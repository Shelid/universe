#!/usr/bin/env node
/**
 * Zero-Dependency Cloudflare Workers + Static Assets CDN Deployer
 *
 * Deploys the entire Universe Explorer SPA (`./dist`) AND all unpacked 3D models & 4K textures
 * (`./dist/models/spaceship/*` — 657 MB total, < 25 MiB per file) directly to Cloudflare's global
 * CDN edge (`https://universe-explorer.douker-universe.workers.dev`) using the official
 * Cloudflare Workers Direct Upload API.
 *
 * Reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from environment variables or `.env.local`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const WORKER_NAME = process.env.CF_WORKER_NAME || 'universe-explorer';
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const ENV_LOCAL_PATH = path.resolve(process.cwd(), '.env.local');

function loadEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL_PATH)) return;
  const lines = fs.readFileSync(ENV_LOCAL_PATH, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnvLocal();

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error(
    'Erro: Defina CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN no ambiente ou em .env.local'
  );
  process.exit(1);
}

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MiB Cloudflare Workers Static Assets limit

function buildManifest(dir) {
  const manifest = {};
  const fileByHash = new Map();

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name === '.assetsignore' || entry.name.startsWith('.')) continue;
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_ASSET_BYTES) {
          console.warn(
            `Ignorando arquivo > 25 MiB (${(stat.size / (1024 * 1024)).toFixed(1)} MB): ${fullPath}`
          );
          continue;
        }
        const relPath = '/' + path.relative(dir, fullPath).replace(/\\/g, '/');
        const ext = path.extname(fullPath).slice(1);
        const buf = fs.readFileSync(fullPath);
        const b64 = buf.toString('base64');
        const hash = crypto
          .createHash('sha256')
          .update(b64 + ext)
          .digest('hex')
          .slice(0, 32);

        manifest[relPath] = { hash, size: buf.length };
        fileByHash.set(hash, { fullPath, relPath, mime: getMimeType(fullPath), size: buf.length });
      }
    }
  }

  walk(dir);
  return { manifest, fileByHash };
}

const WORKER_SCRIPT = String.raw`
import { DurableObject } from 'cloudflare:workers';

function sanitizeRoomCode(raw) {
  const cleaned = String(raw || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  return cleaned || 'GLOBAL';
}

function sanitizeCallsign(raw) {
  const cleaned = String(raw || '').replace(/[<>\r\n\t]/g, '').trim().slice(0, 22);
  return cleaned || ('Piloto-' + Math.floor(1000 + Math.random() * 9000));
}

export class UniverseRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.chatHistory = [];
  }

  getActivePlayers(excludeWs) {
    const sockets = this.ctx.getWebSockets();
    const list = [];
    for (const ws of sockets) {
      if (ws === excludeWs) continue;
      const att = ws.deserializeAttachment();
      if (att && att.id) list.push(att);
    }
    return list;
  }

  broadcast(payload, excludeWs) {
    const serialized = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excludeWs) continue;
      try { ws.send(serialized); } catch {}
    }
  }

  async fetch(request) {
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

    const initialAttachment = {
      id: playerId,
      callsign,
      roomCode,
      mode: 'EXPLORE',
      shipId,
      charId,
      anchorBodyId: 'earth',
      rx: 0, ry: 0, rz: 0,
      qx: 0, qy: 0, qz: 0, qw: 1,
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
      server.send(JSON.stringify({
        type: 'welcome',
        playerId,
        roomCode,
        isGlobal: roomCode === 'GLOBAL',
        players: existingPlayers,
        chatHistory: this.chatHistory.slice(-24),
      }));
    } catch {}

    this.broadcast({ type: 'join', player: initialAttachment }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== 'string') return;
    let data;
    try { data = JSON.parse(message); } catch { return; }
    const att = ws.deserializeAttachment();
    if (!att) return;

    if (data.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong', ts: Date.now() })); } catch {}
      return;
    }

    if (data.type === 'state') {
      const next = {
        ...att,
        callsign: typeof data.callsign === 'string' ? sanitizeCallsign(data.callsign) : att.callsign,
        mode: (data.mode === 'SPACECRAFT' || data.mode === 'EVA' || data.mode === 'EXPLORE') ? data.mode : att.mode,
        shipId: typeof data.shipId === 'string' ? data.shipId.slice(0, 32) : att.shipId,
        charId: typeof data.charId === 'string' ? data.charId.slice(0, 32) : att.charId,
        anchorBodyId: typeof data.anchorBodyId === 'string' ? data.anchorBodyId.slice(0, 32) : att.anchorBodyId,
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
        miningColor: typeof data.miningColor === 'string' ? data.miningColor.slice(0, 16) : '#38bdf8',
        shipScale: Number.isFinite(Number(data.shipScale)) ? Math.max(1e-7, Math.min(10, Number(data.shipScale))) : att.shipScale,
        updatedAt: Date.now(),
      };
      ws.serializeAttachment(next);
      this.broadcast({ type: 'state', player: next }, ws);
      return;
    }

    if (data.type === 'chat') {
      const rawText = String(data.text || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 180);
      if (!rawText) return;
      const item = {
        id: crypto.randomUUID().slice(0, 8),
        playerId: att.id,
        callsign: att.callsign,
        text: rawText,
        ts: Date.now(),
      };
      this.chatHistory.push(item);
      if (this.chatHistory.length > 30) this.chatHistory.splice(0, this.chatHistory.length - 30);
      this.broadcast({ type: 'chat', msg: item });
      return;
    }

    if (data.type === 'seismic') {
      const ev = {
        id: crypto.randomUUID().slice(0, 8),
        playerId: att.id,
        callsign: att.callsign,
        bodyId: typeof data.bodyId === 'string' ? data.bodyId.slice(0, 32) : 'earth',
        nx: Number(data.nx) || 0,
        ny: Number(data.ny) || 1,
        nz: Number(data.nz) || 0,
        resourceId: typeof data.resourceId === 'string' ? data.resourceId.slice(0, 32) : 'helium-3',
        colorHex: typeof data.colorHex === 'string' ? data.colorHex.slice(0, 16) : '#38bdf8',
        ts: Date.now(),
      };
      this.broadcast({ type: 'seismic', event: ev }, ws);
    }
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment();
    try { ws.close(); } catch {}
    if (att && att.id) {
      this.broadcast({ type: 'leave', playerId: att.id, callsign: att.callsign }, ws);
    }
  }

  async webSocketError(ws) {
    const att = ws.deserializeAttachment();
    try { ws.close(); } catch {}
    if (att && att.id) {
      this.broadcast({ type: 'leave', playerId: att.id, callsign: att.callsign }, ws);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/ws/room/') || url.pathname.startsWith('/api/room/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const roomCode = sanitizeRoomCode(parts[2] || 'GLOBAL');
      const id = env.UNIVERSE_ROOM.idFromName(roomCode);
      const stub = env.UNIVERSE_ROOM.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('room', roomCode);
      return stub.fetch(new Request(forwardUrl.toString(), request));
    }

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/models/')) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, If-None-Match, Content-Type',
        },
      });
    }
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
  }
};
`.trim();

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Pasta dist/ não encontrada. Execute "npm run build" primeiro.');
    process.exit(1);
  }

  console.log('1/4 Escaneando arquivos em dist/ (incluindo modelos 3D e texturas)...');
  const { manifest, fileByHash } = buildManifest(DIST_DIR);
  const fileCount = Object.keys(manifest).length;
  let totalBytes = 0;
  for (const info of Object.values(manifest)) totalBytes += info.size;
  console.log(
    `   -> ${fileCount} arquivos prontos (${(totalBytes / (1024 * 1024)).toFixed(2)} MB totais).`
  );

  console.log('2/4 Iniciando sessão de upload no Cloudflare Workers Static Assets...');
  const sessionRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/assets-upload-session`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ manifest }),
    }
  );
  const sessionJson = await sessionRes.json();
  if (!sessionRes.ok || !sessionJson.success) {
    console.error('Falha ao criar sessão de upload:', JSON.stringify(sessionJson, null, 2));
    process.exit(1);
  }

  const uploadJwt = sessionJson.result.jwt;
  const buckets = sessionJson.result.buckets || [];
  let completionJwt = uploadJwt;

  if (buckets.length === 0) {
    console.log('3/4 Todos os arquivos 3D/texturas já estão no cache da CDN da Cloudflare! (0 bytes para reenviar)');
  } else {
    console.log(`3/4 Enviando ${buckets.length} lote(s) de arquivos para a CDN global da Cloudflare...`);
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const form = new FormData();
      let bucketBytes = 0;
      for (const hash of bucket) {
        const info = fileByHash.get(hash);
        if (!info) throw new Error(`Hash não encontrado: ${hash}`);
        const b64 = fs.readFileSync(info.fullPath).toString('base64');
        bucketBytes += info.size;
        form.append(hash, new Blob([b64], { type: info.mime }), hash);
      }

      console.log(
        `   -> Lote [${i + 1}/${buckets.length}] (${bucket.length} arquivo(s), ${(
          bucketBytes /
          (1024 * 1024)
        ).toFixed(2)} MB)...`
      );

      let uploadedOk = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const upRes = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/assets/upload?base64=true`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${uploadJwt}`,
              },
              body: form,
            }
          );
          const upJson = await upRes.json();
          if (!upRes.ok || !upJson.success) {
            throw new Error(`HTTP ${upRes.status}: ${JSON.stringify(upJson)}`);
          }
          if (upJson.result?.jwt) {
            completionJwt = upJson.result.jwt;
          }
          uploadedOk = true;
          break;
        } catch (err) {
          console.warn(`      Tentativa ${attempt}/3 falhou (${err.message}), tentando novamente...`);
          if (attempt === 3) throw err;
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      if (!uploadedOk) process.exit(1);
    }
  }

  console.log('4/4 Publicando Worker + Durable Object (Multiplayer) na Cloudflare...');
  // Check whether DO migration tag v1 is already applied on this Worker script
  let hasV1Migration = false;
  try {
    const settingsRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/settings`,
      { headers: { Authorization: `Bearer ${API_TOKEN}` } }
    );
    const settingsJson = await settingsRes.json();
    const curBindings = settingsJson?.result?.bindings || [];
    hasV1Migration = curBindings.some(
      (b) => b.type === 'durable_object_namespace' && b.class_name === 'UniverseRoom'
    );
  } catch {
    hasV1Migration = false;
  }

  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2026-03-01',
    assets: {
      jwt: completionJwt,
      config: {
        not_found_handling: 'single-page-application',
        run_worker_first: ['/models/*', '/ws/*', '/api/*'],
      },
    },
    bindings: [
      { type: 'assets', name: 'ASSETS' },
      {
        type: 'durable_object_namespace',
        name: 'UNIVERSE_ROOM',
        class_name: 'UniverseRoom',
      },
    ],
    ...(hasV1Migration
      ? {}
      : {
          migrations: {
            new_tag: 'v1',
            new_sqlite_classes: ['UniverseRoom'],
          },
        }),
  };

  const deployForm = new FormData();
  deployForm.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  deployForm.append(
    'worker.mjs',
    new Blob([WORKER_SCRIPT], { type: 'application/javascript+module' }),
    'worker.mjs'
  );

  const deployRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      body: deployForm,
    }
  );
  const deployJson = await deployRes.json();
  if (!deployRes.ok || !deployJson.success) {
    console.error('Falha ao publicar Worker:', JSON.stringify(deployJson, null, 2));
    process.exit(1);
  }

  // Enable workers.dev subdomain route for this Worker
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/subdomain`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enabled: true }),
    }
  );

  const subRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/subdomain`,
    {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    }
  );
  const subJson = await subRes.json();
  const sub = subJson?.result?.subdomain || 'douker-universe';

  console.log(`\n✅ Deploy concluído com sucesso na Cloudflare!`);
  console.log(`🌐 URL do Jogo + CDN de Modelos 3D: https://${WORKER_NAME}.${sub}.workers.dev`);
}

main().catch((err) => {
  console.error('Erro inesperado no deploy:', err);
  process.exit(1);
});
