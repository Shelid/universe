import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CockpitSeatPosition, SpacecraftPreset } from '../types/astronomy';
import {
  fetchCachedAssetResponse,
  fetchCachedBlob,
  resolveModelAssetUrl,
} from './assetCdnCache';

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
  clickableCockpitControls: THREE.Object3D[];
  modelReadyPromise: Promise<void>;
  setVariant: (preset: SpacecraftPreset) => void;
  dispose: () => void;
  updateAnimations: (params: {
    dt: number;
    clockTime: number;
    throttle: number;
    boostActive: boolean;
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
export function createSR7Spacecraft3DGroup(options?: { maxAnisotropy?: number }): SR7SpacecraftRefs {
  const maxAniso = Math.max(1, options?.maxAnisotropy ?? 8);
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
  const tailLightMaterials: THREE.MeshStandardMaterial[] = [];
  const neonMaterials: THREE.MeshStandardMaterial[] = [];
  const screenMaterials: THREE.MeshStandardMaterial[] = [];
  let nativeYokeNode: THREE.Object3D | null = null;
  const nativeYokeBaseQuat = new THREE.Quaternion();

  if (!isNodeEnv) {
    const loader = new GLTFLoader();
    const spaceshipBaseDir = `${resolveModelAssetUrl('spaceship').replace(/\/+$/, '')}/`;
    modelReadyPromise = new Promise<void>((resolve) => {
      fetchCachedAssetResponse(resolveModelAssetUrl('spaceship/spaceship.gltf'))
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((rawGltf) => {
          if (disposed) {
            resolve();
            return;
          }

          // Extract material texture specs and build a geometry-only glTF JSON so
          // GLTFLoader.parse loads spaceship.bin (9.67 MB) in ~120ms without waiting for 99 4K PNGs!
          const texSpecs: MaterialTextureSpec[] = [];
          const getUriForTexIndex = (texIdx?: number): string | undefined => {
            if (texIdx === undefined || !rawGltf.textures || !rawGltf.images) return undefined;
            const texDef = rawGltf.textures[texIdx];
            if (!texDef || texDef.source === undefined) return undefined;
            const imgDef = rawGltf.images[texDef.source];
            return imgDef?.uri;
          };

          const geomOnlyGltf = {
            ...rawGltf,
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
                  // Retract/hide wheeled runway landing gear struts (Cube.010/012/013/019 & freio) during spaceflight
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
                  if (
                    isLandingGearNode ||
                    mats.some((m) => m && (m.name === 'freio' || m.name === ''))
                  ) {
                    mesh.visible = false;
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
              resolve();

              // Stream PBR textures progressively in the background with bounded GPU VRAM & concurrency
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

              let baseCursor = 0;
              let auxCursor = 0;
              const worker = async () => {
                // Pass 1: Load all BaseColor & Screen textures first so full ship colors appear immediately
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
                      m.color.set('#ffffff');
                      m.map = baseTex;
                      if (isScreen) {
                        m.emissive.set('#ffffff');
                        m.emissiveMap = baseTex;
                        m.emissiveIntensity = 0.65;
                      }
                      m.needsUpdate = true;
                    });
                  }
                }

                // Pass 2: Stream Roughness/Metalness and Normal maps in the background
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
                  }

                  if (spec.normalUri && !FLAT_NORMAL_URIS.has(spec.normalUri)) {
                    const normTex = await loadResizedTexture(spec.normalUri, false, auxDim);
                    if (normTex && !disposed) {
                      targetMats.forEach((m) => {
                        m.normalMap = normTex;
                        m.needsUpdate = true;
                      });
                    }
                  }
                }
              };

              // Start 4 background texture workers so all BaseColor maps finish in ~1.5s
              setTimeout(() => {
                if (!disposed) {
                  for (let w = 0; w < 4; w++) {
                    void worker();
                  }
                }
              }, 100);
            },
            () => {
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

  // Lightweight compatibility proxies (no external flame cones added to Rear_metal)
  const yokeGroup = new THREE.Group();
  const throttleGroup = new THREE.Group();
  const leftPlumeMesh = new THREE.Mesh();
  leftPlumeMesh.visible = false;
  const rightPlumeMesh = new THREE.Mesh();
  rightPlumeMesh.visible = false;
  const leftCoreMesh = new THREE.Mesh();
  leftCoreMesh.visible = false;
  const rightCoreMesh = new THREE.Mesh();
  rightCoreMesh.visible = false;
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

  const dummyCanvas = isNodeEnv
    ? ({ width: 1, height: 1, getContext: () => null } as unknown as HTMLCanvasElement)
    : document.createElement('canvas');
  const dummyMat = new THREE.MeshBasicMaterial();

  const _yokeAnimEuler = new THREE.Euler();
  const _yokeAnimQuat = new THREE.Quaternion();

  const updateAnimations: SR7SpacecraftRefs['updateAnimations'] = ({
    dt,
    throttle,
    boostActive,
    headlightsOn,
    interiorLightsOn,
    pitchInput,
    radarPulseAgeSec,
    muzzleFlashAlpha,
    isCockpitView = false,
    cockpitSeat = 'LEFT',
    shipScale = 1,
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

    // Modulate native Tail Light emissive intensity with engine throttle (without extra flame cones)
    const absT = Math.abs(throttle);
    const tailIntensity = boostActive ? 2.8 : 0.9 + absT * 1.35;
    tailLightMaterials.forEach((m) => {
      m.emissiveIntensity = tailIntensity;
    });

    // Cabin interior lights (decay = 0 so intensity is invariant across 1:1 cosmic scales)
    const scaleFactor = Math.max(0.0000025, shipScale);
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

    // 3D Radar Scan Wave
    if (radarPulseAgeSec >= 0 && radarPulseAgeSec < 2.2) {
      const progress = radarPulseAgeSec / 2.2;
      radarPulseRing.visible = true;
      radarPulseRing.scale.setScalar(1 + progress * 48);
      radarPulseRingMat.opacity = (1 - progress) * 0.65;
    } else {
      radarPulseRing.visible = false;
    }
  };

  // Preserve 100% of the native Spaceship.glb PBR colors & textures (no color tint overrides)
  const setVariant = (_preset: SpacecraftPreset) => {
    // Fixed original look per user preference
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
    clickableCockpitControls,
    modelReadyPromise,
    setVariant,
    dispose,
    updateAnimations,
  };
}
