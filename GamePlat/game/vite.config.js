import 'dotenv/config'
import restart from 'vite-plugin-restart'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { handle as careerApi } from './server/app.js'

// Career platform API (server/) served by the dev server itself, no second process needed
const careerApiPlugin = {
    name: 'career-api',
    configureServer(server)
    {
        server.middlewares.use(async (request, response, next) =>
        {
            if(!(await careerApi(request, response)))
                next()
        })
    }
}

export default {
    root: 'sources/', // Sources files (typically where index.html is)
    envDir: '../',  // Directory where the env file is located
    publicDir: '../static/', // Path from "root" to static assets (files that are served as they are)
    base: './', // Public path (what's after the domain)
    server:
    {
        // https: true,
        host: true, // Open to local network and display URL
        open: true // Open in browser
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: false // Add sourcemap
    },
    plugins:
    [
        wasm(),
        topLevelAwait(),
        restart({ restart: [ '../static/**', '../server/**/*.js' ] }), // Restart server on static or API file change
        careerApiPlugin,
        nodePolyfills(),
        // basicSsl()
    ]
}