import { describe, expect, it } from 'vitest';
import {
    generateAgentApiToken,
    generateAgentConfig,
} from './generateAgentConfig';

describe('Agent config generator', () => {
    const base = {
        panelUrl: 'https://panel.example.com',
        nodeId: 'node-123',
        nodeToken: 'node-secret',
        apiToken: 'a'.repeat(64),
    };

    it('generates the expected Agent YAML fields', () => {
        const yaml = generateAgentConfig(base);

        expect(yaml).toContain('panel:');
        expect(yaml).toContain('  url: "https://panel.example.com"');
        expect(yaml).toContain('  id: "node-123"');
        expect(yaml).toContain('  token: "node-secret"');
        expect(yaml).toContain('  interval: "30s"');
        expect(yaml).toContain('  enabled: true');
        expect(yaml).toContain('  listen: "127.0.0.1:8080"');
        expect(yaml).toContain(`  token: "${'a'.repeat(64)}"`);
    });

    it('rejects HTTP for non-local panel URLs', () => {
        expect(() =>
            generateAgentConfig({
                ...base,
                panelUrl: 'http://panel.example.com',
            }),
        ).toThrow('HTTPS is required');
    });

    it('allows localhost HTTP', () => {
        expect(
            generateAgentConfig({
                ...base,
                panelUrl: 'http://localhost:3000',
            }),
        ).toContain('http://localhost:3000');
    });

    it('rejects matching node and API tokens', () => {
        expect(() =>
            generateAgentConfig({
                ...base,
                apiToken: base.nodeToken,
            }),
        ).toThrow();
    });

    it('escapes YAML-sensitive values', () => {
        const yaml = generateAgentConfig({
            ...base,
            nodeId: 'node:"special"',
        });

        expect(yaml).toContain('node:\\"special\\"');
    });

    it('generates a separate random API token', () => {
        const first = generateAgentApiToken();
        const second = generateAgentApiToken();

        expect(first).toMatch(/^[a-f0-9]{64}$/);
        expect(second).toMatch(/^[a-f0-9]{64}$/);
        expect(first).not.toBe(second);
    });
});
