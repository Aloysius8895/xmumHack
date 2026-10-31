import { pick, t } from './i18n.js'

const TYPING_SPEED = 22 // ms per character

const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

// Wisp, the wizard ghost (original drawing): round body with a curled tail, starry hat, happy closed eyes
// Animated cursor tapping the element to press
const POINTER = /* html */`
<svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M7 3l18 12-8 1.5 4.5 9-3.5 1.7-4.5-9L7 24z"/>
</svg>`

const GHOST = /* html */`
<svg viewBox="0 0 120 130" aria-hidden="true">
    <path class="career-tour-ghost-body" d="M60 38c-24 0-40 17-40 40 0 14 4 25 10 32 4 5 10 5 14 1 3 4 9 5 13 1 4 4 11 4 15-1 5 4 13 4 18-3 7 3 15 1 18-6-6-1-10-6-10-12 2-25-13-52-38-52z"/>
    <path class="career-tour-ghost-arm" d="M22 82c-7 1-12-3-12-8 6 0 10 2 13 4z"/>
    <path class="career-tour-ghost-arm" d="M97 78c7-3 13-1 14 4-6 2-10 2-14 0z"/>
    <path class="career-tour-ghost-eye" d="M42 74q5-6 10 0M66 74q5-6 10 0"/>
    <ellipse class="career-tour-ghost-blush" cx="40" cy="83" rx="5" ry="3"/>
    <ellipse class="career-tour-ghost-blush" cx="80" cy="83" rx="5" ry="3"/>
    <path class="career-tour-ghost-mouth" d="M54 84q5 5 10 0"/>
    <ellipse class="career-tour-ghost-hat" cx="60" cy="41" rx="31" ry="6.5"/>
    <path class="career-tour-ghost-hat" d="M41 40Q49 22 57 7Q60 1 64 6Q72 22 79 40Z"/>
    <path class="career-tour-ghost-band" d="M43 35Q60 40 77 35L79 40Q60 45 41 40Z"/>
    <path class="career-tour-ghost-star" d="M60 15l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"/>
    <path class="career-tour-ghost-star" d="M68 27l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.2-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>
    <circle class="career-tour-ghost-star" cx="52" cy="29" r="1.8"/>
</svg>`

/**
 * Guided tour: Wisp talks the player through one real round of the system (profile > career goal > pet > roadmap
 * > log). A step's lines are typed out, then the tour waits until the step is really done (panel opened, state
 * changed): the rest of the screen dims, a spotlight and a tapping cursor show what to press and Wisp floats next
 * to it. Uses the real save; AI calls run on demo data meanwhile.
 */
export class CareerTour
{
    constructor(api, ui)
    {
        this.api = api
        this.ui = ui
        this.active = false
        this.autoStartHandled = false
        this.newUser = false // Set by the intro username step (CharacterSelect.signIn): first time the server sees the name
        this.panel = null

        // say: string ids typed one page each; target: menu button that glows; focus: elements to spotlight while
        // waiting (the cursor taps the last one); until: the step is done; done: line said once it is;
        // enter: runs when the step starts
        const panel = (selector) => () => [ ...this.ui.panelElement.querySelectorAll(selector) ]
        const careerDetail = panel('.career-modes, [data-action="set-target"]')
        this.steps = [
            { say: [ 'tour.intro.1', 'tour.intro.2', 'tour.intro.3' ] },
            { say: [ 'tour.profile.open' ], target: 'profile', until: () => this.panel === 'profile' },
            { say: [ 'tour.profile.fill' ], focus: panel('textarea[data-draft="profile"], [data-action="extract"]'), until: (state) => state.profile.skills.length > 0, done: 'tour.profile.done' },
            { say: [ 'tour.careers.open' ], target: 'careers', until: () => this.panel === 'careers' },
            { say: [ 'tour.careers.pick' ], focus: () => careerDetail().length ? careerDetail() : panel('.career-search')(), until: (state) => Boolean(state.target && state.pet), done: 'tour.careers.done' },
            { say: [ 'tour.pet.open' ], target: 'pet', until: () => this.panel === 'pet' },
            { say: [ 'tour.pet.explain' ] },
            { say: [ 'tour.roadmap.open' ], target: 'roadmap', until: () => this.panel === 'roadmap' },
            { say: [ 'tour.roadmap.generate' ], focus: panel('[data-action="roadmap"]'), until: (state) => Boolean(state.roadmap) },
            { say: [ 'tour.roadmap.explain' ] },
            { say: [ 'tour.log.open' ], target: 'log', until: () => this.panel === 'log' },
            { say: [ 'tour.log.write' ], focus: panel('textarea[data-draft="log"], [data-action="log"]'), until: (state) => this.newLogs(state).some((log) => log.advanced.length > 0), retry: (state) => this.newLogs(state)[0]?.id ?? null, done: 'tour.log.done', enter: (state) => { this.lastLogId = state?.logs[0]?.id ?? null } },
            { say: [ 'tour.outro.1', 'tour.outro.2' ] },
        ]
        for(const step of this.steps)
            if(step.target && !step.focus)
                step.focus = () => this.railItem(step.target)

        this.update = this.update.bind(this)

        this.setElement()

        this.api.events.on('state', () =>
        {
            this.maybeStart()
            this.check()
        })
        this.ui.events.on('panel', (name) =>
        {
            this.panel = name
            this.check()
        })
    }

    // Logs written since the log step started (newest first, the state only keeps the latest 30)
    newLogs(state)
    {
        const index = state.logs.findIndex((log) => log.id === this.lastLogId)
        return index === -1 ? state.logs : state.logs.slice(0, index)
    }

    railItem(name)
    {
        return [ ...this.ui.root.querySelectorAll(`.career-rail-item[data-panel="${name}"]`) ]
    }

    setElement()
    {
        // The world a shade darker for the whole tour, under every UI element (first child of the UI)
        this.dim = document.createElement('div')
        this.dim.className = 'career-tour-dim'
        this.ui.root.prepend(this.dim)

        // Dimmed screen with a hole on the element to press (pointer events go through), and the tapping cursor
        this.spot = document.createElement('div')
        this.spot.className = 'career-tour-spot'
        this.ui.root.appendChild(this.spot)

        this.pointer = document.createElement('div')
        this.pointer.className = 'career-tour-pointer'
        this.pointer.innerHTML = POINTER
        this.ui.root.appendChild(this.pointer)

        this.element = document.createElement('div')
        this.element.className = 'career-tour'
        this.element.setAttribute('role', 'dialog')
        this.element.setAttribute('aria-labelledby', 'career-tour-name')
        this.element.innerHTML = /* html */`
            <div class="career-tour-ghost">${GHOST}</div>
            <div class="career-tour-box">
                <div id="career-tour-name" class="career-tour-name js-name"></div>
                <p class="career-tour-text js-text" aria-live="polite"></p>
                <div class="career-tour-footer">
                    <span class="career-tour-progress js-progress"></span>
                    <span class="career-tour-waiting js-waiting"></span>
                    <button type="button" class="career-tour-skip js-skip"></button>
                    <div class="career-tour-action">
                        <button type="button" class="career-tour-next js-next"></button>
                        <kbd class="career-key-hint js-enter-hint"></kbd>
                    </div>
                </div>
            </div>
        `
        this.ui.root.appendChild(this.element)

        this.elements = {
            name: this.element.querySelector('.js-name'),
            text: this.element.querySelector('.js-text'),
            progress: this.element.querySelector('.js-progress'),
            waiting: this.element.querySelector('.js-waiting'),
            skip: this.element.querySelector('.js-skip'),
            next: this.element.querySelector('.js-next'),
            enterHint: this.element.querySelector('.js-enter-hint'),
        }

        this.elements.skip.addEventListener('click', () => this.finish())
        this.elements.next.addEventListener('click', () => this.next())
        this.elements.text.addEventListener('click', () => this.typing ? this.stopTyping() : null)

        // Enter = Next. Capture phase so the game doesn't also read it as "interact", and preventDefault so a focused Next button isn't clicked twice
        addEventListener('keydown', (event) =>
        {
            if(!this.active || this.waiting || this.ui.dialogue || (event.code !== 'Enter' && event.code !== 'NumpadEnter'))
                return
            if(event.target.closest?.('input, textarea, select, [contenteditable]'))
                return
            event.preventDefault()
            event.stopImmediatePropagation()
            if(!event.repeat)
                this.next()
        }, true)
    }

    get state()
    {
        return this.api.state
    }

    // New users only. The reveal and initial API request can finish in either order.
    maybeStart()
    {
        if(this.autoStartHandled || this.active || !this.state || this.ui.game.reveal?.step !== 2)
            return

        this.autoStartHandled = true
        if(this.newUser)
            this.start()
    }

    start()
    {
        if(this.active)
            return

        this.autoStartHandled = true
        this.active = true
        this.originalPanelPadding = this.ui.panelBody.style.paddingBottom
        this.ui.root.classList.add('is-touring')
        this.api.demo = true
        // The world is frozen for the whole tour (no walking, no camera drag / zoom), the menu and panels still work
        this.ui.touring = true
        this.ui.takeInputs()
        this.panel = this.ui.panel?.name ?? null
        this.element.classList.add('is-visible')
        this.dim.classList.add('is-visible')
        this.go(0)
        requestAnimationFrame(this.update)
    }

    finish()
    {
        if(!this.active)
            return

        this.active = false
        this.ui.panelBody.style.paddingBottom = this.originalPanelPadding
        this.ui.root.classList.remove('is-touring')
        this.api.demo = false
        this.ui.touring = false
        this.ui.releaseInputs()
        this.stopTyping()
        delete this.ui.root.dataset.tourTarget
        this.element.classList.remove('is-visible', 'is-placed')
        this.dim.classList.remove('is-visible')
        this.spot.classList.remove('is-visible')
        this.pointer.classList.remove('is-visible')
        this.focused = null
    }

    go(index)
    {
        if(index >= this.steps.length)
            return this.finish()

        this.index = index
        this.step = this.steps[index]
        this.lines = [ ...this.step.say ]
        this.page = 0
        this.waiting = false
        this.saidDone = false
        this.step.enter?.(this.state)
        this.render()
    }

    next()
    {
        if(this.typing)
            return this.stopTyping()

        if(this.page < this.lines.length - 1)
        {
            this.page++
            return this.render()
        }

        // Last line of a step that waits: nothing to press, the step completes by itself
        if(this.waiting)
            return

        this.go(this.index + 1)
    }

    // Is the step being waited on done? Then say the done line (if any) or move on
    check()
    {
        if(!this.active || !this.waiting || !this.state)
            return
        if(!this.step.until(this.state))
        {
            // A try that didn't count (e.g. a log with no learning in it): Wisp says so once per try, still waiting
            const attempt = this.step.retry?.(this.state)
            if(attempt && attempt !== this.retried)
            {
                this.retried = attempt
                this.lines.push('tour.log.retry')
                this.page = this.lines.length - 1
                this.render()
            }
            return
        }

        this.waiting = false
        delete this.ui.root.dataset.tourTarget

        if(this.step.done)
        {
            this.lines.push(this.step.done)
            this.page = this.lines.length - 1
            this.saidDone = true
            this.render()
        }
        else
            this.go(this.index + 1)
    }

    vars()
    {
        const state = this.state
        const career = state?.careers.find((item) => item.id === state.target?.careerId)
        const task = state?.roadmap?.stages.flatMap((stage) => stage.tasks).find((item) => item.skillId && !item.done)
        const skillId = task?.skillId ?? career?.match.skills.find((skill) => skill.gap > 0)?.id ?? career?.match.skills[0]?.id
        return {
            pet: state?.pet?.name ?? (career ? career.pet.name : ''),
            career: career ? pick(career.name) : '',
            skill: skillId ? this.ui.skillName(skillId, skillId) : 'Python',
        }
    }

    render()
    {
        const isLastPage = this.page === this.lines.length - 1
        const isLastStep = this.index === this.steps.length - 1
        this.waiting = isLastPage && Boolean(this.step.until) && !this.saidDone

        if(this.waiting && this.step.target)
            this.ui.root.dataset.tourTarget = this.step.target
        else
            delete this.ui.root.dataset.tourTarget

        this.elements.name.textContent = t('tour.ghost')
        this.elements.progress.textContent = `${this.index + 1} / ${this.steps.length}`
        this.elements.skip.textContent = t('tutorial.skip')
        this.elements.skip.hidden = isLastStep
        this.elements.next.textContent = isLastStep && isLastPage ? t('tutorial.finish') : t('tutorial.next')
        this.elements.next.hidden = this.waiting
        this.elements.enterHint.textContent = t('hint.pressEnter')
        this.elements.enterHint.hidden = this.waiting
        this.elements.waiting.textContent = this.waiting ? t('tutorial.waiting') : ''
        this.elements.waiting.hidden = !this.waiting
        this.element.classList.toggle('is-waiting', this.waiting)

        this.type(t(this.lines[this.page], this.vars()))

        // Already done when the step starts (e.g. skills saved before): continue right away
        if(this.waiting)
            this.check()
    }

    /**
     * Every frame while active: follow the element to press (panels slide, re-render, scroll), spotlight it,
     * put the cursor on it and Wisp next to it. Nothing to press: no dim, Wisp back in the bottom left corner
     */
    update()
    {
        if(!this.active)
            return
        requestAnimationFrame(this.update)

        const elements = this.waiting && this.step.focus ? this.step.focus().filter((element) => element.offsetParent !== null) : []
        if(!elements.length)
        {
            this.ui.panelBody.style.paddingBottom = this.originalPanelPadding
            this.focused = null
            this.spot.classList.remove('is-visible')
            this.pointer.classList.remove('is-visible')
            this.element.classList.remove('is-placed')
            this.element.style.left = this.element.style.top = ''
            return
        }

        // New element to press: bring it into view in its panel
        const last = elements[elements.length - 1]
        if(this.focused !== last)
        {
            this.focused = last
            last.scrollIntoView({ block: 'nearest', behavior: innerWidth <= 720 ? 'auto' : 'smooth' })
        }

        // Spotlight around all of them
        const rects = elements.map((element) => element.getBoundingClientRect())
        const padding = 8
        const box = {
            left: Math.min(...rects.map((rect) => rect.left)) - padding,
            top: Math.min(...rects.map((rect) => rect.top)) - padding,
            right: Math.max(...rects.map((rect) => rect.right)) + padding,
            bottom: Math.max(...rects.map((rect) => rect.bottom)) + padding,
        }
        Object.assign(this.spot.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.right - box.left}px`, height: `${box.bottom - box.top}px` })
        this.spot.classList.add('is-visible')

        // Cursor on the last one (the button)
        const target = rects[rects.length - 1]
        this.pointer.style.transform = `translate(${target.left + target.width * 0.6}px, ${target.top + target.height * 0.55}px)`
        this.pointer.classList.add('is-visible')

        // Wisp: left of an element in the side panel, otherwise under it (above when there is no room), kept on screen
        const width = this.element.offsetWidth
        const height = this.element.offsetHeight
        const margin = 16
        const inPanel = this.ui.panelElement.contains(last) && !last.classList.contains('career-close')
        const narrowPanel = inPanel && (innerWidth <= 720 || this.ui.root.classList.contains('is-building-view'))
        this.ui.panelBody.style.paddingBottom = narrowPanel ? `${height + margin}px` : this.originalPanelPadding
        let x
        let y
        if(narrowPanel)
        {
            x = margin
            y = innerHeight - height - margin
            // Reserve room for Wisp and keep the form action reachable above the dialogue.
            const overlap = last.getBoundingClientRect().bottom + margin - y
            if(overlap > 1)
                this.ui.panelBody.scrollTop += overlap
        }
        else if(inPanel)
        {
            x = this.ui.panelElement.getBoundingClientRect().left - width - margin
            y = (box.top + box.bottom) / 2 - height / 2
        }
        else
        {
            x = (box.left + box.right) / 2 - width / 2
            y = box.bottom + margin + 24
            if(y + height > innerHeight - margin)
                y = box.top - height - margin
        }
        x = Math.max(margin, Math.min(innerWidth - width - margin, x))
        y = Math.max(margin, Math.min(innerHeight - height - margin, y))
        this.element.style.left = `${x}px`
        this.element.style.top = `${y}px`
        this.element.classList.add('is-placed')
    }

    type(text)
    {
        this.stopTyping()
        this.fullText = text
        this.typing = true
        let length = 0
        this.typingInterval = setInterval(() =>
        {
            length++
            this.elements.text.textContent = text.slice(0, length)
            if(length >= text.length)
                this.stopTyping()
        }, TYPING_SPEED)
    }

    stopTyping()
    {
        clearInterval(this.typingInterval)
        if(this.typing)
            this.elements.text.textContent = this.fullText
        this.typing = false
    }
}
