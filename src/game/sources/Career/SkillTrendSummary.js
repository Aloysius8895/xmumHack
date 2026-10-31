/** Historical skill movers use exactly the resolved rows and monthly changes displayed in the skill list. */
export function renderSkillTrendSummary(skills, { t, esc, skillName, range, month, previous })
{
    const rising = skills.filter(skill => skill.points !== null && skill.points > 0).sort((a, b) => b.points - a.points).slice(0, 5)
    const declining = skills.filter(skill => skill.points !== null && skill.points < 0).sort((a, b) => a.points - b.points).slice(0, 5)
    const list = rows => rows.length
        ? `<ol>${rows.map(skill => `<li><span>${esc(skillName(skill))}</span><em>${skill.points > 0 ? '↑' : '↓'} ${esc(t('market.points', { n: `${skill.points > 0 ? '+' : ''}${skill.points.toFixed(1)}` }))}</em></li>`).join('')}</ol>`
        : `<p class="career-muted">${esc(t('market.skillSummary.none'))}</p>`
    return `<section class="career-radar" aria-labelledby="career-radar-title">
        <h3 id="career-radar-title">${esc(t('market.skillSummary.title', { range }))}</h3>
        <div class="career-radar-columns">
            <div class="is-up"><h4>${esc(t('market.skillSummary.rising'))}</h4>${list(rising)}</div>
            <div class="is-down"><h4>${esc(t('market.skillSummary.declining'))}</h4>${list(declining)}</div>
        </div>
        <p class="career-muted">${esc(t('market.skillSummary.note', { month, previous }))}</p>
    </section>`
}
