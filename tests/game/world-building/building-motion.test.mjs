import assert from 'node:assert/strict'
import test from 'node:test'
import { updateBuildingMotion } from '../../../src/game/sources/Game/World/Areas/BuildingMotion.js'

const machinery = () => ({
    oven: { blower: { scale: { y: 1 } } },
    grinder: { rotation: { z: 0 } },
    anvil: { frequency: 1, hammer: { rotation: { x: 0 } } },
})

test('building machinery moves and remains bounded over a full cycle', () =>
{
    const props = machinery()
    const positions = new Set()
    for(let time = 0; time <= 2 * Math.PI; time += 0.05)
    {
        updateBuildingMotion(props, time)
        assert.ok(props.oven.blower.scale.y >= 0.6 - 1e-10 && props.oven.blower.scale.y <= 1)
        assert.ok(props.anvil.hammer.rotation.x >= -1 && props.anvil.hammer.rotation.x <= 0)
        positions.add(props.anvil.hammer.rotation.x)
    }
    assert.ok(positions.size > 10, 'the hammer must animate rather than remain frozen')
    assert.ok(props.grinder.rotation.z < 0, 'the grinder must keep turning')
})

test('frame rate and paused ticks do not change the pose at the same game time', () =>
{
    const coarse = machinery(), fine = machinery()
    for(let frame = 0; frame < 60; frame++) updateBuildingMotion(coarse, frame / 30)
    for(let frame = 0; frame < 240; frame++) updateBuildingMotion(fine, frame / 120)
    updateBuildingMotion(coarse, 2)
    updateBuildingMotion(fine, 2)
    assert.deepEqual(coarse, fine)
    const paused = structuredClone(fine)
    updateBuildingMotion(fine, 2)
    assert.deepEqual(fine, paused)
})

test('lab and workshop can have different optional props', () =>
{
    assert.doesNotThrow(() => updateBuildingMotion({}, 10))
    const grinderOnly = { grinder: { rotation: { z: 0 } } }
    updateBuildingMotion(grinderOnly, 2)
    assert.notEqual(grinderOnly.grinder.rotation.z, 0)
})
