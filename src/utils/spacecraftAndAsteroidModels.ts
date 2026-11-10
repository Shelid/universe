import * as THREE from 'three';
import { CelestialBodyData, PropagatedSatellite } from '../types/astronomy';

/**
 * Generates a soft circular radial glow sprite texture so THREE.Points NEVER render as flat squares ("quadradinhos").
 */
let cachedSoftCircleTexture: THREE.CanvasTexture | null = null;
export function getSoftCircleParticleTexture(): THREE.CanvasTexture {
  if (cachedSoftCircleTexture) return cachedSoftCircleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedSoftCircleTexture = tex;
  return tex;
}

/**
 * Generates high-definition procedural PBR textures for Spacecraft Solar Panels, Kapton Gold Foil (MLI),
 * and Aerospace Composite / Thermal Radiator hulls.
 */
interface SpacecraftMaterialsBank {
  solarPanelMat: THREE.MeshStandardMaterial;
  goldFoilMat: THREE.MeshStandardMaterial;
  silverAlloyMat: THREE.MeshStandardMaterial;
  whiteHullMat: THREE.MeshStandardMaterial;
  radiatorMat: THREE.MeshStandardMaterial;
  darkOpticsMat: THREE.MeshStandardMaterial;
  copperDishMat: THREE.MeshStandardMaterial;
}

let cachedSpacecraftMaterials: SpacecraftMaterialsBank | null = null;

function getSpacecraftMaterials(): SpacecraftMaterialsBank {
  if (cachedSpacecraftMaterials) return cachedSpacecraftMaterials;

  // 1. Photovoltaic Solar Cell Grid Texture (512x512)
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = 512;
  solarCanvas.height = 512;
  const sCtx = solarCanvas.getContext('2d');
  if (sCtx) {
    const bgGrad = sCtx.createLinearGradient(0, 0, 512, 512);
    bgGrad.addColorStop(0, '#071936');
    bgGrad.addColorStop(0.5, '#0c2d5e');
    bgGrad.addColorStop(1, '#06152d');
    sCtx.fillStyle = bgGrad;
    sCtx.fillRect(0, 0, 512, 512);

    // Individual silicon wafer cells
    const cols = 8;
    const rows = 16;
    const cellW = 512 / cols;
    const cellH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        sCtx.fillStyle = (r + c) % 2 === 0 ? '#0e356e' : '#0a2854';
        sCtx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

        // Fine silver micro-busbars
        sCtx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
        sCtx.lineWidth = 1;
        sCtx.beginPath();
        sCtx.moveTo(x + cellW * 0.33, y + 2);
        sCtx.lineTo(x + cellW * 0.33, y + cellH - 2);
        sCtx.moveTo(x + cellW * 0.66, y + 2);
        sCtx.lineTo(x + cellW * 0.66, y + cellH - 2);
        sCtx.stroke();
      }
    }

    // Metallic cell interconnect grid lines
    sCtx.strokeStyle = '#64748b';
    sCtx.lineWidth = 2.5;
    for (let c = 0; c <= cols; c++) {
      sCtx.beginPath();
      sCtx.moveTo(c * cellW, 0);
      sCtx.lineTo(c * cellW, 512);
      sCtx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      sCtx.beginPath();
      sCtx.moveTo(0, r * cellH);
      sCtx.lineTo(512, r * cellH);
      sCtx.stroke();
    }
  }
  const solarTex = new THREE.CanvasTexture(solarCanvas);
  solarTex.wrapS = THREE.RepeatWrapping;
  solarTex.wrapT = THREE.RepeatWrapping;

  // 2. Crinkled Kapton Gold Foil (MLI Thermal Blanket) Texture + Bump Map (256x256)
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = 256;
  foilCanvas.height = 256;
  const fCtx = foilCanvas.getContext('2d');
  if (fCtx) {
    fCtx.fillStyle = '#d97706';
    fCtx.fillRect(0, 0, 256, 256);
    // Faceted crinkle polygons simulating metallic Mylar/Kapton blanket
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 6 + Math.random() * 18;
      const lum = Math.random();
      fCtx.fillStyle =
        lum > 0.65
          ? 'rgba(254, 240, 138, 0.45)'
          : lum > 0.3
            ? 'rgba(245, 158, 11, 0.45)'
            : 'rgba(146, 64, 14, 0.45)';
      fCtx.beginPath();
      fCtx.moveTo(x, y);
      fCtx.lineTo(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r * 2);
      fCtx.lineTo(x + (Math.random() - 0.5) * r * 2, y + (Math.random() - 0.5) * r * 2);
      fCtx.closePath();
      fCtx.fill();
    }
    // Kapton blanket seams
    fCtx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
    fCtx.lineWidth = 2;
    for (let s = 0; s <= 256; s += 64) {
      fCtx.beginPath();
      fCtx.moveTo(s, 0);
      fCtx.lineTo(s, 256);
      fCtx.moveTo(0, s);
      fCtx.lineTo(256, s);
      fCtx.stroke();
    }
  }
  const foilTex = new THREE.CanvasTexture(foilCanvas);
  foilTex.wrapS = THREE.RepeatWrapping;
  foilTex.wrapT = THREE.RepeatWrapping;

  // 3. Aerospace Hull / Module Panel Texture (256x256)
  const hullCanvas = document.createElement('canvas');
  hullCanvas.width = 256;
  hullCanvas.height = 256;
  const hCtx = hullCanvas.getContext('2d');
  if (hCtx) {
    hCtx.fillStyle = '#e2e8f0';
    hCtx.fillRect(0, 0, 256, 256);
    hCtx.strokeStyle = '#94a3b8';
    hCtx.lineWidth = 2;
    for (let y = 0; y <= 256; y += 32) {
      hCtx.beginPath();
      hCtx.moveTo(0, y);
      hCtx.lineTo(256, y);
      hCtx.stroke();
    }
    for (let x = 0; x <= 256; x += 64) {
      hCtx.beginPath();
      hCtx.moveTo(x, 0);
      hCtx.lineTo(x, 256);
      hCtx.stroke();
    }
  }
  const hullTex = new THREE.CanvasTexture(hullCanvas);

  cachedSpacecraftMaterials = {
    solarPanelMat: new THREE.MeshStandardMaterial({
      map: solarTex,
      bumpMap: solarTex,
      bumpScale: 0.004,
      metalness: 0.65,
      roughness: 0.22,
      emissive: new THREE.Color('#092247'),
      emissiveIntensity: 0.35,
    }),
    goldFoilMat: new THREE.MeshStandardMaterial({
      map: foilTex,
      bumpMap: foilTex,
      bumpScale: 0.012,
      color: new THREE.Color('#fbbf24'),
      metalness: 0.86,
      roughness: 0.28,
      emissive: new THREE.Color('#451a03'),
      emissiveIntensity: 0.18,
    }),
    silverAlloyMat: new THREE.MeshStandardMaterial({
      map: hullTex,
      color: new THREE.Color('#cbd5e1'),
      metalness: 0.82,
      roughness: 0.26,
    }),
    whiteHullMat: new THREE.MeshStandardMaterial({
      map: hullTex,
      color: new THREE.Color('#f8fafc'),
      metalness: 0.32,
      roughness: 0.42,
    }),
    radiatorMat: new THREE.MeshStandardMaterial({
      map: hullTex,
      color: new THREE.Color('#f1f5f9'),
      metalness: 0.45,
      roughness: 0.3,
      side: THREE.DoubleSide,
    }),
    darkOpticsMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0f172a'),
      metalness: 0.75,
      roughness: 0.18,
    }),
    copperDishMat: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e2e8f0'),
      metalness: 0.78,
      roughness: 0.25,
      side: THREE.DoubleSide,
    }),
  };

  return cachedSpacecraftMaterials;
}

/**
 * Helper: Creates a realistic Parabolic High-Gain Dish Antenna with central feed horn tripod.
 */
function createParabolicDishAssembly(
  radius: number,
  mats: SpacecraftMaterialsBank
): THREE.Group {
  const dishGroup = new THREE.Group();
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = t * radius;
    const y = t * t * radius * 0.38;
    points.push(new THREE.Vector2(r, y));
  }
  const dishGeo = new THREE.LatheGeometry(points, 24);
  const dishMesh = new THREE.Mesh(dishGeo, mats.copperDishMat);
  dishGroup.add(dishMesh);

  // Central feed horn + sub-reflector cap
  const feedGeo = new THREE.CylinderGeometry(radius * 0.06, radius * 0.12, radius * 0.52, 12);
  const feedMesh = new THREE.Mesh(feedGeo, mats.darkOpticsMat);
  feedMesh.position.y = radius * 0.26;
  dishGroup.add(feedMesh);

  const capGeo = new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, radius * 0.05, 12);
  const capMesh = new THREE.Mesh(capGeo, mats.goldFoilMat);
  capMesh.position.y = radius * 0.52;
  dishGroup.add(capMesh);

  return dishGroup;
}

/**
 * Helper: Creates a multi-panel articulated Photovoltaic Solar Array Wing with metallic frame & yoke.
 */
function createSolarWingAssembly(
  wingLength: number,
  wingWidth: number,
  segments: number,
  mats: SpacecraftMaterialsBank
): THREE.Group {
  const wingGroup = new THREE.Group();

  // Central support boom
  const boomGeo = new THREE.CylinderGeometry(wingWidth * 0.04, wingWidth * 0.04, wingLength * 1.04, 8);
  boomGeo.rotateZ(Math.PI / 2);
  const boomMesh = new THREE.Mesh(boomGeo, mats.silverAlloyMat);
  boomMesh.position.x = wingLength * 0.52;
  wingGroup.add(boomMesh);

  const segLen = (wingLength * 0.92) / segments;
  const gap = wingLength * 0.015;
  const startX = wingLength * 0.08;

  for (let i = 0; i < segments; i++) {
    const panelGroup = new THREE.Group();
    const cx = startX + i * (segLen + gap) + segLen * 0.5;

    // Metallic backing frame
    const frameGeo = new THREE.BoxGeometry(segLen, wingWidth * 0.025, wingWidth);
    const frameMesh = new THREE.Mesh(frameGeo, mats.silverAlloyMat);
    panelGroup.add(frameMesh);

    // Front & back silicon solar cell blankets
    const blanketGeo = new THREE.BoxGeometry(segLen * 0.96, wingWidth * 0.032, wingWidth * 0.95);
    const blanketMesh = new THREE.Mesh(blanketGeo, mats.solarPanelMat);
    panelGroup.add(blanketMesh);

    panelGroup.position.x = cx;
    wingGroup.add(panelGroup);
  }

  return wingGroup;
}

/**
 * Builds a realistic, multi-component 3D Spacecraft Model tailored to the satellite's mission architecture:
 * - Space Stations (ISS & Tiangong): Integrated truss, pressurized modules, cupola, thermal radiators, 8 solar wings
 * - Space Telescopes (Hubble, Fermi, IXPE): Cylindrical optical barrel, hinged aperture door, secondary mirror baffle, twin dishes & wings
 * - Earth Observation & Weather (Landsat 9, Sentinel-2, Terra, Aqua, NOAA-20, GOES-16): Octagonal Kapton gold-foil bus, nadir optical cameras, SAR radar panel, parabolic dish, single/dual solar wing
 * - Communications & Navigation (GPS III, Galileo, Starlink, Iridium): Hexagonal bus, L-band helical antenna array, cross-link dishes, long solar wings
 */
export function createDetailedSatellite3DGroup(sat: PropagatedSatellite): THREE.Group {
  const mats = getSpacecraftMaterials();
  const root = new THREE.Group();

  const isISS = sat.id === 'sat-iss';
  const isTiangong = sat.id === 'sat-tiangong';

  // =========================================================================
  // 1. INTERNATIONAL SPACE STATION (ISS) & TIANGONG SPACE STATION
  // =========================================================================
  if (isISS || isTiangong) {
    const scale = isISS ? 0.018 : 0.015;
    const station = new THREE.Group();
    station.scale.setScalar(scale);

    // Integrated Truss Structure (ITS) backbone
    const trussLen = isISS ? 8.8 : 5.2;
    const trussGeo = new THREE.BoxGeometry(trussLen, 0.24, 0.24);
    const trussMesh = new THREE.Mesh(trussGeo, mats.silverAlloyMat);
    station.add(trussMesh);

    // Pressurized Habitation & Laboratory Modules along Z axis (Zvezda -> Zarya -> Unity -> Destiny -> Harmony)
    const modPositionsZ = isISS ? [-1.8, -0.7, 0.3, 1.3, 2.2] : [-1.2, 0.0, 1.2];
    modPositionsZ.forEach((zPos, idx) => {
      const r = idx % 2 === 0 ? 0.34 : 0.29;
      const len = 0.92;
      const modGeo = new THREE.CylinderGeometry(r, r, len, 18);
      modGeo.rotateX(Math.PI / 2);
      const modMesh = new THREE.Mesh(
        modGeo,
        idx === 0 ? mats.goldFoilMat : mats.whiteHullMat
      );
      modMesh.position.set(0, 0, zPos);
      station.add(modMesh);

      // Docking ring collar
      const ringGeo = new THREE.CylinderGeometry(r * 1.06, r * 1.06, 0.08, 18);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, mats.silverAlloyMat);
      ringMesh.position.set(0, 0, zPos + len * 0.48);
      station.add(ringMesh);
    });

    // Cross-modules (Columbus & Kibo on ISS / Wentian & Mengtian on Tiangong)
    [-0.95, 0.95].forEach((xSide) => {
      const labGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.15, 16);
      labGeo.rotateZ(Math.PI / 2);
      const labMesh = new THREE.Mesh(labGeo, mats.whiteHullMat);
      labMesh.position.set(xSide, 0, isISS ? 1.3 : 0.6);
      station.add(labMesh);
    });

    // 8 Giant Double-Wing Photovoltaic Solar Arrays (4 pairs on ISS, 2 pairs on Tiangong)
    const wingXPositions = isISS ? [-3.9, -2.7, 2.7, 3.9] : [-2.3, 2.3];
    wingXPositions.forEach((xPos) => {
      // Rotary alpha gimbal hub
      const hubGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.38, 12);
      const hubMesh = new THREE.Mesh(hubGeo, mats.goldFoilMat);
      hubMesh.position.set(xPos, 0, 0);
      station.add(hubMesh);

      // Upper (+Z) and Lower (-Z) Solar Array Wings
      [-1, 1].forEach((dirZ) => {
        const wing = createSolarWingAssembly(2.85, 0.68, 4, mats);
        wing.rotation.y = dirZ > 0 ? -Math.PI / 2 : Math.PI / 2;
        wing.position.set(xPos, 0, dirZ * 0.18);
        station.add(wing);
      });
    });

    // White Accordion Thermal Radiator Panels
    [-1.4, 1.4].forEach((xRad) => {
      const radGeo = new THREE.BoxGeometry(0.55, 0.02, 1.65);
      const radMesh = new THREE.Mesh(radGeo, mats.radiatorMat);
      radMesh.position.set(xRad, -0.25, -0.85);
      radMesh.rotation.z = 0.25;
      station.add(radMesh);
    });

    root.add(station);
    return root;
  }

  // =========================================================================
  // 2. SPACE TELESCOPES (HUBBLE, FERMI, IXPE)
  // =========================================================================
  if (sat.category === 'TELESCOPES') {
    const scope = new THREE.Group();
    scope.scale.setScalar(0.017);

    // Aft Equipment & Instrument Shroud (wider cylinder)
    const aftGeo = new THREE.CylinderGeometry(0.62, 0.62, 1.45, 24);
    aftGeo.rotateX(Math.PI / 2);
    const aftMesh = new THREE.Mesh(aftGeo, mats.silverAlloyMat);
    aftMesh.position.z = -0.65;
    scope.add(aftMesh);

    // Gold foil thermal wrap band around mid-ring
    const midBandGeo = new THREE.CylinderGeometry(0.64, 0.64, 0.38, 24);
    midBandGeo.rotateX(Math.PI / 2);
    const midBandMesh = new THREE.Mesh(midBandGeo, mats.goldFoilMat);
    midBandMesh.position.z = 0.05;
    scope.add(midBandMesh);

    // Forward Optical Telescope OTA Barrel
    const otaGeo = new THREE.CylinderGeometry(0.52, 0.52, 1.65, 24);
    otaGeo.rotateX(Math.PI / 2);
    const otaMesh = new THREE.Mesh(otaGeo, mats.silverAlloyMat);
    otaMesh.position.z = 0.95;
    scope.add(otaMesh);

    // Dark internal optical mirror cavity at +Z front mouth
    const cavGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.12, 24);
    cavGeo.rotateX(Math.PI / 2);
    const cavMesh = new THREE.Mesh(cavGeo, mats.darkOpticsMat);
    cavMesh.position.z = 1.74;
    scope.add(cavMesh);

    // Open Hinged Aperture Door at front of Hubble
    const doorGeo = new THREE.CylinderGeometry(0.53, 0.53, 0.85, 16, 1, true, 0, Math.PI);
    const doorMesh = new THREE.Mesh(doorGeo, mats.silverAlloyMat);
    doorMesh.rotation.x = Math.PI / 2 - 0.55;
    doorMesh.position.set(0, 0.45, 2.05);
    scope.add(doorMesh);

    // Twin Photovoltaic Solar Array Wings (+X and -X)
    [-1, 1].forEach((side) => {
      const wing = createSolarWingAssembly(2.35, 0.65, 3, mats);
      if (side < 0) wing.rotation.y = Math.PI;
      wing.position.set(side * 0.55, 0, 0.15);
      scope.add(wing);
    });

    // Twin High-Gain Dish Antennas on vertical booms (+Y and -Y)
    [-1, 1].forEach((vSide) => {
      const mastGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8);
      const mastMesh = new THREE.Mesh(mastGeo, mats.silverAlloyMat);
      mastMesh.position.set(0, vSide * 0.95, 0.05);
      scope.add(mastMesh);

      const dish = createParabolicDishAssembly(0.32, mats);
      dish.position.set(0, vSide * 1.42, 0.05);
      dish.rotation.x = vSide > 0 ? 0.5 : Math.PI - 0.5;
      scope.add(dish);
    });

    root.add(scope);
    return root;
  }

  // =========================================================================
  // 3. EARTH OBSERVATION & METEOROLOGICAL SATELLITES (LANDSAT 9, SENTINEL-2, TERRA, AQUA, NOAA-20, GOES-16)
  // =========================================================================
  if (sat.category === 'EARTH_OBSERVATION' || sat.category === 'WEATHER') {
    const obs = new THREE.Group();
    obs.scale.setScalar(0.017);

    // Octagonal Spacecraft Bus wrapped in crinkled Kapton Gold Foil (MLI)
    const busGeo = new THREE.CylinderGeometry(0.62, 0.58, 1.55, 8);
    busGeo.rotateX(Math.PI / 2);
    const busMesh = new THREE.Mesh(busGeo, mats.goldFoilMat);
    obs.add(busMesh);

    // Forward Precision Optical Instrument Deck (white/silver composite)
    const deckGeo = new THREE.BoxGeometry(0.95, 0.85, 0.82);
    const deckMesh = new THREE.Mesh(deckGeo, mats.whiteHullMat);
    deckMesh.position.z = 0.95;
    obs.add(deckMesh);

    // Dual Nadir-Pointing Multi-Spectral Telescope Lenses (OLI-2 & TIRS-2 / MODIS / ABI)
    [-0.24, 0.24].forEach((xOff, i) => {
      const barrelGeo = new THREE.CylinderGeometry(i === 0 ? 0.22 : 0.16, i === 0 ? 0.24 : 0.18, 0.55, 18);
      barrelGeo.rotateX(Math.PI / 2);
      const barrelMesh = new THREE.Mesh(barrelGeo, mats.silverAlloyMat);
      barrelMesh.position.set(xOff, 0, 1.42);
      obs.add(barrelMesh);

      const lensGeo = new THREE.CircleGeometry(i === 0 ? 0.19 : 0.14, 18);
      const lensMesh = new THREE.Mesh(lensGeo, mats.darkOpticsMat);
      lensMesh.position.set(xOff, 0, 1.71);
      obs.add(lensMesh);
    });

    // Parabolic X-Band Downlink Dish Antenna
    const dish = createParabolicDishAssembly(0.46, mats);
    dish.position.set(0, 0.78, -0.15);
    dish.rotation.x = 0.4;
    obs.add(dish);

    // SAR Radar / Calibration Flat Panel Antenna underneath
    const sarGeo = new THREE.BoxGeometry(0.42, 0.05, 1.35);
    const sarMesh = new THREE.Mesh(sarGeo, mats.radiatorMat);
    sarMesh.position.set(0, -0.68, 0.15);
    obs.add(sarMesh);

    // Realistic Single-Wing or Dual-Wing Articulated Photovoltaic Array
    const wingRight = createSolarWingAssembly(2.75, 0.82, 4, mats);
    wingRight.position.set(0.58, 0, -0.1);
    obs.add(wingRight);

    if (sat.category === 'WEATHER') {
      // Magnetometer boom on opposite side for GOES/NOAA weather satellites
      const magBoomGeo = new THREE.CylinderGeometry(0.03, 0.02, 1.8, 8);
      magBoomGeo.rotateZ(Math.PI / 2);
      const magBoom = new THREE.Mesh(magBoomGeo, mats.silverAlloyMat);
      magBoom.position.set(-1.35, 0, -0.1);
      obs.add(magBoom);
    } else {
      const wingLeft = createSolarWingAssembly(2.75, 0.82, 4, mats);
      wingLeft.rotation.y = Math.PI;
      wingLeft.position.set(-0.58, 0, -0.1);
      obs.add(wingLeft);
    }

    root.add(obs);
    return root;
  }

  // =========================================================================
  // 4. COMMUNICATIONS & NAVIGATION SATELLITES (GPS III, GALILEO, STARLINK, IRIDIUM)
  // =========================================================================
  const comm = new THREE.Group();
  comm.scale.setScalar(0.017);

  // Main Rectangular Aerospace Chassis with Gold Foil Thermal Blankets
  const bodyGeo = new THREE.BoxGeometry(0.95, 0.88, 1.35);
  const bodyMesh = new THREE.Mesh(bodyGeo, mats.goldFoilMat);
  comm.add(bodyMesh);

  // Side Thermal Radiator Louver Panels
  const sideGeo = new THREE.BoxGeometry(1.01, 0.68, 1.05);
  const sideMesh = new THREE.Mesh(sideGeo, mats.whiteHullMat);
  comm.add(sideMesh);

  // Nadir L-Band Helical Navigation Antenna Array (8 helical elements pointing at Earth +Z)
  for (let r = -1; r <= 1; r += 2) {
    for (let c = -1.5; c <= 1.5; c += 1) {
      const helGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.36, 10);
      helGeo.rotateX(Math.PI / 2);
      const helMesh = new THREE.Mesh(helGeo, mats.silverAlloyMat);
      helMesh.position.set(c * 0.22, r * 0.22, 0.84);
      comm.add(helMesh);
    }
  }

  // Dual Cross-Link Parabolic Dishes
  [-0.58, 0.58].forEach((yOff) => {
    const dish = createParabolicDishAssembly(0.36, mats);
    dish.position.set(0, yOff, 0.15);
    dish.rotation.x = yOff > 0 ? 0.35 : Math.PI - 0.35;
    comm.add(dish);
  });

  // Aft Apogee Thruster Nozzle Cone
  const nozzleGeo = new THREE.ConeGeometry(0.22, 0.38, 16, 1, true);
  nozzleGeo.rotateX(Math.PI / 2);
  const nozzleMesh = new THREE.Mesh(nozzleGeo, mats.darkOpticsMat);
  nozzleMesh.position.z = -0.82;
  comm.add(nozzleMesh);

  // Twin Extended 4-Panel Photovoltaic Solar Wings
  [-1, 1].forEach((side) => {
    const wing = createSolarWingAssembly(2.85, 0.76, 4, mats);
    if (side < 0) wing.rotation.y = Math.PI;
    wing.position.set(side * 0.52, 0, 0);
    comm.add(wing);
  });

  root.add(comm);
  return root;
}

/**
 * Simple deterministic 3D pseudo-noise for sculpting realistic asteroid crags, facets, and impact craters.
 */
function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const uz = fz * fz * (3.0 - 2.0 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 + (n100 - n000) * ux;
  const nx10 = n010 + (n110 - n010) * ux;
  const nx01 = n001 + (n101 - n001) * ux;
  const nx11 = n011 + (n111 - n011) * ux;
  const nxy0 = nx00 + (nx10 - nx00) * uy;
  const nxy1 = nx01 + (nx11 - nx01) * uy;
  return (nxy0 + (nxy1 - nxy0) * uz) * 2.0 - 1.0;
}

function fbm3D(x: number, y: number, z: number): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < 4; i++) {
    v += amp * noise3D(x * freq, y * freq, z * freq);
    freq *= 2.12;
    amp *= 0.48;
  }
  return v;
}

/**
 * Generates 6 distinct, high-resolution sculpted 3D Asteroid Geometries with varied geological shapes
 * (Eros Bilobed, Bennu Diamond, Vesta Craggy Spheroid, Gaspra Angular Shard, Mathilde Cratered, Kleopatra Twisted)
 * and real spherical UVs + smooth vertex normals.
 */
let cachedAsteroidGeometries: THREE.BufferGeometry[] | null = null;

export function getSculptedAsteroidGeometries(): THREE.BufferGeometry[] {
  if (cachedAsteroidGeometries) return cachedAsteroidGeometries;

  const archetypes = [
    // 0: Eros / Itokawa Bilobed Peanut Asteroid
    { stretch: [1.55, 0.76, 0.85], seed: 1.7, craterCount: 9, pinchNeck: 0.32, ridge: 0.0 },
    // 1: Bennu / Ryugu Diamond "Spinning-Top" Asteroid
    { stretch: [1.14, 0.92, 1.14], seed: 5.3, craterCount: 7, pinchNeck: 0.0, ridge: 0.22 },
    // 2: Vesta / Ida Asymmetric Craggy Planetesimal
    { stretch: [1.28, 0.96, 1.08], seed: 9.1, craterCount: 11, pinchNeck: 0.0, ridge: 0.06 },
    // 3: Gaspra / Lutetia Angular Fractured Monolith Shard
    { stretch: [1.44, 0.72, 0.94], seed: 14.8, craterCount: 8, pinchNeck: 0.12, ridge: 0.1 },
    // 4: Mathilde Heavily Gouged Carbonaceous Asteroid
    { stretch: [1.15, 1.04, 1.18], seed: 21.4, craterCount: 14, pinchNeck: 0.0, ridge: 0.0 },
    // 5: Toutatis / Kleopatra Gnarled Multi-Lobe Boulder
    { stretch: [1.48, 0.82, 0.78], seed: 28.9, craterCount: 10, pinchNeck: 0.24, ridge: 0.08 },
  ];

  cachedAsteroidGeometries = archetypes.map((cfg) => {
    // Subdivision 2 = 320 sculpted triangles per asteroid (4x faster GPU performance for locked 60 FPS!)
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;

    // Pre-generate random impact crater centers on the unit sphere
    const craters: { dir: THREE.Vector3; radius: number; depth: number }[] = [];
    for (let c = 0; c < cfg.craterCount; c++) {
      const u = hash3(cfg.seed, c * 1.3, 0.7) * Math.PI * 2;
      const v = Math.acos(hash3(cfg.seed, c * 2.9, 1.9) * 2 - 1);
      craters.push({
        dir: new THREE.Vector3(
          Math.sin(v) * Math.cos(u),
          Math.cos(v),
          Math.sin(v) * Math.sin(u)
        ).normalize(),
        radius: 0.24 + hash3(cfg.seed, c, 4.1) * 0.28,
        depth: 0.14 + hash3(cfg.seed, c, 7.3) * 0.16,
      });
    }

    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).normalize();

      // Spherical UVs for 4K regolith texture mapping
      if (uvAttr) {
        const u = 0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2);
        const vt = 0.5 - Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI;
        uvAttr.setXY(i, u, vt);
      }

      // 1. Multi-octave rocky crags & facets
      const coarse = fbm3D(
        v.x * 1.85 + cfg.seed,
        v.y * 1.85 + cfg.seed,
        v.z * 1.85 + cfg.seed
      );
      const sharpRidges =
        1.0 -
        Math.abs(
          noise3D(
            v.x * 3.6 - cfg.seed,
            v.y * 3.6 + cfg.seed,
            v.z * 3.6
          )
        );
      const fineRegolith = noise3D(
        v.x * 9.5 + cfg.seed,
        v.y * 9.5,
        v.z * 9.5 - cfg.seed
      );

      let disp = 1.0 + coarse * 0.26 + (sharpRidges - 0.5) * 0.16 + fineRegolith * 0.035;

      // 2. Bilobed neck pinch (Eros / Itokawa / Toutatis)
      if (cfg.pinchNeck > 0) {
        const neckFactor = Math.exp(-v.x * v.x * 10.0);
        disp *= 1.0 - cfg.pinchNeck * neckFactor;
      }

      // 3. Equatorial diamond ridge (Bennu / Ryugu)
      if (cfg.ridge > 0) {
        const eqFactor = Math.exp(-v.y * v.y * 12.0);
        disp += cfg.ridge * eqFactor;
      }

      // 4. Carve 3D impact craters with raised ejecta rims
      for (const cr of craters) {
        const dist = v.distanceTo(cr.dir);
        if (dist < cr.radius * 1.35) {
          const normD = dist / cr.radius;
          if (normD < 1.0) {
            // Parabolic crater bowl
            const bowl = (1.0 - normD * normD) * cr.depth;
            disp -= bowl;
          } else {
            // Raised crater rim
            const rimT = (normD - 1.0) / 0.35;
            const rim = Math.sin(rimT * Math.PI) * cr.depth * 0.32;
            disp += rim;
          }
        }
      }

      posAttr.setXYZ(
        i,
        v.x * disp * cfg.stretch[0],
        v.y * disp * cfg.stretch[1],
        v.z * disp * cfg.stretch[2]
      );
    }

    posAttr.needsUpdate = true;
    if (uvAttr) uvAttr.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  });

  return cachedAsteroidGeometries;
}

/**
 * Custom 3D Instanced Asteroid Shader Material with 4K Crater/Regolith Texture,
 * Lommel-Seeliger Solar Lighting, Crater Self-Shadowing, and Cool Slate-Blue Space Ambient Fill
 * (matching the user's reference image).
 */
export function createInstancedAsteroidShaderMaterial(
  craterTexture: THREE.Texture | null,
  isSaturnRingIce = false
): THREE.ShaderMaterial {
  const fallbackData = new Uint8Array([180, 175, 170, 255]);
  const fallbackTex = new THREE.DataTexture(fallbackData, 1, 1, THREE.RGBAFormat);
  fallbackTex.needsUpdate = true;

  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetRadius: { value: 0.0 },
      uCraterMap: { value: craterTexture || fallbackTex },
      uIsIceBoulder: { value: isSaturnRingIce ? 1.0 : 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec2 vUv;
      varying vec3 vInstanceColor;

      void main() {
        vUv = uv;
        vLocalPos = position;
        #ifdef USE_INSTANCING_COLOR
          vInstanceColor = instanceColor;
        #else
          vInstanceColor = vec3(0.75, 0.72, 0.68);
        #endif

        #ifdef USE_INSTANCING
          mat4 instModel = modelMatrix * instanceMatrix;
          mat3 im = mat3(instanceMatrix);
          vec3 instNormal = normal / vec3(
            max(dot(im[0], im[0]), 0.0001),
            max(dot(im[1], im[1]), 0.0001),
            max(dot(im[2], im[2]), 0.0001)
          );
          instNormal = im * instNormal;
          vNormal = normalize(mat3(modelMatrix) * instNormal);
        #else
          mat4 instModel = modelMatrix;
          vNormal = normalize(mat3(modelMatrix) * normal);
        #endif

        vec4 worldPos = instModel * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunPosition;
      uniform vec3 uPlanetPosition;
      uniform float uPlanetRadius;
      uniform sampler2D uCraterMap;
      uniform float uIsIceBoulder;

      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      varying vec2 vUv;
      varying vec3 vInstanceColor;

      void main() {
        vec3 texSample = texture2D(uCraterMap, vUv * 2.0).rgb;
        vec3 texDetail = texture2D(uCraterMap, vUv * 5.5 + vec2(0.37, 0.61)).rgb;

        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunPosition - vWorldPos);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 H = normalize(L + V);

        // Perturb normal from 4K crater texture luminance for crisp micro-facets and deep craters
        float microRelief = dot(texDetail, vec3(0.333)) - 0.5;
        float NdotL = dot(N, L) + microRelief * 0.32;
        float NdotV = max(dot(N, V), 0.05);

        // Lommel-Seeliger rocky asteroid reflectance
        float mu0 = max(NdotL, 0.0);
        float lommel = (mu0 / (mu0 + NdotV * 0.52)) * 1.48;
        float dayLight = mix(mu0, lommel, 0.65) * smoothstep(-0.14, 0.12, NdotL);

        // Combine mineralogical instance color with 4K NASA crater texture & local 3D depth shading
        float craterCavity = clamp((length(vLocalPos) - 0.72) / 0.55, 0.45, 1.18);
        float rockDetail = mix(0.48, 1.42, dot(texSample, vec3(0.333))) * craterCavity;
        vec3 baseAlbedo = vInstanceColor * rockDetail;

        // Warm sunlit highlight on sun-facing crags + cool slate-blue cosmic fill on shadowed facets
        vec3 warmSunTint = uIsIceBoulder > 0.5 ? vec3(1.15, 1.06, 0.96) : vec3(1.25, 1.02, 0.82);
        vec3 coolSpaceAmbient = uIsIceBoulder > 0.5 ? vec3(0.20, 0.30, 0.46) : vec3(0.16, 0.23, 0.35);

        // Rim backlight / crystalline glint so every 3D rock silhouette stands out against space
        float rim = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.4);
        float spec = pow(max(dot(N, H), 0.0), uIsIceBoulder > 0.5 ? 36.0 : 16.0) * (uIsIceBoulder > 0.5 ? 0.42 : 0.16) * dayLight;

        // Optional planetary shadow (for Saturn's ring boulders)
        float shadowFactor = 1.0;
        if (uPlanetRadius > 0.001) {
          vec3 fromPlanet = vWorldPos - uPlanetPosition;
          float proj = dot(fromPlanet, L);
          if (proj < 0.0) {
            vec3 closestVec = fromPlanet - proj * L;
            vec3 scaledClosest = vec3(closestVec.x, closestVec.y / 0.902, closestVec.z);
            shadowFactor = smoothstep(uPlanetRadius * 0.94, uPlanetRadius * 1.02, length(scaledClosest));
          }
        }

        vec3 litAsteroid =
          baseAlbedo * (coolSpaceAmbient + warmSunTint * dayLight * shadowFactor) +
          vec3(0.50, 0.70, 0.96) * rim * 0.24 +
          vec3(1.0, 0.96, 0.88) * spec * shadowFactor;

        gl_FragColor = vec4(litAsteroid, 1.0);
      }
    `,
  });
}

/**
 * Populates a realistic 3D Asteroid Belt or Kuiper Belt using all 6 sculpted 3D asteroid archetypes
 * with varied sizes (power-law distribution from giant hero boulders to small fragments), varied non-uniform
 * proportions, and varied 3D orientations (100% solid 3D meshes, zero faint point-light clouds).
 */
export function populateRealisticAsteroidBeltGroup(
  targetGroup: THREE.Group,
  asteroidMat: THREE.ShaderMaterial,
  totalAsteroids: number,
  innerRadius: number,
  outerRadius: number,
  verticalSpread: number,
  baseScaleMin: number,
  baseScaleMax: number,
  isKuiperBelt = false
): THREE.InstancedMesh[] {
  const geometries = getSculptedAsteroidGeometries();
  const countPerArchetype = Math.floor(totalAsteroids / geometries.length);
  const instancedMeshes: THREE.InstancedMesh[] = [];

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  geometries.forEach((geo, archIdx) => {
    const mesh = new THREE.InstancedMesh(geo, asteroidMat, countPerArchetype);
    mesh.frustumCulled = false;

    for (let i = 0; i < countPerArchetype; i++) {
      // Radial distribution
      const radialT = Math.random();
      const radius = innerRadius + radialT * (outerRadius - innerRadius);
      const angle = Math.random() * Math.PI * 2;
      // Gaussian-like vertical distribution
      const gaussY = (Math.random() + Math.random() + Math.random() - 1.5) * 0.66;
      const y = gaussY * verticalSpread * (radius / innerRadius);

      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      dummy.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Power-law size variation: mostly fine/medium rocky fragments + ~10% larger planetesimals
      const sizeRoll = Math.random();
      const powerFactor =
        sizeRoll > 0.90
          ? 0.70 + Math.random() * 0.30 // Larger planetesimals (capped at 1.0x baseScaleMax)
          : sizeRoll > 0.55
            ? 0.35 + Math.random() * 0.35 // Medium asteroids
            : 0.14 + Math.random() * 0.21; // Smaller rocky fragments

      const baseScale = baseScaleMin + powerFactor * (baseScaleMax - baseScaleMin);
      dummy.scale.set(
        baseScale * (0.78 + Math.random() * 0.44),
        baseScale * (0.72 + Math.random() * 0.42),
        baseScale * (0.78 + Math.random() * 0.44)
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Mineralogical taxonomic color classes:
      // Main Belt: C-type (dark carbonaceous slate), S-type (stony warm ochre-grey), M-type (metallic bronze-grey)
      // Kuiper Belt: Icy-slate, methane-blue, and reddish-amber tholin KBOs
      const typeRoll = (i + archIdx) % 10;
      if (isKuiperBelt) {
        if (typeRoll < 5) {
          color.setHSL(0.58, 0.24 + Math.random() * 0.15, 0.56 + Math.random() * 0.22);
        } else if (typeRoll < 8) {
          color.setHSL(0.54, 0.14, 0.48 + Math.random() * 0.18);
        } else {
          // Reddish tholin KBO (like Arrokoth / Sedna)
          color.setHSL(0.05, 0.38, 0.50 + Math.random() * 0.16);
        }
      } else {
        if (typeRoll < 4) {
          // C-type carbonaceous (cool slate-grey rock)
          color.setHSL(0.59, 0.12 + Math.random() * 0.08, 0.44 + Math.random() * 0.18);
        } else if (typeRoll < 8) {
          // S-type silicate stony (warm brownish-ochre rock)
          color.setHSL(0.08, 0.28 + Math.random() * 0.14, 0.54 + Math.random() * 0.20);
        } else {
          // M-type metallic nickel-iron (bright warm bronze-silver)
          color.setHSL(0.09, 0.18, 0.66 + Math.random() * 0.20);
        }
      }
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    targetGroup.add(mesh);
    instancedMeshes.push(mesh);
  });

  return instancedMeshes;
}

/**
 * Populates Saturn's Rings with 1,200 sculpted 3D Asteroid & Crystalline Ice-Rock Fragments
 * across all 6 geological archetypes, respecting the C Ring, B Ring, Cassini Division, A Ring, and Encke Gap.
 */
export function populateSaturnRing3DAsteroidFragments(
  targetGroup: THREE.Group,
  boulderShaderMat: THREE.ShaderMaterial,
  innerR: number,
  outerR: number,
  totalFragments = 1200
): THREE.InstancedMesh[] {
  const geometries = getSculptedAsteroidGeometries();
  const countPerArchetype = Math.floor(totalFragments / geometries.length);
  const instancedMeshes: THREE.InstancedMesh[] = [];

  const dummy = new THREE.Object3D();
  const boulderColor = new THREE.Color();

  geometries.forEach((geo, archIdx) => {
    const mesh = new THREE.InstancedMesh(geo, boulderShaderMat, countPerArchetype);
    mesh.frustumCulled = false;

    for (let i = 0; i < countPerArchetype; i++) {
      let t = Math.random();
      // Respect Cassini Division (0.635 - 0.695) and Encke Gap (0.875)
      if (t > 0.635 && t < 0.695 && Math.random() < 0.94) {
        t = 0.28 + Math.random() * 0.34;
      }
      if (Math.abs(t - 0.875) < 0.014) {
        t += 0.025;
      }

      const r = innerR + t * (outerR - innerR);
      const theta = Math.random() * Math.PI * 2;
      // Ultra-thin realistic ring plane vertical dispersion
      const gaussY = (Math.random() + Math.random() - 1.0) * 0.008;

      dummy.position.set(Math.cos(theta) * r, gaussY, Math.sin(theta) * r);
      dummy.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Proportional 3D ring fragment sizes: sleek from afar, crisp 3D rocks when zoomed in
      const sizeRoll = Math.random();
      const baseScale =
        sizeRoll > 0.88
          ? 0.0085 + Math.random() * 0.0055 // Larger 3D ring moonlets
          : sizeRoll > 0.50
            ? 0.0045 + Math.random() * 0.0040 // Medium 3D rocky/icy fragments
            : 0.0022 + Math.random() * 0.0024; // Fine 3D fragments

      dummy.scale.set(
        baseScale * (0.78 + Math.random() * 0.44),
        baseScale * (0.68 + Math.random() * 0.42),
        baseScale * (0.78 + Math.random() * 0.44)
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Ring composition color variation:
      // C-Ring: darker carbonaceous rock-ice; B-Ring: bright crystalline ice + ochre silicate rocks; A-Ring: slate-ice & rock
      const isCRing = t < 0.22;
      const isBRing = t >= 0.22 && t <= 0.635;
      const rockMix = (i + archIdx) % 5;

      if (isCRing) {
        boulderColor.setHSL(0.58, 0.16, 0.42 + Math.random() * 0.16);
      } else if (isBRing) {
        if (rockMix === 0) {
          // Warm ochre-brown rocky fragment
          boulderColor.setHSL(0.08, 0.30, 0.58 + Math.random() * 0.18);
        } else if (rockMix === 1) {
          // Cool slate-blue icy boulder
          boulderColor.setHSL(0.58, 0.28, 0.66 + Math.random() * 0.18);
        } else {
          // Bright crystalline water-ice boulder
          boulderColor.setHSL(0.10, 0.18, 0.78 + Math.random() * 0.18);
        }
      } else {
        // A-Ring icy-slate and stony boulders
        if (rockMix < 2) {
          boulderColor.setHSL(0.57, 0.24, 0.60 + Math.random() * 0.18);
        } else {
          boulderColor.setHSL(0.09, 0.22, 0.64 + Math.random() * 0.20);
        }
      }
      mesh.setColorAt(i, boulderColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    targetGroup.add(mesh);
    instancedMeshes.push(mesh);
  });

  return instancedMeshes;
}

/**
 * Builds a realistic, scientific 3D Volumetric Galaxy Group (Spiral, Barred Spiral, Elliptical, Sombrero Ring, or Irregular)
 * normalized to radius = 1.0 (scaled by the parent rootGroup in UniverseCanvas).
 */
export function createRealistic3DGalaxyGroup(body: CelestialBodyData): THREE.Group {
  const galaxyGroup = new THREE.Group();
  const softSprite = getSoftCircleParticleTexture();

  const starCount = 3800;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  const cCore = new THREE.Color('#fff7ed');
  const cBulge = new THREE.Color(body.secondaryColorHex || '#fbbf24');
  const cArm = new THREE.Color(body.primaryColorHex || '#60a5fa');
  const cHII = new THREE.Color(body.atmosphereColorHex || '#f472b6');
  const tempColor = new THREE.Color();

  const isElliptical = body.subType === 'galaxy_elliptical';
  const isIrregular = body.subType === 'galaxy_irregular';
  const isBarred = body.subType === 'galaxy_barred';
  const isSombrero = body.id === 'sombrero-galaxy';
  const isWhirlpool = body.id === 'whirlpool-galaxy';

  const armCount = body.id === 'milky-way' ? 4 : 2;
  const spiralWinding = isWhirlpool ? 4.4 : body.id === 'triangulum' ? 2.6 : 3.6;

  for (let i = 0; i < starCount; i++) {
    let x = 0;
    let y = 0;
    let z = 0;

    if (isElliptical) {
      // 3D De Vaucouleurs spheroidal distribution for M87 supergiant elliptical galaxy
      const r = Math.pow(Math.random(), 1.65) * 0.95;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta) * 1.12;
      y = r * Math.cos(phi) * 0.86;
      z = r * Math.sin(phi) * Math.sin(theta);

      tempColor.copy(cCore).lerp(cBulge, Math.min(1.0, r * 1.35));
    } else if (isSombrero) {
      // Sombrero Galaxy (M104): Huge luminous spheroidal bulge + crisp outer equatorial ring
      if (i < starCount * 0.42) {
        const r = Math.pow(Math.random(), 1.6) * 0.58;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        x = r * Math.sin(phi) * Math.cos(theta);
        y = r * Math.cos(phi) * 0.62;
        z = r * Math.sin(phi) * Math.sin(theta);
        tempColor.copy(cCore).lerp(cBulge, r * 1.4);
      } else {
        // Prominent symmetrical outer ring + thin disk
        const isOuterRing = Math.random() < 0.68;
        const r = isOuterRing
          ? 0.76 + (Math.random() - 0.5) * 0.18
          : 0.22 + Math.random() * 0.54;
        const theta = Math.random() * Math.PI * 2;
        x = Math.cos(theta) * r;
        z = Math.sin(theta) * r;
        y = (Math.random() - 0.5) * 0.032;
        if (isOuterRing && i % 6 === 0) {
          tempColor.copy(cHII);
        } else {
          tempColor.copy(cBulge).lerp(cArm, 0.45);
        }
      }
    } else if (isIrregular) {
      // Large Magellanic Cloud: Off-center stellar bar + single sweeping spiral arm + 30 Doradus Tarantula Nebula knot
      if (i < starCount * 0.45) {
        // Off-center stellar bar
        x = (Math.random() - 0.5) * 0.85;
        z = (Math.random() - 0.5) * 0.28 + x * 0.22;
        y = (Math.random() - 0.5) * 0.08;
        tempColor.copy(cCore).lerp(cArm, 0.5);
      } else if (i < starCount * 0.62) {
        // 30 Doradus (Tarantula Nebula) super-bright H-II star-forming complex
        const rKnot = Math.pow(Math.random(), 1.4) * 0.24;
        const a = Math.random() * Math.PI * 2;
        x = 0.34 + Math.cos(a) * rKnot;
        z = 0.18 + Math.sin(a) * rKnot;
        y = (Math.random() - 0.5) * 0.09;
        tempColor.copy(i % 2 === 0 ? cHII : cCore);
      } else {
        // Irregular sweeping arm & stellar cloud
        const r = 0.15 + Math.random() * 0.85;
        const angle = r * 2.8 + (Math.random() - 0.5) * 1.45;
        x = Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        y = (Math.random() - 0.5) * 0.12;
        tempColor.copy(cArm).lerp(cHII, Math.random() * 0.45);
      }
    } else {
      // Spiral & Barred Spiral Galaxies (Milky Way, Andromeda M31, Triangulum M33, Whirlpool M51)
      if (isWhirlpool && i > starCount * 0.88) {
        // Companion dwarf galaxy NGC 5195 at the tip of M51's spiral arm!
        const rComp = Math.pow(Math.random(), 1.5) * 0.22;
        const a = Math.random() * Math.PI * 2;
        x = 0.82 + Math.cos(a) * rComp;
        z = 0.46 + Math.sin(a) * rComp;
        y = (Math.random() - 0.5) * 0.07;
        tempColor.copy(cCore).lerp(new THREE.Color('#fbbf24'), 0.65);
      } else if (i < starCount * 0.22) {
        // Central Galactic Bulge & Bar
        const rBulge = Math.pow(Math.random(), 1.6) * 0.28;
        const a = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const barStretch = isBarred ? 1.65 : 1.05;
        x = rBulge * Math.sin(phi) * Math.cos(a) * barStretch;
        y = rBulge * Math.cos(phi) * 0.48;
        z = rBulge * Math.sin(phi) * Math.sin(a) * (isBarred ? 0.68 : 1.0);
        tempColor.copy(cCore).lerp(cBulge, rBulge / 0.28);
      } else {
        // Logarithmic Spiral Arms with H-II Nebulae & OB Associations
        const r = 0.14 + Math.pow(Math.random(), 0.92) * 0.88;
        const armIndex = i % armCount;
        const armBaseAngle = (armIndex / armCount) * Math.PI * 2;
        const scatter = (Math.random() + Math.random() - 1.0) * (0.28 + r * 0.26);
        const theta = armBaseAngle + r * spiralWinding + scatter;

        x = Math.cos(theta) * r;
        z = Math.sin(theta) * r;
        const diskThickness = 0.055 * (1.0 - r * 0.55);
        y = (Math.random() + Math.random() - 1.0) * diskThickness;

        // Color distribution along spiral arms
        const isNebulaKnot = Math.abs(scatter) < 0.09 && i % 5 === 0;
        if (isNebulaKnot) {
          tempColor.copy(cHII);
        } else {
          tempColor.copy(cBulge).lerp(cArm, Math.min(1.0, (r - 0.1) * 1.25));
        }
      }
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    map: softSprite,
    size: 0.68,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const galaxyPoints = new THREE.Points(geo, mat);
  galaxyGroup.add(galaxyPoints);

  // Special feature for Messier 87: 3D Relativistic Blue Synchrotron Plasma Jet from M87* Black Hole!
  if (body.id === 'm87-galaxy') {
    const jetCurve = new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.85, 0.92, 0.35)
    );
    const jetGeo = new THREE.TubeGeometry(jetCurve, 24, 0.018, 12, false);
    const jetMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });
    const jetMesh = new THREE.Mesh(jetGeo, jetMat);
    galaxyGroup.add(jetMesh);

    const counterJetCurve = new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.42, -0.46, -0.18)
    );
    const counterJetGeo = new THREE.TubeGeometry(counterJetCurve, 16, 0.01, 10, false);
    const counterJetMat = new THREE.MeshBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    galaxyGroup.add(new THREE.Mesh(counterJetGeo, counterJetMat));
  }

  return galaxyGroup;
}
