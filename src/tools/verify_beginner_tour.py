"""New/returning usernames use isolated API fixtures; no player save or AI request is changed."""
import json
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'verification/beginner-tour'
OUT.mkdir(parents=True, exist_ok=True)
fixture_code = """
import {createSave} from './server/store.js';
import {view} from './server/game.js';
console.log(JSON.stringify(view(createSave(),{mock:true,model:'tour UI fixture',keyConfigured:false})));
"""
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', fixture_code],
                                            cwd=ROOT / 'game', text=True, encoding='utf-8'))
results = {'page_errors': [], 'isolated_api_no_player_save_writes': True}
registered = set()  # Usernames the fixture /api/register has seen (lowercase, like the server)


def ready(page):
    page.wait_for_function('window.game?.career?.api.state && game.reveal.step === 2', timeout=90000)


def sign_in(page, name):
    page.wait_for_function('window.game?.characterSelect?.signingIn && game.career?.api.state', timeout=90000)
    expect(page.locator('.career-tour')).not_to_be_visible()
    page.locator('.character-select-input').fill(name)
    page.keyboard.press('Enter')
    page.wait_for_function('game.characterSelect.active')
    page.keyboard.press('Enter')
    ready(page)


def install_api(page, slow=False):
    def api(route):
        if route.request.url.endswith('/api/state'):
            if slow:
                page.wait_for_function('window.game?.reveal?.step === 2', timeout=90000)
                assert not page.evaluate('game.career.tour.active')
                results['slow_api_waits_until_world_ready'] = True
            route.fulfill(json={'state': fixture})
        elif route.request.url.endswith('/api/register'):
            key = ' '.join(json.loads(route.request.post_data)['name'].split()).lower()
            route.fulfill(json={'newUser': key not in registered, 'state': fixture})
            registered.add(key)
        else:
            route.abort()
    page.route('**/api/**', api)
    page.on('pageerror', lambda error: results['page_errors'].append(str(error)))


with sync_playwright() as p:
    if '--mobile-only' not in sys.argv:
        browser = p.chromium.launch(headless=True, channel='chromium', args=[
            '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
        ])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        page = context.new_page()
        install_api(page)
        page.goto('http://localhost:5000/', wait_until='domcontentloaded')
        sign_in(page, 'Tour Tester')
        expect(page.locator('.career-tour')).to_be_visible()
        assert page.evaluate('game.career.tour.active && game.career.api.demo && game.career.ui.touring')
        page.evaluate('game.career.tour.stopTyping()')
        page.screenshot(path=str(OUT / 'first-visit-desktop.png'))
        results['new_username_after_character_confirmation'] = True

        page.locator('.career-tour .js-skip').click()
        expect(page.locator('.career-tour')).not_to_be_visible()
        assert page.evaluate('!game.career.api.demo && !game.career.ui.touring')
        page.goto('http://localhost:5000/?tour-check=returning', wait_until='domcontentloaded')
        assert page.locator('.character-select-input').input_value() == 'Tour Tester'
        page.evaluate('localStorage.setItem("playerCharacter", "Edixon")')
        sign_in(page, '  tour tester ')
        expect(page.locator('.career-tour')).not_to_be_visible()
        assert page.evaluate('game.career.tour.autoStartHandled && !game.career.tour.active')
        results['returning_username_stays_quiet'] = True

        page.evaluate('game.career.ui.openPanel("settings")')
        page.locator('[data-action="tutorial"]').click()
        expect(page.locator('.career-tour')).to_be_visible()
        results['settings_replay_still_works'] = True
        page.locator('.career-tour .js-skip').click()
        browser.close()

    browser = p.chromium.launch(headless=True, channel='chromium', args=[
        '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11',
    ])
    context = browser.new_context(viewport={'width': 390, 'height': 844})
    page = context.new_page()
    install_api(page, slow=True)
    page.goto('http://localhost:5000/#skip', wait_until='domcontentloaded')
    ready(page)
    # #skip has no username step: start the tour as the Settings replay does
    page.evaluate('game.career.tour.start()')
    expect(page.locator('.career-tour')).to_be_visible()
    page.evaluate('''() => {
        const tour = game.career.tour;
        while(tour.index === 0) { tour.stopTyping(); tour.next(); }
    }''')
    expect(page.locator('.career-ui')).to_have_attribute('data-tour-target', 'profile')
    page.locator('.career-rail-item[data-panel="profile"]').click()
    page.wait_for_function('game.career.tour.index === 2 && game.career.tour.element.classList.contains("is-placed")')
    page.evaluate('game.career.tour.stopTyping()')
    for width, height in ((390, 844), (320, 568)):
        page.set_viewport_size({'width': width, 'height': height})
        page.wait_for_function('''() => {
            const b = game.career.tour.element.getBoundingClientRect();
            return b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        }''')
        expect(page.locator('.career-tour .js-skip')).to_be_visible()
        page.locator('textarea[data-draft="profile"]').click()
        page.locator('textarea[data-draft="profile"]').fill('Python and SQL')
        page.locator('[data-action="extract"]').click(trial=True)
        page.wait_for_function('''() => {
            const field = document.querySelector('textarea[data-draft="profile"]').getBoundingClientRect();
            const header = document.querySelector('.career-panel-header').getBoundingClientRect();
            const action = document.querySelector('[data-action="extract"]').getBoundingClientRect();
            const tip = game.career.tour.element.getBoundingClientRect();
            return field.top >= header.bottom - 1 && action.bottom < tip.top;
        }''')
        page.screenshot(path=str(OUT / f'first-visit-mobile-{width}.png'))
    results['mobile_guidance_and_spotlight_fit_390_and_320'] = True
    page.locator('.career-tour .js-skip').click()
    assert page.locator('.career-panel-body').evaluate('(n) => n.style.paddingBottom') == ''
    assert not results['page_errors'], results['page_errors']
    browser.close()

(OUT / ('mobile-results.json' if '--mobile-only' in sys.argv else 'results.json')).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
