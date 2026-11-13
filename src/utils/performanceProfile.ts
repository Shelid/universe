import * as THREE from 'three';

export type QualityPreference = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH';
export type ResolvedQualityTier = 'low' | 'medium' | 'high';

export interface PerformanceProfile {
  tier: ResolvedQualityTier;
  maxDpr: number;
  antialias: boolean;
  maxAnisotropy: number;
  maxTextureSize: number;
  use2kTextures: boolean;
  skyboxCubeSize: number;
  sphereUltraSegments: [number, number];
  sphereMoonSegments: [number, number];
  ringSegments: number;
  orbitSegments: number;
  backgroundStarCount: number;
  cmeParticleCount: number;
  enceladusPlumeCount: number;
  mainBeltCount: number;
  kuiperBeltCount: number;
  saturnBouldersCount: number;
  ceresClusterCount: number;
  galaxyStarCount: number;
  galaxyDiskLayers: number;
  shaderNoiseOctaves: number;
  labelUpdateIntervalFrames: number;
}

const QUALITY_STORAGE_KEY = 'universe_explorer_quality_pref_v1';

export function loadSavedQualityPreference(): QualityPreference {
  try {
    const raw = localStorage.getItem(QUALITY_STORAGE_KEY);
    if (raw === 'AUTO' || raw === 'LOW' || raw === 'MEDIUM' || raw === 'HIGH') {
      return raw;
    }
  } catch {
    // ignore storage restriction
  }
  return 'AUTO';
}

export function saveQualityPreference(pref: QualityPreference): void {
  try {
    localStorage.setItem(QUALITY_STORAGE_KEY, pref);
  } catch {
    // ignore storage restriction
  }
}

export function detectAutoQualityTier(): ResolvedQualityTier {
  if (typeof window === 'undefined') return 'high';

  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 8;
  const memGb =
    typeof (navigator as unknown as { deviceMemory?: number }).deviceMemory === 'number'
      ? (navigator as unknown as { deviceMemory: number }).deviceMemory
      : 8;
  const smallViewport = Math.min(window.innerWidth || 1280, window.innerHeight || 720) < 640;

  if (isMobileUa || isCoarsePointer || smallViewport) {
    if (cores >= 8 && memGb >= 6 && !smallViewport) {
      return 'medium';
    }
    return 'low';
  }

  if (cores <= 2 || memGb <= 2) {
    return 'low';
  }

  if (cores <= 4 || memGb <= 4) {
    return 'medium';
  }

  return 'high';
}

export function resolvePerformanceProfile(
  pref: QualityPreference,
  renderer?: THREE.WebGLRenderer
): PerformanceProfile {
  let tier: ResolvedQualityTier =
    pref === 'LOW'
      ? 'low'
      : pref === 'MEDIUM'
        ? 'medium'
        : pref === 'HIGH'
          ? 'high'
          : detectAutoQualityTier();

  // Downgrade AUTO only when the active WebGL adapter reports software rendering or weak mobile GPU
  if (pref === 'AUTO' && renderer) {
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const gpuStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      if (/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(gpuStr)) {
        tier = 'low';
      } else if (/Mali-G5|Mali-T|Adreno \(TM\) [345]|PowerVR/i.test(gpuStr)) {
        tier = 'low';
      } else if (/Adreno \(TM\) 6|Mali-G7/i.test(gpuStr) && tier === 'high') {
        tier = 'medium';
      }
    } catch {
      // ignore adapter inspection failure
    }
  }

  if (tier === 'low') {
    return {
      tier: 'low',
      maxDpr: 1.5,
      antialias: true,
      maxAnisotropy: 4,
      maxTextureSize: 2048,
      use2kTextures: true,
      skyboxCubeSize: 512,
      sphereUltraSegments: [48, 36],
      sphereMoonSegments: [28, 20],
      ringSegments: 72,
      orbitSegments: 96,
      backgroundStarCount: 15000,
      cmeParticleCount: 450,
      enceladusPlumeCount: 160,
      mainBeltCount: 390,
      kuiperBeltCount: 210,
      saturnBouldersCount: 360,
      ceresClusterCount: 90,
      galaxyStarCount: 18000,
      galaxyDiskLayers: 1,
      shaderNoiseOctaves: 3,
      labelUpdateIntervalFrames: 4,
    };
  }

  if (tier === 'medium') {
    return {
      tier: 'medium',
      maxDpr: 2.0,
      antialias: true,
      maxAnisotropy: 8,
      maxTextureSize: 4096,
      use2kTextures: false,
      skyboxCubeSize: 768,
      sphereUltraSegments: [64, 48],
      sphereMoonSegments: [40, 28],
      ringSegments: 112,
      orbitSegments: 132,
      backgroundStarCount: 26000,
      cmeParticleCount: 900,
      enceladusPlumeCount: 280,
      mainBeltCount: 720,
      kuiperBeltCount: 420,
      saturnBouldersCount: 720,
      ceresClusterCount: 150,
      galaxyStarCount: 42000,
      galaxyDiskLayers: 2,
      shaderNoiseOctaves: 4,
      labelUpdateIntervalFrames: 3,
    };
  }

  return {
    tier: 'high',
    maxDpr: 2.5,
    antialias: true,
    maxAnisotropy: 16,
    maxTextureSize: 4096,
    use2kTextures: false,
    skyboxCubeSize: 1024,
    sphereUltraSegments: [96, 72],
    sphereMoonSegments: [64, 48],
    ringSegments: 160,
    orbitSegments: 180,
    backgroundStarCount: 45000,
    cmeParticleCount: 1600,
    enceladusPlumeCount: 450,
    mainBeltCount: 1140,
    kuiperBeltCount: 660,
    saturnBouldersCount: 1200,
    ceresClusterCount: 210,
    galaxyStarCount: 85000,
    galaxyDiskLayers: 3,
    shaderNoiseOctaves: 6,
    labelUpdateIntervalFrames: 2,
  };
}

/**
 * Downscales oversized HTMLImageElements on low/medium tiers to fit `maxSize` cleanly in VRAM,
 * preserving sharpness while reducing mobile GPU memory by up to 75%.
 */
export function downscaleTextureIfNeeded(tex: THREE.Texture, maxSize: number): THREE.Texture {
  const img = tex.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!img || typeof document === 'undefined') return tex;
  const w = (img as HTMLImageElement).naturalWidth || img.width || 0;
  const h = (img as HTMLImageElement).naturalHeight || img.height || 0;
  if (w <= maxSize && h <= maxSize) return tex;

  const scale = maxSize / Math.max(w, h);
  const nextW = Math.max(1, Math.round(w * scale));
  const nextH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = nextW;
  canvas.height = nextH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return tex;

  ctx.drawImage(img as CanvasImageSource, 0, 0, nextW, nextH);
  const resized = new THREE.CanvasTexture(canvas);
  resized.wrapS = tex.wrapS;
  resized.wrapT = tex.wrapT;
  tex.dispose();
  return resized;
}
