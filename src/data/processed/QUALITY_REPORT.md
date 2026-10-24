# 马来西亚招聘数据质量报告

样本：564 则马来西亚广告，251 则有可用完整描述；0 则因地点未确认或明确境外搬迁被隔离。
来源：{"linkedin": 507, "indeed": 57}；映射 14/14 个职业；169 则待分类。
原始观察 1297 次，按来源职位 ID 去除重复观察 733 次。技能关联 1160 条。

## 职业覆盖（样本广告量）

| 职业 | 广告 | 公司 | 可用描述 | 状态 |
|---|---:|---:|---:|---|
| Auditor | 29 | 28 | 13 | sample_available |
| Backend Developer | 21 | 18 | 11 | sample_available |
| Chef | 44 | 26 | 14 | sample_available |
| Civil Engineer | 31 | 25 | 8 | sample_available |
| Data Analyst | 30 | 25 | 14 | sample_available |
| Data Scientist | 31 | 28 | 14 | sample_available |
| Doctor | 15 | 13 | 7 | sample_available |
| FDE (Forward Deployed Engineer) | 6 | 5 | 5 | low_sample |
| Frontend Developer | 23 | 18 | 12 | sample_available |
| Lawyer | 31 | 24 | 13 | sample_available |
| AI / ML Engineer | 41 | 34 | 20 | sample_available |
| Product Manager | 40 | 33 | 14 | sample_available |
| Teacher | 27 | 19 | 14 | sample_available |
| UI/UX Designer | 26 | 24 | 13 | sample_available |
| Pending classification | 169 | 127 | 79 | sample_available |

## 字段缺失

| 字段 | 缺失数 | 缺失率 |
|---|---:|---:|
| apply_url | 564 | 100.0% |
| company_raw | 2 | 0.35% |
| company_website | 564 | 100.0% |
| company_normalized | 6 | 1.06% |
| description_raw | 313 | 55.5% |
| excerpt_text | 511 | 90.6% |
| state | 564 | 100.0% |
| city | 4 | 0.71% |
| employment_type | 265 | 46.99% |
| posted_at | 564 | 100.0% |
| posted_date | 57 | 10.11% |
| posted_relative_raw | 313 | 55.5% |
| valid_through | 564 | 100.0% |
| salary_min | 534 | 94.68% |
| salary_max | 534 | 94.68% |
| currency | 534 | 94.68% |
| salary_period | 534 | 94.68% |
| occupation_id | 169 | 29.96% |
| classification_confidence | 564 | 100.0% |
| seniority | 313 | 55.5% |
| experience_min | 457 | 81.03% |
| experience_max | 520 | 92.2% |
| education_requirement | 449 | 79.61% |
| raw_payload_file | 313 | 55.5% |

## 使用边界

- 使用了用户的 explore-data 与 pandas-pro：先检查表粒度、缺失、唯一性、日期及覆盖，再写派生表；raw/ 保持不变。
- 技能需求率仅以完整描述可用的去重广告为分母；Indeed 索引摘要不进入分母。当前是所有明确提及技能（required、preferred、unknown），不是“全部必须技能”。
- Indeed 直连返回 403；索引记录可能滞后，不能视为已确认仍在招聘。
- LinkedIn 搜索页按页数截断；部分详情受预算上限影响。查询别名只用于发现，职业分类独立判断。
- 远程职位即使地点标为 Malaysia，也尚未核实跨境申请资格；remote_eligibility=unconfirmed。
- 未知值保留 null；未捏造薪资、发布日期或职位状态。来源日期只有“天”精度时不伪造 UTC 时间点。
- 一次抓取不足以建立可比趋势，当前状态为“正在积累历史数据”。按发布日期分布也不能恢复已消失的广告。
- 没有样本的职业不代表市场没有需求。不得把广告数称为招聘人数或全国职位空缺总量。
- 后续建议：逐日固定查询与分页；补足职业低样本；人工复核待分类；检查平台间重复及未知薪资。
