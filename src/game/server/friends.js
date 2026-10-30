/**
 * Leaderboard with friend codes: no accounts, no shared server
 * A friend code carries the player id, name and points at the time it was shared (CQ-<base64url json>-<checksum>).
 * Adding a code again updates that friend's points. Codes are a snapshot and are not tamper proof (friendly game).
 */
const PREFIX = 'CQ'
export const MAX_FRIENDS = 50
const MAX_NAME = 24

function checksum(text)
{
    // FNV-1a, catches typos and truncated copies
    let hash = 0x811c9dc5
    for(let i = 0; i < text.length; i++)
    {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193) >>> 0
    }
    return hash.toString(36).slice(0, 4).padStart(4, '0')
}

export function cleanName(name)
{
    return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
}

export function friendCode(save)
{
    const payload = Buffer.from(JSON.stringify({
        v: 1,
        i: save.player.id,
        n: save.player.name,
        p: save.points,
        t: new Date().toISOString().slice(0, 10),
    })).toString('base64url')
    return `${PREFIX}-${payload}-${checksum(payload)}`
}

/**
 * Code > { id, name, points, sharedAt }, or null when it isn't a valid code
 */
export function readFriendCode(code)
{
    const match = String(code ?? '').trim().match(/^CQ-([A-Za-z0-9_-]+)-([a-z0-9]{4})$/)
    if(!match || checksum(match[1]) !== match[2])
        return null
    try
    {
        const data = JSON.parse(Buffer.from(match[1], 'base64url').toString('utf8'))
        if(data.v !== 1 || typeof data.i !== 'string' || !/^[a-z0-9]{6,32}$/.test(data.i) || !Number.isFinite(data.p))
            return null
        return { id: data.i, name: cleanName(data.n), points: Math.max(0, Math.round(data.p)), sharedAt: String(data.t ?? '').slice(0, 10) }
    }
    catch
    {
        return null
    }
}

/**
 * Returns 'added' | 'updated', or the error code: 'friend-code' | 'friend-self' | 'friend-full'
 */
export function addFriend(save, code)
{
    const friend = readFriendCode(code)
    if(!friend)
        return 'friend-code'
    if(friend.id === save.player.id)
        return 'friend-self'

    const existing = save.friends.find((item) => item.id === friend.id)
    if(existing)
    {
        Object.assign(existing, friend)
        return 'updated'
    }
    if(save.friends.length >= MAX_FRIENDS)
        return 'friend-full'
    save.friends.push({ ...friend, addedAt: new Date().toISOString() })
    return 'added'
}

export function removeFriend(save, id)
{
    const count = save.friends.length
    save.friends = save.friends.filter((item) => item.id !== id)
    return save.friends.length < count
}

// Player and friends, best first (ties: the player first)
export function leaderboard(save)
{
    const rows = [
        { id: save.player.id, name: save.player.name, points: save.points, me: true, sharedAt: null },
        ...save.friends.map((friend) => ({ id: friend.id, name: friend.name, points: friend.points, me: false, sharedAt: friend.sharedAt })),
    ]
    return rows.sort((a, b) => b.points - a.points || Number(b.me) - Number(a.me))
}
