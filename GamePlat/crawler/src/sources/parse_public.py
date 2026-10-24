"""Parse public pages locally. HTTP and its domain/budget limits live in Node."""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / 'data/scripts'))
from collect_linkedin import parse_search, parse_detail

data = json.load(sys.stdin)
html, mode, page_url = data['html'], data['mode'], data['url']
country = lambda loc: 'MY' if re.search(r'malaysia|kuala lumpur|selangor|petaling jaya|subang|shah alam|penang|pulau pinang|johor|sarawak|sabah|perak|melaka|kedah|pahang|putrajaya|negeri sembilan', str(loc), re.I) else ''
if mode == 'linkedin-search':
    rows = parse_search(html)
    records = [dict(sourceId=j['source_job_id'], title=j['title_raw'], company=j['company_raw'], location=j['location_raw'],
                    country=country(j['location_raw']), url=j['job_url'], postedAt=j['posted_date'], description='') for j in rows]
    result = {'recognized': bool(rows) or not html.strip() or bool(re.search(r'no (matching |more )?(jobs|results)', html, re.I)), 'records': records}
elif mode == 'linkedin-detail':
    detail = parse_detail(html)
    result = {'recognized': bool(detail['description_raw']), 'detail': detail}
else:
    soup = BeautifulSoup(html, 'html.parser')
    records, links = [], []
    if data['platform'] == 'ricebowl':
        for card in soup.select('mkrb-job-card[job-id][job-title]'):
            try: locations=json.loads(card.get('locations','[]'))
            except ValueError: locations=[]
            loc=', '.join(x.get('label','') for x in locations)
            try: posted=datetime.fromtimestamp(float(card.get('posted-at'))/1000,timezone.utc).isoformat().replace('+00:00','Z')
            except (TypeError,ValueError,OverflowError,OSError): posted=None
            records.append({'sourceId':card['job-id'],'title':card['job-title'],'company':card.get('company'),
                            'location':loc,'country':country(loc),'postedAt':posted,'description':'','url':urljoin(page_url,card.get('href',''))})
    def visit(item):
        if isinstance(item, list):
            for child in item: visit(child)
        elif isinstance(item, dict):
            kinds = item.get('@type', [])
            if isinstance(kinds, str): kinds = [kinds]
            if 'JobPosting' in kinds:
                location = item.get('jobLocation') or {}
                if isinstance(location, list): location = location[0] if location else {}
                address = location.get('address') or {} if isinstance(location, dict) else {}
                c = address.get('addressCountry', '')
                if isinstance(c, dict): c = c.get('name', '')
                employer = item.get('hiringOrganization') or {}
                identity = item.get('identifier') or {}
                if isinstance(identity, dict): identity = identity.get('value')
                records.append({'sourceId': str(identity or item.get('url') or page_url), 'title': item.get('title'),
                    'company': employer.get('name') if isinstance(employer, dict) else employer,
                    'country': c, 'location': ', '.join(str(address.get(k) or '') for k in ['addressLocality','addressRegion','addressCountry']),
                    'description': BeautifulSoup(item.get('description') or '', 'html.parser').get_text(' ', strip=True),
                    'postedAt': item.get('datePosted'), 'url': urljoin(page_url, item.get('url') or page_url)})
            for key, value in item.items():
                if key != 'description' and isinstance(value, (dict, list)): visit(value)
    for script in soup.select('script[type="application/ld+json"]'):
        try: visit(json.loads(script.string or script.get_text()))
        except (ValueError, TypeError): pass
    # Ricebowl's imported-posting template (observed on the Avanade FDE page)
    # has public job-description/company/location DOM instead of JobPosting JSON-LD.
    if data['platform'] == 'ricebowl' and not any(r.get('description') for r in records):
        title_node=soup.select_one('h2.font-bold')
        company_node=soup.select_one('[id^="companyName-id-"]')
        description_node=soup.select_one('#job-description .job-description-content')
        location_node=soup.select_one('#job-locations .job-locations-content')
        identity=re.search(r'/job/([A-Za-z0-9]+)',page_url)
        if title_node and company_node and description_node and location_node and identity:
            loc=location_node.get_text(' ',strip=True)
            records.append({'sourceId':identity.group(1),'title':title_node.get_text(' ',strip=True),
                            'company':company_node.get_text(' ',strip=True),'location':loc,'country':country(loc),
                            'description':description_node.get_text('\n',strip=True),'url':page_url})
    for a in soup.select('a[href]'):
        href = urljoin(page_url, a['href'])
        if data['platform'] == 'ricebowl' and re.search(r'ricebowl\.my/job/[A-Za-z0-9][A-Za-z0-9-]+', href): links.append(href.split('?')[0])
        if data['platform'] == 'indeed' and '/viewjob?' in href and 'jk=' in href: links.append(href)
    if data['platform'] == 'indeed':
        for card in soup.select('[data-jk]'):
            identity = card.get('data-jk')
            if identity: links.append('https://malaysia.indeed.com/viewjob?jk=' + identity)
    empty = bool(re.search(r'no (matching )?(jobs|results)|没有找到|tiada (kerja|jawatan)', soup.get_text(' ', strip=True), re.I))
    result = {'recognized': bool(records or links or empty), 'records': records, 'links': list(dict.fromkeys(links))}
json.dump(result, sys.stdout, ensure_ascii=False)
