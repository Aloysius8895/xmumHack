import fs from 'node:fs';
const request=(id,name,method,url,position)=>({id,name,type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position,
 parameters:{method,url,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',...(method==='POST'?{sendBody:true,specifyBody:'json',jsonBody:'{}'}:{}),options:{timeout:10000}}});
export function buildWorkflow(){
 const nodes=[
  {id:'manual',name:'Manual Trigger',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},
  {id:'schedule',name:'Every Day 08:00 MYT',type:'n8n-nodes-base.scheduleTrigger',typeVersion:1.2,position:[0,180],parameters:{rule:{interval:[{field:'cronExpression',expression:'0 8 * * *'}]}}},
  request('start','Start crawl','POST','http://127.0.0.1:8788/api/crawl',[240,80]),
  {id:'wait',name:'Wait 10 seconds',type:'n8n-nodes-base.wait',typeVersion:1.1,position:[470,80],parameters:{amount:10,unit:'seconds'}},
  request('poll','Check collection and publication','GET',"={{ 'http://127.0.0.1:8788' + $('Start crawl').first().json.statusUrl }}",[700,80]),
  {id:'check',name:'Verify final publication',type:'n8n-nodes-base.code',typeVersion:2,position:[930,80],parameters:{jsCode:`const run=$input.first().json;
if($runIndex>=75)throw new Error('Crawler did not finish and publish within the polling budget');
const publishable=['complete','capped'].includes(run.status)||(run.status==='partial'&&run.report?.publishable===true);
const pending=run.status==='running'||(publishable&&['pending','publishing'].includes(run.publication?.status));
if(!pending&&(!publishable||run.publication?.status!=='published'))throw new Error('Collection/publication failed: '+run.status+' / '+(run.publication?.status||'missing'));
return [{json:{...run,pending}}];`}},
  {id:'pending',name:'Still working?',type:'n8n-nodes-base.if',typeVersion:2.2,position:[1160,80],parameters:{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:'is-pending',leftValue:'={{ $json.pending }}',rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'}}},
 ];
 const edge=node=>({node,type:'main',index:0});
 return {name:'CareerSphere - Crawl and publish verified sample',nodes,connections:{
  'Manual Trigger':{main:[[edge('Start crawl')]]},'Every Day 08:00 MYT':{main:[[edge('Start crawl')]]},
  'Start crawl':{main:[[edge('Wait 10 seconds')]]},'Wait 10 seconds':{main:[[edge('Check collection and publication')]]},
  'Check collection and publication':{main:[[edge('Verify final publication')]]},'Verify final publication':{main:[[edge('Still working?')]]},
  'Still working?':{main:[[edge('Wait 10 seconds')],[]]},
 },settings:{timezone:'Asia/Kuala_Lumpur',executionOrder:'v1'},active:false,pinData:{}};
}
fs.writeFileSync(new URL('./daily-crawl.json',import.meta.url),JSON.stringify(buildWorkflow(),null,2)+'\n');
