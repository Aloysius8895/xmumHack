import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { careerRecord, loadSignals, SIGNALS_FILE } from '../../../src/game/server/official-signals.js'
import { allCareers } from '../../../src/game/server/careers.js'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'official-signals-'))
test.after(() => fs.rmSync(directory, { recursive: true, force: true }))

test('records without their source, page and quote are not used', () =>
{
    const file = path.join(directory, 'signals.json')
    fs.writeFileSync(file, JSON.stringify({ signals: [
        { id: 'data-analyst', kind: 'career', signal: 'critical', url: 'https://x', page: 3, quote: 'listed', period: '2024/2025', sourceId: 'mycol-2024-2025' },
        { id: 'data-analyst', kind: 'career', signal: 'critical', url: 'https://x', page: 3, quote: '' },
        { id: 'chef', kind: 'career', signal: 'hot', url: 'https://x', page: 1, quote: 'q' },
    ] }))
    assert.equal(loadSignals(file).signals.length, 1)
})

test('a career record lists its MyCOL editions oldest first and its emerging mentions', () =>
{
    const row = (period, signal = 'critical', sourceId = `mycol-${period.replace('/', '-')}`) => ({ id: 'ml-engineer', kind: 'career', signal, period, sourceId })
    const record = careerRecord([ row('2020/2021'), row('2019/2020'), row('2025', 'emerging', 'impact-phase2-vol2'), { ...row('2019/2020'), id: 'chef' } ], 'ml-engineer')
    assert.deepEqual(record.mycol, [ '2019/2020', '2020/2021' ])
    assert.equal(record.emerging, true)
    assert.equal(careerRecord([], 'teacher').mycol.length, 0)
})

test('the imported file: real careers, positive evidence only, every record quoted from its page', () =>
{
    if(!fs.existsSync(SIGNALS_FILE))
        return
    const data = JSON.parse(fs.readFileSync(SIGNALS_FILE, 'utf8'))
    const careers = new Set(allCareers().map((career) => career.id))
    for(const row of data.signals)
    {
        assert.ok(careers.has(row.id), row.id)
        assert.ok([ 'critical', 'emerging' ].includes(row.signal), 'no decline is inferred from a missing edition')
        assert.ok(row.url.startsWith('https://www.talentcorp.com.my/') && Number.isInteger(row.page) && row.quote.length > 10, `${row.id} ${row.period}`)
    }
})
