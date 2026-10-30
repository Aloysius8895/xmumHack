// Local synthetic responses only: no provider credits, website traffic, publication, or player-save writes.
import {setTimeout as delay} from 'node:timers/promises';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Store} from '../src/store.js';
import {gameConfig} from '../src/game-config.js';
import {startRun,executeRun} from '../src/runner.js';

process.env.JSEARCH_API_KEY='local-benchmark-key';
const base=gameConfig({jsearch:true}),roles=base.roles.slice(0,4);
const indexForQuery=query=>roles.findIndex(r=>r.queries.includes(query));

async function measure(name,settings){
 const store=new Store(':memory:'),config={...base,roles,...settings};
 const rawDirectory=pathToFileURL(mkdtempSync(join(tmpdir(),'collection-speed-benchmark-'))+sep);
 let searches=0,apiRequests=0,browserRequests=0;
 try{
  const id=startRun(store,config),start=performance.now();
  const result=await executeRun(store,config,id,{
   fetchImpl:async url=>{
    apiRequests++;await delay(30);const n=indexForQuery(new URL(url).searchParams.get('query'));
    return new Response(JSON.stringify({status:'OK',data:{cursor:null,jobs:['linkedin','indeed'].map(platform=>({
     job_id:platform+n,job_title:'Data Analyst',employer_name:'Synthetic '+platform+' '+n,job_country:'MY',job_location:'Kuala Lumpur, Malaysia',
     job_description:'Local test only. SQL and Python.',job_apply_link:platform==='linkedin'?'https://www.linkedin.com/jobs/view/'+(100+n):'https://malaysia.indeed.com/viewjob?jk=abc'+n,
    }))}}));
   },
   publicOptions:{rawDirectory,browserReadImpl:async(url,platform,budget)=>{
    if(platform!=='ricebowl')throw new Error('Unexpected test platform');
    await budget.take();browserRequests++;await delay(30);
    if(url.includes('/jobsearch/')){
     const n=searches++;
     return `<mkrb-job-card job-id="ABC${n}" job-title="Data Analyst" company="Synthetic Ricebowl ${n}" locations='[{"label":"Selangor"}]' href="https://www.ricebowl.my/job/ABC${n}-data-analyst"></mkrb-job-card>`;
    }
    const n=Number(url.match(/\/job\/ABC(\d+)/)?.[1]);
    return '<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',identifier:{value:'ABC'+n},title:'Data Analyst',hiringOrganization:{name:'Synthetic Ricebowl '+n},jobLocation:{address:{addressCountry:'MY',addressRegion:'Selangor'}},description:'Local test only. SQL and Python.',url:'https://www.ricebowl.my/job/ABC'+n+'-data-analyst'})+'</script>';
   }},
  });
  if(!result.report.publishable||store.records(id).length!==12)throw new Error('Benchmark sample incomplete');
  const records=store.records(id).map(({title,company,country,role,description,url})=>({title,company,country,role,description,url})).sort((a,b)=>a.company.localeCompare(b.company));
  return {name,durationMs:Math.round(performance.now()-start),requests:result.report.requests,apiRequests,browserRequests,postings:records.length,records};
 }finally{store.close();}
}

const serial=await measure('serial, 2500 ms pacing',{maxSourceConcurrency:1,requestIntervalMs:2500,jsearchRequestIntervalMs:2500});
const parallel=await measure('parallel, 1000 ms browser / 2500 ms API pacing',{});
if(JSON.stringify(serial.records)!==JSON.stringify(parallel.records))throw new Error('Optimized sample differs');
const {records:_serial,...before}=serial,{records:_parallel,...after}=parallel;
const report={synthetic:true,networkUsed:false,published:false,before,after,sameSample:true,lessElapsedPct:Math.round((1-after.durationMs/before.durationMs)*100)};
const output=new URL('../../verification/crawler-integration/speed-benchmark.json',import.meta.url);
mkdirSync(new URL('.',output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
