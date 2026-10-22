
import {
  AGENT_PROTOCOL_VERSION,
  createAgentEnvelope,
  isAgentEnvelope,
} from '../agent-protocol';

describe('Agent protocol v1', () => {
  const validMessage = {
    protocol: AGENT_PROTOCOL_VERSION,
    id: 'message-123',
    type: 'node.heartbeat',
    timestamp: '2026-10-21T12:00:00Z',
    payload: {
      uptimeSeconds: 120,
    },
  };

  it('accepts a valid protocol envelope', () => {
    expect(isAgentEnvelope(validMessage)).toBe(true);
  });

  it('rejects unsupported protocol versions', () => {
    expect(
      isAgentEnvelope({
        ...validMessage,
        protocol: 2,
      }),
    ).toBe(false);
  });

  it('rejects unknown message types', () => {
    expect(
      isAgentEnvelope({
        ...validMessage,
        type: 'system.execute',
      }),
    ).toBe(false);
  });

  it('rejects empty message IDs', () => {
    expect(
      isAgentEnvelope({
        ...validMessage,
        id: '',
      }),
    ).toBe(false);
  });

  it('rejects oversized message IDs', () => {
    expect(
      isAgentEnvelope({
        ...validMessage,
        id: 'x'.repeat(129),
      }),
    ).toBe(false);
  });

  it('rejects malformed timestamps', () => {
    expect(
      isAgentEnvelope({
        ...validMessage,
        timestamp: 'not-a-date',
      }),
    ).toBe(false);
  });

  it('rejects invalid payloads', () => {
    expect(
      isAgentEnvelope({
        ...validMessage,
        payload: null,
      }),
    ).toBe(false);

    expect(
      isAgentEnvelope({
        ...validMessage,
        payload: [],
      }),
    ).toBe(false);
  });

  it('rejects non-object messages', () => {
    expect(isAgentEnvelope(null)).toBe(false);
    expect(isAgentEnvelope('hello')).toBe(false);
    expect(isAgentEnvelope([])).toBe(false);
  });

  it('creates a valid message', () => {
    const message = createAgentEnvelope(
      'node.hello',
      {
        agentVersion: '0.4.0',
        capabilities: ['docker'],
      },
      'hello-123',
    );

    expect(message.protocol).toBe(1);
    expect(message.type).toBe('node.hello');
    expect(message.id).toBe('hello-123');
    expect(isAgentEnvelope(message)).toBe(true);
  });

  it('rejects invalid IDs during creation', () => {
    expect(() =>
      createAgentEnvelope('node.hello', {}, ''),
    ).toThrow('Invalid agent message ID');
  });
});
