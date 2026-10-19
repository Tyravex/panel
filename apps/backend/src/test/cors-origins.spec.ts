
import { getCorsOrigins } from '../cors-origins';

describe('getCorsOrigins', () => {
  it('accepts a single HTTP origin', () => {
    expect(getCorsOrigins('http://localhost:5173')).toEqual([
      'http://localhost:5173',
    ]);
  });

  it('accepts a single HTTPS origin', () => {
    expect(getCorsOrigins('https://panel.example.com')).toEqual([
      'https://panel.example.com',
    ]);
  });

  it('accepts multiple comma-separated origins', () => {
    expect(
      getCorsOrigins(
        'http://localhost:5173,https://panel.example.com',
      ),
    ).toEqual([
      'http://localhost:5173',
      'https://panel.example.com',
    ]);
  });

  it('trims whitespace and removes duplicates', () => {
    expect(
      getCorsOrigins(
        ' http://localhost:5173 , https://panel.example.com , http://localhost:5173 ',
      ),
    ).toEqual([
      'http://localhost:5173',
      'https://panel.example.com',
    ]);
  });

  it('rejects a missing configuration', () => {
    expect(() => getCorsOrigins('')).toThrow(
      'CORS_ORIGIN environment variable is required',
    );
  });

  it('rejects whitespace-only configuration', () => {
    expect(() => getCorsOrigins('   ')).toThrow(
      'CORS_ORIGIN must contain at least one origin',
    );
  });

  it('rejects wildcard origins', () => {
    expect(() => getCorsOrigins('*')).toThrow(
      'Invalid CORS origin: *',
    );
  });

  it('rejects unsupported protocols', () => {
    expect(() => getCorsOrigins('ftp://example.com')).toThrow(
      'Invalid CORS origin: ftp://example.com',
    );
  });

  it('rejects origins containing paths', () => {
    expect(() =>
      getCorsOrigins('https://panel.example.com/admin'),
    ).toThrow(
      'Invalid CORS origin: https://panel.example.com/admin',
    );
  });

  it('rejects origins containing query parameters', () => {
    expect(() =>
      getCorsOrigins('https://panel.example.com?token=test'),
    ).toThrow(
      'Invalid CORS origin: https://panel.example.com?token=test',
    );
  });

  it('rejects origins containing credentials', () => {
    expect(() =>
      getCorsOrigins('https://user:password@panel.example.com'),
    ).toThrow(
      'Invalid CORS origin: https://user:password@panel.example.com',
    );
  });

  it('rejects an invalid origin in a list', () => {
    expect(() =>
      getCorsOrigins('http://localhost:5173,*'),
    ).toThrow('Invalid CORS origin: *');
  });

  it('rejects the literal null origin', () => {
    expect(() => getCorsOrigins('null')).toThrow(
      'Invalid CORS origin: null',
    );
  });

  it('rejects an origin with a trailing slash', () => {
    expect(() =>
      getCorsOrigins('https://panel.example.com/'),
    ).toThrow(
      'Invalid CORS origin: https://panel.example.com/',
    );
  });
});
