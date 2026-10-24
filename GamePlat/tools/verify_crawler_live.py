"""One user-authorized real refresh; no credentials printed and no synthetic data."""
import json
import time
import urllib.request
from pathlib import Path

base='http://127.0.0.1:5000'
def request(path,body=None):
    req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'} if body is not None else {})
    with urllib.request.urlopen(req,timeout=20) as response:return json.load(response)
out=Path(__file__).resolve().parents[1]/'verification/crawler-integration'
out.mkdir(parents=True,exist_ok=True)
before=request('/api/state')['state']['trends']
run=request('/api/market/sample/refresh',{})
print(json.dumps({'started':run},ensure_ascii=False),flush=True)
last=None
for attempt in range(220):
    status=request('/api/market/sample/'+run['runId'])
    if status['status']!=last:
        print(json.dumps(status,ensure_ascii=False),flush=True)
        last=status['status']
    if status['status'] in ('published','failed'):break
    time.sleep(3)
else:raise RuntimeError('Live refresh exceeded verification budget')
after=request('/api/state')['state']['trends']
report={'real_network':True,'result':status,'beforePostings':before.get('postings'),'afterPostings':after.get('postings'),
        'previous_retained_on_failure':status['status']!='failed' or before['careers']==after['careers'],
        'new_snapshot_matches_run':after.get('crawler',{}).get('runId')==run['runId'],
        'source':after.get('source'),'isDemo':after.get('demo'),'scopeSources':after.get('crawler',{}).get('source')}
(out/'live-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)
assert report['previous_retained_on_failure']
if status['status']=='published':assert report['new_snapshot_matches_run'] and report['isDemo'] is False
