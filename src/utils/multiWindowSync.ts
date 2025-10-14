type Message = { type: 'INIT' | 'STATE_UPDATE' | 'REQUEST_STATE' | 'CLOSE'; panelId?: string; state?: any };

export default class MultiWindowSync {
  channel: BroadcastChannel | null;
  constructor(channelName = 'zc_panels') {
    this.channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel(channelName) : null;
  }

  onMessage(fn: (msg: Message) => void) {
    if (!this.channel) return () => {};
    const handler = (ev: MessageEvent) => {
      try { fn(ev.data as Message); } catch (err) { console.warn(err); }
    };
    this.channel.addEventListener('message', handler as EventListener);
    return () => this.channel?.removeEventListener('message', handler as EventListener);
  }

  post(msg: Message) {
    try { this.channel?.postMessage(msg); } catch (err) { console.warn('broadcast failed', err); }
  }

  close() { this.channel?.close(); }
}
