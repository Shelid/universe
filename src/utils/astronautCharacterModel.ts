import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type AstronautActionMode = 'SEATED' | 'EVA_IDLE' | 'EVA_WALK' | 'EVA_RUN' | 'EVA_JETPACK';

export interface AstronautCharacterRefs {
  rootGroup: THREE.Group;
  characterOffsetGroup: THREE.Group;
  visorLight: THREE.SpotLight;
  visorLightTarget: THREE.Object3D;
  jetpackGlowGroup: THREE.Group;
  modelReadyPromise: Promise<void>;
  update: (params: {
    dt: number;
    clockTime: number;
    mode: AstronautActionMode;
    moveSpeed01: number;
    boostActive: boolean;
    pitchTilt?: number;
    rollTilt?: number;
    visorLightOn: boolean;
    worldScale: number;
  }) => void;
  dispose: () => void;
}

type TrackedBoneName =
  | 'Hips'
  | 'Spine'
  | 'Spine01'
  | 'Spine02'
  | 'neck'
  | 'Head'
  | 'LeftUpLeg'
  | 'LeftLeg'
  | 'LeftFoot'
  | 'RightUpLeg'
  | 'RightLeg'
  | 'RightFoot'
  | 'LeftArm'
  | 'LeftForeArm'
  | 'RightArm'
  | 'RightForeArm';

interface BoneBinding {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  parentInvWorldQuat: THREE.Quaternion;
}

const TRACKED_BONES: TrackedBoneName[] = [
  'Hips',
  'Spine',
  'Spine01',
  'Spine02',
  'neck',
  'Head',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'LeftArm',
  'LeftForeArm',
  'RightArm',
  'RightForeArm',
];

/**
 * Rewrites Skeleton.update() so boneMatrices are evaluated relative to skinnedMesh.matrixWorld in
 * JS 64-bit Float64 precision rather than global Solar-System coordinates (~150-4500 AU).
 * This avoids Float32 quantization spikes & horizontal stripes when rendering at 1:1 cosmic scale.
 */
function enableMeshRelativeSkinning(skinnedMesh: THREE.SkinnedMesh): void {
  const skeleton = skinnedMesh.skeleton;
  if (!skeleton) return;

  skinnedMesh.bindMode = THREE.DetachedBindMode;
  skinnedMesh.bindMatrix.identity();
  skinnedMesh.bindMatrixInverse.identity();

  const meshInvWorld = new THREE.Matrix4();
  const offsetMatrix = new THREE.Matrix4();

  skeleton.update = function updateMeshRelative() {
    const bones = this.bones;
    const boneInverses = this.boneInverses;
    const boneMatrices = this.boneMatrices;

    meshInvWorld.copy(skinnedMesh.matrixWorld).invert();

    for (let i = 0, il = bones.length; i < il; i++) {
      const bone = bones[i];
      if (bone) {
        offsetMatrix.multiplyMatrices(meshInvWorld, bone.matrixWorld);
        offsetMatrix.multiply(boneInverses[i]);
      } else {
        offsetMatrix.identity();
      }
      offsetMatrix.toArray(boneMatrices, i * 16);
    }

    if (this.boneTexture !== null) {
      this.boneTexture.needsUpdate = true;
    }
  };
}

/**
 * Loads the rigged Astronaut GLB (`/models/astronaut.glb`), manages seated pilot pose
 * inside the Light Fighter canopy as well as zero-G EVA jetpack/walk animations & thruster VFX.
 */
export function createAstronautCharacter3D(): AstronautCharacterRefs {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'astronaut-root-group';

  const characterOffsetGroup = new THREE.Group();
  characterOffsetGroup.name = 'astronaut-character-offset';
  // Model's headfront points toward +Z at rest; rotating PI aligns forward to -Z everywhere.
  characterOffsetGroup.rotation.y = Math.PI;
  rootGroup.add(characterOffsetGroup);

  // Subtle shoulder/helmet EVA headlamp (aimed forward -Z in rootGroup space)
  const visorLight = new THREE.SpotLight('#e0f2fe', 0, 20, Math.PI * 0.24, 0.52, 0.0);
  visorLight.position.set(0, 1.72, -0.18);
  const visorLightTarget = new THREE.Object3D();
  visorLightTarget.position.set(0, 1.35, -5.5);
  rootGroup.add(visorLight, visorLightTarget);
  visorLight.target = visorLightTarget;

  // Twin Dorsal Jetpack RCS Thruster Cones (visible during EVA movement & boost)
  const jetpackGlowGroup = new THREE.Group();
  jetpackGlowGroup.position.set(0, 1.34, 0.24);
  jetpackGlowGroup.visible = false;
  rootGroup.add(jetpackGlowGroup);

  const jetFlameGeo = new THREE.ConeGeometry(0.055, 0.42, 12, 1, true);
  jetFlameGeo.rotateX(Math.PI);
  jetFlameGeo.translate(0, -0.21, 0);

  const jetFlameMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const leftJetFlame = new THREE.Mesh(jetFlameGeo, jetFlameMat);
  leftJetFlame.position.set(-0.11, 0, 0.02);
  leftJetFlame.rotation.x = 0.26;
  const rightJetFlame = new THREE.Mesh(jetFlameGeo, jetFlameMat);
  rightJetFlame.position.set(0.11, 0, 0.02);
  rightJetFlame.rotation.x = 0.26;
  jetpackGlowGroup.add(leftJetFlame, rightJetFlame);

  let disposed = false;
  let loadedScene: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let runAction: THREE.AnimationAction | null = null;
  let currentClipMode: 'none' | 'walk' | 'run' = 'none';

  const bones = new Map<TrackedBoneName, BoneBinding>();
  const allBoneRestStates: Array<{
    bone: THREE.Object3D;
    pos: THREE.Vector3;
    quat: THREE.Quaternion;
    scale: THREE.Vector3;
  }> = [];
  const tmpAxis = new THREE.Vector3();
  const tmpDeltaQ = new THREE.Quaternion();
  const tmpTargetQ = new THREE.Quaternion();
  const tmpChildWorldQ = new THREE.Quaternion();

  const applyCharAxisPose = (
    name: TrackedBoneName,
    rotationsDeg: Array<[number, number, number, number]>, // [ax, ay, az, deg]
    blend = 1.0
  ) => {
    const binding = bones.get(name);
    if (!binding) return;

    tmpTargetQ.copy(binding.restQuat);
    // Apply sequentially around character-root axes converted into parent bone local space
    for (let i = 0; i < rotationsDeg.length; i++) {
      const [ax, ay, az, deg] = rotationsDeg[i];
      if (Math.abs(deg) < 0.001) continue;
      tmpAxis.set(ax, ay, az).normalize().applyQuaternion(binding.parentInvWorldQuat);
      tmpDeltaQ.setFromAxisAngle(tmpAxis, THREE.MathUtils.degToRad(deg));
      tmpTargetQ.premultiply(tmpDeltaQ);
    }

    if (blend >= 0.999) {
      binding.bone.quaternion.copy(tmpTargetQ);
    } else {
      binding.bone.quaternion.slerp(tmpTargetQ, blend);
    }
  };

  const resetAllBonesToRest = (blend = 0.2) => {
    for (let i = 0; i < allBoneRestStates.length; i++) {
      const b = allBoneRestStates[i];
      if (blend >= 0.999) {
        b.bone.position.copy(b.pos);
        b.bone.quaternion.copy(b.quat);
        b.bone.scale.copy(b.scale);
      } else {
        b.bone.position.lerp(b.pos, blend);
        b.bone.quaternion.slerp(b.quat, blend);
        b.bone.scale.lerp(b.scale, blend);
      }
    }
  };

  const disposeObjectResources = (node: THREE.Object3D) => {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const texs = new Set<THREE.Texture>();
    node.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      list.forEach((m) => {
        if (!m) return;
        mats.add(m);
        Object.values(m).forEach((v) => {
          if (v && (v as THREE.Texture).isTexture) texs.add(v as THREE.Texture);
        });
      });
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());
  };

  const isNodeEnv = typeof window === 'undefined' || typeof document === 'undefined';
  let modelReadyPromise: Promise<void> = Promise.resolve();

  if (!isNodeEnv) {
    const loader = new GLTFLoader();
    modelReadyPromise = new Promise<void>((resolve) => {
      loader.load(
        '/models/astronaut.glb',
        (gltf) => {
          if (disposed) {
            disposeObjectResources(gltf.scene);
            resolve();
            return;
          }

          loadedScene = gltf.scene;
          loadedScene.updateMatrixWorld(true);

          loadedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.frustumCulled = false;
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.isMeshStandardMaterial) {
                mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.35);
                mat.needsUpdate = true;
              }
            }
            if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
              enableMeshRelativeSkinning(child as THREE.SkinnedMesh);
            }
            if ((child as THREE.Bone).isBone) {
              allBoneRestStates.push({
                bone: child,
                pos: child.position.clone(),
                quat: child.quaternion.clone(),
                scale: child.scale.clone(),
              });
            }
            const name = child.name as TrackedBoneName;
            if (TRACKED_BONES.includes(name) && child.parent) {
              child.parent.getWorldQuaternion(tmpChildWorldQ);
              bones.set(name, {
                bone: child,
                restQuat: child.quaternion.clone(),
                parentInvWorldQuat: tmpChildWorldQ.clone().invert(),
              });
            }
          });

          characterOffsetGroup.add(loadedScene);

          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(loadedScene);
            const walkClip =
              gltf.animations.find((a) => a.name.toLowerCase().includes('walk')) ||
              gltf.animations[0];
            const runClip =
              gltf.animations.find((a) => a.name.toLowerCase().includes('run')) ||
              walkClip;

            if (walkClip) {
              walkAction = mixer.clipAction(walkClip);
              walkAction.enabled = true;
            }
            if (runClip) {
              runAction = mixer.clipAction(runClip);
              runAction.enabled = true;
            }
          }

          resolve();
        },
        undefined,
        () => {
          resolve();
        }
      );
    });
  }

  const syncClipState = (target: 'none' | 'walk' | 'run', speedScale: number) => {
    if (!mixer) return;
    if (target === currentClipMode) {
      if (target === 'walk' && walkAction) walkAction.timeScale = speedScale;
      if (target === 'run' && runAction) runAction.timeScale = speedScale;
      return;
    }

    const fadeSec = 0.18;
    if (target === 'none') {
      // Stop mixer tracks cleanly rather than fading weights toward zero on bones
      walkAction?.stop();
      runAction?.stop();
    } else if (target === 'walk' && walkAction) {
      runAction?.fadeOut(fadeSec);
      walkAction.reset().setEffectiveWeight(1).fadeIn(fadeSec).play();
      walkAction.timeScale = speedScale;
    } else if (target === 'run' && runAction) {
      walkAction?.fadeOut(fadeSec);
      runAction.reset().setEffectiveWeight(1).fadeIn(fadeSec).play();
      runAction.timeScale = speedScale;
    }
    currentClipMode = target;
  };

  const update: AstronautCharacterRefs['update'] = ({
    dt,
    clockTime,
    mode,
    moveSpeed01,
    boostActive,
    pitchTilt = 0,
    rollTilt = 0,
    visorLightOn,
    worldScale,
  }) => {
    const safeDt = Math.min(dt, 0.06);

    // Helmet spotlight scales seamlessly with world space scale
    visorLight.distance = Math.max(0.0005, worldScale * 48);
    visorLight.intensity = visorLightOn && mode !== 'SEATED' ? 4.8 : 0;

    if (!loadedScene) return;

    if (mode === 'SEATED') {
      syncClipState('none', 1);
      resetAllBonesToRest(1.0);

      // Drop astronaut hips cleanly onto cockpit seat cushion and center chest in seat bucket
      characterOffsetGroup.position.set(0, -0.88, -0.02);
      jetpackGlowGroup.visible = false;

      // Ergonomic Fighter Pilot Seated Pose (rootGroup: -Z = forward, +Y = up, +X = right)
      applyCharAxisPose('Hips', [[1, 0, 0, 8]]);
      applyCharAxisPose('Spine02', [[1, 0, 0, 6]]);
      applyCharAxisPose('Spine', [
        [1, 0, 0, 6 + pitchTilt * 2.5],
        [0, 0, 1, -rollTilt * 3.0],
      ]);
      applyCharAxisPose('Head', [
        [1, 0, 0, -12 - pitchTilt * 2.0],
        [0, 1, 0, -rollTilt * 5.0],
      ]);

      // Thighs raised forward toward instrument panel with realistic knee flare
      applyCharAxisPose('LeftUpLeg', [
        [1, 0, 0, 94],
        [0, 1, 0, -8],
      ]);
      applyCharAxisPose('RightUpLeg', [
        [1, 0, 0, 94],
        [0, 1, 0, 8],
      ]);
      // Knees bent down cleanly onto cockpit footwell floor (-Z = forward, -X bends knee down)
      applyCharAxisPose('LeftLeg', [[1, 0, 0, -62]]);
      applyCharAxisPose('RightLeg', [[1, 0, 0, -62]]);

      // Arms reaching forward/downward onto Left Throttle & Right HOTAS Control Stick
      applyCharAxisPose('LeftArm', [
        [1, 0, 0, 28 + pitchTilt * 5],
        [0, 0, 1, 20],
      ]);
      applyCharAxisPose('LeftForeArm', [
        [1, 0, 0, 46],
        [0, 1, 0, -14],
      ]);
      applyCharAxisPose('RightArm', [
        [1, 0, 0, 28 - pitchTilt * 6],
        [0, 0, 1, -20],
      ]);
      applyCharAxisPose('RightForeArm', [
        [1, 0, 0, 46 + rollTilt * 6],
        [0, 1, 0, 14],
      ]);
      return;
    }

    // Standing / Zero-G EVA Mode: feet at y = 0 in rootGroup
    characterOffsetGroup.position.set(0, 0, 0);

    if (mode === 'EVA_WALK') {
      syncClipState('walk', THREE.MathUtils.clamp(0.75 + moveSpeed01 * 0.7, 0.7, 1.45));
      mixer?.update(safeDt);
    } else if (mode === 'EVA_RUN') {
      syncClipState('run', THREE.MathUtils.clamp(0.95 + moveSpeed01 * 0.65, 0.9, 1.6));
      mixer?.update(safeDt);
    } else if (mode === 'EVA_JETPACK') {
      syncClipState('none', 1);
      const blend = Math.min(1, safeDt * 7.5);
      resetAllBonesToRest(blend);
      // Dynamic zero-G EVA flight posture (leans slightly forward -Z, knees naturally flexed)
      applyCharAxisPose('Spine', [[1, 0, 0, -14 + pitchTilt * 8], [0, 0, 1, -rollTilt * 10]], blend);
      applyCharAxisPose('Head', [[1, 0, 0, 10]], blend);
      applyCharAxisPose('LeftUpLeg', [[1, 0, 0, 18]], blend);
      applyCharAxisPose('RightUpLeg', [[1, 0, 0, 26]], blend);
      applyCharAxisPose('LeftLeg', [[1, 0, 0, -24]], blend);
      applyCharAxisPose('RightLeg', [[1, 0, 0, -34]], blend);
      applyCharAxisPose('LeftArm', [[1, 0, 0, 12], [0, 0, 1, -18]], blend);
      applyCharAxisPose('RightArm', [[1, 0, 0, 12], [0, 0, 1, 18]], blend);
      applyCharAxisPose('LeftForeArm', [[1, 0, 0, 26]], blend);
      applyCharAxisPose('RightForeArm', [[1, 0, 0, 26]], blend);
    } else {
      // EVA_IDLE: smooth weightless idle float + subtle breathing sway
      syncClipState('none', 1);
      resetAllBonesToRest(Math.min(1, safeDt * 6));
      const sway = Math.sin(clockTime * 1.55);
      applyCharAxisPose('Spine', [[1, 0, 0, sway * 1.6]], Math.min(1, safeDt * 5));
      applyCharAxisPose('Head', [[0, 1, 0, Math.sin(clockTime * 0.72) * 3.5]], Math.min(1, safeDt * 5));
      applyCharAxisPose('LeftArm', [[0, 0, 1, 5 + sway * 1.8]], Math.min(1, safeDt * 5));
      applyCharAxisPose('RightArm', [[0, 0, 1, -5 - sway * 1.8]], Math.min(1, safeDt * 5));
    }

    // Jetpack RCS flame cones when thrusting/moving in EVA
    const showJets = mode === 'EVA_JETPACK' || moveSpeed01 > 0.08 || boostActive;
    jetpackGlowGroup.visible = showJets;
    if (showJets) {
      const pulse = 0.8 + Math.sin(clockTime * 32) * 0.2;
      const flameScale = (boostActive ? 1.55 : 0.45 + moveSpeed01 * 0.7) * pulse;
      leftJetFlame.scale.set(boostActive ? 1.25 : 0.85, flameScale, boostActive ? 1.25 : 0.85);
      rightJetFlame.scale.set(boostActive ? 1.25 : 0.85, flameScale, boostActive ? 1.25 : 0.85);
      jetFlameMat.color.set(boostActive ? '#7dd3fc' : '#38bdf8');
      jetFlameMat.opacity = boostActive ? 0.88 : 0.56;
    }
  };

  const dispose = () => {
    disposed = true;
    mixer?.stopAllAction();
    disposeObjectResources(rootGroup);
  };

  return {
    rootGroup,
    characterOffsetGroup,
    visorLight,
    visorLightTarget,
    jetpackGlowGroup,
    modelReadyPromise,
    update,
    dispose,
  };
}
