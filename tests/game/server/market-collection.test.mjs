import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { createCollectionRunner, verifyGeneration } from '../../../src/game/server/market-collection.js'
import { buildPublicMarketWorkflow } from '../../../src/game/n8n/market/build-public-workflow.mjs'

const json = (directory, name, value) => { fs.mkdirSync(directory, {recursive:true}); fs.writeFileSync(path.join(directory,name), JSON.stringify(value)) }
function generation(directory)
{
    json(directory,'jobs.json',[{canonical_job_id:'fixture:1',description_quality:'usable'}])
    json(directory,'job_skills.json',[{canonical_job_id:'fixture:1',skill_id:'sql'}])
    json(directory,'quality_report.json',{malaysia_jobs:1,skill_links:1,sources:{linkedin:1}})
    const manifest = Object.fromEntries(['jobs.json','job_skills.json','quality_report.json'].map(name => [name,crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,name))).digest('hex')]))
    json(directory,'artifact_manifest.json',manifest)
}

test('public collection shares concurrent runs and publishes only validated derived output', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(),'public-collection-'))
    let commands = 0
    const runner = async (script,args) => {
        commands++
        if(script==='collect_linkedin.py') {
            json(path.join(root,'raw','fixture'),'manifest.json',{run_id:'fixture',searches_expected:52,searches_successful:52,unique_source_jobs:1,details_successful:1,details_selected:1,access_blocked:false})
            return 'progress\n'+JSON.stringify({directory:'raw/fixture'})
        }
        generation(path.join(root,args[1]))
        return 'processed fixture'
    }
    const collector = createCollectionRunner({root,runner})
    const first = collector.run(), second = collector.run()
    assert.equal(first,second)
    const result = await first
    assert.equal(result.status,'success')
    assert.equal(result.summary.postings,1)
    assert.equal(commands,2)
    assert.equal(verifyGeneration(path.join(root,'processed')).skillLinks,1)
})

test('partial source failures retain previous published data and never process partial sample', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(),'failed-collection-'))
    generation(path.join(root,'processed'))
    const before=fs.readFileSync(path.join(root,'processed','jobs.json'),'utf8')
    let commands=0
    const collector=createCollectionRunner({root,runner:async () => {
        commands++
        json(path.join(root,'raw','failed'),'manifest.json',{searches_expected:52,searches_successful:2,unique_source_jobs:10,details_selected:1,details_successful:0,access_blocked:true})
        return JSON.stringify({directory:'raw/failed'})
    }})
    await assert.rejects(collector.run(),/collection-incomplete-retained-previous-data/)
    assert.equal(commands,1)
    assert.equal(collector.status().status,'failed')
    assert.equal(fs.readFileSync(path.join(root,'processed','jobs.json'),'utf8'),before)
})

test('checksums and out-of-root collector output are rejected',async () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'invalid-collection-'))
    generation(path.join(root,'processed'))
    fs.appendFileSync(path.join(root,'processed','jobs.json'),' ')
    assert.throws(()=>verifyGeneration(path.join(root,'processed')),/checksum/)
    const collector=createCollectionRunner({root,runner:async()=>JSON.stringify({directory:'../outside'})})
    await assert.rejects(collector.run(),/invalid-output-path/)
})

test('no-key workflow calls fixed collector with backend credentials and daily MYT schedule',()=>{
    const workflow=buildPublicMarketWorkflow()
    assert.equal(workflow.settings.timezone,'Asia/Kuala_Lumpur')
    assert.equal(workflow.nodes.find(node=>node.type.endsWith('.scheduleTrigger')).parameters.rule.interval[0].expression,'0 8 * * *')
    assert.ok(workflow.nodes.find(node=>node.type.endsWith('.httpRequest')).parameters.url.endsWith('/api/integrations/market/collect'))
    assert.ok(!JSON.stringify(workflow).includes('rapidapi.com'))
})
