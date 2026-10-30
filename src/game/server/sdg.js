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
