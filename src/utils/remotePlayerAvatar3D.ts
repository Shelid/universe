import * as THREE from 'three';
import { getCharacterPreset, getSpacecraftPreset } from '../data/hangarCatalog';
import { CharacterVariantId, RemotePlayerState, SpacecraftVariantId } from '../types/astronomy';
import { SR7SpacecraftRefs } from './sr7SpacecraftModel';

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
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const prefix = mode === 'EVA' ? 'EVA · ' : '';
    const displayText = `${prefix}${callsign}`.slice(0, 22);
    ctx.font = '700 32px system-ui, -apple-system, Segoe UI, sans-serif';
    const textWidth = Math.min(390, Math.ceil(ctx.measureText(displayText).width));
    const pillW = Math.max(156, textWidth + 78);
    const pillH = 60;
    const padX = Math.floor((canvas.width - pillW) / 2);
    const padY = Math.floor((canvas.height - pillH) / 2);
    const r = 30;

    ctx.beginPath();
    ctx.moveTo(padX + r, padY);
    ctx.lineTo(padX + pillW - r, padY);
    ctx.quadraticCurveTo(padX + pillW, padY, padX + pillW, padY + r);
    ctx.lineTo(padX + pillW, padY + pillH - r);
    ctx.quadraticCurveTo(padX + pillW, padY + pillH, padX + pillW - r, padY + pillH);
    ctx.lineTo(padX + r, padY + pillH);
    ctx.quadraticCurveTo(padX, padY + pillH, padX, padY + pillH - r);
    ctx.lineTo(padX, padY + r);
    ctx.quadraticCurveTo(padX, padY, padX + r, padY);
    ctx.closePath();

    ctx.fillStyle = 'rgba(8, 15, 32, 0.82)';
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = accentHex;
    ctx.stroke();

    // Live online beacon dot
    ctx.beginPath();
    ctx.arc(padX + 28, canvas.height / 2, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = accentHex;
    ctx.fill();

    // Callsign label
    ctx.fillStyle = '#f8fafc';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayText, padX + 48, canvas.height / 2 + 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Full 4K Shared-Geometry Remote Player Avatar:
 * - Clones the EXACT 4K Spaceship GLTF model (`sr7.cloneExteriorForMultiplayer`) sharing 100% of GPU
 *   geometries & 4K PBR textures (0 MB extra VRAM!) so other players look identical to your own ship!
 * - Aligns twin plasma thruster flames & ventral orbital mining laser to the exact ship nozzles.
 * - Includes compact EVA astronaut suit model when friend switches to EVA mode.
 */
export function createRemotePlayerAvatar3D(
  initialState: RemotePlayerState,
  sourceShip?: SR7SpacecraftRefs | null
): RemotePlayerAvatarHandle {
  const rootGroup = new THREE.Group();
  const shipGroup = new THREE.Group();
  const evaGroup = new THREE.Group();
  rootGroup.add(shipGroup, evaGroup);

  const shipPreset = getSpacecraftPreset(initialState.shipId as SpacecraftVariantId);
  const charPreset = getCharacterPreset(initialState.charId as CharacterVariantId);

  // Mount the full 4K cloned Spaceship GLTF hull (0 MB extra VRAM!) or wait lazily if still streaming
  let cloned4kHull = sourceShip?.cloneExteriorForMultiplayer(shipPreset) ?? null;
  if (cloned4kHull) {
    shipGroup.add(cloned4kHull.group);
  }

  // Twin Aft Plasma Thruster Plumes aligned to the exact real Spaceship.glb nozzles (-0.463 / +0.468, 0.0024, 3.56)
  const outerPlumeGeo = new THREE.ConeGeometry(0.32, 2.35, 16, 1, true);
  outerPlumeGeo.rotateX(Math.PI / 2);
  outerPlumeGeo.translate(0, 0, 1.18);

  const innerCoreGeo = new THREE.ConeGeometry(0.16, 1.45, 12, 1, true);
  innerCoreGeo.rotateX(Math.PI / 2);
  innerCoreGeo.translate(0, 0, 0.72);

  const throatDiscGeo = new THREE.CircleGeometry(0.29, 16);

  const outerPlumeMat = new THREE.MeshBasicMaterial({
    color: shipPreset.plumePrimaryHex,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerCoreMat = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const throatGlowMat = new THREE.MeshBasicMaterial({
    color: shipPreset.plumeWarpHex,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const plumes: THREE.Group[] = [];
  [
    [-0.463, 0.0024, 3.56],
    [0.468, 0.0024, 3.56],
  ].forEach(([tx, ty, tz]) => {
    const tGrp = new THREE.Group();
    tGrp.position.set(tx, ty, tz);
    const outer = new THREE.Mesh(outerPlumeGeo, outerPlumeMat);
    const core = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    const throat = new THREE.Mesh(throatDiscGeo, throatGlowMat);
    throat.position.set(0, 0, 0.02);
    tGrp.add(outer, core, throat);
    shipGroup.add(tGrp);
    plumes.push(tGrp);
  });

  // EVA Astronaut Group (Compact articulated spacesuit when friend exits in EVA)
  const trimMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.65,
    roughness: 0.4,
  });
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

  // Remote Orbital Mining Laser Beam emanating from exact ventral mining turret (0, -0.34, -2.82)
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
  laserMesh.position.set(0, -0.34, -2.82);
  laserMesh.visible = false;
  shipGroup.add(laserMesh);

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
  labelSprite.position.set(0, 2.35, 0);
  labelSprite.scale.set(5.4, 1.0, 1);
  rootGroup.add(labelSprite);

  const _upAxis = new THREE.Vector3(0, 1, 0);
  const _beamDir = new THREE.Vector3();
  const _turretWorld = new THREE.Vector3();
  const _invShipQuat = new THREE.Quaternion();
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
      // Lazily attach the full 4K Spaceship clone once GLTF finished mounting
      if (!cloned4kHull && sourceShip) {
        const currentPreset = getSpacecraftPreset(state.shipId as SpacecraftVariantId);
        cloned4kHull = sourceShip.cloneExteriorForMultiplayer(currentPreset);
        if (cloned4kHull) {
          shipGroup.add(cloned4kHull.group);
        }
      }

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

      // Update variant paint & nametag dynamically if pilot changes ship, callsign, or mode
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
        cloned4kHull?.setVariant(nextShip);
        outerPlumeMat.color.set(state.boost ? nextShip.plumeWarpHex : nextShip.plumePrimaryHex);
        throatGlowMat.color.set(nextShip.plumeWarpHex);
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

      // Twin engine plume pulse (clean warm idle glow -> full afterburner -> cyan/warp boost flare)
      const isMoving = state.boost || state.thr > 0.03;
      const thrustZ = state.boost ? 2.45 : isMoving ? 0.55 + state.thr * 1.45 : 0.22;
      const flutter = 0.88 + 0.14 * Math.sin(clockTime * 34);
      outerPlumeMat.opacity = state.boost ? 0.92 : isMoving ? 0.35 + state.thr * 0.52 : 0.16;
      innerCoreMat.opacity = state.boost ? 0.96 : isMoving ? 0.45 + state.thr * 0.48 : 0.22;
      throatGlowMat.opacity = state.boost ? 0.95 : 0.42 + state.thr * 0.48;
      for (const p of plumes) {
        p.scale.set(state.boost ? 1.18 : 1.0, state.boost ? 1.18 : 1.0, thrustZ * flutter);
      }

      // Compact, readable floating nametag hovering smoothly over the 4K fuselage
      const distToCam = rootGroup.position.distanceTo(cameraPos);
      const tagWorldHeight = THREE.MathUtils.clamp(distToCam * 0.04, scale * 0.62, scale * 11);
      const localTagH = tagWorldHeight / scale;
      labelSprite.scale.set(localTagH * 5.33, localTagH, 1);
      labelSprite.position.set(0, Math.max(1.75, localTagH * 0.85 + 1.15), 0);

      // Remote Orbital Mining Laser Beam emanating cleanly from the ventral mining turret
      if (state.mining && !isEva && planetWorldPos && planetRadius > 0) {
        _turretWorld
          .set(0, -0.34, -2.82)
          .multiplyScalar(scale)
          .applyQuaternion(shipGroup.quaternion)
          .add(rootGroup.position);
        _beamDir.subVectors(planetWorldPos, _turretWorld);
        const distCenter = _beamDir.length();
        const beamLenWorld = Math.max(scale * 2, distCenter - planetRadius);
        if (distCenter > planetRadius * 0.9 && beamLenWorld < planetRadius * 7.5) {
          _beamDir.divideScalar(distCenter);
          laserMesh.visible = true;
          laserMat.color.set(state.miningColor || '#38bdf8');
          _invShipQuat.copy(shipGroup.quaternion).invert();
          _beamDir.applyQuaternion(_invShipQuat).normalize();
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
      cloned4kHull?.dispose();
      labelTex.dispose();
      labelMat.dispose();
      outerPlumeMat.dispose();
      innerCoreMat.dispose();
      throatGlowMat.dispose();
      trimMat.dispose();
      suitMat.dispose();
      visorMat.dispose();
      laserMat.dispose();
      outerPlumeGeo.dispose();
      innerCoreGeo.dispose();
      throatDiscGeo.dispose();
      torsoGeo.dispose();
      helmetGeo.dispose();
      visorGeo.dispose();
      packGeo.dispose();
      laserGeo.dispose();
    },
  };
}
