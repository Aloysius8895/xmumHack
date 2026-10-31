"""
Online job offerings in Malaysia by occupation, from DOSM's quarterly "Big Data Analytics: Job Market Insights"
releases: the population structure our samples are weighted to (prompt 01e).

The releases quote the total and the three largest MASCO major groups (Professionals, Managers, Technicians and
Associate Professionals); the other six groups are only in charts. So four strata are used: those three and
"others" (the total minus them). Every number is read from its quote on the PDF page; a quote not found stops the
script, and the three groups must not exceed the total. 2026 Q2 comes from the nine groups checked earlier
(src/data/historical/2026-04_onwards). Missing quarters stay missing: 2024 Q1 and 2025 Q2 have no group figures.

python -I src/data/scripts/import_dosm_occupations.py   ->   data/official-signals/dosm-occupations.json
"""
import csv
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

REPO = Path(__file__).resolve().parents[3]
RAW = REPO / 'data' / 'official-signals' / 'raw'
OUT = REPO / 'data' / 'official-signals' / 'dosm-occupations.json'
HISTORY = REPO / 'src' / 'data' / 'historical' / '2026-04_onwards' / 'quarterly_occupation_context.csv'
DOWNLOAD = 'https://www.dosm.gov.my/site/downloadrelease?id={}&lang=English'
GROUPS = ['professionals', 'managers', 'technicians_and_associate_professionals', 'others']
NUMBER = r'([\d,]{5,})'

RELEASES = {
    '2024-Q2': {'file': 'dosm-2024q2.pdf', 'id': 'big-data-analytics-job-market-insights-and-my-job-profile-q224', 'evidence': [
        ('total', 2, r'second quarter of 2024 recorded a decline of 14\.5 per cent, amounting to ' + NUMBER),
        ('professionals', 2, r'Professionals category, accounting for 47\.5 per cent or ' + NUMBER),
        ('managers', 2, r'Managers accounted for 17\.1 per cent \(' + NUMBER),
        ('technicians_and_associate_professionals', 2, r'Technicians and Associate Professionals at 16\.4 per cent \(' + NUMBER),
    ]},
    '2025-Q1': {'file': 'dosm-2025q1.pdf', 'id': 'big-data-analytics-job-market-insights-and-my-job-profile-first-q12025', 'evidence': [
        ('total', 2, r'9 per cent to ' + NUMBER + r', compared with 276,624'),
        ('professionals', 2, r'Professional category, accounting for 48\.0 per cent or ' + NUMBER),
        ('managers', 2, r'Managers recorded ' + NUMBER),
        ('technicians_and_associate_professionals', 2, r'Technicians and Associate Professionals with ' + NUMBER),
    ]},
}


def page_text(path, page):
    return ' '.join((PdfReader(str(path)).pages[page - 1].extract_text() or '').split())


def quote(text, match, width=160):
    return '…' + text[max(0, match.start() - width // 2):match.end() + width // 2].strip() + '…'


def from_release(period, release, raw=RAW):
    counts, sources = {}, []
    for field, page, pattern in release['evidence']:
        text = page_text(raw / release['file'], page)
        match = re.search(pattern, text)
        if not match:
            raise ValueError(f'{period} {field}: "{pattern}" not on page {page} of {release["file"]}')
        counts[field] = int(match.group(1).replace(',', ''))
        sources.append({'field': field, 'url': DOWNLOAD.format(release['id']), 'page': page, 'quote': quote(text, match)})
    return counts, sources


def from_history(period, path=HISTORY):
    with open(path, encoding='utf-8-sig', newline='') as handle:
        rows = [row for row in csv.DictReader(handle) if row['period'] == period and row['aggregation_level'] == 'major_group']
    if len(rows) != 9:
        raise ValueError(f'{period}: {len(rows)} major groups in {path.name}, 9 expected')
    value = {row['occupation']: int(row['value']) for row in rows}
    counts = {'total': sum(value.values()), 'professionals': value['professionals'], 'managers': value['managers'],
              'technicians_and_associate_professionals': value['technicians_and_associate_professionals']}
    return counts, [{'field': 'all', 'url': rows[0]['source_url'], 'page': None, 'quote': 'nine major groups, checked in src/data/historical/2026-04_onwards'}]


def quarter(counts, sources):
    named = sum(counts[group] for group in GROUPS[:3])
    if named > counts['total']:
        raise ValueError(f'the three groups ({named}) exceed the total ({counts["total"]})')
    full = {**{group: counts[group] for group in GROUPS[:3]}, 'others': counts['total'] - named}
    return {'total': counts['total'], 'counts': full, 'shares': {group: round(n / counts['total'], 4) for group, n in full.items()}, 'sources': sources}


def build(raw=RAW, history=HISTORY):
    quarters = {period: quarter(*from_release(period, release, raw)) for period, release in RELEASES.items()}
    quarters['2026-Q2'] = quarter(*from_history('2026-Q2', history))
    return {'about': 'DOSM online job offerings by MASCO major group, four strata (the three groups quoted in the releases and the rest). '
                     'Shares weight our samples; DOSM totals are not used as a trend (its own sources changed, e.g. +108.8% in 2025 Q3).',
            'groups': GROUPS, 'missing': ['2024-Q1', '2025-Q2'], 'quarters': dict(sorted(quarters.items()))}


def main():
    try:
        data = build()
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for period, row in data['quarters'].items():
        print(period, row['total'], {group: f'{share:.1%}' for group, share in row['shares'].items()})
    return 0


if __name__ == '__main__':
    sys.exit(main())
