import fs from 'node:fs'
import { collectedMarket } from '../../game/server/collected-market.js'
import { marketMonthWindow } from '../../game/sources/Career/MarketWindow.js'
import { buildMockMarketHistory } from '../../game/sources/Career/MockMarketHistory.js'

const collected = collectedMarket()
if(!collected) throw new Error('Collected sample unavailable')
const periods = marketMonthWindow(7, new Date(collected.collectedAt))
const preview = buildMockMarketHistory(collected.trends, periods)
const rows = collected.trends.careers.flatMap(career => periods.map(period => {
    const observed = career.ads[collected.trends.periods.indexOf(period)]
    const archived = collected.trends.careerObservations?.[career.id]?.[period]
    const mock = preview.cells[career.id]?.[period]
    return {
        period, career_id: career.id, career_name: career.name.zh,
        value: observed ?? archived?.value ?? mock?.value ?? null, mock: observed == null && archived == null && Boolean(mock),
        origin: observed != null ? 'observed' : archived ? 'archived' : mock ? 'mock' : 'missing',
        anchor_period: mock?.anchorPeriod ?? period, anchor_value: mock?.anchorValue ?? observed,
    }
}))
const directory = new URL('../derived/history-preview/', import.meta.url)
fs.mkdirSync(directory, {recursive:true})
const metadata = {
    generatedAt: new Date().toISOString(), authorizationDate: '2026-10-24',
    purpose: 'User-authorized trend preview; mock history is not measured recruitment data.',
    visibleMockLabel: false, method: preview.method, periods,
    mockCells: preview.count, observedCells: rows.filter(row => row.origin === 'observed').length,
    archivedCells: rows.filter(row => row.origin === 'archived').length,
    sourceCollectedAt: collected.collectedAt, excludedFromGrowthAndSkills: true,
}
fs.writeFileSync(new URL('career_history_preview.json', directory), JSON.stringify({...metadata, rows}, null, 2) + '\n')
const keys = Object.keys(rows[0])
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`
fs.writeFileSync(new URL('career_history_preview.csv', directory), '\uFEFF' + [keys.map(csv).join(','), ...rows.map(row => keys.map(key => csv(row[key])).join(','))].join('\r\n') + '\r\n')
console.log(JSON.stringify(metadata))
