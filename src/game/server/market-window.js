/**
 * Accumulated crawler observations shared by every player: the postings seen in the last WINDOW_DAYS days across
 * runs (deduplicated by platform and platform id), monthly aggregates and the collection watermark that makes the
 * next run incremental. Scheduled runs and Refresh both merge into it; nothing is replaced by a single run.
 *
 * Stored as the 'market-window' document in PostgreSQL when configured, else as a file next to the crawler data
 * (CRAWLER_DATA_DIR, 'off' disables). Reads are synchronous from a cache so the market view stays synchronous.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as persistence from './persistence.js'

export const WINDOW_DAYS = 30
export const THIN = 30          // a month with fewer described postings than this is too small to compare
const DAY = 86_400_000
const DOCUMENT = 'market-window'
const LIMITS = { postings: 20_000, months: 24, runs: 20, receipts: 200 }

export const keyOf = (source, sourceId) => `${source}:${sourceId}`
export const malaysiaMonth = (iso) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(0, 7)
const monthStart = (period) => Date.parse(`${period}-01T00:00:00+08:00`)
const share = (count, denominator) => denominator ? Math.round(count / denominator * 1000) / 10 : null

const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [ key, stable(value[key]) ])) : value
export const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')

export function emptyWindow()
{
    return { schema: 1, scopeHash: null, latest: null, postings: [], months: [], runs: [], receipts: [], lastSuccessfulCollectionAt: null }
}

/** platform:id -> listing fingerprint, what the crawler needs to skip detail pages it already has */
export function knownListings(window)
{
    const known = {}
    for(const posting of window?.postings ?? [])
        if(posting.listingHash)
            for(const source of posting.sources)
                known[keyOf(source.source, source.sourceId)] = posting.listingHash
    return known
}

/** Postings observed during the month of `at` (Malaysia time), from the window */
function monthOf(window, scope, run)
{
    const period = malaysiaMonth(run.finishedAt)
    const observed = window.postings.filter((posting) => Date.parse(posting.lastSeenAt) >= monthStart(period))
    const described = observed.filter((posting) => posting.descriptionAvailable)
    return {
        period,
        runId: run.id,
        collectedAt: run.finishedAt,
        counts: Object.fromEntries(scope.roles.map((id) => [ id, observed.filter((posting) => posting.role === id).length ])),
        shares: Object.fromEntries(scope.skills.map((id) => [ id, share(described.filter((posting) => posting.skills.includes(id)).length, described.length) ])),
        postings: observed.length,
        denominator: described.length,
        thin: described.length < THIN,
        sources: scope.sources.map((source) => source.id),
        metric: 'postings_observed_in_month_within_window',
    }
}

/**
 * Merges a validated, fresh crawler payload (schema 1.1 full run or 1.2 increment) into a copy of the window.
 * 1.1: every job was observed. 1.2: jobs are the new and changed postings, `seen` the unchanged ones observed again.
 */
export function mergeRun(previous, payload)
{
    const window = structuredClone(previous ?? emptyWindow())
    const { run, scope } = payload
    const at = run.finishedAt
    // A different collection scope is a different sample: its months are not compared with the old ones
    if(window.scopeHash !== run.scopeHash)
        window.months = []
    window.scopeHash = run.scopeHash

    const index = new Map()
    window.postings.forEach((posting, position) => posting.sources.forEach((source) => index.set(keyOf(source.source, source.sourceId), position)))
    for(const job of payload.jobs)
    {
        const keys = job.sources.map((source) => keyOf(source.source, source.sourceId))
        const position = keys.map((key) => index.get(key)).find((found) => found !== undefined)
        const old = position === undefined ? null : window.postings[position]
        // A listing seen without its detail page never erases the description and skills already known
        const keepOld = Boolean(old?.descriptionAvailable && !job.descriptionAvailable)
        const sources = [ ...(old?.sources ?? []) ]
        for(const source of job.sources)
            if(!sources.some((known) => known.source === source.source && known.sourceId === source.sourceId))
                sources.push({ source: source.source, sourceId: source.sourceId, url: source.url ?? null })
        const posting = {
            key: old?.key ?? keys[0],
            sources,
            listingHash: job.listingHash ?? old?.listingHash ?? null,
            role: job.role,
            title: job.title,
            company: job.company,
            location: job.location,
            url: job.url ?? old?.url ?? null,
            postedAt: job.postedAt ?? old?.postedAt ?? null,
            postedDate: job.postedDate ?? old?.postedDate ?? null,
            descriptionAvailable: keepOld || job.descriptionAvailable,
            skills: keepOld ? old.skills : job.skills.map((skill) => skill.id),
            firstSeenAt: old?.firstSeenAt ?? at,
            lastSeenAt: at,
        }
        if(old)
            window.postings[position] = posting
        else
        {
            window.postings.push(posting)
            keys.forEach((key) => index.set(key, window.postings.length - 1))
        }
    }
    for(const seen of payload.seen ?? [])
    {
        const position = index.get(keyOf(seen.source, seen.sourceId))
        if(position !== undefined)
            window.postings[position].lastSeenAt = at
    }

    const cutoff = Date.parse(at) - WINDOW_DAYS * DAY
    window.postings = window.postings.filter((posting) => Date.parse(posting.lastSeenAt) >= cutoff).slice(- LIMITS.postings)
    if(!window.lastSuccessfulCollectionAt || Date.parse(run.startedAt) > Date.parse(window.lastSuccessfulCollectionAt))
        window.lastSuccessfulCollectionAt = run.startedAt

    const { jobs, seen, ...latest } = payload
    window.latest = latest
    const month = monthOf(window, scope, run)
    window.months = [ ...window.months.filter((entry) => entry.period !== month.period), month ]
        .sort((a, b) => a.period.localeCompare(b.period)).slice(- LIMITS.months)
    window.runs = [ ...window.runs, {
        id: run.id,
        trigger: run.trigger ?? 'manual',
        since: run.since ?? null,
        startedAt: run.startedAt,
        finishedAt: at,
        new: payload.delta?.new ?? null,
        changed: payload.delta?.changed ?? null,
        unchanged: payload.delta?.unchanged ?? null,
        skippedDetails: payload.delta?.skippedDetails ?? null,
        undatedAds: payload.delta?.undatedAds ?? null,
        sources: scope.sources.map((source) => source.id),
    } ].slice(- LIMITS.runs)
    return window
}

// --- Storage -------------------------------------------------------------------------------------------------

export function windowDirectory()
{
    if(process.env.CRAWLER_DATA_DIR === 'off')
        return null
    // Default: the repository's data/crawler folder (public job adverts only, no player data)
    return process.env.CRAWLER_DATA_DIR ?? (process.env.SAVE_DIR ? path.join(process.env.SAVE_DIR, 'crawler') : fileURLToPath(new URL('../../../data/crawler/', import.meta.url)))
}

export function windowFile()
{
    const directory = windowDirectory()
    return directory ? path.join(directory, 'market-window.json') : null
}

const usesDatabase = () => persistence.documentBackend(DOCUMENT) === 'postgres'
export const storageEnabled = () => usesDatabase() || Boolean(windowFile())

let cache = { window: null, version: 0, signature: '', file: '', loadedAt: 0 }

/** The single-run file written before the window existed: its latest run becomes the window's first merge */
function fromLegacy(directory)
{
    try
    {
        const envelope = JSON.parse(fs.readFileSync(path.join(directory, 'market.json'), 'utf8'))
        if(envelope.sha256 !== hash(envelope.data) || !envelope.data.latest)
            return null
        const window = mergeRun(null, envelope.data.latest)
        if(Array.isArray(envelope.data.months))
            window.months = [ ...envelope.data.months.filter((entry) => entry.period !== window.months[0]?.period), ...window.months ].sort((a, b) => a.period.localeCompare(b.period))
        window.receipts = envelope.data.receipts ?? []
        return window
    }
    catch
    {
        return null
    }
}

function readFile()
{
    const file = windowFile()
    if(!file)
        return null
    try
    {
        const stat = fs.statSync(file)
        const signature = `${file}:${stat.mtimeMs}:${stat.size}`
        if(signature === cache.signature)
            return cache.window
        const envelope = JSON.parse(fs.readFileSync(file, 'utf8'))
        if(envelope.sha256 !== hash(envelope.data))
            throw new Error('checksum')
        cache = { ...cache, window: envelope.data, signature, file }
        return envelope.data
    }
    catch(error)
    {
        if(error?.code === 'ENOENT')
        {
            const legacy = fromLegacy(path.dirname(file))
            cache = { ...cache, window: legacy, signature: '', file }
            return legacy
        }
        // Corrupt or half-written file: keep the last consistent window of this same file
        return cache.file === file ? cache.window : null
    }
}

function writeFile(window)
{
    const file = windowFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temporary = `${file}.${crypto.randomUUID()}.tmp`
    try
    {
        fs.writeFileSync(temporary, JSON.stringify({ sha256: hash(window), data: window }))
        fs.renameSync(temporary, file)
    }
    finally
    {
        if(fs.existsSync(temporary))
            fs.unlinkSync(temporary)
    }
    cache = { ...cache, window, signature: '', file }
}

/** The window stored on disk, whatever the configured storage (migration to the database reads it) */
export const readLocalWindow = () => readFile()

/** Synchronous read for the market view: the file, or the last window loaded from the database */
export function readWindow()
{
    return usesDatabase() ? cache.window : readFile()
}

export async function loadWindow()
{
    if(!usesDatabase())
        return readFile()
    const loaded = await persistence.loadDocument(DOCUMENT)
    cache = { ...cache, window: loaded.payload, version: loaded.version, loadedAt: Date.now() }
    return loaded.payload
}

/** Database mode: other instances may have merged a run, reload at most every `ttl` ms (never throws) */
export function refreshIfStale(ttl = 15_000)
{
    if(!usesDatabase() || Date.now() - cache.loadedAt < ttl)
        return
    cache.loadedAt = Date.now()
    loadWindow().catch(() => {})
}

let queue = Promise.resolve()

/**
 * Read, change and write the window, one change at a time in this process and with the document version across
 * processes (one retry after a conflict). `change(window)` returns { result, window } with window null when nothing
 * is to be written.
 */
export function updateWindow(change)
{
    const run = async () =>
    {
        for(let attempt = 0; ; attempt++)
        {
            const current = await loadWindow()
            const { result, window } = change(current)
            if(!window)
                return result
            if(!usesDatabase())
            {
                writeFile(window)
                return result
            }
            try
            {
                const saved = await persistence.saveDocument(DOCUMENT, window, cache.version)
                cache = { ...cache, window, version: saved.version, loadedAt: Date.now() }
                return result
            }
            catch(error)
            {
                if(error?.code !== 'document-version-conflict' || attempt > 0)
                    throw error
            }
        }
    }
    const next = queue.then(run, run)
    queue = next.catch(() => {})
    return next
}

/** Tests: forget the cached window */
export function resetCache()
{
    cache = { window: null, version: 0, signature: '', file: '', loadedAt: 0 }
}
