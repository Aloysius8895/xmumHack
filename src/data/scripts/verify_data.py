"""Offline integration checks against collected snapshots; never performs network I/O."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def main():
    raw_before = {str(p.relative_to(ROOT)): digest(p) for p in sorted((ROOT / 'raw').rglob('*')) if p.is_file()}
    processed = ROOT / 'processed'
    jobs = load(processed / 'jobs.json')
    skills = load(processed / 'job_skills.json')
    sources = load(processed / 'job_sources.json')
    profile = load(processed / 'quality_report.json')
    catalog = load(ROOT / 'config/catalog.json')
    job_index = {j['canonical_job_id']: j for j in jobs}
    checks = {}
    checks['unique_source_ids'] = len(job_index) == len(jobs)
    checks['only_requested_sources'] = {j['source'] for j in jobs} == {'indeed', 'linkedin'}
    checks['malaysia_location_evidence'] = all(j['country'] == 'MY' and j['malaysia_eligibility'] == 'location_my' for j in jobs)
    checks['all_source_urls_present'] = all(j['job_url'] for j in jobs)
    checks['existing_occupation_ids'] = {j['occupation_id'] for j in jobs if j['occupation_id']}.issubset({c['id'] for c in catalog['careers']})
    checks['existing_skill_ids'] = {s['skill_id'] for s in skills}.issubset(catalog['skills'])
    checks['unique_job_skill_links'] = len({(s['canonical_job_id'], s['skill_id']) for s in skills}) == len(skills)
    checks['skill_evidence_present'] = all(s['matched_text'].casefold() in s['evidence_text'].casefold() and job_index[s['canonical_job_id']]['description_raw'] for s in skills)
    checks['indeed_index_not_full_description'] = all(j['description_raw'] is None and j['live_verified'] is False and j['retrieval_method'] == 'search_index' for j in jobs if j['source'] == 'indeed')
    usable = {j['canonical_job_id'] for j in jobs if j['description_quality'] == 'usable'}
    checks['skills_only_from_usable_descriptions'] = all(s['canonical_job_id'] in usable for s in skills)
    rates = load(processed / 'skill_demand_sample.json')
    checks['skill_rates_have_correct_denominator'] = all(r['denominator'] == len(usable) and abs(r['demand_rate_pct'] - round(r['postings'] / len(usable) * 100, 2)) < 0.001 for r in rates)
    checks['skill_numerators_are_distinct_ads'] = all(r['postings'] == len({s['canonical_job_id'] for s in skills if s['skill_id'] == r['skill_id']}) for r in rates)
    checks['date_precision_not_fabricated'] = all(j['posted_at'] is None and j['posted_date_precision'] in {'day', 'unknown'} for j in jobs)
    checks['no_fabricated_history'] = profile['trend_status'] == 'insufficient_history'
    checks['report_counts_match_exports'] = profile['malaysia_jobs'] == len(jobs) and profile['usable_descriptions'] == len(usable) and profile['skill_links'] == len(skills)
    checks['all_jobs_have_discovery_provenance'] = set(job_index).issubset({s['canonical_job_id'] for s in sources})
    checks['salary_has_explicit_units_when_available'] = all(j['currency'] == 'MYR' and j['salary_period'] in {'month', 'year', 'week', 'hour'} for j in jobs if j['salary_min'] is not None)
    source_hashes_verified = 0
    requests_failed = 0
    for run in sorted((ROOT / 'raw').glob('linkedin-*')):
        requests = load(run / 'requests.json')
        manifest = load(run / 'manifest.json')
        assert len(requests) == manifest['request_count'] <= manifest['settings']['budget']
        requests_failed += sum('error' in r for r in requests)
        for request in requests:
            if request.get('raw_file'):
                assert digest(run / request['raw_file']) == request['sha256']
                source_hashes_verified += 1
    checks['raw_http_response_hashes_match'] = source_hashes_verified > 0
    checks['partial_failures_recorded'] = requests_failed == sum(m.get('requests_failed', 0) for m in profile['collection_runs'])
    checks['indeed_excerpts_bounded'] = all(len((r.get('excerpt_text') or '').split()) <= 24 for p in (ROOT / 'raw').glob('indeed-index-*/records.json') for r in load(p)['records'])
    output_files = [p for p in processed.iterdir() if p.is_file() and p.name not in {'verification.json', 'artifact_manifest.json'}]
    before = {p.name: digest(p) for p in output_files}
    result = subprocess.run([sys.executable, str(ROOT / 'scripts/process_jobs.py')], capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr)
    checks['offline_replay_is_idempotent'] = all(digest(processed / name) == value for name, value in before.items())
    checks['raw_files_unchanged_after_replay'] = raw_before == {str(p.relative_to(ROOT)): digest(p) for p in sorted((ROOT / 'raw').rglob('*')) if p.is_file()}
    report = {'status': 'passed' if all(checks.values()) else 'failed', 'checks': checks,
              'raw_files_checked': len(raw_before), 'http_response_hashes_checked': source_hashes_verified,
              'network_used_by_verification': False, 'jobs': len(jobs), 'usable_descriptions': len(usable),
              'skill_links': len(skills), 'reported_request_failures': requests_failed}
    (processed / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Update output checksum list after writing the verification artifact.
    (processed / 'artifact_manifest.json').write_text(json.dumps({p.name: digest(p) for p in sorted(processed.iterdir()) if p.is_file() and p.name != 'artifact_manifest.json'}, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=True, indent=2))
    if report['status'] != 'passed':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
