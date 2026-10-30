"""Bounded collection of public LinkedIn job pages. No login, cookies or proxies."""
import argparse
import hashlib
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8') as handle:
        json.dump(obj, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write('\n')


def text_at(soup, selector):
    node = soup.select_one(selector)
    return node.get_text(' ', strip=True) if node else None


def parse_search(html):
    soup = BeautifulSoup(html, 'html.parser')
    jobs = []
    for card in soup.select('[data-entity-urn]'):
        urn = card.get('data-entity-urn', '')
        if not urn.startswith('urn:li:jobPosting:'):
            continue
        link = card if card.name == 'a' and card.get('href') else card.select_one('a.base-card__full-link')
        date = card.select_one('time')
        jobs.append({
            'source': 'linkedin', 'source_job_id': urn.split(':')[-1],
            'job_url': link['href'].split('?')[0] if link else None,
            'title_raw': text_at(card, '.base-search-card__title'),
            'company_raw': text_at(card, '.base-search-card__subtitle'),
            'location_raw': text_at(card, '.job-search-card__location'),
            'posted_date': date.get('datetime') if date else None,
        })
    return jobs


def parse_detail(html):
    soup = BeautifulSoup(html, 'html.parser')
    description = soup.select_one('.show-more-less-html__markup')
    criteria = {}
    for item in soup.select('.description__job-criteria-item'):
        name = text_at(item, '.description__job-criteria-subheader')
        value = text_at(item, '.description__job-criteria-text')
        if name:
            criteria[name] = value
    apply = soup.select_one('a.apply-button')
    return {
        'title_raw': text_at(soup, '.top-card-layout__title'),
        'company_raw': text_at(soup, '.topcard__org-name-link'),
        'location_raw': text_at(soup, '.topcard__flavor--bullet'),
        'description_raw': description.get_text('\n', strip=True) if description else None,
        'employment_type': criteria.get('Employment type'),
        'seniority': criteria.get('Seniority level'),
        'criteria_raw': criteria,
        'posted_relative_raw': text_at(soup, '.posted-time-ago__text'),
        'apply_url': apply.get('href') if apply else None,
        'closed_explicitly': 'No longer accepting applications' in soup.get_text(' ', strip=True),
    }


class Collector:
    def __init__(self, directory, budget, interval):
        self.directory = directory
        self.budget = budget
        self.interval = interval
        self.lock = threading.Lock()
        self.requests = []
        self.next_request = 0
        self.blocked = False

    def fetch(self, url, kind, context):
        for attempt in range(3):
            with self.lock:
                if self.blocked or len(self.requests) >= self.budget:
                    return None, None
                delay = max(0, self.next_request - time.monotonic())
                self.next_request = time.monotonic() + delay + self.interval
                request_no = len(self.requests) + 1
                record = {'number': request_no, 'url': url, 'kind': kind,
                          'context': context, 'attempt': attempt + 1, 'started_at': utc_now()}
                self.requests.append(record)
            time.sleep(delay)
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.8'})
                with urllib.request.urlopen(request, timeout=25) as response:
                    # Reject authentication redirects; do not use a signed-in session.
                    if '/authwall' in response.url or '/login' in response.url:
                        raise PermissionError('authentication_required')
                    body = response.read(2_000_001)
                    if len(body) > 2_000_000:
                        raise ValueError('response_too_large')
                    html = body.decode('utf-8', errors='replace')
                    filename = f'{kind}/{request_no:04d}-{hashlib.sha256(url.encode()).hexdigest()[:12]}.html'
                    target = self.directory / filename
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(body)
                    record.update(status=response.status, bytes=len(body), raw_file=filename,
                                  sha256=hashlib.sha256(body).hexdigest(), finished_at=utc_now())
                    return html, filename
            except urllib.error.HTTPError as exc:
                record.update(status=exc.code, error=f'http_{exc.code}', finished_at=utc_now())
                if exc.code in (401, 403, 999):
                    self.blocked = True
                    break
                if exc.code == 429:
                    # One delayed retry; sustained rate limits stop this collection.
                    if attempt >= 1:
                        self.blocked = True
                        break
                    time.sleep(30)
                elif exc.code >= 500 and attempt < 2:
                    time.sleep(2 ** attempt)
                else:
                    break
            except PermissionError:
                record.update(error='authentication_required', finished_at=utc_now())
                self.blocked = True
                break
            except Exception as exc:
                record.update(error=type(exc).__name__, finished_at=utc_now())
                if attempt < 2:
                    time.sleep(2 ** attempt)
        return None, None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pages', type=int, default=1)
    parser.add_argument('--budget', type=int, default=260)
    parser.add_argument('--max-details', type=int, default=180)
    parser.add_argument('--interval', type=float, default=1.5)
    parser.add_argument('--career', action='append', dest='career_ids', help='Limit collection to a catalog career; repeat for multiple careers')
    parser.add_argument('--location', action='append', dest='locations', help='Search location stratum; repeat to broaden coverage')
    parser.add_argument('--posted-days', type=int, default=30)
    parser.add_argument('--sort-by', choices=['DD', 'R'], default='DD')
    args = parser.parse_args()
    if not 1 <= args.pages <= 5 or not 1 <= args.budget <= 1000 or not 0 <= args.max_details <= 600 or args.interval < 1 or not 1 <= args.posted_days <= 365:
        parser.error('pages 1..5, budget 1..1000, details 0..600, interval >= 1s')
    started = utc_now()
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    directory = ROOT / 'raw' / f'linkedin-{run_id}'
    directory.mkdir(parents=True, exist_ok=False)
    catalog = json.loads((ROOT / 'config/catalog.json').read_text(encoding='utf-8'))
    if args.career_ids:
        unknown = set(args.career_ids) - {career['id'] for career in catalog['careers']}
        if unknown:
            parser.error('Unknown careers: ' + ', '.join(sorted(unknown)))
        catalog['careers'] = [career for career in catalog['careers'] if career['id'] in args.career_ids]
    locations = list(dict.fromkeys(args.locations or ['Malaysia']))
    collector = Collector(directory, args.budget, args.interval)
    observations = []
    searches = []
    # First cover every career once, then its second alias; this reduces budget bias.
    queries = [(career, alias, location) for i in range(2) for location in locations for career in catalog['careers'] for alias in career['aliases'][i:i+1]]
    for career, alias, location in queries:
        for page in range(args.pages):
            params = urllib.parse.urlencode({'keywords': alias, 'location': location, 'start': page * 10,
                                           'sortBy': args.sort_by, 'f_TPR': f'r{args.posted_days * 86400}'})
            url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?' + params
            context = {'career_id_hint': career['id'], 'query': alias, 'location': location, 'page': page + 1, 'offset': page * 10,
                       'sort_by': args.sort_by, 'posted_days': args.posted_days}
            html, raw_file = collector.fetch(url, 'search', context)
            if html is None:
                searches.append({**context, 'status': 'failed', 'returned': None})
                break
            jobs = parse_search(html)
            searches.append({**context, 'status': 'success', 'returned': len(jobs), 'raw_file': raw_file,
                             'page_cap_reached': bool(jobs) and page + 1 == args.pages})
            for job in jobs:
                observations.append({**job, 'discovery': context, 'raw_search_file': raw_file, 'collected_at': utc_now()})
            if not jobs:
                break
        print(f"search {career['id']} / {alias}: {len(observations)} observations", flush=True)
        if collector.blocked:
            break
    write_json(directory / 'observations.json', observations)
    unique = {}
    for job in observations:
        unique.setdefault(job['source_job_id'], job)
    # Round-robin selection across careers, rather than all details for the first query.
    groups = {career['id']: [] for career in catalog['careers']}
    for job in unique.values():
        groups[job['discovery']['career_id_hint']].append(job)
    selected = []
    for index in range(max((len(group) for group in groups.values()), default=0)):
        for group in groups.values():
            if index < len(group) and len(selected) < args.max_details:
                selected.append(group[index])

    def detail(job):
        url = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/' + job['source_job_id']
        html, raw_file = collector.fetch(url, 'detail', {'source_job_id': job['source_job_id']})
        if html is None:
            return {'source_job_id': job['source_job_id'], 'detail_status': 'failed'}
        parsed = parse_detail(html)
        return {**parsed, 'source_job_id': job['source_job_id'], 'raw_detail_file': raw_file,
                'collected_at': utc_now(), 'detail_status': 'success' if parsed['description_raw'] else 'missing_description'}

    details = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        for item in pool.map(detail, selected):
            details.append(item)
            if len(details) % 20 == 0:
                print(f'details {len(details)}/{len(selected)}', flush=True)
    write_json(directory / 'details.json', details)
    write_json(directory / 'requests.json', collector.requests)
    failures = sum('error' in r for r in collector.requests)
    manifest = {
        'schema_version': 1, 'run_id': run_id, 'source': 'linkedin', 'started_at': started, 'finished_at': utc_now(),
        'settings': vars(args), 'catalog_version': catalog['version'], 'searches': searches,
        'searches_expected': len(queries) * args.pages,
        'searches_successful': sum(s['status'] == 'success' for s in searches),
        'observations': len(observations), 'unique_source_jobs': len(unique), 'duplicates': len(observations) - len(unique),
        'details_selected': len(selected), 'details_successful': sum(d['detail_status'] == 'success' for d in details),
        'request_count': len(collector.requests), 'requests_failed': failures,
        'access_blocked': collector.blocked, 'budget_reached': len(collector.requests) >= args.budget,
        'detail_cap_reached': len(unique) > len(selected),
        'status': 'partial_success' if observations and (failures or collector.blocked or len(details) < len(unique)) else ('success' if observations else 'failed'),
        'coverage': 'Bounded ranked search sample, not all Malaysia jobs; page cap does not imply source exhaustion.',
    }
    write_json(directory / 'manifest.json', manifest)
    print(json.dumps({'directory': str(directory.relative_to(ROOT)), **{k: manifest[k] for k in ['status', 'unique_source_jobs', 'details_successful', 'request_count']}}), flush=True)


if __name__ == '__main__':
    main()
