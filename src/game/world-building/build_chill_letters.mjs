/**
 * Letters of the landing sign ("CHILL CHILL", replaces "BRUNO SIMON"), see sources/Game/World/Areas/LandingArea.js
 * Same format as the original letters of static/areas/areas.glb: centred, 1.45 m cap height, 0.46 m deep,
 * low poly with flat normals, one UV on the palette cell of the original letters (same colour)
 *
 * Usage: node world-building/build_chill_letters.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.join(root, 'static/areas/chillLetters.glb')
const LETTERS = [ 'C', 'H', 'I', 'L' ]
const HEIGHT = 1.45
const DEPTH = 0.46
const PALETTE_UV = [ 0.736, 0.5 ] // UV of the original letters

const font = new FontLoader().parse(JSON.parse(fs.readFileSync(path.join(root, 'node_modules/three/examples/fonts/helvetiker_bold.typeface.json'), 'utf8')))

const meshes = LETTERS.map((letter) =>
{
    const geometry = new TextGeometry(letter, { font, size: 1, depth: 1, curveSegments: 4, bevelEnabled: false })
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    const scale = HEIGHT / (box.max.y - box.min.y)
    geometry.translate(- (box.min.x + box.max.x) / 2, - (box.min.y + box.max.y) / 2, - (box.min.z + box.max.z) / 2)
    geometry.scale(scale, scale, DEPTH / (box.max.z - box.min.z))
    geometry.computeVertexNormals() // TextGeometry is non indexed: flat faces like the original letters
    geometry.computeBoundingBox()

    const count = geometry.attributes.position.count
    const uv = new Float32Array(count * 2)
    for(let i = 0; i < count; i++)
        uv.set(PALETTE_UV, i * 2)

    return { name: `letter${letter}`, position: geometry.attributes.position.array, normal: geometry.attributes.normal.array, uv, box: geometry.boundingBox }
})

// Minimal GLB writer: one buffer view per attribute, one node per letter
const chunks = []
const bufferViews = []
const accessors = []
let byteLength = 0
function addAccessor(array, type, extra = {})
{
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target: 34962 })
    chunks.push(bytes)
    byteLength += bytes.length
    accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: array.length / { VEC3: 3, VEC2: 2 }[type], type, ...extra })
    return accessors.length - 1
}

const gltf = {
    asset: { version: '2.0', generator: 'world-building/build_chill_letters.mjs' },
    scene: 0,
    scenes: [ { nodes: meshes.map((_, index) => index) } ],
    nodes: meshes.map((mesh, index) => ({ name: mesh.name, mesh: index })),
    materials: [ { name: 'palette', pbrMetallicRoughness: { baseColorFactor: [ 1, 1, 1, 1 ], metallicFactor: 0 } } ],
    meshes: meshes.map((mesh) => ({
        name: mesh.name,
        primitives: [ {
            attributes: {
                POSITION: addAccessor(mesh.position, 'VEC3', { min: mesh.box.min.toArray(), max: mesh.box.max.toArray() }),
                NORMAL: addAccessor(mesh.normal, 'VEC3'),
                TEXCOORD_0: addAccessor(mesh.uv, 'VEC2'),
            },
            material: 0,
        } ],
    })),
    bufferViews,
    accessors,
    buffers: [ { byteLength } ],
}

const binary = Buffer.concat(chunks)
let json = Buffer.from(JSON.stringify(gltf))
json = Buffer.concat([ json, Buffer.alloc((4 - json.length % 4) % 4, 0x20) ])
const header = Buffer.alloc(12)
header.writeUInt32LE(0x46546c67, 0)
header.writeUInt32LE(2, 4)
header.writeUInt32LE(12 + 8 + json.length + 8 + binary.length, 8)
const chunkHeader = (length, type) => { const buffer = Buffer.alloc(8); buffer.writeUInt32LE(length, 0); buffer.writeUInt32LE(type, 4); return buffer }
fs.writeFileSync(OUTPUT, Buffer.concat([ header, chunkHeader(json.length, 0x4e4f534a), json, chunkHeader(binary.length, 0x004e4942), binary ]))

console.log(`${OUTPUT} ${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB`, meshes.map((mesh) => `${mesh.name} ${(mesh.box.max.x - mesh.box.min.x).toFixed(2)} m`).join(', '))
