import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SR7SpacecraftRefs {
  rootGroup: THREE.Group;
  hullGroup: THREE.Group;
  interiorGroup: THREE.Group;
  cockpitSeatAnchor: THREE.Object3D;
  pilotSeatAnchor: THREE.Group;
  chaseCameraAnchor: THREE.Object3D;
  yokeGroup: THREE.Group;
  throttleGroup: THREE.Group;
  leftPlumeMesh: THREE.Mesh;
  rightPlumeMesh: THREE.Mesh;
  leftCoreMesh: THREE.Mesh;
  rightCoreMesh: THREE.Mesh;
  leftWingTipGlow: THREE.Mesh;
  rightWingTipGlow: THREE.Mesh;
  leftAileron: THREE.Mesh;
  rightAileron: THREE.Mesh;
  headlightLeftSpot: THREE.SpotLight;
  headlightRightSpot: THREE.SpotLight;
  headlightBeamGroup: THREE.Group;
  radarDishGroup: THREE.Group;
  sensorTurretGroup: THREE.Group;
  radarPulseRing: THREE.Mesh;
  pfdCanvas: HTMLCanvasElement;
  pfdMat: THREE.MeshBasicMaterial;
  navCanvas: HTMLCanvasElement;
  navMat: THREE.MeshBasicMaterial;
  sysCanvas: HTMLCanvasElement;
  sysMat: THREE.MeshBasicMaterial;
  holoCanvas: HTMLCanvasElement;
  holoMat: THREE.MeshBasicMaterial;
  interiorLight: THREE.PointLight;
  strobeLightMesh: THREE.Mesh;
  leftMuzzleFlash: THREE.Mesh;
  rightMuzzleFlash: THREE.Mesh;
  muzzlePositionsLocal: [THREE.Vector3, THREE.Vector3];
  clickableCockpitControls: THREE.Object3D[];
  modelReadyPromise: Promise<void>;
  dispose: () => void;
  updateAnimations: (params: {
    dt: number;
    clockTime: number;
    throttle: number;
    boostActive: boolean;
    headlightsOn: boolean;
    interiorLightsOn: boolean;
    shieldsOn: boolean;
    pitchInput: number;
    rollInput: number;
    yawInput: number;
    pitchDeg: number;
    rollDeg: number;
    radarPulseAgeSec: number;
    muzzleFlashAlpha: number;
    speedFormatted: string;
    nearestName: string;
    nearestDist: string;
    reactorTempC: number;
    sasEnabled: boolean;
    autopilotActive: boolean;
    isCockpitView?: boolean;
    shipScale?: number;
    driftAngleDeg?: number;
  }) => void;
}

/**
 * Partitions the Light Fighter BASE mesh triangles into opaque metallic airframe vs
 * the sloped cockpit windshield dome so 1st-person cockpit view retains full panoramic glass
 * while preserving the authentic exterior silhouette and canopy frame ribs.
 */
function partitionLightFighterCanopy(
  baseMesh: THREE.Mesh,
  glbScene: THREE.Object3D,
  canopyGlassMat: THREE.Material
): THREE.Mesh | null {
  const geo = baseMesh.geometry;
  const posAttr = geo.getAttribute('position');
  const uvAttr = geo.getAttribute('uv');
  const indexAttr = geo.getIndex();
  if (!posAttr || !indexAttr) return null;

  glbScene.updateMatrixWorld(true);
  const toRawMatrix = baseMesh.matrixWorld;

  let texData: Uint8ClampedArray | null = null;
  const sampleSize = 128;
  try {
    const stdMat = baseMesh.material as THREE.MeshStandardMaterial;
    const img = stdMat?.map?.image as CanvasImageSource | undefined;
    if (img) {
      const c = document.createElement('canvas');
      c.width = sampleSize;
      c.height = sampleSize;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
        texData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      }
    }
  } catch {
    texData = null;
  }

  const opaqueIndices: number[] = [];
  const glassIndices: number[] = [];
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const count = indexAttr.count;

  const wrapUnit = (val: number) => ((val % 1) + 1) % 1;

  for (let t = 0; t < count; t += 3) {
    const i0 = indexAttr.getX(t);
    const i1 = indexAttr.getX(t + 1);
    const i2 = indexAttr.getX(t + 2);

    p0.fromBufferAttribute(posAttr, i0).applyMatrix4(toRawMatrix);
    p1.fromBufferAttribute(posAttr, i1).applyMatrix4(toRawMatrix);
    p2.fromBufferAttribute(posAttr, i2).applyMatrix4(toRawMatrix);

    const cx = (p0.x + p1.x + p2.x) / 3;
    const cy = (p0.y + p1.y + p2.y) / 3;
    const cz = (p0.z + p1.z + p2.z) / 3;

    let isGlass = false;
    if (cz > 2.2 && cz < 4.1 && cy > 1.32 && Math.abs(cx) < 0.9) {
      if (texData && uvAttr) {
        const u = wrapUnit((uvAttr.getX(i0) + uvAttr.getX(i1) + uvAttr.getX(i2)) / 3);
        const v = wrapUnit((uvAttr.getY(i0) + uvAttr.getY(i1) + uvAttr.getY(i2)) / 3);
        const px = Math.min(sampleSize - 1, Math.floor(u * sampleSize));
        const py = Math.min(sampleSize - 1, Math.floor(v * sampleSize));
        const pix = (py * sampleSize + px) * 4;
        const r = texData[pix];
        const g = texData[pix + 1];
        const b = texData[pix + 2];
        isGlass = b - r >= 6 || (b > g && b > r + 3);
      } else {
        isGlass = cz > 2.48 && cz < 4.02 && cy > 1.54 && Math.abs(cx) < 0.72;
      }
    }

    if (isGlass) {
      glassIndices.push(i0, i1, i2);
    } else {
      opaqueIndices.push(i0, i1, i2);
    }
  }

  if (glassIndices.length === 0) return null;

  geo.setIndex(opaqueIndices);

  const glassGeo = new THREE.BufferGeometry();
  glassGeo.setAttribute('position', posAttr);
  const normAttr = geo.getAttribute('normal');
  if (normAttr) glassGeo.setAttribute('normal', normAttr);
  if (uvAttr) glassGeo.setAttribute('uv', uvAttr);
  glassGeo.setIndex(glassIndices);

  const glassMesh = new THREE.Mesh(glassGeo, canopyGlassMat);
  glassMesh.name = 'light-fighter-canopy-glass';
  glassMesh.renderOrder = 6;
  baseMesh.parent?.add(glassMesh);
  return glassMesh;
}

/**
 * Custom volumetric GLSL Mach-diamond plasma exhaust shader for SR-7 twin main engines.
 */
function createPlasmaPlumeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uThrottle: { value: 0 },
      uBoost: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrottle;
      uniform float uBoost;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;

      void main() {
        float axial = clamp(1.0 - vUv.y, 0.0, 1.0);
        vec3 viewDir = normalize(vViewPos);
        float rim = abs(dot(normalize(vNormalView), viewDir));
        float radialCore = pow(rim, 1.35);

        // Animated supersonic Mach shock diamonds
        float wave = sin(axial * 24.0 - uTime * (14.0 + uBoost * 18.0));
        float diamonds = smoothstep(0.15, 0.95, wave) * pow(1.0 - axial, 0.7);

        vec3 idleCol = vec3(0.98, 0.58, 0.12);
        vec3 hotCol = vec3(1.0, 0.85, 0.45);
        vec3 warpCol = vec3(0.22, 0.82, 1.0);
        vec3 warpCore = vec3(0.88, 0.98, 1.0);

        vec3 baseColor = mix(idleCol, hotCol, clamp(uThrottle, 0.0, 1.0));
        baseColor = mix(baseColor, warpCol, uBoost);
        vec3 color = mix(baseColor, warpCore, diamonds * (0.45 + 0.5 * uBoost));

        float tailFade = pow(1.0 - axial, 1.55) * smoothstep(0.0, 0.08, axial);
        float powerAlpha = 0.24 + uThrottle * 0.58 + uBoost * 0.45;
        float alpha = radialCore * tailFade * powerAlpha * (0.75 + 0.4 * diamonds);

        gl_FragColor = vec4(color * (1.2 + uBoost * 0.55), clamp(alpha, 0.0, 0.95));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Applies maximum hardware anisotropic filtering and linear mipmap filtering so angled
 * 4K cockpit glass screens, carbon weaves, and console engravings remain razor sharp.
 */
function configureCrispTexture(
  tex: THREE.Texture,
  maxAnisotropy: number,
  isColor = true
): THREE.Texture {
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = Math.max(1, maxAnisotropy);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Ultra-fast dynamic canvas texture configuration:
 * Disables mipmap generation to avoid heavy GPU mipmap recalculation on every MFD update.
 */
function configureDynamicCanvasTexture(
  tex: THREE.CanvasTexture,
  isColor = true
): THREE.CanvasTexture {
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Yellow/black diagonal hazard stripes (ejection & jettison handles).
 */
function createHazardStripeTexture(maxAnisotropy = 16): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(4, 4);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#111111';
  for (let i = -64; i < 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 8, 0);
    ctx.lineTo(i + 8 + 64, 64);
    ctx.lineTo(i + 64, 64);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  configureCrispTexture(tex, maxAnisotropy, true);
  return tex;
}

interface ConsolePanelLabel {
  text: string;
  u: number;
  z: number;
  size?: number;
  color?: string;
  ring?: number;
}

/**
 * Engraved anodized console faceplate decal with 4K crisp backlit legends, Dzus fasteners & tick rings.
 * (u, z) are faceplate-local coordinates in model units; canvas top = forward (-Z).
 */
function createConsolePanelTexture(
  planeW: number,
  planeL: number,
  labels: ConsolePanelLabel[],
  title: string,
  maxAnisotropy = 16
): THREE.CanvasTexture {
  const logicalW = 256;
  const logicalH = Math.round((logicalW * planeL) / planeW);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = logicalW * scale;
  canvas.height = logicalH * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const W = logicalW;
  const H = logicalH;
  const toPx = (u: number, z: number): [number, number] => [
    ((u + planeW / 2) / planeW) * W,
    ((z + planeL / 2) / planeL) * H,
  ];

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#2a3342');
  grad.addColorStop(0.5, '#1f2633');
  grad.addColorStop(1, '#161b24');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle horizontal brushed-metal micro-grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let y = 0; y < H; y += 2) {
    ctx.fillRect(0, y, W, 1);
  }

  // Engraved border & panel seam lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(9.5, 9.5, W - 19, H - 19);

  // Dzus quarter-turn fasteners in the corners
  [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]].forEach(([fx, fy]) => {
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ctx.strokeStyle = '#0b0f17';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(fx - 3.8, fy - 1);
    ctx.lineTo(fx + 3.8, fy + 1);
    ctx.stroke();
  });

  // Title strip
  ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
  ctx.fillRect(14, 26, W - 28, 24);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(14, 26, W - 28, 24);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 14px ui-monospace, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, W / 2, 38);

  labels.forEach((lbl) => {
    const [px, py] = toPx(lbl.u, lbl.z);
    if (lbl.ring) {
      const rPx = (lbl.ring / planeW) * W;
      ctx.strokeStyle = lbl.color || '#94a3b8';
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, rPx, 0, Math.PI * 2);
      ctx.stroke();
      for (let t = 0; t < 12; t++) {
        const a = (t / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * rPx * 1.1, py + Math.sin(a) * rPx * 1.1);
        ctx.lineTo(px + Math.cos(a) * rPx * 1.32, py + Math.sin(a) * rPx * 1.32);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (lbl.text) {
      ctx.fillStyle = lbl.color || '#e2e8f0';
      ctx.font = `bold ${lbl.size || 13}px ui-monospace, Consolas, monospace`;
      ctx.fillText(lbl.text, px, py);
    }
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const tex = new THREE.CanvasTexture(canvas);
  configureCrispTexture(tex, maxAnisotropy, true);
  return tex;
}

/**
 * Generates lightweight woven carbon-fiber & brushed titanium PBR maps for the cockpit.
 */
function createCockpitCarbonTextures(maxAnisotropy = 16): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 128;
  const col = document.createElement('canvas');
  col.width = size;
  col.height = size;
  const ctx = col.getContext('2d')!;

  const bmp = document.createElement('canvas');
  bmp.width = size;
  bmp.height = size;
  const bCtx = bmp.getContext('2d')!;

  const rgh = document.createElement('canvas');
  rgh.width = size;
  rgh.height = size;
  const rCtx = rgh.getContext('2d')!;

  ctx.fillStyle = '#1b222e';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#7c7c7c';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#686868';
  rCtx.fillRect(0, 0, size, size);

  const step = 16;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const parity = ((x / step + y / step) % 2) === 0;
      ctx.fillStyle = parity ? '#263040' : '#151a24';
      ctx.fillRect(x, y, step - 2, step - 2);
      bCtx.fillStyle = parity ? '#9c9c9c' : '#646464';
      bCtx.fillRect(x + 2, y + 2, step - 4, step - 4);
      rCtx.fillStyle = parity ? '#505050' : '#8a8a8a';
      rCtx.fillRect(x, y, step, step);
    }
  }

  const map = new THREE.CanvasTexture(col);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);
  configureCrispTexture(map, maxAnisotropy, true);

  const bumpMap = new THREE.CanvasTexture(bmp);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(16, 16);
  configureCrispTexture(bumpMap, maxAnisotropy, false);

  const roughnessMap = new THREE.CanvasTexture(rgh);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(16, 16);
  configureCrispTexture(roughnessMap, maxAnisotropy, false);

  return { map, bumpMap, roughnessMap };
}

/**
 * Generates ultra-sharp 2048x1360 collimated sapphire-glass holographic reticle for the 3D HUD combiner.
 */
function renderHoloCombiner(
  canvas: HTMLCanvasElement,
  pitchDeg: number,
  rollDeg: number,
  boostActive: boolean,
  driftAngleDeg = 0
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const logicalW = 512;
  const logicalH = 340;
  const sx = canvas.width / logicalW;
  const sy = canvas.height / logicalH;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(sx, 0, 0, sy, 0, 0);

  const w = logicalW;
  const h = logicalH;
  const cx = w * 0.5;
  const cy = h * 0.52;
  const primary = boostActive ? 'rgba(103, 232, 249, 0.96)' : 'rgba(56, 189, 248, 0.92)';
  const subtle = boostActive ? 'rgba(103, 232, 249, 0.52)' : 'rgba(56, 189, 248, 0.42)';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-rollDeg * Math.PI) / 180);

  // Subtle aerospace pitch ladder with degree markers
  ctx.strokeStyle = subtle;
  ctx.fillStyle = subtle;
  ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
  ctx.lineWidth = 1.8;
  const pitchShift = THREE.MathUtils.clamp(-pitchDeg * 1.9, -98, 98);
  [-70, -35, 0, 35, 70].forEach((offsetY, idx) => {
    const y = offsetY + pitchShift;
    const span = offsetY === 0 ? 142 : Math.abs(offsetY) === 35 ? 84 : 58;
    ctx.beginPath();
    ctx.moveTo(-span, y);
    ctx.lineTo(-32, y);
    ctx.moveTo(32, y);
    ctx.lineTo(span, y);
    ctx.stroke();
    if (offsetY !== 0) {
      const degLabel = (2 - idx) * 10;
      ctx.fillText(`${degLabel}`, span + 6, y + 3.5);
    }
  });
  ctx.restore();

  // Top edge-lit sapphire corner ticks (frames the glass combiner without milky background fill)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  [
    [14, 28, 14, 14, 28, 14],
    [w - 28, 14, w - 14, 14, w - 14, 28],
    [14, h - 28, 14, h - 14, 28, h - 14],
    [w - 28, h - 14, w - 14, h - 14, w - 14, h - 28],
  ].forEach(([x1, y1, x2, y2, x3, y3]) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  });

  // Prograde drift marker (flight path vector)
  const driftX = cx + THREE.MathUtils.clamp(driftAngleDeg * 2.6, -125, 125);
  ctx.strokeStyle = boostActive ? '#22d3ee' : '#34d399';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(driftX, cy, 10, 0, Math.PI * 2);
  ctx.moveTo(driftX - 20, cy);
  ctx.lineTo(driftX - 10, cy);
  ctx.moveTo(driftX + 10, cy);
  ctx.lineTo(driftX + 20, cy);
  ctx.moveTo(driftX, cy - 18);
  ctx.lineTo(driftX, cy - 10);
  ctx.stroke();

  // Fixed boresight reticle
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 28, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 44, cy);
  ctx.lineTo(cx - 28, cy);
  ctx.moveTo(cx + 28, cy);
  ctx.lineTo(cx + 44, cy);
  ctx.moveTo(cx, cy - 38);
  ctx.lineTo(cx, cy - 28);
  ctx.stroke();

  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderPFDCanvas(
  canvas: HTMLCanvasElement,
  throttle: number,
  boostActive: boolean,
  speedFormatted: string,
  pitchDeg: number,
  rollDeg: number,
  sasEnabled: boolean,
  driftAngleDeg = 0
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = 512;
  const h = 340;
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);

  ctx.fillStyle = '#030a16';
  ctx.fillRect(0, 0, w, h);

  // Subtle avionics grid lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let gx = 48; gx < w; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 48; gy < h; gy += 48) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  ctx.strokeStyle = boostActive ? '#22d3ee' : '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Artificial Horizon Sphere
  const cx = w * 0.5;
  const cy = h * 0.51;
  const r = 86;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(cx, cy);
  ctx.rotate((-rollDeg * Math.PI) / 180);
  const py = THREE.MathUtils.clamp(pitchDeg * 1.45, -64, 64);
  ctx.fillStyle = '#092b48';
  ctx.fillRect(-130, -130 + py, 260, 130);
  ctx.fillStyle = '#151c24';
  ctx.fillRect(-130, py, 260, 130);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-105, py);
  ctx.lineTo(105, py);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
  ctx.lineWidth = 1.35;
  [-36, -18, 18, 36].forEach((tick) => {
    ctx.beginPath();
    ctx.moveTo(-34, py + tick);
    ctx.lineTo(34, py + tick);
    ctx.stroke();
  });
  ctx.restore();

  // Horizon Ring & Bank Angle Scale
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  for (let aDeg = -60; aDeg <= 60; aDeg += 15) {
    const rad = ((aDeg - 90) * Math.PI) / 180;
    const len = aDeg % 30 === 0 ? 7 : 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
    ctx.lineTo(cx + Math.cos(rad) * (r + len), cy + Math.sin(rad) * (r + len));
    ctx.stroke();
  }

  // Fixed miniature delta craft datum
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.lineTo(cx, cy + 9);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx + 28, cy);
  ctx.stroke();

  // Left Attitudinal Readout Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(16, cy - 36, 118, 72);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, cy - 36, 118, 72);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px ui-monospace, Consolas, monospace';
  ctx.fillText(`ARF  ${pitchDeg >= 0 ? '+' : ''}${Math.round(pitchDeg)}°`, 26, cy - 12);
  ctx.fillText(`ROL  ${rollDeg >= 0 ? '+' : ''}${Math.round(rollDeg)}°`, 26, cy + 8);
  ctx.fillText(`DER  ${Math.round(driftAngleDeg)}°`, 26, cy + 28);

  // Side Thrust Arc Bar (right flank)
  const barX = w - 34;
  const barH = 156;
  const barY = cy - barH * 0.5;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(barX, barY, 14, barH);
  const thrFrac = THREE.MathUtils.clamp(Math.abs(throttle), 0, 1);
  ctx.fillStyle = boostActive ? '#22d3ee' : throttle < 0 ? '#f43f5e' : '#f59e0b';
  ctx.fillRect(barX + 2, barY + barH * (1 - thrFrac), 10, barH * thrFrac);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(barX, barY, 14, barH);

  // Header & Telemetry Readouts
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 18px ui-monospace, Consolas, monospace';
  ctx.fillText('PFD // HORIZONTE', 18, 32);

  ctx.fillStyle = sasEnabled ? '#34d399' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(sasEnabled ? 'SAS ATIVO' : 'DERIVA NEWTON', w - 18, 32);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 21px ui-monospace, Consolas, monospace';
  ctx.fillText(speedFormatted, 18, h - 22);

  ctx.fillStyle = boostActive ? '#22d3ee' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.font = 'bold 19px ui-monospace, Consolas, monospace';
  ctx.fillText(boostActive ? 'DOBRA ATIVA' : `${Math.round(throttle * 100)}% THR`, w - 18, h - 22);
  ctx.textAlign = 'left';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderNavCanvas(
  canvas: HTMLCanvasElement,
  nearestName: string,
  nearestDist: string,
  autopilotActive: boolean,
  clockTime: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = 384;
  const h = 300;
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);

  ctx.fillStyle = '#030a16';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = autopilotActive ? '#f59e0b' : '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  const cx = w * 0.5;
  const cy = h * 0.48;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 1.4;
  [30, 58, 86].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  for (let d = 0; d < 12; d++) {
    const a = (d / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 82, cy + Math.sin(a) * 82);
    ctx.lineTo(cx + Math.cos(a) * 89, cy + Math.sin(a) * 89);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - 88, cy);
  ctx.lineTo(cx + 88, cy);
  ctx.moveTo(cx, cy - 88);
  ctx.lineTo(cx, cy + 88);
  ctx.stroke();

  const sweep = (clockTime * 2.2) % (Math.PI * 2);
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 86);
  grad.addColorStop(0, 'rgba(34, 211, 238, 0.45)');
  grad.addColorStop(1, 'rgba(34, 211, 238, 0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, 86, sweep - 0.35, sweep);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * 86, cy + Math.sin(sweep) * 86);
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 7);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 16px ui-monospace, Consolas, monospace';
  ctx.fillText('RADAR ESPACIAL', 16, 28);

  ctx.fillStyle = autopilotActive ? '#fbbf24' : '#f1f5f9';
  ctx.font = 'bold 16px ui-monospace, Consolas, monospace';
  ctx.fillText(nearestName.toUpperCase().slice(0, 16), 16, h - 38);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px ui-monospace, Consolas, monospace';
  ctx.fillText(nearestDist, 16, h - 15);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function renderSysCanvas(
  canvas: HTMLCanvasElement,
  throttle: number,
  reactorTempC: number,
  shieldsOn: boolean,
  boostActive: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = 384;
  const h = 300;
  ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);

  ctx.fillStyle = '#030a16';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 16px ui-monospace, Consolas, monospace';
  ctx.fillText('PROPULSÃO & NÚCLEO', 16, 28);

  if (shieldsOn) {
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.58)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, 118, 118, 64, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = shieldsOn ? '#38bdf8' : '#64748b';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 56);
  ctx.lineTo(w * 0.61, 102);
  ctx.lineTo(w * 0.84, 146);
  ctx.lineTo(w * 0.84, 168);
  ctx.lineTo(w * 0.59, 168);
  ctx.lineTo(w * 0.5, 180);
  ctx.lineTo(w * 0.41, 168);
  ctx.lineTo(w * 0.16, 168);
  ctx.lineTo(w * 0.16, 146);
  ctx.lineTo(w * 0.39, 102);
  ctx.closePath();
  ctx.stroke();

  const powerFrac = boostActive ? 1.0 : Math.max(0.08, Math.abs(throttle));
  [20, w - 34].forEach((mx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(mx, 56, 14, 118);
    ctx.fillStyle = boostActive ? '#22d3ee' : '#38bdf8';
    ctx.fillRect(mx + 2, 56 + 114 * (1 - powerFrac), 10, 114 * powerFrac);
  });

  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 14px ui-monospace, Consolas, monospace';
  ctx.fillText(`REATOR: ${Math.round(reactorTempC)}°C`, 16, h - 50);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(16, h - 38, w - 32, 12);
  const heatFrac = THREE.MathUtils.clamp((reactorTempC - 280) / 700, 0.08, 1);
  ctx.fillStyle = boostActive ? '#22d3ee' : Math.abs(throttle) > 0.7 ? '#fb923c' : '#10b981';
  ctx.fillRect(16, h - 38, (w - 32) * heatFrac, 12);

  ctx.fillStyle = shieldsOn ? '#a5b4fc' : '#64748b';
  ctx.font = 'bold 13px ui-monospace, Consolas, monospace';
  ctx.fillText(shieldsOn ? 'ESCUDOS: 100% ATIVOS' : 'ESCUDOS: STANDBY', 16, h - 10);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * Builds the photorealistic sculpted 3D SR-7 Tactical Explorer Spacecraft & 4K Panoramic Cockpit.
 * Local orientation: Nose = -Z, Thrusters = +Z, Up = +Y, Right = +X.
 */
export function createSR7Spacecraft3DGroup(options?: { maxAnisotropy?: number }): SR7SpacecraftRefs {
  const maxAniso = Math.max(1, options?.maxAnisotropy ?? 16);
  const rootGroup = new THREE.Group();
  rootGroup.name = 'sr7-spacecraft-root';

  const hullGroup = new THREE.Group();
  rootGroup.add(hullGroup);

  const isNodeEnv = typeof window === 'undefined' || typeof document === 'undefined';
  let disposed = false;

  const { map: carbonMap, bumpMap: carbonBump, roughnessMap: carbonRough } =
    createCockpitCarbonTextures(maxAniso);

  const armorDarkMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    bumpMap: carbonBump,
    bumpScale: 0.012,
    roughnessMap: carbonRough,
    color: '#2c323b',
    roughness: 0.62,
    metalness: 0.72,
    envMapIntensity: 1.35,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    bumpMap: carbonBump,
    bumpScale: 0.008,
    color: '#1b2028',
    roughness: 0.34,
    metalness: 0.88,
    envMapIntensity: 1.4,
  });

  const titaniumTrimMat = new THREE.MeshStandardMaterial({
    color: '#6e7785',
    roughness: 0.28,
    metalness: 0.9,
    envMapIntensity: 1.5,
  });

  const cockpitInteriorTrimMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    bumpMap: carbonBump,
    bumpScale: 0.008,
    roughnessMap: carbonRough,
    color: '#3a495e',
    roughness: 0.5,
    metalness: 0.4,
    envMapIntensity: 1.5,
  });

  const cockpitConsoleMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    bumpMap: carbonBump,
    bumpScale: 0.006,
    color: '#283447',
    roughness: 0.44,
    metalness: 0.54,
    envMapIntensity: 1.55,
  });

  const anodizedBezelMat = new THREE.MeshStandardMaterial({
    color: '#4c5c73',
    roughness: 0.28,
    metalness: 0.86,
    envMapIntensity: 1.55,
  });

  const bolsterLeatherMat = new THREE.MeshStandardMaterial({
    color: '#313a47',
    roughness: 0.68,
    metalness: 0.14,
  });

  const hazardStripeTex = createHazardStripeTexture(maxAniso);
  const hazardStripeMat = new THREE.MeshStandardMaterial({
    map: hazardStripeTex,
    roughness: 0.5,
    metalness: 0.2,
    emissive: '#3a2a00',
    emissiveIntensity: 0.35,
  });

  const harnessStrapMat = new THREE.MeshStandardMaterial({
    color: '#4b5a47',
    roughness: 0.85,
    metalness: 0.05,
  });

  // 100% Crystal-Clear Optical Canopy ShaderMaterial:
  // Virtually zero central tint/opacity so both inside->outside and outside->cockpit views
  // are completely clear (no black film!), with a crisp cyan aerospace glint only on grazing edges.
  const canopyGlassMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uInteriorView: { value: 0.0 },
      uTintColor: { value: new THREE.Color('#7dd3fc') },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uInteriorView;
      uniform vec3 uTintColor;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec3 N = normalize(vNormalView);
        if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(vViewPos);
        float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 4.4);

        float centerAlpha = mix(0.012, 0.0, uInteriorView);
        float edgeAlpha = mix(0.28, 0.075, uInteriorView);
        float alpha = mix(centerAlpha, edgeAlpha, fresnel);

        vec3 glassColor = mix(uTintColor * 1.15, vec3(0.90, 0.97, 1.0), fresnel * 0.72);
        gl_FragColor = vec4(glassColor, alpha);
      }
    `,
  });

  const clickableCockpitControls: THREE.Object3D[] = [];

  // ============================================================================
  // 1. LIGHT FIGHTER EXTERIOR AIRFRAME (Uploaded GLB Asset + Canopy Glass Split)
  // ============================================================================
  // Normalized local transform: scale 0.50 (wingspan ~6.14, length ~5.39),
  // rotated Math.PI around Y so Nose = -Z and Thrusters = +Z, vertically centered on cockpit floor.
  const glbWrapper = new THREE.Group();
  glbWrapper.name = 'light-fighter-glb-wrapper';
  glbWrapper.scale.setScalar(0.5);
  hullGroup.add(glbWrapper);

  // Temporary lightweight silhouette wireframe placeholder removed automatically when GLB finishes loading
  const placeholderMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.65, 3.8, 6),
    new THREE.MeshBasicMaterial({ color: '#475569', wireframe: true, transparent: true, opacity: 0.35 })
  );
  placeholderMesh.rotation.x = -Math.PI / 2;
  hullGroup.add(placeholderMesh);

  const disposeNodeResources = (node: THREE.Object3D) => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    node.traverse((obj) => {
      const msh = obj as THREE.Mesh;
      if (msh.geometry) geometries.add(msh.geometry);
      const mats = Array.isArray(msh.material) ? msh.material : msh.material ? [msh.material] : [];
      mats.forEach((mt) => {
        if (!mt) return;
        materials.add(mt);
        Object.values(mt).forEach((val) => {
          if (val && (val as THREE.Texture).isTexture) {
            textures.add(val as THREE.Texture);
          }
        });
      });
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((mt) => mt.dispose());
    textures.forEach((tx) => tx.dispose());
  };

  let modelReadyPromise: Promise<void> = Promise.resolve();

  if (!isNodeEnv) {
    const loader = new GLTFLoader();
    modelReadyPromise = new Promise<void>((resolve) => {
      loader.load(
        '/models/light-fighter.glb',
        (gltf) => {
          if (disposed) {
            disposeNodeResources(gltf.scene);
            resolve();
            return;
          }
          const loadedRoot = gltf.scene;

          let baseMesh: THREE.Mesh | null = null;
          loadedRoot.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.frustumCulled = false;
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.isMeshStandardMaterial) {
                mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.45);
                [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.emissiveMap].forEach((tx) => {
                  if (tx) {
                    tx.anisotropy = maxAniso;
                    tx.needsUpdate = true;
                  }
                });
                mat.needsUpdate = true;
              }
              if (mesh.name.includes('BASE') && !baseMesh) {
                baseMesh = mesh;
              }
            }
          });

          // Partition canopy glass BEFORE rotating/offsetting loadedRoot so local raw-GLB
          // bounds (cz in 2.2..4.1, cy > 1.32) match cleanly!
          if (baseMesh) {
            const glassMesh = partitionLightFighterCanopy(baseMesh, loadedRoot, canopyGlassMat);
            if (glassMesh) {
              glassMesh.frustumCulled = false;
            }
          }

          loadedRoot.rotation.y = Math.PI;
          loadedRoot.position.set(0, -1.08, 2.1);

          glbWrapper.add(loadedRoot);
          hullGroup.remove(placeholderMesh);
          placeholderMesh.geometry.dispose();
          (placeholderMesh.material as THREE.Material).dispose();
          resolve();
        },
        undefined,
        () => {
          // Non-fatal fallback: resolve cleanly so initial scene boot never stalls
          resolve();
        }
      );
    });
  }

  // ============================================================================
  // 2. CLEAN HIGH-PERFORMANCE GLASS COCKPIT INTERIOR (ZERO FRAGMENTS & SUPER FAST)
  // ============================================================================
  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'sr7-cockpit-interior';
  interiorGroup.scale.setScalar(0.7);
  interiorGroup.position.set(0, 0.078, 0.15);
  rootGroup.add(interiorGroup);

  // 1. Cockpit Structural Tub (Floor, Bulkheads & Coaming)
  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.025, 1.15),
    armorDarkMat
  );
  floorMesh.position.set(0, -0.015, -1.05);
  interiorGroup.add(floorMesh);

  // Forward Firewall Bulkhead (below forward instrument panel)
  const forwardBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.32, 0.03),
    armorDarkMat
  );
  forwardBulkhead.position.set(0, 0.14, -1.56);
  interiorGroup.add(forwardBulkhead);

  // Rear Pressurized Bulkhead (behind pilot seat)
  const rearBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.58, 0.04),
    cockpitInteriorTrimMat
  );
  rearBulkhead.position.set(0, 0.28, -0.52);
  interiorGroup.add(rearBulkhead);

  // Side Coaming Sills (Left & Right)
  [-1, 1].forEach((side) => {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.28, 1.12),
      armorDarkMat
    );
    sideWall.position.set(side * 0.355, 0.13, -1.05);
    interiorGroup.add(sideWall);

    // Leather padded armrest / elbow sill
    const armrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.024, 0.85),
      bolsterLeatherMat
    );
    armrest.position.set(side * 0.355, 0.265, -0.98);
    interiorGroup.add(armrest);

    // Titanium structural sill rail
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.012, 0.85),
      titaniumTrimMat
    );
    rail.position.set(side * 0.315, 0.265, -0.98);
    interiorGroup.add(rail);
  });

  // Articulated Footwell Yaw/Brake Rudder Pedals
  const createRudderPedal = (side: -1 | 1) => {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.010), anodizedBezelMat);
    pedal.position.set(side * 0.09, 0.035, -1.48);
    pedal.rotation.x = -0.35;
    interiorGroup.add(pedal);
    return pedal;
  };
  const leftRudderPedal = createRudderPedal(-1);
  const rightRudderPedal = createRudderPedal(1);

  // 2. Forward Main Dashboard & Glare-Shield Brow
  const dashBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.14, 0.26),
    cockpitConsoleMat
  );
  dashBase.position.set(0, 0.09, -1.34);
  interiorGroup.add(dashBase);

  // Glare-shield brow (clean visor cleanly above MFDs, well below pilot eye line!)
  const browHood = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.022, 0.20),
    cockpitInteriorTrimMat
  );
  browHood.position.set(0, 0.21, -1.32);
  browHood.rotation.x = 0.06;
  interiorGroup.add(browHood);

  // Indirect cyan LED accent strip under the brow lip
  const browGlowStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.004, 0.008),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  browGlowStrip.position.set(0, 0.202, -1.22);
  interiorGroup.add(browGlowStrip);

  // Center Sloped Tactical Pedestal (between knees)
  const centerPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.08, 0.30),
    cockpitConsoleMat
  );
  centerPedestal.position.set(0, 0.04, -1.18);
  centerPedestal.rotation.x = -0.15;
  interiorGroup.add(centerPedestal);

  // Pedestal status indicators
  ['#38bdf8', '#10b981', '#fbbf24'].forEach((barHex, idx) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.004, 0.012),
      new THREE.MeshBasicMaterial({ color: barHex })
    );
    strip.position.set(0, 0.085 - idx * 0.008, -1.22 + idx * 0.045);
    strip.rotation.x = -0.15;
    interiorGroup.add(strip);
  });

  // 3. Helper to Mount Bezeled MFD Displays (Zero Z-Fighting)
  const mountMfdScreen = (
    w: number,
    h: number,
    screenMat: THREE.Material,
    pos: THREE.Vector3,
    rotY: number,
    rotX: number
  ) => {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.order = 'YXZ';
    group.rotation.y = rotY;
    group.rotation.x = rotX;

    // Dark CNC aluminum bezel backplate
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.018, h + 0.016, 0.012),
      anodizedBezelMat
    );
    frame.position.z = -0.006;
    group.add(frame);

    // Titanium frame border rim
    const rimH = new THREE.BoxGeometry(w + 0.018, 0.004, 0.006);
    const rimV = new THREE.BoxGeometry(0.004, h + 0.016, 0.006);
    const topRim = new THREE.Mesh(rimH, titaniumTrimMat);
    topRim.position.set(0, (h + 0.016) * 0.5 - 0.002, 0.001);
    const botRim = new THREE.Mesh(rimH, titaniumTrimMat);
    botRim.position.set(0, -(h + 0.016) * 0.5 + 0.002, 0.001);
    const leftRim = new THREE.Mesh(rimV, titaniumTrimMat);
    leftRim.position.set(-(w + 0.018) * 0.5 + 0.002, 0, 0.001);
    const rightRim = new THREE.Mesh(rimV, titaniumTrimMat);
    rightRim.position.set((w + 0.018) * 0.5 - 0.002, 0, 0.001);
    group.add(topRim, botRim, leftRim, rightRim);

    // Active Screen Plane (cleanly 2.5mm in front of bezel frame — ZERO Z-fighting!)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat);
    screen.position.z = 0.0025;
    group.add(screen);

    // Green avionics online status LED pip
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.003, 0.002),
      new THREE.MeshBasicMaterial({ color: '#34d399' })
    );
    led.position.set(w * 0.5 - 0.004, h * 0.5 + 0.004, 0.003);
    group.add(led);

    interiorGroup.add(group);
    return screen;
  };

  // 4. TRIPLE HIGH-DPI COCKPIT MFD SCREENS (512x340 & 384x300 — Super Sharp & Ultra-Fast!)
  const pfdCanvas = document.createElement('canvas');
  pfdCanvas.width = 512;
  pfdCanvas.height = 340;
  renderPFDCanvas(pfdCanvas, 0, false, '0 km/s', 0, 0, true, 0);
  const pfdTex = configureDynamicCanvasTexture(new THREE.CanvasTexture(pfdCanvas), true);
  const pfdMat = new THREE.MeshBasicMaterial({ map: pfdTex });
  mountMfdScreen(
    0.190,
    0.126,
    pfdMat,
    new THREE.Vector3(0, 0.146, -1.285),
    0,
    -0.22
  );

  const navCanvas = document.createElement('canvas');
  navCanvas.width = 384;
  navCanvas.height = 300;
  renderNavCanvas(navCanvas, 'Terra', '0 km', false, 0);
  const navTex = configureDynamicCanvasTexture(new THREE.CanvasTexture(navCanvas), true);
  const navMat = new THREE.MeshBasicMaterial({ map: navTex });
  mountMfdScreen(
    0.155,
    0.120,
    navMat,
    new THREE.Vector3(-0.192, 0.142, -1.250),
    0.35,
    -0.20
  );

  const sysCanvas = document.createElement('canvas');
  sysCanvas.width = 384;
  sysCanvas.height = 300;
  renderSysCanvas(sysCanvas, 0, 340, true, false);
  const sysTex = configureDynamicCanvasTexture(new THREE.CanvasTexture(sysCanvas), true);
  const sysMat = new THREE.MeshBasicMaterial({ map: sysTex });
  mountMfdScreen(
    0.155,
    0.120,
    sysMat,
    new THREE.Vector3(0.192, 0.142, -1.250),
    -0.35,
    -0.20
  );

  // 5. 3D Translucent Collimated Sapphire Glass HUD Combiner
  const holoCanvas = document.createElement('canvas');
  holoCanvas.width = 512;
  holoCanvas.height = 340;
  renderHoloCombiner(holoCanvas, 0, 0, false, 0);
  const holoTex = configureDynamicCanvasTexture(new THREE.CanvasTexture(holoCanvas), true);
  const holoMat = new THREE.MeshBasicMaterial({
    map: holoTex,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const holoGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.170, 0.105), holoMat);
  holoGlass.position.set(0, 0.285, -1.30);
  holoGlass.rotation.x = -0.16;
  holoGlass.renderOrder = 8;
  interiorGroup.add(holoGlass);

  // Collimator Projector & Dual Titanium Mounting Posts
  const collimatorLens = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.008, 0.016),
    new THREE.MeshBasicMaterial({ color: '#0ea5e9' })
  );
  collimatorLens.position.set(0, 0.222, -1.30);
  interiorGroup.add(collimatorLens);

  [-0.08, 0.08].forEach((sx) => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.005, 0.065, 14),
      titaniumTrimMat
    );
    post.position.set(sx, 0.260, -1.30);
    post.rotation.x = -0.16;
    interiorGroup.add(post);
  });

  // 6. Left Console: Propulsion, Throttle Quadrant & Clickable Switches
  const leftConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.05, 0.42),
    cockpitConsoleMat
  );
  leftConsole.position.set(-0.255, 0.09, -0.98);
  leftConsole.rotation.z = -0.22;
  interiorGroup.add(leftConsole);

  // Console plate & decal
  const plateW = 0.125;
  const plateL = 0.230;
  const leftLabels: ConsolePanelLabel[] = [
    { text: 'FARÓIS', u: -0.01, z: -0.04, size: 12, color: '#fde047', ring: 0.016 },
    { text: 'SAS', u: -0.01, z: 0.02, size: 12, color: '#34d399', ring: 0.016 },
    { text: 'CABINE', u: -0.01, z: 0.08, size: 12, color: '#38bdf8', ring: 0.016 },
    { text: 'O2', u: 0.035, z: -0.06, size: 10, color: '#cbd5e1' },
    { text: 'APU', u: 0.035, z: -0.02, size: 10, color: '#cbd5e1' },
    { text: 'COM', u: 0.035, z: 0.02, size: 10, color: '#cbd5e1' },
    { text: 'ECS', u: 0.035, z: 0.06, size: 10, color: '#cbd5e1' },
  ];
  const leftDecalTex = createConsolePanelTexture(plateW, plateL, leftLabels, 'SISTEMAS', maxAniso);
  const leftDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(plateW, plateL),
    new THREE.MeshStandardMaterial({
      map: leftDecalTex,
      emissive: '#ffffff',
      emissiveMap: leftDecalTex,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.4,
    })
  );
  leftDecal.rotation.x = -Math.PI / 2;
  leftDecal.position.set(-0.255, 0.118, -0.98);
  leftDecal.rotation.z = -0.22;
  interiorGroup.add(leftDecal);

  // Clickable push switches on Left Console
  const switchGeo = new THREE.CylinderGeometry(0.009, 0.010, 0.008, 20);
  const leftSwitches = [
    { id: 'headlights', color: '#fde047', z: -0.04 },
    { id: 'sas', color: '#34d399', z: 0.02 },
    { id: 'interior_lights', color: '#38bdf8', z: 0.08 },
  ];
  leftSwitches.forEach((sw) => {
    const btn = new THREE.Mesh(switchGeo, new THREE.MeshBasicMaterial({ color: sw.color }));
    btn.position.set(-0.265, 0.126, -0.98 + sw.z);
    btn.rotation.z = -0.22;
    btn.userData = { kind: 'cockpit_button', action: sw.id };
    interiorGroup.add(btn);
    clickableCockpitControls.push(btn);
  });

  // Sliding HOTAS Throttle Quadrant (animated with throttle!)
  const throttleSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.006, 0.13),
    anodizedBezelMat
  );
  throttleSlot.position.set(-0.215, 0.116, -0.98);
  interiorGroup.add(throttleSlot);

  const throttleGroup = new THREE.Group();
  throttleGroup.position.set(-0.215, 0.120, -0.98);

  const tLever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.05, 12),
    titaniumTrimMat
  );
  tLever.position.set(0, 0.025, 0);
  throttleGroup.add(tLever);

  const tGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.050, 20),
    gunmetalMat
  );
  tGrip.rotation.z = Math.PI / 2;
  tGrip.position.set(0, 0.050, 0);
  tGrip.userData = { kind: 'cockpit_button', action: 'throttle_step' };
  throttleGroup.add(tGrip);
  clickableCockpitControls.push(tGrip);

  const tBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.004, 0.006),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  tBand.position.set(0, 0.060, -0.008);
  throttleGroup.add(tBand);

  interiorGroup.add(throttleGroup);

  // 7. Right Console: Tactical HOTAS Stick & Clickable Switches
  const rightConsole = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.05, 0.42),
    cockpitConsoleMat
  );
  rightConsole.position.set(0.255, 0.09, -0.98);
  rightConsole.rotation.z = 0.22;
  interiorGroup.add(rightConsole);

  const rightLabels: ConsolePanelLabel[] = [
    { text: 'RADAR', u: 0.01, z: -0.04, size: 12, color: '#22d3ee', ring: 0.016 },
    { text: 'ESCUDO', u: 0.01, z: 0.02, size: 12, color: '#a5b4fc', ring: 0.016 },
    { text: 'DOBRA', u: 0.01, z: 0.08, size: 12, color: '#fb7185', ring: 0.016 },
    { text: 'NAV', u: -0.035, z: -0.06, size: 10, color: '#cbd5e1' },
    { text: 'TRIM', u: -0.035, z: -0.02, size: 10, color: '#cbd5e1' },
    { text: 'AUX', u: -0.035, z: 0.02, size: 10, color: '#cbd5e1' },
    { text: 'HUD', u: -0.035, z: 0.06, size: 10, color: '#cbd5e1' },
  ];
  const rightDecalTex = createConsolePanelTexture(plateW, plateL, rightLabels, 'TÁTICO', maxAniso);
  const rightDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(plateW, plateL),
    new THREE.MeshStandardMaterial({
      map: rightDecalTex,
      emissive: '#ffffff',
      emissiveMap: rightDecalTex,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.4,
    })
  );
  rightDecal.rotation.x = -Math.PI / 2;
  rightDecal.position.set(0.255, 0.118, -0.98);
  rightDecal.rotation.z = 0.22;
  interiorGroup.add(rightDecal);

  // Clickable push switches on Right Console
  const rightSwitches = [
    { id: 'scanner', color: '#22d3ee', z: -0.04 },
    { id: 'shields', color: '#a5b4fc', z: 0.02 },
    { id: 'boost', color: '#fb7185', z: 0.08 },
  ];
  rightSwitches.forEach((sw) => {
    const btn = new THREE.Mesh(switchGeo, new THREE.MeshBasicMaterial({ color: sw.color }));
    btn.position.set(0.265, 0.126, -0.98 + sw.z);
    btn.rotation.z = 0.22;
    btn.userData = { kind: 'cockpit_button', action: sw.id };
    interiorGroup.add(btn);
    clickableCockpitControls.push(btn);
  });

  // Ergonomic HOTAS Flight Stick in yokeGroup (animated with pitch/roll/yaw!)
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0.225, 0.118, -0.98);

  const stickBoot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.026, 0.020, 20),
    bolsterLeatherMat
  );
  yokeGroup.add(stickBoot);

  const stickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.005, 0),
    new THREE.Vector3(0, 0.045, -0.006),
    new THREE.Vector3(0, 0.085, 0.006),
    new THREE.Vector3(0, 0.115, 0.002),
  ]);
  const stickColumn = new THREE.Mesh(
    new THREE.TubeGeometry(stickCurve, 20, 0.008, 14, false),
    titaniumTrimMat
  );
  yokeGroup.add(stickColumn);

  const stickGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.012, 0.040, 20),
    gunmetalMat
  );
  stickGrip.position.set(0, 0.120, 0.002);
  stickGrip.rotation.x = 0.20;
  yokeGroup.add(stickGrip);

  // Red Weapons Fire Trigger Button (clickable to fire lasers!)
  const fireTrigger = new THREE.Mesh(
    new THREE.SphereGeometry(0.0065, 16, 14),
    new THREE.MeshBasicMaterial({ color: '#ef4444' })
  );
  fireTrigger.position.set(0, 0.132, -0.014);
  fireTrigger.userData = { kind: 'cockpit_button', action: 'fire' };
  yokeGroup.add(fireTrigger);
  clickableCockpitControls.push(fireTrigger);

  // Top castle hat & cyan indicator
  const hatMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.008, 0.006, 16),
    anodizedBezelMat
  );
  hatMesh.position.set(0, 0.144, 0.006);
  yokeGroup.add(hatMesh);

  interiorGroup.add(yokeGroup);

  // 8. Ergonomic Sci-Fi Pilot Ejection Seat
  const seatGroup = new THREE.Group();
  seatGroup.position.set(0, 0.04, -0.78);

  // Seat pan
  const seatPan = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.28), armorDarkMat);
  seatGroup.add(seatPan);

  // Leather seat cushion
  const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.024, 0.24), bolsterLeatherMat);
  seatCushion.position.set(0, 0.030, 0);
  seatGroup.add(seatCushion);

  // Seat backrest (reclined 12 degrees)
  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.04), armorDarkMat);
  seatBack.position.set(0, 0.21, 0.12);
  seatBack.rotation.x = 0.14;
  seatGroup.add(seatBack);

  // Leather backrest bolster pad
  const backBolster = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.34, 0.02), bolsterLeatherMat);
  backBolster.position.set(0, 0.21, 0.10);
  backBolster.rotation.x = 0.14;
  seatGroup.add(backBolster);

  // Ergonomic winged headrest
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.045), bolsterLeatherMat);
  headrest.position.set(0, 0.44, 0.15);
  seatGroup.add(headrest);

  // Dual shoulder harness straps
  [-0.065, 0.065].forEach((hx) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.28, 0.006), harnessStrapMat);
    strap.position.set(hx, 0.20, 0.088);
    strap.rotation.x = 0.14;
    seatGroup.add(strap);
  });

  // Yellow/black striped emergency ejection handle loop between pilot knees
  const ejectHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.005, 8, 16, Math.PI),
    hazardStripeMat
  );
  ejectHandle.position.set(0, 0.045, -0.14);
  ejectHandle.rotation.x = -0.35;
  seatGroup.add(ejectHandle);

  interiorGroup.add(seatGroup);

  // 9. Canopy Roll-Cage Structural Arch
  const archCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.35, 0.18, -1.14),
    new THREE.Vector3(-0.30, 0.34, -1.13),
    new THREE.Vector3(-0.16, 0.43, -1.12),
    new THREE.Vector3(0, 0.45, -1.12),
    new THREE.Vector3(0.16, 0.43, -1.12),
    new THREE.Vector3(0.30, 0.34, -1.13),
    new THREE.Vector3(0.35, 0.18, -1.14),
  ]);
  const archMesh = new THREE.Mesh(
    new THREE.TubeGeometry(archCurve, 28, 0.010, 16, false),
    titaniumTrimMat
  );
  interiorGroup.add(archMesh);

  // Canopy lock status LEDs
  [-0.14, 0.14].forEach((lx) => {
    const lockLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.005, 0.005),
      new THREE.MeshBasicMaterial({ color: '#10b981' })
    );
    lockLed.position.set(lx, 0.428, -1.115);
    interiorGroup.add(lockLed);
  });

  // 10. Cabin Lighting (Realistic soft cockpit illumination, zero glare outside!)
  const interiorLight = new THREE.PointLight('#e0f2fe', 2.0, 4.5, 1);
  interiorLight.position.set(0, 0.40, -0.92);
  interiorGroup.add(interiorLight);

  const consoleGlowLight = new THREE.PointLight('#38bdf8', 1.0, 2.5, 1);
  consoleGlowLight.position.set(0, 0.18, -1.22);
  interiorGroup.add(consoleGlowLight);

  // Panoramic Pilot Eye Camera Anchor (placed right at eye level looking straight forward!)
  const cockpitSeatAnchor = new THREE.Object3D();
  cockpitSeatAnchor.position.set(0, 0.34, -0.88);
  interiorGroup.add(cockpitSeatAnchor);

  // Seated 3D Pilot Character Anchor (for astronaut mesh)
  const pilotSeatAnchor = new THREE.Group();
  pilotSeatAnchor.name = 'light-fighter-pilot-seat-anchor';
  pilotSeatAnchor.position.set(0, 0.038, -0.80);
  interiorGroup.add(pilotSeatAnchor);

  // Cinematic 3rd-Person Chase Camera Anchor behind & slightly above Light Fighter
  const chaseCameraAnchor = new THREE.Object3D();
  chaseCameraAnchor.position.set(0, 1.38, 6.95);
  rootGroup.add(chaseCameraAnchor);

  // ============================================================================
  // 3. EXTERNAL ANCHORS, NAV STROBES, FORWARD PRONG CANNONS & TRIPLE PLASMA THRUSTERS
  // ============================================================================
  // Lightweight proxies preserve SR7SpacecraftRefs compatibility with zero redundant hull draw calls
  const sensorTurretGroup = new THREE.Group();
  sensorTurretGroup.position.set(0, 0.80, 0.92);
  hullGroup.add(sensorTurretGroup);

  const radarDishGroup = new THREE.Group();
  radarDishGroup.position.set(0, 0.82, 1.35);
  hullGroup.add(radarDishGroup);

  const leftAileron = new THREE.Mesh();
  leftAileron.visible = false;
  const rightAileron = new THREE.Mesh();
  rightAileron.visible = false;

  // Dorsal Anti-Collision Beacon Strobe (atop upper Light Fighter spine)
  const strobeLightMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#f8fafc' })
  );
  strobeLightMesh.position.set(0, 0.77, 1.65);
  hullGroup.add(strobeLightMesh);

  // Port (Red) & Starboard (Green) Outer Wingtip Nav Strobes + Ion Strips (aligned to GLB wingtips)
  const wingGlowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
  const leftWingTipGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.38), wingGlowMat);
  leftWingTipGlow.position.set(-3.04, -0.11, 1.04);
  hullGroup.add(leftWingTipGlow);

  const rightWingTipGlow = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.045, 0.38),
    wingGlowMat.clone()
  );
  rightWingTipGlow.position.set(3.04, -0.11, 1.04);
  hullGroup.add(rightWingTipGlow);

  [-1, 1].forEach((side) => {
    const navStrobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      new THREE.MeshBasicMaterial({ color: side === -1 ? '#ef4444' : '#22c55e' })
    );
    navStrobe.position.set(side * 3.07, -0.11, 0.78);
    hullGroup.add(navStrobe);
  });

  // Forward Twin Wing-Prong Laser Muzzle Anchors & Flashes (aligned to raw ±2.50, 1.42, +5.20 tips)
  const muzzlePositionsLocal: [THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(-1.25, 0.16, -1.62),
    new THREE.Vector3(1.25, 0.16, -1.62),
  ];
  const muzzleMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const leftMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), muzzleMat);
  leftMuzzleFlash.position.copy(muzzlePositionsLocal[0]);
  hullGroup.add(leftMuzzleFlash);

  const rightMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), muzzleMat.clone());
  rightMuzzleFlash.position.copy(muzzlePositionsLocal[1]);
  hullGroup.add(rightMuzzleFlash);

  // Triple Main Afterburner Plumes (Center Main Turbine + Twin Outboard Turbines)
  const plumeMatLeft = createPlasmaPlumeMaterial();
  const plumeMatRight = createPlasmaPlumeMaterial();
  const plumeMatCenter = createPlasmaPlumeMaterial();

  const sidePlumeGeo = new THREE.CylinderGeometry(0.24, 0.03, 2.25, 22, 1, true);
  sidePlumeGeo.rotateX(Math.PI / 2);
  sidePlumeGeo.translate(0, 0, 1.12);

  const centerPlumeGeo = new THREE.CylinderGeometry(0.35, 0.04, 2.85, 24, 1, true);
  centerPlumeGeo.rotateX(Math.PI / 2);
  centerPlumeGeo.translate(0, 0, 1.42);

  const leftPlumeMesh = new THREE.Mesh(sidePlumeGeo, plumeMatLeft);
  leftPlumeMesh.position.set(-0.736, 0.296, 3.24);
  hullGroup.add(leftPlumeMesh);

  const rightPlumeMesh = new THREE.Mesh(sidePlumeGeo, plumeMatRight);
  rightPlumeMesh.position.set(0.736, 0.296, 3.24);
  hullGroup.add(rightPlumeMesh);

  const centerPlumeMesh = new THREE.Mesh(centerPlumeGeo, plumeMatCenter);
  centerPlumeMesh.position.set(0, 0.364, 3.72);
  hullGroup.add(centerPlumeMesh);

  const coreGlowMat = new THREE.MeshBasicMaterial({ color: '#e9d5ff' });
  const leftCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), coreGlowMat);
  leftCoreMesh.position.set(-0.736, 0.296, 3.18);
  hullGroup.add(leftCoreMesh);

  const rightCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), coreGlowMat.clone());
  rightCoreMesh.position.set(0.736, 0.296, 3.18);
  hullGroup.add(rightCoreMesh);

  const centerCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), coreGlowMat.clone());
  centerCoreMesh.position.set(0, 0.364, 3.64);
  hullGroup.add(centerCoreMesh);

  // Twin Lower Ventral Auxiliary Boost Core Glows (aligned to raw ±0.39, 0.746, -3.283)
  [-0.195, 0.195].forEach((vx) => {
    const ventralCore = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 14),
      new THREE.MeshBasicMaterial({ color: '#c084fc' })
    );
    ventralCore.position.set(vx, -0.167, 2.66);
    hullGroup.add(ventralCore);
  });

  // ============================================================================
  // 4. SPOTLIGHTS, VOLUMETRIC BEAMS & 3D RADAR PULSE RING
  // ============================================================================
  const headlightLeftSpot = new THREE.SpotLight('#fef9c3', 0, 85, Math.PI * 0.16, 0.45, 1.0);
  headlightLeftSpot.position.set(-0.28, -0.09, -1.18);
  const leftTarget = new THREE.Object3D();
  leftTarget.position.set(-0.28, -0.12, -32);
  rootGroup.add(leftTarget);
  headlightLeftSpot.target = leftTarget;
  rootGroup.add(headlightLeftSpot);

  const headlightRightSpot = new THREE.SpotLight('#fef9c3', 0, 85, Math.PI * 0.16, 0.45, 1.0);
  headlightRightSpot.position.set(0.28, -0.09, -1.18);
  const rightTarget = new THREE.Object3D();
  rightTarget.position.set(0.28, -0.12, -32);
  rootGroup.add(rightTarget);
  headlightRightSpot.target = rightTarget;
  rootGroup.add(headlightRightSpot);

  const headlightBeamGroup = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(1.25, 10, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, -5);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fef9c3',
    transparent: true,
    opacity: 0.075,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  [-0.28, 0.28].forEach((bx) => {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, -0.09, -1.18);
    headlightBeamGroup.add(beam);
  });
  headlightBeamGroup.visible = false;
  hullGroup.add(headlightBeamGroup);

  const radarPulseRingMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const radarPulseRing = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 48), radarPulseRingMat);
  radarPulseRing.rotation.x = Math.PI / 2;
  radarPulseRing.visible = false;
  rootGroup.add(radarPulseRing);

  let mfdTimer = 0;

  const updateAnimations: SR7SpacecraftRefs['updateAnimations'] = ({
    dt,
    clockTime,
    throttle,
    boostActive,
    headlightsOn,
    interiorLightsOn,
    shieldsOn,
    pitchInput,
    rollInput,
    yawInput,
    pitchDeg,
    rollDeg,
    radarPulseAgeSec,
    muzzleFlashAlpha,
    speedFormatted,
    nearestName,
    nearestDist,
    reactorTempC,
    sasEnabled,
    autopilotActive,
    isCockpitView = false,
    shipScale = 1,
    driftAngleDeg = 0,
  }) => {
    // 1. HOTAS Flight Stick, Throttle & Footwell Rudder Pedal Animation
    yokeGroup.rotation.x = THREE.MathUtils.lerp(yokeGroup.rotation.x, pitchInput * 0.28, Math.min(1, dt * 12));
    yokeGroup.rotation.z = THREE.MathUtils.lerp(
      yokeGroup.rotation.z,
      -rollInput * 0.42 - yawInput * 0.18,
      Math.min(1, dt * 12)
    );
    throttleGroup.rotation.x = THREE.MathUtils.lerp(
      throttleGroup.rotation.x,
      -throttle * 0.6,
      Math.min(1, dt * 10)
    );
    leftRudderPedal.position.z = THREE.MathUtils.lerp(
      leftRudderPedal.position.z,
      -1.49 - yawInput * 0.032,
      Math.min(1, dt * 10)
    );
    rightRudderPedal.position.z = THREE.MathUtils.lerp(
      rightRudderPedal.position.z,
      -1.49 + yawInput * 0.032,
      Math.min(1, dt * 10)
    );

    // Lightweight aerodynamic control proxy deflection
    leftAileron.rotation.x = THREE.MathUtils.lerp(
      leftAileron.rotation.x,
      pitchInput * 0.25 - rollInput * 0.35,
      Math.min(1, dt * 10)
    );
    rightAileron.rotation.x = THREE.MathUtils.lerp(
      rightAileron.rotation.x,
      pitchInput * 0.25 + rollInput * 0.35,
      Math.min(1, dt * 10)
    );

    // Adaptive crystal-clear canopy glass clarity (100% see-through in both cockpit & exterior views)
    canopyGlassMat.uniforms.uInteriorView.value = isCockpitView ? 1.0 : 0.0;
    canopyGlassMat.uniforms.uTintColor.value.set(isCockpitView ? '#e0f2fe' : '#7dd3fc');

    // 2. Mach-Diamond Volumetric GLSL Plumes across All 3 Light Fighter Nozzles
    const absT = Math.abs(throttle);
    const boostVal = boostActive ? 1.0 : 0.0;
    const plumeLenScale = boostActive
      ? 1.75 + Math.sin(clockTime * 34) * 0.12
      : 0.24 + absT * 0.92 + Math.sin(clockTime * 26) * 0.04;
    const plumeRadScale = boostActive ? 1.15 : 0.72 + absT * 0.35;
    leftPlumeMesh.scale.set(plumeRadScale, plumeRadScale, plumeLenScale);
    rightPlumeMesh.scale.set(plumeRadScale, plumeRadScale, plumeLenScale);
    centerPlumeMesh.scale.set(plumeRadScale, plumeRadScale, plumeLenScale);

    [plumeMatLeft, plumeMatRight, plumeMatCenter].forEach((m) => {
      m.uniforms.uTime.value = clockTime;
      m.uniforms.uThrottle.value = absT;
      m.uniforms.uBoost.value = boostVal;
    });

    const coreColor = boostActive ? '#e0f2fe' : '#e9d5ff';
    (leftCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (rightCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (centerCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (leftWingTipGlow.material as THREE.MeshBasicMaterial).color.set(boostActive ? '#7dd3fc' : '#0284c7');
    (rightWingTipGlow.material as THREE.MeshBasicMaterial).color.set(boostActive ? '#7dd3fc' : '#0284c7');

    // Dorsal anti-collision beacon strobe (~1.1 Hz)
    const strobeOn = (clockTime % 1.1) < 0.09;
    strobeLightMesh.visible = strobeOn;

    // 3. Headlights & Scale-Invariant Cabin Interior Lights (hide milky cone beams inside cockpit)
    headlightBeamGroup.visible = headlightsOn && !isCockpitView;
    const spotDist = Math.max(0.0005, shipScale * 95);
    headlightLeftSpot.distance = spotDist;
    headlightRightSpot.distance = spotDist;
    headlightLeftSpot.intensity = headlightsOn ? 6.5 : 0;
    headlightRightSpot.intensity = headlightsOn ? 6.5 : 0;
    interiorLight.distance = Math.max(0.0001, shipScale * 5.2);
    interiorLight.intensity = interiorLightsOn ? 2.85 : 0.72;
    consoleGlowLight.distance = Math.max(0.0001, shipScale * 4.2);
    consoleGlowLight.intensity = interiorLightsOn ? 1.35 : 0.55;

    // 4. Radar & Sensor Turret Micro-Motion
    radarDishGroup.rotation.y = Math.sin(clockTime * 0.65) * 0.55;
    sensorTurretGroup.rotation.y = THREE.MathUtils.lerp(
      sensorTurretGroup.rotation.y,
      yawInput * 0.35,
      Math.min(1, dt * 6)
    );

    // 5. Twin Forward Prong Muzzle Flash
    leftMuzzleFlash.visible = muzzleFlashAlpha > 0.02;
    rightMuzzleFlash.visible = muzzleFlashAlpha > 0.02;
    (leftMuzzleFlash.material as THREE.MeshBasicMaterial).opacity = muzzleFlashAlpha;
    (rightMuzzleFlash.material as THREE.MeshBasicMaterial).opacity = muzzleFlashAlpha;

    // 6. Expanding 3D Radar Scanner Ring
    if (radarPulseAgeSec >= 0 && radarPulseAgeSec < 2.2) {
      radarPulseRing.visible = true;
      const t = radarPulseAgeSec / 2.2;
      radarPulseRing.scale.setScalar(1.0 + t * 55.0);
      radarPulseRingMat.opacity = (1.0 - t) * 0.85;
    } else {
      radarPulseRing.visible = false;
    }

    // 7. Refresh Cockpit MFD Screens & Holographic HUD (~10 fps only while inside cockpit)
    if (isCockpitView) {
      mfdTimer += dt;
      if (mfdTimer > 0.10) {
        mfdTimer = 0;
        renderPFDCanvas(
          pfdCanvas,
          throttle,
          boostActive,
          speedFormatted,
          pitchDeg,
          rollDeg,
          sasEnabled,
          driftAngleDeg
        );
        pfdTex.needsUpdate = true;

        renderNavCanvas(navCanvas, nearestName, nearestDist, autopilotActive, clockTime);
        navTex.needsUpdate = true;

        renderSysCanvas(sysCanvas, throttle, reactorTempC, shieldsOn, boostActive);
        sysTex.needsUpdate = true;

        renderHoloCombiner(holoCanvas, pitchDeg, rollDeg, boostActive, driftAngleDeg);
        holoTex.needsUpdate = true;
      }
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeNodeResources(rootGroup);
  };

  return {
    rootGroup,
    hullGroup,
    interiorGroup,
    cockpitSeatAnchor,
    pilotSeatAnchor,
    chaseCameraAnchor,
    yokeGroup,
    throttleGroup,
    leftPlumeMesh,
    rightPlumeMesh,
    leftCoreMesh,
    rightCoreMesh,
    leftWingTipGlow,
    rightWingTipGlow,
    leftAileron,
    rightAileron,
    headlightLeftSpot,
    headlightRightSpot,
    headlightBeamGroup,
    radarDishGroup,
    sensorTurretGroup,
    radarPulseRing,
    pfdCanvas,
    pfdMat,
    navCanvas,
    navMat,
    sysCanvas,
    sysMat,
    holoCanvas,
    holoMat,
    interiorLight,
    strobeLightMesh,
    leftMuzzleFlash,
    rightMuzzleFlash,
    muzzlePositionsLocal,
    clickableCockpitControls,
    modelReadyPromise,
    dispose,
    updateAnimations,
  };
}
