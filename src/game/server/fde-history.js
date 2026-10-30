import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const defaultRoot = fileURLToPath(new URL('../../data/historical/fde_2026/', import.meta.url))
const title = /\bforward[ -]+deploy(?:ed|ment)\s+(?:(?:software|ai|genai)\s+)?engineer/i
let cached = null, signature = ''

export function buildFdeHistory(records)
{
    if(!Array.isArray(records)) throw new Error('fde-history-invalid')
    const ids = new Set(), months = Object.create(null)
    for(const row of records)
    {
        if(row.mock !== false || row.country !== 'MY' || row.career_id !== 'forward-deployed-engineer'
            || !title.test(row.title) || !/^2026-0[4-9]$/.test(row.period) || row.posted_date?.slice(0,7) !== row.period
            || !/^https:\/\//.test(row.url) || !row.canonical_id || ids.has(row.canonical_id)) throw new Error('fde-history-invalid-record')
        ids.add(row.canonical_id)
        months[row.period] ??= {value:0,origin:'archived',source:'OpenJobData'}
        months[row.period].value++
    }
    // A month without recovered advertisements remains unknown, rather than becoming an observed zero.
    return { 'forward-deployed-engineer': months }
}

export function fdeHistory(root = process.env.FDE_HISTORY_DIR ?? (process.env.SAVE_DIR || process.env.COLLECTED_DATA_DIR ? null : defaultRoot))
{
    if(!root || root === 'off') return null
    try
    {
        const files = ['observations.json','verification.json'].map(name => path.join(root,name))
        const version = root + files.map(file => { const stat=fs.statSync(file); return `${stat.mtimeMs}:${stat.size}` }).join('|')
        if(signature === version) return cached
        const buffer = fs.readFileSync(files[0])
        const verification = JSON.parse(fs.readFileSync(files[1],'utf8'))
        if(verification.artifact_sha256?.['observations.json'] !== crypto.createHash('sha256').update(buffer).digest('hex')) return null
        cached = buildFdeHistory(JSON.parse(buffer.toString('utf8')))
        signature = version
        return cached
    }
    catch { return null }
}
