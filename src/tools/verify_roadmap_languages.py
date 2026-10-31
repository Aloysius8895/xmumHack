"""Check current roadmap display with real GET responses; intercept settings writes and never regenerate."""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'docs' / 'verification/roadmap-languages'
OUT.mkdir(parents=True, exist_ok=True)
SAVE = ROOT / 'game/server/data/save.json'
before_hash = hashlib.sha256(SAVE.read_bytes()).hexdigest() if SAVE.exists() else None


def read_state(lang):
    request = urllib.request.Request('http://localhost:5000/api/state', headers={'X-Career-Lang': lang})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)['state']


before = read_state('en')
assert before.get('roadmap'), 'This check needs an existing saved roadmap.'
progress = [(s['id'], [(t['id'], t['progress'], t['mp']) for t in s['tasks']]) for s in before['roadmap']['stages']]
results = {'page_errors': [], 'languages': [], 'no_regeneration_or_ai_calls': True}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium', args=[
        '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
    ])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.add_init_script("localStorage.setItem('careerLang','en');")
    page = context.new_page()
    page.on('pageerror', lambda error: results['page_errors'].append(str(error)))
    first_state_headers = []

    def api(route):
        request = route.request
        if request.url.endswith('/api/lang') and request.method == 'POST':
            # Exercise the selector with the actual server's language projection, without changing the player.
            lang = request.post_data_json['lang']
            route.fulfill(json={'state': read_state(lang), 'translatedSkills': 0, 'skillTranslationPending': False})
        elif request.method == 'POST':
            route.abort()
            raise AssertionError('Unexpected write from roadmap language check')
        else:
            if request.url.endswith('/api/state'):
                first_state_headers.append(request.headers.get('x-career-lang'))
            route.continue_()

    page.route('**/api/**', api)
    page.goto('http://localhost:5000/#skip', wait_until='domcontentloaded')
    page.wait_for_function('window.game?.career?.api.state && game.reveal.step === 2', timeout=90000)
    assert first_state_headers[0] == 'en'
    assert page.evaluate('game.career.api.state.lang') == 'en'
    results['startup_uses_browser_language'] = True

    for lang in ('en', 'zh', 'ms', 'en'):
        page.evaluate('game.career.ui.openPanel("settings")')
        page.locator('select[data-lang]').select_option(lang)
        page.wait_for_function('lang => game.career.api.state.lang === lang && !game.career.api.busy', arg=lang)
        page.evaluate('game.career.ui.openPanel("roadmap")')
        page.locator('.career-map-node').first.click()
        card = page.locator('.career-map-note .career-map-card').first
        expect(card).to_be_visible()
        state = page.evaluate('game.career.api.state')
        stage = state['roadmap']['stages'][0]
        expect(card.locator('.career-map-card-title')).to_have_text(stage['title'])
        expect(card.locator('.career-map-why')).to_contain_text(stage['why'])
        texts = [s[k] for s in state['roadmap']['stages'] for k in ('title', 'why')]
        texts += [t[k] for s in state['roadmap']['stages'] for t in s['tasks'] for k in ('title', 'why')]
        if lang in ('en', 'ms'):
            assert not any(re.search(r'[\u4e00-\u9fff]', text) for text in texts)
        assert [(s['id'], [(t['id'], t['progress'], t['mp']) for t in s['tasks']]) for s in state['roadmap']['stages']] == progress
        results['languages'].append(lang)
        page.screenshot(path=str(OUT / f'roadmap-{lang}.png'))

    await_refresh = '''async () => { await game.career.api.refresh(); return game.career.api.state.lang; }'''
    assert page.evaluate(await_refresh) == 'en'
    results['background_refresh_keeps_english'] = True
    assert not results['page_errors']
    browser.close()

assert read_state('en')['points'] == before['points']
if before_hash:
    assert hashlib.sha256(SAVE.read_bytes()).hexdigest() == before_hash
results['saved_roadmap_and_progress_unchanged'] = True
(OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
