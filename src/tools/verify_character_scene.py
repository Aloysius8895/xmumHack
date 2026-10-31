"""Real scene/animation/crate integration, isolated from the user's saved progress."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'docs' / 'verification' / 'character-stuck'
OUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import {createSave} from './server/store.js'; import {view} from './server/game.js'; console.log(JSON.stringify(view(createSave(),{mock:true})));"],
    cwd=ROOT / 'game', text=True, encoding='utf-8'))
report = {'fixture_only': True, 'checks': []}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium',
        args=['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    context.route('**/api/**', lambda route: route.fulfill(status=200,
        content_type='application/json', body=json.dumps({'state': fixture})))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    try:
        page.goto('http://127.0.0.1:5173/?characterDebug=1#skip', wait_until='domcontentloaded')
        page.wait_for_function('game?.world?.areas?.social && game?.reveal?.step === 2', timeout=90000)
        page.wait_for_function('game.physicalVehicle.grounded && game.physicalVehicle.knockState === "none"', timeout=15000)
        report['controller'] = page.evaluate('''() => {
            const c=game.physicalVehicle, visual=game.world.visualVehicle;
            return {class:c.constructor.name,radius:c.radius,height:c.height,
                colliderRadius:c.chassis.physical.colliders[0].shape.radius,
                colliderHalfHeight:c.chassis.physical.colliders[0].shape.halfHeight,
                ccd:c.chassis.physical.body.isCcdEnabled(),
                visualHeight:c.height,modelScale:visual.model.scale.toArray(),knockDeadline:c.knockRecoveryDuration,
                animations:Object.fromEntries(Object.entries(visual.animations.actions).map(([name,action])=>[name,action.getClip().duration]))};
        }''')
        social = page.evaluate('''() => {
            const c=game.physicalVehicle, area=game.world.areas.social;
            const origin=area.center.clone();origin.y=2;
            const safe=c.recovery.findSafePosition(origin);
            if(!safe) throw new Error('No supported landing near social props');
            c.moveTo(safe.point);
            game.view.focusPoint.isTracking=true;
            game.view.focusPoint.smoothedPosition.copy(c.position);
            game.view.spherical.radius.edges.min=12;game.view.spherical.radius.edges.max=16;
            return {center:area.center.toArray(),start:c.position.toArray(),
                objects:area.objects.items.filter(o=>o.physical).map(o=>({name:o.visual?.object3D.name,colliders:o.physical.colliders.length,position:{...o.physical.body.translation()}}))};
        }''')
        report['social'] = social
        page.wait_for_timeout(500)
        page.keyboard.down('w'); page.wait_for_timeout(1400); page.keyboard.up('w')
        before = page.evaluate('game.physicalVehicle.position.toArray()')
        page.keyboard.down('s'); page.wait_for_timeout(1200); page.keyboard.up('s')
        after = page.evaluate('game.physicalVehicle.position.toArray()')
        assert sum((a-b)**2 for a,b in zip(before,after)) > 0.1
        report['checks'].append('Actual keyboard movement and reverse among social scene props')
        page.screenshot(path=str(OUT/'social-capsule.png'))
        page.evaluate('game.wireframe.active=true; game.scene.add(game.wireframe.lineSegments)')
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT/'social-all-colliders.png'))
        page.evaluate('game.wireframe.active=false; game.wireframe.lineSegments.removeFromParent()')
        print('Real scene loaded; social movement and capsule visualization verified.', flush=True)

        crate = page.evaluate('''() => {
            const c=game.physicalVehicle;
            const crates=game.world.explosiveCrates.items.filter(item=>!item.exploded);
            for(const crate of crates)
            {
                const origin=crate.object.physical.body.translation();
                for(const offset of [[1.7,0],[-1.7,0],[0,1.7],[0,-1.7]])
                {
                    const point=c.recovery.landingAt({y:2},origin.x+offset[0],origin.z+offset[1]);
                    if(!point)continue;
                    c.moveTo(point);game.world.explosiveCrates.explode(crate);
                    return {id:crate.id,position:{...origin},start:point.toArray()};
                }
            }
            throw new Error('No crate with a validated nearby player landing');
        }''')
        report['crate'] = crate
        page.wait_for_function('game.physicalVehicle.knockState === "air"', timeout=10000)
        page.screenshot(path=str(OUT/'crate-airborne.png'))
        page.wait_for_function('game.physicalVehicle.knockState === "none" && game.physicalVehicle.grounded', timeout=25000)
        page.screenshot(path=str(OUT/'crate-recovered.png'))
        report['checks'].append('Actual crate delay -> fireball -> explosion -> airborne -> landing/getUp -> controls')
        print('Actual crate explosion and landing recovered.', flush=True)

        for i in range(3):
            page.evaluate('''i => {
                const c=game.physicalVehicle, blast=c.position.clone().add({x:i%2?1:-1,y:-0.5,z:0.4});
                game.world.fireballs.create(blast,2,5);
            }''', i)
            page.wait_for_timeout(350)
        page.wait_for_function('game.physicalVehicle.knockState === "none" && game.physicalVehicle.grounded', timeout=30000)
        report['checks'].append('Three consecutive real fireball explosions with moving debris and animation recovery')
        print('Repeated explosions recovered.', flush=True)

        page.evaluate('''() => {
            let previous=-Infinity;
            game.rendering.renderer.setAnimationLoop(time=>{
                if(time-previous<100)return;
                previous=time;game.ticker.update(time);
            });
            const c=game.physicalVehicle;
            game.world.fireballs.create(c.position.clone().add({x:-1,y:-0.5,z:0.3}),2,5);
        }''')
        page.wait_for_function('game.physicalVehicle.knockState === "air"', timeout=10000)
        page.wait_for_function('game.physicalVehicle.knockState === "none" && game.physicalVehicle.grounded', timeout=35000)
        before = page.evaluate('game.physicalVehicle.position.toArray()')
        page.keyboard.down('s'); page.wait_for_timeout(2000); page.keyboard.up('s')
        after = page.evaluate('game.physicalVehicle.position.toArray()')
        assert sum((a-b)**2 for a,b in zip(before,after)) > 0.1
        page.screenshot(path=str(OUT/'low-fps-recovered.png'))
        report['checks'].append('Full game at ~10 FPS: bomb launch, landing and keyboard control after recovery')

        report['diagnostics'] = page.evaluate('''() => {
            const c=game.physicalVehicle,v=game.world.visualVehicle;
            return {samples:c.diagnostics.samples,events:c.diagnostics.events,
                relocations:c.recovery.relocations,corrections:c.recovery.corrections,
                capsule:{...c.chassis.physical.body.translation()},visual:v.root.position.toArray(),
                grounded:c.grounded,knock:c.knockState,playerState:game.player.state};
        }''')
        d=report['diagnostics']
        assert abs(d['visual'][0]-d['capsule']['x'])<0.001
        assert abs(d['visual'][1]+0.75-d['capsule']['y'])<0.001
        assert abs(d['visual'][2]-d['capsule']['z'])<0.001
        assert d['knock']=='none' and d['playerState']==1
        assert not errors, errors
        report['passed'] = True
    finally:
        report['page_errors'] = errors
        (OUT/'scene-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        browser.close()
print(json.dumps({k:v for k,v in report.items() if k not in ['diagnostics','social']},ensure_ascii=False,indent=2))
