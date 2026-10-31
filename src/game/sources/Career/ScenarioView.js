/**
 * Future scenarios on screen (server/scenarios.js through game.js view: forecast, scenarioCompare, skillStatus):
 * which scenario is on and the score of each career (the "why this score" breakdown was removed at the user's request, 2026-10-31).
 * Every number is the server's; this file only lays them out. Always labelled an estimate.
 */
export const PRESET_IDS = [ 'moderate', 'extreme' ]
const ARROW = { rising: '↑', stable: '→', declining: '↓' }

/** The forecast row of a career, or null */
export const forecastOf = (state, careerId) => state.forecast?.careers.find((row) => row.careerId === careerId) ?? null

/** Rank change from the other preset to the current one (positive = higher under the current scenario), or null */
export function rankDelta(state, careerId)
{
    const ranks = state.scenarioCompare?.[careerId]
    const current = state.scenario?.scenario
    const other = PRESET_IDS.find((preset) => preset !== current)
    if(!ranks?.[current] || !ranks?.[other])
        return null
    return ranks[other].rank - ranks[current].rank
}

/**
 * The toggle above the careers: the two presets and what the data recommend (no estimate or mock data tags here, user
 * decision 2026-10-31; the assumptions card was removed at the user's request the same day)
 */
export function renderScenarioBar(state, {t, esc, lang = 'zh'})
{
    const current = state.scenario?.scenario
    const choice = state.scenarioChoice
    // The recommended scenario is marked: it is on by default, the other one is the player's own choice
    const recommended = (preset) => preset === choice?.recommendedScenario ? ` <small class="career-scenario-recommended">${esc(t('scenario.recommendedTag'))}</small>` : ''
    const buttons = PRESET_IDS.map((preset) => `<button type="button" class="career-scenario-button ${preset === current ? 'is-active' : ''}" data-action="scenario" data-preset="${preset}" aria-pressed="${preset === current}">${esc(t(`scenario.${preset}`))}${recommended(preset)}</button>`).join('')
    const thin = state.forecast?.careers.some((row) => row.thinProfile)
    const own = choice?.selectionSource === 'user_override'
    const reason = choice?.reason?.[lang] ?? choice?.reason?.en ?? ''
    return `<section class="career-scenario" aria-label="${esc(t('scenario.label'))}">
        <div class="career-scenario-row">
            <span class="career-scenario-title">${esc(t('scenario.label'))}</span>
            <div class="career-scenario-buttons" role="group">${buttons}</div>
        </div>
        ${choice ? `<p class="career-muted">${esc(t(own ? 'scenario.userChoice' : 'scenario.recommended', { scenario: t(`scenario.${choice.recommendedScenario}`), date: choice.overrideUntil ? new Date(choice.overrideUntil).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang === 'ms' ? 'ms-MY' : 'en-GB') : '—' }))} ${esc(reason)}</p>` : ''}
        ${current === 'custom' ? `<p class="career-muted">${esc(t('scenario.custom', { k: state.forecast.params.k, h: state.forecast.params.H }))}</p>` : ''}
        ${thin ? `<p class="career-notice is-warning">${esc(t('scenario.thinProfile'))} <button type="button" class="career-link" data-action="menu" data-panel="profile">${esc(t('scenario.toProfile'))}</button></p>` : ''}
    </section>`
}

/** The score line of a career card: score, rank change against the other scenario, low confidence */
export function renderCardScore(state, careerId, {t, esc})
{
    const row = forecastOf(state, careerId)
    if(!row)
        return ''
    const delta = rankDelta(state, careerId)
    const other = PRESET_IDS.find((preset) => preset !== state.scenario?.scenario)
    const change = delta ? `<em class="is-${delta > 0 ? 'up' : 'down'}">${esc(t('scenario.rankDelta', { scenario: t(`scenario.${state.scenario.scenario}`), arrow: delta > 0 ? '↑' : '↓', n: Math.abs(delta), other: t(`scenario.${other}`) }))}</em>` : ''
    return `<span class="career-card-score"><strong>${esc(t('scenario.score', { n: row.score }))}</strong> ${change}
        ${row.confidence === 'low' ? `<span class="career-tag is-low" title="${esc(t('scenario.lowHelp'))}">${esc(t('scenario.low'))}</span>` : ''}</span>`
}

/** Skill radar: the skills rising and declining most under the current scenario, and those declining under both */
export function renderSkillRadar(state, {t, esc, skillName})
{
    const skills = state.forecast?.skills ?? []
    if(!skills.length)
        return ''
    const list = (rows) => rows.length ? `<ol>${rows.map((skill) => `<li><span>${esc(skillName(skill.id))}</span><em>${ARROW[skill.status]} ${skill.value.toFixed(2)}</em></li>`).join('')}</ol>` : `<p class="career-muted">${esc(t('scenario.radarNone'))}</p>`
    const rising = skills.filter((skill) => skill.status === 'rising').sort((a, b) => b.value - a.value).slice(0, 5)
    const declining = skills.filter((skill) => skill.status === 'declining').sort((a, b) => a.value - b.value).slice(0, 5)
    const both = skills.filter((skill) => PRESET_IDS.every((preset) => state.skillStatus?.[skill.id]?.[preset] === 'declining'))
    return `<section class="career-radar" aria-labelledby="career-radar-title">
        <h3 id="career-radar-title">${esc(t('scenario.radar', { scenario: t(`scenario.${state.forecast.scenario === 'custom' ? 'customName' : state.forecast.scenario}`) }))} <span class="career-tag is-estimate">${esc(t('scenario.estimate'))}</span></h3>
        <div class="career-radar-columns">
            <div class="is-up"><h4>${esc(t('scenario.radarRising'))}</h4>${list(rising)}</div>
            <div class="is-down"><h4>${esc(t('scenario.radarDeclining'))}</h4>${list(declining)}</div>
        </div>
        <h4>${esc(t('scenario.radarBoth'))}</h4>
        <p class="career-muted">${esc(both.length ? both.map((skill) => skillName(skill.id)).join(', ') : t('scenario.radarNone'))}</p>
        <p class="career-muted">${esc(t('scenario.radarNote'))}</p>
    </section>`
}
