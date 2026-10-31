import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src' / 'data' / 'scripts'))
from import_dosm_occupations import GROUPS, OUT, RAW, RELEASES, quarter  # noqa: E402


class DosmOccupationTests(unittest.TestCase):
    def test_others_is_the_rest_and_the_three_groups_may_not_exceed_the_total(self):
        row = quarter({'total': 100, 'professionals': 50, 'managers': 20, 'technicians_and_associate_professionals': 10}, [])
        self.assertEqual(row['counts']['others'], 20)
        self.assertAlmostEqual(sum(row['shares'].values()), 1, places=3)
        with self.assertRaises(ValueError):
            quarter({'total': 50, 'professionals': 50, 'managers': 20, 'technicians_and_associate_professionals': 10}, [])

    def test_the_file_matches_the_shares_the_releases_print(self):
        if not OUT.exists():
            self.skipTest('dosm-occupations.json not built')
        data = json.loads(OUT.read_text(encoding='utf-8'))
        self.assertEqual(data['groups'], GROUPS)
        q = data['quarters']['2024-Q2']['shares']
        # the release itself prints 47.5, 17.1 and 16.4 per cent
        self.assertEqual((round(q['professionals'] * 100, 1), round(q['managers'] * 100, 1), round(q['technicians_and_associate_professionals'] * 100, 1)), (47.5, 17.1, 16.4))
        self.assertEqual(round(data['quarters']['2025-Q1']['shares']['professionals'] * 100, 1), 48.0)
        for row in data['quarters'].values():
            self.assertEqual(sum(row['counts'].values()), row['total'])
            self.assertTrue(row['sources'])

    def test_every_release_quote_is_on_its_page(self):
        from import_dosm_occupations import from_release
        for period, release in RELEASES.items():
            if not (RAW / release['file']).exists():
                continue
            counts, sources = from_release(period, release)
            self.assertEqual(len(sources), 4)


if __name__ == '__main__':
    unittest.main()
