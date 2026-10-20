import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IDEAS_DIR, STATE_FILE } from './config.js';

// Everything the bot knows about a hackathon lives in ideas/<slug>/. These files are the resume point after a restart.
export const FILES = {
  trackCards: 'track-cards.md',
  ideas: 'ideas.md',
  remix: 'remix.md',
  discussion: 'discussion.md',
} as const;

export type Stage = 'awaiting-brief' | 'needs-ideas' | 'awaiting-pick' | 'discussing';

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export const hackathonDir = (slug: string) => path.join(IDEAS_DIR, slug);
export const hackathonFile = (slug: string, file: string) => path.join(hackathonDir(slug), file);

export function exists(slug: string): boolean {
  return existsSync(hackathonDir(slug));
}

export async function createHackathon(slug: string): Promise<void> {
  await mkdir(hackathonDir(slug), { recursive: true });
}

export function listHackathons(): string[] {
  if (!existsSync(IDEAS_DIR)) return [];
  return readdirSync(IDEAS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export function listFiles(slug: string): string[] {
  if (!exists(slug)) return [];
  return readdirSync(hackathonDir(slug)).filter((f) => f.endsWith('.md')).sort();
}

export function stageOf(slug: string): Stage {
  const has = (file: string) => existsSync(hackathonFile(slug, file));
  if (!has(FILES.trackCards)) return 'awaiting-brief';
  if (!has(FILES.ideas)) return 'needs-ideas';
  if (!has(FILES.remix)) return 'awaiting-pick';
  return 'discussing';
}

export function mtimeMs(slug: string, file: string): number {
  try {
    return statSync(hackathonFile(slug, file)).mtimeMs;
  } catch {
    return 0;
  }
}

/** First part of discussion.md, for the "back online" message. */
export function summaryPreview(slug: string, maxChars = 700): string {
  try {
    const text = readFileSync(hackathonFile(slug, FILES.discussion), 'utf8').trim();
    return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
  } catch {
    return '';
  }
}

export async function readActive(): Promise<string | null> {
  try {
    const { active } = JSON.parse(await readFile(STATE_FILE, 'utf8')) as { active?: string | null };
    return active && exists(active) ? active : null;
  } catch {
    return null;
  }
}

export async function writeActive(slug: string | null): Promise<void> {
  await writeFile(STATE_FILE, `${JSON.stringify({ active: slug }, null, 2)}\n`);
}
