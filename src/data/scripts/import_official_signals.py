"""
Official Malaysian signals for the game's careers, quoted from the PDFs in data/official-signals/raw:

    critical   listed in TalentCorp's Critical Occupations List (MyCOL), one record per edition
    emerging   named an emerging role (TalentCorp Impact Study), or listed for the first time in a MyCOL edition

Every quote is taken from the PDF page itself: an evidence whose text is not on its page stops the script, so no
quote is typed by hand. Only positive evidence is recorded. Editions differ in scope (2022/2023 covered three
sectors only), so a career missing from an edition is never read as a decline.

python -I src/data/scripts/import_official_signals.py   ->   data/official-signals/signals.json
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[3] / 'data' / 'official-signals'
TALENTCORP = 'https://www.talentcorp.com.my/images/uploads/publication/'

SOURCES = {
    'mycol-2015-2016': {'name': 'Pilot Critical Occupations List 2015/2016', 'period': '2015/2016', 'file': 'mycol-2015-2016-pilot.pdf',
                        'url': TALENTCORP + '157/Pilot-Critical-Occupations-List-20152016-1704363325.pdf', 'scope': 'national, all sectors'},
    'mycol-2016-2017': {'name': 'Critical Occupations List 2016/2017', 'period': '2016/2017', 'file': 'mycol-2016-2017.pdf',
                        'url': TALENTCORP + '165/Critical-Occupations-List-20162017-1704363678.pdf', 'scope': 'national, all sectors'},
    'mycol-2018-2019': {'name': 'Critical Occupations List 2018/2019', 'period': '2018/2019', 'file': 'mycol-2018-2019.pdf',
                        'url': TALENTCORP + '174/Critical-Occupations-List-20182019-1704364085.pdf', 'scope': 'national, all sectors'},
    'mycol-2019-2020': {'name': 'Critical Occupations List 2019/2020', 'period': '2019/2020', 'file': 'mycol-2019-2020.pdf',
                        'url': TALENTCORP + '178/Critical-Occupations-List-20192020-1704364278.pdf', 'scope': 'national, all sectors'},
    'mycol-2020-2021': {'name': 'Critical Occupations List 2020/2021', 'period': '2020/2021', 'file': 'mycol-2020-2021.pdf',
                        'url': TALENTCORP + '184/Critical-Occupations-List-20202021-1704364685.pdf', 'scope': 'national, all sectors'},
    'mycol-2022-2023': {'name': 'Critical Occupations List (MyCOL) 2022/2023', 'period': '2022/2023', 'file': 'mycol-2022-2023.pdf',
                        'url': TALENTCORP + '3/Critical-Occupations-List-MyCOL-20222023-1695267153.pdf',
                        'scope': 'three pilot sectors only: aerospace, construction, manufacturing (food processing)'},
    'mycol-2024-2025': {'name': 'Malaysia Critical Occupations List (MyCOL) 2024/2025', 'period': '2024/2025', 'file': 'mycol-2024-2025.pdf',
                        'url': TALENTCORP + '204/MyMahir-Malaysia-Critical-Occupations-List-MyCOL20242025-1773385490.pdf', 'scope': 'national, 18 industries'},
    'impact-phase2-vol2': {'name': 'Impact Study of AI, Digital and Green Economy on the Malaysian Workforce, Phase 2 Volume 2',
                           'period': '2025', 'file': 'impact-study-phase2-vol2.pdf',
                           'url': TALENTCORP + '230/Impact-Study-of-Artificial-Intelligence-Digital-and-Green-Economy-on-the-Malaysian-Workforce-Phase-2-Volume-2-1791170303.pdf',
                           'scope': 'Communications & Multimedia: telecommunications, broadcasting, postal and courier'},
}

# (source, page, pattern locating the evidence on that page, careers it supports, signal, note)
EVIDENCE = [
    ('mycol-2015-2016', 5, r'Data Scientists; Data Analysts', ['data-analyst', 'data-scientist'], 'critical', None),
    ('mycol-2016-2017', 4, r'Data Scientist, Data Analyst', ['data-analyst', 'data-scientist'], 'critical', 'under Mathematicians, Actuaries and Statisticians (2121)'),
    ('mycol-2018-2019', 5, r'Data Scientist; Data Analyst', ['data-analyst', 'data-scientist'], 'critical', 'under Actuary and Statistician (2121)'),
    ('mycol-2019-2020', 5, r'Data Scientist; Data Analyst', ['data-analyst', 'data-scientist'], 'critical', 'under 2121'),
    ('mycol-2020-2021', 8, r'Data Scientist; Big Data Engineer; Data Analyst', ['data-analyst', 'data-scientist'], 'critical', 'Data Professionals (2524)'),
    ('mycol-2020-2021', 3, r'first time on the 2020/2021 COL', ['data-analyst', 'data-scientist', 'frontend-developer'], 'emerging',
     'Data Professionals and Web and Multimedia Developers appear for the first time'),
    ('mycol-2024-2025', 138, r'Data Scientist, Data Analyst', ['data-analyst', 'data-scientist'], 'critical', None),
    ('mycol-2015-2016', 4, r'Software Developers', ['backend-developer'], 'critical', None),
    ('mycol-2016-2017', 7, r'Software Developers \(2512\)', ['backend-developer'], 'critical', None),
    ('mycol-2018-2019', 9, r'Software Developer \(2512\)', ['backend-developer'], 'critical', None),
    ('mycol-2019-2020', 10, r'Software Developer \(2512\)', ['backend-developer'], 'critical', None),
    ('mycol-2020-2021', 7, r'Software Developers \(2512\)', ['backend-developer'], 'critical', None),
    ('mycol-2022-2023', 7, r'2512 Software Developers', ['backend-developer'], 'critical', None),
    ('mycol-2024-2025', 126, r'Software Developer, Design Engineer', ['backend-developer'], 'critical', None),
    ('mycol-2020-2021', 8, r'Machine Learning Engineer; Artificial Intelligence Engineer', ['ml-engineer'], 'critical', 'Data Professionals (2524)'),
    ('mycol-2019-2020', 11, r'Machine Learning Engineer', ['ml-engineer'], 'critical', None),
    ('impact-phase2-vol2', 12, r'AI engineers and data scientists', ['ml-engineer', 'data-scientist'], 'emerging', '60 emerging roles, 43 of them AI and digital'),
    ('mycol-2015-2016', 10, r'Web Designers; Graphics And Sound Specialists', ['ui-ux-designer'], 'critical', 'Graphic and Multimedia Designers (2166)'),
    ('mycol-2016-2017', 6, r'Graphic and Multimedia Designers \(2166\)', ['ui-ux-designer'], 'critical', None),
    ('mycol-2018-2019', 7, r'Graphic and Multimedia Designer \(2166\)', ['ui-ux-designer'], 'critical', None),
    ('mycol-2019-2020', 8, r'Graphic and Multimedia Designer \(2166\)', ['ui-ux-designer'], 'critical', None),
    ('mycol-2020-2021', 9, r'UI Designer \(User Interface\)', ['ui-ux-designer'], 'critical', 'Graphic and Multimedia Designers (2166)'),
    ('mycol-2024-2025', 96, r'This occupation is included in the MyCOL', ['ui-ux-designer'], 'critical', 'designers, validated with stakeholders (MDEC)'),
    ('mycol-2016-2017', 3, r'Market Research Manager, Product Manager', ['product-manager'], 'critical', 'a job title under Sales and Marketing Managers'),
    ('mycol-2018-2019', 4, r'Market Research Manager; Product Manager', ['product-manager'], 'critical', 'a job title under Sales and Marketing Managers'),
    ('mycol-2019-2020', 4, r'Market Research Manager; Product Manager', ['product-manager'], 'critical', 'a job title under Sales and Marketing Managers'),
    ('mycol-2015-2016', 11, r'Accountants; Auditors', ['auditor'], 'critical', None),
    ('mycol-2016-2017', 7, r'Financial Controller, Auditor', ['auditor'], 'critical', 'under Accountants (2411)'),
    ('mycol-2018-2019', 8, r'Auditor; Audit Executive', ['auditor'], 'critical', 'under Accountant (2411)'),
    ('mycol-2019-2020', 9, r'Auditor; Audit Executive', ['auditor'], 'critical', 'under Accountant (2411)'),
    ('mycol-2020-2021', 6, r'Auditor; Internal Auditor', ['auditor'], 'critical', 'under Accountants (2411)'),
    ('mycol-2024-2025', 114, r'Auditor, Internal Auditor', ['auditor'], 'critical', None),
    ('mycol-2015-2016', 16, r'Lawyers \(2611\)', ['lawyer'], 'critical', None),
    ('mycol-2018-2019', 141, r'GENERALIST MEDICAL PRACTITIONERS', ['doctor'], 'critical', '2211'),
    ('mycol-2019-2020', 8, r'Specialist Medical Practitioner \(2212\)', ['doctor'], 'critical', None),
    ('mycol-2020-2021', 6, r'Specialist Medical Professionals \(2212\)', ['doctor'], 'critical', None),
    ('mycol-2024-2025', 102, r'Physician, Physician \(Haematology\)', ['doctor'], 'critical', 'specialists'),
    ('mycol-2018-2019', 11, r'Chef \(3641\)', ['chef'], 'critical', None),
    ('mycol-2015-2016', 6, r'Civil Engineers \(2142\)', ['civil-engineer'], 'critical', None),
    ('mycol-2018-2019', 5, r'Civil Engineer \(2142\)', ['civil-engineer'], 'critical', None),
    ('mycol-2019-2020', 6, r'Civil Engineer \(2142\)', ['civil-engineer'], 'critical', None),
    ('mycol-2020-2021', 5, r'Civil Engineers \(2142\)', ['civil-engineer'], 'critical', None),
    ('mycol-2022-2023', 7, r'2142 Civil Engineers', ['civil-engineer'], 'critical', None),
    ('mycol-2024-2025', 82, r'Engineer, Civil Engineer', ['civil-engineer'], 'critical', None),
]


def page_texts(path, cache={}):
    if path not in cache:
        cache[path] = [re.sub(r'\s+', ' ', page.extract_text() or '') for page in PdfReader(path).pages]
    return cache[path]


def quote(text, match, width=200):
    start, end = max(0, match.start() - width // 2), min(len(text), match.end() + width)
    return ('…' if start else '') + text[start:end].strip() + ('…' if end < len(text) else '')


def build(root=ROOT, evidence=EVIDENCE, sources=SOURCES):
    signals, errors = [], []
    for source_id, page, pattern, careers, signal, note in evidence:
        source = sources[source_id]
        pages = page_texts(root / 'raw' / source['file'])
        match = re.search(pattern, pages[page - 1]) if 0 < page <= len(pages) else None
        if not match:
            errors.append(f'{source_id} p{page}: pattern not found: {pattern}')
            continue
        for career in careers:
            signals.append({'id': career, 'kind': 'career', 'signal': signal, 'source': source['name'], 'sourceId': source_id,
                            'period': source['period'], 'url': source['url'], 'page': page, 'scope': source['scope'],
                            'quote': quote(pages[page - 1], match), 'note': note})
    return signals, errors


def main():
    signals, errors = build()
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    data = {'about': 'Official Malaysian signals, positive evidence only; quotes extracted from the PDF pages.',
            'sources': {key: {k: v for k, v in source.items() if k != 'file'} for key, source in SOURCES.items()},
            'signals': signals}
    (ROOT / 'signals.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    by_career = {}
    for row in signals:
        by_career.setdefault(row['id'], set()).add(f'{row["signal"]} {row["period"]}')
    print(json.dumps({'signals': len(signals), 'careers': {k: sorted(v) for k, v in sorted(by_career.items())}}, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
