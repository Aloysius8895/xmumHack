/**
 * Official Malaysian signals per career (data/official-signals/signals.json, src/data/scripts/import_official_signals.py):
 * "critical" = listed in an edition of TalentCorp's Critical Occupations List (MyCOL), "emerging" = named an emerging
 * role or listed for the first time. Positive evidence only, each with its source, edition, page and quote; a career
 * missing from an edition is not a decline (editions differ in scope).
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const SIGNALS_FILE = fileURLToPath(new URL('../../../data/official-signals/signals.json', import.meta.url))
let cache = { signature: '', value: { signals: [], sources: {} } }

export function loadSignals(file = SIGNALS_FILE)
{
    try
    {
        const stat = fs.statSync(file)
        const signature = `${file}:${stat.mtimeMs}:${stat.size}`
        if(signature === cache.signature)
            return cache.value
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        // A record without its source, page and quote is not used
        const signals = (data.signals ?? []).filter((row) => row.id && [ 'critical', 'emerging', 'declining' ].includes(row.signal) && row.url && row.page && row.quote)
        cache = { signature, value: { signals, sources: data.sources ?? {} } }
        return cache.value
    }
    catch
    {
        return cache.value
    }
}

export const currentSignals = () => loadSignals().signals

/** A career's official record: its signals, and the MyCOL editions it was listed in, oldest first */
export function careerRecord(signals, careerId)
{
    const own = signals.filter((row) => row.kind === 'career' && row.id === careerId)
    const editions = [ ...new Set(own.filter((row) => row.signal === 'critical' && row.sourceId?.startsWith('mycol')).map((row) => row.period)) ].sort()
    return { signals: own, mycol: editions, emerging: own.some((row) => row.signal === 'emerging') }
}

/**
 * A career across the MyCOL editions, oldest first: listed (with its page and quote), not listed, or limited (the
 * edition covered a few sectors only, so not being listed says nothing). Never read as a decline.
 */
export function mycolTimeline(careerId, { signals, sources } = loadSignals())
{
    return Object.entries(sources)
        .filter(([ id ]) => id.startsWith('mycol-'))
        .sort(([ , a ], [ , b ]) => a.period.localeCompare(b.period))
        .map(([ id, source ]) =>
        {
            const listed = signals.find((row) => row.kind === 'career' && row.id === careerId && row.signal === 'critical' && row.sourceId === id)
            const limited = /only/i.test(source.scope ?? '')
            return { sourceId: id, period: source.period, url: source.url, scope: source.scope ?? null,
                status: listed ? 'listed' : limited ? 'limited' : 'not-listed',
                ...(listed ? { page: listed.page, quote: listed.quote } : {}) }
        })
}
