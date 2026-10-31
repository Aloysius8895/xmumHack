/**
 * Skill evidence in the three languages. Profiles extracted before 2026-10-31 kept the evidence sentence in the
 * language of the CV or of the screen at the time (one string); it is translated once, when the player picks a
 * language, and saved as { zh, en, ms }. Levels, ids and sources are never touched.
 */
import { SKILLS } from './careers.js'

const LANGS = [ 'zh', 'en', 'ms' ]
export const EVIDENCE_LIMIT = 200

/** { zh, en, ms } trimmed, or null when a language is missing */
export function localizedEvidence(value)
{
    if(!value || typeof value !== 'object' || !LANGS.every((lang) => typeof value[lang] === 'string' && value[lang].trim()))
        return null
    return Object.fromEntries(LANGS.map((lang) => [ lang, value[lang].trim().slice(0, EVIDENCE_LIMIT) ]))
}

export function localizedSkillName(value)
{
    const text = localizedEvidence(value)
    if(!text || /\p{Script=Han}/u.test(text.en + text.ms)) return null
    return Object.fromEntries(LANGS.map(lang => [lang, text[lang].slice(0, 100)]))
}

/** Resolve a catalog alias without changing a skill's identity, level or evidence. */
export function profileSkillNames(skill)
{
    const raw = String(skill.name ?? '').trim().toLowerCase()
    const known = SKILLS[skill.id] ?? Object.values(SKILLS).find(names => Object.values(names).some(name => name.trim().toLowerCase() === raw))
    return known ?? (skill.localizedNameSource === undefined || skill.localizedNameSource === skill.name ? localizedSkillName(skill.localizedName) : null)
}

/** Evidence as stored: { zh, en, ms }, or a single sentence still to translate ('' when none) */
export const cleanEvidence = (value) => localizedEvidence(value) ?? String(typeof value === 'string' ? value : '').slice(0, EVIDENCE_LIMIT)

/** The evidence in one language: its translation, or the single sentence as written */
export const evidenceIn = (value, lang = 'en') => localizedEvidence(value)?.[lang] ?? (typeof value === 'string' ? value : '')

/** Profile skills whose evidence is one sentence: [{ id, text }] with id their index in the profile */
export function untranslatedEvidence(save)
{
    return (save.profile?.skills ?? []).flatMap((skill, index) => typeof skill.evidence === 'string' && skill.evidence.trim() ? [ { id: String(index), text: skill.evidence } ] : [])
}

/** Translates every single-sentence evidence once; demo mode (translate returns null) leaves them for a later request */
export async function localizeProfileEvidence(save, translate)
{
    const names = (save.profile?.skills ?? []).flatMap((skill, index) => !profileSkillNames(skill) && skill.name?.trim()
        ? [{ id: `name:${index}`, text: skill.name }] : [])
    const pending = [...untranslatedEvidence(save), ...names]
    if(!pending.length)
        return { translatedEvidence: 0, evidenceTranslationPending: false }
    const result = await translate(pending)
    if(result === null)
        return { translatedEvidence: 0, evidenceTranslationPending: true }
    const expected = new Set(pending.map((item) => item.id))
    const translated = new Map()
    for(const item of Array.isArray(result) ? result : [])
    {
        const text = item?.id?.startsWith('name:') ? localizedSkillName(item.evidence) : localizedEvidence(item?.evidence)
        if(!expected.delete(item?.id) || !text)
            throw new Error('invalid-evidence-translations')
        translated.set(item.id, text)
    }
    if(expected.size)
        throw new Error('incomplete-evidence-translations')
    // Validated as a whole before the save changes
    for(const [ id, text ] of translated)
        if(id.startsWith('name:'))
        {
            const skill = save.profile.skills[Number(id.slice(5))]
            skill.localizedName = text
            skill.localizedNameSource = skill.name
        }
        else save.profile.skills[Number(id)].evidence = text
    return { translatedEvidence: translated.size, evidenceTranslationPending: false }
}
