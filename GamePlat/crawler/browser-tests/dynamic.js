import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {collectBrowser} from '../src/sources/browser.js';
import {Budget} from '../src/http.js';
import {loadConfig} from '../src/config.js';
async function run(html,source,check){
 const server=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(req.url.startsWith('/job/')?'<div id="description">DEMO ONLY. React and TypeScript required.</div>':html);});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 const config={...loadConfig(),requestIntervalMs:100,maxRequestsPerRun:20,maxRunMs:30000},rows=[],tasks=[];
 try{await collectBrowser({source:{id:'browser-fixture',validated:true,allowOrigins:[origin],startUrls:[origin],readySelector:'#ready',itemSelector:'article',idAttribute:'data-id',endSelector:'#end',timeoutMs:3000,...source},config,budget:new Budget(config),onRecord:r=>rows.push(r),onTask:t=>tasks.push(t)});assert.equal(tasks[0].status,'complete',JSON.stringify(tasks));assert.deepEqual(rows.map(r=>r.sourceId),['1','2','3']);check?.(rows);}
 finally{await new Promise(ok=>server.close(ok));}
}
test('delayed JS, load-more, virtual replacement and details',async()=>{
 const html='<!doctype html><div id="root"></div><script>let batch=1;function render(){document.querySelector("#root").innerHTML='+
 "'<div id=\"ready\"></div><article data-id=\"'+batch+'\"><h2>Frontend Developer '+batch+'</h2><span class=\"company\">Demo</span><a href=\"/job/'+batch+'\">Details</a></article>'+(batch<3?'<button id=\"more\">Load more</button>':'<div id=\"end\">End</div>');"+
 'const b=document.querySelector("#more");if(b)b.onclick=()=>setTimeout(()=>{batch++;render()},150);}setTimeout(render,150);</script>';
 await run(html,{fields:{title:{selector:'h2'},company:{selector:'.company'},country:{value:'MY'},url:{selector:'a',attribute:'href'}},detail:{readySelector:'#description',descriptionSelector:'#description'},pagination:{mode:'button',nextSelector:'#more',maxSteps:5}},rows=>assert.ok(rows.every(r=>r.description.includes('TypeScript'))));
});
test('inner container infinite scrolling retains replaced cards',async()=>{
 const html='<!doctype html><div id="ready"></div><div id="scroller" style="height:200px;overflow-y:auto"></div><div id="tail"></div><script>let batch=1;const s=document.querySelector("#scroller");function render(){s.innerHTML='+
 "'<article data-id=\"'+batch+'\" style=\"height:600px\"><h2>Data Analyst '+batch+'</h2></article>';"+
 's.scrollTop=0;if(batch===3){document.querySelector("#tail").innerHTML=\'<div id="end">End</div>\';s.onscroll=null;return;}s.onscroll=()=>{if(s.scrollTop===0)return;s.onscroll=null;setTimeout(()=>{batch++;render()},120);};}render();</script>';
 await run(html,{fields:{title:{selector:'h2'},company:{value:'DEMO'},country:{value:'MY'},description:{value:'SQL'}},pagination:{mode:'scroll',scrollContainerSelector:'#scroller',maxSteps:5}});
});
