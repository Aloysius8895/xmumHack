import { Game } from '../Game/Game.js'
import { Events } from '../Game/Events.js'
import { CharacterSelect } from '../Game/CharacterSelect.js'
import { readFile } from './CareerApi.js'
import { LANGS, getLang, pick, setLang, t } from './i18n.js'
import { renderMarketHistory } from './MarketHistory.js'
import { marketMonthWindow } from './MarketWindow.js'
import { buildMarketRows } from './MarketSeries.js'
import { buildMockMarketHistory, buildMockSkillHistory } from './MockMarketHistory.js'
import { newCareerBadge, renderSamplingDiagnostics } from './MarketSampling.js'
import { renderMycolTimeline } from './OfficialRecord.js'
import { forecastOf, renderAssumptions, renderCardScore, renderScenarioBar, renderScoreBreakdown, renderSkillRadar } from './ScenarioView.js'
import { MAX_RANGE_MONTHS, chosenRange, limitRange, monthsBetween, referenceView, yearOnYearColumn, yearOnYearText } from './MarketReference.js'
import { collectNewSample } from './SampleRefresh.js'
import { travelToBuilding } from './BuildingTravel.js'
import { renderLearningPanel } from './LearningPanel.js'

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
    sdg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5m0 8v5M3 12h5m8 0h5M5.6 5.6l3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    market: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6Z"/><path d="M12 21a2.5 2.5 0 0 1-2.5-2.5c0-1.6 1.2-2.4 2.5-4 1.3 1.6 2.5 2.4 2.5 4A2.5 2.5 0 0 1 12 21Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/>',
    magnifier: '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>',
}

const MENU = [ 'profile', 'careers', 'market', 'pet', 'roadmap', 'sdg', 'log', 'leaderboard', 'settings' ]

// Files a mentor question can carry (the server checks them again, server/app.js FILE_TYPES, 10 MB)
const ASK_FILE_TYPES = 'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown'

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

// Market periods: a week (its Monday, YYYY-MM-DD) from the job market workflow, or a month (YYYY-MM) of the reference values
function isWeek(period)
{
    return /^\d{4}-\d{2}-\d{2}$/.test(String(period))
}

function periodLabel(period)
{
    const locale = getLang() === 'zh' ? 'zh-CN' : getLang()
    return isWeek(period)
        ? new Date(`${period}T00:00:00`).toLocaleString(locale, { month: 'short', day: 'numeric' })
        : new Date(`${period}-01T00:00:00`).toLocaleString(locale, { month: 'short' })
}

// "+5" / "-3" / "0", "—" when the change can't be computed (first week after backfilled ones)
function changeText(change)
{
    if(change === null || change === undefined)
        return '—'
    return `${change > 0 ? '+' : ''}${change}`
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
        this.events = new Events()  // 'panel' when a side panel opens or closes (CareerTour listens)

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
        this.api.events.on('busy', (busy) => this.setBusy(busy))

        // Window resize, and the UI showing up after the intro (display none until then, nothing to measure)
        new ResizeObserver(() =>
        {
            this.fitBar()
            const columns = this.root.clientWidth < 640 ? 2 : this.root.clientWidth < 1000 ? 3 : 4
            if(this.panel?.name === 'roadmap' && this.mapColumns && columns !== this.mapColumns)
                this.renderPanel()
        }).observe(this.root)
        document.fonts?.ready.then(() => this.fitBar())
    }

    /**
     * Top bar: centered in the room between the minimap and the HUD. Labels that don't fit beside the icons go under
     * them in small type, icons only when even that doesn't fit (label width depends on the language, a fixed
     * breakpoint can't tell)
     */
    fitBar()
    {
        if(!this.rail.children.length || !this.root.offsetWidth)
            return

        const gap = 16
        const minimap = this.root.querySelector('.career-minimap')
        const left = minimap ? minimap.offsetLeft + minimap.offsetWidth + gap : gap
        const right = this.menuElement.offsetLeft - gap
        const room = Math.max(0, right - left)

        this.menuElement.style.setProperty('--career-bar-center', `${(left + right) / 2}px`)
        this.menuElement.style.setProperty('--career-bar-room', `${room}px`)

        // Width with the labels, uncapped (the buttons shrink to their min-width under the room cap)
        this.menuElement.classList.remove('is-compact', 'is-stacked')
        this.rail.style.maxWidth = 'none'
        const width = this.rail.offsetWidth
        this.menuElement.classList.add('is-stacked')
        const stacked = this.rail.offsetWidth
        this.rail.style.maxWidth = ''
        this.menuElement.classList.toggle('is-stacked', width > room && stacked <= room)
        this.menuElement.classList.toggle('is-compact', stacked > room)
    }

    get state()
    {
        return this.api.state
    }

    // AI call running: buttons locked, a pill at the bottom counts the seconds (shown after 1s, quick calls stay silent)
    setBusy(busy)
    {
        this.root.classList.toggle('is-busy', busy)
        clearInterval(this.busyInterval)
        const time = this.root.querySelector('.js-career-busy-time')
        time.textContent = ''
        if(!busy)
            return
        const start = performance.now()
        this.busyInterval = setInterval(() =>
        {
            time.textContent = t('common.seconds', { n: Math.floor((performance.now() - start) / 1000) })
        }, 1000)
    }

    setDom()
    {
        this.root = document.createElement('div')
        this.root.className = 'career-ui'
        this.root.innerHTML = `
            <section class="career-panel js-career-panel" aria-hidden="true">
                <header class="career-panel-header">
                    <span class="building-screen-brand building-only">KerjayaKu <span> / </span></span>
                    <h2 class="js-career-panel-title"></h2>
                    <button class="career-close" data-action="close" aria-label="${esc(t('common.close'))}">×</button>
                </header>
                <nav class="building-screen-sections building-only js-building-sections"></nav>
                <div class="career-panel-body js-career-panel-body"></div>
                <footer class="building-screen-footer building-only">
                    <button type="button" data-action="building-page" data-direction="-1" class="building-screen-arrow">←</button>
                    <span class="js-building-position"></span>
                    <span class="building-screen-hint">Esc · <span class="js-building-exit"></span></span>
                    <button type="button" data-action="building-page" data-direction="1" class="building-screen-arrow">→</button>
                </footer>
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
            <div class="career-busy" role="status"><span class="career-busy-spinner" aria-hidden="true"></span><span class="js-career-busy-text">${esc(t('common.loading'))}</span><span class="career-busy-time js-career-busy-time"></span></div>
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
        this.dialogueElement.addEventListener('submit', (event) =>
        {
            event.preventDefault()
            this.askMentor(event.target.querySelector('input[type="text"]').value)
        })
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

            // A stage note opened by a click closes on a press anywhere else (its own flag still toggles it)
            const openStop = this.root.querySelector('.career-map-stop.is-open')
            if(this.panel?.openStage && openStop && !openStop.contains(event.target))
                this.closeStageNote(openStop)
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
            // Search filters as you type (renderPanel keeps the focus and caret). Not mid IME composition (Chinese pinyin):
            // the re-render would drop the pending text, compositionend renders once the characters are picked
            if((key === 'careerSearch' || key === 'marketSearch') && !event.isComposing)
                this.renderPanel()
        })

        // IME composition (Chinese pinyin...): no panel re-render meanwhile, it would drop the pending text
        this.root.addEventListener('compositionstart', () =>
        {
            this.composing = true
        })
        this.root.addEventListener('compositionend', (event) =>
        {
            this.composing = false
            const key = event.target.dataset?.draft
            if(key)
                this.drafts[key] = event.target.value
            // Render what was held back (state update while composing) or filter the search with the picked characters
            if(this.panelRenderHeld || key === 'careerSearch' || key === 'marketSearch')
                this.renderPanel()
        })

        // Screenshot pasted (Ctrl+V) into the CV / job posting box: attached like a picked file
        this.root.addEventListener('paste', (event) =>
        {
            // Screenshot or file pasted into the mentor question field (CareerUI.askMentor)
            if(this.dialogue && event.target.closest?.('.career-dialogue-ask'))
            {
                const file = [ ...(event.clipboardData?.files ?? []) ][0]
                if(!file)
                    return
                event.preventDefault()
                const extension = file.type.split('/')[1] ?? 'png'
                return this.attachToQuestion(file.name && file.name !== `image.${extension}` ? file : new File([ file ], `screenshot-${Date.now()}.${extension}`, { type: file.type }))
            }

            const key = event.target.dataset?.draft
            if(key !== 'profile' && key !== 'posting')
                return
            const file = [ ...(event.clipboardData?.files ?? []) ].find((item) => item.type.startsWith('image/') || item.type === 'application/pdf')
            if(!file)
                return
            event.preventDefault()
            const extension = file.type.split('/')[1] ?? 'png'
            this.files[key] = file.name && file.name !== `image.${extension}` ? file : new File([ file ], `screenshot-${Date.now()}.${extension}`, { type: file.type })
            this.renderPanel()
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
            if(input.dataset.askFile !== undefined)
            {
                this.attachToQuestion(input.files?.[0])
                input.value = ''
            }
            if(input.dataset.task)
            {
                const stop = input.closest('[data-stage]')
                if(stop && this.panel)
                    this.panel.openStage = stop.dataset.stage
                this.run(() => this.api.setTaskDone(input.dataset.task, input.checked))
            }
            if(input.dataset.lang)
                this.changeLang(input.value)
            if(input.dataset.market && this.panel)
            {
                const key = { filter: 'marketFilter', from: 'marketFrom', to: 'marketTo', sort: 'marketSort', movers: 'marketMovers' }[input.dataset.market]
                // From / to: the chosen month is kept; past MAX_RANGE_MONTHS the other end moves to the limit and a warning says so
                const other = input.closest('.career-trend-controls')?.querySelector(`[data-market="${key === 'marketFrom' ? 'to' : 'from'}"]`)?.value
                if((key === 'marketFrom' || key === 'marketTo') && other)
                {
                    const range = limitRange(input.dataset.market, input.value, other)
                    Object.assign(this.panel, { marketFrom: range.from, marketTo: range.to, marketRangeWarning: range.adjusted })
                }
                else
                    this.panel[key] = input.value
                this.renderPanel()
            }
        })

        addEventListener('keydown', (event) =>
        {
            // Keys typed into an IME (Chinese pinyin: Enter / Esc / Space pick or cancel a candidate) are not commands
            if(event.isComposing || event.keyCode === 229)
                return
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
            if(this.dialogue && event.target.closest?.('.career-dialogue-ask'))
            {
                if(event.code === 'Escape')
                    this.closeDialogue()
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
            if(event.key === '/' && this.panel?.name === 'market' && !event.target.closest?.('input, textarea, select'))
            {
                event.preventDefault()
                this.panelBody.querySelector('[data-draft="marketSearch"]')?.focus()
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
        if(!this.ownsInputs || this.panel || this.dialogue || this.menuOpen || this.touring)
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
        this.events.trigger('panel', [ name ])
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
        this.events.trigger('panel', [ null ])
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
        await this.run(() => this.api.setLang(lang), (result) =>
        {
            if(result.skillTranslationPending)
                this.notice = { type: 'warning', text: t('settings.skillTranslationPending') }
        })
        this.rebuildStatic()
        this.render()
    }

    async refreshMarketSample()
    {
        if(this.marketRefreshing)return
        this.marketRefreshing=true
        this.marketRefreshResult={status:'running'}
        this.renderPanel()
        try
        {
            this.marketRefreshResult=await collectNewSample(this.api,{onChange:run=>{this.marketRefreshResult=run;if(this.panel?.name==='market')this.renderPanel()}})
        }
        catch(error){this.marketRefreshResult={...this.marketRefreshResult,status:'failed',error:error.code??'crawler-refresh-failed',cooldownUntil:error.cooldownUntil??null}}
        finally {this.marketRefreshing=false;if(this.panel?.name==='market')this.renderPanel()}
    }

    rebuildStatic()
    {
        this.root.querySelector('.js-career-busy-text').textContent = t('common.loading')
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
            case 'menu': return element?.closest('.career-menu') ? travelToBuilding(this.game, this, data.panel) : this.openPanel(data.panel)
            case 'next': return element?.closest('.career-menu') ? travelToBuilding(this.game, this, data.panel) : this.openPanel(data.panel)
            case 'building-page': return this.turnBuildingPage(Number(data.direction))
            case 'building-section': return this.buildingHeadings?.[Number(data.section)]?.scrollIntoView({ block: 'start', behavior: 'smooth' })
            case 'building-room': return this.switchBuildingRoom(Number(data.direction))
            case 'building-dot': return this.selectBuildingDot(Number(data.index))
            case 'extract': return this.extractProfile()
            case 'skill-remove': return this.updateSkill(Number(data.index), null)
            case 'skill-add': return this.addSkill()
            case 'career': return this.openPanel('careers', { careerId: data.career })
            case 'careers-back': return this.openPanel('careers')
            case 'market-tab': this.panel.marketTab = data.tab; return this.renderPanel()
            case 'market-sampling-toggle': this.panel.marketSamplingExpanded = !this.panel.marketSamplingExpanded; return this.renderPanel()
            case 'market-refresh': return this.refreshMarketSample()
            case 'scenario': return this.run(() => this.api.setScenario(data.preset), () => this.renderPanel())
            case 'scenario-assumptions': this.panel.assumptionsOpen = !this.panel.assumptionsOpen; return this.renderPanel()
            case 'market-rising': Object.assign(this.panel, { marketTab: 'ranking', marketFilter: 'rising' }); return this.renderPanel()
            case 'mode': this.panel.mode = data.mode; return this.renderPanel()
            case 'sdg-filter': this.panel.sdgFilter = this.panel.sdgFilter === Number(data.goal) ? null : Number(data.goal); return this.renderPanel()
            case 'sdg-explore': return this.openPanel('careers', { sdgFilter: Number(data.goal) })
            case 'stage-toggle': this.panel.openStage = this.panel.openStage === data.stage ? null : data.stage; return this.renderPanel()
            case 'stage-force': this.panel.forceConfirm = data.stage; this.panel.openStage = data.stage; return this.renderPanel()
            case 'stage-force-cancel': this.panel.forceConfirm = null; return this.renderPanel()
            case 'stage-force-confirm': return this.forceStage(data.stage, element)
            case 'set-target': return this.setTarget()
            case 'replace-confirm': return this.setTarget(true)
            case 'replace-cancel': this.panel.confirmReplace = false; return this.renderPanel()
            case 'target-resolve': return this.resolveTarget(data.choice)
            case 'career-generate': return this.generateCareer()
            case 'file-remove': delete this.files[data.file]; return this.renderPanel()
            case 'roadmap': return this.generateRoadmap(data.confirm === '1')
            case 'learning-mode': return this.run(() => this.api.setLearningScenario(data.mode))
            case 'learning-default': return this.run(() => this.api.setLearningScenario(null))
            case 'learning-analyze': return this.run(() => this.api.analyzeLearning())
            case 'learning-checkpoint': return this.run(() => this.api.startCheckpoint())
            case 'learning-checkpoint-refresh': return this.run(() => this.api.refreshCheckpoint(this.state.learning?.checkpoint?.id), () =>
            {
                delete this.drafts.reviewProgress
                delete this.drafts.reviewDifficulty
                delete this.drafts.reviewAnswer
                this.renderPanel()
            })
            case 'learning-preview': return this.run(() => this.api.previewLearning())
            case 'learning-apply': return this.run(() => this.api.applyLearning(this.state.learning?.pending?.id))
            case 'learning-discard': return this.run(() => this.api.discardLearning())
            case 'learning-review': return this.run(() => this.api.reviewCheckpoint(this.state.learning?.checkpoint?.id,
                this.drafts.reviewProgress ?? '', this.drafts.reviewDifficulty ?? '', this.drafts.reviewAnswer ?? ''), () =>
            {
                delete this.drafts.reviewProgress
                delete this.drafts.reviewDifficulty
                delete this.drafts.reviewAnswer
            })
            case 'track-posting': return this.run(() => this.api.trackPosting(this.drafts.postingTrackUrl ?? ''))
            case 'refresh-posting':
                if(!confirm(t('roadmap.regenerateConfirm'))) return
                return this.run(() => this.api.refreshPosting(this.state.target?.posting?.monitor?.pending?.hash))
            case 'log': return this.submitLog()
            case 'reset': return this.reset()
            case 'tutorial': this.closePanel(); return Game.getInstance().career.tour.start()
            case 'player-name': return this.savePlayerName()
            case 'friend-add': return this.addFriend()
            case 'friend-remove': return this.run(() => this.api.removeFriend(data.id))
            case 'copy-code': return this.copyFriendCode()
            case 'choice': this.dialogue.selected = Number(data.index); return this.choose(Number(data.index))
            case 'dialogue-close': return this.closeDialogue()
            case 'dialogue-advance': return this.advanceDialogue()
            case 'ask-file-remove': this.dialogue.file = null; this.renderAskFile(); return
            case 'dialogue-menu': Object.assign(this.dialogue, { node: 'greet', page: 0, selected: 0 }); return this.renderDialogue()
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

    /**
     * A career off the map asks first which mentor it replaces (replace: confirmed). A posting fitting another
     * career comes back pending: the career page then shows the choice (renderPending)
     */
    async setTarget(replace = false)
    {
        const careerId = this.panel.careerId
        const career = this.state.careers.find((item) => item.id === careerId)
        if(!career.onMap && !replace)
        {
            this.panel.confirmReplace = true
            return this.renderPanel()
        }
        const mode = this.panel.mode ?? 'general'
        const file = mode === 'customise' && this.files.posting ? await readFile(this.files.posting) : null
        const text = mode === 'customise' ? this.drafts.posting ?? '' : ''
        await this.run(() => this.api.setTarget(careerId, mode, text, file, replace, this.drafts.postingSourceUrl ?? ''), (result) =>
        {
            this.drafts.posting = ''
            this.drafts.postingSourceUrl = ''
            delete this.files.posting
            this.panel.confirmReplace = false
            if(result.pending)
                return this.renderPanel()
            this.targetSet(result, mode === 'customise' ? 'careers' : 'pet')
        })
    }

    async resolveTarget(choice)
    {
        await this.run(() => this.api.resolveTarget(choice), (result) =>
        {
            if(result.careerId)
                this.targetSet(result, 'careers')
            else
                this.renderPanel()
        })
    }

    targetSet(result, panel)
    {
        const careerId = result.careerId ?? this.state.target.careerId
        this.game.career.world.celebratePet()
        this.openPanel(panel, panel === 'careers' ? { careerId } : {})
        if(result.replaced)
        {
            this.notice = { type: 'info', text: t('replace.done', { new: this.careerName(careerId), old: this.careerName(result.replaced) }) }
            this.renderPanel()
        }
    }

    async generateCareer()
    {
        const query = (this.drafts.careerSearch ?? '').trim()
        if(!query)
            return
        await this.run(() => this.api.generateCareer(query), (result) =>
        {
            this.drafts.careerSearch = ''
            this.openPanel('careers', { careerId: result.careerId })
        })
    }

    careerName(careerId)
    {
        const career = this.state.careers.find((item) => item.id === careerId)
        return career ? pick(career.name) : careerId
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
            // Not counted (no real learning in it): keep the text so it can be completed, the pet doesn't cheer
            const counted = result.log.advanced.length > 0
            if(counted)
                this.drafts.log = ''
            this.notice = { type: counted ? 'info' : 'warning', text: result.reply }
            this.renderPanel()
            if(counted)
                this.game.career.world.cheerPet()
        })
    }

    // Close in place (no re-render, the map keeps its scroll), and drop the focus so :focus-within doesn't keep it shown
    closeStageNote(stop)
    {
        this.panel.openStage = null
        this.panel.forceConfirm = null
        stop.classList.remove('is-open')
        stop.querySelector('.career-map-node')?.setAttribute('aria-expanded', 'false')
        if(stop.contains(document.activeElement))
            document.activeElement.blur()
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
        this.fitBar()
    }

    renderPanel()
    {
        if(!this.panel || !this.state)
            return
        // Held while an IME composes (its own name: renderPending() is the pending-target block of the career page)
        if(this.composing)
        {
            this.panelRenderHeld = true
            return
        }
        this.panelRenderHeld = false

        // Keep the focused field and its caret while re-rendering
        const active = document.activeElement
        const focusKey = active?.dataset?.draft
        const caret = focusKey ? active.selectionStart : null
        const scroll = this.panelBody.scrollTop

        const renderers = {
            profile: () => this.renderProfile(),
            careers: () => this.panel.careerId ? this.renderCareer(this.panel.careerId) : this.renderCareers(),
            market: () => this.renderMarket(),
            pet: () => this.renderPet(),
            roadmap: () => this.renderRoadmap(),
            sdg: () => this.renderSdg(),
            log: () => this.renderLog(),
            leaderboard: () => this.renderLeaderboard(),
            settings: () => this.renderSettings(),
        }
        const [ title, body ] = renderers[this.panel.name]()
        const notice = this.notice ? `<p class="career-notice is-${this.notice.type}" role="status">${esc(this.notice.text)}</p>` : ''

        this.panelTitle.textContent = title
        const changedPosting = this.state.target?.posting?.monitor?.requiresRegeneration && this.panel.name !== 'roadmap'
            ? `<p class="career-notice is-warning" role="status">${esc(t('watch.changed'))} <button class="career-link" data-action="menu" data-panel="roadmap">${esc(t('roadmap.title'))}</button></p>` : ''
        this.panelBody.innerHTML = changedPosting + notice + body
        this.panelElement.classList.toggle('is-map', !this.buildingVisit?.active && this.panel.name === 'roadmap' && Boolean(this.state.roadmap))
        if(this.buildingVisit?.active) this.renderBuildingSections()
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

    renderBuildingSections()
    {
        this.buildingHeadings = [...this.panelBody.querySelectorAll('h3')]
        this.root.querySelector('.js-building-sections').innerHTML = this.buildingHeadings.map((heading, index) =>
            `<button type="button" data-action="building-section" data-section="${index}">${esc(heading.textContent)}</button>`).join('')
        this.root.querySelector('.js-building-position').textContent = t(`menu.${this.panel.name}`)
        this.root.querySelector('.js-building-exit').textContent = t('common.close')
        this.buildingVisit.stage.syncContent()
    }

    switchBuildingRoom(direction)
    {
        const index = MENU.indexOf(this.panel?.name)
        return travelToBuilding(this.game, this, MENU[(index + direction + MENU.length) % MENU.length])
    }

    selectBuildingDot(index)
    {
        if(this.buildingHeadings?.[index])
            return this.buildingHeadings[index].scrollIntoView({ block: 'start', behavior: 'smooth' })
        if(this.panel?.name === 'careers' && this.state?.careers[index])
            return this.openPanel('careers', { careerId: this.state.careers[index].id })
        this.panelBody.scrollTo({ top: index / 4 * Math.max(0, this.panelBody.scrollHeight - this.panelBody.clientHeight), behavior: 'smooth' })
    }

    turnBuildingPage(direction)
    {
        // Like the reference display: arrows browse careers; other rooms keep every section scrollable.
        if(this.panel?.name === 'careers' && this.state?.careers.length)
        {
            const careers = this.state.careers
            const index = careers.findIndex(career => career.id === this.panel.careerId)
            if(index === -1 && direction < 0) return
            const next = (index + direction + careers.length) % careers.length
            return this.openPanel('careers', { careerId: careers[next].id })
        }
        this.panelBody.scrollBy({ top: direction * this.panelBody.clientHeight * 0.8, behavior: 'smooth' })
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
                    <select data-skill-level="${index}" aria-label="${esc(this.skillName(skill.id, skill.name))}">
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
        const snapshot = career.market.snapshot
        if(career.market.sample)
            return `<span class="career-tag">${esc(t('market.sampleShare', { p: career.market.heat ?? '—' }))}</span><span class="career-tag">${esc(t('market.sampleAds', { n: snapshot.postings }))}</span><span class="career-tag">${esc(t('market.accumulating'))}</span>`
        const direction = (change) => change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
        const trend = snapshot
            ? `<span class="career-tag is-trend is-${direction(snapshot.change)}" title="${esc([ snapshot.note ? pick(snapshot.note) : '', snapshot.postings !== undefined && snapshot.postings !== null ? t('careers.postings', { n: snapshot.postings }) : '' ].filter(Boolean).join(' · '))}">${esc(t(isWeek(snapshot.period) ? 'careers.weekTrend' : 'careers.monthTrend', {
                month: periodLabel(snapshot.period),
                week: periodLabel(snapshot.period),
                arrow: snapshot.change > 0 ? '↑' : snapshot.change < 0 ? '↓' : '→',
                change: snapshot.change === null || snapshot.change === undefined ? '—' : `${changeText(snapshot.change)}%`,
            }))}</span>`
            : ''
        // No collected postings for this career: say so rather than show a number
        return career.market.heat === null && !trend ? `<span class="career-tag">${esc(t('careers.marketNoData'))}</span>`
            : `${career.market.heat === null ? '' : `<span class="career-tag">${esc(t('careers.heat', { p: career.market.heat }))}</span>`}${trend}`
    }

    /**
     * Postings per week of the live snapshots (server/market-trends.js), one bar per week.
     * Backfilled weeks (rebuilt from posting dates, undercounted) are drawn lighter and never compared.
     */
    weeklyTrend(career)
    {
        const history = career.market.snapshot?.history ?? []
        if(!history.length)
            return ''

        const max = Math.max(1, ...history.map((point) => point.postings ?? 0))
        const skills = (point) => Object.entries(point.topSkills ?? {}).slice(0, 3)
            .map(([ id, count ]) => `${this.skillName(id, id)} ${point.postings ? Math.round(count / point.postings * 100) : 0}%`)
            .join(getLang() === 'zh' ? '、' : ', ')
        const bars = history.map((point) => `
            <li class="career-week ${point.backfilled ? 'is-backfilled' : ''}" title="${esc([ periodLabel(point.period), t('careers.postings', { n: point.postings ?? 0 }), skills(point), point.backfilled ? t('careers.weekBackfilled') : '' ].filter(Boolean).join(' · '))}">
                <span class="career-week-value">${point.postings ?? 0}</span>
                <span class="career-week-bar"><span style="height:${Math.round((point.postings ?? 0) / max * 100)}%"></span></span>
                <span class="career-week-change is-${point.change > 0 ? 'up' : point.change < 0 ? 'down' : 'flat'}">${esc(point.change === null || point.change === undefined ? '—' : `${changeText(point.change)}%`)}</span>
                <span class="career-week-label">${esc(periodLabel(point.period))}</span>
            </li>`).join('')

        const notes = [ t(history.length === 1 ? 'careers.weeklyFirst' : 'careers.weeklyNote') ]
        if(history.some((point) => point.backfilled))
            notes.push(t('careers.weeklyBackfilled'))
        return `
            <h3>${esc(t('careers.weekly'))}</h3>
            <ol class="career-weeks" style="--career:${career.color}" aria-label="${esc(t('careers.weekly'))}">${bars}</ol>
            ${notes.map((note) => `<p class="career-muted">${esc(note)}</p>`).join('')}`
    }

    /**
     * Skill popularity (server/market-trends.js skillTrend): share of the postings asking for each skill and its
     * change in percentage points vs the previous period, most asked first
     */
    skillPopularity(trend, title, limit = 8)
    {
        if(!trend?.skills.length)
            return ''

        const rows = trend.skills.slice(0, limit).map((skill) => `
            <li class="career-skill-trend">
                <span class="career-skill-trend-name">${esc(this.skillName(skill.id, skill.id))}</span>
                <span class="career-skill-trend-bar">${bar(skill.share)}</span>
                <span class="career-skill-trend-share">${skill.share}%</span>
                <span class="career-skill-trend-change is-${skill.change > 0 ? 'up' : skill.change < 0 ? 'down' : 'flat'}">${esc(skill.change === null ? '—' : t('careers.skillChange', { arrow: skill.change > 0 ? '↑' : skill.change < 0 ? '↓' : '→', n: Math.abs(skill.change) }))}</span>
            </li>`).join('')

        const note = trend.sample ? t('market.sampleSkills', { n: trend.denominator }) : trend.previousPeriod
            ? t('careers.skillsVs', { period: periodLabel(trend.period), previous: periodLabel(trend.previousPeriod), n: trend.postings })
            : t('careers.skillsFirst', { period: periodLabel(trend.period), n: trend.postings })
        return `
            <h3>${esc(title)}</h3>
            <ul class="career-skill-trends">${rows}</ul>
            <p class="career-muted">${esc(note)}</p>`
    }

    /**
     * Career search: name, summary or skill, in any of the three languages. Nothing found: the AI can generate it
     */
    searchCareers(query)
    {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean)
        if(!words.length)
            return [ ...this.state.careers ]
        return this.state.careers.filter((career) =>
        {
            const haystack = [
                ...Object.values(career.name),
                ...Object.values(career.summary),
                ...career.match.skills.flatMap((skill) => Object.values(this.state.skillNames[skill.id] ?? {})),
            ].join(' ').toLowerCase()
            return words.every((word) => haystack.includes(word))
        })
    }

    renderCareers()
    {
        const query = (this.drafts.careerSearch ?? '').trim()
        const sdgFilter = this.panel.sdgFilter ?? null
        const careers = this.searchCareers(query)
            .filter((career) => !sdgFilter || career.sdgs.some((tag) => tag.goal === sdgFilter))
            // Ranked by the score of the current scenario (server/scenarios.js); affinity still shows on the cards
            .sort((a, b) => (forecastOf(this.state, a.id)?.rank ?? Infinity) - (forecastOf(this.state, b.id)?.rank ?? Infinity) || (b.affinity ?? 0) - (a.affinity ?? 0))
        return [ t('careers.title'), `
            ${renderScenarioBar(this.state, { t, esc, open: Boolean(this.panel.assumptionsOpen) })}
            ${this.panel.assumptionsOpen ? renderAssumptions(this.state, { t, esc }) : ''}
            <div class="career-search">
                <input type="search" data-draft="careerSearch" placeholder="${esc(t('careers.search.placeholder'))}" aria-label="${esc(t('careers.search.placeholder'))}" value="${esc(this.drafts.careerSearch ?? '')}">
                <small class="career-muted">${esc(t('careers.search.count', { n: careers.length }))}</small>
            </div>
            ${careers.length ? '' : `
                <div class="career-search-empty">
                    <p>${esc(t('careers.search.none', { q: query }))}</p>
                    <button class="career-button" data-action="career-generate">${esc(t('careers.search.generate', { q: query }))}</button>
                </div>`}
            <p>${esc(t('careers.intro'))}</p>
            <button class="career-link" data-action="menu" data-panel="market">${esc(t('market.open'))}</button>
            ${this.renderSdgFilter(sdgFilter)}
            <div class="career-cards">
                ${careers.map((career) => `
                    <button class="career-card ${career.onMap ? '' : 'is-off-map'}" data-action="career" data-career="${career.id}" style="--career:${career.color}">
                        <span class="career-card-top">
                            <strong>${esc(pick(career.name))}${newCareerBadge(career,{t,esc})}</strong>
                            ${this.state.target?.careerId === career.id ? `<span class="career-tag is-target">${esc(t('careers.current'))}</span>` : ''}
                        </span>
                        <small>${esc(pick(career.summary))}</small>
                        <span class="career-card-affinity" title="${esc(t('careers.affinityHelp'))}">${bar(career.affinity ?? 0, 'is-heart')}<em>♡ ${esc(t('careers.affinity', { p: career.affinity ?? 0 }))}</em></span>
                        ${renderCardScore(this.state, career.id, { t, esc })}
                        <small class="career-card-fit">${esc(t('careers.fit', { p: career.match.percent }))}</small>
                        <span class="career-card-sdgs">${[ ...new Set(career.sdgs.map((tag) => tag.goal)) ].map((goal) => this.sdgBadge(goal)).join('')}</span>
                        <span>
                            <span class="career-tag ${career.onMap ? 'is-on-map' : 'is-off-map'}">${esc(t(career.onMap ? 'careers.onMap' : 'careers.offMapTag'))}</span>
                            ${career.custom ? `<span class="career-tag">${esc(t('careers.custom'))}</span>` : ''}
                            ${career.saved ? `<span class="career-tag">${esc(t('careers.saved'))}</span>` : ''}
                            ${this.marketBadges(career)}
                        </span>
                    </button>`).join('')}
            </div>
        ` ]
    }

    /**
     * Trends panel: a demand heatmap of new job ads per career and month with the month's movers, a career ranking and
     * the skill trends. Monthly data pushed by the n8n workflow (server/trends.js), demo numbers until the first push.
     */
    renderMarket()
    {
        const state = this.state
        const trends = state.trends
        const panel = this.panel
        const tab = panel.marketTab ?? 'overview'
        const locale = getLang() === 'zh' ? 'zh-CN' : getLang()
        // Nothing collected yet: say so and offer Refresh, never stand-in numbers
        if(!trends.periods.length)
            return [ t('market.title'), `
            <p class="career-muted career-trend-intro">${esc(t('market.notCollected'))}</p>
            ${renderSamplingDiagnostics(trends.sampling ?? null,{t,esc,locale,expanded:false,refresh:{busy:this.marketRefreshing,result:this.marketRefreshResult,collection:trends.crawler,now:Date.now()}})}` ]
        const periods = trends.periods
        const last = periods.length - 1
        const month = (period, options) => new Date(`${period}-01T00:00:00`).toLocaleString(locale, options)
        const short = (period) => month(period, { month: 'short' })
        const long = (period) => month(period, { month: 'long' })
        const withYear = (period) => month(period, { month: 'short', year: 'numeric' })
        const rangeLabel = (from, to) => from === to ? withYear(to) : from.slice(0, 4) === to.slice(0, 4) ? `${short(from)} – ${withYear(to)}` : `${withYear(from)} – ${withYear(to)}`
        const change = (values, index) => index > 0 && values[index] !== null && values[index - 1] ? Math.round((values[index] - values[index - 1]) / values[index - 1] * 1000) / 10 : null
        const percent = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
        const direction = (value) => value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
        const spark = (values) =>
        {
            const known = values.filter((value) => value !== null)
            if(known.length < 2)
                return ''
            const min = Math.min(...known), max = Math.max(...known)
            const points = values.map((value, index) => value === null ? null : `${(index / (values.length - 1) * 58 + 1).toFixed(1)},${(17 - (value - min) / ((max - min) || 1) * 16).toFixed(1)}`).filter(Boolean)
            return `<svg class="career-trend-spark" viewBox="0 0 60 18" aria-hidden="true"><polyline points="${points.join(' ')}"/></svg>`
        }

        // Range (last N months), search, filter and sort
        const calendar = marketMonthWindow()
        const currentMonth = calendar.at(-1)
        // From / to menus: every month from the first with data (our collection, archives, past JobStreet months) to now
        const references = trends.references ?? []
        const firstMonth = [ ...calendar, ...periods, ...(trends.historical?.periods ?? []), ...references.flatMap((reference) => reference.months) ].sort()[0]
        const allMonths = monthsBetween(firstMonth, currentMonth)
        const { from: rangeFrom, to: rangeTo, shown } = chosenRange(allMonths, panel, calendar)
        const shownIndexes = shown.map(period => periods.indexOf(period))
        // A range across years labels its months with the year ("Mar 25"), so last year's March is not this year's
        const columnLabel = new Set(shown.map((period) => period.slice(0, 4))).size > 1 ? (period) => month(period, { month: 'short', year: '2-digit' }) : short
        // Only months our own collection reached are real; every other cell is simulated, in the same unit (postings),
        // including the ranking and its rising / falling (user decision 2026-10-30, overriding D5). Simulated cells
        // carry data-origin="mock"; the scenario model never reads them.
        // The range menus belong to the overview; the ranking and skill tabs always end at the current month
        const rowMonths = tab === 'overview' ? shown : calendar
        const historyPreview = buildMockMarketHistory(trends, rowMonths)
        const query = (this.drafts.marketSearch ?? '').trim()
        const matches = (name) => !query || Object.values(name).some((text) => String(text).toLowerCase().includes(query.toLowerCase()))
        const careers = buildMarketRows(trends, rowMonths, historyPreview)
        const filter = panel.marketFilter ?? 'all'
        const counts = { all: careers.length, rising: careers.filter((career) => career.trend === 'rising').length, falling: careers.filter((career) => career.trend === 'falling').length }
        const sort = panel.marketSort ?? 'latest'
        const visible = careers
            .filter((career) => matches(career.name) && (filter === 'all' || career.trend === filter))
            .sort((a, b) => sort === 'name' ? pick(a.name).localeCompare(pick(b.name), locale)
                : sort === 'growth' ? (b.change ?? - Infinity) - (a.change ?? - Infinity)
                : (b.latest ?? - 1) - (a.latest ?? - 1))
        const target = state.target?.careerId
        const isTarget = (career) => Boolean(career.careerId) && career.careerId === target
        const option = (value, current, label) => `<option value="${value}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`
        const careerButton = (career, content, extraClass) => career.careerId
            ? `<button class="${extraClass}" data-action="career" data-career="${career.careerId}">${content}</button>`
            : `<div class="${extraClass}">${content}</div>`
        const none = query && !visible.length ? `<p class="career-muted">${esc(t('market.none', { q: query }))}</p>` : ''
        const filterSelect = `
            <select data-market="filter" aria-label="${esc(t('market.filterLabel'))}">
                ${[ 'all', 'rising', 'falling' ].map((name) => option(name, filter, t(`market.filter.${name}`, { n: counts[name] }))).join('')}
            </select>`

        const tabs = [ 'overview', 'ranking', 'skills' ].map((name) => `
            <button class="career-trend-tab ${tab === name ? 'is-active' : ''}" data-action="market-tab" data-tab="${name}" aria-pressed="${tab === name}">${esc(t(`market.tab.${name}`))}</button>`).join('')

        const badge = `<span class="career-trend-badge is-live">${esc(t('market.live', { date: trends.collectedAt ? new Date(trends.collectedAt).toLocaleDateString(locale) : withYear(periods[last]) }))}</span>`
        const head = (title, subtitle, extra = badge) => `
            <header class="career-trend-head">
                <div><h3>${esc(title)}</h3><p class="career-muted">${esc(subtitle)}</p></div>
                ${extra}
            </header>`

        let body = ''
        // National estimate of our collection (server/national-estimate.js): shown on hover, with how it was made
        const national = trends.nationalEstimate
        const nationalTitle = (row) => row ? t('market.national.value', { p: row.share, m: row.margin }) : t('market.national.none')
        const nationalNote = national ? `<p class="career-muted career-national-note">${esc(t('market.national.note', { quarter: national.quarter.replace('-', ' '), n: national.postings }))}</p>` : ''
        if(tab === 'overview')
        {
            const hasBackfill = visible.some(career => shown.some(period => historyPreview.cells[career.id]?.[period]))
            const displayedValue = (career, index) => career.displayAds[index]
            // Darker purple = more ads, on a scale rounded up to 50
            const max = Math.max(50, ...visible.flatMap((career) => shown.map((_, index) => displayedValue(career, index))).filter((value) => value !== null))
            const scale = Math.ceil(max / 50) * 50
            const cell = (value, period, preview, archived) =>
            {
                if(value === null)
                    return `<td class="is-empty" title="${esc(`${period}: ${t('market.history.missing')}`)}" aria-label="${esc(`${period}: ${t('market.history.missing')}`)}">—</td>`
                const p = value / scale
                const mix = 0.14 + p * 0.86 // From #f0ebff (no ads) to #4b2fb3 (top of the scale)
                const shade = [ [ 240, 75 ], [ 235, 47 ], [ 255, 179 ] ].map(([ from, to ]) => Math.round(from + (to - from) * mix))
                const description = `${period}: ${value}`
                return `<td data-period="${period}" data-origin="${preview ? 'mock' : archived ? 'archived' : 'observed'}" class="${period === currentMonth ? 'is-latest' : ''} ${p > 0.5 ? 'is-dark' : ''}" style="background-color:rgb(${shade.join(',')})" title="${esc(description)}" aria-label="${esc(description)}"><span>${value}</span></td>`
            }
            // Past JobStreet months in the chosen range (shares of each month's sample, own colour scale), and their
            // 2024→2025 change as the last column when both years are on screen; never compared with our own months
            const reference = referenceView([], shown, visible, { t, esc, label: columnLabel, withYear })
            const yearOnYear = yearOnYearColumn(trends.yearOnYear, reference.datasets, { t, esc })
            const rows = visible.map((career) => `
                <tr data-career="${esc(career.id)}" class="${isTarget(career) ? 'is-target' : ''}">
                    <th scope="row" title="${esc(pick(career.name))}">${careerButton(career, `<span>${esc(pick(career.shortName ?? career.name))}${newCareerBadge(career,{t,esc})}</span>${isTarget(career) ? '<i class="career-trend-dot" aria-hidden="true"></i>' : ''}`, 'career-trend-name')}</th>
                    ${shown.map((period, index) => reference.isReference(period) ? reference.cell(career, period) : cell(displayedValue(career, index), period, historyPreview.cells[career.id]?.[period], career.ads[shownIndexes[index]] == null && trends.careerObservations?.[career.id]?.[period])).join('')}${yearOnYear ? yearOnYear.cell(career) : ''}
                </tr>`).join('')

            // Movers: change in the chosen month versus the month before
            const chosen = periods.indexOf(panel.marketMovers)
            const moversIndex = chosen > 0 ? chosen : last
            const moved = trends.sample ? careers.filter(career => career.change !== null) : trends.careers.map((career) => ({ ...career, change: change(career.ads, moversIndex) })).filter((career) => career.change !== null)
            const rising = moved.filter((career) => career.change > 0).sort((a, b) => b.change - a.change)
            const falling = moved.filter((career) => career.change < 0).sort((a, b) => a.change - b.change)
            const moverList = (items, kind) => items.length
                ? `<ol>${items.slice(0, 3).map((career, index) => `
                    <li>${careerButton(career, `<span class="career-trend-rank">${index + 1}</span><strong>${esc(pick(career.name))}</strong><em class="is-${kind}">${percent(career.change)}</em>`, 'career-trend-mover')}</li>`).join('')}</ol>`
                : `<p class="career-muted">${esc(t(kind === 'up' ? 'market.noneRising' : 'market.noneFalling'))}</p>`

            body = `
                <section class="career-trend-card">
                    ${head(t(hasBackfill ? 'market.heatmap' : trends.sample ? 'market.sampleHeatmap' : 'market.heatmap'), t(hasBackfill ? 'market.trendSub' : trends.sample ? 'market.sampleSub' : 'market.heatmapSub', { n: trends.postings, d: trends.denominator }))}
                    ${!hasBackfill && trends.sample ? `<p class="career-market-coverage">${esc(t('market.history.sampleCoverage', { range: rangeLabel(periods[0], periods[last]) }))}</p>` : ''}
                    <div class="career-trend-controls">
                        ${[ [ 'from', rangeFrom ], [ 'to', rangeTo ] ].map(([ end, value ]) => `
                        <label class="career-range-field"><span>${esc(t(`market.range.${end}`))}</span>
                            <select data-market="${end}" aria-label="${esc(t(`market.range.${end}`))}">
                                ${allMonths.map((month) => option(month, value, withYear(month))).join('')}
                            </select>
                        </label>`).join('')}
                    </div>
                    ${panel.marketRangeWarning ? `<p class="career-notice is-warning career-range-warning" role="alert">${esc(t('market.range.tooLong', { n: MAX_RANGE_MONTHS, end: t(`market.range.${panel.marketRangeWarning}`), month: withYear(panel.marketRangeWarning === 'to' ? rangeTo : rangeFrom) }))}</p>` : ''}
                    <small class="career-history-scrollhint">${esc(t('market.history.scroll'))}</small>
                    ${none || `
                    <div class="career-trend-scroll">
                        <table class="career-heatmap">
                            <thead><tr><th scope="col">${esc(t('market.career'))}</th>${shown.map((period) => reference.isReference(period) ? reference.head(period) : `<th scope="col" class="${period === currentMonth ? 'is-latest' : ''}" title="${esc(trends.sample && period === periods[last] ? t('market.history.currentSample') : period)}">${esc(columnLabel(period))}</th>`).join('')}${yearOnYear ? yearOnYear.head : ''}</tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <div class="career-trend-legend">
                        <span>${esc(t('market.fewer'))}</span>
                        <div><i></i><small><b>0</b><b>${scale / 2}</b><b>${scale}</b></small></div>
                        <span>${esc(t('market.more'))}</span>
                    </div>
                    ${reference.notes}${yearOnYear ? `<p class="career-muted career-reference-note">${esc(t('market.yoy.note'))}</p>` : ''}`}
                </section>


                ${renderMarketHistory(trends.historical, { t, esc, locale, short, rangeLabel })}

                ${(periods.length > 1 && !trends.sample) || (trends.sample && moved.length) ? `
                <section class="career-trend-movers">
                    ${head(t('market.movers'), t('market.moversSub', { month: long(trends.sample ? careers[0].previousPeriod : periods[moversIndex - 1]) }), trends.sample ? '' : `
                        <select data-market="movers" aria-label="${esc(t('market.moversLabel'))}">
                            ${periods.slice(1).map((period) => option(period, periods[moversIndex], withYear(period))).join('')}
                        </select>`)}
                    <div class="career-trend-columns">
                        <div class="career-trend-column is-up">
                            <h4>↑ ${esc(t('market.rising'))}</h4>
                            ${moverList(rising, 'up')}
                            ${rising.length > 3 ? `<button class="career-link" data-action="market-rising">${esc(t('market.viewRising', { n: rising.length }))}</button>` : ''}
                        </div>
                        <div class="career-trend-column is-down">
                            <h4>↓ ${esc(t('market.falling'))}</h4>
                            ${moverList(falling, 'down')}
                            ${falling.length ? `<small class="career-muted">${esc(t('market.declining', { n: falling.length }))}</small>` : ''}
                        </div>
                    </div>
                </section>` : ''}`
        }
        else if(tab === 'ranking')
        {
            const max = Math.max(1, ...visible.map((career) => career.latest ?? 0))
            body = `
                <section class="career-trend-card">
                    ${head(t('market.tab.ranking'), t(trends.sample ? 'market.sampleSub' : 'market.rankingSub', { n: trends.postings, d: trends.denominator, month: long(periods[last]), previous: long(periods[Math.max(0, last - 1)]) }))}
                    <div class="career-trend-controls">${filterSelect}</div>
                    ${nationalNote}
                    ${none}
                    <ol class="career-trend-ranking">${[ ...visible ].sort((a, b) => (b.latest ?? - 1) - (a.latest ?? - 1)).map((career, index) => `
                        <li class="${isTarget(career) ? 'is-target' : ''}">${careerButton(career, `
                            <span class="career-trend-rank">${index + 1}</span>
                            <span class="career-trend-label"><strong>${esc(pick(career.name))}${newCareerBadge(career,{t,esc})}</strong>${bar((career.latest ?? 0) / max * 100)}</span>
                            ${spark(career.displayAds)}
                            <span class="career-trend-value" title="${esc(nationalTitle(national?.careers[career.careerId ?? career.id]))}">${esc(t('market.ads', { n: career.latest ?? '—' }))}</span>
                            <em class="is-${direction(career.change)}">${career.change === null ? '—' : percent(career.change)}</em>`, 'career-trend-row')}
                        </li>`).join('')}
                    </ol>
                </section>`
        }
        else
        {
            const mockSkills = buildMockSkillHistory(trends, calendar)
            const skillSeries = (skill) => calendar.map((period) => skill.share[periods.indexOf(period)] ?? mockSkills[skill.id]?.[period] ?? null)
            const skills = trends.skills
                .map((skill) => ({ ...skill, series: skillSeries(skill) }))
                .map((skill) => ({ ...skill, latest: skill.series.at(- 1), points: skill.series.length > 1 && skill.series.at(- 1) !== null && skill.series.at(- 2) !== null ? Math.round((skill.series.at(- 1) - skill.series.at(- 2)) * 10) / 10 : null }))
                .filter((skill) => matches(skill.name))
                .sort((a, b) => (b.latest ?? - 1) - (a.latest ?? - 1))
            body = `
                <section class="career-trend-card">
                    ${head(t('market.tab.skills'), t(trends.sample ? 'market.sampleSkills' : 'market.skillsSub', { n: trends.denominator, month: long(periods[last]), previous: long(periods[Math.max(0, last - 1)]) }))}
                    ${renderSkillRadar(state, { t, esc, skillName: (id) => this.skillName(id, id) })}
                    ${nationalNote}
                    ${query && !skills.length ? `<p class="career-muted">${esc(t('market.none', { q: query }))}</p>` : ''}
                    <ol class="career-trend-ranking">${skills.map((skill, index) => `
                        <li><div class="career-trend-row">
                            <span class="career-trend-rank">${index + 1}</span>
                            <span class="career-trend-label"><strong>${esc(pick(skill.name))}</strong>${bar(skill.latest ?? 0)}</span>
                            ${spark(skill.series)}
                            <span class="career-trend-value" title="${esc(nationalTitle(national?.skills[skill.id]))}">${skill.latest ?? '—'}%</span>
                            <em class="is-${direction(skill.points)}">${skill.points === null ? '—' : esc(t('market.points', { n: `${skill.points > 0 ? '+' : ''}${skill.points}` }))}</em>
                        </div></li>`).join('')}
                    </ol>
                </section>`
        }

        const targetCareer = target && state.careers.find((career) => career.id === target)
        return [ t('market.title'), `
            <p class="career-muted career-trend-intro">${esc(t(tab === 'overview' && historyPreview.count ? 'market.trendIntro' : trends.sample ? 'market.sampleSub' : 'market.subtitle', { n: trends.postings, d: trends.denominator }))}</p>
            <label class="career-trend-search">
                ${icon('magnifier')}
                <input type="search" data-draft="marketSearch" placeholder="${esc(t('market.search'))}" aria-label="${esc(t('market.search'))}" value="${esc(this.drafts.marketSearch ?? '')}">
                <kbd>/</kbd>
            </label>
            <div class="career-trend-tabs" role="group">${tabs}</div>
            ${tab === 'overview' ? renderSamplingDiagnostics(trends.sampling,{t,esc,locale,expanded:Boolean(panel.marketSamplingExpanded),refresh:{busy:this.marketRefreshing,result:this.marketRefreshResult,collection:trends.crawler,now:Date.now()}}) : ''}
            ${body}
            <p class="career-muted career-trend-note">${esc(t(trends.sample ? 'market.sampleNote' : 'market.noteLive', { source: trends.source }))}</p>
            <footer class="career-trend-footer">
                <span>${esc(targetCareer ? t('market.target', { career: pick(targetCareer.name) }) : t('market.noTarget'))}</span>
                ${targetCareer
                    ? `<button class="career-button" data-action="menu" data-panel="roadmap">${esc(t('market.viewRoadmap'))}</button>`
                    : `<button class="career-button" data-action="menu" data-panel="careers">${esc(t('market.chooseCareer'))}</button>`}
            </footer>
        ` ]
    }

    /**
     * The uploaded posting fits another career (server pendingTarget): take it (maybe swapping a mentor), keep the asked one, or cancel
     */
    renderPending(careerId)
    {
        const pending = this.state.pending
        if(!pending || pending.requestedCareerId !== careerId)
            return ''
        const asked = this.careerName(careerId)
        const career = pending.newCareerName ? pick(pending.newCareerName) : this.careerName(pending.suggestedCareerId)
        const replaced = pending.replaces && this.state.careers.find((item) => item.id === pending.replaces)
        return `
            <div class="career-notice is-warning career-choice" role="alert">
                <strong>${esc(t('pending.title'))}</strong>
                <p>${esc(t(pending.newCareerName ? 'pending.textNew' : 'pending.text', { title: pending.postingTitle, career, asked }))}</p>
                ${replaced ? `<p>${esc(t('pending.replace', { career, old: pick(replaced.name), p: replaced.affinity ?? 0 }))}</p>` : ''}
                <div class="career-row">
                    <button class="career-button" data-action="target-resolve" data-choice="suggested">${esc(t('pending.take', { career }))}</button>
                    <button class="career-button is-secondary" data-action="target-resolve" data-choice="requested">${esc(t('pending.keep', { asked }))}</button>
                    <button class="career-link" data-action="target-resolve" data-choice="cancel">${esc(t('pending.cancel'))}</button>
                </div>
            </div>`
    }

    // Target off the map: which mentor leaves (lowest affinity), confirmed before the request
    renderReplaceConfirm(career)
    {
        if(!this.panel.confirmReplace || career.onMap)
            return ''
        const replaced = this.state.careers.find((item) => item.id === this.state.map.replaceCandidate)
        return `
            <div class="career-notice is-warning career-choice" role="alert">
                <p>${esc(t('replace.confirm', { old: pick(replaced.name), p: replaced.affinity ?? 0, new: pick(career.name) }))}</p>
                <div class="career-row">
                    <button class="career-button" data-action="replace-confirm">${esc(t('replace.yes'))}</button>
                    <button class="career-button is-secondary" data-action="replace-cancel">${esc(t('replace.no'))}</button>
                </div>
            </div>`
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

        const posting = isTarget && this.state.target.posting ? this.renderPosting(this.state.target.posting, career.color) : ''

        const switching = this.state.target && !isTarget ? `<p class="career-notice is-warning">${esc(t('mode.switchWarning'))}</p>` : ''

        return [ pick(career.name), `
            <button class="career-link" data-action="careers-back">← ${esc(t('common.back'))}</button>
            ${this.renderPending(careerId)}
            ${newCareerBadge(career,{t,esc})}
            <p>${esc(pick(career.summary))}</p>
            ${career.onMap ? '' : `<p class="career-notice is-warning">${esc(t('careers.offMap'))}</p>`}
            <p>${this.marketBadges(career)} <span class="career-tag">${esc(t('careers.pet', { name: career.pet.name }))}</span></p>
            ${this.yearOnYearLine(this.state.trends?.yearOnYear?.careers[career.id], 'careers.yoy')}
            <p class="career-muted">${esc(t('careers.effort', { range }))} · ${esc(t(career.market.sample ? 'market.accumulating' : 'careers.marketNoData'))}</p>
            ${renderScoreBreakdown(this.state, career.id, { t, esc, skillName: (id) => this.skillName(id, id) })}
            ${this.renderCareerSdgs(career)}
            ${renderMycolTimeline(career.mycol, { t, esc })}
            <h3>${esc(t('careers.chooseMode'))}</h3>
            <div class="career-modes">
                ${[ 'general', 'customise' ].map((item) => `
                    <button class="career-mode ${mode === item ? 'is-selected' : ''}" data-action="mode" data-mode="${item}" aria-pressed="${mode === item}">
                        <strong>${esc(t(`mode.${item}`))}</strong><small>${esc(t(`mode.${item}.desc`))}</small>
                    </button>`).join('')}
            </div>
            ${mode === 'customise' ? `
                <textarea data-draft="posting" rows="5" placeholder="${esc(t('mode.postingPlaceholder'))}">${esc(this.drafts.posting ?? '')}</textarea>
                <label>${esc(t('watch.sourceLabel'))}<input type="url" data-draft="postingSourceUrl" placeholder="https://www.linkedin.com/jobs/view/…" value="${esc(this.drafts.postingSourceUrl ?? '')}"></label>
                <p class="career-muted">${esc(t('watch.sourceHelp'))}</p>
                <div class="career-row">${this.fileField('posting', '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md')}</div>
                <p class="career-muted">${esc(t('mode.disclaimer'))}</p>` : ''}
            ${switching}
            ${this.renderReplaceConfirm(career)}
            <button class="career-button is-wide" data-action="set-target">${esc(t(career.onMap ? 'mode.confirm' : 'mode.confirmReplace'))}</button>
            <div class="career-skill-popularity">${this.skillPopularity(career.market.skills, t('careers.skillsCareer'))}</div>
            ${this.weeklyTrend(career)}
            <h3>${esc(t('careers.requirements'))}</h3>
            <p class="career-muted career-skill-reference">${esc(t(this.state.trends?.sample ? 'market.sampleSkillReference' : 'skill.reference'))}</p>
            <ul class="career-skill-grid career-requirements" style="--skill-accent:${career.color}">${requirements}</ul>
            ${posting}
        ` ]
    }

    /**
     * SDG badge: the goal colour, the goal (or target) number, the names in the tooltip
     */
    sdgBadge(goal, target = null)
    {
        const info = this.state.sdg.goals[goal]
        const title = `SDG ${goal} · ${pick(info.name)}${target ? ` — ${target} ${pick(this.state.sdg.targets[target])}` : ''}`
        return `<span class="career-sdg" style="--sdg:${info.color}" title="${esc(title)}">${esc(target ?? goal)}</span>`
    }

    renderSdgFilter(selected)
    {
        const goals = [ ...new Set(this.state.careers.flatMap((career) => career.sdgs.map((tag) => tag.goal))) ].sort((a, b) => a - b)
        return `
            <div class="career-sdg-filter" role="group" aria-label="${esc(t('sdg.filter'))}">
                <small>${esc(t('sdg.filter'))}</small>
                ${goals.map((goal) => `
                    <button class="career-sdg-chip ${selected === goal ? 'is-selected' : ''}" data-action="sdg-filter" data-goal="${goal}" aria-pressed="${selected === goal}" style="--sdg:${this.state.sdg.goals[goal].color}" title="${esc(pick(this.state.sdg.goals[goal].name))}">
                        SDG ${goal}
                    </button>`).join('')}
            </div>
            ${selected ? `<p class="career-muted">${esc(t('sdg.filtered', { goal: selected, name: pick(this.state.sdg.goals[selected].name) }))}</p>` : ''}`
    }

    /**
     * Career page: the targets the job moves and why (server/sdg.js CAREER_SDGS)
     */
    renderCareerSdgs(career)
    {
        const sdg = this.state.sdg
        return `
            <h3>${esc(t('sdg.careerTitle'))}</h3>
            <ul class="career-sdg-list">
                ${career.sdgs.map((tag) => `
                <li style="--sdg:${sdg.goals[tag.goal].color}">
                    <span class="career-sdg-goal">${tag.goal}</span>
                    <span class="career-sdg-text">
                        <strong>${esc(tag.target)} · ${esc(pick(sdg.targets[tag.target]))}</strong>
                        <small>SDG ${tag.goal} ${esc(pick(sdg.goals[tag.goal].name))}</small>
                        <span>${esc(tag.why ? pick(tag.why) : t('sdg.fromSkills'))}</span>
                    </span>
                </li>`).join('')}
            </ul>
            <p class="career-muted">${esc(t('sdg.careerNote'))} <a href="${esc(sdg.source.url)}" target="_blank" rel="noopener noreferrer">${esc(t('sdg.source'))} ↗</a></p>`
    }

    /**
     * SDG panel: how far the player's preparation for the target career moves each goal, and the 17 goals to explore
     */
    renderSdg()
    {
        const sdg = this.state.sdg
        const contribution = sdg.contribution
        const career = contribution && this.state.careers.find((item) => item.id === contribution.careerId)
        const touched = new Set(contribution?.goals.map((item) => item.goal) ?? [])

        const goals = career ? `
            <p>${esc(t('sdg.path', { career: pick(career.name) }))}</p>
            <ul class="career-sdg-progress">
                ${contribution.goals.map((item) => `
                <li style="--sdg:${sdg.goals[item.goal].color}">
                    <span class="career-sdg-goal">${item.goal}</span>
                    <span class="career-sdg-text">
                        <strong>${esc(pick(sdg.goals[item.goal].name))}</strong>
                        <small>${item.targets.map((target) => `${esc(target)} ${esc(pick(sdg.targets[target]))}`).join(' · ')}</small>
                        <span class="career-sdg-bar">${bar(item.progress)}<em>${item.progress}%</em></span>
                        <small>${esc(t(item.career ? 'sdg.byCareer' : item.skillIds.length ? 'sdg.bySkills' : 'sdg.byLearning'))}${item.skillIds.length ? ` · ${esc(item.skillIds.map((id) => this.skillName(id, id)).join('、'))}` : ''}</small>
                    </span>
                </li>`).join('')}
            </ul>
            <p class="career-muted">${esc(t('sdg.progressNote'))}</p>` : `
            <p>${esc(t('sdg.none'))}</p>
            <button class="career-button" data-action="menu" data-panel="careers">${esc(t('menu.careers'))}</button>`

        return [ t('sdg.title'), `
            <p>${esc(t('sdg.intro'))}</p>
            ${goals}
            <h3>${esc(t('sdg.allTitle'))}</h3>
            <p class="career-muted">${esc(t('sdg.allHelp'))}</p>
            <div class="career-sdg-grid">
                ${Object.entries(sdg.goals).map(([ goal, info ]) => {
                    const count = this.state.careers.filter((item) => item.sdgs.some((tag) => tag.goal === Number(goal))).length
                    return `
                    <button class="career-sdg-tile ${touched.has(Number(goal)) ? 'is-touched' : ''}" style="--sdg:${info.color}" data-action="sdg-explore" data-goal="${goal}" ${count ? '' : 'disabled'}>
                        <b>${goal}</b><span>${esc(pick(info.name))}</span><small>${esc(t('sdg.careerCount', { n: count }))}</small>
                    </button>`
                }).join('')}
            </div>
            <p class="career-muted">${esc(t('sdg.note'))} <a href="${esc(sdg.source.url)}" target="_blank" rel="noopener noreferrer">${esc(t('sdg.source'))} ↗</a></p>
        ` ]
    }

    renderPosting(posting, color)
    {
        return `
            <h3>${esc(t('posting.title'))}: ${esc(posting.title)} · ${esc(posting.company)}</h3>
            <p class="career-muted">${esc(posting.summary)}</p>
            <ul class="career-skill-grid career-posting-cards" style="--skill-accent:${color}">${posting.requirements.map((requirement, index) => this.renderRequirementCard(requirement, index)).join('')}
            </ul>
            <p class="career-muted">${esc(t('mode.disclaimer'))}</p>
        `
    }

    /**
     * One requirement of the uploaded posting as a skill card: the posting's wording, the catalog skill it maps to
     * (icon, heat, difficulty) and the player's level against the level it implies
     */
    renderRequirementCard(requirement, index)
    {
        const detail = this.state.skillDetails[requirement.skillId]
        const current = this.state.profile.skills.find((skill) => skill.id === requirement.skillId)?.level ?? 0
        const required = Math.max(1, requirement.level || 1)
        const progress = requirement.status === 'met' ? 100 : Math.round(Math.min(current, required) / required * 100)
        const colors = [ '#f5d85f', '#ffad62', '#ff71ac', '#68cf98', '#79b8fa' ]
        return `
            <li class="career-skill-card career-posting-card is-${esc(requirement.status)}" data-skill="${esc(requirement.skillId)}">
                <header class="career-skill-card-header">
                    <span class="career-skill-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${SKILL_ICONS[detail?.icon] ?? SKILL_ICONS.check}</svg></span>
                    <h4>${esc(requirement.text)}</h4>
                    <div class="career-skill-mastery" role="meter" aria-label="${esc(requirement.text)} · ${esc(t('skill.mastery'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
                        <span class="career-skill-stones" aria-hidden="true">${colors.map((color, stone) => `<i class="${progress >= (stone + 1) * 20 ? 'is-filled' : ''}" style="--stone:${color}"></i>`).join('')}</span>
                        <small class="career-status">${esc(t(`posting.status.${requirement.status}`))}</small>
                    </div>
                </header>
                <p class="career-posting-tags">
                    <span class="career-tag is-${esc(requirement.priority)}">R${index + 1} · ${esc(t(`posting.${requirement.priority}`))}</span>
                    ${detail && this.skillName(requirement.skillId) !== requirement.text ? `<span class="career-tag">${esc(this.skillName(requirement.skillId))}</span>` : ''}
                </p>
                ${detail ? `
                <dl class="career-skill-stats">
                    <div><dt title="${esc(t('skill.market'))}">${esc(t('skill.heat'))}</dt><dd>${detail.heat === null || detail.heat === undefined ? esc(t('market.noData')) : `${detail.heat}%`}</dd></div>
                    ${this.skillTrendStat(requirement.skillId)}
                    ${this.skillYearOnYear(requirement.skillId)}
                    <div><dt>${esc(t('skill.difficulty'))}</dt><dd>${detail.difficulty}/5</dd></div>
                </dl>` : ''}
                ${requirement.note ? `<p class="career-skill-description">${esc(requirement.note)}</p>` : ''}
                <p class="career-skill-requirement">${esc(t('careers.yours', { c: t(`level.${Math.min(3, current)}`) }))} / ${esc(t('careers.required', { r: t(`level.${Math.min(3, required)}`) }))}</p>
            </li>`
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
            <p class="career-muted career-skill-reference">${esc(t(this.state.trends?.sample ? 'market.sampleSkillReference' : 'skill.reference'))}</p>
            <ul class="career-skill-grid career-pet-skills" style="--skill-accent:${career.color}">${pet.skills.map((skill) => this.renderSkillCard(skill)).join('')}
            </ul>
        ` ]
    }

    /**
     * Trend row of a skill card: share of the postings and its change from the job market workflow, nothing without data
     */
    skillTrendStat(skillId)
    {
        const market = this.state.skillMarket?.[skillId]
        if(!market)
            return ''
        if(market.sample)
            return `<div><dt title="${esc(t('market.sampleSkills', { n: market.denominator }))}">${esc(t('skill.trend'))}</dt><dd>${esc(t('market.accumulating'))}</dd></div>`
        if(!market.live)
            return ''
        const direction = market.change > 0 ? 'up' : market.change < 0 ? 'down' : 'flat'
        const change = market.change === null ? '' : ` ${t('careers.skillChange', { arrow: market.change > 0 ? '↑' : market.change < 0 ? '↓' : '→', n: Math.abs(market.change) })}`
        return `<div><dt title="${esc(t('skill.trendLive', { period: periodLabel(market.period) }))}">${esc(t('skill.trend'))}</dt><dd class="career-skill-trend-change is-${direction}">${esc(t('skill.trendShare', { p: market.share }))}${esc(change)}</dd></div>`
    }

    /**
     * JobStreet 2024→2025 change of a career or skill (server/reference-trend.js), with how it was measured
     */
    yearOnYearLine(row, key)
    {
        const shown = yearOnYearText(row, { t })
        if(!shown)
            return ''
        const window = this.state.trends.yearOnYear.window.periods[0]
        return `<p class="career-muted career-yoy is-${shown.direction}">${esc(t(key, { from: window.from.slice(5), to: window.to.slice(5), arrow: shown.arrow }))} · ${esc(shown.text)}</p>`
    }

    skillYearOnYear(skillId)
    {
        const shown = yearOnYearText(this.state.trends?.yearOnYear?.skills[skillId], { t })
        return shown ? `<div><dt title="${esc(shown.text)}">${esc(t('skill.yoy'))}</dt><dd class="career-skill-trend-change is-${shown.direction}">${esc(shown.arrow)}</dd></div>` : ''
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
                    <div><dt title="${esc(t('skill.market'))}">${esc(t('skill.heat'))}</dt><dd>${detail.heat === null || detail.heat === undefined ? esc(t('market.noData')) : `${detail.heat}%`}</dd></div>
                    ${this.skillTrendStat(skill.id)}
                    ${this.skillYearOnYear(skill.id)}
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
        const learningPanel = renderLearningPanel(state, this.drafts, { t, esc, skillName: id => this.skillName(id, id), locale: getLang() === 'zh' ? 'zh-CN' : getLang() })
        if(!state.roadmap)
            return [ t('roadmap.title'), `${learningPanel}${this.renderPostingWatch()}<p>${esc(t('roadmap.intro'))}</p>${state.target.posting?.monitor?.requiresRegeneration ? '' : `<button class="career-button is-wide" data-action="roadmap">${esc(t('roadmap.generate'))}</button>`}` ]

        return [ t('roadmap.title'), learningPanel + this.renderPostingWatch() + this.renderRoadmapMap() ]
    }

    renderPostingWatch()
    {
        const target = this.state.target
        if(target?.mode !== 'customise') return ''
        const monitor = target.posting?.monitor
        if(!monitor) return `<section class="career-notice">
            <p>${esc(t('watch.missing'))}</p>
            <div class="career-row career-posting-track">
                <label>${esc(t('watch.sourceLabel'))}<input type="url" data-draft="postingTrackUrl" value="${esc(this.drafts.postingTrackUrl ?? '')}" placeholder="https://www.linkedin.com/jobs/view/…"></label>
                <button class="career-button" data-action="track-posting">${esc(t('watch.attach'))}</button>
            </div>
        </section>`
        return `<section class="career-notice ${monitor.requiresRegeneration ? 'is-warning' : 'is-info'}" role="status">
            <p>${esc(t(monitor.requiresRegeneration ? 'watch.changed' : 'watch.tracking'))}</p>
            <a href="${esc(monitor.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('watch.openSource'))}</a>
            <p>${esc(t('watch.lastChecked', { at: monitor.lastCheckedAt ? new Date(monitor.lastCheckedAt).toLocaleString() : '—' }))}</p>
            ${monitor.lastError ? `<p>${esc(t('watch.failed'))} (${esc(monitor.lastError)})</p>` : ''}
            ${monitor.pending ? `<details><summary>${esc(t('watch.review'))}</summary><strong>${esc(monitor.pending.title)}</strong><p style="white-space:pre-wrap">${esc(monitor.pending.description)}</p></details><button class="career-button" data-action="refresh-posting">${esc(t('watch.regenerate'))}</button>` : ''}
        </section>`
    }

    /**
     * Roadmap as a treasure map on an unrolled scroll: a responsive winding trail shows all stages without horizontal scrolling,
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

        // Fit every flag and the chest to the board width, folding the route into alternating rows.
        const width = this.root.clientWidth || window.innerWidth
        const columns = width < 640 ? 2 : width < 1000 ? 3 : 4
        this.mapColumns = columns
        const rows = Math.ceil((stages.length + 1) / columns)
        const mapHeight = Math.max(440, 320 + (rows - 1) * 140)
        const inset = columns === 2 ? 25 : 12
        const trail = Array.from({ length: stages.length + 1 }, (_, index) =>
        {
            const row = Math.floor(index / columns)
            const column = row % 2 ? columns - 1 - index % columns : index % columns
            return { x: inset + column * (100 - inset * 2) / (columns - 1),
                y: 100 * (rows === 1 ? 280 : 240 + row * (mapHeight - 320) / (rows - 1)) / mapHeight }
        })
        const points = trail.slice(0, -1)
        const chest = trail.at(-1)
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
            const alternative = stage.status === 'alternative'
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
                <div class="career-map-note ${right ? 'is-right' : 'is-left'}" style="${right ? `left:${point.x}%` : `right:${100 - point.x}%`};max-width:${right ? 100 - point.x : point.x}%">
                    <article class="career-map-card">
                        <span class="career-map-card-index">${esc(t('roadmap.stage', { n: index + 1 }))}</span>
                        <strong class="career-map-card-title">${esc(stage.title)}</strong>
                        <div class="career-map-tags">
                            <span class="career-tag is-${stage.status}">${esc(t(`roadmap.status.${stage.status}`))}</span>
                            ${stage.branch ? `<span class="career-tag">${esc(t(`scenario.${stage.branch}`))}</span>` : ''}
                            <span class="career-tag is-mp">${esc(t('roadmap.mp', { n: stage.mp }))}</span>
                            ${stage.forced && stage.status === 'active' ? `<span class="career-tag is-forced">${esc(t('roadmap.forced'))}</span>` : ''}
                        </div>
                        <div class="career-map-progress">${bar(stage.progress)}<small>${esc(t('roadmap.tasksDone', { done, total: stage.tasks.length }))}</small></div>
                        <p class="career-map-why">${icon('target')}<span><b>${esc(t('roadmap.why'))}</b>${esc(stage.why)}</span></p>
                        ${this.renderStageSdgs(stage)}
                        ${this.renderStageResources(stage)}
                        ${stage.requirementRefs.length ? `<p class="career-muted">${esc(t('roadmap.covers', { refs: stage.requirementRefs.join(', ') }))}</p>` : ''}
                        ${alternative ? `<p class="career-muted">${esc(t('learning.otherBranch'))}</p>` : ''}
                        ${locked ? this.renderStageLock(stage, stage.prerequisites.map(stageTitle).join(', ')) : `
                        ${stage.prerequisites.length ? `<p class="career-map-lock">${icon('lock')}${esc(t('roadmap.needs', { stages: stage.prerequisites.map(stageTitle).join(', ') }))}</p>` : ''}
                        <ul class="career-tasks">${stage.tasks.map((task) => `
                            <li>
                                <label>
                                    <input type="checkbox" data-task="${task.id}" ${task.progress >= 100 ? 'checked' : ''} ${locked || alternative ? 'disabled' : ''}>
                                    <span>${esc(task.title)}<small>${esc(task.why)}</small>${task.deliverable ? `<small>${esc(t('learning.deliverable'))}: ${esc(task.deliverable)}</small>` : ''}${task.completionCriteria ? `<small>${esc(t('learning.criteria'))}: ${esc(task.completionCriteria)}</small>` : ''}</span>
                                </label>
                                <span class="career-tag is-mp">${esc(t('roadmap.mp', { n: task.mp }))}</span>
                                ${bar(task.progress, 'is-thin')}
                            </li>`).join('')}
                        </ul>`}
                    </article>
                </div>
            </div>`
        }).join('')

        const walked = stages.filter(stage => stage.status !== 'alternative')
        const allCleared = walked.length > 0 && walked.every((stage) => stage.status === 'cleared')

        return `
            <div class="career-map">
                <div class="career-map-viewport">
                    <div class="career-map-board" style="--map-height:${mapHeight}px;background-image:url(ui/map/map-day.webp)">
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
                    <p><span>${esc(state.roadmap.overview)}</span><small>${esc(t('roadmap.intro'))} ${esc(t('roadmap.mpNote'))}${state.roadmap.oneLanguage ? ` ${esc(t('roadmap.oneLanguage'))}` : ''}</small></p>
                    <button class="career-button is-secondary" data-action="roadmap" data-confirm="1">${esc(t('roadmap.regenerate'))}</button>
                </footer>
            </div>`
    }

    /**
     * SDG targets the stage skills move (server/sdg.js SKILL_TARGETS)
     */
    renderStageSdgs(stage)
    {
        const skillIds = [ ...new Set([ ...stage.skillIds, ...stage.tasks.map((task) => task.skillId) ]) ]
        const targets = [ ...new Set(skillIds.flatMap((id) => this.state.sdg.skills[id] ?? [])) ]
        if(!targets.length)
            return ''
        return `<p class="career-map-sdgs"><b>${esc(t('sdg.stage'))}</b>${targets.map((target) => this.sdgBadge(Number(target.split('.')[0]), target)).join('')}</p>`
    }

    /**
     * Where to start learning the stage skills (server/skill-details.js RESOURCES), nothing for custom skills
     */
    renderStageResources(stage)
    {
        const skillIds = [ ...new Set([ ...stage.skillIds, ...stage.tasks.map((task) => task.skillId) ]) ]
        const resources = skillIds.map((id) => this.state.skillDetails[id]?.resource).filter(Boolean)
        if(!resources.length)
            return ''

        return `
            <div class="career-map-resources">
                <b>${icon('compass')}${esc(t('roadmap.startHere'))}</b>
                ${resources.map((resource) => `
                <a href="${esc(resource.url)}" target="_blank" rel="noopener noreferrer">
                    <span>${esc(resource.title)} ↗</span>
                    <small>${esc(t(resource.open ? 'roadmap.resourceOpen' : 'roadmap.resourceFree'))}</small>
                </a>`).join('')}
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
                    <span>${esc(log.text)}${log.verdict && log.verdict !== 'learned' ? ` <em class="career-tag is-off-map">${esc(t(`log.verdict.${log.verdict}`))}</em>` : ''}</span>
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
            <h3>${esc(t('tutorial.label'))}</h3>
            <button class="career-button is-secondary" data-action="tutorial">${esc(t('tutorial.replay'))}</button>
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
        this.stopStreamTimers()
        // A question still being answered: stop it (the server stops the AI call) and the thought bubble
        this.dialogue.aborter?.abort()
        this.game.career.world.setThinking(null)
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

        const expert = career.expert

        const menu = [
            { text: t('npc.ask.about'), to: 'about' },
            { text: t('npc.ask.fit'), to: 'fit' },
            { text: t('npc.ask.market'), to: 'market' },
            { text: t('npc.ask.question'), action: () => this.startAsk(false) },
            // Every career offers its elite; one not distilled yet (server/experts.js) is explained instead of hidden
            expert
                ? { text: t('npc.ask.expert', { name: expert.name }), action: () => this.startAsk(true) }
                : { text: t('npc.ask.expertNone'), to: 'noExpert' },
            { text: t('npc.ask.target'), action: () => this.setTargetFromDialogue(careerId), if: !isTarget },
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
                lines: [ career.market.sample ? `${t('market.sampleShare', { p: career.market.heat })} · ${t('market.sampleAds', { n: career.market.snapshot.postings })} · ${t('market.accumulating')}` : t('npc.marketNoData', { range }) ],
                choices: menu,
            },
            noExpert: {
                lines: [ t('npc.expertMissing', { career: name }) ],
                choices: menu,
            },
            // Target just set from the dialogue: tailor it to a posting, plan the roadmap, or leave
            target: {
                lines: [ this.dialogue?.targetError ?? t('npc.targetDone', { career: name, pet: career.pet.name }) ],
                choices: this.dialogue?.targetError ? [ { text: t('common.back'), to: 'greet' } ] : [
                    { text: t('npc.targetCustomise'), action: () => this.openPanel('careers', { careerId, mode: 'customise' }) },
                    { text: t('npc.targetRoadmap'), action: () => this.openPanel('roadmap') },
                    { text: t('npc.ask.bye'), to: 'bye' },
                ],
            },
            // The player types a question, the mentor answers as a professional of the field, or the career's distilled
            // industry elite answers (dialogue.expert, server/experts.js) after being introduced as a perspective from public record
            ask: {
                lines: this.dialogue?.expert
                    ? (this.dialogue.expertMet ? [ t('npc.expertAgain', { name: expert.name }) ] : [ t('npc.expertIntro', { name: expert.name, tagline: pick(expert.tagline) }), t('npc.expertNote', { name: expert.name }) ])
                    : [ t('npc.askIntro') ],
                input: true,
                choices: [],
            },
            // Waiting for the first words: ". .. ..." in the box, a thought bubble over the mentor (CareerWorld.setThinking)
            thinking: {
                lines: [ '' ],
                dots: true,
                waiting: true,
                choices: [],
            },
            // Typed out as it streams in, paged on sentence ends (typeStream)
            answer: {
                lines: [ '' ],
                streamed: true,
                choices: [
                    { text: t('npc.ask.more'), to: 'ask' },
                    { text: t('npc.ask.menu'), to: 'greet' },
                    { text: t('npc.ask.bye'), to: 'bye' },
                ],
            },
            bye: {
                lines: [ t('npc.bye') ],
                choices: [],
            },
        }
    }

    /**
     * "I want this career as my goal": set it as the target in general mode right away (the career panel can still
     * tailor it to a posting), the pet pops out and the mentor confirms
     */
    async setTargetFromDialogue(careerId)
    {
        const dialogue = this.dialogue
        if(!dialogue || dialogue.settingTarget)
            return
        dialogue.settingTarget = true
        dialogue.targetError = null
        try
        {
            await this.api.setTarget(careerId, 'general', '', null, false)
            this.game.career.world.celebratePet()
        }
        catch(error)
        {
            const key = `error.${error.code}`
            dialogue.targetError = t(key) === key ? t('error.generic') : t(key)
        }
        dialogue.settingTarget = false
        if(this.dialogue !== dialogue)
            return
        dialogue.turn = (dialogue.turn ?? 0) + 1
        Object.assign(dialogue, { node: 'target', page: 0, selected: 0 })
        this.renderDialogue()
    }

    /**
     * Ask the mentor (expert false) or hand over to the industry elite (expert true): switching starts a fresh
     * conversation, the history of one is not the other's
     */
    startAsk(expert)
    {
        const dialogue = this.dialogue
        if(dialogue.expert !== expert)
            dialogue.history = []
        dialogue.expert = expert
        dialogue.turn = (dialogue.turn ?? 0) + 1
        Object.assign(dialogue, { node: 'ask', page: 0, selected: 0 })
        this.renderDialogue()
    }

    /**
     * Send the typed question: the mentor thinks (". .. ..." and a thought bubble) until the first words arrive,
     * then the answer is typed out as it streams in (typeStream)
     */
    async askMentor(question)
    {
        const dialogue = this.dialogue
        const attachment = dialogue?.file ?? null
        question = question.trim() || (attachment ? t('npc.askFileDefault') : '')
        if(!dialogue || !question || dialogue.node !== 'ask')
            return

        dialogue.history ??= []
        const stream = dialogue.stream = { text: '', done: false, at: 0, page: 0, full: false }
        dialogue.aborter = new AbortController()
        this.showDialogueNode('thinking')
        this.game.career.world.setThinking(dialogue.careerId)

        // First words: the thought bubble pops, the answer box takes over
        const onText = (piece) =>
        {
            if(this.dialogue !== dialogue)
                return
            stream.text += piece
            if(dialogue.node === 'thinking')
            {
                this.game.career.world.setThinking(null)
                this.showDialogueNode('answer')
            }
            else
                this.typeStream()
        }

        try
        {
            const file = attachment ? await readFile(attachment) : null
            const answer = await this.api.askMentorStream(dialogue.careerId, question, dialogue.history, file, Boolean(dialogue.expert), onText, dialogue.aborter.signal)
            if(!stream.text.trim())
                stream.text = answer
            // Later turns only keep the file name, the file itself is sent once
            dialogue.history.push({ role: 'user', content: attachment ? `${question}\n[${attachment.name}]` : question }, { role: 'assistant', content: answer })
            dialogue.file = null
            // The elite's introduction and disclaimer show before the first answer only
            if(dialogue.expert)
                dialogue.expertMet = true
        }
        catch(error)
        {
            // Left meanwhile (the request was aborted)
            if(this.dialogue !== dialogue)
                return
            const key = `error.${error.code}`
            const message = t('npc.askError', { reason: t(key) === key ? t('error.generic') : t(key) })
            stream.text = stream.text.trim() ? `${stream.text}\n${message}` : message
        }

        if(this.dialogue !== dialogue)
            return
        this.game.career.world.setThinking(null)
        stream.done = true
        if(dialogue.node === 'thinking')
            this.showDialogueNode('answer')
        else
            this.typeStream()
    }

    showDialogueNode(node)
    {
        const dialogue = this.dialogue
        dialogue.turn = (dialogue.turn ?? 0) + 1
        Object.assign(dialogue, { node, page: 0, selected: 0 })
        this.renderDialogue()
    }

    /**
     * Streamed answer typed out quickly as it arrives, like a chat assistant. A page ends at the first sentence end
     * once it is long enough (a paragraph break earlier, any space when a sentence runs on): the typing waits there
     * for Enter while the rest keeps arriving
     */
    typeStream()
    {
        const dialogue = this.dialogue
        if(!dialogue?.stream || dialogue.node !== 'answer' || this.streamInterval)
            return
        this.dialogueElement.classList.remove('is-typed', 'has-choices')
        dialogue.typing = true
        this.streamInterval = setInterval(() => this.streamStep(), getLang() === 'zh' ? 28 : 12)
        this.streamStep()
    }

    // fast: Enter while typing, everything received up to the page end at once
    streamStep(fast = false)
    {
        const dialogue = this.dialogue
        const stream = dialogue?.stream
        const line = this.dialogueElement.querySelector('.career-dialogue-line')
        if(!stream || dialogue.node !== 'answer' || !line)
            return this.stopStreamTimers()

        let steps = fast ? Infinity : getLang() === 'zh' ? 1 : 2
        while(steps > 0 && !stream.full && stream.at < stream.text.length)
        {
            // No blank at the top of a page
            if(stream.at === stream.page && /\s/.test(stream.text[stream.at]))
            {
                stream.page = ++stream.at
                continue
            }
            stream.at++
            stream.full = this.pageEnds(stream)
            steps--
        }
        line.textContent = stream.text.slice(stream.page, stream.at)

        // Page full, or all received: stop until Enter or more text
        if(stream.full || stream.at >= stream.text.length)
        {
            this.stopStreamTimers()
            // Only blanks left after a full page of a finished answer: that page is the last
            if(stream.full && stream.done && !stream.text.slice(stream.at).trim())
            {
                stream.full = false
                stream.at = stream.text.length
            }
            const finished = stream.done && !stream.full && stream.at >= stream.text.length
            dialogue.typing = !finished
            this.dialogueElement.classList.toggle('is-typed', stream.full || finished)
            this.dialogueElement.classList.toggle('has-choices', finished)
            if(finished)
                this.highlightChoice()
        }
    }

    pageEnds(stream)
    {
        const limit = getLang() === 'zh' ? 90 : 230
        const length = stream.at - stream.page
        const last = stream.text[stream.at - 1]
        const next = stream.text[stream.at]
        // Not received yet: can't tell whether "3." ends a sentence
        if(next === undefined)
            return false
        if(next === '\n')
            return length >= limit * 0.3
        // After 。！？ or after . ! ? followed by a space (keeps "Node.js", "3.5", "e.g.x" whole)
        const sentenceEnd = /[。！？]/.test(last) || (/[.!?]/.test(last) && /\s/.test(next))
        if(sentenceEnd && length >= limit * 0.6)
            return true
        return length >= limit * 1.3 && (getLang() === 'zh' || /\s/.test(next))
    }

    stopStreamTimers()
    {
        clearInterval(this.streamInterval)
        clearInterval(this.dotsInterval)
        this.streamInterval = null
        this.dotsInterval = null
    }

    // The file attached to the next question: a chip with its name (a thumbnail for images) and a remove button
    renderAskFile()
    {
        const chip = this.dialogueElement.querySelector('.career-dialogue-file')
        if(!chip)
            return
        URL.revokeObjectURL(this.askFileUrl)
        const file = this.dialogue?.file
        chip.hidden = !file
        if(!file)
            return chip.replaceChildren()
        this.askFileUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        chip.innerHTML = `
            ${this.askFileUrl ? `<img src="${this.askFileUrl}" alt="">` : ''}
            <span>${esc(file.name)}</span>
            <button type="button" data-action="ask-file-remove" aria-label="${esc(t('common.remove'))}">×</button>`
    }

    attachToQuestion(file)
    {
        if(!this.dialogue || !file)
            return
        if(!ASK_FILE_TYPES.split(',').includes(file.type))
            return this.showAskError('error.file-type')
        if(file.size > 10 * 1024 * 1024)
            return this.showAskError('error.file-too-large')
        this.dialogue.file = file
        this.renderAskFile()
        this.dialogueElement.querySelector('.career-dialogue-ask input[type="text"]')?.focus()
    }

    // Wrong file: said in the field's placeholder for a moment
    showAskError(key)
    {
        const field = this.dialogueElement.querySelector('.career-dialogue-ask input[type="text"]')
        if(!field)
            return
        field.value = ''
        field.placeholder = t(key)
        field.classList.add('is-error')
        clearTimeout(this.askErrorTimeout)
        this.askErrorTimeout = setTimeout(() =>
        {
            field.placeholder = t('npc.askPlaceholder')
            field.classList.remove('is-error')
        }, 3000)
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

        // Streamed answer: next page, or the rest received so far at once; the choices once all is shown
        const stream = dialogue.node === 'answer' && dialogue.stream
        if(stream && stream.full)
        {
            stream.full = false
            stream.page = stream.at
            this.dialogueElement.querySelector('.career-dialogue-line').textContent = ''
            return this.typeStream()
        }
        if(stream && stream.at < stream.text.length)
            return this.streamStep(true)
        if(stream && !stream.done)
            return

        if(dialogue.typing)
            return this.finishTyping()

        if(!this.isLastPage())
        {
            dialogue.page++
            return this.renderDialogue()
        }

        const node = this.currentNode()
        if(node.input)
            this.dialogueElement.querySelector('.career-dialogue-ask input')?.focus()
        else if(node.waiting)
            return
        else if(this.currentChoices().length)
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
        const askField = this.currentNode().input && this.dialogueElement.querySelector('.career-dialogue-ask input[type="text"]')
        this.dialogueElement.classList.toggle('has-ask', Boolean(askField))
        this.renderAskFile()
        askField?.focus({ preventScroll: true })
    }

    renderDialogue()
    {
        if(!this.dialogue || !this.state)
            return

        // Only rebuild when the page changes, so state updates don't restart the typing
        const key = `${this.dialogue.node}:${this.dialogue.page}:${this.dialogue.turn ?? 0}`
        if(this.dialogue.rendered === key)
            return
        this.dialogue.rendered = key

        const career = this.state.careers.find((item) => item.id === this.dialogue.careerId)
        const node = this.currentNode()
        const choices = this.isLastPage() ? this.currentChoices() : []
        // The industry elite speaks in the question / answer nodes, the mentor everywhere else
        const expertSpeaks = this.dialogue.expert && career.expert && [ 'ask', 'thinking', 'answer' ].includes(this.dialogue.node)
        const speaker = expertSpeaks ? t('npc.expertName', { name: career.expert.name }) : t('npc.leader', { career: pick(career.name) })

        this.dialogueElement.style.setProperty('--career', career.color)
        this.dialogueElement.classList.remove('is-typed', 'has-choices', 'has-ask')
        this.dialogueElement.innerHTML = `
            <div class="career-dialogue-choices" role="menu">
                ${choices.map((choice, index) => `<button role="menuitem" data-action="choice" data-index="${index}">${esc(choice.text)}</button>`).join('')}
            </div>
            ${node.input ? `
            <form class="career-dialogue-ask">
                <label class="career-dialogue-attach" title="${esc(t('npc.askAttach'))}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 11.5-8.2 8.2a5.2 5.2 0 0 1-7.4-7.4l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></svg>
                    <input type="file" data-ask-file accept="${ASK_FILE_TYPES}" aria-label="${esc(t('npc.askAttach'))}" hidden>
                </label>
                <span class="career-dialogue-file" hidden></span>
                <input type="text" maxlength="500" placeholder="${esc(t('npc.askPlaceholder'))}" aria-label="${esc(t('npc.askPlaceholder'))}" autocomplete="off">
                <button type="submit">${esc(t('npc.askSend'))}</button>
                <button type="button" data-action="dialogue-menu">${esc(t('common.back'))}</button>
            </form>` : ''}
            <div class="career-dialogue-box" data-action="dialogue-advance">
                <div class="career-dialogue-name">${esc(speaker)}</div>
                <p class="career-dialogue-line" aria-live="polite"></p>
                <svg class="career-dialogue-next" viewBox="0 0 24 24" role="img" aria-label="${esc(t('npc.continue'))}"><path d="M5 9l7 7 7-7"/></svg>
                <kbd class="career-key-hint career-dialogue-enter">${esc(t('hint.pressEnter'))}</kbd>
            </div>
        `

        clearInterval(this.typingInterval)
        this.stopStreamTimers()
        const line = this.dialogueElement.querySelector('.career-dialogue-line')

        // Thinking: dots counting up in the box until the first words arrive
        if(node.dots)
        {
            let count = 0
            line.setAttribute('aria-label', t('npc.thinking'))
            line.textContent = '.'
            this.dialogue.typing = false
            this.dotsInterval = setInterval(() =>
            {
                count = (count + 1) % 3
                line.textContent = '.'.repeat(count + 1)
            }, 380)
            return
        }

        // Streamed answer: typed out as it comes in
        if(node.streamed && this.dialogue.stream)
        {
            const stream = this.dialogue.stream
            line.textContent = stream.text.slice(stream.page, stream.at)
            return this.typeStream()
        }

        // Type the line out
        this.typingText = node.lines[this.dialogue.page]
        const characters = [ ...this.typingText ]
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
