/**
 * Post-stratification of a posting sample to DOSM's occupation structure (prompt 01e), like a poll weighted to the
 * census: in each DOSM stratum, weight = DOSM share / sample share, so the weighted sample has DOSM's mix. Postings
 * whose stratum is unknown keep weight 1 (and are reported). Margins of error use Kish's effective sample size,
 * n_eff = (Σw)² / Σw², for a 95% margin of 1.96 √(p(1−p) / n_eff).
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const DOSM_FILE = fileURLToPath(new URL('../../../data/official-signals/dosm-occupations.json', import.meta.url))
export const Z = 1.96

// The DOSM quarter each sample is weighted to: the quarter of most of its postings with group figures, or the latest
// published one for our own collection (DOSM publishes about a year late; 2024 Q1 and 2025 Q2 have no group figures)
export const SAMPLE_QUARTER = { 'jobstreet-2024': '2024-Q2', 'jobstreet-2025': '2025-Q1', window: '2026-Q2' }

export function loadDosm(file = DOSM_FILE)
{
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** { group: weight } from the groups of the sample's postings (null = unknown) and DOSM's shares */
export function stratumWeights(groups, dosmShares)
{
    const known = groups.filter((group) => group !== null)
    const counts = {}
    for(const group of known)
        counts[group] = (counts[group] ?? 0) + 1
    const weights = {}
    for(const [ group, share ] of Object.entries(dosmShares))
        if(counts[group])
            weights[group] = share / (counts[group] / known.length)
    return weights
}

export const weightOf = (weights, group) => group === null || group === undefined ? 1 : weights[group] ?? 1

/** Weighted share (%) of the rows passing `hit`, with its 95% margin (points) and effective sample size */
export function weightedShare(rows, hit)
{
    let total = 0, squares = 0, hits = 0
    for(const row of rows)
    {
        total += row.weight
        squares += row.weight ** 2
        if(hit(row))
            hits += row.weight
    }
    if(!total)
        return { share: null, margin: null, nEff: 0 }
    const p = hits / total
    const nEff = total ** 2 / squares
    return { share: p * 100, margin: Z * Math.sqrt(p * (1 - p) / nEff) * 100, nEff }
}

/** A change between two weighted shares that is larger than their combined margin */
export const significant = (before, after) =>
    before.share !== null && after.share !== null && Math.abs(after.share - before.share) > Math.hypot(before.margin, after.margin)
