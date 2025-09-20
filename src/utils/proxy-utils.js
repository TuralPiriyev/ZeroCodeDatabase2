// Utility used by client runtime and server-side tests to build proxy URLs safely
const BAD_HOST = 'https://zerocodedb.online';
const PROXY_PREFIX = '/api/proxy';

function buildProxyUrl(original) {
  try {
    if (!original) return original;
    if (original.startsWith('/')) return original;
    const u = new URL(original, 'http://example');
    if (u.origin === BAD_HOST) {
      return PROXY_PREFIX + u.pathname + u.search;
    }
    return original;
  } catch (e) {
    // on error, return original so we don't break third-party calls
    return original;
  }
}

module.exports = { buildProxyUrl, BAD_HOST, PROXY_PREFIX };
