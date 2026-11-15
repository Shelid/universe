/**
 * Cloudflare Worker Entrypoint for Universe Explorer
 *
 * - Serves `/models/*` (600 MB - 1 GB+ 3D models, .gltf, .glb, .bin, and 4K/8K textures)
 *   directly from Cloudflare R2 (`MODELS_BUCKET`) with zero egress fees, HTTP Range support,
 *   immutable CDN caching, and CORS headers.
 * - Serves the React + Three.js SPA (`./dist`) via Workers Static Assets (`ASSETS`).
 */

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
  head(key: string): Promise<{ httpEtag: string; size: number; writeHttpMetadata(headers: Headers): void } | null>;
}

export interface Env {
  MODELS_BUCKET?: R2BucketLike;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
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

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/models/')) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Serve 3D models & textures from Cloudflare R2 (`MODELS_BUCKET`)
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

    // Fallback to Workers Static Assets (SPA)
    return env.ASSETS.fetch(request);
  },
};
