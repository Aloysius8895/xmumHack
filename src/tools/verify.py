"""Browser verification: drive the local mirror (offline) and, optionally, the live site.

The local run blocks every non-127.0.0.1 request, so any remaining dependency
on the original servers shows up as a blocked request in the report.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'docs' / 'verification'
LIVE = 'https://bruno-simon.com/'
DESKTOP = {'viewport': {'width': 1440, 'height': 1000}}
MOBILE = {'viewport': {'width': 390, 'height': 844}, 'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def start_server(port: int) -> subprocess.Popen:
    proc = subprocess.Popen([sys.executable, str(ROOT / 'tools' / 'serve_reference.py'), '--port', str(port)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    for _ in range(50):
        try:
            urlopen(f'http://127.0.0.1:{port}/', timeout=1).read()
            return proc
        except OSError:
            time.sleep(0.2)
    proc.kill()
    raise RuntimeError('serve_reference.py did not start')


def run(browser, url: str, prefix: str, device: dict, offline: bool, mobile: bool) -> dict:
    context = browser.new_context(**device)
    page = context.new_page()
    report = {'url': url, 'device': device, 'offline': offline, 'blocked_external': [], 'http_errors': [],
              'failed_requests': [], 'console_errors': [], 'page_errors': [], 'steps': []}
    local_host = urlsplit(url).netloc

    if offline:
        def guard(route):
            target = urlsplit(route.request.url)
            if target.scheme in ('http', 'https', 'ws', 'wss') and target.netloc != local_host:
                report['blocked_external'].append(route.request.url)
                return route.abort()
            return route.continue_()
        context.route('**/*', guard)
    page.on('response', lambda r: r.status >= 400 and report['http_errors'].append(f'{r.status} {r.url}'))
    page.on('requestfailed', lambda r: report['failed_requests'].append(f'{r.failure} {r.url}'))
    page.on('console', lambda m: m.type == 'error' and report['console_errors'].append(m.text[:300]))
    page.on('pageerror', lambda e: report['page_errors'].append(str(e)[:300]))
    sockets = []
    page.on('websocket', lambda ws: sockets.append(ws.url))

    def classes() -> str:
        return page.evaluate('document.documentElement.className')

    def wait_filter(name: str, timeout_s: float) -> bool:
        try:
            page.wait_for_function(f'document.documentElement.classList.contains("input-filter-{name}")',
                                   timeout=int(timeout_s * 1000))
            return True
        except Exception:
            return False

    def step(name: str, action, settle_s: float, expect: str | None = None):
        entry = {'name': name}
        try:
            action()
            if expect:
                entry['reached'] = wait_filter(expect, 15)
            page.wait_for_timeout(int(settle_s * 1000))
        except Exception as exc:  # keep going: later steps are still informative
            entry['error'] = str(exc).splitlines()[0][:300]
        shot = OUT / f'{prefix}-{name}.png'
        page.screenshot(path=str(shot))
        entry.update(screenshot=shot.name, classes=classes())
        report['steps'].append(entry)
        print(f'  {prefix}-{name}: {entry.get("error") or entry["classes"]}', flush=True)

    width, height = device['viewport']['width'], device['viewport']['height']

    def press_center():
        # "Click to start" is a raycast against a sphere around the car; the ray
        # cursor updates on tick, so hover/hold for a few frames like a real user.
        x, y = width / 2, height / 2
        if mobile:
            cdp = context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            page.wait_for_timeout(150)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            cdp.detach()
        else:
            page.mouse.move(x, y)
            page.wait_for_timeout(300)
            page.mouse.down()
            page.wait_for_timeout(120)
            page.mouse.up()

    def start_game():
        # The intro accepts input once loading and the reveal finish; retry until it leaves the intro.
        deadline = time.time() + 120
        while time.time() < deadline:
            press_center()
            if wait_filter('wandering', 2):
                report['seconds_to_start'] = round(time.time() - loaded_at, 1)
                return
        raise TimeoutError('game did not leave the intro within 120 s')

    def drive():
        page.keyboard.down('ArrowUp')
        page.wait_for_timeout(2500)
        page.keyboard.down('ArrowRight')
        page.wait_for_timeout(1200)
        page.keyboard.up('ArrowRight')
        page.keyboard.up('ArrowUp')

    def close_menu_then_map():
        page.keyboard.press('Escape')
        wait_filter('wandering', 10)
        page.click('.js-map-trigger', timeout=10_000)

    page.goto(url, wait_until='load', timeout=120_000)
    loaded_at = time.time()
    report['renderer'] = page.evaluate('''() => { const gl = document.createElement('canvas').getContext('webgl2');
        const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null }''')
    step('01-intro', lambda: None, 15)
    report['fps'] = round(page.evaluate('''() => new Promise(r => { let n = 0; const t0 = performance.now();
        const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r(n / 2) }; requestAnimationFrame(f) })'''), 1)
    step('02-started', start_game, 4)
    if not mobile:
        step('03-driving', drive, 1.5)
        step('04-menu', lambda: page.click('.js-menu-trigger', timeout=10_000), 2, expect='menu')
        step('05-map', close_menu_then_map, 2.5)
    report['websockets'] = sockets
    report['resources_loaded'] = page.evaluate('performance.getEntriesByType("resource").length')
    context.close()
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--original', action='store_true', help='also capture the live site for comparison')
    args = parser.parse_args()
    OUT.mkdir(exist_ok=True)
    port = free_port()
    server = start_server(port)
    results = {}
    try:
        with sync_playwright() as p:
            # The default headless shell renders with SwiftShader (~1 fps for this scene);
            # new-headless Chromium on the real GPU runs it at normal speed.
            gpu = ['--enable-gpu', '--ignore-gpu-blocklist'] + (['--use-angle=d3d11'] if sys.platform == 'win32' else [])
            browser = p.chromium.launch(headless=True, channel='chromium', args=gpu)
            local = f'http://127.0.0.1:{port}/'
            results['local_desktop'] = run(browser, local, 'local-desktop', DESKTOP, True, False)
            results['local_mobile'] = run(browser, local, 'local-mobile', MOBILE, True, True)
            if args.original:
                results['original_desktop'] = run(browser, LIVE, 'original-desktop', DESKTOP, False, False)
            browser.close()
    finally:
        server.terminate()
        stderr = server.communicate(timeout=10)[1]
    results['server_errors'] = [line for line in stderr.splitlines() if '" 4' in line or '" 5' in line]
    (OUT / 'results.json').write_text(json.dumps(results, indent=1, ensure_ascii=False), 'utf-8')
    for key, r in results.items():
        if key == 'server_errors':
            continue
        print(f'{key}: fps={r.get("fps")} start={r.get("seconds_to_start")}s resources={r.get("resources_loaded")} '
              f'blocked_external={len(r["blocked_external"])} http_errors={len(r["http_errors"])} '
              f'failed={len(r["failed_requests"])} page_errors={len(r["page_errors"])} '
              f'console_errors={len(r["console_errors"])} websockets={r.get("websockets")} '
              f'step_errors={[s["name"] for s in r["steps"] if "error" in s]}')
    print(f'server 4xx/5xx: {len(results["server_errors"])}')


if __name__ == '__main__':
    main()
