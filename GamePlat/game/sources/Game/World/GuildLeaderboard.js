import * as THREE from 'three/webgpu'
import { Fn, mix, texture, vec4 } from 'three/tsl'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { CharacterSelect, CHARACTERS } from '../CharacterSelect.js'
import { t } from '../../Career/i18n.js'
import { createQuestNotice, paintRankings } from './GuildLeaderboardArtwork.js'

export class GuildLeaderboard
{
    constructor(area, surface)
    {
        this.game = area.game
        this.rows = []
        this.portraits = new Map()
        this.playerCharacter = CharacterSelect.getSaved().id
        this.canvas = document.createElement('canvas')
        this.canvas.width = 1024
        this.canvas.height = 896
        this.context = this.canvas.getContext('2d')
        this.texture = this.createTexture(this.canvas)

        this.group = new THREE.Group()
        this.group.name = 'guildLeaderboard'
        this.placeOnSurface(surface, area.model.position)
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.93, 1.68), this.createMaterial(this.texture))
        this.mesh.name = 'guildRankingsParchment'
        this.mesh.position.z = 0.045
        this.mesh.receiveShadow = true
        this.group.add(this.mesh)

        const notices = [
            ['star', - 1.10, 0.47, 0.08, true],
            ['potion', - 1.12, - 0.23, - 0.09, true],
            ['leaf', 1.13, 0.38, - 0.10, false],
            ['star', 1.15, - 0.34, 0.07, false],
        ]
        for(const [symbol, x, y, rotation, lavender] of notices)
        {
            const map = this.createTexture(createQuestNotice(symbol, lavender))
            const notice = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.49), this.createMaterial(map))
            notice.name = `guildNotice-${symbol}`
            notice.position.set(x, y, 0.065)
            notice.rotation.z = rotation
            notice.receiveShadow = true
            this.group.add(notice)
        }
        this.game.scene.add(this.group)
        area.objects.hideable.push(this.group)

        this.paper = new Image()
        this.paper.onload = () => this.draw()
        this.paper.onerror = () => console.warn('Guild leaderboard: parchment artwork could not be loaded')
        this.paper.src = 'leaderboard/guild-parchment.png'
        document.fonts.load('700 39px "Pally-Bold"').then(() => this.draw())
    }

    createTexture(canvas)
    {
        const map = new THREE.CanvasTexture(canvas)
        map.colorSpace = THREE.SRGBColorSpace
        map.minFilter = THREE.LinearMipmapLinearFilter
        map.magFilter = THREE.LinearFilter
        map.anisotropy = 4
        return map
    }

    createMaterial(map)
    {
        const paper = texture(map)
        const material = new MeshDefaultMaterial({
            colorNode: paper.rgb,
            alphaNode: paper.a,
            transparent: true,
            alphaTest: 0.2,
            hasWater: false,
        })
        // Soft lantern fill keeps ink legible under the roof's strong purple shadow.
        // Scene shading, clipping, transparency and the reveal still come from the game material.
        const shaded = material.outputNode
        material.outputNode = Fn(() =>
        {
            const output = shaded.toVar()
            return vec4(mix(output.rgb, paper.rgb, 0.62), output.a)
        })()
        return material
    }

    placeOnSurface(surface, areaPosition)
    {
        // The source GLB bakes the plane orientation into its vertices as well as its transform.
        // Use UV corners so both compressed and uncompressed models give the same placement.
        surface.updateMatrix()
        const positions = surface.geometry.getAttribute('position')
        const uvs = surface.geometry.getAttribute('uv')
        const corner = (u, v) =>
        {
            let nearest = 0, distance = Infinity
            for(let i = 0; i < uvs.count; i++)
            {
                const candidate = (uvs.getX(i) - u) ** 2 + (uvs.getY(i) - v) ** 2
                if(candidate < distance)
                {
                    nearest = i
                    distance = candidate
                }
            }
            return new THREE.Vector3().fromBufferAttribute(positions, nearest).applyMatrix4(surface.matrix)
        }
        const topLeft = corner(0, 0), topRight = corner(1, 0), bottomLeft = corner(0, 1)
        const right = topRight.clone().sub(topLeft).normalize()
        const up = topLeft.clone().sub(bottomLeft).normalize()
        const normal = new THREE.Vector3().crossVectors(right, up).normalize()
        this.group.position.copy(topRight).add(bottomLeft).multiplyScalar(0.5).add(areaPosition)
        this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal))
    }

    bind(api)
    {
        this.api = api
        const update = (state) =>
        {
            this.rows = (state?.leaderboard ?? []).slice(0, 3)
            this.draw()
        }
        api.events.on('state', update)
        update(api.state)
    }

    setPlayerCharacter(id)
    {
        this.playerCharacter = id
        this.draw()
    }

    portrait(row)
    {
        const normalize = (name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, '')
        const id = row.me ? this.playerCharacter : CHARACTERS.find((character) => normalize(character.id) === normalize(row.name))?.id
        if(!id)
            return null
        if(!this.portraits.has(id))
        {
            const image = new Image()
            this.portraits.set(id, image)
            image.onload = () => this.draw()
            image.src = `ui/avatars/${id}.png`
        }
        const image = this.portraits.get(id)
        return image.complete && image.naturalWidth ? image : null
    }

    draw()
    {
        if(!this.paper?.complete || !this.paper.naturalWidth)
            return
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this.context.drawImage(this.paper, 0, 0, this.canvas.width, this.canvas.height)
        this.paintedRows = paintRankings(this.context, this.rows, {
            portrait: (row) => this.portrait(row),
            emptyLabel: t('leaderboard.openSpot'),
            unnamedLabel: t('leaderboard.noName'),
        })
        this.texture.needsUpdate = true
    }
}
