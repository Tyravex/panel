import { getTrustedProxyAddresses } from './trusted-proxies';

describe('Trusted proxy configuration', () => {
  it('accepts only explicit IP addresses and never a blanket trust value', () => {
    expect(getTrustedProxyAddresses('127.0.0.1,::1,127.0.0.1')).toEqual(['127.0.0.1', '::1']);
    for (const value of ['true', '*', '0.0.0.0/0', 'loopback', 'https://proxy.example']) expect(() => getTrustedProxyAddresses(value)).toThrow();
    expect(getTrustedProxyAddresses('')).toEqual([]);
  });
});
