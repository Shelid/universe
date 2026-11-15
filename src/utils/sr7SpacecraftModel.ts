import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CockpitSeatPosition, SpacecraftPreset } from '../types/astronomy';

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
  LEFT: new THREE.Vector3(-0.1155, 0.072, -3.342),
  // Panoramic Center (Between Commander & Co-Pilot seats)
  CENTER: new THREE.Vector3(0.0, 0.078, -3.328),
  // Co-Pilot Seat (Right, directly facing illuminated keyboard & navigation monitors)
  RIGHT: new THREE.Vector3(0.1155, 0.072, -3.342),
};

/**
 * Loads and mounts the complete high-definition Spaceship.glb (exterior + native 3D interior,
 * dual seats, 5 computer screens, keyboard, floor window, and crystal-clear panoramic canopy).
 * Local orientation: Nose = -Z, Thrusters = +Z, Up = +Y, Right = +X.
 */
export function createSR7Spacecraft3DGroup(options?: { maxAnisotropy?: number }): SR7SpacecraftRefs {
  const maxAniso = Math.max(1, options?.maxAnisotropy ?? 16);
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

  // 100% Crystal-Clear Optical Canopy ShaderMaterial for all Glass meshes in Spaceship.glb:
  // Zero central tint/opacity from inside so space & planets are crystal clear, with a subtle
  // aerospace Fresnel glint on grazing edges.
  const canopyGlassMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uInteriorView: { value: 0.0 },
      uTintColor: { value: new THREE.Color('#7dd3fc') },
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
        float fresnel = pow(1.0 - ndotv, 4.2);

        float centerAlpha = mix(0.015, 0.0, uInteriorView);
        float edgeAlpha = mix(0.24, 0.06, uInteriorView);
        float alpha = mix(centerAlpha, edgeAlpha, fresnel);

        vec3 glassColor = mix(uTintColor * 1.1, vec3(0.92, 0.98, 1.0), fresnel * 0.7);
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

  const placeholderMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.65, 3.8, 6),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', wireframe: true, transparent: true, opacity: 0.28 })
  );
  placeholderMesh.rotation.x = -Math.PI / 2;
  hullGroup.add(placeholderMesh);

  const disposeNodeResources = (node: THREE.Object3D) => {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    node.traverse((obj) => {
      const msh = obj as THREE.Mesh;
      if (msh.geometry) geometries.add(msh.geometry);
      const mats = Array.isArray(msh.material) ? msh.material : msh.material ? [msh.material] : [];
      mats.forEach((mt) => {
        if (!mt) return;
        materials.add(mt);
        Object.values(mt).forEach((val) => {
          if (val && (val as THREE.Texture).isTexture) {
            textures.add(val as THREE.Texture);
          }
        });
      });
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((mt) => mt.dispose());
    textures.forEach((tx) => tx.dispose());
  };

  let modelReadyPromise: Promise<void> = Promise.resolve();
  const tailLightMaterials: THREE.MeshStandardMaterial[] = [];
  const neonMaterials: THREE.MeshStandardMaterial[] = [];
  const screenMaterials: THREE.MeshStandardMaterial[] = [];
  let nativeYokeNode: THREE.Object3D | null = null;
  const nativeYokeBaseQuat = new THREE.Quaternion();

  if (!isNodeEnv) {
    const loader = new GLTFLoader();
    modelReadyPromise = new Promise<void>((resolve) => {
      loader.load(
        '/models/spaceship.glb',
        (gltf) => {
          if (disposed) {
            disposeNodeResources(gltf.scene);
            resolve();
            return;
          }
          const loadedRoot = gltf.scene;

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
                  std.envMapIntensity = Math.max(std.envMapIntensity ?? 1, 1.45);
                  [
                    std.map,
                    std.normalMap,
                    std.roughnessMap,
                    std.metalnessMap,
                    std.emissiveMap,
                    std.aoMap,
                  ].forEach((tx) => {
                    if (tx) {
                      tx.anisotropy = maxAniso;
                      tx.needsUpdate = true;
                    }
                  });

                  if (std.name === 'NOMATERIAL') {
                    std.color.set('#334155');
                    std.metalness = 0.82;
                    std.roughness = 0.32;
                  } else if (std.name === 'NOMATERIAL_1') {
                    std.color.set('#1e293b');
                    std.metalness = 0.85;
                    std.roughness = 0.38;
                  } else if (std.name === 'Tail Light') {
                    std.color.set('#38bdf8');
                    std.emissive.set('#38bdf8');
                    std.emissiveIntensity = 1.35;
                    tailLightMaterials.push(std);
                  } else if (std.name === 'Neon' || std.name === 'Neon.002') {
                    std.color.set('#22d3ee');
                    std.emissive.set('#00f0ff');
                    std.emissiveIntensity = 1.45;
                    neonMaterials.push(std);
                  } else if (std.name === 'GREEN.001') {
                    std.emissive.set('#22c55e');
                    std.emissiveIntensity = 1.25;
                  } else if (std.name === 'ScreenBorder.001') {
                    std.emissive.set('#0ea5e9');
                    std.emissiveIntensity = 0.85;
                  } else if (
                    std.name.toLowerCase().includes('screen') ||
                    std.name === 'pcKeyboard'
                  ) {
                    if (std.map && !std.emissiveMap) {
                      std.emissiveMap = std.map;
                    }
                    std.emissive.set('#ffffff');
                    std.emissiveIntensity = 1.15;
                    std.roughness = 0.16;
                    std.metalness = 0.08;
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
            }
          });

          // Align Spaceship.glb so Nose (-X raw) points to -Z, Tail (+X raw) points to +Z,
          // and center symmetry axis (z_raw = -0.335, y_raw = 10.00, x_raw = -2.65) sits at (0, 0, 0).
          loadedRoot.rotation.y = -Math.PI / 2;
          loadedRoot.position.set(-0.335, -10.0, 2.65);

          glbWrapper.add(loadedRoot);
          hullGroup.remove(placeholderMesh);
          placeholderMesh.geometry.dispose();
          (placeholderMesh.material as THREE.Material).dispose();
          resolve();
        },
        undefined,
        () => {
          resolve();
        }
      );
    });
  }

  // Cabin Lighting placed inside the native Spaceship.glb bridge
  const interiorLight = new THREE.PointLight('#e0f2fe', 2.4, 5.5, 1);
  interiorLight.position.set(0, 0.16, -3.18);
  interiorGroup.add(interiorLight);

  const consoleGlowLight = new THREE.PointLight('#38bdf8', 1.35, 3.2, 1);
  consoleGlowLight.position.set(0, 0.05, -3.42);
  interiorGroup.add(consoleGlowLight);

  const rearLoungeLight = new THREE.PointLight('#bae6fd', 1.4, 4.2, 1);
  rearLoungeLight.position.set(0, 0.14, -2.82);
  interiorGroup.add(rearLoungeLight);

  // Pilot Eye Camera Anchor inside the native Spaceship.glb cabin (defaults to Commander Left Seat)
  const cockpitSeatAnchor = new THREE.Object3D();
  cockpitSeatAnchor.position.copy(SEAT_LOCAL_POSITIONS.LEFT);
  interiorGroup.add(cockpitSeatAnchor);

  // Seated 3D Pilot Character Anchor (placed in Commander Left Seat)
  const pilotSeatAnchor = new THREE.Group();
  pilotSeatAnchor.name = 'spaceship-pilot-seat-anchor';
  pilotSeatAnchor.position.set(-0.1155, -0.02, -3.346);
  interiorGroup.add(pilotSeatAnchor);

  // 3rd-Person Chase Camera Anchor behind & slightly above Spaceship
  const chaseCameraAnchor = new THREE.Object3D();
  chaseCameraAnchor.position.set(0, 1.42, 7.2);
  rootGroup.add(chaseCameraAnchor);

  // Forward Spotlights & Radar Pulse Ring
  const headlightLeftSpot = new THREE.SpotLight('#fef9c3', 0, 95, Math.PI * 0.16, 0.45, 1.0);
  headlightLeftSpot.position.set(-0.35, -0.05, -3.65);
  const leftTarget = new THREE.Object3D();
  leftTarget.position.set(-0.35, -0.08, -36);
  hullGroup.add(leftTarget);
  headlightLeftSpot.target = leftTarget;
  hullGroup.add(headlightLeftSpot);

  const headlightRightSpot = new THREE.SpotLight('#fef9c3', 0, 95, Math.PI * 0.16, 0.45, 1.0);
  headlightRightSpot.position.set(0.35, -0.05, -3.65);
  const rightTarget = new THREE.Object3D();
  rightTarget.position.set(0.35, -0.08, -36);
  hullGroup.add(rightTarget);
  headlightRightSpot.target = rightTarget;
  hullGroup.add(headlightRightSpot);

  const headlightBeamGroup = new THREE.Group();
  const beamGeo = new THREE.ConeGeometry(1.25, 10, 16, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, -5);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fef9c3',
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  [-0.35, 0.35].forEach((bx) => {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(bx, -0.05, -3.65);
    headlightBeamGroup.add(beam);
  });
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
    rollInput,
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

    // Cabin interior lights
    const scaleFactor = Math.max(0.0000025, shipScale);
    interiorLight.intensity = interiorLightsOn ? (isCockpitView ? 2.4 : 1.5) : 0.35;
    interiorLight.distance = scaleFactor * 6.5;
    consoleGlowLight.intensity = interiorLightsOn ? 1.35 : 0.55;
    consoleGlowLight.distance = scaleFactor * 3.8;
    rearLoungeLight.intensity = interiorLightsOn ? (isCockpitView ? 1.6 : 0.9) : 0.2;
    rearLoungeLight.distance = scaleFactor * 5.0;

    // Forward Spotlights
    headlightLeftSpot.intensity = headlightsOn ? 9.5 : 0;
    headlightRightSpot.intensity = headlightsOn ? 9.5 : 0;
    headlightLeftSpot.distance = scaleFactor * 95;
    headlightRightSpot.distance = scaleFactor * 95;
    headlightBeamGroup.visible = headlightsOn;

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
