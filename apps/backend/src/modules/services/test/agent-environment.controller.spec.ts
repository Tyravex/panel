import { AgentEnvironmentController } from '../configuration/agent-environment.controller';
import { AgentEnvironmentService } from '../configuration/agent-environment.service';
import type { Request } from 'express';

describe('Agent environment HTTPS boundary', () => {
  const service = { deliver: jest.fn() };
  const controller = new AgentEnvironmentController(service as unknown as AgentEnvironmentService);
  beforeEach(() => jest.resetAllMocks());
  it('rejects HTTP even when an untrusted forwarded HTTPS header is supplied', async () => {
    await expect(controller.deliver('node-1', { secure: false, headers: { 'x-forwarded-proto': 'https', authorization: `Bearer ${'cd'.repeat(32)}` } } as unknown as Request, { commandId: 'command-1', sessionId: 'session-1' })).rejects.toThrow('HTTPS');
    expect(service.deliver).not.toHaveBeenCalled();
  });
  it('requires an Agent token and rejects unexpected body fields', async () => {
    await expect(controller.deliver('node-1', { secure: true, headers: {} } as Request, {})).rejects.toThrow();
    await expect(controller.deliver('node-1', { secure: true, headers: { authorization: `Bearer ${'cd'.repeat(32)}` } } as Request, { commandId: 'command-1', sessionId: 'session-1', serviceId: 'other' })).rejects.toThrow();
    expect(service.deliver).not.toHaveBeenCalled();
  });
});
