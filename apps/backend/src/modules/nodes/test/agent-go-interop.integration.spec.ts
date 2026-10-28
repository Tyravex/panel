import { createServer, Server as HttpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { once } from 'node:events';

import { NodesService } from '../nodes.service';
import { AgentWebSocketServer } from '../transport/agent-websocket.server';

// Requires the local Agent repository and Go toolchain.
// This test is excluded from the ordinary backend test command.
describe('Panel <-> real Go Agent WSS interop', () => {
    it('handshakes, applies initial ownership and revokes on disconnect', async () => {
        const agentRepo = process.env.TYRAVEX_AGENT_REPO;
        if (!agentRepo) {
            throw new Error('Set TYRAVEX_AGENT_REPO to the local Agent repository path');
        }

        const certFile = resolve(__dirname, 'fixtures/interop-cert.pem');
        const keyFile = resolve(__dirname, 'fixtures/interop-key.pem');
        const server: HttpsServer = createServer({
            cert: readFileSync(certFile),
            key: readFileSync(keyFile),
        });
        const authenticateNode = jest.fn().mockResolvedValue({ id: 'node-1', name: 'Interop node', status: 'OFFLINE' });
        const heartbeat = jest.fn().mockResolvedValue({ ok: true, lastSeenAt: new Date().toISOString() });
        const findAssignedServiceIds = jest.fn().mockResolvedValue(['minecraft-1']);
        const transport = new AgentWebSocketServer(server, {
            authenticateNode, heartbeat, findAssignedServiceIds,
        } as unknown as NodesService);

        try {
            server.listen(0, '127.0.0.1');
            await once(server, 'listening');
            const address = server.address() as AddressInfo;
            const output = await new Promise<{ code: number | null; text: string }>((resolveProcess, reject) => {
                const child = spawn('go', [
                    'test', './internal/transport', '-run', '^TestPanelInteropInitialSnapshot$', '-count=1', '-v',
                ], {
                    cwd: agentRepo,
                    windowsHide: true,
                    env: {
                        ...process.env,
                        TYRAVEX_INTEROP_PANEL_URL: `https://127.0.0.1:${address.port}`,
                        TYRAVEX_INTEROP_CERT_FILE: certFile,
                    },
                });
                let text = '';
                child.stdout.on('data', (data: Buffer) => { text += data.toString(); });
                child.stderr.on('data', (data: Buffer) => { text += data.toString(); });
                const deadline = setTimeout(() => {
                    child.kill();
                    reject(new Error(`Go interop process timed out:\n${text}`));
                }, 60_000);
                child.once('error', (error) => { clearTimeout(deadline); reject(error); });
                child.once('close', (code) => {
                    clearTimeout(deadline);
                    resolveProcess({ code, text });
                });
            });
            expect(output.code).toBe(0);
            expect(output.text).toContain('INTEROP_READY revision=1');
            expect(authenticateNode).toHaveBeenCalled();
            expect(findAssignedServiceIds).toHaveBeenCalledWith('node-1');
        } finally {
            transport.close();
            await new Promise<void>((resolveClose) => {
                if (!server.listening) return resolveClose();
                server.close(() => resolveClose());
                server.closeAllConnections();
            });
        }
    }, 75_000);

    it('refreshes ownership with a higher revision over real WSS', async () => {
        const agentRepo = process.env.TYRAVEX_AGENT_REPO;
        if (!agentRepo) {
            throw new Error('Set TYRAVEX_AGENT_REPO to the local Agent repository path');
        }

        const certFile = resolve(__dirname, 'fixtures/interop-cert.pem');
        const keyFile = resolve(__dirname, 'fixtures/interop-key.pem');
        const server: HttpsServer = createServer({
            cert: readFileSync(certFile),
            key: readFileSync(keyFile),
        });
        const authenticateNode = jest.fn().mockResolvedValue({ id: 'node-1', name: 'Interop node', status: 'OFFLINE' });
        const heartbeat = jest.fn().mockResolvedValue({ ok: true, lastSeenAt: new Date().toISOString() });
        const findAssignedServiceIds = jest.fn().mockResolvedValue(['minecraft-1']);
        const transport = new AgentWebSocketServer(server, {
            authenticateNode, heartbeat, findAssignedServiceIds,
        } as unknown as NodesService);

        try {
            server.listen(0, '127.0.0.1');
            await once(server, 'listening');
            const address = server.address() as AddressInfo;
            const output = await new Promise<{ code: number | null; text: string }>((resolveProcess, reject) => {
                const child = spawn('go', [
                    'test', './internal/transport', '-run', '^TestPanelInteropRefresh$', '-count=1', '-v',
                ], {
                    cwd: agentRepo,
                    windowsHide: true,
                    env: {
                        ...process.env,
                        TYRAVEX_INTEROP_PANEL_URL: `https://127.0.0.1:${address.port}`,
                        TYRAVEX_INTEROP_CERT_FILE: certFile,
                    },
                });
                let text = '';
                child.stdout.on('data', (data: Buffer) => { text += data.toString(); });
                child.stderr.on('data', (data: Buffer) => { text += data.toString(); });
                const deadline = setTimeout(() => {
                    child.kill();
                    reject(new Error(`Go interop process timed out:\n${text}`));
                }, 60_000);
                child.once('error', (error) => { clearTimeout(deadline); reject(error); });
                child.once('close', (code) => {
                    clearTimeout(deadline);
                    resolveProcess({ code, text });
                });
            });
            expect(output.code).toBe(0);
            expect(output.text).toContain('INTEROP_REFRESH revision=2');
            expect(authenticateNode).toHaveBeenCalled();
            expect(findAssignedServiceIds).toHaveBeenCalledWith('node-1');
        } finally {
            transport.close();
            await new Promise<void>((resolveClose) => {
                if (!server.listening) return resolveClose();
                server.close(() => resolveClose());
                server.closeAllConnections();
            });
        }
    }, 90_000);

    it('reconnects with a new session ID and resets revision', async () => {
        const agentRepo = process.env.TYRAVEX_AGENT_REPO;
        if (!agentRepo) {
            throw new Error('Set TYRAVEX_AGENT_REPO to the local Agent repository path');
        }

        const certFile = resolve(__dirname, 'fixtures/interop-cert.pem');
        const keyFile = resolve(__dirname, 'fixtures/interop-key.pem');
        const server: HttpsServer = createServer({
            cert: readFileSync(certFile),
            key: readFileSync(keyFile),
        });
        const authenticateNode = jest.fn().mockResolvedValue({ id: 'node-1', name: 'Interop node', status: 'OFFLINE' });
        const heartbeat = jest.fn().mockResolvedValue({ ok: true, lastSeenAt: new Date().toISOString() });
        const findAssignedServiceIds = jest.fn().mockResolvedValue(['minecraft-1']);
        const transport = new AgentWebSocketServer(server, {
            authenticateNode, heartbeat, findAssignedServiceIds,
        } as unknown as NodesService);

        try {
            server.listen(0, '127.0.0.1');
            await once(server, 'listening');
            const address = server.address() as AddressInfo;
            const output = await new Promise<{ code: number | null; text: string }>((resolveProcess, reject) => {
                const child = spawn('go', [
                    'test', './internal/transport', '-run', '^TestPanelInteropReconnect$', '-count=1', '-v',
                ], {
                    cwd: agentRepo,
                    windowsHide: true,
                    env: {
                        ...process.env,
                        TYRAVEX_INTEROP_PANEL_URL: `https://127.0.0.1:${address.port}`,
                        TYRAVEX_INTEROP_CERT_FILE: certFile,
                    },
                });
                let text = '';
                child.stdout.on('data', (data: Buffer) => { text += data.toString(); });
                child.stderr.on('data', (data: Buffer) => { text += data.toString(); });
                const deadline = setTimeout(() => {
                    child.kill();
                    reject(new Error(`Go interop process timed out:\n${text}`));
                }, 60_000);
                child.once('error', (error) => { clearTimeout(deadline); reject(error); });
                child.once('close', (code) => {
                    clearTimeout(deadline);
                    resolveProcess({ code, text });
                });
            });
            if (output.code !== 0) {
                throw new Error(
                    `Go interop reconnect failed (exit code ${output.code}):\n${output.text}`,
                );
            }
            expect(output.text).toContain('INTEROP_RECONNECT new_session=true revision=1');
            expect(authenticateNode).toHaveBeenCalled();
            expect(findAssignedServiceIds).toHaveBeenCalledWith('node-1');
        } finally {
            transport.close();
            await new Promise<void>((resolveClose) => {
                if (!server.listening) return resolveClose();
                server.close(() => resolveClose());
                server.closeAllConnections();
            });
        }
    }, 75_000);
});
