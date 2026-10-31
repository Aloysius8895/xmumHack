/**
 * MOCK AI exposure (prompt 07) for the catalog skills the Anthropic Economic Index gives no reviewed value: no O*NET
 * task matches them, or their mapping awaits review. Mock data, labelled as such, never authored numbers: each value
 * is imputed from the real, reviewed values of data/ai-exposure/exposure.json, and a real value always wins
 * (src/game/server/ai-exposure.js reads a mock row only for a skill without one).
 *
 *   method   career-mean-imputation: the mean automation and augmentation of the other skills with real values in the
 *            careers that need the skill (data/ai-exposure/skill_task_map.json); the mean of every real skill when
 *            none of those careers has one
 *
 * Run again after a review (python src/data/scripts/build_ai_exposure.py) so reviewed skills leave the mock.
 * node src/data/scripts/mock-ai-exposure.mjs   → data/mock/ai-exposure.json
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const OUT = new URL('../../../data/mock/ai-exposure.json', import.meta.url)
const EXPOSURE = new URL('../../../data/ai-exposure/exposure.json', import.meta.url)
const MAP = new URL('../../../data/ai-exposure/skill_task_map.json', import.meta.url)
const TASKS = new URL('../config/mock-skill-tasks.json', import.meta.url)

const round = (value) => Math.round(value * 10000) / 10000
const mean = (values) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null

export function imputeExposure(exposure, map, mockTasks = {})
{
    const real = Object.fromEntries(Object.entries(exposure.skills ?? {}).filter(([ , row ]) => Array.isArray(row.tasks) && row.tasks.length))
    const everyReal = Object.keys(real)
    const skills = {}
    for(const id of Object.keys(map.skills ?? {}).filter((skill) => !real[skill]))
    {
        const careers = Object.entries(map.careers ?? {}).filter(([ , career ]) => career.skills.includes(id)).map(([ careerId ]) => careerId)
        const neighbours = [ ...new Set(careers.flatMap((careerId) => map.careers[careerId].skills).filter((skill) => real[skill])) ].sort()
        const basis = neighbours.length ? neighbours : everyReal
        skills[id] = {
            automation: mean(basis.map((skill) => real[skill].automation)),
            augmentation: mean(basis.map((skill) => real[skill].augmentation)),
            mock: true,
            ...(mockTasks[id]?.length ? { mockTasks: mockTasks[id] } : {}),
            method: neighbours.length ? 'career-mean-imputation' : 'all-skills-mean-imputation',
            basis: { careers, skills: basis },
        }
    }
    return skills
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
    const exposure = JSON.parse(fs.readFileSync(EXPOSURE, 'utf8'))
    const map = JSON.parse(fs.readFileSync(MAP, 'utf8'))
    const tasks = JSON.parse(fs.readFileSync(TASKS, 'utf8'))
    const skills = imputeExposure(exposure, map, tasks.mock === true ? tasks.skills : {})
    const document = {
        mock: true,
        generator: 'src/data/scripts/mock-ai-exposure.mjs',
        generatedAt: new Date().toISOString(),
        about: 'MOCK AI exposure, not observed data: imputed from reviewed Anthropic Economic Index skill values. mockTasks are synthetic project-created examples from src/data/config/mock-skill-tasks.json, not observed AEI/O*NET tasks and not used to calculate exposure values or evidence quality. Real values always take precedence. Every result using imputed values is marked mock.',
        basis: { exposure: 'data/ai-exposure/exposure.json', map: 'data/ai-exposure/skill_task_map.json', downloadedAt: exposure.source?.downloadedAt ?? null },
        skills,
    }
    fs.mkdirSync(new URL('.', OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(document, null, 2) + '\n')
    console.log(`${Object.keys(skills).length} imputed skills → data/mock/ai-exposure.json`)
    for(const [ id, row ] of Object.entries(skills))
        console.log(`  ${id.padEnd(28)} ${row.automation} / ${row.augmentation}  ${row.method} (${row.basis.skills.length} skills)`)
}
