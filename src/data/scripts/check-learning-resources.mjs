// Checks that every learning resource of the skill catalog (src/game/server/skill-details.js) still opens.
// Usage: node src/data/scripts/check-learning-resources.mjs   (exit code 1 when a link is broken)
// Some sites answer automated requests with a bot challenge page (status 200): those count as reachable.
import { SKILL_DETAILS, TOPIC_RESOURCES } from '../../game/server/skill-details.js'

const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
const links = [
    ...Object.entries(SKILL_DETAILS).flatMap(([skill, detail]) => detail.resources.map((resource) => ({ skill, ...resource }))),
    // Topic links of the skills made from job postings (relatedResources)
    ...TOPIC_RESOURCES.flatMap(([pattern, resources]) => resources.map((resource) => ({ skill: `topic ${pattern.source.slice(0, 24)}`, ...resource }))),
]

async function check(link)
{
    try
    {
        const response = await fetch(link.url, { headers: { 'user-agent': AGENT, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) })
        await response.body?.cancel()
        return { ...link, status: response.status, moved: response.url !== link.url ? response.url : null }
    }
    catch(error)
    {
        return { ...link, status: error.name }
    }
}

const results = []
for(let index = 0; index < links.length; index += 8)
    results.push(...await Promise.all(links.slice(index, index + 8).map(check)))
const broken = results.filter((result) => result.status !== 200)
for(const result of results.filter((result) => result.moved))
    console.log(`moved   ${result.skill}: ${result.url} -> ${result.moved}`)
for(const result of broken)
    console.log(`broken  ${result.skill}: ${result.status} ${result.url}`)
console.log(`${results.length - broken.length}/${results.length} links reachable`)
process.exitCode = broken.length ? 1 : 0
