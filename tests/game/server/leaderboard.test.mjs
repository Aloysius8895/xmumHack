import assert from 'node:assert/strict'
import test from 'node:test'
import * as game from '../../../src/game/server/game.js'
import * as friends from '../../../src/game/server/friends.js'
import { createSave } from '../../../src/game/server/store.js'

function learner(skillId)
{
    const save = createSave()
    save.player.name = 'Me'
    save.roadmap = { stages: [{ id: 's1', tasks: [{ id: 's1t1', skillId, mp: 10, progress: 0 }], prerequisites: [] }] }
    return save
}

function logHours(save, hours)
{
    return game.applyLog(save, { text: 'study', source: 'web', classification: { summary: 'study', items: [{ taskId: 's1t1', skillId: 'x', hours }] } })
}

test('points are the progress gained times the difficulty weight', () =>
{
    // 10 MP task, 3 hours = +30 progress points
    for(const [ skillId, difficulty, weight ] of [ [ 'cloud-deploy', 'high', 3 ], [ 'sql', 'medium', 2 ], [ 'git', 'low', 1 ], [ null, 'low', 1 ] ])
    {
        const save = learner(skillId)
        const log = logHours(save, 3)
        assert.equal(game.difficultyTier(skillId), difficulty)
        assert.equal(log.points, 30 * weight)
        assert.equal(save.points, 30 * weight)
    }
})

test('progress capped at 100 only scores what was gained, and no progress gives no points', () =>
{
    const save = learner('sql')
    save.roadmap.stages[0].tasks[0].progress = 95
    assert.equal(logHours(save, 5).points, 5 * 2)
    assert.equal(logHours(save, 5).points, 0)
})

test('friend codes round trip, update the same friend and refuse bad or own codes', () =>
{
    const me = learner('sql')
    const friend = learner('sql')
    friend.player.name = 'Ali'
    friend.points = 120

    assert.equal(friends.addFriend(me, friends.friendCode(friend)), 'added')
    friend.points = 200
    assert.equal(friends.addFriend(me, friends.friendCode(friend)), 'updated')
    assert.equal(me.friends.length, 1)
    assert.equal(me.friends[0].points, 200)

    assert.equal(friends.addFriend(me, friends.friendCode(me)), 'friend-self')
    const code = friends.friendCode(friend)
    assert.equal(friends.addFriend(me, code.slice(0, -1) + (code.at(-1) === 'a' ? 'b' : 'a')), 'friend-code')
    assert.equal(friends.addFriend(me, 'hello'), 'friend-code')
})

test('leaderboard is sorted and marks the player', () =>
{
    const save = learner('sql')
    save.points = 50
    save.friends = [ { id: 'aaaaaa', name: 'A', points: 80 }, { id: 'bbbbbb', name: 'B', points: 10 } ]
    const rows = game.view(save, { mock: true }).leaderboard
    assert.deepEqual(rows.map((row) => row.points), [ 80, 50, 10 ])
    assert.equal(rows[1].me, true)
    assert.ok(friends.removeFriend(save, 'aaaaaa'))
    assert.equal(save.friends.length, 1)
})

test('a locked stage can be started anyway, the others keep their prerequisites', () =>
{
    const save = learner('sql')
    save.roadmap.stages.push({ id: 's2', tasks: [{ id: 's2t1', skillId: 'git', mp: 5, progress: 0 }], prerequisites: [ 's1' ] })
    save.roadmap.stages.push({ id: 's3', tasks: [{ id: 's3t1', skillId: 'git', mp: 5, progress: 0 }], prerequisites: [ 's2' ] })
    const status = () => game.view(save, { mock: true }).roadmap.stages.map((stage) => stage.status)
    assert.deepEqual(status(), [ 'active', 'locked', 'locked' ])
    assert.ok(game.forceStage(save, 's3'))
    assert.deepEqual(status(), [ 'active', 'locked', 'active' ])
    assert.equal(game.forceStage(save, 'nope'), false)
})
