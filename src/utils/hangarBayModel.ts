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

function createFloorTextures(): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d')!;

  // Base industrial epoxy-concrete plates
  ctx.fillStyle = '#141a24';
  ctx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#a8a8a8';
  rCtx.fillRect(0, 0, size, size);

  const tiles = 8;
  const tilePx = size / tiles;
  for (let gx = 0; gx < tiles; gx++) {
    for (let gy = 0; gy < tiles; gy++) {
      const shade = 20 + ((gx * 7 + gy * 13) % 9);
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
      ctx.fillRect(gx * tilePx + 3, gy * tilePx + 3, tilePx - 6, tilePx - 6);

      const rough = 135 + ((gx * 11 + gy * 5) % 45);
      rCtx.fillStyle = `rgb(${rough}, ${rough}, ${rough})`;
      rCtx.fillRect(gx * tilePx + 3, gy * tilePx + 3, tilePx - 6, tilePx - 6);
    }
  }

  // Expansion joint dark grooves + subtle steel bolt dots
  ctx.strokeStyle = '#090d14';
  ctx.lineWidth = 4;
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

  // Painted yellow/amber bay boundary lane + caution stripes aligned with ship landing pad (3.15, -2.15)
  const padX = size * 0.605;
  const padY = size * 0.44;
  const ringR = size * 0.22;

  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.72)';
  ctx.lineWidth = 10;
  ctx.setLineDash([28, 14]);
  ctx.beginPath();
  ctx.arc(padX, padY, ringR + 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Polished painted caution ring has lower roughness
  rCtx.save();
  rCtx.strokeStyle = '#555555';
  rCtx.lineWidth = 12;
  rCtx.beginPath();
  rCtx.arc(padX, padY, ringR + 28, 0, Math.PI * 2);
  rCtx.stroke();
  rCtx.restore();

  // Cyan docking alignment stripes
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(padX, padY - ringR - 80);
  ctx.lineTo(padX, padY + ringR + 80);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(padX - ringR - 70, padY);
  ctx.lineTo(padX + ringR + 70, padY);
  ctx.stroke();
  ctx.restore();

  // Walkway lane leading to astronaut staging spot
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(size * 0.14, size * 0.12, size * 0.72, size * 0.76);
  ctx.restore();

  // Stencil hangar bay text
  ctx.save();
  ctx.fillStyle = 'rgba(226, 232, 240, 0.32)';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BAÍA 01 · HANGAR ORBITAL', padX, padY + ringR + 74);
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

  // Horizontal panel seams & subtle caution stripe near base
  ctx.fillStyle = '#0c121c';
  ctx.fillRect(0, 170, 512, 6);
  ctx.fillRect(0, 340, 512, 6);

  ctx.fillStyle = '#b45309';
  ctx.fillRect(0, 456, 512, 16);
  ctx.fillStyle = '#0f172a';
  for (let x = -40; x < 540; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 456);
    ctx.lineTo(x + 20, 456);
    ctx.lineTo(x + 8, 472);
    ctx.lineTo(x - 12, 472);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(6, 1);
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

  const width = 30;
  const depth = 36;
  const height = 10.6;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const padTopY = 0.045;
  const shipAnchorPos = new THREE.Vector3(3.15, 0, -2.15);
  const astronautAnchorPos = new THREE.Vector3(-0.75, 0, 2.95);

  const isNodeEnv = typeof document === 'undefined';
  const floorTexs = !isNodeEnv ? createFloorTextures() : null;
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

  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.65, height, 0.95));
  const beamGeo = trackGeo(new THREE.BoxGeometry(width - 0.8, 0.55, 0.48));
  const fixtureHousingGeo = trackGeo(new THREE.BoxGeometry(3.4, 0.16, 0.42));
  const fixtureLedGeo = trackGeo(new THREE.BoxGeometry(3.15, 0.08, 0.28));
  const ceilingLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      emissive: '#e0f2fe',
      emissiveIntensity: 1.55,
      roughness: 0.2,
    })
  );

  const zBays = [-13.5, -7.0, 0, 7.0, 13.5];
  zBays.forEach((zb) => {
    const leftCol = new THREE.Mesh(pillarGeo, steelDarkMat);
    leftCol.position.set(-halfW + 0.35, height * 0.5, zb);
    const rightCol = new THREE.Mesh(pillarGeo, steelDarkMat);
    rightCol.position.set(halfW - 0.35, height * 0.5, zb);
    rootGroup.add(leftCol, rightCol);

    const roofBeam = new THREE.Mesh(beamGeo, steelDarkMat);
    roofBeam.position.set(0, height - 0.48, zb);
    rootGroup.add(roofBeam);

    // High-Bay Ceiling LED Light Banks flanking center
    [-4.8, 4.8].forEach((lx) => {
      const housing = new THREE.Mesh(fixtureHousingGeo, steelTrimMat);
      housing.position.set(lx, height - 0.82, zb);
      const led = new THREE.Mesh(fixtureLedGeo, ceilingLedMat);
      led.position.set(lx, height - 0.90, zb);
      rootGroup.add(housing, led);
    });
  });

  // Side Mezzanine Catwalk Ledges
  const catwalkGeo = trackGeo(new THREE.BoxGeometry(1.4, 0.22, depth - 1.2));
  [-halfW + 0.8, halfW - 0.8].forEach((cx) => {
    const ledge = new THREE.Mesh(catwalkGeo, steelTrimMat);
    ledge.position.set(cx, 5.2, 0);
    rootGroup.add(ledge);
  });

  // 4. Giant Armored Twin Blast Gate Doors on Rear Hangar Wall (z = -halfD)
  const gateFrameGeo = trackGeo(new THREE.BoxGeometry(15.6, 7.8, 0.55));
  const gateFrame = new THREE.Mesh(gateFrameGeo, steelDarkMat);
  gateFrame.position.set(0, 3.9, -halfD + 0.32);
  rootGroup.add(gateFrame);

  const gateLeafGeo = trackGeo(new THREE.BoxGeometry(6.8, 7.0, 0.38));
  const leftGate = new THREE.Mesh(gateLeafGeo, steelTrimMat);
  leftGate.position.set(-3.46, 3.52, -halfD + 0.55);
  const rightGate = new THREE.Mesh(gateLeafGeo, steelTrimMat);
  rightGate.position.set(3.46, 3.52, -halfD + 0.55);
  rootGroup.add(leftGate, rightGate);

  // Horizontal blast door reinforcement ribs & amber caution pillars
  const doorRibGeo = trackGeo(new THREE.BoxGeometry(13.8, 0.24, 0.14));
  [1.4, 3.1, 4.8, 6.3].forEach((ry) => {
    const rib = new THREE.Mesh(doorRibGeo, steelDarkMat);
    rib.position.set(0, ry, -halfD + 0.78);
    rootGroup.add(rib);
  });
  const hazardColGeo = trackGeo(new THREE.BoxGeometry(0.42, 7.4, 0.55));
  [-7.2, 7.2].forEach((hx) => {
    const hCol = new THREE.Mesh(hazardColGeo, cautionAmberMat);
    hCol.position.set(hx, 3.7, -halfD + 0.52);
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
    trackGeo(new THREE.BoxGeometry(0.12, 6.8, 0.12)),
    accentMat
  );
  centerSeamStrip.position.set(0, 3.45, -halfD + 0.80);
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
  const signBoard = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(8.6, 1.55)), signMat);
  signBoard.position.set(1.2, 6.95, -halfD + 0.94);
  rootGroup.add(signBoard);

  // 5. Raised Circular Landing Pad (ships rest at y = padTopY without any z-fighting)
  const padDeckGeo = trackGeo(new THREE.CylinderGeometry(4.45, 4.75, padTopY, 32));
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

  const padRingGeo = trackGeo(new THREE.TorusGeometry(4.56, 0.04, 8, 48));
  padRingGeo.rotateX(Math.PI / 2);
  const padRing = new THREE.Mesh(padRingGeo, accentMat);
  padRing.position.set(shipAnchorPos.x, padTopY + 0.01, shipAnchorPos.z);
  rootGroup.add(padRing);

  // 6. Ground Support Props Around Perimeter (keeps camera sweep crystal clear)
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
  addCrate(1.9, 1.15, 1.35, -8.8, -8.5, 0.14);
  addCrate(1.3, 0.95, 1.2, -10.5, -7.2, -0.25);
  addCrate(1.1, 0.85, 1.1, -8.7, -8.5, 0.35); // stacked feel via offset height:
  const topCrate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.05, 0.8, 0.95)), cautionAmberMat);
  topCrate.position.set(-8.8, 1.55, -8.5);
  topCrate.rotation.y = 0.24;
  rootGroup.add(topCrate);

  // Cryo propellant tanks on back-right bay
  const tankGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.45, 2.4, 16));
  [7.8, 8.95].forEach((tx) => {
    const t = new THREE.Mesh(tankGeo, tankMat);
    t.position.set(tx, 1.2, -9.8);
    rootGroup.add(t);
  });

  // Diagnostic Workstation Kiosk (back-left near astronaut)
  const kioskStand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 1.15, 0.65)), steelDarkMat);
  kioskStand.position.set(-5.8, 0.575, -1.8);
  kioskStand.rotation.y = 0.55;
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
  const kioskScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.26, 0.78)), diagMat);
  kioskScreen.position.set(-5.7, 1.52, -1.72);
  kioskScreen.rotation.y = 0.55;
  rootGroup.add(kioskScreen);

  // Subtle Perimeter Amber Hazard Beacons
  const beaconMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 1.4,
      roughness: 0.25,
    })
  );
  const beaconGeo = trackGeo(new THREE.SphereGeometry(0.14, 12, 12));
  [-7.2, 7.2].forEach((bx) => {
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(bx, 7.45, -halfD + 0.52);
    rootGroup.add(beacon);
  });

  // 7. Tailored Studio Hangar Lighting (zero universe leak, invariant intensity)
  const hangarHemi = new THREE.HemisphereLight('#c7dcf5', '#1b2434', 0.95);
  rootGroup.add(hangarHemi);

  const keyLight = new THREE.DirectionalLight('#f8fafc', 1.45);
  keyLight.position.set(5.5, 9.6, 7.5);
  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(0, 1.2, 0);
  rootGroup.add(keyLight, keyTarget);
  keyLight.target = keyTarget;

  const rimCoolLight = new THREE.DirectionalLight('#7dd3fc', 0.88);
  rimCoolLight.position.set(-6.5, 7.2, -9.5);
  rimCoolLight.target = keyTarget;
  rootGroup.add(rimCoolLight);

  const padOverheadFill = new THREE.PointLight('#e0f2fe', 0.72, 26, 0);
  padOverheadFill.position.set(1.2, 7.8, 0.4);
  rootGroup.add(padOverheadFill);

  const workWarmFill = new THREE.PointLight('#fdba74', 0.45, 24, 0);
  workWarmFill.position.set(-7.5, 4.8, -6.5);
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
