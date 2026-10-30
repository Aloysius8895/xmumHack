export function newCareerBadge(career, {t, esc})
{
    return career.emerging ? `<span class="career-new-badge" title="${esc(t('market.emerging.badge'))}" aria-label="${esc(t('market.emerging.badge'))}">NEW</span>` : ''
}

const MYT = 'Asia/Kuala_Lumpur'
const clock = (iso, locale) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: MYT }).format(new Date(iso))
const moment = (iso, locale) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: MYT }).format(new Date(iso))
function ago(iso, now, t)
{
    const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
    return minutes < 1 ? t('market.refresh.justNow') : minutes < 60 ? t('market.refresh.minutesAgo', { n: minutes })
        : minutes < 1440 ? t('market.refresh.hoursAgo', { n: Math.round(minutes / 60) }) : t('market.refresh.daysAgo', { n: Math.round(minutes / 1440) })
}

/** The Refresh result line: incremental runs report new, updated and unchanged adverts since the last collection */
function refreshMessage(result, {t, locale, collection, cooldown})
{
    if(!result)
        return ''
    if(result.status === 'failed')
    {
        if(result.error === 'crawler-cooldown' && cooldown)
            return t('error.crawler-cooldown', { at: clock(cooldown, locale) })
        if([ 'crawler-unavailable', 'crawler-not-configured' ].includes(result.error) && collection?.lastCollectedAt)
            return t('market.refresh.offline', { date: moment(collection.lastCollectedAt, locale) })
        const errorKey = `error.${result.error}`
        return t(errorKey) === errorKey ? t('error.crawler-refresh-failed') : t(errorKey)
    }
    if(result.status === 'published' && result.unchangedAds != null)
        return (result.newAds ?? 0) + (result.changedAds ?? 0) === 0 ? t('market.refresh.nothingNew')
            : t('market.refresh.doneIncremental', { a: result.newAds ?? 0, c: result.changedAds ?? 0, u: result.unchangedAds })
    return t(result.status === 'published' ? 'market.refresh.done' : result.status === 'publishing' ? 'market.refresh.publishing' : 'market.refresh.running',
        { n: result.postings ?? 0, a: result.newAds ?? 0, r: result.previouslySeen ?? 0 })
}

/**
 * refresh: { busy, result (the last Refresh run), collection (state.trends.crawler: lastCollectedAt, nextScheduledAt,
 * cooldownUntil, window, postings), now }
 */
export function renderSamplingDiagnostics(report, {t, esc, locale, expanded=false, refresh={}})
{
    const number = new Intl.NumberFormat(locale)
    const collection = refresh.collection
    const now = refresh.now ?? Date.now()
    const cooldown = [ refresh.result?.cooldownUntil, collection?.cooldownUntil ].filter((at) => at && Date.parse(at) > now).sort().at(-1) ?? null
    const timing = collection ? [
        collection.lastCollectedAt ? t('market.refresh.last', { ago: ago(collection.lastCollectedAt, now, t) }) : t('market.refresh.never'),
        collection.nextScheduledAt ? t('market.refresh.next', { at: moment(collection.nextScheduledAt, locale) }) : null,
    ].filter(Boolean).join(' · ') : ''
    const range = collection?.window && collection.postings != null
        ? t('market.refresh.window', { d: collection.window.days, n: number.format(collection.postings), date: moment(collection.collectedAt, locale) }) : ''
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
    const message=refreshMessage(result,{t,locale,collection,cooldown})
    const label=refresh.busy?t('market.refresh.shortBusy'):cooldown?t('market.refresh.cooldownShort',{at:clock(cooldown,locale)}):t('market.refresh.short')
    return `<section class="career-sampling">
        <div class="career-sampling-header">
            <button type="button" class="career-sampling-toggle" data-action="market-sampling-toggle" aria-expanded="${expanded}" aria-controls="market-sampling-content"><span aria-hidden="true">${expanded?'▾':'▸'}</span><span>${esc(t('market.sampling.title'))}</span></button>
            <button type="button" class="career-button career-sampling-refresh" data-action="market-refresh" title="${esc(t('market.refresh.button'))}" aria-label="${esc(t('market.refresh.button'))}" ${refresh.busy?'disabled aria-busy="true"':cooldown?'disabled':''}>↻ ${esc(label)}</button>
        </div>
        ${timing||range?`<p class="career-market-refresh-timing">${esc([range,timing].filter(Boolean).join(' · '))}</p>`:''}
        <p class="career-market-refresh-message" role="status" aria-live="polite">${esc(message)}</p>
        ${result?.unavailableSources?.length?`<p class="career-market-refresh-message">${esc(t('market.refresh.unavailable',{sources:result.unavailableSources.map(row=>`${row.id} (${row.error})`).join(' · ')}))}</p>`:''}
        <div class="career-sampling-content" id="market-sampling-content" ${expanded?'':'hidden'}>${coverage}</div>
    </section>`
}

/**
 * Personal update log (server/update-log.js): what changed since the player last marked the data as read, for their
 * target and best-matching careers, and for the skills of their learning direction. names: { skill(id), career(id) },
 * direction: { saved (save.learningDirection), draft (the unsaved text) }
 */
export function renderUpdateLog(log, {t, esc, locale, names, direction = {}})
{
    if(!log?.baseline)
        return ''
    const saved = direction.saved
    const learning = `<div class="career-updates-direction">
        <label for="career-learning-direction">${esc(t('market.updates.direction'))}</label>
        <div class="career-updates-direction-row">
            <input id="career-learning-direction" type="text" maxlength="1000" data-draft="learningDirection" placeholder="${esc(t('market.updates.directionHint'))}" value="${esc(direction.draft ?? saved?.text ?? '')}">
            <button type="button" class="career-button" data-action="learning-direction">${esc(t('market.updates.directionSave'))}</button>
        </div>
        ${saved ? `<p class="career-muted">${esc(saved.skillIds.length ? t('market.updates.directionSkills', { skills: saved.skillIds.map(names.skill).join(', ') }) : t('market.updates.directionNone'))}${saved.unmatched?.length ? ` · ${esc(t('market.updates.directionUnmatched', { phrases: saved.unmatched.join(', ') }))}` : ''}</p>` : ''}
    </div>`
    const number = new Intl.NumberFormat(locale)
    const signed = (value) => `${value > 0 ? '+' : ''}${value}`
    const line = (change) =>
    {
        if(change.kind === 'skill-share')
            return t('market.updates.share', { skill: names.skill(change.skillId), from: change.from, to: change.to, d: signed(change.delta), n: number.format(change.sample.to) })
        if(change.kind === 'new-postings')
            return t('market.updates.postings', { n: number.format(change.added), career: names.career(change.careerId) })
        return t('market.updates.official', { career: names.career(change.careerId), source: change.source, page: change.page })
    }
    const items = log.changes.map((change) => `<li class="is-${change.kind}${change.delta ? ` is-${change.delta > 0 ? 'up' : 'down'}` : ''}">${esc(line(change))}${change.url ? ` <a href="${esc(change.url)}" target="_blank" rel="noopener">${esc(t('market.updates.sourceLink'))}</a>` : ''}</li>`).join('')
    const affected = log.affectedRoadmapSkills?.length
        ? `<p class="career-updates-roadmap">${esc(t('market.updates.roadmap', { skills: log.affectedRoadmapSkills.map(names.skill).join(', ') }))}</p>` : ''
    return `<section class="career-updates" aria-labelledby="career-updates-title">
        <div class="career-updates-header">
            <h3 id="career-updates-title">${esc(t('market.updates.title'))}</h3>
            <span class="career-muted">${esc(t('market.updates.since', { date: moment(log.seenAt, locale) }))}</span>
        </div>
        ${log.count ? `<ul>${items}</ul>${affected}
        <p class="career-muted career-updates-note">${esc(t('market.updates.note'))}</p>
        <button type="button" class="career-button" data-action="updates-seen">${esc(t('market.updates.seen'))}</button>`
        : `<p class="career-muted">${esc(t('market.updates.none'))}</p>`}
        ${learning}
    </section>`
}
