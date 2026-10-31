# AI exposure mapping review (v2, checkpoint 2)

Generated 2026-10-31. Source: Anthropic Economic Index (https://huggingface.co/datasets/Anthropic/EconomicIndex), CC-BY (data).

**How tasks are chosen**: nobody picks them and nothing is ranked by AI penetration. Every task of the career's O*NET occupations that matches the skill's pattern counts, including tasks with no observed AI use (penetration 0).

**How to review**: for each skill, look at the tasks listed under each career and **only remove the irrelevant ones**: add the task text to that skill's `exclude` list in `skill_task_map.json`, or change its `pattern`. Then set `reviewed` to `true` and run the script again.

**Method**: every task of the career's O*NET occupations matching the skill (reviewed, none ranked by penetration); per task penetration x share of automation (directive, feedback_loop) or augmentation (task_iteration, validation, learning) interactions; per skill the mean over its tasks, then over the careers that need it.

**Limits**: Usage of Claude on US O*NET tasks: a signal of where AI enters work, not jobs lost and not Malaysian data.

## Career-level cross-check (against AEI's own job exposure; Spearman rank correlation = 0.57)

| Career | AEI job exposure | Ours from skills (automation + augmentation) | O*NET tasks | Tasks without penetration data |
|---|---|---|---|---|
| data-analyst | 0.4605 | 0.6398 | 35 | 9 |
| frontend-developer | 0.4802 | 0.0 | 37 | 3 |
| backend-developer | 0.288 | 0.6762 | 49 | 17 |
| ui-ux-designer | 0.249 | 0.208 | 54 | 5 |
| ml-engineer | 0.3404 | 0.3035 | 33 | 8 |
| product-manager | 0.1559 | 0.4849 | 17 | 0 |
| forward-deployed-engineer | 0.288 | 0.2383 | 36 | 12 |
| data-scientist | 0.4605 | 0.5456 | 35 | 9 |
| auditor | 0.3478 | 0.6158 | 36 | 13 |
| lawyer | 0.1673 | 0.1846 | 22 | 2 |
| teacher | 0.2901 | 0.3076 | 32 | 3 |
| doctor | 0.084 | 0.1725 | 19 | 3 |
| chef | 0.0 | 0.0477 | 21 | 1 |
| civil-engineer | 0.0081 | 0.0596 | 17 | 4 |
| accountant | 0.3478 | 0.5282 | 16 | 8 |
| software-engineer | 0.288 | 0.5958 | 31 | 15 |
| electrical-engineer | 0.059 | 0.1007 | 22 | 2 |
| digital-marketer | 0.6483 | 0.4507 | 13 | 0 |
| quantity-surveyor | 0.0 | 0.034 | 13 | 4 |
| hr-executive | 0.4034 | 0.437 | 25 | 1 |
| sales-executive | 0.6279 | 0.646 | 20 | 1 |
| customer-service | 0.7011 | 0.5882 | 15 | 0 |

## sql　✅ reviewed

Pattern: `\bsql\b|structured query language` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 仅接受明确的 SQL 证据；数据库或 BI 工具任务不能单独证明 SQL。

## excel　✅ reviewed

Pattern: `\A(?:Create\ business\ intelligence\ tools\ or\ systems,\ including\ design\ of\ related\ databases,\ spreadsheets,\ or\ outputs\.)\Z` → automation **0.4365**, augmentation **0.4858**

Reviewer note: [AI 语义审查 2026-10-31] 保留电子表格任务作为工具族代理；不能称为 Excel 专属观测，且当前样本只有一条。

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Create business intelligence tools or systems, including design of related databases, spreadsheets, or outputs. | 0.9223 | 0.4365 | 0.4858 |

## statistics　✅ reviewed

Pattern: `\A(?:Report\ results\ of\ statistical\ analyses,\ including\ information\ in\ the\ form\ of\ graphs,\ charts,\ and\ tables\.|Analyze\ and\ interpret\ statistical\ data\ to\ identify\ significant\ differences\ in\ relationships\ among\ sources\ of\ information\.|Adapt\ statistical\ methods\ to\ solve\ specific\ problems\ in\ many\ fields,\ such\ as\ economics,\ biology,\ and\ engineering\.|Process\ large\ amounts\ of\ data\ for\ statistical\ modeling\ and\ graphic\ analysis,\ using\ computers\.|Evaluate\ the\ statistical\ methods\ and\ procedures\ used\ to\ obtain\ data\ to\ ensure\ validity,\ applicability,\ efficiency,\ and\ accuracy\.|Report\ results\ of\ statistical\ analyses\ in\ peer\-reviewed\ papers\ and\ technical\ manuals\.)\Z` → automation **0.1691**, augmentation **0.296**

Reviewer note: [AI 语义审查 2026-10-31] 保留报告中的统计分析、方法评估与结果解释任务。

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

Pattern: `\bpython\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般编程任务不能证明使用 Python。

## data-cleaning　✅ reviewed

Pattern: `\b(?:clean|cleanse|deduplicate|impute|preprocess)\w*\b.{0,50}\bdata\b|\bdata\s+(?:cleaning|cleansing|deduplication|preprocessing)\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 统计方法有效性评估不属于数据清洗；只保留直接的数据清洗或预处理证据。

## data-visualization　✅ reviewed

Pattern: `\A(?:Report\ results\ of\ statistical\ analyses,\ including\ information\ in\ the\ form\ of\ graphs,\ charts,\ and\ tables\.|Process\ large\ amounts\ of\ data\ for\ statistical\ modeling\ and\ graphic\ analysis,\ using\ computers\.)\Z` → automation **0.3904**, augmentation **0.543**

Reviewer note: [AI 语义审查 2026-10-31] 保留明确的图表呈现与图形分析；移除 BI 系统维护和一般技术支持。

**data-analyst**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |

**data-scientist**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Report results of statistical analyses, including information in the form of graphs, charts, and tables. | 0.9446 | 0.3699 | 0.5747 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |

## communication　✅ reviewed

Pattern: `\A(?:Communicate\ with\ customers,\ competitors,\ suppliers,\ professional\ organizations,\ or\ others\ to\ stay\ abreast\ of\ industry\ or\ business\ trends\.|Confer\ with\ clients\ to\ discuss\ and\ determine\ layout\ design\.|Confer\ with\ management\ or\ development\ teams\ to\ prioritize\ needs,\ resolve\ conflicts,\ develop\ content\ criteria,\ or\ choose\ solutions\.|Communicate\ with\ network\ personnel\ or\ Web\ site\ hosting\ agencies\ to\ address\ hardware\ or\ software\ issues\ affecting\ Web\ sites\.|Provide\ clear,\ detailed\ descriptions\ of\ Web\ site\ specifications,\ such\ as\ product\ features,\ activities,\ software,\ communication\ protocols,\ programming\ languages,\ and\ operating\ systems\ software\ and\ hardware\.|Consult\ with\ users,\ management,\ vendors,\ and\ technicians\ to\ assess\ computing\ needs\ and\ system\ requirements\.|Consult\ with\ management\ to\ ensure\ agreement\ on\ system\ principles\.|Confer\ with\ clients\ regarding\ the\ nature\ of\ the\ information\ processing\ or\ computation\ needs\ a\ computer\ program\ is\ to\ address\.|Confer\ with\ company\ officials\ about\ financial\ and\ regulatory\ matters\.|Advise\ clients\ in\ areas\ such\ as\ compensation,\ employee\ health\ care\ benefits,\ the\ design\ of\ accounting\ or\ data\ processing\ systems,\ or\ long\-range\ tax\ or\ estate\ plans\.|Present\ evidence\ to\ defend\ clients\ or\ prosecute\ defendants\ in\ criminal\ or\ civil\ litigation\.|Present\ and\ summarize\ cases\ to\ judges\ and\ juries\.|Advise\ clients\ concerning\ business\ transactions,\ claim\ liability,\ advisability\ of\ prosecuting\ or\ defending\ lawsuits,\ or\ legal\ rights\ and\ obligations\.|Confer\ with\ colleagues\ with\ specialties\ in\ appropriate\ areas\ of\ legal\ issue\ to\ establish\ and\ verify\ bases\ for\ legal\ proceedings\.|Probate\ wills\ and\ represent\ and\ advise\ executors\ and\ administrators\ of\ estates\.|Instruct\ through\ lectures,\ discussions,\ and\ demonstrations\ in\ one\ or\ more\ subjects,\ such\ as\ English,\ mathematics,\ or\ social\ studies\.|Establish\ clear\ objectives\ for\ all\ lessons,\ units,\ and\ projects\ and\ communicate\ those\ objectives\ to\ students\.|Confer\ with\ parents\ or\ guardians,\ other\ teachers,\ counselors,\ and\ administrators\ to\ resolve\ students'\ behavioral\ and\ academic\ problems\.|Meet\ with\ parents\ and\ guardians\ to\ discuss\ their\ children's\ progress\ and\ to\ determine\ priorities\ for\ their\ children\ and\ their\ resource\ needs\.|Meet\ with\ other\ professionals\ to\ discuss\ individual\ students'\ needs\ and\ progress\.|Confer\ with\ other\ staff\ members\ to\ plan\ and\ schedule\ lessons\ promoting\ learning,\ following\ approved\ curricula\.|Explain\ procedures\ and\ discuss\ test\ results\ or\ prescribed\ treatments\ with\ patients\.|Advise\ patients\ and\ community\ members\ concerning\ diet,\ activity,\ hygiene,\ and\ disease\ prevention\.|Advise\ surgeon\ of\ a\ patient's\ risk\ status\ and\ recommend\ appropriate\ intervention\ to\ minimize\ risk\.|Provide\ consulting\ services\ to\ other\ doctors\ caring\ for\ patients\ with\ special\ or\ difficult\ problems\.|Meet\ with\ customers\ to\ discuss\ menus\ for\ special\ occasions,\ such\ as\ weddings,\ parties,\ or\ banquets\.|Prepare\ or\ present\ public\ reports\ on\ topics\ such\ as\ bid\ proposals,\ deeds,\ environmental\ impact\ statements,\ or\ property\ and\ right\-of\-way\ descriptions\.|Consult\ with\ customers\ or\ other\ departments\ on\ project\ status,\ proposals,\ or\ technical\ issues,\ such\ as\ software\ system\ design\ or\ maintenance\.|Confer\ with\ data\ processing\ or\ project\ managers\ to\ obtain\ information\ on\ limitations\ or\ capabilities\ for\ data\ processing\ projects\.|Confer\ with\ engineers,\ customers,\ or\ others\ to\ discuss\ existing\ or\ potential\ engineering\ projects\ or\ products\.|Confer\ with\ engineers,\ customers,\ vendors,\ or\ others\ to\ discuss\ existing\ or\ potential\ electronics\ engineering\ projects\ or\ products\.|Represent\ employer\ at\ conferences,\ meetings,\ boards,\ panels,\ committees,\ or\ working\ groups\ to\ present,\ explain,\ or\ defend\ findings\ or\ recommendations,\ negotiate\ compromises\ or\ agreements,\ or\ exchange\ information\.|Attend\ staff\ conferences\ to\ provide\ management\ with\ information\ and\ proposals\ concerning\ the\ promotion,\ distribution,\ design,\ and\ pricing\ of\ company\ products\ or\ services\.|Confer\ with\ legal\ staff\ to\ resolve\ problems,\ such\ as\ copyright\ infringement\ or\ royalty\ sharing\ with\ outside\ producers\ or\ distributors\.|Consult\ with\ buying\ personnel\ to\ gain\ advice\ regarding\ the\ types\ of\ products\ or\ services\ expected\ to\ be\ in\ demand\.|Consult\ with\ buying\ personnel\ to\ gain\ advice\ regarding\ environmentally\ sound\ or\ sustainable\ products\.|Advise\ business\ or\ other\ groups\ on\ local,\ national,\ or\ international\ factors\ affecting\ the\ buying\ or\ selling\ of\ products\ or\ services\.|Interpret\ and\ explain\ human\ resources\ policies,\ procedures,\ laws,\ standards,\ or\ regulations\.|Confer\ with\ management\ to\ develop\ or\ implement\ personnel\ policies\ or\ procedures\.|Advise\ management\ on\ organizing,\ preparing,\ or\ implementing\ recruiting\ or\ retention\ programs\.|Evaluate\ selection\ or\ testing\ techniques\ by\ conducting\ research\ or\ follow\-up\ activities\ and\ conferring\ with\ management\ or\ supervisory\ personnel\.|Contact\ regular\ and\ prospective\ customers\ to\ demonstrate\ products,\ explain\ product\ features,\ and\ solicit\ orders\.|Consult\ with\ clients\ after\ sales\ or\ contract\ signings\ to\ resolve\ problems\ and\ to\ provide\ ongoing\ support\.|Confer\ with\ customers\ by\ telephone\ or\ in\ person\ to\ provide\ information\ about\ products\ or\ services,\ take\ or\ enter\ orders,\ cancel\ accounts,\ or\ obtain\ details\ of\ complaints\.)\Z` → automation **0.0766**, augmentation **0.1617**

Reviewer note: [AI 语义审查 2026-10-31] 保留解释、表达、咨询和讨论；移除营销效果测量与以查找名单为主的潜客识别。完整任务可能仍包含其他能力。

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

**product-manager** (career to review: not counted yet)

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

**accountant**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Advise clients in areas such as compensation, employee health care benefits, the design of accounting or data processing systems, or long-range tax or estate plans. | 0.0 | 0.0 | 0.0 |

**software-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Consult with customers or other departments on project status, proposals, or technical issues, such as software system design or maintenance. | 0.6464 | 0.1678 | 0.4786 |
| Confer with data processing or project managers to obtain information on limitations or capabilities for data processing projects. | 0.0 | 0.0 | 0.0 |

**electrical-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Confer with engineers, customers, or others to discuss existing or potential engineering projects or products. | 0.0 | 0.0 | 0.0 |

**digital-marketer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Attend staff conferences to provide management with information and proposals concerning the promotion, distribution, design, and pricing of company products or services. | 0.0 | 0.0 | 0.0 |

**hr-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Interpret and explain human resources policies, procedures, laws, standards, or regulations. | 0.7865 | 0.1459 | 0.6406 |
| Confer with management to develop or implement personnel policies or procedures. | 0.0 | 0.0 | 0.0 |
| Advise management on organizing, preparing, or implementing recruiting or retention programs. | 0.0 | 0.0 | 0.0 |
| Evaluate selection or testing techniques by conducting research or follow-up activities and conferring with management or supervisory personnel. | 0.0 | 0.0 | 0.0 |

**sales-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Contact regular and prospective customers to demonstrate products, explain product features, and solicit orders. ※ | 0.9923 | 0.4926 | 0.4997 |
| Consult with clients after sales or contract signings to resolve problems and to provide ongoing support. ※ | 1.0 | 0.4965 | 0.5035 |

**customer-service**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Confer with customers by telephone or in person to provide information about products or services, take or enter orders, cancel accounts, or obtain details of complaints. | 0.991 | 0.3604 | 0.6306 |

## html-css　✅ reviewed

Pattern: `\bhtml\b|\bcss\b|hypertext markup|cascading style` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般建站或页面维护不能独立识别 HTML/CSS 的暴露度。

## javascript　✅ reviewed

Pattern: `\bjavascript\b|\becmascript\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般编程或脚本任务不能证明使用 JavaScript。

## react　✅ reviewed

Pattern: `\breact(?:\.js|js)?\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 界面开发与网页应用不等于 React；此规则按前端框架名称理解。

## git　✅ reviewed

Pattern: `\bgit\b|\bversion control\b|\brevision control\b|\bsource control\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 接受版本控制这一直接能力族，不以备份任务替代；不是 Git 品牌专属统计。

## accessibility　✅ reviewed

Pattern: `\A(?:Incorporate\ technical\ considerations\ into\ Web\ site\ design\ plans,\ such\ as\ budgets,\ equipment,\ performance\ requirements,\ or\ legal\ issues\ including\ accessibility\ and\ privacy\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 仅保留明确提及 accessibility 的任务；浏览器和设备兼容性不等于无障碍。

**frontend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Incorporate technical considerations into Web site design plans, such as budgets, equipment, performance requirements, or legal issues including accessibility and privacy. | 0.0 | 0.0 | 0.0 |

## api-integration　✅ reviewed

Pattern: `\bapi\b|application programming interfaces?` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 系统整合、库存系统和一般 interface 不足以证明 API 集成。

## backend-language　✅ reviewed

Pattern: `\A(?:Modify\ existing\ software\ to\ correct\ errors,\ allow\ it\ to\ adapt\ to\ new\ hardware,\ or\ to\ improve\ its\ performance\.|Develop\ or\ maintain\ archived\ procedures,\ procedural\ codes,\ or\ queries\ for\ applications\.)\Z` → automation **0.532**, augmentation **0.4085**

Reviewer note: [AI 语义审查 2026-10-31] 保留代码修改与过程代码开发；通用编程代理，不识别具体后端语言，也不将数据库建模当成编程。

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Modify existing software to correct errors, allow it to adapt to new hardware, or to improve its performance. | 0.9592 | 0.5982 | 0.361 |
| Develop or maintain archived procedures, procedural codes, or queries for applications. | 0.8849 | 0.3337 | 0.5512 |

**software-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Modify existing software to correct errors, allow it to adapt to new hardware, or to improve its performance. | 0.9592 | 0.5982 | 0.361 |

## databases　✅ reviewed

Pattern: `\A(?:Develop\ database\ architectural\ strategies\ at\ the\ modeling,\ design\ and\ implementation\ stages\ to\ address\ business\ or\ industry\ requirements\.|Develop\ data\ models\ for\ applications,\ metadata\ tables,\ views\ or\ related\ database\ structures\.|Set\ up\ database\ clusters,\ backup,\ or\ recovery\ processes\.|Create\ and\ enforce\ database\ development\ standards\.|Develop\ and\ document\ database\ architectures\.|Design\ database\ applications,\ such\ as\ interfaces,\ data\ transfer\ mechanisms,\ global\ temporary\ tables,\ data\ partitions,\ and\ function\-based\ indexes\ to\ enable\ efficient\ access\ of\ the\ generic\ database\ structure\.|Document\ and\ communicate\ database\ schemas,\ using\ accepted\ notations\.|Identify,\ evaluate\ and\ recommend\ hardware\ or\ software\ technologies\ to\ achieve\ desired\ database\ performance\.|Demonstrate\ database\ technical\ functionality,\ such\ as\ performance,\ security\ and\ reliability\.|Test\ changes\ to\ database\ applications\ or\ systems\.|Identify\ and\ correct\ deviations\ from\ database\ development\ standards\.|Plan\ and\ install\ upgrades\ of\ database\ management\ system\ software\ to\ enhance\ database\ performance\.)\Z` → automation **0.1846**, augmentation **0.424**

Reviewer note: [AI 语义审查 2026-10-31] 数据库架构、建模、标准、备份恢复、性能、测试与升级均相关。

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

Pattern: `\brestful\b|\brest\s+(?:apis?|services?|interfaces?)\b|representational state transfer` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 数据库接口不能证明 REST API；一般 API 也不能证明 REST。

## cloud-deploy　✅ reviewed

Pattern: `\bcloud\b.{0,80}\b(?:deploy|provision|configur|install|migrat)\w*\b|\b(?:deploy|provision|configur|install|migrat)\w*\b.{0,80}\bcloud\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 普通系统安装、数据库升级与网络维护不等于云部署。

## testing　✅ reviewed

Pattern: `\A(?:Modify\ existing\ software\ to\ correct\ errors,\ allow\ it\ to\ adapt\ to\ new\ hardware,\ or\ to\ improve\ its\ performance\.|Test\ changes\ to\ database\ applications\ or\ systems\.)\Z` → automation **0.2991**, augmentation **0.1805**

Reviewer note: [AI 语义审查 2026-10-31] 保留软件测试与错误修复；包含调试这一相邻能力，非单一测试类型专属统计。

**backend-developer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Modify existing software to correct errors, allow it to adapt to new hardware, or to improve its performance. | 0.9592 | 0.5982 | 0.361 |
| Test changes to database applications or systems. | 0.0 | 0.0 | 0.0 |

## user-research　✅ reviewed

Pattern: `\A(?:Confer\ with\ clients\ to\ discuss\ and\ determine\ layout\ design\.|Analyze\ user\ needs\ to\ determine\ technical\ requirements\.|Consult\ with\ users,\ management,\ vendors,\ and\ technicians\ to\ assess\ computing\ needs\ and\ system\ requirements\.)\Z` → automation **0.0777**, augmentation **0.2756**

Reviewer note: [AI 语义审查 2026-10-31] 保留需求访谈与用户需求分析；移除一般商业策略、项目可行性和没有明确研究活动的故障反馈处理。

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Confer with clients to discuss and determine layout design. | 0.0 | 0.0 | 0.0 |
| Analyze user needs to determine technical requirements. | 0.0 | 0.0 | 0.0 |

**product-manager** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Consult with users, management, vendors, and technicians to assess computing needs and system requirements. | 0.7066 | 0.1555 | 0.5511 |

## prototyping　✅ reviewed

Pattern: `\A(?:Prepare\ illustrations\ or\ rough\ sketches\ of\ material,\ discussing\ them\ with\ clients\ or\ supervisors\ and\ making\ necessary\ changes\.|Create\ web\ models\ or\ prototypes\ that\ include\ physical,\ interface,\ logical,\ or\ data\ models\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 仅保留网页原型和概念草图；移除发电设施布局、工程施工草图及成品平面设计。按数字产品概念原型理解。

**ui-ux-designer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare illustrations or rough sketches of material, discussing them with clients or supervisors and making necessary changes. | 0.0 | 0.0 | 0.0 |
| Create web models or prototypes that include physical, interface, logical, or data models. | 0.0 | 0.0 | 0.0 |

## figma　✅ reviewed

Pattern: `\bfigma\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般数字设计或排版任务不能证明使用 Figma。

## visual-design　✅ reviewed

Pattern: `\A(?:Create\ designs,\ concepts,\ and\ sample\ layouts,\ based\ on\ knowledge\ of\ layout\ principles\ and\ esthetic\ design\ concepts\.|Determine\ size\ and\ arrangement\ of\ illustrative\ material\ and\ copy,\ and\ select\ style\ and\ size\ of\ type\.|Develop\ graphics\ and\ layouts\ for\ product\ illustrations,\ company\ logos,\ and\ Web\ sites\.|Prepare\ illustrations\ or\ rough\ sketches\ of\ material,\ discussing\ them\ with\ clients\ or\ supervisors\ and\ making\ necessary\ changes\.|Draw\ and\ print\ charts,\ graphs,\ illustrations,\ and\ other\ artwork,\ using\ computer\.|Study\ illustrations\ and\ photographs\ to\ plan\ presentation\ of\ materials,\ products,\ or\ services\.|Produce\ still\ and\ animated\ graphics\ for\ on\-air\ and\ taped\ portions\ of\ television\ news\ broadcasts,\ using\ electronic\ video\ equipment\.)\Z` → automation **0.1005**, augmentation **0.1399**

Reviewer note: [AI 语义审查 2026-10-31] 保留视觉构图、字体、图形与版式任务；移除研究报告和客户人口特征分析。品牌设计、动态图形是视觉设计的宽类代理。

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

## usability-testing　✅ reviewed

Pattern: `(?!)` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般测试发现问题或客户反馈不能确认执行了可用性测试；当前候选不通过。

## ml-math　✅ reviewed

Pattern: `\A(?:Conduct\ logical\ analyses\ of\ business,\ scientific,\ engineering,\ and\ other\ technical\ problems,\ formulating\ mathematical\ models\ of\ problems\ for\ solution\ by\ computers\.|Analyze\ and\ interpret\ statistical\ data\ to\ identify\ significant\ differences\ in\ relationships\ among\ sources\ of\ information\.|Adapt\ statistical\ methods\ to\ solve\ specific\ problems\ in\ many\ fields,\ such\ as\ economics,\ biology,\ and\ engineering\.|Process\ large\ amounts\ of\ data\ for\ statistical\ modeling\ and\ graphic\ analysis,\ using\ computers\.|Evaluate\ the\ statistical\ methods\ and\ procedures\ used\ to\ obtain\ data\ to\ ensure\ validity,\ applicability,\ efficiency,\ and\ accuracy\.|Examine\ theories,\ such\ as\ those\ of\ probability\ and\ inference,\ to\ discover\ mathematical\ bases\ for\ new\ or\ improved\ methods\ of\ obtaining\ and\ evaluating\ numerical\ data\.)\Z` → automation **0.1119**, augmentation **0.1916**

Reviewer note: [AI 语义审查 2026-10-31] 保留数学建模、概率、统计分析与方法评估作为数学基础代理；移除仅写作或呈现结果的任务，不称为 ML 专属暴露度。

**ml-engineer** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Conduct logical analyses of business, scientific, engineering, and other technical problems, formulating mathematical models of problems for solution by computers. | 0.8987 | 0.2602 | 0.6385 |
| Analyze and interpret statistical data to identify significant differences in relationships among sources of information. | 0.0 | 0.0 | 0.0 |
| Adapt statistical methods to solve specific problems in many fields, such as economics, biology, and engineering. | 0.0 | 0.0 | 0.0 |
| Process large amounts of data for statistical modeling and graphic analysis, using computers. | 0.9223 | 0.411 | 0.5113 |
| Evaluate the statistical methods and procedures used to obtain data to ensure validity, applicability, efficiency, and accuracy. | 0.0 | 0.0 | 0.0 |
| Examine theories, such as those of probability and inference, to discover mathematical bases for new or improved methods of obtaining and evaluating numerical data. | 0.0 | 0.0 | 0.0 |

## ml-frameworks　✅ reviewed

Pattern: `\btensorflow\b|\bpytorch\b|\bscikit[ -]learn\b|\bkeras\b|\bmachine learning frameworks?\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 数学模型和统计建模不证明使用机器学习框架。

## mlops　✅ reviewed

Pattern: `\bmlops\b|(?:machine learning|\bml\b).{0,80}(?:deploy|monitor|production|lifecycle)|(?:deploy|monitor|production|lifecycle).{0,80}(?:machine learning|\bml\b)` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般程序测试、维护和监控不是机器学习模型运维的直接证据。

## roadmapping　✅ reviewed

Pattern: `\broad\s?maps?\b|\bproduct\s+(?:strategy|priorities|planning)\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] IT 部门日常运营和组织政策不等于产品路线图。

## agile　✅ reviewed

Pattern: `\bagile\b|\bscrum\b|\bkanban\b|\bsprints?\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般团队协调、排期和项目计划不等于敏捷方法。

## market-analysis　✅ reviewed

Pattern: `\A(?:Seek\ and\ provide\ information\ to\ help\ companies\ determine\ their\ position\ in\ the\ marketplace\.|Gather\ data\ on\ competitors\ and\ analyze\ their\ prices,\ sales,\ and\ method\ of\ marketing\ and\ distribution\.|Collect\ and\ analyze\ data\ on\ customer\ demographics,\ preferences,\ needs,\ and\ buying\ habits\ to\ identify\ potential\ markets\ and\ factors\ affecting\ product\ demand\.|Monitor\ industry\ statistics\ and\ follow\ trends\ in\ trade\ literature\.|Forecast\ and\ track\ marketing\ and\ sales\ trends,\ analyzing\ collected\ data\.|Conduct\ research\ on\ consumer\ opinions\ and\ marketing\ strategies,\ collaborating\ with\ marketing\ professionals,\ statisticians,\ pollsters,\ and\ other\ professionals\.|Conduct\ economic\ or\ commercial\ surveys\ to\ identify\ potential\ markets\ for\ products\ or\ services\.|Monitor\ market\ conditions,\ product\ innovations,\ and\ competitors'\ products,\ prices,\ and\ sales\.)\Z` → automation **0.2856**, augmentation **0.5776**

Reviewer note: [AI 语义审查 2026-10-31] 保留市场、竞争者、消费者和趋势研究；移除一般客户沟通、销售、人员管理、合同谈判和纯技术跟踪。

**digital-marketer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Seek and provide information to help companies determine their position in the marketplace. | 0.9792 | 0.3394 | 0.6398 |
| Gather data on competitors and analyze their prices, sales, and method of marketing and distribution. | 0.9399 | 0.3807 | 0.5592 |
| Collect and analyze data on customer demographics, preferences, needs, and buying habits to identify potential markets and factors affecting product demand. | 0.9548 | 0.4274 | 0.5274 |
| Monitor industry statistics and follow trends in trade literature. | 0.0 | 0.0 | 0.0 |
| Forecast and track marketing and sales trends, analyzing collected data. | 0.9181 | 0.5374 | 0.3807 |
| Conduct research on consumer opinions and marketing strategies, collaborating with marketing professionals, statisticians, pollsters, and other professionals. | 0.9697 | 0.3794 | 0.5903 |

**sales-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Monitor market conditions, product innovations, and competitors' products, prices, and sales. | 0.933 | 0.2273 | 0.7057 |

## accounting　✅ reviewed

Pattern: `\A(?:Inspect\ account\ books\ and\ accounting\ systems\ for\ efficiency,\ effectiveness,\ and\ use\ of\ accepted\ accounting\ procedures\ to\ record\ transactions\.|Examine\ inventory\ to\ verify\ journal\ and\ ledger\ entries\.|Prepare,\ examine,\ or\ analyze\ accounting\ records,\ financial\ statements,\ or\ other\ financial\ reports\ to\ assess\ accuracy,\ completeness,\ and\ conformance\ to\ reporting\ and\ procedural\ standards\.|Establish\ tables\ of\ accounts\ and\ assign\ entries\ to\ proper\ accounts\.|Develop,\ implement,\ modify,\ and\ document\ recordkeeping\ and\ accounting\ systems,\ making\ use\ of\ current\ computer\ technology\.|Analyze\ business\ operations,\ trends,\ costs,\ revenues,\ financial\ commitments,\ and\ obligations\ to\ project\ future\ revenues\ and\ expenses\ or\ to\ provide\ advice\.)\Z` → automation **0.3087**, augmentation **0.4408**

Reviewer note: [AI 语义审查 2026-10-31] 保留会计记录、报表、账簿与会计系统任务；与审计有真实重叠，不以强制互斥方式删除。

**auditor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Inspect account books and accounting systems for efficiency, effectiveness, and use of accepted accounting procedures to record transactions. | 0.0 | 0.0 | 0.0 |
| Examine inventory to verify journal and ledger entries. | 0.0 | 0.0 | 0.0 |
| Prepare, examine, or analyze accounting records, financial statements, or other financial reports to assess accuracy, completeness, and conformance to reporting and procedural standards. ※ | 0.8929 | 0.4079 | 0.485 |
| Establish tables of accounts and assign entries to proper accounts. ※ | 0.9373 | 0.4281 | 0.5092 |
| Develop, implement, modify, and document recordkeeping and accounting systems, making use of current computer technology. | 0.9107 | 0.4101 | 0.5006 |
| Analyze business operations, trends, costs, revenues, financial commitments, and obligations to project future revenues and expenses or to provide advice. | 0.8571 | 0.2988 | 0.5583 |

**accountant**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare, examine, or analyze accounting records, financial statements, or other financial reports to assess accuracy, completeness, and conformance to reporting and procedural standards. ※ | 0.8929 | 0.3567 | 0.5362 |
| Establish tables of accounts and assign entries to proper accounts. ※ | 0.9373 | 0.3744 | 0.5629 |
| Develop, implement, modify, and document recordkeeping and accounting systems, making use of current computer technology. | 0.9107 | 0.4101 | 0.5006 |
| Analyze business operations, trends, costs, revenues, financial commitments, and obligations to project future revenues and expenses or to provide advice. | 0.8571 | 0.2988 | 0.5583 |

## auditing　✅ reviewed

Pattern: `\A(?:Prepare\ detailed\ reports\ on\ audit\ findings\.|Supervise\ auditing\ of\ establishments,\ and\ determine\ scope\ of\ investigation\ required\.|Report\ to\ management\ about\ asset\ utilization\ and\ audit\ results,\ and\ recommend\ changes\ in\ operations\ and\ financial\ activities\.|Inspect\ account\ books\ and\ accounting\ systems\ for\ efficiency,\ effectiveness,\ and\ use\ of\ accepted\ accounting\ procedures\ to\ record\ transactions\.|Examine\ records\ and\ interview\ workers\ to\ ensure\ recording\ of\ transactions\ and\ compliance\ with\ laws\ and\ regulations\.|Examine\ and\ evaluate\ financial\ and\ information\ systems,\ recommending\ controls\ to\ ensure\ system\ reliability\ and\ data\ integrity\.|Examine\ whether\ the\ organization's\ objectives\ are\ reflected\ in\ its\ management\ activities,\ and\ whether\ employees\ understand\ the\ objectives\.|Inspect\ cash\ on\ hand,\ notes\ receivable\ and\ payable,\ negotiable\ securities,\ and\ canceled\ checks\ to\ confirm\ records\ are\ accurate\.|Examine\ inventory\ to\ verify\ journal\ and\ ledger\ entries\.|Conduct\ pre\-implementation\ audits\ to\ determine\ if\ systems\ and\ programs\ under\ development\ will\ work\ as\ planned\.|Audit\ payroll\ and\ personnel\ records\ to\ determine\ unemployment\ insurance\ premiums,\ workers'\ compensation\ coverage,\ liabilities,\ and\ compliance\ with\ tax\ laws\.|Review\ taxpayer\ accounts,\ and\ conduct\ audits\ on\-site,\ by\ correspondence,\ or\ by\ summoning\ taxpayer\ to\ office\.|Prepare,\ examine,\ or\ analyze\ accounting\ records,\ financial\ statements,\ or\ other\ financial\ reports\ to\ assess\ accuracy,\ completeness,\ and\ conformance\ to\ reporting\ and\ procedural\ standards\.)\Z` → automation **0.228**, augmentation **0.3196**

Reviewer note: [AI 语义审查 2026-10-31] 保留审计、记录核查、系统检查与审计报告任务；会计与审计可能真实重叠。

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

**accountant**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare, examine, or analyze accounting records, financial statements, or other financial reports to assess accuracy, completeness, and conformance to reporting and procedural standards. ※ | 0.8929 | 0.3567 | 0.5362 |

## internal-control　✅ reviewed

Pattern: `\A(?:Collect\ and\ analyze\ data\ to\ detect\ deficient\ controls,\ duplicated\ effort,\ extravagance,\ fraud,\ or\ non\-compliance\ with\ laws,\ regulations,\ and\ management\ policies\.|Examine\ records\ and\ interview\ workers\ to\ ensure\ recording\ of\ transactions\ and\ compliance\ with\ laws\ and\ regulations\.|Examine\ and\ evaluate\ financial\ and\ information\ systems,\ recommending\ controls\ to\ ensure\ system\ reliability\ and\ data\ integrity\.)\Z` → automation **0.2838**, augmentation **0.3375**

Reviewer note: [AI 语义审查 2026-10-31] 保留控制缺陷、舞弊、合规和系统控制评估；移除不明确针对内控的薪资审计任务。

**auditor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Collect and analyze data to detect deficient controls, duplicated effort, extravagance, fraud, or non-compliance with laws, regulations, and management policies. ※ | 0.9099 | 0.4156 | 0.4943 |
| Examine records and interview workers to ensure recording of transactions and compliance with laws and regulations. ※ | 0.954 | 0.4358 | 0.5182 |
| Examine and evaluate financial and information systems, recommending controls to ensure system reliability and data integrity. | 0.0 | 0.0 | 0.0 |

## legal-research　✅ reviewed

Pattern: `\A(?:Study\ Constitution,\ statutes,\ decisions,\ regulations,\ and\ ordinances\ of\ quasi\-judicial\ bodies\ to\ determine\ ramifications\ for\ cases\.|Interpret\ laws,\ rulings\ and\ regulations\ for\ individuals\ and\ businesses\.|Analyze\ the\ probable\ outcomes\ of\ cases,\ using\ knowledge\ of\ legal\ precedents\.)\Z` → automation **0.0247**, augmentation **0.2261**

Reviewer note: [AI 语义审查 2026-10-31] 保留法规、判例研究与法律解释；移除同时包含立法及政策执行的宽泛任务。

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Study Constitution, statutes, decisions, regulations, and ordinances of quasi-judicial bodies to determine ramifications for cases. | 0.0 | 0.0 | 0.0 |
| Interpret laws, rulings and regulations for individuals and businesses. | 0.7523 | 0.0741 | 0.6782 |
| Analyze the probable outcomes of cases, using knowledge of legal precedents. | 0.0 | 0.0 | 0.0 |

## legal-writing　✅ reviewed

Pattern: `\A(?:Prepare\ legal\ briefs\ and\ opinions,\ and\ file\ appeals\ in\ state\ and\ federal\ courts\ of\ appeal\.|Search\ for\ and\ examine\ public\ and\ other\ legal\ records\ to\ write\ opinions\ or\ establish\ ownership\.|Help\ develop\ federal\ and\ state\ programs,\ draft\ and\ interpret\ laws\ and\ legislation,\ and\ establish\ enforcement\ procedures\.)\Z` → automation **0.1458**, augmentation **0.1035**

Reviewer note: [AI 语义审查 2026-10-31] 法律意见、诉状和法律草案写作均相关；保留复合任务并提示写作只是其中一部分。

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare legal briefs and opinions, and file appeals in state and federal courts of appeal. | 0.7477 | 0.4373 | 0.3104 |
| Search for and examine public and other legal records to write opinions or establish ownership. | 0.0 | 0.0 | 0.0 |
| Help develop federal and state programs, draft and interpret laws and legislation, and establish enforcement procedures. | 0.0 | 0.0 | 0.0 |

## negotiation　✅ reviewed

Pattern: `\A(?:Negotiate\ settlements\ of\ civil\ disputes\.|Establish\ and\ maintain\ tendering\ process,\ and\ conduct\ negotiations\.|Negotiate\ details\ of\ contracts\ and\ payments\.|Negotiate\ with\ retail\ merchants\ to\ improve\ product\ exposure,\ such\ as\ shelf\ positioning\ and\ advertising\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留直接的民事和解谈判任务；仅代表已覆盖的职业情境。

**lawyer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Negotiate settlements of civil disputes. | 0.0 | 0.0 | 0.0 |

**quantity-surveyor** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Establish and maintain tendering process, and conduct negotiations. | 0.0 | 0.0 | 0.0 |

**sales-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Negotiate details of contracts and payments. | 0.0 | 0.0 | 0.0 |
| Negotiate with retail merchants to improve product exposure, such as shelf positioning and advertising. | 0.0 | 0.0 | 0.0 |

## lesson-planning　✅ reviewed

Pattern: `\A(?:Adapt\ teaching\ methods\ and\ instructional\ materials\ to\ meet\ students'\ varying\ needs\ and\ interests\.|Prepare\ materials\ and\ classrooms\ for\ class\ activities\.|Plan\ and\ conduct\ activities\ for\ a\ balanced\ program\ of\ instruction,\ demonstration,\ and\ work\ time\ that\ provides\ students\ with\ opportunities\ to\ observe,\ question,\ and\ investigate\.|Establish\ clear\ objectives\ for\ all\ lessons,\ units,\ and\ projects\ and\ communicate\ those\ objectives\ to\ students\.|Prepare\ objectives\ and\ outlines\ for\ courses\ of\ study,\ following\ curriculum\ guidelines\ or\ requirements\ of\ states\ and\ schools\.|Confer\ with\ other\ staff\ members\ to\ plan\ and\ schedule\ lessons\ promoting\ learning,\ following\ approved\ curricula\.|Plan\ and\ supervise\ class\ projects,\ field\ trips,\ visits\ by\ guest\ speakers,\ or\ other\ experiential\ activities,\ and\ guide\ students\ in\ learning\ from\ those\ activities\.)\Z` → automation **0.1683**, augmentation **0.195**

Reviewer note: [AI 语义审查 2026-10-31] 教学目标、课程活动、教材调整与课程安排均属于教学规划。

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

Pattern: `\A(?:Establish\ and\ enforce\ rules\ for\ behavior\ and\ procedures\ for\ maintaining\ order\ among\ students\.|Enforce\ all\ administration\ policies\ and\ rules\ governing\ students\.|Confer\ with\ parents\ or\ guardians,\ other\ teachers,\ counselors,\ and\ administrators\ to\ resolve\ students'\ behavioral\ and\ academic\ problems\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留课堂秩序、行为规则和学生行为问题处理。

**teacher**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Establish and enforce rules for behavior and procedures for maintaining order among students. | 0.0 | 0.0 | 0.0 |
| Enforce all administration policies and rules governing students. | 0.0 | 0.0 | 0.0 |
| Confer with parents or guardians, other teachers, counselors, and administrators to resolve students' behavioral and academic problems. | 0.0 | 0.0 | 0.0 |

## assessment　✅ reviewed

Pattern: `\A(?:Assign\ and\ grade\ class\ work\ and\ homework\.|Observe\ and\ evaluate\ students'\ performance,\ behavior,\ social\ development,\ and\ physical\ health\.|Prepare,\ administer,\ and\ grade\ tests\ and\ assignments\ to\ evaluate\ students'\ progress\.)\Z` → automation **0.4664**, augmentation **0.1626**

Reviewer note: [AI 语义审查 2026-10-31] 保留作业评分、学生表现评估与考试评量。

**teacher**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Assign and grade class work and homework. | 0.0 | 0.0 | 0.0 |
| Observe and evaluate students' performance, behavior, social development, and physical health. | 0.9429 | 0.8015 | 0.1414 |
| Prepare, administer, and grade tests and assignments to evaluate students' progress. | 0.9441 | 0.5978 | 0.3463 |

## clinical-knowledge　✅ reviewed

Pattern: `\A(?:Prescribe\ or\ administer\ medication,\ therapy,\ and\ other\ specialized\ medical\ care\ to\ treat\ or\ prevent\ illness,\ disease,\ or\ injury\.|Analyze\ records,\ reports,\ test\ results,\ or\ examination\ information\ to\ diagnose\ medical\ condition\ of\ patient\.|Provide\ and\ manage\ long\-term,\ comprehensive\ medical\ care,\ including\ diagnosis\ and\ nonsurgical\ treatment\ of\ diseases,\ for\ adult\ patients\ in\ an\ office\ or\ hospital\.|Make\ diagnoses\ when\ different\ illnesses\ occur\ together\ or\ in\ situations\ where\ the\ diagnosis\ may\ be\ obscure\.|Monitor\ patients'\ conditions\ and\ progress\ and\ reevaluate\ treatments\ as\ necessary\.|Immunize\ patients\ to\ protect\ them\ from\ preventable\ diseases\.|Operate\ on\ patients\ to\ remove,\ repair,\ or\ improve\ functioning\ of\ diseased\ or\ injured\ body\ parts\ and\ systems\.|Prescribe\ or\ administer\ treatment,\ therapy,\ medication,\ vaccination,\ and\ other\ specialized\ medical\ care\ to\ treat\ or\ prevent\ illness,\ disease,\ or\ injury\.|Order,\ perform,\ and\ interpret\ tests\ and\ analyze\ records,\ reports,\ and\ examination\ information\ to\ diagnose\ patients'\ condition\.)\Z` → automation **0.0509**, augmentation **0.0862**

Reviewer note: [AI 语义审查 2026-10-31] 保留诊断、治疗、处方与监测等临床任务；具体任务仍须受职业范围限制。

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

## patient-care　✅ reviewed

Pattern: `\A(?:Explain\ procedures\ and\ discuss\ test\ results\ or\ prescribed\ treatments\ with\ patients\.|Provide\ and\ manage\ long\-term,\ comprehensive\ medical\ care,\ including\ diagnosis\ and\ nonsurgical\ treatment\ of\ diseases,\ for\ adult\ patients\ in\ an\ office\ or\ hospital\.|Monitor\ patients'\ conditions\ and\ progress\ and\ reevaluate\ treatments\ as\ necessary\.|Advise\ patients\ and\ community\ members\ concerning\ diet,\ activity,\ hygiene,\ and\ disease\ prevention\.|Immunize\ patients\ to\ protect\ them\ from\ preventable\ diseases\.|Refer\ patient\ to\ medical\ specialist\ or\ other\ practitioner\ when\ necessary\.|Refer\ patients\ to\ medical\ specialists\ or\ other\ practitioners\ when\ necessary\.)\Z` → automation **0.0304**, augmentation **0.1116**

Reviewer note: [AI 语义审查 2026-10-31] 保留直接病患沟通、照护、监测、预防与转诊；不把所有含 patient 的诊断、手术和医生间建议都视为照护。

**doctor**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Explain procedures and discuss test results or prescribed treatments with patients. | 0.8522 | 0.1826 | 0.6696 |
| Provide and manage long-term, comprehensive medical care, including diagnosis and nonsurgical treatment of diseases, for adult patients in an office or hospital. | 0.0 | 0.0 | 0.0 |
| Monitor patients' conditions and progress and reevaluate treatments as necessary. | 0.0 | 0.0 | 0.0 |
| Advise patients and community members concerning diet, activity, hygiene, and disease prevention. | 0.0 | 0.0 | 0.0 |
| Immunize patients to protect them from preventable diseases. | 0.0 | 0.0 | 0.0 |
| Refer patient to medical specialist or other practitioner when necessary. | 0.0 | 0.0 | 0.0 |

## medical-ethics　✅ reviewed

Pattern: `\bethic\w*\b|\binformed consent\b|\bconfidential\w*\b|\bprivacy\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 不以一般病患解释或诊疗任务替代医学伦理。

## cooking-technique　✅ reviewed

Pattern: `\A(?:Instruct\ cooks\ or\ other\ workers\ in\ the\ preparation,\ cooking,\ garnishing,\ or\ presentation\ of\ food\.|Prepare\ and\ cook\ foods\ of\ all\ types,\ either\ on\ a\ regular\ basis\ or\ for\ special\ guests\ or\ functions\.|Demonstrate\ new\ cooking\ techniques\ or\ equipment\ to\ staff\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 实际烹饪、示范与指导烹饪技巧均相关。

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Instruct cooks or other workers in the preparation, cooking, garnishing, or presentation of food. | 0.0 | 0.0 | 0.0 |
| Prepare and cook foods of all types, either on a regular basis or for special guests or functions. | 0.0 | 0.0 | 0.0 |
| Demonstrate new cooking techniques or equipment to staff. | 0.0 | 0.0 | 0.0 |

## food-safety　✅ reviewed

Pattern: `\A(?:Monitor\ sanitation\ practices\ to\ ensure\ that\ employees\ follow\ standards\ and\ regulations\.|Inspect\ supplies,\ equipment,\ or\ work\ areas\ to\ ensure\ conformance\ to\ established\ standards\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留卫生监控与供应品、设备、工作区检查。

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Monitor sanitation practices to ensure that employees follow standards and regulations. | 0.0 | 0.0 | 0.0 |
| Inspect supplies, equipment, or work areas to ensure conformance to established standards. | 0.0 | 0.0 | 0.0 |

## menu-planning　✅ reviewed

Pattern: `\A(?:Analyze\ recipes\ to\ assign\ prices\ to\ menu\ items,\ based\ on\ food,\ labor,\ and\ overhead\ costs\.|Collaborate\ with\ other\ personnel\ to\ plan\ and\ develop\ recipes\ or\ menus,\ taking\ into\ account\ such\ factors\ as\ seasonal\ availability\ of\ ingredients\ or\ the\ likely\ number\ of\ customers\.|Meet\ with\ customers\ to\ discuss\ menus\ for\ special\ occasions,\ such\ as\ weddings,\ parties,\ or\ banquets\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留菜单定价、食谱开发与菜单需求讨论。

**chef**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze recipes to assign prices to menu items, based on food, labor, and overhead costs. | 0.0 | 0.0 | 0.0 |
| Collaborate with other personnel to plan and develop recipes or menus, taking into account such factors as seasonal availability of ingredients or the likely number of customers. | 0.0 | 0.0 | 0.0 |
| Meet with customers to discuss menus for special occasions, such as weddings, parties, or banquets. | 0.0 | 0.0 | 0.0 |

## engineering-math　✅ reviewed

Pattern: `\A(?:Compute\ load\ and\ grade\ requirements,\ water\ flow\ rates,\ or\ material\ stress\ factors\ to\ determine\ design\ specifications\.|Estimate\ quantities\ and\ cost\ of\ materials,\ equipment,\ or\ labor\ to\ determine\ project\ feasibility\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留明确工程计算与数量成本估算；移除只写 analyze 的一般调查和工艺研究。

**civil-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Compute load and grade requirements, water flow rates, or material stress factors to determine design specifications. | 0.0 | 0.0 | 0.0 |
| Estimate quantities and cost of materials, equipment, or labor to determine project feasibility. | 0.0 | 0.0 | 0.0 |

## cad　✅ reviewed

Pattern: `\A(?:Operate\ computer\-assisted\ engineering\ or\ design\ software\ or\ equipment\ to\ perform\ engineering\ tasks\.|Operate\ computer\-assisted\ engineering\ or\ design\ software\ or\ equipment\ to\ perform\ electronics\ engineering\ tasks\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留明确的计算机辅助工程或设计工具操作，属于 CAE/CAD 宽类代理；读蓝图或制作图纸不能单独证明使用 CAD 软件。

**electrical-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Operate computer-assisted engineering or design software or equipment to perform engineering tasks. | 0.0 | 0.0 | 0.0 |

## project-management　✅ reviewed

Pattern: `\A(?:Inspect\ project\ sites\ to\ monitor\ progress\ and\ ensure\ conformance\ to\ design\ specifications\ and\ safety\ or\ sanitation\ standards\.|Manage\ and\ direct\ the\ construction,\ operations,\ or\ maintenance\ activities\ at\ project\ site\.|Estimate\ quantities\ and\ cost\ of\ materials,\ equipment,\ or\ labor\ to\ determine\ project\ feasibility\.|Identify\ environmental\ risks\ and\ develop\ risk\ management\ strategies\ for\ civil\ engineering\ projects\.|Prepare\ estimates\ used\ by\ management\ for\ purposes\ such\ as\ planning,\ organizing,\ and\ scheduling\ work\.|Prepare\ cost\ and\ expenditure\ statements\ and\ other\ necessary\ documentation\ at\ regular\ intervals\ for\ the\ duration\ of\ the\ project\.|Assess\ cost\ effectiveness\ of\ products,\ projects\ or\ services,\ tracking\ actual\ costs\ relative\ to\ bids\ as\ the\ project\ develops\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留项目现场管理、进度、预算和成本控制；移除餐饮日常运营及排班作为项目管理的替代。

**civil-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Inspect project sites to monitor progress and ensure conformance to design specifications and safety or sanitation standards. | 0.0 | 0.0 | 0.0 |
| Manage and direct the construction, operations, or maintenance activities at project site. | 0.0 | 0.0 | 0.0 |
| Estimate quantities and cost of materials, equipment, or labor to determine project feasibility. | 0.0 | 0.0 | 0.0 |
| Identify environmental risks and develop risk management strategies for civil engineering projects. | 0.0 | 0.0 | 0.0 |

**quantity-surveyor** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare estimates used by management for purposes such as planning, organizing, and scheduling work. | 0.0 | 0.0 | 0.0 |
| Prepare cost and expenditure statements and other necessary documentation at regular intervals for the duration of the project. | 0.0 | 0.0 | 0.0 |
| Assess cost effectiveness of products, projects or services, tracking actual costs relative to bids as the project develops. | 0.0 | 0.0 | 0.0 |

## accounting-software　✅ reviewed

Pattern: `\A(?:Develop,\ implement,\ modify,\ and\ document\ recordkeeping\ and\ accounting\ systems,\ making\ use\ of\ current\ computer\ technology\.)\Z` → automation **0.4101**, augmentation **0.5006**

Reviewer note: [AI 语义审查 2026-10-31] 保留明确使用计算机技术处理会计系统的任务作为软件系统代理；移除仅向客户提供系统设计建议。

**accountant**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Develop, implement, modify, and document recordkeeping and accounting systems, making use of current computer technology. | 0.9107 | 0.4101 | 0.5006 |

## accounts-payable-receivable　✅ reviewed

Pattern: `\A(?:Resolve\ customers'\ service\ or\ billing\ complaints\ by\ performing\ activities\ such\ as\ exchanging\ merchandise,\ refunding\ money,\ or\ adjusting\ bills\.|Determine\ charges\ for\ services\ requested,\ collect\ deposits\ or\ payments,\ or\ arrange\ for\ billing\.|Compare\ disputed\ merchandise\ with\ original\ requisitions\ and\ information\ from\ invoices\ and\ prepare\ invoices\ for\ returned\ goods\.)\Z` → automation **0.1286**, augmentation **0.2005**

Reviewer note: [AI 语义审查 2026-10-31] 保留账单、收款、押金和发票相关任务，属于 billing/collections 局部代理；移除报税、一般财务记录、科目表与流程建议，不能代表完整 AP/AR 职能。

**customer-service**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Resolve customers' service or billing complaints by performing activities such as exchanging merchandise, refunding money, or adjusting bills. | 0.9872 | 0.3858 | 0.6014 |
| Determine charges for services requested, collect deposits or payments, or arrange for billing. | 0.0 | 0.0 | 0.0 |
| Compare disputed merchandise with original requisitions and information from invoices and prepare invoices for returned goods. | 0.0 | 0.0 | 0.0 |

## taxation　✅ reviewed

Pattern: `\A(?:Compute\ taxes\ owed\ and\ prepare\ tax\ returns,\ ensuring\ compliance\ with\ payment,\ reporting,\ or\ other\ tax\ requirements\.|Advise\ clients\ in\ areas\ such\ as\ compensation,\ employee\ health\ care\ benefits,\ the\ design\ of\ accounting\ or\ data\ processing\ systems,\ or\ long\-range\ tax\ or\ estate\ plans\.|Represent\ clients\ before\ taxing\ authorities\ and\ provide\ support\ during\ litigation\ involving\ financial\ issues\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留报税、税务规划及税务机关代理；复合咨询任务只构成局部税务证据。

**accountant**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Compute taxes owed and prepare tax returns, ensuring compliance with payment, reporting, or other tax requirements. | 0.0 | 0.0 | 0.0 |
| Advise clients in areas such as compensation, employee health care benefits, the design of accounting or data processing systems, or long-range tax or estate plans. | 0.0 | 0.0 | 0.0 |
| Represent clients before taxing authorities and provide support during litigation involving financial issues. | 0.0 | 0.0 | 0.0 |

## electrical-systems　✅ reviewed

Pattern: `\A(?:Prepare\ technical\ drawings,\ specifications\ of\ electrical\ systems,\ or\ topographical\ maps\ to\ ensure\ that\ installation\ and\ operations\ conform\ to\ standards\ and\ customer\ requirements\.|Design,\ implement,\ maintain,\ or\ improve\ electrical\ instruments,\ equipment,\ facilities,\ components,\ products,\ or\ systems\ for\ commercial,\ industrial,\ or\ domestic\ purposes\.|Conduct\ field\ surveys\ or\ study\ maps,\ graphs,\ diagrams,\ or\ other\ data\ to\ identify\ and\ correct\ power\ system\ problems\.|Design\ electrical\ systems\ or\ components\ that\ minimize\ electric\ energy\ requirements,\ such\ as\ lighting\ systems\ designed\ to\ account\ for\ natural\ lighting\.|Plan\ layout\ of\ electric\ power\ generating\ plants\ or\ distribution\ lines\ or\ stations\.|Collect\ data\ relating\ to\ commercial\ or\ residential\ development,\ population,\ or\ power\ system\ interconnection\ to\ determine\ operating\ efficiency\ of\ electrical\ systems\.|Integrate\ electrical\ systems\ with\ renewable\ energy\ systems\ to\ improve\ overall\ efficiency\.|Analyze\ electronics\ system\ requirements,\ capacity,\ cost,\ or\ customer\ needs\ to\ determine\ project\ feasibility\.|Recommend\ repair\ or\ design\ modifications\ of\ electronics\ components\ or\ systems,\ based\ on\ factors\ such\ as\ environment,\ service,\ cost,\ or\ system\ capabilities\.|Design\ electronic\ components,\ software,\ products,\ or\ systems\ for\ commercial,\ industrial,\ medical,\ military,\ or\ scientific\ applications\.|Inspect\ electronic\ equipment,\ instruments,\ products,\ or\ systems\ to\ ensure\ conformance\ to\ specifications,\ safety\ standards,\ or\ applicable\ codes\ or\ regulations\.)\Z` → automation **0.0679**, augmentation **0.1974**

Reviewer note: [AI 语义审查 2026-10-31] 保留电气与电子系统设计、分析、检查；职业层另行去除电子工程师，避免与电气工程师 SOC 错位。

**electrical-engineer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Prepare technical drawings, specifications of electrical systems, or topographical maps to ensure that installation and operations conform to standards and customer requirements. | 0.0 | 0.0 | 0.0 |
| Design, implement, maintain, or improve electrical instruments, equipment, facilities, components, products, or systems for commercial, industrial, or domestic purposes. | 0.0 | 0.0 | 0.0 |
| Conduct field surveys or study maps, graphs, diagrams, or other data to identify and correct power system problems. | 0.8568 | 0.1734 | 0.6834 |
| Design electrical systems or components that minimize electric energy requirements, such as lighting systems designed to account for natural lighting. | 0.0 | 0.0 | 0.0 |
| Plan layout of electric power generating plants or distribution lines or stations. | 0.0 | 0.0 | 0.0 |
| Collect data relating to commercial or residential development, population, or power system interconnection to determine operating efficiency of electrical systems. | 1.0 | 0.3019 | 0.6981 |
| Integrate electrical systems with renewable energy systems to improve overall efficiency. | 0.0 | 0.0 | 0.0 |

## equipment-maintenance　✅ reviewed

Pattern: `\A(?:Recommend\ repair\ or\ design\ modifications\ of\ electronics\ components\ or\ systems,\ based\ on\ factors\ such\ as\ environment,\ service,\ cost,\ or\ system\ capabilities\.|Develop\ or\ perform\ operational,\ maintenance,\ or\ testing\ procedures\ for\ electronic\ products,\ components,\ equipment,\ or\ systems\.)\Z` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 保留维修建议和维护程序；移除维修预算、一般生产协调及维护文档整理。电气职业去除电子工程后可能无匹配，这表示无来源。

## plc-automation　✅ reviewed

Pattern: `\bplcs?\b|programmable logic controllers?` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 普通自动化、仪表或控制系统不足以确认 PLC 能力。

## social-media-marketing　✅ reviewed

Pattern: `\bsocial media\b|\bsocial networking\b|\bonline communit\w*\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 没有社交媒体相关任务时保留无来源；不以一般营销任务填充。

## digital-advertising　✅ reviewed

Pattern: `\A(?:Measure\ the\ effectiveness\ of\ marketing,\ advertising,\ and\ communications\ programs\ and\ strategies\.|Develop\ and\ implement\ procedures\ for\ identifying\ advertising\ needs\.)\Z` → automation **0.1444**, augmentation **0.3164**

Reviewer note: [AI 语义审查 2026-10-31] 保留广告需求与效果任务作为广告宽类代理；未证明数字渠道，须显示来源局限，不能宣称数字广告专属统计。

**digital-marketer**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Measure the effectiveness of marketing, advertising, and communications programs and strategies. | 0.9216 | 0.2888 | 0.6328 |
| Develop and implement procedures for identifying advertising needs. | 0.0 | 0.0 | 0.0 |

## web-analytics　✅ reviewed

Pattern: `\bweb\s+(?:analytics|metrics)\b|\bwebsite\s+(?:analytics|traffic|metrics)\b|\bpage views?\b|\bclick.through\b|\bconversion rates?\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般市场趋势、客户人口特征或营销效果分析不足以证明网站分析。

## content-writing　✅ reviewed

Pattern: `\b(?:write|writing|draft|drafting|create|creating|produce|producing)\b.{0,60}\b(?:copy|blog|blogs|articles?|social media content|marketing content|advertising content)\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 将研究结果写成报告不等于营销内容写作。

## quantity-surveying　✅ reviewed

Pattern: `\A(?:Analyze\ blueprints\ and\ other\ documentation\ to\ prepare\ time,\ cost,\ materials,\ and\ labor\ estimates\.|Prepare\ cost\ and\ expenditure\ statements\ and\ other\ necessary\ documentation\ at\ regular\ intervals\ for\ the\ duration\ of\ the\ project\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 成本估算与支出记录仅覆盖工料测量的局部职能；职业级映射因不足以代表全职能而停用。

**quantity-surveyor** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze blueprints and other documentation to prepare time, cost, materials, and labor estimates. | 0.0 | 0.0 | 0.0 |
| Prepare cost and expenditure statements and other necessary documentation at regular intervals for the duration of the project. | 0.0 | 0.0 | 0.0 |

## cost-estimation　✅ reviewed

Pattern: `\A(?:Analyze\ blueprints\ and\ other\ documentation\ to\ prepare\ time,\ cost,\ materials,\ and\ labor\ estimates\.|Prepare\ estimates\ for\ use\ in\ selecting\ vendors\ or\ subcontractors\.|Prepare\ estimates\ used\ by\ management\ for\ purposes\ such\ as\ planning,\ organizing,\ and\ scheduling\ work\.|Assess\ cost\ effectiveness\ of\ products,\ projects\ or\ services,\ tracking\ actual\ costs\ relative\ to\ bids\ as\ the\ project\ develops\.|Set\ up\ cost\ monitoring\ and\ reporting\ systems\ and\ procedures\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留工程数量、材料人工成本、分包估算及成本效果评估。

**quantity-surveyor** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Analyze blueprints and other documentation to prepare time, cost, materials, and labor estimates. | 0.0 | 0.0 | 0.0 |
| Prepare estimates for use in selecting vendors or subcontractors. | 0.0 | 0.0 | 0.0 |
| Prepare estimates used by management for purposes such as planning, organizing, and scheduling work. | 0.0 | 0.0 | 0.0 |
| Assess cost effectiveness of products, projects or services, tracking actual costs relative to bids as the project develops. | 0.0 | 0.0 | 0.0 |
| Set up cost monitoring and reporting systems and procedures. | 0.0 | 0.0 | 0.0 |

## contract-administration　✅ reviewed

Pattern: `\A(?:Establish\ and\ maintain\ tendering\ process,\ and\ conduct\ negotiations\.)\Z` → automation **0.0**, augmentation **0.0**

Reviewer note: [AI 语义审查 2026-10-31] 保留招标流程及谈判作为采购合同生命周期的局部代理；移除单纯估算、成本比较和供应商通讯录。

**quantity-surveyor** (career to review: not counted yet)

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Establish and maintain tendering process, and conduct negotiations. | 0.0 | 0.0 | 0.0 |

## employee-relations　✅ reviewed

Pattern: `\A(?:Interpret\ and\ explain\ human\ resources\ policies,\ procedures,\ laws,\ standards,\ or\ regulations\.|Address\ employee\ relations\ issues,\ such\ as\ harassment\ allegations,\ work\ complaints,\ or\ other\ employee\ concerns\.|Confer\ with\ management\ to\ develop\ or\ implement\ personnel\ policies\ or\ procedures\.|Conduct\ exit\ interviews\ and\ ensure\ that\ necessary\ employment\ termination\ paperwork\ is\ completed\.)\Z` → automation **0.0365**, augmentation **0.1601**

Reviewer note: [AI 语义审查 2026-10-31] 保留员工申诉、政策解释、政策制定与离职面谈。

**hr-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Interpret and explain human resources policies, procedures, laws, standards, or regulations. | 0.7865 | 0.1459 | 0.6406 |
| Address employee relations issues, such as harassment allegations, work complaints, or other employee concerns. | 0.0 | 0.0 | 0.0 |
| Confer with management to develop or implement personnel policies or procedures. | 0.0 | 0.0 | 0.0 |
| Conduct exit interviews and ensure that necessary employment termination paperwork is completed. | 0.0 | 0.0 | 0.0 |

## recruitment　✅ reviewed

Pattern: `\A(?:Hire\ employees\ and\ process\ hiring\-related\ paperwork\.|Inform\ job\ applicants\ of\ details\ such\ as\ duties\ and\ responsibilities,\ compensation,\ benefits,\ schedules,\ working\ conditions,\ or\ promotion\ opportunities\.|Select\ qualified\ job\ applicants\ or\ refer\ them\ to\ managers,\ making\ hiring\ recommendations\ when\ appropriate\.|Review\ employment\ applications\ and\ job\ orders\ to\ match\ applicants\ with\ job\ requirements\.|Conduct\ reference\ or\ background\ checks\ on\ job\ applicants\.|Perform\ searches\ for\ qualified\ job\ candidates,\ using\ sources\ such\ as\ computer\ databases,\ networking,\ Internet\ recruiting\ resources,\ media\ advertisements,\ job\ fairs,\ recruiting\ firms,\ or\ employee\ referrals\.|Contact\ job\ applicants\ to\ inform\ them\ of\ the\ status\ of\ their\ applications\.|Interview\ job\ applicants\ to\ obtain\ information\ on\ work\ history,\ training,\ education,\ or\ job\ skills\.|Develop\ or\ implement\ recruiting\ strategies\ to\ meet\ current\ or\ anticipated\ staffing\ needs\.|Advise\ management\ on\ organizing,\ preparing,\ or\ implementing\ recruiting\ or\ retention\ programs\.|Evaluate\ recruitment\ or\ selection\ criteria\ to\ ensure\ conformance\ to\ professional,\ statistical,\ or\ testing\ standards,\ recommending\ revisions,\ as\ needed\.)\Z` → automation **0.293**, augmentation **0.2226**

Reviewer note: [AI 语义审查 2026-10-31] 保留寻才、筛选、面试、录用与候选人沟通；移除入职培训及一般执照资格审查。

**hr-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Hire employees and process hiring-related paperwork. | 0.0 | 0.0 | 0.0 |
| Inform job applicants of details such as duties and responsibilities, compensation, benefits, schedules, working conditions, or promotion opportunities. | 0.0 | 0.0 | 0.0 |
| Select qualified job applicants or refer them to managers, making hiring recommendations when appropriate. ※ | 0.9296 | 0.4758 | 0.4538 |
| Review employment applications and job orders to match applicants with job requirements. | 0.9369 | 0.4776 | 0.4593 |
| Conduct reference or background checks on job applicants. | 0.0 | 0.0 | 0.0 |
| Perform searches for qualified job candidates, using sources such as computer databases, networking, Internet recruiting resources, media advertisements, job fairs, recruiting firms, or employee referrals. | 0.9758 | 0.4337 | 0.5421 |
| Contact job applicants to inform them of the status of their applications. | 0.91 | 0.5328 | 0.3772 |
| Interview job applicants to obtain information on work history, training, education, or job skills. | 0.978 | 0.978 | 0.0 |
| Develop or implement recruiting strategies to meet current or anticipated staffing needs. | 0.0 | 0.0 | 0.0 |
| Advise management on organizing, preparing, or implementing recruiting or retention programs. | 0.0 | 0.0 | 0.0 |
| Evaluate recruitment or selection criteria to ensure conformance to professional, statistical, or testing standards, recommending revisions, as needed. | 0.9414 | 0.3254 | 0.616 |

## payroll　✅ reviewed

Pattern: `\b(?:calculate|compute|process|prepare|administer|manage)\w*\b.{0,50}\b(?:payroll|wages|salaries)\b|\bpayroll\s+(?:processing|calculation|administration)\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 向求职者说明薪酬福利不属于薪资核算或发薪；审计 payroll 也不是执行 payroll。

## sales-prospecting　✅ reviewed

Pattern: `\A(?:Contact\ regular\ and\ prospective\ customers\ to\ demonstrate\ products,\ explain\ product\ features,\ and\ solicit\ orders\.|Identify\ prospective\ customers\ by\ using\ business\ directories,\ following\ leads\ from\ existing\ clients,\ participating\ in\ organizations\ and\ clubs,\ and\ attending\ trade\ shows\ and\ conferences\.)\Z` → automation **0.4909**, augmentation **0.4979**

Reviewer note: [AI 语义审查 2026-10-31] 保留联系潜客和寻找线索；移除销售行政报告与客户信用调查。

**sales-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Contact regular and prospective customers to demonstrate products, explain product features, and solicit orders. ※ | 0.9923 | 0.4926 | 0.4997 |
| Identify prospective customers by using business directories, following leads from existing clients, participating in organizations and clubs, and attending trade shows and conferences. ※ | 0.9852 | 0.4891 | 0.4961 |

## customer-support　✅ reviewed

Pattern: `\A(?:Answer\ customers'\ questions\ about\ products,\ prices,\ availability,\ product\ uses,\ and\ credit\ terms\.|Check\ to\ ensure\ that\ appropriate\ changes\ were\ made\ to\ resolve\ customers'\ problems\.|Resolve\ customers'\ service\ or\ billing\ complaints\ by\ performing\ activities\ such\ as\ exchanging\ merchandise,\ refunding\ money,\ or\ adjusting\ bills\.|Refer\ unresolved\ customer\ grievances\ to\ designated\ departments\ for\ further\ investigation\.|Contact\ customers\ to\ respond\ to\ inquiries\ or\ to\ notify\ them\ of\ claim\ investigation\ results\ or\ any\ planned\ adjustments\.)\Z` → automation **0.2576**, augmentation **0.6057**

Reviewer note: [AI 语义审查 2026-10-31] 保留客户问题解答、投诉处理、转交调查、服务跟进与通知。

**sales-executive**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Answer customers' questions about products, prices, availability, product uses, and credit terms. | 0.9818 | 0.2575 | 0.7243 |

**customer-service**

| O*NET task | Penetration | Automation | Augmentation |
|---|---|---|---|
| Check to ensure that appropriate changes were made to resolve customers' problems. | 0.0 | 0.0 | 0.0 |
| Resolve customers' service or billing complaints by performing activities such as exchanging merchandise, refunding money, or adjusting bills. | 0.9872 | 0.3858 | 0.6014 |
| Refer unresolved customer grievances to designated departments for further investigation. ※ | 1.0 | 0.3238 | 0.6762 |
| Contact customers to respond to inquiries or to notify them of claim investigation results or any planned adjustments. ※ | 0.9913 | 0.321 | 0.6703 |

## crm-systems　✅ reviewed

Pattern: `\bcrm\b|customer relationship management|\bsalesforce\b|\bhubspot\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 记录客户互动或销售记录不一定使用 CRM 系统。

## workplace-languages　✅ reviewed

Pattern: `\b(?:foreign languages?|multilingual|multi-lingual|bilingual)\b|\b(?:translate|interpret)\w*\b.{0,60}\blanguages?\b` → no matching task → shown as "no source"

Reviewer note: [AI 语义审查 2026-10-31] 一般沟通和 translating findings into written text 不属于多语言能力。

※ The task has a penetration but no interaction split; its automation and augmentation shares are the mean of the career's other tasks.
