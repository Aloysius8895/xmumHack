"""Headless browser verification of the actual Vite game, not a separate renderer."""
import json
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'verification'/'reference-island-v2'
OUT.mkdir(parents=True,exist_ok=True)

with sync_playwright() as p:
    args=['--enable-gpu','--ignore-gpu-blocklist']+(['--use-angle=d3d11'] if sys.platform=='win32' else [])
    browser=p.chromium.launch(headless=True,channel='chromium',args=args)
    report={}
    for mode in ['island','original']:
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script('const realNow=Date.now.bind(Date);const dayOffset=Math.floor(realNow()/240000)*240000+12000-realNow();Date.now=()=>realNow()+dayOffset;')
        page.goto(f'http://127.0.0.1:5173/?map={mode}#skip',wait_until='load',timeout=120000)
        page.wait_for_timeout(10000)
        page.evaluate("async()=>{window.qaGame=window.game||(await import('/Game/Game.js')).Game.getInstance()}")
        try:
            page.wait_for_function('window.qaGame?.career',timeout=45000)
            page.keyboard.press('Enter')
            page.wait_for_timeout(3000)
            page.keyboard.press('Escape')
            page.wait_for_timeout(1000)
        except Exception:
            pass
        print(mode,'loaded',json.dumps(errors),flush=True)
        page.screenshot(path=str(OUT/f'{mode}-player.png'))
        state=page.evaluate('''() => {const g=qaGame; return {island:!!g.island,career:!!g.career,
            classes:document.documentElement.className,position:g.player?.position.toArray(),
            terrainHeight:g.island?.height(g.player.position.x,g.player.position.z),
            grounded:g.physicalVehicle?.grounded,npcs:g.career?.world.npcs.map(n=>({id:n.career.id,p:n.character.group.position.toArray(),grounded:n.character.grounded})),
            treeCount:g.world?.oakTrees?.bodies.count};}''')
        report[mode]={'state':state,'errors':errors}
        print(mode,json.dumps(report[mode]),flush=True)
        if mode=='island' and state['career']:
            for name,x,z in [('garden',2,-31),('volcano',10,35),('coast',37,16)]:
                page.evaluate('''([x,z])=>{const g=qaGame;g.physicalVehicle.moveTo({x,y:g.island.height(x,z)+1.3,z},0);g.view.focusPoint.isTracking=true}''',[x,z])
                page.wait_for_timeout(2500)
                page.screenshot(path=str(OUT/f'island-{name}.png'))
            page.keyboard.press('m')
            page.wait_for_timeout(1000)
            page.screenshot(path=str(OUT/'island-map.png'))
            page.keyboard.press('Escape')
            page.evaluate('''()=>{const g=qaGame;g.view.camera.far=1000;g.view.freeCamera.far=1000;
                g.view.freeCamera.updateProjectionMatrix();g.view.camera.updateProjectionMatrix();g.view.setMode(2);
                g.view.freeMode.setLookAt(210,260,280,0,0,0,false);
                g.fog.update=()=>{g.fog.near.value=350;g.fog.far.value=800;};
                const water=g.world.waterSurface,update=water.update.bind(water);
                water.update=()=>{update();water.mesh.position.x=0;water.mesh.position.z=0;water.mesh.scale.setScalar(500);};
                document.querySelector('.career-ui').style.display='none';}''')
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT/'island-overview.png'))
        page.close()
    browser.close()
    (OUT/'browser-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
