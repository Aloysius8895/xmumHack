import { useCustom } from './careers.js'
import { localizedSkillName } from './profile-localization.js'

const LANGS = [ 'zh', 'en', 'ms' ]

export const localizedSkillTextSchema = {
    type: 'object',
    properties: Object.fromEntries(LANGS.map((lang) => [ lang, { type: 'string' } ])),
    required: LANGS,
    additionalProperties: false,
}

function localizedText(value, limit)
{
    if(!value || !LANGS.every((lang) => typeof value[lang] === 'string' && value[lang].trim()))
        return null
    return Object.fromEntries(LANGS.map((lang) => [ lang, value[lang].trim().slice(0, limit) ]))
}

export function postingSkillLocalization(requirement)
{
    const name = localizedSkillName(requirement.skillName)
    const description = localizedText(requirement.skillDescription, 600)
    return name && description ? { name, description } : null
}

/** Older posting skills copied their source sentence into all three language slots. */
export function missingPostingSkillTranslations(save)
{
    const targets = [ save.target, ...Object.values(save.careers ?? {}).map((entry) => entry?.target) ]
    const ids = new Set(targets.filter((target) => target?.mode === 'customise')
        .flatMap((target) => target.posting?.requirements ?? [])
        .filter((requirement) => ![ 'education', 'experience' ].includes(requirement.kind))
        .map((requirement) => requirement.skillId))
    const copied = (value) => new Set(LANGS.map((lang) => value[lang])).size === 1
    return [ ...ids ].flatMap((id) =>
    {
        const skill = save.customSkills?.[id]
        if(!skill) return []
        const name = localizedSkillName(skill.name)
        const description = localizedText(skill.detail?.description, 600)
        if(name && description && (skill.localizationVersion === 1 || !copied(name) || !copied(description)))
            return []
        return [ { id, name: skill.name, description: skill.detail?.description ?? {} } ]
    })
}

/** One persisted repair, shared by every view; IDs and all learning data remain untouched. */
export async function localizePostingSkills(save, translate)
{
    const pending = missingPostingSkillTranslations(save)
    if(!pending.length)
        return { translatedSkills: 0, skillTranslationPending: false }

    const translated = new Map()
    for(let offset = 0; offset < pending.length; offset += 24)
    {
        const batch = pending.slice(offset, offset + 24)
        const result = await translate(batch)
        // Demo mode has no translation service. Keep originals available for a later real request.
        if(result === null)
            return { translatedSkills: 0, skillTranslationPending: true }
        const expected = new Set(batch.map((skill) => skill.id))
        if(!Array.isArray(result) || result.length !== batch.length)
            throw new Error('incomplete-skill-translations')
        for(const item of result)
        {
            const text = postingSkillLocalization({ skillName: item?.name, skillDescription: item?.description })
            if(!expected.delete(item?.id) || !text)
                throw new Error('invalid-skill-translations')
            translated.set(item.id, text)
        }
    }

    // Validate the entire response before mutating the save, including across batches.
    for(const [ id, text ] of translated)
    {
        const skill = save.customSkills[id]
        skill.name = text.name
        skill.detail.description = text.description
        skill.localizationVersion = 1
    }
    useCustom(save)
    return { translatedSkills: translated.size, skillTranslationPending: false }
}
