import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {allCareers,SKILLS} from '../../game/server/careers.js';
import {SKILL_PATTERNS} from '../../game/n8n/market/pipeline.js';
import {jsearchSettings} from './provider-env.js';

// Reviewed title rules and search words, shared with the reference imports in src/data/scripts
const RULES=JSON.parse(readFileSync(new URL('../config/career-titles.json',import.meta.url),'utf8'));
const TITLES=RULES.titles,QUERY=RULES.queries;
/** Cloud deployments have no browser: CRAWLER_BROWSER_SOURCES=0 turns the browser-transport platforms off. */
export const browserSourcesFromEnv=(env=process.env)=>env.CRAWLER_BROWSER_SOURCES!=='0';
export function gameConfig({jsearch=false,apiProvider='rapidapi',browserSources=true}={}){
 return {
  pipelineVersion:4,platformRestricted:true,allowedPlatforms:['linkedin','indeed','ricebowl'],jsearchProvider:jsearch?apiProvider:null,timezone:'Asia/Kuala_Lumpur',country:'MY',datePosted:'month',
  maxPagesPerQuery:1,maxRequestsPerRun:150,requestIntervalMs:1000,jsearchRequestIntervalMs:2500,maxSourceConcurrency:3,maxRunMs:600000,maxRecordsPerRun:1000,maxDetailsPerSource:28,
  roles:allCareers().filter(c=>!c.custom).map(c=>{
   if(!TITLES[c.id])throw new Error('Missing reviewed title rule for '+c.id);
   return {id:c.id,name:c.name.en,titlePatterns:[TITLES[c.id]],queries:[(QUERY[c.id]||c.name.en)+' jobs in Malaysia']};
  }),
  skills:Object.entries(SKILLS).map(([id,name])=>({id,name:name.en,aliases:[name.en],...(SKILL_PATTERNS[id]?{pattern:SKILL_PATTERNS[id].source,patternFlags:SKILL_PATTERNS[id].flags}:{})})),
  sources:['linkedin','indeed','ricebowl'].map(id=>{
   const transport=jsearch&&id!=='ricebowl'?'jsearch':id==='linkedin'?'http':'browser';
   return {id,type:'public',transport,enabled:browserSources||transport!=='browser',optional:true};
  }),
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const settings=jsearchSettings({readGame:true}),browserSources=browserSourcesFromEnv();
 const config=gameConfig({jsearch:Boolean(settings.key),apiProvider:settings.provider,browserSources});
 writeFileSync(new URL('../config/game.market.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
 console.log('Synced '+config.roles.length+' careers and '+config.skills.length+' game skill IDs. JSearch '+(settings.key?'enabled':'not configured')+'. Browser sources '+(browserSources?'on':'off')+'. No requests made.');
}
