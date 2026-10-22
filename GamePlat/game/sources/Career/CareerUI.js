import { Game } from '../Game/Game.js'
import { CharacterSelect } from '../Game/CharacterSelect.js'
import { readFile } from './CareerApi.js'
import { LANGS, getLang, pick, setLang, t } from './i18n.js'

/**
 * Career platform UI: HUD (pet, points, next step), quick menu rail, side panels and the NPC dialogue box
 *
 * skills/game/game-ui-ux: one screen stack (panel or dialogue on top of the world), event driven updates, Esc closes,
 * every control is a real button (keyboard focus). skills/game/threejs-game-ui-designer: hierarchy companion > objective
 * > actions, stable sizes, the world stays visible in the middle.
 * Every user or AI string goes through esc() before reaching innerHTML.
 */

const ICONS = {
    profile: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/>',
    careers: '<path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16"/>',
    pet: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="9" r="2"/><path d="M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 2-4 1.5C10 19 8 19 8 17Z"/>',
    roadmap: '<path d="M5 20V5m0 0h11l-2 3 2 3H5"/><circle cx="17" cy="18" r="2"/><path d="M5 18h10"/>',
    log: '<path d="M5 19h4L19 9l-4-4L5 15v4ZM13 7l4 4"/>',
    leaderboard: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4a3 3 0 0 0 4 4m8-4h4a3 3 0 0 1-4 4m-4 3v4m-4 3h8"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/>',
}

const MENU = [ 'profile', 'careers', 'pet', 'roadmap', 'log', 'leaderboard', 'settings' ]

const SKILL_ICONS = {
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
    sheet: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 9v12"/>',
    chart: '<path d="M3 3v18h18M7 17v-5m5 5V7m5 10V4"/>',
    code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
    filter: '<path d="M3 4h18l-7 8v7l-4 2v-9Z"/>',
    message: '<path d="M4 4h16v12H9l-5 4ZM8 8h8m-8 4h5"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    branch: '<circle cx="6" cy="5" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><path d="M6 8v8m12-8c0 5-12 2-12 7"/>',
    link: '<path d="m9 15 6-6M9 6l2-2a5 5 0 0 1 7 7l-2 2M8 11l-2 2a5 5 0 0 0 7 7l2-2"/>',
    cloud: '<path d="M6 18a5 5 0 1 1 1-10 6 6 0 0 1 11 0 5 5 0 0 1 0 10M12 21V11m-4 4 4-4 4 4"/>',
    check: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 6-7"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6m-3-3v6"/>',
    pen: '<path d="m4 20 2-7L16 3l5 5-10 10Zm10-15 5 5M6 13l5 5M4 20l7-2"/>',
    brain: '<path d="M12 4c-4-4-8 0-6 3-5 0-5 8-1 9-1 6 7 7 7 2V4Zm0 0c4-4 8 0 6 3 5 0 5 8 1 9 1 6-7 7-7 2M6 8l3 3m9-3-3 3M7 16h2m8 0h-2"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16 8-3 5-5 3 3-5Z"/>',
}

function esc(value)
{
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

// Two crossed chains for the locked roadmap stages: oval links and links seen edge on, alternating
const MAP_CHAINS = [ [ 0, 18, 400, 182 ], [ 0, 182, 400, 18 ] ].map(([ x1, y1, x2, y2 ]) =>
{
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
    return Array.from({ length: 13 }, (_, index) =>
    {
        const x = x1 + (x2 - x1) * (index + 0.5) / 13
        const y = y1 + (y2 - y1) * (index + 0.5) / 13
        const size = index % 2 ? 'x="-17" y="-4" width="34" height="8" rx="4"' : 'x="-19" y="-10" width="38" height="20" rx="10"'
        return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})"><rect ${size} class="is-link"/><rect ${size} class="is-shine"/></g>`
    }).join('')
}).join('')

const MAP_PADLOCK = `<svg viewBox="0 0 64 72" aria-hidden="true">
    <path d="M18 34V22a14 14 0 0 1 28 0v12" class="is-shackle"/>
    <path d="M18 34V22a14 14 0 0 1 28 0v12" class="is-shackle-shine"/>
    <rect x="7" y="30" width="50" height="38" rx="11" class="is-body"/>
    <path d="M32 40a5 5 0 0 0-3 9l-1 9h8l-1-9a5 5 0 0 0-3-9Z" class="is-keyhole"/>
    <path d="M32 24l5 5-5 5-5-5Z" class="is-gem"/>
</svg>`

function icon(name)
{
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`
}

function list(items)
{
    return items.join(getLang() === 'zh' ? '、' : ', ')
}

function bar(percent, extraClass = '')
{
    return `<span class="career-bar ${extraClass}"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></span>`
}

export class CareerUI
{
    constructor(api)
    {
        this.game = Game.getInstance()
        this.api = api

        this.panel = null           // { name, ...view options }
        this.dialogue = null        // { careerId, node }
        this.drafts = {}            // text typed in inputs survives re-renders
        this.files = {}             // attached files by draft key
        this.notice = null          // { type: 'error' | 'info', text } shown in the open panel
        this.ownsInputs = false
        this.menuOpen = false

        setLang(getLang())
        this.setDom()
        this.setEvents()

        this.api.events.on('state', () => this.render())
        this.api.events.on('busy', (busy) => this.root.classList.toggle('is-busy', busy))
    }

    get state()
    {
        return this.api.state
    }

    setDom()
    {
        this.root = document.createElement('div')
        this.root.className = 'career-ui'
        this.root.innerHTML = `
            <section class="career-panel js-career-panel" aria-hidden="true">
                <header class="career-panel-header">
                    <h2 class="js-career-panel-title"></h2>
                    <button class="career-close" data-action="close" aria-label="${esc(t('common.close'))}">×</button>
                </header>
                <div class="career-panel-body js-career-panel-body"></div>
            </section>
            <section class="career-dialogue js-career-dialogue" aria-hidden="true"></section>
            <nav class="career-menu is-bar js-career-menu" aria-label="${esc(t('menu.title'))}">
                <button type="button" class="career-menu-trigger js-career-menu-trigger" data-action="menu-toggle" aria-expanded="false" aria-controls="career-menu-items">
                    <svg class="career-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                    <span class="js-career-menu-label">${esc(t('menu.title'))}</span>
                    <svg class="career-menu-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                <div id="career-menu-items" class="career-rail js-career-rail"></div>
                <div class="career-hud js-career-hud"></div>
            </nav>
            <div class="career-busy">${esc(t('common.loading'))}</div>
        `
        this.game.domElement.appendChild(this.root)

        this.hud = this.root.querySelector('.js-career-hud')
        this.rail = this.root.querySelector('.js-career-rail')
        this.menuElement = this.root.querySelector('.js-career-menu')
        this.menuTrigger = this.root.querySelector('.js-career-menu-trigger')
        this.panelElement = this.root.querySelector('.js-career-panel')
        this.panelTitle = this.root.querySelector('.js-career-panel-title')
        this.panelBody = this.root.querySelector('.js-career-panel-body')
        this.dialogueElement = this.root.querySelector('.js-career-dialogue')
    }

    setEvents()
    {
        this.root.addEventListener('click', (event) =>
        {
            const target = event.target.closest('[data-action]')
            // The menu opens with a mouse click or Tab only, not Space / Enter on the focused trigger (detail 0 = keyboard click)
            if(target?.dataset.action === 'menu-toggle' && event.detail === 0)
                return
            if(target)
                this.action(target.dataset.action, target.dataset, target)
        })

        // A mouse click doesn't leave the focus on the trigger or the bar, so Space / Enter keep going to the game (jump, talk)
        this.menuTrigger.addEventListener('mousedown', (event) => event.preventDefault())
        this.rail.addEventListener('mousedown', (event) => event.preventDefault())

        document.addEventListener('pointerdown', (event) =>
        {
            if(this.menuOpen && !this.menuElement.contains(event.target))
                this.setMenuOpen(false)
        }, true)

        this.menuElement.addEventListener('focusout', (event) =>
        {
            if(this.menuOpen && !this.menuElement.contains(event.relatedTarget))
                this.setMenuOpen(false)
        })

        this.menuElement.addEventListener('keydown', (event) =>
        {
            if(event.target.closest('.career-hud'))
                return
            if([ 'Enter', 'NumpadEnter', 'Space' ].includes(event.code))
            {
                event.stopPropagation()
                return
            }
            if(event.code === 'Escape' && this.menuOpen)
            {
                event.preventDefault()
                event.stopPropagation()
                this.setMenuOpen(false, true)
                return
            }

            if(![ 'ArrowDown', 'ArrowUp', 'Home', 'End' ].includes(event.code))
                return

            event.preventDefault()
            event.stopPropagation()
            this.setMenuOpen(true)
            const items = [...this.rail.querySelectorAll('button')]
            const current = items.indexOf(document.activeElement)
            const index = event.code === 'Home' ? 0
                : event.code === 'End' ? items.length - 1
                : event.code === 'ArrowDown' ? (current + 1) % items.length
                : (current < 0 ? items.length - 1 : current - 1 + items.length) % items.length
            items[index]?.focus({ preventScroll: true })
        })

        this.root.addEventListener('input', (event) =>
        {
            const key = event.target.dataset.draft
            if(key)
                this.drafts[key] = event.target.value
        })

        this.root.addEventListener('change', async (event) =>
        {
            const input = event.target
            if(input.dataset.file && input.files?.[0])
            {
                this.files[input.dataset.file] = input.files[0]
                this.renderPanel()
            }
            if(input.dataset.skillLevel !== undefined)
                this.updateSkill(Number(input.dataset.skillLevel), { level: Number(input.value) })
            if(input.dataset.task)
            {
                const stop = input.closest('[data-stage]')
                if(stop && this.panel)
                    this.panel.openStage = stop.dataset.stage
                this.run(() => this.api.setTaskDone(input.dataset.task, input.checked))
            }
            if(input.dataset.lang)
                this.changeLang(input.value)
        })

        addEventListener('keydown', (event) =>
        {
            // Tab toggles the menu (outside text fields and open panels / dialogues, where Tab keeps moving the focus)
            if(event.code === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey && !this.panel && !this.dialogue && !event.target.closest?.('input, textarea, select'))
            {
                // The menu is an always expanded bar: Tab moves the focus into it (arrows + Enter), Tab again back to the world
                event.preventDefault()
                if(this.rail.contains(document.activeElement))
                    document.activeElement.blur()
                else
                    this.rail.querySelector('button')?.focus({ preventScroll: true })
                return
            }
            if(event.code === 'Escape' && this.menuOpen)
            {
                event.preventDefault()
                this.setMenuOpen(false, true)
                return
            }
            if(this.dialogue)
            {
                if(event.code === 'Escape')
                    this.closeDialogue()
                else if(event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space')
                {
                    event.preventDefault()
                    if(!event.repeat)
                        this.advanceDialogue()
                }
                else if(event.code === 'ArrowDown' || event.code === 'KeyS')
                {
                    event.preventDefault()
                    this.moveChoice(1)
                }
                else if(event.code === 'ArrowUp' || event.code === 'KeyW')
                {
                    event.preventDefault()
                    this.moveChoice(- 1)
                }
                return
            }
            if(event.code === 'Escape' && this.panel)
                this.closePanel()
        })
    }

    setMenuOpen(open, restoreFocus = false)
    {
        // Always expanded bar (top of the screen): nothing to open, and it never takes the world inputs
        if(this.menuElement.classList.contains('is-bar'))
            return

        this.menuOpen = open
        this.menuElement.classList.toggle('is-open', open)
        this.menuTrigger.setAttribute('aria-expanded', String(open))
        this.rail.setAttribute('aria-hidden', String(!open))
        this.rail.inert = !open
        if(open)
            this.takeInputs()
        else
        {
            // Drop the focus instead of putting it back on the trigger, Space / Enter must not reopen the menu
            if(restoreFocus || this.menuElement.contains(document.activeElement))
                document.activeElement?.blur()
            this.releaseInputs()
        }
    }

    /**
     * Screen stack: panel / dialogue take the inputs from the world while open
     */
    takeInputs()
    {
        if(this.ownsInputs)
            return
        this.ownsInputs = true
        this.root.classList.add('is-overlay')
        this.previousInputFilters = [...this.game.inputs.filters]
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('career')
    }

    releaseInputs()
    {
        if(!this.ownsInputs || this.panel || this.dialogue || this.menuOpen)
            return
        this.ownsInputs = false
        this.root.classList.remove('is-overlay')
        this.game.inputs.filters.clear()
        for(const filter of this.previousInputFilters ?? [ 'wandering' ])
            this.game.inputs.filters.add(filter)
    }

    openPanel(name, options = {})
    {
        if(!MENU.includes(name))
            return
        this.closeDialogue(false)
        this.panel = { name, ...options }
        this.setMenuOpen(false)
        this.notice = null
        this.panelElement.classList.add('is-open')
        this.panelElement.setAttribute('aria-hidden', 'false')
        this.takeInputs()
        this.panelBody.scrollTop = 0
        this.render()
        this.panelElement.querySelector('textarea, input:not(.career-map input), button:not(.career-close):not(.career-map button)')?.focus({ preventScroll: true }) // Map notes open on focus, don't open one by itself
    }

    closePanel()
    {
        this.panel = null
        this.panelElement.classList.remove('is-open')
        this.panelElement.setAttribute('aria-hidden', 'true')
        this.render()
        this.releaseInputs()
        // Drop the focus: on the menu trigger, the menu would swallow Enter and the world couldn't interact (NPCs, kiosks)
        if(this.panelElement.contains(document.activeElement))
            document.activeElement.blur()
    }

    /**
     * Run an API call, show its error in the panel
     */
    async run(task, onDone = null)
    {
        this.notice = null
        try
        {
            const result = await task()
            onDone?.(result)
        }
        catch(error)
        {
            const key = `error.${error.code}`
            const text = t(key) === key ? t('error.generic') : t(key)
            this.notice = { type: 'error', text }
            this.renderPanel()
        }
    }

    async changeLang(lang)
    {
        setLang(lang)
        await this.run(() => this.api.setLang(lang))
        this.rebuildStatic()
        this.render()
    }

    rebuildStatic()
    {
        this.root.querySelector('.career-busy').textContent = t('common.loading')
        this.root.querySelector('.career-close').setAttribute('aria-label', t('common.close'))
        this.menuElement.setAttribute('aria-label', t('menu.title'))
        this.root.querySelector('.js-career-menu-label').textContent = t('menu.title')
    }

    action(name, data, element)
    {
        switch(name)
        {
            case 'close': return this.closePanel()
            case 'menu-toggle': return this.setMenuOpen(!this.menuOpen)
            case 'menu': return this.panel?.name === data.panel ? this.closePanel() : this.openPanel(data.panel)
            case 'next': return this.openPanel(data.panel)
            case 'extract': return this.extractProfile()
            case 'skill-remove': return this.updateSkill(Number(data.index), null)
            case 'skill-add': return this.addSkill()
            case 'career': return this.openPanel('careers', { careerId: data.career })
            case 'careers-back': return this.openPanel('careers')
            case 'mode': this.panel.mode = data.mode; return this.renderPanel()
            case 'stage-toggle': this.panel.openStage = this.panel.openStage === data.stage ? null : data.stage; return this.renderPanel()
            case 'stage-force': this.panel.forceConfirm = data.stage; this.panel.openStage = data.stage; return this.renderPanel()
            case 'stage-force-cancel': this.panel.forceConfirm = null; return this.renderPanel()
            case 'stage-force-confirm': return this.forceStage(data.stage, element)
            case 'set-target': return this.setTarget()
            case 'file-remove': delete this.files[data.file]; return this.renderPanel()
            case 'roadmap': return this.generateRoadmap(data.confirm === '1')
            case 'log': return this.submitLog()
            case 'reset': return this.reset()
            case 'player-name': return this.savePlayerName()
            case 'friend-add': return this.addFriend()
            case 'friend-remove': return this.run(() => this.api.removeFriend(data.id))
            case 'copy-code': return this.copyFriendCode()
            case 'choice': this.dialogue.selected = Number(data.index); return this.choose(Number(data.index))
            case 'dialogue-close': return this.closeDialogue()
            case 'dialogue-advance': return this.advanceDialogue()
        }
    }

    /**
     * Actions
     */
    async extractProfile()
    {
        const text = this.drafts.profile ?? ''
        const file = this.files.profile ? await readFile(this.files.profile) : null
        await this.run(() => this.api.extractProfile(text, file), (result) =>
        {
            this.drafts.profile = ''
            delete this.files.profile
            this.notice = { type: 'info', text: `${t('profile.found', { n: result.found })} · ${result.summary}` }
            this.renderPanel()
        })
    }

    updateSkill(index, change)
    {
        const skills = this.state.profile.skills.map((skill) => ({ ...skill }))
        if(change === null)
            skills.splice(index, 1)
        else
            Object.assign(skills[index], change)
        this.run(() => this.api.setSkills(skills))
    }

    addSkill()
    {
        const name = (this.drafts.newSkill ?? '').trim()
        if(!name)
            return
        this.drafts.newSkill = ''
        const known = Object.entries(this.state.skillNames).find(([ , names ]) => Object.values(names).some((value) => value.toLowerCase() === name.toLowerCase()))
        const skills = [ ...this.state.profile.skills, { id: known?.[0] ?? null, name, level: 1, evidence: '', source: 'manual' } ]
        this.run(() => this.api.setSkills(skills))
    }

    async setTarget()
    {
        const careerId = this.panel.careerId
        const mode = this.panel.mode ?? 'general'
        const file = mode === 'customise' && this.files.posting ? await readFile(this.files.posting) : null
        const text = mode === 'customise' ? this.drafts.posting ?? '' : ''
        await this.run(() => this.api.setTarget(careerId, mode, text, file), () =>
        {
            this.drafts.posting = ''
            delete this.files.posting
            this.game.career.world.celebratePet()
            this.openPanel(mode === 'customise' ? 'careers' : 'pet', mode === 'customise' ? { careerId } : {})
        })
    }

    async generateRoadmap(confirmFirst)
    {
        if(confirmFirst && !confirm(t('roadmap.regenerateConfirm')))
            return
        await this.run(() => this.api.generateRoadmap())
    }

    async submitLog()
    {
        const text = (this.drafts.log ?? '').trim()
        if(!text)
            return
        await this.run(() => this.api.log(text), (result) =>
        {
            this.drafts.log = ''
            this.notice = { type: 'info', text: result.reply }
            this.renderPanel()
            this.game.career.world.cheerPet()
        })
    }

    // The padlock shatters first, then the stage is unlocked (the new state re-renders the note with its tasks)
    async forceStage(stageId, element)
    {
        element.closest('.career-map-locked')?.classList.add('is-breaking')
        this.panel.forceConfirm = null
        this.panel.openStage = stageId
        await new Promise((resolve) => setTimeout(resolve, 800))
        await this.run(() => this.api.unlockStage(stageId))
    }

    async savePlayerName()
    {
        await this.run(() => this.api.setPlayerName(this.drafts.playerName ?? ''), () =>
        {
            delete this.drafts.playerName
            this.notice = { type: 'info', text: t('leaderboard.nameSaved') }
            this.renderPanel()
        })
    }

    async addFriend()
    {
        await this.run(() => this.api.addFriend(this.drafts.friendCode ?? ''), (result) =>
        {
            this.drafts.friendCode = ''
            this.notice = { type: 'info', text: t(result.friend === 'updated' ? 'leaderboard.updated' : 'leaderboard.added') }
            this.renderPanel()
        })
    }

    async copyFriendCode()
    {
        const field = this.panelBody.querySelector('.js-friend-code')
        try
        {
            await navigator.clipboard.writeText(this.state.player.code)
        }
        catch
        {
            field?.select()
            document.execCommand?.('copy')
        }
        this.notice = { type: 'info', text: t('leaderboard.copied') }
        this.renderPanel()
    }

    async reset()
    {
        if(!confirm(t('settings.resetConfirm')))
            return
        this.drafts = {}
        this.files = {}
        await this.run(() => this.api.reset())
    }

    /**
     * Rendering
     */
    render()
    {
        if(!this.state)
            return
        this.renderHud()
        this.renderRail()
        this.renderPanel()
        this.renderDialogue()
    }

    nextStep()
    {
        const state = this.state
        if(!state.profile.skills.length)
            return { text: t('next.profile'), panel: 'profile' }
        if(!state.target)
            return { text: t('next.target'), panel: 'careers' }
        if(!state.roadmap)
            return { text: t('next.roadmap'), panel: 'roadmap' }
        const active = state.roadmap.stages.find((stage) => stage.status === 'active')
        if(active)
            return { text: t('next.study', { stage: active.title, p: active.progress }), panel: 'log' }
        return { text: t('next.done'), panel: 'careers' }
    }

    renderHud()
    {
        const state = this.state
        const pet = state.pet
        const career = pet && state.careers.find((item) => item.id === pet.careerId)
        const next = this.nextStep()

        const petHtml = pet
            ? `<button class="career-pet-chip" data-action="menu" data-panel="pet" style="--pet:${career.color}">
                    <span class="career-pet-avatar">${esc(pet.name.slice(0, 1))}</span>
                    <span class="career-pet-info">
                        <strong>${esc(pet.name)} <em>${esc(t('common.level', { n: pet.level }))}</em></strong>
                        <small>${esc(t('hud.affinity'))} ${bar(pet.affinity, 'is-heart')}</small>
                    </span>
               </button>`
            : `<button class="career-pet-chip is-empty" data-action="menu" data-panel="careers"><span class="career-pet-avatar">?</span><span class="career-pet-info"><small>${esc(t('hud.noPet'))}</small></span></button>`

        const aiBadge = state.ai.mock
            ? `<span class="career-badge is-mock">${esc(t('hud.mock'))}</span>`
            : !state.ai.keyConfigured ? `<span class="career-badge is-warning">${esc(t('hud.noKey'))}</span>` : ''

        this.hud.innerHTML = `
            ${petHtml}
            <div class="career-hud-row">
                <button class="career-points" data-action="menu" data-panel="leaderboard">★ ${esc(state.points)} <small>${esc(t('hud.points'))}</small></button>
                ${aiBadge}
            </div>
            <button class="career-next ${next.highlight ? 'is-highlight' : ''}" data-action="next" data-panel="${next.panel}">
                <small>${esc(t('hud.next'))}</small>${esc(next.text)}
            </button>
        `
    }

    renderRail()
    {
        // Keep the buttons mounted so state/language updates preserve keyboard focus.
        if(!this.rail.children.length)
            this.rail.innerHTML = MENU.map((name) => `
                <button type="button" class="career-rail-item" data-action="menu" data-panel="${name}">
                    ${icon(name)}<span></span>
                </button>
            `).join('')

        for(const button of this.rail.children)
        {
            const name = button.dataset.panel
            button.classList.toggle('is-active', this.panel?.name === name)
            button.title = t(`menu.${name}`)
            button.setAttribute('aria-label', t(`menu.${name}`))
            button.querySelector('span').textContent = t(`menu.${name}`)
        }
    }

    renderPanel()
    {
        if(!this.panel || !this.state)
            return

        // Keep the focused field and its caret while re-rendering
        const active = document.activeElement
        const focusKey = active?.dataset?.draft
        const caret = focusKey ? active.selectionStart : null
        const scroll = this.panelBody.scrollTop

        const renderers = {
            profile: () => this.renderProfile(),
            careers: () => this.panel.careerId ? this.renderCareer(this.panel.careerId) : this.renderCareers(),
            pet: () => this.renderPet(),
            roadmap: () => this.renderRoadmap(),
            log: () => this.renderLog(),
            leaderboard: () => this.renderLeaderboard(),
            settings: () => this.renderSettings(),
        }
        const [ title, body ] = renderers[this.panel.name]()
        const notice = this.notice ? `<p class="career-notice is-${this.notice.type}" role="status">${esc(this.notice.text)}</p>` : ''

        this.panelTitle.textContent = title
        this.panelBody.innerHTML = notice + body
        this.panelElement.classList.toggle('is-map', this.panel.name === 'roadmap' && Boolean(this.state.roadmap))
        this.panelBody.scrollTop = scroll
        this.renderRail()

        if(focusKey)
        {
            const field = this.panelBody.querySelector(`[data-draft="${CSS.escape(focusKey)}"]`)
            if(field)
            {
                field.focus({ preventScroll: true })
                if(caret !== null && field.setSelectionRange)
                    field.setSelectionRange(caret, caret)
            }
        }
    }

    fileField(key, accept)
    {
        const file = this.files[key]
        return file
            ? `<span class="career-file">${esc(t('common.attached', { name: file.name }))} <button class="career-link" data-action="file-remove" data-file="${key}">${esc(t('common.remove'))}</button></span>`
            : `<label class="career-file-button">${esc(t('common.attach'))}<input type="file" data-file="${key}" accept="${accept}" hidden></label>`
    }

    skillName(id, fallback)
    {
        return id && this.state.skillNames[id] ? pick(this.state.skillNames[id]) : fallback
    }

    renderProfile()
    {
        const skills = this.state.profile.skills
        const list = skills.length
            ? `<ul class="career-skill-list">${skills.map((skill, index) => `
                <li>
                    <span class="career-skill-name">${esc(this.skillName(skill.id, skill.name))}<small>${esc(t(`profile.source.${skill.source}`))}${skill.evidence ? ` · ${esc(skill.evidence)}` : ''}</small></span>
                    <select data-skill-level="${index}" aria-label="${esc(skill.name)}">
                        ${[ 0, 1, 2, 3 ].map((level) => `<option value="${level}" ${skill.level === level ? 'selected' : ''}>${esc(t(`level.${level}`))}</option>`).join('')}
                    </select>
                    <button class="career-icon-button" data-action="skill-remove" data-index="${index}" aria-label="${esc(t('common.remove'))}">×</button>
                </li>`).join('')}</ul>`
            : `<p class="career-muted">${esc(t('profile.empty'))}</p>`

        return [ t('profile.title'), `
            <p>${esc(t('profile.intro'))}</p>
            <textarea data-draft="profile" rows="4" placeholder="${esc(t('profile.placeholder'))}">${esc(this.drafts.profile ?? '')}</textarea>
            <div class="career-row">
                ${this.fileField('profile', '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md')}
                <button class="career-button" data-action="extract">${esc(t('profile.extract'))}</button>
            </div>
            <h3>${esc(t('profile.skills'))}</h3>
            ${list}
            <div class="career-row">
                <input type="text" data-draft="newSkill" placeholder="${esc(t('profile.newSkill'))}" value="${esc(this.drafts.newSkill ?? '')}">
                <button class="career-button is-secondary" data-action="skill-add">${esc(t('profile.add'))}</button>
            </div>
        ` ]
    }

    marketBadges(career)
    {
        const monthly = career.market.monthly
        const trend = monthly
            ? `<span class="career-tag is-trend is-${monthly.change > 0 ? 'up' : monthly.change < 0 ? 'down' : 'flat'}" title="${esc([ monthly.note ? pick(monthly.note) : '', monthly.postings !== undefined && monthly.postings !== null ? t('careers.postings', { n: monthly.postings }) : '' ].filter(Boolean).join(' · '))}">${esc(t('careers.monthTrend', {
                month: new Date(`${monthly.period}-01T00:00:00`).toLocaleString(getLang() === 'zh' ? 'zh-CN' : getLang(), { month: 'short' }),
                arrow: monthly.change > 0 ? '↑' : monthly.change < 0 ? '↓' : '→',
                change: `${monthly.change > 0 ? '+' : ''}${monthly.change}`,
            }))}</span>`
            : ''
        return `<span class="career-tag">${esc(t('careers.heat', { p: career.market.heat }))}</span><span class="career-tag">${esc(t(`careers.trend.${career.market.trend}`))}</span>${trend}`
    }

    renderCareers()
    {
        const careers = [ ...this.state.careers ].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
        return [ t('careers.title'), `
            <p>${esc(t('careers.intro'))}</p>
            ${careers[0]?.market.monthly ? `<p class="career-muted">${esc(t(careers[0].market.monthly.live ? 'careers.monthLive' : 'careers.monthNote', { period: careers[0].market.monthly.period }))}</p>` : ''}
            <div class="career-cards">
                ${careers.map((career) => `
                    <button class="career-card" data-action="career" data-career="${career.id}" style="--career:${career.color}">
                        <span class="career-card-top">
                            <strong>${esc(pick(career.name))}</strong>
                            ${this.state.target?.careerId === career.id ? `<span class="career-tag is-target">${esc(t('careers.current'))}</span>` : ''}
                        </span>
                        <small>${esc(pick(career.summary))}</small>
                        <span class="career-card-affinity">${bar(career.affinity ?? 0, 'is-heart')}<em>♡ ${esc(t('careers.affinity', { p: career.affinity ?? 0 }))}</em></span>
                        <span>${this.marketBadges(career)}</span>
                    </button>`).join('')}
            </div>
            <p class="career-muted">${esc(t('careers.marketNote'))}</p>
        ` ]
    }

    renderCareer(careerId)
    {
        const career = this.state.careers.find((item) => item.id === careerId)
        const isTarget = this.state.target?.careerId === careerId
        const mode = this.panel.mode ?? (isTarget ? this.state.target.mode : 'general')
        this.panel.mode = mode
        const range = t('common.months', { a: career.effortMonths[0], b: career.effortMonths[1] })

        const requirements = career.match.skills.map((skill) => this.renderSkillCard({
            ...skill,
            progress: Math.min(skill.current, skill.required) / skill.required * 100,
        }, true)).join('')

        const posting = isTarget && this.state.target.posting ? this.renderPosting(this.state.target.posting) : ''

        const switching = this.state.target && !isTarget ? `<p class="career-notice is-warning">${esc(t('mode.switchWarning'))}</p>` : ''

        return [ pick(career.name), `
            <button class="career-link" data-action="careers-back">← ${esc(t('common.back'))}</button>
            <p>${esc(pick(career.summary))}</p>
            <p>${this.marketBadges(career)} <span class="career-tag">${esc(t('careers.pet', { name: career.pet.name }))}</span></p>
            <p class="career-muted">${esc(t('careers.effort', { range }))} · ${esc(t('careers.marketNote'))}</p>
            <h3>${esc(t('careers.requirements'))}</h3>
            <p class="career-muted career-skill-reference">${esc(t('skill.reference'))}</p>
            <ul class="career-skill-grid career-requirements" style="--skill-accent:${career.color}">${requirements}</ul>
            ${posting}
            <h3>${esc(t('careers.chooseMode'))}</h3>
            <div class="career-modes">
                ${[ 'general', 'customise' ].map((item) => `
                    <button class="career-mode ${mode === item ? 'is-selected' : ''}" data-action="mode" data-mode="${item}" aria-pressed="${mode === item}">
                        <strong>${esc(t(`mode.${item}`))}</strong><small>${esc(t(`mode.${item}.desc`))}</small>
                    </button>`).join('')}
            </div>
            ${mode === 'customise' ? `
                <textarea data-draft="posting" rows="5" placeholder="${esc(t('mode.postingPlaceholder'))}">${esc(this.drafts.posting ?? '')}</textarea>
                <div class="career-row">${this.fileField('posting', '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md')}</div>
                <p class="career-muted">${esc(t('mode.disclaimer'))}</p>` : ''}
            ${switching}
            <button class="career-button is-wide" data-action="set-target">${esc(t('mode.confirm'))}</button>
        ` ]
    }

    renderPosting(posting)
    {
        return `
            <h3>${esc(t('posting.title'))}: ${esc(posting.title)} · ${esc(posting.company)}</h3>
            <p class="career-muted">${esc(posting.summary)}</p>
            <ul class="career-posting">${posting.requirements.map((requirement, index) => `
                <li class="is-${requirement.status}">
                    <span class="career-tag">R${index + 1} · ${esc(t(`posting.${requirement.priority}`))}</span>
                    <span>${esc(requirement.text)}${requirement.note ? `<small>${esc(requirement.note)}</small>` : ''}</span>
                    <span class="career-status">${esc(t(`posting.status.${requirement.status}`))}</span>
                </li>`).join('')}
            </ul>
            <p class="career-muted">${esc(t('mode.disclaimer'))}</p>
        `
    }

    renderPet()
    {
        const pet = this.state.pet
        if(!pet)
            return [ t('pet.title'), `<p>${esc(t('pet.none'))}</p><button class="career-button" data-action="menu" data-panel="careers">${esc(t('menu.careers'))}</button>` ]

        const career = this.state.careers.find((item) => item.id === pet.careerId)
        return [ t('pet.title'), `
            <div class="career-pet-card" style="--pet:${career.color}">
                <span class="career-pet-portrait">${esc(pet.name.slice(0, 1))}</span>
                <div>
                    <strong>${esc(pet.name)}</strong> <em>${esc(t('common.level', { n: pet.level }))}</em>
                    <small>${esc(t(`pet.species.${pet.species}`))} · ${esc(pick(career.name))}</small>
                    <span class="career-affinity">${esc(t('hud.affinity'))} ${bar(pet.affinity, 'is-heart')} ${esc(pet.affinity)}/100</span>
                </div>
            </div>
            <p class="career-muted">${esc(t('pet.affinityNote'))}</p>
            <h3>${esc(t('pet.skills'))}</h3>
            <p class="career-muted career-skill-reference">${esc(t('skill.reference'))}</p>
            <ul class="career-skill-grid career-pet-skills" style="--skill-accent:${career.color}">${pet.skills.map((skill) => this.renderSkillCard(skill)).join('')}
            </ul>
        ` ]
    }

    renderSkillCard(skill, showRequirement = false)
    {
        const detail = this.state.skillDetails[skill.id]
        const progress = Math.max(0, Math.min(100, Math.round(Number(skill.progress) || 0)))
        const title = this.skillName(skill.id)
        const colors = [ '#f5d85f', '#ffad62', '#ff71ac', '#68cf98', '#79b8fa' ]
        return `
            <li class="career-skill-card" data-skill="${esc(skill.id)}">
                <header class="career-skill-card-header">
                    <span class="career-skill-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${SKILL_ICONS[detail.icon]}</svg></span>
                    <h4>${esc(title)}</h4>
                        <div class="career-skill-mastery" role="meter" aria-label="${esc(title)} · ${esc(t('skill.mastery'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
                            <span class="career-skill-stones" aria-hidden="true">${colors.map((color, index) => `<i class="${progress >= (index + 1) * 20 ? 'is-filled' : ''}" style="--stone:${color}"></i>`).join('')}</span>
                            <small>${esc(t('skill.mastery'))} <b>${progress}%</b></small>
                        </div>
                </header>
                <dl class="career-skill-stats">
                    <div><dt title="${esc(t('skill.market'))}">${esc(t('skill.heat'))}</dt><dd>${detail.heat}%</dd></div>
                    <div><dt>${esc(t('skill.difficulty'))}</dt><dd>${detail.difficulty}/5</dd></div>
                </dl>
                <p class="career-skill-description">${esc(pick(detail.description))}</p>
                ${showRequirement ? `<p class="career-skill-requirement">${esc(t('careers.yours', { c: t(`level.${skill.current}`) }))} / ${esc(t('careers.required', { r: t(`level.${skill.required}`) }))}</p>` : ''}
            </li>`
    }

    renderRoadmap()
    {
        const state = this.state
        if(!state.target)
            return [ t('roadmap.title'), `<p>${esc(t('roadmap.noTarget'))}</p><button class="career-button" data-action="menu" data-panel="careers">${esc(t('menu.careers'))}</button>` ]
        if(!state.roadmap)
            return [ t('roadmap.title'), `<p>${esc(t('roadmap.intro'))}</p><button class="career-button is-wide" data-action="roadmap">${esc(t('roadmap.generate'))}</button>` ]

        return [ t('roadmap.title'), this.renderRoadmapMap() ]
    }

    /**
     * Roadmap as a treasure map on an unrolled scroll (horizontal): the world map picture, a dotted trail from left to right
     * through one flag per stage, the chest at the end. A stage note opens beside its flag when the pointer is near
     * (hover / focus), or on click for touch screens. The note spans the map height, its padding bridges to the flag.
     */
    renderRoadmapMap()
    {
        const state = this.state
        const stages = state.roadmap.stages
        const career = state.careers.find((item) => item.id === state.target.careerId)
        const stageTitle = (id) => stages.find((stage) => stage.id === id)?.title ?? id
        const activeIndex = stages.findIndex((stage) => stage.status === 'active')

        // Winding trail in % of the map (x from left to right, y around the middle), the map scrolls when it gets crowded
        const minWidth = 260 + (stages.length + 1) * 190
        const step = 78 / Math.max(1, stages.length)
        const points = stages.map((_, index) => ({ x: 9 + index * step, y: 60 + Math.sin(index * 1.9 + 0.6) * 16 }))
        const chest = { x: 92, y: 58 }
        const trail = [ ...points, chest ]
        const path = trail.map((point, index) =>
        {
            if(index === 0)
                return `M ${point.x} ${point.y}`
            const previous = trail[index - 1]
            const middle = (point.x - previous.x) * 0.5
            return `C ${previous.x + middle} ${previous.y} ${point.x - middle} ${point.y} ${point.x} ${point.y}`
        }).join(' ')

        const stops = stages.map((stage, index) =>
        {
            const point = points[index]
            const done = stage.tasks.filter((task) => task.progress >= 100).length
            const locked = stage.status === 'locked'
            const open = this.panel.openStage === stage.id
            const flag = stage.status === 'cleared' ? '✓' : index + 1
            const right = point.x < 55
            return `
            <div class="career-map-stop is-${stage.status} ${open ? 'is-open' : ''}" data-stage="${stage.id}">
                <button class="career-map-node" style="left:${point.x}%;top:${point.y}%" data-action="stage-toggle" data-stage="${stage.id}" aria-label="${esc(t('roadmap.stage', { n: index + 1 }))} · ${esc(stage.title)}" aria-expanded="${open}">
                    <span class="career-map-base">${locked ? icon('lock') : ''}</span>
                    <span class="career-map-pole"></span>
                    <span class="career-map-flag">${flag}</span>
                </button>
                ${index === activeIndex ? `<img class="career-map-avatar" style="left:${point.x}%;top:${point.y}%" src="ui/avatars/${esc((this.game.characterSelect?.selected ?? CharacterSelect.getSaved()).id)}.png" alt="">` : ''}
                <div class="career-map-note ${right ? 'is-right' : 'is-left'}" style="${right ? `left:${point.x}%` : `right:${100 - point.x}%`}">
                    <article class="career-map-card">
                        <span class="career-map-card-index">${esc(t('roadmap.stage', { n: index + 1 }))}</span>
                        <strong class="career-map-card-title">${esc(stage.title)}</strong>
                        <div class="career-map-tags">
                            <span class="career-tag is-${stage.status}">${esc(t(`roadmap.status.${stage.status}`))}</span>
                            <span class="career-tag is-mp">${esc(t('roadmap.mp', { n: stage.mp }))}</span>
                            ${stage.forced && stage.status === 'active' ? `<span class="career-tag is-forced">${esc(t('roadmap.forced'))}</span>` : ''}
                        </div>
                        <div class="career-map-progress">${bar(stage.progress)}<small>${esc(t('roadmap.tasksDone', { done, total: stage.tasks.length }))}</small></div>
                        <p class="career-map-why">${icon('target')}<span><b>${esc(t('roadmap.why'))}</b>${esc(stage.why)}</span></p>
                        ${stage.requirementRefs.length ? `<p class="career-muted">${esc(t('roadmap.covers', { refs: stage.requirementRefs.join(', ') }))}</p>` : ''}
                        ${locked ? this.renderStageLock(stage, stage.prerequisites.map(stageTitle).join(', ')) : `
                        ${stage.prerequisites.length ? `<p class="career-map-lock">${icon('lock')}${esc(t('roadmap.needs', { stages: stage.prerequisites.map(stageTitle).join(', ') }))}</p>` : ''}
                        <ul class="career-tasks">${stage.tasks.map((task) => `
                            <li>
                                <label>
                                    <input type="checkbox" data-task="${task.id}" ${task.progress >= 100 ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                                    <span>${esc(task.title)}<small>${esc(task.why)}</small></span>
                                </label>
                                <span class="career-tag is-mp">${esc(t('roadmap.mp', { n: task.mp }))}</span>
                                ${bar(task.progress, 'is-thin')}
                            </li>`).join('')}
                        </ul>`}
                    </article>
                </div>
            </div>`
        }).join('')

        const allCleared = stages.length > 0 && stages.every((stage) => stage.status === 'cleared')

        return `
            <div class="career-map">
                <div class="career-map-viewport">
                    <div class="career-map-board" style="min-width:${minWidth}px;background-image:url(ui/map/map-day.webp)">
                        <svg class="career-map-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <path d="${path}" vector-effect="non-scaling-stroke"/>
                        </svg>
                        <header class="career-map-header">
                            <div class="career-map-banner">
                                <span class="career-map-emblem">${icon('compass')}</span>
                                <span><strong>${esc(t('roadmap.mapTitle'))}</strong><small>${esc(t('roadmap.mapTarget', { career: pick(career.name) }))}</small></span>
                            </div>
                            <span class="career-map-ribbon">${esc(t('roadmap.mapRibbon'))}</span>
                        </header>
                        <span class="career-map-mp" title="${esc(t('roadmap.mpNote'))}">${esc(t('roadmap.mpShort'))}</span>
                        <span class="career-map-hint">${esc(t('roadmap.mapHint'))}</span>
                        ${stops}
                        <div class="career-map-chest ${allCleared ? 'is-open' : ''}" style="left:${chest.x}%;top:${chest.y}%">
                            <svg viewBox="0 0 64 52" aria-hidden="true">
                                <ellipse cx="32" cy="48" rx="28" ry="4" class="career-map-chest-shadow"/>
                                <rect x="6" y="22" width="52" height="26" rx="4" class="career-map-chest-wood"/>
                                <path d="M6 24c0-12 10-18 26-18s26 6 26 18Z" class="career-map-chest-lid"/>
                                <path d="M6 22h52M14 8v40M50 8v40" class="career-map-chest-band"/>
                                <rect x="27" y="18" width="10" height="12" rx="2" class="career-map-chest-lock"/>
                            </svg>
                            <span class="career-map-bubble">${esc(t(allCleared ? 'roadmap.chestOpen' : 'roadmap.chest'))}</span>
                        </div>
                    </div>
                </div>
                <footer class="career-map-footer">
                    <p><span>${esc(state.roadmap.overview)}</span><small>${esc(t('roadmap.intro'))} ${esc(t('roadmap.mpNote'))}</small></p>
                    <button class="career-button is-secondary" data-action="roadmap" data-confirm="1">${esc(t('roadmap.regenerate'))}</button>
                </footer>
            </div>`
    }

    /**
     * Locked stage: tasks sealed by chains and a padlock, the player can still start it after a confirmation
     */
    renderStageLock(stage, prerequisites)
    {
        const confirming = this.panel.forceConfirm === stage.id
        const shards = Array.from({ length: 10 }, (_, index) =>
        {
            const angle = index / 10 * Math.PI * 2 + 0.3
            const distance = 70 + (index % 3) * 26
            return `<i style="--dx:${(Math.cos(angle) * distance).toFixed(0)}px;--dy:${(Math.sin(angle) * distance).toFixed(0)}px;--r:${(index * 67) % 360 - 180}deg"></i>`
        }).join('')

        return `
            <div class="career-map-locked ${confirming ? 'is-confirming' : ''}">
                <svg class="career-map-chains" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">${MAP_CHAINS}</svg>
                <span class="career-map-padlock">${MAP_PADLOCK}<span class="career-map-shards" aria-hidden="true">${shards}</span></span>
                <p class="career-map-lock">${icon('lock')}${esc(t('roadmap.unlock', { stages: prerequisites }))}</p>
                ${confirming ? `
                    <p class="career-map-force-warning" role="alert">${esc(t('roadmap.forceConfirm', { stages: prerequisites }))}</p>
                    <div class="career-map-force-actions">
                        <button class="career-button" data-action="stage-force-confirm" data-stage="${stage.id}">${esc(t('roadmap.forceYes'))}</button>
                        <button class="career-button is-secondary" data-action="stage-force-cancel">${esc(t('common.cancel'))}</button>
                    </div>` : `
                    <button class="career-button is-secondary" data-action="stage-force" data-stage="${stage.id}">${esc(t('roadmap.force'))}</button>`}
            </div>`
    }

    renderLog()
    {
        const state = this.state
        const logs = state.logs.length ? `
            <h3>${esc(t('log.recent'))}</h3>
            <ul class="career-logs">${state.logs.map((log) => `
                <li>
                    <time>${esc(new Date(log.at).toLocaleString(getLang() === 'zh' ? 'zh-CN' : getLang()))} · ${esc(log.source)}</time>
                    <span>${esc(log.text)}</span>
                    <small>${log.skillIds.map((id) => esc(this.skillName(id))).join(' · ')}${log.advanced.map((item) => ` · ${esc(t('log.advanced', item))}`).join('')}${log.points ? ` · ${esc(t('log.points', { n: log.points }))}` : ''}</small>
                </li>`).join('')}
            </ul>` : ''

        return [ t('log.title'), `
            <p>${esc(t('log.intro'))}</p>
            ${state.roadmap ? `
                <textarea data-draft="log" rows="3" placeholder="${esc(t('log.placeholder'))}">${esc(this.drafts.log ?? '')}</textarea>
                <button class="career-button is-wide" data-action="log">${esc(t('log.submit'))}</button>` : `<p class="career-notice is-warning">${esc(t('log.noRoadmap'))}</p>`}
            <p class="career-muted">${esc(t('log.note'))}</p>
            <p class="career-muted">💬 ${esc(t('log.channels'))}</p>
            ${logs}
        ` ]
    }

    renderLeaderboard()
    {
        const state = this.state
        const rows = state.leaderboard.map((row, index) => `
            <li class="career-leaderboard-row ${row.me ? 'is-me' : ''}">
                <span class="career-leaderboard-rank">${index + 1}</span>
                <span class="career-leaderboard-name">
                    ${esc(row.name || t('leaderboard.noName'))}${row.me ? ` <em>${esc(t('leaderboard.you'))}</em>` : ''}
                    ${row.sharedAt ? `<small>${esc(t('leaderboard.sharedAt', { date: row.sharedAt }))}</small>` : ''}
                </span>
                <strong>★ ${esc(row.points)}</strong>
                ${row.me ? '' : `<button class="career-link" data-action="friend-remove" data-id="${esc(row.id)}" title="${esc(t('common.remove'))}">×</button>`}
            </li>`).join('')

        return [ t('leaderboard.title'), `
            <p>${esc(t('leaderboard.rule', state.rules.difficultyWeights))}</p>
            <ol class="career-leaderboard">${rows}</ol>
            ${state.leaderboard.length < 2 ? `<p class="career-muted">${esc(t('leaderboard.empty'))}</p>` : ''}
            <h3>${esc(t('leaderboard.name'))}</h3>
            ${state.player.name ? '' : `<p class="career-notice is-warning">${esc(t('leaderboard.nameFirst'))}</p>`}
            <div class="career-row">
                <input type="text" data-draft="playerName" maxlength="24" value="${esc(this.drafts.playerName ?? state.player.name)}" placeholder="${esc(t('leaderboard.namePlaceholder'))}">
                <button class="career-button is-secondary" data-action="player-name">${esc(t('common.save'))}</button>
            </div>
            <h3>${esc(t('leaderboard.myCode'))}</h3>
            <p class="career-muted">${esc(t('leaderboard.myCodeHint'))}</p>
            <div class="career-row">
                <input type="text" class="js-friend-code" readonly value="${esc(state.player.code)}">
                <button class="career-button" data-action="copy-code">${esc(t('leaderboard.copy'))}</button>
            </div>
            <h3>${esc(t('leaderboard.add'))}</h3>
            <div class="career-row">
                <input type="text" data-draft="friendCode" value="${esc(this.drafts.friendCode ?? '')}" placeholder="CQ-…">
                <button class="career-button" data-action="friend-add">${esc(t('leaderboard.addButton'))}</button>
            </div>
        ` ]
    }

    renderSettings()
    {
        const ai = this.state.ai
        return [ t('menu.settings'), `
            <h3>${esc(t('settings.language'))}</h3>
            <select data-lang="1">${LANGS.map((lang) => `<option value="${lang.id}" ${getLang() === lang.id ? 'selected' : ''}>${esc(lang.label)}</option>`).join('')}</select>
            <h3>AI</h3>
            <p class="career-muted">${esc(ai.mock ? t('settings.aiMock') : t('settings.ai', { model: ai.model }))}</p>
            <button class="career-button is-danger" data-action="reset">${esc(t('settings.reset'))}</button>
        ` ]
    }

    /**
     * NPC dialogue (skills/game/dialogue-systems): a small graph of nodes { lines, choices }, choices gated by
     * conditions on the state, every text from the string table.
     * Presentation in the Pokemon Scarlet/Violet style: white box at the bottom with the speaker tab, text typed out,
     * Enter / click for the next page, then a choice list on the right (arrows + Enter), Esc to leave.
     */
    openDialogue(careerId)
    {
        if(!this.state)
            return
        this.closePanel()
        this.dialogue = { careerId, node: 'greet', page: 0, typing: false, selected: 0, openedAt: performance.now(), rendered: null }
        this.setMenuOpen(false)
        this.dialogueElement.classList.add('is-open')
        this.dialogueElement.setAttribute('aria-hidden', 'false')
        this.takeInputs()
        this.renderDialogue()
    }

    closeDialogue(release = true)
    {
        if(!this.dialogue)
            return
        clearInterval(this.typingInterval)
        this.dialogue = null
        this.dialogueElement.classList.remove('is-open')
        this.dialogueElement.setAttribute('aria-hidden', 'true')
        if(release)
            this.releaseInputs()
    }

    dialogueGraph(careerId)
    {
        const state = this.state
        const career = state.careers.find((item) => item.id === careerId)
        const name = pick(career.name)
        const isTarget = state.target?.careerId === careerId
        const gaps = career.match.skills.filter((skill) => skill.gap > 0).map((skill) => this.skillName(skill.id))
        const range = t('common.months', { a: career.effortMonths[0], b: career.effortMonths[1] })

        const menu = [
            { text: t('npc.ask.about'), to: 'about' },
            { text: t('npc.ask.fit'), to: 'fit' },
            { text: t('npc.ask.market'), to: 'market' },
            { text: t('npc.ask.target'), to: 'target', if: !isTarget },
            { text: t('npc.ask.bye'), to: 'bye' },
        ]

        return {
            greet: {
                lines: isTarget && state.pet
                    ? [ t('npc.greetingTarget', { pet: state.pet.name }) ]
                    : [ t('npc.greeting', { career: name }), pick(career.summary) ],
                choices: menu,
            },
            about: {
                lines: [ t('npc.about', { skills: list(career.match.skills.map((skill) => `${this.skillName(skill.id)} (${t(`level.${skill.required}`)})`)) }) ],
                choices: menu,
            },
            fit: {
                lines: [ !state.profile.skills.length ? t('npc.fitNoProfile') : gaps.length ? t('npc.fit', { p: career.match.percent, gaps: list(gaps) }) : t('npc.fitNone', { p: career.match.percent }) ],
                choices: state.profile.skills.length ? menu : [ { text: t('menu.profile'), action: () => this.openPanel('profile') }, ...menu ],
            },
            market: {
                lines: [ t('npc.market', { p: career.market.heat, trend: t(`careers.trend.${career.market.trend}`), range }) ],
                choices: menu,
            },
            target: {
                lines: [ t('npc.target', { pet: career.pet.name }) ],
                choices: [
                    { text: t('mode.general'), action: () => this.openPanel('careers', { careerId, mode: 'general' }) },
                    { text: t('mode.customise'), action: () => this.openPanel('careers', { careerId, mode: 'customise' }) },
                    { text: t('common.back'), to: 'greet' },
                ],
            },
            bye: {
                lines: [ t('npc.bye') ],
                choices: [],
            },
        }
    }

    currentNode()
    {
        return this.dialogueGraph(this.dialogue.careerId)[this.dialogue.node]
    }

    currentChoices()
    {
        return this.currentNode().choices.filter((choice) => choice.if !== false)
    }

    isLastPage()
    {
        return this.dialogue.page >= this.currentNode().lines.length - 1
    }

    choose(index)
    {
        const choice = this.currentChoices()[index]
        if(!choice || this.dialogue.typing)
            return
        if(choice.action)
            return choice.action()
        this.dialogue.node = choice.to
        this.dialogue.page = 0
        this.dialogue.selected = 0
        this.renderDialogue()
    }

    /**
     * Enter / Space / click on the box: finish the typing, next page, pick the choice, or leave after the last line
     */
    advanceDialogue()
    {
        const dialogue = this.dialogue
        if(!dialogue || performance.now() - dialogue.openedAt < 250) // ignore the key press that opened it
            return

        if(dialogue.typing)
            return this.finishTyping()

        if(!this.isLastPage())
        {
            dialogue.page++
            return this.renderDialogue()
        }

        if(this.currentChoices().length)
            this.choose(dialogue.selected)
        else
            this.closeDialogue()
    }

    moveChoice(step)
    {
        const count = this.currentChoices().length
        if(!count || this.dialogue.typing || !this.isLastPage())
            return
        this.dialogue.selected = (this.dialogue.selected + step + count) % count
        this.highlightChoice()
    }

    highlightChoice()
    {
        // Highlight only: a focused button would also react to Enter / Space natively and pick the choice twice
        this.dialogueElement.querySelectorAll('.career-dialogue-choices button').forEach((button, index) =>
        {
            const selected = index === this.dialogue.selected
            button.classList.toggle('is-selected', selected)
            button.setAttribute('aria-current', selected ? 'true' : 'false')
        })
    }

    finishTyping()
    {
        clearInterval(this.typingInterval)
        this.dialogue.typing = false
        this.dialogueElement.querySelector('.career-dialogue-line').textContent = this.typingText
        this.dialogueElement.classList.add('is-typed')
        const showChoices = this.isLastPage() && this.currentChoices().length > 0
        this.dialogueElement.classList.toggle('has-choices', showChoices)
        if(showChoices)
            this.highlightChoice()
    }

    renderDialogue()
    {
        if(!this.dialogue || !this.state)
            return

        // Only rebuild when the page changes, so state updates don't restart the typing
        const key = `${this.dialogue.node}:${this.dialogue.page}`
        if(this.dialogue.rendered === key)
            return
        this.dialogue.rendered = key

        const career = this.state.careers.find((item) => item.id === this.dialogue.careerId)
        const node = this.currentNode()
        const choices = this.isLastPage() ? this.currentChoices() : []

        this.dialogueElement.style.setProperty('--career', career.color)
        this.dialogueElement.classList.remove('is-typed', 'has-choices')
        this.dialogueElement.innerHTML = `
            <div class="career-dialogue-choices" role="menu">
                ${choices.map((choice, index) => `<button role="menuitem" data-action="choice" data-index="${index}">${esc(choice.text)}</button>`).join('')}
            </div>
            <div class="career-dialogue-box" data-action="dialogue-advance">
                <div class="career-dialogue-name">${esc(t('npc.leader', { career: pick(career.name) }))}</div>
                <p class="career-dialogue-line" aria-live="polite"></p>
                <svg class="career-dialogue-next" viewBox="0 0 24 24" role="img" aria-label="${esc(t('npc.continue'))}"><path d="M5 9l7 7 7-7"/></svg>
            </div>
        `

        // Type the line out
        clearInterval(this.typingInterval)
        this.typingText = node.lines[this.dialogue.page]
        const characters = [ ...this.typingText ]
        const line = this.dialogueElement.querySelector('.career-dialogue-line')
        let index = 0
        this.dialogue.typing = true
        this.typingInterval = setInterval(() =>
        {
            index += 1
            line.textContent = characters.slice(0, index).join('')
            if(index >= characters.length)
                this.finishTyping()
        }, getLang() === 'zh' ? 40 : 18)
    }
}
