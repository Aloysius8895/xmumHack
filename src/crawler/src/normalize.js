import {digest} from './config.js';
export const clean=x=>String(x??'').replace(/\s+/g,' ').trim();
const fold=x=>clean(x).toLowerCase();
const escape=x=>x.replace(/[.*+?^{}$()|[\]\\]/g,'\\$&');
export function canonicalUrl(value){try{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_.+|gclid|fbclid)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return null;}}
export function extractSkills(description,dictionary){
 const found=[];
 for(const skill of dictionary){
  const regex=skill.pattern?new RegExp(skill.pattern,skill.patternFlags||'i'):new RegExp('(?<![\\p{L}\\p{N}_])(?:'+skill.aliases.map(escape).join('|')+')(?![\\p{L}\\p{N}_+#])','iu');
  const match=regex.exec(description);if(!match)continue;
  found.push({id:skill.id,name:skill.name,evidence:description.slice(Math.max(0,match.index-50),match.index+match[0].length+80),requirement:'mentioned',method:'dictionary'});
 }return found;
}
export function normalize(raw,source,config){
 const title=clean(raw.title),company=clean(raw.company),location=clean(raw.location),country=clean(raw.country).toUpperCase();
 if(!title||!company)return {rejection:'missing_title_or_company'};
 if(!['MY','MYS','MALAYSIA'].includes(country))return {rejection:country?'outside_malaysia':'unknown_country'};
 const description=clean(raw.description),url=canonicalUrl(raw.url),sourceId=clean(raw.sourceId)||digest([title,company,location,url]);
 let matches=config.roles.filter(r=>r.titlePatterns.some(p=>new RegExp(p,'i').test(title)));
 // An explicit FDE title is more specific than a generic AI/Python engineer match.
 if(matches.some(r=>r.id==='forward-deployed-engineer'))matches=matches.filter(r=>r.id==='forward-deployed-engineer');
 const parsed=/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(raw.postedAt||''))?Date.parse(raw.postedAt):NaN;
 const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(String(raw.postedAt||''));
 const body={title,company,location,country:'MY',description,url,role:matches.length===1?matches[0].id:'unmapped',roleCandidates:matches.map(r=>r.id),postedAt:Number.isFinite(parsed)&&!dateOnly?new Date(parsed).toISOString():null,postedDate:Number.isFinite(parsed)?(dateOnly?raw.postedAt:new Date(parsed+8*3600000).toISOString().slice(0,10)):null,employmentType:clean(raw.employmentType)||null,remote:typeof raw.remote==='boolean'?raw.remote:null,salary:raw.salary&&typeof raw.salary==='object'?raw.salary:null,descriptionAvailable:Boolean(description),skills:extractSkills(description,config.skills)};
 return {...body,source,sourceId,contentHash:digest(body),fingerprint:digest([fold(company),fold(title),fold(location),fold(description)]),raw};
}
