"""Read real UI; simulate only async refresh responses, never publish test ads."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

out = Path(__file__).resolve().parents[2] / 'docs' / 'verification/crawler-integration'
out.mkdir(parents=True, exist_ok=True)
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium', args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://localhost:5000/#skip',wait_until='domcontentloaded')
    page.wait_for_function('window.game?.career?.api.state && window.game?.reveal?.step===2',timeout=90000)
    page.evaluate('game.career.ui.openPanel("market")')
    expect(page.locator('.career-panel')).to_have_css('transform','none')
    expect(page.locator('.career-emerging-demand')).to_have_count(0)
    expect(page.locator('.career-heatmap tr[data-career="forward-deployed-engineer"] .career-new-badge')).to_have_count(1)
    page.evaluate('game.career.ui.openPanel("careers", {careerId:"forward-deployed-engineer"})')
    expect(page.locator('.career-emerging-demand')).to_have_count(0)
    assert page.locator('.career-panel .career-new-badge').count()>=1
    page.evaluate('game.career.ui.openPanel("market")')
    results['fde_details_card_removed_career_retained']=True
    for tab in ('ranking','skills'):
        page.locator(f'[data-action="market-tab"][data-tab="{tab}"]').click()
        expect(page.locator('.career-sampling')).to_have_count(0)
        expect(page.locator('[data-action="market-refresh"]')).to_have_count(0)
    page.locator('[data-action="market-tab"][data-tab="overview"]').click()
    expect(page.locator('.career-sampling')).to_have_count(1)
    results['coverage_and_refresh_only_in_market_overview']=True
    button=page.locator('[data-action="market-refresh"]')
    expect(button).to_be_visible()
    expect(page.locator('.career-sampling [data-action="market-refresh"]')).to_have_count(1)
    expect(page.locator('.career-crawler-status')).to_have_count(0)
    assert 'crawler' not in page.locator('.career-panel').inner_text().lower()
    assert '爬虫' not in page.locator('.career-panel').inner_text()
    toggle=page.locator('[data-action="market-sampling-toggle"]')
    expect(toggle).to_have_attribute('aria-expanded','false')
    toggle.click()
    expect(toggle).to_have_attribute('aria-expanded','true')
    expect(page.locator('.career-sampling-content')).to_be_visible()
    assert page.locator('.career-sampling-content p').first.evaluate('(el)=>getComputedStyle(el).fontSize')=='16px'
    assert page.locator('.career-sampling dd').first.evaluate('(el)=>getComputedStyle(el).fontSize')=='16px'
    a,b=toggle.bounding_box(),button.bounding_box()
    assert b['x']>=a['x']+a['width'] and abs((b['y']+b['height']/2)-(a['y']+a['height']/2))<3
    results['refresh_at_upper_right_of_coverage']=True
    results['coverage_body_16px_and_status_block_removed']=True
    before=page.evaluate('JSON.stringify(game.career.api.state.trends.careers)')
    page.screenshot(path=str(out/'refresh-desktop.png'))
    counts={'starts':0,'polls':0}
    def start(route):
        counts['starts']+=1
        route.fulfill(status=202,json={'runId':'ui-test-run','status':'running'})
    def poll(route):
        counts['polls']+=1
        status=['running','publishing','published'][min(counts['polls']-1,2)] if counts['starts']==1 else 'failed'
        route.fulfill(json={'runId':'ui-test-run','status':status,'postings':20,'newAds':5,'previouslySeen':15,'error':'crawler-collection-failed'})
    page.route('**/api/market/sample/refresh',start)
    page.route('**/api/market/sample/ui-test-run',poll)
    button.click()
    expect(button).to_be_disabled()
    expect(toggle).to_have_attribute('aria-expanded','true')
    expect(page.locator('.career-heatmap tbody tr')).to_have_count(14)
    page.wait_for_function('game.career.ui.marketRefreshResult?.status === "published"',timeout=20000)
    expect(page.locator('.career-market-refresh-message')).to_contain_text('20')
    expect(button).to_be_enabled()
    expect(toggle).to_have_attribute('aria-expanded','true')
    assert counts['starts']==1 and counts['polls']==3
    assert page.evaluate('JSON.stringify(game.career.api.state.trends.careers)')==before
    results['button_starts_and_polls_new_collection']=True
    results['disabled_while_running_and_reloads_after_publication']=True
    button.click()
    page.wait_for_function('game.career.ui.marketRefreshResult?.status === "failed"',timeout=10000)
    expect(page.locator('.career-market-refresh-message')).not_to_be_empty()
    assert page.evaluate('JSON.stringify(game.career.api.state.trends.careers)')==before
    results['failure_retains_previous_chart']=True
    page.set_viewport_size({'width':390,'height':844})
    expect(button).to_be_visible()
    a,b=toggle.bounding_box(),button.bounding_box()
    assert b['x']>=a['x']+a['width']
    assert page.locator('.career-sampling-content p').first.evaluate('(el)=>getComputedStyle(el).fontSize')=='16px'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(out/'refresh-mobile.png'))
    results['mobile_button_visible_without_page_overflow']=True
    results['synthetic_refresh_responses_only_no_test_ads_published']=True
    results['page_errors']=errors
    assert not errors
    browser.close()
(out/'ui-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(results,ensure_ascii=False,indent=2))
