import test from 'node:test'
import assert from 'node:assert/strict'
import { allCareers, getCareer, DEFAULT_MAP, SKILLS } from './careers.js'
import { createSave } from './store.js'
import { setTarget, view } from './game.js'
import { trendsView } from './trends.js'

test('FDE is an emerging selectable career with valid skills and an existing pet species', () => {
    const career = getCareer('forward-deployed-engineer')
    assert.ok(career?.emerging)
    assert.equal(allCareers().filter(row => row.id === career.id).length,1)
    assert.ok(career.skills.every(skill => SKILLS[skill.id]))
    const save = createSave()
    setTarget(save,{careerId:career.id,mode:'general'})
    assert.equal(save.target.careerId,career.id)
    assert.equal(save.pet.name,'Relay')
    assert.equal(save.map.length,DEFAULT_MAP.length)
    assert.ok(save.map.includes(career.id))
    assert.equal(view(save,{}).careers.find(row => row.id === career.id).emerging,true)
})

test('monthly FDE workflow observations link back to the career catalog', () => {
    const trends = trendsView({months:[{period:'2026-10',source:'fixture',careers:[{id:'forward-deployed-engineer',ads:5}],skills:[]}]})
    assert.equal(trends.careers[0].careerId,'forward-deployed-engineer')
    assert.match(trends.careers[0].name.en,/Forward Deployed Engineer/)
})
