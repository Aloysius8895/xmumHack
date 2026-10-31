/**
 * UN Sustainable Development Goals: every career and every catalog skill is tagged with at least one SDG target,
 * each career tag says why the job moves that target. Fixed, authored data (never AI-invented), source below.
 * AI-generated careers pick their targets from TARGETS only (features.generateCareer), never new ones.
 *
 * Contribution of the player = their preparation (game.skillProgress) on the skills tagged with each goal.
 */
export const SOURCE = {
    name: 'United Nations, Global indicator framework for the SDGs (A/RES/71/313)',
    url: 'https://unstats.un.org/sdgs/indicators/indicators-list/',
}

const name = (zh, en, ms) => ({ zh, en, ms })

// The 17 goals: official short names and colours
export const GOALS = {
    1:  { color: '#E5243B', name: name('无贫穷', 'No Poverty', 'Tiada Kemiskinan') },
    2:  { color: '#DDA63A', name: name('零饥饿', 'Zero Hunger', 'Sifar Kelaparan') },
    3:  { color: '#4C9F38', name: name('良好健康与福祉', 'Good Health and Well-being', 'Kesihatan Baik dan Kesejahteraan') },
    4:  { color: '#C5192D', name: name('优质教育', 'Quality Education', 'Pendidikan Berkualiti') },
    5:  { color: '#FF3A21', name: name('性别平等', 'Gender Equality', 'Kesaksamaan Gender') },
    6:  { color: '#26BDE2', name: name('清洁饮水和卫生设施', 'Clean Water and Sanitation', 'Air Bersih dan Sanitasi') },
    7:  { color: '#FCC30B', name: name('经济适用的清洁能源', 'Affordable and Clean Energy', 'Tenaga Mampu Milik dan Bersih') },
    8:  { color: '#A21942', name: name('体面工作和经济增长', 'Decent Work and Economic Growth', 'Pekerjaan Wajar dan Pertumbuhan Ekonomi') },
    9:  { color: '#FD6925', name: name('产业、创新和基础设施', 'Industry, Innovation and Infrastructure', 'Industri, Inovasi dan Infrastruktur') },
    10: { color: '#DD1367', name: name('减少不平等', 'Reduced Inequalities', 'Mengurangkan Ketidaksamaan') },
    11: { color: '#FD9D24', name: name('可持续城市和社区', 'Sustainable Cities and Communities', 'Bandar dan Komuniti Mampan') },
    12: { color: '#BF8B2E', name: name('负责任消费和生产', 'Responsible Consumption and Production', 'Penggunaan dan Pengeluaran Bertanggungjawab') },
    13: { color: '#3F7E44', name: name('气候行动', 'Climate Action', 'Tindakan Iklim') },
    14: { color: '#0A97D9', name: name('水下生物', 'Life Below Water', 'Kehidupan di Bawah Air') },
    15: { color: '#56C02B', name: name('陆地生物', 'Life on Land', 'Kehidupan di Darat') },
    16: { color: '#00689D', name: name('和平、正义与强大机构', 'Peace, Justice and Strong Institutions', 'Keamanan, Keadilan dan Institusi Kukuh') },
    17: { color: '#19486A', name: name('促进目标实现的伙伴关系', 'Partnerships for the Goals', 'Perkongsian untuk Matlamat') },
}

// The targets the catalog uses, shortened from the official wording
export const TARGETS = {
    '2.1':  name('让所有人全年都能获得安全、营养和充足的食物', 'Access for all to safe, nutritious and sufficient food', 'Akses semua kepada makanan yang selamat, berkhasiat dan mencukupi'),
    '3.4':  name('减少非传染性疾病导致的过早死亡', 'Reduce premature deaths from non-communicable diseases', 'Kurangkan kematian pramatang akibat penyakit tidak berjangkit'),
    '3.8':  name('实现全民健康覆盖', 'Universal health coverage', 'Liputan kesihatan sejagat'),
    '3.c':  name('增加卫生人力的招聘、培训和保留', 'Grow and train the health workforce', 'Tingkatkan dan latih tenaga kerja kesihatan'),
    '4.1':  name('确保所有儿童完成优质的中小学教育', 'Quality primary and secondary education for all children', 'Pendidikan rendah dan menengah berkualiti untuk semua kanak-kanak'),
    '4.3':  name('人人平等获得负担得起的职业技术和高等教育', 'Equal access to affordable technical, vocational and tertiary education', 'Akses saksama kepada pendidikan teknikal, vokasional dan tinggi yang mampu milik'),
    '4.4':  name('增加掌握就业所需相关技能的青年和成年人', 'More youth and adults with relevant skills for decent jobs', 'Lebih ramai belia dan dewasa dengan kemahiran relevan untuk pekerjaan wajar'),
    '4.c':  name('增加合格教师的数量', 'Increase the supply of qualified teachers', 'Tambah bilangan guru yang berkelayakan'),
    '6.1':  name('人人获得安全且负担得起的饮用水', 'Safe and affordable drinking water for all', 'Air minuman yang selamat dan mampu milik untuk semua'),
    '8.2':  name('通过技术升级和创新提高经济生产力', 'Higher productivity through technology and innovation', 'Produktiviti lebih tinggi melalui teknologi dan inovasi'),
    '8.3':  name('支持创造体面工作、创业和创新', 'Support decent job creation, entrepreneurship and innovation', 'Sokong penciptaan pekerjaan wajar, keusahawanan dan inovasi'),
    '8.5':  name('人人实现充分和生产性就业及体面工作', 'Full and productive employment and decent work for all', 'Pekerjaan penuh dan produktif serta pekerjaan wajar untuk semua'),
    '8.9':  name('推广创造就业、宣传地方文化和产品的可持续旅游业', 'Sustainable tourism that creates jobs and promotes local culture and products', 'Pelancongan mampan yang mencipta pekerjaan dan mempromosi budaya serta produk tempatan'),
    '9.1':  name('发展优质、可靠、可持续和有抵御能力的基础设施', 'Quality, reliable, sustainable and resilient infrastructure', 'Infrastruktur berkualiti, boleh dipercayai, mampan dan berdaya tahan'),
    '9.5':  name('加强科学研究，提升技术能力', 'Enhance research and upgrade technological capabilities', 'Perkukuh penyelidikan dan tingkatkan keupayaan teknologi'),
    '9.c':  name('大幅提升信息和通信技术的普及度', 'Increase access to information and communications technology', 'Tingkatkan akses kepada teknologi maklumat dan komunikasi'),
    '10.2': name('增强所有人的权能，促进社会、经济和政治融合', 'Empower and include everyone socially, economically and politically', 'Perkasa dan rangkumi semua orang dari segi sosial, ekonomi dan politik'),
    '10.3': name('确保机会均等，消除歧视性的法律和做法', 'Equal opportunity, end discriminatory laws and practices', 'Peluang sama rata, hapuskan undang-undang dan amalan diskriminasi'),
    '11.2': name('为所有人提供安全、负担得起、可持续的交通系统', 'Safe, affordable and sustainable transport for all', 'Pengangkutan yang selamat, mampu milik dan mampan untuk semua'),
    '12.3': name('将全球人均粮食浪费减半', 'Halve global food waste per person', 'Kurangkan separuh pembaziran makanan setiap orang'),
    '12.6': name('鼓励公司采用可持续做法，并把可持续信息纳入报告', 'Companies adopt sustainable practices and report on them', 'Syarikat mengamalkan amalan mampan dan melaporkannya'),
    '16.3': name('促进法治，确保所有人都能平等诉诸司法', 'Rule of law and equal access to justice for all', 'Kedaulatan undang-undang dan akses saksama kepada keadilan'),
    '16.5': name('大幅减少一切形式的腐败和贿赂', 'Substantially reduce corruption and bribery', 'Kurangkan rasuah dan sogokan dengan ketara'),
    '16.6': name('建立有效、负责和透明的各级机构', 'Effective, accountable and transparent institutions', 'Institusi yang berkesan, bertanggungjawab dan telus'),
    '17.18': name('提高优质、及时、可靠数据的可获得性', 'More high-quality, timely and reliable data', 'Lebih banyak data berkualiti tinggi, tepat pada masanya dan boleh dipercayai'),
}
export const TARGET_IDS = Object.keys(TARGETS)

export const goalOf = (target) => Number(target.split('.')[0])

/**
 * Every roadmap moves these targets whatever the career: learning skills for a decent job (the problem statement's targets)
 */
export const PLATFORM_TARGETS = [ '4.4', '8.5' ]

/**
 * Career → targets, with why the job moves each one
 */
export const CAREER_SDGS = {
    'forward-deployed-engineer': [
        { target: '9.5', why: name('把 AI 和软件研究转化为客户现场可用的生产系统，促进技术落地。', 'Turns AI and software research into production systems used by customers.', 'Menukar penyelidikan AI dan perisian kepada sistem pengeluaran yang digunakan pelanggan.') },
        { target: '8.2', why: name('与用户共同改进业务流程，以可靠的系统集成提升生产力。', 'Works with users to improve workflows and productivity through reliable system integration.', 'Bekerjasama dengan pengguna untuk menambah baik aliran kerja dan produktiviti melalui integrasi sistem yang boleh dipercayai.') },
    ],
    'data-analyst': [
        { target: '17.18', why: name('把杂乱的数据整理成可靠、及时的信息，供企业和公共部门决策。', 'Turns messy data into reliable, timely information for business and public decisions.', 'Menukar data bersepah kepada maklumat yang boleh dipercayai dan tepat pada masanya untuk keputusan.') },
        { target: '8.2', why: name('用数据找出流程的浪费，帮助企业提高生产力。', 'Finds waste in processes with data and helps companies raise productivity.', 'Mencari pembaziran proses dengan data dan membantu syarikat meningkatkan produktiviti.') },
    ],
    'frontend-developer': [
        { target: '10.2', why: name('做出无障碍、响应式的网页，让残障人士和低端手机用户也能使用服务。', 'Builds accessible, responsive pages so people with disabilities and low-end phones can use services too.', 'Membina laman yang mudah diakses supaya OKU dan pengguna telefon murah juga boleh menggunakan perkhidmatan.') },
        { target: '9.c', why: name('把服务搬到浏览器上，让更多人通过网络获得信息和服务。', 'Brings services to the browser so more people reach information and services online.', 'Membawa perkhidmatan ke pelayar supaya lebih ramai mendapat maklumat dan perkhidmatan dalam talian.') },
    ],
    'backend-developer': [
        { target: '9.1', why: name('搭建稳定、可扩展的数字基础设施，让银行、医疗等服务不中断。', 'Builds stable, scalable digital infrastructure that keeps services like banking and health running.', 'Membina infrastruktur digital yang stabil supaya perkhidmatan seperti perbankan dan kesihatan terus berjalan.') },
        { target: '9.c', why: name('提供 API 和云服务，降低数字服务的成本，让更多人用得上。', 'Provides APIs and cloud services that make digital services cheaper and easier to reach.', 'Menyediakan API dan perkhidmatan awan yang menjadikan perkhidmatan digital lebih murah dan mudah dicapai.') },
    ],
    'ui-ux-designer': [
        { target: '10.2', why: name('通过用户研究和无障碍设计，让老人、残障人士和新手都能顺利使用产品。', 'User research and inclusive design let older people, people with disabilities and first-time users use products.', 'Penyelidikan pengguna dan reka bentuk inklusif membolehkan warga emas, OKU dan pengguna baharu menggunakan produk.') },
        { target: '9.5', why: name('把新技术变成人们真正用得懂的产品，加快创新落地。', 'Turns new technology into products people understand, so innovation actually gets used.', 'Menukar teknologi baharu kepada produk yang difahami orang supaya inovasi benar-benar digunakan.') },
    ],
    'ml-engineer': [
        { target: '9.5', why: name('研究和部署 AI 模型，提升本地的技术能力。', 'Researches and deploys AI models, raising local technological capability.', 'Menyelidik dan menggunakan model AI, meningkatkan keupayaan teknologi tempatan.') },
        { target: '8.2', why: name('用 AI 自动化重复工作，让人专注在更有价值的任务上。', 'Automates repetitive work with AI so people can focus on higher-value tasks.', 'Mengautomasikan kerja berulang dengan AI supaya orang boleh fokus pada tugas bernilai tinggi.') },
    ],
    'product-manager': [
        { target: '8.3', why: name('带团队把想法做成产品，支持创业、创新和新的就业机会。', 'Leads teams from idea to product, supporting start-ups, innovation and new jobs.', 'Memimpin pasukan dari idea ke produk, menyokong permulaan, inovasi dan pekerjaan baharu.') },
        { target: '9.5', why: name('决定把研发资源投在真正解决问题的方向上。', 'Points research and development at the problems that matter.', 'Mengarahkan penyelidikan dan pembangunan kepada masalah yang penting.') },
    ],
    'data-scientist': [
        { target: '9.5', why: name('用统计和机器学习做研究，推动科学和技术进步。', 'Uses statistics and machine learning for research that moves science and technology forward.', 'Menggunakan statistik dan pembelajaran mesin untuk penyelidikan yang memajukan sains dan teknologi.') },
        { target: '17.18', why: name('建立可靠的数据和预测，帮助政府和机构追踪发展目标。', 'Builds reliable data and forecasts that help governments and organisations track development goals.', 'Membina data dan ramalan yang boleh dipercayai untuk membantu kerajaan menjejak matlamat pembangunan.') },
    ],
    'auditor': [
        { target: '16.5', why: name('检查账目和流程，发现并防止舞弊和贿赂。', 'Checks accounts and processes to detect and prevent fraud and bribery.', 'Menyemak akaun dan proses untuk mengesan dan mencegah penipuan serta sogokan.') },
        { target: '16.6', why: name('确认财务报告真实，让机构更透明、更负责。', 'Confirms financial reports are true, making organisations more transparent and accountable.', 'Mengesahkan laporan kewangan benar, menjadikan organisasi lebih telus dan bertanggungjawab.') },
        { target: '12.6', why: name('审核企业的可持续发展报告，确认披露的内容可信。', 'Assures companies’ sustainability reports so what they disclose can be trusted.', 'Mengaudit laporan kemampanan syarikat supaya pendedahan boleh dipercayai.') },
    ],
    'lawyer': [
        { target: '16.3', why: name('为客户争取权益，让普通人也能获得公正的司法程序。', 'Defends clients’ rights so ordinary people get fair access to justice.', 'Mempertahankan hak pelanggan supaya orang biasa mendapat akses adil kepada keadilan.') },
        { target: '10.3', why: name('挑战歧视性的做法，推动机会均等。', 'Challenges discriminatory practices and pushes for equal opportunity.', 'Mencabar amalan diskriminasi dan memperjuangkan peluang sama rata.') },
    ],
    'teacher': [
        { target: '4.1', why: name('让学生在课堂上真正学到东西，提高教育质量。', 'Makes sure students actually learn in class, raising the quality of education.', 'Memastikan murid benar-benar belajar di kelas, meningkatkan kualiti pendidikan.') },
        { target: '4.c', why: name('马来西亚和全球都需要更多合格的教师。', 'Malaysia and the world need more qualified teachers.', 'Malaysia dan dunia memerlukan lebih ramai guru berkelayakan.') },
    ],
    'doctor': [
        { target: '3.8', why: name('诊断和治疗病人，让更多人获得基本医疗服务。', 'Diagnoses and treats patients so more people get essential health care.', 'Mendiagnosis dan merawat pesakit supaya lebih ramai mendapat penjagaan kesihatan asas.') },
        { target: '3.4', why: name('预防和管理糖尿病、心脏病等慢性病。', 'Prevents and manages chronic diseases such as diabetes and heart disease.', 'Mencegah dan mengurus penyakit kronik seperti diabetes dan penyakit jantung.') },
        { target: '3.c', why: name('加入并带领卫生人力，缓解医生短缺。', 'Joins and trains the health workforce, easing doctor shortages.', 'Menyertai dan melatih tenaga kerja kesihatan, mengurangkan kekurangan doktor.') },
    ],
    'chef': [
        { target: '12.3', why: name('合理设计菜单和库存，减少厨房的食物浪费。', 'Plans menus and stock to cut food waste in the kitchen.', 'Merancang menu dan stok untuk mengurangkan pembaziran makanan di dapur.') },
        { target: '2.1', why: name('做出安全、卫生、有营养的食物。', 'Serves safe, hygienic and nutritious food.', 'Menyediakan makanan yang selamat, bersih dan berkhasiat.') },
        { target: '8.9', why: name('用本地食材和菜式推广地方文化和旅游。', 'Promotes local culture and tourism through local ingredients and dishes.', 'Mempromosi budaya dan pelancongan tempatan melalui bahan dan hidangan tempatan.') },
    ],
    'civil-engineer': [
        { target: '9.1', why: name('设计和监督道路、桥梁等坚固耐用的基础设施。', 'Designs and supervises durable infrastructure such as roads and bridges.', 'Mereka bentuk dan menyelia infrastruktur tahan lama seperti jalan raya dan jambatan.') },
        { target: '11.2', why: name('建设安全、可持续的公共交通系统。', 'Builds safe, sustainable public transport systems.', 'Membina sistem pengangkutan awam yang selamat dan mampan.') },
        { target: '6.1', why: name('建造供水和排水系统，让社区获得安全的饮用水。', 'Builds water supply and drainage so communities get safe drinking water.', 'Membina sistem bekalan air dan saliran supaya komuniti mendapat air minuman selamat.') },
    ],
    'accountant': [
        { target: '16.6', why: name('准确透明的账目让企业和机构更负责任。', 'Accurate, transparent accounts make companies and institutions accountable.', 'Akaun yang tepat dan telus menjadikan syarikat dan institusi bertanggungjawab.') },
        { target: '12.6', why: name('协助公司把可持续信息纳入财务报告。', 'Helps companies bring sustainability information into their financial reports.', 'Membantu syarikat memasukkan maklumat kemampanan ke dalam laporan kewangan.') },
    ],
    'software-engineer': [
        { target: '9.c', why: name('开发让更多人用得上的数字服务。', 'Builds digital services more people can use.', 'Membina perkhidmatan digital yang boleh digunakan lebih ramai orang.') },
        { target: '9.5', why: name('把新技术做成可靠的软件，提升企业的技术能力。', 'Turns new technology into reliable software that raises companies\' technical capability.', 'Menjadikan teknologi baharu perisian yang boleh dipercayai untuk meningkatkan keupayaan teknikal syarikat.') },
    ],
    'electrical-engineer': [
        { target: '9.1', why: name('建设和维护可靠的电力与工业基础设施。', 'Builds and maintains reliable power and industrial infrastructure.', 'Membina dan menyelenggara infrastruktur kuasa dan industri yang boleh dipercayai.') },
        { target: '8.2', why: name('用自动化和设备维护提升生产力。', 'Raises productivity through automation and equipment upkeep.', 'Meningkatkan produktiviti melalui automasi dan penyelenggaraan peralatan.') },
    ],
    'digital-marketer': [
        { target: '8.3', why: name('帮助中小企业和创业者在网上找到客户。', 'Helps small businesses and entrepreneurs reach customers online.', 'Membantu perniagaan kecil dan usahawan mencapai pelanggan dalam talian.') },
        { target: '8.2', why: name('用数据改进营销，提高企业的生产力。', 'Improves marketing with data to raise business productivity.', 'Menambah baik pemasaran dengan data untuk meningkatkan produktiviti perniagaan.') },
    ],
    'quantity-surveyor': [
        { target: '9.1', why: name('控制成本，让基础设施项目可靠地完成。', 'Keeps costs under control so infrastructure projects are delivered reliably.', 'Mengawal kos supaya projek infrastruktur disiapkan dengan boleh dipercayai.') },
        { target: '16.5', why: name('公开透明的招标和结算减少贪污的机会。', 'Open, transparent tendering and final accounts leave less room for corruption.', 'Tender dan akaun akhir yang terbuka dan telus mengurangkan ruang untuk rasuah.') },
    ],
    'hr-executive': [
        { target: '8.5', why: name('让员工得到公平的薪资和体面的工作条件。', 'Gives employees fair pay and decent working conditions.', 'Memberi pekerja gaji yang adil dan keadaan kerja yang wajar.') },
        { target: '10.3', why: name('以公平的招聘确保机会均等。', 'Ensures equal opportunity through fair hiring.', 'Memastikan peluang sama rata melalui pengambilan yang adil.') },
    ],
    'sales-executive': [
        { target: '8.3', why: name('为企业带来新客户，支持业务成长和就业。', 'Brings in new customers that let businesses grow and hire.', 'Membawa pelanggan baharu yang membolehkan perniagaan berkembang dan mengambil pekerja.') },
        { target: '8.2', why: name('用 CRM 和数据提升销售效率。', 'Raises sales productivity with CRM tools and data.', 'Meningkatkan produktiviti jualan dengan alat CRM dan data.') },
    ],
    'customer-service': [
        { target: '8.2', why: name('快速解决客户问题，提升服务业的生产力。', 'Solves customer issues quickly, raising productivity in services.', 'Menyelesaikan isu pelanggan dengan cepat, meningkatkan produktiviti perkhidmatan.') },
        { target: '8.5', why: name('客服是许多年轻人进入职场的第一份工作。', 'Customer service is the first job for many young people entering work.', 'Khidmat pelanggan ialah pekerjaan pertama bagi ramai anak muda yang memasuki alam kerja.') },
    ],
}

/**
 * Catalog skill → the targets it moves (the first one is its main target)
 */
export const SKILL_TARGETS = {
    'sql': [ '17.18' ],
    'excel': [ '8.2' ],
    'statistics': [ '17.18', '9.5' ],
    'python': [ '9.5' ],
    'data-cleaning': [ '17.18' ],
    'data-visualization': [ '17.18' ],
    'communication': [ '8.5' ],
    'html-css': [ '9.c' ],
    'javascript': [ '9.c' ],
    'react': [ '9.c' ],
    'git': [ '9.5' ],
    'accessibility': [ '10.2' ],
    'api-integration': [ '9.c' ],
    'backend-language': [ '9.1' ],
    'databases': [ '9.1' ],
    'rest-api': [ '9.c' ],
    'cloud-deploy': [ '9.1' ],
    'testing': [ '9.1' ],
    'user-research': [ '10.2' ],
    'prototyping': [ '9.5' ],
    'figma': [ '9.5' ],
    'visual-design': [ '10.2' ],
    'usability-testing': [ '10.2' ],
    'ml-math': [ '9.5' ],
    'ml-frameworks': [ '9.5', '8.2' ],
    'mlops': [ '9.5', '8.2' ],
    'roadmapping': [ '8.3' ],
    'agile': [ '8.2' ],
    'market-analysis': [ '8.3' ],
    'accounting': [ '16.6' ],
    'auditing': [ '16.5', '16.6' ],
    'internal-control': [ '16.5', '12.6' ],
    'legal-research': [ '16.3' ],
    'legal-writing': [ '16.3' ],
    'negotiation': [ '16.3', '10.3' ],
    'lesson-planning': [ '4.1' ],
    'classroom-management': [ '4.1', '4.c' ],
    'assessment': [ '4.1' ],
    'clinical-knowledge': [ '3.8', '3.4' ],
    'patient-care': [ '3.8', '3.c' ],
    'medical-ethics': [ '3.8', '16.6' ],
    'cooking-technique': [ '8.9' ],
    'food-safety': [ '2.1' ],
    'menu-planning': [ '12.3' ],
    'engineering-math': [ '9.1' ],
    'cad': [ '9.1', '11.2' ],
    'project-management': [ '8.2' ],
    'accounting-software': [ '8.2' ],
    'accounts-payable-receivable': [ '16.6' ],
    'taxation': [ '16.6' ],
    'electrical-systems': [ '9.1' ],
    'equipment-maintenance': [ '9.1' ],
    'plc-automation': [ '9.5' ],
    'social-media-marketing': [ '8.3' ],
    'digital-advertising': [ '8.3' ],
    'web-analytics': [ '17.18' ],
    'content-writing': [ '8.3' ],
    'quantity-surveying': [ '9.1' ],
    'cost-estimation': [ '9.1' ],
    'contract-administration': [ '16.5' ],
    'employee-relations': [ '8.5' ],
    'recruitment': [ '10.3' ],
    'payroll': [ '8.5' ],
    'sales-prospecting': [ '8.3' ],
    'customer-support': [ '8.2' ],
    'crm-systems': [ '8.2' ],
    'workplace-languages': [ '4.4' ],
}

/**
 * Why each catalog skill moves each of its targets: one line per link (Domain 1 Finalist Guide, SDG mapping method)
 */
export const SKILL_SDG_REASONS = {
    'sql': { '17.18': name("用 SQL 从数据库取出准确数据，支持可靠的统计和决策。", "Pulls accurate data from databases for reliable statistics and decisions.", "Mengambil data tepat dari pangkalan data untuk statistik dan keputusan yang boleh dipercayai.") },
    'excel': { '8.2': name("用表格自动完成计算和报表，提高日常工作效率。", "Automates calculations and reports in spreadsheets, raising everyday productivity.", "Mengautomasikan pengiraan dan laporan dalam hamparan, meningkatkan produktiviti harian.") },
    'statistics': { '17.18': name("正确分析数据，让统计结果可信。", "Analyses data correctly so statistics can be trusted.", "Menganalisis data dengan betul supaya statistik boleh dipercayai."), '9.5': name("统计方法是科学研究和实验的基础。", "Statistical methods underpin scientific research and experiments.", "Kaedah statistik menjadi asas penyelidikan saintifik dan eksperimen.") },
    'python': { '9.5': name("Python 是做研究、数据分析和开发新技术的常用工具。", "Python is a core tool for research, data analysis and new technology.", "Python ialah alat utama untuk penyelidikan, analisis data dan teknologi baharu.") },
    'data-cleaning': { '17.18': name("清理错误和缺失的数据，让数据更准确可靠。", "Fixes errors and gaps so data is accurate and reliable.", "Membetulkan ralat dan kekosongan supaya data tepat dan boleh dipercayai.") },
    'data-visualization': { '17.18': name("用图表把数据讲清楚，让更多人看懂并用好数据。", "Makes data clear in charts so more people can understand and use it.", "Menjadikan data jelas dalam carta supaya lebih ramai faham dan menggunakannya.") },
    'communication': { '8.5': name("清楚沟通是几乎所有体面工作都需要的基本能力。", "Clear communication is a core skill for almost every decent job.", "Komunikasi yang jelas ialah kemahiran teras untuk hampir semua pekerjaan wajar.") },
    'html-css': { '9.c': name("做出在各种设备上都能打开的网页，让更多人上网获取信息。", "Builds web pages that work on any device, widening access to online information.", "Membina laman web yang berfungsi pada semua peranti, meluaskan akses maklumat dalam talian.") },
    'javascript': { '9.c': name("让网站和网络服务可以互动，扩大数字服务的覆盖。", "Makes websites and online services interactive, extending digital services.", "Menjadikan laman web dan perkhidmatan dalam talian interaktif, meluaskan perkhidmatan digital.") },
    'react': { '9.c': name("快速搭建好用的网页应用，让更多服务上线。", "Builds usable web apps quickly, bringing more services online.", "Membina aplikasi web yang mudah digunakan dengan pantas, membawa lebih banyak perkhidmatan ke dalam talian.") },
    'git': { '9.5': name("版本管理让团队可靠地协作开发和改进技术。", "Version control lets teams build and improve technology together reliably.", "Kawalan versi membolehkan pasukan membina dan menambah baik teknologi bersama dengan andal.") },
    'accessibility': { '10.2': name("让残障人士也能使用网站和应用，促进数字包容。", "Lets people with disabilities use websites and apps, making digital services inclusive.", "Membolehkan orang kurang upaya menggunakan laman web dan aplikasi, menjadikan perkhidmatan digital inklusif.") },
    'api-integration': { '9.c': name("把不同系统连接起来，让数据和服务更容易被使用。", "Connects systems so data and services are easier to reach.", "Menghubungkan sistem supaya data dan perkhidmatan lebih mudah dicapai.") },
    'backend-language': { '9.1': name("搭建稳定的服务器程序，是数字基础设施的核心。", "Builds stable server software, the core of digital infrastructure.", "Membina perisian pelayan yang stabil, teras infrastruktur digital.") },
    'databases': { '9.1': name("可靠地保存数据，支撑各种数字服务。", "Stores data reliably to support digital services.", "Menyimpan data dengan andal untuk menyokong perkhidmatan digital.") },
    'rest-api': { '9.c': name("设计清晰的接口，让其他应用也能接入服务。", "Designs clear interfaces so other apps can connect to a service.", "Mereka antara muka yang jelas supaya aplikasi lain boleh berhubung dengan perkhidmatan.") },
    'cloud-deploy': { '9.1': name("把服务稳定地部署上线，让基础设施可靠、可扩展。", "Deploys services reliably so infrastructure is dependable and scalable.", "Melancarkan perkhidmatan dengan andal supaya infrastruktur boleh diharap dan boleh berkembang.") },
    'testing': { '9.1': name("测试减少故障，让系统更可靠。", "Testing reduces failures and makes systems more reliable.", "Ujian mengurangkan kegagalan dan menjadikan sistem lebih andal.") },
    'user-research': { '10.2': name("了解不同用户的需要，让产品照顾到更多人。", "Understands different users' needs so products serve more people.", "Memahami keperluan pengguna yang berbeza supaya produk melayani lebih ramai orang.") },
    'prototyping': { '9.5': name("快速做原型验证想法，推动产品创新。", "Tests ideas quickly with prototypes, driving product innovation.", "Menguji idea dengan pantas melalui prototaip, memacu inovasi produk.") },
    'figma': { '9.5': name("用设计工具快速试验新的产品方案。", "Explores new product ideas quickly with a design tool.", "Meneroka idea produk baharu dengan pantas menggunakan alat reka bentuk.") },
    'visual-design': { '10.2': name("清楚易读的设计让更多人能看懂和使用。", "Clear, readable design lets more people understand and use a product.", "Reka bentuk yang jelas dan mudah dibaca membolehkan lebih ramai orang memahami dan menggunakan produk.") },
    'usability-testing': { '10.2': name("请真实用户试用，找出妨碍别人使用的问题。", "Tests with real users to find what stops people from using a product.", "Menguji dengan pengguna sebenar untuk mencari halangan penggunaan produk.") },
    'ml-math': { '9.5': name("机器学习的数学是研究和改进 AI 的基础。", "The maths of machine learning underpins AI research and improvement.", "Matematik pembelajaran mesin menjadi asas penyelidikan dan penambahbaikan AI.") },
    'ml-frameworks': { '9.5': name("用框架训练和评估模型，推动 AI 技术研发。", "Trains and evaluates models with frameworks, advancing AI research.", "Melatih dan menilai model dengan rangka kerja, memajukan penyelidikan AI."), '8.2': name("模型能自动化重复工作，提高生产力。", "Models automate repetitive work and raise productivity.", "Model mengautomasikan kerja berulang dan meningkatkan produktiviti.") },
    'mlops': { '9.5': name("让 AI 模型从研究走到可靠的实际应用。", "Takes AI models from research into reliable real use.", "Membawa model AI dari penyelidikan ke penggunaan sebenar yang andal."), '8.2': name("自动部署和监控模型，节省人力、提高效率。", "Automates deploying and monitoring models, saving effort and raising efficiency.", "Mengautomasikan pelancaran dan pemantauan model, menjimatkan tenaga dan meningkatkan kecekapan.") },
    'roadmapping': { '8.3': name("规划产品方向，帮助新产品和创业项目落地。", "Plans product direction, helping new products and ventures launch.", "Merancang hala tuju produk, membantu produk dan usaha niaga baharu dilancarkan.") },
    'agile': { '8.2': name("敏捷方法让团队更快交付、减少浪费。", "Agile methods help teams deliver faster with less waste.", "Kaedah tangkas membantu pasukan menyampaikan lebih pantas dengan kurang pembaziran.") },
    'market-analysis': { '8.3': name("看懂市场需求，帮助企业和创业者做出好决定。", "Reads market demand to help businesses and founders decide well.", "Memahami permintaan pasaran untuk membantu perniagaan dan usahawan membuat keputusan yang baik.") },
    'accounting': { '16.6': name("准确的账目让机构的财务透明、可问责。", "Accurate accounts make finances transparent and accountable.", "Akaun yang tepat menjadikan kewangan telus dan bertanggungjawab.") },
    'auditing': { '16.5': name("审计能发现舞弊和贿赂，减少腐败。", "Audits uncover fraud and bribery, reducing corruption.", "Audit mendedahkan penipuan dan sogokan, mengurangkan rasuah."), '16.6': name("独立检查让机构更透明、更负责。", "Independent checks make institutions more transparent and accountable.", "Semakan bebas menjadikan institusi lebih telus dan bertanggungjawab.") },
    'internal-control': { '16.5': name("内部控制从流程上防止舞弊和贿赂。", "Internal controls prevent fraud and bribery in everyday processes.", "Kawalan dalaman mencegah penipuan dan sogokan dalam proses harian."), '12.6': name("好的控制和报告帮助公司落实负责任的做法。", "Good controls and reporting help companies follow responsible practices.", "Kawalan dan pelaporan yang baik membantu syarikat mengamalkan amalan bertanggungjawab.") },
    'legal-research': { '16.3': name("找准法律依据，帮助人们得到公正的对待。", "Finds the right legal basis so people are treated fairly under the law.", "Mencari asas undang-undang yang betul supaya orang dilayan dengan adil.") },
    'legal-writing': { '16.3': name("清楚的法律文书让人们更容易理解和维护自己的权利。", "Clear legal writing helps people understand and defend their rights.", "Penulisan undang-undang yang jelas membantu orang memahami dan mempertahankan hak mereka.") },
    'negotiation': { '16.3': name("通过协商公平解决纠纷，不必都上法庭。", "Settles disputes fairly by negotiation, without always going to court.", "Menyelesaikan pertikaian secara adil melalui rundingan tanpa sentiasa ke mahkamah."), '10.3': name("公平谈判让各方获得平等的机会和条件。", "Fair negotiation gives every side equal opportunity and terms.", "Rundingan yang adil memberi peluang dan terma yang sama kepada semua pihak.") },
    'lesson-planning': { '4.1': name("好的教案让学生学得更扎实。", "Good lesson plans help students learn more solidly.", "Rancangan pengajaran yang baik membantu murid belajar dengan lebih kukuh.") },
    'classroom-management': { '4.1': name("有序的课堂让每个学生都能专心学习。", "A well-run classroom lets every student focus on learning.", "Bilik darjah yang teratur membolehkan setiap murid menumpukan perhatian pada pembelajaran."), '4.c': name("管好课堂是合格教师的核心能力。", "Managing a class is a core skill of a qualified teacher.", "Mengurus kelas ialah kemahiran teras guru yang berkelayakan.") },
    'assessment': { '4.1': name("合理的评估帮助老师知道学生哪里需要帮助。", "Sound assessment shows teachers where students need help.", "Penilaian yang baik menunjukkan kepada guru di mana murid memerlukan bantuan.") },
    'clinical-knowledge': { '3.8': name("扎实的临床知识让更多人得到可靠的医疗服务。", "Solid clinical knowledge brings reliable health care to more people.", "Pengetahuan klinikal yang kukuh membawa penjagaan kesihatan yang andal kepada lebih ramai orang."), '3.4': name("及早发现和处理慢性病，减少过早死亡。", "Spots and treats chronic disease early, reducing premature deaths.", "Mengesan dan merawat penyakit kronik lebih awal, mengurangkan kematian pramatang.") },
    'patient-care': { '3.8': name("用心护理让病人得到完整、安全的照顾。", "Careful nursing gives patients complete and safe care.", "Penjagaan yang teliti memberi pesakit penjagaan yang lengkap dan selamat."), '3.c': name("护理人员是卫生人力的重要组成部分。", "Carers are a key part of the health workforce.", "Penjaga ialah bahagian penting tenaga kerja kesihatan.") },
    'medical-ethics': { '3.8': name("尊重知情同意和公平分配，让医疗更值得信任。", "Respecting consent and fair allocation makes health care more trustworthy.", "Menghormati persetujuan dan agihan yang adil menjadikan penjagaan kesihatan lebih dipercayai."), '16.6': name("伦理规范让医疗机构对病人负责。", "Ethical standards keep health institutions accountable to patients.", "Piawaian etika memastikan institusi kesihatan bertanggungjawab kepada pesakit.") },
    'cooking-technique': { '8.9': name("好的烹饪推广本地美食，带动旅游和就业。", "Good cooking promotes local food, supporting tourism and jobs.", "Masakan yang baik mempromosikan makanan tempatan, menyokong pelancongan dan pekerjaan.") },
    'food-safety': { '2.1': name("安全处理食物，让人人吃得安全。", "Handling food safely keeps it safe for everyone.", "Mengendalikan makanan dengan selamat memastikannya selamat untuk semua.") },
    'menu-planning': { '12.3': name("合理规划菜单和份量，减少食物浪费。", "Planning menus and portions well reduces food waste.", "Merancang menu dan hidangan dengan baik mengurangkan pembaziran makanan.") },
    'engineering-math': { '9.1': name("工程计算保证建筑和设施安全可靠。", "Engineering calculations keep buildings and facilities safe and reliable.", "Pengiraan kejuruteraan memastikan bangunan dan kemudahan selamat dan andal.") },
    'cad': { '9.1': name("精确的设计图是建好基础设施的第一步。", "Precise drawings are the first step to building good infrastructure.", "Lukisan yang tepat ialah langkah pertama membina infrastruktur yang baik."), '11.2': name("设计道路和交通设施，让出行更安全。", "Designs roads and transport facilities for safer travel.", "Mereka jalan dan kemudahan pengangkutan untuk perjalanan yang lebih selamat.") },
    'project-management': { '8.2': name("管好时间、成本和人力，让项目更有效率。", "Manages time, cost and people so projects run efficiently.", "Mengurus masa, kos dan tenaga kerja supaya projek berjalan dengan cekap.") },
    'accounting-software': { '8.2': name("用会计软件自动记账，减少人工错误、提高效率。", "Automates bookkeeping with software, cutting errors and raising efficiency.", "Mengautomasikan simpan kira dengan perisian, mengurangkan ralat dan meningkatkan kecekapan.") },
    'accounts-payable-receivable': { '16.6': name("准确记录收付款，让财务清楚透明。", "Accurate payment records keep finances clear and transparent.", "Rekod bayaran yang tepat memastikan kewangan jelas dan telus.") },
    'taxation': { '16.6': name("依法申报税务，支持透明、负责的公共财政。", "Filing taxes correctly supports transparent, accountable public finances.", "Memfailkan cukai dengan betul menyokong kewangan awam yang telus dan bertanggungjawab.") },
    'electrical-systems': { '9.1': name("安全可靠的电力系统是基础设施的根本。", "Safe, reliable electrical systems are basic infrastructure.", "Sistem elektrik yang selamat dan andal ialah infrastruktur asas.") },
    'equipment-maintenance': { '9.1': name("定期维护让设备和设施持续可靠运行。", "Regular maintenance keeps equipment and facilities running reliably.", "Penyelenggaraan berkala memastikan peralatan dan kemudahan berfungsi dengan andal.") },
    'plc-automation': { '9.5': name("自动化控制提升工厂的技术水平。", "Automated control upgrades the technology of factories.", "Kawalan automatik meningkatkan teknologi kilang.") },
    'social-media-marketing': { '8.3': name("社交媒体让小企业低成本找到顾客。", "Social media helps small businesses find customers at low cost.", "Media sosial membantu perniagaan kecil mencari pelanggan dengan kos rendah.") },
    'digital-advertising': { '8.3': name("精准的数字广告帮助新企业成长。", "Targeted digital ads help new businesses grow.", "Iklan digital yang tepat membantu perniagaan baharu berkembang.") },
    'web-analytics': { '17.18': name("用网站数据了解用户，做出有根据的决定。", "Uses website data to understand users and make evidence-based decisions.", "Menggunakan data laman web untuk memahami pengguna dan membuat keputusan berasaskan bukti.") },
    'content-writing': { '8.3': name("好的内容帮助企业和创作者建立品牌、获得生意。", "Good content helps businesses and creators build a brand and win work.", "Kandungan yang baik membantu perniagaan dan pencipta membina jenama dan mendapat kerja.") },
    'quantity-surveying': { '9.1': name("准确计算工程量，让建设项目不超支。", "Accurate quantities keep construction projects on budget.", "Kuantiti yang tepat memastikan projek pembinaan tidak melebihi bajet.") },
    'cost-estimation': { '9.1': name("合理估算成本，让基础设施项目可行。", "Sound cost estimates make infrastructure projects feasible.", "Anggaran kos yang munasabah menjadikan projek infrastruktur boleh dilaksanakan.") },
    'contract-administration': { '16.5': name("透明的合同管理减少贿赂和舞弊。", "Transparent contract management reduces bribery and fraud.", "Pengurusan kontrak yang telus mengurangkan sogokan dan penipuan.") },
    'employee-relations': { '8.5': name("处理好劳资关系，保障员工的体面工作。", "Good employee relations protect decent work for staff.", "Hubungan pekerja yang baik melindungi pekerjaan wajar untuk kakitangan.") },
    'recruitment': { '10.3': name("公平招聘，让每个人都有平等的机会。", "Fair recruitment gives everyone an equal chance.", "Pengambilan yang adil memberi semua orang peluang yang sama.") },
    'payroll': { '8.5': name("准时准确发薪，保障员工的基本权益。", "Paying staff correctly and on time protects their basic rights.", "Membayar gaji dengan betul dan tepat pada masanya melindungi hak asas pekerja.") },
    'sales-prospecting': { '8.3': name("开发新客户帮助企业成长、创造工作。", "Finding new customers helps businesses grow and create jobs.", "Mencari pelanggan baharu membantu perniagaan berkembang dan mencipta pekerjaan.") },
    'customer-support': { '8.2': name("高效解决顾客问题，提高服务的生产力。", "Solving customer problems efficiently raises service productivity.", "Menyelesaikan masalah pelanggan dengan cekap meningkatkan produktiviti perkhidmatan.") },
    'crm-systems': { '8.2': name("用 CRM 系统管理客户，让团队工作更有效率。", "Managing customers in a CRM makes teams more efficient.", "Mengurus pelanggan dalam CRM menjadikan pasukan lebih cekap.") },
    'workplace-languages': { '4.4': name("掌握工作语言是就业所需的重要技能。", "Workplace languages are a key skill for getting decent jobs.", "Bahasa tempat kerja ialah kemahiran penting untuk mendapat pekerjaan wajar.") },
}

/**
 * SDG links of a skill made from a job posting (careers.useCustom): those of the closest catalog skill
 * (skill-details.relatedSkillId), each reason saying which skill it is close to; else 4.4, the skills employers ask for
 */
export function postingSkillSdgs(relatedId, relatedName)
{
    if(!relatedId || !SKILL_TARGETS[relatedId] || !relatedName)
        return { targets: [ '4.4' ], reasons: { '4.4': name('这是雇主在招聘中要求的技能，学会它能提高就业能力。', 'An employer asks for this skill; learning it builds skills for decent jobs.', 'Majikan memerlukan kemahiran ini; mempelajarinya membina kemahiran untuk pekerjaan wajar.') } }
    const reasons = SKILL_SDG_REASONS[relatedId]
    return {
        targets: [ ...SKILL_TARGETS[relatedId] ],
        reasons: Object.fromEntries(SKILL_TARGETS[relatedId].map((target) => [ target, name(
            `与「${relatedName.zh}」相近：${reasons[target].zh}`,
            `Close to ${relatedName.en}: ${reasons[target].en}`,
            `Hampir sama dengan ${relatedName.ms}: ${reasons[target].ms}`) ])),
    }
}

// Targets of a career: its authored tags, the ones an AI-generated career picked from TARGETS, or its skills' main targets
export function careerSdgs(career)
{
    const tags = CAREER_SDGS[career.id] ?? (career.sdgs?.length ? career.sdgs : null)
    if(tags)
        return tags.filter((tag) => TARGETS[tag.target]).map((tag) => ({ ...tag, goal: goalOf(tag.target) }))

    const targets = [ ...new Set(career.skills.map((skill) => SKILL_TARGETS[skill.id]?.[0]).filter(Boolean)) ].slice(0, 3)
    return targets.map((target) => ({ target, goal: goalOf(target), why: null }))
}

/**
 * The player's contribution to each goal of a career: average preparation (0-100, game.skillProgress) of the
 * career skills tagged with the goal, weighted like the match. A goal no skill is tagged with (a career tag, or a
 * platform target 4.4 / 8.5) counts the whole preparation (affinity).
 * [ { goal, targets, progress, skillIds, career: true when the career itself is tagged } ] most advanced first
 */
export function contribution(career, progress, affinity)
{
    const weights = new Map(career.skills.map((skill) => [ skill.id, skill.level * skill.weight ]))
    const goals = new Map()
    const entry = (goal) =>
    {
        if(!goals.has(goal))
            goals.set(goal, { goal, targets: new Set(), skillIds: [], reached: 0, total: 0, career: false })
        return goals.get(goal)
    }

    for(const tag of careerSdgs(career))
    {
        const item = entry(tag.goal)
        item.targets.add(tag.target)
        item.career = true
    }
    for(const skill of progress)
        for(const target of SKILL_TARGETS[skill.id] ?? [])
        {
            const item = entry(goalOf(target))
            item.targets.add(target)
            item.skillIds.push(skill.id)
            item.reached += (weights.get(skill.id) ?? 1) * skill.progress
            item.total += weights.get(skill.id) ?? 1
        }
    for(const target of PLATFORM_TARGETS)
        entry(goalOf(target)).targets.add(target)

    return [ ...goals.values() ]
        .map((item) => ({
            goal: item.goal,
            targets: [ ...item.targets ].sort(),
            progress: item.total ? Math.round(item.reached / item.total) : affinity,
            skillIds: [ ...new Set(item.skillIds) ],
            career: item.career,
        }))
        .sort((a, b) => Number(b.career) - Number(a.career) || b.progress - a.progress || a.goal - b.goal)
}
