import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SR7SpacecraftRefs {
  rootGroup: THREE.Group;
  hullGroup: THREE.Group;
  interiorGroup: THREE.Group;
  cockpitSeatAnchor: THREE.Object3D;
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
 * Creates a seamless lofted multi-station BufferGeometry along Z with crisp normals and UV seams.
 * Each station supplies an array of [x, y] ring points ordered consistently around the perimeter.
 */
function createLoftedGeometry(
  stations: Array<{ z: number; ring: Array<[number, number]> }>,
  uvScaleU = 1.0,
  uvScaleV = 0.25,
  capEnds = true,
  closedRing = true
): THREE.BufferGeometry {
  const numStations = stations.length;
  const ringCount = stations[0].ring.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s < numStations; s++) {
    const { z, ring } = stations[s];
    const vCoord = z * uvScaleV;
    for (let r = 0; r <= ringCount; r++) {
      const pt = ring[r % ringCount];
      positions.push(pt[0], pt[1], z);
      uvs.push((r / ringCount) * uvScaleU, vCoord);
    }
  }

  const stride = ringCount + 1;
  const segCount = closedRing ? ringCount : ringCount - 1;
  for (let s = 0; s < numStations - 1; s++) {
    for (let r = 0; r < segCount; r++) {
      const a = s * stride + r;
      const b = s * stride + (r + 1);
      const c = (s + 1) * stride + r;
      const d = (s + 1) * stride + (r + 1);
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  if (capEnds) {
    // Front cap (-Z)
    const frontCenter = [0, 0, stations[0].z];
    let fAvgX = 0;
    let fAvgY = 0;
    stations[0].ring.forEach(([x, y]) => {
      fAvgX += x;
      fAvgY += y;
    });
    frontCenter[0] = fAvgX / ringCount;
    frontCenter[1] = fAvgY / ringCount;
    const frontCenterIdx = positions.length / 3;
    positions.push(frontCenter[0], frontCenter[1], frontCenter[2]);
    uvs.push(0.5, 0.5);
    for (let r = 0; r < ringCount; r++) {
      indices.push(frontCenterIdx, r, r + 1);
    }

    // Rear cap (+Z)
    const lastOffset = (numStations - 1) * stride;
    let rAvgX = 0;
    let rAvgY = 0;
    stations[numStations - 1].ring.forEach(([x, y]) => {
      rAvgX += x;
      rAvgY += y;
    });
    const rearCenterIdx = positions.length / 3;
    positions.push(rAvgX / ringCount, rAvgY / ringCount, stations[numStations - 1].z);
    uvs.push(0.5, 0.5);
    for (let r = 0; r < ringCount; r++) {
      indices.push(rearCenterIdx, lastOffset + r + 1, lastOffset + r);
    }
  }

  // Auto-correct winding for mirrored (counter-clockwise) rings so normals always face outward
  const ring0 = stations[0].ring;
  let signedArea = 0;
  for (let i = 0; i < ringCount; i++) {
    const [x1, y1] = ring0[i];
    const [x2, y2] = ring0[(i + 1) % ringCount];
    signedArea += x1 * y2 - x2 * y1;
  }
  const zIncreasing = stations[numStations - 1].z >= stations[0].z;
  if ((signedArea > 0) === zIncreasing) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = tmp;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
 * Yellow/black diagonal hazard stripes (ejection & jettison handles).
 */
function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
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
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
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
 * Engraved anodized console faceplate decal with backlit legends, Dzus fasteners & switch rings.
 * (u, z) are faceplate-local coordinates in model units; canvas top = forward (-Z).
 */
function createConsolePanelTexture(
  planeW: number,
  planeL: number,
  labels: ConsolePanelLabel[],
  title: string
): THREE.CanvasTexture {
  const W = 256;
  const H = Math.round((W * planeL) / planeW);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const toPx = (u: number, z: number): [number, number] => [
    ((u + planeW / 2) / planeW) * W,
    ((z + planeL / 2) / planeL) * H,
  ];

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#2a3240');
  grad.addColorStop(1, '#1a2029');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Engraved border & panel seam lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(9, 9, W - 18, H - 18);

  // Dzus quarter-turn fasteners in the corners
  [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]].forEach(([fx, fy]) => {
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(fx, fy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx - 4, fy);
    ctx.lineTo(fx + 4, fy);
    ctx.stroke();
  });

  // Title strip
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.fillRect(14, 26, W - 28, 24);
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, W / 2, 38);

  labels.forEach((lbl) => {
    const [px, py] = toPx(lbl.u, lbl.z);
    if (lbl.ring) {
      const rPx = (lbl.ring / planeW) * W;
      ctx.strokeStyle = lbl.color || '#94a3b8';
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, rPx, 0, Math.PI * 2);
      ctx.stroke();
      // Engraved tick marks around knob / switch
      for (let t = 0; t < 8; t++) {
        const a = (t / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * rPx * 1.1, py + Math.sin(a) * rPx * 1.1);
        ctx.lineTo(px + Math.cos(a) * rPx * 1.32, py + Math.sin(a) * rPx * 1.32);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (lbl.text) {
      ctx.fillStyle = lbl.color || '#e2e8f0';
      ctx.font = `bold ${lbl.size || 13}px monospace`;
      ctx.fillText(lbl.text, px, py);
    }
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Avionics rack faceplate with LED status matrix, vent slots and placards.
 */
function createAvionicsRackTexture(title: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 224;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1c232d';
  ctx.fillRect(0, 0, 160, 224);
  ctx.strokeStyle = '#0b0f14';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 154, 218);

  ctx.fillStyle = accent;
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 80, 24);

  // LED status matrix
  const ledColors = ['#34d399', '#34d399', '#38bdf8', '#fbbf24', '#34d399', '#38bdf8'];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      ctx.fillStyle = ledColors[(row * 2 + col) % ledColors.length];
      ctx.globalAlpha = (row + col) % 4 === 0 ? 0.35 : 0.95;
      ctx.fillRect(18 + col * 22, 40 + row * 16, 12, 7);
    }
  }
  ctx.globalAlpha = 1;

  // Cooling vent slots
  ctx.fillStyle = '#0b0f14';
  for (let s = 0; s < 8; s++) {
    ctx.fillRect(20, 102 + s * 10, 120, 4);
  }

  // Data plug ports
  [44, 80, 116].forEach((cx) => {
    ctx.fillStyle = '#4b5563';
    ctx.beginPath();
    ctx.arc(cx, 196, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, 196, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.textAlign = 'left';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Compact crisp standby artificial horizon & chronometer dial for backup glare-shield pod.
 */
function createStandbyGaugeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#050b14';
  ctx.fillRect(0, 0, 128, 128);

  ctx.save();
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#292524';
  ctx.fillRect(0, 64, 128, 64);
  ctx.strokeStyle = '#e0f2fe';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 64);
  ctx.lineTo(116, 64);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(42, 64);
  ctx.lineTo(56, 64);
  ctx.lineTo(64, 71);
  ctx.lineTo(72, 64);
  ctx.lineTo(86, 64);
  ctx.stroke();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(64 + Math.cos(a) * 48, 64 + Math.sin(a) * 48);
    ctx.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates woven carbon-fiber & brushed titanium PBR maps for the modern cockpit interior.
 */
function createCockpitCarbonTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
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

  ctx.fillStyle = '#1d2430';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#7c7c7c';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#686868';
  rCtx.fillRect(0, 0, size, size);

  const step = 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const parity = ((x / step + y / step) % 2) === 0;
      ctx.fillStyle = parity ? '#262f3e' : '#161b25';
      ctx.fillRect(x, y, step - 1, step - 1);
      bCtx.fillStyle = parity ? '#9c9c9c' : '#646464';
      bCtx.fillRect(x + 1, y + 1, step - 2, step - 2);
      rCtx.fillStyle = parity ? '#545454' : '#8a8a8a';
      rCtx.fillRect(x, y, step, step);
    }
  }

  const map = new THREE.CanvasTexture(col);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(8, 8);

  const bumpMap = new THREE.CanvasTexture(bmp);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(8, 8);

  const roughnessMap = new THREE.CanvasTexture(rgh);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(8, 8);

  return { map, bumpMap, roughnessMap };
}

/**
 * Generates crisp collimated holographic reticle canvas texture for the 3D glass HUD combiner.
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
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.52;
  const primary = boostActive ? 'rgba(103, 232, 249, 0.95)' : 'rgba(56, 189, 248, 0.88)';
  const subtle = boostActive ? 'rgba(103, 232, 249, 0.45)' : 'rgba(56, 189, 248, 0.36)';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-rollDeg * Math.PI) / 180);

  // Subtle aerospace pitch ladder
  ctx.strokeStyle = subtle;
  ctx.lineWidth = 2;
  const pitchShift = THREE.MathUtils.clamp(-pitchDeg * 1.6, -78, 78);
  [-56, -28, 0, 28, 56].forEach((offsetY) => {
    const y = offsetY + pitchShift;
    const span = offsetY === 0 ? 115 : Math.abs(offsetY) === 28 ? 64 : 42;
    ctx.beginPath();
    ctx.moveTo(-span, y);
    ctx.lineTo(-26, y);
    ctx.moveTo(26, y);
    ctx.lineTo(span, y);
    ctx.stroke();
  });
  ctx.restore();

  // Prograde drift marker (flight path vector)
  const driftX = cx + THREE.MathUtils.clamp(driftAngleDeg * 2.2, -96, 96);
  ctx.strokeStyle = boostActive ? '#22d3ee' : '#34d399';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(driftX, cy, 8, 0, Math.PI * 2);
  ctx.moveTo(driftX - 16, cy);
  ctx.lineTo(driftX - 8, cy);
  ctx.moveTo(driftX + 8, cy);
  ctx.lineTo(driftX + 16, cy);
  ctx.moveTo(driftX, cy - 14);
  ctx.lineTo(driftX, cy - 8);
  ctx.stroke();

  // Fixed boresight reticle
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 22, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 34, cy);
  ctx.lineTo(cx - 22, cy);
  ctx.moveTo(cx + 22, cy);
  ctx.lineTo(cx + 34, cy);
  ctx.moveTo(cx, cy - 30);
  ctx.lineTo(cx, cy - 22);
  ctx.stroke();
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
  const w = canvas.width;
  const h = canvas.height;

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
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Artificial Horizon Sphere
  const cx = w * 0.5;
  const cy = h * 0.51;
  const r = 84;
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
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-105, py);
  ctx.lineTo(105, py);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(186, 230, 253, 0.55)';
  ctx.lineWidth = 1.5;
  [-36, -18, 18, 36].forEach((tick) => {
    ctx.beginPath();
    ctx.moveTo(-30, py + tick);
    ctx.lineTo(30, py + tick);
    ctx.stroke();
  });
  ctx.restore();

  // Horizon Ring & Bank Arc
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.78)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Fixed miniature delta craft datum
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.lineTo(cx, cy + 9);
  ctx.lineTo(cx + 10, cy);
  ctx.lineTo(cx + 28, cy);
  ctx.stroke();

  // Side Thrust Arc Bar (right flank)
  const barX = w - 34;
  const barH = 156;
  const barY = cy - barH * 0.5;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(barX, barY, 14, barH);
  const thrFrac = THREE.MathUtils.clamp(Math.abs(throttle), 0, 1);
  ctx.fillStyle = boostActive ? '#22d3ee' : throttle < 0 ? '#f43f5e' : '#f59e0b';
  ctx.fillRect(barX + 2, barY + barH * (1 - thrFrac), 10, barH * thrFrac);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(barX, barY, 14, barH);

  // Header & Telemetry Readouts
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 19px monospace';
  ctx.fillText('PFD // HORIZONTE', 18, 32);

  ctx.fillStyle = sasEnabled ? '#34d399' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(sasEnabled ? 'SAS ATIVO' : 'DERIVA NEWTON', w - 18, 32);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px monospace';
  ctx.fillText(`DERIVA ${Math.round(driftAngleDeg)}°`, 18, 62);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(speedFormatted, 18, h - 22);

  ctx.fillStyle = boostActive ? '#22d3ee' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(boostActive ? 'DOBRA ATIVA' : `${Math.round(throttle * 100)}% THR`, w - 18, h - 22);
  ctx.textAlign = 'left';
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
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#030a16';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = autopilotActive ? '#f59e0b' : '#0284c7';
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  const cx = w * 0.5;
  const cy = h * 0.48;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1.6;
  [30, 58, 86].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });
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
  ctx.font = 'bold 17px monospace';
  ctx.fillText('RADAR ESPACIAL', 16, 28);

  ctx.fillStyle = autopilotActive ? '#fbbf24' : '#f1f5f9';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(nearestName.toUpperCase().slice(0, 16), 16, h - 38);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px monospace';
  ctx.fillText(nearestDist, 16, h - 15);
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
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#030a16';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 17px monospace';
  ctx.fillText('PROPULSÃO & NÚCLEO', 16, 28);

  // Shield Aura Bubble Ring around hull wireframe
  if (shieldsOn) {
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, 118, 118, 64, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crisp SR-7 hull schematic
  ctx.strokeStyle = shieldsOn ? '#38bdf8' : '#64748b';
  ctx.lineWidth = 2.4;
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

  // Twin ion engine vertical meters
  const powerFrac = boostActive ? 1.0 : Math.max(0.08, Math.abs(throttle));
  [20, w - 34].forEach((mx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(mx, 56, 14, 118);
    ctx.fillStyle = boostActive ? '#22d3ee' : '#38bdf8';
    ctx.fillRect(mx + 2, 56 + 114 * (1 - powerFrac), 10, 114 * powerFrac);
  });

  // Temp bar
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`REATOR: ${Math.round(reactorTempC)}°C`, 16, h - 50);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(16, h - 38, w - 32, 12);
  const heatFrac = THREE.MathUtils.clamp((reactorTempC - 280) / 700, 0.08, 1);
  ctx.fillStyle = boostActive ? '#22d3ee' : Math.abs(throttle) > 0.7 ? '#fb923c' : '#10b981';
  ctx.fillRect(16, h - 38, (w - 32) * heatFrac, 12);

  ctx.fillStyle = shieldsOn ? '#a5b4fc' : '#64748b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(shieldsOn ? 'ESCUDOS: 100% ATIVOS' : 'ESCUDOS: STANDBY', 16, h - 10);
}

/**
 * Builds the photorealistic sculpted 3D SR-7 Tactical Explorer Spacecraft & Panoramic Cockpit.
 * Local orientation: Nose = -Z, Thrusters = +Z, Up = +Y, Right = +X.
 */
export function createSR7Spacecraft3DGroup(): SR7SpacecraftRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'sr7-spacecraft-root';

  const hullGroup = new THREE.Group();
  rootGroup.add(hullGroup);

  const isNodeEnv = typeof window === 'undefined' || typeof document === 'undefined';
  let disposed = false;

  const { map: carbonMap, bumpMap: carbonBump, roughnessMap: carbonRough } =
    createCockpitCarbonTextures();

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

  const crimsonStripeMat = new THREE.MeshStandardMaterial({
    color: '#a32222',
    roughness: 0.48,
    metalness: 0.32,
    envMapIntensity: 1.15,
  });

  const copperPipeMat = new THREE.MeshStandardMaterial({
    color: '#c47b43',
    roughness: 0.26,
    metalness: 0.88,
    envMapIntensity: 1.45,
  });

  const cockpitInteriorTrimMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    bumpMap: carbonBump,
    bumpScale: 0.008,
    roughnessMap: carbonRough,
    color: '#293342',
    roughness: 0.56,
    metalness: 0.42,
    envMapIntensity: 1.25,
  });

  const cockpitConsoleMat = new THREE.MeshStandardMaterial({
    map: carbonMap,
    bumpMap: carbonBump,
    bumpScale: 0.006,
    color: '#1b2330',
    roughness: 0.48,
    metalness: 0.58,
    envMapIntensity: 1.35,
  });

  const anodizedBezelMat = new THREE.MeshStandardMaterial({
    color: '#3c485b',
    roughness: 0.28,
    metalness: 0.86,
    envMapIntensity: 1.45,
  });

  const bolsterLeatherMat = new THREE.MeshStandardMaterial({
    color: '#252b35',
    roughness: 0.72,
    metalness: 0.14,
  });

  const hazardStripeTex = createHazardStripeTexture();
  const hazardStripeMat = new THREE.MeshStandardMaterial({
    map: hazardStripeTex,
    roughness: 0.5,
    metalness: 0.2,
    emissive: '#3a2a00',
    emissiveIntensity: 0.35,
  });

  const harnessStrapMat = new THREE.MeshStandardMaterial({
    color: '#3f4a3c',
    roughness: 0.9,
    metalness: 0.05,
  });

  const mirrorMat = new THREE.MeshStandardMaterial({
    color: '#dbe7f3',
    roughness: 0.04,
    metalness: 1.0,
    envMapIntensity: 2.0,
  });

  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#93c5fd',
    transparent: true,
    opacity: 0.44,
    roughness: 0.06,
    metalness: 0.16,
    reflectivity: 0.96,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
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
          loadedRoot.rotation.y = Math.PI;
          loadedRoot.position.set(0, -1.08, 2.1);

          let baseMesh: THREE.Mesh | null = null;
          loadedRoot.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.frustumCulled = false;
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.isMeshStandardMaterial) {
                mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.35);
                mat.needsUpdate = true;
              }
              if (mesh.name.includes('BASE') && !baseMesh) {
                baseMesh = mesh;
              }
            }
          });

          if (baseMesh) {
            const glassMesh = partitionLightFighterCanopy(baseMesh, loadedRoot, canopyGlassMat);
            if (glassMesh) {
              glassMesh.frustumCulled = false;
            }
          }

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
  // 2. REALISTIC MODERN GLASS COCKPIT INTERIOR (Fitted Inside Light Fighter Bay)
  // ============================================================================
  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'sr7-cockpit-interior';
  interiorGroup.scale.setScalar(0.7);
  interiorGroup.position.set(0, 0.078, 0.15);
  rootGroup.add(interiorGroup);

  // Ribbed Structural Cockpit Floor & Footwell
  const deckFloor = new THREE.Mesh(
    createLoftedGeometry([
      { z: -1.52, ring: [[-0.27, -0.02], [0.27, -0.02], [0.29, -0.06], [-0.29, -0.06]] },
      { z: -0.58, ring: [[-0.36, -0.02], [0.36, -0.02], [0.38, -0.06], [-0.38, -0.06]] },
    ], 1, 1, true),
    cockpitConsoleMat
  );
  interiorGroup.add(deckFloor);

  // Ribbed Footwell Heel-Rest Tread Plates & Bulkhead Frame Seals
  [-0.095, 0.095].forEach((fx) => {
    const treadPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.008, 0.34), anodizedBezelMat);
    treadPlate.position.set(fx, -0.015, -1.28);
    interiorGroup.add(treadPlate);
  });

  // Curved Rear Pressurized Crew Bulkhead Wall + Acoustic Thermal Liner (framed cleanly behind pilot seat!)
  const rearBulkhead = new THREE.Mesh(
    createLoftedGeometry([
      { z: -0.635, ring: [[-0.39, 0.0], [0.39, 0.0], [0.40, 0.24], [0.34, 0.45], [0, 0.515], [-0.34, 0.45], [-0.40, 0.24]] },
      { z: -0.56, ring: [[-0.39, 0.0], [0.39, 0.0], [0.40, 0.24], [0.34, 0.44], [0, 0.505], [-0.34, 0.44], [-0.40, 0.24]] },
    ], 1, 1, true),
    cockpitInteriorTrimMat
  );
  interiorGroup.add(rearBulkhead);

  // Twin Recessed Rear Avionics Bays & Power Conduits (detailed 360° view behind shoulder!)
  [
    { side: -1, title: 'AVIÔNICA A', accent: '#38bdf8' },
    { side: 1, title: 'NÚCLEO B', accent: '#34d399' },
  ].forEach((rack) => {
    const rackGroup = new THREE.Group();
    rackGroup.position.set(rack.side * 0.245, 0.255, -0.642);
    rackGroup.rotation.y = rack.side * -0.18;

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.19, 0.024), anodizedBezelMat);
    rackGroup.add(housing);

    const rackTex = createAvionicsRackTexture(rack.title, rack.accent);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.116, 0.168),
      new THREE.MeshStandardMaterial({
        map: rackTex,
        emissive: '#ffffff',
        emissiveMap: rackTex,
        emissiveIntensity: 0.36,
        roughness: 0.45,
        metalness: 0.4,
      })
    );
    face.position.z = -0.013;
    face.rotation.y = Math.PI;
    rackGroup.add(face);
    interiorGroup.add(rackGroup);

    const rearConduit = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rack.side * 0.29, 0.34, -0.65),
      new THREE.Vector3(rack.side * 0.31, 0.18, -0.68),
      new THREE.Vector3(rack.side * 0.27, 0.02, -0.74),
    ]);
    interiorGroup.add(new THREE.Mesh(new THREE.TubeGeometry(rearConduit, 10, 0.008, 6, false), copperPipeMat));
  });

  // Left Canopy Sill Emergency Jettison Handle + Internal Canopy Brow Bow & Lock Latches
  const jettisonGrip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.075), hazardStripeMat);
  jettisonGrip.position.set(-0.335, 0.172, -1.16);
  interiorGroup.add(jettisonGrip);

  const innerCanopyBow = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 0.22, -1.18),
    new THREE.Vector3(-0.27, 0.39, -1.155),
    new THREE.Vector3(0, 0.435, -1.145),
    new THREE.Vector3(0.27, 0.39, -1.155),
    new THREE.Vector3(0.34, 0.22, -1.18),
  ]);
  interiorGroup.add(new THREE.Mesh(new THREE.TubeGeometry(innerCanopyBow, 18, 0.012, 8, false), gunmetalMat));

  [-0.14, 0.14].forEach((lx) => {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.035), titaniumTrimMat);
    latch.position.set(lx, 0.422, -1.15);
    interiorGroup.add(latch);
    const lockLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.005, 0.005),
      new THREE.MeshBasicMaterial({ color: '#10b981' })
    );
    lockLed.position.set(lx, 0.415, -1.132);
    interiorGroup.add(lockLed);
  });

  // Twin Sculpted Convex Cabin Inspection Mirrors mounted inside Canopy Brow Sides
  [-1, 1].forEach((side) => {
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(side * 0.262, 0.342, -1.265);
    mirrorGroup.rotation.order = 'YXZ';
    mirrorGroup.rotation.y = side * -0.58;
    mirrorGroup.rotation.x = 0.22;

    const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.024, 0.01), anodizedBezelMat);
    mirrorGroup.add(mirrorHousing);
    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.050, 0.018), mirrorMat);
    mirrorGlass.position.z = 0.006;
    mirrorGroup.add(mirrorGlass);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.036, 6), titaniumTrimMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(side * 0.034, 0, -0.005);
    mirrorGroup.add(arm);
    interiorGroup.add(mirrorGroup);
  });

  // Standby Backup Artificial Horizon Pod + Master Caution Bar along Glare-Shield Upper Flanks
  const standbyPod = new THREE.Group();
  standbyPod.position.set(0.215, 0.205, -1.305);
  standbyPod.rotation.order = 'YXZ';
  standbyPod.rotation.y = -0.34;
  standbyPod.rotation.x = -0.22;
  const podRim = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.025, 0.018, 18), anodizedBezelMat);
  podRim.rotation.x = Math.PI / 2;
  standbyPod.add(podRim);
  const standbyDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.019, 18),
    new THREE.MeshBasicMaterial({ map: createStandbyGaugeTexture() })
  );
  standbyDial.position.z = 0.01;
  standbyPod.add(standbyDial);
  interiorGroup.add(standbyPod);

  const cautionHousing = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.016, 0.012), anodizedBezelMat);
  cautionHousing.position.set(-0.205, 0.215, -1.312);
  cautionHousing.rotation.order = 'YXZ';
  cautionHousing.rotation.y = 0.34;
  cautionHousing.rotation.x = -0.18;
  ['#10b981', '#38bdf8', '#fbbf24', '#38bdf8'].forEach((cHex, ci) => {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.008, 0.003),
      new THREE.MeshBasicMaterial({ color: cHex })
    );
    tile.position.set(-0.028 + ci * 0.019, 0, 0.006);
    cautionHousing.add(tile);
  });
  interiorGroup.add(cautionHousing);

  // Articulated Footwell Yaw/Brake Rudder Pedals (animated with yawInput!)
  const createRudderPedal = (side: -1 | 1) => {
    const pedalGroup = new THREE.Group();
    pedalGroup.position.set(side * 0.095, 0.045, -1.49);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.068, 8), titaniumTrimMat);
    arm.position.set(0, 0.02, -0.02);
    arm.rotation.x = 0.38;
    pedalGroup.add(arm);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.044, 0.012), anodizedBezelMat);
    pad.rotation.x = -0.45;
    pedalGroup.add(pad);
    for (let t = -1; t <= 1; t++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.004, 0.004), gunmetalMat);
      tread.position.set(0, t * 0.012, 0.007);
      pad.add(tread);
    }
    interiorGroup.add(pedalGroup);
    return pedalGroup;
  };
  const leftRudderPedal = createRudderPedal(-1);
  const rightRudderPedal = createRudderPedal(1);

  // Armored Sculpted Pilot Seat Bucket with Ergonomic Ribbed Bolsters (behind eye z = -0.89)
  const seatBucketGeo = createLoftedGeometry([
    { z: -0.92, ring: [[-0.14, 0.06], [0.14, 0.06], [0.15, 0.0], [-0.15, 0.0]] },
    { z: -0.72, ring: [[-0.16, 0.07], [0.16, 0.07], [0.17, 0.0], [-0.17, 0.0]] },
  ], 1, 1, true);
  interiorGroup.add(new THREE.Mesh(seatBucketGeo, armorDarkMat));

  const seatBackCurve = new THREE.Mesh(
    createLoftedGeometry([
      { z: -0.73, ring: [[-0.15, 0.07], [0.15, 0.07], [0.17, 0.28], [0.11, 0.44], [-0.11, 0.44], [-0.17, 0.28]] },
      { z: -0.65, ring: [[-0.16, 0.07], [0.16, 0.07], [0.18, 0.28], [0.12, 0.44], [-0.12, 0.44], [-0.18, 0.28]] },
    ], 1, 1, true),
    armorDarkMat
  );
  interiorGroup.add(seatBackCurve);

  // Quilted leather seat cushion + backrest pads (instanced, stitched panel look)
  const seatCushion = new THREE.Mesh(
    createLoftedGeometry([
      { z: -0.915, ring: [[-0.115, 0.082], [0.115, 0.082], [0.125, 0.06], [-0.125, 0.06]] },
      { z: -0.735, ring: [[-0.125, 0.09], [0.125, 0.09], [0.135, 0.068], [-0.135, 0.068]] },
    ], 1, 1, true),
    bolsterLeatherMat
  );
  interiorGroup.add(seatCushion);

  const quiltPadGeo = new THREE.BoxGeometry(0.062, 0.05, 0.014);
  const quiltPads = new THREE.InstancedMesh(quiltPadGeo, bolsterLeatherMat, 12);
  const quiltMatrix = new THREE.Matrix4();
  const quiltQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.06, 0, 0));
  let quiltIdx = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col <= 1; col++) {
      quiltMatrix.compose(
        new THREE.Vector3(col * 0.068, 0.13 + row * 0.066, -0.738),
        quiltQuat,
        new THREE.Vector3(1, 1, 1)
      );
      quiltPads.setMatrixAt(quiltIdx++, quiltMatrix);
    }
  }
  quiltPads.instanceMatrix.needsUpdate = true;
  interiorGroup.add(quiltPads);

  // Contoured side bolsters wrapping the backrest
  [-1, 1].forEach((side) => {
    const bolster = new THREE.Mesh(
      createLoftedGeometry([
        { z: -0.76, ring: [[side * 0.13, 0.09], [side * 0.175, 0.09], [side * 0.19, 0.30], [side * 0.15, 0.36], [side * 0.125, 0.30]] },
        { z: -0.70, ring: [[side * 0.135, 0.09], [side * 0.18, 0.09], [side * 0.195, 0.30], [side * 0.155, 0.36], [side * 0.13, 0.30]] },
      ], 1, 1, true),
      bolsterLeatherMat
    );
    interiorGroup.add(bolster);

    // Seat-pan side rails with titanium ejection guide tracks
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.022), titaniumTrimMat);
    rail.position.set(side * 0.172, 0.25, -0.655);
    rail.rotation.x = 0.04;
    interiorGroup.add(rail);
  });

  // Winged headrest with integrated comms speakers
  const headrest = new THREE.Mesh(
    createLoftedGeometry([
      { z: -0.715, ring: [[-0.09, 0.45], [0.09, 0.45], [0.105, 0.52], [0.07, 0.555], [-0.07, 0.555], [-0.105, 0.52]] },
      { z: -0.655, ring: [[-0.095, 0.45], [0.095, 0.45], [0.11, 0.52], [0.075, 0.56], [-0.075, 0.56], [-0.11, 0.52]] },
    ], 1, 1, true),
    bolsterLeatherMat
  );
  interiorGroup.add(headrest);
  [-1, 1].forEach((side) => {
    const speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 14), anodizedBezelMat);
    speaker.rotation.z = Math.PI / 2;
    speaker.position.set(side * 0.108, 0.505, -0.69);
    interiorGroup.add(speaker);
  });

  // Yellow/black striped ejection handle loop on seat-pan front + lap belt & rotary buckle
  const ejectHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.03, 0.0055, 8, 18, Math.PI),
    hazardStripeMat
  );
  ejectHandle.position.set(0, 0.066, -0.925);
  ejectHandle.rotation.x = -0.35;
  interiorGroup.add(ejectHandle);

  const lapBeltCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.13, 0.095, -0.80),
    new THREE.Vector3(-0.06, 0.098, -0.86),
    new THREE.Vector3(0, 0.099, -0.875),
    new THREE.Vector3(0.06, 0.098, -0.86),
    new THREE.Vector3(0.13, 0.095, -0.80),
  ]);
  const lapBelt = new THREE.Mesh(new THREE.TubeGeometry(lapBeltCurve, 18, 0.0045, 4, false), harnessStrapMat);
  lapBelt.scale.set(1, 0.45, 1);
  lapBelt.position.y = 0.054;
  interiorGroup.add(lapBelt);

  const buckle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 16), titaniumTrimMat);
  buckle.position.set(0, 0.1, -0.876);
  interiorGroup.add(buckle);
  const buckleCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.0075, 12),
    new THREE.MeshBasicMaterial({ color: '#f59e0b' })
  );
  buckleCore.position.set(0, 0.1, -0.876);
  interiorGroup.add(buckleCore);

  // Dual 4-Point Crew Shoulder Harness Straps draping neatly over seat backrest
  [-1, 1].forEach((side) => {
    const strapCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.072, 0.43, -0.71),
      new THREE.Vector3(side * 0.078, 0.30, -0.735),
      new THREE.Vector3(side * 0.052, 0.16, -0.80),
      new THREE.Vector3(side * 0.018, 0.105, -0.865),
    ]);
    const strapMesh = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 14, 0.0055, 4, false), harnessStrapMat);
    strapMesh.scale.set(1.4, 1, 0.5);
    interiorGroup.add(strapMesh);
  });

  // Elevated Ergonomic Wraparound Side Consoles & Armrest Bolsters
  [-1, 1].forEach((side) => {
    const sideConsole = createLoftedGeometry([
      { z: -1.44, ring: [[side * 0.20, 0.125], [side * 0.34, 0.165], [side * 0.35, 0.02], [side * 0.20, 0.02]] },
      { z: -0.78, ring: [[side * 0.21, 0.115], [side * 0.36, 0.155], [side * 0.37, 0.02], [side * 0.21, 0.02]] },
    ], 1, 1, true);
    interiorGroup.add(new THREE.Mesh(sideConsole, cockpitConsoleMat));

    // Padded leather outer thigh/elbow bolster sill
    const sillBolster = createLoftedGeometry([
      { z: -1.36, ring: [[side * 0.315, 0.168], [side * 0.365, 0.162], [side * 0.365, 0.132], [side * 0.315, 0.145]] },
      { z: -0.78, ring: [[side * 0.325, 0.158], [side * 0.38, 0.152], [side * 0.38, 0.125], [side * 0.325, 0.135]] },
    ], 1, 1, true);
    interiorGroup.add(new THREE.Mesh(sillBolster, bolsterLeatherMat));

    // Brushed titanium console inner edge accent rail
    const innerTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.014, 0.62),
      anodizedBezelMat
    );
    innerTrim.position.set(side * 0.204, 0.126, -1.10);
    interiorGroup.add(innerTrim);

    // Metallic hydraulic/cryo umbilical pipes along footwell flanks
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.18, 0.01, -1.46),
      new THREE.Vector3(side * 0.19, 0.04, -1.18),
      new THREE.Vector3(side * 0.185, 0.02, -0.88),
    ]);
    interiorGroup.add(new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 12, 0.008, 6, false), copperPipeMat));
  });

  // Sculpted Wraparound Carbon Glare-Shield & Instrument Coaming Hood
  const cowlGeo = createLoftedGeometry([
    { z: -1.66, ring: [[-0.25, 0.11], [0, 0.14], [0.25, 0.11], [0.31, 0.05], [-0.31, 0.05]] },
    { z: -1.44, ring: [[-0.32, 0.185], [-0.14, 0.228], [0, 0.236], [0.14, 0.228], [0.32, 0.185], [0.34, 0.08], [-0.34, 0.08]] },
    { z: -1.32, ring: [[-0.31, 0.172], [-0.14, 0.218], [0, 0.228], [0.14, 0.218], [0.31, 0.172], [0.32, 0.075], [-0.32, 0.075]] },
  ], 1.5, 0.5, true);
  interiorGroup.add(new THREE.Mesh(cowlGeo, cockpitInteriorTrimMat));

  // Backing instrument bulkhead fascia holding the triple glass MFD bezels cleanly
  const dashBulkheadGeo = createLoftedGeometry([
    { z: -1.42, ring: [[-0.31, 0.19], [0, 0.225], [0.31, 0.19], [0.29, 0.06], [-0.29, 0.06]] },
    { z: -1.33, ring: [[-0.29, 0.185], [0, 0.220], [0.29, 0.185], [0.27, 0.065], [-0.27, 0.065]] },
  ], 1, 1, true);
  interiorGroup.add(new THREE.Mesh(dashBulkheadGeo, cockpitConsoleMat));

  // Brushed Titanium Glare-Shield Brow Beading + Indirect Cyan Accent Light Strip
  const browBeadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.30, 0.178, -1.315),
    new THREE.Vector3(-0.14, 0.221, -1.328),
    new THREE.Vector3(0, 0.231, -1.335),
    new THREE.Vector3(0.14, 0.221, -1.328),
    new THREE.Vector3(0.30, 0.178, -1.315),
  ]);
  interiorGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(browBeadCurve, 22, 0.007, 8, false), titaniumTrimMat)
  );
  const browLedStrip = new THREE.Mesh(
    new THREE.TubeGeometry(browBeadCurve, 22, 0.0028, 6, false),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  browLedStrip.position.set(0, -0.007, 0.006);
  interiorGroup.add(browLedStrip);

  // Helper to mount a chamfered 3D Metallic Bezel around any glass MFD screen
  const mfdKeyGeo = new THREE.BoxGeometry(0.011, 0.0042, 0.004);
  const mfdKeyMat = new THREE.MeshStandardMaterial({
    color: '#4b5768',
    roughness: 0.45,
    metalness: 0.7,
    emissive: '#0c4a6e',
    emissiveIntensity: 0.55,
  });
  const mfdPipGeo = new THREE.BoxGeometry(0.004, 0.0025, 0.002);
  const mfdPipMat = new THREE.MeshBasicMaterial({ color: '#34d399' });
  const mountMfdWithBezel = (
    screenGeoWidth: number,
    screenGeoHeight: number,
    screenMat: THREE.Material,
    pos: THREE.Vector3,
    rotY: number,
    rotX: number
  ) => {
    const bezelGroup = new THREE.Group();
    bezelGroup.position.copy(pos);
    bezelGroup.rotation.order = 'YXZ';
    bezelGroup.rotation.y = rotY;
    bezelGroup.rotation.x = rotX;

    const frameOuter = new THREE.Mesh(
      new THREE.BoxGeometry(screenGeoWidth + 0.022, screenGeoHeight + 0.020, 0.016),
      anodizedBezelMat
    );
    frameOuter.position.z = -0.009;
    bezelGroup.add(frameOuter);

    const screenPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(screenGeoWidth, screenGeoHeight),
      screenMat
    );
    screenPlane.position.z = 0.001;
    bezelGroup.add(screenPlane);

    // Instanced micro soft-keys framing all four bezel edges (single draw call per MFD)
    const keyPositions: Array<[number, number]> = [];
    const halfW = screenGeoWidth * 0.5 + 0.0058;
    const halfH = screenGeoHeight * 0.5 + 0.0056;
    for (let k = -2; k <= 2; k++) {
      keyPositions.push([k * (screenGeoWidth * 0.19), -halfH]);
      keyPositions.push([k * (screenGeoWidth * 0.19), halfH]);
    }
    for (let k = -1.5; k <= 1.5; k += 1) {
      keyPositions.push([-halfW, k * (screenGeoHeight * 0.22)]);
      keyPositions.push([halfW, k * (screenGeoHeight * 0.22)]);
    }
    const keyMesh = new THREE.InstancedMesh(mfdKeyGeo, mfdKeyMat, keyPositions.length);
    const keyMatrix = new THREE.Matrix4();
    keyPositions.forEach(([kx, ky], idx) => {
      keyMatrix.makeTranslation(kx, ky, 0.0005);
      keyMesh.setMatrixAt(idx, keyMatrix);
    });
    keyMesh.instanceMatrix.needsUpdate = true;
    bezelGroup.add(keyMesh);

    // Backlit status pip & anti-glare visor hood over the screen
    const statusPip = new THREE.Mesh(mfdPipGeo, mfdPipMat);
    statusPip.position.set(halfW - 0.002, halfH + 0.0005, 0.001);
    bezelGroup.add(statusPip);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(screenGeoWidth + 0.024, 0.003, 0.026),
      cockpitConsoleMat
    );
    visor.position.set(0, screenGeoHeight * 0.5 + 0.011, 0.004);
    visor.rotation.x = 0.32;
    bezelGroup.add(visor);

    interiorGroup.add(bezelGroup);
    return screenPlane;
  };

  // TRIPLE HI-DPI CURVED GLASS COCKPIT MFD SCREENS (Center PFD + Left Nav Radar + Right Reactor/Systems)
  const pfdCanvas = document.createElement('canvas');
  pfdCanvas.width = 512;
  pfdCanvas.height = 340;
  renderPFDCanvas(pfdCanvas, 0, false, '0 km/s', 0, 0, true, 0);
  const pfdTex = new THREE.CanvasTexture(pfdCanvas);
  pfdTex.colorSpace = THREE.SRGBColorSpace;
  const pfdMat = new THREE.MeshBasicMaterial({ map: pfdTex });
  mountMfdWithBezel(
    0.195,
    0.125,
    pfdMat,
    new THREE.Vector3(0, 0.168, -1.345),
    0,
    -0.25
  );

  const navCanvas = document.createElement('canvas');
  navCanvas.width = 384;
  navCanvas.height = 300;
  renderNavCanvas(navCanvas, 'Terra', '0 km', false, 0);
  const navTex = new THREE.CanvasTexture(navCanvas);
  navTex.colorSpace = THREE.SRGBColorSpace;
  const navMat = new THREE.MeshBasicMaterial({ map: navTex });
  mountMfdWithBezel(
    0.155,
    0.112,
    navMat,
    new THREE.Vector3(-0.185, 0.162, -1.298),
    0.36,
    -0.23
  );

  const sysCanvas = document.createElement('canvas');
  sysCanvas.width = 384;
  sysCanvas.height = 300;
  renderSysCanvas(sysCanvas, 0, 340, true, false);
  const sysTex = new THREE.CanvasTexture(sysCanvas);
  sysTex.colorSpace = THREE.SRGBColorSpace;
  const sysMat = new THREE.MeshBasicMaterial({ map: sysTex });
  mountMfdWithBezel(
    0.155,
    0.112,
    sysMat,
    new THREE.Vector3(0.185, 0.162, -1.298),
    -0.36,
    -0.23
  );

  // Center Tactical Sloped Avionics Pedestal Bridge between Knees
  const centerPedestal = new THREE.Mesh(
    createLoftedGeometry([
      { z: -1.32, ring: [[-0.088, 0.105], [0.088, 0.105], [0.098, 0.0], [-0.098, 0.0]] },
      { z: -1.04, ring: [[-0.075, 0.082], [0.075, 0.082], [0.085, 0.0], [-0.085, 0.0]] },
    ], 1, 1, true),
    cockpitConsoleMat
  );
  interiorGroup.add(centerPedestal);

  // Glowing Master Mode Status Strips on Center Pedestal
  ['#38bdf8', '#10b981', '#fbbf24'].forEach((barHex, idx) => {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.005, 0.012),
      new THREE.MeshBasicMaterial({ color: barHex })
    );
    strip.position.set(0, 0.102 - idx * 0.006, -1.25 + idx * 0.055);
    strip.rotation.x = -0.1;
    interiorGroup.add(strip);
  });

  // 3D Translucent Collimated Sapphire Glass HUD Combiner above center brow
  const holoCanvas = document.createElement('canvas');
  holoCanvas.width = 384;
  holoCanvas.height = 256;
  renderHoloCombiner(holoCanvas, 0, 0, false, 0);
  const holoTex = new THREE.CanvasTexture(holoCanvas);
  holoTex.colorSpace = THREE.SRGBColorSpace;
  const holoMat = new THREE.MeshBasicMaterial({
    map: holoTex,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const holoCombinerGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.175, 0.105), holoMat);
  holoCombinerGlass.position.set(0, 0.285, -1.39);
  holoCombinerGlass.rotation.x = -0.18;
  holoCombinerGlass.renderOrder = 7;
  interiorGroup.add(holoCombinerGlass);

  // Collimator Projector Lens Bar & Sculpted Titanium Combiner Stanchions
  const emitterLens = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.008, 0.022),
    new THREE.MeshBasicMaterial({ color: '#0ea5e9' })
  );
  emitterLens.position.set(0, 0.228, -1.385);
  interiorGroup.add(emitterLens);

  [-0.082, 0.082].forEach((sx) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.007, 0.068, 8), titaniumTrimMat);
    post.position.set(sx, 0.256, -1.388);
    post.rotation.x = -0.18;
    interiorGroup.add(post);
  });

  // Engraved Anodized Side-Console Faceplates with Backlit Legends, Functional Switches,
  // Guarded Mini Toggles & Detented Rotary Knobs (clickable switches live on the faceplates)
  const plateW = 0.13;
  const plateL = 0.24;
  const plateTilt = 0.28;
  const switchCollarGeo = new THREE.CylinderGeometry(0.013, 0.015, 0.008, 14);
  const switchBtnGeo = new THREE.CylinderGeometry(0.0088, 0.0098, 0.01, 14);
  const miniToggleBaseGeo = new THREE.CylinderGeometry(0.0055, 0.0065, 0.004, 10);
  const miniToggleBatGeo = new THREE.CylinderGeometry(0.0016, 0.0026, 0.016, 6);
  miniToggleBatGeo.translate(0, 0.008, 0);
  const knobGeo = new THREE.CylinderGeometry(0.0085, 0.0095, 0.009, 16);
  const knobPointerGeo = new THREE.BoxGeometry(0.0022, 0.0015, 0.0105);
  const miniToggleBatMat = new THREE.MeshStandardMaterial({
    color: '#d6dbe2',
    roughness: 0.22,
    metalness: 0.95,
  });
  const knobPointerMat = new THREE.MeshBasicMaterial({ color: '#f1f5f9' });

  const consoleLayouts = [
    {
      side: -1,
      title: 'SISTEMAS',
      switches: [
        { id: 'headlights', label: 'FARÓIS', color: '#fde047' },
        { id: 'sas', label: 'SAS', color: '#34d399' },
        { id: 'interior_lights', label: 'CABINE', color: '#38bdf8' },
      ],
      toggles: ['O2', 'APU', 'IFF', 'COM', 'ECS'],
    },
    {
      side: 1,
      title: 'TÁTICO',
      switches: [
        { id: 'scanner', label: 'RADAR', color: '#22d3ee' },
        { id: 'shields', label: 'ESCUDO', color: '#a5b4fc' },
        { id: 'boost', label: 'DOBRA', color: '#fb7185' },
      ],
      toggles: ['NAV', 'TRIM', 'AUX', 'DEF', 'HUD'],
    },
  ];
  const switchZs = [-0.03, 0.022, 0.074];
  const toggleZs = [-0.088, -0.048, -0.008, 0.032, 0.072];
  const knobZs = [-0.072, 0.0, 0.072];
  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const unitScale = new THREE.Vector3(1, 1, 1);

  consoleLayouts.forEach((layout) => {
    const { side } = layout;
    const uOf = (o: number) => o * side;
    const plate = new THREE.Group();
    plate.position.set(side * 0.27, 0.148, -1.225);
    plate.rotation.z = side * plateTilt;
    interiorGroup.add(plate);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(plateW + 0.006, 0.01, plateL + 0.006),
      cockpitConsoleMat
    );
    plate.add(slab);

    const labels: ConsolePanelLabel[] = [];
    layout.switches.forEach((sw, i) => {
      labels.push({ text: '', u: uOf(-0.012), z: switchZs[i], ring: 0.0168, color: sw.color });
      labels.push({ text: sw.label, u: uOf(-0.012), z: switchZs[i] + 0.0255, size: 12, color: sw.color });
    });
    layout.toggles.forEach((t, i) => {
      labels.push({ text: t, u: uOf(0.037), z: toggleZs[i] + 0.019, size: 10, color: '#cbd5e1' });
    });
    knobZs.forEach((kz) => {
      labels.push({ text: '', u: uOf(-0.047), z: kz, ring: 0.0105, color: '#94a3b8' });
    });

    const decalTex = createConsolePanelTexture(plateW, plateL, labels, layout.title);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(plateW, plateL),
      new THREE.MeshStandardMaterial({
        map: decalTex,
        emissive: '#ffffff',
        emissiveMap: decalTex,
        emissiveIntensity: 0.32,
        roughness: 0.55,
        metalness: 0.45,
      })
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.y = 0.0052;
    plate.add(decal);

    // Functional backlit push-switches (raycast clickable)
    layout.switches.forEach((sw, i) => {
      const collar = new THREE.Mesh(switchCollarGeo, anodizedBezelMat);
      collar.position.set(uOf(-0.012), 0.009, switchZs[i]);
      plate.add(collar);

      const btnMesh = new THREE.Mesh(switchBtnGeo, new THREE.MeshBasicMaterial({ color: sw.color }));
      btnMesh.position.set(uOf(-0.012), 0.015, switchZs[i]);
      btnMesh.userData = { kind: 'cockpit_button', action: sw.id };
      plate.add(btnMesh);
      clickableCockpitControls.push(btnMesh);

      if (sw.id === 'boost') {
        [-0.019, 0.019].forEach((gz) => {
          const guard = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.016, 0.003), crimsonStripeMat);
          guard.position.set(uOf(-0.012), 0.013, switchZs[i] + gz);
          plate.add(guard);
        });
      }
    });

    // Instanced bat-handle mini toggles (alternating ON/OFF throw)
    const toggleBases = new THREE.InstancedMesh(miniToggleBaseGeo, anodizedBezelMat, toggleZs.length);
    const toggleBats = new THREE.InstancedMesh(miniToggleBatGeo, miniToggleBatMat, toggleZs.length);
    toggleZs.forEach((tz, i) => {
      tmpMatrix.makeTranslation(uOf(0.037), 0.007, tz);
      toggleBases.setMatrixAt(i, tmpMatrix);
      tmpQuat.setFromEuler(tmpEuler.set(i % 2 === 0 ? -0.42 : 0.42, 0, 0));
      tmpMatrix.compose(new THREE.Vector3(uOf(0.037), 0.009, tz), tmpQuat, unitScale);
      toggleBats.setMatrixAt(i, tmpMatrix);
    });
    toggleBases.instanceMatrix.needsUpdate = true;
    toggleBats.instanceMatrix.needsUpdate = true;
    plate.add(toggleBases, toggleBats);

    // Instanced knurled rotary knobs with white pointer caps
    const knobs = new THREE.InstancedMesh(knobGeo, gunmetalMat, knobZs.length);
    const pointers = new THREE.InstancedMesh(knobPointerGeo, knobPointerMat, knobZs.length);
    knobZs.forEach((kz, i) => {
      tmpMatrix.makeTranslation(uOf(-0.047), 0.0095, kz);
      knobs.setMatrixAt(i, tmpMatrix);
      tmpQuat.setFromEuler(tmpEuler.set(0, (i - 1) * 0.9 + side * 0.3, 0));
      tmpMatrix.compose(new THREE.Vector3(uOf(-0.047), 0.0143, kz), tmpQuat, unitScale);
      pointers.setMatrixAt(i, tmpMatrix);
    });
    knobs.instanceMatrix.needsUpdate = true;
    pointers.instanceMatrix.needsUpdate = true;
    plate.add(knobs, pointers);
  });

  // Sculpted HOTAS S-Curved Flight Stick (ergonomic right-console mount clearly in FOV)
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0.205, 0.115, -1.06);
  const stickBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.028, 12), bolsterLeatherMat);
  yokeGroup.add(stickBoot);

  const stickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.01, 0),
    new THREE.Vector3(0, 0.05, -0.01),
    new THREE.Vector3(0, 0.095, 0.01),
    new THREE.Vector3(0, 0.128, 0.002),
  ]);
  yokeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(stickCurve, 14, 0.011, 10, false), titaniumTrimMat));

  const gripHead = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.042, 12), gunmetalMat);
  gripHead.position.set(0, 0.128, 0.002);
  gripHead.rotation.x = 0.22;
  yokeGroup.add(gripHead);

  const palmRest = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.020, 0.006, 12), bolsterLeatherMat);
  palmRest.position.set(0.004, 0.107, 0.008);
  yokeGroup.add(palmRest);

  const pinkyLever = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.008), anodizedBezelMat);
  pinkyLever.position.set(0, 0.118, -0.015);
  pinkyLever.rotation.x = 0.35;
  yokeGroup.add(pinkyLever);

  const trimHat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.009, 0.007, 8),
    anodizedBezelMat
  );
  trimHat.position.set(0, 0.151, 0.008);
  yokeGroup.add(trimHat);
  const castleLed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 8),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  castleLed.position.set(0, 0.155, 0.008);
  yokeGroup.add(castleLed);

  const fireTrigger = new THREE.Mesh(
    new THREE.SphereGeometry(0.0085, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ef4444' })
  );
  fireTrigger.position.set(0, 0.145, -0.011);
  fireTrigger.userData = { kind: 'cockpit_button', action: 'fire' };
  yokeGroup.add(fireTrigger);
  clickableCockpitControls.push(fireTrigger);
  interiorGroup.add(yokeGroup);

  // Twin-Lever Sliding HOTAS Throttle Quadrant on Raised Left Console with Friction Wheel & Detents
  const throttleSlideBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.014, 0.125),
    anodizedBezelMat
  );
  throttleSlideBase.position.set(-0.225, 0.145, -1.045);
  interiorGroup.add(throttleSlideBase);

  const frictionWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.008, 14), gunmetalMat);
  frictionWheel.rotation.z = Math.PI / 2;
  frictionWheel.position.set(-0.183, 0.146, -1.045);
  interiorGroup.add(frictionWheel);

  [-1.09, -1.045, -1.00].forEach((dz) => {
    const detentTick = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.005), titaniumTrimMat);
    detentTick.position.set(-0.256, 0.154, dz);
    interiorGroup.add(detentTick);
  });

  const detentLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.003, 0.105),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  detentLed.position.set(-0.195, 0.153, -1.045);
  interiorGroup.add(detentLed);

  const throttleGroup = new THREE.Group();
  throttleGroup.position.set(-0.225, 0.148, -1.045);
  [-0.014, 0.014].forEach((lx) => {
    const tLeverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(lx, 0, 0),
      new THREE.Vector3(lx, 0.052, -0.008),
    ]);
    throttleGroup.add(new THREE.Mesh(new THREE.TubeGeometry(tLeverCurve, 8, 0.0065, 8, false), titaniumTrimMat));
  });
  const tGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.068, 12), gunmetalMat);
  tGrip.rotation.z = Math.PI / 2;
  tGrip.position.set(0, 0.056, -0.010);
  tGrip.userData = { kind: 'cockpit_button', action: 'throttle_step' };
  throttleGroup.add(tGrip);
  const tGripBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.044, 0.005, 0.008),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  tGripBand.position.set(0, 0.066, -0.019);
  throttleGroup.add(tGripBand);
  clickableCockpitControls.push(tGrip);
  interiorGroup.add(throttleGroup);

  // Dual Scale-Invariant Cockpit Interior Illumination (illuminates dashboard, consoles & rear avionics!)
  const interiorLight = new THREE.PointLight('#bae6fd', 1.65, 4.4, 0);
  interiorLight.position.set(0, 0.45, -0.96);
  interiorGroup.add(interiorLight);

  const consoleGlowLight = new THREE.PointLight('#38bdf8', 0.85, 3.2, 0);
  consoleGlowLight.position.set(0, 0.24, -1.24);
  interiorGroup.add(consoleGlowLight);

  // Panoramic Pilot Eye Anchor inside fitted cockpit bay (auto-inherits interiorGroup transform)
  const cockpitSeatAnchor = new THREE.Object3D();
  cockpitSeatAnchor.position.set(0, 0.345, -0.90);
  interiorGroup.add(cockpitSeatAnchor);

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

    // Adaptive canopy glass clarity: clear panoramic cockpit glass vs sapphire exterior sheen
    canopyGlassMat.opacity = isCockpitView ? 0.085 : 0.44;
    canopyGlassMat.color.set(isCockpitView ? '#cfe9ff' : '#93c5fd');

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

    // 3. Headlights & Scale-Invariant Cabin Interior Lights
    headlightBeamGroup.visible = headlightsOn;
    const spotDist = Math.max(0.0005, shipScale * 95);
    headlightLeftSpot.distance = spotDist;
    headlightRightSpot.distance = spotDist;
    headlightLeftSpot.intensity = headlightsOn ? 6.5 : 0;
    headlightRightSpot.intensity = headlightsOn ? 6.5 : 0;
    interiorLight.distance = Math.max(0.0001, shipScale * 3.8);
    interiorLight.intensity = interiorLightsOn ? 1.65 : 0.38;
    consoleGlowLight.distance = Math.max(0.0001, shipScale * 3.0);
    consoleGlowLight.intensity = interiorLightsOn ? 0.85 : 0.32;

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

    // 7. Refresh 3D Glass Cockpit MFD Screens & Holographic HUD (~14 fps)
    mfdTimer += dt;
    if (mfdTimer > 0.07) {
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
