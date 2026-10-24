import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {allCareers,SKILLS} from '../../game/server/careers.js';
import {SKILL_PATTERNS} from '../../game/n8n/market/pipeline.js';
import {jsearchSettings} from './provider-env.js';

const TITLES={
 'data-analyst':'\\b(data|business intelligence|bi|reporting|insights?) analysts?\\b',
 'frontend-developer':'\\bfront[ -]?end\\b|\\breact (developer|engineer)\\b',
 'backend-developer':'\\bback[ -]?end\\b|\\b(java|node\\.?js|python|api|server[ -]side) (developer|engineer)\\b',
 'ui-ux-designer':'\\b(ui|ux|user experience|user interface|product|interaction) designer\\b|\\bui[ /-]+ux\\b',
 'ml-engineer':'\\b(machine learning|mlops|ml|ai|artificial intelligence|deep learning|llm) (engineer|developer|specialist)\\b',
 'product-manager':'\\bproduct (manager|owner|lead)\\b',
 'forward-deployed-engineer':'\\bforward[ -]+deploy(?:ed|ment)[ -]+(?:(?:software|ai|genai)[ -]+)?engineer(?:ing)?\\b',
 'data-scientist':'\\b(data|applied) scientist\\b',
 'auditor':'\\bauditor\\b|\\baudit (associate|executive|manager|senior)\\b',
 'lawyer':'\\b(lawyer|legal counsel|legal associate|advocate|solicitor)\\b',
 'teacher':'\\b(teacher|lecturer|educator)\\b',
 'doctor':'\\b(medical officer|medical doctor|physician|general practitioner)\\b',
 'chef':'\\bchef\\b',
 'civil-engineer':'\\b(civil|structural) engineer\\b',
};
const QUERY={
 'ml-engineer':'machine learning engineer', 'forward-deployed-engineer':'forward deployed engineer',
 'ui-ux-designer':'UI UX designer','doctor':'medical officer',
};
export function gameConfig({jsearch=false,apiProvider='rapidapi'}={}){
 return {
  pipelineVersion:4,platformRestricted:true,allowedPlatforms:['linkedin','indeed','ricebowl'],jsearchProvider:jsearch?apiProvider:null,timezone:'Asia/Kuala_Lumpur',country:'MY',datePosted:'month',
  maxPagesPerQuery:1,maxRequestsPerRun:150,requestIntervalMs:2500,maxRunMs:600000,maxRecordsPerRun:1000,maxDetailsPerSource:28,
  roles:allCareers().filter(c=>!c.custom).map(c=>{
   if(!TITLES[c.id])throw new Error('Missing reviewed title rule for '+c.id);
   return {id:c.id,name:c.name.en,titlePatterns:[TITLES[c.id]],queries:[(QUERY[c.id]||c.name.en)+' jobs in Malaysia']};
  }),
  skills:Object.entries(SKILLS).map(([id,name])=>({id,name:name.en,aliases:[name.en],...(SKILL_PATTERNS[id]?{pattern:SKILL_PATTERNS[id].source,patternFlags:SKILL_PATTERNS[id].flags}:{})})),
  sources:['linkedin','indeed','ricebowl'].map(id=>({id,type:'public',transport:jsearch&&id!=='ricebowl'?'jsearch':id==='linkedin'?'http':'browser',enabled:true,optional:true})),
 };
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const settings=jsearchSettings({readGame:true});
 const config=gameConfig({jsearch:Boolean(settings.key),apiProvider:settings.provider});
 writeFileSync(new URL('../config/game.market.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
 console.log('Synced '+config.roles.length+' careers and '+config.skills.length+' game skill IDs. JSearch '+(settings.key?'enabled':'not configured')+'. No requests made.');
}
