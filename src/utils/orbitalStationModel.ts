import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fetchCachedArrayBuffer, resolveModelAssetUrl } from './assetCdnCache';

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
   * Keeps any world position (camera, EVA astronaut, or spacecraft) strictly outside
   * the Orbital Station's 3D exterior hull envelope so nothing enters or clips inside modules.
   */
  enforceExteriorKeepOutWorld: (
    worldPos: THREE.Vector3,
    stationWorldScale: number,
    marginLocal?: number
  ) => boolean;
  /**
   * Legacy surface hook — returns false since the Orbital Station is exterior-only.
   */
  resolveSurfaceGroundWorld: (
    astronautWorldPos: THREE.Vector3,
    upDirWorld: THREE.Vector3,
    stationWorldScale: number,
    outHitWorldPos: THREE.Vector3
  ) => boolean;
  dispose: () => void;
}

const _invQuat = new THREE.Quaternion();
const _stationWorldOrigin = new THREE.Vector3();
const _localCheck = new THREE.Vector3();

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

  // Exterior EVA & Ship staging coordinates in open space outside the station hull (41.5 x 12.34 x 49.49 m)
  const walkSpawnLocal = new THREE.Vector3(-14.5, 6.8, 26.5);
  const shipApproachLocal = new THREE.Vector3(-21.5, 5.2, 29.5);

  // Subtle floodlighting so dorsal decks, modules, and solar arrays read cleanly in Earth eclipse too
  const floodLight = new THREE.PointLight('#e0f2fe', 0.0, 0.1, 0.0);
  floodLight.position.set(2.5, 9.5, 6.0);
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
    const stationUrl = resolveModelAssetUrl('orbital-station.glb');
    modelReadyPromise = new Promise<void>((resolve) => {
      const onGltfReady = (gltf: { scene: THREE.Group }) => {
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
      };

      const onGltfError = (err: unknown) => {
        console.warn('Falha ao carregar /models/orbital-station.glb:', err);
        resolve();
      };

      fetchCachedArrayBuffer(stationUrl)
        .then((buf) => {
          if (disposed) {
            resolve();
            return;
          }
          if (buf) {
            loader.parse(buf, '', onGltfReady, onGltfError);
          } else {
            loader.load(stationUrl, onGltfReady, undefined, onGltfError);
          }
        })
        .catch(() => {
          loader.load(stationUrl, onGltfReady, undefined, onGltfError);
        });
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
      floodLight.intensity = 3.2;
      floodLight.distance = Math.max(0.001, worldScale * 95);
      cupolaLight.intensity = 2.1;
      cupolaLight.distance = Math.max(0.001, worldScale * 24);
    } else {
      floodLight.intensity = 0;
      cupolaLight.intensity = 0;
    }
  };

  const enforceExteriorKeepOutWorld: OrbitalStationRefs['enforceExteriorKeepOutWorld'] = (
    worldPos,
    stationWorldScale,
    marginLocal = 1.6
  ) => {
    const scale = Math.max(1e-9, stationWorldScale || rootGroup.scale.x);
    _stationWorldOrigin.copy(rootGroup.position);
    if (rootGroup.parent) {
      _stationWorldOrigin.add(rootGroup.parent.position);
    }
    _invQuat.copy(rootGroup.quaternion).invert();
    _localCheck
      .subVectors(worldPos, _stationWorldOrigin)
      .applyQuaternion(_invQuat)
      .divideScalar(scale);

    // Quick bounding-radius reject so objects far from the station are never touched
    if (_localCheck.lengthSq() > 64 * 64) {
      return false;
    }

    let pushed = false;
    const pushOutOfBox = (hx: number, hy: number, hz: number) => {
      const dx = hx - Math.abs(_localCheck.x);
      const dy = hy - Math.abs(_localCheck.y);
      const dz = hz - Math.abs(_localCheck.z);
      if (dx > 0 && dy > 0 && dz > 0) {
        if (dx <= dy && dx <= dz) {
          _localCheck.x = (_localCheck.x >= 0 ? 1 : -1) * hx;
        } else if (dy <= dx && dy <= dz) {
          _localCheck.y = (_localCheck.y >= 0 ? 1 : -1) * hy;
        } else {
          _localCheck.z = (_localCheck.z >= 0 ? 1 : -1) * hz;
        }
        pushed = true;
      }
    };

    // 1. Main pressurized modules spine & radial airlock/nodes (exterior-only keep-out)
    pushOutOfBox(9.8 + marginLocal, 7.0 + marginLocal, 25.8 + marginLocal);
    // 2. Port & Starboard solar array truss wings
    pushOutOfBox(21.6 + marginLocal, 4.6 + marginLocal, 7.2 + marginLocal);

    if (pushed) {
      worldPos
        .copy(_localCheck)
        .multiplyScalar(scale)
        .applyQuaternion(rootGroup.quaternion)
        .add(_stationWorldOrigin);
    }
    return pushed;
  };

  const resolveSurfaceGroundWorld: OrbitalStationRefs['resolveSurfaceGroundWorld'] = () => {
    // Exterior-only station: never snap astronaut onto internal/deck mesh faces
    return false;
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
    stationFocusDistanceLocal: 58,
    beaconMeshes,
    floodLight,
    cupolaLight,
    modelReadyPromise,
    update,
    enforceExteriorKeepOutWorld,
    resolveSurfaceGroundWorld,
    dispose,
  };
}
