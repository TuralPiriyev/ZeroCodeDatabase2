import { fetchWithBackoff } from './fetchWithBackoff';

type QueueItem = {
  url: string;
  opts: RequestInit;
  resolve: (r: Response) => void;
  reject: (e: any) => void;
};

const queue: QueueItem[] = [];
let running = 0;
const CONCURRENCY = 2; // allow small concurrency to reduce bursts

async function worker() {
  if (running >= CONCURRENCY) return;
  const item = queue.shift();
  if (!item) return;
  running++;
  try {
    const res = await fetchWithBackoff(item.url, item.opts, 3, 400);
    item.resolve(res);
  } catch (e) {
    item.reject(e);
  } finally {
    running--;
    // schedule next
    setTimeout(() => worker(), 0);
  }
}

export function enqueueRequest(url: string, opts: RequestInit = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    queue.push({ url, opts, resolve, reject });
    // start workers up to concurrency
    for (let i = 0; i < CONCURRENCY; i++) worker();
  });
}
