import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-inputs-'))
process.env.AI_MOCK = '1'
test.after(() => fs.rmSync(process.env.SAVE_DIR, { recursive: true, force: true }))

const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const sc = await import('../../../src/game/server/scenarios.js')
const { aeiEvidence, trendClassification, FEW_TASKS } = await import('../../../src/game/server/aei-evidence.js')
const { ACTIVITIES, aeiOnlyInputs, learningApproach, loadPrerequisites, noRegretSkeleton, prerequisiteCycle, prerequisiteOrder, skeletonStages, skillPriority, stageApproach } = await import('../../../src/game/server/no-regret.js')
const game = await import('../../../src/game/server/game.js')
const { generateRoadmap } = await import('../../../src/game/server/features.js')
const { roadmapInputs } = await import('../../../src/game/server/roadmap-inputs.js')
const { getCareer, SKILLS } = await import('../../../src/game/server/careers.js')

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
const exposureFile = read('../../../data/ai-exposure/exposure.json')
const prerequisitesFile = read('../../../src/data/config/skill-prerequisites.json')
const mockExposureFile = read('../../../data/mock/ai-exposure.json')

async function call(route, body = {})
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

const analyst = () =>
{
    const save = store.createSave()
    save.target = { careerId: 'data-analyst', mode: 'general' }
    return save
}

test('two presets only, named moderate and extreme, with the numbers kept', () =>
{
    assert.deepEqual(Object.keys(sc.PRESETS), [ 'moderate', 'extreme' ])
    assert.deepEqual(sc.PRESETS.extreme, { k: 1.6, H: 3 })
    assert.equal(sc.normalizePreset('fast'), 'extreme')
    assert.equal(sc.normalizePreset('slow'), null)
    assert.equal(sc.scenarioOf({ scenario: { preset: 'fast' } }).scenario, 'extreme')
})

test('an old save: fast becomes extreme in the scenario and every roadmap, the unchosen moderate default is dropped', () =>
{
    const roadmap = { chosenBranch: 'fast', branchChosenBy: 'scenario', forecastBasis: { core: [], branches: { moderate: [ 'sql' ], fast: [ 'excel' ] }, later: [] },
        stages: [ { id: 's1', kind: 'branch', branch: 'fast', gains: { excel: { moderate: 1, fast: 2 } }, tasks: [] } ] }
    const old = { ...store.createSave(), version: 6, scenario: { preset: 'fast' }, roadmap, careers: { 'ml-engineer': { roadmap } } }
    const save = store.normalizeSave(structuredClone(old))
    assert.equal(save.version, store.SAVE_VERSION)
    assert.deepEqual(save.scenario, { preset: 'extreme' })
    for(const map of [ save.roadmap, save.careers['ml-engineer'].roadmap ])
    {
        assert.equal(map.chosenBranch, 'extreme')
        assert.equal(map.stages[0].branch, 'extreme')
        assert.deepEqual(map.stages[0].gains.excel, { moderate: 1, extreme: 2 })
        assert.deepEqual(map.forecastBasis.branches, { moderate: [ 'sql' ], extreme: [ 'excel' ] })
    }
    assert.equal(store.normalizeSave({ ...store.createSave(), version: 6, scenario: { preset: 'moderate' } }).scenario, null)
    assert.deepEqual(store.normalizeSave({ ...store.createSave(), version: 6, scenario: { k: 1.2, H: 5 } }).scenario, { k: 1.2, H: 5 })
})

test('API: fast is accepted as extreme, null follows the recommendation again', async () =>
{
    store.reset()
    assert.equal((await call('/api/scenario', { preset: 'fast' })).status, 200)
    assert.deepEqual(store.load().scenario, { preset: 'extreme' })
    const state = (await call('/api/scenario', { preset: null })).body.state
    assert.equal(store.load().scenario, null)
    assert.equal(state.scenarioChoice.selectionSource, 'model_default')
    assert.equal((await call('/api/scenario', { preset: 'slow' })).status, 400)
})

test('AEI evidence: every number is in exposure.json; a skill without data is imputed mock, or unknown, never zero', () =>
{
    const evidence = aeiEvidence('data-analyst')
    assert.equal(evidence.career.evidenceId, 'aei:career:data-analyst')
    assert.equal(evidence.career.observedExposure, exposureFile.careers['data-analyst'].observedExposure)
    assert.deepEqual(evidence.skills.map((skill) => skill.skillId), getCareer('data-analyst').skills.map((skill) => skill.id))
    for(const skill of evidence.skills.filter((row) => exposureFile.skills[row.skillId]))
    {
        const row = exposureFile.skills[skill.skillId]
        assert.equal(skill.status, 'observed')
        assert.equal(skill.evidenceId, `aei:skill:${skill.skillId}`)
        assert.equal(skill.automation, row.automation)
        assert.equal(skill.augmentation, row.augmentation)
        assert.deepEqual(skill.tasks, row.tasks)
        assert.equal(skill.quality.fewTasks, row.tasks.length < FEW_TASKS)
    }
    // skills the reviewed table lacks: imputed from the mock file, marked
    for(const skill of [ 'data-analyst', 'frontend-developer' ].flatMap((id) => aeiEvidence(id).skills).filter((row) => !exposureFile.skills[row.skillId]))
    {
        assert.equal(skill.status, 'imputed')
        assert.equal(skill.evidenceId, `aei:mock:skill:${skill.skillId}`)
        assert.equal(skill.quality.imputed, true)
        assert.equal(skill.automation, mockExposureFile.skills[skill.skillId].automation)
    }
    // without the mock either: unknown, null
    const bare = { skills: {}, careers: {}, source: {} }
    for(const skill of aeiEvidence('frontend-developer', { exposure: bare }).skills)
    {
        assert.equal(skill.status, 'unknown')
        assert.equal(skill.automation, null)
        assert.equal(skill.quality.noData, true)
    }
    assert.equal(aeiEvidence('no-such-career'), null)
})

test('the imputed exposure is the mean of the real values of the careers needing the skill', async () =>
{
    const { imputeExposure } = await import('../../../src/data/scripts/mock-ai-exposure.mjs')
    const exposure = { skills: { sql: { automation: 0.2, augmentation: 0.6, tasks: [ 't' ] }, excel: { automation: 0.4, augmentation: 0.2, tasks: [ 't' ] }, cad: { automation: 0.9, augmentation: 0.9, tasks: [ 't' ] } } }
    const map = { skills: { sql: {}, excel: {}, cad: {}, git: {}, lonely: {} }, careers: { a: { skills: [ 'sql', 'excel', 'git' ] }, b: { skills: [ 'lonely' ] } } }
    const skills = imputeExposure(exposure, map)
    assert.deepEqual(Object.keys(skills).sort(), [ 'git', 'lonely' ])
    assert.deepEqual([ skills.git.automation, skills.git.augmentation, skills.git.method ], [ 0.3, 0.4, 'career-mean-imputation' ])
    assert.deepEqual(skills.git.basis.skills, [ 'excel', 'sql' ])
    // no career with a real value: the mean of every real skill
    assert.equal(skills.lonely.method, 'all-skills-mean-imputation')
    assert.equal(skills.lonely.automation, 0.5)
    assert.ok(Object.values(skills).every((row) => row.mock === true))
})

test('AEI evidence: an observation period is never the download date', () =>
{
    const { source } = aeiEvidence('data-analyst')
    assert.ok(source.downloadedAt)
    assert.ok(source.releases.length >= 2)
    for(const release of source.releases)
    {
        assert.notEqual(release.observationPeriod?.from ?? null, source.downloadedAt)
        assert.notEqual(release.observationPeriod?.approximate ?? null, source.downloadedAt)
        assert.ok(release.observationPeriod || release.periodNote, `${release.release}: a period or why there is none`)
    }
})

test('trend classification by career: the change of its automation share against the threshold set in advance', () =>
{
    const period = { from: '2025-01-01', to: '2025-01-31' }
    const release = (published, observationPeriod = period, extra = {}) => ({ metric: 'share', definition: 'd', observationPeriod, published, ...extra })
    const criteria = { metric: 'share', extremeChangeAbove: 0.05, minimumPairedTasks: 3 }
    const periods = { releases: { a: release('2025-02-01'), b: release('2025-08-01') }, classificationCriteria: criteria }
    const series = { careers: {
        up: { pairedTasks: 5, automationShare: { a: 0.30, b: 0.40 } },
        flat: { pairedTasks: 5, automationShare: { a: 0.30, b: 0.32 } },
        thin: { pairedTasks: 2, automationShare: { a: 0.30, b: 0.90 } },
    } }
    const up = trendClassification('up', { periods, series })
    assert.deepEqual([ up.trendClassification, up.recommendedScenario, up.change ], [ 'extreme', 'extreme', 0.1 ])
    assert.deepEqual(up.evidenceRefs, [ 'aei:source:a', 'aei:source:b', 'aei:career:up' ])
    assert.match(up.reason.zh, /\+10 个百分点.*达到团队事先定下的极端门槛（5 个百分点）/)
    assert.equal(trendClassification('flat', { periods, series }).recommendedScenario, 'moderate')
    assert.equal(trendClassification('flat', { periods, series }).trendClassification, 'moderate')
    for(const careerId of [ 'thin', 'nobody', null ])
        assert.equal(trendClassification(careerId, { periods, series }).trendClassification, 'insufficient_evidence')
    assert.match(trendClassification('up', { periods: { ...periods, classificationCriteria: null }, series }).reason.en, /no criteria/)
    assert.match(trendClassification('up', { periods: { releases: { a: release('2025-02-01') } }, series }).reason.en, /single period/)
    assert.match(trendClassification('up', { periods: { ...periods, releases: { a: release('2025-02-01'), b: release('2025-08-01', null) } }, series }).reason.en, /no observation period/)
    // a mock release says so
    const mock = trendClassification('up', { periods: { ...periods, releases: { ...periods.releases, b: release('2025-08-01', period, { mock: true }) } }, series })
    assert.equal(mock.mock, true)
    assert.match(mock.reason.en, /mock data/)
    for(const lang of [ 'zh', 'en', 'ms' ])
        assert.ok(up.reason[lang] && up.rules[lang] && up.limitations[lang])
})

test('trend classification on the real releases: two comparable periods of the same metric', () =>
{
    const series = read('../../../data/ai-exposure/periods.json')
    const result = trendClassification('data-analyst')
    const row = series.careers['data-analyst']
    if(row.pairedTasks < 3)
        return assert.equal(result.trendClassification, 'insufficient_evidence')
    const values = Object.values(row.automationShare)
    assert.equal(result.change, Math.round((values.at(- 1) - values[0]) * 10000) / 10000)
    assert.equal(result.trendClassification, result.change >= 0.05 ? 'extreme' : 'moderate')
    assert.equal(result.mock, false)
})

test('the player choice wins, the recommendation and its basis stay', () =>
{
    const target = { careerId: 'data-analyst', mode: 'general' }
    const recommended = trendClassification('data-analyst').recommendedScenario
    const other = recommended === 'extreme' ? 'moderate' : 'extreme'
    const chosen = sc.scenarioState({ target, scenario: { preset: other } })
    assert.equal(chosen.userOverride, other)
    assert.equal(chosen.effectiveScenario, other)
    assert.equal(chosen.selectionSource, 'user_override')
    assert.equal(chosen.recommendedScenario, recommended)
    const none = sc.scenarioState({ target, scenario: null })
    assert.deepEqual([ none.userOverride, none.effectiveScenario, none.selectionSource ], [ null, recommended, 'model_default' ])
    assert.equal(sc.scenarioOf({ target, scenario: null }).scenario, recommended)
    // no target: nothing to classify, moderate
    assert.equal(sc.scenarioState({ scenario: null }).effectiveScenario, 'moderate')
    // explicit parameters are no choice between the two scenarios
    assert.equal(sc.scenarioState({ target, scenario: { k: 1.2, H: 5 } }).userOverride, null)
})

test('skill priority reads AI exposure and hiring demand by default; AI exposure only on request', () =>
{
    const save = analyst()
    const base = { official: [], momentum: null, exposure: aeiOnlyInputs().exposure }
    // a demand trend strong enough to reorder the skills, marked mock
    const momentum = { basis: {}, careers: {}, skills: { excel: { growth: 0.4, months: 6, confidence: 'low', mock: true }, sql: { growth: - 0.3, months: 6, confidence: 'low', mock: true } } }
    const withDemand = skillPriority(save, { inputs: { ...base, momentum } })
    assert.equal(withDemand.assumptions.demand, 'momentum')
    assert.deepEqual(withDemand.assumptions.sources, [ 'aei', 'posting-momentum' ])
    assert.equal(withDemand.assumptions.mock.demand, true)
    const neutral = skillPriority(save, { demand: 'neutral', inputs: { ...base, momentum } })
    assert.deepEqual(neutral.core, skillPriority(save, { demand: 'neutral', inputs: base }).core)
    assert.equal(neutral.assumptions.demand, 'neutral')
    assert.notDeepEqual(withDemand.gains, neutral.gains)
    assert.match(withDemand.purpose.en, /not evidence of how fast AI develops/)
    assert.ok(withDemand.evidenceRefs.every((id) => /^aei:(mock:)?skill:/.test(id)))
    for(const preset of [ 'moderate', 'extreme' ])
        assert.ok(withDemand.approach[preset].sql.order.length === 5)
})

const fixture = (automation, augmentation) => ({ automation, augmentation, tasks: [ 't' ] })
const fixtureInputs = { official: [], momentum: null, exposure: { source: {}, skills: {
    sql: fixture(0, 0.9), 'data-cleaning': fixture(0.05, 0.6), communication: fixture(0.4, 1.0), 'data-visualization': fixture(0, 0.05),
    statistics: fixture(0, 0), excel: fixture(0.9, 0), python: fixture(0, 0) } } }

test('a skill declining under both is not put last while a skill still to learn requires it', () =>
{
    const inputs = fixtureInputs, exposure = fixture
    assert.deepEqual(noRegretSkeleton(analyst(), inputs, { requires: {} }).later, [ 'excel' ])
    const held = noRegretSkeleton(analyst(), inputs, { requires: { statistics: [ 'excel' ] } })
    assert.deepEqual(held.later, [])
    assert.deepEqual(held.foundations, { excel: [ 'statistics' ] })
    assert.match(held.reasons.excel.zh, /两个情景下都在下降.*但它是统计基础的基础，所以不放到最后/)
    for(const lang of [ 'en', 'ms' ])
        assert.ok(held.reasons.excel[lang])
    // a requiring skill that itself waits to the end does not hold its foundation back
    assert.deepEqual(noRegretSkeleton(analyst(), { ...inputs, exposure: { ...inputs.exposure, skills: { ...inputs.exposure.skills, statistics: exposure(0.9, 0) } } }, { requires: { statistics: [ 'excel' ] } }).later.sort(), [ 'excel', 'statistics' ])
})

test('a skill comes after what it requires: a core requirement joins the core, before the skill needing it', () =>
{
    assert.deepEqual(prerequisiteOrder([ 'a', 'b', 'c' ], { a: [ 'c' ] }), [ 'b', 'c', 'a' ])
    assert.deepEqual(prerequisiteOrder([ 'a', 'b' ], { a: [ 'b' ], b: [ 'a' ] }), [ 'a', 'b' ])   // a cycle keeps the order
    const plain = noRegretSkeleton(analyst(), fixtureInputs, { requires: {} })
    assert.deepEqual(plain.core, [ 'sql', 'data-cleaning' ])
    assert.ok(!plain.core.includes('python'))
    // sql needs python: python leaves the branches for the core, before sql
    const ordered = noRegretSkeleton(analyst(), fixtureInputs, { requires: { sql: [ 'python' ] } })
    assert.ok(ordered.core.includes('python'))
    assert.ok(ordered.core.indexOf('python') < ordered.core.indexOf('sql'))
    assert.ok(Object.values(ordered.branches).every((ids) => !ids.includes('python')))
    assert.deepEqual(ordered.promoted, { python: [ 'sql' ] })
    assert.match(ordered.reasons.python.zh, /排在前面，因为它是SQL 查询的基础/)
    // inside a branch too
    const branch = noRegretSkeleton(analyst(), fixtureInputs, { requires: { communication: [ 'statistics' ] } })
    for(const ids of Object.values(branch.branches))
        assert.ok(!ids.includes('communication') || ids.indexOf('statistics') < ids.indexOf('communication'))
})

test("a company's job posting replaces the career's skills in the skeleton and the gaps", () =>
{
    const save = analyst()
    save.target = { careerId: 'data-analyst', mode: 'customise', posting: { title: 'BI analyst', company: 'Acme', requirements: [
        { text: 'Power BI dashboards', skillId: 'data-visualization', level: 3, priority: 'must', kind: 'skill' },
        { text: 'Python scripting', skillId: 'python', level: 2, priority: 'nice', kind: 'skill' },
    ] } }
    const career = game.targetedCareer(save, getCareer('data-analyst'))
    assert.deepEqual(career.skills.map((skill) => skill.id).sort(), [ 'data-visualization', 'python' ])
    const skeleton = noRegretSkeleton(save, fixtureInputs, { requires: {}, career })
    const ids = [ ...skeleton.core, ...new Set(Object.values(skeleton.branches).flat()), ...skeleton.later ]
    assert.deepEqual(ids.sort(), [ 'data-visualization', 'python' ])
    assert.deepEqual(game.gapsFor(save).map((gap) => gap.id).sort(), [ 'data-visualization', 'python' ])
})

test('how to learn: the extreme scenario moves time to AI collaboration and verification, never dropping the basics', () =>
{
    const inputs = { exposure: { skills: { sql: fixture(0.4, 0.6) } } }
    const moderate = learningApproach('sql', 'moderate', inputs)
    const extreme = learningApproach('sql', 'extreme', inputs)
    assert.ok(extreme.activities.ai_collaboration > moderate.activities.ai_collaboration)
    assert.ok(extreme.activities.verification > moderate.activities.verification)
    assert.ok(extreme.activities.foundation < moderate.activities.foundation)
    assert.ok(extreme.activities.foundation > 0 && extreme.activities.independent_practice > 0)
    assert.ok(Math.abs(Object.values(extreme.activities).reduce((sum, share) => sum + share, 0) - 1) < 0.02)
    assert.match(extreme.reason.zh, /极端情景（3 年后相关任务约 62% 用上 AI）/)
    // no AI data: the same approach under both scenarios
    const unknown = [ 'moderate', 'extreme' ].map((preset) => learningApproach('git', preset, { exposure: { skills: {} } }))
    assert.deepEqual(unknown[0].activities, unknown[1].activities)
    assert.equal(unknown[0].known, false)
    const stage = stageApproach([ 'sql', 'git' ], 'extreme', inputs)
    assert.equal(stage.order.length, 5)
})

test('the demo roadmap gives every task a learning activity following the stage approach', async () =>
{
    const save = analyst()
    const skeleton = noRegretSkeleton(save, fixtureInputs, { requires: {} })
    const layout = skeletonStages(skeleton).map((stage) => ({ ...stage, approach: stageApproach(stage.skillIds, 'extreme', fixtureInputs) }))
    const plan = await generateRoadmap({ target: save.target, profile: save.profile, gaps: game.gapsFor(save), lang: 'zh', layout, scenario: sc.scenarioState(save) })
    for(const [ index, stage ] of plan.stages.entries())
    {
        assert.ok(stage.tasks.length)
        assert.ok(stage.tasks.every((task) => ACTIVITIES.includes(task.learningActivity)))
        assert.ok(layout[index].approach.order.slice(0, 3).includes(stage.tasks[0].learningActivity))
    }
    const roadmap = game.buildRoadmap({ ...plan, chosenBranch: 'extreme', scenario: 'extreme' })
    assert.equal(roadmap.scenario, 'extreme')
    assert.ok(roadmap.stages.every((stage) => stage.approach && stage.tasks.every((task) => ACTIVITIES.includes(task.learningActivity))))
})

test('prerequisites: known skills, no cycle, only reviewed entries used', () =>
{
    const all = {}
    for(const entry of prerequisitesFile.entries)
    {
        assert.ok(SKILLS[entry.skill], entry.skill)
        assert.ok(entry.requires.every((id) => SKILLS[id]), entry.skill)
        assert.equal(typeof entry.reviewed, 'boolean')
        all[entry.skill] = entry.requires
    }
    assert.equal(prerequisiteCycle(all), null)
    assert.deepEqual(prerequisiteCycle({ a: [ 'b' ], b: [ 'c' ], c: [ 'a' ] }), [ 'a', 'b', 'c', 'a' ])
    const reviewed = prerequisitesFile.entries.filter((entry) => entry.reviewed).map((entry) => entry.skill).sort()
    assert.deepEqual(Object.keys(loadPrerequisites()).sort(), reviewed)
})

test('roadmap inputs: the evidence, scenario and priority of the target, in the roadmap prompt fields', () =>
{
    const save = analyst()
    save.scenario = { preset: 'extreme' }
    const inputs = roadmapInputs(save)
    assert.equal(inputs.targetCareerId, 'data-analyst')
    assert.equal(inputs.aeiEvidence.career.careerId, 'data-analyst')
    assert.equal(inputs.userScenarioOverride, 'extreme')
    assert.equal(inputs.scenario.effectiveScenario, 'extreme')
    assert.ok(inputs.trendClassificationRules.zh)
    assert.equal(inputs.modelAnalysis.skillPriority.assumptions.demand, 'momentum')
    assert.equal(roadmapInputs(store.createSave()).aeiEvidence, null)
})

test("a job posting's skill brings its reviewed prerequisites into the roadmap, placed first, with the reason", async () =>
{
    const { withPrerequisites } = await import('../../../src/game/server/no-regret.js')
    const catalog = { id: 'x', skills: [ { id: 'python', level: 3, weight: 1 }, { id: 'ml-frameworks', level: 3, weight: 1 } ] }
    const posting = { id: 'x', skills: [ { id: 'ml-frameworks', level: 2, weight: 3 } ] }
    const requires = { 'ml-frameworks': [ 'python' ], python: [ 'statistics' ] }
    const career = withPrerequisites(posting, catalog, requires)
    // the lower of the catalog level (3) and the level of the skill needing it (2); a nice-to-have weight; in turn
    assert.deepEqual(career.skills.find((skill) => skill.id === 'python'), { id: 'python', level: 2, weight: 1, prerequisiteOf: [ 'ml-frameworks' ] })
    assert.deepEqual(career.skills.find((skill) => skill.id === 'statistics'), { id: 'statistics', level: 2, weight: 1, prerequisiteOf: [ 'python' ] })
    assert.equal(withPrerequisites(posting, catalog, {}), posting)
    // in the skeleton of a customised target
    const save = analyst()
    save.target = { careerId: 'data-analyst', mode: 'customise', posting: { title: 'ML', company: 'Acme', requirements: [
        { text: 'Familiarity with ML frameworks', skillId: 'ml-frameworks', level: 2, priority: 'must', kind: 'skill' } ] } }
    // the real, reviewed prerequisites: ML frameworks build on Python
    assert.equal(game.roadmapCareer(save).skills.some((skill) => skill.id === 'python'), Boolean(loadPrerequisites()['ml-frameworks']?.includes('python')))
    const skeleton = noRegretSkeleton(save, fixtureInputs, { requires: { 'ml-frameworks': [ 'python' ] }, career: withPrerequisites(game.targetedCareer(save, getCareer('data-analyst')), getCareer('data-analyst'), { 'ml-frameworks': [ 'python' ] }) })
    const order = [ ...skeleton.core, ...skeleton.branches.moderate ]
    assert.ok(order.indexOf('python') < order.indexOf('ml-frameworks'))
    assert.deepEqual(skeleton.added, { python: [ 'ml-frameworks' ] })
    assert.match(skeleton.reasons.python.zh, /招聘信息没有写，但它是机器学习框架的基础，所以补进路线/)
    // affinity and progress keep the posting's own skills
    assert.deepEqual(game.targetedCareer(save, getCareer('data-analyst')).skills.map((skill) => skill.id), [ 'ml-frameworks' ])
})
