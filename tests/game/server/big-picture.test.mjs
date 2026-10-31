import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { MAGNITUDE, bigPicture } from '../../../src/game/server/big-picture.js'
import { SKILLS, allCareers } from '../../../src/game/server/careers.js'

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
const wefFile = read('../../../data/official-signals/wef-future-of-jobs-2025.json')
const mappingFile = read('../../../src/data/config/wef-mapping.json')

const wef = {
    jobs: { page: 19, figure: 'Figure 2.2', growing: [ 'Data People' ], declining: [ 'Clerks', 'Mixed' ] },
    skills: { page: 37, figure: 'Figure 3.4', topOnTheRise: 2, netIncrease: { 'Big data': 87, Coding: 70, Writing: 30, Hands: - 24 } },
    malaysia: { page: 168, skillsOfIncreasingUse: { Writing: 60 }, keyRoles: { Mixed: 12, Clerks: - 28 } },
}
const map = (block) => Object.fromEntries(Object.entries(block).map(([ id, item ]) => [ id, { wef: item, reviewed: true } ]))

test('a skill rises among the top skills on the rise or Malaysia\'s, declines below zero, else has no direction', () =>
{
    const result = bigPicture({ wef, signals: [], mapping: { skills: { ...map({ sql: 'Big data', excel: 'Writing', 'cooking-technique': 'Hands', python: 'Unknown' }),
        statistics: { wef: 'Coding', reviewed: false } } } })
    assert.equal(result.skills.sql.direction, 1)
    assert.equal(result.skills.sql.growth, Math.round(Math.log(1 + MAGNITUDE) * 10000) / 10000)
    assert.equal(result.skills.excel.direction, 1)                       // not top 2 worldwide, but Malaysia's
    assert.equal(result.skills.excel.sources[0].source, 'wef-2025-malaysia')
    assert.equal(result.skills['cooking-technique'].direction, - 1)
    assert.equal(result.skills.python, undefined)                        // no such WEF skill
    assert.equal(result.skills.statistics, undefined)                    // not reviewed
})

test('a career follows the WEF jobs and Malaysia\'s key roles; contradicting sources give none; MyCOL emerging fills in', () =>
{
    const signals = [ { kind: 'career', signal: 'emerging', id: 'chef', sourceId: 'mycol-2020-2021', source: 'COL 2020/2021', page: 3 },
        { kind: 'career', signal: 'critical', id: 'doctor', sourceId: 'mycol-2019-2020', source: 'COL', page: 1 } ]
    const result = bigPicture({ wef, signals, mapping: { careers: map({ 'data-analyst': 'Data People', auditor: 'Clerks', teacher: 'Mixed' }) } })
    assert.equal(result.careers['data-analyst'].direction, 1)
    assert.equal(result.careers.auditor.direction, - 1)
    assert.equal(result.careers.auditor.sources.length, 2)
    assert.equal(result.careers.teacher.direction, 0)                    // declining worldwide, growing in Malaysia
    assert.equal(result.careers.teacher.conflict, true)
    assert.equal(result.careers.chef.direction, 1)
    assert.equal(result.careers.chef.sources[0].source, 'mycol-2020-2021')
    assert.equal(result.careers.doctor, undefined)                       // critical is no direction
})

test('the WEF file holds the report\'s lists and the mapping only names its items, catalog skills and careers', () =>
{
    assert.equal(wefFile.jobs.growing.length, 15)
    assert.equal(wefFile.jobs.declining.length, 15)
    assert.equal(Object.keys(wefFile.skills.netIncrease).length, 26)
    const careers = new Set(allCareers().map((career) => career.id))
    for(const [ id, row ] of Object.entries(mappingFile.skills))
    {
        assert.ok(SKILLS[id], id)
        assert.ok(row.wef === null || row.wef in wefFile.skills.netIncrease, `${id}: ${row.wef}`)
        assert.equal(typeof row.reviewed, 'boolean')
    }
    for(const [ id, row ] of Object.entries(mappingFile.careers))
    {
        assert.ok(careers.has(id), id)
        assert.ok(row.wef === null || wefFile.jobs.growing.includes(row.wef) || wefFile.jobs.declining.includes(row.wef) || row.wef in wefFile.malaysia.keyRoles, `${id}: ${row.wef}`)
    }
    // the real directions come from reviewed entries only
    const real = bigPicture()
    for(const id of Object.keys(real.skills))
        assert.equal(mappingFile.skills[id]?.reviewed, true, id)
})
