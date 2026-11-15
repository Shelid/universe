import * as THREE from 'three';

export type HangarCameraFocus = 'OVERVIEW' | 'SHIP' | 'CHARACTER';

export interface HangarBayRefs {
  rootGroup: THREE.Group;
  padTopY: number;
  shipAnchorPos: THREE.Vector3;
  astronautAnchorPos: THREE.Vector3;
  setAccentColor: (hex: string) => void;
  update: (clockTime: number) => void;
  dispose: () => void;
}

function createFloorTextures(
  width: number,
  depth: number,
  shipAnchorPos: THREE.Vector3,
  padRadius: number
): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 2048;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d')!;

  // Base industrial epoxy-concrete plates (5.5m x 5.5m slabs across 132m x 132m bay)
  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#a8a8a8';
  rCtx.fillRect(0, 0, size, size);

  const tiles = 24;
  const tilePx = size / tiles;
  for (let gx = 0; gx < tiles; gx++) {
    for (let gy = 0; gy < tiles; gy++) {
      const shade = 20 + ((gx * 7 + gy * 13) % 9);
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
      ctx.fillRect(gx * tilePx + 2, gy * tilePx + 2, tilePx - 4, tilePx - 4);

      const rough = 135 + ((gx * 11 + gy * 5) % 45);
      rCtx.fillStyle = `rgb(${rough}, ${rough}, ${rough})`;
      rCtx.fillRect(gx * tilePx + 2, gy * tilePx + 2, tilePx - 4, tilePx - 4);
    }
  }

  // Expansion joint dark grooves
  ctx.strokeStyle = '#090d14';
  ctx.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    const p = i * tilePx;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Painted yellow/amber bay boundary lane + caution stripes aligned with 1:1 ship landing pad
  const padX = size * (0.5 + shipAnchorPos.x / width);
  const padY = size * (0.5 + shipAnchorPos.z / depth);
  const ringR = size * (padRadius / width);

  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
  ctx.lineWidth = 10;
  ctx.setLineDash([36, 18]);
  ctx.beginPath();
  ctx.arc(padX, padY, ringR + 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Polished painted caution ring has lower roughness
  rCtx.save();
  rCtx.strokeStyle = '#555555';
  rCtx.lineWidth = 12;
  rCtx.beginPath();
  rCtx.arc(padX, padY, ringR + 24, 0, Math.PI * 2);
  rCtx.stroke();
  rCtx.restore();

  // Cyan docking alignment stripes
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(padX, padY - ringR - 72);
  ctx.lineTo(padX, padY + ringR + 72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(padX - ringR - 64, padY);
  ctx.lineTo(padX + ringR + 64, padY);
  ctx.stroke();
  ctx.restore();

  // Perimeter hangar walkway boundary lane
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
  ctx.restore();

  // Stencil hangar bay text
  ctx.save();
  ctx.fillStyle = 'rgba(226, 232, 240, 0.36)';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BAÍA 01 · HANGAR ORBITAL · ESCALA 1:1', padX, padY + ringR + 76);
  ctx.restore();

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.anisotropy = 8;

  return { map, roughnessMap };
}

function createWallRibTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#182130';
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 32) {
    ctx.fillStyle = x % 64 === 0 ? '#1d283a' : '#131b28';
    ctx.fillRect(x, 0, 24, 512);
    ctx.fillStyle = '#0c121c';
    ctx.fillRect(x + 24, 0, 8, 512);
  }

  // Horizontal panel seams & human-scale caution stripe near base (~1.1m height on 34m walls)
  ctx.fillStyle = '#0c121c';
  ctx.fillRect(0, 170, 512, 6);
  ctx.fillRect(0, 340, 512, 6);

  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 488, 512, 10);
  ctx.fillStyle = '#0f172a';
  for (let x = -40; x < 540; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 488);
    ctx.lineTo(x + 16, 488);
    ctx.lineTo(x + 6, 498);
    ctx.lineTo(x - 10, 498);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(16, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHangarSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#08101e';
  ctx.fillRect(0, 0, 1024, 192);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 1008, 176);

  ctx.fillStyle = '#e0f2fe';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HANGAR 01 · PRESSURIZADO', 512, 86);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('UNIVERSE EXPLORER · DOCA DE PREPARAÇÃO E DECOLAGEM', 512, 140);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDiagScreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#040b16';
  ctx.fillRect(0, 0, 512, 320);
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 300);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('DIAGNÓSTICO DO GALPÃO // PRONTO', 28, 48);

  const bars = [0.88, 0.94, 0.76, 0.98, 0.84, 0.91];
  bars.forEach((b, idx) => {
    const y = 84 + idx * 34;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(28, y, 280, 18);
    ctx.fillStyle = idx % 2 === 0 ? '#38bdf8' : '#10b981';
    ctx.fillRect(28, y, 280 * b, 18);
  });

  // Mini radar circle
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(410, 175, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(410, 175, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(426, 158, 6, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHangarBay3D(): HangarBayRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'hangar-bay-root';
  rootGroup.visible = false;

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTexs: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };

  // True 1:1 metric scale: 1 Three.js unit = 1 meter.
  // Accommodates native 53.08m x 43.19m x 17.32m starship alongside 1.90m astronaut.
  const width = 132;
  const depth = 132;
  const height = 36;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const padTopY = 0.14;
  const padRadius = 27.5;
  const shipAnchorPos = new THREE.Vector3(16.0, 0, -14.0);
  const astronautAnchorPos = new THREE.Vector3(-17.2, 0, 23.0);

  const isNodeEnv = typeof document === 'undefined';
  const floorTexs = !isNodeEnv ? createFloorTextures(width, depth, shipAnchorPos, padRadius) : null;
  const wallTex = !isNodeEnv ? createWallRibTexture() : null;
  const signTex = !isNodeEnv ? createHangarSignTexture() : null;
  const diagTex = !isNodeEnv ? createDiagScreenTexture() : null;
  if (floorTexs) disposableTexs.push(floorTexs.map, floorTexs.roughnessMap);
  if (wallTex) disposableTexs.push(wallTex);
  if (signTex) disposableTexs.push(signTex);
  if (diagTex) disposableTexs.push(diagTex);

  // 1. Industrial Hangar Deck Floor
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#cfd8e3',
      map: floorTexs?.map || null,
      roughnessMap: floorTexs?.roughnessMap || null,
      roughness: 0.72,
      metalness: 0.25,
    })
  );
  const floorMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(width, depth)), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  rootGroup.add(floorMesh);

  // 2. Enclosed Steel Bulkhead Walls + Ceiling (completely isolates Hangar from space world)
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#b8c4d4',
      map: wallTex || null,
      roughness: 0.58,
      metalness: 0.52,
      side: THREE.FrontSide,
    })
  );
  const ceilingMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0d131d',
      roughness: 0.75,
      metalness: 0.45,
    })
  );

  const addWall = (w: number, h: number, pos: [number, number, number], rotY: number) => {
    const m = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(w, h)), wallMat);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.y = rotY;
    rootGroup.add(m);
  };
  addWall(width, height, [0, height * 0.5, -halfD], 0);
  addWall(width, height, [0, height * 0.5, halfD], Math.PI);
  addWall(depth, height, [-halfW, height * 0.5, 0], Math.PI / 2);
  addWall(depth, height, [halfW, height * 0.5, 0], -Math.PI / 2);

  const ceilingMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(width, depth)), ceilingMat);
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.y = height;
  rootGroup.add(ceilingMesh);

  // 3. Heavy Structural Steel Columns, Wall Girders & Overhead Roof Trusses
  const steelDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.44,
      metalness: 0.72,
    })
  );
  const steelTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.36,
      metalness: 0.78,
    })
  );
  const cautionAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.45,
      metalness: 0.25,
    })
  );

  const pillarGeo = trackGeo(new THREE.BoxGeometry(1.6, height, 2.2));
  const beamGeo = trackGeo(new THREE.BoxGeometry(width - 2.0, 1.45, 1.15));
  const fixtureHousingGeo = trackGeo(new THREE.BoxGeometry(11.0, 0.45, 1.2));
  const fixtureLedGeo = trackGeo(new THREE.BoxGeometry(10.2, 0.22, 0.8));
  const ceilingLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: '#e0f2fe',
      emissiveIntensity: 1.55,
      roughness: 0.2,
    })
  );

  const zBays = [-52, -26, 0, 26, 52];
  zBays.forEach((zb) => {
    const leftCol = new THREE.Mesh(pillarGeo, steelDarkMat);
    leftCol.position.set(-halfW + 0.85, height * 0.5, zb);
    const rightCol = new THREE.Mesh(pillarGeo, steelDarkMat);
    rightCol.position.set(halfW - 0.85, height * 0.5, zb);
    rootGroup.add(leftCol, rightCol);

    const roofBeam = new THREE.Mesh(beamGeo, steelDarkMat);
    roofBeam.position.set(0, height - 1.0, zb);
    rootGroup.add(roofBeam);

    // High-Bay Ceiling LED Light Banks flanking center
    [-21, 21].forEach((lx) => {
      const housing = new THREE.Mesh(fixtureHousingGeo, steelTrimMat);
      housing.position.set(lx, height - 1.75, zb);
      const led = new THREE.Mesh(fixtureLedGeo, ceilingLedMat);
      led.position.set(lx, height - 1.98, zb);
      rootGroup.add(housing, led);
    });
  });

  // Side Mezzanine Catwalk Ledges (roughly cockpit bridge observation height ~14.5m)
  const catwalkGeo = trackGeo(new THREE.BoxGeometry(2.8, 0.48, depth - 3.2));
  [-halfW + 1.6, halfW - 1.6].forEach((cx) => {
    const ledge = new THREE.Mesh(catwalkGeo, steelTrimMat);
    ledge.position.set(cx, 14.5, 0);
    rootGroup.add(ledge);
  });

  // 4. Giant Armored Twin Blast Gate Doors on Rear Hangar Wall (z = -halfD, sized for 43.2m wingspan)
  const gateFrameGeo = trackGeo(new THREE.BoxGeometry(62.0, 24.5, 1.2));
  const gateFrame = new THREE.Mesh(gateFrameGeo, steelDarkMat);
  gateFrame.position.set(0, 12.25, -halfD + 0.65);
  rootGroup.add(gateFrame);

  const gateLeafGeo = trackGeo(new THREE.BoxGeometry(27.5, 22.0, 0.85));
  const leftGate = new THREE.Mesh(gateLeafGeo, steelTrimMat);
  leftGate.position.set(-13.95, 11.05, -halfD + 1.1);
  const rightGate = new THREE.Mesh(gateLeafGeo, steelTrimMat);
  rightGate.position.set(13.95, 11.05, -halfD + 1.1);
  rootGroup.add(leftGate, rightGate);

  // Horizontal blast door reinforcement ribs & amber caution pillars
  const doorRibGeo = trackGeo(new THREE.BoxGeometry(55.5, 0.6, 0.3));
  [4.0, 9.2, 14.4, 19.6].forEach((ry) => {
    const rib = new THREE.Mesh(doorRibGeo, steelDarkMat);
    rib.position.set(0, ry, -halfD + 1.65);
    rootGroup.add(rib);
  });
  const hazardColGeo = trackGeo(new THREE.BoxGeometry(1.1, 23.0, 1.2));
  [-28.4, 28.4].forEach((hx) => {
    const hCol = new THREE.Mesh(hazardColGeo, cautionAmberMat);
    hCol.position.set(hx, 11.5, -halfD + 1.15);
    rootGroup.add(hCol);
  });

  // Accent LED strips & Hangar Banner Sign above Blast Gate
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#38bdf8',
      emissiveIntensity: 1.5,
      roughness: 0.2,
    })
  );
  const centerSeamStrip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 21.6, 0.3)),
    accentMat
  );
  centerSeamStrip.position.set(0, 10.9, -halfD + 1.72);
  rootGroup.add(centerSeamStrip);

  const signMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: signTex || null,
      emissive: '#ffffff',
      emissiveMap: signTex || null,
      emissiveIntensity: 0.78,
      roughness: 0.35,
    })
  );
  const signBoard = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(28.0, 5.2)), signMat);
  signBoard.position.set(2.0, 26.2, -halfD + 1.85);
  rootGroup.add(signBoard);

  // 5. Raised Circular Landing Pad (27.5m radius for 53m starship; rests at y = padTopY)
  const padDeckGeo = trackGeo(new THREE.CylinderGeometry(padRadius, padRadius + 1.1, padTopY, 64));
  const padDeckMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#253142',
      roughness: 0.42,
      metalness: 0.68,
    })
  );
  const padDeck = new THREE.Mesh(padDeckGeo, padDeckMat);
  padDeck.position.set(shipAnchorPos.x, padTopY * 0.5, shipAnchorPos.z);
  rootGroup.add(padDeck);

  const padRingGeo = trackGeo(new THREE.TorusGeometry(padRadius + 0.3, 0.14, 10, 84));
  padRingGeo.rotateX(Math.PI / 2);
  const padRing = new THREE.Mesh(padRingGeo, accentMat);
  padRing.position.set(shipAnchorPos.x, padTopY + 0.04, shipAnchorPos.z);
  rootGroup.add(padRing);

  // 6. True 1:1 Human-Scale Ground Support Equipment beside Apron + Heavy Refueling Tanks by Wall
  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#3b4a5e',
      roughness: 0.55,
      metalness: 0.35,
    })
  );
  const tankMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.32,
      metalness: 0.65,
    })
  );
  const addCrate = (sx: number, sy: number, sz: number, px: number, pz: number, rotY = 0) => {
    const box = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(sx, sy, sz)), crateMat);
    box.position.set(px, sy * 0.5, pz);
    box.rotation.y = rotY;
    rootGroup.add(box);
  };
  addCrate(1.85, 1.12, 1.32, -23.0, 18.8, 0.16);
  addCrate(1.28, 0.92, 1.15, -24.8, 20.4, -0.25);
  const topCrate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.02, 0.78, 0.92)), cautionAmberMat);
  topCrate.position.set(-23.0, 1.51, 18.8);
  topCrate.rotation.y = 0.28;
  rootGroup.add(topCrate);

  // Industrial Cryo Propellant Tank Bank along rear-right wall (true heavy drydock scale)
  const tankGeo = trackGeo(new THREE.CylinderGeometry(1.35, 1.35, 8.6, 20));
  [46.0, 49.8, 53.6].forEach((tx) => {
    const t = new THREE.Mesh(tankGeo, tankMat);
    t.position.set(tx, 4.3, -53.0);
    rootGroup.add(t);
  });

  // 1:1 Human-Scale Diagnostic Workstation Kiosk beside Astronaut (-17.2, 0, 23.0)
  const kioskStand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.35, 1.12, 0.62)), steelDarkMat);
  kioskStand.position.set(-19.5, 0.56, 21.0);
  kioskStand.rotation.y = 0.56;
  rootGroup.add(kioskStand);

  const diagMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: diagTex || null,
      emissive: '#ffffff',
      emissiveMap: diagTex || null,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    })
  );
  const kioskScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.22, 0.76)), diagMat);
  kioskScreen.position.set(-19.4, 1.48, 21.08);
  kioskScreen.rotation.y = 0.56;
  rootGroup.add(kioskScreen);

  // Subtle Perimeter Amber Hazard Beacons atop Blast Door Columns
  const beaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 1.4,
      roughness: 0.25,
    })
  );
  const beaconGeo = trackGeo(new THREE.SphereGeometry(0.42, 12, 12));
  [-28.4, 28.4].forEach((bx) => {
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(bx, 23.25, -halfD + 1.15);
    rootGroup.add(beacon);
  });

  // 7. Tailored Studio Hangar Lighting (zero universe leak, full 120m x 120m x 34m coverage)
  const hangarHemi = new THREE.HemisphereLight('#cfe2fa', '#1b2434', 1.05);
  rootGroup.add(hangarHemi);

  const keyLight = new THREE.DirectionalLight('#f8fafc', 1.55);
  keyLight.position.set(22.0, 31.0, 32.0);
  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(6.0, 4.0, -8.0);
  rootGroup.add(keyLight, keyTarget);
  keyLight.target = keyTarget;

  const rimCoolLight = new THREE.DirectionalLight('#7dd3fc', 0.95);
  rimCoolLight.position.set(-28.0, 24.0, -36.0);
  rimCoolLight.target = keyTarget;
  rootGroup.add(rimCoolLight);

  const padOverheadFill = new THREE.PointLight('#e0f2fe', 0.85, 115, 0);
  padOverheadFill.position.set(14.0, 29.0, -8.0);
  rootGroup.add(padOverheadFill);

  const workWarmFill = new THREE.PointLight('#fdba74', 0.55, 65, 0);
  workWarmFill.position.set(-20.0, 9.5, 22.0);
  rootGroup.add(workWarmFill);

  const setAccentColor = (hex: string) => {
    accentMat.color.set(hex);
    accentMat.emissive.set(hex);
    rimCoolLight.color.set(hex);
  };

  const update = (clockTime: number) => {
    beaconMat.emissiveIntensity = 0.85 + Math.sin(clockTime * 3.8) * 0.55;
    accentMat.emissiveIntensity = 1.15 + Math.sin(clockTime * 2.1) * 0.25;
  };

  const dispose = () => {
    disposableGeos.forEach((g) => g.dispose());
    disposableMats.forEach((m) => m.dispose());
    disposableTexs.forEach((t) => t.dispose());
  };

  return {
    rootGroup,
    padTopY,
    shipAnchorPos,
    astronautAnchorPos,
    setAccentColor,
    update,
    dispose,
  };
}
