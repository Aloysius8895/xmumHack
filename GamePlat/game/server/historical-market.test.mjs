import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildHistoricalMarket, historicalMarket, withHistoricalMarket } from './historical-market.js'

const root = fileURLToPath(new URL('../../data/historical/2026-04_onwards/', import.meta.url))
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
const monthly = read('monthly_market_context.json')
const quarterly = read('quarterly_occupation_context.json')

test('verified sources remain independent, with unavailable monthly values null and quarters separate', () => {
    const history = historicalMarket(root)
    assert.ok(history)
    assert.equal(history.series[0].values[0], 225826)
    assert.equal(history.series[0].values[3], null)
    assert.equal(history.series[1].values[0], 78942)
    assert.equal(history.series[1].values.at(-1), null)
    assert.deepEqual(history.quarterly.occupations.find(row => row.id === 'software_developers').values, [20089, 19899])
    const trends = {sample:true,periods:['2026-10'],careers:[{id:'data-analyst',ads:[30]}],skills:[{id:'sql',share:[0]}],comparable:false}
    const combined = withHistoricalMarket(trends, history)
    assert.deepEqual(combined.historical.periods, ['2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10'])
    assert.deepEqual(combined.periods, ['2026-10'], 'market totals must not create empty career months')
    assert.deepEqual(combined.careers[0].ads, [30])
    assert.deepEqual(combined.skills[0].share, [0])
    assert.equal(combined.comparable, false)
    assert.deepEqual(trends.periods, ['2026-10'], 'response decoration does not alter the sample cache')
    const realMonths = {...trends,sample:false}
    assert.deepEqual(withHistoricalMarket(realMonths, history).periods, ['2026-10'])
    const observed = {...trends, periods:['2026-09','2026-10'], careers:[{id:'data-analyst',ads:[null,30]}], skills:[{id:'sql',share:[0,25]}]}
    const observedWithHistory = withHistoricalMarket(observed, history)
    assert.deepEqual(observedWithHistory.periods, observed.periods)
    assert.deepEqual(observedWithHistory.careers, observed.careers, 'actual missing observations remain null')
    assert.deepEqual(observedWithHistory.skills, observed.skills)
    assert.equal(withHistoricalMarket(trends, null), trends)
})

test('reject simulated records, duplicate months, unknown sources and quarterly-to-monthly allocation', () => {
    for(const changes of [{simulated:true}, {source_url:'https://example.com'}, {value:-1}, {value:undefined}])
        assert.throws(() => buildHistoricalMarket([{...monthly[0],...changes},...monthly.slice(1)], quarterly))
    assert.throws(() => buildHistoricalMarket([...monthly,monthly[0]], quarterly))
    assert.throws(() => buildHistoricalMarket(monthly, [{...quarterly[0],monthly_allocation:123},...quarterly.slice(1)]))
})

test('a changed data file without updated verification is not published', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'historical-market-'))
    try
    {
        for(const name of ['monthly_market_context.json','quarterly_occupation_context.json','verification.json'])
            fs.copyFileSync(path.join(root, name), path.join(temp, name))
        assert.ok(historicalMarket(temp))
        fs.appendFileSync(path.join(temp, 'monthly_market_context.json'), ' ')
        assert.equal(historicalMarket(temp), null)
    }
    finally
    {
        for(const name of ['monthly_market_context.json','quarterly_occupation_context.json','verification.json'])
            fs.unlinkSync(path.join(temp, name))
        fs.rmdirSync(temp)
    }
})
