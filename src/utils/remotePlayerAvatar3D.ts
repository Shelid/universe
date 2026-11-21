import * as THREE from 'three';
import { getCharacterPreset, getSpacecraftPreset } from '../data/hangarCatalog';
import { CharacterVariantId, RemotePlayerState, SpacecraftVariantId } from '../types/astronomy';

export interface RemotePlayerAvatarHandle {
  rootGroup: THREE.Group;
  updateVisuals: (
    state: RemotePlayerState,
    worldPos: THREE.Vector3,
    targetQuat: THREE.Quaternion,
    dt: number,
    clockTime: number,
    planetWorldPos: THREE.Vector3 | null,
    planetRadius: number,
    cameraPos: THREE.Vector3
  ) => void;
  dispose: () => void;
}

function createNametagTexture(callsign: string, accentHex: string, mode: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Sleek pill background
    const padX = 24;
    const padY = 18;
    const w = canvas.width - padX * 2;
    const h = canvas.height - padY * 2;
    const r = 30;
    ctx.beginPath();
    ctx.moveTo(padX + r, padY);
    ctx.lineTo(padX + w - r, padY);
    ctx.quadraticCurveTo(padX + w, padY, padX + w, padY + r);
    ctx.lineTo(padX + w, padY + h - r);
    ctx.quadraticCurveTo(padX + w, padY + h, padX + w - r, padY + h);
    ctx.lineTo(padX + r, padY + h);
    ctx.quadraticCurveTo(padX, padY + h, padX, padY + h - r);
    ctx.lineTo(padX, padY + r);
    ctx.quadraticCurveTo(padX, padY, padX + r, padY);
    ctx.closePath();

    ctx.fillStyle = 'rgba(10, 18, 36, 0.84)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accentHex;
    ctx.stroke();

    // Status beacon dot
    ctx.beginPath();
    ctx.arc(padX + 34, canvas.height / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = accentHex;
    ctx.fill();

    // Callsign label
    ctx.font = 'bold 34px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    const prefix = mode === 'EVA' ? 'EVA · ' : '';
    const displayText = `${prefix}${callsign}`.slice(0, 22);
    ctx.fillText(displayText, padX + 58, canvas.height / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lightweight, zero-VRAM-overhead 3D Remote Player Avatar:
 * - Sleek twin-engine delta starfighter (Spacecraft mode) tinted to the player's chosen Hangar ship
 * - Articulated EVA astronaut silhouette with glowing visor & jetpack plume (EVA mode)
 * - Live engine thruster flames, warp boost glow, and orbital mining laser beam!
 */
export function createRemotePlayerAvatar3D(initialState: RemotePlayerState): RemotePlayerAvatarHandle {
  const rootGroup = new THREE.Group();
  const shipGroup = new THREE.Group();
  const evaGroup = new THREE.Group();
  rootGroup.add(shipGroup, evaGroup);

  const shipPreset = getSpacecraftPreset(initialState.shipId as SpacecraftVariantId);
  const charPreset = getCharacterPreset(initialState.charId as CharacterVariantId);

  // Materials
  const hullMat = new THREE.MeshStandardMaterial({
    color: shipPreset.hullTintHex,
    metalness: 0.72,
    roughness: 0.28,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.65,
    roughness: 0.4,
  });
  const accentMat = new THREE.MeshBasicMaterial({
    color: shipPreset.accentHex,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: '#0ea5e9',
    emissive: shipPreset.emissiveTintHex,
    emissiveIntensity: 0.45,
    metalness: 0.9,
    roughness: 0.12,
  });
  const plumeMat = new THREE.MeshBasicMaterial({
    color: shipPreset.plumePrimaryHex,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Ship geometry (Forward = -Z, matching SR-7 local frame!)
  const bodyGeo = new THREE.ConeGeometry(0.46, 2.7, 6);
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.scale(1.25, 0.52, 1.0);
  const bodyMesh = new THREE.Mesh(bodyGeo, hullMat);
  shipGroup.add(bodyMesh);

  const canopyGeo = new THREE.SphereGeometry(0.32, 12, 10);
  canopyGeo.scale(0.82, 0.45, 1.65);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.18, -0.25);
  shipGroup.add(canopyMesh);

  const wingGeo = new THREE.BoxGeometry(3.15, 0.08, 1.12);
  const wingMesh = new THREE.Mesh(wingGeo, trimMat);
  wingMesh.position.set(0, -0.04, 0.35);
  shipGroup.add(wingMesh);

  const stripeGeo = new THREE.BoxGeometry(3.18, 0.04, 0.16);
  const stripeMesh = new THREE.Mesh(stripeGeo, accentMat);
  stripeMesh.position.set(0, 0.02, 0.75);
  shipGroup.add(stripeMesh);

  // Twin rear thruster nacelles + animated plasma plumes
  const nacelleGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.9, 12);
  nacelleGeo.rotateX(Math.PI / 2);
  const plumeGeo = new THREE.ConeGeometry(0.2, 1.35, 10);
  plumeGeo.rotateX(Math.PI / 2);
  plumeGeo.translate(0, 0, 0.68);

  const plumes: THREE.Mesh[] = [];
  [-0.52, 0.52].forEach((nx) => {
    const nac = new THREE.Mesh(nacelleGeo, trimMat);
    nac.position.set(nx, 0.02, 0.95);
    shipGroup.add(nac);

    const pMesh = new THREE.Mesh(plumeGeo, plumeMat);
    pMesh.position.set(nx, 0.02, 1.35);
    shipGroup.add(pMesh);
    plumes.push(pMesh);
  });

  // Wingtip navigation lights (Red Port, Green Starboard)
  const navGeo = new THREE.SphereGeometry(0.085, 8, 8);
  const portLight = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: '#f43f5e' }));
  portLight.position.set(-1.58, 0.0, 0.4);
  const stbdLight = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: '#10b981' }));
  stbdLight.position.set(1.58, 0.0, 0.4);
  shipGroup.add(portLight, stbdLight);

  // EVA Astronaut Group (Compact articulated spacesuit)
  const suitMat = new THREE.MeshStandardMaterial({
    color: charPreset.suitTintHex,
    roughness: 0.45,
    metalness: 0.25,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: '#0284c7',
    emissive: charPreset.suitEmissiveHex,
    emissiveIntensity: 0.6,
    metalness: 0.95,
    roughness: 0.08,
  });
  const torsoGeo = new THREE.CapsuleGeometry(0.22, 0.42, 6, 10);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  const helmetGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const helmet = new THREE.Mesh(helmetGeo, suitMat);
  helmet.position.set(0, 0.44, 0);
  const visorGeo = new THREE.SphereGeometry(0.16, 10, 8);
  visorGeo.scale(1.0, 0.78, 0.72);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.45, -0.1);
  const packGeo = new THREE.BoxGeometry(0.32, 0.42, 0.18);
  const pack = new THREE.Mesh(packGeo, trimMat);
  pack.position.set(0, 0.08, 0.22);
  evaGroup.add(torso, helmet, visor, pack);
  evaGroup.visible = false;

  // Remote Orbital Mining Laser Beam (Sleek precision beam matching local orbital extractor)
  const laserGeo = new THREE.CylinderGeometry(0.018, 0.036, 1.0, 8, 1, true);
  laserGeo.translate(0, 0.5, 0);
  const laserMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const laserMesh = new THREE.Mesh(laserGeo, laserMat);
  laserMesh.visible = false;
  rootGroup.add(laserMesh);

  // Floating 3D Callsign Nametag Sprite
  let labelCallsign = initialState.callsign;
  let labelMode = initialState.mode;
  let labelShipId = initialState.shipId;
  let labelTex = createNametagTexture(labelCallsign, shipPreset.accentHex, labelMode);
  const labelMat = new THREE.SpriteMaterial({
    map: labelTex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.position.set(0, 1.65, 0);
  labelSprite.scale.set(4.8, 1.05, 1);
  rootGroup.add(labelSprite);

  const _upAxis = new THREE.Vector3(0, 1, 0);
  const _beamDir = new THREE.Vector3();
  const _invRootQuat = new THREE.Quaternion();
  let initializedPos = false;

  return {
    rootGroup,
    updateVisuals: (
      state,
      worldPos,
      targetQuat,
      dt,
      clockTime,
      planetWorldPos,
      planetRadius,
      cameraPos
    ) => {
      if (!initializedPos) {
        rootGroup.position.copy(worldPos);
        shipGroup.quaternion.copy(targetQuat);
        evaGroup.quaternion.copy(targetQuat);
        initializedPos = true;
      } else {
        const snapDist = Math.max(0.5, state.shipScale * 180);
        if (rootGroup.position.distanceTo(worldPos) > snapDist) {
          rootGroup.position.copy(worldPos);
        } else {
          rootGroup.position.lerp(worldPos, Math.min(1, dt * 11));
        }
        shipGroup.quaternion.slerp(targetQuat, Math.min(1, dt * 11));
        evaGroup.quaternion.slerp(targetQuat, Math.min(1, dt * 11));
      }

      const scale = Math.max(1e-6, state.shipScale || 0.00018);
      rootGroup.scale.setScalar(scale);

      // Update variant colors & nametag if pilot changed ship, callsign, or mode
      if (
        state.callsign !== labelCallsign ||
        state.mode !== labelMode ||
        state.shipId !== labelShipId
      ) {
        labelCallsign = state.callsign;
        labelMode = state.mode;
        labelShipId = state.shipId;
        const nextShip = getSpacecraftPreset(state.shipId as SpacecraftVariantId);
        const nextChar = getCharacterPreset(state.charId as CharacterVariantId);
        hullMat.color.set(nextShip.hullTintHex);
        accentMat.color.set(nextShip.accentHex);
        canopyMat.emissive.set(nextShip.emissiveTintHex);
        plumeMat.color.set(state.boost ? nextShip.plumeWarpHex : nextShip.plumePrimaryHex);
        suitMat.color.set(nextChar.suitTintHex);
        visorMat.emissive.set(nextChar.suitEmissiveHex);

        labelTex.dispose();
        labelTex = createNametagTexture(labelCallsign, nextShip.accentHex, labelMode);
        labelMat.map = labelTex;
        labelMat.needsUpdate = true;
      }

      const isEva = state.mode === 'EVA';
      shipGroup.visible = !isEva;
      evaGroup.visible = isEva;

      // Engine plume pulse
      const thrustScale = state.boost ? 2.4 : Math.max(0.25, state.thr * 1.45);
      const flutter = 0.88 + 0.14 * Math.sin(clockTime * 34);
      plumeMat.opacity = state.boost ? 0.96 : Math.min(0.88, 0.22 + state.thr * 0.72);
      for (const p of plumes) {
        p.scale.set(1.0, 1.0, thrustScale * flutter);
      }

      // Keep nametag readable at any viewing distance!
      const distToCam = rootGroup.position.distanceTo(cameraPos);
      const tagWorldHeight = THREE.MathUtils.clamp(distToCam * 0.045, scale * 1.15, scale * 18);
      const localTagH = tagWorldHeight / scale;
      labelSprite.scale.set(localTagH * 4.55, localTagH, 1);
      labelSprite.position.set(0, Math.max(1.65, localTagH * 0.95), 0);

      // Remote Orbital Mining Laser Beam towards the anchor planet surface
      if (state.mining && !isEva && planetWorldPos && planetRadius > 0) {
        _beamDir.subVectors(planetWorldPos, rootGroup.position);
        const distCenter = _beamDir.length();
        const beamLenWorld = Math.max(scale * 2, distCenter - planetRadius);
        if (distCenter > planetRadius * 0.9 && beamLenWorld < planetRadius * 7.5) {
          _beamDir.divideScalar(distCenter);
          laserMesh.visible = true;
          laserMat.color.set(state.miningColor || '#38bdf8');
          _invRootQuat.copy(rootGroup.quaternion).invert();
          _beamDir.applyQuaternion(_invRootQuat).normalize();
          laserMesh.quaternion.setFromUnitVectors(_upAxis, _beamDir);
          laserMesh.scale.set(1.0, beamLenWorld / scale, 1.0);
        } else {
          laserMesh.visible = false;
        }
      } else {
        laserMesh.visible = false;
      }
    },
    dispose: () => {
      labelTex.dispose();
      labelMat.dispose();
      hullMat.dispose();
      trimMat.dispose();
      accentMat.dispose();
      canopyMat.dispose();
      plumeMat.dispose();
      suitMat.dispose();
      visorMat.dispose();
      laserMat.dispose();
      bodyGeo.dispose();
      canopyGeo.dispose();
      wingGeo.dispose();
      stripeGeo.dispose();
      nacelleGeo.dispose();
      plumeGeo.dispose();
      navGeo.dispose();
      torsoGeo.dispose();
      helmetGeo.dispose();
      visorGeo.dispose();
      packGeo.dispose();
      laserGeo.dispose();
    },
  };
}
