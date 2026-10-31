/**
 * AI exposure of the catalog skills, 0-1: automation (AI does the task) and augmentation (AI helps a person do it).
 * Built from the Anthropic Economic Index (CC-BY) over the O*NET tasks each skill is mapped to, a mapping the team
 * reviewed (data/ai-exposure/exposure.json, written by the build script). A skill without a reviewed mapping takes
 * its imputed MOCK value (data/mock/ai-exposure.json, src/data/scripts/mock-ai-exposure.mjs, prompt 07), marked
 * mock: true; without one it is null and shown as "no source". Nothing here is estimated by a language model.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const EXPOSURE_FILE = fileURLToPath(new URL('../../../data/ai-exposure/exposure.json', import.meta.url))
export const MOCK_EXPOSURE_FILE = fileURLToPath(new URL('../../../data/mock/ai-exposure.json', import.meta.url))
const EMPTY = { skills: {}, careers: {}, source: null }
let cache = { signature: '', value: EMPTY }

const share = (value) => typeof value === 'number' && value >= 0 && value <= 1 ? value : null

const signatureOf = (file) => { try { const stat = fs.statSync(file); return `${stat.mtimeMs}:${stat.size}` } catch { return 'none' } }

/** Imputed rows for the skills without a real one: { id: { automation, augmentation, tasks: [], mock, method } } */
function mockRows(file, real)
{
    try
    {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        if(data.mock !== true)
            return {}
        const rows = {}
        for(const [ id, row ] of Object.entries(data.skills ?? {}))
        {
            const automation = share(row.automation), augmentation = share(row.augmentation)
            if(!real[id] && row.mock === true && automation !== null && augmentation !== null)
                rows[id] = { automation, augmentation, tasks: [], note: null, mock: true, method: row.method ?? null,
                    ...(Array.isArray(row.mockTasks) && row.mockTasks.length ? { mockTasks: row.mockTasks.filter(task =>
                        typeof task === 'string' ? task.trim() : task && ['zh', 'en', 'ms'].every(lang => typeof task[lang] === 'string' && task[lang].trim())) } : {}) }
        }
        return rows
    }
    catch
    {
        return {}
    }
}

/** { skills: { id: { automation, augmentation, tasks, note, mock? } }, careers: { id: { observedExposure, soc } }, source } */
export function loadExposure(file = EXPOSURE_FILE, mockFile = MOCK_EXPOSURE_FILE)
{
    try
    {
        const stat = fs.statSync(file)
        const signature = `${file}:${stat.mtimeMs}:${stat.size}:${mockFile}:${signatureOf(mockFile)}`
        if(signature === cache.signature)
            return cache.value
        const data = JSON.parse(fs.readFileSync(file, 'utf8'))
        const skills = {}
        for(const [ id, row ] of Object.entries(data.skills ?? {}))
        {
            const automation = share(row.automation), augmentation = share(row.augmentation)
            // A value without its source tasks is not used
            if(automation !== null && augmentation !== null && Array.isArray(row.tasks) && row.tasks.length)
                skills[id] = { automation, augmentation, tasks: row.tasks, note: row.note ?? null }
        }
        Object.assign(skills, mockRows(mockFile, skills))
        const value = { skills, careers: data.careers ?? {}, source: data.source ?? null }
        cache = { signature, value }
        return value
    }
    catch
    {
        // Missing or unreadable file: keep the last good table (empty before the first one)
        return cache.value
    }
}

export const currentExposure = () => loadExposure()
