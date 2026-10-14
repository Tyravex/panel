import { loadAgentConfig } from './config/agent.config.js';

function main(): void {
    const config = loadAgentConfig();

    console.log(`[Tyravex Agent] Initialized: ${config.agentId}`);
    console.log(`[Tyravex Agent] Panel: ${config.panelUrl}`);
    console.log('[Tyravex Agent] Transport is not enabled yet');
}

main();
