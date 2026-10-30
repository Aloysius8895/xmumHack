/**
 * Personal update log: what changed in the market data since the player last looked, limited to what concerns them
 * (their target career, the best matches of the current scenario and the skills of their learning direction). A Refresh
 * or the daily collection adds data; this says what it means for this player.
 *
 * save.dataView = { seenAt, seenWindowAt, denominator, shares: { skillId: % }, signals: [ key ] } is taken when the
 * player marks the log as read. Changes smaller than MIN_DELTA points, or measured on fewer than MIN_SAMPLE described
 * postings on either side, are noise and are not listed.
 */
import { allCareers } from './careers.js'
import { readWindow } from './market-window.js'
import { currentSignals } from './official-signals.js'

export const MIN_DELTA = 2
export const MIN_SAMPLE = 30
const TOP = 3

const round = (value) => Math.round(value * 10) / 10
const signalKey = (signal) => `${signal.id}:${signal.signal}:${signal.sourceId}`

/** Skill shares over the window's described postings, as the market panel shows them */
export function windowShares(window)
{
    const described = (window?.postings ?? []).filter((posting) => posting.descriptionAvailable)
    const counts = {}
    for(const posting of described)
        for(const skill of posting.skills)
            counts[skill] = (counts[skill] ?? 0) + 1
    return {
        denominator: described.length,
        shares: Object.fromEntries(Object.entries(counts).map(([ id, count ]) => [ id, round(count / described.length * 100) ])),
    }
}

/** The snapshot stored when the player marks the log as read */
export function snapshot(window = readWindow(), signals = currentSignals(), now = new Date().toISOString())
{
    const { denominator, shares } = windowShares(window)
    return { seenAt: now, seenWindowAt: window?.latest?.run?.finishedAt ?? null, denominator, shares, signals: signals.map(signalKey) }
}

/** Careers that concern the player: their target, then the best matches of the forecast */
export function relevantCareers(save, forecast)
{
    const ids = [ save.target?.careerId, ...(forecast?.careers ?? []).map((career) => career.careerId) ].filter(Boolean)
    return [ ...new Set(ids) ].slice(0, save.target ? TOP + 1 : TOP)
}

/**
 * { baseline: false } before the first snapshot. Otherwise { seenAt, now, changes: [...], affectedRoadmapSkills, count }
 * change kinds: skill-share (share moved), new-postings (adverts first seen since), official (new official signal)
 */
export function updateLog(save, forecast, { window = readWindow(), signals = currentSignals() } = {})
{
    const seen = save.dataView
    if(!seen?.seenAt)
        return { baseline: false, changes: [], count: 0 }
    const careers = relevantCareers(save, forecast)
    const catalog = new Map(allCareers().map((career) => [ career.id, career ]))
    const skillCareers = new Map()
    for(const id of careers)
        for(const skill of catalog.get(id)?.skills ?? [])
            skillCareers.set(skill.id, [ ...(skillCareers.get(skill.id) ?? []), id ])
    // Skills the player said they want to learn concern them too, whichever career needs them
    for(const skillId of save.learningDirection?.skillIds ?? [])
        if(!skillCareers.has(skillId))
            skillCareers.set(skillId, [])

    const changes = []
    const now = windowShares(window)
    if(now.denominator >= MIN_SAMPLE && seen.denominator >= MIN_SAMPLE)
        for(const [ skillId, ids ] of skillCareers)
        {
            const from = seen.shares?.[skillId] ?? 0
            const to = now.shares[skillId] ?? 0
            if(Math.abs(to - from) >= MIN_DELTA)
                changes.push({ kind: 'skill-share', skillId, careers: ids, from, to, delta: round(to - from), sample: { from: seen.denominator, to: now.denominator } })
        }
    // Adverts first collected after the collection the player had seen (a count in our sample, not the whole market)
    const since = seen.seenWindowAt ?? seen.seenAt
    for(const careerId of careers)
    {
        const added = (window?.postings ?? []).filter((posting) => posting.role === careerId && Date.parse(posting.firstSeenAt) > Date.parse(since)).length
        if(added)
            changes.push({ kind: 'new-postings', careerId, added, sample: true })
    }
    const known = new Set(seen.signals ?? [])
    for(const signal of signals.filter((row) => careers.includes(row.id) && !known.has(signalKey(row))))
        changes.push({ kind: 'official', careerId: signal.id, signal: signal.signal, source: signal.source, period: signal.period, url: signal.url, page: signal.page, quote: signal.quote })

    changes.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    const changedSkills = new Set(changes.filter((change) => change.kind === 'skill-share').map((change) => change.skillId))
    const roadmapSkills = (save.roadmap?.stages ?? []).flatMap((stage) => stage.skillIds ?? [])
    return {
        baseline: true,
        seenAt: seen.seenAt,
        now: window?.latest?.run?.finishedAt ?? null,
        source: window?.latest?.scope?.sources?.map((source) => source.id).join('+') ?? null,
        careers,
        changes,
        affectedRoadmapSkills: [ ...new Set(roadmapSkills.filter((id) => changedSkills.has(id))) ],
        count: changes.length,
    }
}
