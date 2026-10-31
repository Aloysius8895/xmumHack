/**
 * AI usage evidence for the roadmap (prompt 06): the Anthropic Economic Index rows behind a career's skills, each with a
 * stable evidenceId the roadmap AI may cite, and the trend classification of the scenarios. Every number comes from
 * data/ai-exposure (exposure.json, skill_task_map.json, source-periods.json); none is estimated here.
 *
 *   evidenceId   aei:source:<release>   aei:career:<careerId>   aei:skill:<skillId>   aei:mock:skill:<skillId>
 *   status       observed: exposure rows with their tasks; imputed: a MOCK value (data/mock/ai-exposure.json, prompt 07)
 *                imputed from the reviewed skills of the careers needing it; unknown: no value at all (null, never
 *                read as low risk)
 *   quality      fewTasks (fewer than FEW_TASKS mapped tasks, a team threshold), unreviewed, noData, imputed
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getCareer } from './careers.js'
import { currentExposure } from './ai-exposure.js'

export const MAP_FILE = fileURLToPath(new URL('../../../data/ai-exposure/skill_task_map.json', import.meta.url))
export const PERIODS_FILE = fileURLToPath(new URL('../../../data/ai-exposure/source-periods.json', import.meta.url))
// Team assumption: a skill resting on fewer mapped tasks is weaker evidence (shown, never hidden)
export const FEW_TASKS = 3

const cache = new Map()

/** A JSON file re-read when it changes, the last good content (or `empty`) when it is missing or unreadable */
function readJson(file, empty)
{
    try
    {
        const stat = fs.statSync(file)
        const signature = `${stat.mtimeMs}:${stat.size}`
        if(cache.get(file)?.signature !== signature)
            cache.set(file, { signature, value: JSON.parse(fs.readFileSync(file, 'utf8')) })
        return cache.get(file).value
    }
    catch
    {
        return cache.get(file)?.value ?? empty
    }
}

export const loadPeriods = (file = PERIODS_FILE) => readJson(file, { releases: {}, classificationCriteria: null })
const loadMap = () => readJson(MAP_FILE, { skills: {}, careers: {} })

export const sourceId = (release) => `aei:source:${release}`
export const careerEvidenceId = (careerId) => `aei:career:${careerId}`
export const skillEvidenceId = (skillId, mock = false) => mock ? `aei:mock:skill:${skillId}` : `aei:skill:${skillId}`

const LIMITS = {
    zh: '这些数据反映人们在美国 O*NET 工作任务上如何使用 Claude：说明 AI 正在进入哪些工作，不代表所有 AI 工具，不是马来西亚的就业数据，也不是技能被淘汰或失业的概率。',
    en: 'These data show how people use Claude on US O*NET work tasks: a signal of where AI is entering work, not all AI tools, not Malaysian employment data, and not a probability of a skill becoming obsolete or of job loss.',
    ms: 'Data ini menunjukkan cara orang menggunakan Claude bagi tugas kerja O*NET di AS: petanda di mana AI memasuki kerja, bukan semua alat AI, bukan data pekerjaan Malaysia, dan bukan kebarangkalian kemahiran menjadi usang atau kehilangan kerja.',
}

const REASONS = {
    'no-period': {
        zh: '有的 AI 使用数据没有写明观测时期，无法比较变化，所以无法判断 AI 发展偏温和还是偏极端。默认采用温和，这是保守的规划假设，不代表已经证实 AI 发展温和。',
        en: 'Some AI usage data state no observation period, so no change can be compared and the pace of AI cannot be classified. Moderate is the default: a conservative planning assumption, not a finding that AI is developing moderately.',
        ms: 'Sesetengah data penggunaan AI tidak menyatakan tempoh pemerhatian, jadi perubahan tidak dapat dibandingkan dan kepantasan AI tidak dapat dikelaskan. Sederhana ialah lalai: andaian perancangan yang konservatif, bukan dapatan bahawa AI berkembang secara sederhana.',
    },
    'single-period': {
        zh: '每种 AI 使用指标都只有一期数据，无法判断变化速度，所以无法判断 AI 发展偏温和还是偏极端。默认采用温和，这是保守的规划假设，不代表已经证实 AI 发展温和。',
        en: 'Each AI usage measure has a single period, so its pace of change cannot be measured and AI cannot be classified as moderate or extreme. Moderate is the default: a conservative planning assumption, not a finding that AI is developing moderately.',
        ms: 'Setiap ukuran penggunaan AI hanya ada satu tempoh, jadi kadar perubahannya tidak dapat diukur dan AI tidak dapat dikelaskan sebagai sederhana atau ekstrem. Sederhana ialah lalai: andaian perancangan yang konservatif, bukan dapatan bahawa AI berkembang secara sederhana.',
    },
    'no-criteria': {
        zh: '有可比较的多期数据，但团队还没有定下判断温和或极端的标准，所以不作判断。默认采用温和，这是保守的规划假设。',
        en: 'Comparable periods exist, but the team has set no criteria for moderate or extreme, so none is claimed. Moderate is the default: a conservative planning assumption.',
        ms: 'Tempoh yang setanding wujud, tetapi pasukan belum menetapkan kriteria sederhana atau ekstrem, jadi tiada yang dituntut. Sederhana ialah lalai: andaian perancangan yang konservatif.',
    },
    'no-career-data': {
        zh: '这个职业在各期数据里能对上的工作任务太少（或没有选职业），无法比较变化。默认采用温和，这是保守的规划假设，不代表已经证实 AI 发展温和。',
        en: 'Too few of this career\'s tasks appear in every period (or no career is chosen), so no change can be compared. Moderate is the default: a conservative planning assumption, not a finding that AI is developing moderately.',
        ms: 'Terlalu sedikit tugas kerjaya ini terdapat dalam setiap tempoh (atau tiada kerjaya dipilih), jadi perubahan tidak dapat dibandingkan. Sederhana ialah lalai: andaian perancangan yang konservatif, bukan dapatan bahawa AI berkembang secara sederhana.',
    },
    classified: (scenario, { first, last, change, pairedTasks, threshold, from, to }) =>
    {
        const pp = (value) => `${Math.round(value * 1000) / 10}%`
        const points = `${change >= 0 ? '+' : ''}${Math.round(change * 1000) / 10}`
        const limit = Math.round(threshold * 1000) / 10
        return {
            zh: `这个职业相关的 ${pairedTasks} 项工作任务里，AI 用户让 AI 直接完成（自动化）的占比从 ${pp(first)}（${from}）变为 ${pp(last)}（${to}），变化 ${points} 个百分点，${scenario === 'extreme' ? '达到' : '没有达到'}团队事先定下的极端门槛（${limit} 个百分点），所以判断为${scenario === 'extreme' ? '极端' : '温和'}。这只说明 Claude 用户的使用方式在变，不是失业或技能淘汰的概率。`,
            en: `Across ${pairedTasks} tasks of this career, the share of AI use that hands the task to AI (automation) went from ${pp(first)} (${from}) to ${pp(last)} (${to}), ${points} percentage points, ${scenario === 'extreme' ? 'reaching' : 'below'} the threshold the team set in advance (${limit} points), so ${scenario}. It shows how Claude users' use is changing, not a probability of job loss or of a skill becoming obsolete.`,
            ms: `Dalam ${pairedTasks} tugas kerjaya ini, bahagian penggunaan AI yang menyerahkan tugas kepada AI (automasi) berubah daripada ${pp(first)} (${from}) kepada ${pp(last)} (${to}), ${points} mata peratusan, ${scenario === 'extreme' ? 'mencapai' : 'di bawah'} ambang yang ditetapkan pasukan lebih awal (${limit} mata), jadi ${scenario === 'extreme' ? 'ekstrem' : 'sederhana'}. Ia menunjukkan perubahan cara pengguna Claude menggunakan AI, bukan kebarangkalian kehilangan kerja atau kemahiran menjadi usang.`,
        }
    },
    mock: {
        zh: '注意：其中有模拟数据，结果只作演示。',
        en: 'Note: part of these data is mock data; the result is for demonstration only.',
        ms: 'Nota: sebahagian data ini ialah data olok-olok; hasilnya untuk demonstrasi sahaja.',
    },
}

const RULES = {
    zh: '只有同一指标、同一定义、写明观测时期的 2 期以上数据，并且团队事先定下了分类标准，才按目标职业的工作任务判断 AI 发展偏温和还是偏极端：自动化占比在第一期和最后一期之间上升达到门槛就是极端，否则是温和。条件不满足时结果是 insufficient_evidence，默认温和。不会只因为某项指标现在很高，就说 AI 发展很快。',
    en: 'AI is classified as moderate or extreme for the target career\'s tasks only from two or more periods of the same measure, with the same definition and stated observation periods, against criteria the team set in advance: an automation share rising by the threshold or more from the first to the last period is extreme, otherwise moderate. Otherwise the result is insufficient_evidence with moderate as the default. A measure being high now is never read as fast development.',
    ms: 'AI dikelaskan sebagai sederhana atau ekstrem bagi tugas kerjaya sasaran hanya daripada dua atau lebih tempoh ukuran yang sama, dengan definisi yang sama dan tempoh pemerhatian yang dinyatakan, berbanding kriteria yang ditetapkan pasukan lebih awal: bahagian automasi yang meningkat sebanyak ambang atau lebih dari tempoh pertama ke terakhir ialah ekstrem, jika tidak sederhana. Jika tidak, hasilnya insufficient_evidence dengan sederhana sebagai lalai. Ukuran yang tinggi sekarang tidak pernah dibaca sebagai perkembangan pantas.',
}

export const SERIES_FILE = fileURLToPath(new URL('../../../data/ai-exposure/periods.json', import.meta.url))
export const loadSeries = (file = SERIES_FILE) => readJson(file, { careers: {} })

const periodLabel = (row) => row.observationPeriod?.from ?? row.observationPeriod?.approximate ?? row.published ?? row.release

/**
 * Whether the AI usage evidence of a career points to the moderate or the extreme scenario. Releases of one metric and
 * definition, each with a stated period, form a series; with team criteria ({ metric, extremeChangeAbove,
 * minimumPairedTasks }) the change of the career's value (data/ai-exposure/periods.json) from the first to the last
 * published release classifies it.
 */
export function trendClassification(careerId = null, { periods = loadPeriods(), series = loadSeries() } = {})
{
    const releases = Object.entries(periods.releases ?? {}).map(([ release, row ]) => ({ release, ...row }))
    const result = (trend, scenario, reason, evidenceRefs = releases.map((row) => sourceId(row.release)), extra = {}) => ({
        trendClassification: trend, recommendedScenario: scenario, reason, evidenceRefs, rules: RULES,
        limitations: LIMITS, careerId, ...extra,
    })
    const seriesOf = (rows) =>
    {
        const groups = new Map()
        for(const row of rows)
            groups.set(`${row.metric}\n${row.definition}`, [ ...(groups.get(`${row.metric}\n${row.definition}`) ?? []), row ])
        return [ ...groups.values() ].filter((items) => items.length >= 2)
    }
    const comparable = seriesOf(releases.filter((row) => row.observationPeriod))
    if(!comparable.length)
        return result('insufficient_evidence', 'moderate', seriesOf(releases).length ? REASONS['no-period'] : REASONS['single-period'])
    const criteria = periods.classificationCriteria
    const rows = criteria && comparable.find((items) => items[0].metric === criteria.metric)
    if(!rows || typeof criteria.extremeChangeAbove !== 'number')
        return result('insufficient_evidence', 'moderate', REASONS['no-criteria'])
    const ordered = [ ...rows ].sort((a, b) => String(a.published).localeCompare(String(b.published)))
    const refs = ordered.map((row) => sourceId(row.release))
    const career = careerId ? series.careers?.[careerId] : null
    const values = ordered.map((row) => career?.automationShare?.[row.release])
    if(!career || values.some((value) => typeof value !== 'number') || career.pairedTasks < (criteria.minimumPairedTasks ?? FEW_TASKS))
        return result('insufficient_evidence', 'moderate', REASONS['no-career-data'], refs)
    const [ first, last ] = [ values[0], values.at(- 1) ]
    const change = Math.round((last - first) * 10000) / 10000
    const scenario = change >= criteria.extremeChangeAbove ? 'extreme' : 'moderate'
    const mock = ordered.some((row) => row.mock === true)
    const text = REASONS.classified(scenario, { first, last, change, pairedTasks: career.pairedTasks, threshold: criteria.extremeChangeAbove,
        from: periodLabel(ordered[0]), to: periodLabel(ordered.at(- 1)) })
    const reason = mock ? Object.fromEntries(Object.entries(text).map(([ lang, value ]) => [ lang, `${value} ${REASONS.mock[lang]}` ])) : text
    return result(scenario, scenario, reason, [ ...refs, careerEvidenceId(careerId) ], {
        change, values: Object.fromEntries(ordered.map((row, index) => [ row.release, values[index] ])), pairedTasks: career.pairedTasks, mock,
        comparability: ordered.at(- 1).comparability ?? null,
    })
}

/** The source of the evidence: the dataset, and per release its files, metric and observation period (never the download date) */
export function evidenceSource(exposure = currentExposure(), periods = loadPeriods())
{
    const source = exposure.source ?? {}
    return {
        name: source.name ?? null,
        url: source.url ?? null,
        license: source.license ?? null,
        downloadedAt: source.downloadedAt ?? null,
        method: source.method ?? null,
        releases: Object.entries(periods.releases ?? {}).map(([ release, row ]) => ({
            evidenceId: sourceId(release), release, files: row.files, metric: row.metric, definition: row.definition,
            observationPeriod: row.observationPeriod ?? null, periodNote: row.periodNote ?? null, published: row.published ?? null,
            url: row.observationPeriod?.url ?? row.url ?? null,
        })),
    }
}

function skillEvidence(skillId, exposure, map)
{
    const row = exposure.skills?.[skillId] ?? null
    const mapping = map.skills?.[skillId] ?? null
    const reviewed = mapping?.reviewed === true
    if(!row)
        return {
            evidenceId: skillEvidenceId(skillId), skillId, status: 'unknown', automation: null, augmentation: null, tasks: [],
            mappedTaskCount: mapping ? 0 : null, reviewed, note: mapping?.note ?? null,
            quality: { fewTasks: false, unreviewed: !reviewed, noData: true, imputed: false },
        }
    if(row.mock)
        return {
            evidenceId: skillEvidenceId(skillId, true), skillId, status: 'imputed', automation: row.automation, augmentation: row.augmentation,
            tasks: [], mappedTaskCount: 0, reviewed, note: mapping?.note ?? null, mock: true, method: row.method ?? null,
            quality: { fewTasks: false, unreviewed: !reviewed, noData: true, imputed: true },
        }
    return {
        evidenceId: skillEvidenceId(skillId), skillId, status: 'observed', automation: row.automation, augmentation: row.augmentation,
        tasks: row.tasks, mappedTaskCount: row.tasks.length, reviewed, note: row.note ?? mapping?.note ?? null,
        quality: { fewTasks: row.tasks.length < FEW_TASKS, unreviewed: !reviewed, noData: false, imputed: false },
    }
}

/**
 * The AEI evidence of a career and of each skill it requires (`career`: as targeted, customised to a company's job
 * posting), for the roadmap AI (its aeiEvidence input), or null for an unknown career. Skills without exposure data are
 * 'imputed' (mock) or 'unknown' with null values.
 */
export function aeiEvidence(careerId, { exposure = currentExposure(), career = null } = {})
{
    career ??= getCareer(careerId)
    if(!career)
        return null
    const map = loadMap()
    const row = exposure.careers?.[careerId] ?? null
    return {
        source: evidenceSource(exposure),
        career: {
            evidenceId: careerEvidenceId(careerId), careerId, status: row ? 'observed' : 'unknown',
            onet: row?.onet ?? null, soc: row?.soc ?? null, title: row?.title ?? null, reviewed: row?.reviewed === true,
            observedExposure: row?.observedExposure ?? null, tasks: row?.tasks ?? null, tasksWithoutPenetration: row?.tasksWithoutPenetration ?? null,
        },
        skills: career.skills.map((requirement) => skillEvidence(requirement.id, exposure, map)),
        thresholds: { fewTasks: FEW_TASKS },
        limits: LIMITS,
    }
}
