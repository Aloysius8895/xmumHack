import { Game } from './Game.js'
import gsap from 'gsap'
import { remapClamp, smallestAngle } from './utilities/maths.js'
import * as THREE from 'three/webgpu'
import { Inputs } from './Inputs/Inputs.js'
import { clamp } from 'three/src/math/MathUtils.js'

export class Player
{
    static STATE_DEFAULT = 1
    static STATE_LOCKED = 2

    constructor()
    {
        this.game = Game.getInstance()
        
        this.state = Player.STATE_DEFAULT
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.suspensions = ['low', 'low', 'low', 'low']

        // Character controls (read by PhysicsCharacter)
        this.move = new THREE.Vector2() // Wanted direction in world XZ, length 0..1
        this.running = false
        this.crouching = false
        this.jumpRequested = false

        const respawn = this.game.respawns.getDefault()

        this.position = respawn.position.clone()
        this.basePosition = this.position.clone()
        this.position2 = new THREE.Vector2(this.position.x, this.position.z)
        this.rotationY = 0

        this.setSounds()
        this.setInputs()
        this.setDistanceDriven()
        this.setUnstuck()
        // this.setBackWheel()
        this.setFlip()
        this.setTimePlayed()

        this.game.physicalVehicle.chassis.physical.initialState.position.x = respawn.position.x
        this.game.physicalVehicle.chassis.physical.initialState.position.y = respawn.position.y
        this.game.physicalVehicle.chassis.physical.initialState.position.z = respawn.position.z
        this.game.physicalVehicle.moveTo(respawn.position, respawn.rotation)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 1)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 6)
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.suspensions = this.game.audio.register({
            path: 'sounds/vehicle/suspensions/Robotic_Lifeforms_2_-_Air_Source_-_Piston_Studio_Chair_07.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.1,
            onPlay: (item, count) =>
            {
                item.volume = 0.3 + count * 0.08
                item.rate = 0.9 + Math.random() * 0.2
            }
        })
    }

    setInputs()
    {
        this.game.inputs.addActions([
            { name: 'forward',  categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowUp', 'Keyboard.KeyW', 'Gamepad.up' ] },
            { name: 'right',    categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowRight', 'Keyboard.KeyD', 'Gamepad.right' ] },
            { name: 'backward', categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowDown', 'Keyboard.KeyS', 'Gamepad.down' ] },
            { name: 'left',     categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowLeft', 'Keyboard.KeyA', 'Gamepad.left' ] },
            { name: 'run',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.ShiftLeft', 'Keyboard.ShiftRight', 'Gamepad.circle', 'Gamepad.r2' ] },
            { name: 'jump',     categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Space', 'Gamepad.triangle' ] },
            { name: 'crouch',   categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.KeyC', 'Keyboard.ControlLeft', 'Gamepad.square', 'Gamepad.l2' ] },
            { name: 'respawn',  categories: [ 'wandering',                       ], keys: [ 'Keyboard.KeyR', 'Gamepad.select' ] },
            { name: 'interact', categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.Enter', 'Keyboard.KeyE', 'Keyboard.KeyF', 'Gamepad.cross' ] },
        ])

        // Respawn
        this.game.inputs.events.on('respawn', (action) =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            if(action.active)
            {
                this.respawn()
            }
        })

        // Jump, the request is consumed by PhysicsCharacter on the next physics update
        this.game.inputs.events.on('jump', (action) =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            if(action.active)
                this.jumpRequested = true

            if(action.active && this.game.inputs.mode === Inputs.MODE_TOUCH)
                this.game.inputs.nipple.jump()
        })

        // Nipple tap jump
        this.game.inputs.nipple.events.on('tap', () =>
        {
            this.game.inputs.nipple.jump()
            this.jumpRequested = true
        })
    }

    setDistanceDriven()
    {
        this.distanceDriven = {}

        const localDistanceDriven = localStorage.getItem('distanceDriven')
        this.distanceDriven.value = localDistanceDriven ? parseInt(localDistanceDriven) : 0
        this.distanceDriven.floored = Math.floor(this.distanceDriven.value)
        this.distanceDriven.reset = () =>
        {
            localStorage.removeItem('distanceDriven')
            this.distanceDriven.value = 0
            this.distanceDriven.floored = 0
        }
        
    }

    setUnstuck()
    {
        this.unstuck = {}
        this.unstuck.duration = 3
        this.unstuck.delay = null

        this.game.physicalVehicle.events.on('rightSideUp', () =>
        {
            // Reset delay
            if(this.unstuck.delay)
                this.unstuck.delay.kill()
        })

        const waitAndTest = () =>
        {
            this.unstuck.delay = gsap.delayedCall(this.unstuck.duration, () =>
            {
                this.unstuck.delay = null

                if(this.state !== Player.STATE_DEFAULT)
                    return

                // Still upside down => Flip back
                if(this.game.physicalVehicle.upsideDown.active)
                {
                    this.game.physicalVehicle.flip.jump()
                    
                    // Sound
                    this.sounds.suspensions.play(4)

                    // Achievement
                    if(this.game.physicalVehicle.upsideDown.ratio > 0.75)
                        this.game.achievements.setProgress('upsideDown', 1)

                    // Again in case it didn't work
                    waitAndTest()
                }
            })
        }

        this.game.physicalVehicle.events.on('upsideDown', (ratio) =>
        {
            // Reset delay
            if(this.unstuck.delay)
                this.unstuck.delay.kill()

            // Wait a moment
            waitAndTest()
        })

        this.game.physicalVehicle.events.on('stuck', () =>
        {
            this.game.inputs.interactiveButtons.addItems(['unstuck'])
        })

        this.game.physicalVehicle.events.on('unstuck', () =>
        {
            this.game.inputs.interactiveButtons.removeItems(['unstuck'])
        })

        this.game.inputs.interactiveButtons.events.on('unstuck', () =>
        {
            this.game.inputs.interactiveButtons.removeItems(['unstuck'])
            this.respawn()
        })
    }

    // setBackWheel()
    // {
    //     let delay = null
    //     let startTime = null

    //     this.game.physicalVehicle.events.on('backWheel', (_active) =>
    //     {
    //         if(_active)
    //         {
    //             startTime = this.game.ticker.elapsed

    //             if(delay)
    //             {
    //                 delay.kill()
    //                 delay = null
    //             }
    //         }
    //         else
    //         {
    //             delay = gsap.delayedCall(0.1, () =>
    //             {
    //                 delay = null

    //                 const duration = this.game.ticker.elapsed - startTime

    //                 if(duration > 5)
    //                     this.game.achievements.setProgress('backWheel', 1)
    //             })
    //         }
    //     })
    // }

    setFlip()
    {
        this.game.physicalVehicle.events.on('flip', (direction) =>
        {
            if(direction > 0)
                this.game.achievements.setProgress('frontFlip', 1)
            else
                this.game.achievements.setProgress('backFlip', 1)
        })
    }

    setTimePlayed()
    {
        const localTimePlayed = localStorage.getItem('timePlayed')
        this.timePlayed = {}
        this.timePlayed.all = localTimePlayed ? parseFloat(localTimePlayed) : 0
        this.timePlayed.session = 0
        this.timePlayed.achieved = false

        setInterval(() =>
        {
            localStorage.setItem('timePlayed', this.timePlayed.all)
        }, 1000)
    }

    respawn(respawnName = null, callback = null)
    {
        this.game.overlay.show(() =>
        {
            if(typeof callback === 'function')
                callback()

            // Find respawn
            let respawn = respawnName ? this.game.respawns.getByName(respawnName) : this.game.respawns.getClosest(this.position)

            // Update physical vehicle
            this.game.physicalVehicle.moveTo(
                respawn.position,
                respawn.rotation
            )
            
            this.state = Player.STATE_DEFAULT
            this.game.overlay.hide()
        })
    }

    die()
    {
        this.state = Player.STATE_LOCKED
        
        gsap.delayedCall(2, () =>
        {
            this.respawn(null, () =>
            {
                this.state = Player.STATE_DEFAULT
            })
        })
    }

    updatePrePhysics()
    {
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.move.set(0, 0)
        this.running = false
        this.crouching = false

        if(this.state !== Player.STATE_DEFAULT)
        {
            this.jumpRequested = false
            return
        }

        /**
         * Direction relative to the camera
         * input.y = away from the camera, input.x = to the right of the screen
         */
        const input = new THREE.Vector2()

        if(this.game.inputs.actions.get('forward').active)
            input.y += this.game.inputs.actions.get('forward').value
        if(this.game.inputs.actions.get('backward').active)
            input.y -= this.game.inputs.actions.get('backward').value
        if(this.game.inputs.actions.get('right').active)
            input.x += 1
        if(this.game.inputs.actions.get('left').active)
            input.x -= 1

        // Gamepad joystick
        if(input.lengthSq() === 0 && this.game.inputs.gamepad.joysticks.left.active)
            input.set(this.game.inputs.gamepad.joysticks.left.safeX, - this.game.inputs.gamepad.joysticks.left.safeY)

        if(input.lengthSq() > 1)
            input.normalize()

        // Camera looks along -(sin theta, cos theta) on the XZ plane (see View spherical)
        const theta = this.game.view.spherical.theta
        const forwardX = - Math.sin(theta)
        const forwardZ = - Math.cos(theta)
        const rightX = - forwardZ
        const rightZ = forwardX
        this.move.set(
            forwardX * input.y + rightX * input.x,
            forwardZ * input.y + rightZ * input.x
        )

        /**
         * Nipple (touch), the target angle is already a world direction
         */
        if(this.game.inputs.nipple.active && this.game.inputs.nipple.progress > 0)
        {
            if(!this.game.view.focusPoint.isTracking)
            {
                // Wait a few frames in case it a multi-touch
                this.game.ticker.wait(5, () =>
                {
                    if(this.game.inputs.nipple.active)
                        this.game.view.focusPoint.isTracking = true
                })
            }

            const progress = this.game.inputs.nipple.progress
            const angle = this.game.inputs.nipple.targetAngle
            this.move.set(Math.cos(angle), Math.sin(angle)).multiplyScalar(Math.min(1, progress * 1.5))
            this.running = progress > 0.9
        }

        /**
         * Run / crouch
         */
        if(this.game.inputs.actions.get('run').active)
            this.running = true

        if(this.game.inputs.actions.get('crouch').active)
        {
            this.crouching = true
            this.running = false
        }

        // Kept for the code written for the vehicle (sounds, speed lines, stuck detection)
        this.accelerating = this.move.length()
        this.boosting = this.running ? 1 : 0
    }

    updatePostPhysics()
    {
        // Position
        this.position.copy(this.game.physicalVehicle.position)
        this.position2 = new THREE.Vector2(this.position.x, this.position.z)
        
        // View > Focus point
        this.game.view.focusPoint.trackedPosition.copy(this.position)

        // View > Speed lines
        if(this.boosting && this.accelerating && this.game.physicalVehicle.speed > 15)
            this.game.view.speedLines.strength = 1
        else
            this.game.view.speedLines.strength = 0

        this.game.view.speedLines.worldTarget.copy(this.position)

        // Tracks > Focus point
        this.game.tracks.focusPoint.set(this.position.x, this.position.z)

        // Inputs touch joystick
        this.rotationY = Math.atan2(this.game.physicalVehicle.forward.z, this.game.physicalVehicle.forward.x)
        this.game.inputs.nipple.setCoordinates(this.position.x, this.position.y, this.position.z, this.rotationY)

        // Time played
        this.timePlayed.all += this.game.ticker.delta
        this.timePlayed.session += this.game.ticker.delta

        if(!this.timePlayed.achieved && this.timePlayed.session > this.game.dayCycles.duration)
        {
            this.timePlayed.achieved = true
            this.game.achievements.setProgress('fullDay', 1)
        }

        // Sea achievement
        const distanceToCenter = this.position2.length()
        if(distanceToCenter > 120)
            this.game.achievements.setProgress('sea', 1)

        // Go high achievements
        const elevation = Math.floor(this.position.y)
        if(this.game.achievements.groups.get('goHigh') && elevation > this.game.achievements.groups.get('goHigh').progress)
            this.game.achievements.setProgress('goHigh', elevation)

        // // Speed achievement
        // const speedKmPerHour = Math.floor(this.game.physicalVehicle.xzSpeed / 1000 * 3600)

        // if(this.game.achievements.groups.get('speed') && speedKmPerHour > this.game.achievements.groups.get('speed').progress)
        //     this.game.achievements.setProgress('speed', speedKmPerHour)

        // Distance driven
        this.distanceDriven.value += this.game.physicalVehicle.xzSpeed * this.game.ticker.deltaScaled
        const flooredDistanceDriven = Math.floor(this.distanceDriven.value)

        if(flooredDistanceDriven !== this.distanceDriven.floored)
        {
            localStorage.setItem('distanceDriven', flooredDistanceDriven)
            this.distanceDriven.floored = flooredDistanceDriven
        }
        
        // Achievement
        const distanceDrivenKm = Math.floor(this.distanceDriven.value / 1000)

        if(this.game.achievements.groups.get('distanceDriven') && distanceDrivenKm > this.game.achievements.groups.get('distanceDriven').progress)
        {
            this.game.achievements.setProgress('distanceDriven', distanceDrivenKm)

        }
    }
}