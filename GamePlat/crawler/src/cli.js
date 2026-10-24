import {resolve,join} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadConfig} from './config.js';
import {Store} from './store.js';
import {startRun,executeRun} from './runner.js';
import {summarize} from './analytics.js';
import {makeServer} from './server.js';
import {exportRun,publishRun,autoPublish} from './publication.js';
const [command='help',...args]=process.argv.slice(2),demo=command==='demo'||args.includes('--demo'),config=loadConfig();
if(demo)config.sources=[{id:'demo-fixture',type:'fixture',enabled:true,path:'fixtures/jobs.json'}];
const store=new Store(demo?'data/demo.sqlite':process.env.DB_PATH||'data/market.sqlite');let serving=false;
try{
 if(command==='crawl'||command==='demo'||command==='sync'){
  const id=startRun(store,config,demo),r=await executeRun(store,config,id,{demo});
  console.log(JSON.stringify({runId:id,status:r.status,report:r.report,summary:summarize(store)},null,2));
  if(!['complete','capped'].includes(r.status)&&!(r.status==='partial'&&r.report?.publishable))process.exitCode=1;
  else if(command==='sync')await publishRun(store,id);
 }else if(command==='summary')console.log(JSON.stringify(summarize(store),null,2));
 else if(command==='export'||command==='push'){
  const requested=args.indexOf('--run-id'),r=requested>=0?store.run(args[requested+1]):store.latestRun();if(!r)throw new Error('No data; run crawl or demo first');
  const payload=exportRun(store,r.id);
  if(command==='export'){await mkdir('exports',{recursive:true});const path=resolve(join('exports','market-'+r.id+'.json'));await writeFile(path,JSON.stringify(payload,null,2));console.log(path);}
  else{
   await publishRun(store,r.id);console.log(JSON.stringify({pushed:true,runId:r.id}));
  }
 }else if(command==='serve'){
  const port=Number(process.env.PORT||8787);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
  const server=makeServer(store,config,{afterRun:id=>autoPublish(store,id)});await new Promise((ok,no)=>{server.once('error',no);server.listen(port,process.env.HOST||'127.0.0.1',ok);});serving=true;
  console.log('Crawler listening on '+(process.env.HOST||'127.0.0.1')+':'+port);
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>{store.close();process.exit(0);});setTimeout(()=>process.exit(0),5000).unref();});
 }else console.log('Commands: demo | crawl | sync | serve | summary [--demo] | export [--demo] | push');
}catch(e){console.error('Crawler error: '+e.message);process.exitCode=1;}finally{if(!serving)store.close();}
