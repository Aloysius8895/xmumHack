"""Browser checks for the restored, cropped original map."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT=Path(__file__).resolve().parents[3]/'docs'/'verification'/'cropped-original'
OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,channel='chromium',args=['--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('const now=Date.now.bind(Date);const offset=Math.floor(now()/240000)*240000+10000-now();Date.now=()=>now()+offset;')
    page.goto('http://127.0.0.1:5173/#skip',wait_until='load',timeout=120000)
    page.wait_for_function('window.game?.clickMove && window.game?.career',timeout=60000)
    page.wait_for_function('window.game.reveal.step>=2',timeout=30000)
    page.evaluate("() => {if(game.inputs.filters.has('menu'))game.menu.close()}")
    page.wait_for_timeout(1000)
    print('ready',json.dumps(errors),flush=True)
    page.screenshot(path=str(OUT/'game.png'))
    state=page.evaluate('''() => {const g=window.game;return {island:!!g.island,bounds:g.mapBounds,
        classes:document.documentElement.className,position:g.player.position.toArray(),
        npcs:g.career.world.npcs.map(n=>({id:n.career.id,p:n.character.group.position.toArray(),grounded:n.character.grounded})),
        areas:Object.keys(g.world.areas),trees:g.world.oakTrees.bodies.count}}''')
    print(json.dumps(state),flush=True)
    page.keyboard.press('m')
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT/'map.png'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)
    movement=page.evaluate('''() => {const g=window.game,from=g.player.position;
        for(const dx of [-5,5,-3,3])for(const dz of [-3,3,0]){
            const target={x:from.x+dx,z:from.z+dz};const path=g.clickMove.navigation.findPath(from,target);
            if(path.length>2&&path.length<14){const projected=from.clone().set(target.x,.02,target.z).project(g.view.camera);
                return {start:from.toArray(),target,path:path.length,screen:{x:(projected.x+1)*innerWidth/2,y:(1-projected.y)*innerHeight/2}}}}
        return null}''')
    if movement:
        page.mouse.move(movement['screen']['x'],movement['screen']['y'])
        page.wait_for_timeout(100)
        page.mouse.click(movement['screen']['x'],movement['screen']['y'])
        page.wait_for_timeout(100)
    click_started=page.evaluate('game.clickMove.path.length>0')
    page.wait_for_timeout(1700)
    moved=page.evaluate('() => ({position:game.player.position.toArray(),remaining:game.clickMove.path.length})')
    page.keyboard.down('w')
    page.wait_for_timeout(150)
    page.keyboard.up('w')
    cancelled=page.evaluate('game.clickMove.path.length===0')
    page.evaluate('game.physicalVehicle.moveTo({x:-30,y:2,z:25},0)')
    page.wait_for_timeout(500)
    bounded=page.evaluate('game.player.position.x>=game.mapBounds.minX')
    page.evaluate('game.career.world.teleportTo("frontend-developer")')
    page.wait_for_function('!game.overlay.mesh.visible',timeout=15000)
    page.wait_for_timeout(400)
    page.screenshot(path=str(OUT/'game.png'))
    report={'state':state,'errors':errors,'movement':movement,'clickStarted':click_started,'afterMovement':moved,'keyboardCancels':cancelled,'boundaryClamps':bounded}
    report['passed']=not errors and len(state['npcs'])==6 and all(n['grounded'] for n in state['npcs']) and click_started and cancelled and bounded
    (OUT/'checks.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report),flush=True)
    browser.close()
    if not report['passed']:raise RuntimeError('Crop verification failed; see checks.json')
