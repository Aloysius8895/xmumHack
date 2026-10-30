// Central launcher: suites retain the working directory of their application.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
const mode = process.argv[2] || 'node'
const supported = ['node', 'game', 'crawler', 'workflows', 'python', 'all', 'browser']
if(!supported.includes(mode))
    throw new Error(`Choose one of: ${supported.join(', ')}`)

function files(directory)
{
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    {
        const full = path.join(directory, entry.name)
        return entry.isDirectory() ? files(full) : /\.test\.(mjs|js)$/.test(entry.name) ? [full] : []
    }).sort()
}

function run(label, command, args, directory = root)
{
    console.log(`\n${label}`)
    const result = spawnSync(command, args, {
        cwd: directory,
        stdio: 'inherit',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    })
    if(result.error)
        throw result.error
    if(result.status !== 0)
        process.exit(result.status ?? 1)
}

if(['node', 'game', 'all', 'workflows'].includes(mode))
{
    const selected = mode === 'workflows'
        ? [
            'tests/game/n8n/market/pipeline.test.mjs',
            'tests/game/n8n/learning/pipeline.test.mjs',
            'tests/game/server/workflow-integrations.test.mjs',
        ].map(file => path.join(root, file))
        : files(path.join(root, 'tests/game'))
    run('Game API, career UI and workflows', process.execPath,
        ['--test', '--test-concurrency=4', ...selected], path.join(root, 'src/game'))
}

if(['node', 'crawler', 'all'].includes(mode))
    run('Recruitment sampling service', process.execPath,
        ['--test', '--test-concurrency=4', ...files(path.join(root, 'tests/crawler'))], path.join(root, 'src/crawler'))

if(['python', 'all'].includes(mode))
{
    fs.mkdirSync(path.join(root, '.local/test-tmp'), { recursive: true })
    const virtualPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
    const python = process.env.PYTHON || (fs.existsSync(virtualPython) ? virtualPython : 'python')
    for(const [suite, config] of [
        ['chatbot', 'src/chatbot/pytest.ini'],
        ['aws', 'tests/aws/pytest.ini'],
        ['data', 'tests/data/pytest.ini'],
    ])
        run(`Python: ${suite}`, python, ['-m', 'pytest', `tests/${suite}`, '-c', config,
            '-q', '--basetemp', `.local/test-tmp/${suite}`])
}

if(mode === 'browser')
    run('Local browser fixture checks (requires Playwright Chromium)', process.execPath,
        ['--test', path.join(root, 'tests/browser/crawler/dynamic.js')], path.join(root, 'src/crawler'))
