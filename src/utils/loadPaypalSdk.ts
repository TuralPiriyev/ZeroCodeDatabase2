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

      const script = document.createElement('script');
      // Add small cache-bust so PayPal serves a fresh SDK when switching intents
      const cacheBust = Date.now();
      script.src = `https://www.paypal.com/sdk/js?client-id=${client}&components=buttons&vault=${vault}&intent=${intent}&_=${cacheBust}`;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        try {
          // Mark the global with metadata to help future calls decide whether a reload is needed
          (window as any).__PAYPAL_SDK_INTENT__ = { intent, vault, client };
          if ((window as any).paypal) resolve((window as any).paypal);
          else reject(new Error('PayPal SDK loaded but `paypal` global not found'));
        } catch (e) {
          reject(e);
        }
      };
      script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      document.head.appendChild(script);
    } catch (err) {
      reject(err);
    }
  });

  return _loaded;
}
