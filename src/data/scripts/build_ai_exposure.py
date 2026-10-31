"""
AI exposure of the catalog skills from the Anthropic Economic Index (data/ai-exposure/raw, CC-BY).

Which tasks count (data/ai-exposure/skill_task_map.json, v2): for every career, all task statements of its O*NET
occupations that match a skill's pattern, minus the ones a reviewer excluded. Nothing is picked by hand and nothing
is ranked by AI penetration, so tasks where no AI use was observed weigh in like the others.

For each task:
    automation   = penetration x share of automation-type interactions   (directive + feedback_loop)
    augmentation = penetration x share of augmentation-type interactions (task_iteration + validation + learning)
shares over the interactions with enough data (1 - filtered). A task with penetration > 0 but no interaction split
uses the mean split of its career's tasks. A skill is the mean of its tasks within each career, then the mean over
the careers that need it. Tasks missing from the penetration file are left out and counted.

A career marked "reviewed": false (one added after the review) shows in the review sheet and the draft only: its tasks
do not reach exposure.json until it is reviewed, so the values already reviewed do not move.

Writes, in data/ai-exposure:
    exposure.json        reviewed skills only: the file the game reads (server/ai-exposure.js)
    exposure.draft.json  every skill with tasks, for the review; the game never reads it
    REVIEW.md            the review sheet, with the career-level cross-check against AEI's job exposure

python -I src/data/scripts/build_ai_exposure.py [--root data/ai-exposure]
"""
import argparse
import csv
import json
import re
import sys
from datetime import date
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parents[3] / 'data' / 'ai-exposure'
AUTOMATION = ('directive', 'feedback_loop')
AUGMENTATION = ('task_iteration', 'validation', 'learning')
SOURCE = {
    'name': 'Anthropic Economic Index',
    'url': 'https://huggingface.co/datasets/Anthropic/EconomicIndex',
    'files': ['labor_market_impacts/task_penetration.csv', 'labor_market_impacts/job_exposure.csv',
              'release_2025_03_27/automation_vs_augmentation_by_task.csv', 'release_2025_03_27/onet_task_statements.csv'],
    'license': 'CC-BY (data)',
    'downloadedAt': '2026-10-30',
    'method': 'every task of the career\'s O*NET occupations matching the skill (reviewed, none ranked by penetration); '
              'per task penetration x share of automation (directive, feedback_loop) or augmentation (task_iteration, validation, '
              'learning) interactions; per skill the mean over its tasks, then over the careers that need it',
    'limits': 'Usage of Claude on US O*NET tasks: a signal of where AI enters work, not jobs lost and not Malaysian data.',
}


def norm(text):
    return ' '.join(text.strip().lower().split())


def read_sources(raw):
    with open(raw / 'task_penetration.csv', encoding='utf-8') as handle:
        penetration = {norm(row['task']): float(row['penetration']) for row in csv.DictReader(handle)}
    split = {}
    with open(raw / 'automation_vs_augmentation_by_task.csv', encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            rest = 1 - float(row['filtered'])
            if rest > 0.001:
                split[norm(row['task_name'])] = (sum(float(row[k]) for k in AUTOMATION) / rest, sum(float(row[k]) for k in AUGMENTATION) / rest)
    occupations = {}
    with open(raw / 'onet_task_statements.csv', encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            occupations.setdefault(row['O*NET-SOC Code'], []).append(row['Task'].strip())
    with open(raw / 'job_exposure.csv', encoding='utf-8') as handle:
        jobs = {row['occ_code']: {'title': row['title'], 'observedExposure': float(row['observed_exposure'])} for row in csv.DictReader(handle)}
    return penetration, split, occupations, jobs


def task_rows(tasks, penetration, split):
    """Per task: penetration, automation, augmentation; tasks without penetration data are returned apart"""
    known = [t for t in tasks if norm(t) in penetration]
    with_split = [split[norm(t)] for t in known if norm(t) in split]
    fallback = (sum(s[0] for s in with_split) / len(with_split), sum(s[1] for s in with_split) / len(with_split)) if with_split else (0.5, 0.5)
    rows = []
    for task in known:
        pen = penetration[norm(task)]
        automation, augmentation = split.get(norm(task), fallback)
        rows.append({'task': task, 'penetration': round(pen, 4), 'automation': round(pen * automation, 4),
                     'augmentation': round(pen * augmentation, 4), 'splitFromCareer': norm(task) not in split and pen > 0})
    return rows, [t for t in tasks if norm(t) not in penetration]


def mean(values):
    values = list(values)
    return round(sum(values) / len(values), 4) if values else None


def build(root, reviewed_careers_only=False):
    mapping = json.loads((root / 'skill_task_map.json').read_text(encoding='utf-8'))
    penetration, split, occupations, jobs = read_sources(root / 'raw')
    errors, per_skill, careers = [], {skill: {} for skill in mapping['skills']}, {}
    for career, entry in mapping['careers'].items():
        tasks = list(dict.fromkeys(t for code in entry['onet'] for t in occupations.get(code, [])))
        if not tasks:
            errors.append(f'{career}: no O*NET tasks for {entry["onet"]}')
            continue
        all_rows, missing = task_rows(tasks, penetration, split)
        counted = not (reviewed_careers_only and entry.get('reviewed') is False)
        for skill in entry['skills']:
            rule = mapping['skills'].get(skill)
            if rule is None:
                errors.append(f'{career}: skill {skill} has no pattern')
                continue
            excluded = {norm(t) for t in rule.get('exclude', [])}
            rows = [r for r in all_rows if re.search(rule['pattern'], r['task'], re.I) and norm(r['task']) not in excluded]
            if rows and counted:
                per_skill[skill][career] = rows
        job = jobs.get(entry['soc'])
        careers[career] = {'onet': entry['onet'], 'soc': entry['soc'], 'title': job['title'] if job else None,
                           'reviewed': entry.get('reviewed') is not False,
                           'observedExposure': job['observedExposure'] if job else None,
                           'tasks': len(tasks), 'tasksWithoutPenetration': len(missing),
                           'allTasks': {'automation': mean(r['automation'] for r in all_rows), 'augmentation': mean(r['augmentation'] for r in all_rows)}}
    skills = {}
    for skill, by_career in per_skill.items():
        rule = mapping['skills'][skill]
        means = [(mean(r['automation'] for r in rows), mean(r['augmentation'] for r in rows)) for rows in by_career.values()]
        skills[skill] = {'reviewed': rule.get('reviewed') is True, 'pattern': rule['pattern'], 'note': rule.get('note'),
                         'automation': mean(m[0] for m in means), 'augmentation': mean(m[1] for m in means),
                         'careers': by_career, 'tasks': sorted({r['task'] for rows in by_career.values() for r in rows})}
    return skills, careers, errors


def career_check(skills, careers, mapping):
    """Our skill-based exposure per career next to AEI's job exposure: (rows, spearman)"""
    rows = []
    for career, row in careers.items():
        values = [skills[s]['automation'] + skills[s]['augmentation'] for s in mapping['careers'][career]['skills'] if skills.get(s, {}).get('automation') is not None]
        rows.append((career, row['observedExposure'], round(sum(values) / len(values), 4) if values else None))
    pairs = [(a, b) for _, a, b in rows if a is not None and b is not None]
    def ranks(values):
        order = sorted(range(len(values)), key=lambda i: values[i])
        out = [0] * len(values)
        for rank, i in enumerate(order):
            out[i] = rank + 1
        return out
    if len(pairs) < 3:
        return rows, None
    ra, rb, n = ranks([p[0] for p in pairs]), ranks([p[1] for p in pairs]), len(pairs)
    return rows, round(1 - 6 * sum((x - y) ** 2 for x, y in zip(ra, rb)) / (n * (n * n - 1)), 2)


def usable(skills, reviewed_only):
    return {skill: {'automation': row['automation'], 'augmentation': row['augmentation'], 'tasks': row['tasks'], 'note': row['note']}
            for skill, row in skills.items() if row['tasks'] and (row['reviewed'] or not reviewed_only)}


def review_sheet(skills, careers, check, rho):
    lines = ['# AI exposure mapping review (v2, checkpoint 2)', '',
             f'Generated {date.today().isoformat()}. Source: {SOURCE["name"]} ({SOURCE["url"]}), {SOURCE["license"]}.', '',
             '**How tasks are chosen**: nobody picks them and nothing is ranked by AI penetration. Every task of the career\'s O*NET '
             'occupations that matches the skill\'s pattern counts, including tasks with no observed AI use (penetration 0).', '',
             '**How to review**: for each skill, look at the tasks listed under each career and **only remove the irrelevant ones**: add '
             'the task text to that skill\'s `exclude` list in `skill_task_map.json`, or change its `pattern`. Then set `reviewed` to '
             '`true` and run the script again.', '',
             f'**Method**: {SOURCE["method"]}.', '', f'**Limits**: {SOURCE["limits"]}', '',
             f'## Career-level cross-check (against AEI\'s own job exposure; Spearman rank correlation = {rho})', '',
             '| Career | AEI job exposure | Ours from skills (automation + augmentation) | O*NET tasks | Tasks without penetration data |', '|---|---|---|---|---|']
    lines += [f'| {career} | {aei} | {ours} | {careers[career]["tasks"]} | {careers[career]["tasksWithoutPenetration"]} |' for career, aei, ours in check]
    lines.append('')
    for skill, row in skills.items():
        status = '✅ reviewed' if row['reviewed'] else '☐ to review'
        result = 'no matching task → shown as "no source"' if not row['tasks'] else f'automation **{row["automation"]}**, augmentation **{row["augmentation"]}**'
        lines += [f'## {skill}　{status}', '', f'Pattern: `{row["pattern"]}` → {result}', '']
        if row['note']:
            lines += [f'Reviewer note: {row["note"]}', '']
        for career, rows in row['careers'].items():
            lines += [f'**{career}**' + ('' if careers[career]['reviewed'] else ' (career to review: not counted yet)'), '', '| O*NET task | Penetration | Automation | Augmentation |', '|---|---|---|---|']
            lines += [f'| {r["task"]}{" ※" if r["splitFromCareer"] else ""} | {r["penetration"]} | {r["automation"]} | {r["augmentation"]} |' for r in rows]
            lines.append('')
    lines.append('※ The task has a penetration but no interaction split; its automation and augmentation shares are the mean of the career\'s other tasks.')
    return '\n'.join(lines) + '\n'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument('--root', type=Path, default=DEFAULT_ROOT)
    args = parser.parse_args(argv)
    skills, careers, errors = build(args.root)
    reviewed_skills, _, _ = build(args.root, reviewed_careers_only=True)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    mapping = json.loads((args.root / 'skill_task_map.json').read_text(encoding='utf-8'))
    check, rho = career_check(skills, careers, mapping)
    public = {career: {k: v for k, v in row.items() if k != 'allTasks'} for career, row in careers.items()}
    for name, values, reviewed_only in (('exposure.json', reviewed_skills, True), ('exposure.draft.json', skills, False)):
        (args.root / name).write_text(json.dumps({'source': SOURCE, 'skills': usable(values, reviewed_only), 'careers': public,
                                                  'crossCheck': {'spearman': rho, 'careers': check}}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (args.root / 'REVIEW.md').write_text(review_sheet(skills, careers, check, rho), encoding='utf-8')
    print(json.dumps({'skills': len(skills), 'withTasks': sum(1 for r in skills.values() if r['tasks']),
                      'reviewed': sum(1 for r in skills.values() if r['reviewed'] and r['tasks']), 'careers': len(careers), 'spearman': rho}))
    for career, aei, ours in check:
        print(f'  {career:26} AEI {aei}  ours {ours}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
