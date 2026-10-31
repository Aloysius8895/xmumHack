"""
AI usage per career over several Anthropic Economic Index releases (CC-BY), for the trend classification of the
scenarios (src/game/server/aei-evidence.js).

Metric (the same in every release): per O*NET task, the automation share of the five collaboration patterns,
    (directive + feedback loop) / (directive + feedback loop + task iteration + validation + learning)
leaving out what no pattern describes ("filtered" in release_2025_03_27, "none" and "not_classified" later).
A career's value is the mean over its mapped tasks (the tasks exposure.json counts: reviewed skills of reviewed
careers, data/ai-exposure/skill_task_map.json) that have a split in every release, so all periods compare the same tasks.

release_2025_03_27 is read from data/ai-exposure/raw; later releases from their raw long-format file
(facet onet_task::collaboration, variable onet_task_collaboration_pct), downloaded beside it:

python -I src/data/scripts/build_aei_periods.py --release release_2025_09_15=<path to aei_raw_claude_ai_2025-08-04_to_2025-08-11.csv>

Writes data/ai-exposure/periods.json.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_ai_exposure import DEFAULT_ROOT, norm  # noqa: E402

AUTOMATION = ('directive', 'feedback_loop')
PATTERNS = ('directive', 'feedback_loop', 'task_iteration', 'validation', 'learning')
BASE = 'release_2025_03_27'
DATASET = 'https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/'


def share(parts):
    total = sum(parts.get(p, 0) for p in PATTERNS)
    return sum(parts.get(p, 0) for p in AUTOMATION) / total if total > 0 else None


def read_base(raw):
    """release_2025_03_27, wide: one row per task with the share of each pattern"""
    with open(raw / 'automation_vs_augmentation_by_task.csv', encoding='utf-8') as handle:
        return {norm(row['task_name']): share({p: float(row[p]) for p in PATTERNS}) for row in csv.DictReader(handle)}


def read_long(path):
    """A later release, long: rows 'task::pattern' of onet_task_collaboration_pct (global); returns shares and the dates"""
    parts, dates = {}, set()
    with open(path, encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            if row['facet'] != 'onet_task::collaboration' or row['variable'] != 'onet_task_collaboration_pct' or row['geo_id'] != 'GLOBAL':
                continue
            task, _, pattern = row['cluster_name'].rpartition('::')
            parts.setdefault(norm(task), {})[pattern.strip().replace(' ', '_')] = float(row['value'])
            dates.add((row['date_start'], row['date_end'], row['platform_and_product']))
    return {task: share(p) for task, p in parts.items()}, sorted(dates)


def career_tasks(root):
    """The tasks each reviewed career counts in exposure.json: matched by its reviewed skills, minus exclusions"""
    mapping = json.loads((root / 'skill_task_map.json').read_text(encoding='utf-8'))
    occupations = {}
    with open(root / 'raw' / 'onet_task_statements.csv', encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            occupations.setdefault(row['O*NET-SOC Code'], []).append(row['Task'].strip())
    careers = {}
    for career, entry in mapping['careers'].items():
        if entry.get('reviewed') is False:
            continue
        tasks = list(dict.fromkeys(t for code in entry['onet'] for t in occupations.get(code, [])))
        chosen = set()
        for skill in entry['skills']:
            rule = mapping['skills'].get(skill)
            if not rule or rule.get('reviewed') is not True:
                continue
            excluded = {norm(t) for t in rule.get('exclude', [])}
            chosen |= {norm(t) for t in tasks if re.search(rule['pattern'], t, re.I) and norm(t) not in excluded}
        careers[career] = sorted(chosen)
    return careers


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    parser.add_argument('--release', action='append', default=[], help='name=path of a later release raw file')
    args = parser.parse_args(argv)
    shares = {BASE: read_base(args.root / 'raw')}
    releases = {BASE: {'file': f'{BASE}/automation_vs_augmentation_by_task.csv', 'dates': None}}
    for item in args.release:
        name, _, path = item.partition('=')
        values, dates = read_long(Path(path))
        shares[name] = values
        releases[name] = {'file': str(Path(path).name), 'url': DATASET + f'{name}/data/intermediate/{Path(path).name}', 'sha256': sha256(path),
                          'dates': [{'from': start, 'to': end, 'platform': platform} for start, end, platform in dates]}
    careers = {}
    for career, tasks in career_tasks(args.root).items():
        paired = [t for t in tasks if all(values.get(t) is not None for values in shares.values())]
        careers[career] = {'mappedTasks': len(tasks), 'pairedTasks': len(paired),
                           'automationShare': {name: round(sum(values[t] for t in paired) / len(paired), 4) if paired else None
                                               for name, values in shares.items()}}
    out = {
        'about': __doc__.strip().splitlines()[0] + ' Written by src/data/scripts/build_aei_periods.py.',
        'metric': 'automation-share',
        'definition': '(directive + feedback loop) / (directive + feedback loop + task iteration + validation + learning) per O*NET task; '
                      'patterns no category describes are left out; per career the mean over its mapped tasks present in every release',
        'releases': releases,
        'careers': careers,
    }
    (args.root / 'periods.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for career, row in careers.items():
        print(f'  {career:26} {row["pairedTasks"]:3}/{row["mappedTasks"]:3}  {row["automationShare"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
