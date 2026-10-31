"""Offline-only server for the mirrored bruno-simon.com frontend (Python stdlib)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import mimetypes

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'docs' / 'reference' / 'site'
# WebAssembly.instantiateStreaming (Rapier, Draco, Basis) requires application/wasm.
TYPES = {
    '.wasm': 'application/wasm',
    '.js': 'text/javascript',
    '.glb': 'model/gltf-binary',
    '.ktx': 'application/octet-stream',
    '.ktx2': 'image/ktx2',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.webmanifest': 'application/manifest+json',
}
for suffix, mime in TYPES.items():
    mimetypes.add_type(mime, suffix)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **TYPES}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, format, *args):
        # Only report problems; the game requests several hundred files.
        if len(args) > 1 and str(args[1]).startswith(('4', '5')):
            super().log_message(format, *args)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8083)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f"Bruno Simon folio local mirror: http://127.0.0.1:{args.port} (Ctrl+C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
