// Diagnostic for the user's requested browser-backed sources. No stealth or challenge interaction.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const directory=new URL('../data/browser-diagnostics/',import.meta.url);
await mkdir(directory,{recursive:true});
const context=await chromium.launchPersistentContext(fileURLToPath(new URL('../data/browser-profile/',import.meta.url)),{channel:'chrome',headless:process.argv.includes('--headless')});
const results=[];
try{
 const search=process.argv.includes('--search'),form=process.argv.includes('--form'),detail=process.argv.includes('--detail');
 for(const [platform,url] of [['indeed',search&&!form?'https://malaysia.indeed.com/jobs?q=data+analyst&l=Malaysia&sort=date&fromage=30':'https://malaysia.indeed.com/'],['ricebowl',search&&!form?'https://www.ricebowl.my/jobsearch/data-analyst-jobs-in-malaysia':'https://www.ricebowl.my/']]){
  if(detail&&platform!=='ricebowl')continue;
  const page=await context.newPage();
  try{
   let response=await page.goto(detail?'https://www.ricebowl.my/job/U77B9i4HNQ-data-analyst-logistics-warehouse':url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('body').waitFor({state:'visible',timeout:15000});
   if(form){
    let navigation=null;page.on('response',r=>{if(r.request().isNavigationRequest()&&r.frame()===page.mainFrame())navigation=r;});
    if(platform==='indeed'){
     await page.locator('input[name="q"]').fill('data analyst');await page.locator('input[name="l"]').fill('Malaysia');
     await Promise.all([page.waitForURL(/\/jobs\?/, {timeout:30000}),page.getByRole('button',{name:'Find jobs',exact:true}).click()]);
    }else{
     await page.locator('input[placeholder="Job Title, Company, Skill"]:visible').first().fill('data analyst');
     await Promise.all([page.waitForURL(/jobsearch/, {timeout:30000}),page.locator('button[aria-label="Search"]:visible').first().click()]);
    }
    if(navigation)response=navigation;
   }
   if(search)await page.waitForFunction(()=>document.querySelector('a[href*="viewjob"],a[href*="/job/"]')||/no jobs|no results|just a moment|blocked|verify (you|that)/i.test(document.body.innerText),undefined,{timeout:15000}).catch(()=>{});
   const text=await page.locator('body').innerText(),title=await page.title();
   const challenge=/verify (you|that you)|verifying|additional verification|checking (your|the)|just a moment|are you (a )?human|security check|captcha/i.test(title+' '+text.slice(0,3000));
   const result={platform,url:page.url(),status:response?.status(),title,challenge,
    jobLinks:await page.locator('a[href]').evaluateAll(links=>links.map(a=>({text:(a.textContent||'').trim().slice(0,80),href:a.href})).filter(a=>/\/job\/\d|viewjob/.test(a.href)).slice(0,16)),
    jsonLdScripts:await page.locator('script[type="application/ld+json"]').count(),
    nextData:await page.locator('#__NEXT_DATA__').count(),
   };
   await writeFile(new URL(platform+(detail?'-detail':search?'-search':'')+'.html',directory),await page.content());
   await page.screenshot({path:fileURLToPath(new URL(platform+'.png',directory))});
   results.push(result);console.log(JSON.stringify(result));
  }catch(e){results.push({platform,error:e.message});console.log(JSON.stringify(results.at(-1)));}
 }
 await writeFile(new URL('results.json',directory),JSON.stringify(results,null,2));
 if(process.argv.includes('--keep-open')){
  console.log('Browser stays open for manual inspection. No CAPTCHA or login is automated. Close the browser to finish.');
  await new Promise(resolve=>context.once('close',resolve));
 }
}finally{await context.close().catch(()=>{});}
