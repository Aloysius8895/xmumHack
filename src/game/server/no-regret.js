/**
 * No-Regret learning path (prompt 03): which gap skills to learn first whichever scenario comes true.
 *
 *   core     the gap skills ranking in the top half by score gain under both presets, by their mean gain
 *   branches the other gap skills, ordered by their gain under each preset (moderate, fast)
 *   later    skills declining under both presets (future value below 0.95), learnt last, with the reason
 *
 * Computed in code from the scenario model (scenarios.js); the AI only writes the stage texts. Every skill carries a
 * reason in three languages, written here, never by the AI.
 */
import { getCareer, matchCareer, SKILLS } from './careers.js'
import { PRESETS, defaultInputs, forecastCareer } from './scenarios.js'

export const PRESET_IDS = Object.keys(PRESETS)

const name = (id) => SKILLS[id] ?? { zh: id, en: id, ms: id }
const fixed = (value) => value.toFixed(2)

function reason(kind, id, gains, values, branch = null)
{
    const skill = name(id)
    const m = gains.moderate[id] ?? 0, f = gains.fast[id] ?? 0
    if(kind === 'core')
        return { zh: `${skill.zh}：两个情景下都排在前面（温和 +${m} 分，快速 +${f} 分）`, en: `${skill.en}: ranks high under both scenarios (moderate +${m}, fast +${f})`,
            ms: `${skill.ms}: tinggi dalam kedua-dua senario (sederhana +${m}, pantas +${f})` }
    if(kind === 'later')
        return { zh: `${skill.zh}：两个情景下都在下降（未来价值 ${fixed(values.moderate[id])} / ${fixed(values.fast[id])}），建议最后再学`,
            en: `${skill.en}: declining under both scenarios (future value ${fixed(values.moderate[id])} / ${fixed(values.fast[id])}), best learnt last`,
            ms: `${skill.ms}: menurun dalam kedua-dua senario (nilai masa depan ${fixed(values.moderate[id])} / ${fixed(values.fast[id])}), lebih baik dipelajari terakhir` }
    if(!branch)
        return { zh: `${skill.zh}：两个情景下的顺序相同（温和 +${m} 分，快速 +${f} 分）`, en: `${skill.en}: same order under both scenarios (moderate +${m}, fast +${f})`,
            ms: `${skill.ms}: susunan sama dalam kedua-dua senario (sederhana +${m}, pantas +${f})` }
    if(branch === 'tie')
        return { zh: `${skill.zh}：两个情景下的加分差不多（温和 +${m} 分，快速 +${f} 分）`, en: `${skill.en}: about the same gain under both scenarios (moderate +${m}, fast +${f})`,
            ms: `${skill.ms}: tambahan hampir sama dalam kedua-dua senario (sederhana +${m}, pantas +${f})` }
    const [ own, other ] = branch === 'fast' ? [ f, m ] : [ m, f ]
    const label = branch === 'fast' ? { zh: '快速', en: 'fast', ms: 'pantas' } : { zh: '温和', en: 'moderate', ms: 'sederhana' }
    const otherLabel = branch === 'fast' ? { zh: '温和', en: 'moderate', ms: 'sederhana' } : { zh: '快速', en: 'fast', ms: 'pantas' }
    return { zh: `${skill.zh}：在${label.zh}情景下更重要（${label.zh} +${own} 分，${otherLabel.zh} +${other} 分）`,
        en: `${skill.en}: matters more under the ${label.en} scenario (${label.en} +${own}, ${otherLabel.en} +${other})`,
        ms: `${skill.ms}: lebih penting dalam senario ${label.ms} (${label.ms} +${own}, ${otherLabel.ms} +${other})` }
}

/**
 * { core, branches: { moderate, fast }, later, identical, gains: { preset: { id: gain } }, values, reasons: { id: { zh, en, ms } },
 *   empty } for the save's target career, or null without a target
 */
export function noRegretSkeleton(save, inputs = defaultInputs())
{
    const career = save.target ? getCareer(save.target.careerId) : null
    if(!career)
        return null
    const gaps = matchCareer(career, save.profile.skills).skills.filter((skill) => skill.gap > 0).map((skill) => skill.id)
    const empty = { core: [], branches: { moderate: [], fast: [] }, later: [], identical: true, gains: { moderate: {}, fast: {} }, values: { moderate: {}, fast: {} }, reasons: {} }
    if(!gaps.length)
        return { ...empty, empty: 'requirements-met' }

    const gains = {}, values = {}, status = {}
    for(const preset of PRESET_IDS)
    {
        const row = forecastCareer(career, save.profile.skills, { scenario: preset, ...PRESETS[preset] }, inputs)
        gains[preset] = Object.fromEntries(row.gains.map((item) => [ item.skillId, item.gain ]))
        values[preset] = Object.fromEntries(row.skills.map((skill) => [ skill.id, skill.value ]))
        status[preset] = Object.fromEntries(row.skills.map((skill) => [ skill.id, skill.status ]))
    }
    const later = gaps.filter((id) => PRESET_IDS.every((preset) => status[preset][id] === 'declining'))
    const rest = gaps.filter((id) => !later.includes(id))
    const byGain = (preset) => (a, b) => (gains[preset][b] ?? 0) - (gains[preset][a] ?? 0) || a.localeCompare(b)
    const top = Math.ceil(rest.length / 2)
    const topOf = (preset) => new Set([ ...rest ].sort(byGain(preset)).slice(0, top))
    const [ moderateTop, fastTop ] = PRESET_IDS.map(topOf)
    const mean = (id) => ((gains.moderate[id] ?? 0) + (gains.fast[id] ?? 0)) / 2
    const core = rest.filter((id) => moderateTop.has(id) && fastTop.has(id)).sort((a, b) => mean(b) - mean(a) || a.localeCompare(b))
    const others = rest.filter((id) => !core.includes(id))
    const branches = Object.fromEntries(PRESET_IDS.map((preset) => [ preset, [ ...others ].sort(byGain(preset)) ]))
    const identical = JSON.stringify(branches.moderate) === JSON.stringify(branches.fast)

    const reasons = {}
    for(const id of core)
        reasons[id] = reason('core', id, gains, values)
    for(const id of later)
        reasons[id] = reason('later', id, gains, values)
    // A skill matters more under the scenario where its gain is higher; with identical branches there is no fork to explain
    for(const id of others)
    {
        const lead = (gains.fast[id] ?? 0) - (gains.moderate[id] ?? 0)
        reasons[id] = reason('branch', id, gains, values, identical ? null : Math.abs(lead) < 0.1 ? 'tie' : lead > 0 ? 'fast' : 'moderate')
    }
    return { core, branches, later, identical, gains, values, reasons }
}

/** The preset a scenario follows: its own, or for custom parameters the preset with the closer adoption speed */
export function presetOf(scenario)
{
    if(PRESETS[scenario?.scenario])
        return scenario.scenario
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
        gains: Object.fromEntries(skillIds.map((id) => [ id, { moderate: skeleton.gains.moderate[id] ?? 0, fast: skeleton.gains.fast[id] ?? 0 } ])) })
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
