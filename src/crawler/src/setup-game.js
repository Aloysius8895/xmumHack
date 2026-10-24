import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {gameConfig} from './game-config.js';
import {jsearchSettings} from './provider-env.js';

const gameFile=new URL('../../game/.env',import.meta.url),crawlerFile=new URL('../.env',import.meta.url);
const read=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
let gameText=read(gameFile),crawlerText=read(crawlerFile);
const game=parseEnv(gameText),crawler=parseEnv(crawlerText);
const set=(text,key,value)=>{
 const row=key+'='+JSON.stringify(value),regex=new RegExp('^'+key+'=.*$','m');
 return regex.test(text)?text.replace(regex,row):text.replace(/\s*$/,'')+'\n'+row+'\n';
};
const tokenReused=Boolean(game.INTEGRATION_TOKEN);
let integration=game.INTEGRATION_TOKEN;
if(!integration){integration=randomBytes(32).toString('hex');gameText=set(gameText,'INTEGRATION_TOKEN',integration);fs.writeFileSync(gameFile,gameText);}
const defaults={JSEARCH_PROVIDER:'rapidapi',CRAWLER_TOKEN:randomBytes(32).toString('hex'),HOST:'127.0.0.1',PORT:'8788',
 DB_PATH:'data/market.sqlite',BACKEND_INGEST_URL:'http://127.0.0.1:5000/api/integrations/crawler',BACKEND_INGEST_TOKEN:integration};
for(const [key,value]of Object.entries(defaults))if(!crawler[key]){crawlerText=set(crawlerText,key,value);crawler[key]=value;}
fs.writeFileSync(crawlerFile,crawlerText);
if(!game.MARKET_CRAWLER_URL)gameText=set(gameText,'MARKET_CRAWLER_URL','http://127.0.0.1:'+crawler.PORT);
if(!game.MARKET_CRAWLER_TOKEN)gameText=set(gameText,'MARKET_CRAWLER_TOKEN',crawler.CRAWLER_TOKEN);
fs.writeFileSync(gameFile,gameText);
const providerSettings=jsearchSettings({readGame:true});
const config=gameConfig({jsearch:Boolean(providerSettings.key),apiProvider:providerSettings.provider});fs.writeFileSync(new URL('../config/game.market.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({configured:true,careers:config.roles.length,skills:config.skills.length,platforms:['linkedin','indeed','ricebowl'],jsearchEnabled:Boolean(providerSettings.key),
 server:'127.0.0.1:'+crawler.PORT,gameTokenReused:tokenReused,credentialsPrinted:false,
 next:'Run npm run crawler:serve from src/game, then use Refresh in Trends.'},null,2));
