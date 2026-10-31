import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import * as THREE from '../../../src/game/node_modules/three/build/three.webgpu.js'
import {BuildingScreen} from '../../../src/game/sources/Career/BuildingScreen.js'

function workshop()
{
    const bytes = readFileSync(new URL('../../../src/game/static/areas/areas-compressed.glb', import.meta.url))
    const asset = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
    const objects = new Map()
    function build(index)
    {
        const node = asset.nodes[index]
        let object = new THREE.Group()
        if(node.mesh !== undefined)
        {
            const primitive = asset.meshes[node.mesh].primitives[0]
            const bounds = asset.accessors[primitive.attributes.POSITION]
            const size = bounds.max.map((value, axis) => value - bounds.min[axis])
            const center = bounds.max.map((value, axis) => (value + bounds.min[axis]) / 2)
            object = new THREE.Mesh(new THREE.BoxGeometry(...size).translate(...center))
        }
        object.position.fromArray(node.translation ?? [0, 0, 0])
        object.quaternion.fromArray(node.rotation ?? [0, 0, 0, 1])
        object.scale.fromArray(node.scale ?? [1, 1, 1])
        objects.set(node.name, object)
        for(const child of node.children ?? []) object.add(build(child))
        return object
    }
    const root = build(asset.nodes.findIndex(node => node.name === 'projects'))
    // Areas reparents each top-level object into the scene with the root translation baked in.
    const scene = new THREE.Scene()
    root.updateMatrixWorld(true)
    for(const child of [...root.children]) scene.attach(child)
    return {objects, scene}
}

function projectedBounds(object, camera, width)
{
    object.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(object)
    const xs = []
    for(const x of [bounds.min.x, bounds.max.x])
        for(const y of [bounds.min.y, bounds.max.y])
            for(const z of [bounds.min.z, bounds.max.z])
                xs.push((new THREE.Vector3(x, y, z).project(camera).x + 1) * width / 2)
    return {left: Math.min(...xs), right: Math.max(...xs)}
}

test('original wooden side signs and arrows remain in view, in front of the frame and outside the content', () =>
{
    for(const [width, height] of [[390, 844], [900, 593], [1800, 1186], [1920, 1080]])
    {
        const {objects} = workshop()
        const surface = objects.get('refImages')
        surface.geometry.computeBoundingBox()
        const camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 200)
        const screen = {surface}
        const stage = {
            surface, screen, workshop: screen, game: {viewport: {width, height}, view: {camera}},
            sideFurniture: ['refPrevious', 'refNext'].map(name => {
                const object = objects.get(name)
                return {object, scale: object.scale.clone(), position: object.position.clone()}
            }),
        }
        BuildingScreen.prototype.applySideFurniture.call(stage)
        const framing = BuildingScreen.prototype.framing.call(stage)
        camera.position.copy(framing.position)
        camera.lookAt(framing.target)
        camera.updateMatrixWorld(true)
        const content = projectedBounds(surface, camera, width)
        const previous = projectedBounds(objects.get('refPrevious'), camera, width)
        const next = projectedBounds(objects.get('refNext'), camera, width)
        assert.ok(previous.left >= 0, `left sign clipped at ${width}x${height}: ${previous.left}`)
        assert.ok(next.right <= width, `right sign clipped at ${width}x${height}: ${next.right}`)
        assert.ok(previous.right < content.left, `left control overlaps content at ${width}x${height}`)
        assert.ok(next.left > content.right, `right control overlaps content at ${width}x${height}`)
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(surface.getWorldQuaternion(new THREE.Quaternion()))
        const center = surface.getWorldPosition(new THREE.Vector3())
        for(const name of ['refArrowPreviousProject', 'refArrowNextProject'])
        {
            const arrow = objects.get(name)
            arrow.geometry.computeBoundingBox()
            const position = arrow.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(arrow.matrixWorld)
            assert.ok(position.sub(center).dot(normal) > 0.25, `${name} is behind the frame`)
        }
    }
})
