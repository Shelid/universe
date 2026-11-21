import {
  CharacterVariantId,
  MiningResourceId,
  MultiplayerChatMessage,
  MultiplayerConnectionStatus,
  MultiplayerMode,
  MultiplayerSeismicEvent,
  RemotePlayerState,
  SpacecraftVariantId,
} from '../types/astronomy';

const CALLSIGN_STORAGE_KEY = 'universe_explorer_callsign_v1';
const PROD_WS_HOST = 'universe-explorer.douker-universe.workers.dev';

export interface LocalMultiplayerBroadcast {
  mode: MultiplayerMode;
  shipId: SpacecraftVariantId;
  charId: CharacterVariantId;
  anchorBodyId: string;
  rx: number;
  ry: number;
  rz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  thr: number;
  boost: boolean;
  mining: boolean;
  miningColor: string;
  shipScale: number;
}

export interface MultiplayerClientCallbacks {
  onStatusChange: (status: MultiplayerConnectionStatus) => void;
  onWelcome: (info: {
    playerId: string;
    roomCode: string;
    isGlobal: boolean;
    players: RemotePlayerState[];
    chatHistory: MultiplayerChatMessage[];
  }) => void;
  onPlayerUpdate: (player: RemotePlayerState, isNewJoin: boolean) => void;
  onPlayerLeave: (playerId: string, callsign: string) => void;
  onChatMessage: (msg: MultiplayerChatMessage) => void;
  onSeismicEvent: (event: MultiplayerSeismicEvent) => void;
}

export function sanitizeRoomCodeClient(raw: string): string {
  const cleaned = String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
  return cleaned || 'GLOBAL';
}

export function generatePrivateRoomCode(): string {
  const prefixes = ['ORBITA', 'COSMOS', 'NOVA', 'VEGA', 'ANDROMEDA', 'TITAN', 'SOLARIS'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

export function loadSavedCallsign(): string {
  try {
    const saved = localStorage.getItem(CALLSIGN_STORAGE_KEY);
    if (saved && saved.trim().length >= 2) {
      return saved.trim().slice(0, 22);
    }
  } catch {
    // ignore
  }
  const fresh = `Piloto-${Math.floor(1000 + Math.random() * 9000)}`;
  saveCallsign(fresh);
  return fresh;
}

export function saveCallsign(callsign: string): string {
  const clean = String(callsign || '')
    .replace(/[<>\r\n\t]/g, '')
    .trim()
    .slice(0, 22);
  const finalName = clean || `Piloto-${Math.floor(1000 + Math.random() * 9000)}`;
  try {
    localStorage.setItem(CALLSIGN_STORAGE_KEY, finalName);
  } catch {
    // ignore
  }
  return finalName;
}

export function getInitialRoomCodeFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const sala = params.get('sala') || params.get('room');
    if (sala && sala.trim().length > 0) {
      return sanitizeRoomCodeClient(sala);
    }
  } catch {
    // ignore
  }
  return 'GLOBAL';
}

export function buildRoomInviteUrl(roomCode: string): string {
  try {
    const u = new URL(window.location.href);
    const code = sanitizeRoomCodeClient(roomCode);
    if (code === 'GLOBAL') {
      u.searchParams.delete('sala');
      u.searchParams.delete('room');
    } else {
      u.searchParams.set('sala', code);
      u.searchParams.delete('room');
    }
    return u.toString();
  } catch {
    return `https://${PROD_WS_HOST}/?sala=${encodeURIComponent(roomCode)}`;
  }
}

function resolveWsUrl(
  roomCode: string,
  callsign: string,
  shipId: SpacecraftVariantId,
  charId: CharacterVariantId
): string {
  const envBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_MP_WS_BASE;
  // Always route WebSockets to our Cloudflare Durable Objects Edge Server so players on
  // Cloudflare Workers, Netlify, localhost, or any custom domain share the EXACT same live world!
  const isWorkersOrigin = window.location.hostname.endsWith('.workers.dev');
  const base =
    envBase ||
    (isWorkersOrigin
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
      : `wss://${PROD_WS_HOST}`);

  const params = new URLSearchParams({
    callsign,
    shipId,
    charId,
  });
  return `${base}/ws/room/${encodeURIComponent(sanitizeRoomCodeClient(roomCode))}?${params.toString()}`;
}

export class UniverseMultiplayerClient {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerClientCallbacks;
  private roomCode = 'GLOBAL';
  private callsign = 'Piloto';
  private shipId: SpacecraftVariantId = 'sr7-vanguard';
  private charId: CharacterVariantId = 'cmd-artemis';
  private shouldStayConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private lastStateSentMs = 0;
  private lastBroadcastKey = '';

  constructor(callbacks: MultiplayerClientCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(
    roomCode: string,
    callsign: string,
    shipId: SpacecraftVariantId,
    charId: CharacterVariantId
  ): void {
    this.roomCode = sanitizeRoomCodeClient(roomCode);
    this.callsign = saveCallsign(callsign);
    this.shipId = shipId;
    this.charId = charId;
    this.shouldStayConnected = true;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  public updateIdentity(
    callsign: string,
    shipId: SpacecraftVariantId,
    charId: CharacterVariantId
  ): void {
    this.callsign = saveCallsign(callsign);
    this.shipId = shipId;
    this.charId = charId;
    this.lastBroadcastKey = '';
  }

  public switchRoom(roomCode: string): void {
    const clean = sanitizeRoomCodeClient(roomCode);
    if (clean === this.roomCode && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    this.roomCode = clean;
    this.shouldStayConnected = true;
    this.reconnectAttempts = 0;
    this.openSocket();
  }

  public disconnect(): void {
    this.shouldStayConnected = false;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.callbacks.onStatusChange('OFFLINE');
  }

  public sendLocalState(payload: LocalMultiplayerBroadcast, force = false): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    const compactKey = `${payload.mode}|${payload.anchorBodyId}|${payload.shipId}|${payload.mining}|${payload.boost}|${payload.rx.toFixed(5)}|${payload.ry.toFixed(5)}|${payload.rz.toFixed(5)}|${payload.qx.toFixed(3)}|${payload.qy.toFixed(3)}|${payload.qz.toFixed(3)}`;
    const isChanged = compactKey !== this.lastBroadcastKey;
    const minInterval = isChanged ? 66 : 1400; // ~15 Hz when moving, heartbeat every 1.4s when stationary
    if (!force && now - this.lastStateSentMs < minInterval) return;

    this.lastStateSentMs = now;
    this.lastBroadcastKey = compactKey;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'state',
          callsign: this.callsign,
          ...payload,
        })
      );
    } catch {
      // ignore transient socket write error
    }
  }

  public sendChat(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      this.ws.send(JSON.stringify({ type: 'chat', text: trimmed.slice(0, 180) }));
    } catch {
      // ignore
    }
  }

  public sendSeismicEvent(ev: {
    bodyId: string;
    nx: number;
    ny: number;
    nz: number;
    resourceId: MiningResourceId;
    colorHex: string;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: 'seismic', ...ev }));
    } catch {
      // ignore
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private openSocket(): void {
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.callbacks.onStatusChange(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');
    const wsUrl = resolveWsUrl(this.roomCode, this.callsign, this.shipId, this.charId);

    try {
      const sock = new WebSocket(wsUrl);
      this.ws = sock;

      sock.onopen = () => {
        if (this.ws !== sock) return;
        this.reconnectAttempts = 0;
        this.lastBroadcastKey = '';
        this.callbacks.onStatusChange('CONNECTED');
        this.pingTimer = window.setInterval(() => {
          if (sock.readyState === WebSocket.OPEN) {
            try {
              sock.send(JSON.stringify({ type: 'ping' }));
            } catch {
              // ignore
            }
          }
        }, 25000);
      };

      sock.onmessage = (event) => {
        if (this.ws !== sock || typeof event.data !== 'string') return;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }
        if (data.type === 'welcome') {
          this.callbacks.onWelcome({
            playerId: String(data.playerId || ''),
            roomCode: String(data.roomCode || this.roomCode),
            isGlobal: Boolean(data.isGlobal),
            players: Array.isArray(data.players) ? (data.players as RemotePlayerState[]) : [],
            chatHistory: Array.isArray(data.chatHistory)
              ? (data.chatHistory as MultiplayerChatMessage[])
              : [],
          });
        } else if (data.type === 'join' && data.player) {
          this.callbacks.onPlayerUpdate(data.player as RemotePlayerState, true);
        } else if (data.type === 'state' && data.player) {
          this.callbacks.onPlayerUpdate(data.player as RemotePlayerState, false);
        } else if (data.type === 'leave' && typeof data.playerId === 'string') {
          this.callbacks.onPlayerLeave(data.playerId, String(data.callsign || 'Piloto'));
        } else if (data.type === 'chat' && data.msg) {
          this.callbacks.onChatMessage(data.msg as MultiplayerChatMessage);
        } else if (data.type === 'seismic' && data.event) {
          this.callbacks.onSeismicEvent(data.event as MultiplayerSeismicEvent);
        }
      };

      sock.onclose = () => {
        if (this.ws !== sock) return;
        this.clearTimers();
        if (!this.shouldStayConnected) {
          this.callbacks.onStatusChange('OFFLINE');
          return;
        }
        this.callbacks.onStatusChange('RECONNECTING');
        this.reconnectAttempts = Math.min(6, this.reconnectAttempts + 1);
        const delayMs = Math.min(8000, 900 * Math.pow(1.65, this.reconnectAttempts - 1));
        this.reconnectTimer = window.setTimeout(() => {
          if (this.shouldStayConnected) this.openSocket();
        }, delayMs);
      };

      sock.onerror = () => {
        // onclose will trigger reconnect cleanly
      };
    } catch {
      this.callbacks.onStatusChange('OFFLINE');
    }
  }
}
