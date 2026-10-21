// Browser-run regressions against the project's real Rapier version and controller.
import * as THREE from 'three/webgpu'
import * as RAPIER from '@dimforge/rapier3d'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { Physics } from './Physics.js'
import { PhysicsCharacter } from './PhysicsCharacter.js'
import { VisualCharacter } from '../World/VisualCharacter.js'

export function fixture(bounds = null)
{
    const game = {
        RAPIER, debug: { active: false }, mapBounds: bounds,
        ticker: { events: new Events(), elapsed: 0, delta: 1 / 60, deltaScaled: 1 / 30, elapsedScaled: 0 },
        water: { surfaceElevation: - 100 },
        audio: { groups: { get: () => ({ playRandomNext() {} }) } },
        player: { move: new THREE.Vector2(), running: false, crouching: false, jumpRequested: false, state: 1 },
        scene: new THREE.Scene(), respawns: { items: new Map() },
    }
    Game.instance = game
    game.physics = new Physics()
    game.objects = { add(visual, description) {
        const object = { physical: game.physics.getPhysical(description) }
        object.physical.body.userData = { object }
        return object
    } }
    game.physicalVehicle = new PhysicsCharacter()
    const character = game.physicalVehicle
    const body = character.chassis.physical.body
    const box = (position, halfExtents, options = {}) => game.objects.add(null, {
        type: 'fixed', position, friction: 0.2, restitution: 0,
        colliders: [{ shape: 'cuboid', parameters: halfExtents }], ...options,
    }).physical
    const floor = box({ x: 0, y: - 0.1, z: 0 }, [30, 0.1, 30])
    const trace = []
    const step = (count = 1, dt = 1 / 30) => {
        for(let i = 0; i < count; i++)
        {
            game.ticker.delta = dt / 2
            game.ticker.deltaScaled = dt
            game.ticker.elapsed += dt / 2
            game.ticker.elapsedScaled += dt
            game.ticker.events.trigger('tick')
            if(i % 10 === 0) trace.push(snapshot())
        }
    }
    const snapshot = () => ({
        time: game.ticker.elapsed, input: game.player.move.toArray(),
        position: { ...body.translation() }, velocity: { ...body.linvel() },
        displacement: character.velocity.toArray(), grounded: character.grounded,
        knock: character.knockState, recovery: character.recovery?.lastReason ?? null,
        relocations: character.recovery?.relocations ?? 0,
    })
    const teleport = (position) => {
        character.moveTo(new THREE.Vector3(position.x, position.y, position.z))
        game.physics.world.propagateModifiedBodyPositionsToColliders()
        game.physics.world.updateSceneQueries()
    }
    const dispose = () => { game.physics.eventQueue.free(); game.physics.world.free() }
    return { game, character, body, box, floor, step, snapshot, trace, teleport, dispose }
}

export function baseline()
{
    const results = {}
    let f = fixture()
    f.box({ x: 1.5, y: 1.5, z: 0 }, [0.15, 1.5, 3])
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    f.game.player.move.set(1, 0); f.step(240)
    const wall = f.snapshot()
    f.game.player.move.set(- 1, 0); f.step(60)
    results.wall = { blocked: wall, released: f.snapshot(), trace: f.trace }
    f.dispose()

    f = fixture()
    f.box({ x: - 0.42, y: 0.5, z: 0 }, [0.10, 0.5, 1.5])
    f.box({ x: 0.42, y: 0.5, z: 0 }, [0.10, 0.5, 1.5])
    f.teleport({ x: 0, y: 3, z: 0 })
    f.character.knock(new THREE.Vector3(0, 3, 0)); f.step(900)
    results.edgeWedge = { final: f.snapshot(), trace: f.trace }
    f.dispose()

    f = fixture({ minX: 0, maxX: 10, minZ: - 10, maxZ: 10 })
    f.box({ x: 0.55, y: 2, z: 0 }, [0.2, 2, 2])
    f.teleport({ x: - 0.15, y: 0.8, z: 0 }); f.step(180)
    results.boundaryOverlap = { final: f.snapshot(), trace: f.trace }
    f.dispose()
    return results
}

export function regressions()
{
    const results = {}
    const check = (condition, message) => { if(!condition) throw new Error(message) }
    const save = (name, f, extra = {}) => {
        results[name] = { passed: true, final: f.snapshot(), ...extra, trace: f.trace }
        f.dispose()
    }
    let f = fixture()
    f.box({ x: 1.5, y: 2, z: 0 }, [0.15, 2, 20])
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    f.game.player.move.set(1, 0); f.step(900)
    check(f.body.translation().x < 1.02 && f.character.recovery.relocations === 0, 'Normal wall pushing must never relocate')
    f.game.player.move.set(1, 1).normalize(); f.step(90)
    check(f.body.translation().z > 3, 'Movement should slide along the wall')
    f.game.player.move.set(- 1, 0); f.step(60)
    check(f.body.translation().x < - 2, 'Backing away must release immediately')
    save('wall-hold-slide-release', f)

    f = fixture()
    f.box({ x: 1.5, y: 2, z: 0 }, [0.15, 2, 5])
    f.box({ x: 0, y: 2, z: 1.5 }, [5, 2, 0.15])
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    f.game.player.move.set(1, 1).normalize(); f.step(360)
    check(f.character.recovery.relocations === 0, 'A supported corner is not a recovery condition')
    f.game.player.move.set(- 1, - 1).normalize(); f.step(90)
    check(f.body.translation().x < - 2 && f.body.translation().z < - 2, 'Corner release failed')
    save('corner-reverse', f)

    f = fixture()
    f.box({ x: 1.1, y: 0.12, z: 0 }, [0.2, 0.12, 1])
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    f.game.player.move.set(1, 0); f.step(120)
    const obstaclePosition = { ...f.body.translation() }
    f.game.player.move.set(- 1, 0); f.step(90)
    check(f.body.translation().x < obstaclePosition.x - 2 && f.character.knockState === 'none', 'Small obstacle must allow reverse motion')
    save('small-obstacle', f)

    f = fixture()
    f.box({ x: - 0.42, y: 0.5, z: 0 }, [0.10, 0.5, 1.5])
    f.box({ x: 0.42, y: 0.5, z: 0 }, [0.10, 0.5, 1.5])
    f.teleport({ x: 0, y: 3, z: 0 })
    const validated = []
    f.character.events.on('recovered', () => validated.push(f.character.recovery.isSafe(f.body.translation())))
    f.character.knock(new THREE.Vector3(0, 3, 0)); f.step(600)
    check(f.character.knockState === 'none' && f.character.grounded, 'Edge wedge must not remain in air lock')
    check(validated.length > 0 && validated.every(Boolean), 'Every fallback target must be clear and supported')
    save('bomb-edge-wedge', f, { validated })

    f = fixture()
    f.box({ x: 1.5, y: 2, z: 0 }, [0.15, 2, 2])
    f.teleport({ x: 1.19, y: 0.8, z: 0 }); f.step(90)
    check(f.body.translation().x < 1.025 && f.character.recovery.relocations === 0, 'Ordinary overlap should resolve without a respawn')
    save('shallow-overlap', f)

    f = fixture()
    const sensor = f.box({ x: 0, y: 2, z: 0 }, [2, 0.1, 2])
    sensor.colliders[0].setSensor(true)
    f.teleport({ x: 0, y: 2.7, z: 0 })
    check(!f.character.testGround(), 'Sensors must not count as ground')
    f.step(180)
    check(f.character.grounded && f.body.translation().y < 0.8, 'Capsule should pass through decorative/sensor geometry')
    save('sensor-filter', f)

    f = fixture()
    f.box({ x: 0, y: 2, z: 0 }, [0.2, 2, 2])
    f.teleport({ x: 0, y: 2.5, z: 0 })
    check(!f.character.testGround(), 'Ray starting inside a wall must not count as an upward floor')
    save('inside-wall-not-grounded', f)

    for(const dt of [1 / 60, 1 / 30, 1 / 15, 0.1])
    {
        f = fixture()
        f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
        f.character.knock(new THREE.Vector3(3, 4, 0))
        const launch = { ...f.body.linvel() }
        check(launch.x > 4 && launch.y >= 8, 'Original launch effect must remain')
        f.step(Math.ceil(12 / dt), dt)
        check(f.character.grounded && f.character.knockState === 'none', 'Bomb landing must recover even with no animation callbacks')
        check(f.character.recovery.relocations === 0, 'Ordinary bomb landing must not relocate')
        f.game.player.move.set(0, 1); const z = f.body.translation().z; f.step(Math.ceil(1 / dt), dt)
        check(f.body.translation().z > z + 1, 'Input must move the character after landing')
        save(`bomb-landing-dt-${dt.toFixed(4)}`, f, { launch })
    }

    f = fixture()
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    for(let i = 0; i < 4; i++)
    {
        f.character.knock(new THREE.Vector3(i % 2 ? - 3 : 3, 3, 1))
        f.step(18)
        check(f.character.knockState === 'air', 'Repeated blasts must stay airborne during ascent')
    }
    f.step(450)
    check(f.character.knockState === 'none' && f.character.grounded, 'Repeated blasts must finish recovery')
    save('repeated-bombs', f)

    f = fixture()
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    f.game.player.jumpRequested = true; f.step(1)
    check(!f.character.grounded && f.body.linvel().y > 4, 'A normal jump must launch from support')
    f.game.player.move.set(0, 1); f.step(120)
    check(f.character.grounded && !f.character.jumping && f.body.translation().z > 3, 'Normal jump and air steering must land and restore grounded state')
    save('ordinary-jump-air-control', f)

    f = fixture()
    f.box({ x: 0, y: 0.5, z: 0 }, [0.8, 0.5, 2])
    f.teleport({ x: 0.72, y: 3, z: 0 })
    let landings = 0
    f.character.events.on('knockLand', () => {
        landings++
        if(landings === 1) f.body.setLinvel({ x: 3, y: 0, z: 0 }, true)
    })
    f.character.knock(new THREE.Vector3(0, 3, 0)); f.step(600)
    check(landings >= 2 && f.character.knockState === 'none' && f.character.grounded, 'Sliding off an edge during knockdown must fall and land again')
    save('knockdown-slide-off-platform', f, { landings })

    f = fixture()
    f.box({ x: 2, y: 4, z: 0 }, [0.025, 4, 8])
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(30)
    f.character.knock(new THREE.Vector3(80, 3, 0)); f.step(8, 1 / 15)
    check(f.body.translation().x < 1.68, 'CCD must prevent high-speed thin-wall tunneling')
    save('ccd-low-fps-high-speed-wall', f)

    f = fixture({ minX: - 5, maxX: 5, minZ: - 5, maxZ: 5 })
    f.teleport({ x: - 4, y: 0.8, z: 0 }); f.step(30)
    f.game.player.move.set(- 1, 0); f.step(900)
    check(f.body.translation().x >= - 4.67 && f.character.recovery.relocations === 0, 'Pushing the physical map boundary is normal wall contact')
    f.game.player.move.set(1, 0); f.step(60)
    check(f.body.translation().x > - 1, 'Boundary must allow returning inward')
    save('boundary-normal-wall-no-fallback', f)

    f = fixture({ minX: 0, maxX: 10, minZ: - 10, maxZ: 10 })
    f.box({ x: 0.55, y: 2, z: 0 }, [0.2, 2, 2])
    f.teleport({ x: - 0.15, y: 0.8, z: 0 }); f.step(240)
    check(f.character.knockState === 'none' && f.character.grounded && f.body.translation().x > 1.1, 'Existing boundary overlap must find a clear landing')
    save('boundary-existing-overlap', f)

    f = fixture()
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(60)
    check(!f.character.recovery.isSafe(new THREE.Vector3(0, 3, 0)), 'Floating candidates must be rejected')
    f.box({ x: 3, y: 1, z: 0 }, [1, 1, 1]); f.step(1)
    check(!f.character.recovery.isSafe(new THREE.Vector3(3, 0.8, 0)), 'Overlapping candidates must be rejected')
    f.floor.body.setEnabled(false)
    // Disable the extra box as well: an empty world offers no verified landing.
    for(const p of f.game.physics.physicals) if(p !== f.character.chassis.physical) p.body.setEnabled(false)
    f.game.physics.world.updateSceneQueries()
    check(f.character.recovery.findSafePosition(new THREE.Vector3(0, 2, 0)) === null, 'Failed safety search must never pick a default unchecked point')
    save('safe-position-validation', f)

    f = fixture()
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(60)
    check(f.character.recovery.history.length > 0, 'Safe supported positions should be recorded')
    f.body.setTranslation({ x: 0, y: - 21, z: 0 }, true)
    f.game.physics.world.propagateModifiedBodyPositionsToColliders()
    f.game.physics.world.updateSceneQueries()
    f.step(180)
    check(f.character.recovery.lastReason === 'verified-history' && f.character.grounded, 'A below-world fault should use a revalidated supported history point')
    save('below-world-history-fallback', f)

    f = fixture()
    f.teleport({ x: 0, y: 0.8, z: 0 }); f.step(60)
    f.box({ x: 0, y: 5, z: 0 }, [6, 5, 6])
    f.game.respawns.items.set('safe', { position: new THREE.Vector3(8, 4, 0) })
    f.game.physics.world.updateSceneQueries()
    const safe = f.character.recovery.findSafePosition(new THREE.Vector3(0, 0.8, 0))
    check(safe?.reason === 'verified-respawn' && f.character.recovery.isSafe(safe.point), 'Blocked history must be rejected; a respawn also requires a full clearance and support test')
    save('blocked-history-validated-respawn', f, { safe: { reason: safe.reason, position: safe.point.toArray() } })

    f = fixture()
    const down = {}, getUp = {}
    const visual = { game: f.game, animations: { actions: { knockdown: down, getUp }, current: getUp } }
    f.character.knock(new THREE.Vector3(0, 3, 0))
    VisualCharacter.prototype.onAnimationFinished.call(visual, { action: getUp })
    check(f.character.knockState === 'air', 'An old getUp completion must not cancel a fresh blast')
    f.character.knockState = 'down'; visual.animations.current = down
    VisualCharacter.prototype.onAnimationFinished.call(visual, { action: getUp })
    check(f.character.knockState === 'down', 'A non-current clip must not release control')
    save('stale-animation-callback', f)
    return results
}
