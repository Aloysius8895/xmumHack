"""Synthetic fixtures only. These are never exported as real market data."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'src' / 'data' / 'scripts'))
import pandas as pd
from collect_linkedin import Collector, parse_detail, parse_search
from process_jobs import CATALOG, classify, deduplicate, extract_skills, location_status


class JobDataTests(unittest.TestCase):
    def test_explicit_fde_titles_take_precedence_and_not_an_unrelated_acronym(self):
        for title in ['Forward Deployed Engineer', 'Senior Forward-Deployed Software Engineer', 'Forward Deployed AI Engineer', 'Forward Deployed Engineer - MLOps']:
            self.assertEqual(classify(title, '')[0], 'forward-deployed-engineer')
        self.assertIsNone(classify('Field Development Engineer (FDE)', '')[0])

    def test_catalog_identity_and_ambiguous_software(self):
        self.assertEqual(len(CATALOG['careers']), 14)
        self.assertEqual(classify('Senior Front-end Developer', 'Build UI')[0], 'frontend-developer')
        self.assertEqual(classify('Software Engineer', 'Build software')[0], None)
        self.assertEqual(classify('Software Engineer', 'Build backend APIs')[0], 'backend-developer')
        self.assertEqual(classify('Software Engineer', 'Build frontend and backend')[0], None)
        self.assertEqual(classify('Data Scientist', 'Python')[0], 'data-scientist')
        self.assertEqual(classify('UI/UX Designer cum Front-End Developer', 'Build UI')[0], None)

    def test_java_javascript_react_native_and_aliases(self):
        skills = {s['skill_id'] for s in extract_skills('Requirements\nJavaScript and ReactJS required.\nReact.js experience required.')}
        self.assertIn('javascript', skills)
        self.assertIn('react', skills)
        self.assertNotIn('backend-language', skills)
        skills = {s['skill_id'] for s in extract_skills('Requirements\nJava required. React Native experience required.')}
        self.assertIn('backend-language', skills)
        self.assertNotIn('javascript', skills)
        self.assertNotIn('react', skills)

    def test_negation_company_intro_and_preference(self):
        text = ('About us\nWe use Python and React at our company.\nRequirements\n'
                'No Python experience required.\nJava is not required.\n'
                'SQL is mandatory.\nFigma is a plus.')
        skills = {s['skill_id']: s for s in extract_skills(text)}
        self.assertNotIn('python', skills)
        self.assertNotIn('react', skills)
        self.assertNotIn('backend-language', skills)
        self.assertEqual(skills['sql']['requirement_type'], 'required')
        self.assertEqual(skills['figma']['requirement_type'], 'preferred')
        self.assertIn('SQL', skills['sql']['evidence_text'])

    def test_repeat_import_keeps_distinct_ads_and_first_seen(self):
        rows = [dict(canonical_job_id='linkedin:1', title_raw='Data Analyst', company_raw='Fixture Company',
                     description_raw='SQL needed', collected_at='2026-10-24T00:00:00Z',
                     first_seen_at='2026-10-24T00:00:00Z', last_seen_at='2026-10-24T00:00:00Z'),
                dict(canonical_job_id='linkedin:1', title_raw='Data Analyst', company_raw='Fixture Company',
                     description_raw=None, collected_at='2026-10-25T00:00:00Z',
                     first_seen_at='2026-10-25T00:00:00Z', last_seen_at='2026-10-25T00:00:00Z')]
        rows.append({**rows[0], 'canonical_job_id': 'linkedin:2'})
        once = deduplicate(pd.DataFrame(rows))
        twice = deduplicate(pd.DataFrame(rows + rows))
        pd.testing.assert_frame_equal(once, twice)
        self.assertEqual(len(once), 2)
        job = once.set_index('canonical_job_id').loc['linkedin:1']
        self.assertEqual(job['first_seen_at'], '2026-10-24T00:00:00Z')
        self.assertEqual(job['last_seen_at'], '2026-10-25T00:00:00Z')
        self.assertEqual(job['description_raw'], 'SQL needed')

    def test_search_parser_preserves_source_id_and_date_precision(self):
        html = ('<div data-entity-urn="urn:li:jobPosting:123">'
                '<a class="base-card__full-link" href="https://my.linkedin.com/jobs/view/test-123?trackingId=x"></a>'
                '<h3 class="base-search-card__title">Data Analyst</h3>'
                '<h4 class="base-search-card__subtitle">Fixture Company</h4>'
                '<span class="job-search-card__location">Kuala Lumpur, Malaysia</span>'
                '<time datetime="2026-10-23">1 day ago</time></div>')
        jobs = parse_search(html)
        self.assertEqual(jobs[0]['source_job_id'], '123')
        self.assertEqual(jobs[0]['posted_date'], '2026-10-23')
        self.assertEqual(jobs[0]['job_url'], 'https://my.linkedin.com/jobs/view/test-123')
        self.assertEqual(parse_search('<p>Please sign in</p>'), [])
        self.assertEqual(parse_search('<a data-entity-urn="urn:li:jobPosting:124" href="https://my.linkedin.com/jobs/view/test-124?trackingId=z"></a>')[0]['job_url'], 'https://my.linkedin.com/jobs/view/test-124')

    def test_missing_detail_and_location_are_not_zero_or_malaysia(self):
        self.assertIsNone(parse_detail('<p>Unavailable</p>')['description_raw'])
        self.assertEqual(location_status('Remote', 'Data Analyst'), 'unconfirmed')
        self.assertEqual(location_status('Kuala Lumpur, Malaysia', 'Bangkok-based Data Analyst'), 'relocation_outside_my')
        self.assertEqual(location_status('Petaling Jaya', 'Data Analyst'), 'location_my')

    def test_budget_stops_without_network(self):
        collector = Collector(Path('.'), budget=0, interval=1)
        self.assertEqual(collector.fetch('https://example.invalid', 'test', {}), (None, None))
        self.assertEqual(collector.requests, [])


if __name__ == '__main__':
    unittest.main()
