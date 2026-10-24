// Prepare local auth without logging secret material or changing AI configuration.
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { buildPostingWatchWorkflow, CREDENTIAL_ID } from './build-workflow.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const envPath = path.join(root, '.env')
let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
let token = dotenv.parse(contents).INTEGRATION_TOKEN
if(!token)
{
    token = crypto.randomBytes(32).toString('hex')
    if(/^INTEGRATION_TOKEN\s*=/m.test(contents)) contents = contents.replace(/^INTEGRATION_TOKEN\s*=.*$/m, `INTEGRATION_TOKEN=${token}`)
    else contents += `\nINTEGRATION_TOKEN=${token}\n`
    fs.writeFileSync(envPath, contents)
}
const directory = path.join(root, '.local-automation')
fs.mkdirSync(directory, { recursive: true })
fs.writeFileSync(path.join(directory, 'credential.json'), JSON.stringify([{ id: CREDENTIAL_ID, name: 'CareerSphere posting watch bearer', type: 'httpHeaderAuth', data: { name: 'Authorization', value: `Bearer ${token}` } }]))
fs.writeFileSync(path.join(directory, 'posting-watch.workflow.json'), JSON.stringify(buildPostingWatchWorkflow(), null, 2))
console.log('Local bearer credential and workflow prepared in gitignored .local-automation; token not printed.')
