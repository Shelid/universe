/**
 * Cloudflare Worker + Durable Object (`UniverseRoom`) Entrypoint for Universe Explorer
 *
 * - Real-time Multiplayer via Cloudflare Durable Objects WebSocket Hibernation API (`/ws/room/:code`)
 *   - Default room `GLOBAL`: Shared open universe where all players fly, mine, and EVA together.
 *   - Private rooms (`/ws/room/ORBITA-123`): Isolated Durable Object instances by room code.
 * - Serves `/models/*` from Cloudflare R2 (`MODELS_BUCKET`) or Workers Static Assets (`ASSETS`).
 * - Serves the React + Three.js SPA (`./dist`) via Workers Static Assets (`ASSETS`).
 */
import { DurableObject } from 'cloudflare:workers';

export interface R2ObjectBodyLike {
  body: ReadableStream;
  httpEtag: string;
  size: number;
  range?: { offset: number; length: number };
  writeHttpMetadata(headers: Headers): void;
}

export interface R2BucketLike {
  get(
    key: string,
    options?: { range?: Headers | { offset?: number; length?: number; suffix?: number } }
  ): Promise<R2ObjectBodyLike | null>;
  head(
    key: string
  ): Promise<{ httpEtag: string; size: number; writeHttpMetadata(headers: Headers): void } | null>;
}

export interface Env {
  UNIVERSE_ROOM: DurableObjectNamespace;
  MODELS_BUCKET?: R2BucketLike;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
}

interface PlayerAttachment {
  id: string;
  callsign: string;
  roomCode: string;
  mode: 'EXPLORE' | 'SPACECRAFT' | 'EVA';
  shipId: string;
  charId: string;
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
  updatedAt: number;
}

interface ChatItem {
  id: string;
  playerId: string;
  callsign: string;
  text: string;
  ts: number;
  system?: boolean;
}

function sanitizeRoomCode(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
  return cleaned || 'GLOBAL';
}

function sanitizeCallsign(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/[<>\r\n\t]/g, '')
    .trim()
    .slice(0, 22);
  return cleaned || `Piloto-${Math.floor(1000 + Math.random() * 9000)}`;
}

export class UniverseRoom extends DurableObject<Env> {
  private chatHistory: ChatItem[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private getActivePlayers(excludeWs?: WebSocket): PlayerAttachment[] {
    const sockets = this.ctx.getWebSockets();
    const list: PlayerAttachment[] = [];
    for (const ws of sockets) {
      if (ws === excludeWs) continue;
      const att = ws.deserializeAttachment() as PlayerAttachment | null;
      if (att && att.id) list.push(att);
    }
    return list;
  }

  private broadcast(payload: unknown, excludeWs?: WebSocket): void {
    const serialized = JSON.stringify(payload);
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      if (ws === excludeWs) continue;
      try {
        ws.send(serialized);
      } catch {
        // ignore closed sockets
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const roomCode = sanitizeRoomCode(url.searchParams.get('room') || 'GLOBAL');

    if (url.pathname.endsWith('/info')) {
      const players = this.getActivePlayers();
      return Response.json(
        { roomCode, isGlobal: roomCode === 'GLOBAL', onlineCount: players.length },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const playerId = crypto.randomUUID().slice(0, 8);
    const callsign = sanitizeCallsign(url.searchParams.get('callsign') || '');
    const shipId = url.searchParams.get('shipId') || 'sr7-vanguard';
    const charId = url.searchParams.get('charId') || 'cmd-artemis';

    const initialAttachment: PlayerAttachment = {
      id: playerId,
      callsign,
      roomCode,
      mode: 'EXPLORE',
      shipId,
      charId,
      anchorBodyId: 'earth',
      rx: 0,
      ry: 0,
      rz: 0,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      thr: 0,
      boost: false,
      mining: false,
      miningColor: '#38bdf8',
      shipScale: 0.00018,
      updatedAt: Date.now(),
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(initialAttachment);

    const existingPlayers = this.getActivePlayers(server);
    try {
      server.send(
        JSON.stringify({
          type: 'welcome',
          playerId,
          roomCode,
          isGlobal: roomCode === 'GLOBAL',
          players: existingPlayers,
          chatHistory: this.chatHistory.slice(-24),
        })
      );
    } catch {
      // ignore immediate send failure
    }

    this.broadcast({ type: 'join', player: initialAttachment }, server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }

    const att = ws.deserializeAttachment() as PlayerAttachment | null;
    if (!att) return;

    const msgType = data.type;
    if (msgType === 'ping') {
      try {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      } catch {
        // ignore
      }
      return;
    }

    if (msgType === 'state') {
      const next: PlayerAttachment = {
        ...att,
        callsign:
          typeof data.callsign === 'string' ? sanitizeCallsign(data.callsign) : att.callsign,
        mode:
          data.mode === 'SPACECRAFT' || data.mode === 'EVA' || data.mode === 'EXPLORE'
            ? data.mode
            : att.mode,
        shipId: typeof data.shipId === 'string' ? data.shipId.slice(0, 32) : att.shipId,
        charId: typeof data.charId === 'string' ? data.charId.slice(0, 32) : att.charId,
        anchorBodyId:
          typeof data.anchorBodyId === 'string' ? data.anchorBodyId.slice(0, 32) : att.anchorBodyId,
        rx: Number.isFinite(Number(data.rx)) ? Number(data.rx) : att.rx,
        ry: Number.isFinite(Number(data.ry)) ? Number(data.ry) : att.ry,
        rz: Number.isFinite(Number(data.rz)) ? Number(data.rz) : att.rz,
        qx: Number.isFinite(Number(data.qx)) ? Number(data.qx) : att.qx,
        qy: Number.isFinite(Number(data.qy)) ? Number(data.qy) : att.qy,
        qz: Number.isFinite(Number(data.qz)) ? Number(data.qz) : att.qz,
        qw: Number.isFinite(Number(data.qw)) ? Number(data.qw) : att.qw,
        thr: Number.isFinite(Number(data.thr)) ? Number(data.thr) : 0,
        boost: Boolean(data.boost),
        mining: Boolean(data.mining),
        miningColor:
          typeof data.miningColor === 'string' ? data.miningColor.slice(0, 16) : '#38bdf8',
        shipScale: Number.isFinite(Number(data.shipScale))
          ? Math.max(1e-7, Math.min(10, Number(data.shipScale)))
          : att.shipScale,
        updatedAt: Date.now(),
      };
      ws.serializeAttachment(next);
      this.broadcast({ type: 'state', player: next }, ws);
      return;
    }

    if (msgType === 'chat') {
      const rawText = String(data.text || '')
        .replace(/[\r\n\t]/g, ' ')
        .trim()
        .slice(0, 180);
      if (!rawText) return;
      const item: ChatItem = {
        id: crypto.randomUUID().slice(0, 8),
        playerId: att.id,
        callsign: att.callsign,
        text: rawText,
        ts: Date.now(),
      };
      this.chatHistory.push(item);
      if (this.chatHistory.length > 30) {
        this.chatHistory.splice(0, this.chatHistory.length - 30);
      }
      this.broadcast({ type: 'chat', msg: item });
      return;
    }

    if (msgType === 'seismic') {
      const ev = {
        id: crypto.randomUUID().slice(0, 8),
        playerId: att.id,
        callsign: att.callsign,
        bodyId: typeof data.bodyId === 'string' ? data.bodyId.slice(0, 32) : 'earth',
        nx: Number(data.nx) || 0,
        ny: Number(data.ny) || 1,
        nz: Number(data.nz) || 0,
        resourceId:
          typeof data.resourceId === 'string' ? data.resourceId.slice(0, 32) : 'helium-3',
        colorHex: typeof data.colorHex === 'string' ? data.colorHex.slice(0, 16) : '#38bdf8',
        ts: Date.now(),
      };
      this.broadcast({ type: 'seismic', event: ev }, ws);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as PlayerAttachment | null;
    try {
      ws.close();
    } catch {
      // ignore
    }
    if (att?.id) {
      this.broadcast({ type: 'leave', playerId: att.id, callsign: att.callsign }, ws);
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as PlayerAttachment | null;
    try {
      ws.close();
    } catch {
      // ignore
    }
    if (att?.id) {
      this.broadcast({ type: 'leave', playerId: att.id, callsign: att.callsign }, ws);
    }
  }
}

const MIME_BY_EXT: Record<string, string> = {
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
};

function inferContentType(key: string): string {
  const lower = key.toLowerCase();
  for (const [ext, mime] of Object.entries(MIME_BY_EXT)) {
    if (lower.endsWith(ext)) return mime;
  }
  return 'application/octet-stream';
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, If-None-Match, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, ETag',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Real-Time Multiplayer WebSocket & Room Info routed to Durable Objects
    if (url.pathname.startsWith('/ws/room/') || url.pathname.startsWith('/api/room/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const rawCode = parts[2] || 'GLOBAL';
      const roomCode = sanitizeRoomCode(rawCode);
      const id = env.UNIVERSE_ROOM.idFromName(roomCode);
      const stub = env.UNIVERSE_ROOM.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('room', roomCode);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/models/')) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 2. Serve 3D models & textures from Cloudflare R2 (`MODELS_BUCKET`) if bound
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname.startsWith('/models/') &&
      env.MODELS_BUCKET
    ) {
      const objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

      if (request.method === 'HEAD') {
        const headObj = await env.MODELS_BUCKET.head(objectKey);
        if (headObj) {
          const headers = new Headers(CORS_HEADERS);
          headObj.writeHttpMetadata(headers);
          if (!headers.has('Content-Type')) {
            headers.set('Content-Type', inferContentType(objectKey));
          }
          headers.set('ETag', headObj.httpEtag);
          headers.set('Content-Length', String(headObj.size));
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          return new Response(null, { status: 200, headers });
        }
      } else {
        const hasRange = request.headers.has('range');
        const r2Obj = await env.MODELS_BUCKET.get(
          objectKey,
          hasRange ? { range: request.headers } : undefined
        );

        if (r2Obj) {
          const headers = new Headers(CORS_HEADERS);
          r2Obj.writeHttpMetadata(headers);
          if (!headers.has('Content-Type')) {
            headers.set('Content-Type', inferContentType(objectKey));
          }
          headers.set('ETag', r2Obj.httpEtag);
          headers.set('Accept-Ranges', 'bytes');
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');

          if (hasRange && r2Obj.range) {
            const { offset, length } = r2Obj.range;
            headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${r2Obj.size}`);
            headers.set('Content-Length', String(length));
            return new Response(r2Obj.body, { status: 206, headers });
          }

          headers.set('Content-Length', String(r2Obj.size));
          return new Response(r2Obj.body, { status: 200, headers });
        }
      }
    }

    // 3. Fallback to Workers Static Assets (SPA)
    const response = await env.ASSETS.fetch(request);
    if (url.pathname.startsWith('/models/')) {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    return response;
  },
};
