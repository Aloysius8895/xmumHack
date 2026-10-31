"""Visual QA: live collected sample, and a clearly labelled browser-only change fixture."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

OUT = Path(__file__).resolve().parents[2] / 'docs' / 'verification/market-posting-watch'
OUT.mkdir(parents=True, exist_ok=True)
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium', args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8787/#skip', wait_until='domcontentloaded')
    page.wait_for_function('window.game?.career?.api.state && window.game?.reveal?.step === 2', timeout=90000)
    print('Game loaded with live collected data.', flush=True)
    page.evaluate('game.career.ui.openPanel("market")')
    page.wait_for_timeout(400)
    expect(page.locator('.career-trend-intro')).to_contain_text('459')
    expect(page.locator('.career-heatmap tbody tr')).to_have_count(13)
    page.screenshot(path=str(OUT / 'market-live-desktop.png'))
    results['live_trends_13_careers'] = True
    page.locator('[data-action="market-tab"][data-tab="skills"]').click()
    expect(page.locator('.career-trend-card')).to_contain_text('180')
    page.screenshot(path=str(OUT / 'skills-live-desktop.png'))
    results['skill_denominator_visible'] = True
    page.evaluate('game.career.ui.openPanel("roadmap")')
    page.wait_for_timeout(400)
    expect(page.locator('[data-action="track-posting"]')).to_be_visible()
    page.screenshot(path=str(OUT / 'roadmap-missing-url.png'))
    results['existing_target_can_attach_url'] = True
    # This revision exists only in this tab: no API writes or generated roadmap.
    page.evaluate('''() => {
        game.career.api.state.target.posting.monitor = {
            sourceUrl: 'https://www.linkedin.com/jobs/view/123456', requiresRegeneration:true,
            lastCheckedAt:'2026-10-24T04:00:00Z', lastError:null,
            pending:{hash:'synthetic-ui-fixture',title:'[UI fixture] Updated role',description:'[UI fixture] SQL and Python requirements changed. This is not a detected company update.'}
        };
        game.career.ui.openPanel('roadmap');
    }''')
    expect(page.locator('[data-action="refresh-posting"]')).to_be_visible()
    expect(page.locator('[data-action="roadmap"]')).to_have_count(0)
    page.screenshot(path=str(OUT / 'roadmap-changed-fixture-desktop.png'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.screenshot(path=str(OUT / 'roadmap-changed-fixture-mobile.png'))
    results['changed_revision_requires_explicit_regeneration'] = True
    results['browser_only_fixture_does_not_write_save'] = True
    results['page_errors'] = errors
    (OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf8')
    browser.close()
    if errors:
        raise AssertionError(errors)
print(json.dumps(results), flush=True)
