import crypto from 'node:crypto'

export class PostingWatchError extends Error
{
    constructor(code) { super(code); this.code = code }
}

export function postingSource(value)
{
    let url
    try { url = new URL(String(value)) } catch { throw new PostingWatchError('posting-source-invalid') }
    if(url.protocol !== 'https:' || url.username || url.password || url.port) throw new PostingWatchError('posting-source-invalid')
    if(['www.linkedin.com', 'my.linkedin.com', 'linkedin.com'].includes(url.hostname))
    {
        const id = url.pathname.match(/^\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1]
        if(id) return { source: 'linkedin', sourceJobId: id, sourceUrl: `https://www.linkedin.com/jobs/view/${id}`, fetchUrl: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}` }
    }
    if(['malaysia.indeed.com', 'www.indeed.com'].includes(url.hostname) && url.pathname === '/viewjob')
    {
        const id = url.searchParams.get('jk')
        if(/^[a-f0-9]{16}$/i.test(id ?? '')) return { source: 'indeed', sourceJobId: id, sourceUrl: `https://malaysia.indeed.com/viewjob?jk=${id}`, fetchUrl: `https://malaysia.indeed.com/viewjob?jk=${id}` }
    }
    throw new PostingWatchError('posting-source-unsupported')
}

export function attachPostingWatch(posting, url)
{
    const source = postingSource(url)
    if(posting?.monitor?.sourceUrl === source.sourceUrl)
        return { ...posting, sourceUrl: source.sourceUrl }
    return { ...posting, sourceUrl: source.sourceUrl, monitor: { id: crypto.randomUUID(), ...source, status: 'pending_baseline',
        acceptedHash: null, latest: null, pending: null, lastCheckedAt: null, lastError: null, changedAt: null, requiresRegeneration: false } }
}

function decode(value)
{
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—' }
    return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, code) => {
        if(code[0] !== '#') return entities[code] ?? all
        const number = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
        return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : all
    })
}

const plain = value => decode(String(value).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<(?:br|\/p|\/li|\/div|\/h[1-6])\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[\t ]+/g, ' ').replace(/\n\s*\n/g, '\n').trim()

// Bounded class extraction with balanced tags, so nested job-description divs remain intact.
function classContent(html, className)
{
    const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
    let match
    while((match = tags.exec(html)))
    {
        if(match[0].startsWith('</')) continue
        const classes = match[0].match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1]?.split(/\s+/) ?? []
        if(!classes.includes(className)) continue
        const start = tags.lastIndex, tag = match[1].toLowerCase()
        let depth = 1, next
        while((next = tags.exec(html)))
        {
            if(next[1].toLowerCase() !== tag) continue
            if(next[0].startsWith('</')) depth--
            else if(!next[0].endsWith('/>')) depth++
            if(depth === 0) return plain(html.slice(start, next.index))
        }
        return null
    }
    return null
}

export function parsePosting(html, source)
{
    let snapshot
    if(source === 'linkedin')
        snapshot = { title: classContent(html, 'top-card-layout__title'), company: classContent(html, 'topcard__org-name-link'),
            location: classContent(html, 'topcard__flavor--bullet'), description: classContent(html, 'show-more-less-html__markup') }
    else
    {
        for(const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
        {
            try
            {
                const data = JSON.parse(block[1])
                const item = (Array.isArray(data) ? data : data['@graph'] ?? [data]).find(value => value['@type'] === 'JobPosting')
                if(item) { snapshot = { title: item.title, company: item.hiringOrganization?.name ?? null, location: JSON.stringify(item.jobLocation ?? null), description: plain(item.description ?? '') }; break }
            }
            catch {}
        }
    }
    if(!snapshot?.title || !snapshot.description || snapshot.description.length < 100) throw new PostingWatchError('posting-content-unavailable')
    snapshot.status = /No longer accepting applications/i.test(plain(html)) ? 'closed' : 'unknown'
    const normalized = Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, value == null ? null : String(value).normalize('NFKC').replace(/\s+/g, ' ').trim()]))
    return { ...snapshot, hash: crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex') }
}

export async function fetchPosting(monitor, fetcher = fetch)
{
    const source = postingSource(monitor.sourceUrl) // Validate again; never fetch an arbitrary saved URL.
    const response = await fetcher(source.fetchUrl, { redirect: 'manual', signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en-US,en;q=0.8' } })
    if(!response.ok) throw new PostingWatchError([401,403,429,999].includes(response.status) ? `posting-access-${response.status}` : `posting-fetch-${response.status}`)
    const length = Number(response.headers.get('content-length'))
    if(length > 2_000_000) throw new PostingWatchError('posting-response-too-large')
    const reader = response.body.getReader()
    const chunks = []; let size = 0
    try
    {
        while(true) { const chunk = await reader.read(); if(chunk.done) break; size += chunk.value.length; if(size > 2_000_000) throw new PostingWatchError('posting-response-too-large'); chunks.push(chunk.value) }
    }
    finally { await reader.cancel().catch(() => {}) }
    return parsePosting(Buffer.concat(chunks).toString('utf8'), source.source)
}

export function applyPostingCheck(monitor, snapshot, now = new Date().toISOString())
{
    monitor.lastCheckedAt = now
    monitor.lastError = null
    const first = !monitor.acceptedHash
    if(first) monitor.acceptedHash = snapshot.hash
    const changed = snapshot.hash !== monitor.acceptedHash
    const newlyChanged = changed && snapshot.hash !== monitor.pending?.hash
    monitor.latest = snapshot
    monitor.pending = changed ? snapshot : null
    monitor.requiresRegeneration = changed
    monitor.status = changed ? 'changed' : 'unchanged'
    if(newlyChanged) monitor.changedAt = now
    return { baselineCreated: first, changed, newlyChanged }
}

export async function checkPostings(save, fetcher = fetch)
{
    const targets = [save.target, ...Object.values(save.careers ?? {}).map(item => item.target)].filter(target => target?.posting?.monitor)
    const cache = new Map()
    const result = { checkedAt: new Date().toISOString(), watching: targets.length, checked: 0, changed: 0, failed: 0, skipped: Math.max(0, targets.length - 20) }
    for(const target of targets.slice(0, 20))
    {
        const monitor = target.posting.monitor
        try
        {
            if(!cache.has(monitor.sourceUrl)) cache.set(monitor.sourceUrl, await fetchPosting(monitor, fetcher))
            const check = applyPostingCheck(monitor, cache.get(monitor.sourceUrl), result.checkedAt)
            result.checked++
            if(check.newlyChanged) result.changed++
        }
        catch(error)
        {
            monitor.lastCheckedAt = result.checkedAt
            monitor.lastError = error instanceof PostingWatchError ? error.code : 'posting-network-error'
            monitor.status = 'check_failed'
            result.failed++ // Retain pending change and previous content; failure is never a new revision.
        }
    }
    save.automation = { ...(save.automation ?? {}), postingWatch: result }
    return result
}

export function acceptPostingRevision(posting)
{
    const monitor = posting.monitor
    if(monitor?.latest) { monitor.acceptedHash = monitor.latest.hash; monitor.pending = null; monitor.requiresRegeneration = false; monitor.status = 'unchanged' }
}
