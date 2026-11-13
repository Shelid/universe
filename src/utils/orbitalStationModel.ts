import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface OrbitalStationRefs {
  rootGroup: THREE.Group;
  stationMeshGroup: THREE.Group;
  raycastMeshes: THREE.Mesh[];
  walkSpawnLocal: THREE.Vector3;
  shipApproachLocal: THREE.Vector3;
  stationFocusDistanceLocal: number;
  beaconMeshes: THREE.Mesh[];
  floodLight: THREE.PointLight;
  cupolaLight: THREE.PointLight;
  modelReadyPromise: Promise<void>;
  update: (clockTime: number, isCloseInspection?: boolean, worldScale?: number) => void;
  /**
   * Resolves the highest walkable/solid hull surface directly beneath an EVA astronaut
   * in world coordinates, returning null if the astronaut is outside the station envelope.
   */
  resolveSurfaceGroundWorld: (
    astronautWorldPos: THREE.Vector3,
    upDirWorld: THREE.Vector3,
    stationWorldScale: number,
    outHitWorldPos: THREE.Vector3
  ) => boolean;
  dispose: () => void;
}

const _raycaster = new THREE.Raycaster();
const _invMat = new THREE.Matrix4();
const _localCheck = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

/**
 * Loads the CC0 1.0 "Assembled Orbital Station (Space Station and Docking Bays)" GLB
 * (`/models/orbital-station.glb`, 41.5 x 12.34 x 49.49 m, 66.0k triangles, KHR_mesh_quantization),
 * centers its geometry at (0,0,0), tunes PBR/cupola glass materials, and exposes beacons + EVA deck snapping.
 */
export function createOrbitalStation3DGroup(): OrbitalStationRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'orbital-station-root';

  const stationMeshGroup = new THREE.Group();
  stationMeshGroup.name = 'orbital-station-glb-centered';
  rootGroup.add(stationMeshGroup);

  const raycastMeshes: THREE.Mesh[] = [];
  const beaconMeshes: THREE.Mesh[] = [];

  // Measured exact center offset & flat Laboratory dorsal walkway height (`hitY = 0.080`)
  const walkSpawnLocal = new THREE.Vector3(0, 0.08, 8.5);
  const shipApproachLocal = new THREE.Vector3(-12.5, 5.2, 16.5);

  // Subtle floodlighting so dorsal decks, modules, and solar arrays read cleanly in Earth eclipse too
  const floodLight = new THREE.PointLight('#e0f2fe', 0.0, 0.1, 0.0);
  floodLight.position.set(0, 7.5, 4.0);
  rootGroup.add(floodLight);

  const cupolaLight = new THREE.PointLight('#fbbf24', 0.0, 0.1, 0.0);
  cupolaLight.position.set(0, -4.1, 0.12);
  rootGroup.add(cupolaLight);

  // Docking / Airlock / Solar Wingtip navigation strobe beacons
  const beaconSpecs: Array<{ pos: [number, number, number]; color: string; r: number }> = [
    { pos: [-7.9, -1.65, 2.35], color: '#38bdf8', r: 0.24 }, // EVA Airlock Hatch beacon
    { pos: [0, 0.35, 24.4], color: '#10b981', r: 0.28 }, // Forward Crew Ferry nose
    { pos: [-20.4, 2.3, -0.28], color: '#ef4444', r: 0.30 }, // Port Truss wingtip (Red)
    { pos: [20.4, 2.3, -0.28], color: '#22c55e', r: 0.30 }, // Starboard Truss wingtip (Green)
    { pos: [0, 1.15, -24.5], color: '#f59e0b', r: 0.28 }, // Aft Inflatable Habitat ring
  ];

  const beaconGeo = new THREE.SphereGeometry(1, 10, 10);
  beaconSpecs.forEach((b, idx) => {
    const mat = new THREE.MeshBasicMaterial({
      color: b.color,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(beaconGeo, mat);
    mesh.position.set(b.pos[0], b.pos[1], b.pos[2]);
    mesh.scale.setScalar(b.r);
    mesh.frustumCulled = false;
    mesh.userData.phaseOffset = idx * 1.35;
    rootGroup.add(mesh);
    beaconMeshes.push(mesh);
  });

  // Subtle glowing docking corridor ring around the airlock hatch (-7.71, -2.05, 2.35)
  const dockRingGeo = new THREE.RingGeometry(0.62, 0.78, 28);
  const dockRingMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.48,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const airlockRing = new THREE.Mesh(dockRingGeo, dockRingMat);
  airlockRing.position.set(-7.85, -2.05, 2.35);
  airlockRing.rotation.y = Math.PI / 2;
  airlockRing.frustumCulled = false;
  rootGroup.add(airlockRing);

  let disposed = false;

  const disposeNode = (node: THREE.Object3D) => {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    node.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.geometry) geos.add(m.geometry);
      const list = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      list.forEach((mat) => mat && mats.add(mat));
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((mat) => mat.dispose());
  };

  const isNodeEnv = typeof window === 'undefined' || typeof document === 'undefined';
  let modelReadyPromise: Promise<void> = Promise.resolve();

  if (!isNodeEnv) {
    const loader = new GLTFLoader();
    modelReadyPromise = new Promise<void>((resolve) => {
      loader.load(
        '/models/orbital-station.glb',
        (gltf) => {
          if (disposed) {
            disposeNode(gltf.scene);
            resolve();
            return;
          }

          const loadedScene = gltf.scene;
          loadedScene.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(loadedScene);
          const center = new THREE.Vector3();
          box.getCenter(center);
          loadedScene.position.sub(center);

          loadedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.frustumCulled = false;
              if (mesh.geometry) {
                mesh.geometry.computeBoundingBox();
                mesh.geometry.computeBoundingSphere();
              }
              raycastMeshes.push(mesh);

              const matList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              matList.forEach((rawMat) => {
                const mat = rawMat as THREE.MeshStandardMaterial;
                if (!mat || !mat.isMeshStandardMaterial) return;
                const matName = (mat.name || '').toLowerCase();
                if (matName.includes('glass')) {
                  mat.color.set('#7dd3fc');
                  mat.transparent = true;
                  mat.opacity = 0.42;
                  mat.roughness = 0.08;
                  mat.metalness = 0.15;
                  mat.depthWrite = false;
                  mat.side = THREE.DoubleSide;
                  mat.envMapIntensity = 1.85;
                } else if (matName.includes('solar')) {
                  mat.metalness = 0.65;
                  mat.roughness = 0.22;
                  mat.envMapIntensity = 1.75;
                } else if (matName.includes('foil')) {
                  mat.metalness = 0.85;
                  mat.roughness = 0.28;
                  mat.envMapIntensity = 1.7;
                } else {
                  mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.45);
                }
                mat.needsUpdate = true;
              });
            }
          });

          stationMeshGroup.add(loadedScene);
          resolve();
        },
        undefined,
        () => {
          resolve();
        }
      );
    });
  }

  const update: OrbitalStationRefs['update'] = (
    clockTime,
    isCloseInspection = false,
    worldScale = 1
  ) => {
    beaconMeshes.forEach((b) => {
      const phase = (b.userData.phaseOffset as number) || 0;
      const blink = Math.pow(Math.max(0, Math.sin(clockTime * 3.2 + phase)), 8);
      const mat = b.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + blink * 0.65;
    });

    dockRingMat.opacity = 0.36 + 0.2 * Math.sin(clockTime * 2.4);

    if (isCloseInspection) {
      floodLight.intensity = 2.6;
      floodLight.distance = Math.max(0.001, worldScale * 75);
      cupolaLight.intensity = 1.8;
      cupolaLight.distance = Math.max(0.001, worldScale * 18);
    } else {
      floodLight.intensity = 0;
      cupolaLight.intensity = 0;
    }
  };

  const resolveSurfaceGroundWorld: OrbitalStationRefs['resolveSurfaceGroundWorld'] = (
    astronautWorldPos,
    upDirWorld,
    stationWorldScale,
    outHitWorldPos
  ) => {
    if (raycastMeshes.length === 0) return false;
    rootGroup.updateMatrixWorld(true);
    _invMat.copy(rootGroup.matrixWorld).invert();
    _localCheck.copy(astronautWorldPos).applyMatrix4(_invMat);

    // Quick bounding-box guard in unscaled station GLB coordinates (41.5 x 12.34 x 49.49 m)
    if (
      Math.abs(_localCheck.x) > 22.0 ||
      Math.abs(_localCheck.z) > 26.5 ||
      _localCheck.y < -8.0 ||
      _localCheck.y > 14.0
    ) {
      return false;
    }

    const castHeight = Math.max(1e-7, stationWorldScale * 3.8);
    const maxRayDist = Math.max(1e-6, stationWorldScale * 7.5);
    _rayOrigin.copy(astronautWorldPos).addScaledVector(upDirWorld, castHeight);
    _rayDir.copy(upDirWorld).negate().normalize();

    _raycaster.set(_rayOrigin, _rayDir);
    _raycaster.near = 0;
    _raycaster.far = maxRayDist;

    const hits = _raycaster.intersectObjects(raycastMeshes, false);
    if (hits.length === 0) return false;

    outHitWorldPos.copy(hits[0].point);
    return true;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeNode(rootGroup);
  };

  return {
    rootGroup,
    stationMeshGroup,
    raycastMeshes,
    walkSpawnLocal,
    shipApproachLocal,
    stationFocusDistanceLocal: 42,
    beaconMeshes,
    floodLight,
    cupolaLight,
    modelReadyPromise,
    update,
    resolveSurfaceGroundWorld,
    dispose,
  };
}
