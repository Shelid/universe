import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CockpitSeatPosition, SpacecraftPreset } from '../types/astronomy';
import {
  fetchCachedArrayBuffer,
  fetchCachedAssetResponse,
  fetchCachedBlob,
  resolveModelAssetUrl,
} from './assetCdnCache';
import {
  buildShipInteriorCollider,
  ShipInteriorCollider,
} from './shipInteriorCollider';
import { CABIN_STATIONS } from './survivalEngine';

export interface SR7SpacecraftRefs {
  rootGroup: THREE.Group;
  hullGroup: THREE.Group;
  interiorGroup: THREE.Group;
  cockpitSeatAnchor: THREE.Object3D;
  pilotSeatAnchor: THREE.Group;
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
  muzzlePositionsLocal: [THREE.Vector3, THREE.Vector3];
  miningEmitterLocalPos: THREE.Vector3;
  clickableCockpitControls: THREE.Object3D[];
  interiorWalkerAnchor: THREE.Group;
  readonly interiorCollider: ShipInteriorCollider | null;
  modelReadyPromise: Promise<void>;
  setLandingGearDeployed: (deployed: boolean) => void;
  getFloorOffsetY: (withGear?: boolean) => number;
  setVariant: (preset: SpacecraftPreset) => void;
  dispose: () => void;
  updateAnimations: (params: {
    dt: number;
    clockTime: number;
    throttle: number;
    boostActive: boolean;
    isBraking?: boolean;
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
    isCockpitView?: boolean;
    cockpitSeat?: CockpitSeatPosition;
    shipScale?: number;
    driftAngleDeg?: number;
    radiatorsDeployed?: boolean;
    hullTempC?: number;
    walkingInside?: boolean;
    nearbyCabinStation?: string;
    miningActive?: boolean;
    miningColorHex?: string;
  }) => void;
}

const SEAT_LOCAL_POSITIONS: Record<CockpitSeatPosition, THREE.Vector3> = {
  // Commander Seat (Left, directly facing steering yoke Cube.055 & forward screens)
  LEFT: new THREE.Vector3(-0.1155, 0.082, -3.336),
  // Panoramic Center (Between Commander & Co-Pilot seats)
  CENTER: new THREE.Vector3(0.0, 0.086, -3.318),
  // Co-Pilot Seat (Right, directly facing illuminated keyboard & navigation monitors)
  RIGHT: new THREE.Vector3(0.1155, 0.082, -3.336),
};

interface MaterialTextureSpec {
  matIndex: number;
  matName: string;
  baseColorUri?: string;
  mrUri?: string;
  normalUri?: string;
  emissiveUri?: string;
}

// Flat blue normal maps (0.06 MB solid #8080ff) that do not need GPU texture memory
const FLAT_NORMAL_URIS = new Set([
  'tex_03.png',
  'tex_06.png',
  'tex_12.png',
  'tex_21.png',
  'tex_27.png',
  'tex_33.png',
  'tex_36.png',
  'tex_51.png',
  'tex_79.png',
]);

// Initial fallback PBR appearance while progressive textures stream in the background
function applyInitialMaterialFallback(std: THREE.MeshStandardMaterial, name: string): void {
  const lower = name.toLowerCase();
  if (name === 'Tail Light') {
    std.color.set('#38bdf8');
    std.emissive.set('#38bdf8');
    std.emissiveIntensity = 1.35;
    std.roughness = 0.2;
    std.metalness = 0.1;
  } else if (name === 'Neon' || name === 'Neon.002') {
    std.color.set('#22d3ee');
    std.emissive.set('#00f0ff');
    std.emissiveIntensity = 1.45;
    std.roughness = 0.18;
    std.metalness = 0.1;
  } else if (name === 'GREEN.001') {
    std.color.set('#22c55e');
    std.emissive.set('#22c55e');
    std.emissiveIntensity = 1.25;
  } else if (name === 'ScreenBorder.001') {
    std.color.set('#0ea5e9');
    std.emissive.set('#0ea5e9');
    std.emissiveIntensity = 0.85;
  } else if (lower.includes('screen') || name === 'pcKeyboard') {
    std.color.set('#38bdf8');
    std.emissive.set('#0284c7');
    std.emissiveIntensity = 0.95;
    std.roughness = 0.16;
    std.metalness = 0.08;
  } else if (name === 'White leather_inside') {
    std.color.set('#e2e8f0');
    std.roughness = 0.42;
    std.metalness = 0.08;
  } else if (name === 'Black Leather' || name === 'Black' || name === 'Sits_inside' || name === 'Belts_inside') {
    std.color.set('#1e293b');
    std.roughness = 0.48;
    std.metalness = 0.22;
  } else if (name === 'Red Plastic') {
    std.color.set('#dc2626');
    std.roughness = 0.32;
    std.metalness = 0.15;
  } else if (name === 'SShip_black parts' || name === 'SShip_dark metal' || name === 'NOMATERIAL_1') {
    std.color.set('#1e293b');
    std.roughness = 0.36;
    std.metalness = 0.78;
  } else if (name === 'Rear_metal' || name === 'freio') {
    std.color.set('#334155');
    std.roughness = 0.34;
    std.metalness = 0.82;
  } else if (name.startsWith('Interior') || name.startsWith('PISO') || name === 'BigBar_inside') {
    std.color.set('#475569');
    std.roughness = 0.38;
    std.metalness = 0.68;
  } else {
    // Exterior fuselage & wing armour plates (SShip, SShip_2, SShip_3, SShip_4, SShip_Metal, etc.)
    std.color.set('#94a3b8');
    std.roughness = 0.30;
    std.metalness = 0.76;
  }
}

/**
 * Loads and mounts the complete high-definition Spaceship.glb (exterior + native 3D interior,
 * dual seats, 5 computer screens, keyboard, floor window, and crystal-clear panoramic canopy).
 * Uses instant geometry parsing (`spaceship.bin`) followed by GPU-safe progressive texture streaming
 * so the 3D spaceship appears in <150ms without blocking or exhausting WebGL VRAM.
 * Local orientation: Nose = -Z, Thrusters = +Z, Up = +Y, Right = +X.
 */
export function createSR7Spacecraft3DGroup(options?: {
  maxAnisotropy?: number;
  onLoadProgress?: (loaded: number, total: number, detail: string) => void;
}): SR7SpacecraftRefs {
  const maxAniso = Math.max(1, options?.maxAnisotropy ?? 8);
  const onLoadProgress = options?.onLoadProgress;
  const rootGroup = new THREE.Group();
  rootGroup.name = 'spaceship-root';

  const hullGroup = new THREE.Group();
  hullGroup.name = 'spaceship-hull-group';
  rootGroup.add(hullGroup);

  const interiorGroup = new THREE.Group();
  interiorGroup.name = 'spaceship-interior-group';
  rootGroup.add(interiorGroup);

  const isNodeEnv = typeof window === 'undefined' || typeof document === 'undefined';
  let disposed = false;

  // Optical Canopy ShaderMaterial for all Glass meshes in Spaceship.glb:
  // - Exterior view (uInteriorView = 0.0): sleek dark-smoked aerospace glass dome with sky-blue Fresnel sheen
  // - Interior view (uInteriorView = 1.0): 100% crystal-clear windshield so stars & planets are unobstructed
  const canopyGlassMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uInteriorView: { value: 0.0 },
      uTintColor: { value: new THREE.Color('#38bdf8') },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uInteriorView;
      uniform vec3 uTintColor;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      void main() {
        vec3 N = normalize(vNormalView);
        if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(vViewPos);
        float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
        float fresnel = pow(1.0 - ndotv, 3.2);

        float centerAlpha = mix(0.56, 0.0, uInteriorView);
        float edgeAlpha = mix(0.88, 0.05, uInteriorView);
        float alpha = mix(centerAlpha, edgeAlpha, fresnel);

        vec3 darkSmokedBase = vec3(0.035, 0.075, 0.145);
        vec3 rimSpecular = mix(uTintColor * 0.85, vec3(0.85, 0.95, 1.0), 0.45);
        vec3 extColor = mix(darkSmokedBase, rimSpecular, fresnel * 0.82);
        vec3 intColor = mix(uTintColor, vec3(0.92, 0.98, 1.0), 0.6);
        vec3 glassColor = mix(extColor, intColor, uInteriorView);
        gl_FragColor = vec4(glassColor, alpha);
      }
    `,
  });

  const clickableCockpitControls: THREE.Object3D[] = [];

  // Wrapper scales raw Spaceship.glb (53.08 x 17.32 x 43.19) by 0.14 => length 7.43, wingspan 6.05
  const glbWrapper = new THREE.Group();
  glbWrapper.name = 'spaceship-glb-wrapper';
  glbWrapper.scale.setScalar(0.14);
  hullGroup.add(glbWrapper);

  const allocatedTextures = new Set<THREE.Texture>();

  const disposeNodeResources = (node: THREE.Object3D) => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    node.traverse((obj) => {
      const msh = obj as THREE.Mesh;
      if (msh.geometry) geometries.add(msh.geometry);
      const mats = Array.isArray(msh.material) ? msh.material : msh.material ? [msh.material] : [];
      mats.forEach((mt) => {
        if (!mt) return;
        materials.add(mt);
        Object.values(mt).forEach((val) => {
          if (val && (val as THREE.Texture).isTexture) {
            allocatedTextures.add(val as THREE.Texture);
          }
        });
      });
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((mt) => mt.dispose());
    allocatedTextures.forEach((tx) => {
      if (tx.image && typeof (tx.image as ImageBitmap).close === 'function') {
        try {
          (tx.image as ImageBitmap).close();
        } catch {
          // ignore
        }
      }
      tx.dispose();
    });
    allocatedTextures.clear();
  };

  let modelReadyPromise: Promise<void> = Promise.resolve();
  let interiorCollider: ShipInteriorCollider | null = null;
  const exteriorHullMaterials: THREE.MeshStandardMaterial[] = [];
  const tailLightMaterials: THREE.MeshStandardMaterial[] = [];
  const neonMaterials: THREE.MeshStandardMaterial[] = [];
  const screenMaterials: THREE.MeshStandardMaterial[] = [];
  const landingGearMeshes: THREE.Mesh[] = [];
  let isLandingGearDeployed = false;
  let floorMinYWithGear = -1.25;
  let floorMinYRetracted = -1.05;
  let activeVariantPreset: SpacecraftPreset | null = null;
  let nativeYokeNode: THREE.Object3D | null = null;
  const nativeYokeBaseQuat = new THREE.Quaternion();

  if (!isNodeEnv) {
    const loader = new GLTFLoader();
    const spaceshipBaseDir = `${resolveModelAssetUrl('spaceship').replace(/\/+$/, '')}/`;
    modelReadyPromise = new Promise<void>((resolve) => {
      Promise.all([
        fetchCachedAssetResponse(resolveModelAssetUrl('spaceship/spaceship.gltf')).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        fetchCachedArrayBuffer(resolveModelAssetUrl('spaceship/spaceship.bin')),
      ])
        .then(([rawGltf, binBuf]) => {
          if (disposed) {
            resolve();
            return;
          }

          let binBlobUrl: string | null = null;
          const cleanupBinBlob = () => {
            if (binBlobUrl) {
              URL.revokeObjectURL(binBlobUrl);
              binBlobUrl = null;
            }
          };

          // Extract material texture specs and build a geometry-only glTF JSON so
          // GLTFLoader.parse loads spaceship.bin (9.67 MB) from cache/CDN before awaiting all textures!
          const texSpecs: MaterialTextureSpec[] = [];
          const getUriForTexIndex = (texIdx?: number): string | undefined => {
            if (texIdx === undefined || !rawGltf.textures || !rawGltf.images) return undefined;
            const texDef = rawGltf.textures[texIdx];
            if (!texDef || texDef.source === undefined) return undefined;
            const imgDef = rawGltf.images[texDef.source];
            return imgDef?.uri;
          };

          const cleanBuffers = Array.isArray(rawGltf.buffers)
            ? rawGltf.buffers.map((bufDef: Record<string, any>, bIdx: number) => {
                if (bIdx === 0 && binBuf && typeof bufDef?.uri === 'string') {
                  binBlobUrl = URL.createObjectURL(new Blob([binBuf]));
                  return { ...bufDef, uri: binBlobUrl };
                }
                return bufDef;
              })
            : rawGltf.buffers;

          const geomOnlyGltf = {
            ...rawGltf,
            buffers: cleanBuffers,
            textures: undefined,
            images: undefined,
            materials: (rawGltf.materials || []).map((matDef: Record<string, any>, idx: number) => {
              const pbr = matDef.pbrMetallicRoughness || {};
              texSpecs.push({
                matIndex: idx,
                matName: matDef.name || `mat_${idx}`,
                baseColorUri: getUriForTexIndex(pbr.baseColorTexture?.index),
                mrUri: getUriForTexIndex(pbr.metallicRoughnessTexture?.index),
                normalUri: getUriForTexIndex(matDef.normalTexture?.index),
                emissiveUri: getUriForTexIndex(matDef.emissiveTexture?.index),
              });
              const cleanPbr = { ...pbr };
              delete cleanPbr.baseColorTexture;
              delete cleanPbr.metallicRoughnessTexture;
              const cleanMat: Record<string, any> = {
                ...matDef,
                pbrMetallicRoughness: cleanPbr,
                extras: { ...(matDef.extras || {}), __matIndex: idx },
              };
              delete cleanMat.normalTexture;
              delete cleanMat.emissiveTexture;
              delete cleanMat.occlusionTexture;
              return cleanMat;
            }),
          };
          delete geomOnlyGltf.textures;
          delete geomOnlyGltf.images;

          loader.parse(
            JSON.stringify(geomOnlyGltf),
            spaceshipBaseDir,
            (gltf) => {
              cleanupBinBlob();
              if (disposed) {
                disposeNodeResources(gltf.scene);
                resolve();
                return;
              }
              const loadedRoot = gltf.scene;
              const materialsByIndex = new Map<number, THREE.MeshStandardMaterial[]>();

              loadedRoot.traverse((child) => {
                if (child.name === 'Cube.055' || child.name === 'Cube055') {
                  nativeYokeNode = child;
                  nativeYokeBaseQuat.copy(child.quaternion);
                }
                if ((child as THREE.Mesh).isMesh) {
                  const mesh = child as THREE.Mesh;
                  mesh.frustumCulled = false;

                  const configureMaterial = (mat: THREE.Material): THREE.Material => {
                    if (!mat) return mat;
                    if (mat.name === 'Glass') {
                      return canopyGlassMat;
                    }
                    const std = mat as THREE.MeshStandardMaterial;
                    if (std.isMeshStandardMaterial) {
                      std.envMapIntensity = 0.85;
                      applyInitialMaterialFallback(std, std.name);

                      const matIdx = std.userData?.__matIndex;
                      if (typeof matIdx === 'number') {
                        const list = materialsByIndex.get(matIdx) || [];
                        if (!list.includes(std)) list.push(std);
                        materialsByIndex.set(matIdx, list);
                      }

                      if (std.name === 'Tail Light') {
                        tailLightMaterials.push(std);
                      } else if (std.name === 'Neon' || std.name === 'Neon.002') {
                        neonMaterials.push(std);
                      } else if (
                        std.name.toLowerCase().includes('screen') ||
                        std.name === 'pcKeyboard'
                      ) {
                        screenMaterials.push(std);
                      } else if (std.name.startsWith('SShip')) {
                        exteriorHullMaterials.push(std);
                      }
                      std.needsUpdate = true;
                    }
                    return std;
                  };

                  if (Array.isArray(mesh.material)) {
                    mesh.material = mesh.material.map(configureMaterial);
                  } else if (mesh.material) {
                    mesh.material = configureMaterial(mesh.material);
                  }
                  if (mesh.material === canopyGlassMat) {
                    mesh.renderOrder = 12;
                  }
                  // Retract/hide wheeled runway landing gear struts (Cube.010/012/013/019 & freio) during spaceflight;
                  // deploy them dynamically when parked on the Hangar landing pad!
                  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                  const cName = mesh.name || '';
                  const pName = mesh.parent?.name || '';
                  const isLandingGearNode =
                    cName.includes('010') ||
                    cName.includes('012') ||
                    cName.includes('013') ||
                    cName.includes('019') ||
                    pName.includes('010') ||
                    pName.includes('012') ||
                    pName.includes('013') ||
                    pName.includes('019');
                  const isBrakePad = mats.some((m) => m && m.name === 'freio');
                  const hasUnnamedEmptyMat = mats.some((m) => m && m.name === '');
                  if (hasUnnamedEmptyMat) {
                    mesh.visible = false;
                  } else if (isLandingGearNode || isBrakePad) {
                    landingGearMeshes.push(mesh);
                    mesh.visible = isLandingGearDeployed;
                  }
                }
              });

              // Align Spaceship.glb so Nose (-X raw) points to -Z, Tail (+X raw) points to +Z,
              // and center symmetry axis (z_raw = -0.335, y_raw = 10.00, x_raw = -2.65) sits at (0, 0, 0).
              loadedRoot.rotation.y = -Math.PI / 2;
              loadedRoot.position.set(-0.335, -10.0, 2.65);

              // Fix cockpit monitors & keyboard at 1:1 cosmic scale:
              // 1) In Spaceship.glb, the 4 forward monitors (Screen2.001, Screen3.001, Screen4.001, screen.001)
              //    were modeled with a paper-thin Solidify modifier whose back-facing layer (nx <= 0.1) is only
              //    millimeters behind the front display layer (nx > 0.1) and mapped to dark UV margins.
              //    At 1:1 cosmic scale (0.0000038), those back-faces z-fight through the front display.
              //    Stripping the back/rim triangles (nx <= 0.1) leaves a clean single-layer display surface.
              // 2) Remove duplicate coplanar backing triangles on Interior_metal 7 / ScreenBorder.001 / Interior_metal 6
              //    and nudge the screen meshes slightly toward the pilot (+X, +Y in glTF space).
              loadedRoot.updateMatrixWorld(true);
              const screenCentroids: Array<[number, number, number]> = [];
              const screenMeshes: THREE.Mesh[] = [];
              const backingMeshes: THREE.Mesh[] = [];
              const _vA = new THREE.Vector3();
              const _vB = new THREE.Vector3();
              const _vC = new THREE.Vector3();

              loadedRoot.traverse((obj) => {
                if (!(obj as THREE.Mesh).isMesh) return;
                const msh = obj as THREE.Mesh;
                const mat = Array.isArray(msh.material) ? msh.material[0] : msh.material;
                if (!mat) return;
                const mName = mat.name || '';
                const isScr = mName.toLowerCase().includes('screen') && mName !== 'ScreenBorder.001';
                if (isScr || mName === 'pcKeyboard') {
                  screenMeshes.push(msh);
                } else if (
                  mName === 'Interior_metal 7' ||
                  mName === 'ScreenBorder.001' ||
                  mName === 'Interior_metal 6'
                ) {
                  backingMeshes.push(msh);
                }
              });

              for (const sMesh of screenMeshes) {
                const mat = (Array.isArray(sMesh.material) ? sMesh.material[0] : sMesh.material) as THREE.MeshStandardMaterial;
                const mName = mat?.name || '';
                const geo = sMesh.geometry;
                const pos = geo.attributes.position;
                const norm = geo.attributes.normal;
                const idx = geo.index;
                if (!pos || !idx) continue;

                // Strip paper-thin Solidify back-faces on forward cockpit monitors
                const isForwardMonitor =
                  mName === 'Screen2.001' ||
                  mName === 'Screen3.001' ||
                  mName === 'Screen4.001' ||
                  mName === 'screen.001';
                if (isForwardMonitor && norm) {
                  const frontIndices: number[] = [];
                  for (let i = 0; i < idx.count; i += 3) {
                    const i0 = idx.getX(i);
                    const i1 = idx.getX(i + 1);
                    const i2 = idx.getX(i + 2);
                    const nx = (norm.getX(i0) + norm.getX(i1) + norm.getX(i2)) / 3;
                    if (nx > 0.1) {
                      frontIndices.push(i0, i1, i2);
                    }
                  }
                  if (frontIndices.length > 0 && frontIndices.length < idx.count) {
                    const cleanGeo = geo.clone();
                    cleanGeo.setIndex(frontIndices);
                    sMesh.geometry = cleanGeo;
                  }
                }

                // Record triangle centroids in loadedRoot space for backing-mesh deduplication
                const activeIdx = sMesh.geometry.index!;
                for (let i = 0; i < activeIdx.count; i += 3) {
                  _vA.fromBufferAttribute(pos, activeIdx.getX(i)).applyMatrix4(sMesh.matrix);
                  _vB.fromBufferAttribute(pos, activeIdx.getX(i + 1)).applyMatrix4(sMesh.matrix);
                  _vC.fromBufferAttribute(pos, activeIdx.getX(i + 2)).applyMatrix4(sMesh.matrix);
                  screenCentroids.push([
                    (_vA.x + _vB.x + _vC.x) / 3,
                    (_vA.y + _vB.y + _vC.y) / 3,
                    (_vA.z + _vB.z + _vC.z) / 3,
                  ]);
                }

                // Nudge forward monitor & keyboard surfaces slightly toward the pilot so they sit cleanly above the bezel
                if (isForwardMonitor || mName === 'pcKeyboard') {
                  sMesh.position.x += 0.025;
                  sMesh.position.y += 0.012;
                  sMesh.updateMatrix();
                }
              }

              if (screenCentroids.length > 0) {
                for (const bMesh of backingMeshes) {
                  if (Array.isArray(bMesh.material)) continue;
                  const geo = bMesh.geometry;
                  const pos = geo.attributes.position;
                  const idx = geo.index;
                  if (!pos || !idx) continue;
                  const keptIndices: number[] = [];
                  let removedCount = 0;
                  for (let i = 0; i < idx.count; i += 3) {
                    const i0 = idx.getX(i);
                    const i1 = idx.getX(i + 1);
                    const i2 = idx.getX(i + 2);
                    _vA.fromBufferAttribute(pos, i0).applyMatrix4(bMesh.matrix);
                    _vB.fromBufferAttribute(pos, i1).applyMatrix4(bMesh.matrix);
                    _vC.fromBufferAttribute(pos, i2).applyMatrix4(bMesh.matrix);
                    const cx = (_vA.x + _vB.x + _vC.x) / 3;
                    const cy = (_vA.y + _vB.y + _vC.y) / 3;
                    const cz = (_vA.z + _vB.z + _vC.z) / 3;
                    let isDup = false;
                    for (let k = 0; k < screenCentroids.length; k++) {
                      const sc = screenCentroids[k];
                      const dx = cx - sc[0];
                      const dy = cy - sc[1];
                      const dz = cz - sc[2];
                      if (dx * dx + dy * dy + dz * dz < 0.012) {
                        isDup = true;
                        break;
                      }
                    }
                    if (isDup) {
                      removedCount++;
                    } else {
                      keptIndices.push(i0, i1, i2);
                    }
                  }
                  if (removedCount > 0) {
                    const clonedGeo = geo.clone();
                    clonedGeo.setIndex(keptIndices);
                    bMesh.geometry = clonedGeo;
                  }
                }
              }

              glbWrapper.add(loadedRoot);

              // Measure exact local vertical bounds in hullGroup coordinates (independent of rootGroup world scale)
              const measureHullMinY = (showGear: boolean): number => {
                landingGearMeshes.forEach((m) => {
                  m.visible = showGear;
                });
                let minY = Infinity;
                const tmpBox = new THREE.Box3();
                const tmpMat = new THREE.Matrix4();
                const walkMinY = (obj: THREE.Object3D, parentMat: THREE.Matrix4) => {
                  obj.updateMatrix();
                  const localMat = new THREE.Matrix4().multiplyMatrices(parentMat, obj.matrix);
                  const msh = obj as THREE.Mesh;
                  if (msh.isMesh && msh.visible && msh.geometry) {
                    if (!msh.geometry.boundingBox) msh.geometry.computeBoundingBox();
                    if (msh.geometry.boundingBox) {
                      tmpBox.copy(msh.geometry.boundingBox).applyMatrix4(localMat);
                      if (tmpBox.min.y < minY) minY = tmpBox.min.y;
                    }
                  }
                  for (let c = 0; c < obj.children.length; c++) {
                    walkMinY(obj.children[c], localMat);
                  }
                };
                tmpMat.copy(glbWrapper.matrix);
                walkMinY(loadedRoot, tmpMat);
                return Number.isFinite(minY) ? minY : -1.1;
              };
              glbWrapper.updateMatrix();
              floorMinYWithGear = measureHullMinY(true);
              floorMinYRetracted = measureHullMinY(false);
              landingGearMeshes.forEach((m) => {
                m.visible = isLandingGearDeployed;
              });

              // Bake physical 3D collision mesh for cabin walkthrough strictly in hullGroup-local coordinates
              glbWrapper.updateMatrix();
              const hullRelMeshes: Array<{ mesh: THREE.Mesh; matrix: THREE.Matrix4 }> = [];
              const collectHullRelMeshes = (obj: THREE.Object3D, parentMat: THREE.Matrix4) => {
                obj.updateMatrix();
                const localToHull = new THREE.Matrix4().multiplyMatrices(parentMat, obj.matrix);
                const m = obj as THREE.Mesh;
                if (m.isMesh && m.visible) {
                  hullRelMeshes.push({ mesh: m, matrix: localToHull });
                }
                for (let c = 0; c < obj.children.length; c++) {
                  collectHullRelMeshes(obj.children[c], localToHull);
                }
              };
              collectHullRelMeshes(loadedRoot, glbWrapper.matrix);
              interiorCollider = buildShipInteriorCollider(
                hullRelMeshes,
                new THREE.Box3(
                  new THREE.Vector3(-0.65, -0.35, -3.95),
                  new THREE.Vector3(0.65, 0.45, -2.05)
                ),
                0.04
              );

              // Load ALL PBR textures completely BEFORE resolving modelReadyPromise
              // so the entire spaceship (exterior hull, cockpit screens & cabin) opens 100% textured!
              const textureCache = new Map<string, Promise<THREE.Texture | null>>();
              const loadResizedTexture = (
                uri: string,
                isSrgb: boolean,
                targetDim: number
              ): Promise<THREE.Texture | null> => {
                const cacheKey = `${uri}_${isSrgb ? 'srgb' : 'lin'}_${targetDim}`;
                const existing = textureCache.get(cacheKey);
                if (existing) return existing;

                const p = fetchCachedBlob(resolveModelAssetUrl(`spaceship/${uri}`))
                  .then((blob) => {
                    if (!blob || disposed) return null;
                    return createImageBitmap(blob, {
                      resizeWidth: targetDim,
                      resizeHeight: targetDim,
                      resizeQuality: 'high',
                    });
                  })
                  .then((bitmap) => {
                    if (!bitmap || disposed) {
                      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
                      return null;
                    }
                    const tex = new THREE.Texture(bitmap);
                    tex.flipY = false;
                    tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
                    tex.generateMipmaps = false;
                    tex.minFilter = THREE.LinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.anisotropy = maxAniso;
                    tex.needsUpdate = true;
                    allocatedTextures.add(tex);
                    return tex;
                  })
                  .catch(() => null);

                textureCache.set(cacheKey, p);
                return p;
              };

              // Prioritize exterior hull & cockpit screens first, then cabin interior materials
              const prioritizedSpecs = [...texSpecs].sort((a, b) => {
                const score = (s: MaterialTextureSpec) => {
                  const n = s.matName.toLowerCase();
                  if (n.includes('screen') || s.matName === 'pcKeyboard') return 0;
                  if (s.matName.startsWith('SShip') || s.matName === 'Rear_metal' || s.matName === 'freio') return 1;
                  return 2;
                };
                return score(a) - score(b);
              });

              const totalTextureSteps = Math.max(
                1,
                prioritizedSpecs.reduce((acc, spec) => {
                  const targetMats = materialsByIndex.get(spec.matIndex);
                  if (!targetMats || targetMats.length === 0) return acc;
                  const isScreen =
                    spec.matName.toLowerCase().includes('screen') || spec.matName === 'pcKeyboard';
                  let steps = spec.baseColorUri ? 1 : 0;
                  if (!isScreen) {
                    if (spec.mrUri) steps += 1;
                    if (spec.normalUri && !FLAT_NORMAL_URIS.has(spec.normalUri)) steps += 1;
                  }
                  return acc + steps;
                }, 0)
              );
              let completedTextureSteps = 0;
              onLoadProgress?.(0, totalTextureSteps, 'Geometria 3D da nave');

              let baseCursor = 0;
              let auxCursor = 0;
              const worker = async () => {
                // Pass 1: Load all BaseColor & Screen textures
                while (!disposed && baseCursor < prioritizedSpecs.length) {
                  const spec = prioritizedSpecs[baseCursor++];
                  const targetMats = materialsByIndex.get(spec.matIndex);
                  if (!targetMats || targetMats.length === 0 || !spec.baseColorUri) continue;

                  const isScreen =
                    spec.matName.toLowerCase().includes('screen') || spec.matName === 'pcKeyboard';
                  const isHull =
                    spec.matName.startsWith('SShip') ||
                    spec.matName === 'Rear_metal' ||
                    spec.matName === 'freio';
                  const baseDim = isScreen || isHull ? 1024 : 512;

                  const baseTex = await loadResizedTexture(spec.baseColorUri, true, baseDim);
                  if (baseTex && !disposed) {
                    targetMats.forEach((m) => {
                      const tintHex =
                        m.name.startsWith('SShip') &&
                        activeVariantPreset &&
                        activeVariantPreset.id !== 'sr7-vanguard'
                          ? activeVariantPreset.hullTintHex
                          : '#ffffff';
                      m.color.set(tintHex);
                      m.map = baseTex;
                      if (isScreen) {
                        m.emissive.set('#ffffff');
                        m.emissiveMap = baseTex;
                        m.emissiveIntensity = 0.65;
                      }
                      m.needsUpdate = true;
                    });
                  }
                  completedTextureSteps++;
                  onLoadProgress?.(
                    Math.min(completedTextureSteps, totalTextureSteps),
                    totalTextureSteps,
                    `Nave: ${spec.matName}`
                  );
                }

                // Pass 2: Load all Roughness/Metalness and Normal maps
                while (!disposed && auxCursor < prioritizedSpecs.length) {
                  const spec = prioritizedSpecs[auxCursor++];
                  const targetMats = materialsByIndex.get(spec.matIndex);
                  if (!targetMats || targetMats.length === 0) continue;

                  const isScreen =
                    spec.matName.toLowerCase().includes('screen') || spec.matName === 'pcKeyboard';
                  if (isScreen) continue;
                  const auxDim = 512;

                  if (spec.mrUri) {
                    const mrTex = await loadResizedTexture(spec.mrUri, false, auxDim);
                    if (mrTex && !disposed) {
                      targetMats.forEach((m) => {
                        m.roughness = 1.0;
                        m.metalness = 1.0;
                        m.roughnessMap = mrTex;
                        m.metalnessMap = mrTex;
                        m.needsUpdate = true;
                      });
                    }
                    completedTextureSteps++;
                    onLoadProgress?.(
                      Math.min(completedTextureSteps, totalTextureSteps),
                      totalTextureSteps,
                      `Nave PBR: ${spec.matName}`
                    );
                  }

                  if (spec.normalUri && !FLAT_NORMAL_URIS.has(spec.normalUri)) {
                    const normTex = await loadResizedTexture(spec.normalUri, false, auxDim);
                    if (normTex && !disposed) {
                      targetMats.forEach((m) => {
                        m.normalMap = normTex;
                        m.needsUpdate = true;
                      });
                    }
                    completedTextureSteps++;
                    onLoadProgress?.(
                      Math.min(completedTextureSteps, totalTextureSteps),
                      totalTextureSteps,
                      `Nave Normal: ${spec.matName}`
                    );
                  }
                }
              };

              const workers: Promise<void>[] = [];
              for (let w = 0; w < 6; w++) {
                workers.push(worker());
              }
              void Promise.all(workers).finally(() => {
                onLoadProgress?.(totalTextureSteps, totalTextureSteps, 'Nave 100% carregada');
                resolve();
              });
            },
            () => {
              cleanupBinBlob();
              resolve();
            }
          );
        })
        .catch(() => {
          resolve();
        });
    });
  }

  // Cabin Lighting placed inside the native Spaceship.glb bridge (decay = 0 for cosmic 1:1 scale invariance!)
  const interiorLight = new THREE.PointLight('#e0f2fe', 0.85, 5.5, 0);
  interiorLight.position.set(0, 0.16, -3.18);
  interiorGroup.add(interiorLight);

  const consoleGlowLight = new THREE.PointLight('#38bdf8', 0.55, 3.2, 0);
  consoleGlowLight.position.set(0, 0.05, -3.42);
  interiorGroup.add(consoleGlowLight);

  const rearLoungeLight = new THREE.PointLight('#bae6fd', 0.65, 4.2, 0);
  rearLoungeLight.position.set(0, 0.14, -2.82);
  interiorGroup.add(rearLoungeLight);

  // Pilot Eye Camera Anchor inside the native Spaceship.glb cabin (defaults to Commander Left Seat)
  const cockpitSeatAnchor = new THREE.Object3D();
  cockpitSeatAnchor.position.copy(SEAT_LOCAL_POSITIONS.LEFT);
  interiorGroup.add(cockpitSeatAnchor);

  // Seated 3D Pilot Character Anchor (placed in Commander Left Seat, scaled to fit native seat bucket)
  const pilotSeatAnchor = new THREE.Group();
  pilotSeatAnchor.name = 'spaceship-pilot-seat-anchor';
  pilotSeatAnchor.position.set(-0.1155, -0.012, -3.352);
  pilotSeatAnchor.scale.setScalar(0.68);
  interiorGroup.add(pilotSeatAnchor);

  // Free-walk cabin anchor (1:1 hullGroup-local coords so cabin physics collider matches directly)
  const interiorWalkerAnchor = new THREE.Group();
  interiorWalkerAnchor.name = 'spaceship-interior-walker-anchor';
  interiorGroup.add(interiorWalkerAnchor);

  // 3rd-Person Chase Camera Anchor behind & slightly above Spaceship
  const chaseCameraAnchor = new THREE.Object3D();
  chaseCameraAnchor.position.set(0, 1.65, 8.6);
  rootGroup.add(chaseCameraAnchor);

  // Forward Spotlights & Radar Pulse Ring (decay = 0 so cosmic scale never blows out intensity)
  const headlightLeftSpot = new THREE.SpotLight('#fef9c3', 0, 95, Math.PI * 0.16, 0.45, 0);
  headlightLeftSpot.position.set(-0.35, -0.05, -3.65);
  const leftTarget = new THREE.Object3D();
  leftTarget.position.set(-0.35, -0.08, -36);
  hullGroup.add(leftTarget);
  headlightLeftSpot.target = leftTarget;
  hullGroup.add(headlightLeftSpot);

  const headlightRightSpot = new THREE.SpotLight('#fef9c3', 0, 95, Math.PI * 0.16, 0.45, 0);
  headlightRightSpot.position.set(0.35, -0.05, -3.65);
  const rightTarget = new THREE.Object3D();
  rightTarget.position.set(0.35, -0.08, -36);
  hullGroup.add(rightTarget);
  headlightRightSpot.target = rightTarget;
  hullGroup.add(headlightRightSpot);

  const headlightBeamGroup = new THREE.Group();
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

  // Forward Cannon Muzzle Anchors
  const muzzleFlashGeo = new THREE.SphereGeometry(0.085, 8, 8);
  const muzzleFlashMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const leftMuzzleFlash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
  leftMuzzleFlash.position.set(-0.68, -0.04, -3.68);
  hullGroup.add(leftMuzzleFlash);

  const rightMuzzleFlash = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
  rightMuzzleFlash.position.set(0.68, -0.04, -3.68);
  hullGroup.add(rightMuzzleFlash);

  const muzzlePositionsLocal: [THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(-0.68, -0.04, -3.68),
    new THREE.Vector3(0.68, -0.04, -3.68),
  ];

  // Lightweight compatibility proxies for wingtips / nav stubs
  const yokeGroup = new THREE.Group();
  const throttleGroup = new THREE.Group();
  const leftWingTipGlow = new THREE.Mesh();
  leftWingTipGlow.visible = false;
  const rightWingTipGlow = new THREE.Mesh();
  rightWingTipGlow.visible = false;
  const leftAileron = new THREE.Mesh();
  leftAileron.visible = false;
  const rightAileron = new THREE.Mesh();
  rightAileron.visible = false;
  const radarDishGroup = new THREE.Group();
  const sensorTurretGroup = new THREE.Group();
  const strobeLightMesh = new THREE.Mesh();
  strobeLightMesh.visible = false;

  // === Realistic Twin Engine Exhaust Fire / Plasma Plumes, Mach Shock Diamonds & Dynamic Aft Light ===
  // Exact nozzle anchors measured from Spaceship.glb in hullGroup coordinates:
  // Left bell (-0.463, 0.0024, 3.53..3.715), Right bell (+0.468, 0.0024, 3.53..3.715)
  const createNozzleGlowTexture = (): THREE.CanvasTexture | null => {
    if (isNodeEnv) return null;
    const cvs = document.createElement('canvas');
    cvs.width = 128;
    cvs.height = 128;
    const ctx2d = cvs.getContext('2d');
    if (!ctx2d) return null;
    const grad = ctx2d.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.22, 'rgba(255, 224, 166, 0.95)');
    grad.addColorStop(0.48, 'rgba(255, 128, 36, 0.58)');
    grad.addColorStop(0.78, 'rgba(255, 64, 12, 0.16)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const nozzleGlowTex = createNozzleGlowTexture();

  const createPlumeConeGeo = (baseRad: number, tipRad: number): THREE.BufferGeometry => {
    const geo = new THREE.CylinderGeometry(tipRad, baseRad, 1.0, 28, 18, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);
    // Subtle supersonic underexpansion bell bulge near nozzle lip (z = 0.08..0.28)
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = THREE.MathUtils.clamp(pos.getZ(i), 0, 1);
      const bulge = 1.0 + 0.18 * Math.exp(-Math.pow((z - 0.14) / 0.12, 2));
      pos.setXYZ(i, x * bulge, y * bulge, z);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const plumeVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormalView;
    varying vec3 vViewPos;
    varying float vAlong;
    void main() {
      vUv = uv;
      vAlong = clamp(position.z, 0.0, 1.0);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewPos = -mvPos.xyz;
      vNormalView = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const outerPlumeUniforms = {
    uTime: { value: 0 },
    uThrust: { value: 0 },
    uBoost: { value: 0 },
    uAccentColor: { value: new THREE.Color('#38bdf8') },
  };

  const outerPlumeMat = new THREE.ShaderMaterial({
    uniforms: outerPlumeUniforms,
    vertexShader: plumeVertexShader,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrust;
      uniform float uBoost;
      uniform vec3 uAccentColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying float vAlong;

      void main() {
        float ang = vUv.x * 6.2831853;
        float speed = 13.0 + uThrust * 12.0 + uBoost * 18.0;
        float wave1 = sin(vAlong * 16.0 - uTime * speed + sin(ang * 3.0 + uTime * 7.0) * 0.9);
        float wave2 = cos(vAlong * 29.0 - uTime * (speed * 1.45) + cos(ang * 5.0 - uTime * 11.0) * 0.7);
        float turb = 0.65 + 0.22 * wave1 + 0.13 * wave2;

        // Feather cylinder silhouette edges smoothly so cone never looks polygonal
        float ndotv = abs(dot(normalize(vNormalView), normalize(vViewPos)));
        float radialFeather = pow(clamp(ndotv, 0.0, 1.0), 1.35);

        float rootFade = smoothstep(0.0, 0.045, vAlong);
        float tipCutoff = clamp(1.0 - vAlong * (0.94 + (1.0 - turb) * 0.18), 0.0, 1.0);
        float longFade = pow(tipCutoff, 1.42);

        // Multi-temperature realistic fire -> afterburner ionization
        vec3 whiteHot = vec3(1.0, 0.97, 0.90);
        vec3 amberFire = vec3(1.0, 0.56, 0.12);
        vec3 deepFlame = vec3(0.96, 0.22, 0.04);
        vec3 ionPlasma = mix(vec3(0.32, 0.78, 1.0), uAccentColor, 0.55);

        vec3 fireCol = mix(whiteHot, amberFire, smoothstep(0.02, 0.36, vAlong));
        fireCol = mix(fireCol, deepFlame, smoothstep(0.34, 0.88, vAlong));

        // Intense boost adds blue/accent ionization especially near core throat & edges
        float ionMask = uBoost * (0.48 + 0.35 * (1.0 - radialFeather));
        vec3 finalCol = mix(fireCol, mix(whiteHot, ionPlasma, smoothstep(0.08, 0.72, vAlong)), clamp(ionMask, 0.0, 0.85));

        float alpha = radialFeather * rootFade * longFade * turb * clamp(0.18 + uThrust * 0.95 + uBoost * 0.45, 0.0, 1.0);
        gl_FragColor = vec4(finalCol * (1.35 + uThrust * 0.65 + uBoost * 0.75), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const innerCoreUniforms = {
    uTime: { value: 0 },
    uThrust: { value: 0 },
    uBoost: { value: 0 },
    uCoreColor: { value: new THREE.Color('#7dd3fc') },
  };

  const innerCoreMat = new THREE.ShaderMaterial({
    uniforms: innerCoreUniforms,
    vertexShader: plumeVertexShader,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrust;
      uniform float uBoost;
      uniform vec3 uCoreColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewPos;
      varying float vAlong;

      void main() {
        float ndotv = abs(dot(normalize(vNormalView), normalize(vViewPos)));
        float radialCore = pow(clamp(ndotv, 0.0, 1.0), 1.6);

        // Supersonic standing compression waves ("Mach Shock Diamonds")
        float jitter = sin(uTime * 38.0) * 0.22 + cos(uTime * 23.0) * 0.14;
        float shockNode = pow(clamp(0.5 + 0.5 * sin(vAlong * 26.0 - 0.8 + jitter), 0.0, 1.0), 3.4);
        float coreFade = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.15);

        vec3 coreWhite = vec3(1.0, 0.98, 0.94);
        vec3 hotGold = vec3(1.0, 0.78, 0.38);
        vec3 boostTint = mix(vec3(0.52, 0.90, 1.0), uCoreColor, 0.5);
        vec3 baseCol = mix(hotGold, boostTint, clamp(uBoost * 0.85, 0.0, 0.9));
        vec3 col = mix(baseCol, coreWhite, shockNode * 0.85 + (1.0 - vAlong) * 0.35);

        float machGain = mix(0.45, 1.15, shockNode);
        float alpha = radialCore * coreFade * machGain * clamp(uThrust * 1.15 + uBoost * 0.5, 0.0, 1.0);
        gl_FragColor = vec4(col * (1.8 + shockNode * 1.2 + uBoost * 0.8), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const nozzleGlowMat = new THREE.MeshBasicMaterial({
    map: nozzleGlowTex,
    color: '#ffab5e',
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const nozzleGlowGeo = new THREE.PlaneGeometry(0.44, 0.44);
  const outerPlumeGeo = createPlumeConeGeo(0.228, 0.045);
  const innerCoreGeo = createPlumeConeGeo(0.125, 0.02);

  const createThrusterAssembly = (x: number, y: number, z: number) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);

    const outerMesh = new THREE.Mesh(outerPlumeGeo, outerPlumeMat);
    outerMesh.renderOrder = 14;
    grp.add(outerMesh);

    const innerMesh = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    innerMesh.renderOrder = 15;
    grp.add(innerMesh);

    // Inner combustion throat disc + nozzle lip optical halo
    const throatDisc = new THREE.Mesh(nozzleGlowGeo, nozzleGlowMat);
    throatDisc.position.set(0, 0, -0.02);
    throatDisc.scale.setScalar(0.86);
    throatDisc.renderOrder = 13;
    grp.add(throatDisc);

    const exitHalo = new THREE.Mesh(nozzleGlowGeo, nozzleGlowMat);
    exitHalo.position.set(0, 0, 0.22);
    exitHalo.scale.setScalar(1.38);
    exitHalo.renderOrder = 16;
    grp.add(exitHalo);

    hullGroup.add(grp);
    return { grp, outerMesh, innerMesh, throatDisc, exitHalo };
  };

  const leftThruster = createThrusterAssembly(-0.463, 0.0024, 3.56);
  const rightThruster = createThrusterAssembly(0.468, 0.0024, 3.56);
  const leftPlumeMesh = leftThruster.outerMesh;
  const rightPlumeMesh = rightThruster.outerMesh;
  const leftCoreMesh = leftThruster.innerMesh;
  const rightCoreMesh = rightThruster.innerMesh;

  // Dynamic Aft Exhaust Illumination Light (decay = 0 for Hangar 1:1 & cosmic flight scales)
  const aftExhaustLight = new THREE.PointLight('#ff8b3d', 0.4, 18, 0);
  aftExhaustLight.position.set(0, 0.03, 4.18);
  hullGroup.add(aftExhaustLight);

  // Hot Plasma Embers / Ion Sparks trailing out of both engines (single InstancedMesh)
  const ENGINE_EMBER_COUNT = 24;
  const engineEmberMat = new THREE.MeshBasicMaterial({
    color: '#ffba66',
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const engineEmberInstanced = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.015, 0),
    engineEmberMat,
    ENGINE_EMBER_COUNT
  );
  engineEmberInstanced.frustumCulled = false;
  engineEmberInstanced.visible = false;
  hullGroup.add(engineEmberInstanced);
  const _emberMat4 = new THREE.Matrix4();
  const _emberPos = new THREE.Vector3();
  const _emberQuat = new THREE.Quaternion();
  const _emberScale = new THREE.Vector3();

  // Deployable Thermal Radiator Wings on Dorsal Aft Hull (extend smoothly when radiatorsDeployed = true)
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    emissive: '#fb923c',
    emissiveIntensity: 0.25,
    roughness: 0.28,
    metalness: 0.85,
  });
  const radiatorGroup = new THREE.Group();
  radiatorGroup.name = 'spaceship-thermal-radiators';
  radiatorGroup.visible = false;
  const radGeo = new THREE.BoxGeometry(0.95, 0.025, 0.42);
  const leftRadiator = new THREE.Mesh(radGeo, radiatorMat);
  leftRadiator.position.set(-0.85, 0.22, -1.75);
  leftRadiator.rotation.set(0.12, 0.08, -0.22);
  const rightRadiator = new THREE.Mesh(radGeo, radiatorMat);
  rightRadiator.position.set(0.85, 0.22, -1.75);
  rightRadiator.rotation.set(0.12, -0.08, 0.22);
  radiatorGroup.add(leftRadiator, rightRadiator);
  hullGroup.add(radiatorGroup);

  // Ventral Gimballed Orbital Mining Laser Turret mounted under forward keel
  const miningTurretGroup = new THREE.Group();
  miningTurretGroup.name = 'spaceship-orbital-mining-turret';
  miningTurretGroup.position.set(0, -0.34, -2.82);

  const miningCollarMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.88,
    roughness: 0.25,
  });
  const miningCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.145, 0.14, 16),
    miningCollarMat
  );
  miningTurretGroup.add(miningCollar);

  const miningLensMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#38bdf8',
    emissiveIntensity: 0.45,
    roughness: 0.15,
    metalness: 0.35,
  });
  const miningLensMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 16, 12),
    miningLensMat
  );
  miningLensMesh.position.set(0, -0.055, 0);
  miningLensMesh.scale.set(1, 0.65, 1);
  miningTurretGroup.add(miningLensMesh);

  const miningRingMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const miningRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.012, 8, 24),
    miningRingMat
  );
  miningRingMesh.rotation.x = Math.PI / 2;
  miningRingMesh.position.set(0, -0.04, 0);
  miningTurretGroup.add(miningRingMesh);
  hullGroup.add(miningTurretGroup);
  const miningEmitterLocalPos = new THREE.Vector3(0, -0.40, -2.82);

  // Subtle Holographic Station Markers inside Walkable Bridge (Galley, Bunk, Reactor/O2, Airlock)
  const cabinStationGroup = new THREE.Group();
  cabinStationGroup.name = 'spaceship-cabin-stations';
  cabinStationGroup.visible = false;
  const cabinStationMeshes: Array<{ id: string; ring: THREE.Mesh; mat: THREE.MeshBasicMaterial }> = [];
  const stationRingGeo = new THREE.RingGeometry(0.036, 0.048, 24);
  stationRingGeo.rotateX(-Math.PI / 2);
  const stationBeaconGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.075, 12);
  CABIN_STATIONS.forEach((st) => {
    const ringMat = new THREE.MeshBasicMaterial({
      color: st.accentHex,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(stationRingGeo, ringMat);
    ring.position.set(st.localPos[0], -0.078, st.localPos[2]);
    const beacon = new THREE.Mesh(stationBeaconGeo, ringMat);
    beacon.position.set(0, 0.055, 0);
    ring.add(beacon);
    cabinStationGroup.add(ring);
    cabinStationMeshes.push({ id: st.id, ring, mat: ringMat });
  });
  interiorGroup.add(cabinStationGroup);

  const dummyCanvas = isNodeEnv
    ? ({ width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement)
    : document.createElement('canvas');
  const dummyMat = new THREE.MeshBasicMaterial();

  const _yokeAnimEuler = new THREE.Euler();
  const _yokeAnimQuat = new THREE.Quaternion();
  const _worldAxisZ = new THREE.Vector3(0, 0, 1);
  const _emberColorTmp = new THREE.Color();
  const _lightFireColor = new THREE.Color('#ff8a34');
  const _lightBoostColor = new THREE.Color('#7dd3fc');
  let radiatorDeployBlend = 0;
  let plumeThrustSmooth = 0.04;
  let plumeBoostSmooth = 0;

  const updateAnimations: SR7SpacecraftRefs['updateAnimations'] = ({
    dt,
    clockTime,
    throttle,
    boostActive,
    isBraking = false,
    headlightsOn,
    interiorLightsOn,
    pitchInput,
    yawInput,
    radarPulseAgeSec,
    muzzleFlashAlpha,
    isCockpitView = false,
    cockpitSeat = 'LEFT',
    shipScale = 1,
    radiatorsDeployed = false,
    hullTempC = 24,
    walkingInside = false,
    nearbyCabinStation = 'NONE',
    miningActive = false,
    miningColorHex = '#38bdf8',
  }) => {
    // Smoothly move cockpit eye anchor between Commander (LEFT), Panoramic (CENTER), and Co-Pilot (RIGHT)
    const targetSeatPos = SEAT_LOCAL_POSITIONS[cockpitSeat] || SEAT_LOCAL_POSITIONS.LEFT;
    cockpitSeatAnchor.position.lerp(targetSeatPos, Math.min(1, dt * 14));

    // Animate native Spaceship.glb steering yoke (Cube.055)
    if (nativeYokeNode) {
      _yokeAnimEuler.set(0, 0, -pitchInput * 0.18, 'XYZ');
      _yokeAnimQuat.setFromEuler(_yokeAnimEuler);
      nativeYokeNode.quaternion.copy(nativeYokeBaseQuat).multiply(_yokeAnimQuat);
    }

    // Crystal-clear canopy glass adaptation
    canopyGlassMat.uniforms.uInteriorView.value = isCockpitView ? 1.0 : 0.0;
    canopyGlassMat.uniforms.uTintColor.value.set(isCockpitView ? '#e0f2fe' : '#7dd3fc');

    // Modulate native Tail Light + Twin Volumetric Engine Plumes, Mach Shock Diamonds & Aft Light
    const absT = THREE.MathUtils.clamp(Math.abs(throttle), 0, 1.25);
    const targetBoost = boostActive && !isBraking ? 1 : 0;
    const targetThrustVis = isBraking ? Math.min(0.06, absT * 0.2) : absT;
    plumeThrustSmooth = THREE.MathUtils.lerp(
      plumeThrustSmooth,
      targetThrustVis,
      Math.min(1, dt * 7.5)
    );
    plumeBoostSmooth = THREE.MathUtils.lerp(
      plumeBoostSmooth,
      targetBoost,
      Math.min(1, dt * (targetBoost > plumeBoostSmooth ? 6.5 : 4.2))
    );

    const flicker =
      0.91 +
      0.055 * Math.sin(clockTime * 43.0) +
      0.035 * Math.cos(clockTime * 71.0);
    const tailIntensity =
      (boostActive ? 3.2 : 1.05 + plumeThrustSmooth * 1.75) * flicker;
    tailLightMaterials.forEach((m) => {
      m.emissiveIntensity = tailIntensity;
    });

    const scaleFactor = Math.max(0.0000025, shipScale);
    const effectiveBurn = Math.max(plumeThrustSmooth, plumeBoostSmooth * 0.85);
    const plumeLength =
      (0.36 + effectiveBurn * 3.15 + plumeBoostSmooth * 2.45) * (0.94 + flicker * 0.06);
    const plumeRad =
      (0.88 + effectiveBurn * 0.36 + plumeBoostSmooth * 0.25) * (0.95 + flicker * 0.05);

    outerPlumeUniforms.uTime.value = clockTime;
    outerPlumeUniforms.uThrust.value = effectiveBurn;
    outerPlumeUniforms.uBoost.value = plumeBoostSmooth;
    innerCoreUniforms.uTime.value = clockTime;
    innerCoreUniforms.uThrust.value = effectiveBurn;
    innerCoreUniforms.uBoost.value = plumeBoostSmooth;

    const nozzleGlowAlpha =
      (0.28 + effectiveBurn * 0.62 + plumeBoostSmooth * 0.25) * flicker;
    nozzleGlowMat.opacity = Math.min(0.98, nozzleGlowAlpha);
    nozzleGlowMat.color.lerpColors(_lightFireColor, _lightBoostColor, plumeBoostSmooth * 0.72);

    const gimbalPitch = THREE.MathUtils.clamp((pitchInput || 0) * 0.065, -0.09, 0.09);
    const gimbalYaw = THREE.MathUtils.clamp(-(yawInput || 0) * 0.065, -0.09, 0.09);
    const thrusters = [leftThruster, rightThruster];
    for (let ti = 0; ti < thrusters.length; ti++) {
      const th = thrusters[ti];
      th.grp.visible = !isCockpitView;
      th.grp.rotation.set(gimbalPitch, gimbalYaw, 0);
      th.outerMesh.scale.set(plumeRad, plumeRad, plumeLength);
      th.innerMesh.scale.set(
        plumeRad * (0.85 + plumeBoostSmooth * 0.2),
        plumeRad * (0.85 + plumeBoostSmooth * 0.2),
        plumeLength * 0.84
      );
      const throatSc = 0.78 + effectiveBurn * 0.36;
      th.throatDisc.scale.setScalar(throatSc);
      const haloSc = (0.72 + effectiveBurn * 0.85 + plumeBoostSmooth * 0.45) * flicker;
      th.exitHalo.scale.setScalar(haloSc);
      th.exitHalo.visible = effectiveBurn > 0.025;
    }

    // Dynamic flickering PointLight behind nozzles illuminating aft wings, hull & hangar pad
    const lightIntensity =
      (0.32 + effectiveBurn * 3.1 + plumeBoostSmooth * 2.2) * flicker;
    aftExhaustLight.intensity = isCockpitView ? lightIntensity * 0.35 : lightIntensity;
    aftExhaustLight.distance = scaleFactor * (10 + effectiveBurn * 11 + plumeBoostSmooth * 8);
    aftExhaustLight.color.lerpColors(_lightFireColor, _lightBoostColor, plumeBoostSmooth * 0.78);

    // Hot exhaust plasma embers/sparks streaming backward when accelerating or boosting
    const showEmbers = !isCockpitView && effectiveBurn > 0.14;
    engineEmberInstanced.visible = showEmbers;
    if (showEmbers) {
      _emberColorTmp.lerpColors(
        _lightFireColor,
        _lightBoostColor,
        plumeBoostSmooth * 0.8
      );
      engineEmberMat.color.copy(_emberColorTmp);
      engineEmberMat.opacity = Math.min(0.95, 0.35 + effectiveBurn * 0.65);
      const sparkSpeedBase = 1.65 + effectiveBurn * 1.9 + plumeBoostSmooth * 2.4;
      for (let ei = 0; ei < ENGINE_EMBER_COUNT; ei++) {
        const isLeft = ei % 2 === 0;
        const nozzleX = isLeft ? -0.463 : 0.468;
        const spdJitter = 0.72 + ((ei * 7) % 11) * 0.075;
        const phase = (ei * 0.6180339887) % 1;
        const life = (clockTime * sparkSpeedBase * spdJitter + phase) % 1;
        const angle = ei * 2.39996 + clockTime * (3.2 + (ei % 4) * 1.1);
        const spread = (0.045 + life * 0.16) * (0.75 + 0.45 * Math.sin(ei * 4.1 + clockTime * 5.0));
        const zSpan = 3.74 + life * Math.max(1.4, plumeLength * 1.08);
        _emberPos.set(
          nozzleX + Math.cos(angle) * spread,
          0.0024 + Math.sin(angle) * spread,
          zSpan
        );
        _emberQuat.setFromAxisAngle(_worldAxisZ, angle);
        const emberSc = (1 - life) * (0.45 + ((ei % 3) * 0.24) + effectiveBurn * 0.45);
        _emberScale.set(emberSc * 0.55, emberSc * 0.55, emberSc * 3.1);
        _emberMat4.compose(_emberPos, _emberQuat, _emberScale);
        engineEmberInstanced.setMatrixAt(ei, _emberMat4);
      }
      engineEmberInstanced.instanceMatrix.needsUpdate = true;
    }

    // Cabin interior lights (decay = 0 so intensity is invariant across 1:1 cosmic scales)
    interiorLight.intensity = interiorLightsOn ? (isCockpitView ? 0.95 : 0.45) : 0.15;
    interiorLight.distance = scaleFactor * 6.5;
    consoleGlowLight.intensity = interiorLightsOn ? (isCockpitView ? 0.65 : 0.25) : 0.12;
    consoleGlowLight.distance = scaleFactor * 3.8;
    rearLoungeLight.intensity = interiorLightsOn ? (isCockpitView ? 0.75 : 0.35) : 0.1;
    rearLoungeLight.distance = scaleFactor * 5.0;

    // Forward Spotlights (no volumetric fog cones in vacuum space)
    headlightLeftSpot.intensity = headlightsOn ? 1.8 : 0;
    headlightRightSpot.intensity = headlightsOn ? 1.8 : 0;
    headlightLeftSpot.distance = scaleFactor * 95;
    headlightRightSpot.distance = scaleFactor * 95;
    headlightBeamGroup.visible = false;

    // Muzzle flash
    muzzleFlashMat.opacity = muzzleFlashAlpha;
    leftMuzzleFlash.visible = muzzleFlashAlpha > 0.02;
    rightMuzzleFlash.visible = muzzleFlashAlpha > 0.02;

    // Deployable Thermal Radiator Fins Animation + Glow
    radiatorDeployBlend = THREE.MathUtils.lerp(
      radiatorDeployBlend,
      radiatorsDeployed ? 1 : 0,
      Math.min(1, dt * 6.5)
    );
    if (radiatorDeployBlend > 0.02) {
      radiatorGroup.visible = true;
      leftRadiator.scale.set(radiatorDeployBlend, 1, 1);
      rightRadiator.scale.set(radiatorDeployBlend, 1, 1);
      leftRadiator.position.x = -0.38 - radiatorDeployBlend * 0.48;
      rightRadiator.position.x = 0.38 + radiatorDeployBlend * 0.48;
      const heatGlow = THREE.MathUtils.clamp((hullTempC - 40) / 480, 0.12, 1.8);
      radiatorMat.emissive.set(hullTempC > 220 ? '#fb923c' : '#38bdf8');
      radiatorMat.emissiveIntensity = heatGlow * radiatorDeployBlend;
    } else {
      radiatorGroup.visible = false;
    }

    // Holographic Walkable Cabin Station Markers (Galley, Bunk, Reactor, Airlock)
    cabinStationGroup.visible = walkingInside;
    if (walkingInside) {
      const pulse = 0.55 + Math.sin(clockTime * 3.8) * 0.25;
      cabinStationMeshes.forEach(({ id, ring, mat }) => {
        const isActive = id === nearbyCabinStation;
        mat.opacity = isActive ? 0.95 : pulse * 0.52;
        const sc = isActive ? 1.24 : 0.92;
        ring.scale.set(sc, 1, sc);
      });
    }

    // 3D Radar Scan Wave
    if (radarPulseAgeSec >= 0 && radarPulseAgeSec < 2.2) {
      const progress = radarPulseAgeSec / 2.2;
      radarPulseRing.visible = true;
      radarPulseRing.scale.setScalar(1 + progress * 48);
      radarPulseRingMat.opacity = (1 - progress) * 0.65;
    } else {
      radarPulseRing.visible = false;
    }

    // Ventral Gimballed Orbital Mining Turret pulse & beam lens color
    if (miningActive) {
      miningLensMat.color.set(miningColorHex);
      miningLensMat.emissive.set(miningColorHex);
      miningLensMat.emissiveIntensity = 2.6 + Math.sin(clockTime * 16.0) * 0.7;
      miningRingMat.color.set(miningColorHex);
      miningRingMat.opacity = 0.72 + Math.sin(clockTime * 12.0) * 0.2;
      miningTurretGroup.rotation.y = Math.sin(clockTime * 2.5) * 0.18;
      miningTurretGroup.position.y = -0.37;
    } else {
      miningLensMat.color.set('#38bdf8');
      miningLensMat.emissive.set('#38bdf8');
      miningLensMat.emissiveIntensity = 0.4;
      miningRingMat.color.set('#38bdf8');
      miningRingMat.opacity = 0.25;
      miningTurretGroup.rotation.y = THREE.MathUtils.lerp(miningTurretGroup.rotation.y, 0, Math.min(1, dt * 6));
      miningTurretGroup.position.y = THREE.MathUtils.lerp(miningTurretGroup.position.y, -0.34, Math.min(1, dt * 6));
    }
  };

  const setLandingGearDeployed = (deployed: boolean) => {
    isLandingGearDeployed = deployed;
    landingGearMeshes.forEach((m) => {
      m.visible = deployed;
    });
  };

  const getFloorOffsetY = (withGear = false) =>
    withGear ? floorMinYWithGear : floorMinYRetracted;

  // Preserve 100% native Spaceship.glb PBR look on Flagship ('sr7-vanguard') while letting alternate
  // Hangar editions customize exterior hull armor shade, thruster glow, and tactical LED accents.
  const setVariant = (preset: SpacecraftPreset) => {
    activeVariantPreset = preset;
    const isDefault = preset.id === 'sr7-vanguard';
    const hullTint = isDefault ? '#ffffff' : preset.hullTintHex;
    exteriorHullMaterials.forEach((mat) => {
      if (mat.map) {
        mat.color.set(hullTint);
        mat.needsUpdate = true;
      }
    });
    const tailHex = isDefault ? '#38bdf8' : preset.plumePrimaryHex;
    tailLightMaterials.forEach((mat) => {
      mat.color.set(tailHex);
      mat.emissive.set(tailHex);
      mat.needsUpdate = true;
    });
    const neonBaseHex = isDefault ? '#22d3ee' : preset.accentHex;
    const neonGlowHex = isDefault ? '#00f0ff' : preset.emissiveTintHex;
    neonMaterials.forEach((mat) => {
      mat.color.set(neonBaseHex);
      mat.emissive.set(neonGlowHex);
      mat.needsUpdate = true;
    });
    radarPulseRingMat.color.set(preset.accentHex);
    muzzleFlashMat.color.set(preset.accentHex);
    outerPlumeUniforms.uAccentColor.value.set(tailHex);
    innerCoreUniforms.uCoreColor.value.set(preset.plumeWarpHex);
    _lightBoostColor.set(preset.plumeWarpHex);
  };

  const dispose = () => {
    disposed = true;
    disposeNodeResources(rootGroup);
  };

  return {
    rootGroup,
    hullGroup,
    interiorGroup,
    cockpitSeatAnchor,
    pilotSeatAnchor,
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
    pfdCanvas: dummyCanvas,
    pfdMat: dummyMat,
    navCanvas: dummyCanvas,
    navMat: dummyMat,
    sysCanvas: dummyCanvas,
    sysMat: dummyMat,
    holoCanvas: dummyCanvas,
    holoMat: dummyMat,
    interiorLight,
    strobeLightMesh,
    leftMuzzleFlash,
    rightMuzzleFlash,
    muzzlePositionsLocal,
    miningEmitterLocalPos,
    clickableCockpitControls,
    interiorWalkerAnchor,
    get interiorCollider() {
      return interiorCollider;
    },
    modelReadyPromise,
    setLandingGearDeployed,
    getFloorOffsetY,
    setVariant,
    dispose,
    updateAnimations,
  };
}
