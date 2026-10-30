import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src' / 'data' / 'scripts'))
from build_ai_exposure import build, main  # noqa: E402

PENETRATION = ('task,penetration\n"Write SQL queries.",1.0\n"Chart results.",0.5\n"Meet clients.",0.0\n'
               '"Query the warehouse.",0.8\n"Cook rice.",0.0\n')
SPLIT = ('task_name,feedback_loop,directive,task_iteration,validation,learning,filtered\n'
         'write sql queries.,0.1,0.5,0.2,0.0,0.0,0.2\n'
         'chart results.,0.0,0.25,0.25,0.25,0.25,0.0\n')
ONET = ('O*NET-SOC Code,Title,Task ID,Task,Task Type,Incumbents Responding,Date,Domain Source\n'
        '15-2041.00,Statisticians,1,Write SQL queries.,Core,1,2020,x\n'
        '15-2041.00,Statisticians,2,Chart results.,Core,1,2020,x\n'
        '15-2041.00,Statisticians,3,Meet clients.,Core,1,2020,x\n'
        '15-2041.00,Statisticians,4,Query the warehouse.,Core,1,2020,x\n'
        '15-2041.00,Statisticians,5,Task missing from penetration.,Core,1,2020,x\n'
        '35-1011.00,Chefs,6,Cook rice.,Core,1,2020,x\n')
JOBS = 'occ_code,title,observed_exposure\n15-2051,Data Scientists,0.46\n35-1011,Chefs,0.0\n'


def fixture(skills, careers=None):
    root = Path(tempfile.mkdtemp())
    (root / 'raw').mkdir()
    for name, text in (('task_penetration.csv', PENETRATION), ('automation_vs_augmentation_by_task.csv', SPLIT),
                       ('onet_task_statements.csv', ONET), ('job_exposure.csv', JOBS)):
        (root / 'raw' / name).write_text(text, encoding='utf-8')
    careers = careers or {'data-analyst': {'onet': ['15-2041.00'], 'soc': '15-2051', 'skills': list(skills)},
                          'chef': {'onet': ['35-1011.00'], 'soc': '35-1011', 'skills': ['cooking']}}
    (root / 'skill_task_map.json').write_text(json.dumps({'careers': careers, 'skills': skills}), encoding='utf-8')
    return root


class AiExposureTest(unittest.TestCase):
    def test_every_matching_task_of_the_occupation_counts_including_zero_penetration(self):
        skills, careers, errors = build(fixture({'sql': {'pattern': 'sql|quer', 'reviewed': True}, 'cooking': {'pattern': 'cook', 'reviewed': True}}))
        self.assertEqual(errors, [])
        # SQL: both query tasks, ranked by nothing; the warehouse task has penetration but no split -> career mean split
        self.assertEqual(skills['sql']['tasks'], ['Query the warehouse.', 'Write SQL queries.'])
        rows = {r['task']: r for r in skills['sql']['careers']['data-analyst']}
        self.assertEqual((rows['Write SQL queries.']['automation'], rows['Write SQL queries.']['augmentation']), (0.75, 0.25))
        self.assertTrue(rows['Query the warehouse.']['splitFromCareer'])
        # no observed AI use counts as 0, it is not dropped
        self.assertEqual((skills['cooking']['automation'], skills['cooking']['augmentation']), (0.0, 0.0))
        # a task missing from the penetration file is counted, not guessed
        self.assertEqual(careers['data-analyst']['tasksWithoutPenetration'], 1)

    def test_excluded_tasks_are_left_out(self):
        skills, _, _ = build(fixture({'sql': {'pattern': 'sql|quer', 'reviewed': True, 'exclude': ['query the warehouse.']}, 'cooking': {'pattern': 'cook'}}))
        self.assertEqual(skills['sql']['tasks'], ['Write SQL queries.'])
        self.assertEqual((skills['sql']['automation'], skills['sql']['augmentation']), (0.75, 0.25))

    def test_unknown_occupation_or_pattern_is_an_error(self):
        root = fixture({'sql': {'pattern': 'sql'}}, {'data-analyst': {'onet': ['99-9999.00'], 'soc': '15-2051', 'skills': ['sql']}})
        self.assertEqual(main(['--root', str(root)]), 1)
        root = fixture({'sql': {'pattern': 'sql'}}, {'data-analyst': {'onet': ['15-2041.00'], 'soc': '15-2051', 'skills': ['sql', 'nope']}})
        self.assertTrue(any('nope' in e for e in build(root)[2]))

    def test_only_reviewed_skills_reach_the_game_file(self):
        root = fixture({'sql': {'pattern': 'sql|quer', 'reviewed': True}, 'charts': {'pattern': 'chart', 'reviewed': False},
                        'cooking': {'pattern': 'cook', 'reviewed': True}})
        self.assertEqual(main(['--root', str(root)]), 0)
        game = json.loads((root / 'exposure.json').read_text(encoding='utf-8'))
        draft = json.loads((root / 'exposure.draft.json').read_text(encoding='utf-8'))
        self.assertEqual(sorted(game['skills']), ['cooking', 'sql'])
        self.assertEqual(sorted(draft['skills']), ['charts', 'cooking', 'sql'])
        self.assertEqual(game['careers']['data-analyst']['observedExposure'], 0.46)
        self.assertIn('crossCheck', game)
        self.assertIn('☐ to review', (root / 'REVIEW.md').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
