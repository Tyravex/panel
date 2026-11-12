export interface AgentConfigInput {
    panelUrl: string;
    nodeId: string;
    nodeToken: string;
    apiToken?: string;
}

function yamlString(value: string): string {
    return JSON.stringify(value);
}

function validatePanelUrl(value: string): string {
    const trimmed = value.trim();

    let parsed: URL;

    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error('Invalid panel URL');
    }

    if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash
    ) {
        throw new Error('Invalid panel URL');
    }

    if (parsed.protocol === 'http:') {
        const hostname = parsed.hostname.toLowerCase();

        if (
            hostname !== 'localhost' &&
            hostname !== '127.0.0.1' &&
            hostname !== '[::1]'
        ) {
            throw new Error('HTTPS is required for non-local panel connections');
        }
    }

    return parsed.toString().replace(/\/$/, '');
}

export function generateAgentApiToken(): string {
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('Secure random generator is unavailable');
    }

    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
}

export function generateAgentConfig(input: AgentConfigInput): string {
    const panelUrl = validatePanelUrl(input.panelUrl);

    const nodeId = input.nodeId.trim();
    const nodeToken = input.nodeToken.trim();

    if (!nodeId || !nodeToken) {
        throw new Error('Node ID and token are required');
    }

    const apiToken = input.apiToken ?? generateAgentApiToken();

    if (apiToken.trim().length < 32) {
        throw new Error('Agent API token must contain at least 32 characters');
    }

    if (apiToken.trim() === nodeToken) {
        throw new Error('Agent API token must differ from node token');
    }

    return [
        '# Tyravex Agent configuration',
        '# Contains secrets. Never commit this file to Git.',
        '',
        'panel:',
        `  url: ${yamlString(panelUrl)}`,
        '',
        'node:',
        `  id: ${yamlString(nodeId)}`,
        `  token: ${yamlString(nodeToken)}`,
        '',
        'heartbeat:',
        '  interval: "30s"',
        '',
        'docker:',
        '  enabled: true',
        '  host: ""',
        '',
        'api:',
        '  listen: "127.0.0.1:8080"',
        `  token: ${yamlString(apiToken.trim())}`,
        '',
    ].join('\n');
}
