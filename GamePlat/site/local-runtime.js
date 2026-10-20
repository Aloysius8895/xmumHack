// Local mirror runtime: keep the original bundle byte-identical, but never open
// the production multiplayer socket (whispers, leaderboards, live counters).
// The game already supports this state and shows its "server offline" UI.
(() => {
    const PRODUCTION_SERVER = /^wss?:\/\/srv740865\.hstgr\.cloud(?::\d+)?\/?$/
    const NativeWebSocket = window.WebSocket

    class OfflineSocket extends EventTarget {
        constructor(url) {
            super()
            this.url = url
            this.readyState = NativeWebSocket.CLOSED
            this.binaryType = 'blob'
            this.bufferedAmount = 0
            this.protocol = ''
            this.extensions = ''
        }
        send() {}
        close() {}
    }

    function LocalWebSocket(url, protocols) {
        if (PRODUCTION_SERVER.test(String(url))) return new OfflineSocket(url)
        return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols)
    }
    LocalWebSocket.prototype = NativeWebSocket.prototype
    for (const key of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) LocalWebSocket[key] = NativeWebSocket[key]

    window.WebSocket = LocalWebSocket
})()
