/**
 * Future scenarios on screen (server/scenarios.js through game.js view: forecast, scenarioCompare, skillStatus):
 * which scenario is on, why a career has its score, how to raise it, what is assumed and where the data comes from.
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
 * The toggle above the careers: the two presets, the estimate (and mock data) labels, the assumptions button (open: card
 * shown) and what the data recommend, with a way back to it after the player's own choice
 */
export function renderScenarioBar(state, {t, esc, open = false, lang = 'zh'})
{
    const current = state.scenario?.scenario
    const choice = state.scenarioChoice
    // The recommended scenario is marked: it is on by default, the other one is the player's own choice
    const recommended = (preset) => preset === choice?.recommendedScenario ? ` <small class="career-scenario-recommended">${esc(t('scenario.recommendedTag'))}</small>` : ''
    const buttons = PRESET_IDS.map((preset) => `<button type="button" class="career-scenario-button ${preset === current ? 'is-active' : ''}" data-action="scenario" data-preset="${preset}" aria-pressed="${preset === current}">${esc(t(`scenario.${preset}`))}${recommended(preset)}</button>`).join('')
    const thin = state.forecast?.careers.some((row) => row.thinProfile)
    const own = choice?.selectionSource === 'user_override'
    const reason = choice?.reason?.[lang] ?? choice?.reason?.en ?? ''
    const mock = state.forecast?.mock || choice?.mock
    return `<section class="career-scenario" aria-label="${esc(t('scenario.label'))}">
        <div class="career-scenario-row">
            <span class="career-scenario-title">${esc(t('scenario.label'))}</span>
            <div class="career-scenario-buttons" role="group">${buttons}</div>
            <span class="career-tag is-estimate" title="${esc(t('scenario.estimateHelp'))}">${esc(t('scenario.estimate'))}</span>
            ${mock ? `<span class="career-tag is-mock" title="${esc(t('scenario.mockHelp'))}">${esc(t('scenario.mock'))}</span>` : ''}
            <button type="button" class="career-link" data-action="scenario-assumptions" aria-expanded="${open}">${esc(t('scenario.assumptions'))}</button>
        </div>
        ${choice ? `<p class="career-muted">${esc(t(own ? 'scenario.userChoice' : 'scenario.recommended', { scenario: t(`scenario.${choice.recommendedScenario}`) }))} ${esc(reason)}${own ? ` <button type="button" class="career-link" data-action="scenario" data-preset="default">${esc(t('scenario.backToDefault'))}</button>` : ''}</p>` : ''}
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

const percent = (value) => Math.round(value * 100)

/** One skill of the breakdown: required and current level, future value and status, its parts with their sources */
function skillRow(skill, {t, esc, skillName})
{
    const demand = skill.sources.demand
    const exposure = skill.sources.exposure
    return `<li class="career-score-skill is-${skill.status}"><details>
        <summary>
            <span>${esc(skillName(skill.id))}</span>
            <small>${esc(t('scenario.levels', { current: skill.current, required: skill.required }))}</small>
            <span class="career-score-value" aria-label="${esc(t(`scenario.status.${skill.status}`))}">${ARROW[skill.status]} ${skill.value.toFixed(2)}</span>
        </summary>
        <dl>
            <div><dt>${esc(t('scenario.part.demand'))}</dt><dd>× ${skill.parts.demand.toFixed(2)} · ${esc(demand ? t('scenario.source.demand', { months: demand.months, from: demand.from, through: demand.through }) : t('scenario.noSource'))}</dd></div>
            <div><dt>${esc(t('scenario.part.automation'))}</dt><dd>− ${percent(skill.parts.automationLoss)}% · ${esc(exposure ? t('scenario.source.exposure', { name: exposure.name, n: exposure.taskCount }) : t('scenario.noSource'))}</dd></div>
            <div><dt>${esc(t('scenario.part.augmentation'))}</dt><dd>+ ${percent(skill.parts.augmentationGain)}% · ${esc(exposure ? t('scenario.source.exposure', { name: exposure.name, n: exposure.taskCount }) : t('scenario.noSource'))}</dd></div>
        </dl>
    </details></li>`
}

/** "Why this score": the formula with the career's numbers, its skills, how to raise it and the sources */
export function renderScoreBreakdown(state, careerId, {t, esc, skillName})
{
    const row = forecastOf(state, careerId)
    if(!row)
        return ''
    const raise = row.raise.length
        ? `<ol class="career-score-raise">${row.raise.map((item) => `<li>${esc(t('scenario.raiseItem', { skill: skillName(item.skillId), n: item.gain }))}</li>`).join('')}</ol>`
        : `<p class="career-muted">${esc(t('scenario.raiseNone'))}</p>`
    const exposure = state.forecast.sources.exposure
    return `<section class="career-score" aria-labelledby="career-score-title">
        <h3 id="career-score-title">${esc(t('scenario.why'))} <span class="career-tag is-estimate">${esc(t('scenario.estimate'))}</span></h3>
        <p class="career-score-formula">${esc(t('scenario.formula', { score: row.score, fit: percent(row.fit), outlook: percent(row.outlook), wf: percent(row.weights.fit), wo: percent(row.weights.outlook) }))}</p>
        <p class="career-muted">${esc(t('scenario.skillsHelp'))}</p>
        <ul class="career-score-skills">${row.skills.map((skill) => skillRow(skill, { t, esc, skillName })).join('')}</ul>
        <h4>${esc(t('scenario.raise'))}</h4>
        ${raise}
        <p class="career-muted career-score-sources">${esc(t('scenario.sources', { exposure: exposure ? `${exposure.name} (${exposure.license}, ${exposure.downloadedAt})` : t('scenario.noSource') }))}</p>
    </section>`
}

/** The assumptions card: parameters, the formula in one sentence, sources and limits */
export function renderAssumptions(state, {t, esc})
{
    const forecast = state.forecast
    if(!forecast)
        return ''
    const exposure = forecast.sources.exposure
    const momentum = forecast.sources.momentum
    return `<section class="career-assumptions" aria-labelledby="career-assumptions-title">
        <h3 id="career-assumptions-title">${esc(t('scenario.assumptionsTitle'))}</h3>
        <dl>
            <div><dt>${esc(t('scenario.label'))}</dt><dd>${esc(t(`scenario.${forecast.scenario === 'custom' ? 'customName' : forecast.scenario}`))} · ${esc(t('scenario.params', { k: forecast.params.k, h: forecast.params.H, rate: percent(forecast.adoptionRate) }))}</dd></div>
            <div><dt>${esc(t('scenario.formulaTitle'))}</dt><dd>${esc(t('scenario.formulaSentence'))}</dd></div>
            <div><dt>${esc(t('scenario.exposureTitle'))}</dt><dd>${exposure ? `<a href="${esc(exposure.url)}" target="_blank" rel="noopener">${esc(exposure.name)}</a> · ${esc(exposure.license)} · ${esc(exposure.downloadedAt)}` : esc(t('scenario.noSource'))}</dd></div>
            <div><dt>${esc(t('scenario.demandTitle'))}</dt><dd>${esc(momentum?.months >= 3 ? t('scenario.demandSource', { months: momentum.months, from: momentum.from, through: momentum.through }) : t('scenario.demandNone', { months: momentum?.months ?? 0 }))}</dd></div>
        </dl>
        <ul class="career-assumptions-limits">${[ 'limitParams', 'limitExposure', 'limitEstimate' ].map((key) => `<li>${esc(t(`scenario.${key}`))}</li>`).join('')}</ul>
    </section>`
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
