import * as THREE from 'three/webgpu'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { Game } from '../Game.js'
import { Track } from '../Tracks.js'
import { useGameMaterials, fitToHeight } from './Characters.js'

/**
 * Player character replacing VisualVehicle
 * Follows game.physicalVehicle (a PhysicsCharacter) and picks the animation from its state
 * Clips come from scripts/rig-character.py: idle, walk, run, jump, crouch, crouchWalk
 */
export class VisualCharacter
{
    constructor(gltf)
    {
        this.game = Game.getInstance()

        this.root = new THREE.Group()
        this.game.scene.add(this.root)

        // Inner group for the landing squash (at the feet), so it doesn't fight with the root transform
        this.body = new THREE.Group()
        this.root.add(this.body)

        // Pivot at mid height for the tumble when blown away
        this.pivot = new THREE.Group()
        this.pivot.position.y = this.game.physicalVehicle.halfHeight
        this.body.add(this.pivot)

        this.setModel(gltf)
        this.setAnimations(gltf)
        this.setSquash()
        this.setKnock()
        this.setSounds()
        this.setMainGroundTrack()
        this.setScreenPosition()

        this.tickCallback = () =>
        {
            this.update()
        }
        this.game.ticker.events.on('tick', this.tickCallback, 8)

        if(this.game.debug.active)
            this.setDebug()
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.tickCallback)
        this.root.removeFromParent()
        this.game.tracks.remove(this.mainGroundTrack)
    }

    setModel(gltf)
    {
        this.model = cloneSkinned(gltf.scene)
        useGameMaterials(this.model)
        fitToHeight(this.model, this.game.physicalVehicle.height)
        this.model.position.y -= this.pivot.position.y

        this.model.traverse((child) =>
        {
            if(child.isMesh)
                child.frustumCulled = false // Skinned bounds don't follow the animation
        })

        this.pivot.add(this.model)
    }

    setAnimations(gltf)
    {
        this.animations = {}
        this.animations.mixer = new THREE.AnimationMixer(this.model)
        this.animations.actions = {}
        this.animations.current = null

        for(const clip of gltf.animations)
            this.animations.actions[clip.name] = this.animations.mixer.clipAction(clip)

        // One shots hold their last pose (jump stays tucked while in the air)
        for(const name of [ 'jump', 'knockdown', 'getUp' ])
        {
            const action = this.animations.actions[name]
            if(action)
            {
                action.setLoop(THREE.LoopOnce, 1)
                action.clampWhenFinished = true
            }
        }

        this.animations.play = (name, fadeDuration = 0.2) =>
        {
            const action = this.animations.actions[name]

            if(!action || action === this.animations.current)
                return

            action.reset().setEffectiveTimeScale(1).fadeIn(fadeDuration).play()

            if(this.animations.current)
                this.animations.current.fadeOut(fadeDuration)

            this.animations.current = action
            this.animations.currentName = name
        }

        this.animations.play('idle', 0)

        // Restart the jump clip on every jump, even when already airborne (coyote time)
        this.game.physicalVehicle.events.on('jump', () =>
        {
            if(this.animations.currentName === 'jump')
                this.animations.current.reset().play()
            else
                this.animations.play('jump', 0.08)
        })
    }

    setSquash()
    {
        this.squash = {}
        this.squash.value = 0 // 1 = fully squashed
        this.squash.strength = 0.18

        this.game.physicalVehicle.events.on('land', () =>
        {
            // Bigger falls squash more
            this.squash.value = Math.min(1, Math.abs(this.squash.fallSpeed) / 8)
        })
        this.squash.fallSpeed = 0
    }

    setKnock()
    {
        // Blown away: fall (flailing, tumbling) > knockdown (on the butt, dazed) > getUp (rubs the butt) > back to control
        this.knock = {}
        this.knock.spin = 0
        this.knock.spinSpeed = 10 // rad/s backflip while going up

        const physical = this.game.physicalVehicle

        physical.events.on('knock', () =>
        {
            this.animations.play('fall', 0.1)
        })

        physical.events.on('knockLand', () =>
        {
            this.squash.value = 1
            this.sounds.knockLand.play()
            this.animations.play('knockdown', 0.06)
        })

        this.animations.mixer.addEventListener('finished', (event) =>
        {
            if(physical.knockState === 'none')
                return

            if(event.action === this.animations.actions.knockdown)
                this.animations.play('getUp', 0.25)
            else if(event.action === this.animations.actions.getUp)
                physical.standUp()
        })

        // Characters without the clips still get control back
        if(!this.animations.actions.knockdown || !this.animations.actions.getUp)
            physical.events.on('knockLand', () => physical.standUp())
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.jump = this.game.audio.register({
            path: 'sounds/swoosh/Swoosh 02.mp3',
            autoplay: false,
            loop: false,
            volume: 0.25,
            antiSpam: 0.1,
            onPlay: (item) =>
            {
                item.rate = 1.2 + Math.random() * 0.2
            }
        })
        this.sounds.land = this.game.audio.register({
            path: 'sounds/hits/defaults/Impact Soft 01.mp3',
            autoplay: false,
            loop: false,
            volume: 0.3,
            antiSpam: 0.15,
            onPlay: (item) =>
            {
                item.rate = 0.9 + Math.random() * 0.2
            }
        })

        this.sounds.knockLand = this.game.audio.register({
            path: 'sounds/hits/defaults/Short Stone Hit 01.mp3',
            autoplay: false,
            loop: false,
            volume: 0.5,
            antiSpam: 0.3,
            onPlay: (item) =>
            {
                item.rate = 0.8 + Math.random() * 0.1
            }
        })

        this.game.physicalVehicle.events.on('jump', () => this.sounds.jump.play())
        this.game.physicalVehicle.events.on('land', () => this.sounds.land.play())
    }

    setMainGroundTrack()
    {
        this.mainGroundTrack = this.game.tracks.add(new Track(0.6, 'g'))
    }

    setScreenPosition()
    {
        this.screenPosition = new THREE.Vector2(0, 0)
    }

    setDebug()
    {
        const debugPanel = this.game.debug.panel.addFolder({
            title: '🧒 Player character',
            expanded: false,
        })

        const buttons = {}
        for(const name in this.animations.actions)
            buttons[`play ${name}`] = () => this.animations.play(name)
        this.game.debug.addButtons(debugPanel, buttons)

        debugPanel.addBinding(this.squash, 'strength', { min: 0, max: 0.5, step: 0.001 })
    }

    updateAnimation()
    {
        const physical = this.game.physicalVehicle
        const speed = physical.xzSpeed

        // Knocked clips are driven by the knock events
        if(physical.knockState !== 'none')
        {
            this.animations.mixer.update(this.getAnimationDelta())
            return
        }

        let name = 'idle'
        let timeScale = 1

        if(!physical.grounded)
        {
            // Walking off an edge also shows the airborne pose once the fall lasts a little
            name = physical.jumping || physical.velocity.y / Math.max(this.game.ticker.deltaScaled, 1e-6) < - 2 ? 'jump' : this.animations.currentName
        }
        else if(physical.crouching)
        {
            if(speed > 0.4)
            {
                name = 'crouchWalk'
                timeScale = THREE.MathUtils.clamp(speed / physical.crouchSpeed, 0.5, 1.6)
            }
            else
            {
                name = 'crouch'
            }
        }
        else if(speed > (physical.walkSpeed + physical.runSpeed) * 0.5)
        {
            name = 'run'
            timeScale = THREE.MathUtils.clamp(speed / physical.runSpeed, 0.6, 1.5)
        }
        else if(speed > 0.4)
        {
            name = 'walk'
            timeScale = THREE.MathUtils.clamp(speed / physical.walkSpeed, 0.5, 1.6)
        }

        this.animations.play(name, name === 'jump' ? 0.08 : 0.2)

        if(name !== 'jump' && this.animations.current)
            this.animations.current.setEffectiveTimeScale(timeScale)

        this.animations.mixer.update(this.getAnimationDelta())
    }

    getAnimationDelta()
    {
        // Clips are authored in real seconds, the game time runs at Time.defaultScale (2) but bullet time should still slow them down
        return this.game.ticker.deltaScaled / this.game.time.defaultScale
    }

    update()
    {
        const physical = this.game.physicalVehicle
        const delta = this.game.ticker.deltaScaled

        // Position (body is the capsule center, the model has its feet at 0)
        this.root.position.set(physical.position.x, physical.position.y - physical.halfHeight, physical.position.z)

        // Rotation, the model faces +Z and the physical facing angle is around Y with 0 = +X
        this.root.rotation.y = physical.facing + Math.PI * 0.5

        // Animation
        this.updateAnimation()

        // Tumble: backflips while going up, comes back upright while falling to land on the butt
        const fullTurn = Math.PI * 2
        const upright = Math.round(this.knock.spin / fullTurn) * fullTurn
        if(physical.knockState === 'air' && physical.velocity.y > 0)
            this.knock.spin += this.knock.spinSpeed * delta
        else
            this.knock.spin += (upright - this.knock.spin) * Math.min(1, delta * 6)

        if(physical.knockState === 'none' && Math.abs(upright - this.knock.spin) < 0.001)
            this.knock.spin = 0

        this.pivot.rotation.x = - this.knock.spin

        // Landing squash
        if(!physical.grounded)
            this.squash.fallSpeed = physical.velocity.y / Math.max(delta, 1e-6)

        this.squash.value = Math.max(0, this.squash.value - delta * 6)
        const squash = Math.sin(this.squash.value * Math.PI * 0.5) * this.squash.strength
        this.body.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6)

        // Ground track (footprints in the grass/snow)
        const feet = this.root.position
        this.mainGroundTrack.update(feet, physical.grounded)

        // Screen position (used by the foliage see-through)
        const vector = new THREE.Vector3(physical.position.x, physical.position.y, physical.position.z)
        vector.project(this.game.view.camera)

        this.screenPosition.x = (vector.x * 0.5 + 0.5)
        this.screenPosition.y = (vector.y * -0.5 + 0.5)
    }
}
