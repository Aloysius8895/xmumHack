import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export const WORKFLOW_ID = 'CSPostingWatch01'
export const CREDENTIAL_ID = 'CSPostingAuth001'

export function buildPostingWatchWorkflow(baseUrl = 'http://127.0.0.1:8787')
{
    return {
        id: WORKFLOW_ID, name: 'CareerSphere: weekly job posting watch', active: false,
        nodes: [
            { id: 'watch-manual', name: 'Check now', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
            { id: 'watch-schedule', name: 'Every Monday 08:00 MYT', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 180], parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1' }] } } },
            { id: 'watch-webhook', name: 'Local job-watch webhook', webhookId: 'CSPostingWatch01-hook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 340],
                parameters: { httpMethod: 'POST', path: 'job-watch', authentication: 'headerAuth', responseMode: 'lastNode', options: {} },
                credentials: { httpHeaderAuth: { id: CREDENTIAL_ID, name: 'CareerSphere posting watch bearer' } } },
            { id: 'watch-check', name: 'Check saved posting links', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [300, 80],
                parameters: { method: 'POST', url: `${baseUrl.replace(/\/$/, '')}/api/integrations/jobs/check`, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
                    sendBody: true, specifyBody: 'json', jsonBody: '{}', options: { timeout: 330000 } },
                credentials: { httpHeaderAuth: { id: CREDENTIAL_ID, name: 'CareerSphere posting watch bearer' } } },
            { id: 'watch-notes', name: 'Monitoring contract', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [0, -240],
                parameters: { width: 700, height: 220, content: '## Weekly job posting watch\nEvery Monday 08:00 (Asia/Kuala_Lumpur), check source URLs registered in Roadmap for general or customised career targets. The server compares job content, preserves the roadmap, and sends in-app live updates when a revision needs review.\nFirst successful fetch establishes baseline. HTTP/parse failures do not count as changes. No external messages or automatic roadmap replacement.\nSet Header Auth: Authorization = Bearer <INTEGRATION_TOKEN>. No secrets are embedded in this JSON. This workflow checks saved posting links; it does not re-scrape the full market dataset.' } },
        ],
        connections: {
            'Check now': { main: [[{ node: 'Check saved posting links', type: 'main', index: 0 }]] },
            'Every Monday 08:00 MYT': { main: [[{ node: 'Check saved posting links', type: 'main', index: 0 }]] },
            'Local job-watch webhook': { main: [[{ node: 'Check saved posting links', type: 'main', index: 0 }]] },
        },
        settings: { executionOrder: 'v1', timezone: 'Asia/Kuala_Lumpur', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
        pinData: {},
    }
}

export function writePostingWatchWorkflow(baseUrl)
{
    const workflow = buildPostingWatchWorkflow(baseUrl)
    fs.writeFileSync(fileURLToPath(new URL('./posting-watch.workflow.json', import.meta.url)), JSON.stringify(workflow, null, 2) + '\n')
    return workflow
}

if(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) writePostingWatchWorkflow()
