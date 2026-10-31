import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { allCareers, SKILLS } from '../../game/server/careers.js'
import { SKILL_PATTERNS } from '../../game/n8n/market/pipeline.js'

const aliases = {
  'forward-deployed-engineer': ['forward deployed engineer', 'forward deployed software engineer'],
  'data-analyst': ['data analyst', 'business intelligence analyst'],
  'frontend-developer': ['frontend developer', 'front end engineer'],
  'backend-developer': ['backend developer', 'back end engineer'],
  'ui-ux-designer': ['UI UX designer', 'product designer'],
  'ml-engineer': ['machine learning engineer', 'AI engineer'],
  'product-manager': ['product manager', 'product owner'],
  'data-scientist': ['data scientist', 'applied scientist'],
  'auditor': ['auditor', 'audit associate'],
  'lawyer': ['lawyer', 'legal counsel'],
  'teacher': ['teacher', 'lecturer'],
  'doctor': ['medical officer', 'medical doctor'],
  'chef': ['chef', 'sous chef'],
  'civil-engineer': ['civil engineer', 'structural engineer'],
  'accountant': ['accountant', 'accounts executive'],
  'software-engineer': ['software engineer', 'software developer'],
  'electrical-engineer': ['electrical engineer', 'electronics engineer'],
  'digital-marketer': ['digital marketing executive', 'social media executive'],
  'quantity-surveyor': ['quantity surveyor', 'QS executive'],
  'hr-executive': ['HR executive', 'human resources executive'],
  'sales-executive': ['sales executive', 'business development executive'],
  'customer-service': ['customer service executive', 'customer support specialist'],
}
const root = fileURLToPath(new URL('../config/', import.meta.url))
fs.mkdirSync(root, { recursive: true })
fs.writeFileSync(root + 'catalog.json', JSON.stringify({
  version: 'careersphere-catalog-2026-10-24',
  source: 'src/game/server/careers.js (allCareers, SKILLS)',
  careers: allCareers().map(c => ({ id: c.id, name: c.name, aliases: aliases[c.id] ?? [c.name.en] })),
  skills: SKILLS,
  skillPatterns: Object.fromEntries(Object.entries(SKILL_PATTERNS).map(([id, regex]) => [id, regex.source])),
}, null, 2) + '\n')
console.log('Exported project career and skill IDs to src/data/config/catalog.json')
