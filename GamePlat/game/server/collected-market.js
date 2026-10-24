import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allCareers, SKILLS } from './careers.js'
import * as live from './live.js'
import crypto from 'node:crypto'
import { buildSamplingDiagnostics } from './sampling-diagnostics.js'
import { fdeHistory } from './fde-history.js'
import { crawlerMarket } from './crawler-market.js'

const defaultDirectory = fileURLToPath(new URL('../../data/processed/', import.meta.url))
let cached = null
let signature = ''
let watcher = null
let watching = ''
let timer = null

function directory()
{
    return process.env.COLLECTED_DATA_DIR === 'off' ? null : process.env.COLLECTED_DATA_DIR ?? (process.env.SAVE_DIR ? null : defaultDirectory)
}

export function collectedMarket()
{
    const crawler=crawlerMarket()
    if(crawler) return crawler
    const root = directory()
    if(!root) return null
    const files = [ 'jobs.json', 'job_skills.json', 'quality_report.json' ].map(name => path.join(root, name))
    try
    {
        const manifestPath = path.join(root, 'artifact_manifest.json')
        const hasManifest = fs.existsSync(manifestPath)
        const version = [...files, ...(hasManifest ? [manifestPath] : [])].map(file => { const stat = fs.statSync(file); return `${stat.mtimeMs}:${stat.size}` }).join('|')
        if(signature === root + version)
        {
            cached = {...cached,trends:{...cached.trends,careerObservations:fdeHistory()}}
            return cached
        }
        const buffers = files.map(file => fs.readFileSync(file))
        if(hasManifest)
        {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            if(files.some((file, index) => manifest[path.basename(file)] !== crypto.createHash('sha256').update(buffers[index]).digest('hex'))) return cached
        }
        const [ jobs, links, quality ] = buffers.map(buffer => JSON.parse(buffer.toString('utf8')))
        if(!Array.isArray(jobs) || !Array.isArray(links) || jobs.length !== quality.malaysia_jobs || links.length !== quality.skill_links)
            return cached // Writer is between artifacts; keep last consistent generation.
        const unique = new Map(jobs.map(job => [ job.canonical_job_id, job ]))
        if(unique.size !== jobs.length) return cached
        const usable = jobs.filter(job => job.description_quality === 'usable')
        const usableIds = new Set(usable.map(job => job.canonical_job_id))
        const skills = new Map()
        for(const link of links)
        {
            if(!SKILLS[link.skill_id] || !usableIds.has(link.canonical_job_id)) continue
            if(!skills.has(link.skill_id)) skills.set(link.skill_id, new Set())
            skills.get(link.skill_id).add(link.canonical_job_id)
        }
        const share = (count, denominator) => denominator ? Math.round(count / denominator * 1000) / 10 : null
        const rows = [...skills].map(([ id, ids ]) => ({ id, share: share(ids.size, usable.length), count: ids.size, change: null }))
            .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))
        const collectedAt = jobs.map(job => job.collected_at).filter(Boolean).sort().at(-1) ?? null
        const period = collectedAt?.slice(0, 7) ?? new Date().toISOString().slice(0, 7)
        const meta = { sample: true, live: true, source: Object.keys(quality.sources ?? {}).join('+'), collectedAt, period,
            postings: jobs.length, denominator: usable.length, previousPeriod: null, historyStatus: 'insufficient_history',
            pendingClassification: jobs.filter(job => !job.occupation_id).length, comparable: false }
        const careers = {}
        for(const career of allCareers())
        {
            if(career.custom) continue
            const careerJobs = jobs.filter(job => job.occupation_id === career.id)
            const careerIds = new Set(careerJobs.filter(job => job.description_quality === 'usable').map(job => job.canonical_job_id))
            const perSkills = [...skills].map(([ id, ids ]) => {
                const count = [...ids].filter(id => careerIds.has(id)).length
                return { id, count, share: share(count, careerIds.size), change: null }
            }).filter(skill => skill.count > 0).sort((a, b) => b.share - a.share)
            careers[career.id] = { ...meta, postings: careerJobs.length, heat: share(careerJobs.length, jobs.length),
                companies: new Set(careerJobs.map(job => job.company_normalized).filter(Boolean)).size,
                change: null, note: null, topSkills: Object.fromEntries(perSkills.map(skill => [skill.id, skill.count])), history: [],
                skills: { ...meta, postings: careerJobs.length, denominator: careerIds.size, skills: perSkills } }
        }
        cached = { ...meta, careers, skills: { ...meta, skills: rows },
            skillMarket: Object.fromEntries(Object.keys(SKILLS).map(id => [id, { ...meta, share: rows.find(row => row.id === id)?.share ?? (usable.length ? 0 : null), change: null }])),
            trends: { ...meta, demo: false, periods: [period], careerObservations: fdeHistory(), sampling: buildSamplingDiagnostics(jobs, quality, collectedAt ?? new Date().toISOString()),
                careers: allCareers().filter(career => careers[career.id]).map(career => ({ id: career.id, careerId: career.id, name: career.name, shortName:career.shortName, emerging: Boolean(career.emerging), ads: [careers[career.id].postings] })),
                skills: rows.map(skill => ({ id: skill.id, name: SKILLS[skill.id], share: [skill.share] })) } }
        signature = root + version
        return cached
    }
    catch { return cached }
}

export function watchCollectedMarket()
{
    const root = directory()
    if(!root || root === watching || !fs.existsSync(root)) return
    watcher?.close()
    watching = root
    collectedMarket()
    watcher = fs.watch(root, { persistent: false }, (_event, filename) => {
        if(!filename || !['jobs.json', 'job_skills.json', 'quality_report.json', 'artifact_manifest.json'].includes(String(filename))) return
        clearTimeout(timer)
        timer = setTimeout(() => {
            const before = signature
            collectedMarket()
            if(signature !== before) live.changed()
        }, 500)
        timer.unref?.()
    })
    watcher.on('error', () => { watcher?.close(); watcher = null; watching = '' })
}
