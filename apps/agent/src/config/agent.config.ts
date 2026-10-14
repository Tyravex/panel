export interface AgentConfig {
    agentId: string;
    panelUrl: string;
    port: number;
}

export function loadAgentConfig(): AgentConfig {
    const agentId = process.env.TYRAVEX_AGENT_ID;
    const panelUrl = process.env.TYRAVEX_PANEL_URL;
    const port = Number(process.env.TYRAVEX_AGENT_PORT ?? 8081);

    if (!agentId) {
        throw new Error('TYRAVEX_AGENT_ID is required');
    }

    if (!panelUrl) {
        throw new Error('TYRAVEX_PANEL_URL is required');
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('TYRAVEX_AGENT_PORT must be a valid TCP port');
    }

    return {
        agentId,
        panelUrl: new URL(panelUrl).toString(),
        port,
    };
}
