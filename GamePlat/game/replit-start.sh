#!/bin/sh
# Replit "Run" button: install + build once, then serve dist/ and /api on 0.0.0.0
set -e
[ -d node_modules ] || npm install
[ -f dist/index.html ] || npm run build
HOST=0.0.0.0 PORT=${PORT:-8787} npm run server
