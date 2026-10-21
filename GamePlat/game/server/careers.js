/**
 * Career catalog: skills, requirements, market info and the matching pet
 *
 * Market info is a curated, indicative snapshot (levels, not live numbers): the UI labels it as such.
 * Skill levels: 0 none, 1 basic, 2 working, 3 solid. Career skills give the required level and a weight (1-3).
 * Names are { zh, en, ms }.
 */

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
}

export const SKILL_IDS = Object.keys(SKILLS)

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

export function getCareer(id)
{
    return CAREERS.find((career) => career.id === id) ?? null
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
