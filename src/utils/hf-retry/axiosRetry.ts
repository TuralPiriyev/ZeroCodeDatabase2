import type { AxiosInstance } from 'axios';

export function attachRetryInterceptor(axiosInstance: AxiosInstance, opts:{ maxAttempts?:number, baseDelayMs?:number } = {}){
  const maxAttempts = opts.maxAttempts || 5;
  const baseDelay = opts.baseDelayMs || 500;

  axiosInstance.interceptors.response.use(undefined, async (error) => {
    const config = error.config || {};
    config.__retryCount = config.__retryCount || 0;
    const status = error.response && error.response.status;

    // log rate limit headers if present
    try {
      const headers = error.response && error.response.headers || {};
      const interesting = Object.keys(headers).filter(h => /retry-after|x-request-id|x-rate-limit/i.test(h));
      if (interesting.length) {
        console.warn('[HF_RETRY] rate-limit headers:', interesting.reduce((acc:any,k)=>{ acc[k]=headers[k]; return acc },{}));
      }
    } catch(e){}

    if (status === 429 || status === 503) {
      if (config.__retryCount >= maxAttempts) return Promise.reject(error);
      config.__retryCount += 1;

      const ra = error.response.headers && (error.response.headers['retry-after'] || error.response.headers['Retry-After']);
      let waitMs = ra ? (parseInt(ra) * 1000) : Math.min(baseDelay * (2 ** config.__retryCount), 30000);
      // full jitter
      waitMs = Math.random() * waitMs;

      await new Promise(r=>setTimeout(r, waitMs));
      return axiosInstance(config);
    }

    return Promise.reject(error);
  });

  return axiosInstance;
}
