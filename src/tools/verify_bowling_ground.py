"""Regression for the actual exported terrain and player at the bowling map edge.

Run with the game dev server on port 5173. Uses an isolated browser context and
does not submit any game API writes. --baseline records the pre-fix geometry.
"""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--baseline', action='store_true')
args = parser.parse_args()
out = Path(__file__).resolve().parents[1] / 'verification' / 'bowling-ground'
out.mkdir(parents=True, exist_ok=True)
report = {'baseline': args.baseline, 'checks': []}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,
        args=['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5173/?characterDebug=1#skip', wait_until='domcontentloaded')
        page.wait_for_function('window.game?.world?.areas?.bowling && game.reveal?.step === 2', timeout=90000)
        report['floorSamples'] = page.evaluate('''() => {
            const c = game.physicalVehicle;
            const samples = [];
            for(const x of [-17.65, -17.1, -16.5])
                for(const z of [63, 64.5, 66, 67.5, 69, 70.5, 72]) {
                    const hit = c.recovery.ray({x, y:10, z}, 0, 0, 25, true);
                    samples.push({x, z, y:hit ? 10-hit.timeOfImpact : null});
                }
            return samples;
        }''')
        if not args.baseline:
            assert all(s['y'] is not None and abs(s['y']) < .06 for s in report['floorSamples']), report['floorSamples']
            report['checks'].append('21 paved-edge ground rays agree with visible ground within 6 cm')
        page.evaluate('''() => {
            const c = game.physicalVehicle;
            c.moveTo({x:-17.6, y:3, z:63});
            game.view.focusPoint.isTracking = true;
            game.view.focusPoint.smoothedPosition.copy(c.position);
            game.view.spherical.radius.edges.min = 12;
            game.view.spherical.radius.edges.max = 16;
        }''')
        page.wait_for_function('game.physicalVehicle.grounded && Math.abs(game.physicalVehicle.chassis.physical.body.linvel().y)<.1')
        page.wait_for_timeout(400)

        def snapshot():
            return page.evaluate('''() => {
                const c=game.physicalVehicle;
                return {position:c.position.toArray(), feet:game.world.visualVehicle.root.position.toArray(),
                    grounded:c.grounded, relocations:c.recovery.relocations, corrections:c.recovery.corrections};
            }''')

        report['settled'] = snapshot()
        page.screenshot(path=str(out / ('baseline-capsule.png' if args.baseline else 'after-capsule.png')))
        if not args.baseline:
            assert report['settled']['feet'][1] > -.06, report['settled']
            report['checks'].append('Settled character stands on the visible paved floor')
            initial_relocations = report['settled']['relocations']

            def hold(keys, milliseconds):
                try:
                    for key in keys:
                        page.keyboard.down(key)
                    page.wait_for_timeout(milliseconds)
                finally:
                    for key in keys:
                        page.keyboard.up(key)
                page.wait_for_timeout(250)
                state = snapshot()
                assert state['feet'][1] > -.08, state
                assert state['position'][0] > -17.68, state
                assert state['relocations'] == initial_relocations, state
                return state

            # The actual default camera is at theta=pi/4: W+A pushes west,
            # A+S walks south along the boundary, D+S moves east away from it.
            report['boundaryPush'] = hold(['w', 'a'], 900)
            report['alongBoundary'] = hold(['a', 's'], 900)
            assert report['alongBoundary']['position'][2] > report['boundaryPush']['position'][2] + .7
            report['awayFromBoundary'] = hold(['d', 's'], 450)
            assert report['awayFromBoundary']['position'][0] > report['alongBoundary']['position'][0] + .4
            report['checks'].append('Real keyboard movement: boundary push, walk along edge, back away without sinking or relocation')

            page.keyboard.press('Space')
            page.wait_for_function('!game.physicalVehicle.grounded', timeout=5000)
            page.wait_for_function('game.physicalVehicle.grounded && Math.abs(game.physicalVehicle.chassis.physical.body.linvel().y)<.1', timeout=10000)
            report['landed'] = snapshot()
            assert report['landed']['feet'][1] > -.08, report['landed']
            report['checks'].append('Jump and landing remain above the visible floor')

        page.evaluate('game.physicalVehicle.diagnostics.setEnabled(false)')
        page.wait_for_timeout(100)
        page.screenshot(path=str(out / ('baseline.png' if args.baseline else 'after.png')))
        assert not errors, errors
        report['passed'] = True
    finally:
        report['pageErrors'] = errors
        (out / ('baseline-results.json' if args.baseline else 'results.json')).write_text(
            json.dumps(report, indent=2), encoding='utf-8')
        browser.close()

print(json.dumps({'passed': report.get('passed', False), 'checks': report['checks'], 'settled': report.get('settled')}))
