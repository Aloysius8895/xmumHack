import {fetchJson} from './http.js';
if(!process.env.CRAWLER_TOKEN)throw new Error('Run setup:game first');
const path=process.argv.includes('--status')?'/api/browser/status':'/api/browser/open';
const result=await fetchJson('http://127.0.0.1:'+(process.env.PORT||8788)+path,{method:process.argv.includes('--status')?'GET':'POST',headers:{authorization:'Bearer '+process.env.CRAWLER_TOKEN},attempts:1});
console.log(JSON.stringify(result,null,2));
if(!process.argv.includes('--status'))console.log('The dedicated collection browser is open. Complete any login or verification manually, then use Refresh. No verification is automated.');
