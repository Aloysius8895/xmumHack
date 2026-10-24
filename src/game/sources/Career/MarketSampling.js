export function newCareerBadge(career, {t, esc})
{
    return career.emerging ? `<span class="career-new-badge" title="${esc(t('market.emerging.badge'))}" aria-label="${esc(t('market.emerging.badge'))}">NEW</span>` : ''
}

export function renderSamplingDiagnostics(report, {t, esc, locale, expanded=false, refresh={}})
{
    const number = new Intl.NumberFormat(locale)
    const source = report?.sources.map(row => `${row.id}: ${number.format(row.count)} (${report.n ? (row.count / report.n * 100).toFixed(1) : 0}%)`).join(' · ')
    const regions = report?.regions.filter(row => row.id !== 'Unknown').slice(0,4).map(row => `${row.id}: ${number.format(row.count)}`).join(' · ')
    const coverage = report ? `
        <p>${esc(t('market.sampling.scope', {n:number.format(report.n)}))}</p>
        <dl>
            <div><dt>${esc(t('market.sampling.sources'))}</dt><dd>${esc(source)}</dd></div>
            <div><dt>${esc(t('market.sampling.regions'))}</dt><dd>${esc(regions)} · ${esc(t('market.sampling.unknown', {n:report.unknownRegion}))}</dd></div>
            <div><dt>${esc(t('market.sampling.quality'))}</dt><dd>${esc(t('market.sampling.qualityCounts', {u:report.usableDescriptions,n:report.n,c:report.unclassified,d:report.undated,r:report.recentDated}))}</dd></div>
            <div><dt>${esc(t('market.sampling.concentration'))}</dt><dd>${esc(t('market.sampling.concentrationCounts', {n:report.topEmployerCount,p:report.n ? (report.topEmployerCount/report.n*100).toFixed(1) : 0,q:report.pageCappedQueries}))}</dd></div>
        </dl>
        <p>${esc(t('market.sampling.action'))}</p>` : `<p>${esc(t('market.sampling.empty'))}</p>`
    const result=refresh.result
    const errorKey=`error.${result?.error}`
    const message=result ? result.status==='failed'
        ? (t(errorKey)===errorKey?t('error.crawler-refresh-failed'):t(errorKey))
        : t(result.status==='published'?'market.refresh.done':result.status==='publishing'?'market.refresh.publishing':'market.refresh.running',{n:result.postings??0,a:result.newAds??0,r:result.previouslySeen??0}) : ''
    return `<section class="career-sampling">
        <div class="career-sampling-header">
            <button type="button" class="career-sampling-toggle" data-action="market-sampling-toggle" aria-expanded="${expanded}" aria-controls="market-sampling-content"><span aria-hidden="true">${expanded?'▾':'▸'}</span><span>${esc(t('market.sampling.title'))}</span></button>
            <button type="button" class="career-button career-sampling-refresh" data-action="market-refresh" title="${esc(t('market.refresh.button'))}" aria-label="${esc(t('market.refresh.button'))}" ${refresh.busy?'disabled aria-busy="true"':''}>↻ ${esc(t(refresh.busy?'market.refresh.shortBusy':'market.refresh.short'))}</button>
        </div>
        <p class="career-market-refresh-message" role="status" aria-live="polite">${esc(message)}</p>
        ${result?.unavailableSources?.length?`<p class="career-market-refresh-message">${esc(t('market.refresh.unavailable',{sources:result.unavailableSources.map(row=>`${row.id} (${row.error})`).join(' · ')}))}</p>`:''}
        <div class="career-sampling-content" id="market-sampling-content" ${expanded?'':'hidden'}>${coverage}</div>
    </section>`
}
