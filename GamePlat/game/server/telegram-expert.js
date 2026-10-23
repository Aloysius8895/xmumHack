/** Telegram's target-based expert entry point. The web save is the target's source of truth. */
import { getCareer } from './careers.js'
import { expertOf } from './experts.js'
import { askMentor } from './features.js'
import { chatReceipt, rememberChat, IntegrationError } from './integrations.js'

const choose = (values, lang) => values[lang] ?? values.en

export function expertReceipt(save, body)
{
    return chatReceipt({ integrationReceipts: save.telegramExpertReceipts }, { ...body, messageId: `expert:${body.messageId}` }, JSON.stringify({ action: body.action, text: body.action === 'ask' ? body.text.trim() : '' }))
}

function remember(save, receipt, result)
{
    const cache = { integrationReceipts: save.telegramExpertReceipts }
    rememberChat(cache, receipt, result)
    save.telegramExpertReceipts = Object.fromEntries(Object.entries(cache.integrationReceipts).slice(-64))
    return result
}

function introduction(expert, career, lang)
{
    const role = career.name[lang] ?? career.name.en
    const tagline = expert.tagline[lang] ?? expert.tagline.en
    return choose({
        zh: `你好！我是基于 ${expert.name} 公开资料蒸馏的 AI 专家视角。${tagline}。你在网页中选择的目标是「${role}」，我会用这套思维框架和你讨论准备方向。\n\n这不是本人，也不代表本人观点。直接发送问题即可；发送 /exit 返回普通聊天。`,
        en: `Hello! I am an AI perspective distilled from ${expert.name}'s public records: ${tagline}. Your web-game target is ${role}; I will use these thinking frameworks to discuss your preparation.\n\nI am not the real person and do not speak for them. Send a question, or /exit to return to ordinary chat.`,
        ms: `Helo! Saya perspektif AI yang disuling daripada rekod awam ${expert.name}: ${tagline}. Sasaran permainan web anda ialah ${role}; saya akan menggunakan kerangka pemikiran ini untuk membincangkan persediaan anda.\n\nSaya bukan orang sebenar dan tidak mewakili pandangannya. Hantar soalan, atau /exit untuk kembali ke sembang biasa.`,
    }, lang)
}

function historyOf(value)
{
    const history = []
    for(const turn of Array.isArray(value) ? value.slice(-6) : [])
    {
        if(![ 'user', 'assistant' ].includes(turn?.role) || typeof turn.content !== 'string' || !turn.content.trim())
            continue
        if(turn.role !== (history.length % 2 === 0 ? 'user' : 'assistant'))
            continue
        history.push({ role: turn.role, content: turn.content.slice(0, 1200) })
    }
    if(history.at(-1)?.role === 'user')
        history.pop()
    return history
}

export async function telegramExpert(save, body)
{
    if(!body || typeof body !== 'object' || Array.isArray(body))
        throw new IntegrationError(400, 'bad-expert-request')
    if(body.channel !== 'telegram' || typeof body.from !== 'string' || !/^tg:[0-9]{1,30}$/.test(body.from))
        throw new IntegrationError(400, 'bad-expert-sender')
    if(typeof body.messageId !== 'string' || !body.messageId.trim() || body.messageId.length > 180)
        throw new IntegrationError(400, 'bad-message-id')
    if(![ 'enter', 'ask' ].includes(body.action))
        throw new IntegrationError(400, 'bad-expert-action')
    if(body.action === 'ask' && (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000))
        throw new IntegrationError(400, 'bad-expert-question')

    const receipt = expertReceipt(save, body)
    if(receipt.previous)
        return { ...receipt.previous, duplicate: true }
    const lang = [ 'zh', 'en', 'ms' ].includes(save.lang) ? save.lang : 'en'
    const career = getCareer(save.target?.careerId)
    if(!career)
        return remember(save, receipt, { active: false, reply: choose({ zh: '请先在网页游戏里选择 target 目标职业，再发送 /expert。', en: 'Choose a target career in the web game first, then send /expert.', ms: 'Pilih kerjaya sasaran dalam permainan web dahulu, kemudian hantar /expert.' }, lang) })
    const expert = expertOf(career.id)
    if(!expert)
        return remember(save, receipt, { active: false, reply: choose({ zh: `目标职业「${career.name.zh}」暂时没有蒸馏专家。目前支持机器学习工程师（Andrej Karpathy）和数据分析师（Hans Rosling）。`, en: `No distilled expert is available for your target, ${career.name.en}. Currently supported: ML engineer (Andrej Karpathy) and data analyst (Hans Rosling).`, ms: `Tiada pakar tersuling untuk sasaran ${career.name.ms}. Kini tersedia: jurutera ML (Andrej Karpathy) dan penganalisis data (Hans Rosling).` }, lang) })

    const changed = body.careerId !== career.id
    const state = { active: true, careerId: career.id, expert, lang, history: [] }
    const intro = introduction(expert, career, lang)
    if(body.action === 'enter')
        return remember(save, receipt, { ...state, reply: intro })

    const history = changed ? [] : historyOf(body.history)
    const question = body.text.trim()
    const answer = await askMentor({ career, question, history, elite: true, profile: save.profile, target: save.target, lang })
    if(typeof answer !== 'string' || !answer.trim())
        throw new IntegrationError(502, 'empty-expert-answer')
    state.history = [ ...history, { role: 'user', content: question.slice(0, 1200) }, { role: 'assistant', content: answer.slice(0, 1200) } ].slice(-6)
    return remember(save, receipt, { ...state, reply: changed ? `${intro}\n\n${answer}` : answer })
}
