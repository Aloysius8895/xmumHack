import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { t, pick, setLang, getLang } from '../../../../src/game/sources/Career/i18n.js'

const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/CareerUI.js', import.meta.url), 'utf8')
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const compile = (name, args = '') => new Function('t', 'pick', 'getLang', 'esc', `return ({${source.match(new RegExp(`    ${name}\\(${args}\\)\\r?\\n    \\{[\\s\\S]*?\\r?\\n    \\}`))[0]}}).${name}`)(t, pick, getLang, esc)
const skillName = compile('skillName', 'id, fallback')
const render = compile('renderProfile')
globalThis.document = {documentElement: {}}
test.after(() => {delete globalThis.document})

test('profile names, evidence and accessible labels follow all three selected languages', () => {
    const names = {zh: '自然语言处理（NLP）', en: 'Natural language processing (NLP)', ms: 'Pemprosesan bahasa semula jadi (NLP)'}
    const evidence = {zh: '训练分类模型', en: 'Trained a classifier', ms: 'Melatih pengelas'}
    const ui = {state: {skillNames: {}, profile: {skills: [{id: null, name: names.zh, localizedName: names, evidence, level: 2, source: 'ai'}]}}, drafts: {}, fileField: () => '', skillName}
    for(const lang of ['zh', 'en', 'ms']) {
        setLang(lang)
        const html = render.call(ui)[1]
        assert.ok(html.includes(names[lang]))
        assert.ok(html.includes(evidence[lang]))
        assert.ok(html.includes(`aria-label="${names[lang]}"`))
        if(lang !== 'zh') assert.doesNotMatch(html, /\p{Script=Han}/u)
    }
})

test('untranslated Chinese names do not leak into English or Malay screens', () => {
    for(const lang of ['en', 'ms']) {
        setLang(lang)
        assert.equal(skillName.call({state: {skillNames: {}}}, null, '自然语言处理'), t('profile.translationPending'))
    }
})
