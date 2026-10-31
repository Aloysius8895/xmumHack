/**
 * No-Regret learning path (prompt 03): which gap skills to learn first whichever scenario comes true.
 *
 *   core     the gap skills ranking in the top half by score gain under both presets, by their mean gain
 *   branches the other gap skills, ordered by their gain under each preset (moderate, extreme)
 *   later    skills declining under both presets (future value below 0.95), learnt last, with the reason; a skill that
 *            a skill still to learn requires (src/data/config/skill-prerequisites.json, reviewed entries) is not put last
 *   order    a skill comes after what it requires: a requirement of a core skill joins the core, every list is ordered
 *            so requirements come first (prompt 07)
 *
 * Computed in code from the scenario model (scenarios.js) on AI exposure and hiring demand (prompt 07; mock data where
 * real data is missing, marked); the AI only writes the stage texts. Every skill carries a reason in three languages,
 * written here, never by the AI. The order is a learning priority, never evidence of the pace of AI.
 *
 * learningApproach: how to learn a skill under a scenario, the weight of five activities from its automation and
 * augmentation and the scenario's adoption (prompt 07): what differs between the scenarios is how to learn as well as
 * what to learn.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getCareer, matchCareer, SKILLS } from './careers.js'
import { PRESETS, adoption, defaultInputs, forecastCareer, normalizePreset } from './scenarios.js'
import { skillEvidenceId } from './aei-evidence.js'

export const PRESET_IDS = Object.keys(PRESETS)
export const PREREQUISITES_FILE = fileURLToPath(new URL('../../data/config/skill-prerequisites.json', import.meta.url))

const LABEL = { moderate: { zh: '温和', en: 'moderate', ms: 'sederhana' }, extreme: { zh: '极端', en: 'extreme', ms: 'ekstrem' } }
const name = (id) => SKILLS[id] ?? { zh: id, en: id, ms: id }
const fixed = (value) => value.toFixed(2)
const names = (ids, lang) => ids.map((id) => name(id)[lang]).join(lang === 'zh' ? '、' : ', ')

function reason(kind, id, gains, values, branch = null, requiredBy = [])
{
    const skill = name(id)
    const m = gains.moderate[id] ?? 0, x = gains.extreme[id] ?? 0
    if(kind === 'foundation')
        return { zh: `${skill.zh}：两个情景下都在下降（未来价值 ${fixed(values.moderate[id])} / ${fixed(values.extreme[id])}），但它是${names(requiredBy, 'zh')}的基础，所以不放到最后`,
            en: `${skill.en}: declining under both scenarios (future value ${fixed(values.moderate[id])} / ${fixed(values.extreme[id])}), but a foundation of ${names(requiredBy, 'en')}, so not left to last`,
            ms: `${skill.ms}: menurun dalam kedua-dua senario (nilai masa depan ${fixed(values.moderate[id])} / ${fixed(values.extreme[id])}), tetapi asas bagi ${names(requiredBy, 'ms')}, jadi tidak diletakkan terakhir` }
    if(kind === 'added')
        return { zh: `${skill.zh}：招聘信息没有写，但它是${names(requiredBy, 'zh')}的基础，所以补进路线`, en: `${skill.en}: not in the job posting, but a foundation of ${names(requiredBy, 'en')}, so added`,
            ms: `${skill.ms}: tiada dalam iklan jawatan, tetapi asas bagi ${names(requiredBy, 'ms')}, jadi ditambah` }
    if(kind === 'first')
        return { zh: `${skill.zh}：排在前面，因为它是${names(requiredBy, 'zh')}的基础`, en: `${skill.en}: comes first, a foundation of ${names(requiredBy, 'en')}`,
            ms: `${skill.ms}: didahulukan, asas bagi ${names(requiredBy, 'ms')}` }
    if(kind === 'core')
        return { zh: `${skill.zh}：两个情景下都排在前面（温和 +${m} 分，极端 +${x} 分）`, en: `${skill.en}: ranks high under both scenarios (moderate +${m}, extreme +${x})`,
            ms: `${skill.ms}: tinggi dalam kedua-dua senario (sederhana +${m}, ekstrem +${x})` }
    if(kind === 'later')
        return { zh: `${skill.zh}：两个情景下都在下降（未来价值 ${fixed(values.moderate[id])} / ${fixed(values.extreme[id])}），建议最后再学`,
            en: `${skill.en}: declining under both scenarios (future value ${fixed(values.moderate[id])} / ${fixed(values.extreme[id])}), best learnt last`,
            ms: `${skill.ms}: menurun dalam kedua-dua senario (nilai masa depan ${fixed(values.moderate[id])} / ${fixed(values.extreme[id])}), lebih baik dipelajari terakhir` }
    if(!branch)
        return { zh: `${skill.zh}：两个情景下的顺序相同（温和 +${m} 分，极端 +${x} 分）`, en: `${skill.en}: same order under both scenarios (moderate +${m}, extreme +${x})`,
            ms: `${skill.ms}: susunan sama dalam kedua-dua senario (sederhana +${m}, ekstrem +${x})` }
    if(branch === 'tie')
        return { zh: `${skill.zh}：两个情景下的加分差不多（温和 +${m} 分，极端 +${x} 分）`, en: `${skill.en}: about the same gain under both scenarios (moderate +${m}, extreme +${x})`,
            ms: `${skill.ms}: tambahan hampir sama dalam kedua-dua senario (sederhana +${m}, ekstrem +${x})` }
    const otherBranch = branch === 'extreme' ? 'moderate' : 'extreme'
    const [ own, other ] = branch === 'extreme' ? [ x, m ] : [ m, x ]
    const label = LABEL[branch], otherLabel = LABEL[otherBranch]
    return { zh: `${skill.zh}：在${label.zh}情景下更重要（${label.zh} +${own} 分，${otherLabel.zh} +${other} 分）`,
        en: `${skill.en}: matters more under the ${label.en} scenario (${label.en} +${own}, ${otherLabel.en} +${other})`,
        ms: `${skill.ms}: lebih penting dalam senario ${label.ms} (${label.ms} +${own}, ${otherLabel.ms} +${other})` }
}

/** { skillId: [ required skill ids ] } from the reviewed entries of the prerequisites file (empty when it is missing) */
export function loadPrerequisites(file = PREREQUISITES_FILE)
{
    try
    {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        const requires = {}
        for(const entry of data.entries ?? [])
            if(entry.reviewed === true && SKILLS[entry.skill])
                requires[entry.skill] = [ ...(requires[entry.skill] ?? []), ...entry.requires.filter((id) => SKILLS[id]) ]
        return requires
    }
    catch
    {
        return {}
    }
}

/** A cycle in { skillId: [ required ids ] } as the list of skills along it, or null */
export function prerequisiteCycle(requires)
{
    const state = new Map()
    const visit = (id, path) =>
    {
        if(state.get(id) === 'done')
            return null
        if(state.get(id) === 'open')
            return [ ...path.slice(path.indexOf(id)), id ]
        state.set(id, 'open')
        for(const next of requires[id] ?? [])
        {
            const cycle = visit(next, [ ...path, id ])
            if(cycle)
                return cycle
        }
        state.set(id, 'done')
        return null
    }
    for(const id of Object.keys(requires))
    {
        const cycle = visit(id, [])
        if(cycle)
            return cycle
    }
    return null
}

/**
 * Skills declining under both presets that may wait to the end, and those held back because a skill still to learn
 * (one not waiting) requires them: { later, foundations: { id: [ ids requiring it ] } }. Held-back skills free what
 * they require in turn, so it repeats until nothing changes.
 */
function laterSkills(gaps, declining, requires)
{
    const later = new Set(declining)
    const foundations = {}
    let changed = true
    while(changed)
    {
        changed = false
        for(const id of [ ...later ])
        {
            const requiredBy = gaps.filter((other) => !later.has(other) && (requires[other] ?? []).includes(id))
            if(requiredBy.length)
            {
                later.delete(id)
                foundations[id] = requiredBy
                changed = true
            }
        }
    }
    return { later: gaps.filter((id) => later.has(id)), foundations }
}

/**
 * The career with the reviewed prerequisites of its skills added: a company's job posting may ask for a skill without
 * the one it builds on (ML frameworks without Python). An added skill takes the lower of the level the catalog career
 * asks for it and the level of the skill needing it, the weight of a nice-to-have, and lists the skills needing it
 * (prerequisiteOf). Prerequisites of added skills are added in turn.
 */
export function withPrerequisites(career, catalog = null, requires = loadPrerequisites())
{
    const skills = [ ...career.skills ]
    for(let index = 0; index < skills.length; index++)
        for(const need of requires[skills[index].id] ?? [])
        {
            const known = skills.find((skill) => skill.id === need)
            if(known)
            {
                if(known.prerequisiteOf && !known.prerequisiteOf.includes(skills[index].id))
                    known.prerequisiteOf.push(skills[index].id)
                continue
            }
            if(!SKILLS[need])
                continue
            const listed = catalog?.skills?.find((skill) => skill.id === need)?.level
            skills.push({ id: need, level: Math.min(listed ?? skills[index].level, skills[index].level), weight: 1, prerequisiteOf: [ skills[index].id ] })
        }
    return skills.length === career.skills.length ? career : { ...career, skills }
}

/** The ids in their order, each moved after the ids it requires among them (stable; a cycle keeps the given order) */
export function prerequisiteOrder(ids, requires)
{
    const rest = [ ...ids ], placed = []
    while(rest.length)
    {
        const ready = rest.findIndex((id) => !(requires[id] ?? []).some((need) => need !== id && rest.includes(need)))
        placed.push(...rest.splice(ready < 0 ? 0 : ready, 1))
    }
    return placed
}

/**
 * { core, branches: { moderate, extreme }, later, identical, gains: { preset: { id: gain } }, values, reasons: { id: { zh, en, ms } },
 *   foundations, promoted, empty } for the save's target career (or `career`: the career as targeted, customised to a
 *   company's job posting, game.targetedCareer), or null without a target
 */
export function noRegretSkeleton(save, inputs = defaultInputs(), { requires = loadPrerequisites(), career = null } = {})
{
    career ??= save.target ? getCareer(save.target.careerId) : null
    if(!career)
        return null
    const profileSkills = save.profile?.skills ?? []
    const gaps = matchCareer(career, profileSkills).skills.filter((skill) => skill.gap > 0).map((skill) => skill.id)
    const empty = { core: [], branches: { moderate: [], extreme: [] }, later: [], identical: true, gains: { moderate: {}, extreme: {} }, values: { moderate: {}, extreme: {} }, reasons: {}, foundations: {}, promoted: {} }
    if(!gaps.length)
        return { ...empty, empty: 'requirements-met' }

    const gains = {}, values = {}, status = {}
    for(const preset of PRESET_IDS)
    {
        const row = forecastCareer(career, profileSkills, { scenario: preset, ...PRESETS[preset] }, inputs)
        gains[preset] = Object.fromEntries(row.gains.map((item) => [ item.skillId, item.gain ]))
        values[preset] = Object.fromEntries(row.skills.map((skill) => [ skill.id, skill.value ]))
        status[preset] = Object.fromEntries(row.skills.map((skill) => [ skill.id, skill.status ]))
    }
    const declining = gaps.filter((id) => PRESET_IDS.every((preset) => status[preset][id] === 'declining'))
    const { later, foundations } = laterSkills(gaps, declining, requires)
    const rest = gaps.filter((id) => !later.includes(id))
    const byGain = (preset) => (a, b) => (gains[preset][b] ?? 0) - (gains[preset][a] ?? 0) || a.localeCompare(b)
    const top = Math.ceil(rest.length / 2)
    const topOf = (preset) => new Set([ ...rest ].sort(byGain(preset)).slice(0, top))
    const [ moderateTop, extremeTop ] = PRESET_IDS.map(topOf)
    const mean = (id) => ((gains.moderate[id] ?? 0) + (gains.extreme[id] ?? 0)) / 2
    const ranked = rest.filter((id) => moderateTop.has(id) && extremeTop.has(id)).sort((a, b) => mean(b) - mean(a) || a.localeCompare(b))
    // What a core skill requires joins the core (and what that requires, in turn)
    const promoted = {}
    for(let index = 0; index < ranked.length; index++)
        for(const need of requires[ranked[index]] ?? [])
            if(rest.includes(need) && !ranked.includes(need))
            {
                ranked.push(need)
                ;(promoted[need] ??= []).push(ranked[index])
            }
            else if(promoted[need] && !promoted[need].includes(ranked[index]))
                promoted[need].push(ranked[index])
    const core = prerequisiteOrder(ranked, requires)
    const others = rest.filter((id) => !core.includes(id))
    const branches = Object.fromEntries(PRESET_IDS.map((preset) => [ preset, prerequisiteOrder([ ...others ].sort(byGain(preset)), requires) ]))
    const identical = JSON.stringify(branches.moderate) === JSON.stringify(branches.extreme)
    const lastly = prerequisiteOrder(later, requires)

    const reasons = {}
    for(const id of core)
        reasons[id] = reason('core', id, gains, values)
    for(const id of lastly)
        reasons[id] = reason('later', id, gains, values)
    // A skill matters more under the scenario where its gain is higher; with identical branches there is no fork to explain
    for(const id of others)
    {
        const lead = (gains.extreme[id] ?? 0) - (gains.moderate[id] ?? 0)
        reasons[id] = reason('branch', id, gains, values, identical ? null : Math.abs(lead) < 0.1 ? 'tie' : lead > 0 ? 'extreme' : 'moderate')
    }
    // Why a declining skill is not last says more than its place among the others
    for(const [ id, requiredBy ] of Object.entries(foundations))
        reasons[id] = reason('foundation', id, gains, values, null, requiredBy)
    for(const [ id, requiredBy ] of Object.entries(promoted))
        if(!foundations[id])
            reasons[id] = reason('first', id, gains, values, null, requiredBy)
    // Skills the career as targeted did not ask for, added as prerequisites (withPrerequisites): that is the first thing to say
    const added = Object.fromEntries(career.skills.filter((skill) => skill.prerequisiteOf && gaps.includes(skill.id)).map((skill) => [ skill.id, skill.prerequisiteOf ]))
    for(const [ id, requiredBy ] of Object.entries(added))
        reasons[id] = reason('added', id, gains, values, null, requiredBy)
    return { core, branches, later: lastly, identical, gains, values, reasons, foundations, promoted, added }
}

/** The inputs with the demand term left out (neutral): AI exposure only, kept for comparison (prompt 06) */
export const aeiOnlyInputs = (inputs = defaultInputs()) => ({ ...inputs, momentum: null })

export const ACTIVITIES = [ 'foundation', 'independent_practice', 'ai_collaboration', 'verification', 'transfer' ]
// Method parameters (assumptions, not data): each activity's weight without AI use, how far AI use moves the AI
// activities (shift) and how far it may lower the practice of fundamentals (floor: never below this share of it)
export const APPROACH = { base: { foundation: 1, independent_practice: 0.8, ai_collaboration: 0.3, verification: 0.3, transfer: 0.5 }, shift: 2, floor: 0.5 }

const ACTIVITY_NAMES = {
    foundation: { zh: '基础理解', en: 'foundation', ms: 'kefahaman asas' },
    independent_practice: { zh: '独立练习', en: 'independent practice', ms: 'latihan sendiri' },
    ai_collaboration: { zh: 'AI 协作', en: 'AI collaboration', ms: 'kerjasama dengan AI' },
    verification: { zh: '检查验证', en: 'verification', ms: 'semakan' },
    transfer: { zh: '迁移应用', en: 'transfer', ms: 'pemindahan' },
}
const percent = (value) => `${Math.round(value * 100)}%`

/** Shares of the five activities, in decreasing order, with a reason; equal under both scenarios without AI data */
function approachFrom(weights, scenario, D, detail)
{
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
    const activities = Object.fromEntries(ACTIVITIES.map((activity) => [ activity, Math.round(weights[activity] / total * 100) / 100 ]))
    const order = [ ...ACTIVITIES ].sort((a, b) => activities[b] - activities[a] || ACTIVITIES.indexOf(a) - ACTIVITIES.indexOf(b))
    const label = LABEL[scenario]
    const list = (lang) => order.map((activity) => `${ACTIVITY_NAMES[activity][lang]} ${percent(activities[activity])}`).join(lang === 'zh' ? '、' : ', ')
    return {
        scenario, activities, order,
        reason: {
            zh: `${label.zh}情景（${PRESETS[scenario].H} 年后相关任务约 ${percent(D)} 用上 AI）${detail.zh}：学习时间依次分配给${list('zh')}。`,
            en: `${label.en} scenario (about ${percent(D)} of related tasks use AI after ${PRESETS[scenario].H} years)${detail.en}: learning time goes to ${list('en')}.`,
            ms: `Senario ${label.ms} (kira-kira ${percent(D)} tugas berkaitan menggunakan AI selepas ${PRESETS[scenario].H} tahun)${detail.ms}: masa belajar untuk ${list('ms')}.`,
        },
    }
}

/**
 * How to learn a skill under a scenario: five activities weighted from its automation a and augmentation u (AI
 * exposure) and the adoption D of the scenario. AI collaboration grows with u·D, verification with a·D; foundation and
 * independent practice shrink with a·D but never below APPROACH.floor of themselves. A faster scenario (larger D) moves
 * time to AI collaboration and verification by itself: nothing differs by hand.
 */
export function learningApproach(skillId, scenario, inputs = defaultInputs())
{
    const preset = PRESETS[scenario] ? scenario : 'moderate'
    const D = adoption(PRESETS[preset].k, PRESETS[preset].H)
    const row = inputs.exposure?.skills?.[skillId] ?? null
    const a = row?.automation ?? 0, u = row?.augmentation ?? 0
    const { base, shift, floor } = APPROACH
    const weights = {
        foundation: base.foundation * Math.max(floor, 1 - 0.5 * a * D),
        independent_practice: base.independent_practice * Math.max(floor, 1 - a * D),
        ai_collaboration: base.ai_collaboration * (1 + shift * u * D),
        verification: base.verification * (1 + shift * a * D),
        transfer: base.transfer,
    }
    const detail = !row
        ? { zh: '，这个技能没有 AI 使用数据，所以两个情景的学习方式相同', en: ', no AI usage data for this skill, so both scenarios learn it the same way', ms: ', tiada data penggunaan AI bagi kemahiran ini, jadi kedua-dua senario sama' }
        : { zh: `，AI 自动化程度 ${a}、增强程度 ${u}${row.mock ? '（推算的模拟数据）' : ''}`, en: `, AI automation ${a}, augmentation ${u}${row.mock ? ' (imputed mock data)' : ''}`,
            ms: `, automasi AI ${a}, penambahan ${u}${row.mock ? ' (data olok-olok yang dianggar)' : ''}` }
    return { skillId, ...approachFrom(weights, preset, D, detail), mock: row?.mock === true, known: Boolean(row) }
}

/** The approach of a stage: the mean share of each activity over its skills */
export function stageApproach(skillIds, scenario, inputs = defaultInputs())
{
    const skills = skillIds.map((id) => learningApproach(id, scenario, inputs))
    const preset = PRESETS[scenario] ? scenario : 'moderate'
    const D = adoption(PRESETS[preset].k, PRESETS[preset].H)
    const weights = Object.fromEntries(ACTIVITIES.map((activity) => [ activity, skills.reduce((sum, skill) => sum + skill.activities[activity], 0) / Math.max(1, skills.length) ]))
    const detail = { zh: '', en: '', ms: '' }
    return { ...approachFrom(weights, preset, D, detail), mock: skills.some((skill) => skill.mock) }
}

const PURPOSE = {
    zh: '项目模型算出的学习优先顺序：根据 AI 使用数据估算每个技能对目标职业的加分。它不是 AI 发展速度的证据。',
    en: "A learning priority computed by the project's model: each skill's gain for the target career, estimated from AI usage data. It is not evidence of how fast AI develops.",
    ms: 'Keutamaan pembelajaran yang dikira oleh model projek: tambahan setiap kemahiran bagi kerjaya sasaran, dianggar daripada data penggunaan AI. Ia bukan bukti kepantasan perkembangan AI.',
}
const DEMAND = {
    neutral: {
        zh: '第一版没有纳入招聘需求的变化：这一项一律当作不变。',
        en: 'The first version leaves out changes in hiring demand: that term is held constant.',
        ms: 'Versi pertama tidak mengambil kira perubahan permintaan pengambilan: istilah itu dianggap tetap.',
    },
    momentum: {
        zh: '纳入招聘需求的变化（累积采集的职位样本；真实月份不足 3 个时，用标明的模拟月份补齐）。',
        en: 'Includes changes in hiring demand (accumulated posting samples; marked mock months fill in while fewer than 3 real months exist).',
        ms: 'Mengambil kira perubahan permintaan pengambilan (sampel iklan terkumpul; bulan olok-olok bertanda mengisi selagi kurang daripada 3 bulan sebenar).',
    },
}

/**
 * The learning priority given to the roadmap AI (its modelAnalysis.skillPriority): the No-Regret skeleton on AI
 * exposure and hiring demand (demand 'momentum', the default), or on AI exposure only (demand 'neutral'), with how to
 * learn each skill under each scenario
 */
export function skillPriority(save, { demand = 'momentum', inputs = defaultInputs(), career = null } = {})
{
    const neutral = demand === 'neutral'
    const used = neutral ? aeiOnlyInputs(inputs) : inputs
    const skeleton = noRegretSkeleton(save, used, { career })
    if(!skeleton)
        return null
    const skillIds = [ ...skeleton.core, ...new Set(Object.values(skeleton.branches).flat()), ...skeleton.later ]
    const exposure = used.exposure?.skills ?? {}
    const mockDemand = !neutral && skillIds.some((id) => used.momentum?.skills?.[id]?.mock)
    const mockExposure = skillIds.some((id) => exposure[id]?.mock)
    return {
        ...skeleton,
        approach: Object.fromEntries(PRESET_IDS.map((preset) => [ preset, Object.fromEntries(skillIds.map((id) => [ id, learningApproach(id, preset, used) ])) ])),
        evidenceRefs: skillIds.filter((id) => exposure[id]).map((id) => skillEvidenceId(id, exposure[id].mock === true)),
        assumptions: {
            demand: neutral ? 'neutral' : 'momentum',
            demandNote: DEMAND[neutral ? 'neutral' : 'momentum'],
            presets: PRESETS,
            approach: APPROACH,
            sources: neutral ? [ 'aei' ] : [ 'aei', 'posting-momentum' ],
            mock: { demand: mockDemand, exposure: mockExposure },
        },
        purpose: PURPOSE,
    }
}

/** The preset a scenario follows: its own, or for custom parameters the preset with the closer adoption speed */
export function presetOf(scenario)
{
    const preset = normalizePreset(scenario?.scenario)
    if(PRESETS[preset])
        return preset
    const k = scenario?.k ?? PRESETS.moderate.k
    return PRESET_IDS.reduce((best, preset) => Math.abs(PRESETS[preset].k - k) < Math.abs(PRESETS[best].k - k) ? preset : best, PRESET_IDS[0])
}

const STAGE_LIMIT = { core: 3, branch: 2, later: 1 }

/** Skills in stages of one, merged in neighbouring pairs when a kind has more skills than stages */
function chunk(ids, limit)
{
    const size = Math.max(1, Math.ceil(ids.length / limit))
    const stages = []
    for(let start = 0; start < ids.length; start += size)
        stages.push(ids.slice(start, start + size))
    return stages
}

/**
 * The stages of the skeleton, in roadmap order: { kind, branch, skillIds, basis, gains, after } where `after` is how the
 * stage waits: 'previous' (the stage before in the same line), 'core-end' (first stage of a branch) or 'branch-end'
 * (the later stages, after the chosen branch). Identical branches make one line: their stages join the core.
 */
export function skeletonStages(skeleton)
{
    const stage = (kind, branch, skillIds) => ({ kind, branch, skillIds,
        basis: skillIds.map((id) => skeleton.reasons[id]),
        gains: Object.fromEntries(skillIds.map((id) => [ id, { moderate: skeleton.gains.moderate[id] ?? 0, extreme: skeleton.gains.extreme[id] ?? 0 } ])) })
    const coreIds = skeleton.identical ? [ ...skeleton.core, ...skeleton.branches.moderate ] : skeleton.core
    const stages = chunk(coreIds, STAGE_LIMIT.core + (skeleton.identical ? STAGE_LIMIT.branch : 0)).map((ids) => stage('core', null, ids))
    if(!skeleton.identical)
        for(const preset of PRESET_IDS)
            stages.push(...chunk(skeleton.branches[preset], STAGE_LIMIT.branch).map((ids) => stage('branch', preset, ids)))
    stages.push(...chunk(skeleton.later, STAGE_LIMIT.later).map((ids) => stage('later', null, ids)))
    return stages
}

/** Skills whose place differs between two skeletons (core set, branch orders, later set) */
export function skeletonChanges(before, after)
{
    const changed = new Set()
    const sets = (skeleton) => ({ core: new Set(skeleton.core), later: new Set(skeleton.later) })
    const [ a, b ] = [ sets(before), sets(after) ]
    for(const kind of [ 'core', 'later' ])
        for(const id of [ ...a[kind], ...b[kind] ])
            if(a[kind].has(id) !== b[kind].has(id))
                changed.add(id)
    for(const preset of PRESET_IDS)
    {
        const x = before.branches?.[preset] ?? [], y = after.branches?.[preset] ?? []
        x.forEach((id, index) => { if(y[index] !== id) changed.add(id) })
        y.forEach((id, index) => { if(x[index] !== id) changed.add(id) })
    }
    return [ ...changed ]
}
