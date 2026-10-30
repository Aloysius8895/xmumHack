"""Runs the real character/Rapier regression harness in an isolated browser page."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--baseline', action='store_true')
args = parser.parse_args()
out = Path(__file__).resolve().parents[1] / 'verification' / 'character-stuck'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium')
    page = browser.new_page()
    page.route('**/character-physics-harness.html', lambda route: route.fulfill(
        content_type='text/html', body='<!doctype html><title>Character physics regression</title>'))
    page.goto('http://127.0.0.1:5173/character-physics-harness.html')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    name = 'baseline' if args.baseline else 'regressions'
    result = page.evaluate('''async name => {
        const harness = await import('/Game/Physics/character-physics.test.js');
        return harness[name]();
    }''', name)
    (out / ('reproductions-latest.json' if args.baseline else 'regressions.json')).write_text(json.dumps(result, indent=2), encoding='utf-8')
    if args.baseline:
        print(json.dumps({key: {k:v for k,v in value.items() if k!='trace'} for key,value in result.items()}, indent=2))
    else:
        print(json.dumps({'passed': len(result), 'cases': [
            {'name': name, 'knock': value['final']['knock'], 'relocations': value['final']['relocations']}
            for name, value in result.items()]}, indent=2))
    assert not errors, errors
    browser.close()
