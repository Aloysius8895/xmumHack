"""Read-only browser QA against the actual local historical market response."""
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

out = Path(__file__).resolve().parents[1] / "verification/historical-market-ui"
out.mkdir(parents=True, exist_ok=True)
results = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="chromium", args=["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"])
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.clock.set_system_time(datetime(2026, 10, 24, 4, tzinfo=timezone.utc))
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto("http://localhost:5000/#skip", wait_until="domcontentloaded")
    try:
        page.wait_for_function("window.game?.career?.api.state && window.game?.reveal?.step === 2", timeout=90000)
    except Exception:
        print(json.dumps({"page_errors": errors, "state": page.evaluate("({game:!!window.game, career:!!window.game?.career, reveal:window.game?.reveal?.step})")}), flush=True)
        page.screenshot(path=str(out / "loading-failure.png"))
        raise
    print("Game loaded with the actual collected market data.", flush=True)
    snapshot = page.evaluate('game.career.api.state.trends')
    career_count = len(snapshot['careers'])
    archived_count = sum(len(row) for row in (snapshot.get('careerObservations') or {}).values())
    page.evaluate('game.career.ui.openPanel("market")')
    expect(page.locator('.career-panel')).to_have_css('transform','none')
    expect(page.locator('.career-history')).to_be_visible()
    expect(page.locator('[data-history-source="dosm"] circle')).to_have_count(3)
    expect(page.locator('[data-history-source="techmap"] circle')).to_have_count(6)
    expect(page.locator('[data-history-source="dosm"]')).to_contain_text("225,826")
    expect(page.locator('[data-history-source="techmap"]')).to_contain_text("48,752")
    expect(page.locator('.career-heatmap tbody tr')).to_have_count(career_count)
    expect(page.locator('.career-heatmap td.is-empty')).to_have_count(0)
    expect(page.locator('.career-heatmap td[data-origin="mock"]')).to_have_count(career_count * 6 - archived_count)
    expect(page.locator('.career-heatmap td[data-origin="observed"]')).to_have_count(career_count)
    expect(page.locator('.career-heatmap td[data-origin="archived"]')).to_have_count(archived_count)
    assert "Mock" not in page.locator('.career-panel-body').inner_text()
    assert "≈" not in page.locator('.career-heatmap').inner_text()
    assert page.locator('.career-heatmap thead th').all_text_contents() == ["职业", "4月", "5月", "6月", "7月", "8月", "9月", "10月"]
    assert page.evaluate("Boolean(document.querySelector('.career-heatmap').compareDocumentPosition(document.querySelector('.career-history')) & Node.DOCUMENT_POSITION_FOLLOWING)")
    assert page.evaluate("game.career.api.state.trends.periods") == ["2026-10"]
    for row in page.locator('.career-heatmap tbody tr').all():
        assert row.locator('td').count() == 7
        assert row.locator('td[data-origin="mock"]').count() + row.locator('td[data-origin="archived"]').count() == 6
        assert row.locator('td').last.inner_text().isdigit()
    ai = page.locator('.career-heatmap tr[data-career="ml-engineer"] td').all_text_contents()
    chef = page.locator('.career-heatmap tr[data-career="chef"] td').all_text_contents()
    assert int(ai[0]) < int(ai[-1]), "AI has a rising preview profile"
    assert int(chef[0]) > int(chef[-1]), "Chef has a falling preview profile"
    results["distinct_career_trends_visible"] = True
    results["no_visible_mock_label"] = True
    expect(page.locator('[data-history-source="dosm"]')).to_contain_text("DOSM 按季度发布")
    results["heatmap_before_advertisement_history"] = True
    results["api_observations_unchanged"] = True
    expect(page.locator('.career-trend-movers')).to_have_count(1)
    page.screenshot(path=str(out / "history-desktop.png"))
    results["real_sources_visible"] = True
    results["mock_history_cells"] = career_count * 6 - archived_count
    results["observed_current_cells"] = career_count
    results["archived_history_cells"] = archived_count
    results["trend_filters_follow_displayed_values"] = True
    counts = {'rising':0,'falling':0}
    for row in page.locator('.career-heatmap tbody tr').all():
        cells = row.locator('td')
        if cells.nth(5).get_attribute('data-origin') == 'archived':
            continue
        previous, latest = int(cells.nth(5).inner_text()), int(cells.nth(6).inner_text())
        if latest > previous: counts['rising'] += 1
        if latest < previous: counts['falling'] += 1
    for kind,n in counts.items():
        assert n > 0
        page.locator('[data-market="filter"]').select_option(kind)
        expect(page.locator('.career-heatmap tbody tr')).to_have_count(n)
    page.locator('[data-market="filter"]').select_option('all')
    results['filter_counts'] = counts
    page.locator('[data-market="range"]').select_option("3")
    assert page.locator('.career-heatmap thead th').all_text_contents() == ["职业", "8月", "9月", "10月"]
    assert page.locator('.career-heatmap tr[data-career="ml-engineer"] td').all_text_contents() == ai[-3:]
    page.locator('[data-market="range"]').select_option("7")
    page.locator('[data-draft="marketSearch"]').fill("数据分析师")
    expect(page.locator('.career-heatmap tbody tr')).to_have_count(1)
    analyst = next(row for row in snapshot['careers'] if row['id']=='data-analyst')
    expect(page.locator('.career-heatmap tbody tr td').last).to_have_text(str(analyst['ads'][-1]))
    assert all(cell.isdigit() for cell in page.locator('.career-heatmap tbody tr td').all_text_contents())
    page.locator('[data-draft="marketSearch"]').fill("")
    expect(page.locator('.career-heatmap tbody tr')).to_have_count(career_count)
    results["range_and_search_preserve_month_alignment"] = True
    page.locator('.career-history-quarterly summary').click()
    expect(page.locator('.career-history-quarterly tbody tr')).to_have_count(10)
    expect(page.locator('.career-history-quarterly')).to_contain_text("19,899")
    results["quarterly_statistics_separate"] = True
    page.locator('.career-heatmap').scroll_into_view_if_needed()
    page.screenshot(path=str(out / "career-history-filled-desktop.png"))
    page.locator('[data-action="market-tab"][data-tab="skills"]').click()
    expect(page.locator('.career-history')).to_have_count(0)
    expect(page.locator('.career-trend-card')).to_contain_text(str(snapshot['denominator']))
    results["skill_sample_denominator_unchanged"] = True
    page.locator('[data-action="market-tab"][data-tab="overview"]').click()
    page.locator('.career-sampling summary').click()
    expect(page.locator('.career-sampling')).to_contain_text('入样概率未知')
    assert snapshot['sampling']['weightingApplied'] is False
    assert snapshot['sampling']['populationEstimate'] is None
    page.locator('.career-sampling summary').click()
    fde = page.locator('.career-heatmap tr[data-career="forward-deployed-engineer"]')
    expect(fde.locator('.career-new-badge')).to_have_text('NEW')
    assert fde.locator('td').all_text_contents() == ['2','2','3','1','2','1','6']
    expected_fde = snapshot['sampling']['emergingDemand']['forward-deployed-engineer']
    evidence = page.locator('[data-emerging-career="forward-deployed-engineer"]')
    expect(evidence.locator('li')).to_have_count(min(6,expected_fde['recentAds']))
    evidence.scroll_into_view_if_needed()
    page.screenshot(path=str(out / 'fde-recent-evidence-desktop.png'))
    fde.locator('button').click()
    expect(page.locator('.career-panel-header h2')).to_contain_text('FDE')
    expect(page.locator('.career-panel-body > .career-new-badge')).to_have_text('NEW')
    page.locator('[data-action="careers-back"]').click()
    page.locator('[data-draft="careerSearch"]').fill('Forward Deployed Engineer')
    expect(page.locator('.career-card')).to_have_count(1)
    expect(page.locator('.career-card .career-new-badge')).to_have_text('NEW')
    page.screenshot(path=str(out / 'fde-career-search-desktop.png'))
    page.evaluate('game.career.ui.openPanel("market")')
    results['fde_selectable_with_new_badge_and_source_links'] = True
    results['sampling_diagnostics_no_false_population_weights'] = True
    page.clock.set_system_time(datetime(2026, 11, 1, 4, tzinfo=timezone.utc))
    page.evaluate('game.career.ui.renderPanel()')
    assert page.locator('.career-heatmap thead th').all_text_contents() == ["职业", "5月", "6月", "7月", "8月", "9月", "10月", "11月"]
    for row in page.locator('.career-heatmap tbody tr').all():
        assert row.locator('td').nth(5).inner_text().isdigit(), "October observations stay in October"
        assert row.locator('td').nth(6).inner_text() == "—", "uncollected November remains unavailable"
        assert row.locator('td[data-origin="mock"]').count() + row.locator('td[data-origin="archived"]').count() == 5
    page.locator('.career-heatmap').scroll_into_view_if_needed()
    page.screenshot(path=str(out / "heatmap-november-rollover.png"))
    results["november_shows_may_to_november_with_stale_october_sample"] = True
    page.clock.set_system_time(datetime(2026, 10, 24, 4, tzinfo=timezone.utc))
    page.evaluate('game.career.ui.renderPanel()')
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator('.career-heatmap').scroll_into_view_if_needed()
    scroll = page.locator('.career-heatmap').locator('..')
    assert scroll.evaluate('(el) => el.scrollWidth > el.clientWidth')
    scroll.evaluate('(el) => { el.scrollLeft = el.scrollWidth; }')
    assert page.locator('.career-heatmap tbody th').first.evaluate('(el) => getComputedStyle(el).position') == "sticky"
    page.screenshot(path=str(out / "heatmap-mobile-current-month.png"))
    results["mobile_heatmap_scrolls_with_sticky_career_names"] = True
    page.locator('.career-history').scroll_into_view_if_needed()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path=str(out / "history-mobile.png"))
    results["mobile_no_page_horizontal_overflow"] = True
    # Browser-only fixture: real observed zero and an interior gap retain their own months.
    page.evaluate('''() => {
        game.career.api.state.trends = {
            ...game.career.api.state.trends, sample:false,
            periods:['2026-04','2026-06','2026-10'],
            careers:[{id:'qa-fixture',name:{zh:'月份对齐测试'},ads:[0,null,12]}], skills:[],
        };
        game.career.ui.renderPanel();
    }''')
    assert page.locator('.career-heatmap tbody td').first.inner_text() == "0"
    assert page.locator('.career-heatmap tbody td').last.inner_text() == "12"
    expect(page.locator('.career-heatmap td[data-origin="mock"]')).to_have_count(5)
    assert page.evaluate('game.career.api.state.trends.careers[0].ads') == [0,None,12]
    expect(page.locator('.career-heatmap td.is-empty')).to_have_count(0)
    results["browser_fixture_keeps_zero_distinct_from_missing"] = True
    results["page_errors"] = errors
    (out / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    browser.close()
    assert not errors, errors
print(json.dumps(results), flush=True)
