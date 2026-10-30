import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFdeHistory } from '../../../src/game/server/fde-history.js'

const record = {canonical_id:'source:1',career_id:'forward-deployed-engineer',title:'Forward Deployed AI Engineer',country:'MY',posted_date:'2026-06-18',period:'2026-06',url:'https://example.com/jobs/1',mock:false}
test('dated archived FDE advertisements are grouped into their publication month, with gaps unknown', () => {
    const result = buildFdeHistory([record,{...record,canonical_id:'source:2',posted_date:'2026-07-01',period:'2026-07'}])
    assert.equal(result['forward-deployed-engineer']['2026-06'].value,1)
    assert.equal(result['forward-deployed-engineer']['2026-07'].value,1)
    assert.equal(result['forward-deployed-engineer']['2026-04'],undefined)
})
test('simulated, overseas, wrongly dated and adjacent non-FDE roles cannot enter the real historical series', () => {
    for(const patch of [{mock:true},{country:'SG'},{period:'2026-04'},{title:'Customer Support Engineer'}])
        assert.throws(() => buildFdeHistory([{...record,...patch}]))
    assert.throws(() => buildFdeHistory([record,record]))
})
