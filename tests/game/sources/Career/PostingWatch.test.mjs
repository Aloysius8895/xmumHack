import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { t, getLang } from '../../../../src/game/sources/Career/i18n.js'

const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/CareerUI.js', import.meta.url), 'utf8')
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const compile = name => new Function('t', 'esc', 'getLang', 'renderLearningPanel', `return ({${source.match(new RegExp(`    ${name}\\(\\)\\r?\\n    \\{[\\s\\S]*?\\r?\\n    \\}`))[0]}}).${name}`)(t, esc, getLang, () => '<div>learning-panel</div>')
const watch = compile('renderPostingWatch')
const roadmap = compile('renderRoadmap')
const fixture = mode => ({state: {target: {careerId: 'data-analyst', mode}, roadmap: null}, drafts: {}, renderPostingWatch() {return watch.call(this)}, renderRoadmapMap() {return '<div>roadmap-map</div>'}})

test('Roadmap has no URL entry before or after generation for either target mode', () => {
    for(const mode of ['general', 'customise']) {
        const ui = fixture(mode)
        for(const plan of [null, {stages: []}]) {
            ui.state.roadmap = plan
            const html = roadmap.call(ui)[1]
            assert.doesNotMatch(html, /data-draft="postingTrackUrl"|data-action="track-posting"/)
            assert.ok(!html.includes(t('watch.title')))
            assert.match(html, /learning-panel/)
        }
    }
})

test('Roadmap displays saved sources, schedule, baseline, errors and revisions without URL entry', () => {
    const ui = fixture('general')
    ui.state.target.posting = {monitor: {sourceUrl: 'https://www.linkedin.com/jobs/view/123456', status: 'pending_baseline'}}
    assert.match(watch.call(ui), new RegExp(t('watch.pending')))
    assert.match(watch.call(ui), /href="https:\/\/www.linkedin.com\/jobs\/view\/123456"/)
    for(const plan of [null, {stages: []}]) {
        ui.state.roadmap = plan
        const html = roadmap.call(ui)[1]
        assert.ok(html.indexOf(t('watch.title')) < html.indexOf('learning-panel'))
        assert.match(html, /08:00/)
    }
    ui.state.target.posting.monitor = {...ui.state.target.posting.monitor, status: 'changed', requiresRegeneration: true,
        lastCheckedAt: '2026-10-31T00:00:00Z', lastError: 'posting-access-403', pending: {title: '<unsafe>', description: 'New SQL requirement'}}
    const html = watch.call(ui)
    assert.match(html, /data-action="refresh-posting"/)
    assert.match(html, /posting-access-403/)
    assert.match(html, /&lt;unsafe>/)
    assert.doesNotMatch(html, /<input|data-action="track-posting"/)
})

test('Careers Customise retains source entry and career context', () => {
    const body = source.slice(source.indexOf('    renderCareer(careerId)'), source.indexOf('    sdgBadge('))
    assert.match(body, /mode === 'customise'[\s\S]*data-draft="postingSourceUrl"/)
    assert.match(source, /this\.api\.setTarget\(careerId, mode, text, file, replace, this\.drafts\.postingSourceUrl/)
    for(const renderer of ['renderCareerSdgs', 'renderMycolTimeline']) {
        assert.ok(body.includes(renderer), `${renderer} is preserved`)
    }
})

test('weekly tracking texts exist in Chinese, English and Malay', () => {
    const strings = fs.readFileSync(new URL('../../../../src/game/sources/Career/i18n.js', import.meta.url), 'utf8')
    for(const key of ['watch.title', 'watch.schedule', 'watch.pending', 'watch.update', 'watch.missing', 'watch.tracking']) {
        const line = strings.split('\n').find(row => row.includes(`'${key}':`))
        for(const lang of ['zh', 'en', 'ms']) assert.match(line, new RegExp(`${lang}: '[^']+'`))
    }
})
