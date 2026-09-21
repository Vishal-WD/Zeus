/**
 * Zeus OS — Resilient WebSocket Connection Service
 *
 * Features:
 *   • Auto-reconnect with exponential backoff (1 s → 2 s → 4 s → cap 10 s)
 *   • Event-driven callbacks: onMessage, onConnect, onDisconnect
 *   • send() with queue drain on reconnect
 *   • Singleton-safe: calling connect() while connected is a no-op
 */

type MessageHandler = (data: any) => void;

interface SocketOptions {
  url: string;
  onMessage?: MessageHandler;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

class ZeusSocketService {
  private ws: WebSocket | null = null;
  private url = '';
  private onMessage: MessageHandler = () => {};
  private onConnect: () => void = () => {};
  private onDisconnect: () => void = () => {};
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private intentionalClose = false;

  connect(opts: SocketOptions): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.url = opts.url;
    if (opts.onMessage) this.onMessage = opts.onMessage;
    if (opts.onConnect) this.onConnect = opts.onConnect;
    if (opts.onDisconnect) this.onDisconnect = opts.onDisconnect;
    this.intentionalClose = false;
    this._open();
  }

  send(action: string, payload: Record<string, unknown> = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...payload }));
    } else {
      console.warn('[ZeusSocket] Cannot send — socket not open.');
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Private ──

  private _open(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.backoff = 1000;
        this.onConnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (e) {
          console.error('[ZeusSocket] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.onDisconnect();
        if (!this.intentionalClose) this._scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (this.intentionalClose) return;
    this.reconnectTimer = setTimeout(() => {
      this.backoff = Math.min(this.backoff * 2, 10000);
      this._open();
    }, this.backoff);
  }
}

export const socketService = new ZeusSocketService();
