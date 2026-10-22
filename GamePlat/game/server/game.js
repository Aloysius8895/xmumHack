/**
 * Game rules: everything that changes progress, affinity or points is decided here, never by the AI
 *
 * Loop (skills/game/game-design-theory, MDA): know your skills > pick a target > get the career pet > follow the roadmap
 * > log what you did and track preparation. Daily-report mastery growth is a separate, future feature.
 */
import { CAREERS, SKILLS, getCareer, matchCareer } from './careers.js'
import { SKILL_DETAILS } from './skill-details.js'
import { friendCode, leaderboard } from './friends.js'
import { monthlyTrend } from './market-trends.js'
import { loadMarket } from './store.js'

export const RULES = {
    affinityPerLevel: 20,      // retain existing pet levels; new affinity growth is deferred
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
 * Target and pet
 */
export function setTarget(save, { careerId, mode, posting })
{
    const career = getCareer(careerId)
    const changed = save.target?.careerId !== careerId

    save.target = { careerId, mode, posting: posting ?? null, setAt: new Date().toISOString() }

    // A new career means a new companion and a new plan, the previous ones are kept in history
    if(changed || !save.pet)
    {
        save.pet = { careerId, name: career.pet.name, species: career.pet.species, affinity: 0, createdAt: new Date().toISOString() }
    }
    save.roadmap = null
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
    const advanced = []
    for(const item of classification.items)
    {
        const task = item.taskId !== 'none' && save.roadmap ? findTask(save.roadmap, item.taskId) : null
        const hours = Math.max(0, Math.min(24, Number(item.hours) || 0))
        if(task && hours > 0)
        {
            const before = task.progress
            task.progress = Math.min(100, Math.round(task.progress + hours / task.mp * 100))
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
        skillIds: [ ...new Set(classification.items.map((item) => item.skillId).filter((id) => SKILLS[id])) ],
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
    task.progress = done ? 100 : Math.min(task.progress, 99)
    return true
}

/**
 * What the client sees (hidden rubric removed, derived values computed)
 */
export function view(save, ai)
{
    const market = loadMarket()
    const careers = CAREERS.map((career) => ({
        id: career.id,
        name: career.name,
        summary: career.summary,
        color: career.color,
        market: { ...career.market, monthly: monthlyTrend(career.id, market) },
        effortMonths: career.effortMonths,
        pet: career.pet,
        affinity: save.pet?.careerId === career.id ? save.pet.affinity : 0,
        match: matchCareer(career, save.profile.skills),
    }))

    let pet = null
    if(save.pet)
    {
        const career = getCareer(save.pet.careerId)
        const match = matchCareer(career, save.profile.skills)
        const roadmapTasks = save.roadmap ? save.roadmap.stages.flatMap((stage) => stage.tasks) : []
        pet = {
            ...save.pet,
            level: petLevel(save.pet.affinity),
            skills: match.skills.map((skill) =>
            {
                const tasks = roadmapTasks.filter((task) => task.skillId === skill.id)
                const roadmapProgress = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length) : 0
                const baseline = Math.round(Math.min(skill.current, skill.required) / skill.required * 100)
                return {
                    ...skill,
                    // Daily digests of the chat agent (server/integrations.js) can raise it too
                    progress: Math.max(baseline, roadmapProgress, save.mastery?.[skill.id] ?? 0),
                }
            }),
        }
    }

    const roadmap = save.roadmap && {
        ...save.roadmap,
        stages: save.roadmap.stages.map(({ challenge: _legacyChallenge, ...stage }) => ({
            ...stage,
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
        target: save.target,
        pet,
        roadmap,
        logs: save.logs.slice(0, 30),
        points: save.points,
        player: { id: save.player.id, name: save.player.name, code: friendCode(save) },
        mastery: save.mastery ?? {},
        digests: (save.digests ?? []).slice(0, 7),
        leaderboard: leaderboard(save),
    }
}
