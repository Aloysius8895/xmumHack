import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'market-save-'))
process.env.COLLECTED_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'market-collected-'))
const { collectedMarket } = await import('../../../src/game/server/collected-market.js')
const { view } = await import('../../../src/game/server/game.js')
const { createSave } = await import('../../../src/game/server/store.js')

function write(name, obj) { fs.writeFileSync(path.join(process.env.COLLECTED_DATA_DIR, name), JSON.stringify(obj)) }
test('collected samples update career/skill heat and trends with usable-description denominator', () => {
    const jobs = [
        {canonical_job_id:'linkedin:1',source:'linkedin',occupation_id:'data-analyst',description_quality:'usable',collected_at:'2026-10-24T00:00:00Z',company_normalized:'fixture'},
        {canonical_job_id:'indeed:2',source:'indeed',occupation_id:'data-analyst',description_quality:'missing_or_short',collected_at:'2026-10-24T00:00:00Z',company_normalized:'fixture2'},
    ]
    write('jobs.json', jobs)
    write('job_skills.json', [{canonical_job_id:'linkedin:1',skill_id:'sql'},{canonical_job_id:'linkedin:1',skill_id:'sql'},{canonical_job_id:'indeed:2',skill_id:'python'}])
    write('quality_report.json', {malaysia_jobs:2,skill_links:3,sources:{linkedin:1,indeed:1}})
    let data = collectedMarket()
    assert.equal(data.postings, 2)
    assert.equal(data.denominator, 1)
    assert.equal(data.skillMarket.sql.share, 100)
    assert.equal(data.skillMarket.python.share, 0)
    assert.equal(data.careers['data-analyst'].heat, 100)
    const state = view(createSave(), {})
    assert.equal(state.trends.demo, false)
    assert.equal(state.trends.periods.length, 1)
    assert.equal(state.skillDetails.sql.heat, 100)
    assert.equal(state.careers.find(c => c.id === 'data-analyst').market.trend, 'unknown')
    jobs.push({canonical_job_id:'linkedin:3',occupation_id:'chef',description_quality:'usable',collected_at:'2026-10-24T01:00:00Z'})
    write('jobs.json', jobs)
    assert.equal(collectedMarket().postings, 2, 'inconsistent generation keeps previous snapshot')
    write('quality_report.json', {malaysia_jobs:3,skill_links:3,sources:{linkedin:2,indeed:1}})
    data = collectedMarket()
    assert.equal(data.postings, 3)
    assert.equal(data.skillMarket.sql.share, 50)
    assert.equal(data.careers['data-analyst'].heat, 66.7)
    assert.equal(data.skills.skills[0].change, null)
})
