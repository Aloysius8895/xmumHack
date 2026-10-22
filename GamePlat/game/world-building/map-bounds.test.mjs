import assert from 'node:assert/strict'
import test from 'node:test'
import { MAP_BOUNDS, MAP_WIDTH, MAP_HEIGHT, insideMap, worldToCroppedMap } from '../sources/Game/MapBounds.js'

test('cropped world corners align with map corners',()=>{
    assert.deepEqual(worldToCroppedMap({x:MAP_BOUNDS.minX,z:MAP_BOUNDS.minZ}),{x:0,y:0})
    assert.deepEqual(worldToCroppedMap({x:MAP_BOUNDS.maxX,z:MAP_BOUNDS.maxZ}),{x:1,y:1})
    assert.deepEqual(worldToCroppedMap({x:71,z:16}),{x:.5,y:.5})
    assert.equal(MAP_WIDTH,178)
    assert.equal(MAP_HEIGHT,136)
})
test('excluded west/north regions cannot reappear as playable map positions',()=>{
    assert.equal(insideMap({x:-30,z:0}),false)
    assert.equal(insideMap({x:20,z:-60}),false)
    assert.equal(insideMap({x:39.5,z:37.8}),true)
    assert.deepEqual(worldToCroppedMap({x:-500,z:500}),{x:0,y:1})
})
test('two-dimensional and world-coordinate markers agree',()=>{
    assert.deepEqual(worldToCroppedMap({x:28,y:12}),worldToCroppedMap({x:28,z:12}))
})
