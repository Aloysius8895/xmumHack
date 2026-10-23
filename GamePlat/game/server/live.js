/**
 * Live updates: the web client keeps GET /api/events open (Server-Sent Events) and reloads its state when the save
 * changes, so progress reported on Telegram (or by n8n, or in another tab) shows without a refresh.
 *
 * In process only: a client connected to another server instance is not told, it catches up when its tab comes back
 * into view or its connection reopens (sources/Career/CareerApi.js listen).
 */
const HEARTBEAT_MS = 25_000 // Below the idle timeout of proxies (Replit, Cloud Run) so they keep the connection

const clients = new Set()
let revision = 0

export function subscribe(request, response)
{
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders?.()
    // retry: how long the browser waits before reconnecting a dropped stream
    response.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ revision })}\n\n`)

    clients.add(response)
    const heartbeat = setInterval(() => response.write(': ping\n\n'), HEARTBEAT_MS)
    const close = () =>
    {
        clearInterval(heartbeat)
        clients.delete(response)
    }
    request.on('close', close)
    response.on('error', close)
}

/**
 * The save (or a market/trends document) changed. origin: the client id of the tab that made the change (it already has
 * the new state), or null for Telegram, n8n and other integrations
 */
export function changed(origin = null)
{
    revision++
    const message = `event: change\ndata: ${JSON.stringify({ revision, origin })}\n\n`
    for(const response of clients)
        response.write(message)
}

export function listeners()
{
    return clients.size
}
