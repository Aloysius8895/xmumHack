/**
 * The data inputs of the roadmap AI (prompt 06, docs/ROADMAP-INPUTS.md), computed in code: the AEI evidence of the
 * target career as targeted (customised to a company's job posting), the scenario state (recommended, chosen,
 * effective) with the classification rules, and the learning priority with how to learn each skill under each
 * scenario. The roadmap prompt adds the profile, the roadmap and the reviews itself.
 */
import { getCareer } from './careers.js'
import { aeiEvidence, trendClassification } from './aei-evidence.js'
import { scenarioState } from './scenarios.js'
import { skillPriority } from './no-regret.js'
import { roadmapCareer } from './game.js'

export function roadmapInputs(save)
{
    const scenario = scenarioState(save)
    const careerId = save.target?.careerId ?? null
    const catalog = careerId ? getCareer(careerId) : null
    const career = catalog ? roadmapCareer(save, catalog) : null
    return {
        targetCareerId: careerId,
        aeiEvidence: career ? aeiEvidence(careerId, { career }) : null,
        trendClassificationRules: trendClassification(careerId).rules,
        scenario,
        userScenarioOverride: scenario.userOverride,
        modelAnalysis: { skillPriority: career ? skillPriority(save, { career }) : null },
    }
}
