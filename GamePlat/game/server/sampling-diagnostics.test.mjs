import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSamplingDiagnostics } from './sampling-diagnostics.js'

test('reports measured source, region, employer and date coverage without inventing population weights', () => {
    const jobs = [
        {canonical_job_id:'linkedin:1',source:'linkedin',location_raw:'Kuala Lumpur, Malaysia',company_normalized:'a',occupation_id:'x',posted_date:'2026-10-22',description_quality:'usable',live_verified:true},
        {canonical_job_id:'linkedin:2',source:'linkedin',location_raw:'George Town, Penang, Malaysia',company_normalized:'a',occupation_id:'x',posted_date:'2026-08-01'},
        {canonical_job_id:'indeed:3',source:'indeed',location_raw:'Malaysia',company_normalized:'b'},
    ]
    const report = buildSamplingDiagnostics(jobs, {collection_runs:[{searches:[{page_cap_reached:true},{page_cap_reached:false}]}]}, '2026-10-24T04:00:00Z')
    assert.equal(report.n, 3)
    assert.equal(report.sources.find(row => row.id === 'linkedin').count, 2)
    assert.equal(report.regions.find(row => row.id === 'Penang').count, 1)
    assert.equal(report.unknownRegion, 1)
    assert.equal(report.topEmployerCount, 2)
    assert.equal(report.undated, 1)
    assert.equal(report.recentDated, 1)
    assert.equal(report.unclassified, 1)
    assert.equal(report.pageCappedQueries, 1)
    assert.equal(report.populationEstimate, null)
    assert.equal(report.weightingApplied, false)
    assert.equal(report.probabilitySample, false)
})

test('recent emerging demand excludes explicitly closed, undated, future and overseas observations', () => {
    const base = {source:'linkedin',occupation_id:'forward-deployed-engineer',country:'MY',company_normalized:'a',title_raw:'Forward Deployed Engineer',job_url:'https://www.linkedin.com/jobs/view/1/',posted_date:'2026-10-22',status:'unknown'}
    const jobs = [base,{...base,status:'closed'},{...base,posted_date:null},{...base,posted_date:'2026-11-01'},{...base,country:'SG'}]
    const report = buildSamplingDiagnostics(jobs, {}, '2026-10-24T04:00:00Z')
    assert.equal(report.emergingDemand['forward-deployed-engineer'].recentAds, 1)
    assert.equal(report.emergingDemand['forward-deployed-engineer'].companies, 1)
    assert.equal(report.emergingDemand['forward-deployed-engineer'].excludedClosed, 1)
    assert.equal(report.emergingDemand['forward-deployed-engineer'].undated, 1)
})
