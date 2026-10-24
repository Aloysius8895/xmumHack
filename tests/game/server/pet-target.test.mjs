import test from 'node:test'
import assert from 'node:assert/strict'
import { SKILLS, useCustom } from '../../../src/game/server/careers.js'
import { createSave } from '../../../src/game/server/store.js'
import * as game from '../../../src/game/server/game.js'

const ai = { mock: true, keyConfigured: false, model: 'test' }

// A data analyst posting that asks for SQL, Python and charts, plus two requirements outside the catalog
function posting()
{
    return {
        title: 'Data Analyst', company: 'ShopCo', summary: 'Retail analytics',
        requirements: [
            { text: 'Advanced SQL', skillId: 'sql', level: 3, priority: 'must', status: 'gap', note: '' },
            { text: 'Python for analysis', skillId: 'python', level: 3, priority: 'must', status: 'gap', note: '' },
            { text: 'Dashboards in Tableau', skillId: 'data-visualization', level: 2, priority: 'nice', status: 'gap', note: '' },
            { text: 'SQL window functions', skillId: 'sql', level: 2, priority: 'nice', status: 'gap', note: '' },
            { text: 'Retail domain knowledge', skillId: 'other', level: 2, priority: 'nice', status: 'gap', note: 'Know how stores report sales' },
            { text: '熟悉马来西亚会计准则', skillId: 'other', level: 1, priority: 'must', status: 'gap', note: '' },
        ],
    }
}

test('a customised target gives the pet the skills of the posting, not the career defaults', () =>
{
    const save = createSave()
    game.setTarget(save, { careerId: 'data-analyst', mode: 'customise', posting: posting() })
    const pet = game.view(save, ai).pet
    assert.deepEqual(pet.skills.map((skill) => [ skill.id, skill.required ]), [
        [ 'sql', 3 ], [ 'python', 3 ], [ 'data-visualization', 2 ],
        [ 'custom-retail-domain-knowledge', 2 ], [ save.target.posting.requirements[5].skillId, 1 ],
    ])
})

test('requirements outside the catalog become custom skills with card details, in any language', () =>
{
    const save = createSave()
    game.setTarget(save, { careerId: 'data-analyst', mode: 'customise', posting: posting() })
    const [ retail, standards ] = save.target.posting.requirements.slice(4).map((requirement) => requirement.skillId)
    assert.equal(retail, 'custom-retail-domain-knowledge')
    assert.match(standards, /^custom-[0-9a-f]{8}$/, 'non-Latin text gets a hash id')

    const skill = save.customSkills[retail]
    assert.deepEqual(skill.name, { zh: 'Retail domain knowledge', en: 'Retail domain knowledge', ms: 'Retail domain knowledge' })
    assert.equal(skill.detail.description.en, 'Know how stores report sales')
    assert.equal(SKILLS[standards].zh, '熟悉马来西亚会计准则')
    assert.ok(game.view(save, ai).skillDetails[retail], 'the client gets the card details')
})

test('saves customised before the change adopt their skills, and doing it again changes nothing', () =>
{
    const save = createSave()
    save.target = { careerId: 'data-analyst', mode: 'customise', posting: posting(), setAt: '2026-10-23T00:00:00.000Z' }
    useCustom(save)
    assert.equal(game.adoptPostingSkills(save), true)
    const skills = structuredClone(save.customSkills)
    assert.equal(game.adoptPostingSkills(save), false)
    assert.deepEqual(save.customSkills, skills)
    assert.equal(Object.keys(skills).length, 2)
})

test('the posting skills drive the affinity, and the general mode keeps the career defaults', () =>
{
    const save = createSave()
    save.profile.skills = [ { id: 'sql', level: 3 }, { id: 'python', level: 3 } ]
    game.setTarget(save, { careerId: 'data-analyst', mode: 'general' })
    const general = game.view(save, ai).pet
    assert.equal(general.skills.length, 7)

    game.setTarget(save, { careerId: 'data-analyst', mode: 'customise', posting: posting() })
    const customised = game.view(save, ai).pet
    // SQL and Python (must, 3 × 3 each) met; charts (nice, 2 × 1), retail (nice, 2 × 1), standards (must, 1 × 3) not
    assert.equal(customised.affinity, Math.round((9 + 9) / (9 + 9 + 2 + 2 + 3) * 100))
    assert.ok(customised.affinity > general.affinity)
})

test('degrees and years of experience are hiring conditions, not skills (zh, en, ms)', () =>
{
    const kind = (text, skillId = 'other') => game.requirementKind({ text, skillId })
    assert.equal(kind('计算机科学、信息技术或相关专业学位'), 'education')
    assert.equal(kind('具备作为机器学习工程师或类似岗位的可证明技术经验'), 'experience')
    assert.equal(kind('具备数据结构、数据建模与软件架构的基础知识'), 'skill')
    assert.equal(kind('3年以上数据分析工作经验'), 'experience')
    assert.equal(kind("Bachelor's degree in Computer Science"), 'education')
    assert.equal(kind('3+ years of experience in analytics'), 'experience')
    assert.equal(kind('Proven experience as a Data Analyst'), 'experience')
    assert.equal(kind('Experience with Kubernetes'), 'skill')
    assert.equal(kind('Ijazah Sarjana Muda dalam Sains Komputer'), 'education')
    assert.equal(kind('Sekurang-kurangnya 2 tahun pengalaman'), 'experience')
    // A catalog skill stays a skill whatever the words; the AI's label wins over the guess
    assert.equal(kind('3 years of Python', 'python'), 'skill')
    assert.equal(game.requirementKind({ text: 'Statistics degree', skillId: 'statistics', kind: 'education' }), 'education')
    assert.equal(game.requirementKind({ text: 'Bachelor in anything', skillId: 'other', kind: 'skill' }), 'skill')
})

test('education and experience requirements never reach the pet, labelled or guessed', () =>
{
    const save = createSave()
    const job = posting()
    job.requirements.push(
        { text: 'Degree in Statistics', skillId: 'statistics', level: 2, priority: 'must', status: 'gap', note: '', kind: 'education' },
        { text: '计算机科学、信息技术或相关专业学位', skillId: 'other', level: 2, priority: 'must', status: 'gap', note: '' },
        { text: '具备作为机器学习工程师或类似岗位的可证明技术经验', skillId: 'other', level: 3, priority: 'must', status: 'gap', note: '' },
    )
    game.setTarget(save, { careerId: 'data-analyst', mode: 'customise', posting: job })
    const ids = game.view(save, ai).pet.skills.map((skill) => skill.id)
    assert.ok(!ids.includes('statistics'))
    assert.equal(ids.length, 5, 'sql, python, charts and the two learnable custom skills')
    assert.deepEqual(save.target.posting.requirements.slice(-2).map((requirement) => requirement.skillId), [ 'other', 'other' ])
    assert.equal(Object.keys(save.customSkills).length, 2)
})

test('a degree made into a skill before is released from the save, a skill still used elsewhere is kept', () =>
{
    const save = createSave()
    save.customSkills = {
        'custom-degree': { name: { zh: '学位', en: '学位', ms: '学位' }, detail: { icon: 'compass', demand: 'medium', heat: 60, difficulty: 3, description: { zh: '', en: '', ms: '' } } },
        'custom-shared': { name: { zh: 'x', en: 'x', ms: 'x' }, detail: { icon: 'compass', demand: 'medium', heat: 60, difficulty: 3, description: { zh: '', en: '', ms: '' } } },
    }
    save.customCareers = [ { id: 'custom-career', skills: [ { id: 'custom-shared', level: 1, weight: 1 } ] } ]
    save.target = { careerId: 'data-analyst', mode: 'customise', setAt: '2026-10-23T00:00:00.000Z', posting: { title: 'x', company: 'y', summary: '', requirements: [
        { text: '计算机科学相关专业学位', skillId: 'custom-degree', level: 2, priority: 'must', status: 'gap', note: '' },
        { text: '5 years of experience', skillId: 'custom-shared', level: 2, priority: 'must', status: 'gap', note: '' },
    ] } }
    useCustom(save)
    assert.equal(game.adoptPostingSkills(save), true)
    assert.deepEqual(save.target.posting.requirements.map((requirement) => requirement.skillId), [ 'other', 'other' ])
    assert.deepEqual(Object.keys(save.customSkills), [ 'custom-shared' ])
    assert.equal(SKILLS['custom-degree'], undefined)
    assert.equal(game.adoptPostingSkills(save), false)
})

test('a shelved customised career keeps its posting skills', () =>
{
    const save = createSave()
    game.setTarget(save, { careerId: 'data-analyst', mode: 'customise', posting: posting() })
    game.setTarget(save, { careerId: 'ml-engineer', mode: 'general' })
    const shelved = game.targetedCareer(save, { id: 'data-analyst', skills: [] })
    assert.deepEqual(shelved.skills.slice(0, 4).map((skill) => skill.id), [ 'sql', 'python', 'data-visualization', 'custom-retail-domain-knowledge' ])
})
