/**
 * Career catalog: skills, requirements, market info and the matching pet
 *
 * Market info is a curated, indicative snapshot (levels, not live numbers): the UI labels it as such.
 * Skill levels: 0 none, 1 basic, 2 working, 3 solid. Career skills give the required level and a weight (1-3).
 * Names are { zh, en, ms }.
 */
import { SKILL_DETAILS } from './skill-details.js'

export const SKILLS = {
    'sql':                { zh: 'SQL 查询', en: 'SQL', ms: 'SQL' },
    'excel':              { zh: 'Excel / 电子表格', en: 'Excel / Spreadsheets', ms: 'Excel / Hamparan' },
    'statistics':         { zh: '统计基础', en: 'Statistics', ms: 'Statistik' },
    'python':             { zh: 'Python 编程', en: 'Python', ms: 'Pengaturcaraan Python' },
    'data-cleaning':      { zh: '数据清洗', en: 'Data cleaning', ms: 'Pembersihan data' },
    'data-visualization': { zh: '数据可视化', en: 'Data visualization', ms: 'Visualisasi data' },
    'communication':      { zh: '沟通与表达', en: 'Communication', ms: 'Komunikasi' },
    'html-css':           { zh: 'HTML 与 CSS', en: 'HTML & CSS', ms: 'HTML & CSS' },
    'javascript':         { zh: 'JavaScript', en: 'JavaScript', ms: 'JavaScript' },
    'react':              { zh: 'React 框架', en: 'React', ms: 'React' },
    'git':                { zh: 'Git 版本控制', en: 'Git', ms: 'Git' },
    'accessibility':      { zh: '响应式与无障碍', en: 'Responsive & accessibility', ms: 'Responsif & kebolehcapaian' },
    'api-integration':    { zh: 'API 对接', en: 'API integration', ms: 'Integrasi API' },
    'backend-language':   { zh: '后端语言（Java / Node / Python）', en: 'Backend language (Java / Node / Python)', ms: 'Bahasa backend (Java / Node / Python)' },
    'databases':          { zh: '数据库设计', en: 'Database design', ms: 'Reka bentuk pangkalan data' },
    'rest-api':           { zh: 'REST API 设计', en: 'REST API design', ms: 'Reka bentuk REST API' },
    'cloud-deploy':       { zh: '云端部署', en: 'Cloud deployment', ms: 'Penggunaan awan' },
    'testing':            { zh: '自动化测试', en: 'Automated testing', ms: 'Ujian automatik' },
    'user-research':      { zh: '用户研究', en: 'User research', ms: 'Penyelidikan pengguna' },
    'prototyping':        { zh: '线框与原型', en: 'Wireframes & prototyping', ms: 'Rangka wayar & prototaip' },
    'figma':              { zh: 'Figma', en: 'Figma', ms: 'Figma' },
    'visual-design':      { zh: '视觉设计', en: 'Visual design', ms: 'Reka bentuk visual' },
    'usability-testing':  { zh: '可用性测试', en: 'Usability testing', ms: 'Ujian kebolehgunaan' },
    'ml-math':            { zh: '机器学习数学', en: 'Math for ML', ms: 'Matematik untuk ML' },
    'ml-frameworks':      { zh: '机器学习框架', en: 'ML frameworks', ms: 'Rangka kerja ML' },
    'mlops':              { zh: '模型部署 MLOps', en: 'MLOps', ms: 'MLOps' },
    'roadmapping':        { zh: '产品规划', en: 'Product roadmapping', ms: 'Perancangan produk' },
    'agile':              { zh: '敏捷协作', en: 'Agile collaboration', ms: 'Kolaborasi Agile' },
    'market-analysis':    { zh: '市场分析', en: 'Market analysis', ms: 'Analisis pasaran' },
    // Careers of the search catalog (EXTRA_CAREERS), not on the map by default
    'accounting':         { zh: '财务会计', en: 'Financial accounting', ms: 'Perakaunan kewangan' },
    'auditing':           { zh: '审计程序与准则', en: 'Audit procedures & standards', ms: 'Prosedur & piawaian audit' },
    'internal-control':   { zh: '内部控制与风险', en: 'Internal control & risk', ms: 'Kawalan dalaman & risiko' },
    'legal-research':     { zh: '法律检索', en: 'Legal research', ms: 'Penyelidikan undang-undang' },
    'legal-writing':      { zh: '法律文书写作', en: 'Legal drafting', ms: 'Penggubalan dokumen undang-undang' },
    'negotiation':        { zh: '谈判', en: 'Negotiation', ms: 'Rundingan' },
    'lesson-planning':    { zh: '教学设计', en: 'Lesson planning', ms: 'Perancangan pengajaran' },
    'classroom-management': { zh: '课堂管理', en: 'Classroom management', ms: 'Pengurusan bilik darjah' },
    'assessment':         { zh: '学习评估', en: 'Learning assessment', ms: 'Penilaian pembelajaran' },
    'clinical-knowledge': { zh: '临床医学知识', en: 'Clinical knowledge', ms: 'Pengetahuan klinikal' },
    'patient-care':       { zh: '病患沟通与照护', en: 'Patient care', ms: 'Penjagaan pesakit' },
    'medical-ethics':     { zh: '医学伦理', en: 'Medical ethics', ms: 'Etika perubatan' },
    'cooking-technique':  { zh: '烹饪技法', en: 'Cooking technique', ms: 'Teknik masakan' },
    'food-safety':        { zh: '食品安全与卫生', en: 'Food safety & hygiene', ms: 'Keselamatan & kebersihan makanan' },
    'menu-planning':      { zh: '菜单设计与成本', en: 'Menu planning & costing', ms: 'Perancangan menu & kos' },
    'engineering-math':   { zh: '工程数学与力学', en: 'Engineering math & mechanics', ms: 'Matematik & mekanik kejuruteraan' },
    'cad':                { zh: 'CAD 制图', en: 'CAD drafting', ms: 'Lukisan CAD' },
    'project-management': { zh: '项目管理', en: 'Project management', ms: 'Pengurusan projek' },
}

export const SKILL_IDS = Object.keys(SKILLS)

/**
 * Text of a { zh, en, ms } object in one language. Plain strings (roadmaps saved before they were trilingual) as they are
 */
export function localText(value, lang)
{
    return typeof value === 'string' ? value : value?.[lang] ?? value?.en ?? ''
}

export const CAREERS = [
    {
        id: 'data-analyst',
        name: { zh: '数据分析师', en: 'Data Analyst', ms: 'Penganalisis Data' },
        summary: {
            zh: '把杂乱的数据整理成能回答业务问题的结论。',
            en: 'Turns messy data into answers for business questions.',
            ms: 'Menukar data yang bersepah kepada jawapan untuk soalan perniagaan.',
        },
        color: '#2bb3a3',
        skills: [
            { id: 'sql', level: 3, weight: 3 },
            { id: 'data-cleaning', level: 3, weight: 3 },
            { id: 'data-visualization', level: 2, weight: 2 },
            { id: 'excel', level: 2, weight: 2 },
            { id: 'statistics', level: 2, weight: 2 },
            { id: 'python', level: 1, weight: 1 },
            { id: 'communication', level: 2, weight: 2 },
        ],
        market: { demand: 'high', heat: 80, trend: 'stable' },
        effortMonths: [ 4, 8 ],
        pet: { name: 'Sorti', species: 'owl' },
    },
    {
        id: 'frontend-developer',
        name: { zh: '前端工程师', en: 'Frontend Developer', ms: 'Pembangun Frontend' },
        summary: {
            zh: '把设计变成在浏览器里好用、好看的界面。',
            en: 'Builds the interfaces people use in the browser.',
            ms: 'Membina antara muka yang digunakan orang dalam pelayar.',
        },
        color: '#ff8a3d',
        skills: [
            { id: 'html-css', level: 3, weight: 3 },
            { id: 'javascript', level: 3, weight: 3 },
            { id: 'react', level: 2, weight: 3 },
            { id: 'git', level: 2, weight: 2 },
            { id: 'accessibility', level: 2, weight: 2 },
            { id: 'api-integration', level: 2, weight: 2 },
        ],
        market: { demand: 'high', heat: 80, trend: 'stable' },
        effortMonths: [ 6, 10 ],
        pet: { name: 'Pixi', species: 'fox' },
    },
    {
        id: 'backend-developer',
        name: { zh: '后端工程师', en: 'Backend Developer', ms: 'Pembangun Backend' },
        summary: {
            zh: '负责服务器、数据库和 API，让产品稳定运行。',
            en: 'Runs the servers, databases and APIs behind a product.',
            ms: 'Menguruskan pelayan, pangkalan data dan API di sebalik produk.',
        },
        color: '#6c8a5a',
        skills: [
            { id: 'backend-language', level: 3, weight: 3 },
            { id: 'databases', level: 3, weight: 3 },
            { id: 'rest-api', level: 3, weight: 3 },
            { id: 'git', level: 2, weight: 2 },
            { id: 'testing', level: 2, weight: 2 },
            { id: 'cloud-deploy', level: 2, weight: 2 },
        ],
        market: { demand: 'high', heat: 80, trend: 'stable' },
        effortMonths: [ 6, 12 ],
        pet: { name: 'Bytey', species: 'turtle' },
    },
    {
        id: 'ui-ux-designer',
        name: { zh: 'UI/UX 设计师', en: 'UI/UX Designer', ms: 'Pereka UI/UX' },
        summary: {
            zh: '理解用户需求，设计出清楚好用的产品体验。',
            en: 'Understands users and designs clear, usable product experiences.',
            ms: 'Memahami pengguna dan mereka pengalaman produk yang jelas dan mudah digunakan.',
        },
        color: '#ff6fa8',
        skills: [
            { id: 'user-research', level: 3, weight: 3 },
            { id: 'prototyping', level: 3, weight: 3 },
            { id: 'figma', level: 3, weight: 2 },
            { id: 'visual-design', level: 2, weight: 2 },
            { id: 'usability-testing', level: 2, weight: 2 },
            { id: 'communication', level: 2, weight: 2 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 5, 9 ],
        pet: { name: 'Hue', species: 'bunny' },
    },
    {
        id: 'ml-engineer',
        name: { zh: 'AI / 机器学习工程师', en: 'AI / ML Engineer', ms: 'Jurutera AI / ML' },
        summary: {
            zh: '训练、评估并部署机器学习模型。',
            en: 'Trains, evaluates and deploys machine learning models.',
            ms: 'Melatih, menilai dan menggunakan model pembelajaran mesin.',
        },
        color: '#8a6cff',
        skills: [
            { id: 'python', level: 3, weight: 3 },
            { id: 'ml-math', level: 3, weight: 3 },
            { id: 'ml-frameworks', level: 3, weight: 3 },
            { id: 'data-cleaning', level: 2, weight: 2 },
            { id: 'mlops', level: 2, weight: 2 },
            { id: 'sql', level: 1, weight: 1 },
        ],
        market: { demand: 'high', heat: 80, trend: 'rising' },
        effortMonths: [ 9, 18 ],
        pet: { name: 'Neuro', species: 'axolotl' },
    },
    {
        id: 'product-manager',
        name: { zh: '产品经理', en: 'Product Manager', ms: 'Pengurus Produk' },
        summary: {
            zh: '决定做什么、为什么做，并带领团队把产品做出来。',
            en: 'Decides what to build and why, and leads the team to ship it.',
            ms: 'Menentukan apa yang perlu dibina dan sebabnya, serta memimpin pasukan menghasilkannya.',
        },
        color: '#3d8bff',
        skills: [
            { id: 'roadmapping', level: 3, weight: 3 },
            { id: 'user-research', level: 2, weight: 2 },
            { id: 'communication', level: 3, weight: 3 },
            { id: 'market-analysis', level: 2, weight: 2 },
            { id: 'agile', level: 2, weight: 2 },
            { id: 'sql', level: 1, weight: 1 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'rising' },
        effortMonths: [ 6, 12 ],
        pet: { name: 'Compass', species: 'penguin' },
    },
]

/**
 * Search catalog: careers without a mentor on the map at first (a mentor can be swapped for one of them).
 * CAREERS above are the map careers, the ones the job market workflow (n8n/market) tracks.
 */
export const EXTRA_CAREERS = [
    {
        id: 'forward-deployed-engineer',
        name: { zh: 'FDE（前线部署工程师）', en: 'FDE (Forward Deployed Engineer)', ms: 'FDE (Forward Deployed Engineer)' },
        shortName: { zh: 'FDE', en: 'FDE', ms: 'FDE' },
        summary: {
            zh: '深入客户现场，把业务问题转化成可上线的 AI 应用、系统集成与解决方案。',
            en: 'Works with customers to turn business problems into production AI applications and integrated solutions.',
            ms: 'Bekerjasama dengan pelanggan untuk menukar masalah perniagaan kepada aplikasi AI dan penyelesaian bersepadu.',
        },
        emerging: true,
        introducedAt: '2026-10-24',
        color: '#ef6455',
        skills: [
            { id: 'python', level: 3, weight: 3 },
            { id: 'api-integration', level: 3, weight: 3 },
            { id: 'communication', level: 3, weight: 3 },
            { id: 'rest-api', level: 2, weight: 2 },
            { id: 'cloud-deploy', level: 2, weight: 2 },
            { id: 'mlops', level: 2, weight: 2 },
            { id: 'ml-frameworks', level: 2, weight: 2 },
            { id: 'sql', level: 2, weight: 2 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 8, 14 ],
        pet: { name: 'Relay', species: 'fox' },
    },
    {
        id: 'data-scientist',
        name: { zh: '数据科学家', en: 'Data Scientist', ms: 'Saintis Data' },
        summary: { zh: '用统计和机器学习模型从数据中找出规律并做预测。', en: 'Finds patterns and makes predictions from data with statistics and models.', ms: 'Mencari corak dan membuat ramalan daripada data dengan statistik dan model.' },
        color: '#17a2b8',
        skills: [
            { id: 'python', level: 3, weight: 3 },
            { id: 'statistics', level: 3, weight: 3 },
            { id: 'ml-frameworks', level: 2, weight: 3 },
            { id: 'sql', level: 2, weight: 2 },
            { id: 'data-visualization', level: 2, weight: 2 },
            { id: 'communication', level: 2, weight: 2 },
        ],
        market: { demand: 'high', heat: 80, trend: 'rising' },
        effortMonths: [ 8, 14 ],
        pet: { name: 'Quanta', species: 'owl' },
    },
    {
        id: 'auditor',
        name: { zh: '审计师', en: 'Auditor', ms: 'Juruaudit' },
        summary: { zh: '检查公司的账目和流程，确认财务报告真实可靠。', en: 'Checks a company\'s accounts and processes so its financial reports can be trusted.', ms: 'Menyemak akaun dan proses syarikat supaya laporan kewangan boleh dipercayai.' },
        color: '#b8860b',
        skills: [
            { id: 'accounting', level: 3, weight: 3 },
            { id: 'auditing', level: 3, weight: 3 },
            { id: 'internal-control', level: 2, weight: 2 },
            { id: 'excel', level: 2, weight: 2 },
            { id: 'communication', level: 2, weight: 2 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 6, 12 ],
        pet: { name: 'Ledger', species: 'turtle' },
    },
    {
        id: 'lawyer',
        name: { zh: '律师', en: 'Lawyer', ms: 'Peguam' },
        summary: { zh: '研究法律问题，起草文件，为客户争取权益。', en: 'Researches legal questions, drafts documents and argues for clients.', ms: 'Mengkaji isu undang-undang, menggubal dokumen dan membela pelanggan.' },
        color: '#7b3f61',
        skills: [
            { id: 'legal-research', level: 3, weight: 3 },
            { id: 'legal-writing', level: 3, weight: 3 },
            { id: 'negotiation', level: 2, weight: 2 },
            { id: 'communication', level: 3, weight: 3 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 12, 36 ],
        pet: { name: 'Gavel', species: 'owl' },
    },
    {
        id: 'teacher',
        name: { zh: '教师', en: 'Teacher', ms: 'Guru' },
        summary: { zh: '设计课程、带好课堂，并帮助学生持续进步。', en: 'Plans lessons, runs the classroom and helps students keep improving.', ms: 'Merancang pelajaran, mengurus kelas dan membantu murid terus maju.' },
        color: '#e07a5f',
        skills: [
            { id: 'lesson-planning', level: 3, weight: 3 },
            { id: 'classroom-management', level: 2, weight: 3 },
            { id: 'assessment', level: 2, weight: 2 },
            { id: 'communication', level: 3, weight: 3 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 6, 18 ],
        pet: { name: 'Chalky', species: 'bunny' },
    },
    {
        id: 'doctor',
        name: { zh: '医生', en: 'Doctor', ms: 'Doktor' },
        summary: { zh: '诊断和治疗病人，并向他们解释病情和方案。', en: 'Diagnoses and treats patients and explains their options to them.', ms: 'Mendiagnosis dan merawat pesakit serta menerangkan pilihan kepada mereka.' },
        color: '#2e86ab',
        skills: [
            { id: 'clinical-knowledge', level: 3, weight: 3 },
            { id: 'patient-care', level: 3, weight: 3 },
            { id: 'medical-ethics', level: 2, weight: 2 },
            { id: 'communication', level: 3, weight: 2 },
        ],
        market: { demand: 'high', heat: 80, trend: 'stable' },
        effortMonths: [ 24, 72 ],
        pet: { name: 'Pulse', species: 'penguin' },
    },
    {
        id: 'chef',
        name: { zh: '厨师', en: 'Chef', ms: 'Cef' },
        summary: { zh: '设计菜单，做出稳定好吃的菜，并管好厨房。', en: 'Designs menus, cooks consistently good food and runs the kitchen.', ms: 'Mereka menu, memasak makanan yang sedap secara konsisten dan mengurus dapur.' },
        color: '#d1495b',
        skills: [
            { id: 'cooking-technique', level: 3, weight: 3 },
            { id: 'food-safety', level: 3, weight: 3 },
            { id: 'menu-planning', level: 2, weight: 2 },
            { id: 'project-management', level: 1, weight: 1 },
            { id: 'communication', level: 2, weight: 1 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 6, 24 ],
        pet: { name: 'Saucy', species: 'fox' },
    },
    {
        id: 'civil-engineer',
        name: { zh: '土木工程师', en: 'Civil Engineer', ms: 'Jurutera Awam' },
        summary: { zh: '设计并监督道路、桥梁和建筑等工程。', en: 'Designs and supervises roads, bridges and buildings.', ms: 'Mereka dan menyelia jalan raya, jambatan dan bangunan.' },
        color: '#5c6b73',
        skills: [
            { id: 'engineering-math', level: 3, weight: 3 },
            { id: 'cad', level: 3, weight: 3 },
            { id: 'project-management', level: 2, weight: 2 },
            { id: 'communication', level: 2, weight: 2 },
        ],
        market: { demand: 'medium', heat: 60, trend: 'stable' },
        effortMonths: [ 12, 24 ],
        pet: { name: 'Girder', species: 'turtle' },
    },
]

// Mentors on the map, one per spot (sources/Career/CareerWorld.js NPC_SPOTS, same order). A save keeps its own list in save.map
export const DEFAULT_MAP = [ 'product-manager', 'frontend-developer', 'ml-engineer', 'backend-developer', 'ui-ux-designer', 'data-analyst' ]

/**
 * Careers and skills the AI generated for this save (save.customCareers / save.customSkills), registered in the
 * catalogs above while a request runs (server/app.js) so every SKILLS / getCareer lookup knows them
 */
let customCareers = []
const customSkillIds = new Set()

export function useCustom(save)
{
    for(const id of customSkillIds)
    {
        delete SKILLS[id]
        delete SKILL_DETAILS[id]
        SKILL_IDS.splice(SKILL_IDS.indexOf(id), 1)
    }
    customSkillIds.clear()

    for(const [ id, skill ] of Object.entries(save.customSkills ?? {}))
    {
        if(SKILLS[id])
            continue
        SKILLS[id] = skill.name
        SKILL_DETAILS[id] = skill.detail
        SKILL_IDS.push(id)
        customSkillIds.add(id)
    }
    customCareers = save.customCareers ?? []
}

export function allCareers()
{
    return [ ...CAREERS, ...EXTRA_CAREERS, ...customCareers ]
}

export function getCareer(id)
{
    return allCareers().find((career) => career.id === id) ?? null
}

/**
 * Match of a profile against a career: weighted share of the required levels already reached
 * Returns { percent, skills: [{ id, required, current, gap }] }
 */
export function matchCareer(career, profileSkills)
{
    const levels = new Map()
    for(const skill of profileSkills)
        if(skill.id)
            levels.set(skill.id, Math.max(levels.get(skill.id) ?? 0, skill.level))

    let reached = 0
    let total = 0
    const skills = career.skills.map((requirement) =>
    {
        const current = levels.get(requirement.id) ?? 0
        reached += Math.min(current, requirement.level) * requirement.weight
        total += requirement.level * requirement.weight
        return { id: requirement.id, required: requirement.level, current, gap: Math.max(0, requirement.level - current) }
    })

    return { percent: total ? Math.round(reached / total * 100) : 0, skills }
}
