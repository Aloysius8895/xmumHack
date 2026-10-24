// All paths are anchored to this project, including when invoked by npm --prefix.
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.js';
process.env.JSEARCH_GAME_ENV='1';
process.env.CONFIG_PATH=process.env.GAME_CRAWLER_CONFIG_PATH||fileURLToPath(new URL('../config/game.market.json',import.meta.url));
process.env.DB_PATH=process.env.DB_PATH||fileURLToPath(new URL('../data/market.sqlite',import.meta.url));
if(!loadConfig(process.env.CONFIG_PATH).platformRestricted)throw new Error('Game crawler requires the LinkedIn/Indeed/Ricebowl restricted profile');
await import('./cli.js');
