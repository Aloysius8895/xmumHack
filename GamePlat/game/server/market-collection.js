import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DATA_ROOT = fileURLToPath(new URL('../../data/', import.meta.url))

export class CollectionError extends Error
{
    constructor(code) { super(code); this.code = code }
}

function execute(script, args, root, log)
{
    return new Promise((resolve, reject) => {
        const child = spawn(process.env.MARKET_PYTHON ?? 'python', [path.join(root, 'scripts', script), ...args], {
            cwd: root, shell: false, windowsHide: true, timeout: 20 * 60_000,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
        })
        let stdout = ''
        child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString('utf8')).slice(-200_000); fs.appendFileSync(log, chunk) })
        child.stderr.on('data', chunk => fs.appendFileSync(log, chunk))
        child.on('error', () => reject(new CollectionError('collection-python-unavailable')))
        child.on('close', code => code === 0 ? resolve(stdout) : reject(new CollectionError('collection-command-failed')))
    })
}

export function verifyGeneration(directory)
{
    const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'))
    const jobs = read('jobs.json'), skills = read('job_skills.json'), quality = read('quality_report.json')
    const ids = new Set(jobs.map(job => job.canonical_job_id))
    const usable = new Set(jobs.filter(job => job.description_quality === 'usable').map(job => job.canonical_job_id))
    if(ids.size !== jobs.length || jobs.length !== quality.malaysia_jobs || skills.length !== quality.skill_links || skills.some(link => !usable.has(link.canonical_job_id)))
        throw new CollectionError('collection-invalid-derived-data')
    const manifest = read('artifact_manifest.json')
    for(const [name, hash] of Object.entries(manifest))
    {
        if(path.basename(name) !== name || crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex') !== hash)
            throw new CollectionError('collection-checksum-mismatch')
    }
    return { postings: jobs.length, usableDescriptions: usable.size, skillLinks: skills.length, source: Object.keys(quality.sources ?? {}).join('+') }
}

export function createCollectionRunner({ root = DATA_ROOT, runner = execute } = {})
{
    let pending = null
    let state = { status: 'idle', source: 'linkedin', requiresRapidApiKey: false }
    const statusFile = path.join(root, 'runs', 'market-collection.json')
    try
    {
        state = JSON.parse(fs.readFileSync(statusFile, 'utf8'))
        if(state.status === 'running') state = { ...state, status: 'interrupted' }
    }
    catch {}
    const update = changes => {
        state = { ...state, ...changes }
        fs.mkdirSync(path.dirname(statusFile), { recursive: true })
        const temp = statusFile + '.tmp'
        fs.writeFileSync(temp, JSON.stringify(state, null, 2) + '\n')
        fs.renameSync(temp, statusFile)
    }
    const run = () => {
        if(pending) return pending // Concurrent workflow retries share one collection, not duplicate requests.
        const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex')
        const log = path.join(root, 'runs', id + '.log')
        update({ runId: id, status: 'running', step: 'collecting', source: 'linkedin', requiresRapidApiKey: false,
            startedAt: new Date().toISOString(), finishedAt: null, error: null, summary: null, logFile: 'runs/' + id + '.log' })
        pending = (async () => {
            try
            {
                const output = await runner('collect_linkedin.py', ['--pages', '2', '--budget', '300', '--max-details', '180', '--interval', '1.5'], root, log)
                let collection
                try { collection = JSON.parse(output.trim().split(/\r?\n/).at(-1)) } catch { throw new CollectionError('collection-result-missing') }
                const raw = path.resolve(root, collection.directory)
                const rawRoot = path.resolve(root, 'raw') + path.sep
                if(!raw.startsWith(rawRoot)) throw new CollectionError('collection-invalid-output-path')
                const manifest = JSON.parse(fs.readFileSync(path.join(raw, 'manifest.json'), 'utf8'))
                // A bounded sample is expected. Failed searches or failed selected details are not publishable.
                if(manifest.searches_expected < 1 || manifest.searches_successful !== manifest.searches_expected || manifest.access_blocked || manifest.unique_source_jobs < 1 || manifest.details_successful !== manifest.details_selected)
                    throw new CollectionError('collection-incomplete-retained-previous-data')
                update({ step: 'processing', collection: { runId: manifest.run_id, observations: manifest.observations, uniqueJobs: manifest.unique_source_jobs,
                    usableDetails: manifest.details_successful, requestCount: manifest.request_count, boundedSample: true } })
                const stagingRelative = path.join('derived', id)
                const staging = path.join(root, stagingRelative)
                await runner('process_jobs.py', ['--output', stagingRelative], root, log)
                const summary = verifyGeneration(staging)
                update({ step: 'publishing' })
                const destination = path.join(root, 'processed')
                fs.mkdirSync(destination, { recursive: true })
                const files = fs.readdirSync(staging).filter(name => fs.statSync(path.join(staging, name)).isFile())
                // Publish the checksum manifest last. Readers retain the previous consistent cache meanwhile.
                files.sort((a, b) => Number(a === 'artifact_manifest.json') - Number(b === 'artifact_manifest.json'))
                for(const name of files)
                {
                    const temp = path.join(destination, name + '.' + id + '.tmp')
                    fs.copyFileSync(path.join(staging, name), temp)
                    fs.renameSync(temp, path.join(destination, name))
                }
                update({ status: 'success', step: 'finished', summary, finishedAt: new Date().toISOString() })
                return structuredClone(state)
            }
            catch(error)
            {
                const code = error instanceof CollectionError ? error.code : 'collection-failed'
                update({ status: 'failed', step: 'finished', error: code, finishedAt: new Date().toISOString() })
                throw new CollectionError(code)
            }
            finally { pending = null }
        })()
        return pending
    }
    return { run, status: () => structuredClone(state) }
}

export const marketCollector = createCollectionRunner()
