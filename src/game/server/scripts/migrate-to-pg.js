/**
 * One-off copy of the local data into PostgreSQL (DATABASE_URL): the player save, the market and trends documents
 * and the accumulated crawler window. Safe to run again: anything already in the database is left untouched.
 *
 * cd src/game && DATABASE_URL=... npm run migrate:pg
 */
import { fileURLToPath } from 'node:url'
import * as pg from '../pg-backend.js'
import * as store from '../store.js'
import { readLocalWindow } from '../market-window.js'

export async function migrate({ database = pg, local = store, localWindow = readLocalWindow, log = console.log } = {})
{
    const report = {}
    const copy = async (name, load, save, value) =>
    {
        if(value === null || value === undefined)
            return (report[name] = 'no local data')
        if((await load()).version > 0)
            return (report[name] = 'already in database, kept')
        await save(value)
        report[name] = 'copied'
    }
    await copy('save', () => database.loadSave(), (state) => database.commitSave({ state, expectedVersion: 0 }), local.load())
    for(const [ name, value ] of [ [ 'market', local.loadMarket() ], [ 'trends', local.loadTrends() ], [ 'market-window', localWindow() ] ])
        await copy(name, () => database.loadDocument(name), (payload) => database.saveDocument({ documentId: name, payload, expectedVersion: 0 }), value)
    log(JSON.stringify(report, null, 2))
    return report
}

if(process.argv[1] === fileURLToPath(import.meta.url))
{
    if(!pg.enabled())
    {
        console.error('Set DATABASE_URL first (Replit: Database tool).')
        process.exit(1)
    }
    await migrate()
    process.exit(0)
}
