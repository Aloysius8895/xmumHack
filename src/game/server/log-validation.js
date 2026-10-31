import { randomUUID } from 'node:crypto'
import { ask, isMock } from './ai.js'
import { localText } from './careers.js'
import { classifyLog } from './features.js'
import { applyLog } from './game.js'

export class LogValidationError extends Error
{
    constructor(code, status = 409) { super(code); this.code = code; this.status = status }
}

export function publicLogValidation(save)
{
    const pending = save.logValidation
    if(!pending || pending.roadmap !== save.roadmap?.generatedAt || !pending.questions?.[pending.step]) return null
    const { question, options } = pending.questions[pending.step]
    return { id: pending.id, step: pending.step, total: 2, question, options }
}

export async function submitLog(save, { content, source, lang })
{
    if(publicLogValidation(save))
    {
        if(save.logValidation.text === content && save.logValidation.source === source)
            return { quiz: publicLogValidation(save) }
        throw new LogValidationError('log-validation-pending')
    }
    const classification = await classifyLog({ text: content, roadmap: save.roadmap, lang })
    const task = classification.verdict === 'learned' && classification.items?.length
        ? save.roadmap.stages.flatMap(stage => stage.tasks).find(item => item.id === classification.items.find(row => row.taskId !== 'none')?.taskId)
        : null
    if(!task)
    {
        const log = applyLog(save, { text: content, source, classification })
        return { log, reply: classification.reply }
    }

    const title = localText(task.title, lang)
    const demo = {
        zh: [
            { question: `学习「${title}」时，怎样能确认自己理解了？`, options: [ '只看标题', '举一个简单例子', '直接打勾' ], answerIndex: 1 },
            { question: `练习「${title}」时做错了，下一步应该？`, options: [ '忽略错误', '直接打勾', '找出原因并再试' ], answerIndex: 2 },
        ],
        en: [
            { question: `How can you check you understand ${title}?`, options: [ 'Read the title only', 'Give a simple example', 'Just tick Done' ], answerIndex: 1 },
            { question: `What should you do if your ${title} practice is wrong?`, options: [ 'Ignore it', 'Tick Done', 'Find the mistake and try again' ], answerIndex: 2 },
        ],
        ms: [
            { question: `Bagaimana anda semak kefahaman tentang ${title}?`, options: [ 'Baca tajuk sahaja', 'Beri contoh mudah', 'Tandakan selesai' ], answerIndex: 1 },
            { question: `Jika latihan ${title} salah, apa langkah seterusnya?`, options: [ 'Abaikan', 'Tandakan selesai', 'Cari kesilapan dan cuba lagi' ], answerIndex: 2 },
        ],
    }
    const questions = isMock() ? demo[lang] ?? demo.en : (await ask({
        system: 'Generate exactly TWO very easy beginner multiple-choice questions about the specific topic in the learning log and roadmap task. Question 1 checks one basic term or idea mentioned in the log. Question 2 checks one simple everyday use of that idea. A beginner who really studied the stated topic should answer both without specialist knowledge, calculations, trick wording, or outside facts. Keep each question under 120 characters and each option under 50 characters. Give exactly three short options per question, one clearly correct. Incorrect options should be simple but relevant. Do not ask about clicking Done, proving study, or general learning habits. Do not reveal the answer in the public question/options. Write in the requested language.',
        content: JSON.stringify({ lang, log: content, task: { title, why: localText(task.why, lang), skillId: task.skillId } }),
        schema: { type: 'object', properties: { questions: { type: 'array', items: { type: 'object', properties: {
            question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answerIndex: { type: 'integer' },
        }, required: [ 'question', 'options', 'answerIndex' ], additionalProperties: false } } }, required: [ 'questions' ], additionalProperties: false },
        effort: 'low', maxTokens: 1500,
    })).questions
    if(!Array.isArray(questions) || questions.length !== 2 || questions.some(row => !row?.question?.trim() || row.options?.length !== 3 ||
        row.options.some(option => !option?.trim()) || !Number.isInteger(row.answerIndex) || row.answerIndex < 0 || row.answerIndex >= row.options.length))
        throw new LogValidationError('bad-log-quiz', 502)

    save.logValidation = { id: randomUUID(), roadmap: save.roadmap.generatedAt, step: 0, questions,
        text: content, source, classification }
    return { quiz: publicLogValidation(save), reply: classification.reply }
}

export function answerLog(save, { quizId, step, optionIndex })
{
    const pending = save.logValidation
    if(!pending || !publicLogValidation(save) || quizId !== pending.id || step !== pending.step)
        throw new LogValidationError('log-quiz-stale')
    const question = pending.questions[step]
    if(!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length)
        throw new LogValidationError('bad-log-answer', 400)
    if(optionIndex !== question.answerIndex)
    {
        delete save.logValidation
        return { passed: false }
    }
    pending.step++
    if(pending.step < 2) return { next: true, quiz: publicLogValidation(save) }
    delete save.logValidation
    const log = applyLog(save, { text: pending.text, source: pending.source, classification: pending.classification })
    return { passed: true, log }
}
