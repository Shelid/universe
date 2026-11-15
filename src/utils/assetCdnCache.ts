/**
 * Persistent Browser Cache + Cloudflare Global CDN Resolver for Large 3D Assets (600 MB - 1 GB+)
 *
 * - Primary Cloudflare Global CDN endpoint:
 *   `https://universe-explorer.douker-universe.workers.dev/models`
 * - Automatically serves from same-origin `/models/*` on localhost and `*.workers.dev`,
 *   and from the Cloudflare Global CDN when hosted on Netlify or custom domains.
 * - Persists downloaded binary geometry (.bin) and textures (.png) in the browser's
 *   Cache Storage API (`universe-3d-assets-v1`) on the player's disk so subsequent loads
 *   are instant (~100ms) with zero network transfer.
 */

const ASSET_CACHE_NAME = 'universe-3d-assets-v1';
export const CLOUDFLARE_MODELS_CDN_URL =
  'https://universe-explorer.douker-universe.workers.dev/models';

/**
 * Resolves a model path (e.g. `spaceship/spaceship.gltf`) against `VITE_ASSETS_CDN_URL`
 * or the Cloudflare Global CDN (`https://universe-explorer.douker-universe.workers.dev/models`).
 */
export function resolveModelAssetUrl(relativePath: string): string {
  const cleanRel = relativePath.replace(/^\/+/, '').replace(/^models\/+/, '');
  const envCdn = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_ASSETS_CDN_URL;
  if (envCdn && envCdn.trim().length > 0) {
    const base = envCdn.trim().replace(/\/+$/, '');
    return `${base}/${cleanRel}`;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalOrWorkers =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.workers.dev');
    if (!isLocalOrWorkers) {
      return `${CLOUDFLARE_MODELS_CDN_URL}/${cleanRel}`;
    }
  }

  return `/models/${cleanRel}`;
}

/**
 * Fetches a 3D asset (JSON, .bin buffer, or texture Blob) with persistent Cache Storage
 * and automatic fallback to the Cloudflare Global CDN if a local file is missing.
 */
export async function fetchCachedAssetResponse(url: string): Promise<Response> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return fetch(url);
  }

  try {
    const cache = await window.caches.open(ASSET_CACHE_NAME);
    const cached = await cache.match(url);
    if (cached && cached.ok) {
      return cached;
    }

    let netRes = await fetch(url);
    // Automatic fallback to Cloudflare CDN if local `/models/...` returns 404
    if (!netRes.ok && url.startsWith('/models/')) {
      const cdnUrl = `${CLOUDFLARE_MODELS_CDN_URL}/${url.replace(/^\/models\/+/, '')}`;
      netRes = await fetch(cdnUrl);
    }

    if (netRes.ok && netRes.status === 200) {
      try {
        await cache.put(url, netRes.clone());
      } catch {
        // Ignore quota errors on low-disk devices; network response still succeeds
      }
    }
    return netRes;
  } catch {
    return fetch(url);
  }
}

export async function fetchCachedBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetchCachedAssetResponse(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

export async function fetchCachedArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetchCachedAssetResponse(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}
