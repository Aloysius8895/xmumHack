import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src' / 'data' / 'scripts'))
from import_jobstreet_reference import DATASETS, collection_window, fetch, listed_day, window_record  # noqa: E402


class JobStreetReferenceTests(unittest.TestCase):
    def test_collection_starts_when_the_scrape_starts_not_with_old_open_postings(self):
        # a few old adverts a day in January, the scrape from 22 February on
        days = [date(2024, 1, 10) + timedelta(days=i) for i in range(40) for _ in range(3)]
        days += [date(2024, 2, 22) + timedelta(days=i) for i in range(60) for _ in range(100)]
        start, end = collection_window(days)
        self.assertEqual(start, date(2024, 2, 22))
        self.assertEqual(end, date(2024, 2, 22) + timedelta(days=59))
        record = window_record(start, end)
        self.assertEqual(record['partialMonths'], ['2024-02', '2024-04'])
        self.assertEqual(window_record(date(2024, 3, 1), date(2024, 3, 31))['partialMonths'], [])

    def test_listing_dates_are_malaysian_days(self):
        self.assertEqual(listed_day('2024-03-01T18:30:00Z'), date(2024, 3, 2))
        self.assertEqual(listed_day('2025-03-28 07:13:35+00:00'), date(2025, 3, 28))

    def test_a_file_with_another_hash_is_refused(self):
        raw = Path(tempfile.mkdtemp())
        dataset = DATASETS['jobstreet-2024']
        (raw / dataset['file']).write_text('job_id\n1\n', encoding='utf-8')
        with self.assertRaises(ValueError):
            fetch(dataset, raw)

    def test_the_repository_holds_only_aggregates(self):
        root = Path(__file__).resolve().parents[2] / 'data' / 'reference'
        for dataset_id in DATASETS:
            reference = root / dataset_id / 'reference.json'
            if not reference.exists():
                continue
            data = json.loads(reference.read_text(encoding='utf-8'))
            self.assertEqual(data['source']['sha256'], DATASETS[dataset_id]['sha256'])
            self.assertNotIn('description', reference.read_text(encoding='utf-8').lower().replace('described', ''))
            self.assertEqual(sum(data['months'].values()), data['postings'])


if __name__ == '__main__':
    unittest.main()
