"""
JobStreet Malaysia 2025 reference (Hugging Face seemarn/jobstreet, 9,566 postings listed 2025-03-03 to 2025-05-08).

The dataset states no licence, so only aggregates go into the repository: career counts and skill shares, with the
dataset link, revision and SHA-256. The raw file stays in data/reference/jobstreet-2025/raw (git-ignored).

Two stages, so the careers and skills are found by the crawler's own code (same title and skill rules as our
LinkedIn / Indeed collection):
    1. this script: download the pinned revision, check its SHA-256, keep the fields the crawler reads -> raw/rows.jsonl
    2. src/data/scripts/jobstreet-reference.mjs: crawler normalize() on every row -> reference.json, candidates.json

python -I src/data/scripts/import_jobstreet_reference.py [--root data/reference/jobstreet-2025] [--skip-node]
"""
import argparse
import ast
import csv
import hashlib
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ROOT = REPO_ROOT / 'data' / 'reference' / 'jobstreet-2025'
DATASET = 'seemarn/jobstreet'
REVISION = 'c1f4a140d60f405a9736c1fb0de0a0b2dbde7804'
FILE = 'jobstreet_all_job_dataset_2025_skills_ner_clustered.csv'
SHA256 = 'b59db2797edf7567b34aa9cbd64dfc5818d2c870811cbf071f5710aaceb17263'
URL = f'https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/{FILE}'
SOURCE = {'name': 'JobStreet Malaysia job postings 2025 (Hugging Face seemarn/jobstreet)', 'platform': 'JobStreet',
          'url': f'https://huggingface.co/datasets/{DATASET}', 'revision': REVISION, 'file': FILE, 'sha256': SHA256,
          'licence': 'not stated by the dataset; aggregates only, no posting text is redistributed'}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def fetch(raw):
    """The pinned file in raw/, downloaded once; a file whose SHA-256 differs is refused"""
    path = raw / FILE
    if not path.exists():
        raw.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix('.part')
        with urllib.request.urlopen(URL, timeout=600) as response, open(partial, 'wb') as handle:
            shutil.copyfileobj(response, handle)
        partial.replace(path)
    actual = sha256(path)
    if actual != SHA256:
        raise ValueError(f'{FILE}: SHA-256 {actual} is not the pinned {SHA256}')
    return path


def dataset_skills(text):
    try:
        value = ast.literal_eval(text) if text.strip() else []
    except (ValueError, SyntaxError):
        return []
    return [str(skill).strip().lower() for skill in value if str(skill).strip()] if isinstance(value, list) else []


def rows(path):
    """The fields the crawler's normalize() reads, plus JobStreet's own category for the precision check"""
    csv.field_size_limit(1 << 30)
    with open(path, encoding='utf-8', newline='') as handle:
        for row in csv.DictReader(handle):
            listed = row['listingDate'].strip()
            yield {'sourceId': row['job_id'].strip(), 'title': row['job_title'], 'company': row['company'],
                   'location': row['location'], 'country': 'MY', 'description': row['descriptions'],
                   # "2025-03-28 07:13:35+00:00" -> ISO, the form the crawler parses
                   'postedAt': listed.replace(' ', 'T', 1) if listed else None,
                   'category': row['category'], 'subcategory': row['subcategory'],
                   # The dataset's own skill tags (a Python list literal), only to suggest skills for new careers
                   'datasetSkills': dataset_skills(row['skills'])}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    parser.add_argument('--skip-node', action='store_true', help='only write raw/rows.jsonl')
    args = parser.parse_args(argv)
    raw = args.root / 'raw'
    try:
        path = fetch(raw)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    count = 0
    with open(raw / 'rows.jsonl', 'w', encoding='utf-8') as out:
        for row in rows(path):
            out.write(json.dumps(row, ensure_ascii=False) + '\n')
            count += 1
    (args.root / 'source.json').write_text(json.dumps({**SOURCE, 'rows': count}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'rows': count, 'sha256': SHA256}))
    if args.skip_node:
        return 0
    script = REPO_ROOT / 'src' / 'data' / 'scripts' / 'jobstreet-reference.mjs'
    return subprocess.call(['node', str(script), '--root', str(args.root)])


if __name__ == '__main__':
    sys.exit(main())
