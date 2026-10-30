/**
 * A career across the MyCOL editions (server/official-signals.js mycolTimeline): listed as critical, not listed, or
 * limited (that edition covered a few sectors only). A listed edition opens on its page and quote, with the PDF link.
 */
export function renderMycolTimeline(timeline, {t, esc})
{
    if(!timeline?.length)
        return ''
    const items = timeline.map((edition) =>
    {
        const label = `<span class="career-mycol-period">${esc(edition.period)}</span><span class="career-mycol-status">${esc(t(`mycol.${edition.status}`))}</span>`
        if(edition.status !== 'listed')
            return `<li class="is-${edition.status}" title="${esc(edition.status === 'limited' ? t('mycol.limitedNote', { scope: edition.scope ?? '' }) : t('mycol.notListedNote'))}">${label}</li>`
        return `<li class="is-listed"><details>
            <summary>${label}</summary>
            <blockquote>${esc(edition.quote)}</blockquote>
            <a href="${esc(edition.url)}" target="_blank" rel="noopener">${esc(t('mycol.page', { page: edition.page }))}</a>
        </details></li>`
    }).join('')
    return `<h3>${esc(t('mycol.title'))}</h3>
        <ol class="career-mycol">${items}</ol>
        <p class="career-muted">${esc(t('mycol.note'))}</p>`
}
