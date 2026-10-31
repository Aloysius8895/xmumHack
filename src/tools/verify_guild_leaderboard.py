"""Verify the world parchment using an isolated API fixture, without writing a player save."""
import base64
import json
import subprocess
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'docs' / 'verification' / 'guild-leaderboard'
OUT.mkdir(parents=True, exist_ok=True)
fixture_code = """
import { createSave } from './server/store.js';
import { view } from './server/game.js';
const save = createSave();
save.player.name = 'Aloysius';
save.points = 1280;
save.friends = [
    {id:'edixon01',name:'Edixon',points:960,sharedAt:'2026-10-21'},
    {id:'leekhim1',name:'Lee Khim',points:840,sharedAt:'2026-10-21'},
    {id:'fourth01',name:'Fourth player',points:100,sharedAt:'2026-10-21'},
];
console.log(JSON.stringify(view(save,{mock:true})));
"""
fixture = json.loads(subprocess.check_output(
    ['node', '--input-type=module', '-e', fixture_code],
    cwd=ROOT / 'game', text=True, encoding='utf-8'))
report = {'fixture_only': True, 'checks': []}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, channel='chromium',
        args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.add_init_script("localStorage.setItem('playerCharacter','Aloysius')")
    context.route('**/api/**', lambda route: route.fulfill(
        status=200, content_type='application/json', body=json.dumps({'state': fixture})))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5173/#skip', wait_until='domcontentloaded')
        page.wait_for_function('''() => {
            const board = window.game?.world?.areas?.landing?.guildLeaderboard;
            return game?.reveal?.step === 2 && board?.paintedRows?.length === 3
                && board.rows.length === 3 && [...board.portraits.values()].every(i=>i.complete);
        }''', timeout=90000)
        page.evaluate('document.fonts.ready')
        page.evaluate('''() => {
            const board = game.world.areas.landing.guildLeaderboard;
            const focus = game.view.focusPoint;
            focus.isTracking = false; focus.magnet.active = false;
            focus.position.copy(board.group.position).add({x:0,y:0.2,z:0});
            focus.smoothedPosition.copy(focus.position);
            game.view.spherical.radius.edges.min = 10;
            game.view.spherical.radius.edges.max = 10;
            game.dayCycles.newAbsoluteProgressBinding.manual = true;
            game.dayCycles.newAbsoluteProgressBinding.manualValue = 0.1;
        }''')
        page.wait_for_timeout(1500)
        initial = page.evaluate('''() => {
            const area=game.world.areas.landing, b=area.guildLeaderboard;
            return {rows:b.rows, painted:b.paintedRows, visible:b.group.visible,
                children:b.group.children.length, frustum:area.objects.hideable.includes(b.group),
                version:b.texture.version, playerPortrait:b.playerCharacter,
                oldMapMaterial:game.materials.list.has('stylizedMap')};
        }''')
        assert [r['name'] for r in initial['rows']] == ['Aloysius', 'Edixon', 'Lee Khim']
        assert [r['score'] for r in initial['painted']] == ['1,280', '960', '840']
        assert initial['visible'] and initial['frustum'] and initial['children'] == 5
        assert not initial['oldMapMaterial']
        report['checks'].append('Top three real fixture entries; no fourth row or old map mesh; paper and four side notices registered for visibility')
        page.screenshot(path=str(OUT / 'daylight.png'))
        data = page.evaluate('game.world.areas.landing.guildLeaderboard.canvas.toDataURL("image/png")')
        (OUT / 'paper-detail.png').write_bytes(base64.b64decode(data.split(',')[1]))
        page.wait_for_timeout(350)
        assert page.evaluate('game.world.areas.landing.guildLeaderboard.texture.version') == initial['version']
        report['checks'].append('Canvas texture stays unchanged between state updates')
        print('Initial world placement and live parchment texture verified.', flush=True)

        page.evaluate('''() => {
            const state=structuredClone(game.career.api.state);
            state.leaderboard=[{id:'friend99',name:'New champion',points:2500,me:false},
                {...state.leaderboard[0],points:1400},state.leaderboard[1]];
            game.career.api.state=state; game.career.api.events.trigger('state',[state]);
        }''')
        updated = page.evaluate('game.world.areas.landing.guildLeaderboard.paintedRows')
        assert updated[0]['name'] == 'New champion' and updated[0]['score'] == '2,500'
        assert updated[1]['score'] == '1,400'
        report['checks'].append('State event updates names, order and scores on the paper')

        for lang, label in [('zh', '待上榜'), ('en', 'Open spot'), ('ms', 'Tempat kosong')]:
            painted = page.evaluate('''async lang => {
                await game.career.ui.changeLang(lang);
                const state=structuredClone(game.career.api.state);
                state.leaderboard=[{id:'unicode',name:'魔法公会冒险者这是一个很长的中文名字✨',points:1234567890,me:false}];
                game.career.api.state=state; game.career.api.events.trigger('state',[state]);
                return game.world.areas.landing.guildLeaderboard.paintedRows;
            }''', lang)
            assert painted[0]['name'].endswith('…')
            assert len(painted[0]['score']) < 10
            assert painted[1]['empty'] and painted[2]['empty']
            assert painted[1]['name'] == label, (lang, painted)
        report['checks'].append('Long Unicode names, compact large scores and localized empty slots in zh/en/ms')

        page.evaluate('''async fixture => {
            await game.career.ui.changeLang('zh');
            game.career.api.state=fixture; game.career.api.events.trigger('state',[fixture]);
            game.characterSelect.setMapAvatar({id:'Edixon'});
        }''', fixture)
        assert page.evaluate('game.world.areas.landing.guildLeaderboard.playerCharacter') == 'Edixon'
        page.evaluate("game.characterSelect.setMapAvatar({id:'Aloysius'})")
        report['checks'].append('Changing the selected character refreshes the local player portrait')

        page.evaluate('''() => {
            const area=game.world.areas.landing;
            const point=area.references.items.get('kioskInteractivePoint')[0].position;
            game.interactivePoints.items.find(p=>Math.hypot(p.position.x-point.x,p.position.y-point.z)<0.01).interactCallback();
        }''')
        expect(page.locator('.js-career-panel-title')).to_have_text('排行榜')
        assert page.locator('.career-leaderboard-row').count() == 4
        page.evaluate('game.career.ui.closePanel()')
        page.wait_for_timeout(300)
        page.keyboard.press('m')
        page.wait_for_function("game.modals.current?.name === 'map' && game.map.modal.isOpen")
        page.keyboard.press('m')
        page.wait_for_timeout(600)
        report['checks'].append('Kiosk opens the complete four-player leaderboard; M still opens and closes the map')

        page.evaluate('''() => {
            const f=game.view.focusPoint;
            f.position.x=0; f.position.z=0; f.smoothedPosition.copy(f.position);
        }''')
        page.wait_for_timeout(700)
        assert not page.evaluate('game.world.areas.landing.guildLeaderboard.group.visible')
        page.evaluate('''() => {
            const f=game.view.focusPoint, b=game.world.areas.landing.guildLeaderboard;
            f.position.copy(b.group.position).add({x:0,y:0.2,z:0}); f.smoothedPosition.copy(f.position);
            game.dayCycles.newAbsoluteProgressBinding.manualValue=0.45;
        }''')
        page.wait_for_timeout(1000)
        assert page.evaluate('game.world.areas.landing.guildLeaderboard.group.visible')
        assert page.evaluate('game.world.areas.landing.guildLeaderboard.paintedRows[0].score') == '1,280'
        page.screenshot(path=str(OUT / 'night.png'))
        report['checks'].append('Board hides and returns with area frustum; artwork remains correct at night')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / 'mobile.png'))
        report['checks'].append('Mobile viewport renders without page errors')
        assert errors == [], errors
        report['page_errors'] = errors
        report['initial'] = initial
        report['passed'] = True
    finally:
        report['page_errors'] = errors
        (OUT / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        browser.close()

print(json.dumps(report, ensure_ascii=False, indent=2))
