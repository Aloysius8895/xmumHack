/**
 * Year-on-year change on JobStreet: the same calendar window in both datasets (the overlap of their collection
 * windows, by month and day), postings sorted by the crawler's own normalize() and game config, as the references.
 *
 * Each year's sample is weighted to DOSM's occupation structure of its quarter (weighting.mjs, prompt 01e), like a
 * poll weighted to the census, so the comparison is about the market rather than about what each collector happened
 * to scrape (the two datasets were collected by different people and their mix differs a lot).
 *
 *   career share = weighted postings of the career / all weighted postings
 *   skill share  = weighted mentions of the skill / all weighted skill mentions (the 2025 descriptions are about
 *                  twice as long, so every skill is named more often there; the share of mentions cancels that)
 *   growth       = ln(weighted share 2025 / weighted share 2024), per year (the windows are one year apart)
 *
 * Each share has a 95% margin; a change smaller than the two margins combined is "no clear change". A career or skill
 * counted fewer than MIN_COUNT times in either year gets no trend. Writes data/reference/jobstreet-yoy.json.
 *
 * Needs the strata of the postings: run masco-classify.mjs first (its AI answers are cached).
 * node src/data/scripts/jobstreet-yoy.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gameConfig } from '../../crawler/src/game-config.js'
import { normalize } from '../../crawler/src/normalize.js'
import { readRows } from './jobstreet-reference.mjs'
import { placeAll } from './masco-classify.mjs'
import { SAMPLE_QUARTER, loadDosm, significant, stratumWeights, weightOf, weightedShare } from './weighting.mjs'

const REFERENCE = fileURLToPath(new URL('../../../data/reference/', import.meta.url))
export const MIN_COUNT = 30
const DATASETS = [ 'jobstreet-2024', 'jobstreet-2025' ]

const round = (value, digits = 4) => value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits

/** The month-day window both collections cover, e.g. { from: '03-04', to: '05-08' } */
export function commonWindow(collections)
{
    const from = collections.map((window) => window.from.slice(5)).sort().at(- 1)
    const to = collections.map((window) => window.to.slice(5)).sort()[0]
    if(from > to)
        throw new Error('the collection windows do not overlap')
    return { from, to }
}

/** Postings listed inside the window: { role, described, skills: [ id ], group } */
export async function collect(rows, config, year, window, groupOf)
{
    const postings = []
    const from = `${year}-${window.from}`, to = `${year}-${window.to}`
    for await (const row of rows)
    {
        const job = normalize(row, 'jobstreet', config)
        if(job.rejection || !job.postedDate || job.postedDate < from || job.postedDate > to)
            continue
        postings.push({ role: job.role, described: job.descriptionAvailable, skills: job.skills.map((skill) => skill.id), group: groupOf(row.sourceId) })
    }
    return postings
}

/** Postings weighted to DOSM's shares; the mentions of their skills carry the same weights */
export function weigh(postings, dosmShares)
{
    const weights = stratumWeights(postings.map((posting) => posting.group), dosmShares)
    const weighted = postings.map((posting) => ({ ...posting, weight: weightOf(weights, posting.group) }))
    const mentions = weighted.filter((posting) => posting.described).flatMap((posting) => posting.skills.map((skill) => ({ skill, weight: posting.weight })))
    return { weights, postings: weighted, mentions, unknown: postings.filter((posting) => posting.group === null).length }
}

/** One id across the two years: raw and weighted shares (%) with margins, change, growth, or why there is none */
export function change(rowsBefore, rowsAfter, hit)
{
    const side = (rows) =>
    {
        const count = rows.filter(hit).length
        const weighted = weightedShare(rows, hit)
        return { count, share: round(rows.length ? count / rows.length * 100 : null, 3), weightedShare: round(weighted.share, 3),
            margin: round(weighted.margin, 3), nEff: Math.round(weighted.nEff) }
    }
    const before = side(rowsBefore), after = side(rowsAfter)
    const row = { from: before, to: after }
    if(before.count < MIN_COUNT || after.count < MIN_COUNT)
        return { ...row, points: null, growth: null, rawGrowth: null, significant: false, reason: 'thin' }
    const clear = significant({ share: before.weightedShare, margin: before.margin }, { share: after.weightedShare, margin: after.margin })
    return { ...row, points: round(after.weightedShare - before.weightedShare, 3), growth: round(Math.log(after.weightedShare / before.weightedShare)),
        rawGrowth: round(Math.log(after.share / before.share)), significant: clear, reason: clear ? null : 'within-margin' }
}

export function compare(first, second, ids)
{
    return {
        careers: Object.fromEntries(ids.careers.map((id) => [ id, change(first.postings, second.postings, (posting) => posting.role === id) ])),
        skills: Object.fromEntries(ids.skills.map((id) => [ id, change(first.mentions, second.mentions, (mention) => mention.skill === id) ])),
    }
}

if(process.argv[1] === fileURLToPath(import.meta.url))
{
    const sources = DATASETS.map((id) => JSON.parse(fs.readFileSync(path.join(REFERENCE, id, 'source.json'), 'utf8')))
    const window = commonWindow(sources.map((source) => source.collection))
    const config = gameConfig()
    const years = sources.map((source) => Number(source.collection.from.slice(0, 4)))
    const dosm = loadDosm()
    const placed = await placeAll({ useAi: false, log: () => {} })
    const weighted = []
    for(const [ index, id ] of DATASETS.entries())
    {
        const groups = new Map(placed[id].map((row) => [ row.id, row.group ]))
        const postings = await collect(readRows(path.join(REFERENCE, id, 'raw', 'rows.jsonl')), config, years[index], window, (sourceId) => groups.get(sourceId) ?? null)
        weighted.push(weigh(postings, dosm.quarters[SAMPLE_QUARTER[id]].shares))
    }
    const ids = { careers: config.roles.map((role) => role.id), skills: config.skills.map((skill) => skill.id) }
    const result = {
        about: 'Year-on-year change of JobStreet shares in the same calendar window, each year weighted to the DOSM occupation structure of its quarter (src/data/scripts/jobstreet-yoy.mjs). A change of share in the weighted samples, with 95% margins.',
        generatedAt: new Date().toISOString(),
        sources: sources.map(({ id, name, url, revision, sha256, licence, author }) => ({ id, name, url, revision, sha256, licence, author })),
        window: { monthDay: window, from: `${years[0]}-${window.from}`, to: `${years[1]}-${window.to}`,
            periods: years.map((year) => ({ from: `${year}-${window.from}`, to: `${year}-${window.to}` })) },
        minCount: MIN_COUNT,
        weighting: DATASETS.map((id, index) => ({ dataset: id, dosmQuarter: SAMPLE_QUARTER[id],
            weights: Object.fromEntries(Object.entries(weighted[index].weights).map(([ group, weight ]) => [ group, round(weight, 3) ])),
            postings: weighted[index].postings.length, unknownStratum: weighted[index].unknown })),
        totals: weighted.map((sample, index) => ({ year: years[index], postings: sample.postings.length,
            described: sample.postings.filter((posting) => posting.described).length, mentions: sample.mentions.length })),
        metrics: { careers: 'share_of_postings_dosm_weighted', skills: 'share_of_skill_mentions_dosm_weighted' },
        ...compare(weighted[0], weighted[1], ids),
    }
    fs.writeFileSync(path.join(REFERENCE, 'jobstreet-yoy.json'), JSON.stringify(result, null, 2) + '\n')
    const shown = (block) => Object.values(block).filter((row) => row.growth !== null)
    console.log(JSON.stringify({ window: result.window.periods, weighting: result.weighting, careersWithTrend: shown(result.careers).length,
        clear: shown(result.careers).filter((row) => row.significant).length, skillsWithTrend: shown(result.skills).length,
        skillsClear: shown(result.skills).filter((row) => row.significant).length }))
    for(const [ id, row ] of Object.entries(result.careers).filter(([ , row ]) => row.growth !== null))
        console.log(`  ${id.padEnd(22)} raw ${row.from.share}% -> ${row.to.share}%  weighted ${row.from.weightedShare}±${row.from.margin} -> ${row.to.weightedShare}±${row.to.margin}  growth ${row.growth}${row.significant ? '' : ' (within margin)'}`)
}
