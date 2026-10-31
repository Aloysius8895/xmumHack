import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

process.env.AI_MOCK = '1'
const { SKILL_DETAILS, relatedResources } = await import('../../../src/game/server/skill-details.js')
const { PLAIN_WRITING, resourceIndexOf, generateRoadmap } = await import('../../../src/game/server/features.js')

test('every skill has 1 to 3 learning links (https, no duplicates), or an AI study prompt instead', () =>
{
    for(const [ id, detail ] of Object.entries(SKILL_DETAILS))
    {
        if(detail.resource?.prompt)
        {
            assert.equal(detail.resources.length, 0, `${id}: prompt only`)
            continue
        }
        assert.ok(detail.resources.length >= 1 && detail.resources.length <= 3, `${id}: ${detail.resources.length} links`)
        assert.deepEqual(detail.resources[0], { open: false, ...detail.resource }, `${id}: the starting point comes first`)
        for(const resource of detail.resources)
        {
            assert.match(resource.url, /^https:\/\//, `${id}: ${resource.url}`)
            assert.ok(resource.title.trim(), `${id}: title`)
            assert.equal(typeof resource.open, 'boolean')
        }
        assert.equal(new Set(detail.resources.map((resource) => resource.url)).size, detail.resources.length, `${id}: duplicate link`)
    }
})

test('a task keeps the link it picked, an invalid or missing pick falls back to the first link', () =>
{
    assert.equal(resourceIndexOf('sql', 2), 2)
    assert.equal(resourceIndexOf('sql', 3), 0)
    assert.equal(resourceIndexOf('sql', -1), 0)
    assert.equal(resourceIndexOf('sql', undefined), 0)
    assert.equal(resourceIndexOf('sql', 1.5), 0)
    assert.equal(resourceIndexOf('auditing', 0), 0)
    assert.equal(resourceIndexOf('not-a-skill', 1), 0)
})

test('roadmap writing asks for short plain texts and never for internal numbers or links', () =>
{
    for(const banned of [ 'percentages', 'scenario names', 'AEI', 'the project model', 'R1, R2', 'learning time is split' ])
        assert.ok(PLAIN_WRITING.includes(banned), banned)
    const source = fs.readFileSync(new URL('../../../src/game/server/features.js', import.meta.url), 'utf8')
    // Generation, weekly adjustment and free planning all carry the rules and the links by index
    assert.equal(source.match(/PLAIN_WRITING/g).length >= 4, true)
    assert.equal(source.match(/describeResources\(/g).length >= 3, true)
})

test('template roadmap tasks are one short sentence with a valid link', async () =>
{
    const roadmap = await generateRoadmap({ target: { careerId: 'data-analyst', mode: 'general' }, profile: { skills: [], summary: '' },
        gaps: [ { id: 'sql', current: 0, required: 2, gap: 2 }, { id: 'python', current: 0, required: 2, gap: 2 } ], lang: 'zh' })
    for(const task of roadmap.stages.flatMap((stage) => stage.tasks))
    {
        assert.ok(task.title.zh.length <= 20, task.title.zh) // the skill's full name included
        assert.ok(task.why.zh.length <= 30 && /。$/.test(task.why.zh), task.why.zh)
        assert.ok(task.why.en.split(/\s+/).length <= 20, task.why.en)
        assert.ok(SKILL_DETAILS[task.skillId].resources[task.resourceIndex], `${task.skillId} link ${task.resourceIndex}`)
    }
})

test('a skill made from a job posting borrows the links of its topic, else of a close catalog skill, else a Wikipedia search', () =>
{
    const titles = (name, description) => relatedResources({ en: name }, { en: description }).map((resource) => resource.title)
    assert.deepEqual(titles('Natural language processing (NLP)', 'Analysing and classifying text datasets with machine learning and deep learning.'), [ 'GeeksforGeeks: NLP Tutorial', 'Hugging Face: LLM Course' ])
    assert.equal(titles('Data structures and software architecture', 'Basic understanding of data structures.')[0], 'GeeksforGeeks: DSA Tutorial')
    assert.equal(titles('Financial reporting', 'Prepare financial statements and accounting reports.')[0], 'OpenStax: Principles of Financial Accounting')
    const [ search ] = relatedResources({ en: 'Hotel front desk' }, { en: 'Check guests in and out.' })
    assert.equal(search.url, 'https://en.wikipedia.org/w/index.php?search=Hotel%20front%20desk')
    assert.deepEqual(relatedResources({ en: '' }, { en: '' }), [])
})
