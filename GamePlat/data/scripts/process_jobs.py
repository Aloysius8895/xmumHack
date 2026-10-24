"""Local-only profiling and derivation. Raw snapshots are never modified."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path

os.environ.setdefault('NUMEXPR_MAX_THREADS', '1')
import pandas as pd
from collect_linkedin import parse_search

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'config/catalog.json').read_text(encoding='utf-8'))
VERSION = 'careersphere-rules-v1'

TITLE_PATTERNS = {
    'forward-deployed-engineer': r'\bforward[ -]+deploy(?:ed|ment)\s+(?:(?:software|ai|genai)\s+)?engineer(?:ing)?\b',
    'data-analyst': r'\b(?:data|business intelligence|bi|reporting|analytics|insights)\s+analyst\b|\banalyst[, ]+(?:data analytics|data analysis)\b',
    'frontend-developer': r'\bfront[ -]?end\b|\b(?:react|vue|angular|javascript|web)\s+(?:developer|engineer)\b',
    'backend-developer': r'\bback[ -]?end\b|\b(?:java|node(?:\.js)?|python|php|golang|server[ -]side)\s+(?:developer|engineer)\b',
    'ui-ux-designer': r'\b(?:ui[ /&-]*ux|ux[ /&-]*ui|ux|ui|user experience|user interface|interaction|product)\s+(?:designer|design lead)\b',
    'ml-engineer': r'\b(?:machine learning|ml|ai|artificial intelligence|mlops|deep learning|computer vision|nlp|llm)\s+(?:engineer|developer|specialist)\b',
    'product-manager': r'\bproduct\s+(?:manager|owner|lead|management)\b',
    'data-scientist': r'\bdata scientist\b|\bapplied scientist\b',
    'auditor': r'\bauditor\b|\baudit\s+(?:associate|assistant|senior|manager|executive)\b',
    'lawyer': r'\blawyer\b|\blegal counsel\b|\bsolicitor\b|\blegal associate\b',
    'teacher': r'\bteacher\b|\blecturer\b|\beducator\b',
    'doctor': r'\bmedical (?:officer|doctor|practitioner)\b|\bphysician\b',
    'chef': r'\bchef\b',
    'civil-engineer': r'\b(?:civil|structural|c&s)\s+engineer\b',
}


def classify(title, description):
    matches = [key for key, pattern in TITLE_PATTERNS.items() if re.search(pattern, title or '', re.I)]
    if 'forward-deployed-engineer' in matches:
        return 'forward-deployed-engineer', 'explicit_fde_title_v1'
    if len(matches) == 1:
        return matches[0], 'title_rule_v1'
    if not matches and re.search(r'\bsoftware (engineer|developer)\b', title or '', re.I):
        signals = [key for key, pattern in (
            ('frontend-developer', r'\bfront[ -]?end\b'),
            ('backend-developer', r'\bback[ -]?end\b|\bserver[ -]side\b'),
        ) if re.search(pattern, description or '', re.I)]
        if len(signals) == 1:
            return signals[0], 'generic_software_title_and_description_v1'
    return None, 'pending_review'


def extract_skills(description):
    patterns = dict(CATALOG['skillPatterns'])
    patterns.update({
        'javascript': r'\b(?:javascript|ecmascript|JS)\b',
        'react': r'\breact(?:\.js|js)?\b(?!\s+native)',
        'figma': r'\bfigma\b',
        'backend-language': r'\b(?:java|python|php|golang|node(?:\.js|js)?|c#|c\+\+)\b',
        'ml-math': r'\b(?:linear algebra|calculus|probability theory|mathematics for machine learning)\b',
        'accessibility': r'\b(?:accessibility|wcag|aria|responsive design)\b',
    })
    found = {}
    section = 'unknown'
    in_company_intro = False
    for raw_line in (description or '').splitlines():
        line = re.sub(r'\s+', ' ', raw_line).strip()
        if not line:
            continue
        # Heading-based exclusion prevents corporate technology claims becoming requirements.
        if len(line) < 90:
            if re.fullmatch(r'(?:about us|about the company|who we are|company (?:overview|description)|our company)[: ]*', line, re.I):
                in_company_intro = True
                continue
            if re.fullmatch(r'(?:requirements|qualifications|what you (?:bring|need)|skills|your (?:skills|profile)|minimum qualifications|must.haves)[: ]*', line, re.I):
                in_company_intro = False
                section = 'required'
                continue
            if re.fullmatch(r'(?:preferred qualifications|nice.to.haves|bonus skills|good to have|bonus points if you have)[: ]*', line, re.I):
                in_company_intro = False
                section = 'preferred'
                continue
            if re.fullmatch(r'(?:responsibilities|job description|your role|what you.ll do|key responsibilities|the role)[: ]*', line, re.I):
                in_company_intro = False
                section = 'unknown'
                continue
        if in_company_intro:
            continue
        for clause in re.split(r'(?<=[.!?;])\s+(?=[A-Z])', line):
            # Conservative sentence exclusion for ambiguous negation (documented undercount risk).
            if re.search(r'\b(?:no|without)\b.{0,50}\b(?:experience|knowledge|skills?)\b|\bnot (?:required|necessary|essential|mandatory)\b|\bdo(?:es)? not (?:need|require)\b|无需|不需要', clause, re.I):
                continue
            requirement = 'preferred' if re.search(r'\b(?:preferred|desirable|advantage|nice.to.have|a plus|bonus)\b', clause, re.I) else (
                'required' if re.search(r'\b(?:must|required|essential|mandatory)\b', clause, re.I) else section)
            for skill_id, pattern in patterns.items():
                if skill_id not in CATALOG['skills']:
                    continue
                match = re.search(pattern, clause, re.I)
                if not match:
                    continue
                start = max(0, match.start() - 140)
                end = min(len(clause), match.end() + 180)
                item = {'skill_id': skill_id, 'skill_name_normalized': CATALOG['skills'][skill_id]['en'],
                        'requirement_type': requirement, 'evidence_text': clause[start:end],
                        'matched_text': match.group(), 'extraction_method': VERSION, 'confidence': None}
                priority = {'required': 2, 'preferred': 1, 'unknown': 0}
                if skill_id not in found or priority[requirement] > priority[found[skill_id]['requirement_type']]:
                    found[skill_id] = item
    return list(found.values())


MY_PLACES = r'\b(?:Malaysia|Kuala Lumpur|Selangor|Penang|Pulau Pinang|Johor|Petaling Jaya|Shah Alam|Cyberjaya|Putrajaya|Subang Jaya|Kuching|Kota Kinabalu|Perak|Ipoh|Melaka|Malacca|Seremban|Negeri Sembilan|Kedah|Kelantan|Pahang|Perlis|Sabah|Sarawak|Terengganu|Labuan|Bayan Lepas|Batu Kawan|George Town|Bukit Jalil|Puchong|Cheras|Klang|Gelang Patah|Kulai|Kajang|Bangi|TTDI|Taman Tun Dr Ismail|KL Eco City|Bangsar|Port Dickson|Ampang|Sungai Buloh|Bintulu|Kuantan)\b'


def location_status(location, title):
    if re.search(r'\b(?:Bangkok|Singapore|Jakarta|Manila|Vietnam)[ -]based\b|\brelocat(?:e|ion) to (?:Bangkok|Singapore|Thailand)\b', title or '', re.I):
        return 'relocation_outside_my'
    return 'location_my' if re.search(MY_PLACES, location or '', re.I) else 'unconfirmed'


def normalize(observation, detail, run_path):
    job = dict(observation)
    for key, value in detail.items():
        if value is not None:
            job[key] = value
    title = job.get('title_raw') or ''
    description = job.get('description_raw')
    occupation, method = classify(title, description)
    location = job.get('location_raw')
    eligibility = location_status(location, title)
    raw_detail = job.get('raw_detail_file')
    posted_date = job.get('posted_date')
    if posted_date and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', posted_date):
        posted_date = None
    arrangement_text = (title + '\n' + (description or ''))
    # Explicit work-location labels only; "remote team" does not establish remote work.
    arrangement = 'unknown'
    for label, pattern in [('hybrid', r'\b(?:work (?:location|arrangement|mode)|workplace|location)\s*[:\-]\s*hybrid\b'),
                           ('remote', r'\b(?:fully remote|100% remote|remote position|work from home|workplace\s*:\s*remote)\b'),
                           ('onsite', r'\b(?:on[ -]site|in person)\b')]:
        if re.search(pattern, arrangement_text, re.I):
            arrangement = label
            break
    if arrangement == 'unknown' and re.search(r'\bremote\b', title, re.I):
        arrangement = 'remote'
    record = {
        'canonical_job_id': job['source'] + ':' + str(job['source_job_id']),
        'source': job['source'], 'publisher': job['source'], 'source_job_id': str(job['source_job_id']),
        'job_url': job.get('job_url'), 'apply_url': job.get('apply_url'),
        'company_raw': job.get('company_raw'), 'company_website': None,
        'company_normalized': re.sub(r'\s+', ' ', job.get('company_raw') or '').strip().casefold() or None,
        'title_raw': title, 'description_raw': description, 'excerpt_text': job.get('excerpt_text'),
        'location_raw': location, 'country': 'MY' if eligibility == 'location_my' else None,
        'state': None, 'city': location.split(',')[0].strip() if location and eligibility == 'location_my' and location.strip().casefold() != 'malaysia' else None,
        'malaysia_eligibility': eligibility,
        'remote_eligibility': 'unconfirmed' if arrangement == 'remote' else 'not_applicable_or_unknown',
        'employment_type': job.get('employment_type'), 'work_arrangement': arrangement,
        'posted_at': None, 'posted_date': posted_date, 'posted_date_precision': 'day' if posted_date else 'unknown',
        'posted_relative_raw': job.get('posted_relative_raw'), 'valid_through': None,
        'salary_min': job.get('salary_min'), 'salary_max': job.get('salary_max'),
        'currency': job.get('currency'), 'salary_period': job.get('salary_period'),
        'collected_at': job.get('collected_at'), 'first_seen_at': observation.get('collected_at'),
        'last_seen_at': job.get('collected_at'),
        'status': 'closed' if job.get('closed_explicitly') else 'unknown',
        'occupation_id': occupation, 'classification_confidence': None, 'classification_method': method,
        'seniority': job.get('seniority'), 'experience_min': None, 'experience_max': None, 'education_requirement': None,
        'description_quality': 'usable' if description and len(description.strip()) >= 200 else 'missing_or_short',
        'retrieval_method': job.get('retrieval_method', 'public_guest_page'),
        'live_verified': job.get('live_verified', bool(raw_detail)),
        'raw_payload_file': str((run_path / raw_detail).relative_to(ROOT)).replace('\\', '/') if raw_detail else None,
        'detail_status': job.get('detail_status', 'not_requested' if job['source'] == 'linkedin' else 'indexed_excerpt_only'),
    }
    if record['company_normalized'] in {'confidential', 'private advertiser', 'confidential company'}:
        record['company_normalized'] = None
    if description:
        experience = re.search(r'\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b', description, re.I)
        if experience:
            record['experience_min'], record['experience_max'] = map(int, experience.groups())
        else:
            minimum = re.search(r'\b(?:at least|minimum of?|minimum)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b', description, re.I)
            record['experience_min'] = int(minimum[1]) if minimum else None
        education = re.search(r'[^\n.!?]*(?:bachelor|master.s degree|doctoral|ph\.?d\.?|diploma)[^\n.!?]*', description, re.I)
        record['education_requirement'] = education[0].strip()[:500] if education else None
    return record


def read_inputs():
    records = []
    provenance = []
    manifests = []
    for run in sorted((ROOT / 'raw').glob('linkedin-*')):
        if not (run / 'manifest.json').exists():
            continue  # Never treat a still-running collection as complete.
        manifests.append(json.loads((run / 'manifest.json').read_text(encoding='utf-8')))
        observations = json.loads((run / 'observations.json').read_text(encoding='utf-8'))
        details = {d['source_job_id']: d for d in json.loads((run / 'details.json').read_text(encoding='utf-8'))}
        recovered_links = {}
        for obs in observations:
            if not obs.get('job_url'):
                filename = obs['raw_search_file']
                if filename not in recovered_links:
                    recovered_links[filename] = {j['source_job_id']: j['job_url'] for j in parse_search((run / filename).read_text(encoding='utf-8'))}
                obs = {**obs, 'job_url': recovered_links[filename].get(obs['source_job_id'])}
            records.append(normalize(obs, details.get(obs['source_job_id'], {}), run))
            provenance.append({'canonical_job_id': 'linkedin:' + obs['source_job_id'], 'source': 'linkedin',
                               'query': obs['discovery']['query'], 'career_id_hint': obs['discovery']['career_id_hint'],
                               'page': obs['discovery']['page'], 'collected_at': obs['collected_at'],
                               'raw_file': str((run / obs['raw_search_file']).relative_to(ROOT)).replace('\\', '/')})
    for path in sorted((ROOT / 'raw').glob('indeed-index-*/records.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        for obs in data['records']:
            records.append(normalize(obs, {}, path.parent))
            provenance.append({'canonical_job_id': 'indeed:' + obs['source_job_id'], 'source': 'indeed',
                               'query': json.dumps(obs.get('discovery_queries', [])), 'career_id_hint': None,
                               'page': None, 'collected_at': obs['collected_at'],
                               'raw_file': str(path.relative_to(ROOT)).replace('\\', '/')})
        manifests.append(data['manifest'])
    return records, provenance, manifests


def deduplicate(df):
    if df.empty:
        return df
    seen = df.groupby('canonical_job_id', observed=True).agg(first_seen_at=('first_seen_at', 'min'), last_seen_at=('last_seen_at', 'max'))
    # Prefer complete detail, then latest observation; no merging on company/title alone.
    result = (df.assign(_has_description=df['description_raw'].notna())
              .sort_values(['_has_description', 'collected_at'], kind='stable')
              .drop_duplicates('canonical_job_id', keep='last')
              .drop(columns=['_has_description', 'first_seen_at', 'last_seen_at'])
              .merge(seen, on='canonical_job_id', how='left', validate='1:1'))
    assert result['canonical_job_id'].is_unique
    return result


def json_records(df):
    return json.loads(df.to_json(orient='records', force_ascii=False))


def save_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='processed')
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if ROOT not in output.parents or output == ROOT / 'raw' or ROOT / 'raw' in output.parents:
        parser.error('derived output must be inside GamePlat/data and outside raw/')
    output.mkdir(parents=True, exist_ok=True)
    records, provenance, manifests = read_inputs()
    if not records:
        raise SystemExit('No completed snapshots. Wait for collection to finish.')
    original = pd.DataFrame.from_records(records)
    df = deduplicate(original)
    for column in ['salary_min', 'salary_max', 'experience_min', 'experience_max']:
        df[column] = pd.to_numeric(df[column], errors='coerce').astype('Float64')
    for column in ['source', 'country', 'description_quality', 'work_arrangement', 'status']:
        df[column] = df[column].astype('category')
    excluded = df.loc[df['malaysia_eligibility'].ne('location_my')].copy()
    jobs = df.loc[df['malaysia_eligibility'].eq('location_my')].copy()
    skills = []
    for job in json_records(jobs.loc[jobs['description_quality'].eq('usable')]):
        for skill in extract_skills(job['description_raw']):
            skills.append({'canonical_job_id': job['canonical_job_id'], 'occupation_id': job['occupation_id'], **skill})
    skill_df = pd.DataFrame(skills, columns=['canonical_job_id', 'occupation_id', 'skill_id', 'skill_name_normalized',
                                            'requirement_type', 'evidence_text', 'matched_text', 'extraction_method', 'confidence'])
    assert not skill_df.duplicated(['canonical_job_id', 'skill_id']).any()
    assert set(skill_df['skill_id']).issubset(CATALOG['skills'])
    assert set(jobs['occupation_id'].dropna()).issubset(c['id'] for c in CATALOG['careers'])
    assert len(jobs) + len(excluded) == df['canonical_job_id'].nunique()

    # Only whole descriptions enter skill-share denominators; index excerpts never do.
    usable = jobs.loc[jobs['description_quality'].eq('usable')]
    career = (jobs.groupby('occupation_id', observed=True, dropna=False)
              .agg(postings=('canonical_job_id', 'nunique'), companies=('company_normalized', 'nunique'))
              .reset_index())
    denominators = usable.groupby('occupation_id', dropna=False, observed=True)['canonical_job_id'].nunique().rename('usable_descriptions').reset_index()
    career = career.merge(denominators, on='occupation_id', how='left', validate='1:1')
    career['usable_descriptions'] = career['usable_descriptions'].fillna(0).astype(int)
    all_careers = pd.DataFrame([{'occupation_id': c['id'], 'occupation_name': c['name']['en']} for c in CATALOG['careers']])
    coverage = all_careers.merge(career, on='occupation_id', how='outer', validate='1:1')
    coverage['occupation_name'] = coverage['occupation_name'].fillna('Pending classification')
    for col in ['postings', 'companies', 'usable_descriptions']:
        coverage[col] = coverage[col].fillna(0).astype(int)
    # Sample counts of zero mean no record in this dataset, never no market demand.
    coverage['coverage_status'] = coverage['postings'].map(lambda n: 'no_sample' if n == 0 else ('low_sample' if n < 10 else 'sample_available'))
    rates = (skill_df.groupby(['skill_id', 'skill_name_normalized'], observed=True)
             .agg(postings=('canonical_job_id', 'nunique')).reset_index())
    rates['denominator'] = len(usable)
    rates['demand_rate_pct'] = rates['postings'].div(len(usable)).mul(100).round(2) if len(usable) else None
    rates = rates.sort_values('postings', ascending=False)
    # Export flat CSV for Excel and full JSON for later backend ingestion.
    for filename, table in [('jobs', jobs), ('job_skills', skill_df), ('occupation_coverage', coverage), ('skill_demand_sample', rates), ('job_sources', pd.DataFrame(provenance)), ('excluded_jobs', excluded)]:
        table.to_csv(output / (filename + '.csv'), index=False, encoding='utf-8-sig')
        save_json(output / (filename + '.json'), json_records(table))
    field_profile = []
    for col in jobs.columns:
        series = jobs[col]
        profile = {'column': col, 'dtype': str(series.dtype), 'null_count': int(series.isna().sum()),
                   'null_pct': round(float(series.isna().mean() * 100), 2), 'distinct': int(series.nunique()),
                   'role': 'identifier' if col.endswith('_id') else ('temporal' if col.endswith(('_at', '_date')) else ('text' if col.endswith(('_raw', '_text')) else 'dimension'))}
        if pd.api.types.is_numeric_dtype(series):
            profile['role'] = 'metric'
            profile['statistics'] = {key: (None if pd.isna(value) else float(value)) for key, value in series.describe().items()}
        elif col in ['source', 'country', 'description_quality', 'work_arrangement', 'occupation_id', 'status']:
            profile['frequencies'] = {str(k): int(v) for k, v in series.value_counts(dropna=False).items()}
        if col in ['description_raw', 'title_raw', 'company_raw', 'location_raw']:
            lengths = series.astype('string').str.len()
            profile['length'] = {'min': None if lengths.dropna().empty else int(lengths.min()),
                                 'max': None if lengths.dropna().empty else int(lengths.max()),
                                 'mean': None if lengths.dropna().empty else round(float(lengths.mean()), 2)}
        field_profile.append(profile)
    dates = pd.to_datetime(jobs['posted_date'], errors='coerce', utc=True)
    last_collection = pd.to_datetime(jobs['collected_at'], errors='coerce', utc=True).max()
    profile = {
        'schema_version': 1, 'grain': 'one row per source job ID; cross-source duplicates not automatically merged',
        'primary_key': 'canonical_job_id', 'input_observations': len(original), 'unique_all_locations': len(df),
        'malaysia_jobs': len(jobs), 'excluded_or_unconfirmed': len(excluded),
        'duplicate_observations_removed': len(original) - len(df),
        'columns': len(jobs.columns), 'memory_bytes_deep': int(jobs.memory_usage(deep=True).sum()),
        'sources': {str(k): int(v) for k, v in jobs['source'].value_counts().items()},
        'usable_descriptions': len(usable), 'skill_links': len(skill_df),
        'mapped_occupations': int(jobs['occupation_id'].nunique()), 'pending_classification': int(jobs['occupation_id'].isna().sum()),
        'posted_date_range': [None if dates.dropna().empty else dates.min().date().isoformat(), None if dates.dropna().empty else dates.max().date().isoformat()],
        'future_posted_dates': int((dates > last_collection.normalize()).sum()),
        'raw_unchanged': True, 'trend_status': 'insufficient_history',
        'fields': field_profile, 'collection_runs': manifests,
        'limitations': ['Ranked page-limited sample, not Malaysia market totals.',
                       'Indeed search-index metadata is not live verified and has no full description.',
                       'LinkedIn date-only values remain date-only; no midnight UTC timestamps invented.',
                       'Conservative rules may miss skills; company introduction and negation heuristics need review.',
                       'Different source IDs are retained; same company/title alone never proves duplicate ads.',
                       'Source discovery does not prove an advertisement remains open.',
                       'One collection session cannot establish temporal demand trends.'],
    }
    save_json(output / 'quality_report.json', profile)
    lines = ['# 马来西亚招聘数据质量报告', '',
             f"样本：{len(jobs)} 则马来西亚广告，{len(usable)} 则有可用完整描述；{len(excluded)} 则因地点未确认或明确境外搬迁被隔离。",
             f"来源：{json.dumps(profile['sources'], ensure_ascii=False)}；映射 {profile['mapped_occupations']}/{len(CATALOG['careers'])} 个职业；{profile['pending_classification']} 则待分类。",
             f"原始观察 {len(original)} 次，按来源职位 ID 去除重复观察 {len(original) - len(df)} 次。技能关联 {len(skill_df)} 条。",
             '', '## 职业覆盖（样本广告量）', '', '| 职业 | 广告 | 公司 | 可用描述 | 状态 |', '|---|---:|---:|---:|---|']
    for row in json_records(coverage):
        lines.append(f"| {row['occupation_name']} | {row['postings']} | {row['companies']} | {row['usable_descriptions']} | {row['coverage_status']} |")
    lines.extend(['', '## 字段缺失', '', '| 字段 | 缺失数 | 缺失率 |', '|---|---:|---:|'])
    for field in field_profile:
        if field['null_count']:
            lines.append(f"| {field['column']} | {field['null_count']} | {field['null_pct']}% |")
    lines.extend(['', '## 使用边界', '',
                  '- 使用了用户的 explore-data 与 pandas-pro：先检查表粒度、缺失、唯一性、日期及覆盖，再写派生表；raw/ 保持不变。',
                  '- 技能需求率仅以完整描述可用的去重广告为分母；Indeed 索引摘要不进入分母。当前是所有明确提及技能（required、preferred、unknown），不是“全部必须技能”。',
                  '- Indeed 直连返回 403；索引记录可能滞后，不能视为已确认仍在招聘。',
                  '- LinkedIn 搜索页按页数截断；部分详情受预算上限影响。查询别名只用于发现，职业分类独立判断。',
                  '- 远程职位即使地点标为 Malaysia，也尚未核实跨境申请资格；remote_eligibility=unconfirmed。',
                  '- 未知值保留 null；未捏造薪资、发布日期或职位状态。来源日期只有“天”精度时不伪造 UTC 时间点。',
                  '- 一次抓取不足以建立可比趋势，当前状态为“正在积累历史数据”。按发布日期分布也不能恢复已消失的广告。',
                  '- 没有样本的职业不代表市场没有需求。不得把广告数称为招聘人数或全国职位空缺总量。',
                  '- 后续建议：逐日固定查询与分页；补足职业低样本；人工复核待分类；检查平台间重复及未知薪资。', ''])
    (output / 'QUALITY_REPORT.md').write_text('\n'.join(lines), encoding='utf-8')
    save_json(output / 'verification.json', {
        'status': 'passed', 'scope': 'derived_schema_counts_and_references',
        'checks': {'unique_source_ids': True, 'unique_job_skill_links': True,
                   'existing_occupation_ids': True, 'existing_skill_ids': True,
                   'malaysia_and_excluded_counts_reconciled': True},
        'jobs': len(jobs), 'usable_descriptions': len(usable), 'skill_links': len(skill_df),
        'raw_written_by_processor': False, 'network_used_by_verification': False,
        'full_offline_replay_audit': 'Run scripts/verify_data.py for the additional raw-hash and replay checks.'
    })
    save_json(output / 'artifact_manifest.json', {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(output.iterdir()) if p.is_file() and p.name != 'artifact_manifest.json'})
    print(json.dumps({k: profile[k] for k in ['malaysia_jobs', 'sources', 'usable_descriptions', 'skill_links', 'mapped_occupations', 'pending_classification', 'duplicate_observations_removed']}))


if __name__ == '__main__':
    main()
