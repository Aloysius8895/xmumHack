import { createHash, randomUUID } from 'node:crypto'
import { ask, isMock } from './ai.js'
import { SKILLS, localText } from './careers.js'
import { generateRoadmap } from './features.js'
import { LEARNING_DEFAULTS, MODES, localized, localizedSchema as L, learningContext, learningPrompt, aeiEvidence, effectiveMode } from './learning-rules.js'

export class LearningError extends Error
{
    constructor(code, status = 409) { super(code); this.code = code; this.status = status }
}
const object = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const string = { type: 'string' }
const enumeration = (...values) => ({ type: 'string', enum: values })
const allTasks = (save) => (save.roadmap?.stages ?? []).flatMap(stage => stage.tasks.map(task => ({ ...task, stageId: stage.id })))
const walkedTasks = (save, mode = save.roadmap?.chosenBranch) => (save.roadmap?.stages ?? []).filter(stage => stage.kind !== 'branch' || stage.branch === mode).flatMap(stage => stage.tasks.map(task => ({ ...task, stageId: stage.id })))
const requireRoadmap = (save) => { if(!save.target || !save.roadmap) throw new LearningError('no-roadmap') }
const state = (save) => save.learning ??= { mode: null, analysis: null, checkpoint: null, reviews: [], pending: null }
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const revisionOf = (save) => hash({ target: save.target, profile: save.profile, roadmap: save.roadmap, mode: effectiveMode(save), evidence: aeiEvidence(save).revision })
const dueFrom = (at) => Number.isFinite(Date.parse(at)) ? new Date(Date.parse(at) + LEARNING_DEFAULTS.checkpointDays * 86400000).toISOString() : null
const currentReviews = (save) => (save.learning?.reviews ?? []).filter(review => review.roadmapId === save.roadmap?.generatedAt && review.careerId === save.target?.careerId)

export async function analyzeEvidence(save)
{
    const context = learningContext(save)
    const fallback = localized('现有 AEI 为单期任务使用快照，无法判断发展速度。默认温和是学习规划假设，可自行选择极端情境。',
        'The AEI task-use snapshot cannot establish development speed. Moderate is a conservative planning assumption; you can choose Extreme.',
        'Snapshot penggunaan tugas AEI tidak menentukan kadar perkembangan. Sederhana ialah andaian perancangan konservatif; anda boleh memilih Ekstrem.')
    const result = isMock() ? { summary: fallback } : await ask({ system: learningPrompt(context),
        content: 'Analyze the supplied AEI mappings for this target. Explain useful learning implications and thin/zero mappings in zh/en/ms. Explicitly state that speed is unknown and moderate is a conservative default. Do not classify speed or change the target.',
        schema: object({ summary: L }), effort: 'low' })
    const analysis = { ...result, trendClassification: 'insufficient_evidence', recommendedScenario: 'moderate',
        evidenceRevision: context.evidence.revision, careerId: save.target?.careerId ?? null, at: new Date().toISOString() }
    state(save).analysis = analysis
    return analysis
}

export function setLearningMode(save, mode)
{
    if(mode !== null && !MODES.includes(mode)) throw new LearningError('bad-learning-mode', 400)
    const learning = state(save)
    learning.mode = mode
    learning.pending = null
    learning.checkpoint = null
    // Reuse the existing numerical presets; public learning labels are moderate/extreme.
    save.scenario = { preset: effectiveMode(save) }
}

export async function createCheckpoint(save, { refresh = false, checkpointId = null } = {})
{
    requireRoadmap(save)
    const learning = state(save), revision = revisionOf(save)
    const previous = learning.checkpoint
    if(refresh && (!previous || previous.id !== checkpointId || previous.revision !== revision)) throw new LearningError('checkpoint-stale')
    if(!refresh && previous?.revision === revision && previous.schemaVersion === 2) return
    const studied = walkedTasks(save).filter(task => task.progress > 0)
    const task = studied.find(task => task.progress < 100) ?? studied[0] ?? null
    const feedbackOnly = !task
    const name = SKILLS[task?.skillId] ?? localized('学习任务', 'learning task', 'tugas pembelajaran')
    const result = isMock() ? {
        progressQuestion: localized('本周完成了什么？大约花了多少时间？', 'What did you work on, and roughly how much time did it take?', 'Apakah yang anda usahakan dan berapa masa diambil?'),
        difficultyQuestion: localized('有哪些困难？也可以说明本周没有时间学习。', 'What was difficult? You can also say you had no time to study.', 'Apakah kesukarannya? Anda juga boleh nyatakan tiada masa belajar.'),
        question: feedbackOnly ? localized('本周尚未记录学习内容，这次只了解时间安排和困难，不判断理解程度。',
            'No studied material is recorded yet; this check-in only covers scheduling and difficulties, not understanding.',
            'Belum ada rekod pembelajaran; semakan ini hanya meliputi masa dan kesukaran, bukan pemahaman.')
            : localized(`（演示）解释你在「${localText(task.title, 'zh')}」中使用的一个概念，并说明怎样发现一个错误。`,
            `(Demo) Explain a concept used in “${localText(task.title, 'en')}” and how you would detect an error.`,
            `(Demo) Terangkan konsep dalam “${localText(task.title, 'ms')}” dan cara mengesan kesilapan.`),
        privateRubric: `Look for a correct explanation and a concrete verification example about ${name.en}. Self-report alone is insufficient.`,
    } : await ask({ system: learningPrompt(learningContext(save)),
        content: JSON.stringify({ action: 'create_checkpoint', task, feedbackOnly, recentLogs: save.logs.slice(0, 5),
            previousReview: currentReviews(save)[0]?.feedback ?? null,
            refresh, previousQuestions: refresh ? { progressQuestion: previous.progressQuestion, difficultyQuestion: previous.difficultyQuestion, question: previous.question } : null,
            instruction: 'Generate all check-in prompts in zh/en/ms: progressQuestion about actual work and time, difficultyQuestion about blockers, and question as ONE focused explanation/error-check/transfer task grounded ONLY in the supplied studied task. Tailor the prompts to the task and previous feedback rather than repeat a generic questionnaire. If refresh is true, choose a genuinely different example or question angle from previousQuestions at the same skill and difficulty; do not simply repeat it or raise difficulty to force novelty. Supply all information needed to answer. Do not include the solution in any public field; put evaluation criteria only in privateRubric. If feedbackOnly is true, do not ask any academic/understanding question: use question solely to explain that understanding cannot be assessed yet, and ask only scheduling/difficulty questions. Never assume an unrecorded task was studied. Keep the whole check-in within 5-10 minutes.' }),
        schema: object({ progressQuestion: L, difficultyQuestion: L, question: L, privateRubric: string }), effort: 'low', maxTokens: 2000 })
    if(refresh && isMock())
    {
        result.progressQuestion = localized('（演示）这次学习有哪些实际产出？投入了几次学习时段？', '(Demo) What did this study produce, and how many study sessions did you use?', '(Demo) Apakah hasil pembelajaran ini dan berapa sesi digunakan?')
        result.difficultyQuestion = localized('（演示）下次学习最需要解决哪个障碍？', '(Demo) Which obstacle should your next study session address?', '(Demo) Halangan manakah perlu ditangani pada sesi seterusnya?')
        if(!feedbackOnly) result.question = localized(`（演示）为「${localText(task.title, 'zh')}」举一个不同的应用例子，并解释怎样验证结果。`,
            `(Demo) Give a different application of “${localText(task.title, 'en')}” and explain how to verify the result.`,
            `(Demo) Berikan aplikasi berbeza bagi “${localText(task.title, 'ms')}” dan terangkan cara mengesahkan hasil.`)
    }
    if(refresh && !isMock())
    {
        const normalize = value => localText(value, save.lang ?? 'zh').replace(/\s+/gu, ' ').trim().toLowerCase()
        const repeated = feedbackOnly
            ? normalize(result.progressQuestion) === normalize(previous.progressQuestion) && normalize(result.difficultyQuestion) === normalize(previous.difficultyQuestion)
            : normalize(result.question) === normalize(previous.question)
        if(repeated) throw new LearningError('checkpoint-refresh-unchanged', 422)
    }
    learning.checkpoint = { id: randomUUID(), revision, schemaVersion: 2, taskId: task?.id ?? null, skillId: task?.skillId ?? null,
        ...result, feedbackOnly, ...(feedbackOnly ? { privateRubric: 'No studied material; always insufficient_evidence, never infer low ability.' } : {}), at: new Date().toISOString() }
}

export async function reviewCheckpoint(save, body)
{
    requireRoadmap(save)
    const learning = state(save), checkpoint = learning.checkpoint
    if(!checkpoint || checkpoint.id !== body.checkpointId || checkpoint.revision !== revisionOf(save)) throw new LearningError('checkpoint-stale')
    for(const key of [ 'progress', 'difficulty', 'answer' ])
        if(typeof body[key] !== 'string' || body[key].length > 2000) throw new LearningError('bad-checkpoint-response', 400)
    if(!body.progress.trim() && !body.difficulty.trim() && !body.answer.trim()) throw new LearningError('bad-checkpoint-response', 400)
    const noAnswer = !body.answer.trim()
    const fallback = { understanding: 'insufficient_evidence', nextAction: noAnswer ? 'adjust_pace' : 'continue',
        feedback: localized('这次回答还不足以判断理解程度。保留进度，继续收集具体解释和作品依据。',
            'There is not enough evidence to assess understanding. Keep progress and collect a concrete explanation or artifact.',
            'Bukti belum mencukupi untuk menilai pemahaman. Kekalkan kemajuan dan kumpulkan penjelasan atau hasil kerja.') }
    const result = isMock() || noAnswer || checkpoint.feedbackOnly ? { ...fallback, nextAction: noAnswer || checkpoint.feedbackOnly ? 'adjust_pace' : 'continue' } : await ask({ system: learningPrompt(learningContext(save)),
        content: JSON.stringify({ action: 'review_checkpoint', checkpoint, response: { progress: body.progress, difficulty: body.difficulty, answer: body.answer },
            instruction: 'Assess this specific answer against the private rubric. Explain concrete strengths/gaps and the next focus. No study, copied answers without explanation, or vague replies mean insufficient_evidence. Never change mastery or points.' }),
        schema: object({ understanding: enumeration('ready', 'needs_practice', 'insufficient_evidence'),
            nextAction: enumeration('continue', 'reinforce', 'advance', 'adjust_pace'), feedback: L }), effort: 'low' })
    const review = { id: randomUUID(), checkpointId: checkpoint.id, roadmapId: save.roadmap.generatedAt, careerId: save.target.careerId,
        at: new Date().toISOString(), ...result, response: { progress: body.progress, difficulty: body.difficulty, answer: body.answer } }
    learning.reviews = [ review, ...(learning.reviews ?? []) ].slice(0, 20)
    learning.checkpoint = null
    learning.pending = null
    return review
}

export async function proposeUpdate(save)
{
    requireRoadmap(save)
    const tasks = walkedTasks(save, effectiveMode(save)), editable = tasks.filter(task => task.progress === 0 && task.progressBeforeDone === undefined && !save.roadmap.stages.find(stage => stage.id === task.stageId)?.cleared)
    const review = currentReviews(save)[0] ?? null
    const context = learningContext(save)
    let result
    if(isMock())
    {
        const task = editable[0]
        result = { summary: localized('（演示）保留已完成和进行中的任务，调整一项尚未开始的练习。',
            '(Demo) Preserve completed and in-progress tasks and adapt one unstarted exercise.',
            '(Demo) Kekalkan tugas selesai dan sedang berjalan; sesuaikan satu latihan yang belum bermula.'), updates: [], additions: [] }
        if(task) result.updates.push({ taskId: task.id,
            title: localized(`解释并检查 ${SKILLS[task.skillId]?.zh ?? '任务'} 的${context.effectiveScenario === 'extreme' ? ' AI 辅助' : ''}结果`,
                `Explain and check ${context.effectiveScenario === 'extreme' ? 'AI-assisted ' : ''}${SKILLS[task.skillId]?.en ?? 'task'} results`,
                `Terangkan dan semak hasil ${SKILLS[task.skillId]?.ms ?? 'tugas'}${context.effectiveScenario === 'extreme' ? ' berbantu AI' : ''}`),
            why: result.summary, effortHours: 2,
            deliverable: localized('一个结果及检查记录', 'A result and verification notes', 'Hasil dan nota pengesahan'),
            completionCriteria: localized('解释一个概念，发现并修正一个错误。', 'Explain a concept and find and correct an error.', 'Terangkan konsep serta cari dan betulkan kesilapan.') })
    }
    else result = await generateRoadmap({ target: save.target, profile: save.profile, gaps: [], lang: save.lang,
        learning: context, adjustment: { roadmap: save.roadmap, editableTasks: editable, latestReview: review } })
    return buildPreview(save, result, context)
}

function validateFields(change)
{
    if(!Number.isInteger(change.effortHours) || change.effortHours < 1 || change.effortHours > 200) throw new LearningError('bad-learning-plan', 422)
    for(const key of [ 'title', 'why', 'deliverable', 'completionCriteria' ])
        if(!change[key] || [ 'zh', 'en', 'ms' ].some(lang => typeof change[key][lang] !== 'string' || !change[key][lang].trim() || change[key][lang].length > 3000))
            throw new LearningError('bad-learning-plan', 422)
}

export function buildPreview(save, result, context = learningContext(save))
{
    requireRoadmap(save)
    if(!Array.isArray(result.updates) || !Array.isArray(result.additions) || result.updates.length + result.additions.length > 4) throw new LearningError('bad-learning-plan', 422)
    const roadmap = structuredClone(save.roadmap), changes = [], used = new Set()
    const editable = new Set(walkedTasks(save, context.effectiveScenario).map(task => task.id))
    for(const change of result.updates)
    {
        validateFields(change)
        const task = roadmap.stages.flatMap(stage => stage.tasks).find(item => item.id === change.taskId)
        const stage = roadmap.stages.find(item => item.tasks.some(candidate => candidate.id === change.taskId))
        if(!task || stage?.cleared || !editable.has(task.id) || used.has(task.id) || task.progress !== 0 || task.progressBeforeDone !== undefined) throw new LearningError('protected-learning-task', 422)
        used.add(task.id)
        const { title, why, deliverable, completionCriteria } = change
        changes.push({ operation: 'revise', taskId: task.id, before: task.title, title, why, effortHours: change.effortHours, previousHours: task.mp })
        Object.assign(task, { title, why, deliverable, completionCriteria, mp: change.effortHours })
    }
    for(const change of result.additions)
    {
        validateFields(change)
        const stage = roadmap.stages.find(item => item.id === change.stageId)
        if(!stage || stage.cleared || stage.tasks.every(task => task.progress >= 100) || (stage.kind === 'branch' && stage.branch !== context.effectiveScenario) || stage.tasks.length >= 8 || !stage.skillIds.includes(change.skillId) || !SKILLS[change.skillId]) throw new LearningError('bad-learning-plan', 422)
        const id = `a${randomUUID()}`
        stage.tasks.push({ id, title: change.title, why: change.why, deliverable: change.deliverable,
            completionCriteria: change.completionCriteria, skillId: change.skillId, mp: change.effortHours, progress: 0 })
        changes.push({ operation: 'add', taskId: id, title: change.title, why: change.why, effortHours: change.effortHours, previousHours: 0 })
    }
    roadmap.learningScenario = context.effectiveScenario
    if(roadmap.chosenBranch)
    {
        roadmap.chosenBranch = context.effectiveScenario
        roadmap.branchChosenBy = 'player'
    }
    const pending = { id: randomUUID(), revision: revisionOf(save), summary: result.summary, changes, roadmap,
        mode: context.effectiveScenario, at: new Date().toISOString(), requiresConfirmation: true,
        previousMode: save.roadmap.learningScenario ?? save.roadmap.chosenBranch ?? null,
        branchChanged: Boolean(save.roadmap.chosenBranch && save.roadmap.chosenBranch !== context.effectiveScenario),
        preservedTasks: allTasks(save).filter(task => !used.has(task.id)).length,
        hoursDelta: changes.reduce((sum, row) => sum + row.effortHours - row.previousHours, 0) }
    state(save).pending = pending
    return pending
}

export function applyPreview(save, id)
{
    const learning = state(save), pending = learning.pending
    if(!pending || pending.id !== id || pending.revision !== revisionOf(save)) throw new LearningError('learning-preview-stale')
    learning.history = [ { roadmap: structuredClone(save.roadmap), careerId: save.target.careerId, at: new Date().toISOString() }, ...(learning.history ?? []) ].slice(0, 3)
    save.roadmap = pending.roadmap
    learning.pending = null
    learning.checkpoint = null
    // No progress/point/mastery changes and no target switching.
}

export function learningView(save, now = Date.now())
{
    const learning = save.learning ?? {}, lang = save.lang ?? 'zh', context = learningContext(save)
    const review = currentReviews(save)[0]
    const dueAt = save.roadmap ? dueFrom(review?.at ?? save.roadmap.generatedAt) : null
    const checkpoint = learning.checkpoint?.revision === revisionOf(save) ? learning.checkpoint : null
    const pending = learning.pending?.revision === revisionOf(save) ? learning.pending : null
    const analysis = learning.analysis?.evidenceRevision === context.evidence.revision && learning.analysis?.careerId === save.target?.careerId ? learning.analysis : null
    return { mode: context.effectiveScenario, userOverride: learning.mode ?? null, recommendedScenario: 'moderate', trendClassification: 'insufficient_evidence',
        weeklyHours: context.weeklyHours, checkpointDays: context.checkpointDays, appliedMode: save.roadmap?.learningScenario ?? save.roadmap?.chosenBranch ?? null,
        evidence: context.evidence, analysis: analysis ? localText(analysis.summary, lang) : null,
        checkpointDueAt: dueAt, checkpointDue: Boolean(dueAt && now >= Date.parse(dueAt)),
        canReview: Boolean(save.roadmap), hasStudyEvidence: walkedTasks(save).some(task => task.progress > 0),
        checkpoint: checkpoint ? { id: checkpoint.id, question: localText(checkpoint.question, lang),
            progressQuestion: checkpoint.progressQuestion ? localText(checkpoint.progressQuestion, lang) : null,
            difficultyQuestion: checkpoint.difficultyQuestion ? localText(checkpoint.difficultyQuestion, lang) : null,
            taskId: checkpoint.taskId, feedbackOnly: Boolean(checkpoint.feedbackOnly) } : null,
        latestReview: review ? { id: review.id, at: review.at, understanding: review.understanding, nextAction: review.nextAction, feedback: localText(review.feedback, lang) } : null,
        pending: pending ? { id: pending.id, summary: localText(pending.summary, lang), preservedTasks: pending.preservedTasks, hoursDelta: pending.hoursDelta,
            requiresConfirmation: true, mode: pending.mode, previousMode: pending.previousMode, branchChanged: pending.branchChanged,
            changes: pending.changes.map(row => ({ ...row, before: row.before ? localText(row.before, lang) : null, title: localText(row.title, lang), why: localText(row.why, lang) })) } : null }
}
