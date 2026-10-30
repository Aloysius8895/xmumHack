import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
// The daily collection goes through the game server: it hands the crawler the watermark and the known listings, so
// the run is incremental, and it is never held by the players' Refresh cooldown. Header auth = Bearer INTEGRATION_TOKEN.
export const DEFAULT_GAME_URL='https://xmum-hackfinal.replit.app';
const request=(id,name,method,url,position)=>({id,name,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position,
 parameters:{method,url,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',...(method==='POST'?{sendBody:true,specifyBody:'json',jsonBody:'{}'}:{}),options:{timeout:15000}}});
export function buildWorkflow(gameUrl=process.env.GAME_BASE_URL||DEFAULT_GAME_URL){
 const base=gameUrl.replace(/\/+$/,'');
 const nodes=[
  {id:'manual',name:'Manual Trigger',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},
  {id:'schedule',name:'Every Day 08:00 MYT',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,180],parameters:{rule:{interval:[{field:'cronExpression',expression:'0 8 * * *'}]}}},
  request('start','Start scheduled collection','POST',base+'/api/integrations/crawl/schedule',[240,80]),
  {id:'wait',name:'Wait 10 seconds',type:'n8n-nodes-base.wait',typeVersion:1.1,position:[470,80],parameters:{amount:10,unit:'seconds'}},
  request('poll','Check collection and publication','GET',"={{ '"+base+"/api/integrations/crawl/schedule/' + $('Start scheduled collection').first().json.runId }}",[700,80]),
  {id:'check',name:'Verify final publication',type:'n8n-nodes-base.code',typeVersion:2,position:[930,80],parameters:{jsCode:`const run=$input.first().json;
if($runIndex>=75)throw new Error('Collection did not finish and publish within the polling budget');
if(run.status==='failed')throw new Error('Collection/publication failed: '+(run.error||'unknown'));
return [{json:{...run,pending:run.status!=='published'}}];`}},
  {id:'pending',name:'Still working?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[1160,80],parameters:{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:'is-pending',leftValue:'={{ $json.pending }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'}}},
 ];
 const edge=node=>({node,type:'main',index:0});
 return {name:'CareerSphere - Daily incremental collection through the game',nodes,connections:{
  'Manual Trigger':{main:[[edge('Start scheduled collection')]]},'Every Day 08:00 MYT':{main:[[edge('Start scheduled collection')]]},
  'Start scheduled collection':{main:[[edge('Wait 10 seconds')]]},'Wait 10 seconds':{main:[[edge('Check collection and publication')]]},
  'Check collection and publication':{main:[[edge('Verify final publication')]]},'Verify final publication':{main:[[edge('Still working?')]]},
  'Still working?':{main:[[edge('Wait 10 seconds')],[]]},
 },settings:{timezone:'Asia/Kuala_Lumpur',executionOrder:'v1'},active:false,pinData:{}};
}
if(process.argv[1]===fileURLToPath(import.meta.url))fs.writeFileSync(new URL('./daily-crawl.json',import.meta.url),JSON.stringify(buildWorkflow(),null,2)+'\n');
