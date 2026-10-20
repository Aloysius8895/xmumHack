import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_TOOLS, REQUIRED_SKILLS, SKILLS_DIR } from './config.js';

export interface SkillReport {
  installed: string[];
  missingRequired: string[];
  /** References inside installed SKILL.md files that don't resolve in this project. */
  unresolved: { skill: string; missing: string[] }[];
}

const SKILL_REFS = [
  /Skill\(\s*([\w:-]+)\s*\)/g, // Skill(tome:triz)
  /`([a-z0-9-]+:[a-z0-9-]+)`/g, // `tome:research`
  /\b(?:use|run|invoke)\s+the\s+`?([a-z0-9][\w-]*)`?\s+skill\b/gi, // use the foo skill
];
const PY_MODULE = /\bfrom\s+`([a-z_]\w*(?:\.\w+)+)`/g; // `select_methods(n)` from `tome.channels.ideation`
const TOOL_CALL = /\b([A-Z][A-Za-z]+)\(\{/g; // Workflow({ ... })
const FILE_REF = /(?:`|\]\()((?:[\w.-]+\/)+[\w.-]+\.\w+)(?:`|\))/g; // `resources/template.md`

const matches = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => m[1]);

export function checkSkills(): SkillReport {
  const installed = existsSync(SKILLS_DIR)
    ? readdirSync(SKILLS_DIR).filter((d) => existsSync(path.join(SKILLS_DIR, d, 'SKILL.md')))
    : [];
  const unresolved: SkillReport['unresolved'] = [];

  for (const skill of installed) {
    const dir = path.join(SKILLS_DIR, skill);
    const text = readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    const missing = new Set<string>();

    for (const ref of SKILL_REFS.flatMap((re) => matches(text, re))) {
      const bare = ref.split(':').pop()!;
      if (bare !== skill && !installed.includes(bare)) missing.add(`skill ${ref}`);
    }
    for (const mod of matches(text, PY_MODULE)) {
      const base = path.join(dir, ...mod.split('.'));
      if (!existsSync(`${base}.py`) && !existsSync(path.join(base, '__init__.py'))) missing.add(`Python module ${mod}`);
    }
    for (const tool of matches(text, TOOL_CALL)) {
      if (!AGENT_TOOLS.includes(tool)) missing.add(`${tool} tool (not enabled in this bot)`);
    }
    for (const file of matches(text, FILE_REF)) {
      if (!existsSync(path.join(dir, file))) missing.add(`file ${file}`);
    }
    if (missing.size) unresolved.push({ skill, missing: [...missing] });
  }

  return {
    installed,
    missingRequired: REQUIRED_SKILLS.filter((s) => !installed.includes(s)),
    unresolved,
  };
}

export function formatReport(r: SkillReport): string {
  const lines = [
    `Skills installed: ${r.installed.join(', ') || 'none'}`,
    `Missing required skills: ${r.missingRequired.join(', ') || 'none'}`,
  ];
  if (r.unresolved.length) {
    lines.push('Dependencies these skills mention but this project lacks:');
    for (const u of r.unresolved) lines.push(`- ${u.skill}: ${u.missing.join('; ')}`);
  } else {
    lines.push('All skill dependencies resolve.');
  }
  return lines.join('\n');
}

// `npm run skills:check` runs this file directly; it needs no .env.
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]).toLowerCase() : '';
if (invokedPath === fileURLToPath(import.meta.url).toLowerCase()) {
  const report = checkSkills();
  console.log(formatReport(report));
  process.exitCode = report.missingRequired.length ? 1 : 0;
}
