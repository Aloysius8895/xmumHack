import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readWindow } from './market-window.js'
import { ruleGroup } from '../../data/scripts/masco-major-group.mjs'
import { stratumWeights, weightOf, weightedShare } from '../../data/scripts/weighting.mjs'

/**
 * National estimate of our own collection (prompt 01e): the window's postings weighted, like a poll to the census,
 * to DOSM's occupation structure of the latest quarter it has published, with 95% margins. Postings are placed in the
 * four strata by the title rules alone (the AI answers used offline are not deployed); a title the rules cannot place
 * keeps weight 1. Real postings only: simulated months never enter. NATIONAL_ESTIMATE=off turns it off.
 */
const DOSM_FILE = fileURLToPath(new URL('../../../data/official-signals/dosm-occupations.json', import.meta.url))
let cache = { key: null, value: null }

const round = (value) => value === null ? null : Math.round(value * 100) / 100

/** { quarter, postings, placed, careers: { id: { share, margin } }, skills: same, or null without data */
export function nationalEstimate(window = readWindow(), dosmFile = DOSM_FILE)
{
    if(process.env.NATIONAL_ESTIMATE === 'off' || !window?.postings?.length)
        return null
    try
    {
        const key = `${window.latest?.run?.id ?? ''}:${window.postings.length}:${fs.statSync(dosmFile).mtimeMs}`
        if(key === cache.key)
            return cache.value
        const dosm = JSON.parse(fs.readFileSync(dosmFile, 'utf8'))
        const quarter = Object.keys(dosm.quarters).sort().at(- 1)
        const groups = window.postings.map((posting) => ruleGroup(posting.title))
        const weights = stratumWeights(groups, dosm.quarters[quarter].shares)
        const postings = window.postings.map((posting, index) => ({ ...posting, weight: weightOf(weights, groups[index]) }))
        const described = postings.filter((posting) => posting.descriptionAvailable)
        const estimate = (rows, hit) =>
        {
            const result = weightedShare(rows, hit)
            return { share: round(result.share), margin: round(result.margin) }
        }
        const careers = Object.fromEntries([ ...new Set(postings.map((posting) => posting.role)) ].filter((id) => id && id !== 'unmapped')
            .map((id) => [ id, estimate(postings, (posting) => posting.role === id) ]))
        const skills = Object.fromEntries([ ...new Set(described.flatMap((posting) => posting.skills)) ]
            .map((id) => [ id, estimate(described, (posting) => posting.skills.includes(id)) ]))
        cache = { key, value: { quarter, postings: postings.length, placed: groups.filter(Boolean).length, careers, skills } }
        return cache.value
    }
    catch
    {
        return null
    }
}
