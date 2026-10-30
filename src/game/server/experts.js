/**
 * Industry elites a career mentor can hand the player over to (features.askMentor with elite)
 *
 * Each elite is a perspective distilled from public record with the nuwa method (skills/Distillation/nuwa-skill):
 * the full skill and its research live in src/expert/<folder>/, the AI gets the condensed card.md.
 * It is a thinking framework, not the real person: the UI says so before the first question.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const EXPERT_DIR = path.resolve(here, '..', '..', 'expert')

// Career id > elite. tagline: what the player is told about them before asking, { zh, en, ms }
const EXPERTS = {
    'ml-engineer': {
        folder: 'andrej-karpathy-perspective',
        name: 'Andrej Karpathy',
        tagline: {
            zh: '前 Tesla AI 总监、OpenAI 创始成员，CS231n 和 nanoGPT 的作者',
            en: 'former Director of AI at Tesla, founding member of OpenAI, author of CS231n and nanoGPT',
            ms: 'bekas Pengarah AI Tesla, ahli pengasas OpenAI, pengarang CS231n dan nanoGPT',
        },
    },
    'data-analyst': {
        folder: 'hans-rosling-perspective',
        name: 'Hans Rosling',
        tagline: {
            zh: '统计学教授、Gapminder 创始人、《真确》（Factfulness）作者',
            en: 'statistics professor, Gapminder co-founder, author of Factfulness',
            ms: 'profesor statistik, pengasas bersama Gapminder, pengarang Factfulness',
        },
    },
}

const cards = new Map()

/**
 * The elite of a career for the client (null: this career has none yet, or its card is missing from the deploy)
 */
export function expertOf(careerId)
{
    const expert = expertCard(careerId)
    return expert ? { name: expert.name, tagline: expert.tagline } : null
}

/**
 * The elite with the runtime card the AI speaks from (read once, null when the career or its card is missing)
 */
export function expertCard(careerId)
{
    const expert = EXPERTS[careerId]
    if(!expert)
        return null
    if(!cards.has(careerId))
        cards.set(careerId, readCard(expert.folder))
    const card = cards.get(careerId)
    return card ? { ...expert, card } : null
}

function readCard(folder)
{
    try
    {
        return fs.readFileSync(path.join(EXPERT_DIR, folder, 'card.md'), 'utf8')
    }
    catch
    {
        return null
    }
}
