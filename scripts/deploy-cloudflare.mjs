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

const WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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

  console.log('4/4 Publicando Worker e ativando rota pública na Cloudflare...');
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2026-03-01',
    assets: {
      jwt: completionJwt,
      config: {
        not_found_handling: 'single-page-application',
        run_worker_first: ['/models/*'],
      },
    },
    bindings: [{ type: 'assets', name: 'ASSETS' }],
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
