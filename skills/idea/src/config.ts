import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const IDEAS_DIR = path.join(ROOT, 'ideas');
export const SKILLS_DIR = path.join(ROOT, '.claude', 'skills');
export const STATE_FILE = path.join(ROOT, '.bot-state.json');

export const THIRD_PARTY_SKILLS = ['brainstorm-diverge-converge', 'ideate', 'remix'];
export const REQUIRED_SKILLS = ['track-decoder', ...THIRD_PARTY_SKILLS];

// Built-in tools the agent gets. No Bash, web or Workflow tools: the agent only reads skills and writes ideas/<hackathon>/*.md.
export const AGENT_TOOLS = ['Skill', 'Read', 'Write', 'Edit', 'Glob'];

// Safety cap per Telegram turn; the turn stops with an error result if exceeded.
export const MAX_TURN_USD = 5;

export interface Config {
  botToken: string;
  userId: number;
  apiKey: string;
  model: string;
}

export function loadConfig(): Config {
  const envFile = path.join(ROOT, '.env');
  if (!existsSync(envFile)) {
    throw new Error(`Missing ${envFile}. Copy .env.example to .env and fill it in.`);
  }
  // Parse .env explicitly so its values win over anything already set in the shell.
  const env = parseEnv(readFileSync(envFile, 'utf8'));
  const get = (key: string) => env[key]?.trim() ?? '';

  const missing = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_USER_ID', 'ANTHROPIC_API_KEY'].filter((k) => !get(k));
  if (missing.length) throw new Error(`Missing in .env: ${missing.join(', ')}`);

  const userId = Number(get('TELEGRAM_USER_ID'));
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('TELEGRAM_USER_ID must be your numeric Telegram user ID (message @userinfobot to get it).');
  }

  return {
    botToken: get('TELEGRAM_BOT_TOKEN'),
    userId,
    apiKey: get('ANTHROPIC_API_KEY'),
    model: get('CLAUDE_MODEL') || 'claude-opus-5-5',
  };
}
