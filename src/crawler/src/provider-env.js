import fs from 'node:fs';
import {parseEnv} from 'node:util';

/** Read secrets only on the server; never return this object through an HTTP route. */
export function jsearchSettings({env=process.env,readGame=env.JSEARCH_GAME_ENV==='1'}={}){
 let game={};
 if(readGame)try{game=parseEnv(fs.readFileSync(new URL('../../game/.env',import.meta.url),'utf8'));}catch{}
 const provider=env.JSEARCH_PROVIDER||'rapidapi';
 const key=env.JSEARCH_API_KEY?.trim()||(provider==='rapidapi'?(env.RAPIDAPI_KEY?.trim()||game.RAPIDAPI_KEY?.trim()||game.JSEARCH_API_KEY?.trim()):game.JSEARCH_API_KEY?.trim());
 return {provider,key:key||null};
}
