/** Read-only historical context. Values are never assigned to career or skill counts. */
export function renderMarketHistory(history, { t, esc, locale, short, rangeLabel })
{
    if(!history?.series?.length) return ''
    const number = new Intl.NumberFormat(locale)
    const sourceLink = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`
    const chart = series =>
    {
        const values = series.values
        const known = values.filter(value => value !== null)
        const max = Math.max(1, Math.ceil(Math.max(0, ...known) / 10000) * 10000)
        const x = index => 55 + index / Math.max(1, values.length - 1) * 550
        const y = value => 146 - value / max * 112
        const segments = []
        let segment = []
        values.forEach((value, index) => {
            if(value === null)
            {
                if(segment.length) segments.push(segment)
                segment = []
            }
            else segment.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`)
        })
        if(segment.length) segments.push(segment)
        const accessible = history.periods.map((period, index) => `${period}: ${values[index] === null ? t('market.history.missing') : number.format(values[index])}`).join('; ')
        const observedPeriods = history.periods.filter((_, index) => values[index] !== null)
        const note = series.id === 'dosm'
            ? observedPeriods.length ? t('market.history.dosmNote', {
                range: rangeLabel(observedPeriods[0], observedPeriods.at(-1)),
                n: number.format(known.reduce((total, value) => total + value, 0)),
            }) : t('market.history.dosmUnavailable')
            : t(`market.history.${series.id}Note`)
        return `<figure class="career-history-series" data-history-source="${esc(series.id)}">
            <figcaption>
                <strong>${esc(t(`market.history.${series.id}`))}</strong>
                ${sourceLink(series.sourceUrl, t('market.history.source'))}
            </figcaption>
            <div class="career-history-plot">
                <svg viewBox="0 0 660 190" role="img" aria-label="${esc(t(`market.history.${series.id}`))}">
                    <title>${esc(t(`market.history.${series.id}`))}</title><desc>${esc(accessible)}</desc>
                    ${[0, 0.5, 1].map(ratio => `<line class="career-history-grid" x1="55" x2="605" y1="${y(max * ratio)}" y2="${y(max * ratio)}"/><text class="career-history-axis" x="46" y="${y(max * ratio) + 4}" text-anchor="end">${esc(number.format(max * ratio / 1000))}k</text>`).join('')}
                    ${segments.filter(points => points.length > 1).map(points => `<polyline class="career-history-line" points="${points.join(' ')}"/>`).join('')}
                    ${values.map((value, index) => value === null
                        ? `<text class="career-history-missing" x="${x(index)}" y="137" text-anchor="middle">—</text>`
                        : `<g><circle class="career-history-point" cx="${x(index)}" cy="${y(value)}" r="4"><title>${esc(`${history.periods[index]}: ${number.format(value)}`)}</title></circle><text class="career-history-value" x="${x(index)}" y="${y(value) - 11}" text-anchor="middle">${esc(number.format(value))}</text></g>`).join('')}
                    ${history.periods.map((period, index) => `<text class="career-history-axis" x="${x(index)}" y="175" text-anchor="middle">${esc(short(period))}</text>`).join('')}
                </svg>
            </div>
            <small class="career-history-scrollhint">${esc(t('market.history.scroll'))}</small>
            <p class="career-muted">${esc(note)}</p>
        </figure>`
    }
    const quarterly = history.quarterly
    return `<section class="career-trend-card career-history">
        <header class="career-trend-head">
            <div><h3>${esc(t('market.history.title'))}</h3><p class="career-muted">${esc(rangeLabel(history.periods[0], history.periods.at(-1)))}</p></div>
            <span class="career-trend-badge is-live">${esc(t('market.history.real'))}</span>
        </header>
        <p class="career-muted">${esc(t('market.history.scope'))}</p>
        <div class="career-trend-scroll">
            <table class="career-history-monthly">
                <caption>${esc(t('market.history.monthly'))}</caption>
                <thead><tr><th scope="col">${esc(t('market.history.month'))}</th>${history.series.map(series => `<th scope="col">${sourceLink(series.sourceUrl, t(`market.history.${series.id}`))}</th>`).join('')}</tr></thead>
                <tbody>${history.periods.map((period, index) => `<tr><th scope="row">${esc(period)}</th>${history.series.map(series => series.values[index] == null
                    ? `<td class="is-empty">${esc(t('market.history.missing'))}</td>`
                    : `<td>${esc(number.format(series.values[index]))}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
        </div>
        ${history.series.map(chart).join('')}
        <p class="career-muted career-history-key">${esc(t('market.history.missingNote'))}</p>
        ${quarterly?.occupations?.length ? `<details class="career-history-quarterly">
            <summary>${esc(t('market.history.quarterly'))}</summary>
            <p class="career-muted">${esc(t('market.history.quarterlyNote'))} ${sourceLink(quarterly.sourceUrl, t('market.history.source'))}</p>
            <div class="career-trend-scroll"><table>
                <thead><tr><th scope="col">${esc(t('market.career'))}</th>${quarterly.periods.map(period => `<th scope="col">${esc(period)}</th>`).join('')}</tr></thead>
                <tbody>${quarterly.occupations.map(row => `<tr><th scope="row">${esc(t(`market.history.occupation.${row.id}`))}</th>${row.values.map(value => `<td>${value === null ? '—' : esc(number.format(value))}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>
        </details>` : ''}
    </section>`
}
