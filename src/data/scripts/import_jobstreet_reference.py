"""
JobStreet Malaysia history from Hugging Face: postings counted per career by the crawler's own rules.

    jobstreet-2024  azrai99/job-dataset  (CC BY 4.0, Azrai Mahadan), collected Feb-Jun 2024
    jobstreet-2025  seemarn/jobstreet    (no licence stated), collected 2025-03-03 to 2025-05-08

Only aggregates go into the repository: career counts and skill shares, with the dataset link, revision and SHA-256.
Raw files stay in data/reference/<dataset>/raw (git-ignored).

Collection window: a dataset scraped over some weeks also holds older postings that were still open then, a few per
day. Those do not show the demand of their month, so only postings from the collection start are counted: the first
day with at least a fifth of the median daily count of the busiest month. The window runs to the last listing date;
months cut by it are partial.

Two stages, so careers and skills are found exactly as in our LinkedIn / Indeed collection:
    1. this script: download the pinned revision, check its SHA-256, keep the fields the crawler reads -> raw/rows.jsonl
    2. src/data/scripts/jobstreet-reference.mjs: crawler normalize() on every row -> reference.json, candidates.json

python -I src/data/scripts/import_jobstreet_reference.py [--dataset jobstreet-2024|jobstreet-2025|all] [--skip-node]
"""
import argparse
import ast
import csv
import hashlib
import json
import shutil
import statistics
import subprocess
import sys
import urllib.request
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
REFERENCE = REPO_ROOT / 'data' / 'reference'
MYT = timezone(timedelta(hours=8))
START_SHARE = 0.2

DATASETS = {
    'jobstreet-2024': {'repo': 'azrai99/job-dataset', 'revision': 'b1937baac3ad7a2c7f18d0e24b14b00683a49f1d',
                       'file': 'jobstreet_all_job_dataset.csv', 'sha256': '4bdd026944f1c2527402ca5ee7b83d63b3a82e6acaa4c78898a9ee90430b45c7',
                       'name': 'JobStreet Job Postings Dataset (Hugging Face azrai99/job-dataset)', 'author': 'Azrai Mahadan',
                       'licence': 'CC BY 4.0'},
    'jobstreet-2025': {'repo': 'seemarn/jobstreet', 'revision': 'c1f4a140d60f405a9736c1fb0de0a0b2dbde7804',
                       'file': 'jobstreet_all_job_dataset_2025_skills_ner_clustered.csv', 'sha256': 'b59db2797edf7567b34aa9cbd64dfc5818d2c870811cbf071f5710aaceb17263',
                       'name': 'JobStreet Malaysia job postings 2025 (Hugging Face seemarn/jobstreet)', 'author': 'seemarn',
                       'licence': 'not stated by the dataset; aggregates only, no posting text is redistributed'},
}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def fetch(dataset, raw):
    """The pinned file in raw/, downloaded once; a file whose SHA-256 differs is refused"""
    path = raw / dataset['file']
    if not path.exists():
        raw.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix('.part')
        url = f'https://huggingface.co/datasets/{dataset["repo"]}/resolve/{dataset["revision"]}/{dataset["file"]}'
        with urllib.request.urlopen(url, timeout=600) as response, open(partial, 'wb') as handle:
            shutil.copyfileobj(response, handle)
        partial.replace(path)
    actual = sha256(path)
    if actual != dataset['sha256']:
        raise ValueError(f'{dataset["file"]}: SHA-256 {actual} is not the pinned {dataset["sha256"]}')
    return path


def dataset_skills(text):
    try:
        value = ast.literal_eval(text) if text.strip() else []
    except (ValueError, SyntaxError):
        return []
    return [str(skill).strip().lower() for skill in value if str(skill).strip()] if isinstance(value, list) else []


def listed_day(text):
    """Listing date in Malaysia time; "2025-03-28 07:13:35+00:00" and "2024-03-01T02:10:00Z" both parse"""
    return datetime.fromisoformat(text.strip().replace(' ', 'T', 1).replace('Z', '+00:00')).astimezone(MYT).date()


def rows(path):
    """The fields the crawler's normalize() reads, plus JobStreet's own category for the precision check"""
    csv.field_size_limit(1 << 30)
    with open(path, encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            listed = row['listingDate'].strip()
            yield {'sourceId': row['job_id'].strip(), 'title': row['job_title'], 'company': row['company'],
                   'location': row['location'], 'country': 'MY', 'description': row['descriptions'],
                   # ISO, the form the crawler parses
                   'postedAt': listed.replace(' ', 'T', 1) if listed else None,
                   'category': row['category'], 'subcategory': row['subcategory'],
                   # The dataset's own skill tags (a Python list literal) when it has them, only to suggest skills
                   'datasetSkills': dataset_skills(row.get('skills') or '')}


def collection_window(days):
    """(start, end): from the first day with at least START_SHARE of the busiest month's median daily count"""
    counts = Counter(days)
    months = Counter(day.strftime('%Y-%m') for day in days)
    busiest = months.most_common(1)[0][0]
    median = statistics.median(n for day, n in counts.items() if day.strftime('%Y-%m') == busiest)
    start = min(day for day, n in counts.items() if n >= START_SHARE * median)
    return start, max(counts)


def month_end(day):
    following = date(day.year + day.month // 12, day.month % 12 + 1, 1)
    return following - timedelta(days=1)


def window_record(start, end):
    return {'from': start.isoformat(), 'to': end.isoformat(),
            # months the window cuts: their shares hold, their counts cover part of the month only
            'partialMonths': sorted({day.strftime('%Y-%m') for day in (start, end)
                                     if (day == start and day.day > 1) or (day == end and day != month_end(day))}),
            'rule': f'from the first day with at least {START_SHARE:.0%} of the median daily count of the busiest month to the last listing'}


def run(dataset_id, skip_node=False):
    dataset = DATASETS[dataset_id]
    root = REFERENCE / dataset_id
    path = fetch(dataset, root / 'raw')
    count, days = 0, []
    with open(root / 'raw' / 'rows.jsonl', 'w', encoding='utf-8') as out:
        for row in rows(path):
            # ASCII escapes: descriptions hold line separators (U+2028) that would split a JSON line
            out.write(json.dumps(row) + '\n')
            days.append(listed_day(row['postedAt']))
            count += 1
    start, end = collection_window(days)
    source = {'id': dataset_id, 'name': dataset['name'], 'platform': 'JobStreet', 'author': dataset['author'],
              'url': f'https://huggingface.co/datasets/{dataset["repo"]}', 'revision': dataset['revision'],
              'file': dataset['file'], 'sha256': dataset['sha256'], 'licence': dataset['licence'], 'rows': count,
              'collection': window_record(start, end)}
    (root / 'source.json').write_text(json.dumps(source, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'dataset': dataset_id, 'rows': count, 'collection': source['collection']}))
    if skip_node:
        return 0
    return subprocess.call(['node', str(REPO_ROOT / 'src' / 'data' / 'scripts' / 'jobstreet-reference.mjs'), '--root', str(root)])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument('--dataset', choices=[*DATASETS, 'all'], default='all')
    parser.add_argument('--skip-node', action='store_true', help='only write raw/rows.jsonl and source.json')
    args = parser.parse_args(argv)
    try:
        codes = [run(dataset_id, args.skip_node) for dataset_id in (DATASETS if args.dataset == 'all' else [args.dataset])]
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    return max(codes)


if __name__ == '__main__':
    sys.exit(main())
