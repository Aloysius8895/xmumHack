import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export class Store{
 constructor(path){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});this.db=new DatabaseSync(path);
  this.db.exec("PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;PRAGMA busy_timeout=5000;"+
  "CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,scope TEXT NOT NULL,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,lease_until TEXT,demo INTEGER NOT NULL DEFAULT 0,config_json TEXT NOT NULL,report_json TEXT);"+
  "CREATE UNIQUE INDEX IF NOT EXISTS one_active_run ON runs(status) WHERE status='running';"+
  "CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS job_fingerprint ON jobs(fingerprint);"+
  "CREATE TABLE IF NOT EXISTS job_sources(source TEXT NOT NULL,source_id TEXT NOT NULL,job_id TEXT NOT NULL REFERENCES jobs(id),url TEXT,PRIMARY KEY(source,source_id));CREATE INDEX IF NOT EXISTS source_url ON job_sources(url);"+
  "CREATE TABLE IF NOT EXISTS revisions(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),content_hash TEXT NOT NULL,seen_at TEXT NOT NULL,normalized_json TEXT NOT NULL,UNIQUE(job_id,content_hash));"+
  "CREATE TABLE IF NOT EXISTS observations(run_id TEXT NOT NULL REFERENCES runs(id),job_id TEXT NOT NULL REFERENCES jobs(id),revision_id TEXT NOT NULL REFERENCES revisions(id),PRIMARY KEY(run_id,job_id));"+
  "CREATE TABLE IF NOT EXISTS raw_records(run_id TEXT NOT NULL REFERENCES runs(id),source TEXT NOT NULL,source_id TEXT NOT NULL,fetched_at TEXT NOT NULL,raw_json TEXT NOT NULL,PRIMARY KEY(run_id,source,source_id));"+
  "CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),task_json TEXT NOT NULL);"+
  "CREATE TABLE IF NOT EXISTS deliveries(run_id TEXT PRIMARY KEY REFERENCES runs(id),publication_json TEXT NOT NULL);");
 }
 close(){this.db.close();}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const v=fn();this.db.exec('COMMIT');return v;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 beginRun(scope,config,demo=false,now=new Date().toISOString()){
  return this.transaction(()=>{
   this.db.prepare("UPDATE runs SET status='interrupted',finished_at=? WHERE status='running' AND lease_until<?").run(now,now);
   if(this.db.prepare("SELECT id FROM runs WHERE status='running'").get()){const e=new Error('A crawl is already running');e.code='BUSY';throw e;}
   const id=randomUUID();this.db.prepare('INSERT INTO runs(id,scope,started_at,status,lease_until,demo,config_json) VALUES(?,?,?,?,?,?,?)').run(id,scope,now,'running',new Date(Date.parse(now)+120000).toISOString(),Number(demo),JSON.stringify(config));return id;
  });
 }
 heartbeat(id){const r=this.db.prepare("UPDATE runs SET lease_until=? WHERE id=? AND status='running'").run(new Date(Date.now()+120000).toISOString(),id);if(r.changes!==1)throw new Error('Run lease lost');}
 finishRun(id,status,report,now=new Date().toISOString()){this.db.prepare("UPDATE runs SET status=?,finished_at=?,report_json=?,lease_until=NULL WHERE id=? AND status='running'").run(status,now,JSON.stringify(report),id);}
 restrictRun(id,config,scope){this.db.prepare("UPDATE runs SET config_json=?,scope=? WHERE id=? AND status='running'").run(JSON.stringify(config),scope,id);}
 addTask(id,t){this.db.prepare('INSERT INTO tasks(run_id,task_json) VALUES(?,?)').run(id,JSON.stringify(t));}
 ingest(runId,r,now=new Date().toISOString()){
  return this.transaction(()=>{
   if(!this.db.prepare("SELECT id FROM runs WHERE id=? AND status='running' AND lease_until>=?").get(runId,now))throw new Error('Inactive or expired run');
   this.db.prepare('INSERT OR REPLACE INTO raw_records VALUES(?,?,?,?,?)').run(runId,r.source,r.sourceId,now,JSON.stringify(r.raw));
   let job=this.db.prepare('SELECT job_id AS id FROM job_sources WHERE source=? AND source_id=?').get(r.source,r.sourceId);
   if(!job&&r.url){const candidates=this.db.prepare('SELECT DISTINCT s.job_id AS id,v.normalized_json FROM job_sources s JOIN revisions v ON v.job_id=s.job_id WHERE s.url=?').all(r.url);
    const match=candidates.find(c=>{const v=JSON.parse(c.normalized_json);return ['title','company','location','description'].every(k=>v[k].toLowerCase()===r[k].toLowerCase());});if(match)job={id:match.id};}
   if(!job&&r.description)job=this.db.prepare('SELECT id FROM jobs WHERE fingerprint=? LIMIT 1').get(r.fingerprint);
   const created=!job,id=job?.id||randomUUID();
   if(created)this.db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(id,r.fingerprint,now,now);else this.db.prepare('UPDATE jobs SET last_seen_at=?,fingerprint=? WHERE id=?').run(now,r.fingerprint,id);
   this.db.prepare('INSERT INTO job_sources VALUES(?,?,?,?) ON CONFLICT(source,source_id) DO UPDATE SET url=excluded.url').run(r.source,r.sourceId,id,r.url);
   const {raw,source,sourceId,contentHash,fingerprint,...body}=r;
   let revision=this.db.prepare('SELECT id FROM revisions WHERE job_id=? AND content_hash=?').get(id,contentHash);const changed=!revision;
   if(!revision){revision={id:randomUUID()};this.db.prepare('INSERT INTO revisions VALUES(?,?,?,?,?)').run(revision.id,id,contentHash,now,JSON.stringify(body));}
   this.db.prepare('INSERT INTO observations VALUES(?,?,?) ON CONFLICT(run_id,job_id) DO UPDATE SET revision_id=excluded.revision_id').run(runId,id,revision.id);
   return {id,created,changed};
  });
 }
 run(id){const r=this.db.prepare('SELECT * FROM runs WHERE id=?').get(id);return r?decode(r):null;}
 latestRun(){const r=this.db.prepare('SELECT * FROM runs ORDER BY started_at DESC,rowid DESC LIMIT 1').get();return r?decode(r):null;}
 runs(scope){return this.db.prepare('SELECT * FROM runs WHERE scope=? ORDER BY started_at').all(scope).map(decode);}
 records(id){return this.db.prepare('SELECT j.id,j.first_seen_at,(SELECT MAX(raw.fetched_at) FROM raw_records raw JOIN job_sources s ON s.source=raw.source AND s.source_id=raw.source_id WHERE raw.run_id=o.run_id AND s.job_id=j.id) AS observed_at,r.normalized_json FROM observations o JOIN jobs j ON j.id=o.job_id JOIN revisions r ON r.id=o.revision_id WHERE o.run_id=? ORDER BY j.id').all(id).map(r=>({id:r.id,firstSeenAt:r.first_seen_at,lastSeenAt:r.observed_at,...JSON.parse(r.normalized_json)}));}
 sourcesAtRun(id,runId){return this.db.prepare('SELECT raw.source,raw.source_id AS sourceId,raw.raw_json FROM raw_records raw JOIN job_sources s ON s.source=raw.source AND s.source_id=raw.source_id WHERE s.job_id=? AND raw.run_id=? ORDER BY raw.source,raw.source_id').all(id,runId).map(r=>({source:r.source,sourceId:r.sourceId,url:JSON.parse(r.raw_json).url??null}));}
 sources(id){return this.db.prepare('SELECT source,source_id AS sourceId,url FROM job_sources WHERE job_id=?').all(id);}
 tasks(id){return this.db.prepare('SELECT task_json FROM tasks WHERE run_id=? ORDER BY id').all(id).map(r=>JSON.parse(r.task_json));}
 setDelivery(id,value){this.db.prepare('INSERT INTO deliveries VALUES(?,?) ON CONFLICT(run_id) DO UPDATE SET publication_json=excluded.publication_json').run(id,JSON.stringify(value));}
 delivery(id){const row=this.db.prepare('SELECT publication_json FROM deliveries WHERE run_id=?').get(id);return row?JSON.parse(row.publication_json):{status:'pending'};}
}
function decode(r){const {config_json,report_json,...rest}=r;return {...rest,config:JSON.parse(config_json),report:report_json?JSON.parse(report_json):null};}
