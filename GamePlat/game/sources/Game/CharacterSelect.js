import { Game } from './Game.js'
import { t, pick } from '../Career/i18n.js'

/**
 * Playable characters, picked on the intro circle before the reveal (A / D to browse, Enter to confirm)
 * path is relative to static/, null = empty slot (not playable yet)
 * Models are rigged with animation/build.py (clips: idle, walk, run, jump, crouch, crouchWalk...)
 * The map portrait is static/ui/avatars/<id>.png (animation/portrait.py)
 */
export const CHARACTERS = [
    { id: 'QX',       path: 'characters/QX/QX.glb',              name: { zh: 'QX', en: 'QX', ms: 'QX' } },
    { id: 'Aloysius', path: 'characters/Aloysius/Aloysius.glb',  name: { zh: 'Aloysius', en: 'Aloysius', ms: 'Aloysius' } },
    { id: 'Edixon',   path: 'characters/Edixon/Edixon.glb',      name: { zh: 'Edixon', en: 'Edixon', ms: 'Edixon' } },
    { id: 'LeeKhim',  path: 'characters/LeeKhim/LeeKhim.glb',    name: { zh: 'Lee Khim', en: 'Lee Khim', ms: 'Lee Khim' } },
    { id: 'Nks',      path: 'characters/Nks/Nks.glb',            name: { zh: 'Nks', en: 'Nks', ms: 'Nks' } },
    { id: 'Jing',     path: 'characters/Jing/Jing.glb',          name: { zh: 'Jing', en: 'Jing', ms: 'Jing' } },
]

const STORAGE_KEY = 'playerCharacter'

export class CharacterSelect
{
    // Saved choice (falls back to the first playable character)
    static getSaved()
    {
        let id = null
        try
        {
            id = localStorage.getItem(STORAGE_KEY)
        }
        catch {}

        return CHARACTERS.find((character) => character.id === id && character.path) ?? CHARACTERS[0]
    }

    constructor()
    {
        this.game = Game.getInstance()

        this.index = CHARACTERS.indexOf(CharacterSelect.getSaved())
        this.selected = CHARACTERS[this.index] // Character in play this session (portraits read it, localStorage can be unavailable)
        this.active = false
        this.onConfirm = null

        // Loaded gltf promises by id, the saved one is already loaded as playerCharacter
        this.loads = new Map()
        this.loads.set(CHARACTERS[this.index].id, Promise.resolve(this.game.resources.playerCharacter))
        this.game.world.visualVehicle.currentCharacterId = CHARACTERS[this.index].id
        this.setMapAvatar(CHARACTERS[this.index])

        this.setElement()
        this.setInputs()
    }

    // Player marker on the M map (the element is in the page markup, Map.js only wires it on the first open)
    setMapAvatar(character)
    {
        this.game.map.element.querySelector('.js-player')?.style.setProperty('--avatar', `url(ui/avatars/${character.id}.png)`)
        this.game.world.areas.landing?.guildLeaderboard?.setPlayerCharacter(character.id)
    }

    setElement()
    {
        this.element = document.createElement('div')
        this.element.className = 'character-select'
        this.element.innerHTML = /* html */`
            <div class="character-select-title"></div>
            <div class="character-select-row">
                <button class="character-select-arrow js-prev" type="button"><span class="character-select-key">A</span>◀</button>
                <div class="character-select-card">
                    <div class="character-select-index"></div>
                    <div class="character-select-name"></div>
                </div>
                <button class="character-select-arrow js-next" type="button">▶<span class="character-select-key">D</span></button>
            </div>
            <div class="character-select-dots">
                ${CHARACTERS.map(() => '<span class="character-select-dot"></span>').join('')}
            </div>
            <div class="character-select-hint"></div>
        `
        this.game.domElement.appendChild(this.element)

        this.elements = {
            title: this.element.querySelector('.character-select-title'),
            card: this.element.querySelector('.character-select-card'),
            index: this.element.querySelector('.character-select-index'),
            name: this.element.querySelector('.character-select-name'),
            dots: [ ...this.element.querySelectorAll('.character-select-dot') ],
            hint: this.element.querySelector('.character-select-hint'),
        }

        this.element.querySelector('.js-prev').addEventListener('click', () => this.move(- 1))
        this.element.querySelector('.js-next').addEventListener('click', () => this.move(1))
    }

    setInputs()
    {
        this.game.inputs.addActions([
            { name: 'characterPrev',    categories: [ 'intro' ], keys: [ 'Keyboard.KeyA', 'Keyboard.ArrowLeft', 'Gamepad.left' ] },
            { name: 'characterNext',    categories: [ 'intro' ], keys: [ 'Keyboard.KeyD', 'Keyboard.ArrowRight', 'Gamepad.right' ] },
            { name: 'characterConfirm', categories: [ 'intro' ], keys: [ 'Keyboard.Enter', 'Gamepad.cross' ] },
        ])

        // Events also fire on release, only react to the press
        this.inputCallbacks = {
            characterPrev: (action) => { if(action.active) this.move(- 1) },
            characterNext: (action) => { if(action.active) this.move(1) },
            characterConfirm: (action) => { if(action.active) this.confirm() },
        }

        for(const name in this.inputCallbacks)
            this.game.inputs.events.on(name, this.inputCallbacks[name])
    }

    open(onConfirm)
    {
        this.onConfirm = onConfirm
        this.active = true
        this.element.classList.add('is-visible')
        this.select(this.index)

        // Warm up the other models so browsing is instant
        for(const character of CHARACTERS)
            this.load(character)
    }

    load(character)
    {
        if(!character.path)
            return null

        if(!this.loads.has(character.id))
        {
            const loader = this.game.resourcesLoader.getLoader('gltf')
            const promise = loader.loadAsync(character.path)
            promise.catch((error) => console.warn(`CharacterSelect: failed to load ${character.path}`, error))
            this.loads.set(character.id, promise)
        }

        return this.loads.get(character.id)
    }

    move(direction)
    {
        if(!this.active)
            return

        this.select((this.index + direction + CHARACTERS.length) % CHARACTERS.length)
    }

    async select(index)
    {
        this.index = index
        const character = CHARACTERS[index]
        const visual = this.game.world.visualVehicle

        this.render()

        // Empty slot => nobody on the circle
        if(!character.path)
        {
            visual.pivot.visible = false
            return
        }

        let gltf = null
        try
        {
            gltf = await this.load(character)
        }
        catch
        {
            return
        }

        // Browsed away while loading
        if(this.index !== index || !this.active)
            return

        if(visual.currentCharacterId !== character.id)
        {
            visual.setCharacter(gltf)
            visual.currentCharacterId = character.id
        }
        visual.pivot.visible = true
    }

    render()
    {
        const character = CHARACTERS[this.index]

        this.elements.title.textContent = t('characterSelect.title')
        this.elements.index.textContent = `${this.index + 1} / ${CHARACTERS.length}`
        this.elements.name.textContent = character.path ? pick(character.name) : t('characterSelect.empty')
        this.elements.hint.textContent = character.path ? t('characterSelect.hint') : t('characterSelect.emptyHint')
        this.elements.card.classList.toggle('is-empty', !character.path)

        this.elements.dots.forEach((dot, i) => dot.classList.toggle('is-active', i === this.index))

        // Retrigger the pop animation
        this.elements.card.classList.remove('is-pop')
        void this.elements.card.offsetWidth
        this.elements.card.classList.add('is-pop')
    }

    async confirm()
    {
        if(!this.active)
            return

        const character = CHARACTERS[this.index]

        if(!character.path)
        {
            this.elements.card.classList.remove('is-shake')
            void this.elements.card.offsetWidth
            this.elements.card.classList.add('is-shake')
            return
        }

        // Make sure the model on the circle is the confirmed one
        this.active = false
        try
        {
            const gltf = await this.load(character)
            const visual = this.game.world.visualVehicle
            if(visual.currentCharacterId !== character.id)
            {
                visual.setCharacter(gltf)
                visual.currentCharacterId = character.id
            }
            visual.pivot.visible = true
        }
        catch
        {
            this.active = true
            return
        }

        try
        {
            localStorage.setItem(STORAGE_KEY, character.id)
        }
        catch {}

        this.selected = character
        this.setMapAvatar(character)
        this.close()

        if(typeof this.onConfirm === 'function')
            this.onConfirm(character)
    }

    close()
    {
        this.active = false
        this.element.classList.remove('is-visible')

        for(const name in this.inputCallbacks)
            this.game.inputs.events.off(name, this.inputCallbacks[name])

        setTimeout(() => this.element.remove(), 400)
    }
}
