import * as THREE from 'three';

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
  clickableCockpitControls: THREE.Object3D[];
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
  }) => void;
}

/**
 * Generates high-resolution 1024x1024 procedural PBR maps (albedo, bump, roughness)
 * with realistic spacecraft ceramic plates, metallic seams, rivets, weathering & markings.
 */
function createSR7PBRTextures(withDecal = false): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base composite ceramic titanium plating
  ctx.fillStyle = '#d3d0c8';
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#848484';
  bCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = '#9a9a9a'; // ~0.60 base ceramic roughness
  rCtx.fillRect(0, 0, size, size);

  // Subtle brushed alloy horizontal micro-grain
  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 4 + Math.random() * 24;
    const h = 1 + Math.random() * 1.5;
    const isLight = Math.random() < 0.45;
    ctx.fillStyle = isLight ? 'rgba(255, 253, 248, 0.055)' : 'rgba(28, 34, 42, 0.065)';
    ctx.fillRect(x, y, w, h);

    rCtx.fillStyle = isLight ? 'rgba(95, 95, 95, 0.14)' : 'rgba(200, 200, 200, 0.12)';
    rCtx.fillRect(x, y, w, h);
  }

  // Multi-tier armor panel grid
  const panelGrid: Array<[number, number, number, number, string]> = [
    [0, 0, 256, 220, '#cbc7be'],
    [256, 0, 256, 220, '#d7d4cc'],
    [512, 0, 256, 220, '#c2beb5'],
    [768, 0, 256, 220, '#d4d0c7'],
    [0, 220, 192, 260, '#d8d5cd'],
    [192, 220, 320, 260, '#c8c4bb'],
    [512, 220, 320, 260, '#d0cdc4'],
    [832, 220, 192, 260, '#bcb8af'],
    [0, 480, 290, 256, '#c4c0b7'],
    [290, 480, 222, 256, '#dbd8d0'],
    [512, 480, 256, 256, '#c9c5bc'],
    [768, 480, 256, 256, '#d2cfc6'],
    [0, 736, 360, 288, '#cfcbc2'],
    [360, 736, 304, 288, '#bfbbb2'],
    [664, 736, 360, 288, '#d5d2ca'],
  ];

  panelGrid.forEach(([x, y, w, h, tone], idx) => {
    ctx.fillStyle = tone;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);

    // Subtle edge bevel shading & ambient occlusion along seams
    const edgeGrad = ctx.createLinearGradient(x, y, x, y + h);
    edgeGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
    edgeGrad.addColorStop(0.15, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(0.88, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, 'rgba(15,20,28,0.14)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);

    // Metallic bevel seam
    ctx.strokeStyle = 'rgba(24, 28, 34, 0.65)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    bCtx.strokeStyle = '#242424';
    bCtx.lineWidth = 4;
    bCtx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    bCtx.strokeStyle = '#a8a8a8';
    bCtx.lineWidth = 1.5;
    bCtx.strokeRect(x + 4, y + 4, w - 8, h - 8);

    // Shined seam edges in roughness map
    rCtx.fillStyle = idx % 2 === 0 ? '#8c8c8c' : '#a8a8a8';
    rCtx.fillRect(x + 6, y + 6, w - 12, h - 12);
    rCtx.strokeStyle = '#4a4a4a';
    rCtx.lineWidth = 3;
    rCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    // Countersunk titanium fasteners
    ctx.fillStyle = 'rgba(40, 44, 52, 0.55)';
    bCtx.fillStyle = '#cfcfcf';
    rCtx.fillStyle = '#404040';
    for (let rx = x + 18; rx < x + w - 14; rx += 28) {
      [y + 9, y + h - 11].forEach((ry) => {
        ctx.fillRect(rx, ry, 3, 3);
        bCtx.fillRect(rx, ry, 3, 3);
        rCtx.fillRect(rx, ry, 3, 3);
      });
    }

    // Occasional titanium maintenance access hatch
    if (idx % 4 === 1) {
      const hx = x + 28;
      const hy = y + 32;
      const hw = Math.min(82, w - 56);
      const hh = Math.min(54, h - 64);
      ctx.fillStyle = 'rgba(72, 78, 88, 0.22)';
      ctx.fillRect(hx, hy, hw, hh);
      ctx.strokeStyle = 'rgba(20, 24, 30, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, hw, hh);
      bCtx.strokeStyle = '#363636';
      bCtx.strokeRect(hx, hy, hw, hh);
    }
  });

  // Atmospheric re-entry scorch streaks & soot patina
  for (let s = 0; s < 110; s++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const len = 35 + Math.random() * 140;
    const thick = 2 + Math.random() * 5;
    const grad = ctx.createLinearGradient(sx, sy, sx + len, sy);
    grad.addColorStop(0, 'rgba(24, 22, 20, 0.22)');
    grad.addColorStop(0.5, 'rgba(38, 34, 30, 0.08)');
    grad.addColorStop(1, 'rgba(24, 22, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, len, thick);

    rCtx.fillStyle = 'rgba(235, 235, 235, 0.14)';
    rCtx.fillRect(sx, sy, len, thick);
  }

  if (withDecal) {
    // Aerospace squadron crimson stripe + stenciled SR-7 markings
    ctx.fillStyle = 'rgba(154, 29, 29, 0.88)';
    ctx.fillRect(size * 0.62, 0, 68, size);

    ctx.fillStyle = 'rgba(30, 34, 40, 0.82)';
    ctx.fillRect(size * 0.62 - 14, 0, 10, size);

    ctx.fillStyle = 'rgba(20, 22, 26, 0.9)';
    ctx.font = 'bold 88px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SR-7', size * 0.34, size * 0.48);

    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = 'rgba(154, 29, 29, 0.9)';
    ctx.fillText('DEEP SPACE RECON', size * 0.34, size * 0.56);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.needsUpdate = true;

  return { map, bumpMap, roughnessMap };
}

/**
 * Creates a seamless lofted multi-station BufferGeometry along Z with crisp normals and UV seams.
 * Each station supplies an array of [x, y] ring points ordered consistently around the perimeter.
 */
function createLoftedGeometry(
  stations: Array<{ z: number; ring: Array<[number, number]> }>,
  uvScaleU = 1.0,
  uvScaleV = 0.25,
  capEnds = true
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
  for (let s = 0; s < numStations - 1; s++) {
    for (let r = 0; r < ringCount; r++) {
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
 * Generates crisp collimated holographic reticle canvas texture for the 3D glass HUD combiner.
 */
function renderHoloCombiner(
  canvas: HTMLCanvasElement,
  pitchDeg: number,
  rollDeg: number,
  boostActive: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const primary = boostActive ? 'rgba(103, 232, 249, 0.92)' : 'rgba(56, 189, 248, 0.84)';
  const subtle = boostActive ? 'rgba(103, 232, 249, 0.42)' : 'rgba(56, 189, 248, 0.35)';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-rollDeg * Math.PI) / 180);

  // Subtle horizon bars
  ctx.strokeStyle = subtle;
  ctx.lineWidth = 2;
  const pitchShift = THREE.MathUtils.clamp(-pitchDeg * 1.4, -70, 70);
  [-44, 0, 44].forEach((offsetY) => {
    const y = offsetY + pitchShift;
    const span = offsetY === 0 ? 92 : 48;
    ctx.beginPath();
    ctx.moveTo(-span, y);
    ctx.lineTo(-22, y);
    ctx.moveTo(22, y);
    ctx.lineTo(span, y);
    ctx.stroke();
  });
  ctx.restore();

  // Fixed flight vector boresight ring
  ctx.strokeStyle = primary;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 28, cy);
  ctx.lineTo(cx - 18, cy);
  ctx.moveTo(cx + 18, cy);
  ctx.lineTo(cx + 28, cy);
  ctx.moveTo(cx, cy - 26);
  ctx.lineTo(cx, cy - 18);
  ctx.stroke();
}

function renderPFDCanvas(
  canvas: HTMLCanvasElement,
  throttle: number,
  boostActive: boolean,
  speedFormatted: string,
  pitchDeg: number,
  rollDeg: number,
  sasEnabled: boolean
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#040d19';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = boostActive ? '#22d3ee' : '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Artificial Horizon Sphere
  const cx = w * 0.5;
  const cy = h * 0.52;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(cx, cy);
  ctx.rotate((-rollDeg * Math.PI) / 180);
  const py = THREE.MathUtils.clamp(pitchDeg * 1.1, -45, 45);
  ctx.fillStyle = '#0c2d48';
  ctx.fillRect(-90, -90 + py, 180, 90);
  ctx.fillStyle = '#1e1b18';
  ctx.fillRect(-90, py, 180, 90);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-70, py);
  ctx.lineTo(70, py);
  ctx.stroke();
  ctx.restore();

  // Horizon Ring Outline
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.stroke();

  // Fixed miniature aircraft symbol
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.lineTo(cx, cy + 7);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.stroke();

  // Top Header + Readouts
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PFD // HORIZONTE', 16, 26);

  ctx.fillStyle = sasEnabled ? '#34d399' : '#f87171';
  ctx.fillText(sasEnabled ? 'SAS ON' : 'NEWTON', w - 92, 26);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(speedFormatted, 16, h - 18);

  ctx.fillStyle = boostActive ? '#22d3ee' : '#fbbf24';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(throttle * 100)}% THR`, w - 16, h - 18);
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
  ctx.fillStyle = '#040d19';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  const cx = w * 0.5;
  const cy = h * 0.48;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 1.5;
  [22, 44, 66].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  const sweep = (clockTime * 2.1) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * 66, cy + Math.sin(sweep) * 66);
  ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.lineTo(cx - 4, cy + 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('RADAR NAV', 14, 24);

  ctx.fillStyle = autopilotActive ? '#38bdf8' : '#e2e8f0';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(nearestName.toUpperCase().slice(0, 14), 14, h - 34);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText(nearestDist, 14, h - 14);
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
  ctx.fillStyle = '#040d19';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('PROPULSÃO & NÚCLEO', 14, 24);

  // Stylised mini SR-7 hull wireframe schematic
  ctx.strokeStyle = shieldsOn ? '#38bdf8' : '#64748b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 46);
  ctx.lineTo(w * 0.62, 85);
  ctx.lineTo(w * 0.85, 118);
  ctx.lineTo(w * 0.85, 134);
  ctx.lineTo(w * 0.58, 134);
  ctx.lineTo(w * 0.5, 144);
  ctx.lineTo(w * 0.42, 134);
  ctx.lineTo(w * 0.15, 134);
  ctx.lineTo(w * 0.15, 118);
  ctx.lineTo(w * 0.38, 85);
  ctx.closePath();
  ctx.stroke();

  // Temp bar
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.fillText(`REATOR: ${Math.round(reactorTempC)}°C`, 14, h - 42);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(14, h - 32, w - 28, 10);
  const heatFrac = THREE.MathUtils.clamp((reactorTempC - 280) / 700, 0.08, 1);
  ctx.fillStyle = boostActive ? '#22d3ee' : throttle > 0.7 ? '#fb923c' : '#10b981';
  ctx.fillRect(14, h - 32, (w - 28) * heatFrac, 10);

  ctx.fillStyle = shieldsOn ? '#818cf8' : '#64748b';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(shieldsOn ? 'ESCUDOS: 100% ATIVOS' : 'ESCUDOS: DESLIGADOS', 14, h - 8);
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

  const { map: hullTex, bumpMap: hullBump, roughnessMap: hullRough } = createSR7PBRTextures(false);
  const { map: decalTex } = createSR7PBRTextures(true);

  const armorWhiteMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    bumpMap: hullBump,
    bumpScale: 0.018,
    roughnessMap: hullRough,
    color: '#ebe8df',
    roughness: 0.72,
    metalness: 0.42,
    envMapIntensity: 1.25,
  });

  const armorDarkMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    bumpMap: hullBump,
    bumpScale: 0.02,
    roughnessMap: hullRough,
    color: '#2c323b',
    roughness: 0.62,
    metalness: 0.72,
    envMapIntensity: 1.35,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    bumpMap: hullBump,
    bumpScale: 0.012,
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
    map: hullTex,
    bumpMap: hullBump,
    bumpScale: 0.012,
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

  const decalPanelMat = new THREE.MeshStandardMaterial({
    map: decalTex,
    bumpMap: hullBump,
    bumpScale: 0.016,
    roughnessMap: hullRough,
    roughness: 0.68,
    metalness: 0.42,
    envMapIntensity: 1.25,
  });

  const cockpitInteriorTrimMat = new THREE.MeshStandardMaterial({
    color: '#171c24',
    roughness: 0.68,
    metalness: 0.35,
  });

  const bolsterLeatherMat = new THREE.MeshStandardMaterial({
    color: '#1f242c',
    roughness: 0.78,
    metalness: 0.1,
  });

  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#b8e4ff',
    transparent: true,
    opacity: 0.13,
    roughness: 0.05,
    metalness: 0.12,
    reflectivity: 0.96,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const clickableCockpitControls: THREE.Object3D[] = [];

  // ============================================================================
  // 1. SCULPTED LOFTED AEROSPACE FUSELAGE (Beveled Chined Hull — Zero Blockiness)
  // ============================================================================
  // Main Lower & Chined Fuselage Station Ring (10-point symmetrical chine profile)
  // Top deck along cockpit bay stays low (y <= 0.02) so cockpit sits recessed & clean!
  const fuselageStations: Array<{ z: number; ring: Array<[number, number]> }> = [
    {
      z: -2.86,
      ring: [
        [-0.14, 0.02], [0.14, 0.02],
        [0.24, -0.02], [0.22, -0.10], [0.10, -0.16],
        [-0.10, -0.16], [-0.22, -0.10], [-0.24, -0.02],
      ],
    },
    {
      z: -2.35,
      ring: [
        [-0.28, 0.06], [0.28, 0.06],
        [0.46, 0.01], [0.40, -0.16], [0.20, -0.24],
        [-0.20, -0.24], [-0.40, -0.16], [-0.46, 0.01],
      ],
    },
    {
      z: -1.72,
      ring: [
        [-0.41, 0.11], [0.41, 0.11],
        [0.64, 0.02], [0.56, -0.22], [0.30, -0.31],
        [-0.30, -0.31], [-0.56, -0.22], [-0.64, 0.02],
      ],
    },
    {
      z: -0.95,
      ring: [
        [-0.44, 0.10], [0.44, 0.10],
        [0.74, 0.01], [0.68, -0.24], [0.36, -0.33],
        [-0.36, -0.33], [-0.68, -0.24], [-0.74, 0.01],
      ],
    },
    {
      z: -0.38,
      ring: [
        [-0.46, 0.14], [0.46, 0.14],
        [0.84, 0.04], [0.76, -0.25], [0.42, -0.33],
        [-0.42, -0.33], [-0.76, -0.25], [-0.84, 0.04],
      ],
    },
    {
      z: 0.42,
      ring: [
        [-0.54, 0.24], [0.54, 0.24],
        [0.98, 0.05], [0.88, -0.24], [0.48, -0.32],
        [-0.48, -0.32], [-0.88, -0.24], [-0.98, 0.05],
      ],
    },
    {
      z: 1.35,
      ring: [
        [-0.58, 0.24], [0.58, 0.24],
        [1.04, 0.04], [0.94, -0.22], [0.46, -0.29],
        [-0.46, -0.29], [-0.94, -0.22], [-1.04, 0.04],
      ],
    },
    {
      z: 1.98,
      ring: [
        [-0.48, 0.20], [0.48, 0.20],
        [0.92, 0.03], [0.82, -0.18], [0.38, -0.24],
        [-0.38, -0.24], [-0.82, -0.18], [-0.92, 0.03],
      ],
    },
  ];
  const mainHullGeo = createLoftedGeometry(fuselageStations, 2.0, 0.35, true);
  const mainHullMesh = new THREE.Mesh(mainHullGeo, armorWhiteMat);
  hullGroup.add(mainHullMesh);

  // Dark Ventral Underbelly Keel Armor Spine
  const bellyKeelGeo = createLoftedGeometry([
    { z: -2.65, ring: [[-0.14, -0.14], [0.14, -0.14], [0.10, -0.22], [-0.10, -0.22]] },
    { z: -1.65, ring: [[-0.34, -0.28], [0.34, -0.28], [0.24, -0.35], [-0.24, -0.35]] },
    { z: 0.2, ring: [[-0.48, -0.29], [0.48, -0.29], [0.34, -0.36], [-0.34, -0.36]] },
    { z: 1.75, ring: [[-0.36, -0.22], [0.36, -0.22], [0.22, -0.30], [-0.22, -0.30]] },
  ], 1.2, 0.35, true);
  hullGroup.add(new THREE.Mesh(bellyKeelGeo, armorDarkMat));

  // Forward Chin Armored Cowling (visible gracefully along bottom sightline inside cockpit!)
  const noseHoodGeo = createLoftedGeometry([
    { z: -2.84, ring: [[-0.13, 0.02], [0.13, 0.02], [0.16, -0.02], [-0.16, -0.02]] },
    { z: -2.25, ring: [[-0.28, 0.075], [0.28, 0.075], [0.32, 0.01], [-0.32, 0.01]] },
    { z: -1.72, ring: [[-0.36, 0.115], [0.36, 0.115], [0.42, 0.04], [-0.42, 0.04]] },
  ], 1.0, 0.4, true);
  hullGroup.add(new THREE.Mesh(noseHoodGeo, armorWhiteMat));

  // Nose Front Sensor Intake Aperture & Recessed LED Floodlights
  const noseIntakeLip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.34, 8), gunmetalMat);
  noseIntakeLip.rotation.z = Math.PI / 2;
  noseIntakeLip.scale.set(0.45, 1.0, 0.65);
  noseIntakeLip.position.set(0, -0.07, -2.84);
  hullGroup.add(noseIntakeLip);

  const headlightMat = new THREE.MeshBasicMaterial({ color: '#fef9c3' });
  [-0.19, 0.19].forEach((hx) => {
    const hlHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8), gunmetalMat);
    hlHousing.rotation.x = Math.PI / 2;
    hlHousing.scale.set(1.4, 1.0, 0.75);
    hlHousing.position.set(hx, -0.06, -2.82);
    hullGroup.add(hlHousing);

    const hlGlow = new THREE.Mesh(new THREE.CircleGeometry(0.038, 12), headlightMat);
    hlGlow.rotation.y = Math.PI;
    hlGlow.scale.set(1.35, 0.72, 1);
    hlGlow.position.set(hx, -0.06, -2.885);
    hullGroup.add(hlGlow);
  });

  // Side Chined Cheek Armor Shrouds with SR-7 Squadron Markings & Intake Louvers
  [-1, 1].forEach((side) => {
    const cheekArmorGeo = createLoftedGeometry([
      { z: -1.75, ring: [[side * 0.44, 0.08], [side * 0.56, 0.02], [side * 0.48, -0.14], [side * 0.36, -0.12]] },
      { z: -0.45, ring: [[side * 0.54, 0.14], [side * 0.80, 0.05], [side * 0.72, -0.20], [side * 0.44, -0.16]] },
      { z: 0.45, ring: [[side * 0.62, 0.22], [side * 0.96, 0.06], [side * 0.86, -0.19], [side * 0.52, -0.15]] },
    ], 1.2, 0.45, true);
    const cheekMesh = new THREE.Mesh(cheekArmorGeo, decalPanelMat);
    hullGroup.add(cheekMesh);

    // Side Radiator / Heat-Exchanger Intake Nacelles with Turbine Core
    const intakeCowling = createLoftedGeometry([
      { z: 0.08, ring: [[side * 0.76, 0.14], [side * 1.06, 0.12], [side * 1.02, -0.16], [side * 0.72, -0.14]] },
      { z: 0.95, ring: [[side * 0.74, 0.18], [side * 1.10, 0.12], [side * 1.04, -0.18], [side * 0.70, -0.15]] },
    ], 1.0, 0.5, true);
    hullGroup.add(new THREE.Mesh(intakeCowling, armorDarkMat));

    // Recessed cyan plasma intake glow inside mid vents
    const intakeGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.18),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide })
    );
    intakeGlow.position.set(side * 0.9, 0.0, 0.075);
    hullGroup.add(intakeGlow);

    // Diagonal Titanium Heat-Sink Louvers
    for (let v = 0; v < 4; v++) {
      const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.24, 6), titaniumTrimMat);
      slat.rotation.z = Math.PI / 2;
      slat.position.set(side * 0.91, -0.09 + v * 0.06, 0.072);
      hullGroup.add(slat);
    }

    // Cheek Navigation Strobe Bar
    const cheekLight = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 8), headlightMat);
    cheekLight.rotation.x = Math.PI / 2;
    cheekLight.position.set(side * 0.56, -0.05, -2.02);
    hullGroup.add(cheekLight);
  });

  // Sculpted Dorsal Spine Fairing & Rear Bridge Housing
  const dorsalGeo = createLoftedGeometry([
    { z: -0.56, ring: [[-0.30, 0.18], [0.30, 0.18], [0.44, 0.50], [0.0, 0.55], [-0.44, 0.50]] },
    { z: 0.15, ring: [[-0.44, 0.22], [0.44, 0.22], [0.54, 0.44], [0.0, 0.50], [-0.54, 0.44]] },
    { z: 1.15, ring: [[-0.50, 0.21], [0.50, 0.21], [0.62, 0.36], [0.0, 0.42], [-0.62, 0.36]] },
    { z: 1.88, ring: [[-0.40, 0.18], [0.40, 0.18], [0.48, 0.26], [0.0, 0.30], [-0.48, 0.26]] },
  ], 1.5, 0.4, true);
  hullGroup.add(new THREE.Mesh(dorsalGeo, armorWhiteMat));

  // Dark Crimson Squadron Saddle Accent along Upper Spine
  const spineTrimGeo = createLoftedGeometry([
    { z: -0.45, ring: [[-0.14, 0.525], [0.14, 0.525], [0.18, 0.49], [-0.18, 0.49]] },
    { z: 1.65, ring: [[-0.10, 0.33], [0.10, 0.33], [0.14, 0.29], [-0.14, 0.29]] },
  ], 1.0, 0.4, true);
  hullGroup.add(new THREE.Mesh(spineTrimGeo, crimsonStripeMat));

  // ============================================================================
  // 2. PANORAMIC AEROSPACE CANOPY (Ultra-Slim Titanium Arches for Wide FOV!)
  // ============================================================================
  // Slender Curved Canopy Framing (No thick center blocker; wide peripheral arches!)
  [-1, 1].forEach((side) => {
    // Sculpted lower side canopy rail
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.34, 0.11, -1.74),
      new THREE.Vector3(side * 0.45, 0.16, -1.24),
      new THREE.Vector3(side * 0.45, 0.22, -0.58),
    ]);
    const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 14, 0.028, 8, false), titaniumTrimMat);
    hullGroup.add(railMesh);

    // Swept slender side windshield bow arch (pushed to outer periphery |x| ~ 0.35..0.44)
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.28, 0.12, -1.72),
      new THREE.Vector3(side * 0.37, 0.41, -1.36),
      new THREE.Vector3(side * 0.36, 0.55, -0.82),
      new THREE.Vector3(side * 0.38, 0.50, -0.54),
    ]);
    const archMesh = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 18, 0.02, 8, false), gunmetalMat);
    hullGroup.add(archMesh);

    // Subtle upper side glass pane (tapered, clear peripheral sightline)
    const sideGlassShape = new THREE.Shape();
    sideGlassShape.moveTo(0, 0);
    sideGlassShape.lineTo(1.12, 0.06);
    sideGlassShape.lineTo(1.02, 0.34);
    sideGlassShape.lineTo(0.28, 0.28);
    sideGlassShape.closePath();
    const sideGlass = new THREE.Mesh(new THREE.ShapeGeometry(sideGlassShape), canopyGlassMat);
    sideGlass.position.set(side * 0.41, 0.16, -1.68);
    sideGlass.rotation.y = side * (Math.PI / 2 - 0.1);
    if (side === -1) sideGlass.rotation.y = -Math.PI / 2 - 0.1;
    hullGroup.add(sideGlass);
  });

  // High Overhead Aft Canopy Hoop (far above eye horizon y=0.56 so forward space view is unobstructed!)
  const overheadHoop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.37, 0.54, -0.92),
    new THREE.Vector3(0, 0.59, -0.95),
    new THREE.Vector3(0.37, 0.54, -0.92),
  ]);
  hullGroup.add(new THREE.Mesh(new THREE.TubeGeometry(overheadHoop, 16, 0.022, 8, false), gunmetalMat));

  const frontBrowHoop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.36, 0.42, -1.34),
    new THREE.Vector3(0, 0.49, -1.38),
    new THREE.Vector3(0.36, 0.42, -1.34),
  ]);
  hullGroup.add(new THREE.Mesh(new THREE.TubeGeometry(frontBrowHoop, 16, 0.014, 8, false), titaniumTrimMat));

  // Swept Curved Front Bubble Canopy Glass
  const curvedWindshield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.92, 16, 1, true, -Math.PI * 0.36, Math.PI * 0.72),
    canopyGlassMat
  );
  curvedWindshield.rotation.x = Math.PI * 0.33;
  curvedWindshield.position.set(0, 0.24, -1.32);
  hullGroup.add(curvedWindshield);

  // ============================================================================
  // 3. REALISTIC ERGONOMIC GLASS COCKPIT INTERIOR (Wide FOV & Multi-MFD Suite!)
  // ============================================================================
  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'sr7-cockpit-interior';
  rootGroup.add(interiorGroup);

  // Ribbed Cockpit Floor & Angled Side Consoles
  const deckFloor = new THREE.Mesh(
    createLoftedGeometry([
      { z: -1.62, ring: [[-0.30, -0.02], [0.30, -0.02], [0.32, -0.06], [-0.32, -0.06]] },
      { z: -0.58, ring: [[-0.38, -0.02], [0.38, -0.02], [0.40, -0.06], [-0.40, -0.06]] },
    ], 1, 1, true),
    cockpitInteriorTrimMat
  );
  interiorGroup.add(deckFloor);

  // Armored Sculpted Seat with Padded Headrest Bolsters (kept behind eye z=-0.96)
  const seatBucketGeo = createLoftedGeometry([
    { z: -0.96, ring: [[-0.14, 0.05], [0.14, 0.05], [0.15, 0.0], [-0.15, 0.0]] },
    { z: -0.74, ring: [[-0.16, 0.06], [0.16, 0.06], [0.17, 0.0], [-0.17, 0.0]] },
  ], 1, 1, true);
  interiorGroup.add(new THREE.Mesh(seatBucketGeo, bolsterLeatherMat));

  const seatBackCurve = new THREE.Mesh(
    createLoftedGeometry([
      { z: -0.76, ring: [[-0.15, 0.06], [0.15, 0.06], [0.17, 0.28], [0.11, 0.44], [-0.11, 0.44], [-0.17, 0.28]] },
      { z: -0.68, ring: [[-0.16, 0.06], [0.16, 0.06], [0.18, 0.28], [0.12, 0.44], [-0.12, 0.44], [-0.18, 0.28]] },
    ], 1, 1, true),
    armorDarkMat
  );
  interiorGroup.add(seatBackCurve);

  // Sloped Ergonomic Left & Right Side Instrument Consoles
  [-1, 1].forEach((side) => {
    const sideConsole = createLoftedGeometry([
      { z: -1.46, ring: [[side * 0.22, 0.05], [side * 0.36, 0.11], [side * 0.38, -0.01], [side * 0.22, -0.01]] },
      { z: -0.78, ring: [[side * 0.24, 0.04], [side * 0.40, 0.10], [side * 0.40, -0.01], [side * 0.24, -0.01]] },
    ], 1, 1, true);
    interiorGroup.add(new THREE.Mesh(sideConsole, cockpitInteriorTrimMat));
  });

  // Sculpted Low-Profile Curved Glare-Shield Cowl (dipped well below eye horizon!)
  const cowlGeo = createLoftedGeometry([
    { z: -1.66, ring: [[-0.26, 0.08], [0, 0.115], [0.26, 0.08], [0.34, 0.02], [-0.34, 0.02]] },
    { z: -1.36, ring: [[-0.36, 0.125], [0, 0.165], [0.36, 0.125], [0.38, 0.03], [-0.38, 0.03]] },
    { z: -1.24, ring: [[-0.32, 0.075], [0, 0.105], [0.32, 0.075], [0.34, 0.01], [-0.34, 0.01]] },
  ], 1.5, 0.5, true);
  interiorGroup.add(new THREE.Mesh(cowlGeo, cockpitInteriorTrimMat));

  // Brushed Titanium Glare-Shield Brow Beading
  const browBeadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 0.125, -1.35),
    new THREE.Vector3(0, 0.166, -1.36),
    new THREE.Vector3(0.34, 0.125, -1.35),
  ]);
  interiorGroup.add(
    new THREE.Mesh(new THREE.TubeGeometry(browBeadCurve, 18, 0.008, 6, false), titaniumTrimMat)
  );

  // TRIPLE CURVED GLASS COCKPIT MFD SCREENS (Center PFD + Left Nav Radar + Right Reactor/Systems)
  const pfdCanvas = document.createElement('canvas');
  pfdCanvas.width = 320;
  pfdCanvas.height = 240;
  renderPFDCanvas(pfdCanvas, 0, false, '0 km/s', 0, 0, true);
  const pfdTex = new THREE.CanvasTexture(pfdCanvas);
  pfdTex.colorSpace = THREE.SRGBColorSpace;
  const pfdMat = new THREE.MeshBasicMaterial({ map: pfdTex });

  const pfdMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.145), pfdMat);
  pfdMesh.position.set(0, 0.115, -1.275);
  pfdMesh.rotation.x = -0.34;
  interiorGroup.add(pfdMesh);

  const navCanvas = document.createElement('canvas');
  navCanvas.width = 256;
  navCanvas.height = 224;
  renderNavCanvas(navCanvas, 'Terra', '0 km', false, 0);
  const navTex = new THREE.CanvasTexture(navCanvas);
  navTex.colorSpace = THREE.SRGBColorSpace;
  const navMat = new THREE.MeshBasicMaterial({ map: navTex });

  const navMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.13), navMat);
  navMesh.position.set(-0.21, 0.11, -1.245);
  navMesh.rotation.order = 'YXZ';
  navMesh.rotation.y = 0.28;
  navMesh.rotation.x = -0.32;
  interiorGroup.add(navMesh);

  const sysCanvas = document.createElement('canvas');
  sysCanvas.width = 256;
  sysCanvas.height = 224;
  renderSysCanvas(sysCanvas, 0, 340, true, false);
  const sysTex = new THREE.CanvasTexture(sysCanvas);
  sysTex.colorSpace = THREE.SRGBColorSpace;
  const sysMat = new THREE.MeshBasicMaterial({ map: sysTex });

  const sysMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.13), sysMat);
  sysMesh.position.set(0.21, 0.11, -1.245);
  sysMesh.rotation.order = 'YXZ';
  sysMesh.rotation.y = -0.28;
  sysMesh.rotation.x = -0.32;
  interiorGroup.add(sysMesh);

  // 3D Translucent Collimated Glass HUD Combiner above center brow (stars stay crystal-clear!)
  const holoCanvas = document.createElement('canvas');
  holoCanvas.width = 256;
  holoCanvas.height = 192;
  renderHoloCombiner(holoCanvas, 0, 0, false);
  const holoTex = new THREE.CanvasTexture(holoCanvas);
  holoTex.colorSpace = THREE.SRGBColorSpace;
  const holoMat = new THREE.MeshBasicMaterial({
    map: holoTex,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const holoCombinerGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.13), holoMat);
  holoCombinerGlass.position.set(0, 0.26, -1.35);
  holoCombinerGlass.rotation.x = -0.26;
  interiorGroup.add(holoCombinerGlass);

  // Combiner Twin Titanium Stanchions
  [-0.08, 0.08].forEach((sx) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.075, 6), titaniumTrimMat);
    post.position.set(sx, 0.195, -1.355);
    interiorGroup.add(post);
  });

  // Glowing 3D Tactile Cockpit Switches along Side & Brow Panels (Clickable!)
  const switchSpecs = [
    { id: 'headlights', x: -0.30, y: 0.07, z: -1.16, color: '#fde047' },
    { id: 'sas', x: -0.30, y: 0.07, z: -1.10, color: '#10b981' },
    { id: 'scanner', x: 0.30, y: 0.07, z: -1.16, color: '#38bdf8' },
    { id: 'boost', x: 0.30, y: 0.07, z: -1.10, color: '#f43f5e' },
  ];
  switchSpecs.forEach((sw) => {
    const btnMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.013, 0.012, 8),
      new THREE.MeshBasicMaterial({ color: sw.color })
    );
    btnMesh.position.set(sw.x, sw.y, sw.z);
    btnMesh.userData = { kind: 'cockpit_button', action: sw.id };
    interiorGroup.add(btnMesh);
    clickableCockpitControls.push(btnMesh);
  });

  // Sculpted HOTAS S-Curved Flight Stick (positioned comfortably on right-center thigh)
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0.18, 0.02, -1.10);
  const stickBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.03, 12), bolsterLeatherMat);
  yokeGroup.add(stickBoot);

  const stickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.01, 0),
    new THREE.Vector3(0, 0.06, -0.01),
    new THREE.Vector3(0, 0.11, 0.012),
    new THREE.Vector3(0, 0.145, 0.004),
  ]);
  const gripShaft = new THREE.Mesh(new THREE.TubeGeometry(stickCurve, 14, 0.012, 10, false), titaniumTrimMat);
  yokeGroup.add(gripShaft);

  const gripHead = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.036, 10), gunmetalMat);
  gripHead.position.set(0, 0.148, 0.004);
  gripHead.rotation.x = 0.2;
  yokeGroup.add(gripHead);

  const fireTrigger = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ef4444' })
  );
  fireTrigger.position.set(0, 0.16, -0.008);
  fireTrigger.userData = { kind: 'cockpit_button', action: 'fire' };
  yokeGroup.add(fireTrigger);
  clickableCockpitControls.push(fireTrigger);
  interiorGroup.add(yokeGroup);

  // Sculpted Split HOTAS Throttle Quadrant on Left Side Console
  const throttleGroup = new THREE.Group();
  throttleGroup.position.set(-0.29, 0.065, -1.04);
  const tLeverCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.055, -0.01),
  ]);
  throttleGroup.add(new THREE.Mesh(new THREE.TubeGeometry(tLeverCurve, 8, 0.008, 8, false), titaniumTrimMat));
  const tGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.058, 12), gunmetalMat);
  tGrip.rotation.z = Math.PI / 2;
  tGrip.position.set(0.01, 0.06, -0.012);
  tGrip.userData = { kind: 'cockpit_button', action: 'throttle_step' };
  throttleGroup.add(tGrip);
  clickableCockpitControls.push(tGrip);
  interiorGroup.add(throttleGroup);

  // Ambient Cockpit Instrument Light
  const interiorLight = new THREE.PointLight('#7dd3fc', 0.9, 2.2, 1.5);
  interiorLight.position.set(0, 0.44, -1.05);
  interiorGroup.add(interiorLight);

  // Panoramic Pilot Eye Anchor (slightly elevated above sculpted cowl -> wide unobstructed forward view!)
  const cockpitSeatAnchor = new THREE.Object3D();
  cockpitSeatAnchor.position.set(0, 0.345, -0.96);
  rootGroup.add(cockpitSeatAnchor);

  // Cinematic 3rd-Person Chase Camera Anchor behind & slightly above SR-7
  const chaseCameraAnchor = new THREE.Object3D();
  chaseCameraAnchor.position.set(0, 1.28, 6.1);
  rootGroup.add(chaseCameraAnchor);

  // ============================================================================
  // 4. DORSAL SENSOR TURRET, PARABOLIC RADAR, COPPER CONDUITS & CANTED TAIL FINS
  // ============================================================================
  const sensorTurretGroup = new THREE.Group();
  sensorTurretGroup.position.set(0, 0.50, 0.14);
  sensorTurretGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.11, 18), armorDarkMat));
  const turretBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), titaniumTrimMat);
  turretBall.position.y = 0.095;
  sensorTurretGroup.add(turretBall);
  const sensorLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 14, 14),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  sensorLens.position.set(0, 0.095, -0.105);
  sensorTurretGroup.add(sensorLens);
  hullGroup.add(sensorTurretGroup);

  // Parabolic Deep-Space Comms Dish
  const radarDishGroup = new THREE.Group();
  radarDishGroup.position.set(-0.34, 0.43, 0.78);
  radarDishGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.14, 10), gunmetalMat));
  const dishBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    armorWhiteMat
  );
  dishBowl.position.y = 0.13;
  dishBowl.rotation.x = Math.PI * 0.72;
  radarDishGroup.add(dishBowl);
  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.11, 6), copperPipeMat);
  feedHorn.position.set(0, 0.17, -0.05);
  feedHorn.rotation.x = Math.PI * 0.22;
  radarDishGroup.add(feedHorn);
  hullGroup.add(radarDishGroup);

  // Curved Aero Whip Antennas + Dorsal Anti-Collision Strobe
  [-0.20, 0.20].forEach((ax) => {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.013, 0.52, 8), titaniumTrimMat);
    ant.position.set(ax, 0.62, -0.22);
    ant.rotation.x = 0.14;
    hullGroup.add(ant);
  });

  const strobeLightMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#f8fafc' })
  );
  strobeLightMesh.position.set(0, 0.48, 0.92);
  hullGroup.add(strobeLightMesh);

  // Sculpted Curved Copper/Cryo Conduits along Aft Flanks
  [-1, 1].forEach((side) => {
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.62, 0.22, 0.55),
      new THREE.Vector3(side * 0.74, 0.24, 0.98),
      new THREE.Vector3(side * 0.72, 0.18, 1.56),
    ]);
    hullGroup.add(new THREE.Mesh(new THREE.TubeGeometry(pipeCurve, 16, 0.038, 10, false), copperPipeMat));
  });

  // Swept Beveled Vertical Tail Stabilizers
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.88, 0);
  finShape.lineTo(1.16, 0.74);
  finShape.lineTo(0.82, 0.74);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSize: 0.016,
    bevelThickness: 0.016,
    bevelSegments: 3,
  });
  finGeo.rotateY(-Math.PI / 2);

  [-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(finGeo, armorWhiteMat);
    fin.position.set(side * 0.60, 0.28, 0.96);
    fin.rotation.z = side * -0.44;
    hullGroup.add(fin);

    const finTip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.18, 0.34),
      crimsonStripeMat
    );
    finTip.position.set(side * 0.87, 0.79, 1.78);
    finTip.rotation.z = side * -0.44;
    hullGroup.add(finTip);
  });

  // ============================================================================
  // 5. COMPOUND SWEPT DELTA WINGS, MOVING AILERONS & LATHE OUTRIGGER ION PODS
  // ============================================================================
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.92);
  wingShape.bezierCurveTo(0.45, -0.62, 1.05, -0.25, 1.58, -0.02);
  wingShape.lineTo(1.58, 0.66);
  wingShape.bezierCurveTo(1.02, 0.80, 0.45, 0.90, 0, 0.98);
  wingShape.closePath();

  const wingExtrudeGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.10,
    bevelEnabled: true,
    bevelSize: 0.032,
    bevelThickness: 0.028,
    bevelSegments: 3,
  });
  wingExtrudeGeo.rotateX(Math.PI / 2);

  // Lathe profile for cylindrical outrigger wingtip thruster/ion nacelles
  const podProfile = [
    new THREE.Vector2(0.001, -0.62),
    new THREE.Vector2(0.11, -0.52),
    new THREE.Vector2(0.165, -0.28),
    new THREE.Vector2(0.175, 0.42),
    new THREE.Vector2(0.145, 0.56),
    new THREE.Vector2(0.125, 0.58),
    new THREE.Vector2(0.08, 0.52),
    new THREE.Vector2(0.001, 0.52),
  ];
  const podLatheGeo = new THREE.LatheGeometry(podProfile, 20);
  podLatheGeo.rotateX(Math.PI / 2);

  let leftAileron!: THREE.Mesh;
  let rightAileron!: THREE.Mesh;

  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(wingExtrudeGeo, armorWhiteMat);
    wing.position.set(side * 0.84, 0.02, 0.42);
    if (side === -1) wing.scale.x = -1;
    wing.rotation.z = side * -0.045;
    hullGroup.add(wing);

    // Armored dark wing-root leading-edge strake
    const leadingArmorGeo = createLoftedGeometry([
      { z: -0.52, ring: [[side * 0.80, 0.04], [side * 0.96, 0.0], [side * 0.80, -0.06]] },
      { z: 0.36, ring: [[side * 2.24, -0.03], [side * 2.40, -0.05], [side * 2.24, -0.09]] },
    ], 1, 1, true);
    hullGroup.add(new THREE.Mesh(leadingArmorGeo, armorDarkMat));

    // Articulated Trailing Control Flaps (tilt subtly when rolling/pitching!)
    const aileron = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.038, 0.16),
      crimsonStripeMat
    );
    aileron.position.set(side * 1.56, -0.05, 1.18);
    aileron.rotation.y = side * 0.14;
    aileron.rotation.z = side * -0.045;
    hullGroup.add(aileron);
    if (side === -1) leftAileron = aileron;
    else rightAileron = aileron;

    // Outrigger Cylindrical Wingtip Ion Pod
    const podMesh = new THREE.Mesh(podLatheGeo, armorDarkMat);
    podMesh.position.set(side * 2.46, -0.07, 0.70);
    hullGroup.add(podMesh);

    const podBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.14, 20, 1, true),
      crimsonStripeMat
    );
    podBand.rotation.x = Math.PI / 2;
    podBand.position.set(side * 2.46, -0.07, 0.46);
    hullGroup.add(podBand);

    // Nav Strobe on Wingtip Pod (Red Port, Green Starboard)
    const navStrobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshBasicMaterial({ color: side === -1 ? '#ef4444' : '#22c55e' })
    );
    navStrobe.position.set(side * 2.63, -0.07, 0.72);
    hullGroup.add(navStrobe);
  });

  // Glowing Ion Exhaust Rings on Wingtip Pods
  const wingGlowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
  const leftWingTipGlow = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.024, 10, 20), wingGlowMat);
  leftWingTipGlow.position.set(-2.46, -0.07, 1.24);
  hullGroup.add(leftWingTipGlow);

  const rightWingTipGlow = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.024, 10, 20), wingGlowMat.clone());
  rightWingTipGlow.position.set(2.46, -0.07, 1.24);
  hullGroup.add(rightWingTipGlow);

  // ============================================================================
  // 6. VENTRAL DUAL-BARREL ROTARY TURRETS
  // ============================================================================
  const muzzleMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });

  const leftMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), muzzleMat);
  const rightMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), muzzleMat.clone());

  [-0.29, 0.29].forEach((tx, idx) => {
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.36, 10), gunmetalMat);
    mount.rotation.x = Math.PI / 2;
    mount.position.set(tx, -0.31, -1.52);
    hullGroup.add(mount);

    [-0.028, 0.028].forEach((bx) => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.62, 10), titaniumTrimMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(tx + bx, -0.32, -1.92);
      hullGroup.add(barrel);
    });

    const flash = idx === 0 ? leftMuzzleFlash : rightMuzzleFlash;
    flash.position.set(tx, -0.32, -2.26);
    hullGroup.add(flash);
  });

  // ============================================================================
  // 7. SCULPTED LATHE MAIN AFTERBURNER TURBINES + ARTICULATED IRIS PETALS + GLSL PLUMES
  // ============================================================================
  const turbineProfile = [
    new THREE.Vector2(0.32, -0.62),
    new THREE.Vector2(0.45, -0.45),
    new THREE.Vector2(0.46, 0.28),
    new THREE.Vector2(0.41, 0.56),
    new THREE.Vector2(0.34, 0.68),
    new THREE.Vector2(0.28, 0.65),
    new THREE.Vector2(0.26, 0.42),
  ];
  const nacelleLatheGeo = new THREE.LatheGeometry(turbineProfile, 26);
  nacelleLatheGeo.rotateX(Math.PI / 2);

  const plumeMatLeft = createPlasmaPlumeMaterial();
  const plumeMatRight = createPlasmaPlumeMaterial();
  const plumeGeo = new THREE.CylinderGeometry(0.25, 0.03, 2.35, 24, 1, true);
  plumeGeo.rotateX(Math.PI / 2);
  plumeGeo.translate(0, 0, 1.18);

  const leftPlumeMesh = new THREE.Mesh(plumeGeo, plumeMatLeft);
  const rightPlumeMesh = new THREE.Mesh(plumeGeo, plumeMatRight);
  const coreGlowMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
  const leftCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), coreGlowMat);
  const rightCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), coreGlowMat.clone());

  const petalGeo = new THREE.BoxGeometry(0.085, 0.022, 0.24);
  [-0.56, 0.56].forEach((ex, idx) => {
    const nacelle = new THREE.Mesh(nacelleLatheGeo, armorDarkMat);
    nacelle.position.set(ex, 0.02, 1.72);
    hullGroup.add(nacelle);

    // Accent heat-shield collar
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.032, 10, 26),
      titaniumTrimMat
    );
    collar.position.set(ex, 0.02, 2.15);
    hullGroup.add(collar);

    // 14 articulated titanium thrust-vector petals
    for (let p = 0; p < 14; p++) {
      const ang = (p / 14) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, gunmetalMat);
      petal.position.set(ex + Math.cos(ang) * 0.34, 0.02 + Math.sin(ang) * 0.34, 2.34);
      petal.rotation.z = ang + Math.PI / 2;
      petal.rotateX(-0.18);
      hullGroup.add(petal);
    }

    const core = idx === 0 ? leftCoreMesh : rightCoreMesh;
    core.position.set(ex, 0.02, 2.18);
    hullGroup.add(core);

    const plume = idx === 0 ? leftPlumeMesh : rightPlumeMesh;
    plume.position.set(ex, 0.02, 2.24);
    hullGroup.add(plume);
  });

  // ============================================================================
  // 8. SPOTLIGHTS, VOLUMETRIC BEAMS & 3D RADAR PULSE RING
  // ============================================================================
  const headlightLeftSpot = new THREE.SpotLight('#fef9c3', 0, 85, Math.PI * 0.16, 0.45, 1.0);
  headlightLeftSpot.position.set(-0.19, -0.06, -2.9);
  const leftTarget = new THREE.Object3D();
  leftTarget.position.set(-0.19, -0.08, -32);
  rootGroup.add(leftTarget);
  headlightLeftSpot.target = leftTarget;
  rootGroup.add(headlightLeftSpot);

  const headlightRightSpot = new THREE.SpotLight('#fef9c3', 0, 85, Math.PI * 0.16, 0.45, 1.0);
  headlightRightSpot.position.set(0.19, -0.06, -2.9);
  const rightTarget = new THREE.Object3D();
  rightTarget.position.set(0.19, -0.08, -32);
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
  [-0.19, 0.19].forEach((bx) => {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, -0.06, -2.9);
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
  }) => {
    // 1. HOTAS Flight Stick & Throttle Animation
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

    // Wing Control Ailerons Deflect with Roll/Pitch
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

    // 2. Mach-Diamond Volumetric GLSL Plumes
    const absT = Math.abs(throttle);
    const boostVal = boostActive ? 1.0 : 0.0;
    const plumeLenScale = boostActive
      ? 1.75 + Math.sin(clockTime * 34) * 0.12
      : 0.24 + absT * 0.92 + Math.sin(clockTime * 26) * 0.04;
    const plumeRadScale = boostActive ? 1.15 : 0.72 + absT * 0.35;
    leftPlumeMesh.scale.set(plumeRadScale, plumeRadScale, plumeLenScale);
    rightPlumeMesh.scale.set(plumeRadScale, plumeRadScale, plumeLenScale);

    [plumeMatLeft, plumeMatRight].forEach((m) => {
      m.uniforms.uTime.value = clockTime;
      m.uniforms.uThrottle.value = absT;
      m.uniforms.uBoost.value = boostVal;
    });

    const coreColor = boostActive ? '#e0f2fe' : '#fef08a';
    (leftCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (rightCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (leftWingTipGlow.material as THREE.MeshBasicMaterial).color.set(boostActive ? '#7dd3fc' : '#0284c7');
    (rightWingTipGlow.material as THREE.MeshBasicMaterial).color.set(boostActive ? '#7dd3fc' : '#0284c7');

    // Dorsal anti-collision beacon strobe (~1.1 Hz)
    const strobeOn = (clockTime % 1.1) < 0.09;
    strobeLightMesh.visible = strobeOn;

    // 3. Headlights & Cabin Interior Lights
    headlightBeamGroup.visible = headlightsOn;
    headlightLeftSpot.intensity = headlightsOn ? 6.5 : 0;
    headlightRightSpot.intensity = headlightsOn ? 6.5 : 0;
    interiorLight.intensity = interiorLightsOn ? 1.25 : 0.18;

    // 4. Radar Dish & Sensor Turret Micro-Motion
    radarDishGroup.rotation.y = Math.sin(clockTime * 0.65) * 0.55;
    sensorTurretGroup.rotation.y = THREE.MathUtils.lerp(
      sensorTurretGroup.rotation.y,
      yawInput * 0.35,
      Math.min(1, dt * 6)
    );

    // 5. Ventral Muzzle Flash
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
      renderPFDCanvas(pfdCanvas, throttle, boostActive, speedFormatted, pitchDeg, rollDeg, sasEnabled);
      pfdTex.needsUpdate = true;

      renderNavCanvas(navCanvas, nearestName, nearestDist, autopilotActive, clockTime);
      navTex.needsUpdate = true;

      renderSysCanvas(sysCanvas, throttle, reactorTempC, shieldsOn, boostActive);
      sysTex.needsUpdate = true;

      renderHoloCombiner(holoCanvas, pitchDeg, rollDeg, boostActive);
      holoTex.needsUpdate = true;
    }
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
    clickableCockpitControls,
    updateAnimations,
  };
}
