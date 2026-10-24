import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export function loadConfig(path=process.env.CONFIG_PATH||'config/market.json'){
 const c=JSON.parse(readFileSync(path,'utf8'));
 for(const k of ['roles','skills','sources'])if(!Array.isArray(c[k]))throw new Error('Expected config array: '+k);
 for(const [k,min,max] of [['maxPagesPerQuery',1,20],['maxRequestsPerRun',1,10000],['requestIntervalMs',100,60000],['maxRunMs',1000,3600000],['maxRecordsPerRun',1,100000]])
  if(!Number.isInteger(c[k])||c[k]<min||c[k]>max)throw new Error('Invalid config: '+k);
 if(c.timezone!=='Asia/Kuala_Lumpur'||c.country!=='MY')throw new Error('This version targets MY with Asia/Kuala_Lumpur calendar windows');
 if(!['all','today','3days','week','month'].includes(c.datePosted))throw new Error('Invalid datePosted');
 for(const r of c.roles){if(!r.id||!r.name||!r.queries?.length||!r.titlePatterns?.length)throw new Error('Role needs id, name, queries, titlePatterns');r.titlePatterns.forEach(p=>new RegExp(p,'i'));}
 for(const k of ['roles','skills','sources'])if(new Set(c[k].map(x=>x.id)).size!==c[k].length)throw new Error('Duplicate IDs: '+k);
 for(const s of c.sources)if(!['jsearch','browser','fixture','public'].includes(s.type))throw new Error('Unknown source type');
 for(const s of c.sources)if(s.type==='public'&&s.transport&&!['http','browser','jsearch'].includes(s.transport))throw new Error('Unknown public transport');
 if(c.platformRestricted&&c.sources.some(s=>s.enabled&&(s.type!=='public'||!['linkedin','indeed','ricebowl'].includes(s.id))))throw new Error('Game collection allows only LinkedIn, Indeed and Ricebowl public sources');
 for(const s of c.skills){if(!s.id||!s.name||!s.aliases?.length||s.aliases.some(a=>typeof a!=='string'||!a.trim()))throw new Error('Invalid skills dictionary');if(s.pattern)new RegExp(s.pattern,s.patternFlags||'i');}
 return c;
}
export const scopeHash=c=>digest({config:c,provider:c.platformRestricted?(c.jsearchProvider||'direct-public'):process.env.JSEARCH_PROVIDER||'rapidapi',pipelineVersion:c.pipelineVersion||2});
