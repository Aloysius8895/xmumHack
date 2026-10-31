"""Download the public bruno-simon.com frontend into docs/reference/site.

Discovery uses four sources and records each in the manifest:
  crawl   - same-origin URLs observed by the crawler (main.py)
  html    - href/src attributes in the served index.html
  code    - path literals in the compiled JS bundles and CSS url() values
  listing - the MIT source repository's static/ folder, which Vite copies
            verbatim to the site root; it reveals paths the bundle builds at
            runtime (e.g. `lab/images/${name}.ktx`). Bytes always come from
            the live site, never from GitHub.

The original compiled JS/CSS bytes are left untouched. index.html is the only
rewritten file: analytics removed, Google Fonts localized, and the offline
runtime shim (local-runtime.js) inserted before the application module.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError
from urllib.parse import quote, unquote, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT.parent / 'docs' / 'reference'
SITE = REFERENCE / 'site'
MANIFEST = REFERENCE / 'asset-manifest.json'
LISTING = REFERENCE / 'static-listing.json'
ORIGIN = 'https://bruno-simon.com/'
REPO_TREE = 'https://api.github.com/repos/brunosimon/folio-2025/git/trees/main?recursive=1'
FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;700;900&display=block'
# Google serves woff2 + unicode-range subsets only to modern browsers.
USER_AGENT = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36')
# Uncompressed audio masters in the repo; the bundle only references the mp3s.
SKIP_SUFFIXES = {'.wav'}
ASSET_EXT = r'glb|gltf|ktx2?|png|jpe?g|webp|avif|mp3|ogg|svg|woff2?|ttf|eot|json|wasm|js|css|ico|webmanifest|mp4|webm'


def fetch(url: str, accept_html: bool = False) -> tuple[bytes, str]:
    request = Request(url, headers={'User-Agent': USER_AGENT, 'Accept-Encoding': 'identity'})
    with urlopen(request, timeout=120) as response:
        body, mime = response.read(), response.headers.get('Content-Type', '')
    if mime.startswith('text/html') and not accept_html:
        raise ValueError(f'HTML response for non-HTML resource ({mime})')
    return body, mime


def local_path(rel: str) -> Path:
    target = (SITE / unquote(rel)).resolve()
    if not target.is_relative_to(SITE.resolve()) or target == SITE.resolve():
        raise ValueError(f'Path outside site: {rel!r}')
    return target


def normalize(ref: str, base: str = ORIGIN) -> str | None:
    """Return a site-relative, percent-encoded path for a same-origin reference."""
    url = urljoin(base, ref.strip())
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.netloc != 'bruno-simon.com':
        return None
    path = unquote(parts.path).lstrip('/')
    if not path or path.endswith('/'):
        return None
    return quote(path)


def load_listing(refresh: bool) -> list[str]:
    if refresh or not LISTING.exists():
        body, _ = fetch(REPO_TREE)
        tree = json.loads(body)
        if tree.get('truncated'):
            raise RuntimeError('GitHub tree listing is truncated')
        paths = sorted(t['path'][len('static/'):] for t in tree['tree']
                       if t['type'] == 'blob' and t['path'].startswith('static/'))
        LISTING.write_text(json.dumps({'source': REPO_TREE, 'paths': paths}, indent=1), 'utf-8')
    return json.loads(LISTING.read_text('utf-8'))['paths']


def latest_crawl() -> Path | None:
    runs = sorted(REFERENCE.glob('bruno-simon_*/network/requests.json'))
    return runs[-1] if runs else None


def discover_code(text: str, base: str) -> set[str]:
    found = set()
    for ref in re.findall(r'url\(\s*["\']?([^"\')]+)["\']?\s*\)', text):
        found.add(normalize(ref, base))
    # Path literals in the bundle are relative to the document (site root).
    for ref in re.findall(rf'["`]([A-Za-z0-9_][A-Za-z0-9_./%() -]*/[A-Za-z0-9_.%() -]+\.(?:{ASSET_EXT}))(?:\?[a-z]+=[0-9a-z]+)?["`]', text):
        found.add(normalize(ref))
    # Vite chunk and worker URLs are relative to the importing chunk.
    for ref in re.findall(r'(?:import\(|new URL\()\s*"(\./)?([^"]+\.(?:js|wasm))"', text):
        found.add(normalize(''.join(ref), base))
    # Skip JS template literals such as url(${o.imageUrl}); the listing covers them.
    return {f for f in found if f and '%24%7B' not in f}


def save(rel: str, body: bytes, mime: str, sources: list[str]) -> dict:
    target = local_path(rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(body)
    return {'url': urljoin(ORIGIN, rel), 'file': target.relative_to(SITE).as_posix(),
            'bytes': len(body), 'content_type': mime, 'sources': sources,
            'sha256': hashlib.sha256(body).hexdigest()}


def download(rel: str, sources: list[str], force: bool) -> dict:
    url = urljoin(ORIGIN, rel)
    target = local_path(rel)
    if target.exists() and not force:
        body = target.read_bytes()
        return {'url': url, 'file': target.relative_to(SITE).as_posix(), 'bytes': len(body),
                'content_type': '', 'sources': sources, 'sha256': hashlib.sha256(body).hexdigest(),
                'cached': True}
    for attempt in range(3):
        try:
            body, mime = fetch(url)
            return save(rel, body, mime, sources)
        except HTTPError as exc:
            if exc.code == 404:
                return {'url': url, 'sources': sources, 'error': 'HTTP 404'}
            error = f'HTTP {exc.code}'
        except Exception as exc:  # network errors, HTML fallbacks
            error = str(exc)
        time.sleep(attempt + 1)
    return {'url': url, 'sources': sources, 'error': error}


def localize_fonts() -> list[dict]:
    css, mime = fetch(FONTS_CSS)
    text = css.decode('utf-8')
    entries = []
    for font_url in sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', text))):
        rel = 'vendor/google-fonts/' + urlsplit(font_url).path.lstrip('/').replace('/', '_')
        body, font_mime = fetch(font_url)
        entry = save(rel, body, font_mime, ['google-fonts'])
        entry['url'] = font_url
        entries.append(entry)
        text = text.replace(font_url, rel.rsplit('/', 1)[-1])
    entry = save('vendor/google-fonts/fonts.css', text.encode('utf-8'), mime, ['google-fonts'])
    entry['url'] = FONTS_CSS
    return entries + [entry]


def rewrite_index(raw: str) -> str:
    html = re.sub(r'\s*<!-- Analytics -->\s*<script async src="https://www\.googletagmanager\.com/[^"]+"></script>\s*<script>.*?</script>',
                  '\n    <!-- Analytics removed in the local mirror -->', raw, count=1, flags=re.S)
    html = re.sub(r'\s*<link rel="preconnect" href="https://fonts\.(?:googleapis|gstatic)\.com"[^>]*>', '', html)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com/css2[^"]*" rel="stylesheet">',
                  '<link href="./vendor/google-fonts/fonts.css" rel="stylesheet">', html, count=1)
    html = re.sub(r'(\s*)(<script type="module")', r'\1<script src="./local-runtime.js"></script>\1\2', html, count=1)
    for marker in ('googletagmanager', 'fonts.googleapis', 'local-runtime.js'):
        present = marker in html
        if present != (marker == 'local-runtime.js'):
            raise RuntimeError(f'index.html rewrite failed near {marker!r}; the live markup changed')
    return html


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--force', action='store_true', help='re-download files that already exist')
    parser.add_argument('--refresh-listing', action='store_true', help='re-read the GitHub static/ listing')
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    SITE.mkdir(parents=True, exist_ok=True)

    sources: dict[str, set[str]] = {}

    def add(rel: str | None, source: str) -> None:
        if rel and Path(unquote(rel)).suffix.lower() not in SKIP_SUFFIXES:
            sources.setdefault(rel, set()).add(source)

    raw_html, html_mime = fetch(ORIGIN, accept_html=True)
    raw = raw_html.decode('utf-8')
    (REFERENCE / 'original-index.html').write_text(raw, 'utf-8')
    for ref in re.findall(r'(?:href|src)="([^"]+)"', raw):
        add(normalize(ref), 'html')

    requests_json = latest_crawl()
    if requests_json:
        for item in json.loads(requests_json.read_text('utf-8')):
            add(normalize(urlsplit(item['url'])._replace(query='').geturl()), 'crawl')
    for rel in load_listing(args.refresh_listing):
        add(quote(rel), 'listing')

    entries: list[dict] = []
    done: set[str] = set()
    # Code can reference further code (main bundle -> rapier chunk -> wasm),
    # so scan JS/CSS until no new paths appear.
    while pending := sorted(set(sources) - done):
        with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
            results = list(pool.map(lambda r: download(r, sorted(sources[r]), args.force), pending))
        done.update(pending)
        for rel, entry in zip(pending, results):
            entries.append(entry)
            print(('ok   ' if 'file' in entry else 'FAIL ') + unquote(rel) + ('' if 'file' in entry else f"  ({entry['error']})"), flush=True)
            if 'file' in entry and rel.endswith(('.js', '.css')) and not rel.startswith(('draco/', 'basis/')):
                text = local_path(rel).read_text('utf-8', errors='replace')
                for found in discover_code(text, urljoin(ORIGIN, rel)):
                    add(found, 'code')

    entries.extend(localize_fonts())
    index = rewrite_index(raw)
    (SITE / 'index.html').write_text(index, 'utf-8')
    entries.append({'url': ORIGIN, 'file': 'index.html', 'bytes': len(index.encode()), 'content_type': html_mime,
                    'sources': ['html'], 'sha256': hashlib.sha256(index.encode()).hexdigest(),
                    'modified': 'analytics removed, fonts localized, local-runtime.js inserted'})

    for entry in entries:
        if 'sources' in entry:
            entry['sources'] = sorted(sources.get(normalize(entry['url']) or '', entry['sources']))
    entries.sort(key=lambda e: e['url'])
    MANIFEST.write_text(json.dumps(entries, indent=1, ensure_ascii=False), 'utf-8')
    ok = [e for e in entries if 'file' in e]
    failed = [e for e in entries if 'error' in e]
    print(f'\n{len(ok)} files, {sum(e["bytes"] for e in ok) / 1e6:.1f} MB; {len(failed)} not available')
    for e in failed:
        print(f'  missing {unquote(e["url"])}  sources={",".join(e["sources"])}  {e["error"]}')


if __name__ == '__main__':
    main()
