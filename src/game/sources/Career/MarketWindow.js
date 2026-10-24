/** Display months follow the Malaysia calendar, independently of observation coverage. */
export function marketMonthWindow(months = 7, now = new Date())
{
    const parts = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit',
    }).formatToParts(now)
    const year = Number(parts.find(part => part.type === 'year').value)
    const month = Number(parts.find(part => part.type === 'month').value)
    return Array.from({ length: months }, (_, index) => {
        const date = new Date(Date.UTC(year, month - months + index, 1))
        return date.toISOString().slice(0, 7)
    })
}
