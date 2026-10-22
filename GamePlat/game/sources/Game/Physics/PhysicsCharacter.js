import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { CharacterRecovery } from './CharacterRecovery.js'
import { CharacterDiagnostics } from './CharacterDiagnostics.js'

/**
 * Walking character body replacing PhysicsVehicle
 * Same public API as PhysicsVehicle (position, velocity, speed, chassis, events, moveTo...) so the rest of the game
 * (areas, zones, explosions, tornado, achievements) keeps working with game.physicalVehicle
 *
 * Dynamic capsule with locked rotations, the horizontal velocity is steered toward the wanted velocity each frame
 * so impulses (explosions, tornado) still push the character for a moment
 */
export class PhysicsCharacter
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        // Dimensions (metres): capsule from the feet to the top of the head
        this.radius = 0.35
        this.height = 1.5
        this.halfHeight = this.height * 0.5

        // Movement, in game time which runs twice as fast as real time (Time.defaultScale = 2): walk 4 m/s real, run 9 m/s real
        this.walkSpeed = 2
        this.runSpeed = 4.5
        this.crouchSpeed = 1
        this.jumpSpeed = 5.2
        this.groundAcceleration = 14
        this.airAcceleration = 3
        this.turnSpeed = 12
        this.coyoteTime = 0.12

        // PhysicsVehicle compatible attributes
        this.steeringAmplitude = 0
        this.sideward = new THREE.Vector3(0, 0, 1)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.forward = new THREE.Vector3(1, 0, 0)
        this.position = new THREE.Vector3(0, 4, 0)
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.direction = this.forward.clone()
        this.speed = 0
        this.xzSpeed = 0
        this.forwardRatio = 1
        this.goingForward = true
        this.forwardSpeed = 0
        this.yRotation = 0
        this.xRotation = 0
        this.zRotation = 0

        // Character state
        this.grounded = false
        this.lastGroundedTime = - Infinity
        this.jumpTime = - Infinity
        this.jumping = false
        this.crouching = false
        this.facing = 0 // Angle around Y, 0 = facing +X like the vehicle
        this.motionTime = 0

        // 'none' > 'air' > 'down'; physics owns the recovery deadline, animations may finish it earlier.
        this.knockState = 'none'
        this.knockLandTime = 0
        this.knockLaunch = { horizontal: 1.6, vertical: 2.2, minVertical: 6 }
        this.knockRecoveryDuration = 4.4 // Simulation seconds; physics can recover without an animation callback.
        this.knockDownTime = 0
        this.knockSettleTime = 0
        this.knockBlockedTime = 0

        this.setChassis()
        this.setWheels()
        this.setStop()
        this.setUpsideDown()
        this.setStuck()
        this.setFlip()
        this.setMapBoundaries()
        this.recovery = new CharacterRecovery(this)
        this.diagnostics = new CharacterDiagnostics(this)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 2)
        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 5)

        if(this.game.debug.active)
            this.setDebug()
    }

    setChassis()
    {
        this.chassis = {}
        const capsuleHalfLength = this.halfHeight - this.radius
        const object = this.game.objects.add(null, {
            type: 'dynamic',
            position: this.position,
            friction: 0,
            frictionRule: 'min',
            category: 'character',
            restitution: 0,
            colliders: [
                { shape: 'capsule', mass: 2.5, parameters: [ capsuleHalfLength, this.radius ] },
            ],
            canSleep: false,
            waterGravityMultiplier: 0,
            onCollision: (force, position) =>
            {
                this.game.audio.groups.get('hitDefault').playRandomNext(force, position)
            }
        })
        this.chassis.physical = object.physical
        this.chassis.physical.body.lockRotations(true, true)
        this.chassis.physical.body.enableCcd(true)
        this.chassis.physical.body.setAdditionalSolverIterations(4)
        this.chassis.mass = this.chassis.physical.body.mass()
    }

    setMapBoundaries()
    {
        const b = this.game.mapBounds
        if(!b) return
        const x = (b.minX + b.maxX) / 2, z = (b.minZ + b.maxZ) / 2
        // Character-only walls are solved by Rapier, including CCD. Never clamp a solved body into scenery.
        for(const [position, parameters] of [
            [{ x: b.minX - 0.5, y: 0, z }, [0.5, 1000, (b.maxZ - b.minZ) / 2 + 1]],
            [{ x: b.maxX + 0.5, y: 0, z }, [0.5, 1000, (b.maxZ - b.minZ) / 2 + 1]],
            [{ x, y: 0, z: b.minZ - 0.5 }, [(b.maxX - b.minX) / 2 + 1, 1000, 0.5]],
            [{ x, y: 0, z: b.maxZ + 0.5 }, [(b.maxX - b.minX) / 2 + 1, 1000, 0.5]],
        ])
            this.game.objects.add(null, { type: 'fixed', position, friction: 0, restitution: 0,
                colliders: [{ shape: 'cuboid', parameters, category: 'characterBoundary' }] })
    }

    setWheels()
    {
        // Only kept for the code reading the vehicle wheels (sounds), the feet act as 4 wheels
        this.wheels = {}
        this.wheels.inContactCount = 0
        this.wheels.justTouchedCount = 0
        this.wheels.items = []
        this.wheels.settings = { radius: 0.4 }
    }

    setStop()
    {
        this.stop = {}
        this.stop.active = true
        this.stop.lowThreshold = 0.04
        this.stop.highThreshold = 0.7

        this.stop.test = () =>
        {
            if(this.speed < this.stop.lowThreshold)
            {
                if(!this.stop.active)
                {
                    this.stop.active = true
                    this.events.trigger('stop')
                }
            }
            else if(this.speed > this.stop.highThreshold)
            {
                if(this.stop.active)
                {
                    this.stop.active = false
                    this.events.trigger('start')
                }
            }
        }
    }

    setUpsideDown()
    {
        // Rotations are locked, a character can't be upside down
        this.upsideDown = {}
        this.upsideDown.active = false
        this.upsideDown.ratio = 0
        this.upsideDown.threshold = 0.3
    }

    setStuck()
    {
        this.stuck = {}
        this.stuck.durationTest = 3
        this.stuck.durationSaved = 0
        this.stuck.savedItems = []
        this.stuck.distance = 0
        this.stuck.distanceThreshold = 0.5
        this.stuck.active = false

        this.stuck.accumulate = (traveled, time) =>
        {
            this.stuck.savedItems.unshift([traveled, time])
            this.stuck.distance = 0
            this.stuck.durationSaved = 0

            for(let i = 0; i < this.stuck.savedItems.length; i++)
            {
                const item = this.stuck.savedItems[i]

                if(this.stuck.durationSaved >= this.stuck.durationTest)
                {
                    this.stuck.savedItems.splice(i)
                    break
                }
                else
                {
                    this.stuck.distance += item[0]
                    this.stuck.durationSaved += item[1]
                }
            }
        }

        this.stuck.test = () =>
        {
            if(this.stuck.durationSaved >= this.stuck.durationTest && this.stuck.distance < this.stuck.distanceThreshold)
            {
                if(!this.stuck.active)
                {
                    this.stuck.active = true
                    this.events.trigger('stuck')
                }
            }
            else
            {
                if(this.stuck.active)
                {
                    this.stuck.active = false
                    this.events.trigger('unstuck')
                }
            }
        }
    }

    setFlip()
    {
        // Used by the "unstuck" logic of the vehicle, a hop is enough for a character
        this.flip = {}
        this.flip.jump = () =>
        {
            this.chassis.physical.body.applyImpulse({ x: 0, y: this.jumpSpeed * this.chassis.mass, z: 0 }, true)
        }
    }

    setDebug()
    {
        const debugPanel = this.game.physics.debugPanel.addFolder({
            title: 'Character',
            expanded: true,
        })

        debugPanel.addBinding(this, 'walkSpeed', { min: 0, max: 20, step: 0.1 })
        debugPanel.addBinding(this, 'runSpeed', { min: 0, max: 30, step: 0.1 })
        debugPanel.addBinding(this, 'crouchSpeed', { min: 0, max: 10, step: 0.1 })
        debugPanel.addBinding(this, 'jumpSpeed', { min: 0, max: 20, step: 0.1 })
        debugPanel.addBinding(this, 'groundAcceleration', { min: 0, max: 50, step: 0.1 })
        debugPanel.addBinding(this, 'airAcceleration', { min: 0, max: 50, step: 0.1 })
        debugPanel.addBinding(this, 'turnSpeed', { min: 0, max: 50, step: 0.1 })
    }

    moveTo(position, rotation = 0)
    {
        // Respawns are placed for the vehicle chassis, which sits a bit higher than the capsule center: the character just drops
        const quaternion = new THREE.Quaternion()
        this.chassis.physical.body.setTranslation(position)
        this.chassis.physical.body.setRotation(quaternion)
        this.chassis.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.resetForces(true)
        this.chassis.physical.body.resetTorques(true)
        this.game.physics.world.propagateModifiedBodyPositionsToColliders()
        this.game.physics.world.updateSceneQueries()

        // Vehicle rotation is around Y with the vehicle facing +X
        this.facing = rotation
        this.position.copy(position)
        this.velocity.set(0, 0, 0)
        this.speed = this.xzSpeed = this.forwardSpeed = 0
        this.jumping = this.crouching = false
        this.jumpTime = - Infinity
        this.knockDownTime = this.knockSettleTime = this.knockBlockedTime = 0
        this.lastGroundedTime = - Infinity
        this.standUp()
        this.recovery?.reset()
        this.grounded = this.recovery ? this.testGround() : false
        if(this.grounded) this.lastGroundedTime = this.motionTime
        this.wheels.inContactCount = this.grounded ? 4 : 0
        this.wheels.justTouchedCount = 0
        if(this.stuck.active) this.events.trigger('unstuck')
        this.stuck.active = false
        this.stuck.savedItems = []
        this.stuck.durationSaved = this.stuck.distance = 0
        if(this.game.player)
        {
            this.game.player.jumpRequested = false
            this.game.player.position?.copy(this.position)
        }
        this.game.clickMove?.cancel()
        this.game.world?.visualVehicle?.syncFromPhysics(true)
    }

    knock(velocity)
    {
        if(!this.chassis.physical.body.isEnabled()) return
        // Launch higher than a regular object so the explosion sends the character flying
        const launch = {
            x: velocity.x * this.knockLaunch.horizontal,
            y: Math.max(velocity.y * this.knockLaunch.vertical, this.knockLaunch.minVertical),
            z: velocity.z * this.knockLaunch.horizontal
        }
        this.chassis.physical.body.setLinvel(launch, true)

        this.knockState = 'air'
        this.jumping = false
        this.grounded = false
        this.jumpTime = this.motionTime
        this.knockDownTime = this.knockSettleTime = this.knockBlockedTime = 0
        this.events.trigger('knock')
    }

    standUp()
    {
        if(this.knockState === 'none')
            return

        this.knockState = 'none'
        this.knockDownTime = this.knockSettleTime = this.knockBlockedTime = 0
        this.events.trigger('standUp')
    }

    testGround()
    {
        this.groundInfo = this.recovery.ground()
        return this.groundInfo.grounded
    }

    updatePrePhysics()
    {
        const player = this.game.player
        const body = this.chassis.physical.body

        if(!body.isEnabled())
            return

        const delta = this.game.ticker.deltaScaled
        this.motionTime += delta
        const elapsed = this.motionTime

        // Ground
        const wasGrounded = this.grounded
        // Right after a jump the rays still reach the ground, ignore it for a moment
        const ground = this.testGround()
        this.grounded = elapsed - this.jumpTime > 0.2 && ground && body.linvel().y - this.groundInfo.velocityY < 0.8

        if(this.grounded)
            this.lastGroundedTime = elapsed

        if(this.grounded && !wasGrounded)
        {
            this.jumping = false
            this.wheels.justTouchedCount = 4
            this.events.trigger('land')
        }
        else
        {
            this.wheels.justTouchedCount = 0
        }

        this.wheels.inContactCount = this.grounded ? 4 : 0

        // Knocked: no control
        if(this.knockState !== 'none')
        {
            this.crouching = false
            player.jumpRequested = false

            // Rays can hit debris flying along (crates blown by the same explosion), so landing also needs to have stopped falling
            const speed = body.linvel()
            const resting = this.groundInfo.supported && Math.abs(speed.y - this.groundInfo.velocityY) < 0.9
                && speed.y < 0.8 && Math.abs(this.groundInfo.velocityY) < 1.5 && elapsed - this.jumpTime > 0.2
            this.knockSettleTime = resting ? this.knockSettleTime + delta : 0

            if(this.knockState === 'air' && this.knockSettleTime > 0.08)
            {
                this.knockState = 'down'
                this.knockLandTime = elapsed
                this.knockDownTime = 0
                this.events.trigger('knockLand')
            }
            else if(this.knockState === 'down' && !this.groundInfo.supported && elapsed - this.knockLandTime > 0.3)
            {
                // Slid off something, falling again
                this.knockState = 'air'
                this.events.trigger('knock')
            }

            if(this.knockState === 'down')
            {
                this.knockDownTime += delta
                // Slide to a stop on the floor
                const linvel = body.linvel()
                const friction = Math.max(0, 1 - 8 * delta)
                body.setLinvel({ x: linvel.x * friction, y: linvel.y, z: linvel.z * friction }, true)

                if(this.knockDownTime > this.knockRecoveryDuration)
                    this.standUp()
            }
            else
            {
                // A contact wedge can hold the capsule without a walkable floor. Release the input lock
                // before the independently validated geometric recovery considers any relocation.
                const held = this.groundInfo.contacts.length > 0 && Math.hypot(speed.x, speed.y, speed.z) < 0.2
                this.knockBlockedTime = held ? this.knockBlockedTime + delta : 0
                if(this.knockBlockedTime > 1.2)
                {
                    this.standUp()
                    this.events.trigger('knockContactRelease')
                }
            }

            return
        }

        // Crouch
        this.crouching = player.crouching && this.grounded

        // Wanted velocity
        const move = player.move // Vector2 in world XZ, length 0..1
        let targetSpeed = this.walkSpeed
        if(player.crouching)
            targetSpeed = this.crouchSpeed
        else if(player.running)
            targetSpeed = this.runSpeed

        const targetX = move.x * targetSpeed
        const targetZ = move.y * targetSpeed

        const linvel = body.linvel()
        const acceleration = Math.min(1, (this.grounded ? this.groundAcceleration : this.airAcceleration) * delta)
        const velocityX = linvel.x + (targetX - linvel.x) * acceleration
        const velocityZ = linvel.z + (targetZ - linvel.z) * acceleration
        let velocityY = linvel.y

        // Jump (with a bit of coyote time so jumping right after an edge still works)
        if(player.jumpRequested)
        {
            player.jumpRequested = false

            if(!this.jumping && elapsed - this.lastGroundedTime < this.coyoteTime)
            {
                velocityY = this.jumpSpeed
                this.jumping = true
                this.jumpTime = elapsed
                this.grounded = false
                this.events.trigger('jump')
            }
        }

        body.setLinvel({ x: velocityX, y: velocityY, z: velocityZ }, true)

        // Facing, turns toward the movement direction
        if(move.lengthSq() > 0.0001)
        {
            const targetFacing = Math.atan2(- move.y, move.x)
            let angleDelta = targetFacing - this.facing
            angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta))
            this.facing += angleDelta * Math.min(1, this.turnSpeed * delta)
        }
    }

    updatePostPhysics()
    {
        if(!this.chassis.physical.body.isEnabled()) return
        this.recovery.update(this.game.ticker.deltaScaled)
        const newPosition = new THREE.Vector3().copy(this.chassis.physical.body.translation())
        this.velocity = newPosition.clone().sub(this.position)
        this.direction = this.velocity.clone().normalize()
        this.position.copy(newPosition)

        // Visual orientation comes from the facing angle, the physical body never rotates
        this.quaternion.setFromAxisAngle(this.upward.set(0, 1, 0), this.facing)
        this.sideward.set(0, 0, 1).applyQuaternion(this.quaternion)
        this.forward.set(1, 0, 0).applyQuaternion(this.quaternion)

        const delta = Math.max(this.game.ticker.deltaScaled, 1e-6)
        this.speed = this.velocity.length() / delta
        this.xzSpeed = Math.hypot(this.velocity.x, this.velocity.z) / delta
        this.forwardRatio = this.direction.dot(this.forward)
        this.goingForward = this.forwardRatio > 0.5
        this.forwardSpeed = this.speed * this.forwardRatio
        this.yRotation = this.facing

        if(this.game.player.move.lengthSq() > 0.25)
            this.stuck.accumulate(this.velocity.length(), this.game.ticker.deltaScaled)

        this.stop.test()
        this.stuck.test()
        this.diagnostics.update()
    }

    activate()
    {
        this.chassis.physical.body.setLinvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.setAngvel({ x: 0, y: 0, z: 0 })
        this.chassis.physical.body.setEnabled(true)
    }

    deactivate()
    {
        this.chassis.physical.body.setEnabled(false)
    }
}
