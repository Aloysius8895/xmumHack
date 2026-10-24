import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CREDENTIAL_ID } from '../posting-watch/build-workflow.mjs'

export const PUBLIC_MARKET_ID = '5erFfpD0uZ1L719B'
export function buildPublicMarketWorkflow(baseUrl = 'http://127.0.0.1:8787')
{
    return {
        id: PUBLIC_MARKET_ID, name: 'CareerSphere: LinkedIn public market collection', active: false,
        nodes: [
            { id: 'public-market-schedule', name: 'Daily 08:00 MYT', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0], parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * *' }] } } },
            { id: 'public-market-manual', name: 'Collect now', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 180], parameters: {} },
            { id: 'public-market-run', name: 'Collect clean and publish data', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [300, 80],
                parameters: { method: 'POST', url: baseUrl.replace(/\/$/, '') + '/api/integrations/market/collect', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
                    sendBody: true, specifyBody: 'json', jsonBody: '{}', options: { timeout: 1200000 } },
                credentials: { httpHeaderAuth: { id: CREDENTIAL_ID, name: 'CareerSphere posting watch bearer' } } },
            { id: 'public-market-note', name: 'Collection contract', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [0, -220],
                parameters: { width: 760, height: 190, content: '## No RapidAPI key required\nDaily 08:00 Asia/Kuala_Lumpur. Calls the existing public LinkedIn collector: 13 careers, 2 aliases, 2 pages, request budget 300, max 180 details, >=1.5s between requests.\nRaw responses remain immutable. Derived data is validated before publication. Failed searches/selected details preserve previous published data. The API waits until the run finishes; concurrent retries share one run.\nIndeed index metadata is retained but is not refreshed by this workflow. Requires the local Python collector dependencies and the game server. Do not activate the old duplicate JSearch schedule.' } },
        ],
        connections: {
            'Daily 08:00 MYT': { main: [[{ node: 'Collect clean and publish data', type: 'main', index: 0 }]] },
            'Collect now': { main: [[{ node: 'Collect clean and publish data', type: 'main', index: 0 }]] },
        },
        settings: { executionOrder: 'v1', timezone: 'Asia/Kuala_Lumpur', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' }, pinData: {},
    }
}

export function writePublicMarketWorkflow()
{
    const workflow = buildPublicMarketWorkflow()
    fs.writeFileSync(fileURLToPath(new URL('./public-market.workflow.json', import.meta.url)), JSON.stringify(workflow, null, 2) + '\n')
    return workflow
}
