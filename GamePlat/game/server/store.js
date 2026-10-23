/**
 * Save file for the (single, local) player, following skills/game/save-systems:
 * plain data with a schema version, atomic write (temp file + rename) with a .bak of the last good save,
 * migrations on load, validation with a fallback to the backup
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIRECTORY = process.env.SAVE_DIR ?? path.join(here, 'data')
const FILE = path.join(DIRECTORY, 'save.json')

export const SAVE_VERSION = 4

function newPlayer()
{
    return { id: crypto.randomUUID().replaceAll('-', '').slice(0, 12), name: '' }
}

// v(n) > v(n+1), pure functions on plain data
const MIGRATIONS = {
    // Leaderboard: the player identity in friend codes, and the friends added from their codes
    1: (data) => ({ ...data, player: newPlayer(), friends: [] }),
    // Daily digests from the chat agent (server/integrations.js): skill mastery 0-100 and the digest history
    2: (data) => ({ ...data, mastery: {}, digests: [] }),
    // Mentors on the map can be swapped: the map list, the progress kept per career, AI generated careers
    3: (data) => ({ ...data, map: null, careers: {}, customCareers: [], customSkills: {}, pendingTarget: null }),
}

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
        player: newPlayer(), // { id, name } shared in the friend code
        friends: [],    // [{ id, name, points, sharedAt, addedAt }] from friend codes
        mastery: {},    // { skillId: 0-100 } from the daily digests of the chat agent
        digests: [],    // [{ date, summary, skills, at }] latest first
        challenges: [], // legacy history retained for save compatibility; no new exams are created
        map: null,      // [ careerId per NPC spot ], null = DEFAULT_MAP of server/careers.js
        careers: {},    // { careerId: { target, pet, roadmap, lastActiveAt } } progress of the careers not targeted now
        customCareers: [], // careers the AI generated (search, job postings), same shape as server/careers.js CAREERS
        customSkills: {},  // { skillId: { name: { zh, en, ms }, detail } } new skills of those careers
        pendingTarget: null, // { requestedCareerId, posting, suggestedCareerId, newCareer, at } posting fitting another career, waiting for the player
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
    if(!Array.isArray(data.logs) || !Array.isArray(data.challenges) || !Array.isArray(data.friends ?? []))
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

/**
 * Market snapshots pushed by the job market workflow (server/integrations.js), shared by every player
 * { latest: { period, source, collectedAt, careers }, previous: same | null, history: [ same, ... ] oldest first, ends with latest }
 */
const MARKET_FILE = path.join(DIRECTORY, 'market.json')

export function loadMarket()
{
    try
    {
        return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'))
    }
    catch
    {
        return { latest: null, previous: null, history: [] }
    }
}

export function saveMarket(data)
{
    fs.mkdirSync(DIRECTORY, { recursive: true })
    const temporary = MARKET_FILE + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify(data, null, 1), 'utf8')
    fs.renameSync(temporary, MARKET_FILE)
}

/**
 * Monthly job ads per career and skill shares for the trends panel (server/trends.js), shared by every player
 * { months: [ { period: 'YYYY-MM', source, collectedAt, careers: [ { id, name, ads } ], skills: [ { id, name, share } ] } ] oldest first }
 */
const TRENDS_FILE = path.join(DIRECTORY, 'trends.json')

export function loadTrends()
{
    try
    {
        const data = JSON.parse(fs.readFileSync(TRENDS_FILE, 'utf8'))
        return Array.isArray(data.months) ? data : { months: [] }
    }
    catch
    {
        return { months: [] }
    }
}

export function saveTrends(data)
{
    fs.mkdirSync(DIRECTORY, { recursive: true })
    const temporary = TRENDS_FILE + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify(data, null, 1), 'utf8')
    fs.renameSync(temporary, TRENDS_FILE)
}

export function reset()
{
    const fresh = createSave()
    save(fresh)
    return fresh
}
