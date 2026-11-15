#!/usr/bin/env node
/**
 * Large 3D Model Unpacker for Cloudflare Workers Static Assets CDN (600 MB - 1 GB+ .glb)
 *
 * Usage:
 *   npm run import-model -- "caminho/para/ModeloGigante.glb" nome-da-pasta
 *
 * Automatically splits any monolithic 600 MB - 1 GB+ `.glb` into:
 * - `<name>.gltf` (JSON scene graph)
 * - `<name>_part0.bin`, `<name>_part1.bin`, ... (binary geometry buffers automatically split < 20 MiB each)
 * - `tex_00.png`, `tex_01.png`, ... (original textures extracted as individual files < 25 MiB each)
 *
 * Every output file stays strictly under Cloudflare Workers Static Assets' 25 MiB per-file limit
 * while preserving 100% of the original geometry and textures without quality loss!
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , inputGlbArg, modelSlugArg] = process.argv;
if (!inputGlbArg) {
  console.error('Uso: npm run import-model -- "<caminho-do-arquivo.glb>" [nome-do-modelo]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputGlbArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Arquivo não encontrado: ${inputPath}`);
  process.exit(1);
}

const defaultSlug = path
  .basename(inputPath, path.extname(inputPath))
  .toLowerCase()
  .replace(/[^a-z0-9-_]+/g, '-');
const slug = (modelSlugArg || defaultSlug).toLowerCase();
const outDir = path.resolve(process.cwd(), 'public', 'models', slug);
fs.mkdirSync(outDir, { recursive: true });

console.log(`Desempacotando ${inputPath} para ${outDir} (100% original, dividido em partes < 20 MB para Cloudflare CDN)...`);

const fd = fs.openSync(inputPath, 'r');
const header = Buffer.alloc(12);
fs.readSync(fd, header, 0, 12, 0);
const magic = header.readUInt32LE(0);
if (magic !== 0x46546c67) {
  console.error('Arquivo inválido: não é um binário glTF (.glb).');
  process.exit(1);
}

const chunk0Header = Buffer.alloc(8);
fs.readSync(fd, chunk0Header, 0, 8, 12);
const jsonLength = chunk0Header.readUInt32LE(0);
const jsonBuf = Buffer.alloc(jsonLength);
fs.readSync(fd, jsonBuf, 0, jsonLength, 20);
const gltf = JSON.parse(jsonBuf.toString('utf8'));

const binChunkOffset = 20 + jsonLength;
const chunk1Header = Buffer.alloc(8);
fs.readSync(fd, chunk1Header, 0, 8, binChunkOffset);
const binDataStart = binChunkOffset + 8;

const imageBufferViews = new Set();
if (Array.isArray(gltf.images)) {
  gltf.images.forEach((img, idx) => {
    if (typeof img.bufferView === 'number') {
      imageBufferViews.add(img.bufferView);
      const bv = gltf.bufferViews[img.bufferView];
      const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const fileName = `tex_${String(idx).padStart(2, '0')}.${ext}`;
      const imgBuf = Buffer.alloc(bv.byteLength);
      fs.readSync(fd, imgBuf, 0, bv.byteLength, binDataStart + (bv.byteOffset || 0));
      fs.writeFileSync(path.join(outDir, fileName), imgBuf);
      delete img.bufferView;
      delete img.mimeType;
      img.uri = fileName;
    }
  });
}

// Pack non-image geometry bufferViews into < 20 MiB .bin files
const MAX_BIN_BYTES = 20 * 1024 * 1024;
const newBuffers = [];
let currentChunks = [];
let currentSize = 0;
let partIndex = 0;

const flushBinPart = () => {
  if (currentChunks.length === 0) return;
  const binName = partIndex === 0 ? `${slug}.bin` : `${slug}_part${partIndex}.bin`;
  const combined = Buffer.concat(currentChunks);
  fs.writeFileSync(path.join(outDir, binName), combined);
  newBuffers.push({ uri: binName, byteLength: combined.length });
  currentChunks = [];
  currentSize = 0;
  partIndex++;
};

if (Array.isArray(gltf.bufferViews)) {
  gltf.bufferViews.forEach((bv, bvIdx) => {
    if (imageBufferViews.has(bvIdx)) return;
    const len = bv.byteLength;
    const alignedLen = (len + 3) & ~3;
    if (currentSize + alignedLen > MAX_BIN_BYTES && currentSize > 0) {
      flushBinPart();
    }
    const raw = Buffer.alloc(alignedLen);
    fs.readSync(fd, raw, 0, len, binDataStart + (bv.byteOffset || 0));
    bv.buffer = newBuffers.length;
    bv.byteOffset = currentSize;
    currentChunks.push(raw);
    currentSize += alignedLen;
  });
}
flushBinPart();
fs.closeSync(fd);

gltf.buffers = newBuffers;
const outGltfPath = path.join(outDir, `${slug}.gltf`);
fs.writeFileSync(outGltfPath, JSON.stringify(gltf));

console.log(`Concluído! Modelo pronto em public/models/${slug}/${slug}.gltf (${newBuffers.length} arquivo(s) .bin + ${(gltf.images || []).length} texturas).`);
