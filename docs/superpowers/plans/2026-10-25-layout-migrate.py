"""One-time, workspace-bounded migration. Refuses to run against an already migrated tree."""
from pathlib import Path
import hashlib
import json
import os
import posixpath
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
assert not (ROOT / 'runpod/provider.js').exists(), 'Migration already completed'
assert (ROOT / 'GamePlat').is_dir() or (ROOT / 'src/game').is_dir(), 'Expected project layout'
tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
tracked.append('README.md')


def destination(old):
    exact = {
        'GamePlat/README.md': 'docs/development/README.md',
        'GamePlat/IMPLEMENTATION.md': 'docs/development/IMPLEMENTATION.md',
        'GamePlat/game/RUNPOD.md': 'runpod/README.md',
        'GamePlat/game/server/runpod.js': 'runpod/provider.js',
        'GamePlat/game/.env.example': '.env.example',
        'replit.md': 'docs/replit.md',
    }
    if old in exact:
        return exact[old]
    if old.startswith('GamePlat/game/') and old.endswith('.test.mjs'):
        return 'tests/game/' + old.removeprefix('GamePlat/game/')
    for prefix, new in [('GamePlat/crawler/test/', 'tests/crawler/'),
                        ('GamePlat/crawler/browser-tests/', 'tests/browser/crawler/'),
                        ('GamePlat/data/tests/', 'tests/data/'),
                        ('chatbot/tests/', 'tests/chatbot/'),
                        ('aws/lambda/tests/', 'tests/aws/')]:
        if old.startswith(prefix):
            return new + old.removeprefix(prefix)
    if old.startswith('GamePlat/'):
        return 'src/' + old.removeprefix('GamePlat/')
    if old.split('/')[0] in ['aws', 'chatbot', 'character', 'scripts']:
        return 'src/' + old
    return old


def bounded(relative):
    p = (ROOT / relative).resolve()
    assert p.is_relative_to(ROOT) and p != ROOT, f'Outside workspace: {relative}'
    return p


def initial_path(old):
    if old.startswith('GamePlat/'):
        return 'src/' + old.removeprefix('GamePlat/')
    if old.split('/')[0] in ['aws', 'chatbot', 'character', 'scripts']:
        return 'src/' + old
    return old


def current_path(old):
    for candidate in [old, initial_path(old), destination(old)]:
        p = bounded(candidate)
        if p.exists():
            return p
    return bounded(old)


def move(source, target):
    source, target = bounded(source), bounded(target)
    assert source.exists() and not target.exists(), f'Move collision: {source} -> {target}'
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        source.rename(target)
    except PermissionError:
        if not source.is_dir():
            raise
        # A terminal's current directory can lock an otherwise idle parent.
        # Move its children and retain only any locked, empty directories.
        target.mkdir()
        for child in list(source.iterdir()):
            move(str(child.relative_to(ROOT)), str((target / child.name).relative_to(ROOT)))
        try:
            source.rmdir()
        except OSError:
            if any(p.is_file() for p in source.rglob('*')):
                raise
            print('Empty directory still held by a terminal:', source.relative_to(ROOT))


mapping = {old: destination(old) for old in tracked}
assert len(set(mapping.values())) == len(mapping), 'Destination collision'
protected = {}
for base in ['GamePlat/data/raw', 'GamePlat/data/processed', 'GamePlat/data/historical',
             'GamePlat/game/server/data', 'GamePlat/crawler/data', 'chatbot/data']:
    directory = current_path(base)
    for p in directory.rglob('*'):
        if p.is_file() and p.suffix.lower() not in ['.md', '.log']:
            protected[base + '/' + p.relative_to(directory).as_posix()] = p
for old in ['GamePlat/game/.env', 'GamePlat/crawler/.env', 'chatbot/.env']:
    if current_path(old).is_file():
        protected[old] = current_path(old)
hashes = {old: hashlib.sha256(p.read_bytes()).hexdigest() for old, p in protected.items()}
local = ROOT / '.local'
local.mkdir(exist_ok=True)
(local / 'layout-integrity.json').write_text(json.dumps({destination(k): v for k, v in hashes.items()}, indent=2), encoding='utf-8')

texts = {}
for old in tracked:
    p = current_path(old)
    if p.suffix not in ['.md', '.js', '.mjs', '.py', '.ps1', '.sh', '.yaml', '.yml', '.toml', '.cmd'] and p.name not in ['.replit', '.env.example']:
        continue
    if old.startswith(('GamePlat/data/raw/', 'GamePlat/data/processed/', 'GamePlat/data/historical/',
                       'GamePlat/verification/', 'GamePlat/analysis/', 'GamePlat/bruno-simon_', 'GamePlat/site/')):
        continue
    try:
        texts[old] = p.read_text(encoding='utf-8-sig')
    except UnicodeError:
        continue


def relative_target(old, new, raw):
    path, *tail = re.split(r'(?=[?#])', raw, maxsplit=1)
    if not path or re.match(r'^[a-zA-Z]+:', path) or path.startswith(('/', '#')):
        return raw
    absolute = posixpath.normpath(posixpath.join(posixpath.dirname(old), path))
    if absolute.startswith('../') or not current_path(absolute).exists():
        return raw
    result = posixpath.relpath(destination(absolute), posixpath.dirname(new) or '.')
    if raw.startswith('.') and not result.startswith('.'):
        result = './' + result
    if path.endswith('/') and not result.endswith('/'):
        result += '/'
    return result + ''.join(tail)


for old, original in list(texts.items()):
    new = mapping[old]
    if old.endswith('.md'):
        text = re.sub(r'(\]\()([^\s)]+)(\))',
                      lambda m: m[1] + relative_target(old, new, m[2]) + m[3], original)
    else:
        text = re.sub(r"(['\"`])(\.{1,2}/[^'\"`\r\n]+)\1",
                      lambda m: m[1] + relative_target(old, new, m[2]) + m[1], original)
    text = text.replace('GamePlat/', 'src/').replace('GamePlat\\\\', 'src\\\\')
    texts[old] = text

if not (ROOT / 'src').exists():
    move('GamePlat', 'src')
for folder in ['aws', 'chatbot', 'character', 'scripts']:
    move(folder, 'src/' + folder)
for old, new in mapping.items():
    initial = initial_path(old)
    if initial != new:
        move(initial, new)

changed = []
for old, text in texts.items():
    new = mapping[old]
    p = bounded(new)
    if p.read_text(encoding='utf-8-sig') != text:
        p.write_text(text, encoding='utf-8', newline='\n')
        changed.append(new)

# Preserve local helper binaries/archives without adding them to source control.
if (ROOT / 'cloudflared-windows-amd64.exe').is_file():
    move('cloudflared-windows-amd64.exe', 'src/tools/bin/cloudflared-windows-amd64.exe')
if (ROOT / 'GamePlat-replit.zip').is_file():
    move('GamePlat-replit.zip', 'docs/archives/GamePlat-replit.zip')

invalid = [old for old, expected in hashes.items()
           if hashlib.sha256(bounded(destination(old)).read_bytes()).hexdigest() != expected]
assert not invalid, f'Protected file content changed: {invalid}'
(local / 'layout-integrity.json').write_text(json.dumps({destination(k): v for k, v in hashes.items()}, indent=2), encoding='utf-8')
print(json.dumps({'mapped_files': len(mapping), 'rebased_text_files': len(changed), 'preserved_private_and_data_files': len(hashes)}, indent=2))
