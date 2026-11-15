#!/usr/bin/env node
/**
 * Automatic Uploader for Large 3D Models (600 MB - 1 GB+) to Cloudflare R2
 *
 * Scans `public/models/` and uploads every `.gltf`, `.glb`, `.bin`, and `.png` file
 * into the `universe-3d-models` Cloudflare R2 bucket with proper MIME types and Cache-Control.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'universe-3d-models';
const MODELS_DIR = path.resolve(process.cwd(), 'public', 'models');

const MIME_BY_EXT = {
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ktx2': 'image/ktx2',
};

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
    } else if (entry.isFile() && !entry.name.startsWith('.')) {
      out.push(full);
    }
  }
  return out;
}

const files = walkFiles(MODELS_DIR);
console.log(`Found ${files.length} 3D asset files in ${MODELS_DIR} to upload to R2 bucket "${BUCKET_NAME}"...`);

let uploaded = 0;
for (const filePath of files) {
  const relFromPublic = path.relative(path.resolve(process.cwd(), 'public'), filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXT[ext] || 'application/octet-stream';
  uploaded++;
  console.log(`[${uploaded}/${files.length}] Uploading ${relFromPublic} (${contentType})...`);

  const res = spawnSync(
    process.execPath,
    [
      './node_modules/wrangler/bin/wrangler.js',
      'r2',
      'object',
      'put',
      `${BUCKET_NAME}/${relFromPublic}`,
      '--file',
      filePath,
      '--content-type',
      contentType,
      '--cache-control',
      'public, max-age=31536000, immutable',
      '--remote',
    ],
    { stdio: 'inherit' }
  );

  if (res.status !== 0) {
    console.error(`Failed uploading ${relFromPublic} (exit code ${res.status})`);
    process.exit(res.status || 1);
  }
}

console.log(`Successfully uploaded all ${uploaded} 3D assets to Cloudflare R2 bucket "${BUCKET_NAME}"!`);
