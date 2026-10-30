/**
 * Production server: the built game (dist/) + the /api routes
 *
 * npm run build && npm run server   >   http://127.0.0.1:8787
 * During development the same routes run inside Vite (see vite.config.js), no need to start this.
 */
import 'dotenv/config'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handle } from './app.js'
import { status } from './ai.js'
import { loadWindow } from './market-window.js'
import { backend } from './persistence.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(here, '..', 'dist')
const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST || '127.0.0.1'

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.ktx': 'image/ktx2', '.ktx2': 'image/ktx2', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.woff': 'font/woff',
}

function serveStatic(request, response)
{
    const url = new URL(request.url, 'http://localhost')
    let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)))
    if(!file.startsWith(DIST))
    {
        response.statusCode = 403
        return response.end()
    }
    if(fs.existsSync(file) && fs.statSync(file).isDirectory())
        file = path.join(file, 'index.html')
    if(!fs.existsSync(file))
    {
        response.statusCode = 404
        return response.end('not found')
    }
    response.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(response)
}

// The accumulated market window is read synchronously by the views: load it before the first request
await loadWindow().catch((error) => console.error('[market-window] not loaded:', error?.code ?? error?.message))

http.createServer(async (request, response) =>
{
    if(!(await handle(request, response)))
        serveStatic(request, response)
}).listen(PORT, HOST, () =>
{
    const ai = status()
    console.log(`Career game on http://${HOST}:${PORT}  (AI: ${ai.mock ? 'mock' : `${ai.provider}/${ai.model}`}${!ai.mock && !ai.keyConfigured ? ', provider credentials missing' : ''}; storage: ${backend()})`)
})
