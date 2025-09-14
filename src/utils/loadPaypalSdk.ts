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
      if ((window as any).paypal) return resolve((window as any).paypal);

      const script = document.createElement('script');
      const client = encodeURIComponent(opts.clientId || '');
      const vault = opts.vault ? 'true' : 'false';
      const intent = opts.intent || 'subscription';
      script.src = `https://www.paypal.com/sdk/js?client-id=${client}&components=buttons&vault=${vault}&intent=${intent}`;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if ((window as any).paypal) resolve((window as any).paypal);
        else reject(new Error('PayPal SDK loaded but `paypal` global not found'));
      };
  script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
      document.head.appendChild(script);
    } catch (err) {
      reject(err);
    }
  });
  return _loaded;
}
