/**
 * Save file for the (single, local) player, following skills/game/save-systems:
 * plain data with a schema version, atomic write (temp file + rename) with a .bak of the last good save,
 * migrations on load, validation with a fallback to the backup
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIRECTORY = process.env.SAVE_DIR ?? path.join(here, 'data')
const FILE = path.join(DIRECTORY, 'save.json')

export const SAVE_VERSION = 1

// v(n) > v(n+1), pure functions on plain data
const MIGRATIONS = {}

export function createSave()
{
    return {
        version: SAVE_VERSION,
        lang: 'zh',
        profile: { skills: [], summary: '' },
        target: null,   // { careerId, mode: 'general' | 'customise', posting, setAt }
        pet: null,      // { careerId, name, affinity, createdAt }
        roadmap: null,  // { generatedAt, stages: [...] }
        logs: [],
        points: 0,
        challenges: [], // gym attempts, questions + hidden rubric stay on the server
    }
}

function validate(data)
{
    if(typeof data !== 'object' || data === null)
        throw new Error('save is not an object')
    if(!Number.isInteger(data.version))
        throw new Error('save has no version')
    if(!data.profile || !Array.isArray(data.profile.skills))
        throw new Error('save has no profile skills')
    if(!Array.isArray(data.logs) || !Array.isArray(data.challenges))
        throw new Error('save lists are missing')
    return data
}

function migrate(data)
{
    let version = data.version ?? 0
    if(version > SAVE_VERSION)
        throw new Error(`save version ${version} is newer than this server (${SAVE_VERSION})`)
    while(version < SAVE_VERSION)
    {
        data = MIGRATIONS[version](data)
        version++
        data.version = version
    }
    return data
}

function read(file)
{
    return validate(migrate(JSON.parse(fs.readFileSync(file, 'utf8'))))
}

export function load()
{
    if(!fs.existsSync(FILE))
        return createSave()

    try
    {
        return read(FILE)
    }
    catch(error)
    {
        console.warn(`[store] ${FILE} unreadable (${error.message}), trying the backup`)
        try
        {
            return read(FILE + '.bak')
        }
        catch
        {
            console.warn('[store] no usable backup, starting a new save')
            return createSave()
        }
    }
}

export function save(data)
{
    validate(data)
    fs.mkdirSync(DIRECTORY, { recursive: true })

    const temporary = FILE + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify(data, null, 1), 'utf8')

    // Rename over the target isn't atomic on Windows, the .bak is what guarantees recovery
    if(fs.existsSync(FILE))
        fs.copyFileSync(FILE, FILE + '.bak')
    fs.renameSync(temporary, FILE)
}

export function reset()
{
    const fresh = createSave()
    save(fresh)
    return fresh
}
