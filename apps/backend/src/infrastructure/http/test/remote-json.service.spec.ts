import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { RemoteJsonService } from '../remote-json.service';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));
jest.mock('node:https', () => ({ request: jest.fn() }));

describe('RemoteJsonService', () => {
  const service = new RemoteJsonService();
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(lookup).mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
  });
  function response(status: number, body: string, headers = {}) {
    jest.mocked(request).mockImplementation(((_url: unknown, _options: unknown, callback: (value: unknown) => void) => {
      const incoming = Object.assign(new EventEmitter(), { statusCode: status, headers, destroy: jest.fn() });
      const outgoing = Object.assign(new EventEmitter(), { end: () => {
        callback(incoming);
        incoming.emit('data', Buffer.from(body));
        incoming.emit('end');
      } });
      return outgoing;
    }) as never);
  }
  it('returns parsed JSON using a pinned address and no shared agent', async () => {
    response(200, '{"eggs":[]}');
    await expect(service.getJson('https://eggs.example.org/index.json')).resolves.toEqual({ eggs: [] });
    const options = jest.mocked(request).mock.calls[0][1] as { agent: boolean; lookup: Function };
    expect(options.agent).toBe(false);
    const callback = jest.fn();
    options.lookup('eggs.example.org', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
  });
  it('rejects any private DNS result before requesting a document', async () => {
    jest.mocked(lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(service.getJson('https://eggs.example.org/index.json')).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    [302, '{}', {}],
    [200, 'not JSON', {}],
    [200, '{}', { 'content-length': '1048577' }],
    [200, '{}', { 'content-encoding': 'gzip' }],
    [200, 'x'.repeat(1048577), {}],
  ])('rejects an unsafe or invalid response (%s)', async (status, body, headers) => {
    response(status, body, headers);
    await expect(service.getJson('https://eggs.example.org/index.json')).rejects.toThrow();
  });
  it('rejects non-HTTPS sources before DNS lookup', async () => {
    await expect(service.getJson('http://eggs.example.org/index.json')).rejects.toThrow();
    expect(lookup).not.toHaveBeenCalled();
  });
});
