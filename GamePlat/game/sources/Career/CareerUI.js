import { Game } from '../Game/Game.js'
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
    gym: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4M12 13v4m-4 3h8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/>',
}

const MENU = [ 'profile', 'careers', 'pet', 'roadmap', 'log', 'gym', 'settings' ]

function esc(value)
{
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

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
        this.lastGymResult = null
        this.notice = null          // { type: 'error' | 'info', text } shown in the open panel
        this.ownsInputs = false

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
            <div class="career-hud js-career-hud"></div>
            <nav class="career-rail js-career-rail" aria-label="${esc(t('app.title'))}"></nav>
            <section class="career-panel js-career-panel" aria-hidden="true">
                <header class="career-panel-header">
                    <h2 class="js-career-panel-title"></h2>
                    <button class="career-close" data-action="close" aria-label="${esc(t('common.close'))}">×</button>
                </header>
                <div class="career-panel-body js-career-panel-body"></div>
            </section>
            <section class="career-dialogue js-career-dialogue" aria-hidden="true"></section>
            <div class="career-busy">${esc(t('common.loading'))}</div>
        `
        this.game.domElement.appendChild(this.root)

        this.hud = this.root.querySelector('.js-career-hud')
        this.rail = this.root.querySelector('.js-career-rail')
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
            if(target)
                this.action(target.dataset.action, target.dataset, target)
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
                this.run(() => this.api.setTaskDone(input.dataset.task, input.checked))
            if(input.dataset.lang)
                this.changeLang(input.value)
        })

        addEventListener('keydown', (event) =>
        {
            if(event.code !== 'Escape')
                return
            if(this.dialogue)
                this.closeDialogue()
            else if(this.panel)
                this.closePanel()
        })
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
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('career')
    }

    releaseInputs()
    {
        if(!this.ownsInputs || this.panel || this.dialogue)
            return
        this.ownsInputs = false
        this.root.classList.remove('is-overlay')
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('wandering')
    }

    openPanel(name, options = {})
    {
        this.closeDialogue(false)
        this.panel = { name, ...options }
        this.notice = null
        this.panelElement.classList.add('is-open')
        this.panelElement.setAttribute('aria-hidden', 'false')
        this.takeInputs()
        this.render()
        this.panelElement.querySelector('textarea, input, button:not(.career-close)')?.focus({ preventScroll: true })
    }

    closePanel()
    {
        this.panel = null
        this.panelElement.classList.remove('is-open')
        this.panelElement.setAttribute('aria-hidden', 'true')
        this.render()
        this.releaseInputs()
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
    }

    action(name, data, element)
    {
        switch(name)
        {
            case 'close': return this.closePanel()
            case 'menu': return this.panel?.name === data.panel ? this.closePanel() : this.openPanel(data.panel)
            case 'next': return this.openPanel(data.panel)
            case 'extract': return this.extractProfile()
            case 'skill-remove': return this.updateSkill(Number(data.index), null)
            case 'skill-add': return this.addSkill()
            case 'career': return this.openPanel('careers', { careerId: data.career })
            case 'careers-back': return this.openPanel('careers')
            case 'mode': this.panel.mode = data.mode; return this.renderPanel()
            case 'set-target': return this.setTarget()
            case 'file-remove': delete this.files[data.file]; return this.renderPanel()
            case 'roadmap': return this.generateRoadmap(data.confirm === '1')
            case 'log': return this.submitLog()
            case 'gym-start': return this.startGym(data.stage)
            case 'gym-submit': return this.submitGym()
            case 'gym-abandon': return this.run(() => this.api.abandonGym(data.challenge))
            case 'gym-clear': this.lastGymResult = null; return this.renderPanel()
            case 'reset': return this.reset()
            case 'choice': return this.choose(Number(data.index))
            case 'dialogue-close': return this.closeDialogue()
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

    async startGym(stageId)
    {
        this.lastGymResult = null
        if(this.panel?.name !== 'gym')
            this.openPanel('gym')
        await this.run(() => this.api.startGym(stageId))
    }

    async submitGym()
    {
        const challenge = this.state.activeChallenge
        const answers = challenge.questions.map((_, index) => this.drafts[`gym-${challenge.id}-${index}`] ?? '')
        await this.run(() => this.api.submitGym(challenge.id, answers), (result) =>
        {
            this.lastGymResult = { ...result.result, stageId: challenge.stageId, questions: challenge.questions }
            this.renderPanel()
            if(result.result.passed)
                this.game.career.world.celebratePet()
        })
    }

    async reset()
    {
        if(!confirm(t('settings.resetConfirm')))
            return
        this.drafts = {}
        this.files = {}
        this.lastGymResult = null
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
        const ready = state.roadmap.stages.find((stage) => stage.gymReady)
        if(ready)
            return { text: t('next.gym', { stage: ready.title }), panel: 'gym', highlight: true }
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
                <span class="career-points">★ ${esc(state.points)} <small>${esc(t('hud.points'))}</small></span>
                ${aiBadge}
            </div>
            <button class="career-next ${next.highlight ? 'is-highlight' : ''}" data-action="next" data-panel="${next.panel}">
                <small>${esc(t('hud.next'))}</small>${esc(next.text)}
            </button>
        `
    }

    renderRail()
    {
        const gymReady = this.state.roadmap?.stages.some((stage) => stage.gymReady) || Boolean(this.state.activeChallenge)
        this.rail.innerHTML = MENU.map((name) => `
            <button class="career-rail-item ${this.panel?.name === name ? 'is-active' : ''} ${name === 'gym' && gymReady ? 'has-dot' : ''}" data-action="menu" data-panel="${name}" title="${esc(t(`menu.${name}`))}">
                ${icon(name)}<span>${esc(t(`menu.${name}`))}</span>
            </button>
        `).join('')
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
            gym: () => this.renderGym(),
            settings: () => this.renderSettings(),
        }
        const [ title, body ] = renderers[this.panel.name]()
        const notice = this.notice ? `<p class="career-notice is-${this.notice.type}" role="status">${esc(this.notice.text)}</p>` : ''

        this.panelTitle.textContent = title
        this.panelBody.innerHTML = notice + body
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
        return `<span class="career-tag">${esc(t(`careers.demand.${career.market.demand}`))}</span><span class="career-tag">${esc(t(`careers.trend.${career.market.trend}`))}</span>`
    }

    renderCareers()
    {
        const careers = [ ...this.state.careers ].sort((a, b) => b.match.percent - a.match.percent)
        return [ t('careers.title'), `
            <p>${esc(t('careers.intro'))}</p>
            <div class="career-cards">
                ${careers.map((career) => `
                    <button class="career-card" data-action="career" data-career="${career.id}" style="--career:${career.color}">
                        <span class="career-card-top">
                            <strong>${esc(pick(career.name))}</strong>
                            ${this.state.target?.careerId === career.id ? `<span class="career-tag is-target">${esc(t('careers.current'))}</span>` : ''}
                        </span>
                        <small>${esc(pick(career.summary))}</small>
                        <span class="career-card-match">${bar(career.match.percent)}<em>${esc(t('careers.match', { p: career.match.percent }))}</em></span>
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

        const requirements = career.match.skills.map((skill) => `
            <li class="${skill.gap ? 'has-gap' : 'is-met'}">
                <span>${esc(this.skillName(skill.id))}</span>
                ${bar(Math.min(skill.current, skill.required) / skill.required * 100)}
                <small>${esc(t('careers.yours', { c: t(`level.${skill.current}`) }))} / ${esc(t('careers.required', { r: t(`level.${skill.required}`) }))}</small>
            </li>`).join('')

        const posting = isTarget && this.state.target.posting ? this.renderPosting(this.state.target.posting) : ''

        const switching = this.state.target && !isTarget ? `<p class="career-notice is-warning">${esc(t('mode.switchWarning'))}</p>` : ''

        return [ pick(career.name), `
            <button class="career-link" data-action="careers-back">← ${esc(t('common.back'))}</button>
            <p>${esc(pick(career.summary))}</p>
            <p>${this.marketBadges(career)} <span class="career-tag">${esc(t('careers.pet', { name: career.pet.name }))}</span></p>
            <p class="career-muted">${esc(t('careers.effort', { range }))} · ${esc(t('careers.marketNote'))}</p>
            <h3>${esc(t('careers.requirements'))} · ${esc(t('careers.match', { p: career.match.percent }))}</h3>
            <ul class="career-requirements">${requirements}</ul>
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
            <ul class="career-pet-skills">${pet.skills.map((skill) => `
                <li>
                    <span>${esc(this.skillName(skill.id))}${skill.verified ? ` <span class="career-tag is-verified">✓ ${esc(t('pet.verified'))}</span>` : ''}</span>
                    ${bar(skill.progress)}
                </li>`).join('')}
            </ul>
        ` ]
    }

    renderRoadmap()
    {
        const state = this.state
        if(!state.target)
            return [ t('roadmap.title'), `<p>${esc(t('roadmap.noTarget'))}</p><button class="career-button" data-action="menu" data-panel="careers">${esc(t('menu.careers'))}</button>` ]
        if(!state.roadmap)
            return [ t('roadmap.title'), `<p>${esc(t('roadmap.intro'))}</p><button class="career-button is-wide" data-action="roadmap">${esc(t('roadmap.generate'))}</button>` ]

        const stageTitle = (id) => state.roadmap.stages.find((stage) => stage.id === id)?.title ?? id
        const stages = state.roadmap.stages.map((stage, index) => `
            <article class="career-stage is-${stage.status}">
                <header>
                    <span class="career-stage-index">${esc(t('roadmap.stage', { n: index + 1 }))}</span>
                    <strong>${esc(stage.title)}</strong>
                    <span class="career-tag">${esc(t(`roadmap.status.${stage.status}`))}</span>
                    <span class="career-tag is-mp">${esc(t('roadmap.mp', { n: stage.mp }))}</span>
                </header>
                ${bar(stage.progress)}
                <p><small>${esc(t('roadmap.why'))}</small> ${esc(stage.why)}</p>
                ${stage.requirementRefs.length ? `<p class="career-muted">${esc(t('roadmap.covers', { refs: stage.requirementRefs.join(', ') }))}</p>` : ''}
                ${stage.prerequisites.length ? `<p class="career-muted">${esc(t('roadmap.needs', { stages: stage.prerequisites.map(stageTitle).join(', ') }))}</p>` : ''}
                <ul class="career-tasks">${stage.tasks.map((task) => `
                    <li>
                        <label>
                            <input type="checkbox" data-task="${task.id}" ${task.progress >= 100 ? 'checked' : ''} ${stage.status === 'locked' ? 'disabled' : ''}>
                            <span>${esc(task.title)}<small>${esc(task.why)}</small></span>
                        </label>
                        <span class="career-tag is-mp">${esc(t('roadmap.mp', { n: task.mp }))}</span>
                        ${bar(task.progress, 'is-thin')}
                    </li>`).join('')}
                </ul>
                <footer>
                    <span>${esc(t('roadmap.challenge', { topic: stage.challenge.topic }))}</span>
                    ${stage.gymReady
                        ? `<button class="career-button" data-action="gym-start" data-stage="${stage.id}">${esc(t('roadmap.goGym'))}</button>`
                        : stage.status === 'cleared' ? '' : `<small class="career-muted">${esc(t('roadmap.gymLocked', { p: state.rules.gymUnlockProgress }))}</small>`}
                </footer>
            </article>`).join('')

        return [ t('roadmap.title'), `
            <p>${esc(state.roadmap.overview)}</p>
            <p class="career-muted">${esc(t('roadmap.intro'))} ${esc(t('roadmap.mpNote'))}</p>
            ${stages}
            <button class="career-button is-secondary" data-action="roadmap" data-confirm="1">${esc(t('roadmap.regenerate'))}</button>
        ` ]
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

    renderGym()
    {
        const state = this.state
        const challenge = state.activeChallenge
        const intro = `<p>${esc(t('gym.intro'))}</p>`
        const disclaimer = `<p class="career-muted">${esc(t('gym.disclaimer'))}</p>`

        if(challenge)
        {
            const stage = state.roadmap?.stages.find((item) => item.id === challenge.stageId)
            return [ t('gym.title'), `
                <h3>${esc(t('roadmap.challenge', { topic: stage?.challenge.topic ?? '' }))}</h3>
                <ol class="career-questions">${challenge.questions.map((question, index) => `
                    <li>
                        <span class="career-tag">${esc(t('gym.question', { n: index + 1 }))} · ${esc(t(`gym.kind.${question.kind}`))}</span>
                        <p>${esc(question.question)}</p>
                        <textarea data-draft="gym-${challenge.id}-${index}" rows="4" placeholder="${esc(t('gym.answerPlaceholder'))}">${esc(this.drafts[`gym-${challenge.id}-${index}`] ?? '')}</textarea>
                    </li>`).join('')}
                </ol>
                <button class="career-button is-wide" data-action="gym-submit">${esc(t('gym.submit'))}</button>
                <button class="career-link" data-action="gym-abandon" data-challenge="${challenge.id}">${esc(t('gym.abandon'))}</button>
                ${disclaimer}
            ` ]
        }

        if(this.lastGymResult)
        {
            const result = this.lastGymResult
            return [ t('gym.title'), `
                <div class="career-result ${result.passed ? 'is-passed' : 'is-failed'}">
                    <strong>${esc(result.passed ? t('gym.passed') : t('gym.failed'))}</strong>
                    <span>${esc(t('gym.score', { n: result.average, pass: state.rules.passAverage }))}</span>
                    ${result.firstClear ? `<span>${esc(t('gym.rewards', { a: result.affinity, p: result.points }))}</span>` : result.passed ? `<span>${esc(t('gym.alreadyCleared'))}</span>` : ''}
                </div>
                <p>${esc(result.summary)}</p>
                <ol class="career-questions">${result.questions.map((question, index) => `
                    <li>
                        <span class="career-tag">${esc(t('gym.question', { n: index + 1 }))} · ${esc(result.scores[index])}/100</span>
                        <p>${esc(question.question)}</p>
                        <p class="career-muted">${esc(result.feedback[index].feedback)}</p>
                        ${result.feedback[index].missing.length ? `<small>${esc(t('gym.missing', { points: result.feedback[index].missing.join('; ') }))}</small>` : ''}
                    </li>`).join('')}
                </ol>
                ${result.reviewTopics.length ? `<h3>${esc(t('gym.review'))}</h3><ul>${result.reviewTopics.map((topic) => `<li>${esc(topic)}</li>`).join('')}</ul>` : ''}
                ${result.passed ? '' : `<p>${esc(t('gym.retryLater'))}</p>`}
                <button class="career-button is-secondary" data-action="gym-clear">${esc(t('common.back'))}</button>
                ${disclaimer}
            ` ]
        }

        const ready = state.roadmap?.stages.filter((stage) => stage.gymReady) ?? []
        return [ t('gym.title'), `
            ${intro}
            ${ready.length
                ? ready.map((stage) => `<button class="career-button is-wide" data-action="gym-start" data-stage="${stage.id}">${esc(t('gym.start', { topic: stage.challenge.topic }))}</button>`).join('')
                : `<p class="career-notice is-warning">${esc(t('gym.none', { p: state.rules.gymUnlockProgress }))}</p>`}
            ${disclaimer}
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
     * NPC dialogue (skills/game/dialogue-systems): a small graph of nodes { line, choices, action }, choices gated
     * by conditions on the state, every text from the string table
     */
    openDialogue(careerId)
    {
        if(!this.state)
            return
        this.closePanel()
        this.dialogue = { careerId, node: 'greet' }
        this.dialogueElement.classList.add('is-open')
        this.dialogueElement.setAttribute('aria-hidden', 'false')
        this.takeInputs()
        this.renderDialogue()
        this.dialogueElement.querySelector('button')?.focus({ preventScroll: true })
    }

    closeDialogue(release = true)
    {
        if(!this.dialogue)
            return
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
        const ready = isTarget ? state.roadmap?.stages.find((stage) => stage.gymReady) : null
        const range = t('common.months', { a: career.effortMonths[0], b: career.effortMonths[1] })

        const menu = [
            { text: t('npc.ask.about'), to: 'about' },
            { text: t('npc.ask.fit'), to: 'fit' },
            { text: t('npc.ask.market'), to: 'market' },
            { text: t('npc.ask.target'), to: 'target', if: !isTarget },
            { text: t('npc.ask.gym'), to: 'gym' },
            { text: t('npc.ask.bye'), to: 'bye' },
        ]

        return {
            greet: {
                line: isTarget && state.pet ? t('npc.greetingTarget', { pet: state.pet.name }) : t('npc.greeting', { career: name, summary: pick(career.summary) }),
                choices: menu,
            },
            about: {
                line: t('npc.about', { skills: list(career.match.skills.map((skill) => `${this.skillName(skill.id)} (${t(`level.${skill.required}`)})`)) }),
                choices: menu,
            },
            fit: {
                line: !state.profile.skills.length ? t('npc.fitNoProfile') : gaps.length ? t('npc.fit', { p: career.match.percent, gaps: list(gaps) }) : t('npc.fitNone', { p: career.match.percent }),
                choices: state.profile.skills.length ? menu : [ { text: t('menu.profile'), action: () => this.openPanel('profile') }, ...menu ],
            },
            market: {
                line: t('npc.market', { demand: t(`careers.demand.${career.market.demand}`), trend: t(`careers.trend.${career.market.trend}`), range }),
                choices: menu,
            },
            target: {
                line: t('npc.target', { pet: career.pet.name }),
                choices: [
                    { text: t('mode.general'), action: () => this.openPanel('careers', { careerId, mode: 'general' }) },
                    { text: t('mode.customise'), action: () => this.openPanel('careers', { careerId, mode: 'customise' }) },
                    { text: t('common.back'), to: 'greet' },
                ],
            },
            gym: {
                line: !isTarget ? t('npc.gymNotTarget') : ready ? t('npc.gymReady', { stage: ready.title }) : t('npc.gymNotReady', { p: state.rules.gymUnlockProgress }),
                choices: ready
                    ? [ { text: t('gym.start', { topic: ready.challenge.topic }), action: () => this.startGym(ready.id) }, { text: t('common.back'), to: 'greet' } ]
                    : isTarget && state.roadmap ? [ { text: t('menu.roadmap'), action: () => this.openPanel('roadmap') }, ...menu ] : menu,
            },
            bye: {
                line: t('npc.bye'),
                choices: [ { text: t('common.close'), action: () => this.closeDialogue() } ],
            },
        }
    }

    currentChoices()
    {
        const node = this.dialogueGraph(this.dialogue.careerId)[this.dialogue.node]
        return node.choices.filter((choice) => choice.if !== false)
    }

    choose(index)
    {
        const choice = this.currentChoices()[index]
        if(!choice)
            return
        if(choice.action)
            return choice.action()
        this.dialogue.node = choice.to
        this.renderDialogue()
        this.dialogueElement.querySelector('button')?.focus({ preventScroll: true })
    }

    renderDialogue()
    {
        if(!this.dialogue || !this.state)
            return
        const career = this.state.careers.find((item) => item.id === this.dialogue.careerId)
        const node = this.dialogueGraph(this.dialogue.careerId)[this.dialogue.node]
        this.dialogueElement.innerHTML = `
            <div class="career-dialogue-speaker" style="--career:${career.color}">
                <span class="career-pet-avatar">${esc(pick(career.name).slice(0, 1))}</span>
                <strong>${esc(t('npc.leader', { career: pick(career.name) }))}</strong>
                <button class="career-close" data-action="dialogue-close" aria-label="${esc(t('common.close'))}">×</button>
            </div>
            <p class="career-dialogue-line">${esc(node.line)}</p>
            <div class="career-dialogue-choices">
                ${this.currentChoices().map((choice, index) => `<button data-action="choice" data-index="${index}">${esc(choice.text)}</button>`).join('')}
            </div>
        `
    }
}
