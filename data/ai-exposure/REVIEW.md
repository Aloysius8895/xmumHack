# AI exposure mapping review (v2, checkpoint 2)

Generated 2026-10-30. Source: Anthropic Economic Index (https://huggingface.co/datasets/Anthropic/EconomicIndex), CC-BY (data).

**How tasks are chosen**: nobody picks them and nothing is ranked by AI penetration. Every task of the career's O*NET occupations that matches the skill's pattern counts, including tasks with no observed AI use (penetration 0).

**How to review**: for each skill, look at the tasks listed under each career and **only remove the irrelevant ones**: add the task text to that skill's `exclude` list in `skill_task_map.json`, or change its `pattern`. Then set `reviewed` to `true` and run the script again.

**Method**: every task of the career's O*NET occupations matching the skill (reviewed, none ranked by penetration); per task penetration x share of automation (directive, feedback_loop) or augmentation (task_iteration, validation, learning) interactions; per skill the mean over its tasks, then over the careers that need it.

**Limits**: Usage of Claude on US O*NET tasks: a signal of where AI enters work, not jobs lost and not Malaysian data.

## Career-level cross-check (against AEI's own job exposure; Spearman rank correlation = 0.77)

| Career | AEI job exposure | Ours from skills (automation + augmentation) | O*NET tasks | Tasks without penetration data |
|---|---|---|---|---|
| data-analyst | 0.4605 | 0.6235 | 35 | 9 |
| frontend-developer | 0.4802 | 0.6834 | 37 | 3 |
| backend-developer | 0.288 | 0.714 | 49 | 17 |
| ui-ux-designer | 0.249 | 0.2055 | 54 | 5 |
| ml-engineer | 0.3404 | 0.703 | 33 | 8 |
| product-manager | 0.1559 | 0.2749 | 17 | 0 |
| forward-deployed-engineer | 0.288 | 0.7979 | 36 | 12 |
| data-scientist | 0.4605 | 0.7264 | 35 | 9 |
| auditor | 0.3478 | 0.4704 | 36 | 13 |
| lawyer | 0.1673 | 0.1499 | 22 | 2 |
| teacher | 0.2901 | 0.2886 | 32 | 3 |
| doctor | 0.084 | 0.1444 | 28 | 4 |
| chef | 0.0 | 0.0324 | 21 | 1 |
| civil-engineer | 0.0081 | 0.0405 | 17 | 4 |

## sql　✅ reviewed

Pattern: `\bsql\b|\bquer(y|ies)\b|database` → automation **0.4052**, augmentation **0.5559**

Reviewer note: [AI 规则初审 2026-10-30] 加词边界；[AI 任务初审 2026-10-30] 2 条都是 BI 工具/数据库相关，全部保留

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Maintain or update business intelligence tools, databases, dashboards, systems, or methods. ※ | 1.0 | 0.374 | 0.626 |
| Create business intelligence tools or systems, including design of related databases, spreadsheets, or outputs. | 0.9223 | 0.4365 | 0.4858 |

**data-scientist**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Maintain or update business intelligence tools, databases, dashboards, systems, or methods. ※ | 1.0 | 0.374 | 0.626 |
| Create business intelligence tools or systems, including design of related databases, spreadsheets, or outputs. | 0.9223 | 0.4365 | 0.4858 |

## excel　✅ reviewed

Pattern: `spreadsheet` → automation **0.4365**, augmentation **0.4858**

Reviewer note: [AI 任务初审 2026-10-30] 只有 1 条任务（含 spreadsheets），相关，保留；样本很薄

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Create business intelligence tools or systems, including design of related databases, spreadsheets, or outputs. | 0.9223 | 0.4365 | 0.4858 |

## statistics　✅ reviewed

Pattern: `statistic` → automation **0.1691**, augmentation **0.296**

Reviewer note: [AI 任务初审 2026-10-30] 6 条都是统计分析，全部保留

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Analyze and interpret statistical data to identify significant differences in relationships among sources of information. | 0.0 | 0.0 | 0.0 |
| Adapt statistical methods to solve specific problems in many fields, such as economics, biology, and engineering. | 0.0 | 0.0 | 0.0 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |
| Evaluate the statistical methods and procedures used to obtain data to ensure validity, applicability, efficiency, and accuracy. | 0.0 | 0.0 | 0.0 |
| Report results of statistical analyses in peer-reviewed papers and technical manuals. | 0.9237 | 0.2335 | 0.6902 |

**data-scientist**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Analyze and interpret statistical data to identify significant differences in relationships among sources of information. | 0.0 | 0.0 | 0.0 |
| Adapt statistical methods to solve specific problems in many fields, such as economics, biology, and engineering. | 0.0 | 0.0 | 0.0 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |
| Evaluate the statistical methods and procedures used to obtain data to ensure validity, applicability, efficiency, and accuracy. | 0.0 | 0.0 | 0.0 |
| Report results of statistical analyses in peer-reviewed papers and technical manuals. | 0.9237 | 0.2335 | 0.6902 |

## python　✅ reviewed

Pattern: `\bprogramm|\bcode\b|\bcoding\b|software|\bscript` → automation **0.329**, augmentation **0.5784**

Reviewer note: [AI 规则初审 2026-10-30] 去掉 script 误匹配 description/prescription；program 改为 programm（避免匹配“项目/计划 programs”）；[AI 任务初审 2026-10-30] 删除督导、采购、网络维护、硬件设计、需求分析，只保留写/改代码的任务

**ml-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze problems to develop solutions involving computer hardware and software. | 0.8725 | 0.2786 | 0.5939 |

**forward-deployed-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Modify existing software to correct errors, allow it to adapt to new hardware, or to improve its performance. | 0.9592 | 0.5982 | 0.361 |
| Review and analyze computer printouts and performance indicators to locate code problems, and correct errors by correcting codes. | 0.9237 | 0.4597 | 0.464 |
| Use object-oriented programming languages, as well as client and server applications development processes and multimedia and Internet technology. | 0.9439 | 0.08 | 0.8639 |

## data-cleaning　✅ reviewed

Pattern: `clean|data quality|validat|verif|accura|integrity` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 任务初审 2026-10-30] 删除写设计文档的任务；剩下的“评估统计方法的有效性/准确性”是最接近的，但不是严格意义的数据清洗

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Evaluate the statistical methods and procedures used to obtain data to ensure validity, applicability, efficiency, and accuracy. | 0.0 | 0.0 | 0.0 |

**ml-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Evaluate the statistical methods and procedures used to obtain data to ensure validity, applicability, efficiency, and accuracy. | 0.0 | 0.0 | 0.0 |

## data-visualization　✅ reviewed

Pattern: `chart|\bgraph|visuali|dashboard` → automation **0.4346**, augmentation **0.512**

Reviewer note: [AI 规则初审 2026-10-30] 去掉 report：撰写报告属于写作，不是可视化；[AI 任务初审 2026-10-30] 4 条都是图表/仪表板，全部保留

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Maintain or update business intelligence tools, databases, dashboards, systems, or methods. ※ | 1.0 | 0.374 | 0.626 |
| Provide technical support for existing reports, dashboards, or other tools. | 0.9197 | 0.5837 | 0.336 |
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |

**data-scientist**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |
| Maintain or update business intelligence tools, databases, dashboards, systems, or methods. ※ | 1.0 | 0.374 | 0.626 |
| Provide technical support for existing reports, dashboards, or other tools. | 0.9197 | 0.5837 | 0.336 |

## communication　✅ reviewed

Pattern: `\bpresent|communicat|explain|consult|advis|discuss|confer` → automation **0.0366**, augmentation **0.1254**

Reviewer note: [AI 规则初审 2026-10-30] present 加词边界，避免匹配 represent（律师代表客户是核心法律工作）；[AI 任务初审 2026-10-30] 删除只是字面命中的任务：画草图、食物摆盘（presentation）、持续学习/参会、法律分析（advisability）、使用教具

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Communicate with customers, competitors, suppliers, professional organizations, or others to stay abreast of industry or business trends. | 0.0 | 0.0 | 0.0 |

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Confer with clients to discuss and determine layout design. | 0.0 | 0.0 | 0.0 |
| Confer with management or development teams to prioritize needs, resolve conflicts, develop content criteria, or choose solutions. | 0.0 | 0.0 | 0.0 |
| Communicate with network personnel or Web site hosting agencies to address hardware or software issues affecting Web sites. | 0.0 | 0.0 | 0.0 |
| Provide clear, detailed descriptions of Web site specifications, such as product features, activities, software, communication protocols, programming languages, and operating systems software and hardware. | 0.778 | 0.2593 | 0.5187 |

**product-manager**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Consult with users, management, vendors, and technicians to assess computing needs and system requirements. | 0.7066 | 0.1555 | 0.5511 |

**forward-deployed-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Consult with management to ensure agreement on system principles. | 0.0 | 0.0 | 0.0 |
| Confer with clients regarding the nature of the information processing or computation needs a computer program is to address. | 0.7448 | 0.2123 | 0.5325 |

**data-scientist**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Communicate with customers, competitors, suppliers, professional organizations, or others to stay abreast of industry or business trends. | 0.0 | 0.0 | 0.0 |

**auditor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Confer with company officials about financial and regulatory matters. | 0.0 | 0.0 | 0.0 |
| Advise clients in areas such as compensation, employee health care benefits, the design of accounting or data processing systems, or long-range tax or estate plans. | 0.0 | 0.0 | 0.0 |

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Present evidence to defend clients or prosecute defendants in criminal or civil litigation. | 0.0 | 0.0 | 0.0 |
| Present and summarize cases to judges and juries. | 0.0 | 0.0 | 0.0 |
| Advise clients concerning business transactions, claim liability, advisability of prosecuting or defending lawsuits, or legal rights and obligations. | 0.7686 | 0.0 | 0.7686 |
| Confer with colleagues with specialties in appropriate areas of legal issue to establish and verify bases for legal proceedings. | 0.0 | 0.0 | 0.0 |
| Probate wills and represent and advise executors and administrators of estates. | 0.0 | 0.0 | 0.0 |

**teacher**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Instruct through lectures, discussions, and demonstrations in one or more subjects, such as English, mathematics, or social studies. | 0.8533 | 0.1852 | 0.6681 |
| Establish clear objectives for all lessons, units, and projects and communicate those objectives to students. | 0.0 | 0.0 | 0.0 |
| Confer with parents or guardians, other teachers, counselors, and administrators to resolve students' behavioral and academic problems. | 0.0 | 0.0 | 0.0 |
| Meet with parents and guardians to discuss their children's progress and to determine priorities for their children and their resource needs. | 0.0 | 0.0 | 0.0 |
| Meet with other professionals to discuss individual students' needs and progress. | 0.0 | 0.0 | 0.0 |
| Confer with other staff members to plan and schedule lessons promoting learning, following approved curricula. | 0.0 | 0.0 | 0.0 |

**doctor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Explain procedures and discuss test results or prescribed treatments with patients. | 0.8522 | 0.1826 | 0.6696 |
| Advise patients and community members concerning diet, activity, hygiene, and disease prevention. | 0.0 | 0.0 | 0.0 |
| Advise surgeon of a patient's risk status and recommend appropriate intervention to minimize risk. | 0.0 | 0.0 | 0.0 |
| Provide consulting services to other doctors caring for patients with special or difficult problems. | 0.0 | 0.0 | 0.0 |

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Meet with customers to discuss menus for special occasions, such as weddings, parties, or banquets. | 0.0 | 0.0 | 0.0 |

**civil-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare or present public reports on topics such as bid proposals, deeds, environmental impact statements, or property and right-of-way descriptions. | 0.0 | 0.0 | 0.0 |

## html-css　✅ reviewed

Pattern: `\bweb|html|page` → automation **0.3846**, augmentation **0.3089**

Reviewer note: [AI 任务初审 2026-10-30] 只保留建站、写页面代码、页面模板、样式指南、链接维护；删除备份、数据库、商业策略、测试、SEO、写规格文档、技术选型

**frontend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Design, build, or maintain Web sites, using authoring or scripting languages, content creation tools, management tools, and digital media. | 0.9054 | 0.5003 | 0.4051 |
| Perform or direct Web site updates. | 0.0 | 0.0 | 0.0 |
| Write supporting code for Web applications or Web sites. | 0.8944 | 0.4384 | 0.456 |
| Develop and document style guidelines for Web site content. | 0.8662 | 0.3022 | 0.564 |
| Develop Web site maps, application models, image templates, or page templates that meet project goals, user needs, or industry standards. | 0.8819 | 0.3888 | 0.4931 |
| Identify or maintain links to and from other Web sites and check links to ensure proper functioning. | 1.0 | 0.4473 | 0.5527 |
| Create searchable indices for Web page content. | 1.0 | 1.0 | 0.0 |
| Create web models or prototypes that include physical, interface, logical, or data models. | 0.0 | 0.0 | 0.0 |

## javascript　✅ reviewed

Pattern: `\bprogramm|\bcode\b|\bcoding\b|web application|\bscript` → automation **0.4318**, augmentation **0.4956**

Reviewer note: [AI 规则初审 2026-10-30] 同 python：修 script / program 误匹配；[AI 任务初审 2026-10-30] 只保留写代码、评估代码、用脚本语言建站

**frontend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Design, build, or maintain Web sites, using authoring or scripting languages, content creation tools, management tools, and digital media. | 0.9054 | 0.5003 | 0.4051 |
| Evaluate code to ensure that it is valid, is properly structured, meets industry standards, and is compatible with browsers, devices, or operating systems. | 0.9824 | 0.3566 | 0.6258 |
| Write supporting code for Web applications or Web sites. | 0.8944 | 0.4384 | 0.456 |

## react　✅ reviewed

Pattern: `\binterface|front.?end|web application` → automation **0.2192**, augmentation **0.228**

Reviewer note: [AI 规则初审 2026-10-30] 去掉 user：太宽，与 user-research 重叠；[AI 任务初审 2026-10-30] 删除数据库任务

**frontend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Write supporting code for Web applications or Web sites. | 0.8944 | 0.4384 | 0.456 |
| Create web models or prototypes that include physical, interface, logical, or data models. | 0.0 | 0.0 | 0.0 |

## git　✅ reviewed

Pattern: `\bversion|source code|configuration management|revision control` → no matching task → shown as "no source"

Reviewer note: [AI 规则初审 2026-10-30] 原规则 0 匹配；version 加词边界（避免 conversion），新增 back up（网页开发任务里的备份/恢复最接近版本管理）；[AI 任务初审 2026-10-30] O*NET 没有版本管理相关任务；“备份文件/数据库集群”不是 git，用作代理会误导（渗透率 0 会被理解成 AI 用不上 git）。规则恢复为不放宽，显示「无来源」

## accessibility　✅ reviewed

Pattern: `accessib|usab|compatib|disab` → automation **0.1783**, augmentation **0.3129**

Reviewer note: [AI 任务初审 2026-10-30] 2 条：浏览器/设备兼容性检查、网站设计考虑无障碍。是最接近的任务，保留；上一轮你没通过这个技能，请再确认

**frontend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Evaluate code to ensure that it is valid, is properly structured, meets industry standards, and is compatible with browsers, devices, or operating systems. | 0.9824 | 0.3566 | 0.6258 |
| Incorporate technical considerations into Web site design plans, such as budgets, equipment, performance requirements, or legal issues including accessibility and privacy. | 0.0 | 0.0 | 0.0 |

## api-integration　☐ to review

Pattern: `\binterface|integrat|\bapi\b|coordinate and link` → automation **0.398**, augmentation **0.4596**

Reviewer note: [AI 任务初审 2026-10-30] 删除商业策略、原型任务。规则新增 coordinate and link，以匹配系统分析师“连接组织内各计算机系统”这类任务；新匹配到的任务还没看过

**forward-deployed-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Use the computer in the analysis and solution of business problems, such as development of integrated production and inventory control and cost analysis systems. | 0.8576 | 0.398 | 0.4596 |

## backend-language　✅ reviewed

Pattern: `\bprogramm|\bcode\b|\bcoding\b|software|\bapplications?\b` → automation **0.3951**, augmentation **0.4803**

Reviewer note: [AI 任务初审 2026-10-30] 规则与 python 统一（program→programm）；删除督导、沟通、安装、选型、测试任务，只保留写/改代码与数据模型

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Modify existing software to correct errors, allow it to adapt to new hardware, or to improve its performance. | 0.9592 | 0.5982 | 0.361 |
| Develop data models for applications, metadata tables, views or related database structures. | 0.8337 | 0.2987 | 0.535 |
| Design database applications, such as interfaces, data transfer mechanisms, global temporary tables, data partitions, and function-based indexes to enable efficient access of the generic database structure. | 0.8235 | 0.3496 | 0.4739 |
| Develop or maintain archived procedures, procedural codes, or queries for applications. | 0.8849 | 0.3337 | 0.5512 |

## databases　✅ reviewed

Pattern: `database` → automation **0.1846**, augmentation **0.424**

Reviewer note: [AI 任务初审 2026-10-30] 12 条都是数据库工作，全部保留

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Develop database architectural strategies at the modeling, design and implementation stages to address business or industry requirements. | 0.7425 | 0.1909 | 0.5516 |
| Develop data models for applications, metadata tables, views or related database structures. | 0.8337 | 0.2987 | 0.535 |
| Set up database clusters, backup, or recovery processes. | 0.0 | 0.0 | 0.0 |
| Create and enforce database development standards. | 0.7943 | 0.2837 | 0.5106 |
| Develop and document database architectures. | 0.829 | 0.2504 | 0.5786 |
| Design database applications, such as interfaces, data transfer mechanisms, global temporary tables, data partitions, and function-based indexes to enable efficient access of the generic database structure. | 0.8235 | 0.3496 | 0.4739 |
| Document and communicate database schemas, using accepted notations. | 0.8885 | 0.2335 | 0.655 |
| Identify, evaluate and recommend hardware or software technologies to achieve desired database performance. | 0.732 | 0.1954 | 0.5366 |
| Demonstrate database technical functionality, such as performance, security and reliability. | 0.7415 | 0.1335 | 0.608 |
| Test changes to database applications or systems. | 0.0 | 0.0 | 0.0 |
| Identify and correct deviations from database development standards. | 0.0 | 0.0 | 0.0 |
| Plan and install upgrades of database management system software to enhance database performance. ※ | 0.9184 | 0.2799 | 0.6385 |

## rest-api　✅ reviewed

Pattern: `(?<!user )interface|web service|\bapi\b` → automation **0.3496**, augmentation **0.4739**

Reviewer note: [AI 规则初审 2026-10-30] 排除 user interface（那是前端，不是 API）；[AI 任务初审 2026-10-30] 只有 1 条（数据库应用的接口与数据传输机制），相关，保留；样本很薄

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Design database applications, such as interfaces, data transfer mechanisms, global temporary tables, data partitions, and function-based indexes to enable efficient access of the generic database structure. | 0.8235 | 0.3496 | 0.4739 |

## cloud-deploy　✅ reviewed

Pattern: `deploy|install|configur|server|cloud|network` → automation **0.3216**, augmentation **0.4612**

Reviewer note: [AI 任务初审 2026-10-30] 删除机房供电、温湿度设备采购（硬件设施）和写代码任务

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze information to determine, recommend, and plan installation of a new system or modification of an existing system. | 0.8614 | 0.2642 | 0.5972 |
| Coordinate installation of software system. | 0.0 | 0.0 | 0.0 |
| Plan and install upgrades of database management system software to enhance database performance. ※ | 0.9184 | 0.2799 | 0.6385 |

**forward-deployed-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Test, maintain, and monitor computer programs and systems, including coordinating the installation of computer programs and systems. | 0.9722 | 0.4617 | 0.5105 |

## testing　✅ reviewed

Pattern: `\btest|debug|\berrors?\b` → automation **0.2991**, augmentation **0.1805**

Reviewer note: [AI 规则初审 2026-10-30] test 加词边界，避免匹配 latest/contest/attest；[AI 任务初审 2026-10-30] 2 条都是修错/测试，保留

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Modify existing software to correct errors, allow it to adapt to new hardware, or to improve its performance. | 0.9592 | 0.5982 | 0.361 |
| Test changes to database applications or systems. | 0.0 | 0.0 | 0.0 |

## user-research　✅ reviewed

Pattern: `\busers?\b|client|customer|requirement|survey|interview|(user|customer|client) needs` → automation **0.0688**, augmentation **0.213**

Reviewer note: [AI 规则初审 2026-10-30] 去掉 need：会匹配所有 “as needed”；[AI 任务初审 2026-10-30] 删除只因 client/user 字眼命中的制作和技术支持任务；保留与客户/用户沟通需求、分析用户需求、处理用户反馈

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Confer with clients to discuss and determine layout design. | 0.0 | 0.0 | 0.0 |
| Identify problems uncovered by testing or customer feedback, and correct problems or refer problems to appropriate personnel for correction. | 0.0 | 0.0 | 0.0 |
| Analyze user needs to determine technical requirements. | 0.0 | 0.0 | 0.0 |
| Collaborate with management or users to develop e-commerce strategies and to integrate these strategies with Web sites. | 0.8411 | 0.24 | 0.6011 |

**product-manager**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Consult with users, management, vendors, and technicians to assess computing needs and system requirements. | 0.7066 | 0.1555 | 0.5511 |
| Evaluate data processing proposals to assess project feasibility and requirements. | 0.0 | 0.0 | 0.0 |

## prototyping　✅ reviewed

Pattern: `prototyp|mock-?up|sketch|layout|wireframe|storyboard` → automation **0.0659**, augmentation **0.1467**

Reviewer note: [AI 规则初审 2026-10-30] 去掉 model（ML/统计模型），加 wireframe/storyboard；上轮未通过，需人工确认；[AI 任务初审 2026-10-30] 删除印刷排版流程和客户沟通；保留设计概念、草图、版式、网页原型。上一轮你没通过这个技能，请再确认

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Create designs, concepts, and sample layouts, based on knowledge of layout principles and esthetic design concepts. | 0.0 | 0.0 | 0.0 |
| Develop graphics and layouts for product illustrations, company logos, and Web sites. | 0.8504 | 0.2636 | 0.5868 |
| Prepare illustrations or rough sketches of material, discussing them with clients or supervisors and making necessary changes. | 0.0 | 0.0 | 0.0 |
| Create web models or prototypes that include physical, interface, logical, or data models. | 0.0 | 0.0 | 0.0 |

## figma　✅ reviewed

Pattern: `layout|graphic|illustrat|mock-?up|wireframe` → automation **0.1406**, augmentation **0.1958**

Reviewer note: [AI 规则初审 2026-10-30] 去掉 design：几乎匹配设计师全部任务，失去区分度；[AI 任务初审 2026-10-30] 只保留数字化设计与排版任务；删除手绘草图、印刷流程、电视广播图像、客户沟通

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Create designs, concepts, and sample layouts, based on knowledge of layout principles and esthetic design concepts. | 0.0 | 0.0 | 0.0 |
| Determine size and arrangement of illustrative material and copy, and select style and size of type. | 0.8319 | 0.4396 | 0.3923 |
| Develop graphics and layouts for product illustrations, company logos, and Web sites. | 0.8504 | 0.2636 | 0.5868 |
| Key information into computer equipment to create layouts for client or supervisor. | 0.0 | 0.0 | 0.0 |
| Draw and print charts, graphs, illustrations, and other artwork, using computer. | 0.0 | 0.0 | 0.0 |

## visual-design　✅ reviewed

Pattern: `visual|colou?r|graphic|illustrat|layout|typograph` → automation **0.1005**, augmentation **0.1399**

Reviewer note: [AI 任务初审 2026-10-30] 删除印刷制作流程和客户沟通，保留视觉设计本身

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Create designs, concepts, and sample layouts, based on knowledge of layout principles and esthetic design concepts. | 0.0 | 0.0 | 0.0 |
| Determine size and arrangement of illustrative material and copy, and select style and size of type. | 0.8319 | 0.4396 | 0.3923 |
| Develop graphics and layouts for product illustrations, company logos, and Web sites. | 0.8504 | 0.2636 | 0.5868 |
| Prepare illustrations or rough sketches of material, discussing them with clients or supervisors and making necessary changes. | 0.0 | 0.0 | 0.0 |
| Draw and print charts, graphs, illustrations, and other artwork, using computer. | 0.0 | 0.0 | 0.0 |
| Study illustrations and photographs to plan presentation of materials, products, or services. | 0.0 | 0.0 | 0.0 |
| Produce still and animated graphics for on-air and taped portions of television news broadcasts, using electronic video equipment. | 0.0 | 0.0 | 0.0 |

## usability-testing　☐ to review

Pattern: `usab|uncovered by testing|(customer|user) feedback|user experience` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] 原来 test 会匹配网页开发的代码测试；改为必须与 user 同时出现；[AI 任务初审 2026-10-30] 原规则 0 匹配；改为匹配“测试或客户反馈中发现的问题”这类任务（网页开发职业里有）。新匹配到的任务还没看过

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Identify problems uncovered by testing or customer feedback, and correct problems or refer problems to appropriate personnel for correction. | 0.0 | 0.0 | 0.0 |

## ml-math　✅ reviewed

Pattern: `mathemat|statistic|model|algorithm` → automation **0.1593**, augmentation **0.3018**

Reviewer note: [AI 任务初审 2026-10-30] 8 条都是数学/统计建模，全部保留

**ml-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Conduct logical analyses of business, scientific, engineering, and other technical problems, formulating mathematical models of problems for solution by computers. | 0.8987 | 0.2602 | 0.6385 |
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Analyze and interpret statistical data to identify significant differences in relationships among sources of information. | 0.0 | 0.0 | 0.0 |
| Adapt statistical methods to solve specific problems in many fields, such as economics, biology, and engineering. | 0.0 | 0.0 | 0.0 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |
| Evaluate the statistical methods and procedures used to obtain data to ensure validity, applicability, efficiency, and accuracy. | 0.0 | 0.0 | 0.0 |
| Examine theories, such as those of probability and inference, to discover mathematical bases for new or improved methods of obtaining and evaluating numerical data. | 0.0 | 0.0 | 0.0 |
| Report results of statistical analyses in peer-reviewed papers and technical manuals. | 0.9237 | 0.2335 | 0.6902 |

## ml-frameworks　✅ reviewed

Pattern: `machine learning|model|algorithm|data mining` → automation **0.3733**, augmentation **0.5431**

Reviewer note: [AI 任务初审 2026-10-30] 删除“维护模型文档模板库”（model 指文档模板，不是 ML 模型）

**ml-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Conduct logical analyses of business, scientific, engineering, and other technical problems, formulating mathematical models of problems for solution by computers. | 0.8987 | 0.2602 | 0.6385 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |

**data-scientist**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |

## mlops　✅ reviewed

Pattern: `deploy|monitor|production|maintain.*(system|software|model)` → automation **0.4617**, augmentation **0.5105**

Reviewer note: [AI 规则初审 2026-10-30] 去掉单独的 model 和 maintain：与 ml-frameworks 几乎重复、会匹配 maintain records；[AI 任务初审 2026-10-30] 删除网络维护、预算监控、生产库存系统；只剩 1 条（测试、维护、监控程序与系统），样本很薄

**forward-deployed-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Test, maintain, and monitor computer programs and systems, including coordinating the installation of computer programs and systems. | 0.9722 | 0.4617 | 0.5105 |

## roadmapping　✅ reviewed

Pattern: `\bplan|strateg|priorit|\bgoals?\b` → automation **0.0874**, augmentation **0.1574**

Reviewer note: [AI 规则初审 2026-10-30] plan 加词边界，避免匹配 explanation；[AI 任务初审 2026-10-30] 删除 IT 基础设施/灾备任务，保留计划、目标、优先级

**product-manager**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Review project plans to plan and coordinate project activity. | 0.0 | 0.0 | 0.0 |
| Develop and interpret organizational goals, policies, and procedures. | 0.7344 | 0.2623 | 0.4721 |
| Direct daily operations of department, analyzing workflow, establishing priorities, developing standards and setting deadlines. | 0.0 | 0.0 | 0.0 |

## agile　✅ reviewed

Pattern: `coordinat|team|schedul|collaborat` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 任务初审 2026-10-30] 只有 1 条（审查项目计划、协调项目活动），保留；样本很薄

**product-manager**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Review project plans to plan and coordinate project activity. | 0.0 | 0.0 | 0.0 |

## market-analysis　✅ reviewed

Pattern: `market|competit|trend|customer|vendor|industry|new technolog|advances in|cost.?benefit|feasibility` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] 原规则 0 匹配；11-3021（IT 经理）任务里没有 market 字眼，放宽到供应商评估、行业/新技术跟踪、成本效益和可行性分析；[AI 任务初审 2026-10-30] 删除与 user-research/沟通重复的任务；保留跟踪技术进展、评估项目可行性。产品经理映射到 IT 经理本身较弱

**product-manager**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Stay abreast of advances in technology. | 0.0 | 0.0 | 0.0 |
| Evaluate data processing proposals to assess project feasibility and requirements. | 0.0 | 0.0 | 0.0 |

## accounting　✅ reviewed

Pattern: `account|financial|ledger|statement` → automation **0.2575**, augmentation **0.3422**

Reviewer note: [AI 任务初审 2026-10-30] 删除归属审计、内控、沟通、代理出庭的任务，只保留记账、报表、会计系统、财务分析

**auditor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Inspect account books and accounting systems for efficiency, effectiveness, and use of accepted accounting procedures to record transactions. | 0.0 | 0.0 | 0.0 |
| Examine inventory to verify journal and ledger entries. | 0.0 | 0.0 | 0.0 |
| Prepare, examine, or analyze accounting records, financial statements, or other financial reports to assess accuracy, completeness, and conformance to reporting and procedural standards. ※ | 0.8929 | 0.4079 | 0.485 |
| Establish tables of accounts and assign entries to proper accounts. ※ | 0.9373 | 0.4281 | 0.5092 |
| Develop, implement, modify, and document recordkeeping and accounting systems, making use of current computer technology. | 0.9107 | 0.4101 | 0.5006 |
| Analyze business operations, trends, costs, revenues, financial commitments, and obligations to project future revenues and expenses or to provide advice. | 0.8571 | 0.2988 | 0.5583 |

## auditing　✅ reviewed

Pattern: `audit|examin|inspect` → automation **0.0992**, augmentation **0.1029**

Reviewer note: [AI 任务初审 2026-10-30] 13 条都是审计工作，全部保留

**auditor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare detailed reports on audit findings. | 0.7793 | 0.4453 | 0.334 |
| Supervise auditing of establishments, and determine scope of investigation required. | 0.0 | 0.0 | 0.0 |
| Report to management about asset utilization and audit results, and recommend changes in operations and financial activities. | 0.0 | 0.0 | 0.0 |
| Inspect account books and accounting systems for efficiency, effectiveness, and use of accepted accounting procedures to record transactions. | 0.0 | 0.0 | 0.0 |
| Examine records and interview workers to ensure recording of transactions and compliance with laws and regulations. ※ | 0.954 | 0.4358 | 0.5182 |
| Examine and evaluate financial and information systems, recommending controls to ensure system reliability and data integrity. | 0.0 | 0.0 | 0.0 |
| Examine whether the organization's objectives are reflected in its management activities, and whether employees understand the objectives. | 0.0 | 0.0 | 0.0 |
| Inspect cash on hand, notes receivable and payable, negotiable securities, and canceled checks to confirm records are accurate. | 0.0 | 0.0 | 0.0 |
| Examine inventory to verify journal and ledger entries. | 0.0 | 0.0 | 0.0 |
| Conduct pre-implementation audits to determine if systems and programs under development will work as planned. | 0.0 | 0.0 | 0.0 |
| Audit payroll and personnel records to determine unemployment insurance premiums, workers' compensation coverage, liabilities, and compliance with tax laws. | 0.0 | 0.0 | 0.0 |
| Review taxpayer accounts, and conduct audits on-site, by correspondence, or by summoning taxpayer to office. | 0.0 | 0.0 | 0.0 |
| Prepare, examine, or analyze accounting records, financial statements, or other financial reports to assess accuracy, completeness, and conformance to reporting and procedural standards. ※ | 0.8929 | 0.4079 | 0.485 |

## internal-control　✅ reviewed

Pattern: `\bcontrols?\b|risk|complian|fraud` → automation **0.2129**, augmentation **0.2531**

Reviewer note: [AI 规则初审 2026-10-30] control 加词边界，避免匹配 controller；[AI 任务初审 2026-10-30] 删除报税任务

**auditor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Collect and analyze data to detect deficient controls, duplicated effort, extravagance, fraud, or non-compliance with laws, regulations, and management policies. ※ | 0.9099 | 0.4156 | 0.4943 |
| Examine records and interview workers to ensure recording of transactions and compliance with laws and regulations. ※ | 0.954 | 0.4358 | 0.5182 |
| Examine and evaluate financial and information systems, recommending controls to ensure system reliability and data integrity. | 0.0 | 0.0 | 0.0 |
| Audit payroll and personnel records to determine unemployment insurance premiums, workers' compensation coverage, liabilities, and compliance with tax laws. | 0.0 | 0.0 | 0.0 |

## legal-research　✅ reviewed

Pattern: `research|statute|regulation|case law|precedent|interpret` → automation **0.0185**, augmentation **0.1696**

Reviewer note: [AI 任务初审 2026-10-30] 4 条都是法律研究/解释，全部保留

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Study Constitution, statutes, decisions, regulations, and ordinances of quasi-judicial bodies to determine ramifications for cases. | 0.0 | 0.0 | 0.0 |
| Interpret laws, rulings and regulations for individuals and businesses. | 0.7523 | 0.0741 | 0.6782 |
| Analyze the probable outcomes of cases, using knowledge of legal precedents. | 0.0 | 0.0 | 0.0 |
| Help develop federal and state programs, draft and interpret laws and legislation, and establish enforcement procedures. | 0.0 | 0.0 | 0.0 |

## legal-writing　✅ reviewed

Pattern: `prepare|draft|writ|document` → automation **0.1458**, augmentation **0.1035**

Reviewer note: [AI 任务初审 2026-10-30] 3 条都是法律文书写作，全部保留

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare legal briefs and opinions, and file appeals in state and federal courts of appeal. | 0.7477 | 0.4373 | 0.3104 |
| Search for and examine public and other legal records to write opinions or establish ownership. | 0.0 | 0.0 | 0.0 |
| Help develop federal and state programs, draft and interpret laws and legislation, and establish enforcement procedures. | 0.0 | 0.0 | 0.0 |

## negotiation　✅ reviewed

Pattern: `negotiat|\bsettle|\bmediat|agreement` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] mediat 加词边界，避免匹配 immediately/intermediate；[AI 任务初审 2026-10-30] 只有 1 条（谈判民事和解），保留

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Negotiate settlements of civil disputes. | 0.0 | 0.0 | 0.0 |

## lesson-planning　✅ reviewed

Pattern: `\bplan|lesson|curricul|instruction|material` → automation **0.1683**, augmentation **0.195**

Reviewer note: [AI 规则初审 2026-10-30] plan 加词边界，避免匹配 explanation；[AI 任务初审 2026-10-30] 删除器材安全、教具使用、物资管理任务

**teacher**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Adapt teaching methods and instructional materials to meet students' varying needs and interests. | 0.8162 | 0.2376 | 0.5786 |
| Prepare materials and classrooms for class activities. | 0.0 | 0.0 | 0.0 |
| Plan and conduct activities for a balanced program of instruction, demonstration, and work time that provides students with opportunities to observe, question, and investigate. | 0.8702 | 0.3955 | 0.4747 |
| Establish clear objectives for all lessons, units, and projects and communicate those objectives to students. | 0.0 | 0.0 | 0.0 |
| Prepare objectives and outlines for courses of study, following curriculum guidelines or requirements of states and schools. | 0.8566 | 0.5451 | 0.3115 |
| Confer with other staff members to plan and schedule lessons promoting learning, following approved curricula. | 0.0 | 0.0 | 0.0 |
| Plan and supervise class projects, field trips, visits by guest speakers, or other experiential activities, and guide students in learning from those activities. | 0.0 | 0.0 | 0.0 |

## classroom-management　✅ reviewed

Pattern: `classroom|behavio|disciplin|\border\b(?! to)|rules` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] order 只匹配独立单词且排除 in order to，避免匹配 disorder/border；[AI 任务初审 2026-10-30] 删除备课物资任务；“观察评估学生表现”归入 assessment（它的替代度 0.80 原本把课堂管理拉高了）

**teacher**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Establish and enforce rules for behavior and procedures for maintaining order among students. | 0.0 | 0.0 | 0.0 |
| Enforce all administration policies and rules governing students. | 0.0 | 0.0 | 0.0 |
| Confer with parents or guardians, other teachers, counselors, and administrators to resolve students' behavioral and academic problems. | 0.0 | 0.0 | 0.0 |

## assessment　✅ reviewed

Pattern: `evaluat|assess|\bgrad(e|es|ing)\b(?! level)|\btest|progress` → automation **0.4664**, augmentation **0.1626**

Reviewer note: [AI 规则初审 2026-10-30] test 加词边界；grade 排除 grade level（年级不是评分）；[AI 任务初审 2026-10-30] 删除年级（grades）误匹配、家长/同事沟通、学校项目评估

**teacher**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Assign and grade class work and homework. | 0.0 | 0.0 | 0.0 |
| Observe and evaluate students' performance, behavior, social development, and physical health. | 0.9429 | 0.8015 | 0.1414 |
| Prepare, administer, and grade tests and assignments to evaluate students' progress. | 0.9441 | 0.5978 | 0.3463 |

## clinical-knowledge　✅ reviewed

Pattern: `diagnos|treat|prescri|disease|clinical|condition|examin` → automation **0.0396**, augmentation **0.067**

Reviewer note: [AI 任务初审 2026-10-30] 删除归属沟通、行政报告、公共卫生项目管理、科研的任务，保留诊断、治疗、开药、手术、监测

**doctor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prescribe or administer medication, therapy, and other specialized medical care to treat or prevent illness, disease, or injury. | 0.0 | 0.0 | 0.0 |
| Analyze records, reports, test results, or examination information to diagnose medical condition of patient. | 0.9595 | 0.3564 | 0.6031 |
| Provide and manage long-term, comprehensive medical care, including diagnosis and nonsurgical treatment of diseases, for adult patients in an office or hospital. | 0.0 | 0.0 | 0.0 |
| Make diagnoses when different illnesses occur together or in situations where the diagnosis may be obscure. | 0.0 | 0.0 | 0.0 |
| Monitor patients' conditions and progress and reevaluate treatments as necessary. | 0.0 | 0.0 | 0.0 |
| Immunize patients to protect them from preventable diseases. | 0.0 | 0.0 | 0.0 |
| Operate on patients to remove, repair, or improve functioning of diseased or injured body parts and systems. | 0.0 | 0.0 | 0.0 |
| Prescribe or administer treatment, therapy, medication, vaccination, and other specialized medical care to treat or prevent illness, disease, or injury. | 0.0 | 0.0 | 0.0 |
| Order, perform, and interpret tests and analyze records, reports, and examination information to diagnose patients' condition. | 0.0 | 0.0 | 0.0 |

## patient-care　✅ reviewed

Pattern: `patient` → automation **0.049**, augmentation **0.1157**

Reviewer note: [AI 任务初审 2026-10-30] 删除医生之间会诊（不直接面对病人）

**doctor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Explain procedures and discuss test results or prescribed treatments with patients. | 0.8522 | 0.1826 | 0.6696 |
| Analyze records, reports, test results, or examination information to diagnose medical condition of patient. | 0.9595 | 0.3564 | 0.6031 |
| Provide and manage long-term, comprehensive medical care, including diagnosis and nonsurgical treatment of diseases, for adult patients in an office or hospital. | 0.0 | 0.0 | 0.0 |
| Monitor patients' conditions and progress and reevaluate treatments as necessary. | 0.0 | 0.0 | 0.0 |
| Advise patients and community members concerning diet, activity, hygiene, and disease prevention. | 0.0 | 0.0 | 0.0 |
| Immunize patients to protect them from preventable diseases. | 0.0 | 0.0 | 0.0 |
| Refer patient to medical specialist or other practitioner when necessary. | 0.0 | 0.0 | 0.0 |
| Advise surgeon of a patient's risk status and recommend appropriate intervention to minimize risk. | 0.0 | 0.0 | 0.0 |
| Operate on patients to remove, repair, or improve functioning of diseased or injured body parts and systems. | 0.0 | 0.0 | 0.0 |
| Order, perform, and interpret tests and analyze records, reports, and examination information to diagnose patients' condition. | 0.0 | 0.0 | 0.0 |
| Refer patients to medical specialists or other practitioners when necessary. | 0.0 | 0.0 | 0.0 |

## medical-ethics　✅ reviewed

Pattern: `ethic|confidential|consent|privacy` → no matching task → shown as "no source"

Reviewer note: [AI 规则初审 2026-10-30] 原规则 0 匹配；O*NET 医生任务基本不写伦理，用“向病人解释风险/治疗方案”（知情同意）做近似。这是代理指标，需人工确认是否接受；[AI 任务初审 2026-10-30] 撤回我上次加的代理规则：它只命中 1 条渗透率 0.85 的任务，单独把医生总分从 0.14 拉到 0.32。O*NET 没有伦理相关任务，恢复原规则，显示「无来源」

## cooking-technique　✅ reviewed

Pattern: `\bcooking\b|\bcook (food|meat|dish)|\bdish(es)?\b|season|ingredient|prepar\w* (food|meal|dish|sauce)` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] 原来 cook 匹配 supervise cooks（管理任务），prepar 匹配 prepare budgets；改为只匹配烹饪动作；[AI 任务初审 2026-10-30] 删除成本估算和菜单规划，保留烹饪、示范和指导烹饪技巧

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Instruct cooks or other workers in the preparation, cooking, garnishing, or presentation of food. | 0.0 | 0.0 | 0.0 |
| Prepare and cook foods of all types, either on a regular basis or for special guests or functions. | 0.0 | 0.0 | 0.0 |
| Demonstrate new cooking techniques or equipment to staff. | 0.0 | 0.0 | 0.0 |

## food-safety　✅ reviewed

Pattern: `sanit|safety|hygien|clean|inspect|storage` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 任务初审 2026-10-30] 2 条都是卫生检查，保留

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Monitor sanitation practices to ensure that employees follow standards and regulations. | 0.0 | 0.0 | 0.0 |
| Inspect supplies, equipment, or work areas to ensure conformance to established standards. | 0.0 | 0.0 | 0.0 |

## menu-planning　✅ reviewed

Pattern: `menu|recipe|food cost|\bprice|portion` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] 去掉单独的 cost：与 project-management 的预算重叠；[AI 任务初审 2026-10-30] 删除采购议价

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze recipes to assign prices to menu items, based on food, labor, and overhead costs. | 0.0 | 0.0 | 0.0 |
| Collaborate with other personnel to plan and develop recipes or menus, taking into account such factors as seasonal availability of ingredients or the likely number of customers. | 0.0 | 0.0 | 0.0 |
| Meet with customers to discuss menus for special occasions, such as weddings, parties, or banquets. | 0.0 | 0.0 | 0.0 |

## engineering-math　✅ reviewed

Pattern: `calculat|\bcompute\b|computation|estimat|analy` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 规则初审 2026-10-30] comput 改为 compute/computation，避免匹配 computer-aided（那是 cad）；[AI 任务初审 2026-10-30] 4 条都是工程计算/分析，全部保留

**civil-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Compute load and grade requirements, water flow rates, or material stress factors to determine design specifications. | 0.0 | 0.0 | 0.0 |
| Estimate quantities and cost of materials, equipment, or labor to determine project feasibility. | 0.0 | 0.0 | 0.0 |
| Analyze survey reports, maps, drawings, blueprints, aerial photography, or other topographical or geologic data. | 0.0 | 0.0 | 0.0 |
| Analyze manufacturing processes or byproducts to identify engineering solutions to minimize the output of carbon or other pollutants. | 0.0 | 0.0 | 0.0 |

## cad　☐ to review

Pattern: `drawing|\bcad\b|computer-a(ided|ssisted)|blueprint|drafting` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 任务初审 2026-10-30] 只匹配到 1 条“分析图纸蓝图”。规则新增 computer-assisted/drafting，以匹配“用计算机辅助设计或绘图工具设计交通、水利系统”这类任务；新匹配到的任务还没看过

**civil-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze survey reports, maps, drawings, blueprints, aerial photography, or other topographical or geologic data. | 0.0 | 0.0 | 0.0 |

## project-management　✅ reviewed

Pattern: `project|schedul|budget|coordinat` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 任务初审 2026-10-30] 删除交通/环境研究，保留项目现场管理、排期、预算、协调

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Supervise or coordinate activities of cooks or workers engaged in food preparation. | 0.0 | 0.0 | 0.0 |
| Determine production schedules and staff requirements necessary to ensure timely delivery of services. | 0.0 | 0.0 | 0.0 |
| Coordinate planning, budgeting, or purchasing for all the food operations within establishments such as clubs, hotels, or restaurant chains. | 0.0 | 0.0 | 0.0 |

**civil-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Inspect project sites to monitor progress and ensure conformance to design specifications and safety or sanitation standards. | 0.0 | 0.0 | 0.0 |
| Manage and direct the construction, operations, or maintenance activities at project site. | 0.0 | 0.0 | 0.0 |
| Estimate quantities and cost of materials, equipment, or labor to determine project feasibility. | 0.0 | 0.0 | 0.0 |
| Identify environmental risks and develop risk management strategies for civil engineering projects. | 0.0 | 0.0 | 0.0 |

※ The task has a penetration but no interaction split; its automation and augmentation shares are the mean of the career's other tasks.
