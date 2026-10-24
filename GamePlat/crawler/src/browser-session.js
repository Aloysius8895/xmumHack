import {fileURLToPath} from 'node:url';
let contextPromise=null;
const pages=new Map();
const homes={indeed:'https://malaysia.indeed.com/',ricebowl:'https://www.ricebowl.my/'};
const allowed=(url,id)=>{try{const u=new URL(url),host=id==='ricebowl'?'ricebowl.my':'indeed.com';return u.protocol==='https:'&&(u.hostname===host||u.hostname.endsWith('.'+host));}catch{return false;}};
const challenge=text=>/just a moment|additional verification|verify (you|that)|are you (a )?human|access denied|blocked -|security check|captcha/i.test(text);
async function context(){
 if(!contextPromise)contextPromise=(async()=>{
  const {chromium}=await import('playwright');
  const browser=await chromium.launchPersistentContext(fileURLToPath(new URL('../data/browser-profile/',import.meta.url)),{headless:process.env.CRAWLER_BROWSER_HEADLESS==='1',...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{channel:'chrome'})});
  browser.once('close',()=>{contextPromise=null;pages.clear();});return browser;
 })().catch(e=>{contextPromise=null;throw e;});
 return contextPromise;
}
async function pageFor(id){if(!homes[id])throw new Error('Unsupported browser source');const browser=await context();let page=pages.get(id);if(!page||page.isClosed()){page=await browser.newPage();pages.set(id,page);}return page;}
export async function browserStatus(){
 const result=[];
 for(const [id,page]of pages){
  if(page.isClosed())continue;
  const url=page.url();if(!allowed(url,id)){result.push({id,status:'outside-source'});continue;}
  const title=await page.title();const text=(await page.locator('body').innerText().catch(()=>'' )).slice(0,2000);
  result.push({id,url,title,verificationRequired:challenge(title+' '+text),jobLinks:await page.locator('a[href*="viewjob"], a[href*="/job/"]').count()});
 }
 return {open:Boolean(contextPromise),platforms:result};
}
export async function openBrowserSession(){
 for(const [id,url]of Object.entries(homes)){const page=await pageFor(id);if(page.url()==='about:blank')await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});}
 return browserStatus();
}
export async function readBrowserPage(url,id,budget){
 if(!allowed(url,id))throw new Error('Browser URL outside source');
 const page=await pageFor(id);
 if(page.url()!=='about:blank'&&challenge(await page.title()))throw new Error('Browser verification is pending; manual access is required');
 await budget.take();
 let response;
 try{response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:Math.min(45000,Math.max(1000,budget.until-Date.now()))});}
 catch{throw new Error('Browser navigation failed');}
 if(!allowed(page.url(),id))throw new Error('Browser redirected outside source');
 const title=await page.title();const text=(await page.locator('body').innerText()).slice(0,2000);
 if(!response?.ok()||challenge(title+' '+text))throw new Error(`Browser verification or access required (HTTP ${response?.status()??'unknown'})`);
 await page.waitForFunction(()=>document.querySelector('mkrb-job-card[job-id],#job-description .job-description-content,[data-jk],a[href*="viewjob"],a[href*="/job/"]')||[...document.querySelectorAll('script[type="application/ld+json"]')].some(script=>/"@type"\s*:\s*"JobPosting"/.test(script.textContent||''))||/no (jobs|results)|tiada jawatan/i.test(document.body.innerText),undefined,{timeout:10000}).catch(()=>{});
 return page.content();
}
