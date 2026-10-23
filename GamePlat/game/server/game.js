/**
 * Game rules: everything that changes progress, affinity or points is decided here, never by the AI
 *
 * Loop (skills/game/game-design-theory, MDA): know your skills > pick a target > get the career pet > follow the roadmap
 * > log what you did and track preparation. Daily-report mastery growth is a separate, future feature.
 */
import { DEFAULT_MAP, SKILLS, SKILL_IDS, allCareers, getCareer, localText, matchCareer, useCustom } from './careers.js'
import { SKILL_DETAILS } from './skill-details.js'
import { expertOf } from './experts.js'
import { friendCode, leaderboard } from './friends.js'
import { marketSnapshot, skillMarket, skillTrendOrReference } from './market-trends.js'
import { GOALS, PLATFORM_TARGETS, SKILL_TARGETS, SOURCE as SDG_SOURCE, TARGETS, TARGET_IDS, careerSdgs, contribution } from './sdg.js'
import { loadMarket } from './store.js'
import { trendsView } from './trends.js'
import { createHash } from 'node:crypto'

export const RULES = {
    affinityPerLevel: 20,      // affinity (affinityOf: profile match + learning progress) per pet level
    affinityMax: 100,
    // Points = task progress gained (percentage points) × weight of the skill difficulty (skill-details, 1-5)
    difficultyWeights: { high: 3, medium: 2, low: 1 },
    maxStages: 6,
    maxTasksPerStage: 4,
}

// Pet level 1-6 from affinity
export function petLevel(affinity)
{
    return 1 + Math.floor(Math.min(affinity, RULES.affinityMax) / RULES.affinityPerLevel)
}

// Difficulty 4-5 high, 3 medium, 1-2 or unknown skill low
export function difficultyTier(skillId)
{
    const difficulty = SKILL_DETAILS[skillId]?.difficulty ?? 1
    return difficulty >= 4 ? 'high' : difficulty === 3 ? 'medium' : 'low'
}

/**
 * Profile
 */
export function mergeSkills(profile, extracted)
{
    for(const skill of extracted)
    {
        const id = skill.skillId === 'other' ? null : skill.skillId
        const existing = profile.skills.find((item) => id ? item.id === id : !item.id && item.name.toLowerCase() === skill.name.toLowerCase())
        if(existing)
        {
            existing.level = Math.max(existing.level, skill.level)
            existing.evidence = skill.evidence || existing.evidence
        }
        else
        {
            profile.skills.push({ id, name: skill.name, level: skill.level, evidence: skill.evidence, source: 'ai' })
        }
    }
}

export function setSkills(profile, skills)
{
    profile.skills = skills
        .filter((skill) => skill && typeof skill.name === 'string' && skill.name.trim())
        .map((skill) => ({
            id: skill.id && SKILLS[skill.id] ? skill.id : null,
            name: skill.name.trim().slice(0, 80),
            level: Math.max(0, Math.min(3, Math.round(Number(skill.level) || 0))),
            evidence: String(skill.evidence ?? '').slice(0, 200),
            source: skill.source === 'ai' || skill.source === 'gym' ? skill.source : 'manual',
        }))
}

/**
 * Map: one career mentor per NPC spot. A target off the map takes the spot of the mentor with the lowest affinity
 */
export function mapSlots(save)
{
    return save.map ?? DEFAULT_MAP
}

export function isOnMap(save, careerId)
{
    return mapSlots(save).includes(careerId)
}

// Degrees and years of experience are hiring conditions, not skills to learn (zh, en, ms)
const EDUCATION = /\b(degree|diploma|bachelor'?s?|master'?s degree|ph\.?\s?d|graduate of|ijazah|sarjana)\b|学位|学历|本科|硕士|博士|大专|文凭|毕业/i
const EXPERIENCE = /\d+\s*\+?\s*(years?|yrs?|tahun)\b|\byears? of\b|\b(proven|prior|previous|work|working|professional|industry) experience\b|\bexperience as\b|\bpengalaman (sebagai|kerja|bekerja)\b|\d+\s*年|[一二三四五六七八九十两]+年|工作经验|从业经验|相关经验|(岗位|职位|工作)的?.{0,12}经验/i

/**
 * What a posting requirement asks for: 'skill', 'education' or 'experience'. The AI labels it (features.analyzePosting);
 * postings analysed before that are guessed from the words, only when outside the catalog (a catalog skill stays a skill).
 */
export function requirementKind(requirement)
{
    if([ 'skill', 'education', 'experience' ].includes(requirement?.kind))
        return requirement.kind
    const skillId = String(requirement?.skillId ?? '')
    if(SKILLS[skillId] && !skillId.startsWith('custom-'))
        return 'skill'
    const text = String(requirement?.text ?? '')
    return EDUCATION.test(text) ? 'education' : EXPERIENCE.test(text) ? 'experience' : 'skill'
}

/**
 * The career as the player targets it. Customised to a job posting (current or shelved target), the posting's skill
 * requirements replace the career's default skills: the highest level asked, must weighs 3 and nice 1. Requirements
 * outside the catalog count once adoptPostingSkills made them custom skills; education and experience never count.
 * No skill left keeps the defaults.
 */
export function targetedCareer(save, career)
{
    const target = save.target?.careerId === career.id ? save.target : save.careers?.[career.id]?.target
    if(target?.mode !== 'customise' || !Array.isArray(target.posting?.requirements))
        return career
    const skills = new Map()
    for(const requirement of target.posting.requirements)
    {
        if(!SKILLS[requirement?.skillId] || requirementKind(requirement) !== 'skill')
            continue
        const level = Math.max(1, Math.min(3, Math.round(Number(requirement.level) || 1)))
        const weight = requirement.priority === 'must' ? 3 : 1
        const known = skills.get(requirement.skillId)
        skills.set(requirement.skillId, { id: requirement.skillId, level: Math.max(known?.level ?? 0, level), weight: Math.max(known?.weight ?? 0, weight) })
    }
    return skills.size ? { ...career, skills: [ ...skills.values() ] } : career
}

/**
 * Posting skill requirements matching no known skill ("other") become custom skills of the save, so the pet, the
 * affinity and the roadmap can follow them too. The requirement then points at its skill. Education and experience
 * requirements stay "other", and a custom skill made from one earlier is released. Ids come from the requirement text,
 * so running it again (every request, app.js) changes nothing; returns whether the custom skills changed.
 */
export function adoptPostingSkills(save)
{
    const targets = [ save.target, ...Object.values(save.careers ?? {}).map((entry) => entry?.target) ]
        .filter((target) => target?.mode === 'customise' && Array.isArray(target.posting?.requirements))
    let changed = false
    const released = new Set()
    for(const target of targets)
    {
        for(const requirement of target.posting.requirements)
        {
            const text = String(requirement?.text ?? '').trim()
            const current = String(requirement?.skillId ?? '')
            if(requirementKind(requirement) !== 'skill')
            {
                // A catalog skill id stays (targetedCareer skips the requirement); one made from it goes back to "other"
                if(current.startsWith('custom-'))
                {
                    released.add(current)
                    requirement.skillId = 'other'
                }
                continue
            }
            // Already a catalog skill, or a custom skill this save has
            if(!text || (current.startsWith('custom-') ? save.customSkills?.[current] : SKILLS[current]))
                continue
            const base = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
            const id = `custom-${base || createHash('sha256').update(text).digest('hex').slice(0, 8)}`
            save.customSkills ??= {}
            // Only this save counts: the SKILLS registry may still hold another save's custom skills
            if(!save.customSkills[id])
            {
                // The posting is in one language: the same words in all three
                const name = text.slice(0, 60)
                const description = String(requirement.note || text).slice(0, 300)
                save.customSkills[id] = {
                    name: { zh: name, en: name, ms: name },
                    detail: { icon: 'compass', demand: 'medium', heat: 60, difficulty: 3, description: { zh: description, en: description, ms: description } },
                }
                changed = true
            }
            requirement.skillId = id
        }
    }

    // Released skills nothing else uses (another requirement, an AI-generated career) leave the save
    const used = new Set([
        ...targets.flatMap((target) => target.posting.requirements.map((requirement) => requirement?.skillId)),
        ...(save.customCareers ?? []).flatMap((career) => career.skills.map((skill) => skill.id)),
    ])
    for(const id of released)
        if(!used.has(id) && save.customSkills?.[id])
        {
            delete save.customSkills[id]
            changed = true
        }

    if(changed)
        useCustom(save)
    return changed
}

/**
 * Preparation per required skill of a career (as targeted, targetedCareer): the best of the profile level against the
 * required one, the roadmap tasks of that skill (this career's roadmap, current or saved) and the mastery of the daily
 * digests (server/integrations.js)
 */
export function skillProgress(save, career)
{
    career = targetedCareer(save, career)
    const roadmap = save.target?.careerId === career.id ? save.roadmap : save.careers?.[career.id]?.roadmap
    const tasks = roadmap ? roadmap.stages.flatMap((stage) => stage.tasks) : []
    return matchCareer(career, save.profile.skills).skills.map((skill) =>
    {
        const own = tasks.filter((task) => task.skillId === skill.id)
        const roadmapProgress = own.length ? Math.round(own.reduce((sum, task) => sum + task.progress, 0) / own.length) : 0
        const baseline = Math.round(Math.min(skill.current, skill.required) / skill.required * 100)
        return { ...skill, progress: Math.max(baseline, roadmapProgress, save.mastery?.[skill.id] ?? 0) }
    })
}

/**
 * Affinity 0-100 = how ready the player is for the career: skill progress above, weighted like the career match
 * (required level × weight). With no learning yet it equals the match of the profile; tasks and digests raise it.
 */
export function affinityOf(save, careerId)
{
    const found = getCareer(careerId)
    if(!found)
        return 0
    const career = targetedCareer(save, found)
    const weights = new Map(career.skills.map((skill) => [ skill.id, skill.level * skill.weight ]))
    let total = 0
    let reached = 0
    for(const skill of skillProgress(save, career))
    {
        total += weights.get(skill.id)
        reached += weights.get(skill.id) * skill.progress
    }
    return total ? Math.round(reached / total) : 0
}

/**
 * Mentor swapped out for a career that isn't on the map: lowest affinity, then the one left alone the longest
 * (never targeted first, the current target last), then the first spot
 */
export function replaceCandidate(save)
{
    const lastActive = (careerId) => save.target?.careerId === careerId ? Infinity : Date.parse(save.careers?.[careerId]?.lastActiveAt ?? '') || 0
    return mapSlots(save)
        .map((careerId, index) => ({ careerId, index, affinity: affinityOf(save, careerId), lastActive: lastActive(careerId) }))
        .sort((a, b) => a.affinity - b.affinity || a.lastActive - b.lastActive || a.index - b.index)[0].careerId
}

function placeOnMap(save, careerId)
{
    if(isOnMap(save, careerId))
        return null
    const replaced = replaceCandidate(save)
    save.map = mapSlots(save).map((id) => id === replaced ? careerId : id)
    return replaced
}

/**
 * Target and pet: each career keeps its own pet, affinity and roadmap. Switching shelves the current ones
 * (save.careers) and brings back the ones of the new career, so a swapped out career resumes where it was.
 * Returns the career whose mentor left the map, or null.
 */
export function setTarget(save, { careerId, mode, posting })
{
    const career = getCareer(careerId)
    const changed = save.target?.careerId !== careerId
    const now = new Date().toISOString()
    const replaced = placeOnMap(save, careerId)

    if(changed)
    {
        save.careers ??= {}
        if(save.target)
            save.careers[save.target.careerId] = { target: save.target, pet: save.pet, roadmap: save.roadmap, lastActiveAt: now }
        const shelved = save.careers[careerId]
        delete save.careers[careerId]

        save.pet = shelved?.pet ?? { careerId, name: career.pet.name, species: career.pet.species, affinity: 0, createdAt: now }
        // A new posting changes the requirements: plan again. Otherwise the saved roadmap comes back
        save.roadmap = posting ? null : shelved?.roadmap ?? null
        const keptPosting = mode === 'customise' && shelved?.target?.mode === 'customise' ? shelved.target.posting : null
        save.target = { careerId, mode, posting: posting ?? keptPosting, setAt: now }
    }
    else
    {
        save.target = { careerId, mode, posting: posting ?? null, setAt: now }
        save.pet ??= { careerId, name: career.pet.name, species: career.pet.species, affinity: 0, createdAt: now }
        save.roadmap = null
    }
    save.pendingTarget = null
    adoptPostingSkills(save)
    return replaced
}

/**
 * Career the AI generated (search or job posting), with its new skills, kept in the save
 * spec: { name, summary, skills: [ { skillId | null, name, description, icon, difficulty, level, weight } ], demand, effortMonths, petName }
 */
const CUSTOM_COLORS = [ '#e76f51', '#2a9d8f', '#8338ec', '#f4a261', '#3a86ff', '#06a77d', '#c44569', '#6a4c93' ]
const PET_SPECIES = [ 'owl', 'fox', 'turtle', 'bunny', 'axolotl', 'penguin' ]

function slug(text)
{
    return String(text ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'career'
}

export function addCustomCareer(save, spec)
{
    save.customCareers ??= []
    save.customSkills ??= {}
    const index = save.customCareers.length
    const id = `custom-${slug(spec.name.en)}-${Date.now().toString(36).slice(- 4)}`
    const heat = { high: 80, medium: 60, low: 30 }

    const skills = []
    for(const skill of spec.skills.slice(0, 7))
    {
        let skillId = skill.skillId && SKILLS[skill.skillId] ? skill.skillId : null
        if(!skillId)
        {
            skillId = `custom-${slug(skill.name.en)}`
            if(!SKILLS[skillId] && !save.customSkills[skillId])
                save.customSkills[skillId] = {
                    name: skill.name,
                    detail: { icon: skill.icon, demand: spec.demand, heat: heat[spec.demand] ?? 60, difficulty: Math.max(1, Math.min(5, skill.difficulty)), description: skill.description },
                }
        }
        if(!skills.some((item) => item.id === skillId))
            skills.push({ id: skillId, level: Math.max(1, Math.min(3, skill.level)), weight: Math.max(1, Math.min(3, skill.weight)) })
    }

    const career = {
        id,
        custom: true,
        name: spec.name,
        summary: spec.summary,
        color: CUSTOM_COLORS[index % CUSTOM_COLORS.length],
        skills,
        market: { demand: spec.demand, heat: heat[spec.demand] ?? 60, trend: 'stable' },
        effortMonths: [ Math.max(1, Math.min(spec.effortMonths[0], spec.effortMonths[1])), Math.max(spec.effortMonths[0], spec.effortMonths[1]) ],
        pet: { name: spec.petName.slice(0, 20) || 'Nova', species: PET_SPECIES[index % PET_SPECIES.length] },
        // SDG targets the AI picked from sdg.js TARGETS (anything else dropped), none: sdg.careerSdgs uses the skills
        sdgs: (spec.sdgs ?? []).filter((tag) => TARGET_IDS.includes(tag.target)).slice(0, 3),
        createdAt: new Date().toISOString(),
    }
    save.customCareers.push(career)
    useCustom(save)
    return career
}

export function gapsFor(save)
{
    const career = getCareer(save.target.careerId)
    return matchCareer(career, save.profile.skills).skills
}

/**
 * Roadmap: ids, MP (1 MP = 1 estimated hour of focused effort) and clean prerequisites
 */
export function buildRoadmap(plan)
{
    const stages = plan.stages.slice(0, RULES.maxStages)
    return {
        generatedAt: new Date().toISOString(),
        overview: plan.overview,
        stages: stages.map((stage, index) => ({
            id: `s${index + 1}`,
            title: stage.title,
            why: stage.why,
            skillIds: stage.skillIds.filter((id) => SKILLS[id]),
            requirementRefs: stage.requirementRefs,
            prerequisites: stage.prerequisiteIndexes.filter((other) => other >= 0 && other < index).map((other) => `s${other + 1}`),
            tasks: stage.tasks.slice(0, RULES.maxTasksPerStage).map((task, taskIndex) => ({
                id: `s${index + 1}t${taskIndex + 1}`,
                title: task.title,
                why: task.why,
                skillId: SKILLS[task.skillId] ? task.skillId : null,
                mp: Math.max(1, Math.min(200, Math.round(task.effortHours))),
                progress: 0,
            })),
            cleared: false,
            clearedAt: null,
        })),
    }
}

function stageProgress(stage)
{
    const total = stage.tasks.reduce((sum, task) => sum + task.mp, 0)
    if(!total)
        return 0
    return Math.round(stage.tasks.reduce((sum, task) => sum + task.mp * task.progress, 0) / total)
}

function stageStatus(roadmap, stage)
{
    const complete = (item) => item.cleared || (item.tasks.length > 0 && item.tasks.every((task) => task.progress >= 100))
    if(complete(stage))
        return 'cleared'
    // Unlocked early by the player (confirmed in the roadmap), prerequisites are a recommendation, not a wall
    if(stage.forced)
        return 'active'
    const ready = stage.prerequisites.every((id) =>
    {
        const previous = roadmap.stages.find((other) => other.id === id)
        return previous && complete(previous)
    })
    return ready ? 'active' : 'locked'
}

/**
 * Start a locked stage anyway (the client asks for a confirmation first)
 */
export function forceStage(save, stageId)
{
    const stage = save.roadmap?.stages.find((item) => item.id === stageId)
    if(!stage)
        return false
    if(stageStatus(save.roadmap, stage) === 'locked')
    {
        stage.forced = true
        stage.forcedAt = new Date().toISOString()
    }
    return true
}

function findTask(roadmap, taskId)
{
    for(const stage of roadmap.stages)
        for(const task of stage.tasks)
            if(task.id === taskId)
                return task
    return null
}

/**
 * Logs: task progress, and points for the progress gained (only logs give points, ticking a task done doesn't)
 */
export function applyLog(save, { text, source, classification })
{
    // Only a log judged as real learning moves the roadmap (features.classifyLog verdict)
    const verdict = classification.verdict ?? 'learned'
    const items = verdict === 'learned' ? classification.items : []
    const advanced = []
    for(const item of items)
    {
        const task = item.taskId !== 'none' && save.roadmap ? findTask(save.roadmap, item.taskId) : null
        const hours = Math.max(0, Math.min(24, Number(item.hours) || 0))
        if(task && hours > 0)
        {
            const before = task.progress
            task.progress = Math.min(100, Math.round(task.progress + hours / task.mp * 100))
            // Ticked done by hand: the logged hours still count if it gets unticked
            if(task.progressBeforeDone !== undefined)
                task.progressBeforeDone = Math.min(99, Math.round(task.progressBeforeDone + hours / task.mp * 100))
            const difficulty = difficultyTier(task.skillId)
            advanced.push({ taskId: task.id, from: before, to: task.progress, difficulty, points: (task.progress - before) * RULES.difficultyWeights[difficulty] })
        }
    }

    const log = {
        id: `l${Date.now()}`,
        at: new Date().toISOString(),
        source,
        text: text.slice(0, 2000),
        summary: classification.summary,
        verdict,
        skillIds: [ ...new Set(items.map((item) => item.skillId).filter((id) => SKILLS[id])) ],
        advanced,
        points: advanced.reduce((sum, item) => sum + item.points, 0),
    }
    save.logs.unshift(log)
    save.logs = save.logs.slice(0, 500)
    save.points += log.points
    return log
}

export function setTaskDone(save, taskId, done)
{
    const task = save.roadmap && findTask(save.roadmap, taskId)
    if(!task)
        return false
    // Ticking keeps the progress it had, unticking (a misclick) puts it back
    if(done && task.progress < 100)
    {
        task.progressBeforeDone = task.progress
        task.progress = 100
    }
    else if(!done && task.progress >= 100)
    {
        task.progress = Math.min(task.progressBeforeDone ?? task.progress, 99)
        delete task.progressBeforeDone
    }
    return true
}

/**
 * What the client sees (hidden rubric removed, derived values computed)
 */
export function view(save, ai, documents = {})
{
    const market = documents.market ?? loadMarket()
    const careers = allCareers().map((career) => ({
        id: career.id,
        name: career.name,
        summary: career.summary,
        color: career.color,
        market: { ...career.market, snapshot: marketSnapshot(career.id, market), skills: skillTrendOrReference(career.id, career.skills.map((skill) => skill.id), market) },
        effortMonths: career.effortMonths,
        pet: career.pet,
        affinity: affinityOf(save, career.id),
        match: matchCareer(career, save.profile.skills),
        onMap: isOnMap(save, career.id),
        saved: Boolean(save.careers?.[career.id]),
        custom: Boolean(career.custom),
        expert: expertOf(career.id), // Industry elite the mentor can hand over to (experts.js), null if none
        sdgs: careerSdgs(career),
    }))

    const pending = save.pendingTarget && {
        requestedCareerId: save.pendingTarget.requestedCareerId,
        suggestedCareerId: save.pendingTarget.suggestedCareerId,
        newCareerName: save.pendingTarget.newCareer?.name ?? null,
        postingTitle: save.pendingTarget.posting.title,
        // Taking the suggestion puts it on the map in place of this mentor (null: it is on the map already)
        replaces: save.pendingTarget.suggestedCareerId && isOnMap(save, save.pendingTarget.suggestedCareerId) ? null : replaceCandidate(save),
    }

    let pet = null
    if(save.pet)
    {
        const affinity = affinityOf(save, save.pet.careerId)
        pet = {
            ...save.pet,
            affinity,
            level: petLevel(affinity),
            skills: skillProgress(save, getCareer(save.pet.careerId)),
        }
    }

    // Texts saved in the three languages (features.generateRoadmap), shown in the player's current one
    const roadmap = save.roadmap && {
        ...save.roadmap,
        overview: localText(save.roadmap.overview, save.lang),
        oneLanguage: typeof save.roadmap.overview === 'string', // Planned before roadmaps were trilingual: re-plan to translate
        stages: save.roadmap.stages.map(({ challenge: _legacyChallenge, ...stage }) => ({
            ...stage,
            title: localText(stage.title, save.lang),
            why: localText(stage.why, save.lang),
            tasks: stage.tasks.map((task) => ({ ...task, title: localText(task.title, save.lang), why: localText(task.why, save.lang) })),
            status: stageStatus(save.roadmap, stage),
            progress: stageProgress(stage),
            mp: stage.tasks.reduce((sum, task) => sum + task.mp, 0),
        })),
    }

    return {
        lang: save.lang,
        ai,
        rules: RULES,
        skillNames: SKILLS,
        skillDetails: SKILL_DETAILS,
        profile: save.profile,
        careers,
        map: { slots: mapSlots(save), replaceCandidate: replaceCandidate(save) },
        pending,
        marketSkills: skillTrendOrReference(null, SKILL_IDS, market),
        skillMarket: skillMarket(SKILL_IDS, market),
        trends: trendsView(documents.trends),
        target: save.target,
        pet,
        roadmap,
        logs: save.logs.slice(0, 30),
        points: save.points,
        player: { id: save.player.id, name: save.player.name, code: friendCode(save) },
        mastery: save.mastery ?? {},
        digests: (save.digests ?? []).slice(0, 7),
        leaderboard: leaderboard(save),
        sdg: sdgView(save),
    }
}

/**
 * SDG panel data: the goals and targets (sdg.js), each skill's targets and the player's contribution to the goals of the
 * target career (null without a target)
 */
function sdgView(save)
{
    const career = save.target && getCareer(save.target.careerId)
    return {
        source: SDG_SOURCE,
        goals: GOALS,
        targets: TARGETS,
        skills: SKILL_TARGETS,
        platform: PLATFORM_TARGETS,
        contribution: career ? { careerId: career.id, goals: contribution(career, skillProgress(save, career), affinityOf(save, career.id)) } : null,
    }
}
