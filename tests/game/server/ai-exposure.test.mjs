import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { loadExposure, EXPOSURE_FILE } from '../../../src/game/server/ai-exposure.js'
import { SKILLS } from '../../../src/game/server/careers.js'
import { aeiEvidence } from '../../../src/game/server/learning-rules.js'
import { imputeExposure } from '../../../src/data/scripts/mock-ai-exposure.mjs'

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-exposure-'))
test.after(() => fs.rmSync(directory, { recursive: true, force: true }))
const write = (name, data) => { const file = path.join(directory, name); fs.writeFileSync(file, JSON.stringify(data)); return file }

test('values need their source tasks; anything else is left out', () =>
{
    const file = write('exposure.json', { source: { name: 'AEI' }, skills: {
        sql: { automation: 0.75, augmentation: 0.2, tasks: [ 'write queries' ] },
        excel: { automation: 0.3, augmentation: 0.3, tasks: [] },          // no source task
        python: { automation: 1.4, augmentation: 0.2, tasks: [ 'code' ] }, // out of range
    } })
    const exposure = loadExposure(file, path.join(directory, 'no-mock.json'))
    assert.deepEqual(Object.keys(exposure.skills), [ 'sql' ])
    assert.equal(exposure.source.name, 'AEI')
})

test('a missing or broken file keeps the last good table', () =>
{
    const good = write('good.json', { skills: { sql: { automation: 0.5, augmentation: 0.5, tasks: [ 't' ] } } })
    const noMock = path.join(directory, 'no-mock.json')
    assert.equal(Object.keys(loadExposure(good, noMock).skills).length, 1)
    assert.equal(Object.keys(loadExposure(path.join(directory, 'missing.json'), noMock).skills).length, 1)
})

test('the game file holds only reviewed skills, each with a value and its source tasks', () =>
{
    if(!fs.existsSync(EXPOSURE_FILE))
        return
    const data = JSON.parse(fs.readFileSync(EXPOSURE_FILE, 'utf8'))
    const map = JSON.parse(fs.readFileSync(path.join(path.dirname(EXPOSURE_FILE), 'skill_task_map.json'), 'utf8'))
    for(const [ id, row ] of Object.entries(data.skills))
    {
        assert.ok(SKILLS[id], `${id} is a catalog skill`)
        assert.equal(map.skills[id]?.reviewed, true, `${id} was reviewed`)
        assert.ok(row.tasks.length > 0, `${id} has source tasks`)
    }
})

test('a mock value fills only a skill without a real one, marked mock', () =>
{
    const real = write('real.json', { skills: { sql: { automation: 0.5, augmentation: 0.5, tasks: [ 't' ] } } })
    const mock = write('mock.json', { mock: true, skills: {
        sql: { automation: 0.9, augmentation: 0.1, mock: true, method: 'career-mean-imputation' },
        git: { automation: 0.3, augmentation: 0.4, mock: true, method: 'career-mean-imputation' },
        cad: { automation: 1.5, augmentation: 0.4, mock: true },   // out of range
    } })
    const exposure = loadExposure(real, mock)
    assert.equal(exposure.skills.sql.automation, 0.5)
    assert.equal(exposure.skills.sql.mock, undefined)
    assert.deepEqual(exposure.skills.git, { automation: 0.3, augmentation: 0.4, tasks: [], note: null, mock: true, method: 'career-mean-imputation' })
    assert.equal(exposure.skills.cad, undefined)
})

test('six missing ML skills have reproducible multilingual mock examples without inventing observed evidence', () =>
{
    const read = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'))
    const real = read('../../../data/ai-exposure/exposure.json')
    const mapping = read('../../../data/ai-exposure/skill_task_map.json')
    const config = read('../../../src/data/config/mock-skill-tasks.json')
    const generated = imputeExposure(real, mapping, config.skills)
    const written = read('../../../data/mock/ai-exposure.json')
    const loaded = loadExposure()
    for(const id of ['python', 'ml-math', 'ml-frameworks', 'data-cleaning', 'mlops', 'sql'])
    {
        assert.equal(generated[id].mockTasks.length, 3)
        assert.deepEqual(written.skills[id], generated[id])
        assert.deepEqual(loaded.skills[id].tasks, [])
        assert.equal(loaded.skills[id].mock, true)
        for(const task of loaded.skills[id].mockTasks)
            for(const lang of ['zh', 'en', 'ms']) assert.ok(task[lang]?.trim())
    }
    const evidence = aeiEvidence({target: {careerId: 'ml-engineer'}, lang: 'zh'}, loaded)
    for(const row of evidence.skills)
    {
        assert.equal(row.mockTasks.length, 3)
        assert.equal(row.taskCount, 0, 'synthetic examples cannot increase direct AEI task counts')
        assert.equal(row.thinMapping, true, 'synthetic examples cannot improve evidence quality')
        assert.equal(row.mockTasks[0], config.skills[row.skillId][0].zh)
    }
    assert.equal(loaded.skills.statistics.mock, undefined)
    assert.deepEqual(loaded.skills.statistics.tasks, real.skills.statistics.tasks)
})
