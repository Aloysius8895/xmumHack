// Pure helpers shared by the generated n8n Code nodes and local tests.
export const LEARNING_SETTINGS = {
    chatbotBaseUrl: 'http://127.0.0.1:8000',
    ownerTelegramId: '', // numeric Telegram from.id of the ONE player of this local demo
}

export function normalizeTelegram(update, settings)
{
    if(!/^\d+$/.test(String(settings.ownerTelegramId)))
        throw new Error('Set ownerTelegramId to the single demo owner. Match chatbot TELEGRAM_ALLOWED_USER_IDS.')
    if(!Number.isInteger(update.update_id) || update.edited_message)
        return null
    const event = update.message ?? update.callback_query
    const message = update.message ?? update.callback_query?.message
    if(!event || !message || message.chat?.type !== 'private' || String(event.from?.id) !== String(settings.ownerTelegramId))
        return null
    return {
        chatbotBaseUrl: String(settings.chatbotBaseUrl).replace(/\/+$/, ''),
        kind: update.callback_query ? 'callback' : typeof message.text === 'string' ? 'text' : 'attachment',
        senderId: String(event.from.id),
        chatId: String(message.chat.id),
        eventId: `tg:${update.update_id}`,
        update, // forward unchanged: confirmation buttons, IDs and routing belong to the existing chatbot
    }
}

export function yesterdayInMalaysia(now = new Date())
{
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [ type, value ]))
    return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) - 1)).toISOString().slice(0, 10)
}
