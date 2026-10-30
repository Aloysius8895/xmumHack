import { allCareers } from './careers.js'

const REGIONS = [
    ['Kuala Lumpur', /kuala lumpur|\bkl\b/i], ['Selangor', /selangor|petaling jaya|shah alam|subang|cyberjaya|puchong|klang/i],
    ['Penang', /penang|pulau pinang|george town|bayan lepas/i], ['Johor', /johor/i],
    ['Sabah', /sabah|kota kinabalu/i], ['Sarawak', /sarawak|kuching|miri/i],
    ['Perak', /perak|ipoh/i], ['Melaka', /melaka|malacca/i], ['Negeri Sembilan', /negeri sembilan|seremban/i],
    ['Kedah', /kedah|kulim|alor setar/i], ['Pahang', /pahang|kuantan/i], ['Kelantan', /kelantan|kota bharu/i],
    ['Terengganu', /terengganu/i], ['Perlis', /perlis/i], ['Putrajaya', /putrajaya/i], ['Labuan', /labuan/i],
]
const frequencies = (jobs, key) => {
    const counts = new Map()
    for(const job of jobs) { const value = key(job); counts.set(value, (counts.get(value) ?? 0) + 1) }
    return [...counts].map(([id, count]) => ({ id, count })).sort((a,b) => b.count - a.count || a.id.localeCompare(b.id))
}

/** Coverage diagnostics describe this convenience sample; they do not estimate unknown inclusion probabilities. */
export function buildSamplingDiagnostics(jobs, quality = {}, asOf = new Date().toISOString())
{
    const end = asOf.slice(0,10)
    const start = new Date(Date.parse(`${end}T00:00:00Z`) - 29 * 86400000).toISOString().slice(0,10)
    const dated = job => /^\d{4}-\d{2}-\d{2}$/.test(job.posted_date ?? '')
    const recent = job => dated(job) && job.posted_date >= start && job.posted_date <= end
    const regions = frequencies(jobs, job => REGIONS.find(([,pattern]) => pattern.test(`${job.state ?? ''} ${job.location_raw ?? ''}`))?.[0] ?? 'Unknown')
    const employers = frequencies(jobs.filter(job => job.company_normalized), job => job.company_normalized)
    const searches = (quality.collection_runs ?? []).flatMap(run => run.searches ?? [])
    const emergingDemand = Object.fromEntries(allCareers().filter(career => career.emerging).map(career => {
        const observed = jobs.filter(job => job.occupation_id === career.id && job.country === 'MY')
        const records = observed.filter(job => recent(job) && job.status !== 'closed').sort((a,b) => b.posted_date.localeCompare(a.posted_date))
        return [career.id, {
            recentAds: records.length, companies: new Set(records.map(job => job.company_normalized).filter(Boolean)).size,
            windowStart: start, windowEnd: end, observedAds: observed.length,
            excludedClosed: observed.filter(job => job.status === 'closed').length,
            undated: observed.filter(job => !dated(job)).length,
            postings: records.slice(0,6).map(job => ({ title:job.title_raw, company:job.company_raw, location:job.location_raw, postedDate:job.posted_date, url:job.job_url })),
        }]
    }))
    return {
        n: jobs.length, asOf, windowStart:start, windowEnd:end,
        probabilitySample: false, weightingApplied: false, populationEstimate: null,
        sources:frequencies(jobs, job => job.source ?? 'unknown'), regions,
        unknownRegion:regions.find(row => row.id === 'Unknown')?.count ?? 0,
        topEmployerCount:employers[0]?.count ?? 0,
        unclassified:jobs.filter(job => !job.occupation_id).length,
        usableDescriptions:jobs.filter(job => job.description_quality === 'usable').length,
        unverified:jobs.filter(job => !job.live_verified).length,
        undated:jobs.filter(job => !dated(job)).length, recentDated:jobs.filter(recent).length,
        pageCappedQueries:searches.filter(row => row.page_cap_reached).length,
        queryLocations:[...new Set(searches.map(row => row.location).filter(Boolean))], emergingDemand,
    }
}
