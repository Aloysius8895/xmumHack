import { chosenRange, monthsBetween, shiftMonth } from './MarketReference.js'

/** Resolve the shared market range for trend pages and skill cards. */
export function marketRangeWindow(trends, selection = {}, calendar = marketMonthWindow())
{
    const currentMonth = calendar.at(-1)
    const firstMonth = [...calendar, ...trends.periods, ...(trends.historical?.periods ?? []),
        ...(trends.references ?? []).flatMap(reference => reference.months)].sort()[0]
    const allMonths = monthsBetween(firstMonth, currentMonth)
    const range = chosenRange(allMonths, selection, calendar)
    const previousMonth = shiftMonth(range.to, -1)
    return {...range, allMonths, currentMonth, previousMonth, comparisonMonths: [...new Set([...range.shown, previousMonth])]}
}

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
