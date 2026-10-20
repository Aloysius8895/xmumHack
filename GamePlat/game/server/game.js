/**
 * Game rules: everything that changes progress, affinity or points is decided here, never by the AI
 *
 * Loop (skills/game/game-design-theory, MDA): know your skills > pick a target > get the career pet > follow the roadmap
 * > log what you did (progress only) > pass the stage gym (understanding check) > affinity and points go up
 */
import { CAREERS, SKILLS, getCareer, matchCareer } from './careers.js'

export const RULES = {
    gymUnlockProgress: 80,     // % of the stage tasks before its gym opens
    passAverage: 70,           // average score to pass a gym
    passMinimum: 40,           // and no question below this
    affinityPerGym: 20,        // first clear of a stage only, logs never give affinity
    affinityMax: 100,
    pointsPerGym: 100,
    pointsPerLog: 5,
    pointLogsPerDay: 3,        // logs past this still count for progress but give no points
    maxStages: 6,
    maxTasksPerStage: 4,
}

// Pet level 1-6 from affinity
export function petLevel(affinity)
{
    return 1 + Math.floor(Math.min(affinity, RULES.affinityMax) / RULES.affinityPerGym)
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
    save.challenges = save.challenges.filter((challenge) => challenge.result)
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
            challenge: stage.challenge,
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
    if(stage.cleared)
        return 'cleared'
    const ready = stage.prerequisites.every((id) => roadmap.stages.find((other) => other.id === id)?.cleared)
    return ready ? 'active' : 'locked'
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
 * Logs: progress only
 */
export function applyLog(save, { text, source, classification })
{
    const today = new Date().toISOString().slice(0, 10)
    const logsToday = save.logs.filter((log) => log.at.slice(0, 10) === today && log.points > 0).length
    const points = logsToday < RULES.pointLogsPerDay ? RULES.pointsPerLog : 0

    const advanced = []
    for(const item of classification.items)
    {
        const task = item.taskId !== 'none' && save.roadmap ? findTask(save.roadmap, item.taskId) : null
        const hours = Math.max(0, Math.min(24, Number(item.hours) || 0))
        if(task && hours > 0)
        {
            const before = task.progress
            task.progress = Math.min(100, Math.round(task.progress + hours / task.mp * 100))
            advanced.push({ taskId: task.id, from: before, to: task.progress })
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
        points,
    }
    save.logs.unshift(log)
    save.logs = save.logs.slice(0, 500)
    save.points += points
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
 * Gym
 */
export function canChallenge(save, stageId)
{
    const stage = save.roadmap?.stages.find((item) => item.id === stageId)
    if(!stage)
        return { ok: false, reason: 'no-stage' }
    const status = stageStatus(save.roadmap, stage)
    if(status === 'locked')
        return { ok: false, reason: 'locked' }
    if(stageProgress(stage) < RULES.gymUnlockProgress)
        return { ok: false, reason: 'not-ready' }
    return { ok: true, stage }
}

export function startChallenge(save, stage, questions)
{
    const challenge = {
        id: `c${Date.now()}`,
        stageId: stage.id,
        careerId: save.target.careerId,
        startedAt: new Date().toISOString(),
        questions: questions.slice(0, 5),
        result: null,
    }
    save.challenges.unshift(challenge)
    save.challenges = save.challenges.slice(0, 100)
    return challenge
}

export function finishChallenge(save, challenge, grading, answers)
{
    const scores = challenge.questions.map((_, index) => Math.max(0, Math.min(100, Math.round(grading.results[index]?.score ?? 0))))
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length))
    const passed = average >= RULES.passAverage && scores.every((score) => score >= RULES.passMinimum)

    const stage = save.roadmap.stages.find((item) => item.id === challenge.stageId)
    const firstClear = passed && stage && !stage.cleared
    let affinity = 0
    let points = 0

    if(firstClear)
    {
        stage.cleared = true
        stage.clearedAt = new Date().toISOString()

        affinity = Math.min(RULES.affinityPerGym, RULES.affinityMax - save.pet.affinity)
        save.pet.affinity += affinity
        points = RULES.pointsPerGym
        save.points += points

        // The gym confirms understanding of the stage skills: raise them one level toward what the career needs
        const career = getCareer(save.target.careerId)
        for(const skillId of stage.skillIds)
        {
            const required = career.skills.find((skill) => skill.id === skillId)?.level ?? 1
            const existing = save.profile.skills.find((skill) => skill.id === skillId)
            if(existing)
            {
                if(existing.level < required)
                {
                    existing.level += 1
                    existing.source = 'gym'
                }
            }
            else
            {
                save.profile.skills.push({ id: skillId, name: SKILLS[skillId].en, level: 1, evidence: stage.challenge.topic, source: 'gym' })
            }
        }
    }

    challenge.answers = answers
    challenge.result = {
        at: new Date().toISOString(),
        scores,
        average,
        passed,
        firstClear,
        affinity,
        points,
        feedback: challenge.questions.map((_, index) => ({ feedback: grading.results[index]?.feedback ?? '', missing: grading.results[index]?.missing ?? [] })),
        reviewTopics: grading.reviewTopics,
        summary: grading.summary,
    }
    return challenge.result
}

/**
 * What the client sees (hidden rubric removed, derived values computed)
 */
export function view(save, ai)
{
    const careers = CAREERS.map((career) => ({
        id: career.id,
        name: career.name,
        summary: career.summary,
        color: career.color,
        market: career.market,
        effortMonths: career.effortMonths,
        pet: career.pet,
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
                    progress: Math.max(baseline, roadmapProgress),
                    verified: Boolean(save.roadmap?.stages.some((stage) => stage.cleared && stage.skillIds.includes(skill.id))),
                }
            }),
        }
    }

    const roadmap = save.roadmap && {
        ...save.roadmap,
        stages: save.roadmap.stages.map((stage) => ({
            ...stage,
            status: stageStatus(save.roadmap, stage),
            progress: stageProgress(stage),
            mp: stage.tasks.reduce((sum, task) => sum + task.mp, 0),
            gymReady: stageStatus(save.roadmap, stage) === 'active' && stageProgress(stage) >= RULES.gymUnlockProgress,
        })),
    }

    const active = save.challenges.find((challenge) => !challenge.result)

    return {
        lang: save.lang,
        ai,
        rules: RULES,
        skillNames: SKILLS,
        profile: save.profile,
        careers,
        target: save.target,
        pet,
        roadmap,
        logs: save.logs.slice(0, 30),
        points: save.points,
        activeChallenge: active ? { id: active.id, stageId: active.stageId, questions: active.questions.map(({ kind, question }) => ({ kind, question })) } : null,
        challenges: save.challenges.filter((challenge) => challenge.result).slice(0, 20).map(({ id, stageId, startedAt, result }) => ({ id, stageId, startedAt, result })),
    }
}
