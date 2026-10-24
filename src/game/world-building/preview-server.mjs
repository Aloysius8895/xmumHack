import { createServer } from 'vite'

// Use a real module file: --input-type=module is inherited by Stylus workers and
// prevents their CommonJS require() from running on Node 24.
const server = await createServer({ server: { host: '127.0.0.1', port: 5173, strictPort: true, open: false } })
await server.listen()
server.printUrls()
