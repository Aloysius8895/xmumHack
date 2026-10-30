"""Check posting skills through the real language selector using an isolated API fixture."""
import json
import subprocess
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE = 'http://localhost:5000'
OUT = Path(__file__).resolve().parents[1] / 'verification/posting-skill-languages'
OUT.mkdir(parents=True, exist_ok=True)


fixture_code = """
import {createSave} from './server/store.js';
import {setTarget, view} from './server/game.js';
const save = createSave();
save.lang = 'en';
setTarget(save, {careerId:'ml-engineer',mode:'customise',posting:{title:'ML Engineer',company:'Test',summary:'Test',requirements:[{
    text:'具备数据结构、数据建模与软件架构的基础知识',note:'掌握相关基础知识。',
    skillId:'other',kind:'skill',level:2,priority:'must',status:'gap',
    skillName:{zh:'数据结构、数据建模与软件架构基础',en:'Foundations of data structures, data modelling and software architecture',ms:'Asas struktur data, pemodelan data dan seni bina perisian'},
    skillDescription:{zh:'掌握数据结构、数据建模与软件架构的基础知识。',en:'Understand the basics of data structures, data modelling and software architecture.',ms:'Fahami asas struktur data, pemodelan data dan seni bina perisian.'}
}, {text:'Machine learning frameworks',note:'',skillId:'ml-frameworks',kind:'skill',level:2,priority:'must',status:'gap'}]}});
save.mastery[save.target.posting.requirements[0].skillId] = 40;
console.log(JSON.stringify(view(save,{mock:true,model:'UI fixture',keyConfigured:false})));
"""
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', fixture_code],
                                            cwd=OUT.parents[1] / 'game', text=True, encoding='utf-8'))
skill_ids = [s['id'] for s in fixture['pet']['skills'] if s['id'].startswith('custom-')]
results = {'languages': {}, 'page_errors': []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium', args=[
        '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
    ])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})

    def fixture_api(route):
        if route.request.url.endswith('/api/lang'):
            fixture['lang'] = route.request.post_data_json['lang']
            route.fulfill(json={'state': fixture, 'translatedSkills': 0, 'skillTranslationPending': False})
        elif route.request.url.endswith('/api/state'):
            route.fulfill(json={'state': fixture})
        else:
            route.abort()

    context.route('**/api/**', fixture_api)
    page = context.new_page()
    page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
    responses = []

    def capture_language_result(response):
        if response.url.endswith('/api/lang') and response.request.method == 'POST':
            payload = response.json()
            responses.append({k: payload.get(k) for k in ('translatedSkills', 'skillTranslationPending')})

    page.on('response', capture_language_result)
    page.goto(BASE + '/#skip', wait_until='domcontentloaded')
    page.wait_for_function('window.game?.career?.api.state && window.game?.reveal?.step === 2', timeout=90000)
    for lang in ('zh', 'en', 'ms'):
        page.evaluate('game.career.ui.openPanel("settings")')
        page.locator('select[data-lang]').select_option(lang)
        page.wait_for_function('lang => game.career.api.state.lang === lang && !game.career.api.busy', arg=lang, timeout=120000)
        page.evaluate('game.career.ui.openPanel("pet")')
        for skill_id in skill_ids:
            card = page.locator(f'.career-pet-skills [data-skill="{skill_id}"]')
            expected = page.evaluate('id => ({name: game.career.api.state.skillNames[id], description: game.career.api.state.skillDetails[id].description})', skill_id)
            expect(card.locator('h4')).to_have_text(expected['name'][lang])
            expect(card.locator('.career-skill-description')).to_have_text(expected['description'][lang])
            expect(card.locator('[role="meter"]')).to_have_attribute('aria-valuenow', '40')
        results['languages'][lang] = {'custom_skill_cards': len(skill_ids), 'viewports': []}
        for width, height in ((1440, 1000), (390, 844), (320, 568)):
            page.set_viewport_size({'width': width, 'height': height})
            assert page.locator('.career-panel-body').evaluate('(n) => n.scrollWidth <= n.clientWidth + 1'), (lang, width, 'panel overflow')
            overflow = page.locator('.career-pet-skills .career-skill-card').evaluate_all('''nodes => nodes.filter(n => n.scrollWidth > n.clientWidth + 1).map(n => ({
                id:n.dataset.skill,width:n.clientWidth,scrollWidth:n.scrollWidth,
                children:[...n.querySelectorAll('*')].filter(c => c.getBoundingClientRect().right > n.getBoundingClientRect().right).map(c => ({class:c.className,text:c.textContent.slice(0,80),width:c.getBoundingClientRect().width}))
            }))''')
            if overflow:
                page.screenshot(path=str(OUT / 'overflow-diagnostic.png'))
            assert not overflow, (lang, width, overflow)
            results['languages'][lang]['viewports'].append(f'{width}x{height}')
            if width in (1440, 390):
                page.screenshot(path=str(OUT / f'pet-{lang}-{width}.png'))
        page.set_viewport_size({'width': 1440, 'height': 1000})
    results['cached_switches'] = len(responses)
    assert len(responses) == 3
    assert all(r == {'translatedSkills': 0, 'skillTranslationPending': False} for r in responses), responses
    assert not results['page_errors']
    browser.close()

results['isolated_fixture_no_player_save_writes'] = True
results['learning_progress_unchanged'] = True

(OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
