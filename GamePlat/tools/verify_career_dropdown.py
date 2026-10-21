"""Exercise the career menu and corner layout in the running local game."""
import json
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'verification' / 'career-dropdown'
OUT.mkdir(parents=True, exist_ok=True)
results = {}


def check_layout(page, expanded):
    trigger = page.locator('.career-menu-trigger').bounding_box()
    minimap = page.locator('.career-minimap').bounding_box()
    hud = page.locator('.career-hud').bounding_box()
    width = page.viewport_size['width']
    assert minimap['x'] < 30 and minimap['y'] < 30, minimap
    assert trigger['x'] > width / 2 and trigger['y'] < 30, trigger
    assert hud['x'] > minimap['x'] + minimap['width'], (hud, minimap)
    assert abs(hud['x'] + hud['width'] - trigger['x'] - trigger['width']) < 2
    assert hud['y'] >= trigger['y'] + trigger['height'] + 8
    assert hud['y'] + hud['height'] <= page.viewport_size['height'], hud
    if expanded:
        rail = page.locator('.career-rail').bounding_box()
        assert hud['y'] >= rail['y'] + rail['height'] + 8, (hud, rail)
    return {'trigger': trigger, 'minimap': minimap, 'hud': hud}


def run(browser, mobile):
    name = 'mobile' if mobile else 'desktop'
    context = browser.new_context(viewport={'width': 390 if mobile else 1440, 'height': 844 if mobile else 1000},
                                  is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    page_errors = []
    page.on('pageerror', lambda error: page_errors.append(str(error)))
    page.goto('http://127.0.0.1:5173/#skip', wait_until='domcontentloaded')
    page.wait_for_function('window.game?.career?.api.state && window.game?.reveal?.step === 2', timeout=90000)
    page.wait_for_timeout(800)
    print(f'{name}: game ready', flush=True)
    trigger = page.locator('.career-menu-trigger')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    assert page.locator('.js-menu-trigger, .js-map-trigger').count() == 0
    assert page.locator('.career-rail-item').count() == 6
    assert page.locator('.career-rail').evaluate('(element) => element.inert')
    collapsed = check_layout(page, False)
    page.screenshot(path=str(OUT / f'{name}-closed.png'))

    filters = page.evaluate('[...game.inputs.filters]')
    trigger.click()
    expect(trigger).to_have_attribute('aria-expanded', 'true')
    page.wait_for_timeout(350)
    expanded = check_layout(page, True)
    assert page.evaluate('[...game.inputs.filters]') == ['career']
    page.screenshot(path=str(OUT / f'{name}-open.png'))
    page.keyboard.press('Escape')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    expect(trigger).to_be_focused()
    assert page.evaluate('[...game.inputs.filters]') == filters

    trigger.click()
    page.mouse.click(page.viewport_size['width'] / 2, page.viewport_size['height'] * .85)
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    trigger.click()
    trigger.click()
    expect(trigger).to_have_attribute('aria-expanded', 'false')

    trigger.focus()
    page.keyboard.press('ArrowDown')
    expect(page.locator('[data-panel="profile"].career-rail-item')).to_be_focused()
    page.keyboard.press('End')
    expect(page.locator('[data-panel="settings"].career-rail-item')).to_be_focused()
    page.evaluate('game.career.ui.renderRail()')
    expect(page.locator('[data-panel="settings"].career-rail-item')).to_be_focused()
    page.keyboard.press('Home')
    page.keyboard.press('Enter')
    expect(page.locator('.career-panel')).to_have_class('career-panel js-career-panel is-open')
    expect(trigger).to_have_attribute('aria-expanded', 'false')
    page.keyboard.press('Escape')
    expect(trigger).to_be_focused()

    routes = []
    for panel in ['profile', 'careers', 'pet', 'roadmap', 'log', 'settings']:
        trigger.click()
        page.locator(f'.career-rail-item[data-panel="{panel}"]').click()
        assert page.evaluate('game.career.ui.panel.name') == panel
        expect(trigger).to_have_attribute('aria-expanded', 'false')
        assert not trigger.is_visible()
        assert page.locator('.js-career-panel-title').inner_text()
        page.locator('.career-close').click()
        routes.append(panel)
    print(f'{name}: six panel routes and dismissals passed', flush=True)

    if not mobile:
        for lang, label in [('en', 'Menu'), ('ms', 'Menu'), ('zh', '菜单')]:
            page.evaluate('(lang) => game.career.ui.changeLang(lang)', lang)
            expect(page.locator('.js-career-menu-label')).to_have_text(label)
        page.locator('.career-minimap-open').click(position={'x': 90, 'y': 145})
        page.wait_for_function('game.modals.items.get("map").isOpen && game.modals.state === 1')
        page.keyboard.press('Escape')
        page.wait_for_function('game.modals.state === 3')
    else:
        page.set_viewport_size({'width': 320, 'height': 568})
        trigger.tap()
        page.wait_for_timeout(350)
        check_layout(page, True)
        page.locator('.career-rail-item[data-panel="settings"]').tap()
        assert page.evaluate('game.career.ui.panel.name') == 'settings'
        page.locator('.career-close').tap()
        page.set_viewport_size({'width': 740, 'height': 390})
        trigger.tap()
        page.wait_for_timeout(350)
        check_layout(page, True)
        page.screenshot(path=str(OUT / 'mobile-landscape-open.png'))
        page.keyboard.press('Escape')

    assert not page_errors, page_errors
    results[name] = {'collapsed': collapsed, 'expanded': expanded, 'routes': routes, 'page_errors': page_errors}
    context.close()


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, channel='chromium',
                                         args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    try:
        run(browser, False)
        run(browser, True)
    finally:
        browser.close()
        (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print('All menu and corner-layout checks passed.', flush=True)
