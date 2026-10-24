"""Read pinned public active/closed archives for dated Malaysia FDE advertisements, April–September 2026."""
import hashlib
import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

extra = Path(os.environ.get('TEMP', '.')) / 'careersphere-history-deps'
if extra.exists():
    sys.path.insert(0, str(extra))
import duckdb

ROOT = Path(__file__).resolve().parents[1]
REPO = 'scholarweave/Jobs-Dataset-v2'
PATTERN = r'(?i)forward[ -]+deploy(?:ed|ment)\s+(?:(?:software|ai|genai)\s+)?engineer'


def get_json(url):
    response = requests.get(url, timeout=35)
    response.raise_for_status()
    return response.json()


def scan(item):
    revision, entry = item
    url = f'https://huggingface.co/datasets/{REPO}/resolve/{revision}/{entry["path"]}'
    db = duckdb.connect()
    try:
        db.execute('LOAD httpfs')
        db.execute('SET threads=1')
        db.execute('SET http_timeout=25')
        rows = db.execute("""
            SELECT title,country,cast(posted_at AS VARCHAR),apply_url,company_id
            FROM read_parquet(?, hive_partitioning=false)
            WHERE country='Malaysia' AND regexp_matches(title,?)
              AND try_cast(posted_at AS TIMESTAMPTZ) >= TIMESTAMPTZ '2026-04-01 00:00:00+08'
              AND try_cast(posted_at AS TIMESTAMPTZ) < TIMESTAMPTZ '2026-10-01 00:00:00+08'
        """, [url, PATTERN]).fetchall()
        return entry['path'], rows, None
    except Exception as error:
        return entry['path'], [], str(error)[:300]
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--retry-failed', action='store_true')
    args = parser.parse_args()
    output = ROOT / 'historical/fde_2026'
    previous = json.loads((output/'verification.json').read_text(encoding='utf-8')) if args.retry_failed else None
    revision = previous['source_revision'] if previous else get_json(f'https://huggingface.co/api/datasets/{REPO}')['sha']
    files = []
    if previous:
        files = [{'path':entry['file']} for entry in previous['files_failed']]
    else:
        for folder in ['data/active/minimal/current','data/closed/minimal']:
            entries = get_json(f'https://huggingface.co/api/datasets/{REPO}/tree/{revision}/{folder}?recursive=true&expand=false&limit=1000')
            files.extend(entry for entry in entries if entry.get('type') == 'file' and entry['path'].endswith('.parquet'))
    output.mkdir(parents=True, exist_ok=True)
    records, errors, completed = {}, [], 0
    if previous:
        records = {row['canonical_id']:row for row in json.loads((output/'observations.json').read_text(encoding='utf-8'))}
    with ThreadPoolExecutor(max_workers=4) as pool:
        tasks = [pool.submit(scan, (revision, entry)) for entry in files]
        for task in as_completed(tasks):
            filename, rows, error = task.result()
            completed += 1
            if error:
                errors.append({'file':filename,'error':error})
            for title, country, posted, url, company in rows:
                if not url or not re.search(PATTERN, title):
                    continue
                posted_date = datetime.fromisoformat(posted).astimezone(timezone(timedelta(hours=8))).date().isoformat()
                key = url.split('#')[0]
                record = {'canonical_id':key,'career_id':'forward-deployed-engineer','title':title,'country':'MY',
                          'company_id':company,'posted_date':posted_date,'period':posted_date[:7],'url':url,
                          'source':'OpenJobData','source_file':filename,'source_revision':revision,'mock':False}
                if key not in records or posted_date < records[key]['posted_date']:
                    records[key] = record
            if completed % 20 == 0 or completed == len(files):
                print(json.dumps({'scanned':completed,'files':len(files),'unique_dated_fde':len(records),'failed':len(errors)}), flush=True)
    rows = sorted(records.values(), key=lambda row:(row['period'],row['canonical_id']))
    payload = (json.dumps(rows,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    (output/'observations.json').write_bytes(payload)
    counts = {period:sum(row['period']==period for row in rows) for period in [f'2026-{month:02}' for month in range(4,10)]}
    manifest = {'checked_at':datetime.now(timezone.utc).isoformat(),'source_url':f'https://huggingface.co/datasets/{REPO}',
                'source_revision':revision,'source_license':'apache-2.0','files_scanned':previous['files_scanned'] if previous else completed,'files_failed':errors,
                'artifact_sha256':{'observations.json':hashlib.sha256(payload).hexdigest()},'monthly_known_ads':counts,
                'scope':'Known dated Malaysia FDE advertisements in public active and closed archives, not complete population totals. Missing matches do not establish zero demand.',
                'deduplication':'Original apply URL, keeping earliest observed posted date within the requested history window.'}
    (output/'verification.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'directory':str(output),'monthly_known_ads':counts,'files_failed':len(errors)}),flush=True)


if __name__ == '__main__':
    main()
