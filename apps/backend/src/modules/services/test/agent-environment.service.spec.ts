import { createDecipheriv, createHmac } from 'node:crypto';
import { AgentEnvironmentService } from '../configuration/agent-environment.service';
import { encryptServiceEnvironment } from '../configuration/service-environment.crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { NodesService } from '@/modules/nodes/nodes.service';
import { AgentWebSocketLifecycle } from '@/modules/nodes/transport/websocket/agent-websocket.lifecycle';

describe('Agent environment delivery boundaries', () => {
  const previousKey = process.env.SERVICE_ENVIRONMENT_KEY;
  const db = { $queryRaw: jest.fn(), agentCommand: { findUnique: jest.fn() }, service: { findUnique: jest.fn() } };
  const prisma = { $transaction: (callback: (tx: typeof db) => unknown) => callback(db) };
  const nodes = { authenticateNode: jest.fn() }; const agent = { isCurrentNodeSession: jest.fn() };
  const delivery = new AgentEnvironmentService(prisma as unknown as PrismaService, nodes as unknown as NodesService, agent as unknown as AgentWebSocketLifecycle);
  const command = { nodeId: 'node-1', sessionId: 'session-1', operation: 'service.install', status: 'ACCEPTED', serviceId: 'service-1', jobId: 'job-1',
    job: { type: 'INSTALL', status: 'RUNNING', serviceId: 'service-1', createdAt: new Date('2026-11-15T00:01:00Z'), installConfig: { nodeId: 'node-1', egg: { id: 'egg-1' }, variables: [{ name: 'TOKEN', required: true }] } } };
  beforeEach(() => {
    jest.resetAllMocks(); process.env.SERVICE_ENVIRONMENT_KEY = 'ab'.repeat(32);
    nodes.authenticateNode.mockResolvedValue({ id: 'node-1' }); agent.isCurrentNodeSession.mockReturnValue(true);
    db.agentCommand.findUnique.mockResolvedValue(command);
    db.service.findUnique.mockResolvedValue({ id: 'service-1', nodeId: 'node-1', eggId: 'egg-1', eggConfiguration: {
      environmentEncrypted: encryptServiceEnvironment('service-1', { TOKEN: 'secret-value' }), updatedAt: new Date('2026-11-15T00:00:00Z') } });
  });
  afterAll(() => { if (previousKey === undefined) delete process.env.SERVICE_ENVIRONMENT_KEY; else process.env.SERVICE_ENVIRONMENT_KEY = previousKey; });
  it('seals only declared values to the active node, session and command', async () => {
    const token = 'cd'.repeat(32);
    const envelope = await delivery.deliver('node-1', token, 'command-1', 'session-1');
    expect(JSON.stringify(envelope)).not.toContain('secret-value');
    const key = createHmac('sha256', token).update('tyravex:agent-environment:v1:session-1').digest();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(Buffer.from([envelope.nodeId, envelope.serviceId, envelope.jobId, envelope.commandId, envelope.sessionId, envelope.expiresAt].join('\n')));
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    expect(JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString())).toEqual({ TOKEN: 'secret-value' });
  });
  it('rejects another node, a superseded session, and completed commands', async () => {
    await expect(delivery.deliver('node-2', 'token', 'command-1', 'session-1')).rejects.toThrow();
    agent.isCurrentNodeSession.mockReturnValue(false);
    await expect(delivery.deliver('node-1', 'token', 'command-1', 'session-1')).rejects.toThrow();
    agent.isCurrentNodeSession.mockReturnValue(true);
    db.agentCommand.findUnique.mockResolvedValue({ ...command, status: 'COMPLETED' });
    await expect(delivery.deliver('node-1', 'token', 'command-1', 'session-1')).rejects.toThrow();
  });
  it('rejects environment changes newer than the job snapshot', async () => {
    db.service.findUnique.mockResolvedValue({ id: 'service-1', nodeId: 'node-1', eggId: 'egg-1', eggConfiguration: { updatedAt: new Date('2026-11-15T00:02:00Z') } });
    await expect(delivery.deliver('node-1', 'token', 'command-1', 'session-1')).rejects.toThrow('changed after');
  });
});
