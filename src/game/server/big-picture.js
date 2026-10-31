/**
 * The big-picture direction of each skill and career (prompt 07): rising, declining or none, for shaping the MOCK
 * hiring-demand months only (src/data/scripts/mock-market-months.mjs, the heatmap's mock cells). The direction comes
 * from cited sources; how fast is a team assumption (MAGNITUDE a year). Nothing here is read by the scenario model
 * itself, only the mock months it shapes, and real months replace those as they accumulate.
 *
 *   skills   WEF Future of Jobs Report 2025 (data/official-signals/wef-future-of-jobs-2025.json) through the reviewed
 *            mapping (src/data/config/wef-mapping.json): rising when among the report's top skills on the rise (Figure
 *            3.4) or Malaysia's skills of increasing use by 2030; declining when its net increase is below zero
 *   careers  the same report's fastest-growing / fastest-declining jobs (Figure 2.2) and Malaysia's key roles by net
 *            growth; otherwise MyCOL's "emerging" signal (data/official-signals/signals.json); contradicting sources
 *            give no direction
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { currentSignals } from './official-signals.js'

export const WEF_FILE = fileURLToPath(new URL('../../../data/official-signals/wef-future-of-jobs-2025.json', import.meta.url))
export const MAPPING_FILE = fileURLToPath(new URL('../../data/config/wef-mapping.json', import.meta.url))
// Team assumption, not data: how much a rising or declining direction moves demand in a year
export const MAGNITUDE = 0.10

const readJson = (file, empty) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return empty } }
const growthOf = (direction) => direction > 0 ? Math.round(Math.log(1 + MAGNITUDE) * 10000) / 10000 : direction < 0 ? Math.round(Math.log(1 - MAGNITUDE) * 10000) / 10000 : 0

/** One direction from several sourced votes: none when they contradict */
function settle(votes)
{
    const signs = new Set(votes.map((vote) => vote.direction))
    const direction = signs.size === 1 ? [ ...signs ][0] : 0
    return { direction, growth: growthOf(direction), sources: votes, ...(signs.size > 1 ? { conflict: true } : {}) }
}

function skillVotes(item, wef)
{
    const net = wef.skills?.netIncrease ?? {}
    const top = Object.entries(net).sort((a, b) => b[1] - a[1]).slice(0, wef.skills?.topOnTheRise ?? 0).map(([ name ]) => name)
    const votes = []
    if(top.includes(item))
        votes.push({ direction: 1, source: 'wef-2025', item, value: net[item], where: `page ${wef.skills.page}, ${wef.skills.figure.split(' (')[0]}` })
    else if(typeof net[item] === 'number' && net[item] < 0)
        votes.push({ direction: - 1, source: 'wef-2025', item, value: net[item], where: `page ${wef.skills.page}, ${wef.skills.figure.split(' (')[0]}` })
    if(typeof wef.malaysia?.skillsOfIncreasingUse?.[item] === 'number')
        votes.push({ direction: 1, source: 'wef-2025-malaysia', item, value: wef.malaysia.skillsOfIncreasingUse[item], where: `page ${wef.malaysia.page}, Malaysia economy profile` })
    return votes
}

function careerVotes(item, wef)
{
    const votes = []
    const where = `page ${wef.jobs?.page}, ${wef.jobs?.figure?.split(' (')[0]}`
    if(wef.jobs?.growing?.includes(item))
        votes.push({ direction: 1, source: 'wef-2025', item, where })
    if(wef.jobs?.declining?.includes(item))
        votes.push({ direction: - 1, source: 'wef-2025', item, where })
    const net = wef.malaysia?.keyRoles?.[item]
    if(typeof net === 'number' && net !== 0)
        votes.push({ direction: Math.sign(net), source: 'wef-2025-malaysia', item, value: net, where: `page ${wef.malaysia.page}, Malaysia economy profile` })
    return votes
}

/**
 * { magnitude, skills: { id: { direction, growth, sources } }, careers: same }: direction 1, -1 or 0, growth the yearly
 * log change the mock months follow. Only reviewed mapping entries count.
 */
export function bigPicture({ wef = readJson(WEF_FILE, {}), mapping = readJson(MAPPING_FILE, {}), signals = currentSignals() } = {})
{
    const reviewed = (block) => Object.entries(block ?? {}).filter(([ , row ]) => row?.reviewed === true && row.wef)
    const skills = {}
    for(const [ id, row ] of reviewed(mapping.skills))
    {
        const votes = skillVotes(row.wef, wef)
        if(votes.length)
            skills[id] = settle(votes)
    }
    const careers = {}
    for(const [ id, row ] of reviewed(mapping.careers))
    {
        const votes = careerVotes(row.wef, wef)
        if(votes.length)
            careers[id] = settle(votes)
    }
    // MyCOL's emerging occupations, for careers the WEF report gives no direction
    for(const signal of signals ?? [])
        if(signal.kind === 'career' && signal.signal === 'emerging' && !careers[signal.id]?.direction)
            careers[signal.id] = settle([ { direction: 1, source: signal.sourceId, item: signal.id, where: `page ${signal.page}, ${signal.source}` } ])
    return { magnitude: MAGNITUDE, skills, careers }
}
