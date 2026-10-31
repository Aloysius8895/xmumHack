import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { postingSource, attachPostingWatch, parsePosting, applyPostingCheck, checkPostings, acceptPostingRevision } from '../../../src/game/server/posting-watch.js'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'posting-watch-'))
process.env.AI_MOCK = '1'
process.env.INTEGRATION_TOKEN = 'fixture-token'
const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
const { buildPostingWatchWorkflow } = await import('../../../src/game/n8n/posting-watch/build-workflow.mjs')
const html = content => `<h2 class="top-card-layout__title">Data Analyst</h2><a class="topcard__org-name-link">Fixture company</a><span class="topcard__flavor--bullet">Malaysia</span><div class="show-more-less-html__markup"><div><p>${content}</p></div></div>`
const original = 'Requirements: SQL reporting and Python analysis. '.repeat(5)
const snapshot = text => parsePosting(html(text), 'linkedin')
const posting = () => attachPostingWatch({ title: 'Data Analyst', company: 'Fixture company', summary: 'fixture', requirements: [] }, 'https://my.linkedin.com/jobs/view/data-analyst-at-fixture-123456?tracking=1')

async function call(route, body, method = 'POST', token = 'fixture-token')
{
    const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))])
    Object.assign(request, { method, url: route, headers: { authorization: `Bearer ${token}` } })
    let payload
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = JSON.parse(text) } }
    await handle(request, response)
    return { status: response.statusCode, body: payload }
}

test('source identity rejects SSRF, credentials, ports, unsupported URLs and preserves Indeed jk', () => {
    for(const url of ['http://127.0.0.1/a', 'https://linkedin.com.attacker.test/jobs/view/123', 'https://www.linkedin.com:444/jobs/view/123', 'https://user:secret@www.linkedin.com/jobs/view/123', 'https://www.linkedin.com/company/example'])
        assert.throws(() => postingSource(url))
    assert.equal(postingSource('https://malaysia.indeed.com/viewjob?jk=abcdef1234567890&from=search').sourceJobId, 'abcdef1234567890')
    assert.equal(posting().monitor.sourceJobId, '123456')
})

test('nested HTML and formatting changes preserve content identity; login shells fail closed', () => {
    assert.equal(snapshot(original).hash, parsePosting(html(original.replaceAll(' ', '  ')), 'linkedin').hash)
    assert.ok(snapshot(original).description.length > 100)
    assert.notEqual(snapshot(original).hash, parsePosting(html(original) + '<p>No longer accepting applications</p>', 'linkedin').hash)
    assert.throws(() => parsePosting('<div>Sign in</div>', 'linkedin'))
})

test('baseline, revision retry, explicit accept and reversion do not create duplicate alerts', () => {
    const m = posting().monitor
    assert.equal(applyPostingCheck(m, snapshot(original)).baselineCreated, true)
    assert.equal(m.requiresRegeneration, false)
    const changed = snapshot(original + ' Must know TensorFlow.')
    assert.equal(applyPostingCheck(m, changed).newlyChanged, true)
    assert.equal(applyPostingCheck(m, changed).newlyChanged, false)
    assert.equal(m.requiresRegeneration, true)
    applyPostingCheck(m, snapshot(original))
    assert.equal(m.requiresRegeneration, false)
    applyPostingCheck(m, changed)
    acceptPostingRevision({monitor:m})
    assert.equal(m.pending, null)
    assert.equal(applyPostingCheck(m, changed).changed, false)
})

test('saving the same canonical source preserves pending changes; replacing it starts a fresh baseline', () => {
    const p = posting()
    applyPostingCheck(p.monitor, snapshot(original))
    applyPostingCheck(p.monitor, snapshot(original + ' New SQL requirement.'))
    const same = attachPostingWatch(p, 'https://www.linkedin.com/jobs/view/123456?trk=other')
    assert.deepEqual(same.monitor, p.monitor)
    const replacement = attachPostingWatch(p, 'https://www.linkedin.com/jobs/view/654321')
    assert.notEqual(replacement.monitor.id, p.monitor.id)
    assert.equal(replacement.monitor.acceptedHash, null)
    assert.equal(replacement.monitor.pending, null)
})

test('general career goals can register links and be checked without replacing their roadmap', async () => {
    const save = store.createSave()
    game.setTarget(save, {careerId: 'data-analyst', mode: 'general'})
    save.roadmap = {fixture: 'keep-progress', stages: []}
    store.save(save)
    const result = await call('/api/target/track', {sourceUrl: 'https://www.linkedin.com/jobs/view/123456'})
    assert.equal(result.status, 200)
    const saved = store.load()
    assert.equal(saved.target.mode, 'general')
    assert.equal(saved.target.posting.monitor.sourceJobId, '123456')
    const baseline = await checkPostings(saved, async () => new Response(html(original)))
    assert.equal(baseline.checked, 1)
    assert.equal(baseline.changed, 0)
    const changed = await checkPostings(saved, async () => new Response(html(original + ' Must know SQL modelling.')))
    assert.equal(changed.changed, 1)
    assert.deepEqual(saved.roadmap, {fixture: 'keep-progress', stages: []})
    const monitorBeforeSwitch = structuredClone(saved.target.posting.monitor)
    game.setTarget(saved, {careerId: 'chef', mode: 'general'})
    game.setTarget(saved, {careerId: 'data-analyst', mode: 'general'})
    assert.deepEqual(saved.target.posting.monitor, monitorBeforeSwitch)
    assert.deepEqual(saved.roadmap, {fixture: 'keep-progress', stages: []})
    store.save(saved)
    const accepted = await call('/api/roadmap/refresh-posting', {revision: saved.target.posting.monitor.pending.hash})
    assert.equal(accepted.status, 200)
    assert.equal(store.load().target.mode, 'customise')
    assert.ok(store.load().target.posting.requirements.length)
})

test('tracking rejects a missing career target and invalid links without changing a save', async () => {
    store.save(store.createSave())
    assert.equal((await call('/api/target/track', {sourceUrl: 'https://www.linkedin.com/jobs/view/123456'})).status, 409)
    const save = store.createSave()
    game.setTarget(save, {careerId: 'data-analyst', mode: 'general'})
    store.save(save)
    assert.equal((await call('/api/target/track', {sourceUrl: 'https://127.0.0.1/secret'})).status, 400)
    assert.equal(store.load().target.posting, null)
})

test('scheduled checks cover shelved targets; 403 preserves roadmap and pending revision', async () => {
    const p = posting()
    applyPostingCheck(p.monitor, snapshot(original))
    applyPostingCheck(p.monitor, snapshot(original + ' New requirement.'))
    const save = { target: null, careers: { analyst: { target: {mode:'customise',posting:p}, roadmap:{fixture:true} } } }
    const before = structuredClone(p.monitor.pending)
    const result = await checkPostings(save, async () => new Response('Forbidden', {status:403}))
    assert.equal(result.failed, 1)
    assert.equal(result.changed, 0)
    assert.deepEqual(p.monitor.pending, before)
    assert.deepEqual(save.careers.analyst.roadmap, {fixture:true})
})

test('API authenticates checks and requires matching revision before explicit regeneration', async () => {
    const save = store.createSave()
    game.setTarget(save, {careerId:'data-analyst',mode:'customise',posting:posting()})
    const m = save.target.posting.monitor
    applyPostingCheck(m, snapshot(original))
    applyPostingCheck(m, snapshot(original + ' Advanced SQL now required.'))
    save.roadmap = {fixture:'old-roadmap'}
    store.save(save)
    assert.equal((await call('/api/integrations/jobs/check', {}, 'POST', 'wrong')).status, 401)
    assert.equal((await call('/api/roadmap', {})).status, 409)
    assert.equal((await call('/api/roadmap/refresh-posting', {revision:'old'})).status, 409)
    assert.deepEqual(store.load().roadmap, {fixture:'old-roadmap'})
    const result = await call('/api/roadmap/refresh-posting', {revision:m.pending.hash})
    assert.equal(result.status, 200)
    assert.equal(store.load().target.posting.monitor.requiresRegeneration, false)
    assert.ok(store.load().roadmap.stages.length)
})

test('workflow uses credentials and a MYT schedule without embedded token', () => {
    const flow = buildPostingWatchWorkflow()
    assert.equal(flow.settings.timezone, 'Asia/Kuala_Lumpur')
    assert.equal(flow.nodes.find(n => n.type.endsWith('.scheduleTrigger')).parameters.rule.interval[0].expression, '0 8 * * 1')
    assert.ok(flow.nodes.find(n => n.type.endsWith('.httpRequest')).credentials.httpHeaderAuth)
    assert.ok(!JSON.stringify(flow).includes('fixture-token'))
})
