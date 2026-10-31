# Upstream and research reference archive

These files preserve development provenance and reference material. The live
KerjayaKu frontend is `src/game/sources/`, with assets in `src/game/static/`.

| Path | Contents |
| --- | --- |
| `site/` | Archived compiled mirror of Bruno Simon's public site |
| `bruno-simon_20261020_093901/` | Original dated browser/source capture |
| `analysis/` | Saved research and application-comparison outputs |
| `asset-manifest.json` | Mirror asset provenance and checksums |
| `static-listing.json` | Upstream static-file listing |
| `original-index.html`, `mirror.log` | Original page and mirror-generation record |

The archive was relocated without rewriting captured assets or evidence bytes.
Historical paths in captured JSON/log files describe their original execution;
they are not current launch commands. The upstream project's notices and the
game's `src/game/license.md` remain in place. Do not treat all archived code as
technology used by the current application.

For optional offline reference viewing:

```bash
python src/tools/serve_reference.py --port 8083
```

Open `http://127.0.0.1:8083`. This serves the archived reference, not KerjayaKu.
`src/tools/mirror.py` can refresh the archive and makes external network requests;
it is not required to run or submit the game.
