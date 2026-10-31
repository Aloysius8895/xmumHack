import fs from 'node:fs'
import path from 'node:path'

// A paid disk deployment must not silently fall back to an ephemeral save path.
export function validateStorage(backend, env = process.env)
{
    if(env.REQUIRE_PERSISTENT_STORAGE !== '1' || backend !== 'file') return
    const root = env.PERSISTENT_DATA_DIR || '/var/data'
    const target = env.SAVE_DIR || ''
    const relative = path.relative(root, target)
    if(!path.isAbsolute(root) || !path.isAbsolute(target) || !fs.existsSync(root)
        || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
        throw new Error('SAVE_DIR must be inside the mounted PERSISTENT_DATA_DIR')
}
