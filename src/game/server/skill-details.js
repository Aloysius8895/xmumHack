/** Skill descriptions and an estimated difficulty (1–5). Demand comes only from collected postings, never from here. */
const DETAILS = [
    ['sql', 'database', 3, '用查询、关联和聚合，从数据库中提取需要的信息。', 'Query, join and aggregate database records to find useful information.', 'Kueri, gabung dan agregat rekod pangkalan data untuk mencari maklumat berguna.'],
    ['excel', 'sheet', 2, '用公式、数据透视表和表格整理信息并制作报表。', 'Organize information and build reports with formulas and pivot tables.', 'Susun maklumat dan bina laporan dengan formula dan jadual pangsi.'],
    ['statistics', 'chart', 3, '理解分布、抽样和统计指标，让结论有依据。', 'Understand distributions, sampling and metrics to support conclusions.', 'Fahami taburan, persampelan dan metrik untuk menyokong kesimpulan.'],
    ['python', 'code', 3, '编写脚本处理数据、自动化重复工作并解决问题。', 'Write scripts to process data, automate tasks and solve problems.', 'Tulis skrip untuk memproses data, mengautomasikan tugas dan menyelesaikan masalah.'],
    ['data-cleaning', 'filter', 2, '处理缺失值、重复项和格式问题，得到可靠的数据。', 'Handle missing values, duplicates and inconsistent formats for reliable data.', 'Urus nilai hilang, pendua dan format tidak seragam untuk data yang boleh dipercayai.'],
    ['data-visualization', 'chart', 3, '选择合适的图表，清楚表达趋势、对比与结论。', 'Choose clear charts to communicate trends, comparisons and findings.', 'Pilih carta yang jelas untuk menyampaikan trend, perbandingan dan penemuan.'],
    ['communication', 'message', 2, '把想法说清楚，理解反馈，并与他人协作推进工作。', 'Explain ideas clearly, understand feedback and collaborate with others.', 'Jelaskan idea, fahami maklum balas dan bekerjasama dengan orang lain.'],
    ['html-css', 'layout', 2, '搭建网页结构与样式，适配不同尺寸的屏幕。', 'Build page structure and styles that adapt to different screen sizes.', 'Bina struktur dan gaya halaman yang sesuai untuk pelbagai saiz skrin.'],
    ['javascript', 'code', 3, '处理网页交互、异步请求和应用逻辑。', 'Handle web interactions, asynchronous requests and application logic.', 'Urus interaksi web, permintaan tak segerak dan logik aplikasi.'],
    ['react', 'layers', 3, '用组件与状态组织界面，构建可维护的交互应用。', 'Organize interfaces with components and state for maintainable applications.', 'Susun antara muka dengan komponen dan keadaan untuk aplikasi yang mudah diselenggara.'],
    ['git', 'branch', 2, '记录代码变化，管理分支并与团队协作合并修改。', 'Track changes, manage branches and merge work with a team.', 'Jejak perubahan, urus cabang dan gabung kerja bersama pasukan.'],
    ['accessibility', 'layout', 3, '让界面适配设备，并支持键盘和辅助技术访问。', 'Adapt interfaces to devices and support keyboards and assistive technology.', 'Sesuaikan antara muka dengan peranti serta sokong papan kekunci dan teknologi bantuan.'],
    ['api-integration', 'link', 3, '连接服务接口，处理数据、加载状态和错误反馈。', 'Connect service APIs and handle data, loading states and errors.', 'Sambungkan API perkhidmatan serta urus data, keadaan pemuatan dan ralat.'],
    ['backend-language', 'code', 4, '实现服务端业务逻辑，处理请求并组织可靠的服务。', 'Implement server logic, handle requests and organize reliable services.', 'Laksanakan logik pelayan, kendalikan permintaan dan susun perkhidmatan yang boleh dipercayai.'],
    ['databases', 'database', 4, '设计数据结构、关系与索引，保障数据的一致性。', 'Design schemas, relationships and indexes while maintaining data consistency.', 'Reka skema, hubungan dan indeks sambil mengekalkan ketekalan data.'],
    ['rest-api', 'link', 3, '设计清晰的资源接口、请求规则和错误响应。', 'Design clear resource APIs, request contracts and error responses.', 'Reka API sumber, kontrak permintaan dan respons ralat yang jelas.'],
    ['cloud-deploy', 'cloud', 4, '把服务部署到云端，管理配置、监控和运行环境。', 'Deploy services to the cloud and manage configuration and monitoring.', 'Gunakan perkhidmatan di awan serta urus konfigurasi dan pemantauan.'],
    ['testing', 'check', 3, '编写自动化检查，验证关键行为并及时发现回归。', 'Write automated checks for important behavior and catch regressions.', 'Tulis semakan automatik untuk tingkah laku penting dan kesan regresi.'],
    ['user-research', 'search', 3, '通过访谈与观察了解用户目标、行为和真实问题。', 'Use interviews and observation to understand user goals and problems.', 'Gunakan temu bual dan pemerhatian untuk memahami matlamat dan masalah pengguna.'],
    ['prototyping', 'layout', 3, '用线框和交互原型验证信息结构与操作流程。', 'Use wireframes and prototypes to validate information and interaction flows.', 'Gunakan rangka wayar dan prototaip untuk mengesahkan aliran maklumat dan interaksi.'],
    ['figma', 'pen', 2, '制作界面、组件和原型，并协作交付设计。', 'Create interfaces, components and prototypes and collaborate on design handoff.', 'Cipta antara muka, komponen dan prototaip serta bekerjasama dalam penyerahan reka bentuk.'],
    ['visual-design', 'pen', 3, '运用排版、色彩和层级，让信息清楚且风格一致。', 'Use typography, color and hierarchy for clear, consistent visuals.', 'Gunakan tipografi, warna dan hierarki untuk visual yang jelas dan konsisten.'],
    ['usability-testing', 'search', 3, '观察用户完成任务，发现体验问题并验证改进。', 'Observe users completing tasks to find problems and validate improvements.', 'Perhatikan pengguna melaksanakan tugas untuk mencari masalah dan mengesahkan penambahbaikan.'],
    ['ml-math', 'brain', 5, '掌握线性代数、概率和优化，理解模型背后的原理。', 'Study linear algebra, probability and optimization to understand models.', 'Kaji algebra linear, kebarangkalian dan pengoptimuman untuk memahami model.'],
    ['ml-frameworks', 'brain', 4, '使用机器学习框架训练、评估和改进模型。', 'Train, evaluate and improve models with machine learning frameworks.', 'Latih, nilai dan tingkatkan model dengan rangka kerja pembelajaran mesin.'],
    ['mlops', 'cloud', 5, '管理模型部署、版本与监控，让模型持续可靠运行。', 'Manage model deployment, versions and monitoring for reliable operation.', 'Urus penggunaan, versi dan pemantauan model untuk operasi yang boleh dipercayai.'],
    ['roadmapping', 'compass', 3, '梳理目标与优先级，把产品方向拆成可执行的计划。', 'Turn product goals and priorities into an actionable plan.', 'Tukar matlamat dan keutamaan produk kepada pelan yang boleh dilaksanakan.'],
    ['agile', 'layers', 2, '通过迭代、反馈和团队协作持续交付改进。', 'Deliver improvements through iteration, feedback and team collaboration.', 'Sampaikan penambahbaikan melalui lelaran, maklum balas dan kerjasama pasukan.'],
    ['market-analysis', 'chart', 3, '研究用户、竞品和行业信息，支持产品决策。', 'Research users, competitors and industry information to support decisions.', 'Kaji pengguna, pesaing dan maklumat industri untuk menyokong keputusan.'],
    ['accounting', 'sheet', 3, '按会计准则记录交易，编制并读懂财务报表。', 'Record transactions under accounting standards and read financial statements.', 'Rekod transaksi mengikut piawaian perakaunan dan fahami penyata kewangan.'],
    ['auditing', 'check', 4, '规划审计、抽样取证，并对财务报告给出意见。', 'Plan audits, sample evidence and form an opinion on financial reports.', 'Rancang audit, ambil sampel bukti dan beri pendapat tentang laporan kewangan.'],
    ['internal-control', 'filter', 3, '识别流程中的风险，设计并测试防错防弊的控制。', 'Spot process risks and design and test controls against errors and fraud.', 'Kenal pasti risiko proses serta reka dan uji kawalan terhadap kesilapan dan penipuan.'],
    ['legal-research', 'search', 4, '查找法条与判例，分析它们如何适用于具体问题。', 'Find statutes and cases and analyse how they apply to a given issue.', 'Cari statut dan kes serta analisis cara ia terpakai pada sesuatu isu.'],
    ['legal-writing', 'pen', 4, '起草合同、意见书和诉讼文件，用词严谨清楚。', 'Draft contracts, opinions and court documents in precise, clear language.', 'Gubal kontrak, pendapat dan dokumen mahkamah dengan bahasa yang tepat dan jelas.'],
    ['negotiation', 'message', 3, '理解各方利益，准备方案，在谈判中争取好的结果。', 'Understand each side\'s interests, prepare options and reach good deals.', 'Fahami kepentingan setiap pihak, sediakan pilihan dan capai persetujuan yang baik.'],
    ['lesson-planning', 'compass', 3, '根据学习目标设计课程内容、活动和节奏。', 'Design lesson content, activities and pacing around learning goals.', 'Reka kandungan, aktiviti dan rentak pelajaran berdasarkan matlamat pembelajaran.'],
    ['classroom-management', 'layers', 3, '建立课堂规则和节奏，让学生专注投入。', 'Set classroom routines and rules that keep students focused and engaged.', 'Wujudkan rutin dan peraturan kelas supaya murid fokus dan terlibat.'],
    ['assessment', 'check', 2, '设计测验与评分标准，用结果调整教学。', 'Design quizzes and rubrics and use the results to adjust teaching.', 'Reka kuiz dan rubrik serta gunakan keputusan untuk menyesuaikan pengajaran.'],
    ['clinical-knowledge', 'brain', 5, '掌握疾病的成因、诊断与治疗，做出临床判断。', 'Know the causes, diagnosis and treatment of diseases to make clinical decisions.', 'Kuasai punca, diagnosis dan rawatan penyakit untuk membuat keputusan klinikal.'],
    ['patient-care', 'message', 3, '与病人和家属沟通，安全、有同理心地照护病人。', 'Communicate with patients and families and care for them safely and kindly.', 'Berkomunikasi dengan pesakit dan keluarga serta menjaga mereka dengan selamat dan prihatin.'],
    ['medical-ethics', 'compass', 3, '在知情同意、隐私和资源分配上做出合乎伦理的决定。', 'Make ethical decisions on consent, privacy and the use of resources.', 'Buat keputusan beretika tentang persetujuan, privasi dan penggunaan sumber.'],
    ['cooking-technique', 'layers', 3, '掌握刀工、火候和基础酱汁，稳定做出好味道。', 'Master knife skills, heat control and base sauces for consistent flavour.', 'Kuasai kemahiran pisau, kawalan api dan sos asas untuk rasa yang konsisten.'],
    ['food-safety', 'check', 2, '遵守卫生和温度规范，防止食物污染。', 'Follow hygiene and temperature rules to prevent food contamination.', 'Patuhi peraturan kebersihan dan suhu untuk mengelakkan pencemaran makanan.'],
    ['menu-planning', 'sheet', 3, '设计菜单并计算食材成本，兼顾口味与利润。', 'Design menus and cost the ingredients, balancing taste and profit.', 'Reka menu dan kira kos bahan, mengimbangi rasa dan keuntungan.'],
    ['engineering-math', 'chart', 4, '用微积分、力学和材料知识计算结构与荷载。', 'Use calculus, mechanics and materials knowledge to calculate structures and loads.', 'Gunakan kalkulus, mekanik dan pengetahuan bahan untuk mengira struktur dan beban.'],
    ['cad', 'layout', 3, '用 AutoCAD 等工具绘制和修改工程图纸。', 'Draw and revise engineering drawings with tools like AutoCAD.', 'Lukis dan semak lukisan kejuruteraan dengan alat seperti AutoCAD.'],
    ['project-management', 'compass', 3, '规划范围、时间和预算，协调团队按时交付。', 'Plan scope, schedule and budget and coordinate a team to deliver on time.', 'Rancang skop, jadual dan bajet serta selaraskan pasukan untuk menyiapkan tepat pada masa.'],
    ['accounting-software', 'sheet', 2, '用 SQL Account、AutoCount、Xero 等会计软件记账、出单和出报表。', 'Record entries, issue documents and run reports in accounting software such as SQL Account, AutoCount or Xero.', 'Rekod catatan, keluarkan dokumen dan jana laporan dalam perisian perakaunan seperti SQL Account, AutoCount atau Xero.'],
    ['accounts-payable-receivable', 'filter', 2, '处理发票、付款和收款，按时做银行对账与催收。', 'Handle invoices, payments and collections, and reconcile bank statements on time.', 'Urus invois, bayaran dan kutipan, serta buat penyesuaian bank tepat pada masanya.'],
    ['taxation', 'check', 3, '了解所得税、SST 和电子发票的规定，准备税务计算与申报。', 'Know income tax, SST and e-invoicing rules, and prepare tax computations and filings.', 'Fahami peraturan cukai pendapatan, SST dan e-invois, serta sediakan pengiraan dan pemfailan cukai.'],
    ['electrical-systems', 'branch', 4, '读懂和设计配电、开关设备与高低压系统，看懂单线图。', 'Read and design power distribution, switchgear and LV/HV systems, including single-line diagrams.', 'Baca dan reka bentuk agihan kuasa, suis gear dan sistem LV/HV, termasuk gambar rajah satu garisan.'],
    ['equipment-maintenance', 'check', 3, '安排预防性维护，排查设备故障，减少停机时间。', 'Plan preventive maintenance and fix equipment breakdowns to reduce downtime.', 'Rancang penyelenggaraan pencegahan dan baiki kerosakan peralatan untuk mengurangkan masa henti.'],
    ['plc-automation', 'code', 4, '编写和调试 PLC、SCADA、HMI 程序，让产线和设备自动运行。', 'Program and debug PLC, SCADA and HMI systems that run production lines and equipment.', 'Atur cara dan nyahpepijat sistem PLC, SCADA dan HMI yang menjalankan barisan pengeluaran dan peralatan.'],
    ['social-media-marketing', 'message', 2, '在 Facebook、Instagram、TikTok 等平台规划内容、经营社群和与网红合作。', 'Plan content, manage communities and work with influencers on Facebook, Instagram, TikTok and similar platforms.', 'Rancang kandungan, urus komuniti dan bekerjasama dengan pempengaruh di Facebook, Instagram, TikTok dan platform lain.'],
    ['digital-advertising', 'search', 3, '设置和优化 Google Ads、Meta Ads 等付费广告，控制预算与转化成本。', 'Set up and optimise paid campaigns such as Google Ads and Meta Ads within a budget and a cost per conversion.', 'Sediakan dan optimumkan kempen berbayar seperti Google Ads dan Meta Ads dalam bajet dan kos setiap penukaran.'],
    ['web-analytics', 'chart', 3, '用 Google Analytics、Search Console 等工具追踪流量、转化和 SEO 成效。', 'Track traffic, conversions and SEO results with tools such as Google Analytics and Search Console.', 'Jejak trafik, penukaran dan hasil SEO dengan alat seperti Google Analytics dan Search Console.'],
    ['content-writing', 'pen', 2, '为广告、社交媒体和网站写清楚、有说服力的文案。', 'Write clear, persuasive copy for ads, social media and websites.', 'Tulis salinan yang jelas dan meyakinkan untuk iklan, media sosial dan laman web.'],
    ['quantity-surveying', 'sheet', 4, '按图纸计算工程量、编制工程量清单（BQ），处理进度款和结算。', 'Take off quantities from drawings, prepare bills of quantities and handle interim claims and final accounts.', 'Ambil kuantiti daripada lukisan, sediakan senarai kuantiti dan urus tuntutan interim serta akaun akhir.'],
    ['cost-estimation', 'chart', 3, '估算项目成本、制定预算，在施工过程中控制成本和做价值工程。', 'Estimate project costs, set budgets and control costs during the work, including value engineering.', 'Anggarkan kos projek, tetapkan bajet dan kawal kos semasa kerja, termasuk kejuruteraan nilai.'],
    ['contract-administration', 'check', 3, '准备招标文件、评标和管理分包合约，熟悉 PAM、CIDB 等合约条款。', 'Prepare tender documents, evaluate bids and manage subcontracts under forms such as PAM and CIDB.', 'Sediakan dokumen tender, nilai tawaran dan urus subkontrak di bawah borang seperti PAM dan CIDB.'],
    ['employee-relations', 'message', 3, '处理员工投诉、纪律程序和员工参与活动，遵守《1955 年雇佣法令》。', 'Handle grievances, disciplinary procedures and engagement in line with the Employment Act 1955.', 'Urus aduan, prosedur tatatertib dan penglibatan pekerja selaras dengan Akta Kerja 1955.'],
    ['recruitment', 'search', 2, '写职位说明、筛选简历、安排面试并带新员工入职。', 'Write job descriptions, screen candidates, run interviews and onboard new hires.', 'Tulis huraian kerja, tapis calon, jalankan temu duga dan sambut pekerja baharu.'],
    ['payroll', 'sheet', 2, '计算薪资，处理 EPF、SOCSO、EIS 和 PCB 的缴款与申报。', 'Run payroll and handle EPF, SOCSO, EIS and PCB contributions and submissions.', 'Proses gaji dan urus caruman serta penyerahan KWSP, PERKESO, SIP dan PCB.'],
    ['sales-prospecting', 'compass', 2, '寻找潜在客户、跟进商机并完成成交，达成销售目标。', 'Find prospects, follow up leads and close deals to meet sales targets.', 'Cari prospek, susuli petunjuk dan tutup urusan untuk mencapai sasaran jualan.'],
    ['customer-support', 'message', 1, '耐心回应客户询问和投诉，跟进售后问题直到解决。', 'Answer customer enquiries and complaints patiently and follow after-sales issues through to a fix.', 'Jawab pertanyaan dan aduan pelanggan dengan sabar serta susuli isu selepas jualan hingga selesai.'],
    ['crm-systems', 'database', 2, '在 Salesforce、HubSpot、Zoho 等 CRM 里管理客户资料、商机和跟进记录。', 'Manage customer records, deals and follow-ups in CRM tools such as Salesforce, HubSpot or Zoho.', 'Urus rekod pelanggan, urusan dan susulan dalam alat CRM seperti Salesforce, HubSpot atau Zoho.'],
    ['workplace-languages', 'message', 3, '用马来语、华语等第二语言与客户和同事沟通，许多马来西亚职位会注明。', 'Communicate with clients and colleagues in a second language such as Malay or Mandarin, which many Malaysian postings ask for.', 'Berkomunikasi dengan pelanggan dan rakan sekerja dalam bahasa kedua seperti Bahasa Melayu atau Mandarin, yang diminta oleh banyak iklan di Malaysia.'],
]

/**
 * One place to start learning each skill: free, open licence or open source when `open` (checked reachable 2026-10-22)
 * Custom skills (made from a job posting) borrow the links of their topic instead: relatedResources
 */
const RESOURCES = {
    'sql':                 { title: 'Select Star SQL', url: 'https://selectstarsql.com/', open: true },
    'excel':               { title: 'GCFGlobal Excel', url: 'https://www.learnfree.org/series/excel-foundations', open: false },
    'statistics':          { title: 'OpenIntro Statistics', url: 'https://www.openintro.org/book/os/', open: true },
    'python':              { title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/', open: true },
    'data-cleaning':       { title: 'Kaggle Learn: Data Cleaning', url: 'https://www.kaggle.com/learn/data-cleaning', open: false },
    'data-visualization':  { title: 'Fundamentals of Data Visualization', url: 'https://clauswilke.com/dataviz/', open: true },
    'communication':       { title: 'Google Technical Writing', url: 'https://developers.google.com/tech-writing', open: true },
    'html-css':            { title: 'MDN: Learn web development', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development', open: true },
    'javascript':          { title: 'The Modern JavaScript Tutorial', url: 'https://javascript.info/', open: true },
    'react':               { title: 'React: Learn', url: 'https://react.dev/learn', open: true },
    'git':                 { title: 'Pro Git', url: 'https://git-scm.com/book/en/v2', open: true },
    'accessibility':       { title: 'web.dev: Learn Accessibility', url: 'https://web.dev/learn/accessibility', open: true },
    'api-integration':     { title: 'MDN: Using the Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch', open: true },
    'backend-language':    { title: 'roadmap.sh: Backend', url: 'https://roadmap.sh/backend', open: true },
    'databases':           { title: 'PostgreSQL Tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html', open: true },
    'rest-api':            { title: 'Microsoft REST API Guidelines', url: 'https://github.com/microsoft/api-guidelines', open: true },
    'cloud-deploy':        { title: 'Docker: Get started', url: 'https://docs.docker.com/get-started/', open: true },
    'testing':             { title: 'The Practical Test Pyramid', url: 'https://martinfowler.com/articles/practical-test-pyramid.html', open: false },
    'user-research':       { title: 'GOV.UK Service Manual: User research', url: 'https://www.gov.uk/service-manual/user-research', open: true },
    'prototyping':         { title: 'GOV.UK: Making prototypes', url: 'https://www.gov.uk/service-manual/design/making-prototypes', open: true },
    'figma':               { title: 'Figma Learn', url: 'https://help.figma.com/hc/en-us', open: false },
    'visual-design':       { title: 'Material Design: Foundations', url: 'https://m3.material.io/foundations', open: false },
    'usability-testing':   { title: 'GOV.UK: Moderated usability testing', url: 'https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing', open: true },
    'ml-math':             { title: 'Mathematics for Machine Learning', url: 'https://mml-book.github.io/', open: false },
    'ml-frameworks':       { title: 'PyTorch Tutorials', url: 'https://docs.pytorch.org/tutorials/', open: true },
    'mlops':               { title: 'Made With ML', url: 'https://madewithml.com/', open: true },
    'roadmapping':         { title: 'Atlassian: Product roadmaps', url: 'https://www.atlassian.com/agile/product-management/product-roadmaps', open: false },
    'agile':               { title: 'The Scrum Guide', url: 'https://scrumguides.org/scrum-guide.html', open: true },
    'market-analysis':     { title: 'OpenStax: Principles of Marketing', url: 'https://openstax.org/details/books/principles-marketing', open: true },
    'accounting':          { title: 'OpenStax: Principles of Financial Accounting', url: 'https://openstax.org/details/books/principles-financial-accounting', open: true },
    'auditing': { prompt: true },
    'internal-control': { prompt: true },
    'legal-research':      { title: 'Cornell LII Wex: Legal research', url: 'https://www.law.cornell.edu/wex/legal_research', open: false },
    'legal-writing':       { title: 'Plain language guide', url: 'https://digital.gov/guides/plain-language', open: true },
    'negotiation': { title: 'Community Awareness: Negotiating for Financial Success', url: 'https://www.coursera.org/learn/negotiating-for-financial-success', open: false, provider: 'Coursera', cost: 'free', estimatedHours: 3 },
    'lesson-planning': { prompt: true },
    'classroom-management':{ title: 'Edutopia: Classroom management', url: 'https://www.edutopia.org/topic/classroom-management', open: false },
    'assessment':          { title: 'Edutopia: Assessment', url: 'https://www.edutopia.org/topic/assessment', open: false },
    'clinical-knowledge':  { title: 'OpenStax: Anatomy and Physiology', url: 'https://openstax.org/details/books/anatomy-and-physiology-2e', open: true },
    'patient-care':        { title: 'OpenStax: Fundamentals of Nursing', url: 'https://openstax.org/details/books/fundamentals-nursing', open: true },
    'medical-ethics': { prompt: true },
    'cooking-technique':   { title: 'Wikibooks Cookbook', url: 'https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents', open: true },
    'food-safety':         { title: 'WHO: Five keys to safer food', url: 'https://www.who.int/publications/i/item/9789241594639', open: false },
    'menu-planning': { prompt: true },
    'engineering-math':    { title: 'OpenStax: Calculus Volume 1', url: 'https://openstax.org/details/books/calculus-volume-1', open: true },
    'cad':                 { title: 'FreeCAD: Getting started', url: 'https://wiki.freecad.org/Getting_started', open: true },
    'project-management':  { title: 'Project Management (open textbook)', url: 'https://opentextbc.ca/projectmanagement/', open: true },
    'accounting-software': { title: 'GnuCash Tutorial and Concepts Guide', url: 'https://www.gnucash.org/docs/v5/C/gnucash-guide/', open: true },
    'accounts-payable-receivable':{ title: 'OpenStax: Principles of Accounting, Volume 1', url: 'https://openstax.org/details/books/principles-financial-accounting', open: true },
    'taxation':            { title: 'LHDN (Inland Revenue Board of Malaysia)', url: 'https://www.hasil.gov.my/en/', open: false },
    'electrical-systems':  { title: 'Wikibooks: Circuit Theory', url: 'https://en.wikibooks.org/wiki/Circuit_Theory', open: true },
    'equipment-maintenance':{ title: 'Wikipedia: Preventive maintenance', url: 'https://en.wikipedia.org/wiki/Preventive_maintenance', open: true },
    'plc-automation':      { title: 'Wikipedia: Programmable logic controller', url: 'https://en.wikipedia.org/wiki/Programmable_logic_controller', open: true },
    'social-media-marketing':{ title: 'HubSpot Academy: Social Media Marketing', url: 'https://academy.hubspot.com/courses/social-media', open: false },
    'digital-advertising': { title: 'Google Skillshop', url: 'https://skillshop.withgoogle.com/', open: false },
    'web-analytics':       { title: 'Google Analytics Help: Get started', url: 'https://support.google.com/analytics/answer/9304153', open: false },
    'content-writing':     { title: 'HubSpot Academy: Content Marketing', url: 'https://academy.hubspot.com/courses/content-marketing', open: false },
    'quantity-surveying':  { title: 'Wikipedia: Bill of quantities', url: 'https://en.wikipedia.org/wiki/Bill_of_quantities', open: true },
    'cost-estimation':     { title: 'Wikipedia: Cost estimate', url: 'https://en.wikipedia.org/wiki/Cost_estimate', open: true },
    'contract-administration':{ title: 'Wikipedia: Construction contract', url: 'https://en.wikipedia.org/wiki/Construction_contract', open: true },
    'employee-relations':  { title: 'JTKSM (Department of Labour, Peninsular Malaysia)', url: 'https://jtksm.mohr.gov.my/', open: false },
    'recruitment':         { title: 'OpenStax: Principles of Management', url: 'https://openstax.org/details/books/principles-management', open: true },
    'payroll':             { title: 'Wikipedia: Employees Provident Fund (Malaysia)', url: 'https://en.wikipedia.org/wiki/Employees_Provident_Fund_(Malaysia)', open: true },
    'sales-prospecting':   { title: 'HubSpot Academy: Inbound Sales', url: 'https://academy.hubspot.com/courses/inbound-sales', open: false },
    'customer-support':    { title: 'Wikipedia: Customer service', url: 'https://en.wikipedia.org/wiki/Customer_service', open: true },
    'crm-systems':         { title: 'Salesforce Trailhead', url: 'https://trailhead.salesforce.com/', open: false },
    'workplace-languages': { title: 'Wikibooks: Chinese (Mandarin)', url: 'https://en.wikibooks.org/wiki/Chinese_(Mandarin)', open: true },
}

/**
 * Topic articles after the starting point (GeeksforGeeks, W3Schools, MDN, Khan Academy...), free to read, open licence when
 * `open`; checked reachable 2026-10-31 (src/data/scripts/check-learning-resources.mjs). A roadmap task links one resource of its
 * skill (features.js resourceIndex), the AI never writes a link itself
 */
const MORE_RESOURCES = {
    'sql':                 [ { title: 'GeeksforGeeks: SQL Tutorial', url: 'https://www.geeksforgeeks.org/sql/sql-tutorial/' }, { title: 'W3Schools: SQL', url: 'https://www.w3schools.com/sql/' } ],
    'excel':               [ { title: 'W3Schools: Excel', url: 'https://www.w3schools.com/excel/' }, { title: 'GeeksforGeeks: Excel Tutorial', url: 'https://www.geeksforgeeks.org/excel/excel-tutorial/' } ],
    'statistics':          [ { title: 'Khan Academy: Statistics and probability', url: 'https://www.khanacademy.org/math/statistics-probability' }, { title: 'GeeksforGeeks: Statistics', url: 'https://www.geeksforgeeks.org/maths/statistics/' } ],
    'python':              [ { title: 'GeeksforGeeks: Python Tutorial', url: 'https://www.geeksforgeeks.org/python/python-programming-language-tutorial/' }, { title: 'W3Schools: Python', url: 'https://www.w3schools.com/python/' } ],
    'data-cleaning':       [ { title: 'GeeksforGeeks: Data Cleaning', url: 'https://www.geeksforgeeks.org/data-analysis/data-cleaning-introduction/' }, { title: 'pandas: Working with missing data', url: 'https://pandas.pydata.org/docs/user_guide/missing_data.html', open: true } ],
    'data-visualization':  [ { title: 'GeeksforGeeks: Data Visualization', url: 'https://www.geeksforgeeks.org/data-visualization/data-visualization-and-its-importance/' }, { title: 'Matplotlib: Tutorials', url: 'https://matplotlib.org/stable/tutorials/index.html', open: true } ],
    'communication':       [ { title: 'SkillsYouNeed: Communication Skills', url: 'https://www.skillsyouneed.com/ips/communication-skills.html' } ],
    'html-css':            [ { title: 'W3Schools: HTML', url: 'https://www.w3schools.com/html/' }, { title: 'W3Schools: CSS', url: 'https://www.w3schools.com/css/' } ],
    'javascript':          [ { title: 'MDN: JavaScript Guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', open: true }, { title: 'GeeksforGeeks: JavaScript Tutorial', url: 'https://www.geeksforgeeks.org/javascript/javascript-tutorial/' } ],
    'react':               [ { title: 'GeeksforGeeks: React Tutorial', url: 'https://www.geeksforgeeks.org/reactjs/react/' }, { title: 'W3Schools: React', url: 'https://www.w3schools.com/react/' } ],
    'git':                 [ { title: 'GeeksforGeeks: Git Tutorial', url: 'https://www.geeksforgeeks.org/git/git-tutorial/' }, { title: 'GitHub Skills', url: 'https://skills.github.com/' } ],
    'accessibility':       [ { title: 'MDN: Accessibility', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Accessibility', open: true } ],
    'api-integration':     [ { title: 'GeeksforGeeks: Fetch API in JavaScript', url: 'https://www.geeksforgeeks.org/javascript/javascript-fetch-method/' }, { title: 'W3Schools: Fetch API', url: 'https://www.w3schools.com/js/js_api_fetch.asp' } ],
    'backend-language':    [ { title: 'MDN: Server-side website programming', url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side', open: true }, { title: 'GeeksforGeeks: Node.js Tutorial', url: 'https://www.geeksforgeeks.org/node-js/nodejs/' } ],
    'databases':           [ { title: 'GeeksforGeeks: DBMS Tutorial', url: 'https://www.geeksforgeeks.org/dbms/dbms/' }, { title: 'W3Schools: SQL Database', url: 'https://www.w3schools.com/sql/sql_create_db.asp' } ],
    'rest-api':            [ { title: 'GeeksforGeeks: REST Fundamentals', url: 'https://www.geeksforgeeks.org/node-js/rest-api-introduction/' }, { title: 'MDN: HTTP', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP', open: true } ],
    'cloud-deploy':        [ { title: 'GeeksforGeeks: Docker Tutorial', url: 'https://www.geeksforgeeks.org/devops/docker-tutorial/' }, { title: 'GitHub Docs: GitHub Pages', url: 'https://docs.github.com/en/pages/getting-started-with-github-pages', open: true } ],
    'testing':             [ { title: 'GeeksforGeeks: Software Testing Tutorial', url: 'https://www.geeksforgeeks.org/software-testing/software-testing-tutorial/' }, { title: 'Jest: Getting Started', url: 'https://jestjs.io/docs/getting-started', open: true } ],
    'user-research':       [ { title: 'NN/g: When to Use Which UX Research Methods', url: 'https://www.nngroup.com/articles/which-ux-research-methods/' } ],
    'prototyping':         [ { title: 'NN/g: UX Prototypes, Low vs. High Fidelity', url: 'https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/' } ],
    'figma':               [ { title: 'GeeksforGeeks: Figma Tutorial', url: 'https://www.geeksforgeeks.org/websites-apps/figma-tutorial/' } ],
    'visual-design':       [ { title: 'NN/g: Principles of Visual Design', url: 'https://www.nngroup.com/articles/principles-visual-design/' } ],
    'usability-testing':   [ { title: 'NN/g: Usability Testing 101', url: 'https://www.nngroup.com/articles/usability-testing-101/' } ],
    'ml-math':             [ { title: 'GeeksforGeeks: Maths for Machine Learning', url: 'https://www.geeksforgeeks.org/machine-learning/machine-learning-mathematics/' }, { title: 'Khan Academy: Linear algebra', url: 'https://www.khanacademy.org/math/linear-algebra' } ],
    'ml-frameworks':       [ { title: 'GeeksforGeeks: NLP Tutorial', url: 'https://www.geeksforgeeks.org/nlp/natural-language-processing-nlp-tutorial/' }, { title: 'scikit-learn: Getting Started', url: 'https://scikit-learn.org/stable/getting_started.html', open: true } ],
    'mlops':               [ { title: 'GeeksforGeeks: What is MLOps?', url: 'https://www.geeksforgeeks.org/machine-learning/what-is-mlops/' }, { title: 'Google Cloud: MLOps pipelines', url: 'https://docs.cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning' } ],
    'roadmapping':         [ { title: 'ProductPlan: Guide to Product Roadmaps', url: 'https://www.productplan.com/learn/what-is-a-product-roadmap' } ],
    'agile':               [ { title: 'Atlassian: What is Agile?', url: 'https://www.atlassian.com/agile' }, { title: 'GeeksforGeeks: Agile Methodology', url: 'https://www.geeksforgeeks.org/software-testing/what-is-agile-methodology/' } ],
    'market-analysis':     [ { title: 'HubSpot: How to Do Market Research', url: 'https://blog.hubspot.com/marketing/market-research-buyers-journey-guide' } ],
    'accounting':          [ { title: 'AccountingCoach', url: 'https://www.accountingcoach.com/' }, { title: 'Khan Academy: Accounting and financial statements', url: 'https://www.khanacademy.org/economics-finance-domain/core-finance/accounting-and-financial-stateme' } ],
    'legal-research':      [ { title: 'Georgetown Law Library: Research Guides', url: 'https://guides.ll.georgetown.edu/home' } ],
    'legal-writing':       [ { title: 'Purdue OWL: Legal Writing', url: 'https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/legal_writing/index.html' } ],
    'classroom-management':[ { title: 'Khan Academy for Educators', url: 'https://www.khanacademy.org/khan-for-educators' } ],
    'clinical-knowledge':  [ { title: 'Khan Academy: Health and medicine', url: 'https://www.khanacademy.org/science/health-and-medicine' } ],
    'food-safety':         [ { title: 'FoodSafety.gov', url: 'https://www.foodsafety.gov/' } ],
    'engineering-math':    [ { title: 'GeeksforGeeks: Engineering Mathematics', url: 'https://www.geeksforgeeks.org/engineering-mathematics/engineering-mathematics-tutorials/' }, { title: 'Khan Academy: Calculus 1', url: 'https://www.khanacademy.org/math/calculus-1' } ],
    'project-management':  [ { title: 'Atlassian: What Is Project Management?', url: 'https://www.atlassian.com/work-management/project-management' }, { title: 'GeeksforGeeks: Software Project Management', url: 'https://www.geeksforgeeks.org/software-engineering/software-engineering-software-project-management-spm/' } ],
    'accounts-payable-receivable':[ { title: 'AccountingCoach: Accounts Payable', url: 'https://www.accountingcoach.com/accounts-payable/explanation' }, { title: 'AccountingCoach: Accounts Receivable', url: 'https://www.accountingcoach.com/accounts-receivable-and-bad-debts-expense/explanation' } ],
    'electrical-systems':  [ { title: 'Khan Academy: Electrical engineering', url: 'https://www.khanacademy.org/science/electrical-engineering' } ],
    'plc-automation':      [ { title: 'RealPars: What Is a PLC?', url: 'https://www.realpars.com/blog/what-is-a-plc' } ],
    'social-media-marketing':[ { title: 'HubSpot: Social Media Marketing', url: 'https://blog.hubspot.com/marketing/social-media-marketing' } ],
    'web-analytics':       [ { title: 'Google Skillshop: Google Analytics 4', url: 'https://skillshop.exceedlms.com/student/catalog/list?category_ids=6431-google-analytics-4' } ],
    'content-writing':     [ { title: 'Purdue OWL: Professional Writing', url: 'https://owl.purdue.edu/owl/subject_specific_writing/professional_technical_writing/index.html' } ],
    'customer-support':    [ { title: 'HubSpot: Customer Service Skills', url: 'https://blog.hubspot.com/service/customer-service-skills' } ],
    'crm-systems':         [ { title: 'Salesforce: What Is CRM?', url: 'https://www.salesforce.com/crm/what-is-crm/' } ],
    'workplace-languages': [ { title: 'BBC Languages: Chinese', url: 'https://www.bbc.co.uk/languages/chinese/' } ],
}

/**
 * Topics a custom skill (made from a job posting) can be about, with their links (checked reachable 2026-10-31): the
 * first topic its English name or description mentions wins, the more specific topics first
 */
export const TOPIC_RESOURCES = [
    [ /\bnlp\b|natural language|text (?:analy|classif|mining)/i, [ { title: 'GeeksforGeeks: NLP Tutorial', url: 'https://www.geeksforgeeks.org/nlp/natural-language-processing-nlp-tutorial/' }, { title: 'Hugging Face: LLM Course', url: 'https://huggingface.co/learn/llm-course/chapter1/1', open: true } ] ],
    [ /\bllms?\b|large language model|generative ai|\bgenai\b/i, [ { title: 'Hugging Face: LLM Course', url: 'https://huggingface.co/learn/llm-course/chapter1/1', open: true }, { title: 'GeeksforGeeks: Large Language Model (LLM)', url: 'https://www.geeksforgeeks.org/artificial-intelligence/large-language-model-llm/' } ] ],
    [ /computer vision|image (?:recognition|processing)/i, [ { title: 'GeeksforGeeks: Computer Vision Tutorial', url: 'https://www.geeksforgeeks.org/computer-vision/computer-vision/' } ] ],
    [ /deep learning|neural network/i, [ { title: 'GeeksforGeeks: Deep Learning Tutorial', url: 'https://www.geeksforgeeks.org/deep-learning/deep-learning-tutorial/' }, { title: 'Dive into Deep Learning', url: 'https://d2l.ai/', open: true } ] ],
    [ /machine learning|\bml\b/i, [ { title: 'GeeksforGeeks: Machine Learning Tutorial', url: 'https://www.geeksforgeeks.org/machine-learning/machine-learning-tutorial/' }, { title: 'scikit-learn: Getting Started', url: 'https://scikit-learn.org/stable/getting_started.html', open: true } ] ],
    [ /data structure|algorithm/i, [ { title: 'GeeksforGeeks: DSA Tutorial', url: 'https://www.geeksforgeeks.org/dsa/dsa-tutorial-learn-data-structures-and-algorithms/' }, { title: 'W3Schools: DSA', url: 'https://www.w3schools.com/dsa/' } ] ],
    [ /system design|software architecture/i, [ { title: 'GeeksforGeeks: System Design Tutorial', url: 'https://www.geeksforgeeks.org/system-design/system-design-tutorial/' } ] ],
    [ /cloud|\baws\b|azure|\bgcp\b/i, [ { title: 'GeeksforGeeks: Cloud Computing Tutorial', url: 'https://www.geeksforgeeks.org/cloud-computing/cloud-computing-tutorial/' } ] ],
    [ /linux|unix|shell script/i, [ { title: 'GeeksforGeeks: Linux Tutorial', url: 'https://www.geeksforgeeks.org/linux-unix/linux-tutorial/' } ] ],
    [ /\bjava\b/i, [ { title: 'W3Schools: Java', url: 'https://www.w3schools.com/java/' }, { title: 'GeeksforGeeks: Java Tutorial', url: 'https://www.geeksforgeeks.org/java/java/' } ] ],
    [ /security|cyber/i, [ { title: 'GeeksforGeeks: Cyber Security Tutorial', url: 'https://www.geeksforgeeks.org/cybersecurity/cyber-security-tutorial/' } ] ],
]

const STOP_WORDS = new Set([ 'and', 'the', 'with', 'for', 'from', 'into', 'your', 'use', 'using', 'basic', 'understanding', 'knowledge', 'skill', 'skills', 'work', 'working', 'clear', 'good', 'other', 'their', 'that', 'this' ])
const words = (text) => new Set(String(text).toLowerCase().match(/[a-z][a-z+#]{2,}/g)?.filter((word) => !STOP_WORDS.has(word)) ?? [])

/**
 * Links for a custom skill ({ en } name and description): its topic's, else those of the catalog skill sharing the most
 * words with it (at least 2), else a Wikipedia search for its name. Never an invented page
 */
export function relatedResources(name, description)
{
    const text = `${name?.en ?? ''} ${description?.en ?? ''}`
    const topic = TOPIC_RESOURCES.find(([ pattern ]) => pattern.test(text))
    if(topic)
        return topic[1].map((resource) => ({ open: false, ...resource }))
    const own = words(text)
    const [ best ] = DETAILS.map(([ id, , , , en ]) => [ id, [ ...words(`${id.replaceAll('-', ' ')} ${en}`) ].filter((word) => own.has(word)).length ])
        .filter(([ id, score ]) => score >= 2 && resourcesOf(id).length).sort((a, b) => b[1] - a[1])
    if(best)
        return resourcesOf(best[0])
    const query = String(name?.en ?? '').trim()
    return query ? [ { title: `Wikipedia: ${query}`, url: `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`, open: true } ] : []
}

/** Every link of a skill, the starting point first: [ { title, url, open } ] (none for an AI prompt only skill) */
const resourcesOf = (id) => [ RESOURCES[id], ...(MORE_RESOURCES[id] ?? []) ].filter((resource) => resource?.url).map((resource) => ({ open: false, ...resource }))

export const SKILL_DETAILS = Object.fromEntries(DETAILS.map(([id, icon, difficulty, zh, en, ms]) =>
    [id, { icon, difficulty, description: { zh, en, ms }, resource: RESOURCES[id] ?? null, resources: resourcesOf(id) }]))
