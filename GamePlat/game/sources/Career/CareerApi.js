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
    }

    async request(method, path, body)
    {
        this.busy++
        this.events.trigger('busy', [ this.busy > 0 ])
        try
        {
            const response = await fetch(`./api/${path}`, {
                method,
                headers: body ? { 'Content-Type': 'application/json' } : {},
                body: body ? JSON.stringify({ lang: getLang(), ...body }) : undefined,
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
    setLang(lang) { return this.request('POST', 'lang', { lang }) }
    extractProfile(text, file) { return this.request('POST', 'profile/extract', { text, file }) }
    setSkills(skills) { return this.request('POST', 'profile/skills', { skills }) }
    setTarget(careerId, mode, text, file) { return this.request('POST', 'target', { careerId, mode, text, file }) }
    generateRoadmap() { return this.request('POST', 'roadmap', {}) }
    setTaskDone(taskId, done) { return this.request('POST', 'task', { taskId, done }) }
    log(text) { return this.request('POST', 'log', { text, source: 'web' }) }
    startGym(stageId) { return this.request('POST', 'gym/start', { stageId }) }
    submitGym(challengeId, answers) { return this.request('POST', 'gym/submit', { challengeId, answers }) }
    abandonGym(challengeId) { return this.request('POST', 'gym/abandon', { challengeId }) }
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
