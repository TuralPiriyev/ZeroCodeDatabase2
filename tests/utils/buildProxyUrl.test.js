const { buildProxyUrl, BAD_HOST, PROXY_PREFIX } = require('../../src/utils/proxy-utils');

describe('buildProxyUrl', () => {
  test('converts BAD_HOST absolute URL to proxy relative', () => {
    const input = BAD_HOST + '/api/proxy/dbquery?x=1';
    const out = buildProxyUrl(input);
    expect(out).toBe(PROXY_PREFIX + '/api/proxy/dbquery?x=1');
  });

  test('leaves other absolute URLs untouched', () => {
    const input = 'https://example.com/api/other';
    const out = buildProxyUrl(input);
    expect(out).toBe(input);
  });

  test('preserves already-relative paths', () => {
    const input = '/api/proxy/dbquery';
    const out = buildProxyUrl(input);
    expect(out).toBe(input);
  });

  test('handles empty/invalid input gracefully', () => {
    expect(buildProxyUrl('')).toBe('');
    expect(buildProxyUrl(null)).toBe(null);
    expect(buildProxyUrl(undefined)).toBe(undefined);
  });
});
