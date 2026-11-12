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
  headlightLeftSpot: THREE.SpotLight;
  headlightRightSpot: THREE.SpotLight;
  headlightBeamGroup: THREE.Group;
  radarDishGroup: THREE.Group;
  sensorTurretGroup: THREE.Group;
  radarPulseRing: THREE.Mesh;
  mfdScreenMat: THREE.MeshBasicMaterial;
  mfdCanvas: HTMLCanvasElement;
  interiorLight: THREE.PointLight;
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
    pitchInput: number;
    rollInput: number;
    yawInput: number;
    radarPulseAgeSec: number;
    muzzleFlashAlpha: number;
    speedFormatted: string;
    nearestName: string;
    nearestDist: string;
    sasEnabled: boolean;
    autopilotActive: boolean;
  }) => void;
}

/**
 * Generates a high-detail procedural weathered ceramic/titanium armor texture with panel lines,
 * rivets, grime, crimson tactical stripes, and the "SR-7" hull stencil.
 */
function createSR7HullTexture(withDecal = false): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base weathered ceramic off-white/slate hull paint
  ctx.fillStyle = '#cfccc4';
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle metallic wear noise
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * 5;
    const h = 1 + Math.random() * 2;
    const dark = Math.random() < 0.6;
    ctx.fillStyle = dark ? 'rgba(38, 42, 48, 0.09)' : 'rgba(255, 252, 245, 0.08)';
    ctx.fillRect(x, y, w, h);
  }

  // Armor panel rectangles & tonal variation
  const panels = [
    [0, 0, 170, 128],
    [170, 0, 170, 128],
    [340, 0, 172, 128],
    [0, 128, 128, 140],
    [128, 128, 256, 140],
    [384, 128, 128, 140],
    [0, 268, 220, 120],
    [220, 268, 160, 120],
    [380, 268, 132, 120],
    [0, 388, 256, 124],
    [256, 388, 256, 124],
  ];

  panels.forEach(([x, y, w, h], idx) => {
    const shade = idx % 3 === 0 ? 'rgba(180,175,165,0.22)' : idx % 2 === 0 ? 'rgba(85,90,98,0.12)' : 'rgba(235,232,225,0.16)';
    ctx.fillStyle = shade;
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

    // Panel seam
    ctx.strokeStyle = 'rgba(28, 32, 38, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    bCtx.strokeStyle = '#303030';
    bCtx.lineWidth = 3;
    bCtx.strokeRect(x, y, w, h);

    // Rivets along seams
    ctx.fillStyle = 'rgba(45, 48, 52, 0.45)';
    bCtx.fillStyle = '#c8c8c8';
    for (let rx = x + 10; rx < x + w - 8; rx += 22) {
      ctx.fillRect(rx, y + 5, 2, 2);
      ctx.fillRect(rx, y + h - 7, 2, 2);
      bCtx.fillRect(rx, y + 5, 2, 2);
      bCtx.fillRect(rx, y + h - 7, 2, 2);
    }
  });

  // Weathering streaks (re-entry / micrometeorite patina)
  for (let s = 0; s < 55; s++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const len = 20 + Math.random() * 65;
    const grad = ctx.createLinearGradient(sx, sy, sx + len, sy);
    grad.addColorStop(0, 'rgba(30, 28, 26, 0.20)');
    grad.addColorStop(1, 'rgba(30, 28, 26, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, len, 1.5 + Math.random() * 2.5);
  }

  if (withDecal) {
    // Crimson vertical tactical stripe + SR-7 military stencil
    ctx.fillStyle = 'rgba(155, 28, 28, 0.88)';
    ctx.fillRect(size * 0.64, 0, 44, size);

    ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
    ctx.font = 'bold 54px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SR-7', size * 0.36, size * 0.52);
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

  return { map, bumpMap };
}

/**
 * Renders live telemetry onto the 3D Cockpit MFD Screen Canvas.
 */
function renderCockpitMFD(
  canvas: HTMLCanvasElement,
  throttle: number,
  boostActive: boolean,
  speedFormatted: string,
  nearestName: string,
  nearestDist: string,
  sasEnabled: boolean,
  autopilotActive: boolean,
  clockTime: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#030b17';
  ctx.fillRect(0, 0, w, h);

  // Subtle scanlines & border
  ctx.strokeStyle = boostActive ? '#38bdf8' : '#0ea5e9';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  // Left section: Artificial Horizon / Nav Radar
  const cx = 92;
  const cy = h * 0.54;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 1.5;
  [24, 48, 68].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Sweeping radar beam
  const sweep = (clockTime * 2.2) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweep) * 68, cy + Math.sin(sweep) * 68);
  ctx.stroke();

  // Center ship chevron
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx + 5, cy + 5);
  ctx.lineTo(cx - 5, cy + 5);
  ctx.closePath();
  ctx.fill();

  // Right section: Telemetry Readout
  ctx.fillStyle = '#7dd3fc';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('SR-7 EXPLORER // TELEMETRIA', 180, 32);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`VEL: ${speedFormatted}`, 180, 68);

  ctx.fillStyle = boostActive ? '#38bdf8' : '#fbbf24';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(
    `PROP: ${Math.round(throttle * 100)}% ${boostActive ? '[DOBRA ATIVA]' : ''}`,
    180,
    98
  );

  // Thrust Bar
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(180, 110, 290, 14);
  ctx.fillStyle = boostActive ? '#38bdf8' : throttle >= 0 ? '#f59e0b' : '#ef4444';
  ctx.fillRect(180, 110, Math.min(290, Math.abs(throttle) * 290), 14);

  // Nearest Target
  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px monospace';
  ctx.fillText(`PRÓXIMO: ${nearestName.toUpperCase()} (${nearestDist})`, 180, 152);

  // Status Pills
  ctx.fillStyle = sasEnabled ? '#10b981' : '#64748b';
  ctx.fillRect(180, 174, 110, 26);
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(sasEnabled ? 'SAS: ON' : 'SAS: OFF', 194, 192);

  ctx.fillStyle = autopilotActive ? '#38bdf8' : '#334155';
  ctx.fillRect(305, 174, 165, 26);
  ctx.fillStyle = autopilotActive ? '#020617' : '#cbd5e1';
  ctx.fillText(autopilotActive ? 'AUTO-PILOT: ON' : 'MANUAL FLIGHT', 316, 192);
}

/**
 * Builds the 3D SR-7 Tactical Explorer Spacecraft & Interactive Interior Cockpit
 * faithfully modeled after the user's reference concept art.
 * Local orientation: Nose = -Z, Tail/Thrusters = +Z, Up = +Y, Right = +X.
 */
export function createSR7Spacecraft3DGroup(): SR7SpacecraftRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'sr7-spacecraft-root';

  const hullGroup = new THREE.Group();
  rootGroup.add(hullGroup);

  const { map: hullTex, bumpMap: hullBump } = createSR7HullTexture(false);
  const { map: decalTex } = createSR7HullTexture(true);

  const armorWhiteMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    bumpMap: hullBump,
    bumpScale: 0.012,
    color: '#e5e2da',
    roughness: 0.56,
    metalness: 0.35,
  });

  const armorDarkMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    bumpMap: hullBump,
    bumpScale: 0.015,
    color: '#343a42',
    roughness: 0.48,
    metalness: 0.65,
  });

  const gunmetalMat = new THREE.MeshStandardMaterial({
    color: '#1e232a',
    roughness: 0.36,
    metalness: 0.84,
  });

  const crimsonStripeMat = new THREE.MeshStandardMaterial({
    map: hullTex,
    color: '#9e2323',
    roughness: 0.52,
    metalness: 0.28,
  });

  const copperPipeMat = new THREE.MeshStandardMaterial({
    color: '#b47442',
    roughness: 0.32,
    metalness: 0.82,
  });

  const decalPanelMat = new THREE.MeshStandardMaterial({
    map: decalTex,
    bumpMap: hullBump,
    bumpScale: 0.01,
    roughness: 0.52,
    metalness: 0.35,
  });

  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: '#9ad8ff',
    transparent: true,
    opacity: 0.2,
    roughness: 0.08,
    metalness: 0.15,
    reflectivity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const clickableCockpitControls: THREE.Object3D[] = [];

  // ============================================================================
  // 1. FORWARD NOSE & FUSELAGE CORE (Tapered Wedge Nose at -Z)
  // ============================================================================
  // Lower Chin Chassis
  const lowerHullGeo = new THREE.BoxGeometry(1.18, 0.36, 3.6);
  const lowerHull = new THREE.Mesh(lowerHullGeo, armorDarkMat);
  lowerHull.position.set(0, -0.14, 0.18);
  hullGroup.add(lowerHull);

  // Tapered Nose Cone Floor
  const noseWedgeGeo = new THREE.CylinderGeometry(0.42, 0.68, 1.35, 6);
  noseWedgeGeo.rotateX(Math.PI / 2);
  noseWedgeGeo.scale(1.25, 0.48, 1.0);
  const noseWedge = new THREE.Mesh(noseWedgeGeo, armorWhiteMat);
  noseWedge.position.set(0, -0.06, -1.92);
  hullGroup.add(noseWedge);

  // Front Chin Lip & Headlight Bezel
  const noseFrontBezel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.17, 0.24), gunmetalMat);
  noseFrontBezel.position.set(0, -0.08, -2.56);
  hullGroup.add(noseFrontBezel);

  // Twin Glowing Nose Headlights
  const headlightMat = new THREE.MeshBasicMaterial({ color: '#fef9c3' });
  [-0.26, 0.26].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.075, 0.06), headlightMat);
    hl.position.set(hx, -0.08, -2.67);
    hullGroup.add(hl);
  });

  // Side Cheek Glow Strips (as seen on both reference photos)
  [-1, 1].forEach((side) => {
    const cheekLight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.24), headlightMat);
    cheekLight.position.set(side * 0.56, -0.09, -1.88);
    hullGroup.add(cheekLight);
  });

  // Chined Side Cheek Armor Plates + SR-7 Tactical Markings
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 2.2), decalPanelMat);
    cheek.position.set(side * 0.62, -0.02, -0.58);
    cheek.rotation.z = side * -0.22;
    cheek.rotation.y = side * 0.09;
    hullGroup.add(cheek);

    // Mid-fuselage air intake louver box (behind cockpit)
    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.46, 0.95), armorDarkMat);
    intake.position.set(side * 0.82, 0.02, 0.48);
    hullGroup.add(intake);

    // Radiator vent grille slats
    for (let v = 0; v < 4; v++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), gunmetalMat);
      slat.position.set(side * 0.84, -0.1 + v * 0.08, -0.01);
      hullGroup.add(slat);
    }

    // Crimson tactical fuselage stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.28), crimsonStripeMat);
    stripe.position.set(side * 0.78, 0.02, -0.25);
    hullGroup.add(stripe);
  });

  // ============================================================================
  // 2. ARMORED MULTI-STRUT COCKPIT CANOPY (Open Inside for 1st-Person Flight!)
  // ============================================================================
  // Side cockpit lower sills (below eye line)
  [-1, 1].forEach((side) => {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.45), armorDarkMat);
    sill.position.set(side * 0.52, 0.09, -1.12);
    hullGroup.add(sill);

    // Angled side canopy pillars (front & rear)
    const frontPillar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.92), gunmetalMat);
    frontPillar.position.set(side * 0.39, 0.28, -1.52);
    frontPillar.rotation.x = 0.48;
    frontPillar.rotation.y = side * -0.22;
    hullGroup.add(frontPillar);

    const midPillar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.56), gunmetalMat);
    midPillar.position.set(side * 0.45, 0.29, -1.04);
    midPillar.rotation.x = 0.2;
    midPillar.rotation.z = side * 0.35;
    hullGroup.add(midPillar);

    const rearPillar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.62), gunmetalMat);
    rearPillar.position.set(side * 0.48, 0.3, -0.62);
    rearPillar.rotation.z = side * 0.3;
    hullGroup.add(rearPillar);

    // Side canopy glass panes
    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.32), canopyGlassMat);
    sideGlass.position.set(side * 0.44, 0.25, -1.1);
    sideGlass.rotation.y = side * (Math.PI / 2 - 0.16);
    sideGlass.rotation.order = 'YXZ';
    sideGlass.rotation.x = 0.25;
    hullGroup.add(sideGlass);
  });

  // Canopy Roof Halo Frame & Overhead Struts
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.72), armorWhiteMat);
  canopyRoof.position.set(0, 0.49, -0.78);
  hullGroup.add(canopyRoof);

  const canopyTopFrontBar = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.045, 0.06), gunmetalMat);
  canopyTopFrontBar.position.set(0, 0.45, -1.14);
  hullGroup.add(canopyTopFrontBar);

  // Center Windscreen Mullion Strut (subtle off-center or thin center rib so view is crisp)
  const centerStrut = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.94), gunmetalMat);
  centerStrut.position.set(0, 0.29, -1.52);
  centerStrut.rotation.x = 0.46;
  hullGroup.add(centerStrut);

  // Angled Front Windscreen Glass
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.92), canopyGlassMat);
  frontGlass.position.set(0, 0.28, -1.52);
  frontGlass.rotation.x = -Math.PI / 2 + 0.46;
  hullGroup.add(frontGlass);

  // ============================================================================
  // 3. DETAILED INTERACTIVE COCKPIT INTERIOR (Seats, Console, MFD, Yoke, Throttle)
  // ============================================================================
  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'sr7-cockpit-interior';
  rootGroup.add(interiorGroup);

  // Cockpit Floor & Back Bulkhead
  const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 1.45), gunmetalMat);
  cabinFloor.position.set(0, -0.02, -1.15);
  interiorGroup.add(cabinFloor);

  const cabinBulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.56, 0.08), armorDarkMat);
  cabinBulkhead.position.set(0, 0.22, -0.46);
  interiorGroup.add(cabinBulkhead);

  // Pilot Seat (centered at x=0 for symmetrical 1st-person canopy alignment) & Side Jump Console
  const pilotSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.07), armorDarkMat);
  pilotSeatBack.position.set(0, 0.16, -0.78);
  pilotSeatBack.rotation.x = -0.15;
  interiorGroup.add(pilotSeatBack);

  const pilotSeatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.28), gunmetalMat);
  pilotSeatCushion.position.set(0, 0.03, -0.92);
  interiorGroup.add(pilotSeatCushion);

  // Curved Dashboard Console in front of pilot (z = -1.42)
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.34), gunmetalMat);
  dashBase.position.set(0, 0.115, -1.44);
  dashBase.rotation.x = 0.22;
  interiorGroup.add(dashBase);

  // Live Canvas MFD Telemetry Screen centered on dashboard
  const mfdCanvas = document.createElement('canvas');
  mfdCanvas.width = 512;
  mfdCanvas.height = 224;
  renderCockpitMFD(mfdCanvas, 0, false, '0 km/s', 'Terra', '0 km', true, false, 0);

  const mfdTex = new THREE.CanvasTexture(mfdCanvas);
  mfdTex.colorSpace = THREE.SRGBColorSpace;
  const mfdScreenMat = new THREE.MeshBasicMaterial({ map: mfdTex });
  const mfdScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.16), mfdScreenMat);
  mfdScreenMesh.position.set(0, 0.185, -1.29);
  mfdScreenMesh.rotation.x = -0.45;
  interiorGroup.add(mfdScreenMesh);

  // Glowing 3D Tactile Cockpit Switches along Dashboard Wings (Clickable in 3D!)
  const switchSpecs = [
    { id: 'headlights', x: -0.32, z: -1.30, color: '#fde047' },
    { id: 'sas', x: -0.26, z: -1.30, color: '#10b981' },
    { id: 'scanner', x: 0.26, z: -1.30, color: '#38bdf8' },
    { id: 'boost', x: 0.32, z: -1.30, color: '#f43f5e' },
  ];
  switchSpecs.forEach((sw) => {
    const btnMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.022, 0.032),
      new THREE.MeshBasicMaterial({ color: sw.color })
    );
    btnMesh.position.set(sw.x, 0.175, sw.z);
    btnMesh.rotation.x = -0.42;
    btnMesh.userData = { kind: 'cockpit_button', action: sw.id };
    interiorGroup.add(btnMesh);
    clickableCockpitControls.push(btnMesh);
  });

  // Animated 3D Flight Yoke / Joystick directly in front of pilot
  const yokeGroup = new THREE.Group();
  yokeGroup.position.set(0, 0.095, -1.16);
  const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.16, 10), gunmetalMat);
  stickShaft.position.y = 0.07;
  yokeGroup.add(stickShaft);
  const yokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.03), gunmetalMat);
  yokeBar.position.y = 0.14;
  yokeGroup.add(yokeBar);
  [-0.075, 0.075].forEach((gx) => {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.075, 0.028), armorDarkMat);
    grip.position.set(gx, 0.155, 0);
    yokeGroup.add(grip);
  });
  const fireTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ef4444' })
  );
  fireTip.position.set(0, 0.162, -0.01);
  fireTip.userData = { kind: 'cockpit_button', action: 'fire' };
  yokeGroup.add(fireTip);
  clickableCockpitControls.push(fireTip);
  interiorGroup.add(yokeGroup);

  // Animated 3D Throttle Lever on Left Armrest
  const throttleBase = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.24), armorDarkMat);
  throttleBase.position.set(-0.28, 0.06, -1.04);
  interiorGroup.add(throttleBase);

  const throttleGroup = new THREE.Group();
  throttleGroup.position.set(-0.28, 0.08, -1.04);
  const throttleStem = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.1, 0.024), gunmetalMat);
  throttleStem.position.y = 0.05;
  throttleGroup.add(throttleStem);
  const throttleHandle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.028, 0.044), armorWhiteMat);
  throttleHandle.position.y = 0.095;
  throttleHandle.userData = { kind: 'cockpit_button', action: 'throttle_step' };
  throttleGroup.add(throttleHandle);
  clickableCockpitControls.push(throttleHandle);
  interiorGroup.add(throttleGroup);

  // Cockpit Warm Tactical Interior Light
  const interiorLight = new THREE.PointLight('#7dd3fc', 0.85, 2.2, 1.5);
  interiorLight.position.set(0, 0.42, -1.05);
  interiorGroup.add(interiorLight);

  // Camera Anchor Inside Pilot Seat (looking out along -Z above MFD over nose)
  const cockpitSeatAnchor = new THREE.Object3D();
  cockpitSeatAnchor.position.set(0, 0.305, -0.92);
  rootGroup.add(cockpitSeatAnchor);

  // Third-person chase camera anchor behind & slightly above SR-7
  const chaseCameraAnchor = new THREE.Object3D();
  chaseCameraAnchor.position.set(0, 1.55, 6.4);
  rootGroup.add(chaseCameraAnchor);

  // ============================================================================
  // 4. DORSAL SPINE, SENSOR TURRET, COMMS DISH & TWIN CANTED TAIL FINS
  // ============================================================================
  const dorsalSpine = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.36, 2.25), armorWhiteMat);
  dorsalSpine.position.set(0, 0.32, 0.65);
  hullGroup.add(dorsalSpine);

  // Rear Dorsal Bridge Fairing
  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.28, 1.25), armorDarkMat);
  rearDeck.position.set(0, 0.24, 1.48);
  hullGroup.add(rearDeck);

  // Dorsal Sensor Turret / FLIR Ball (from image 1)
  const sensorTurretGroup = new THREE.Group();
  sensorTurretGroup.position.set(0, 0.56, 0.12);
  const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 14), armorDarkMat);
  sensorTurretGroup.add(turretBase);
  const turretHead = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.16, 14), armorWhiteMat);
  turretHead.rotation.z = Math.PI / 2;
  turretHead.position.y = 0.1;
  sensorTurretGroup.add(turretHead);
  const sensorLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 10),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  sensorLens.position.set(0, 0.1, -0.1);
  sensorTurretGroup.add(sensorLens);
  hullGroup.add(sensorTurretGroup);

  // Communications Parabolic Dish (from image 2)
  const radarDishGroup = new THREE.Group();
  radarDishGroup.position.set(-0.34, 0.54, 0.72);
  const dishMast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.14, 8), gunmetalMat);
  radarDishGroup.add(dishMast);
  const dishBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
    armorWhiteMat
  );
  dishBowl.position.y = 0.14;
  dishBowl.rotation.x = Math.PI * 0.72;
  radarDishGroup.add(dishBowl);
  hullGroup.add(radarDishGroup);

  // Twin Whip Antennas behind canopy
  [-0.22, 0.22].forEach((ax) => {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.55, 6), gunmetalMat);
    ant.position.set(ax, 0.68, -0.25);
    hullGroup.add(ant);
  });

  // Twin Copper/Bronze Fuel Conduits on upper flanks
  [-1, 1].forEach((side) => {
    const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.95, 12), copperPipeMat);
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(side * 0.76, 0.22, 1.05);
    hullGroup.add(conduit);
  });

  // Twin Canted Vertical Tail Stabilizers
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.85, 0);
  finShape.lineTo(1.08, 0.72);
  finShape.lineTo(0.75, 0.72);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
  });
  finGeo.rotateY(-Math.PI / 2);

  [-1, 1].forEach((side) => {
    const fin = new THREE.Mesh(finGeo, armorWhiteMat);
    fin.position.set(side * 0.64, 0.34, 1.05);
    fin.rotation.z = side * -0.42;
    hullGroup.add(fin);

    // Dark accent patch on fin
    const finPatch = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.25, 0.28), crimsonStripeMat);
    finPatch.position.set(side * 0.85, 0.76, 1.78);
    finPatch.rotation.z = side * -0.42;
    hullGroup.add(finPatch);
  });

  // ============================================================================
  // 5. SWEPT-BACK DELTA WINGS & WINGTIP NACELLE PODS
  // ============================================================================
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.78);
  wingShape.lineTo(1.62, -0.05);
  wingShape.lineTo(1.62, 0.66);
  wingShape.lineTo(0, 0.95);
  wingShape.closePath();

  const wingExtrudeGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.02,
    bevelSegments: 2,
  });
  wingExtrudeGeo.rotateX(Math.PI / 2);

  const leadingEdgeMat = armorDarkMat;
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(wingExtrudeGeo, armorWhiteMat);
    wing.position.set(side * 0.82, 0.05, 0.45);
    if (side === -1) {
      wing.scale.x = -1;
    }
    wing.rotation.z = side * -0.055; // Slight tactical dihedral
    hullGroup.add(wing);

    // Dark beveled leading-edge slat
    const leadingEdge = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.09, 0.22), leadingEdgeMat);
    leadingEdge.position.set(side * 1.62, 0.0, 0.05);
    leadingEdge.rotation.y = side * -0.41;
    leadingEdge.rotation.z = side * -0.055;
    hullGroup.add(leadingEdge);

    // Crimson tactical wing band
    const wingBand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.78), crimsonStripeMat);
    wingBand.position.set(side * 2.15, -0.03, 0.75);
    hullGroup.add(wingBand);

    // Chunky Wingtip Thruster/Sensor Pod
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.98), armorDarkMat);
    pod.position.set(side * 2.48, -0.04, 0.72);
    hullGroup.add(pod);

    const podFrontRing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.14), crimsonStripeMat);
    podFrontRing.position.set(side * 2.48, -0.04, 0.3);
    hullGroup.add(podFrontRing);
  });

  // Glowing Ion Trim Rings on Wingtip Pods
  const wingGlowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
  const leftWingTipGlow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), wingGlowMat);
  leftWingTipGlow.position.set(-2.48, -0.04, 1.22);
  hullGroup.add(leftWingTipGlow);

  const rightWingTipGlow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), wingGlowMat);
  rightWingTipGlow.position.set(2.48, -0.04, 1.22);
  hullGroup.add(rightWingTipGlow);

  // ============================================================================
  // 6. VENTRAL DUAL-BARREL TURRETS & TELEMETRY PULSE MUZZLES
  // ============================================================================
  const muzzleMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });

  const leftMuzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), muzzleMat);
  const rightMuzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    muzzleMat.clone()
  );

  [-0.3, 0.3].forEach((tx, idx) => {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.45), gunmetalMat);
    mount.position.set(tx, -0.34, -1.48);
    hullGroup.add(mount);

    const barrel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.65, 8), gunmetalMat);
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(tx - 0.035, -0.36, -1.85);
    hullGroup.add(barrel1);

    const barrel2 = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.65, 8), gunmetalMat);
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(tx + 0.035, -0.36, -1.85);
    hullGroup.add(barrel2);

    const flash = idx === 0 ? leftMuzzleFlash : rightMuzzleFlash;
    flash.position.set(tx, -0.36, -2.22);
    hullGroup.add(flash);
  });

  // ============================================================================
  // 7. TWIN MASSIVE REAR AFTERBURNER THRUSTERS & VOLUMETRIC PLUMES
  // ============================================================================
  const plumeMat = new THREE.MeshBasicMaterial({
    color: '#f59e0b',
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coreGlowMat = new THREE.MeshBasicMaterial({
    color: '#fef08a',
  });

  const plumeGeo = new THREE.ConeGeometry(0.32, 1.85, 20, 1, true);
  plumeGeo.rotateX(Math.PI / 2);
  plumeGeo.translate(0, 0, 0.92);

  const leftPlumeMesh = new THREE.Mesh(plumeGeo, plumeMat);
  const rightPlumeMesh = new THREE.Mesh(plumeGeo, plumeMat.clone());
  const leftCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), coreGlowMat);
  const rightCoreMesh = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), coreGlowMat.clone());

  [-0.58, 0.58].forEach((ex, idx) => {
    // Outer thruster cowling
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 1.05, 20), armorDarkMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(ex, 0.02, 1.72);
    hullGroup.add(nacelle);

    // Metallic nozzle lip
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.33, 0.34, 20, 1, true),
      gunmetalMat
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(ex, 0.02, 2.28);
    hullGroup.add(nozzle);

    // Core emissive turbine disc
    const core = idx === 0 ? leftCoreMesh : rightCoreMesh;
    core.position.set(ex, 0.02, 2.24);
    hullGroup.add(core);

    // Exhaust plume cone extending behind (+Z)
    const plume = idx === 0 ? leftPlumeMesh : rightPlumeMesh;
    plume.position.set(ex, 0.02, 2.34);
    hullGroup.add(plume);
  });

  // ============================================================================
  // 8. REAL TACTICAL SPOTLIGHTS & VOLUMETRIC HEADLIGHT CONES + RADAR PULSE RING
  // ============================================================================
  const headlightLeftSpot = new THREE.SpotLight('#fef9c3', 0, 85, Math.PI * 0.16, 0.45, 1.0);
  headlightLeftSpot.position.set(-0.26, -0.08, -2.7);
  const leftTarget = new THREE.Object3D();
  leftTarget.position.set(-0.26, -0.1, -30);
  rootGroup.add(leftTarget);
  headlightLeftSpot.target = leftTarget;
  rootGroup.add(headlightLeftSpot);

  const headlightRightSpot = new THREE.SpotLight('#fef9c3', 0, 85, Math.PI * 0.16, 0.45, 1.0);
  headlightRightSpot.position.set(0.26, -0.08, -2.7);
  const rightTarget = new THREE.Object3D();
  rightTarget.position.set(0.26, -0.1, -30);
  rootGroup.add(rightTarget);
  headlightRightSpot.target = rightTarget;
  rootGroup.add(headlightRightSpot);

  // Subtle volumetric beam cones extending forward along -Z
  const headlightBeamGroup = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(1.4, 10, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, -5);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fef9c3',
    transparent: true,
    opacity: 0.09,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  [-0.26, 0.26].forEach((bx) => {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, -0.08, -2.68);
    headlightBeamGroup.add(beam);
  });
  headlightBeamGroup.visible = false;
  hullGroup.add(headlightBeamGroup);

  // Expanding 3D Radar Scanner Pulse Ring
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
    pitchInput,
    rollInput,
    yawInput,
    radarPulseAgeSec,
    muzzleFlashAlpha,
    speedFormatted,
    nearestName,
    nearestDist,
    sasEnabled,
    autopilotActive,
  }) => {
    // 1. Physical 3D Cockpit Controls Animation
    yokeGroup.rotation.x = THREE.MathUtils.lerp(yokeGroup.rotation.x, pitchInput * 0.28, Math.min(1, dt * 12));
    yokeGroup.rotation.z = THREE.MathUtils.lerp(
      yokeGroup.rotation.z,
      -rollInput * 0.45 - yawInput * 0.2,
      Math.min(1, dt * 12)
    );
    throttleGroup.rotation.x = THREE.MathUtils.lerp(
      throttleGroup.rotation.x,
      -throttle * 0.55,
      Math.min(1, dt * 10)
    );

    // 2. Thruster Plume & Color Logic (Idle amber -> High thrust hot gold -> Hyperdrive cyan-blue!)
    const absT = Math.abs(throttle);
    const plumeScaleZ = boostActive ? 2.4 + Math.sin(clockTime * 35) * 0.18 : 0.28 + absT * 1.35 + Math.sin(clockTime * 28) * 0.06;
    const plumeScaleXY = boostActive ? 1.18 : 0.65 + absT * 0.45;
    leftPlumeMesh.scale.set(plumeScaleXY, plumeScaleXY, plumeScaleZ);
    rightPlumeMesh.scale.set(plumeScaleXY, plumeScaleXY, plumeScaleZ);

    const plumeColor = boostActive ? '#38bdf8' : absT > 0.6 ? '#fb923c' : '#f59e0b';
    const coreColor = boostActive ? '#e0f2fe' : '#fef08a';
    (leftPlumeMesh.material as THREE.MeshBasicMaterial).color.set(plumeColor);
    (rightPlumeMesh.material as THREE.MeshBasicMaterial).color.set(plumeColor);
    (leftPlumeMesh.material as THREE.MeshBasicMaterial).opacity = boostActive
      ? 0.92
      : 0.2 + absT * 0.62;
    (rightPlumeMesh.material as THREE.MeshBasicMaterial).opacity = boostActive
      ? 0.92
      : 0.2 + absT * 0.62;
    (leftCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (rightCoreMesh.material as THREE.MeshBasicMaterial).color.set(coreColor);
    (leftWingTipGlow.material as THREE.MeshBasicMaterial).color.set(boostActive ? '#7dd3fc' : '#0284c7');
    (rightWingTipGlow.material as THREE.MeshBasicMaterial).color.set(boostActive ? '#7dd3fc' : '#0284c7');

    // 3. Tactical Headlights & Cabin Interior Lights
    headlightBeamGroup.visible = headlightsOn;
    headlightLeftSpot.intensity = headlightsOn ? 6.5 : 0;
    headlightRightSpot.intensity = headlightsOn ? 6.5 : 0;
    interiorLight.intensity = interiorLightsOn ? 1.15 : 0.15;

    // 4. Radar Dish & Sensor Turret Micro-Motion
    radarDishGroup.rotation.y = Math.sin(clockTime * 0.65) * 0.55;
    sensorTurretGroup.rotation.y = THREE.MathUtils.lerp(
      sensorTurretGroup.rotation.y,
      yawInput * 0.35,
      Math.min(1, dt * 6)
    );

    // 5. Ventral Cannon Muzzle Flash
    leftMuzzleFlash.visible = muzzleFlashAlpha > 0.02;
    rightMuzzleFlash.visible = muzzleFlashAlpha > 0.02;
    (leftMuzzleFlash.material as THREE.MeshBasicMaterial).opacity = muzzleFlashAlpha;
    (rightMuzzleFlash.material as THREE.MeshBasicMaterial).opacity = muzzleFlashAlpha;

    // 6. Expanding Radar Scanner Pulse
    if (radarPulseAgeSec >= 0 && radarPulseAgeSec < 2.2) {
      radarPulseRing.visible = true;
      const t = radarPulseAgeSec / 2.2;
      radarPulseRing.scale.setScalar(1.0 + t * 55.0);
      radarPulseRingMat.opacity = (1.0 - t) * 0.85;
    } else {
      radarPulseRing.visible = false;
    }

    // 7. Refresh 3D Cockpit MFD Canvas (~12 fps for crisp performance)
    mfdTimer += dt;
    if (mfdTimer > 0.08) {
      mfdTimer = 0;
      renderCockpitMFD(
        mfdCanvas,
        throttle,
        boostActive,
        speedFormatted,
        nearestName,
        nearestDist,
        sasEnabled,
        autopilotActive,
        clockTime
      );
      mfdTex.needsUpdate = true;
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
    headlightLeftSpot,
    headlightRightSpot,
    headlightBeamGroup,
    radarDishGroup,
    sensorTurretGroup,
    radarPulseRing,
    mfdScreenMat,
    mfdCanvas,
    interiorLight,
    leftMuzzleFlash,
    rightMuzzleFlash,
    clickableCockpitControls,
    updateAnimations,
  };
}

