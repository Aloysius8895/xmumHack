import assert from 'node:assert/strict'
import test from 'node:test'
import * as game from '../../../src/game/server/game.js'

const evidence = (en) => ({ zh: en, en, ms: en })

test('each CV extraction is a fresh assessment: earlier AI skills go, hand-added skills stay', () =>
{
    const profile = { skills: [
        { id: 'javascript', name: 'JavaScript', level: 1, evidence: evidence('Mentioned in the text.'), source: 'ai' },
        { id: 'sql', name: 'SQL', level: 3, evidence: evidence('Old CV'), source: 'ai' },
        { id: null, name: 'Mandarin tutoring', level: 2, evidence: null, source: 'manual' },
        { id: 'excel', name: 'Excel', level: 1, evidence: null, source: 'manual' },
    ] }
    game.replaceExtractedSkills(profile, [
        { skillId: 'sql', name: 'SQL', level: 2, evidence: evidence('Joins and CTEs in a project') },
        { skillId: 'python', name: 'Python', level: 2, evidence: evidence('Cleaned 5,000 job ads with pandas') },
        { skillId: 'excel', name: 'Excel', level: 2, evidence: evidence('Pivot tables for sales reports') },
    ])
    const byName = Object.fromEntries(profile.skills.map((skill) => [ skill.name, skill ]))
    assert.equal(byName.JavaScript, undefined, 'a skill the new CV does not show is gone')
    assert.equal(byName.SQL.level, 2, 'the new CV sets the level, the old higher one does not linger')
    assert.equal(byName.SQL.evidence.en, 'Joins and CTEs in a project')
    assert.equal(byName.Python.source, 'ai')
    assert.equal(byName['Mandarin tutoring'].source, 'manual', 'hand-added skills stay')
    assert.equal(byName.Excel.level, 2, 'a hand-added skill the CV also shows takes the CV evidence')
    assert.equal(profile.skills.length, 4)
})
