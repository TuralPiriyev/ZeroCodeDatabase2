// src/utils/loadPaypalSdk.ts
// Idempotent loader for PayPal JS SDK. Returns a promise that resolves when
// the global `paypal` is available. Uses crossorigin="anonymous" on script tag.

export interface LoadOptions {
  clientId: string;
  vault?: boolean;
  intent?: 'subscription' | 'capture' | string;
}

let _loaded: Promise<any> | null = null;

export function loadPayPalSdk(opts: LoadOptions) {
  if (_loaded) return _loaded;

  _loaded = new Promise((resolve, reject) => {
    try {
      if (typeof window === 'undefined') return reject(new Error('Window not available'));

      // (previous simple heuristic removed) We rely on a marker on window.__PAYPAL_SDK_INTENT__ to decide
      // whether an existing SDK matches the requested intent/vault/client. If not, we will load a fresh SDK.

      // If existing paypal global exists but requested intent/vault might differ, force reload by
      // creating a fresh script tag with a cache-busting param so PayPal serves an SDK matching the requested intent.
  // Use the raw client id when building the script URL. Encoding client ids
  // can sometimes cause PayPal to return 400 if characters are encoded
  // differently than what their servers expect. We still keep an encoded
  // marker for identity checks, but build the URL with the original id.
  const clientRaw = opts.clientId || '';
  const client = encodeURIComponent(opts.clientId || '');
  const vault = opts.vault ? 'true' : 'false';
  const intent = opts.intent || 'subscription';

      if ((window as any).paypal) {
        // If PayPal already exists, we check for a simple marker set by previous loads
        const marker = (window as any).__PAYPAL_SDK_INTENT__;
        if (marker && marker.intent === intent && marker.vault === vault && marker.client === client) {
          return resolve((window as any).paypal);
        }
        // Otherwise remove any existing sdk script(s) we injected earlier that match paypal SDK src
        Array.from(document.querySelectorAll('script')).forEach((s) => {
          try {
            if (s && s.src && s.src.indexOf('paypal.com/sdk/js') !== -1) s.parentNode && s.parentNode.removeChild(s);
          } catch (e) { }
        });
      }

      const makeScript = (host: string, useSbClient = false) => {
        const s = document.createElement('script');
        const clientParam = useSbClient ? 'sb' : clientRaw;
        const url = `${host}/sdk/js?client-id=${clientParam}&components=buttons&vault=${vault}&intent=${intent}`;
        // Log the exact URL we attempt so developers can debug 400 responses.
        console.log('[loadPayPalSdk] attempting to load PayPal SDK URL:', url);
        s.src = url;
        s.async = true;
        s.defer = true;
        s.crossOrigin = 'anonymous';
        return s;
      };

      const prodHost = 'https://www.paypal.com';
      const sandboxHost = 'https://www.sandbox.paypal.com';
      let triedSandbox = false;

      // Try load normally first. If that fails for both prod and sandbox, we
      // attempt a final fallback using PayPal's sandbox client-id shortcut 'sb'
      // which will load the generic sandbox SDK (useful for local debugging).
      const attemptLoad = (host: string, useSbClient = false) => {
        const s = makeScript(host, useSbClient);
        s.onload = () => {
          try {
            (window as any).__PAYPAL_SDK_INTENT__ = { intent, vault, client, host };
            console.log('[loadPayPalSdk] PayPal SDK loaded from', host);
            if ((window as any).paypal) resolve((window as any).paypal);
            else reject(new Error('PayPal SDK loaded but `paypal` global not found'));
          } catch (e) {
            reject(e);
          }
        };
        s.onerror = () => {
          console.warn('[loadPayPalSdk] PayPal SDK failed to load from', host, ' useSbClient=', useSbClient);
          // Remove failed script
          try { s.parentNode && s.parentNode.removeChild(s); } catch (e) { /* ignore */ }
          if (!triedSandbox && host === prodHost && !useSbClient) {
            triedSandbox = true;
            console.log('[loadPayPalSdk] Retrying PayPal SDK load from sandbox host');
            // Try sandbox (same client id)
            attemptLoad(sandboxHost, false);
            return;
          }

          // If we already tried prod -> sandbox and both failed, try sandbox with
          // the special 'sb' client id as a last resort for local debugging.
          if (!useSbClient && host === sandboxHost) {
            console.log('[loadPayPalSdk] Both prod and sandbox failed; attempting sandbox with client-id=sb (debug fallback)');
            attemptLoad(sandboxHost, true);
            return;
          }

          reject(new Error('Failed to load PayPal SDK from ' + host + ' (useSbClient=' + useSbClient + ')'));
        };
        document.head.appendChild(s);
      };

  // If we're on localhost/dev, prefer sandbox host first (sandbox client IDs commonly used in dev)
  const hostFirst = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) ? sandboxHost : prodHost;
  console.log('[loadPayPalSdk] loading PayPal SDK, prefer host:', hostFirst, ' intent=', intent, ' vault=', vault);
  attemptLoad(hostFirst);
    } catch (err) {
      reject(err);
    }
  });

  return _loaded;
}
