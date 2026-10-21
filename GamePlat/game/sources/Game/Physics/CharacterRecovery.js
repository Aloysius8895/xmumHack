import * as THREE from 'three/webgpu'

/** Queries and recovery for the existing dynamic capsule; normal blocked movement is never an anomaly. */
export class CharacterRecovery
{
    constructor(character)
    {
        this.character = character
        this.game = character.game
        this.world = this.game.physics.world
        this.body = character.chassis.physical.body
        this.collider = character.chassis.physical.colliders[0]
        this.skin = 0.045
        this.probe = new this.game.RAPIER.Capsule(character.halfHeight - character.radius, character.radius + this.skin)
        this.history = []
        this.duration = 0
        this.recordTime = 0
        this.relocations = 0
        this.corrections = 0
        this.lastReason = null
        this.abnormal = false
        this.contacts = []
        this.maxPenetration = 0
        this.queryPredicate = (collider) => collider.isEnabled() && !collider.isSensor()
            && (collider.parent()?.isEnabled() ?? true)
    }

    contactsAt(position)
    {
        const contacts = []
        this.world.intersectionsWithShape(position, this.body.rotation(), this.probe, (other) =>
        {
            const contact = other.contactShape(this.collider.shape, position, this.body.rotation(), this.skin)
            if(contact && Number.isFinite(contact.distance))
                contacts.push({ collider: other, distance: contact.distance, normal: contact.normal1, point: contact.point2 })
            return true
        }, this.game.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, this.collider.collisionGroups(), undefined, this.body, this.queryPredicate)
        return contacts
    }

    ground(position = this.body.translation())
    {
        const c = this.character
        const contacts = this.contactsAt(position)
        const lowerContact = (contact) => contact.point.y < position.y - 0.2 && contact.distance < 0.035
        const support = contacts.find((contact) => lowerContact(contact) && contact.normal.y > 0.15)
        let walkable = contacts.find((contact) => lowerContact(contact) && contact.normal.y >= 0.6)
        if(!walkable)
        {
            const spread = c.radius * 0.7
            for(const [x, z] of [[0, 0], [spread, 0], [- spread, 0], [0, spread], [0, - spread]])
            {
                const hit = this.ray(position, x, z, c.halfHeight + 0.1)
                if(hit && hit.normal.y >= 0.6 && hit.timeOfImpact > c.halfHeight - c.radius - 0.02)
                {
                    walkable = { collider: hit.collider, normal: hit.normal }
                    break
                }
            }
        }
        const surface = walkable ?? support
        return {
            grounded: !!walkable,
            supported: !!surface,
            velocityY: surface?.collider.parent()?.linvel().y ?? 0,
            normal: surface?.normal ?? null,
            contacts,
        }
    }

    ray(position, x, z, reach, stableOnly = false)
    {
        const R = this.game.RAPIER
        return this.world.castRayAndGetNormal(
            new R.Ray({ x: position.x + x, y: position.y, z: position.z + z }, { x: 0, y: - 1, z: 0 }),
            reach, true, R.QueryFilterFlags.EXCLUDE_SENSORS | (stableOnly ? R.QueryFilterFlags.ONLY_FIXED : 0),
            this.collider.collisionGroups(), undefined, this.body, this.queryPredicate,
        )
    }

    insideBounds(position, margin = this.character.radius - 0.015)
    {
        const b = this.game.mapBounds
        return !b || position.x >= b.minX + margin && position.x <= b.maxX - margin
            && position.z >= b.minZ + margin && position.z <= b.maxZ - margin
    }

    isSafe(position)
    {
        if(![position.x, position.y, position.z].every(Number.isFinite) || !this.insideBounds(position, this.character.radius + 0.015))
            return false
        // A real full-capsule test, including overhead/side obstacles and dynamic debris.
        if(this.contactsAt(position).some((contact) => contact.distance < 0.006))
            return false
        let supported = 0
        const spread = this.character.radius * 0.55
        for(const [x, z] of [[0, 0], [spread, 0], [- spread, 0], [0, spread], [0, - spread]])
        {
            const hit = this.ray(position, x, z, this.character.halfHeight + 0.11, true)
            if(hit && hit.normal.y >= 0.65 && hit.timeOfImpact >= this.character.halfHeight - 0.01)
                supported++
        }
        return supported >= 3
    }

    landingAt(origin, x, z, drop = 6)
    {
        const from = { x, y: origin.y + 2, z }
        const hit = this.ray(from, 0, 0, drop, true)
        if(!hit || hit.normal.y < 0.65)
            return null
        const candidate = new THREE.Vector3(x, from.y - hit.timeOfImpact + this.character.halfHeight + 0.04, z)
        return this.isSafe(candidate) ? candidate : null
    }

    findSafePosition(origin)
    {
        for(const radius of [0, 0.6, 1, 1.6, 2.4, 3.5, 5])
        {
            const count = radius ? 12 : 1
            for(let i = 0; i < count; i++)
            {
                const angle = i * Math.PI * 2 / count
                const point = this.landingAt(origin, origin.x + Math.cos(angle) * radius, origin.z + Math.sin(angle) * radius)
                if(point)
                    return { point, reason: 'verified-nearby' }
            }
        }
        const saved = [...this.history].sort((a, b) => a.distanceToSquared(origin) - b.distanceToSquared(origin))
        for(const point of saved)
        {
            if(this.isSafe(point))
                return { point, reason: 'verified-history' }
        }
        const respawns = [...(this.game.respawns?.items?.values() ?? [])]
            .sort((a, b) => a.position.distanceToSquared(origin) - b.position.distanceToSquared(origin))
        for(const respawn of respawns)
        {
            const point = this.landingAt(respawn.position, respawn.position.x, respawn.position.z, 12)
            if(point)
                return { point, reason: 'verified-respawn' }
        }
        return null // Never move to an unchecked position just because a timer expired.
    }

    depenetrate(position, contacts)
    {
        const deepest = contacts.reduce((a, b) => b.distance < a.distance ? b : a, { distance: 0 })
        if(deepest.distance > - 0.02)
            return false
        const candidate = new THREE.Vector3().copy(position).addScaledVector(deepest.normal, Math.min(0.12, - deepest.distance + 0.008))
        if(!this.insideBounds(candidate))
            return false
        const severity = (items) => items.reduce((sum, contact) => sum + Math.max(0, - contact.distance - 0.01) ** 2, 0)
        if(severity(this.contactsAt(candidate)) >= severity(contacts) - 1e-6)
            return false
        // A small, measured overlap correction, not a respawn: preserve outward and tangential motion.
        const velocity = new THREE.Vector3().copy(this.body.linvel())
        const inward = velocity.dot(deepest.normal)
        if(inward < 0)
            velocity.addScaledVector(deepest.normal, - inward)
        this.body.setTranslation(candidate, true)
        this.body.setLinvel(velocity, true)
        this.world.propagateModifiedBodyPositionsToColliders()
        this.world.updateSceneQueries()
        this.corrections++
        this.lastReason = 'depenetration'
        return true
    }

    update(delta)
    {
        let position = this.body.translation()
        this.contacts = this.contactsAt(position)
        this.maxPenetration = Math.max(0, ...this.contacts.map((contact) => - contact.distance))
        const velocity = this.body.linvel()
        const stalled = Math.hypot(velocity.x, velocity.y, velocity.z) < 0.2
        const opposed = this.contacts.some((a) => this.contacts.some((b) =>
        {
            const length = Math.hypot(a.normal.x, a.normal.z) * Math.hypot(b.normal.x, b.normal.z)
            return length > 0.2 && (a.normal.x * b.normal.x + a.normal.z * b.normal.z) / length < - 0.85
        }))
        // Below the playable terrain/sea bed, not merely a legitimate drop from a tall ledge.
        const belowWorld = position.y < - 20
        this.abnormal = this.maxPenetration > 0.025 || !this.insideBounds(position)
            || (!this.character.grounded && stalled && opposed) || belowWorld

        if(this.maxPenetration > 0.02 && this.depenetrate(position, this.contacts))
        {
            position = this.body.translation()
        }
        this.duration = this.abnormal ? this.duration + delta : 0

        this.recordTime += delta
        if(!this.abnormal && this.character.grounded && this.character.knockState === 'none' && this.recordTime > 0.4)
        {
            const safe = new THREE.Vector3().copy(position).add({ x: 0, y: 0.04, z: 0 })
            if(this.isSafe(safe))
            {
                this.history.push(safe)
                if(this.history.length > 24) this.history.shift()
            }
            this.recordTime = 0
        }
        if(this.duration > 2.5)
        {
            const safe = this.findSafePosition(new THREE.Vector3().copy(position))
            if(safe)
            {
                this.character.moveTo(safe.point, this.character.facing)
                this.lastReason = safe.reason
                this.relocations++
                this.character.events.trigger('recovered', [safe.reason])
            }
            this.duration = 0
        }
    }

    reset()
    {
        this.duration = 0
        this.abnormal = false
        this.contacts = []
        this.maxPenetration = 0
    }
}
