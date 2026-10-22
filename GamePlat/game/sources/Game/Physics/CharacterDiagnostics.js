import * as THREE from 'three/webgpu'

/** Opt-in evidence, not gameplay logic: ?characterDebug=1 or character.diagnostics.setEnabled(true). */
export class CharacterDiagnostics
{
    constructor(character)
    {
        this.character = character
        this.game = character.game
        this.samples = []
        this.events = []
        this.sampleTime = 0
        this.enabled = false
        for(const name of ['knock', 'knockLand', 'standUp', 'knockContactRelease', 'recovered'])
            character.events.on(name, (reason) =>
            {
                if(this.enabled)
                {
                    this.events.push({ time: character.motionTime, name, reason })
                    if(this.events.length > 200) this.events.shift()
                }
            })
        if(new URLSearchParams(location.search).has('characterDebug'))
            this.setEnabled(true)
    }

    setEnabled(enabled)
    {
        this.enabled = enabled
        if(enabled && !this.mesh)
        {
            const c = this.character
            this.mesh = new THREE.Mesh(new THREE.CapsuleGeometry(c.radius, c.height - 2 * c.radius, 6, 12),
                new THREE.MeshBasicNodeMaterial({ color: '#00ffe5', wireframe: true, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false }))
            this.mesh.name = 'characterCollisionDiagnostic'
            this.mesh.renderOrder = 1000
            this.mesh.userData.preventPreRender = true
            this.game.scene.add(this.mesh)
            this.panel = document.createElement('pre')
            this.panel.id = 'character-physics-diagnostics'
            this.panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:10000;pointer-events:none;color:#bffff0;background:#07151dea;padding:10px;border:1px solid #00ccb0;border-radius:5px;font:12px/1.5 monospace;white-space:pre;max-width:95vw;'
            document.body.append(this.panel)
        }
        if(this.mesh) this.mesh.visible = enabled
        if(this.panel) this.panel.hidden = !enabled
    }

    update()
    {
        if(!this.enabled) return
        const c = this.character, body = c.chassis.physical.body
        this.mesh.position.copy(body.translation())
        this.sampleTime += this.game.ticker.deltaScaled
        if(this.sampleTime < 0.1) return
        this.sampleTime = 0
        const sample = {
            time: c.motionTime,
            wallTime: performance.now() / 1000,
            delta: this.game.ticker.deltaScaled,
            substeps: this.game.physics.substeps,
            input: this.game.player.move.toArray(),
            inputState: this.game.player.state,
            filters: [...(this.game.inputs?.filters ?? [])],
            position: { ...body.translation() },
            displacement: c.velocity.toArray(),
            velocity: { ...body.linvel() },
            grounded: c.grounded,
            supported: c.groundInfo?.supported ?? false,
            knock: c.knockState,
            penetration: c.recovery.maxPenetration,
            abnormalTime: c.recovery.duration,
            lastRecovery: c.recovery.lastReason,
            corrections: c.recovery.corrections,
            relocations: c.recovery.relocations,
        }
        this.samples.push(sample)
        if(this.samples.length > 6000) this.samples.shift()
        const vector = (v) => v.map((n) => n.toFixed(3)).join(', ')
        this.panel.textContent = `CHARACTER PHYSICS\ninput: ${vector(sample.input)}  state: ${sample.inputState}\nposition: ${vector(Object.values(sample.position))}\ndisplacement: ${vector(sample.displacement)}\nvelocity: ${vector(Object.values(sample.velocity))}\nground: ${sample.grounded}  support: ${sample.supported}  knock: ${sample.knock}\npenetration: ${sample.penetration.toFixed(4)}  abnormal: ${sample.abnormalTime.toFixed(2)}s\nsubsteps: ${sample.substeps}  recoveries: ${sample.relocations}  ${sample.lastRecovery ?? ''}`
    }
}
