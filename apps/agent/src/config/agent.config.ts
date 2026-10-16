export interface AgentConfig {
    agentId: string;
    panelUrl: string;
    agentToken: string;
    port: number;
}

export function loadAgentConfig(): AgentConfig {
    const agentId = process.env.TYRAVEX_AGENT_ID?.trim();
    const panelUrl = process.env.TYRAVEX_PANEL_URL?.trim();
    const agentToken = process.env.TYRAVEX_AGENT_TOKEN;
    const port = Number(process.env.TYRAVEX_AGENT_PORT ?? 8081);

    if (!agentId) {
        throw new Error('TYRAVEX_AGENT_ID is required');
    }

    if (!panelUrl) {
        throw new Error('TYRAVEX_PANEL_URL is required');
    }

    if (!agentToken || agentToken.length < 32) {
        throw new Error(
            'TYRAVEX_AGENT_TOKEN must contain at least 32 characters',
        );
    }

    const parsedUrl = new URL(panelUrl);

    const isLocalDevelopment =
        parsedUrl.protocol === 'http:' &&
        (parsedUrl.hostname === 'localhost' ||
            parsedUrl.hostname === '127.0.0.1' ||
            parsedUrl.hostname === '[::1]');

    if (parsedUrl.protocol !== 'https:' && !isLocalDevelopment) {
        throw new Error(
            'TYRAVEX_PANEL_URL must use HTTPS outside localhost',
        );
    }

    if (parsedUrl.username || parsedUrl.password) {
        throw new Error(
            'TYRAVEX_PANEL_URL must not contain credentials',
        );
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(
            'TYRAVEX_AGENT_PORT must be a valid TCP port',
        );
    }

    return {
        agentId,
        panelUrl: parsedUrl.toString(),
        agentToken,
        port,
    };
}