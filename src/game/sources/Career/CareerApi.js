import { Events } from '../Game/Events.js'
import { getLang } from './i18n.js'

/**
 * Client of server/app.js, keeps the last state and tells the UI when it changes (event driven HUD, skills/game/game-ui-ux)
 */
export class CareerApi
{
    constructor()
    {
        this.events = new Events()
        this.state = null
        this.busy = 0
        this.demo = false // Guided tour running: the server answers AI features with demo data (server/ai.js isMock)
        // This tab, so the server's change events (server/live.js) can tell our own saves from Telegram's
        this.clientId = globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
        this.refreshing = null
        this.refreshAgain = false
    }

    /**
     * Live updates: reload the state when it changes elsewhere (a Telegram progress report, n8n, another tab), when
     * the stream reconnects after a drop, and when the tab comes back into view (changes on another server instance)
     */
    listen()
    {
        if(this.source || typeof EventSource === 'undefined')
            return
        this.source = new EventSource('./api/events')
        this.source.addEventListener('change', (event) =>
        {
            let origin = null
            try { origin = JSON.parse(event.data).origin } catch {}
            if(origin !== this.clientId)
                this.refresh()
        })
        let connected = false
        this.source.addEventListener('hello', () =>
        {
            // The first hello comes right after load(); a later one means we were offline and may have missed changes
            if(connected)
                this.refresh()
            connected = true
        })
        document.addEventListener('visibilitychange', () =>
        {
            if(document.visibilityState === 'visible')
                this.refresh()
        })
    }

    /**
     * Quiet reload of the state (no busy indicator, errors ignored: the next change or visit tries again). Waits for
     * the tab's own requests, whose answers carry a state too, and folds bursts of changes into one more reload.
     */
    async refresh()
    {
        if(!this.state)
            return
        if(this.refreshing || this.busy > 0)
        {
            this.refreshAgain = true
            if(!this.refreshing)
                setTimeout(() => this.refresh(), 400)
            return
        }
        this.refreshAgain = false
        const language = getLang()
        this.refreshing = fetch('./api/state', { headers: { 'X-Career-Client': this.clientId, 'X-Career-Lang': language }, cache: 'no-store' })
            .then((response) => response.ok ? response.json() : null)
            .then((payload) =>
            {
                // A request of the tab started meanwhile: its answer may be newer, try again after it
                if(this.busy > 0 || getLang() !== language)
                    this.refreshAgain = true
                else if(payload?.state)
                {
                    const previous = this.state
                    this.state = payload.state
                    this.events.trigger('state', [ this.state, previous ])
                }
            })
            .catch(() => {})
        await this.refreshing
        this.refreshing = null
        if(this.refreshAgain)
            this.refresh()
    }

    async request(method, path, body)
    {
        this.busy++
        this.events.trigger('busy', [ this.busy > 0 ])
        try
        {
            const response = await fetch(`./api/${path}`, {
                method,
                headers: { 'X-Career-Client': this.clientId, 'X-Career-Lang': getLang(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
                body: body ? JSON.stringify({ lang: getLang(), ...(this.demo ? { demo: true } : {}), ...body }) : undefined,
            })
            const payload = await response.json().catch(() => ({ error: 'generic' }))
            if(!response.ok)
            {
                const error = new Error(payload.error ?? 'generic')
                error.code = payload.error ?? 'generic'
                throw error
            }
            if(payload.state)
            {
                const previous = this.state
                this.state = payload.state
                this.events.trigger('state', [ this.state, previous ])
            }
            return payload
        }
        finally
        {
            this.busy--
            this.events.trigger('busy', [ this.busy > 0 ])
        }
    }

    load() { return this.request('GET', 'state') }
    async sampleRequest(method,path)
    {
        const response=await fetch(`./api/market/sample/${path}`,{method,cache:'no-store',headers:{'X-Career-Client':this.clientId,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})})
        const payload=await response.json().catch(()=>({error:'crawler-request-failed'}))
        // cooldownUntil: the time a Refresh is possible again after the last collection
        if(!response.ok)throw Object.assign(new Error(payload.error),{code:payload.error,cooldownUntil:payload.cooldownUntil??null})
        return payload
    }
    startMarketSample() {return this.sampleRequest('POST','refresh')}
    marketSampleStatus(runId) {return this.sampleRequest('GET',encodeURIComponent(runId))}
    setLang(lang) { return this.request('POST', 'lang', { lang }) }
    setScenario(preset) { return this.request('POST', 'scenario', { preset }) }
    markUpdatesSeen() { return this.request('POST', 'update-log/seen', {}) }
    setLearningDirection(text) { return this.request('POST', 'learning-direction', { text }) }
    extractProfile(text, file) { return this.request('POST', 'profile/extract', { text, file }) }
    setSkills(skills) { return this.request('POST', 'profile/skills', { skills }) }
    setTarget(careerId, mode, text, file, replace = false, sourceUrl = '') { return this.request('POST', 'target', { careerId, mode, text, file, replace, sourceUrl }) }
    trackPosting(sourceUrl) { return this.request('POST', 'target/track', { sourceUrl }) }
    refreshPosting(revision) { return this.request('POST', 'roadmap/refresh-posting', { revision }) }
    resolveTarget(choice) { return this.request('POST', 'target/resolve', { choice }) }
    generateCareer(query) { return this.request('POST', 'careers/generate', { query }) }
    generateRoadmap() { return this.request('POST', 'roadmap', {}) }
    setTaskDone(taskId, done) { return this.request('POST', 'task', { taskId, done }) }
    unlockStage(stageId) { return this.request('POST', 'stage/unlock', { stageId }) }
    log(text) { return this.request('POST', 'log', { text, source: 'web' }) }
    // expert: ask the career's distilled industry elite instead of the mentor (server/experts.js)
    askMentor(careerId, question, history, file, expert = false) { return this.request('POST', 'npc/ask', { careerId, question, history, file, elite: expert }) }

    /**
     * Same question, the answer streamed (server/app.js streams, one JSON event per line): onText(piece) as it comes,
     * resolves with the whole answer. No busy lock: the dialogue shows its own thinking. signal: abort when leaving
     */
    async askMentorStream(careerId, question, history, file, expert, onText, signal)
    {
        const fail = (code) => Object.assign(new Error(code), { code })
        const response = await fetch('./api/npc/ask/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: getLang(), ...(this.demo ? { demo: true } : {}), careerId, question, history, file, elite: expert }),
            signal,
        })
        if(!response.ok)
            throw fail((await response.json().catch(() => ({}))).error ?? 'generic')

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        let answer = null
        while(true)
        {
            const { value, done } = await reader.read()
            if(done)
                break
            buffer += value
            const lines = buffer.split('\n')
            buffer = lines.pop()
            for(const line of lines.filter((item) => item.trim()))
            {
                const event = JSON.parse(line)
                if(event.error)
                    throw fail(event.error)
                if(event.text)
                    onText(event.text)
                if(typeof event.answer === 'string')
                    answer = event.answer
            }
        }
        if(answer === null)
            throw fail('generic')
        return answer
    }
    setPlayerName(name) { return this.request('POST', 'player', { name }) }
    register(name) { return this.request('POST', 'register', { name }) }
    addFriend(code) { return this.request('POST', 'friends', { code }) }
    removeFriend(id) { return this.request('POST', 'friends/remove', { id }) }
    reset() { return this.request('POST', 'reset', {}) }
}

/**
 * File input > { name, mediaType, data (base64) }
 */
export function readFile(file)
{
    return new Promise((resolve, reject) =>
    {
        const reader = new FileReader()
        reader.onload = () =>
        {
            const result = String(reader.result)
            resolve({ name: file.name, mediaType: file.type || 'text/plain', data: result.slice(result.indexOf(',') + 1) })
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
    })
}
