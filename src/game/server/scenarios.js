/**
 * Future scenarios: an estimate of how valuable each skill will be after H years of AI adoption at speed k, and the
 * match score of every career built from it. Deterministic and decomposable: every number shown can be traced to
 * the formula below and its sources. An estimate under explicit assumptions, not a prediction.
 *
 *   adoption        D = 1 − e^(−k·H/τ)
 *   demand          T = clamp(e^(growth·H), 0.5, 2)            growth from skill-momentum.js, 1 when unknown
 *   skill value     V = T × (1 − a·D) × (1 + β·u·D)            a, u from ai-exposure.js (automation, augmentation), 0 when unknown
 *   fit             Σ w·min(cur, req)/req·V ÷ Σ w·V            w = required level × weight, as careers.matchCareer
 *   outlook         clamp(V̄·Tc − 0.5, 0, 1)                    V̄ = Σ w·V ÷ Σ w, Tc the career's demand term
 *   score           round(100 × (0.6·fit + 0.4·outlook))
 *   raise           100 × 0.6 × w·V·(req − cur)/req ÷ Σ w·V    what learning one missing skill to its level adds
 *
 * Only skill levels enter the calculation: no age, gender or other personal attribute is read.
 */
import { allCareers, SKILLS } from './careers.js'
import { currentExposure } from './ai-exposure.js'
import { currentMomentum } from './skill-momentum.js'
import { careerRecord, currentSignals } from './official-signals.js'

// D10 – D13 (skills/idea/ideas/sdc-domain1-scenarios-2026-10-29/00-README.md)
export const PRESETS = { moderate: { k: 0.6, H: 3 }, fast: { k: 1.6, H: 3 } }
export const TAU = 5
export const BETA = 0.5
export const WEIGHTS = { fit: 0.6, outlook: 0.4 }
export const RISING = 1.05
export const DECLINING = 0.95
export const LIMITS = { k: [ 0.2, 3 ], H: [ 1, 3, 5 ] }

const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits
const RANK = { low: 0, medium: 1, high: 2 }
const lowest = (levels) => levels.reduce((low, level) => RANK[level] < RANK[low] ? level : low, 'high')

export const adoption = (k, H) => 1 - Math.exp(- k * H / TAU)
export const demandTerm = (growth, H) => growth === null || growth === undefined ? 1 : clamp(Math.exp(growth * H), 0.5, 2)

/** The scenario of a save: a preset name, or explicit { k, H } inside LIMITS (anything else falls back to moderate) */
export function scenarioOf(save)
{
    const chosen = save?.scenario ?? {}
    if(PRESETS[chosen.preset])
        return { scenario: chosen.preset, ...PRESETS[chosen.preset] }
    if(validParams(chosen))
        return { scenario: 'custom', k: chosen.k, H: chosen.H }
    return { scenario: 'moderate', ...PRESETS.moderate }
}

export const validParams = ({ k, H } = {}) => typeof k === 'number' && k >= LIMITS.k[0] && k <= LIMITS.k[1] && LIMITS.H.includes(H)

/** What the formulas read: demand momentum and AI exposure, each with its source; official signals are shown beside */
export function defaultInputs()
{
    const official = currentSignals()
    return { momentum: currentMomentum({ official }), exposure: currentExposure(), official }
}

/** The future value of one skill under a scenario, with its parts and sources */
export function skillValue(id, params, inputs)
{
    const D = adoption(params.k, params.H)
    const momentum = inputs.momentum?.skills?.[id] ?? null
    const exposure = inputs.exposure?.skills?.[id] ?? null
    const growth = momentum?.growth ?? null
    const demand = demandTerm(growth, params.H)
    const automationLoss = (exposure?.automation ?? 0) * D
    const augmentationGain = BETA * (exposure?.augmentation ?? 0) * D
    const value = demand * (1 - automationLoss) * (1 + augmentationGain)
    const known = [ growth !== null, Boolean(exposure) ].filter(Boolean).length
    return {
        id,
        value: round(value),
        status: value > RISING ? 'rising' : value < DECLINING ? 'declining' : 'stable',
        parts: { demand: round(demand), automationLoss: round(automationLoss), augmentationGain: round(augmentationGain) },
        sources: {
            demand: growth === null ? null : { metric: inputs.momentum.basis?.metric ?? null, months: momentum.months, from: inputs.momentum.basis?.from ?? null, through: inputs.momentum.basis?.through ?? null },
            exposure: exposure ? { tasks: exposure.tasks, source: inputs.exposure.source } : null,
        },
        official: momentum?.official ?? [],
        confidence: known === 2 && momentum.confidence === 'high' ? 'high' : known >= 1 ? 'medium' : 'low',
    }
}

function profileLevels(profileSkills = [])
{
    const levels = new Map()
    for(const skill of profileSkills)
        if(skill?.id && skill.level > 0)
            levels.set(skill.id, Math.max(levels.get(skill.id) ?? 0, skill.level))
    return levels
}

/** One career under one scenario: score, its two parts, the skills behind them and what would raise the score */
export function forecastCareer(career, profileSkills, params, inputs, values = new Map())
{
    const levels = profileLevels(profileSkills)
    const valueOf = (id) => values.get(id) ?? values.set(id, skillValue(id, params, inputs)).get(id)
    const skills = career.skills.map((requirement) =>
    {
        const current = levels.get(requirement.id) ?? 0
        const future = valueOf(requirement.id)
        return {
            id: requirement.id, required: requirement.level, current, gap: Math.max(0, requirement.level - current),
            weight: requirement.level * requirement.weight, value: future.value, status: future.status, parts: future.parts,
            sources: future.sources, official: future.official, confidence: future.confidence,
        }
    })
    const weighted = skills.reduce((sum, skill) => sum + skill.weight * skill.value, 0)
    const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0)
    const reached = skills.reduce((sum, skill) => sum + skill.weight * skill.value * Math.min(skill.current, skill.required) / skill.required, 0)
    const fit = weighted ? reached / weighted : 0
    const careerGrowth = inputs.momentum?.careers?.[career.id]?.growth ?? null
    const outlook = clamp((totalWeight ? weighted / totalWeight : 1) * demandTerm(careerGrowth, params.H) - 0.5, 0, 1)
    const raise = skills.filter((skill) => skill.gap > 0)
        .map((skill) => ({ skillId: skill.id, gain: round(100 * WEIGHTS.fit * skill.weight * skill.value * skill.gap / skill.required / weighted, 1) }))
        .sort((a, b) => b.gain - a.gain)
    const missing = (key) => skills.filter((skill) => !skill.sources[key]).length > skills.length / 2
    return {
        careerId: career.id,
        score: Math.round(100 * (WEIGHTS.fit * fit + WEIGHTS.outlook * outlook)),
        fit: round(fit),
        outlook: round(outlook),
        weights: WEIGHTS,
        demand: { growth: careerGrowth, term: round(demandTerm(careerGrowth, params.H)) },
        // Shown beside the score, not in it: MyCOL editions and emerging-role mentions with their quotes
        official: careerRecord(inputs.official ?? [], career.id),
        skills,
        raise: raise.slice(0, 3),
        gains: raise,   // every missing skill, for the No-Regret path
        confidence: missing('exposure') || missing('demand') ? 'low' : lowest(skills.map((skill) => skill.confidence)),
        thinProfile: levels.size < 2,
    }
}

/** Every career under the save's scenario (or `params`), ranked */
export function forecast(save, params = scenarioOf(save), inputs = defaultInputs())
{
    const values = new Map()
    const careers = allCareers()
        .map((career) => forecastCareer(career, save?.profile?.skills, params, inputs, values))
        .sort((a, b) => b.score - a.score || a.careerId.localeCompare(b.careerId))
        .map((career, index) => ({ ...career, rank: index + 1 }))
    return {
        scenario: params.scenario ?? 'custom',
        params: { k: params.k, H: params.H },
        adoptionRate: round(adoption(params.k, params.H)),
        careers,
        skills: Object.keys(SKILLS).map((id) => values.get(id) ?? skillValue(id, params, inputs)),
        sources: { exposure: inputs.exposure?.source ?? null, momentum: inputs.momentum?.basis ?? null },
        estimate: true,
    }
}

/** Both presets side by side: per career its score and rank in each, for the rank-change arrows */
export function compare(save, inputs = defaultInputs())
{
    const ranks = {}
    for(const [ name, params ] of Object.entries(PRESETS))
        for(const career of forecast(save, { scenario: name, ...params }, inputs).careers)
            (ranks[career.careerId] ??= {})[name] = { score: career.score, rank: career.rank }
    return ranks
}
