/**
 * Past JobStreet months in the market heatmap (server/reference-market.js) and their 2024→2025 change
 * (server/reference-trend.js). Each dataset has another collector and sample size than our collection, so its cells
 * show the career's share of that month's sample, on the dataset's own colour scale, set apart by a divider.
 */

/** Every month from `from` to `to` (YYYY-MM), both included */
export function monthsBetween(from, to)
{
    const months = []
    for(let year = Number(from.slice(0, 4)), month = Number(from.slice(5)); `${year}-${String(month).padStart(2, '0')}` <= to; month === 12 ? (year++, month = 1) : month++)
        months.push(`${year}-${String(month).padStart(2, '0')}`)
    return months
}

// The heatmap shows at most this many months: a wider choice is refused with a warning
export const MAX_RANGE_MONTHS = 9

/** Months from `a` to `b` whichever comes first, both included */
export const rangeLength = (a, b) => monthsBetween(a < b ? a : b, a < b ? b : a).length

/** The month `n` months after (or before, when negative) `month` */
export function shiftMonth(month, n)
{
    const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1 + n
    return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

/**
 * A new end of the range: kept as chosen; when the range would pass MAX_RANGE_MONTHS, the other end moves to the
 * limit instead of refusing the choice (refusing would leave no way to reach a distant month). { from, to, adjusted }
 */
export function limitRange(changed, value, other)
{
    // In time order, whichever menu was used (a reversed choice is swapped, as chosenRange does)
    const from = value < other ? value : other, to = value < other ? other : value
    if(rangeLength(from, to) <= MAX_RANGE_MONTHS)
        return { from, to, adjusted: null }
    return value === from ? { from, to: shiftMonth(from, MAX_RANGE_MONTHS - 1), adjusted: 'to' }
        : { from: shiftMonth(to, 1 - MAX_RANGE_MONTHS), to, adjusted: 'from' }
}

/** From and to of the heatmap: the panel's choice when it is a known month, else the default; swapped when reversed */
export function chosenRange(months, panel, fallback)
{
    let from = months.includes(panel.marketFrom) ? panel.marketFrom : fallback[0]
    let to = months.includes(panel.marketTo) ? panel.marketTo : fallback.at(- 1)
    if(from > to)
        [ from, to ] = [ to, from ]
    return { from, to, shown: months.filter((month) => month >= from && month <= to) }
}

const shade = (ratio) =>
{
    const mix = 0.14 + Math.min(1, ratio) * 0.86   // from #f0ebff (none) to #4b2fb3 (top of the scale)
    return [ [ 240, 75 ], [ 235, 47 ], [ 255, 179 ] ].map(([ from, to ]) => Math.round(from + (to - from) * mix)).join(',')
}
const percent = (value) => `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`

/**
 * Heatmap pieces for the JobStreet datasets whose months are in `shown`:
 * { isReference(period), head(period), cell(career, period), notes } with careers as rows of the heatmap
 */
export function referenceView(references = [], shown, careers, {t, esc, label, withYear})
{
    const inView = references.map((reference) => ({ ...reference, shownMonths: reference.months.filter((month) => shown.includes(month)) }))
        .filter((reference) => reference.shownMonths.length)
    const of = (period) => inView.find((reference) => reference.shownMonths.includes(period)) ?? null
    const share = (reference, career, period) =>
    {
        const row = reference.careers[career.careerId ?? career.id]
        return row ? (row.byMonth[period] ?? 0) / reference.monthTotals[period] * 100 : null
    }
    const scales = new Map(inView.map((reference) => [ reference.id,
        Math.max(0.5, ...careers.flatMap((career) => reference.shownMonths.map((period) => share(reference, career, period) ?? 0))) ]))
    const partial = (reference, period) => reference.partialMonths.includes(period) ? '*' : ''
    const end = (reference, period) => period === reference.shownMonths.at(- 1) ? 'is-reference-end' : ''
    return {
        isReference: (period) => Boolean(of(period)),
        head(period)
        {
            const reference = of(period)
            return `<th scope="col" class="is-reference ${end(reference, period)}" title="${esc(t('market.reference.title', { n: reference.postings }))}">${esc(label(period))}${partial(reference, period)}<small>JobStreet</small></th>`
        },
        cell(career, period)
        {
            const reference = of(period)
            const value = share(reference, career, period)
            const count = reference.careers[career.careerId ?? career.id]?.byMonth[period] ?? 0
            const text = `JobStreet ${withYear(period)}${partial(reference, period)}: ${value === null ? t('market.noData') : t('market.reference.cell', { n: count, total: reference.monthTotals[period], p: value.toFixed(2) })}`
            if(value === null)
                return `<td class="is-reference is-empty ${end(reference, period)}" title="${esc(text)}" aria-label="${esc(text)}">—</td>`
            const ratio = value / scales.get(reference.id)
            return `<td class="is-reference ${end(reference, period)} ${ratio > 0.5 ? 'is-dark' : ''}" data-origin="reference" style="background-color:rgb(${shade(ratio)})" title="${esc(text)}" aria-label="${esc(text)}"><span>${percent(value)}</span></td>`
        },
        notes: inView.map((reference) => `<p class="career-muted career-reference-note">${esc(t('market.reference.note', { from: reference.from, to: reference.to, n: reference.postings,
            licence: reference.licence ?? '—', author: reference.author ?? '—' }))} <a href="${esc(reference.url)}" target="_blank" rel="noopener">${esc(t('market.updates.sourceLink'))}</a></p>`).join(''),
        datasets: inView.length,
    }
}

/**
 * One row of the JobStreet 2024→2025 change (shares weighted to DOSM, with 95% margins): the arrow and relative
 * change when it is larger than the margins, "no clear change" when it is not, or why there is none
 */
export function yearOnYearText(row, {t})
{
    if(!row)
        return null
    if(row.growth === null)
        return { arrow: '—', text: t('market.yoy.thin'), direction: 'flat' }
    const share = (side) => `${side.weightedShare.toFixed(2)}% ±${side.margin.toFixed(2)}`
    const change = Math.round((Math.exp(row.growth) - 1) * 100)
    if(!row.significant)
        return { arrow: '≈', direction: 'flat', text: t('market.yoy.unclear', { from: share(row.from), to: share(row.to) }) }
    const direction = change > 0 ? 'up' : 'down'
    return { arrow: `${{ up: '↑', down: '↓' }[direction]} ${change > 0 ? '+' : ''}${change}%`, direction,
        text: t('market.yoy.detail', { from: share(row.from), to: share(row.to), change: `${change > 0 ? '+' : ''}${change}` }) }
}

/** The heatmap's last column when both years are on screen: { head, cell(career) } or null */
export function yearOnYearColumn(trend, datasetsShown, {t, esc})
{
    if(!trend || datasetsShown < 2)
        return null
    const title = t('market.yoy.title', { from: trend.window.periods[0].from.slice(5), to: trend.window.periods[0].to.slice(5) })
    return {
        head: `<th scope="col" class="is-yoy" title="${esc(title)}">24→25<small>JobStreet</small></th>`,
        cell(career)
        {
            const shown = yearOnYearText(trend.careers[career.careerId ?? career.id], {t})
            if(!shown)
                return `<td class="is-yoy is-empty">—</td>`
            return `<td class="is-yoy is-${shown.direction}" title="${esc(shown.text)}" aria-label="${esc(shown.text)}">${esc(shown.arrow)}</td>`
        },
    }
}
