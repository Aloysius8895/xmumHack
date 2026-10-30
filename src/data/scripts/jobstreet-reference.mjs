/**
 * Stage 2 of the JobStreet 2025 reference (stage 1: import_jobstreet_reference.py): every row goes through the
 * crawler's own normalize() with the crawler's game config, so careers and skills are found exactly as in our
 * LinkedIn / Indeed collection. Writes, in data/reference/jobstreet-2025:
 *   reference.json   per career: postings, by month, described postings, skill shares (the heatmap's reference column)
 *   candidates.json  per candidate career (data/reference/career-candidates.json): counts, rule precision against
 *                    JobStreet's own category, overlaps, entry-level share, skills (for the career selection)
 *
 * node src/data/scripts/jobstreet-reference.mjs [--root data/reference/jobstreet-2025]
 */
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { gameConfig } from '../../crawler/src/game-config.js'
import { normalize } from '../../crawler/src/normalize.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url))
const CANDIDATES = path.join(REPO, 'data', 'reference', 'career-candidates.json')
const TOP_SKILLS = 15
const ENTRY_TITLE = /\b(graduates?|fresh|junior|jr\.?|trainee|entry[ -]level|assistant)\b/i
const ENTRY_TEXT = /fresh graduates?|\b0\s*(?:-|–|to)\s*[12]\s*years?|no (?:prior |working )?experience (?:is )?(?:required|needed)/i

const round = (value) => Math.round(value * 1000) / 10
const bump = (counts, key, by = 1) => { counts[key] = (counts[key] ?? 0) + by }
const shares = (counts, total, limit = Infinity) => Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([ id, n ]) => [ id, round(n / total) ]))

/** Careers of the game plus the candidates, as crawler roles (candidates are matched but never chosen as the role) */
export function configs(candidates)
{
    const base = gameConfig()
    const extra = Object.entries(candidates).map(([ id, row ]) => ({ id: `candidate:${id}`, name: row.name, titlePatterns: [ row.title ], queries: [ `${row.query} jobs in Malaysia` ] }))
    return { base, probe: { ...base, roles: [ ...base.roles, ...extra ] } }
}

export async function* readRows(file)
{
    const lines = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity })
    for await (const line of lines)
        if(line.trim())
            yield JSON.parse(line)
}

export async function build(rows, candidates)
{
    const { base, probe } = configs(candidates)
    const total = { postings: 0, rejected: 0, unmapped: 0, ambiguous: 0, described: 0, months: {} }
    const careers = Object.fromEntries(base.roles.map((role) => [ role.id, { postings: 0, byMonth: {}, described: 0, skills: {} } ]))
    const found = Object.fromEntries(Object.keys(candidates).map((id) => [ id, { postings: 0, byMonth: {}, inCategory: 0, categories: {}, overlaps: {}, entryLevel: 0, described: 0, skills: {}, datasetSkills: {}, examples: [] } ]))
    let from = null, to = null
    for await (const row of rows)
    {
        const job = normalize(row, 'jobstreet', base)
        if(job.rejection)
        {
            total.rejected++
            continue
        }
        total.postings++
        const month = job.postedDate?.slice(0, 7) ?? 'undated'
        bump(total.months, month)
        if(job.postedDate)
        {
            from = !from || job.postedDate < from ? job.postedDate : from
            to = !to || job.postedDate > to ? job.postedDate : to
        }
        if(job.descriptionAvailable)
            total.described++
        if(job.role === 'unmapped')
            job.roleCandidates.length > 1 ? total.ambiguous++ : total.unmapped++
        else
        {
            const career = careers[job.role]
            career.postings++
            bump(career.byMonth, month)
            if(job.descriptionAvailable)
            {
                career.described++
                job.skills.forEach((skill) => bump(career.skills, skill.id))
            }
        }

        // Candidates: the same title test with the candidate rules added
        const matched = normalize(row, 'jobstreet', probe).roleCandidates
        for(const id of matched.filter((role) => role.startsWith('candidate:')).map((role) => role.slice(10)))
        {
            const candidate = found[id]
            candidate.postings++
            bump(candidate.byMonth, month)
            bump(candidate.categories, row.category)
            if(candidates[id].expectedCategories.includes(row.category))
                candidate.inCategory++
            matched.filter((role) => role !== `candidate:${id}`).forEach((role) => bump(candidate.overlaps, role.replace('candidate:', 'candidate ')))
            if(ENTRY_TITLE.test(job.title) || ENTRY_TEXT.test(job.description))
                candidate.entryLevel++
            if(job.descriptionAvailable)
            {
                candidate.described++
                job.skills.forEach((skill) => bump(candidate.skills, skill.id))
            }
            ;(row.datasetSkills ?? []).forEach((skill) => bump(candidate.datasetSkills, skill))
            if(candidate.examples.length < 8)
                candidate.examples.push(job.title)
        }
    }

    const reference = {
        period: { from, to, note: 'Listing dates; May 2025 only runs to 05-08' },
        postings: total.postings, rejected: total.rejected, described: total.described, months: total.months,
        unmapped: total.unmapped, ambiguous: total.ambiguous,
        careers: Object.fromEntries(Object.entries(careers).map(([ id, row ]) => [ id, {
            postings: row.postings, share: round(row.postings / total.postings), byMonth: row.byMonth,
            described: row.described, skills: row.described ? shares(row.skills, row.described) : {},
        } ])),
    }
    const report = Object.fromEntries(Object.entries(found).map(([ id, row ]) => [ id, {
        name: candidates[id].name, initial: candidates[id].initial, postings: row.postings, byMonth: row.byMonth,
        precision: row.postings ? round(row.inCategory / row.postings) : null,
        categories: shares(row.categories, row.postings || 1, 5), overlaps: row.overlaps,
        entryLevel: row.postings ? round(row.entryLevel / row.postings) : null,
        described: row.described, skills: row.described ? shares(row.skills, row.described, TOP_SKILLS) : {},
        datasetSkills: shares(row.datasetSkills, row.postings || 1, TOP_SKILLS), examples: row.examples,
    } ]))
    return { reference, candidates: report }
}

if(process.argv[1] === fileURLToPath(import.meta.url))
{
    const at = process.argv.indexOf('--root')
    const root = at > 0 ? path.resolve(process.argv[at + 1]) : path.join(REPO, 'data', 'reference', 'jobstreet-2025')
    const source = JSON.parse(fs.readFileSync(path.join(root, 'source.json'), 'utf8'))
    const { candidates } = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'))
    const result = await build(readRows(path.join(root, 'raw', 'rows.jsonl')), candidates)
    const generatedAt = new Date().toISOString()
    const method = 'Careers and skills found by the crawler\'s normalize() and game config (src/crawler/src), the same rules as the LinkedIn / Indeed collection'
    fs.writeFileSync(path.join(root, 'reference.json'), JSON.stringify({ source, generatedAt, method, ...result.reference }, null, 2) + '\n')
    fs.writeFileSync(path.join(root, 'candidates.json'), JSON.stringify({ source, generatedAt, method, candidates: result.candidates }, null, 2) + '\n')
    console.log(JSON.stringify({ postings: result.reference.postings, unmapped: result.reference.unmapped, ambiguous: result.reference.ambiguous,
        careers: Object.fromEntries(Object.entries(result.reference.careers).map(([ id, row ]) => [ id, row.postings ])),
        candidates: Object.fromEntries(Object.entries(result.candidates).map(([ id, row ]) => [ id, `${row.postings} (precision ${row.precision}%, entry ${row.entryLevel}%)` ])) }, null, 1))
}
