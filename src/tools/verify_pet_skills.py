"""Check skill cards with an isolated API fixture; never write the player's save."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification' / 'pet-skills'
OUT.mkdir(parents=True, exist_ok=True)
fixture_code = """
import {createSave} from './server/store.js';
import {setTarget, buildRoadmap, view} from './server/game.js';
const save = createSave();
setTarget(save, {careerId:'data-analyst', mode:'general'});
save.pet.affinity = 40;
save.profile.skills = [{id:'sql', name:'SQL', level:2, source:'manual'}, {id:'excel', name:'Excel', level:1, source:'manual'}];
save.roadmap = buildRoadmap({overview:'Learning plan', stages:[{title:'SQL',why:'Practice',skillIds:['sql'],requirementRefs:[],prerequisiteIndexes:[],tasks:[{title:'Query practice',why:'Practice',skillId:'sql',effortHours:6}]}]});
console.log(JSON.stringify(view(save,{mock:true,model:'preview',keyConfigured:false})));
"""
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', fixture_code], cwd=ROOT / 'game', text=True, encoding='utf-8'))
results = {}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, channel='chromium',
        args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    def api(route):
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'state': fixture}))
    context.route('**/api/**', api)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5173/#skip', wait_until='domcontentloaded')
        page.wait_for_function('window.game?.career?.api.state && window.game?.reveal?.step === 2', timeout=90000)
        print('Game loaded with isolated skill-card fixture.', flush=True)
        trigger = page.locator('.career-menu-trigger')
        trigger.click()
        assert page.locator('.career-rail-item').count() == 6
        assert page.locator('[data-panel="gym"]').count() == 0
        page.locator('.career-rail-item[data-panel="careers"]').click()
        page.wait_for_timeout(350)
        expect(page.locator('.career-card-affinity').first).to_contain_text('好感度 40%')
        expect(page.locator('.career-card').first).to_contain_text('热度：80%')
        assert '匹配度' not in page.locator('.career-cards').inner_text()
        page.screenshot(path=str(OUT / 'desktop-affinity.png'))
        page.locator('.career-card[data-career="ml-engineer"]').click()
        page.wait_for_timeout(350)
        expect(page.locator('.js-career-panel-title')).to_have_text('AI / 机器学习工程师')
        requirements = page.locator('.career-requirements .career-skill-card')
        assert requirements.count() == 6
        assert page.locator('.career-requirements .career-bar').count() == 0
        assert page.locator('.career-skill-requirement').count() == 6
        first, second, third = [requirements.nth(i).bounding_box() for i in range(3)]
        assert abs(first['y'] - second['y']) < 1 and second['x'] > first['x']
        assert third['y'] > first['y']
        expect(page.locator('.career-requirements [data-skill="python"] .career-skill-stats dd').first).to_have_text('80%')
        page.screenshot(path=str(OUT / 'desktop-career-requirements.png'))
        for lang in ['zh', 'en', 'ms']:
            page.evaluate('''async lang => {
                const i18n = await import('/Career/i18n.js');
                i18n.setLang(lang); game.career.ui.rebuildStatic(); game.career.ui.render();
            }''', lang)
            for width, height in [(390, 844), (320, 568)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_timeout(100)
                first, second = [requirements.nth(i).bounding_box() for i in range(2)]
                assert abs(first['y'] - second['y']) < 1 and second['x'] > first['x']
                assert page.locator('.career-panel-body').evaluate('(n) => n.scrollWidth <= n.clientWidth + 1')
                assert requirements.evaluate_all('(nodes) => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
                if lang == 'zh' and width == 390:
                    page.locator('.career-requirements').scroll_into_view_if_needed()
                    page.screenshot(path=str(OUT / 'mobile-career-requirements.png'))
            for career in fixture['careers']:
                page.evaluate('(id) => game.career.ui.openPanel("careers", {careerId:id})', career['id'])
                assert requirements.count() == len(career['match']['skills'])
                assert requirements.evaluate_all('(nodes) => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
            page.evaluate('game.career.ui.openPanel("careers", {careerId:"ml-engineer"})')
        print('Career requirements use two cards per row on desktop and mobile, across six careers and three languages.', flush=True)
        page.evaluate('''async () => {
            const i18n = await import('/Career/i18n.js'); i18n.setLang('zh');
            game.career.ui.rebuildStatic(); game.career.ui.render();
        }''')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.locator('.career-close').click()
        trigger.click()
        page.locator('.career-rail-item[data-panel="pet"]').click()
        page.wait_for_timeout(350)
        assert page.locator('.career-skill-card').count() == 7
        first, second = [page.locator('.career-pet-skills .career-skill-card').nth(i).bounding_box() for i in range(2)]
        assert abs(first['y'] - second['y']) < 1 and second['x'] > first['x']
        expect(page.locator('[data-skill="sql"] [role="meter"]')).to_have_attribute('aria-valuenow', '67')
        assert page.locator('.career-skill-stats').first.inner_text().count('热度') == 1
        assert page.locator('.career-skill-stats').first.inner_text().count('难度') == 1
        expect(page.locator('[data-skill="sql"] .career-skill-stats dd').first).to_have_text('80%')
        assert '热度：60%' in page.evaluate('game.career.ui.dialogueGraph("ui-ux-designer").market.lines[0]')
        assert page.locator('.career-skill-card-icon svg path, .career-skill-card-icon svg ellipse').count() >= 7
        assert page.locator('.career-pet-skills .career-bar').count() == 0
        page.screenshot(path=str(OUT / 'desktop-skill-cards.png'))

        all_skills = list(fixture['skillDetails'])
        for lang in ['zh', 'en', 'ms']:
            page.evaluate('''async ({lang, ids}) => {
                const i18n = await import('/Career/i18n.js');
                i18n.setLang(lang);
                game.career.api.state.pet.skills = ids.map((id,index) => ({id,progress:(index*7)%101}));
                game.career.ui.rebuildStatic(); game.career.ui.render();
            }''', {'lang': lang, 'ids': all_skills})
            assert page.locator('.career-skill-card').count() == 29
            assert page.locator('.career-skill-description').evaluate_all('(nodes) => nodes.every(n => n.textContent.length > 10)')
            assert page.locator('.career-skill-card-icon svg').evaluate_all('(nodes) => nodes.every(n => n.children.length > 0)')
            assert 'undefined' not in page.locator('.career-panel-body').inner_text()
            for width, height in [(390, 844), (320, 568)]:
                page.set_viewport_size({'width': width, 'height': height})
                page.wait_for_timeout(100)
                assert page.locator('.career-panel-body').evaluate('(n) => n.scrollWidth <= n.clientWidth + 1')
                assert page.locator('.career-skill-card').evaluate_all('(nodes) => nodes.every(n => n.scrollWidth <= n.clientWidth + 1)')
                assert page.locator('.career-panel').evaluate('(panel) => panel.contains(document.elementFromPoint(45, 45))')
                assert page.locator('.career-panel').evaluate('(panel) => panel.contains(document.elementFromPoint(65, 65))')
                if lang == 'zh' and width == 390:
                    page.screenshot(path=str(OUT / 'mobile-skill-cards.png'))
                if lang == 'ms' and width == 320:
                    page.screenshot(path=str(OUT / 'mobile-malay-skill-cards.png'))
            results[lang] = {'cards': 29, 'career_layout': 'two columns', 'careers_checked': 6, 'viewports': ['390x844', '320x568'], 'overflow': False}
        print('All 29 skills render in three languages without narrow-screen overflow.', flush=True)

        page.evaluate('''() => {
            game.career.ui.closePanel();
            game.career.ui.openPanel('roadmap');
        }''')
        assert page.locator('[data-action^="gym"]').count() == 0
        graph = page.evaluate('game.career.ui.dialogueGraph("data-analyst")')
        assert 'gym' not in graph
        assert all(choice.get('to') != 'gym' for node in graph.values() for choice in node.get('choices', []))
        page.evaluate('game.career.ui.closePanel(); game.career.ui.openPanel("gym")')
        assert page.evaluate('game.career.ui.panel') is None
        assert not errors, errors
        results['page_errors'] = errors
        print('Affection, six-item menu, roadmap and NPC exam removal passed.', flush=True)
    finally:
        (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()
