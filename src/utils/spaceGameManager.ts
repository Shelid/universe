import * as THREE from 'three';

export type GameObjectiveKind = 'ring' | 'crystal' | 'beacon';

export interface GameHudSnapshot {
  active: boolean;
  score: number;
  combo: number;
  wave: number;
  pilotRank: string;
  ringsCleared: number;
  ringsTotal: number;
  crystalsDestroyed: number;
  crystalsTotal: number;
  beaconsScanned: number;
  beaconsTotal: number;
  lastEventText: string;
  lastEventAgeSec: number;
  nearestObjectiveName: string;
  nearestObjectiveKind: GameObjectiveKind | null;
  nearestObjectiveDistUnits: number;
}

export interface GameEventCallbacks {
  onRingCleared?: () => void;
  onCrystalDestroyed?: () => void;
  onBeaconScanned?: () => void;
  onWaveCleared?: (wave: number) => void;
}

interface GameNodeEntity {
  id: number;
  kind: GameObjectiveKind;
  name: string;
  mesh: THREE.Object3D;
  completed: boolean;
  localOffset: THREE.Vector3;
  spinAxis: THREE.Vector3;
  spinSpeed: number;
  hitRadiusFactor: number;
}

export interface SpaceGameUpdateParams {
  dt: number;
  clockTime: number;
  active: boolean;
  playerPos: THREE.Vector3;
  playerScale: number;
  radarPulseActive: boolean;
  boltPositions: THREE.Vector3[];
  onConsumeBolt?: (boltIndex: number) => void;
  callbacks?: GameEventCallbacks;
}

export interface SpaceGameManager {
  rootGroup: THREE.Group;
  recenterSector: (centerPos: THREE.Vector3, orbitRadius: number, unitScale: number, advanceWave?: boolean) => void;
  resetGame: (centerPos: THREE.Vector3, orbitRadius: number, unitScale: number) => void;
  update: (params: SpaceGameUpdateParams) => GameHudSnapshot;
  getSnapshot: () => GameHudSnapshot;
  dispose: () => void;
}

function resolvePilotRank(score: number): string {
  if (score >= 8000) return 'Comandante Cósmico';
  if (score >= 4200) return 'Ás Interestelar';
  if (score >= 1600) return 'Piloto Espacial';
  return 'Cadete Orbital';
}

export function createSpaceGameManager(scene: THREE.Scene): SpaceGameManager {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'space-game-manager-root';
  rootGroup.visible = false;
  scene.add(rootGroup);

  const sectorOrigin = new THREE.Vector3();
  let currentUnitScale = 0.05;
  let score = 0;
  let combo = 1;
  let comboTimer = 0;
  let wave = 1;
  let lastEventText = 'Missão orbital pronta — atravesse portais e destrua cristais!';
  let lastEventAgeSec = 99;

  // Shared lightweight geometries & materials (minimizing GPU state switches)
  const ringTorusGeo = new THREE.TorusGeometry(1.0, 0.085, 10, 32);
  const ringInnerGeo = new THREE.RingGeometry(0.86, 0.96, 28);
  const crystalGeo = new THREE.IcosahedronGeometry(0.62, 0);
  const beaconCoreGeo = new THREE.OctahedronGeometry(0.45, 0);
  const beaconHaloGeo = new THREE.TorusGeometry(0.75, 0.035, 8, 24);

  const ringMatActive = new THREE.MeshBasicMaterial({
    color: '#22d3ee',
    transparent: true,
    opacity: 0.92,
  });
  const ringInnerMat = new THREE.MeshBasicMaterial({
    color: '#06b6d4',
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringMatNext = new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    transparent: true,
    opacity: 0.96,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: '#fb7185',
    emissive: '#e11d48',
    emissiveIntensity: 1.45,
    roughness: 0.25,
    metalness: 0.65,
    flatShading: true,
  });
  const beaconCoreMat = new THREE.MeshStandardMaterial({
    color: '#fcd34d',
    emissive: '#d97706',
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.85,
  });
  const beaconHaloMat = new THREE.MeshBasicMaterial({
    color: '#34d399',
    transparent: true,
    opacity: 0.85,
  });

  // Single-draw-call burst particle system (96 reusable sparks)
  const sparkCount = 96;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkColors = new Float32Array(sparkCount * 3);
  const sparkVelocities: THREE.Vector3[] = Array.from({ length: sparkCount }, () => new THREE.Vector3());
  const sparkLife = new Float32Array(sparkCount);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  rootGroup.add(sparkPoints);

  let sparkCursor = 0;
  const spawnBurst = (pos: THREE.Vector3, colorHex: string, scale: number) => {
    const col = new THREE.Color(colorHex);
    for (let i = 0; i < 20; i++) {
      const idx = sparkCursor % sparkCount;
      sparkCursor++;
      sparkPositions[idx * 3] = pos.x;
      sparkPositions[idx * 3 + 1] = pos.y;
      sparkPositions[idx * 3 + 2] = pos.z;
      sparkColors[idx * 3] = col.r;
      sparkColors[idx * 3 + 1] = col.g;
      sparkColors[idx * 3 + 2] = col.b;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = (12 + Math.random() * 24) * scale;
      sparkVelocities[idx].set(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.cos(phi) * spd,
        Math.sin(phi) * Math.sin(theta) * spd
      );
      sparkLife[idx] = 0.75 + Math.random() * 0.45;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  };

  const entities: GameNodeEntity[] = [];

  const clearEntities = () => {
    entities.forEach((ent) => {
      rootGroup.remove(ent.mesh);
    });
    entities.length = 0;
  };

  const buildWave = (centerPos: THREE.Vector3, orbitRadius: number, unitScale: number) => {
    clearEntities();
    sectorOrigin.copy(centerPos);
    currentUnitScale = Math.max(0.002, unitScale);

    const ringVisualRadius = currentUnitScale * 7.8;
    const crystalVisualScale = currentUnitScale * 2.4;
    const beaconVisualScale = currentUnitScale * 2.6;
    const safeOrbit = Math.max(orbitRadius, currentUnitScale * 48);

    // 5 Slalom Orbital Boost Rings
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 1.45 - 0.55;
      const dist = safeOrbit * (0.98 + (i % 2) * 0.12);
      const yLift = (i - 2) * currentUnitScale * 9.5;
      const offset = new THREE.Vector3(Math.cos(angle) * dist, yLift, Math.sin(angle) * dist);

      const group = new THREE.Group();
      group.position.copy(centerPos).add(offset);
      group.scale.setScalar(ringVisualRadius);
      // Aim portal tangent along orbital track
      group.lookAt(
        centerPos.x + Math.cos(angle + 0.35) * dist,
        centerPos.y + yLift + currentUnitScale * 3,
        centerPos.z + Math.sin(angle + 0.35) * dist
      );

      const outerTorus = new THREE.Mesh(ringTorusGeo, i === 0 ? ringMatNext : ringMatActive);
      const innerGlow = new THREE.Mesh(ringInnerGeo, ringInnerMat);
      group.add(outerTorus, innerGlow);
      group.traverse((o) => {
        o.frustumCulled = false;
      });
      rootGroup.add(group);

      entities.push({
        id: i + 1,
        kind: 'ring',
        name: `Portal Orbital #${i + 1}`,
        mesh: group,
        completed: false,
        localOffset: offset,
        spinAxis: new THREE.Vector3(0, 0, 1),
        spinSpeed: 0.9,
        hitRadiusFactor: 9.2,
      });
    }

    // 6 Shootable Crimson Energy Crystals
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + wave * 0.4;
      const dist = safeOrbit * (0.86 + (i % 3) * 0.14);
      const yLift = ((i % 3) - 1) * currentUnitScale * 12;
      const offset = new THREE.Vector3(Math.cos(angle) * dist, yLift, Math.sin(angle) * dist);

      const mesh = new THREE.Mesh(crystalGeo, crystalMat);
      mesh.position.copy(centerPos).add(offset);
      mesh.scale.setScalar(crystalVisualScale);
      mesh.frustumCulled = false;
      rootGroup.add(mesh);

      entities.push({
        id: 100 + i,
        kind: 'crystal',
        name: `Cristal Instável #${i + 1}`,
        mesh,
        completed: false,
        localOffset: offset,
        spinAxis: new THREE.Vector3(0.4 + (i % 2) * 0.3, 1.0, 0.2).normalize(),
        spinSpeed: 1.2 + i * 0.15,
        hitRadiusFactor: 4.8,
      });
    }

    // 3 Golden Science Telemetry Beacons
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.85;
      const dist = safeOrbit * 1.16;
      const yLift = (i - 1) * currentUnitScale * 14;
      const offset = new THREE.Vector3(Math.cos(angle) * dist, yLift, Math.sin(angle) * dist);

      const beaconGroup = new THREE.Group();
      beaconGroup.position.copy(centerPos).add(offset);
      beaconGroup.scale.setScalar(beaconVisualScale);
      const core = new THREE.Mesh(beaconCoreGeo, beaconCoreMat);
      const halo = new THREE.Mesh(beaconHaloGeo, beaconHaloMat);
      halo.rotation.x = Math.PI / 2.6;
      beaconGroup.add(core, halo);
      beaconGroup.traverse((o) => {
        o.frustumCulled = false;
      });
      rootGroup.add(beaconGroup);

      entities.push({
        id: 200 + i,
        kind: 'beacon',
        name: `Baliza Científica #${i + 1}`,
        mesh: beaconGroup,
        completed: false,
        localOffset: offset,
        spinAxis: new THREE.Vector3(0, 1, 0),
        spinSpeed: 1.55,
        hitRadiusFactor: 9.5,
      });
    }
  };

  const recenterSector: SpaceGameManager['recenterSector'] = (
    centerPos,
    orbitRadius,
    unitScale,
    advanceWave = false
  ) => {
    if (advanceWave) wave += 1;
    buildWave(centerPos, orbitRadius, unitScale);
    lastEventText = `Setor Onda ${wave} gerado — 5 Portais, 6 Cristais, 3 Balizas`;
    lastEventAgeSec = 0;
  };

  const resetGame: SpaceGameManager['resetGame'] = (centerPos, orbitRadius, unitScale) => {
    score = 0;
    combo = 1;
    comboTimer = 0;
    wave = 1;
    buildWave(centerPos, orbitRadius, unitScale);
    lastEventText = 'Missão reiniciada — Boa caçada espacial!';
    lastEventAgeSec = 0;
  };

  const bumpScore = (basePoints: number, label: string) => {
    const awarded = Math.round(basePoints * combo);
    score += awarded;
    combo = Math.min(8, combo + 1);
    comboTimer = 7.5;
    lastEventText = `+${awarded} pts (${label} · x${combo - 1})`;
    lastEventAgeSec = 0;
  };

  let snapshotCache: GameHudSnapshot = {
    active: false,
    score: 0,
    combo: 1,
    wave: 1,
    pilotRank: 'Cadete Orbital',
    ringsCleared: 0,
    ringsTotal: 5,
    crystalsDestroyed: 0,
    crystalsTotal: 6,
    beaconsScanned: 0,
    beaconsTotal: 3,
    lastEventText,
    lastEventAgeSec: 99,
    nearestObjectiveName: '',
    nearestObjectiveKind: null,
    nearestObjectiveDistUnits: 0,
  };

  const update: SpaceGameManager['update'] = ({
    dt,
    clockTime,
    active,
    playerPos,
    playerScale,
    radarPulseActive,
    boltPositions,
    onConsumeBolt,
    callbacks,
  }) => {
    rootGroup.visible = active;
    if (!active) {
      snapshotCache.active = false;
      return snapshotCache;
    }

    const safeDt = Math.min(dt, 0.06);
    currentUnitScale = Math.max(0.002, playerScale);
    sparkMat.size = Math.max(0.004, currentUnitScale * 1.45);
    lastEventAgeSec = Math.min(99, lastEventAgeSec + safeDt);

    if (comboTimer > 0) {
      comboTimer -= safeDt;
      if (comboTimer <= 0) combo = 1;
    }

    // Update burst sparks
    let anySparkAlive = false;
    for (let i = 0; i < sparkCount; i++) {
      if (sparkLife[i] > 0) {
        anySparkAlive = true;
        sparkLife[i] = Math.max(0, sparkLife[i] - safeDt);
        sparkPositions[i * 3] += sparkVelocities[i].x * safeDt;
        sparkPositions[i * 3 + 1] += sparkVelocities[i].y * safeDt;
        sparkPositions[i * 3 + 2] += sparkVelocities[i].z * safeDt;
        if (sparkLife[i] === 0) {
          sparkPositions[i * 3 + 1] = -9e7;
        }
      }
    }
    if (anySparkAlive) {
      sparkGeo.attributes.position.needsUpdate = true;
    }

    let ringsCleared = 0;
    let ringsTotal = 0;
    let crystalsDestroyed = 0;
    let crystalsTotal = 0;
    let beaconsScanned = 0;
    let beaconsTotal = 0;

    let nearestDist = Infinity;
    let nearestName = '';
    let nearestKind: GameObjectiveKind | null = null;

    let firstPendingRingFound = false;

    entities.forEach((ent) => {
      if (ent.kind === 'ring') ringsTotal++;
      else if (ent.kind === 'crystal') crystalsTotal++;
      else beaconsTotal++;

      if (ent.completed) {
        if (ent.kind === 'ring') ringsCleared++;
        else if (ent.kind === 'crystal') crystalsDestroyed++;
        else beaconsScanned++;
        return;
      }

      // Dynamic hover & spin animation
      ent.mesh.rotateOnAxis(ent.spinAxis, ent.spinSpeed * safeDt);
      if (ent.kind === 'beacon') {
        const pulse = 1 + Math.sin(clockTime * 3.8 + ent.id) * 0.1;
        ent.mesh.scale.setScalar(currentUnitScale * 2.6 * pulse);
      }

      if (ent.kind === 'ring' && ent.mesh instanceof THREE.Group) {
        const outer = ent.mesh.children[0] as THREE.Mesh | undefined;
        if (outer) {
          outer.material = !firstPendingRingFound ? ringMatNext : ringMatActive;
          firstPendingRingFound = true;
        }
      }

      const d = ent.mesh.position.distanceTo(playerPos);
      if (d < nearestDist) {
        nearestDist = d;
        nearestName = ent.name;
        nearestKind = ent.kind;
      }

      const hitDist = ent.hitRadiusFactor * currentUnitScale;

      if (ent.kind === 'ring' && d <= hitDist) {
        ent.completed = true;
        ent.mesh.visible = false;
        ringsCleared++;
        bumpScore(120, ent.name);
        spawnBurst(ent.mesh.position, '#22d3ee', currentUnitScale);
        callbacks?.onRingCleared?.();
      } else if (ent.kind === 'crystal') {
        let hit = d <= hitDist * 0.85;
        if (!hit && boltPositions.length > 0) {
          for (let b = 0; b < boltPositions.length; b++) {
            if (boltPositions[b].distanceTo(ent.mesh.position) <= currentUnitScale * 5.2) {
              hit = true;
              onConsumeBolt?.(b);
              break;
            }
          }
        }
        if (hit) {
          ent.completed = true;
          ent.mesh.visible = false;
          crystalsDestroyed++;
          bumpScore(150, ent.name);
          spawnBurst(ent.mesh.position, '#fb7185', currentUnitScale * 1.15);
          callbacks?.onCrystalDestroyed?.();
        }
      } else if (ent.kind === 'beacon') {
        const scanRange = radarPulseActive ? currentUnitScale * 48 : hitDist * 0.9;
        if (d <= scanRange) {
          ent.completed = true;
          ent.mesh.visible = false;
          beaconsScanned++;
          bumpScore(180, ent.name);
          spawnBurst(ent.mesh.position, '#34d399', currentUnitScale);
          callbacks?.onBeaconScanned?.();
        }
      }
    });

    // Auto-advance wave with big bonus once all targets are cleared!
    const totalDone = ringsCleared + crystalsDestroyed + beaconsScanned;
    const totalAll = ringsTotal + crystalsTotal + beaconsTotal;
    if (totalAll > 0 && totalDone === totalAll) {
      score += 500;
      wave += 1;
      lastEventText = `ONDA ${wave - 1} COMPLETA! +500 Bônus Cósmico!`;
      lastEventAgeSec = 0;
      const completedWave = wave - 1;
      buildWave(sectorOrigin, currentUnitScale * 56, currentUnitScale);
      callbacks?.onWaveCleared?.(completedWave);
    }

    snapshotCache = {
      active,
      score,
      combo,
      wave,
      pilotRank: resolvePilotRank(score),
      ringsCleared,
      ringsTotal,
      crystalsDestroyed,
      crystalsTotal,
      beaconsScanned,
      beaconsTotal,
      lastEventText,
      lastEventAgeSec,
      nearestObjectiveName: nearestName || 'Setor Completo',
      nearestObjectiveKind: nearestKind,
      nearestObjectiveDistUnits: Number.isFinite(nearestDist) ? nearestDist / currentUnitScale : 0,
    };

    return snapshotCache;
  };

  const dispose = () => {
    scene.remove(rootGroup);
    ringTorusGeo.dispose();
    ringInnerGeo.dispose();
    crystalGeo.dispose();
    beaconCoreGeo.dispose();
    beaconHaloGeo.dispose();
    ringMatActive.dispose();
    ringInnerMat.dispose();
    ringMatNext.dispose();
    crystalMat.dispose();
    beaconCoreMat.dispose();
    beaconHaloMat.dispose();
    sparkGeo.dispose();
    sparkMat.dispose();
  };

  return {
    rootGroup,
    recenterSector,
    resetGame,
    update,
    getSnapshot: () => snapshotCache,
    dispose,
  };
}
