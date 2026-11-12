import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Plus, Minus, Focus } from 'lucide-react';
import {
  CelestialBodyData,
  NearbySpacecraftContact,
  PropagatedSatellite,
  SatelliteCategory,
  ScaleMode,
  SceneBootProgress,
  SpacecraftControlState,
  SpacecraftTelemetry,
  SurfaceLandmark,
  WarpFlightState,
  ZoomLevel,
} from '../types/astronomy';
import {
  ALL_CELESTIAL_BODIES,
  computeKeplerianPosition3D,
  generateKeplerianOrbitCurvePoints,
  getCelestialBody,
  getGalacticFadeThresholds,
  getScaledRadius,
} from '../data/solarSystemData';
import { getMissionTrajectoryScenePoints, SPACE_MISSIONS } from '../data/missionsData';
import {
  createAtmosphereHaloMaterial,
  createBakedDeepSpaceSkyboxMaterial,
  createDeepSpaceSkyboxMaterial,
  createPlanetSurfaceMaterial,
  createRealisticStarfieldMaterial,
  createSaturnRingsShaderMaterial,
  createSolarCoronaMaterial,
  createSolarProminenceMaterial,
  createSunShaderMaterial,
  createWarpTunnelShaderMaterial,
} from '../shaders/planetaryShaders';
import {
  createDetailedSatellite3DGroup,
  createInstancedAsteroidShaderMaterial,
  createRealistic3DGalaxyGroup,
  getSoftCircleParticleTexture,
  MILKY_WAY_LANDMARKS,
  populateRealisticAsteroidBeltGroup,
  populateSaturnRing3DAsteroidFragments,
  setGalaxyGroupOpacity,
} from '../utils/spacecraftAndAsteroidModels';
import {
  downscaleTextureIfNeeded,
  QualityPreference,
  ResolvedQualityTier,
  resolvePerformanceProfile,
} from '../utils/performanceProfile';
import { createSR7Spacecraft3DGroup } from '../utils/sr7SpacecraftModel';
import { spaceAudio } from '../utils/spaceAudioEngine';
import { VirtualSteerInput } from './SpacecraftCockpitHUD';

interface UniverseCanvasProps {
  selectedBodyId: string;
  onSelectBody: (bodyId: string, triggerWarp?: boolean) => void;
  zoomLevel: ZoomLevel;
  onZoomLevelChange: (level: ZoomLevel) => void;
  scaleMode: ScaleMode;
  qualityPreference: QualityPreference;
  onResolvedQualityChange?: (tier: ResolvedQualityTier) => void;
  onBootProgress?: (progress: SceneBootProgress) => void;
  simulationTimeMs: number;
  onSyncSimulationTime: (nextTimeMs: number) => void;
  timeSpeedDaysPerSec: number;
  isPaused: boolean;
  showOrbits: boolean;
  showLabels: boolean;
  showAsteroidBelt: boolean;
  showMissionTrajectories: boolean;
  activeMissionId: string | null;
  isExploringInterior: boolean;
  selectedInteriorLayerId: string | null;
  onSelectInteriorLayer: (layerId: string) => void;
  venusRadarMode: boolean;
  saturnRingDiveMode: boolean;
  propagatedSatellites: PropagatedSatellite[];
  enabledSatelliteCategories: Record<SatelliteCategory, boolean>;
  selectedSatelliteId: string | null;
  onSelectSatellite: (sat: PropagatedSatellite | null) => void;
  selectedLandmark: SurfaceLandmark | null;
  onSelectLandmark: (landmark: SurfaceLandmark | null) => void;
  warpState: WarpFlightState;
  onUpdateWarpState: React.Dispatch<React.SetStateAction<WarpFlightState>>;
  spacecraftControl: SpacecraftControlState;
  onUpdateSpacecraftControl: React.Dispatch<React.SetStateAction<SpacecraftControlState>>;
  onSyncSpacecraftTelemetry: (telemetry: SpacecraftTelemetry) => void;
  virtualSteerInput: VirtualSteerInput;
}

interface ScreenLabel {
  id: string;
  name: string;
  subLabel?: string;
  x: number;
  y: number;
  visible: boolean;
  color: string;
  kind: 'body' | 'moon' | 'satellite' | 'landmark' | 'galactic_landmark' | 'galaxy';
  payloadId: string;
}

type PlanetTextureConfig = {
  diffuse?: string;
  clouds?: string;
  night?: string;
  aux?: string;
  normal?: string;
};

// High-resolution 4K / 2K local planetary textures (NASA / LRO / MESSENGER / Solar System Scope / Three.js)
const REAL_PLANET_TEXTURE_URLS_HIGH: Record<string, PlanetTextureConfig> = {
  sun: { diffuse: '/textures/sun_4k.jpg' },
  mercury: { diffuse: '/textures/mercury_4k.jpg' },
  venus: {
    diffuse: '/textures/venus_atmo_4k.jpg',
    aux: '/textures/venus_surface_4k.jpg',
  },
  earth: {
    diffuse: '/textures/earth_day_sss_4k.jpg',
    clouds: '/textures/earth_clouds_sss_4k.jpg',
    night: '/textures/earth_night_sss_4k.jpg',
    aux: '/textures/earth_bump_roughness_clouds_4096.jpg',
    normal: '/textures/earth_normal_2048.jpg',
  },
  moon: { diffuse: '/textures/moon_4k.jpg' },
  mars: { diffuse: '/textures/mars_4k.jpg' },
  jupiter: { diffuse: '/textures/jupiter_4k.jpg' },
  saturn: { diffuse: '/textures/saturn_4k.jpg' },
  uranus: { diffuse: '/textures/uranus_2k.jpg' },
  neptune: { diffuse: '/textures/neptune_2k.jpg' },
  ceres: { diffuse: '/textures/moon_4k.jpg' },
  pluto: { diffuse: '/textures/mercury_4k.jpg' },
  haumea: { diffuse: '/textures/moon_4k.jpg' },
  makemake: { diffuse: '/textures/mars_4k.jpg' },
  eris: { diffuse: '/textures/moon_4k.jpg' },
  sedna: { diffuse: '/textures/mars_4k.jpg' },
};

// Memory-lean 2K / 1K textures for smartphones and weaker GPUs (~70% less VRAM with crisp appearance)
const REAL_PLANET_TEXTURE_URLS_LOW: Record<string, PlanetTextureConfig> = {
  sun: { diffuse: '/textures/sun_2k.jpg' },
  mercury: { diffuse: '/textures/mercury_2k.jpg' },
  venus: {
    diffuse: '/textures/venus_atmo_2k.jpg',
    aux: '/textures/venus_surface_2k.jpg',
  },
  earth: {
    diffuse: '/textures/earth_day_4096.jpg',
    clouds: '/textures/earth_clouds_1024.png',
    night: '/textures/earth_night_4096.jpg',
    aux: '/textures/earth_bump_roughness_clouds_4096.jpg',
    normal: '/textures/earth_normal_2048.jpg',
  },
  moon: { diffuse: '/textures/moon_2k.jpg' },
  mars: { diffuse: '/textures/mars_2k.jpg' },
  jupiter: { diffuse: '/textures/jupiter_2k.jpg' },
  saturn: { diffuse: '/textures/saturn_2k.jpg' },
  uranus: { diffuse: '/textures/uranus_2k.jpg' },
  neptune: { diffuse: '/textures/neptune_2k.jpg' },
  ceres: { diffuse: '/textures/moon_2k.jpg' },
  pluto: { diffuse: '/textures/mercury_2k.jpg' },
  haumea: { diffuse: '/textures/moon_2k.jpg' },
  makemake: { diffuse: '/textures/mars_2k.jpg' },
  eris: { diffuse: '/textures/moon_2k.jpg' },
  sedna: { diffuse: '/textures/mars_2k.jpg' },
};

const getTextureDisplayLabel = (url: string): string => {
  if (url.includes('sun_')) return 'Sol (Fotosfera)';
  if (url.includes('earth_day')) return 'Terra (Superfície)';
  if (url.includes('earth_clouds')) return 'Terra (Nuvens)';
  if (url.includes('earth_night')) return 'Terra (Luzes Noturnas)';
  if (url.includes('earth_bump')) return 'Terra (Oceanos e Relevo)';
  if (url.includes('earth_normal')) return 'Terra (Mapa Normal)';
  if (url.includes('mercury_')) return 'Mercúrio e Asteroides';
  if (url.includes('venus_atmo')) return 'Vênus (Atmosfera)';
  if (url.includes('venus_surface')) return 'Vênus (Superfície Radar)';
  if (url.includes('moon_')) return 'Lua e Luas Rochosas';
  if (url.includes('mars_')) return 'Marte e Planetas Anões';
  if (url.includes('jupiter_')) return 'Júpiter (Faixas Gasosas)';
  if (url.includes('saturn_')) return 'Saturno';
  if (url.includes('uranus_')) return 'Urano';
  if (url.includes('neptune_')) return 'Netuno';
  return 'Textura Planetária';
};

const _sunlitToSun = new THREE.Vector3();
const _sunlitUp = new THREE.Vector3(0, 1, 0);
const _sunlitRight = new THREE.Vector3();

/**
 * Computes a sunlit cinema camera direction for any planet so ~82% of the visible disk
 * is brilliantly illuminated by the Sun and ~18% on the right limb shows the twilight terminator & night lights.
 */
function computeSunlitCameraOffsetDir(
  planetWorldPos: THREE.Vector3,
  bodyId: string,
  outDir = new THREE.Vector3()
): THREE.Vector3 {
  if (bodyId === 'sun' || planetWorldPos.lengthSq() < 0.0001) {
    return outDir.set(0.65, 0.28, 0.72).normalize();
  }
  _sunlitToSun.copy(planetWorldPos).negate().normalize();
  _sunlitRight.crossVectors(_sunlitUp, _sunlitToSun).normalize();
  return outDir
    .set(0, 0, 0)
    .addScaledVector(_sunlitToSun, 0.88)
    .addScaledVector(_sunlitRight, 0.44)
    .addScaledVector(_sunlitUp, 0.14)
    .normalize();
}

export const UniverseCanvas: React.FC<UniverseCanvasProps> = ({
  selectedBodyId,
  onSelectBody,
  zoomLevel,
  onZoomLevelChange,
  scaleMode,
  qualityPreference,
  onResolvedQualityChange,
  onBootProgress,
  simulationTimeMs,
  onSyncSimulationTime,
  timeSpeedDaysPerSec,
  isPaused,
  showOrbits,
  showLabels,
  showAsteroidBelt,
  showMissionTrajectories,
  activeMissionId,
  isExploringInterior,
  selectedInteriorLayerId,
  onSelectInteriorLayer,
  venusRadarMode,
  saturnRingDiveMode,
  propagatedSatellites,
  enabledSatelliteCategories,
  selectedSatelliteId,
  onSelectSatellite,
  selectedLandmark,
  onSelectLandmark,
  warpState,
  onUpdateWarpState,
  spacecraftControl,
  onUpdateSpacecraftControl,
  onSyncSpacecraftTelemetry,
  virtualSteerInput,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [screenLabels, setScreenLabels] = useState<ScreenLabel[]>([]);
  const [scaleReadout, setScaleReadout] = useState<string>('18.400 km');

  const internalSimTimeRef = useRef<number>(simulationTimeMs);

  useEffect(() => {
    if (Math.abs(simulationTimeMs - internalSimTimeRef.current) > 2500) {
      internalSimTimeRef.current = simulationTimeMs;
    }
  }, [simulationTimeMs]);

  const stateRef = useRef({
    selectedBodyId,
    zoomLevel,
    scaleMode,
    timeSpeedDaysPerSec,
    isPaused,
    showOrbits,
    showLabels,
    showAsteroidBelt,
    showMissionTrajectories,
    activeMissionId,
    isExploringInterior,
    selectedInteriorLayerId,
    venusRadarMode,
    saturnRingDiveMode,
    propagatedSatellites,
    enabledSatelliteCategories,
    selectedSatelliteId,
    selectedLandmark,
    warpState,
    spacecraftControl,
    virtualSteerInput,
  });

  const callbacksRef = useRef({
    onSelectBody,
    onZoomLevelChange,
    onSyncSimulationTime,
    onSelectInteriorLayer,
    onSelectSatellite,
    onSelectLandmark,
    onUpdateWarpState,
    onUpdateSpacecraftControl,
    onSyncSpacecraftTelemetry,
    onResolvedQualityChange,
    onBootProgress,
  });

  useEffect(() => {
    stateRef.current = {
      selectedBodyId,
      zoomLevel,
      scaleMode,
      timeSpeedDaysPerSec,
      isPaused,
      showOrbits,
      showLabels,
      showAsteroidBelt,
      showMissionTrajectories,
      activeMissionId,
      isExploringInterior,
      selectedInteriorLayerId,
      venusRadarMode,
      saturnRingDiveMode,
      propagatedSatellites,
      enabledSatelliteCategories,
      selectedSatelliteId,
      selectedLandmark,
      warpState,
      spacecraftControl,
      virtualSteerInput,
    };
  });

  useEffect(() => {
    callbacksRef.current = {
      onSelectBody,
      onZoomLevelChange,
      onSyncSimulationTime,
      onSelectInteriorLayer,
      onSelectSatellite,
      onSelectLandmark,
      onUpdateWarpState,
      onUpdateSpacecraftControl,
      onSyncSpacecraftTelemetry,
      onResolvedQualityChange,
      onBootProgress,
    };
  });

  const overrideDistanceMultiplierRef = useRef<number | null>(null);

  const cameraCommandRef = useRef<{
    activeTransition: boolean;
    desiredDistanceMultiplier: number;
    focusLatLon: { lat: number; lon: number } | null;
    manualZoomStep: number;
    suppressNextSelectionReset: boolean;
  }>({
    activeTransition: true,
    desiredDistanceMultiplier: 3.5,
    focusLatLon: null,
    manualZoomStep: 0,
    suppressNextSelectionReset: false,
  });

  useEffect(() => {
    if (cameraCommandRef.current.suppressNextSelectionReset) {
      cameraCommandRef.current.suppressNextSelectionReset = false;
      return;
    }
    if (!warpState.isActive) {
      cameraCommandRef.current.activeTransition = true;
      cameraCommandRef.current.focusLatLon = null;
      const selBody = getCelestialBody(selectedBodyId);
      if (overrideDistanceMultiplierRef.current !== null) {
        cameraCommandRef.current.desiredDistanceMultiplier = overrideDistanceMultiplierRef.current;
        overrideDistanceMultiplierRef.current = null;
      } else if (saturnRingDiveMode && selectedBodyId === 'saturn') {
        cameraCommandRef.current.desiredDistanceMultiplier = 1.55;
      } else if (selectedBodyId === 'milky-way') {
        cameraCommandRef.current.desiredDistanceMultiplier = 1.65;
      } else if (selBody.category === 'galaxy') {
        cameraCommandRef.current.desiredDistanceMultiplier = 2.05;
      } else if (selectedBodyId === 'sun') {
        cameraCommandRef.current.desiredDistanceMultiplier = 4.6;
      } else {
        cameraCommandRef.current.desiredDistanceMultiplier = 3.4;
      }
    }
  }, [selectedBodyId, saturnRingDiveMode, warpState.isActive]);

  useEffect(() => {
    if (isExploringInterior) {
      cameraCommandRef.current.activeTransition = true;
      cameraCommandRef.current.desiredDistanceMultiplier = 2.85;
    }
  }, [isExploringInterior]);

  useEffect(() => {
    if (selectedSatelliteId && selectedBodyId === 'earth') {
      cameraCommandRef.current.activeTransition = true;
      cameraCommandRef.current.desiredDistanceMultiplier = 1.95;
    }
  }, [selectedSatelliteId, selectedBodyId]);

  useEffect(() => {
    if (selectedLandmark) {
      cameraCommandRef.current.focusLatLon = {
        lat: selectedLandmark.latitudeDeg,
        lon: selectedLandmark.longitudeDeg,
      };
      cameraCommandRef.current.desiredDistanceMultiplier = 2.1;
      cameraCommandRef.current.activeTransition = true;
    } else {
      cameraCommandRef.current.focusLatLon = null;
    }
  }, [selectedLandmark]);

  // Main WebGL initialization — runs on mount & when qualityPreference changes
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let bootCompleted = false;
    let bootTimeoutId = 0;
    const emitBootProgress = (p: SceneBootProgress) => {
      if (isDisposed) return;
      callbacksRef.current.onBootProgress?.(p);
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#010206');

    const camera = new THREE.PerspectiveCamera(
      46,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.00005,
      600000
    );
    camera.position.set(28, 12, 36);

    const prePerf = resolvePerformanceProfile(qualityPreference);
    const renderer = new THREE.WebGLRenderer({
      antialias: prePerf.antialias,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    const perf = resolvePerformanceProfile(qualityPreference, renderer);
    callbacksRef.current.onResolvedQualityChange?.(perf.tier);

    emitBootProgress({
      progress: 10,
      stage: 'Inicializando motor WebGL...',
      detail: `Perfil ${perf.tier.toUpperCase()} ativado`,
      loadedTextures: 0,
      totalTextures: 0,
      ready: false,
    });
    const activeDpr = Math.min(window.devicePixelRatio || 1, perf.maxDpr);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(activeDpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(
      renderer.capabilities.getMaxAnisotropy(),
      perf.maxAnisotropy
    );
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.maxDistance = 200000;
    controls.minDistance = 0.0000005;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.18;

    const stopAutoCamera = () => {
      cameraCommandRef.current.activeTransition = false;
      if (
        stateRef.current.spacecraftControl.isActive &&
        stateRef.current.spacecraftControl.cameraView === 'EXTERNAL'
      ) {
        lastManualOrbitTimestamp = performance.now();
      }
    };
    controls.addEventListener('start', stopAutoCamera);
    const handleWheelInterrupt = () => {
      cameraCommandRef.current.activeTransition = false;
      if (
        stateRef.current.spacecraftControl.isActive &&
        stateRef.current.spacecraftControl.cameraView === 'EXTERNAL'
      ) {
        lastManualOrbitTimestamp = performance.now();
      }
    };
    renderer.domElement.addEventListener('wheel', handleWheelInterrupt, { passive: true });

    // PHOTOREALISTIC DEEP SPACE ENVIRONMENT (Pre-baked CubeMap Milky Way Skybox + Adaptive Multi-Spectral Starfield)
    const starGroup = new THREE.Group();
    scene.add(starGroup);

    const softCircleSprite = getSoftCircleParticleTexture();

    // Bake 35-octave GLSL Milky Way Great Rift + H-II Nebulae into a GPU CubeTexture ONCE at startup (~50x faster on phones!)
    const skyCubeRT = new THREE.WebGLCubeRenderTarget(perf.skyboxCubeSize, {
      type: THREE.UnsignedByteType,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const skyBakeScene = new THREE.Scene();
    const skyBakeGeo = new THREE.SphereGeometry(5, 32, 24);
    const skyBakeMat = createDeepSpaceSkyboxMaterial(true);
    const skyBakeMesh = new THREE.Mesh(skyBakeGeo, skyBakeMat);
    skyBakeScene.add(skyBakeMesh);
    const skyBakeCam = new THREE.CubeCamera(0.1, 20, skyCubeRT);
    const prevToneMapping = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    skyBakeCam.update(renderer, skyBakeScene);
    renderer.toneMapping = prevToneMapping;
    skyBakeGeo.dispose();
    skyBakeMat.dispose();

    emitBootProgress({
      progress: 20,
      stage: 'Renderizando Skybox da Via Láctea...',
      detail: `CubeMap 360° (${perf.skyboxCubeSize}px)`,
      loadedTextures: 0,
      totalTextures: 0,
      ready: false,
    });

    const skyboxGeo = new THREE.SphereGeometry(
      250000,
      perf.tier === 'low' ? 32 : 48,
      perf.tier === 'low' ? 24 : 36
    );
    const skyboxMat = createBakedDeepSpaceSkyboxMaterial(skyCubeRT.texture);
    const skyboxMesh = new THREE.Mesh(skyboxGeo, skyboxMat);
    skyboxMesh.renderOrder = -20;
    skyboxMesh.frustumCulled = false;
    starGroup.add(skyboxMesh);

    // 2. ADAPTIVE MULTI-SPECTRAL FAR-FIELD STARS WITH REALISTIC MAGNITUDE DISTRIBUTION & BLACKBODY COLORS
    const starCount = perf.backgroundStarCount;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starMagnitudes = new Float32Array(starCount);
    const starPhases = new Float32Array(starCount);

    const spectralPalette = [
      new THREE.Color('#93c5fd'), // Class O (30,000 K Blue)
      new THREE.Color('#bfdbfe'), // Class B (18,000 K Blue-White)
      new THREE.Color('#f8fafc'), // Class A (9,500 K Pure White)
      new THREE.Color('#fef9c3'), // Class F (7,000 K Yellow-White)
      new THREE.Color('#fde047'), // Class G (5,800 K Solar Yellow)
      new THREE.Color('#fed7aa'), // Class K (4,400 K Warm Orange)
      new THREE.Color('#fca5a5'), // Class M (3,100 K Red-Orange)
    ];

    const galTilt = (60.2 * Math.PI) / 180;
    const cosTilt = Math.cos(galTilt);
    const sinTilt = Math.sin(galTilt);
    const rotAz = 0.48;
    const cosAz = Math.cos(rotAz);
    const sinAz = Math.sin(rotAz);
    const galacticStarCutoff = Math.floor(starCount * 0.54);

    for (let i = 0; i < starCount; i++) {
      const r = 175000 + Math.random() * 45000;
      const isGalacticBand = i < galacticStarCutoff;
      const theta = Math.random() * Math.PI * 2;
      let phi: number;
      if (isGalacticBand) {
        // Concentrated along the Milky Way Galactic Equator with Gaussian-like vertical dispersion
        const gSpread =
          (Math.random() + Math.random() + Math.random() + Math.random() - 2.0) * 0.145;
        phi = Math.PI / 2 + gSpread;
      } else {
        phi = Math.acos(2 * Math.random() - 1);
      }

      const gx = r * Math.sin(phi) * Math.cos(theta);
      const gy = r * Math.cos(phi);
      const gz = r * Math.sin(phi) * Math.sin(theta);

      // Rotate from Galactic Coordinates into Ecliptic World Coordinates (matching skyboxMat!)
      const y1 = gy * cosTilt + gz * sinTilt;
      const z1 = -gy * sinTilt + gz * cosTilt;
      const wx = gx * cosAz + z1 * sinAz;
      const wz = -gx * sinAz + z1 * cosAz;

      starPositions[i * 3] = wx;
      starPositions[i * 3 + 1] = y1;
      starPositions[i * 3 + 2] = wz;

      // Power-law stellar magnitude distribution:
      // ~94% faint pinpoint diamond-dust stars (0.05 - 0.55)
      // ~5% medium constellation stars (0.55 - 0.90)
      // ~1% bright navigational beacons (0.91 - 1.00) with Airy halos & delicate diffraction rays
      const uMag = Math.random();
      let mag: number;
      if (uMag > 0.991) {
        mag = 0.91 + Math.random() * 0.09; // ~400 brightest navigational stars across the entire 360° sphere
      } else if (uMag > 0.93) {
        mag = 0.55 + Math.random() * 0.35;
      } else {
        mag = 0.06 + Math.pow(Math.random(), 1.8) * 0.49;
      }
      starMagnitudes[i] = mag;
      starPhases[i] = Math.random() * Math.PI * 2;

      // Realistic spectral class weighting (more F/G/K/M and A/B stars)
      const c = spectralPalette[Math.floor(Math.random() * spectralPalette.length)];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('aMagnitude', new THREE.BufferAttribute(starMagnitudes, 1));
    starGeometry.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));

    const starMaterial = createRealisticStarfieldMaterial(activeDpr);
    const starField = new THREE.Points(starGeometry, starMaterial);
    starField.renderOrder = -15;
    starField.frustumCulled = false;
    starGroup.add(starField);

    // REAL 3D SOLAR POINT LIGHT & EARTHSHINE AMBIENT FILL FOR PBR SPACECRAFT MODELS
    const sunPointLight = new THREE.PointLight('#fff8eb', 3.6, 0, 0);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);

    const spaceHemisphereLight = new THREE.HemisphereLight('#7dd3fc', '#1e293b', 0.95);
    scene.add(spaceHemisphereLight);

    // Subtle procedural cosmic reflection environment (PMREM) so PBR metallic hull & cockpit gleam realistically
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 256;
    envCanvas.height = 128;
    const envCtx = envCanvas.getContext('2d')!;
    const skyGrad = envCtx.createLinearGradient(0, 0, 0, 128);
    skyGrad.addColorStop(0, '#0f1d36');
    skyGrad.addColorStop(0.45, '#1e3557');
    skyGrad.addColorStop(0.55, '#1a202c');
    skyGrad.addColorStop(1, '#050811');
    envCtx.fillStyle = skyGrad;
    envCtx.fillRect(0, 0, 256, 128);
    const sunSpot = envCtx.createRadialGradient(195, 42, 2, 195, 42, 48);
    sunSpot.addColorStop(0, 'rgba(255, 248, 225, 0.95)');
    sunSpot.addColorStop(0.3, 'rgba(253, 224, 175, 0.45)');
    sunSpot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    envCtx.fillStyle = sunSpot;
    envCtx.fillRect(0, 0, 256, 128);
    const nebSpot = envCtx.createRadialGradient(64, 68, 4, 64, 68, 64);
    nebSpot.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
    nebSpot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    envCtx.fillStyle = nebSpot;
    envCtx.fillRect(0, 0, 256, 128);

    const envEquirectTex = new THREE.CanvasTexture(envCanvas);
    envEquirectTex.mapping = THREE.EquirectangularReflectionMapping;
    envEquirectTex.colorSpace = THREE.SRGBColorSpace;
    const envRT = pmremGenerator.fromEquirectangular(envEquirectTex);
    scene.environment = envRT.texture;
    envEquirectTex.dispose();

    const shipRimLight = new THREE.DirectionalLight('#bae6fd', 0.9);
    shipRimLight.visible = false;
    scene.add(shipRimLight);
    scene.add(shipRimLight.target);

    // REALISTIC 3D SCULPTED ASTEROID BELT & KUIPER BELT (6 Geological Archetypes + 4K Crater Regolith Shader)
    const beltGroup = new THREE.Group();
    scene.add(beltGroup);

    const asteroidBeltShaderMat = createInstancedAsteroidShaderMaterial(null, false);
    const kuiperBeltShaderMat = createInstancedAsteroidShaderMaterial(null, false);
    const saturnBoulderShaderMat = createInstancedAsteroidShaderMaterial(null, true);

    const loadedTextures: THREE.Texture[] = [];
    const textureTable = perf.use2kTextures
      ? REAL_PLANET_TEXTURE_URLS_LOW
      : REAL_PLANET_TEXTURE_URLS_HIGH;
    const asteroidCraterUrl = perf.use2kTextures
      ? '/textures/mercury_2k.jpg'
      : '/textures/mercury_4k.jpg';

    const configurePlanetTexture = (tex: THREE.Texture) => {
      const optimized = downscaleTextureIfNeeded(tex, perf.maxTextureSize);
      optimized.anisotropy = maxAnisotropy;
      optimized.minFilter = THREE.LinearMipmapLinearFilter;
      optimized.magFilter = THREE.LinearFilter;
      optimized.generateMipmaps = true;
      // Keep NoColorSpace for custom ShaderMaterial so WebGL2 does not apply x^2.2 darkening without output gamma!
      optimized.colorSpace = THREE.NoColorSpace;
      optimized.needsUpdate = true;
      loadedTextures.push(optimized);
      renderer.initTexture(optimized);
      return optimized;
    };

    // Deduplicate all texture downloads & GPU VRAM uploads across bodies/belts
    const uniqueTextureUrlSet = new Set<string>([asteroidCraterUrl]);
    Object.values(textureTable).forEach((cfg) => {
      if (cfg.diffuse) uniqueTextureUrlSet.add(cfg.diffuse);
      if (cfg.clouds) uniqueTextureUrlSet.add(cfg.clouds);
      if (cfg.night) uniqueTextureUrlSet.add(cfg.night);
      if (cfg.aux) uniqueTextureUrlSet.add(cfg.aux);
      if (cfg.normal) uniqueTextureUrlSet.add(cfg.normal);
    });

    const totalTexCount = uniqueTextureUrlSet.size;
    let settledTexCount = 0;

    emitBootProgress({
      progress: 24,
      stage: 'Carregando texturas planetárias NASA...',
      detail: 'Preparando cache em VRAM',
      loadedTextures: 0,
      totalTextures: totalTexCount,
      ready: false,
    });

    const texturePromiseCache = new Map<string, Promise<THREE.Texture | null>>();
    const getOrLoadCachedTexture = (url: string): Promise<THREE.Texture | null> => {
      const existing = texturePromiseCache.get(url);
      if (existing) return existing;

      const promise = new Promise<THREE.Texture | null>((resolve) => {
        textureLoader.load(
          url,
          (tex) => {
            if (isDisposed) {
              tex.dispose();
              resolve(null);
              return;
            }
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            const optimized = configurePlanetTexture(tex);
            settledTexCount++;
            const pct = 24 + Math.round((settledTexCount / Math.max(1, totalTexCount)) * 60);
            emitBootProgress({
              progress: pct,
              stage: 'Carregando texturas planetárias NASA...',
              detail: getTextureDisplayLabel(url),
              loadedTextures: settledTexCount,
              totalTextures: totalTexCount,
              ready: false,
            });
            resolve(optimized);
          },
          undefined,
          () => {
            if (isDisposed) {
              resolve(null);
              return;
            }
            settledTexCount++;
            const pct = 24 + Math.round((settledTexCount / Math.max(1, totalTexCount)) * 60);
            emitBootProgress({
              progress: pct,
              stage: 'Carregando texturas planetárias NASA...',
              detail: `Fallback procedural: ${getTextureDisplayLabel(url)}`,
              loadedTextures: settledTexCount,
              totalTextures: totalTexCount,
              ready: false,
            });
            resolve(null);
          }
        );
      });

      texturePromiseCache.set(url, promise);
      return promise;
    };

    getOrLoadCachedTexture(asteroidCraterUrl).then((sizedTex) => {
      if (isDisposed || !sizedTex) return;
      asteroidBeltShaderMat.uniforms.uCraterMap.value = sizedTex;
      kuiperBeltShaderMat.uniforms.uCraterMap.value = sizedTex;
      saturnBoulderShaderMat.uniforms.uCraterMap.value = sizedTex;
    });

    // Main Asteroid Belt (2.2 - 3.3 AU -> 329 - 494 u) & Kuiper Belt (32 - 48 AU -> 4787 - 7180 u) built directly in 1:1 scale
    const mainAsteroidBelt = new THREE.Group();
    populateRealisticAsteroidBeltGroup(
      mainAsteroidBelt,
      asteroidBeltShaderMat,
      perf.mainBeltCount,
      329.0,
      494.0,
      6.0,
      0.08,
      0.35,
      false
    );
    beltGroup.add(mainAsteroidBelt);

    const kuiperBelt = new THREE.Group();
    populateRealisticAsteroidBeltGroup(
      kuiperBelt,
      kuiperBeltShaderMat,
      perf.kuiperBeltCount,
      4787.0,
      7180.0,
      28.0,
      0.4,
      1.8,
      true
    );
    beltGroup.add(kuiperBelt);

    // CELESTIAL BODIES MESH REGISTRY
    interface BodySceneNode {
      data: CelestialBodyData;
      rootGroup: THREE.Group;
      tiltGroup: THREE.Group;
      spinMesh: THREE.Mesh;
      surfaceMaterial: THREE.ShaderMaterial;
      atmosphereMesh?: THREE.Mesh;
      solarProminenceMat?: THREE.ShaderMaterial;
      solarStormParticles?: THREE.Points;
      saturnRingShaderMesh?: THREE.Mesh;
      saturnRingShaderMat?: THREE.ShaderMaterial;
      saturnBouldersGroup?: THREE.Group;
      saturnBoulderShaderMat?: THREE.ShaderMaterial;
      ceresAsteroidCluster?: THREE.Group;
      galaxyVolumetricGroup?: THREE.Group;
      enceladusPlumePoints?: THREE.Points;
      interiorCutawayGroup: THREE.Group;
      orbitLine: THREE.Line;
      orbitScaleModeBuilt: ScaleMode;
    }

    const bodyNodes: Record<string, BodySceneNode> = {};
    const clickableMeshes: THREE.Object3D[] = [];
    const interiorLayerMeshes: THREE.Object3D[] = [];

    const sphereGeometryUltra = new THREE.SphereGeometry(1, ...perf.sphereUltraSegments);
    const sphereGeometryHigh = new THREE.SphereGeometry(1, ...perf.sphereMoonSegments);
    const interiorSphereGeo = new THREE.SphereGeometry(1, perf.tier === 'low' ? 24 : 36, perf.tier === 'low' ? 20 : 32);

    ALL_CELESTIAL_BODIES.forEach((body) => {
      const rootGroup = new THREE.Group();
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.z =
        body.category === 'galaxy' ? 0 : THREE.MathUtils.degToRad(body.axialTiltDeg);
      rootGroup.add(tiltGroup);

      let surfaceMaterial: THREE.ShaderMaterial;
      if (body.id === 'sun' || body.category === 'galaxy') {
        surfaceMaterial = createSunShaderMaterial();
      } else {
        surfaceMaterial = createPlanetSurfaceMaterial(
          body.shaderType === 'sun' || body.shaderType === 'galaxy' ? 'mercury' : body.shaderType,
          body.primaryColorHex,
          body.secondaryColorHex,
          body.atmosphereColorHex
        );
      }

      // Bind deduplicated NASA / LRO / MESSENGER / Solar System Scope textures
      const texConfig = textureTable[body.id];
      if (texConfig?.diffuse) {
        getOrLoadCachedTexture(texConfig.diffuse).then((tex) => {
          if (isDisposed || !tex) return;
          surfaceMaterial.uniforms.uDiffuseMap.value = tex;
          surfaceMaterial.uniforms.uHasDiffuseMap.value = 1.0;
        });
      }
      if (texConfig?.clouds && surfaceMaterial.uniforms.uCloudsMap) {
        getOrLoadCachedTexture(texConfig.clouds).then((tex) => {
          if (isDisposed || !tex) return;
          surfaceMaterial.uniforms.uCloudsMap.value = tex;
          surfaceMaterial.uniforms.uHasCloudsMap.value = 1.0;
        });
      }
      if (texConfig?.night && surfaceMaterial.uniforms.uNightMap) {
        getOrLoadCachedTexture(texConfig.night).then((tex) => {
          if (isDisposed || !tex) return;
          surfaceMaterial.uniforms.uNightMap.value = tex;
          surfaceMaterial.uniforms.uHasNightMap.value = 1.0;
        });
      }
      if (texConfig?.aux && surfaceMaterial.uniforms.uAuxMap) {
        getOrLoadCachedTexture(texConfig.aux).then((tex) => {
          if (isDisposed || !tex) return;
          surfaceMaterial.uniforms.uAuxMap.value = tex;
          surfaceMaterial.uniforms.uHasAuxMap.value = 1.0;
        });
      }
      if (texConfig?.normal && surfaceMaterial.uniforms.uNormalMap) {
        getOrLoadCachedTexture(texConfig.normal).then((tex) => {
          if (isDisposed || !tex) return;
          surfaceMaterial.uniforms.uNormalMap.value = tex;
          surfaceMaterial.uniforms.uHasNormalMap.value = 1.0;
        });
      }

      const geo = body.category === 'moon' ? sphereGeometryHigh : sphereGeometryUltra;
      const spinMesh = new THREE.Mesh(geo, surfaceMaterial);
      spinMesh.userData = { bodyId: body.id, kind: 'celestial_body' };

      if (body.id === 'jupiter') spinMesh.scale.set(1, 0.935, 1);
      if (body.id === 'saturn') spinMesh.scale.set(1, 0.902, 1);
      if (body.id === 'haumea') spinMesh.scale.set(1.42, 0.72, 0.96);
      if (body.category === 'galaxy') {
        spinMesh.visible = false; // Hide planetary sphere inside galaxies — only show the realistic 3D volumetric starfield!
        spinMesh.scale.setScalar(0.9);
      }

      tiltGroup.add(spinMesh);
      if (body.category !== 'galaxy') {
        clickableMeshes.push(spinMesh);
      }

      let galaxyVolumetricGroup: THREE.Group | undefined;
      if (body.category === 'galaxy') {
        galaxyVolumetricGroup = createRealistic3DGalaxyGroup(body, {
          starCount: perf.galaxyStarCount,
          diskLayers: perf.galaxyDiskLayers,
          highQualityShader: perf.tier !== 'low',
          pixelRatio: activeDpr,
        });
        tiltGroup.add(galaxyVolumetricGroup);
      }

      // SUN SPECIAL FEATURES: Volumetric Corona + 3D Magnetic Prominence Loops + Solar Storm CME Particles
      let atmosphereMesh: THREE.Mesh | undefined;
      let solarProminenceMat: THREE.ShaderMaterial | undefined;
      let solarStormParticles: THREE.Points | undefined;

      if (body.id === 'sun') {
        const coronaMat = createSolarCoronaMaterial();
        atmosphereMesh = new THREE.Mesh(sphereGeometryUltra, coronaMat);
        atmosphereMesh.scale.setScalar(1.34);
        tiltGroup.add(atmosphereMesh);

        // 3D Magnetic Prominence Loops (erupting solar storm arches around active latitudes)
        solarProminenceMat = createSolarProminenceMaterial();
        const prominenceConfigs = [
          { lat: 18, lon: 25, height: 0.24, span: 22 },
          { lat: -22, lon: 110, height: 0.28, span: 26 },
          { lat: 14, lon: 205, height: 0.21, span: 18 },
          { lat: -16, lon: 295, height: 0.26, span: 24 },
          { lat: 28, lon: 155, height: 0.19, span: 16 },
        ];

        prominenceConfigs.forEach((cfg) => {
          const archPts: THREE.Vector3[] = [];
          const steps = 24;
          for (let s = 0; s <= steps; s++) {
            const u = s / steps;
            const lonDeg = cfg.lon + (u - 0.5) * cfg.span;
            const latDeg = cfg.lat + Math.sin(u * Math.PI) * 6.0;
            const r = 0.98 + Math.sin(u * Math.PI) * cfg.height;
            const latR = THREE.MathUtils.degToRad(latDeg);
            const lonR = THREE.MathUtils.degToRad(lonDeg);
            archPts.push(
              new THREE.Vector3(
                r * Math.cos(latR) * Math.cos(lonR),
                r * Math.sin(latR),
                r * Math.cos(latR) * Math.sin(lonR)
              )
            );
          }
          const archCurve = new THREE.CatmullRomCurve3(archPts);
          const tubeGeo = new THREE.TubeGeometry(archCurve, 32, 0.018, 8, false);
          const tubeMesh = new THREE.Mesh(tubeGeo, solarProminenceMat);
          spinMesh.add(tubeMesh);
        });

        // 3D Coronal Mass Ejection (CME) / Solar Wind Storm Particles
        const cmeCount = perf.cmeParticleCount;
        const cmePos = new Float32Array(cmeCount * 3);
        const cmeCol = new Float32Array(cmeCount * 3);
        for (let i = 0; i < cmeCount; i++) {
          const r = 1.02 + Math.pow(Math.random(), 1.5) * 0.65;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          cmePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
          cmePos[i * 3 + 1] = r * Math.cos(phi);
          cmePos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

          const intensity = 1.0 - (r - 1.02) / 0.65;
          cmeCol[i * 3] = 1.0;
          cmeCol[i * 3 + 1] = 0.35 + intensity * 0.55;
          cmeCol[i * 3 + 2] = intensity * 0.25;
        }
        const cmeGeo = new THREE.BufferGeometry();
        cmeGeo.setAttribute('position', new THREE.BufferAttribute(cmePos, 3));
        cmeGeo.setAttribute('color', new THREE.BufferAttribute(cmeCol, 3));
        const cmeMat = new THREE.PointsMaterial({
          map: softCircleSprite,
          size: 0.055,
          vertexColors: true,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        solarStormParticles = new THREE.Points(cmeGeo, cmeMat);
        tiltGroup.add(solarStormParticles);
      } else if (body.category !== 'galaxy' && body.atmosphere.hasAtmosphere) {
        const atmoMat = createAtmosphereHaloMaterial(body.atmosphereColorHex);
        atmosphereMesh = new THREE.Mesh(sphereGeometryHigh, atmoMat);
        atmosphereMesh.scale.setScalar(1.028);
        tiltGroup.add(atmosphereMesh);
      }

      // CERES SPECIAL FEATURE: Local 3D Sculpted Asteroid Field Cluster surrounding Ceres in the Main Belt
      let ceresAsteroidCluster: THREE.Group | undefined;
      if (body.id === 'ceres') {
        ceresAsteroidCluster = new THREE.Group();
        populateRealisticAsteroidBeltGroup(
          ceresAsteroidCluster,
          asteroidBeltShaderMat,
          perf.ceresClusterCount,
          1.5,
          5.5,
          0.45,
          0.015,
          0.075,
          false
        );
        tiltGroup.add(ceresAsteroidCluster);
      }

      // SATURN SPECIAL EXPERIENCE: High-Definition Ring Shader + Proportional Sculpted 3D Asteroid & Ice Fragments
      let saturnRingShaderMesh: THREE.Mesh | undefined;
      let saturnRingShaderMat: THREE.ShaderMaterial | undefined;
      let saturnBouldersGroup: THREE.Group | undefined;

      if (body.id === 'saturn') {
        const innerR = 1.18;
        const outerR = 2.42;
        const ringGeo = new THREE.RingGeometry(innerR, outerR, perf.ringSegments, 10);
        saturnRingShaderMat = createSaturnRingsShaderMaterial(1.0);
        saturnRingShaderMesh = new THREE.Mesh(ringGeo, saturnRingShaderMat);
        saturnRingShaderMesh.rotation.x = Math.PI / 2;
        tiltGroup.add(saturnRingShaderMesh);

        saturnBouldersGroup = new THREE.Group();
        populateSaturnRing3DAsteroidFragments(
          saturnBouldersGroup,
          saturnBoulderShaderMat,
          innerR,
          outerR,
          perf.saturnBouldersCount
        );
        tiltGroup.add(saturnBouldersGroup);
      }

      if (body.id === 'uranus' || body.id === 'neptune' || body.id === 'haumea') {
        const uRingGeo = new THREE.RingGeometry(
          body.id === 'haumea' ? 1.55 : 1.38,
          body.id === 'uranus' ? 1.95 : body.id === 'haumea' ? 1.82 : 1.78,
          perf.tier === 'low' ? 56 : 88
        );
        const uRingMat = new THREE.MeshBasicMaterial({
          color: body.id === 'uranus' ? '#67e8f9' : body.id === 'haumea' ? '#e2e8f0' : '#60a5fa',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: body.id === 'uranus' ? 0.24 : body.id === 'haumea' ? 0.35 : 0.14,
        });
        const uRingMesh = new THREE.Mesh(uRingGeo, uRingMat);
        uRingMesh.rotation.x = Math.PI / 2;
        tiltGroup.add(uRingMesh);
      }

      let enceladusPlumePoints: THREE.Points | undefined;
      if (body.id === 'enceladus') {
        const plumeCount = perf.enceladusPlumeCount;
        const plumePos = new Float32Array(plumeCount * 3);
        for (let i = 0; i < plumeCount; i++) {
          const dist = Math.random() * 1.45;
          const spread = dist * 0.28;
          plumePos[i * 3] = (Math.random() - 0.5) * spread;
          plumePos[i * 3 + 1] = -1.0 - dist;
          plumePos[i * 3 + 2] = (Math.random() - 0.5) * spread;
        }
        const plumeGeo = new THREE.BufferGeometry();
        plumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3));
        const plumeMat = new THREE.PointsMaterial({
          map: softCircleSprite,
          color: '#bae6fd',
          size: 0.045,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        enceladusPlumePoints = new THREE.Points(plumeGeo, plumeMat);
        tiltGroup.add(enceladusPlumePoints);
      }

      // 3D INTERIOR CUTAWAY CROSS-SECTION GROUP
      const interiorCutawayGroup = new THREE.Group();
      interiorCutawayGroup.visible = false;
      tiltGroup.add(interiorCutawayGroup);

      body.interiorLayers.forEach((layer, idx) => {
        const r = Math.max(0.08, layer.outerRadiusRatio * 0.992);
        const layerMat = new THREE.MeshBasicMaterial({
          color: layer.colorHex,
        });
        const clipThreshold = (body.interiorLayers.length - 1 - idx) * 0.04;
        layerMat.onBeforeCompile = (shader) => {
          shader.vertexShader =
            'varying vec3 vCutPos;\n' +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\nvCutPos = normalize(position);'
            );
          shader.fragmentShader =
            `varying vec3 vCutPos;\n` +
            shader.fragmentShader
              .replace(
                '#include <dithering_fragment>',
                `
              if (idx_cut > 0.0 && vCutPos.x > ${clipThreshold.toFixed(3)} && vCutPos.y > -0.10 && vCutPos.z > ${clipThreshold.toFixed(3)}) {
                discard;
              }
              #include <dithering_fragment>
              `
              )
              .replace('idx_cut', idx === 0 ? '0.0' : '1.0');
        };

        const layerMesh = new THREE.Mesh(interiorSphereGeo, layerMat);
        layerMesh.scale.setScalar(r);
        layerMesh.userData = {
          kind: 'interior_layer',
          bodyId: body.id,
          layerId: layer.id,
        };
        interiorCutawayGroup.add(layerMesh);
        interiorLayerMeshes.push(layerMesh);

        const innerR = layer.innerRadiusRatio * 0.992;
        const ringFaceGeo = new THREE.RingGeometry(innerR, r, perf.tier === 'low' ? 28 : 44, 1, 0, Math.PI * 0.56);
        const ringFaceMat = new THREE.MeshBasicMaterial({
          color: layer.colorHex,
          side: THREE.DoubleSide,
        });

        const faceXY = new THREE.Mesh(ringFaceGeo, ringFaceMat);
        faceXY.rotation.z = -0.12;
        faceXY.userData = { kind: 'interior_layer', bodyId: body.id, layerId: layer.id };
        interiorCutawayGroup.add(faceXY);
        interiorLayerMeshes.push(faceXY);

        const faceYZ = new THREE.Mesh(ringFaceGeo, ringFaceMat.clone());
        faceYZ.rotation.y = -Math.PI / 2;
        faceYZ.rotation.z = -0.12;
        faceYZ.userData = { kind: 'interior_layer', bodyId: body.id, layerId: layer.id };
        interiorCutawayGroup.add(faceYZ);
        interiorLayerMeshes.push(faceYZ);
      });

      // KEPLERIAN ORBIT LINE IN TRUE 1:1 ASTRONOMICAL SCALE
      const orbitPoints = generateKeplerianOrbitCurvePoints(body, 'TRUE_1_TO_1', perf.orbitSegments).map(
        ([x, y, z]) => new THREE.Vector3(x, y, z)
      );
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: body.orbitColorHex,
        transparent: true,
        opacity: body.category === 'moon' ? 0.32 : 0.35,
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      orbitLine.visible = body.id !== 'sun' && body.category !== 'galaxy';
      scene.add(orbitLine);

      scene.add(rootGroup);

      bodyNodes[body.id] = {
        data: body,
        rootGroup,
        tiltGroup,
        spinMesh,
        surfaceMaterial,
        atmosphereMesh,
        solarProminenceMat,
        solarStormParticles,
        saturnRingShaderMesh,
        saturnRingShaderMat,
        saturnBouldersGroup,
        ceresAsteroidCluster,
        galaxyVolumetricGroup,
        enceladusPlumePoints,
        interiorCutawayGroup,
        orbitLine,
        orbitScaleModeBuilt: 'TRUE_1_TO_1',
      };
    });

    // EARTH ARTIFICIAL SATELLITES 3D GROUP (Detailed 3D Spacecraft Models + Calm Orbital Tracks)
    const satelliteGroup = new THREE.Group();
    scene.add(satelliteGroup);

    const activeSatelliteOrbitLineGeo = new THREE.BufferGeometry();
    const activeSatelliteOrbitLineMat = new THREE.LineBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.9,
    });
    const activeSatelliteOrbitLine = new THREE.Line(
      activeSatelliteOrbitLineGeo,
      activeSatelliteOrbitLineMat
    );
    satelliteGroup.add(activeSatelliteOrbitLine);

    const satModelMap: Record<string, THREE.Group> = {};
    const satFaintOrbitMap: Record<string, THREE.Line> = {};

    // SPACE MISSIONS TRAJECTORIES GROUP
    const missionsGroup = new THREE.Group();
    scene.add(missionsGroup);
    const missionLines: Record<string, { line: THREE.Line; scaleBuilt: ScaleMode }> = {};

    SPACE_MISSIONS.forEach((mission) => {
      const pts = getMissionTrajectoryScenePoints(mission, 'TRUE_1_TO_1').map(
        ([x, y, z]) => new THREE.Vector3(x, y, z)
      );
      const curve = new THREE.CatmullRomCurve3(pts);
      const smoothPts = curve.getPoints(90);
      const geo = new THREE.BufferGeometry().setFromPoints(smoothPts);
      const mat = new THREE.LineDashedMaterial({
        color: mission.colorHex,
        dashSize: 12.0,
        gapSize: 6.0,
        transparent: true,
        opacity: 0.78,
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      missionsGroup.add(line);
      missionLines[mission.id] = { line, scaleBuilt: 'TRUE_1_TO_1' };
    });

    // UPGRADED CINEMATIC SPACETIME WARP TUNNEL (Volumetric Shader Cylinder + Relativistic Star Streaks)
    const warpTunnelGroup = new THREE.Group();
    warpTunnelGroup.visible = false;
    scene.add(warpTunnelGroup);

    const warpCylGeo = new THREE.CylinderGeometry(3.2, 1.4, 42, perf.tier === 'low' ? 24 : 40, 16, true);
    warpCylGeo.rotateX(Math.PI / 2);
    const warpCylMat = createWarpTunnelShaderMaterial();
    const warpCylMesh = new THREE.Mesh(warpCylGeo, warpCylMat);
    warpTunnelGroup.add(warpCylMesh);

    const warpStreakCount = perf.tier === 'low' ? 420 : perf.tier === 'medium' ? 680 : 900;
    const warpPositions = new Float32Array(warpStreakCount * 6);
    const warpColors = new Float32Array(warpStreakCount * 6);

    for (let i = 0; i < warpStreakCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.8 + Math.random() * 5.2;
      const zStart = (Math.random() - 0.5) * 38.0;
      const streakLen = 3.0 + Math.random() * 6.0;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      warpPositions[i * 6] = x;
      warpPositions[i * 6 + 1] = y;
      warpPositions[i * 6 + 2] = zStart;
      warpPositions[i * 6 + 3] = x;
      warpPositions[i * 6 + 4] = y;
      warpPositions[i * 6 + 5] = zStart - streakLen;

      warpColors[i * 6] = 0.75;
      warpColors[i * 6 + 1] = 0.92;
      warpColors[i * 6 + 2] = 1.0;
      warpColors[i * 6 + 3] = 0.1;
      warpColors[i * 6 + 4] = 0.35;
      warpColors[i * 6 + 5] = 0.85;
    }

    const warpGeo = new THREE.BufferGeometry();
    warpGeo.setAttribute('position', new THREE.BufferAttribute(warpPositions, 3));
    warpGeo.setAttribute('color', new THREE.BufferAttribute(warpColors, 3));
    const warpMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const warpLines = new THREE.LineSegments(warpGeo, warpMat);
    warpTunnelGroup.add(warpLines);

    // SR-7 EXPLORER 3D SPACECRAFT & INTERACTIVE COCKPIT + VENTRAL PULSE PROJECTILES
    const sr7 = createSR7Spacecraft3DGroup();
    sr7.rootGroup.scale.setScalar(0.34);
    sr7.rootGroup.visible = false;
    scene.add(sr7.rootGroup);

    const projectileGroup = new THREE.Group();
    scene.add(projectileGroup);

    interface ActivePulseBolt {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      age: number;
    }
    const activePulseBolts: ActivePulseBolt[] = [];
    const pulseBoltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8);
    pulseBoltGeo.rotateX(Math.PI / 2);
    const pulseBoltMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    // 6-DOF Spacecraft Flight Physics State
    const pressedKeys = new Set<string>();
    const shipVelocity = new THREE.Vector3();
    let angVelPitch = 0;
    let angVelYaw = 0;
    let angVelRoll = 0;
    let boostBlend = 0;
    let continuousThrottle = 0;
    let lastSyncedReactThrottle = 0;
    let throttleSyncTimer = 0;
    let lastManualOrbitTimestamp = 0;
    let wasSpacecraftActive = false;
    let prevCameraView: 'COCKPIT' | 'EXTERNAL' = 'EXTERNAL';
    let lastFirePulseCount = 0;
    let muzzleFlashAlpha = 0;
    let isCockpitDragging = false;
    let cockpitDragOriginX = 0;
    let cockpitDragOriginY = 0;
    let cockpitDragSteerX = 0;
    let cockpitDragSteerY = 0;
    let cockpitSteerSmoothX = 0;
    let cockpitSteerSmoothY = 0;
    let currentShipScale = 0.000035;
    let lastTelemetrySync = 0;
    let prevRecenterTrigger = stateRef.current.spacecraftControl.recenterTrigger || 0;
    let prevRadarAudioTs = 0;
    let prevBrakeAudio = false;
    let prevAutopilotIdAudio: string | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      spaceAudio.unlock();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!stateRef.current.spacecraftControl.isActive) return;

      pressedKeys.add(e.code);

      if (e.code === 'Space') {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        continuousThrottle = 0;
        lastSyncedReactThrottle = 0;
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          throttle: 0,
          boostActive: false,
          autopilotTargetId: null,
          brakeRequested: true,
        }));
      } else if (e.code === 'KeyL') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          headlightsOn: !prev.headlightsOn,
        }));
      } else if (e.code === 'KeyZ') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          sasEnabled: !prev.sasEnabled,
        }));
      } else if (e.code === 'KeyR') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          radarPulseTimestamp: performance.now(),
        }));
      } else if (e.code === 'KeyV') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          cameraView: prev.cameraView === 'COCKPIT' ? 'EXTERNAL' : 'COCKPIT',
        }));
      } else if (e.code === 'KeyC') {
        lastManualOrbitTimestamp = 0;
        prevCameraView = 'COCKPIT';
      } else if (e.code === 'KeyF') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          firePulseCount: prev.firePulseCount + 1,
        }));
      } else if (e.code === 'KeyI') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          interiorLightsOn: !prev.interiorLightsOn,
        }));
      } else if (e.code === 'KeyW' && !e.repeat) {
        continuousThrottle = Math.min(1, Number((continuousThrottle + 0.08).toFixed(2)));
        lastSyncedReactThrottle = continuousThrottle;
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          brakeRequested: false,
          throttle: continuousThrottle,
        }));
      } else if (e.code === 'KeyS' && !e.repeat) {
        continuousThrottle = Math.max(-0.5, Number((continuousThrottle - 0.08).toFixed(2)));
        lastSyncedReactThrottle = continuousThrottle;
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          brakeRequested: false,
          throttle: continuousThrottle,
        }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // RAYCASTING FOR CLICK SELECTION
    const raycaster = new THREE.Raycaster();
    const pointerDownPos = new THREE.Vector2();

    const handlePointerDown = (e: MouseEvent) => {
      spaceAudio.unlock();
      pointerDownPos.set(e.clientX, e.clientY);
      if (
        stateRef.current.spacecraftControl.isActive &&
        stateRef.current.spacecraftControl.cameraView === 'COCKPIT'
      ) {
        isCockpitDragging = true;
        cockpitDragOriginX = e.clientX;
        cockpitDragOriginY = e.clientY;
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!isCockpitDragging) return;
      if ((e.buttons & 1) === 0) {
        isCockpitDragging = false;
        cockpitDragSteerX = 0;
        cockpitDragSteerY = 0;
        return;
      }
      const dx = e.clientX - cockpitDragOriginX;
      const dy = e.clientY - cockpitDragOriginY;
      if (Math.hypot(dx, dy) < 4) return;
      cockpitDragSteerX = THREE.MathUtils.clamp(-dx * 0.008, -1.1, 1.1);
      cockpitDragSteerY = THREE.MathUtils.clamp(-dy * 0.008, -1.1, 1.1);
    };

    const handlePointerUp = (e: MouseEvent) => {
      isCockpitDragging = false;
      cockpitDragSteerX = 0;
      cockpitDragSteerY = 0;

      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);

      if (stateRef.current.spacecraftControl.isActive) {
        const cockpitHits = raycaster.intersectObjects(sr7.clickableCockpitControls, false);
        if (cockpitHits.length > 0) {
          const action = cockpitHits[0].object.userData?.action;
          if (action === 'headlights') {
            callbacksRef.current.onUpdateSpacecraftControl((p) => {
              spaceAudio.playCockpitSwitch(!p.headlightsOn);
              return { ...p, headlightsOn: !p.headlightsOn };
            });
            return;
          }
          if (action === 'sas') {
            callbacksRef.current.onUpdateSpacecraftControl((p) => {
              spaceAudio.playCockpitSwitch(!p.sasEnabled);
              return { ...p, sasEnabled: !p.sasEnabled };
            });
            return;
          }
          if (action === 'interior_lights') {
            callbacksRef.current.onUpdateSpacecraftControl((p) => {
              spaceAudio.playCockpitSwitch(!p.interiorLightsOn);
              return { ...p, interiorLightsOn: !p.interiorLightsOn };
            });
            return;
          }
          if (action === 'shields') {
            callbacksRef.current.onUpdateSpacecraftControl((p) => {
              spaceAudio.playCockpitSwitch(!p.shieldsOn);
              return { ...p, shieldsOn: !p.shieldsOn };
            });
            return;
          }
          if (action === 'scanner') {
            spaceAudio.playCockpitSwitch(true);
            callbacksRef.current.onUpdateSpacecraftControl((p) => ({
              ...p,
              radarPulseTimestamp: performance.now(),
            }));
            return;
          }
          if (action === 'boost') {
            callbacksRef.current.onUpdateSpacecraftControl((p) => {
              spaceAudio.playCockpitSwitch(!p.boostActive);
              return { ...p, boostActive: !p.boostActive };
            });
            return;
          }
          if (action === 'fire') {
            callbacksRef.current.onUpdateSpacecraftControl((p) => ({
              ...p,
              firePulseCount: p.firePulseCount + 1,
            }));
            return;
          }
          if (action === 'throttle_step') {
            spaceAudio.playCockpitSwitch(true);
            callbacksRef.current.onUpdateSpacecraftControl((p) => ({
              ...p,
              brakeRequested: false,
              throttle: p.throttle < 0.4 ? 0.5 : p.throttle < 0.9 ? 1.0 : 0,
            }));
            return;
          }
        }
      }

      if (stateRef.current.isExploringInterior) {
        const layerHits = raycaster.intersectObjects(interiorLayerMeshes, false);
        const validLayerHit = layerHits.find(
          (h) => h.object.userData?.bodyId === stateRef.current.selectedBodyId
        );
        if (validLayerHit && validLayerHit.object.userData?.layerId) {
          callbacksRef.current.onSelectInteriorLayer(validLayerHit.object.userData.layerId);
          return;
        }
      }

      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const bodyId = hits[0].object.userData?.bodyId;
        if (bodyId) {
          if (stateRef.current.spacecraftControl.isActive) {
            callbacksRef.current.onUpdateSpacecraftControl((p) => ({
              ...p,
              autopilotTargetId: bodyId,
            }));
          } else {
            callbacksRef.current.onSelectBody(
              bodyId,
              bodyId !== stateRef.current.selectedBodyId
            );
          }
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      spaceAudio.unlock();
      if (
        stateRef.current.spacecraftControl.isActive &&
        stateRef.current.spacecraftControl.cameraView === 'COCKPIT' &&
        e.touches.length === 1
      ) {
        isCockpitDragging = true;
        cockpitDragOriginX = e.touches[0].clientX;
        cockpitDragOriginY = e.touches[0].clientY;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isCockpitDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - cockpitDragOriginX;
      const dy = e.touches[0].clientY - cockpitDragOriginY;
      if (Math.hypot(dx, dy) < 4) return;
      cockpitDragSteerX = THREE.MathUtils.clamp(-dx * 0.008, -1.1, 1.1);
      cockpitDragSteerY = THREE.MathUtils.clamp(-dy * 0.008, -1.1, 1.1);
    };
    const handleTouchEnd = () => {
      isCockpitDragging = false;
      cockpitDragSteerX = 0;
      cockpitDragSteerY = 0;
    };

    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('mouseup', handlePointerUp);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    renderer.domElement.addEventListener('touchend', handleTouchEnd);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // MAIN 60FPS RENDER LOOP & POOLED ZERO-ALLOCATION SCRATCH MEMORY
    let animationFrameId = 0;
    let clockTime = 0;
    let lastTimestamp = performance.now();
    let lastSimSyncTimestamp = performance.now();
    let labelFrameCounter = 0;
    const previousTargetWorldPos = new THREE.Vector3();
    let hasInitializedTargetPos = false;
    const warpStartCameraPos = new THREE.Vector3();
    let wasWarpingLastFrame = false;
    let lastScaleReadout = '';
    let lastDrawnSatTrackId: string | null = null;
    let lastDrawnSatArrayRef: PropagatedSatellite[] | null = null;
    let lastAdaptiveNear = camera.near;

    // Pre-allocated body positions & pooled math temps (eliminates per-frame GC stutters on mobile!)
    const bodyWorldPositions: Record<string, THREE.Vector3> = {};
    ALL_CELESTIAL_BODIES.forEach((b) => {
      bodyWorldPositions[b.id] = new THREE.Vector3();
    });

    const _sunViewPos = new THREE.Vector3();
    const _planetViewPos = new THREE.Vector3();
    const _originVec = new THREE.Vector3(0, 0, 0);
    const _worldUp = new THREE.Vector3(0, 1, 0);
    const _zAxis = new THREE.Vector3(0, 0, 1);
    const _tmpV1 = new THREE.Vector3();
    const _tmpV2 = new THREE.Vector3();
    const _tmpV3 = new THREE.Vector3();
    const _tmpV4 = new THREE.Vector3();
    const _tmpV5 = new THREE.Vector3();
    const _tmpV6 = new THREE.Vector3();
    const _tmpMat4 = new THREE.Matrix4();
    const _tmpQuat1 = new THREE.Quaternion();
    const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const _projVec = new THREE.Vector3();

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;
      clockTime += dt;

      const st = stateRef.current;
      const cb = callbacksRef.current;

      // Advance simulation time smoothly (sync UI at ~1Hz outside active flight/warp to avoid mobile React stalls)
      if (!st.isPaused) {
        if (st.timeSpeedDaysPerSec === 0) {
          internalSimTimeRef.current += dt * 1000;
        } else {
          internalSimTimeRef.current += st.timeSpeedDaysPerSec * 86_400_000 * dt;
        }
        if (
          now - lastSimSyncTimestamp > 1000 &&
          !st.spacecraftControl.isActive &&
          !st.warpState.isActive
        ) {
          lastSimSyncTimestamp = now;
          cb.onSyncSimulationTime(internalSimTimeRef.current);
        }
      }

      const currentSimTimeMs = internalSimTimeRef.current;

      // Multi-Scale Hierarchy Cross-Fade Factors based on distance from Solar System origin (0, 0, 0)
      const distFromOrigin = camera.position.length();
      const selectedBodyObj = getCelestialBody(st.selectedBodyId);
      const isSelectedGalaxy = selectedBodyObj.category === 'galaxy';
      const galThresholds = getGalacticFadeThresholds(st.scaleMode);
      const macroGalaxyFade = isSelectedGalaxy
        ? Math.max(0.85, THREE.MathUtils.smoothstep(distFromOrigin, 120, 420))
        : THREE.MathUtils.smoothstep(distFromOrigin, galThresholds.fadeStart, galThresholds.fadeEnd);
      const solarSystemMacroFade = isSelectedGalaxy
        ? 1.0 - THREE.MathUtils.smoothstep(distFromOrigin, 220, 620)
        : 1.0 - THREE.MathUtils.smoothstep(distFromOrigin, galThresholds.fadeStart * 1.05, galThresholds.fadeEnd * 1.15);

      // Keep 360° Deep Space Skybox & star sphere centered on camera for infinite parallax depth
      starGroup.position.copy(camera.position);
      skyboxMat.uniforms.uMacroGalaxyFade.value = macroGalaxyFade;
      starMaterial.uniforms.uTime.value = clockTime;

      beltGroup.visible = st.showAsteroidBelt && solarSystemMacroFade > 0.04;
      if (beltGroup.visible) {
        mainAsteroidBelt.rotation.y = clockTime * 0.003;
      }

      ALL_CELESTIAL_BODIES.forEach((body) => {
        const node = bodyNodes[body.id];
        if (!node) return;

        const [x, y, z] = computeKeplerianPosition3D(body, currentSimTimeMs, st.scaleMode);
        node.rootGroup.position.set(x, y, z);
        bodyWorldPositions[body.id].set(x, y, z);

        if (body.category === 'moon' && body.parentId && bodyWorldPositions[body.parentId]) {
          node.orbitLine.position.copy(bodyWorldPositions[body.parentId]);
          const showMoonOrbit =
            st.showOrbits &&
            solarSystemMacroFade > 0.02 &&
            (st.selectedBodyId === body.parentId || st.selectedBodyId === body.id);
          node.orbitLine.visible = showMoonOrbit;
          if (showMoonOrbit) {
            (node.orbitLine.material as THREE.LineBasicMaterial).opacity = 0.32 * solarSystemMacroFade;
          }
        } else {
          node.orbitLine.position.set(0, 0, 0);
          const showBodyOrbit =
            st.showOrbits &&
            solarSystemMacroFade > 0.02 &&
            body.id !== 'sun' &&
            body.category !== 'galaxy';
          node.orbitLine.visible = showBodyOrbit;
          if (showBodyOrbit) {
            (node.orbitLine.material as THREE.LineBasicMaterial).opacity = 0.36 * solarSystemMacroFade;
          }
        }

        const radius = getScaledRadius(body, st.scaleMode);
        node.tiltGroup.scale.setScalar(radius);

        // CALM, REALISTIC PLANETARY ROTATION:
        const daysSinceJ2000 = (currentSimTimeMs - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86_400_000;
        const rotDays = body.siderealRotationHours / 24.0;
        const sereneDrift = clockTime * (body.id === 'sun' ? 0.008 : 0.0045);

        const toSunAzimuth = Math.atan2(-x, -z);
        let baseAngleRad =
          rotDays !== 0 ? ((daysSinceJ2000 / rotDays) * Math.PI * 2) % (Math.PI * 2) : 0;

        if (body.id === 'earth' && st.timeSpeedDaysPerSec === 0) {
          baseAngleRad = toSunAzimuth + 0.28;
        } else if (body.id === 'moon' && st.timeSpeedDaysPerSec === 0) {
          baseAngleRad = toSunAzimuth - Math.PI * 0.38;
        }

        const isSelected = st.selectedBodyId === body.id;
        const isCutaway = isSelected && st.isExploringInterior;

        if (!isCutaway) {
          node.spinMesh.rotation.y = baseAngleRad + sereneDrift;
        } else {
          node.spinMesh.rotation.y = -0.35;
        }

        // Update shaders & distance-aware visibility cleanly (saves dozens of distant draw calls on mobile)
        if (body.category === 'galaxy') {
          if (node.galaxyVolumetricGroup) {
            if (body.id !== 'milky-way') {
              node.galaxyVolumetricGroup.rotation.y = clockTime * 0.006;
            }
            setGalaxyGroupOpacity(node.galaxyVolumetricGroup, macroGalaxyFade);
          }
          node.rootGroup.visible = macroGalaxyFade > 0.004;
        } else if (body.id === 'sun') {
          node.rootGroup.visible = isSelected || distFromOrigin < galThresholds.fadeEnd * 2.5;
          if (node.rootGroup.visible) {
            node.surfaceMaterial.uniforms.uTime.value = clockTime;
            if (node.atmosphereMesh) {
              (node.atmosphereMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = clockTime;
            }
            if (node.solarProminenceMat) {
              node.solarProminenceMat.uniforms.uTime.value = clockTime;
            }
            if (node.solarStormParticles) {
              node.solarStormParticles.rotation.y = clockTime * 0.025;
              node.solarStormParticles.rotation.z = Math.sin(clockTime * 0.2) * 0.05;
            }
          }
        } else {
          let isVisible = isSelected || solarSystemMacroFade > 0.01;
          if (isVisible && body.category === 'moon' && body.parentId && bodyWorldPositions[body.parentId]) {
            const moonOrbitU = body.orbit.semiMajorAxisAU * 149.59787;
            const camDistToParent = camera.position.distanceTo(bodyWorldPositions[body.parentId]);
            isVisible =
              isSelected ||
              st.selectedBodyId === body.parentId ||
              camDistToParent < Math.max(1.5, moonOrbitU * 16);
          }
          node.rootGroup.visible = isVisible;

          if (isVisible) {
            node.surfaceMaterial.uniforms.uTime.value = clockTime;
            if (node.surfaceMaterial.uniforms.uVenusRadarMode) {
              node.surfaceMaterial.uniforms.uVenusRadarMode.value =
                body.id === 'venus' && st.venusRadarMode ? 1.0 : 0.0;
            }
            if (node.surfaceMaterial.uniforms.uCutawayEnabled) {
              node.surfaceMaterial.uniforms.uCutawayEnabled.value = isCutaway ? 1.0 : 0.0;
            }
          }
        }

        if (node.ceresAsteroidCluster && node.rootGroup.visible) {
          const camDistCeres = camera.position.distanceTo(node.rootGroup.position);
          node.ceresAsteroidCluster.visible =
            st.selectedBodyId === 'ceres' || camDistCeres < Math.max(0.25, radius * 45);
        }

        if (node.enceladusPlumePoints && node.rootGroup.visible) {
          const camDistEnc = camera.position.distanceTo(node.rootGroup.position);
          node.enceladusPlumePoints.visible =
            st.selectedBodyId === 'enceladus' || st.selectedBodyId === 'saturn' || camDistEnc < radius * 28;
        }

        node.interiorCutawayGroup.visible = isCutaway;

        // Saturn special rings & sculpted 3D boulder distance culling
        if (body.id === 'saturn' && node.rootGroup.visible) {
          if (node.saturnRingShaderMat) {
            node.saturnRingShaderMat.uniforms.uPlanetPosition.value.copy(node.rootGroup.position);
            node.saturnRingShaderMat.uniforms.uPlanetRadius.value = radius;
            node.saturnRingShaderMat.uniforms.uInnerRadius.value = 1.18;
            node.saturnRingShaderMat.uniforms.uOuterRadius.value = 2.42;
          }
          saturnBoulderShaderMat.uniforms.uPlanetPosition.value.copy(node.rootGroup.position);
          saturnBoulderShaderMat.uniforms.uPlanetRadius.value = radius;
          if (node.saturnBouldersGroup) {
            const camDistSaturn = camera.position.distanceTo(node.rootGroup.position);
            node.saturnBouldersGroup.visible = camDistSaturn < Math.max(0.5, radius * 28);
            if (node.saturnBouldersGroup.visible) {
              node.saturnBouldersGroup.rotation.y = clockTime * 0.028;
            }
          }
        }
      });

      // Update Space Mission 3D Trajectories
      missionsGroup.visible = st.showMissionTrajectories || st.activeMissionId !== null;
      if (missionsGroup.visible) {
        SPACE_MISSIONS.forEach((m) => {
          const mEntry = missionLines[m.id];
          if (!mEntry) return;
          mEntry.line.visible =
            st.showMissionTrajectories || st.activeMissionId === m.id;
          (mEntry.line.material as THREE.LineDashedMaterial).opacity =
            st.activeMissionId === m.id ? 1.0 : 0.52;
        });
      }

      // Position Earth Satellites 3D Spacecraft Models (True 1:1 Altitudes & Cached Orbit Track)
      const earthPos = bodyWorldPositions['earth'];
      if (earthPos) {
        satelliteGroup.position.copy(earthPos);
        const showEarthSats = st.selectedBodyId === 'earth' && !st.isExploringInterior;
        satelliteGroup.visible = showEarthSats;

        if (showEarthSats) {
          const currentEarthRadius = getScaledRadius(getCelestialBody('earth'), st.scaleMode);
          const satRadiusScale = currentEarthRadius / 1.25;
          st.propagatedSatellites.forEach((sat) => {
            let model = satModelMap[sat.id];
            if (!model) {
              model = createDetailedSatellite3DGroup(sat);
              satelliteGroup.add(model);
              satModelMap[sat.id] = model;
            }
            const catVisible = !!st.enabledSatelliteCategories[sat.category];
            model.visible = catVisible;
            if (catVisible) {
              model.position.set(sat.position3D[0], sat.position3D[1], sat.position3D[2]);
              model.lookAt(earthPos);
              const isSelSat = sat.id === st.selectedSatelliteId;
              model.scale.setScalar((isSelSat ? 1.15 : 0.72) * satRadiusScale);
            }

            const faintOrbit = satFaintOrbitMap[sat.id];
            if (faintOrbit) {
              faintOrbit.visible = false;
            }
          });

          const selectedSat = st.propagatedSatellites.find(
            (s) => s.id === st.selectedSatelliteId
          );
          if (selectedSat && selectedSat.orbitTrack3D.length > 1) {
            if (
              lastDrawnSatTrackId !== selectedSat.id ||
              lastDrawnSatArrayRef !== st.propagatedSatellites
            ) {
              const trackVectors = selectedSat.orbitTrack3D.map(
                ([tx, ty, tz]) => new THREE.Vector3(tx, ty, tz)
              );
              activeSatelliteOrbitLine.geometry.setFromPoints(trackVectors);
              activeSatelliteOrbitLineMat.color.set(selectedSat.colorHex);
              lastDrawnSatTrackId = selectedSat.id;
              lastDrawnSatArrayRef = st.propagatedSatellites;
            }
            activeSatelliteOrbitLine.visible = true;
          } else {
            activeSatelliteOrbitLine.visible = false;
          }
        }
      }

      // CINEMATIC INTERPLANETARY WARP FLIGHT OR NORMAL CAMERA TRACKING
      const selectedBody = getCelestialBody(st.selectedBodyId);
      const targetPos = bodyWorldPositions[selectedBody.id] || _originVec;
      const targetRadius = getScaledRadius(selectedBody, st.scaleMode);

      if (st.warpState.isActive) {
        sr7.rootGroup.visible = false;
        shipRimLight.visible = false;
        wasSpacecraftActive = false;
        controls.enabled = true;
        if (!wasWarpingLastFrame) {
          warpStartCameraPos.copy(camera.position);
          wasWarpingLastFrame = true;
        }

        const destPos = bodyWorldPositions[st.warpState.targetId] || _originVec;
        const destBody = getCelestialBody(st.warpState.targetId);
        const destRadius = getScaledRadius(destBody, st.scaleMode);

        const nextProgress = st.warpState.isPaused
          ? st.warpState.progress
          : Math.min(1.0, st.warpState.progress + dt * 0.28 * st.warpState.speedMultiplier);

        // Quintic smoothstep for zero-jerk departure & arrival
        const t = nextProgress;
        const smoothEase = t * t * t * (t * (t * 6 - 15) + 10);

        // Final orbital camera position on the sunlit hemisphere of the destination planet!
        const arrivalOffsetDir = computeSunlitCameraOffsetDir(destPos, destBody.id);
        const mult = destBody.id === 'sun' ? 4.6 : 3.25;
        const goalCamPos = _tmpV1.copy(destPos).addScaledVector(arrivalOffsetDir, destRadius * mult);

        // Interpolate camera directly from actual starting camera position to goalCamPos
        camera.position.lerpVectors(warpStartCameraPos, goalCamPos, smoothEase);

        // Smoothly pan lookAt target toward destination planet
        const lookAtTarget = _tmpV2.lerpVectors(
          controls.target,
          destPos,
          Math.min(1.0, smoothEase * 1.35)
        );
        controls.target.copy(lookAtTarget);
        camera.lookAt(destPos);

        // Dynamic FOV expansion during middle warp phase
        const warpBell = Math.sin(nextProgress * Math.PI);
        camera.fov = 46 + warpBell * 28;
        camera.updateProjectionMatrix();

        // Volumetric Warp Cylinder & Star Streaks aligned with flight vector
        warpTunnelGroup.visible = nextProgress > 0.08 && nextProgress < 0.92;
        warpTunnelGroup.position.copy(camera.position);
        warpTunnelGroup.lookAt(destPos);
        warpCylMat.uniforms.uTime.value = clockTime;
        warpCylMat.uniforms.uIntensity.value = warpBell;
        warpLines.rotation.z = clockTime * 2.2;
        warpMat.opacity = warpBell * 0.72;

        let stage: WarpFlightState['stage'] = 'DEPARTURE';
        let stageLabel = 'Afastamento Orbital e Alinhamento';
        if (nextProgress >= 0.18 && nextProgress < 0.75) {
          stage = 'WARP_TUNNEL';
          stageLabel = 'Travessia Interplanetária em Dobra Espacial';
        } else if (nextProgress >= 0.75) {
          stage = 'ARRIVAL';
          stageLabel = 'Desaceleração e Captura Orbital';
        }

        if (nextProgress >= 1.0) {
          spaceAudio.playWarpArrival();
          wasWarpingLastFrame = false;
          warpTunnelGroup.visible = false;
          camera.fov = 46;
          camera.updateProjectionMatrix();
          previousTargetWorldPos.copy(destPos);
          controls.target.copy(destPos);
          hasInitializedTargetPos = true;
          cameraCommandRef.current.activeTransition = false;
          cb.onUpdateWarpState((prev) => ({
            ...prev,
            isActive: false,
            progress: 1,
            stage: 'IDLE',
          }));
        } else {
          spaceAudio.updateFrame({
            dt,
            clockTime,
            mode: 'WARP',
            warpProgress: nextProgress,
            warpStage: stage,
          });
          if (!st.warpState.isPaused) {
            cb.onUpdateWarpState((prev) => ({
              ...prev,
              progress: nextProgress,
              stage,
              stageLabel,
              apparentSpeedC: Number((warpBell * Math.max(1, prev.distanceAU) * 65).toFixed(1)),
            }));
          }
        }
      } else if (st.spacecraftControl.isActive) {
        wasWarpingLastFrame = false;
        const sc = st.spacecraftControl;

        // Compute true orbital-vessel scale from the most dominant nearby celestial body
        let dominantBody = selectedBody;
        let dominantRadius = Math.max(0.00015, targetRadius);
        let nearestPlanetDist = sr7.rootGroup.position.distanceTo(targetPos);
        let nearestPlanetRadius = Math.max(0.00015, targetRadius);
        let bestProxRatio = Infinity;

        if (wasSpacecraftActive) {
          for (let i = 0; i < ALL_CELESTIAL_BODIES.length; i++) {
            const b = ALL_CELESTIAL_BODIES[i];
            if (b.category === 'galaxy') continue;
            const bPos = bodyWorldPositions[b.id];
            if (!bPos) continue;
            const bRad = Math.max(0.00015, getScaledRadius(b, st.scaleMode));
            const bDist = sr7.rootGroup.position.distanceTo(bPos);
            const ratio = bDist / bRad;
            if (ratio < bestProxRatio) {
              bestProxRatio = ratio;
              dominantBody = b;
              dominantRadius = bRad;
              nearestPlanetDist = bDist;
              nearestPlanetRadius = bRad;
            }
          }
        }

        const effectiveRefRadius =
          dominantBody.category === 'galaxy' || bestProxRatio > 1800
            ? Math.min(0.45, Math.max(0.015, dominantRadius * 0.05))
            : dominantRadius;
        const desiredShipScale = THREE.MathUtils.clamp(
          effectiveRefRadius * 0.0048,
          0.0000035,
          0.0022
        );
        const prevFrameScale = currentShipScale;
        if (!wasSpacecraftActive) {
          currentShipScale = desiredShipScale;
        } else {
          currentShipScale = THREE.MathUtils.lerp(
            currentShipScale,
            desiredShipScale,
            Math.min(1, dt * 3.0)
          );
          // Preserve consistent chase framing if scaling between Sun, Gas Giants, and Rocky Worlds
          if (sc.cameraView === 'EXTERNAL' && prevCameraView === 'EXTERNAL' && prevFrameScale > 0) {
            const scaleRatio = currentShipScale / prevFrameScale;
            if (Math.abs(scaleRatio - 1) > 1e-5) {
              _tmpV2.subVectors(camera.position, sr7.rootGroup.position).multiplyScalar(scaleRatio);
              camera.position.copy(sr7.rootGroup.position).add(_tmpV2);
            }
          }
        }
        sr7.rootGroup.scale.setScalar(currentShipScale);

        // Keep rim lighting subtle and dynamic so PBR metallic bevels gleam cleanly anywhere in deep space
        shipRimLight.visible = true;
        _tmpV2.set(0.45, 0.85, 0.35);
        shipRimLight.position
          .copy(sr7.rootGroup.position)
          .addScaledVector(_tmpV2, currentShipScale * 26);
        shipRimLight.target.position.copy(sr7.rootGroup.position);
        shipRimLight.target.updateMatrixWorld();

        if (!wasSpacecraftActive) {
          const spawnDir = computeSunlitCameraOffsetDir(targetPos, selectedBody.id);
          const spawnDist =
            selectedBody.category === 'galaxy'
              ? targetRadius * 1.45
              : targetRadius * 2.55 + currentShipScale * 7.5;
          sr7.rootGroup.position.copy(targetPos).addScaledVector(spawnDir, spawnDist);
          sr7.rootGroup.lookAt(targetPos);
          shipVelocity.set(0, 0, 0);
          angVelPitch = 0;
          angVelYaw = 0;
          angVelRoll = 0;
          continuousThrottle = sc.throttle;
          lastSyncedReactThrottle = sc.throttle;
          lastManualOrbitTimestamp = 0;
          wasSpacecraftActive = true;
          prevCameraView = sc.cameraView;
          lastFirePulseCount = sc.firePulseCount;
          if (sc.cameraView === 'EXTERNAL') {
            sr7.chaseCameraAnchor.updateWorldMatrix(true, false);
            sr7.chaseCameraAnchor.getWorldPosition(_tmpV2);
            camera.position.copy(_tmpV2);
            controls.target.copy(sr7.rootGroup.position);
          }
        }

        sr7.rootGroup.visible = true;

        // Synchronize smooth keyboard hold throttle (W/S) with HUD slider/presets seamlessly
        if (Math.abs(sc.throttle - lastSyncedReactThrottle) > 0.002) {
          continuousThrottle = sc.throttle;
          lastSyncedReactThrottle = sc.throttle;
        } else {
          const wHeld = pressedKeys.has('KeyW');
          const sHeld = pressedKeys.has('KeyS');
          if (wHeld || sHeld) {
            const deltaT = ((wHeld ? 1 : 0) - (sHeld ? 1 : 0)) * dt * 0.58;
            continuousThrottle = THREE.MathUtils.clamp(continuousThrottle + deltaT, -0.5, 1.0);
            throttleSyncTimer += dt;
            if (throttleSyncTimer > 0.075 && Math.abs(continuousThrottle - lastSyncedReactThrottle) > 0.015) {
              throttleSyncTimer = 0;
              const nextSync = Number(continuousThrottle.toFixed(2));
              lastSyncedReactThrottle = nextSync;
              cb.onUpdateSpacecraftControl((prev) => ({
                ...prev,
                brakeRequested: false,
                throttle: nextSync,
              }));
            }
          }
        }

        // 1. Gather Smooth 6-DOF Attitude Inputs (Newtonian Angular Inertia + SAS Gyro Stabilizer)
        const vSteer = st.virtualSteerInput;
        cockpitSteerSmoothX = THREE.MathUtils.lerp(
          cockpitSteerSmoothX,
          cockpitDragSteerX,
          Math.min(1, dt * 9.5)
        );
        cockpitSteerSmoothY = THREE.MathUtils.lerp(
          cockpitSteerSmoothY,
          cockpitDragSteerY,
          Math.min(1, dt * 9.5)
        );
        if (!isCockpitDragging) {
          const dragDecay = Math.exp(-dt * 9.5);
          cockpitDragSteerX *= dragDecay;
          cockpitDragSteerY *= dragDecay;
        }

        let pitchInput =
          (pressedKeys.has('ArrowUp') ? 1 : 0) -
          (pressedKeys.has('ArrowDown') ? 1 : 0) +
          (vSteer?.pitch || 0) +
          cockpitSteerSmoothY;
        let yawInput =
          (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft') ? 1 : 0) -
          (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight') ? 1 : 0) +
          (vSteer?.yaw || 0) +
          cockpitSteerSmoothX;
        let rollInput =
          (pressedKeys.has('KeyQ') ? 1 : 0) -
          (pressedKeys.has('KeyE') ? 1 : 0) +
          (vSteer?.roll || 0);

        pitchInput = THREE.MathUtils.clamp(pitchInput, -1.25, 1.25);
        yawInput = THREE.MathUtils.clamp(yawInput, -1.25, 1.25);
        rollInput = THREE.MathUtils.clamp(rollInput, -1.25, 1.25);

        const targetAngPitch = pitchInput * 1.05;
        const targetAngYaw = yawInput * 1.05;
        // Subtle RCS roll coordination only when SAS stabilization is engaged
        const bankAssist = sc.sasEnabled && Math.abs(rollInput) < 0.05 ? -yawInput * 0.24 : 0;
        const targetAngRoll = rollInput * 1.45 + bankAssist;

        const rotAccel = Math.min(1, dt * 5.8);
        // True vacuum rotation in Newtonian mode (near-zero drag) vs crisp RCS damping with SAS ON
        const rotDamp = Math.min(1, dt * (sc.sasEnabled ? 5.6 : 0.14));
        angVelPitch = THREE.MathUtils.lerp(
          angVelPitch,
          targetAngPitch,
          Math.abs(pitchInput) > 0.01 ? rotAccel : rotDamp
        );
        angVelYaw = THREE.MathUtils.lerp(
          angVelYaw,
          targetAngYaw,
          Math.abs(yawInput) > 0.01 ? rotAccel : rotDamp
        );
        angVelRoll = THREE.MathUtils.lerp(
          angVelRoll,
          targetAngRoll,
          Math.abs(rollInput) > 0.01 || Math.abs(bankAssist) > 0.01 ? rotAccel : rotDamp
        );

        if (Math.abs(angVelPitch) > 0.0005) sr7.rootGroup.rotateX(angVelPitch * dt);
        if (Math.abs(angVelYaw) > 0.0005) sr7.rootGroup.rotateY(angVelYaw * dt);
        if (Math.abs(angVelRoll) > 0.0005) sr7.rootGroup.rotateZ(angVelRoll * dt);

        // 2. Autopilot Alignment & Smooth Automated Approach
        const autoTargetId = sc.autopilotTargetId;
        const autoPos = autoTargetId ? bodyWorldPositions[autoTargetId] : null;
        let autopilotStatus: SpacecraftTelemetry['autopilotStatus'] = 'OFF';
        let autoThrottleDrive = continuousThrottle;

        if (autoPos && autoTargetId) {
          const autoBody = getCelestialBody(autoTargetId);
          const autoRadius = getScaledRadius(autoBody, st.scaleMode);
          const stopDist =
            autoBody.category === 'galaxy' ? autoRadius * 1.35 : autoRadius * 2.55 + currentShipScale * 7.0;
          const distToAuto = sr7.rootGroup.position.distanceTo(autoPos);

          if (distToAuto <= stopDist) {
            autopilotStatus = 'ARRIVED';
            shipVelocity.multiplyScalar(Math.exp(-dt * 5.2));
            if (shipVelocity.length() < currentShipScale * 0.08) {
              spaceAudio.playAutopilotArrived();
              shipVelocity.set(0, 0, 0);
              continuousThrottle = 0;
              lastSyncedReactThrottle = 0;
              cb.onUpdateSpacecraftControl((prev) => ({
                ...prev,
                autopilotTargetId: null,
                throttle: 0,
                boostActive: false,
              }));
              cb.onSelectBody(autoTargetId, false);
            }
          } else {
            _tmpMat4.lookAt(sr7.rootGroup.position, autoPos, _worldUp);
            _tmpQuat1.setFromRotationMatrix(_tmpMat4);
            const alignAngle = sr7.rootGroup.quaternion.angleTo(_tmpQuat1);

            if (Math.abs(pitchInput) < 0.08 && Math.abs(yawInput) < 0.08) {
              sr7.rootGroup.quaternion.slerp(_tmpQuat1, Math.min(1, dt * 2.8));
            }
            autopilotStatus = alignAngle > 0.14 ? 'ALIGNING' : 'CRUISING';
            if (!sc.brakeRequested) {
              autoThrottleDrive = alignAngle > 0.35 ? 0.35 : distToAuto > stopDist * 2.4 ? 1.0 : 0.45;
            }
          }
        }

        // 3. True Newtonian Momentum Integration & Adaptive Scale Cruise Across Real 1:1 Space
        const boosting =
          sc.boostActive || pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight');
        boostBlend = THREE.MathUtils.lerp(boostBlend, boosting ? 1 : 0, Math.min(1, dt * 3.8));
        const effectiveThrottle = sc.brakeRequested
          ? 0
          : THREE.MathUtils.clamp(autoThrottleDrive + (vSteer?.forward || 0), -0.8, 1.2);
        const nearestClearance = Math.max(
          currentShipScale * 14,
          nearestPlanetDist - nearestPlanetRadius * 1.02
        );
        const adaptiveCruise = autoPos
          ? THREE.MathUtils.clamp(
              sr7.rootGroup.position.distanceTo(autoPos) * 0.55,
              currentShipScale * 5.0,
              2800.0
            )
          : !boosting
            ? THREE.MathUtils.clamp(
                Math.max(currentShipScale * 16.0, nearestClearance * 0.85),
                currentShipScale * 16.0,
                520.0
              )
            : THREE.MathUtils.clamp(
                Math.max(currentShipScale * 38.0, nearestClearance * 1.6),
                currentShipScale * 38.0,
                3200.0
              );

        const maxSpeed = adaptiveCruise * THREE.MathUtils.lerp(1.0, 3.8, boostBlend);
        const shipForward = _tmpV1.set(0, 0, -1).applyQuaternion(sr7.rootGroup.quaternion).normalize();

        if (sc.brakeRequested) {
          shipVelocity.multiplyScalar(Math.exp(-dt * 4.4));
          if (shipVelocity.length() < currentShipScale * 0.03) {
            shipVelocity.set(0, 0, 0);
          }
        } else if (Math.abs(effectiveThrottle) > 0.01) {
          const thrustAccel = maxSpeed * (boosting ? 1.55 : 0.92);
          shipVelocity.addScaledVector(shipForward, effectiveThrottle * thrustAccel * dt);
          if (sc.sasEnabled) {
            const spd = shipVelocity.length();
            if (spd > 1e-8) {
              _tmpV2.copy(shipForward).multiplyScalar(effectiveThrottle >= 0 ? spd : -spd);
              shipVelocity.lerp(_tmpV2, Math.min(1, dt * 1.55));
            }
          }
          const newSpd = shipVelocity.length();
          if (newSpd > maxSpeed) {
            _tmpV2.copy(shipVelocity).setLength(maxSpeed);
            shipVelocity.lerp(_tmpV2, Math.min(1, dt * 3.5));
          }
        } else if (sc.sasEnabled) {
          // Coupled fly-by-wire coasts freely with only subtle orbital micro-trim
          shipVelocity.multiplyScalar(Math.exp(-dt * 0.16));
        }

        const shipDisplacement = _tmpV3.copy(shipVelocity).multiplyScalar(dt);
        sr7.rootGroup.position.add(shipDisplacement);

        // Compute prograde drift slip angle for Cockpit HUD combiner indicator
        const currentSpeed = shipVelocity.length();
        let driftAngleDeg = 0;
        if (currentSpeed > currentShipScale * 0.02) {
          const shipRight = _tmpV2.set(1, 0, 0).applyQuaternion(sr7.rootGroup.quaternion);
          const sideSlip = _tmpV4.copy(shipVelocity).divideScalar(currentSpeed).dot(shipRight);
          driftAngleDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sideSlip, -1, 1)));
        }

        // 4. High-Speed Boost Warp Streaks & Dynamic Panoramic FOV
        const showWarpStreaks = boostBlend > 0.25 && currentSpeed > currentShipScale * 25;
        warpTunnelGroup.visible = showWarpStreaks;
        if (showWarpStreaks) {
          warpTunnelGroup.position.copy(sr7.rootGroup.position);
          _tmpV4.copy(sr7.rootGroup.position).add(shipForward);
          warpTunnelGroup.lookAt(_tmpV4);
          warpCylMat.uniforms.uTime.value = clockTime;
          warpCylMat.uniforms.uIntensity.value = 0.42 * boostBlend;
          warpLines.rotation.z = clockTime * 2.8;
          warpMat.opacity = 0.45 * boostBlend;
        }

        const targetFov =
          sc.cameraView === 'COCKPIT'
            ? THREE.MathUtils.lerp(76, 85, boostBlend)
            : THREE.MathUtils.lerp(48, 57, boostBlend);
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 5.2));
          camera.updateProjectionMatrix();
        }

        // 5. Twin Ventral Plasma Pulse Cannons & Projectiles
        if (sc.firePulseCount > lastFirePulseCount) {
          lastFirePulseCount = sc.firePulseCount;
          muzzleFlashAlpha = 1.0;
          spaceAudio.playPlasmaPulse();
          const boltSpeed = Math.max(
            currentShipScale * 95,
            currentSpeed * 1.8 + currentShipScale * 90
          );
          _tmpV4.copy(shipForward).multiplyScalar(boltSpeed);
          [-0.29, 0.29].forEach((sideX) => {
            const boltMesh = new THREE.Mesh(pulseBoltGeo, pulseBoltMat);
            boltMesh.scale.setScalar(currentShipScale);
            _tmpV5.set(sideX, -0.32, -2.26);
            sr7.rootGroup.localToWorld(_tmpV5);
            boltMesh.position.copy(_tmpV5);
            boltMesh.quaternion.copy(sr7.rootGroup.quaternion);
            projectileGroup.add(boltMesh);
            activePulseBolts.push({ mesh: boltMesh, velocity: _tmpV4.clone(), age: 0 });
          });
        }
        muzzleFlashAlpha = Math.max(0, muzzleFlashAlpha - dt * 7.5);

        for (let i = activePulseBolts.length - 1; i >= 0; i--) {
          const bolt = activePulseBolts[i];
          bolt.age += dt;
          bolt.mesh.position.addScaledVector(bolt.velocity, dt);
          if (bolt.age > 2.2) {
            projectileGroup.remove(bolt.mesh);
            activePulseBolts.splice(i, 1);
          }
        }

        // 6. Camera Placement: Elastic 3rd-Person Spring Chase + Orbit OR Wide Panoramic 1st-Person Cockpit
        if (sc.cameraView === 'COCKPIT') {
          controls.enabled = false;
          sr7.cockpitSeatAnchor.updateWorldMatrix(true, false);
          sr7.cockpitSeatAnchor.getWorldPosition(_tmpV4);
          camera.position.copy(_tmpV4);
          // Subtle natural inertial pilot head lean into high-G turns
          _tmpEuler.set(angVelPitch * -0.022, angVelYaw * -0.022, angVelRoll * -0.04, 'YXZ');
          _tmpQuat1.setFromEuler(_tmpEuler);
          camera.quaternion.copy(sr7.rootGroup.quaternion).multiply(_tmpQuat1);
          controls.target.copy(_tmpV4).addScaledVector(shipForward, Math.max(0.0001, currentShipScale * 18));
        } else {
          controls.enabled = true;
          controls.minDistance = Math.max(1e-7, currentShipScale * 2.25);
          controls.maxDistance = 190000;
          const curRecenter = sc.recenterTrigger || 0;
          if (curRecenter !== prevRecenterTrigger) {
            prevRecenterTrigger = curRecenter;
            lastManualOrbitTimestamp = 0;
            prevCameraView = 'COCKPIT';
          }

          if (prevCameraView !== 'EXTERNAL') {
            sr7.chaseCameraAnchor.updateWorldMatrix(true, false);
            sr7.chaseCameraAnchor.getWorldPosition(_tmpV4);
            camera.position.copy(_tmpV4);
            controls.target.copy(sr7.rootGroup.position);
            lastManualOrbitTimestamp = 0;
          } else {
            camera.position.add(shipDisplacement);
            controls.target.copy(sr7.rootGroup.position);

            // Elastic Chase Spring: softly aligns behind engines unless user recently orbited to inspect hull
            const secondsSinceManualOrbit = (now - lastManualOrbitTimestamp) / 1000;
            const hasSteeringOrThrust =
              Math.abs(angVelYaw) > 0.05 ||
              Math.abs(angVelPitch) > 0.05 ||
              Math.abs(effectiveThrottle) > 0.08;
            if (!isCockpitDragging && (lastManualOrbitTimestamp === 0 || (secondsSinceManualOrbit > 2.6 && hasSteeringOrThrust))) {
              const currentOffset = _tmpV4.subVectors(camera.position, sr7.rootGroup.position);
              const currentDist = Math.max(controls.minDistance, currentOffset.length());
              // Subtle cinematic side/up lag during sharp turns + warp boost zoom-out
              _tmpV5
                .set(-angVelYaw * 0.55, 1.28 + angVelPitch * 0.45, 6.1 + boostBlend * 1.35)
                .applyQuaternion(sr7.rootGroup.quaternion)
                .normalize();
              const currentDir = _tmpV6.copy(currentOffset).normalize();
              const followLerp = Math.min(1, dt * (2.8 + Math.abs(angVelYaw) * 1.4));
              currentDir.lerp(_tmpV5, followLerp).normalize();
              camera.position.copy(sr7.rootGroup.position).addScaledVector(currentDir, currentDist);
            }
          }
          controls.update();
        }
        if (prevCameraView !== sc.cameraView) {
          spaceAudio.playCameraSwitch(sc.cameraView);
        }
        prevCameraView = sc.cameraView;

        if (sc.radarPulseTimestamp !== prevRadarAudioTs) {
          prevRadarAudioTs = sc.radarPulseTimestamp;
          if (sc.radarPulseTimestamp > 0) spaceAudio.playRadarScan();
        }
        if (sc.brakeRequested && !prevBrakeAudio) {
          spaceAudio.playBrakeRetro();
        }
        prevBrakeAudio = sc.brakeRequested;
        if (sc.autopilotTargetId !== prevAutopilotIdAudio) {
          prevAutopilotIdAudio = sc.autopilotTargetId;
          if (sc.autopilotTargetId) spaceAudio.playAutopilotLock();
        }

        spaceAudio.updateFrame({
          dt,
          clockTime,
          mode: 'SPACECRAFT',
          cameraView: sc.cameraView,
          throttle: Math.abs(effectiveThrottle),
          speedNorm: Math.min(1.5, currentSpeed / Math.max(0.0005, adaptiveCruise)),
          boostBlend,
          isBraking: sc.brakeRequested,
          rcsIntensity: Math.min(1, Math.hypot(pitchInput, yawInput, rollInput)),
        });

        // 7. Compute Nearest Contacts & Ship-Relative Radar Bearings
        _tmpQuat1.copy(sr7.rootGroup.quaternion).invert();
        const contactsUnsorted: NearbySpacecraftContact[] = [];
        ALL_CELESTIAL_BODIES.forEach((b) => {
          const bPos = bodyWorldPositions[b.id];
          if (!bPos) return;
          const dist = sr7.rootGroup.position.distanceTo(bPos);
          const relLocal = _tmpV2.copy(bPos).sub(sr7.rootGroup.position).applyQuaternion(_tmpQuat1);
          const bearingDeg = THREE.MathUtils.radToDeg(Math.atan2(relLocal.x, -relLocal.z));
          const horizDist = Math.max(0.001, Math.hypot(relLocal.x, relLocal.z));
          const elevationDeg = THREE.MathUtils.radToDeg(Math.atan2(relLocal.y, horizDist));

          const km = dist * 1_000_000;
          let distFormatted = '';
          if (b.category === 'galaxy' || dist >= 90000) {
            const ly = dist * 59.8;
            distFormatted =
              ly >= 1_000_000
                ? `${(ly / 1_000_000).toFixed(2)} Mly`
                : `${Math.round(ly).toLocaleString('pt-BR')} ly`;
          } else if (km < 5_000_000) {
            distFormatted = `${Math.round(km).toLocaleString('pt-BR')} km`;
          } else {
            distFormatted = `${(dist / 149.59787).toFixed(2)} UA`;
          }

          contactsUnsorted.push({
            id: b.id,
            name: b.name,
            category: b.category,
            distanceUnits: dist,
            distanceFormatted: distFormatted,
            bearingDeg,
            elevationDeg,
          });
        });
        contactsUnsorted.sort((a, b) => a.distanceUnits - b.distanceUnits);
        const nearestContact = contactsUnsorted[0];
        const radarContacts = contactsUnsorted.slice(0, 7);

        let speedFormatted = '0 km/s';
        if (currentSpeed > currentShipScale * 0.008) {
          const speedKmSec = currentSpeed * 1_000_000;
          if (speedKmSec < 299_792) {
            speedFormatted = `${Math.round(speedKmSec).toLocaleString('pt-BR')} km/s`;
          } else if (speedKmSec < 299_792 * 180) {
            speedFormatted = `${(speedKmSec / 299_792).toFixed(1)} c`;
          } else {
            speedFormatted = `${Math.round(currentSpeed * 12).toLocaleString('pt-BR')} ly/s`;
          }
        }

        const radarAgeSec =
          sc.radarPulseTimestamp > 0 ? (now - sc.radarPulseTimestamp) / 1000 : 99;
        _tmpEuler.setFromQuaternion(sr7.rootGroup.quaternion, 'YXZ');
        const pitchDegVal = Math.round(THREE.MathUtils.radToDeg(_tmpEuler.x));
        const yawDegVal = Math.round(THREE.MathUtils.radToDeg(_tmpEuler.y));
        const rollDegVal = Math.round(THREE.MathUtils.radToDeg(_tmpEuler.z));
        const liveReactorTemp = Math.round(
          320 + Math.abs(effectiveThrottle) * 240 + boostBlend * 380
        );

        sr7.updateAnimations({
          dt,
          clockTime,
          throttle: sc.brakeRequested ? 0 : effectiveThrottle,
          boostActive: boosting,
          headlightsOn: sc.headlightsOn,
          interiorLightsOn: sc.interiorLightsOn,
          shieldsOn: sc.shieldsOn,
          pitchInput: angVelPitch / 1.05,
          rollInput: angVelRoll / 1.45,
          yawInput: angVelYaw / 1.05,
          pitchDeg: pitchDegVal,
          rollDeg: rollDegVal,
          radarPulseAgeSec: radarAgeSec,
          muzzleFlashAlpha,
          speedFormatted,
          nearestName: nearestContact?.name || 'Espaço Profundo',
          nearestDist: nearestContact?.distanceFormatted || '—',
          reactorTempC: liveReactorTemp,
          sasEnabled: sc.sasEnabled,
          autopilotActive: Boolean(autoTargetId),
          shipScale: currentShipScale,
          driftAngleDeg,
        });

        // 8. Sync Live Telemetry to HUD (throttled ~9 Hz)
        if (now - lastTelemetrySync > 110) {
          lastTelemetrySync = now;
          cb.onSyncSpacecraftTelemetry({
            speedUnitsPerSec: currentSpeed,
            speedFormatted,
            fuelPercent: Math.max(12, Number((100 - Math.min(80, currentSpeed * 0.02)).toFixed(1))),
            hullIntegrity: 100,
            reactorTempC: liveReactorTemp,
            pitchDeg: pitchDegVal,
            yawDeg: yawDegVal,
            rollDeg: rollDegVal,
            nearestBodyId: nearestContact?.id || 'sun',
            nearestBodyName: nearestContact?.name || 'Sol',
            nearestDistanceFormatted: nearestContact?.distanceFormatted || '0 km',
            nearbyContacts: radarContacts,
            autopilotStatus,
          });
        }

        const computedShipZoom: ZoomLevel =
          distFromOrigin > galThresholds.fadeEnd
            ? 'COSMIC_GALAXY'
            : distFromOrigin > 120
              ? 'SOLAR_SYSTEM'
              : 'PLANETARY_APPROACH';
        if (computedShipZoom !== st.zoomLevel) {
          cb.onZoomLevelChange(computedShipZoom);
        }
      } else {
        sr7.rootGroup.visible = false;
        shipRimLight.visible = false;
        wasSpacecraftActive = false;
        prevBrakeAudio = false;
        prevAutopilotIdAudio = null;
        spaceAudio.updateFrame({ dt, clockTime, mode: 'OBSERVATORY' });
        controls.enabled = true;
        controls.minDistance =
          selectedBody.id === 'milky-way' ? 2.2 : Math.max(0.0000004, targetRadius * 1.18);
        wasWarpingLastFrame = false;
        warpTunnelGroup.visible = false;
        if (Math.abs(camera.fov - 46) > 0.1) {
          camera.fov = 46;
          camera.updateProjectionMatrix();
        }

        const mwWorldPos = bodyWorldPositions['milky-way'] || _originVec;
        const isExternalGalaxy =
          selectedBody.category === 'galaxy' && selectedBody.id !== 'milky-way';

        if (hasInitializedTargetPos) {
          if (selectedBody.category !== 'galaxy') {
            _tmpV1.subVectors(targetPos, previousTargetWorldPos);
            const followWeight =
              1.0 - THREE.MathUtils.smoothstep(distFromOrigin, galThresholds.fadeStart * 1.8, galThresholds.fadeEnd * 2.2);
            camera.position.addScaledVector(_tmpV1, followWeight);
            controls.target.addScaledVector(_tmpV1, followWeight);
          }
        } else {
          controls.target.copy(targetPos);
          const initDir = computeSunlitCameraOffsetDir(targetPos, selectedBody.id);
          camera.position
            .copy(targetPos)
            .addScaledVector(initDir, Math.max(0.0000008, targetRadius * 3.25));
        }
        previousTargetWorldPos.copy(targetPos);
        hasInitializedTargetPos = true;

        if (cameraCommandRef.current.manualZoomStep !== 0) {
          const step = cameraCommandRef.current.manualZoomStep;
          cameraCommandRef.current.manualZoomStep = 0;
          cameraCommandRef.current.activeTransition = false;

          // When zooming IN from Milky Way galactic scale, steer directly toward (0,0,0) [Sistema Solar in the Orion Arm]
          const zoomAnchor =
            !isExternalGalaxy && step > 0 && distFromOrigin > galThresholds.fadeStart
              ? _originVec
              : controls.target;
          const offset = _tmpV1.subVectors(camera.position, zoomAnchor);
          const factor = step > 0 ? 0.72 : 1.38;
          const minAllowed =
            selectedBody.id === 'milky-way' ? 2.2 : Math.max(0.0000004, targetRadius * 1.24);
          const maxLen = 190000;
          const nextLen = THREE.MathUtils.clamp(offset.length() * factor, minAllowed, maxLen);
          offset.setLength(nextLen);
          camera.position.copy(zoomAnchor).add(offset);
          if (!isExternalGalaxy && step > 0 && distFromOrigin > galThresholds.fadeStart) {
            controls.target.lerp(_originVec, 0.32);
          }
        }

        if (cameraCommandRef.current.activeTransition) {
          const mult = cameraCommandRef.current.desiredDistanceMultiplier;
          let desiredDist = Math.max(0.0000008, targetRadius * mult);

          let offsetDir = computeSunlitCameraOffsetDir(targetPos, selectedBody.id);
          if (selectedBody.id === 'milky-way') {
            // Cosmoscope-inspired oblique galactic vantage point framing the barred core, Orion Arm & halo clusters
            offsetDir = _tmpV3.set(-0.36, 0.66, 0.66).normalize();
          } else if (selectedBody.category === 'galaxy') {
            offsetDir = _tmpV3.set(0.55, 0.52, 0.65).normalize();
          } else if (st.saturnRingDiveMode && st.selectedBodyId === 'saturn') {
            offsetDir = _tmpV3.set(0.92, 0.06, 0.38).normalize();
          } else if (st.selectedSatelliteId && st.selectedBodyId === 'earth') {
            const focusedSat = st.propagatedSatellites.find(
              (s) => s.id === st.selectedSatelliteId
            );
            if (focusedSat) {
              const satRadiusU = Math.hypot(
                focusedSat.position3D[0],
                focusedSat.position3D[1],
                focusedSat.position3D[2]
              );
              desiredDist = Math.max(desiredDist, satRadiusU + targetRadius * 0.55);
              offsetDir = _tmpV3
                .set(focusedSat.position3D[0], focusedSat.position3D[1], focusedSat.position3D[2])
                .normalize();
            }
          } else if (cameraCommandRef.current.focusLatLon) {
            const node = bodyNodes[selectedBody.id];
            const spinY = node ? node.spinMesh.rotation.y : 0;
            const latR = THREE.MathUtils.degToRad(cameraCommandRef.current.focusLatLon.lat);
            const lonR =
              THREE.MathUtils.degToRad(cameraCommandRef.current.focusLatLon.lon) + spinY;
            offsetDir = _tmpV3
              .set(
                Math.cos(latR) * Math.cos(lonR),
                Math.sin(latR),
                -Math.cos(latR) * Math.sin(lonR)
              )
              .normalize();
          } else if (st.isExploringInterior) {
            offsetDir = _tmpV3.set(0.62, 0.42, 0.66).normalize();
          }

          const goalCamPos = _tmpV2.copy(targetPos).addScaledVector(offsetDir, desiredDist);
          camera.position.lerp(goalCamPos, 0.085);
          controls.target.lerp(targetPos, 0.14);
          if (camera.position.distanceTo(goalCamPos) < desiredDist * 0.025) {
            cameraCommandRef.current.activeTransition = false;
          }
        } else {
          // Continuous Multi-Scale Orbit Pivot Interpolation:
          // Smoothly transitions controls.target between Sagittarius A* (at Galactic Scale)
          // and the Solar System / Selected Planet (at Solar System & Planetary Scale)
          if (isExternalGalaxy) {
            controls.target.lerp(targetPos, 0.14);
          } else {
            const baseLocalTarget =
              selectedBody.id === 'milky-way' ? _originVec : targetPos;
            const galacticCenterBlend = THREE.MathUtils.smoothstep(
              distFromOrigin,
              galThresholds.fadeStart * 2.0,
              galThresholds.fadeEnd * 4.0
            );
            const desiredPivot = _tmpV1.lerpVectors(
              baseLocalTarget,
              mwWorldPos,
              galacticCenterBlend
            );
            controls.target.lerp(desiredPivot, 0.14);

            // Seamless automatic handoff when zooming in from Milky Way into the Solar System (or zooming out from Solar System into Milky Way)
            if (st.selectedBodyId === 'milky-way' && distFromOrigin < 140) {
              cameraCommandRef.current.suppressNextSelectionReset = true;
              cb.onSelectBody('sun', false);
            } else if (
              selectedBody.category !== 'galaxy' &&
              distFromOrigin > galThresholds.solarHandoffDist
            ) {
              cameraCommandRef.current.suppressNextSelectionReset = true;
              cb.onSelectBody('milky-way', false);
            }
          }
        }

        controls.update();

        const camDist = camera.position.distanceTo(controls.target);
        const distInRadii = camDist / Math.max(0.0000002, targetRadius);

        let computedZoom: ZoomLevel = 'SOLAR_SYSTEM';
        if (distFromOrigin > galThresholds.fadeEnd || isExternalGalaxy || selectedBody.id === 'milky-way') {
          computedZoom = 'COSMIC_GALAXY';
        } else if (selectedBody.id === 'sun' && distInRadii > 8.5) {
          computedZoom = 'SOLAR_SYSTEM';
        } else if (distInRadii > 95.0) {
          computedZoom = 'SOLAR_SYSTEM';
        } else if (distInRadii > 4.8) {
          computedZoom = 'PLANETARY_APPROACH';
        } else if (distInRadii > 2.25) {
          computedZoom = 'ORBITAL_EXPLORATION';
        } else {
          computedZoom = 'SURFACE_EXPLORATION';
        }

        if (computedZoom !== st.zoomLevel) {
          cb.onZoomLevelChange(computedZoom);
        }
      }

      // ADAPTIVE LOG-DEPTH NEAR PLANE + VIEW-SPACE SHADER LIGHTING SYNC (eliminates float32 outer-planet jitter!)
      const activeCamDist = Math.max(0.0000004, camera.position.distanceTo(controls.target));
      let targetNear = THREE.MathUtils.clamp(activeCamDist * 0.004, 1e-7, 0.02);
      if (st.spacecraftControl.isActive) {
        targetNear =
          st.spacecraftControl.cameraView === 'COCKPIT'
            ? THREE.MathUtils.clamp(currentShipScale * 0.032, 1e-8, 0.001)
            : THREE.MathUtils.clamp(
                Math.min(activeCamDist * 0.012, currentShipScale * 0.25),
                1e-8,
                0.01
              );
      }
      if (Math.abs(targetNear - lastAdaptiveNear) > lastAdaptiveNear * 0.15) {
        lastAdaptiveNear = targetNear;
        camera.near = targetNear;
        camera.updateProjectionMatrix();
      }

      camera.updateMatrixWorld();
      _sunViewPos.copy(_originVec).applyMatrix4(camera.matrixWorldInverse);
      const saturnWorldPos = bodyWorldPositions['saturn'];
      if (saturnWorldPos) {
        _planetViewPos.copy(saturnWorldPos).applyMatrix4(camera.matrixWorldInverse);
      }

      asteroidBeltShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
      kuiperBeltShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
      saturnBoulderShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
      saturnBoulderShaderMat.uniforms.uPlanetViewPosition.value.copy(_planetViewPos);

      ALL_CELESTIAL_BODIES.forEach((b) => {
        const node = bodyNodes[b.id];
        if (!node || !node.rootGroup.visible) return;
        if (node.surfaceMaterial.uniforms.uSunViewPosition) {
          node.surfaceMaterial.uniforms.uSunViewPosition.value.copy(_sunViewPos);
        }
        if (node.atmosphereMesh) {
          const atmoMat = node.atmosphereMesh.material as THREE.ShaderMaterial;
          if (atmoMat.uniforms.uSunViewPosition) {
            atmoMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
          }
        }
        if (node.saturnRingShaderMat) {
          node.saturnRingShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
          node.saturnRingShaderMat.uniforms.uPlanetViewPosition.value.copy(_planetViewPos);
        }
      });

      // PROJECT CLEAN, DECLUTTERED 3D LABELS & LIVE SCALE READOUT TO 2D OVERLAY
      labelFrameCounter++;
      if (labelFrameCounter % perf.labelUpdateIntervalFrames === 0 && !st.warpState.isActive) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const nextLabels: ScreenLabel[] = [];

        const isExternalGalaxy =
          selectedBody.category === 'galaxy' && selectedBody.id !== 'milky-way';
        const isGalacticScaleView =
          isExternalGalaxy ||
          selectedBody.id === 'milky-way' ||
          distFromOrigin > galThresholds.fadeStart * 1.45;

        // Calculate real-time vertical field-of-view scale (Cosmoscope-style "↕ 157.377 ly" / "UA" / "km")
        const fovSpanUnits =
          2.0 * activeCamDist * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
        let formattedScale = '';
        if (isGalacticScaleView) {
          const spanLy = fovSpanUnits * 59.8;
          if (spanLy >= 1_000_000) {
            formattedScale = `${(spanLy / 1_000_000).toLocaleString('pt-BR', {
              maximumFractionDigits: 2,
            })} Mly`;
          } else if (spanLy >= 100) {
            formattedScale = `${Math.round(spanLy).toLocaleString('pt-BR')} ly`;
          } else {
            formattedScale = `${spanLy.toLocaleString('pt-BR', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} ly`;
          }
        } else if (st.zoomLevel === 'SOLAR_SYSTEM') {
          const spanAU = Math.max(0.01, fovSpanUnits / 149.59787);
          formattedScale = `${spanAU.toLocaleString('pt-BR', {
            minimumFractionDigits: spanAU < 1 ? 2 : 1,
            maximumFractionDigits: spanAU < 1 ? 2 : 1,
          })} UA`;
        } else {
          const spanKm = Math.max(1, Math.round(fovSpanUnits * 1_000_000));
          formattedScale = `${spanKm.toLocaleString('pt-BR')} km`;
        }
        if (formattedScale !== lastScaleReadout) {
          lastScaleReadout = formattedScale;
          setScaleReadout(formattedScale);
        }

        const projectPoint = (worldVec: THREE.Vector3) => {
          _projVec.copy(worldVec).project(camera);
          const visible = _projVec.z >= -1 && _projVec.z <= 1;
          return {
            x: (_projVec.x * 0.5 + 0.5) * width,
            y: (-(_projVec.y * 0.5) + 0.5) * height,
            visible,
          };
        };

        if (st.showLabels) {
          if (isGalacticScaleView) {
            // AT GALACTIC SCALE: Show Clean Cosmoscope-Style Galaxy Titles & 3D Milky Way Landmarks!
            ALL_CELESTIAL_BODIES.forEach((b) => {
              if (b.category !== 'galaxy') return;
              const wPos = bodyWorldPositions[b.id];
              if (!wPos) return;
              _tmpV1
                .copy(wPos)
                .add(
                  _tmpV2.set(0, b.id === 'milky-way' ? 65 : getScaledRadius(b, st.scaleMode) * 0.55, 0)
                );
              const proj = projectPoint(_tmpV1);
              if (
                proj.visible &&
                proj.x > 24 &&
                proj.x < width - 24 &&
                proj.y > 24 &&
                proj.y < height - 24
              ) {
                nextLabels.push({
                  id: `lbl-gal-${b.id}`,
                  name: b.id === 'milky-way' ? 'Via Láctea (Milky Way)' : b.name,
                  x: proj.x,
                  y: proj.y,
                  visible: true,
                  color: b.primaryColorHex,
                  kind: 'galaxy',
                  payloadId: b.id,
                });
              }
            });

            if (!isExternalGalaxy && distFromOrigin < 9500) {
              const mwPos = bodyWorldPositions['milky-way'] || _originVec;
              const mwRadius = getScaledRadius(getCelestialBody('milky-way'), st.scaleMode);

              MILKY_WAY_LANDMARKS.forEach((lm) => {
                _tmpV2.set(lm.position3D[0], lm.position3D[1], lm.position3D[2]).multiplyScalar(mwRadius);
                _tmpV1.copy(mwPos).add(_tmpV2);
                const proj = projectPoint(_tmpV1);
                if (
                  proj.visible &&
                  proj.x > 20 &&
                  proj.x < width - 20 &&
                  proj.y > 20 &&
                  proj.y < height - 20
                ) {
                  nextLabels.push({
                    id: `lbl-mw-${lm.id}`,
                    name: lm.name,
                    subLabel: lm.distanceLy,
                    x: proj.x,
                    y: proj.y,
                    visible: true,
                    color: lm.colorHex,
                    kind: 'galactic_landmark',
                    payloadId: lm.id,
                  });
                }
              });
            }
          } else {
            // INSIDE SOLAR SYSTEM SCALE: Show Planets, Dwarf Planets, Moons, Asteroids & Comets.
            ALL_CELESTIAL_BODIES.forEach((b) => {
              if (b.category === 'galaxy') return;
              const wPos = bodyWorldPositions[b.id];
              if (!wPos) return;
              if (
                (st.zoomLevel === 'ORBITAL_EXPLORATION' ||
                  st.zoomLevel === 'SURFACE_EXPLORATION') &&
                b.id !== st.selectedBodyId &&
                b.parentId !== st.selectedBodyId
              ) {
                return;
              }
              if (
                b.category === 'moon' &&
                st.selectedBodyId !== b.parentId &&
                st.selectedBodyId !== b.id
              ) {
                return;
              }
              if (b.id === st.selectedBodyId && st.zoomLevel !== 'SOLAR_SYSTEM') {
                return;
              }

              const bRadius = getScaledRadius(b, st.scaleMode);
              _tmpV1.copy(wPos).add(_tmpV2.set(0, bRadius * 1.28, 0));
              const proj = projectPoint(_tmpV1);
              if (
                proj.visible &&
                proj.x > 24 &&
                proj.x < width - 24 &&
                proj.y > 24 &&
                proj.y < height - 24
              ) {
                nextLabels.push({
                  id: `lbl-body-${b.id}`,
                  name: b.name,
                  x: proj.x,
                  y: proj.y,
                  visible: true,
                  color: b.orbitColorHex,
                  kind: b.category === 'moon' ? 'moon' : 'body',
                  payloadId: b.id,
                });
              }
            });
          }
        }

        // Show Earth Satellite pills ONLY outside the planet disk so they never cover the 4K Earth globe!
        if (
          st.showLabels &&
          !isGalacticScaleView &&
          st.selectedBodyId === 'earth' &&
          earthPos &&
          !st.isExploringInterior &&
          (st.zoomLevel === 'ORBITAL_EXPLORATION' ||
            st.zoomLevel === 'SURFACE_EXPLORATION')
        ) {
          const earthCenterScreen = projectPoint(earthPos);
          _tmpV1.copy(earthPos).add(_tmpV2.set(0, targetRadius * 1.05, 0));
          const edgeScreen = projectPoint(_tmpV1);
          const planetScreenRadius = Math.hypot(
            edgeScreen.x - earthCenterScreen.x,
            edgeScreen.y - earthCenterScreen.y
          );

          let shownSatCount = 0;
          st.propagatedSatellites.forEach((sat) => {
            if (!st.enabledSatelliteCategories[sat.category]) return;
            const isSelSat = sat.id === st.selectedSatelliteId;
            if (!isSelSat && shownSatCount >= 4) return;

            _tmpV1
              .copy(earthPos)
              .add(_tmpV2.set(sat.position3D[0], sat.position3D[1], sat.position3D[2]));
            const proj = projectPoint(_tmpV1);
            const distFromEarthCenter = Math.hypot(
              proj.x - earthCenterScreen.x,
              proj.y - earthCenterScreen.y
            );

            if (
              proj.visible &&
              (isSelSat || distFromEarthCenter > planetScreenRadius * 1.04) &&
              proj.x > 24 &&
              proj.x < width - 24 &&
              proj.y > 24 &&
              proj.y < height - 24
            ) {
              shownSatCount++;
              nextLabels.push({
                id: `lbl-sat-${sat.id}`,
                name: sat.name.split('—')[0].trim(),
                subLabel: `${Math.round(sat.altitudeKm)} km`,
                x: proj.x,
                y: proj.y,
                visible: true,
                color: sat.colorHex,
                kind: 'satellite',
                payloadId: sat.id,
              });
            }
          });
        }

        // Show Surface Landmarks ONLY when zoomed all the way into Level 4 (SURFACE_EXPLORATION)
        if (
          st.showLabels &&
          !isGalacticScaleView &&
          st.zoomLevel === 'SURFACE_EXPLORATION' &&
          !st.isExploringInterior
        ) {
          const activeNode = bodyNodes[selectedBody.id];
          if (activeNode && selectedBody.landmarks.length > 0) {
            const spinY = activeNode.spinMesh.rotation.y;
            const tiltRad = THREE.MathUtils.degToRad(selectedBody.axialTiltDeg);
            const toCam = _tmpV3.subVectors(camera.position, targetPos).normalize();
            selectedBody.landmarks.forEach((lm) => {
              const latR = THREE.MathUtils.degToRad(lm.latitudeDeg);
              const lonR = THREE.MathUtils.degToRad(lm.longitudeDeg) + spinY;
              _tmpV2
                .set(
                  Math.cos(latR) * Math.cos(lonR),
                  Math.sin(latR),
                  -Math.cos(latR) * Math.sin(lonR)
                )
                .applyAxisAngle(_zAxis, tiltRad);
              if (_tmpV2.dot(toCam) > 0.35) {
                _tmpV1.copy(targetPos).addScaledVector(_tmpV2, targetRadius * 1.03);
                const proj = projectPoint(_tmpV1);
                if (proj.visible) {
                  nextLabels.push({
                    id: `lbl-lm-${lm.id}`,
                    name: lm.name.split('(')[0].trim(),
                    x: proj.x,
                    y: proj.y,
                    visible: true,
                    color: '#fbbf24',
                    kind: 'landmark',
                    payloadId: lm.id,
                  });
                }
              }
            });
          }
        }

        setScreenLabels(nextLabels);
      }

      renderer.render(scene, camera);
    };

    const finalizeSceneBoot = () => {
      if (isDisposed || bootCompleted) return;
      bootCompleted = true;
      window.clearTimeout(bootTimeoutId);

      emitBootProgress({
        progress: 88,
        stage: 'Compilando shaders 3D, Via Láctea e SR-7...',
        detail: 'Pré-aquecendo pipeline GPU WebGL',
        loadedTextures: settledTexCount,
        totalTextures: totalTexCount,
        ready: false,
      });

      const simNow = internalSimTimeRef.current;
      ALL_CELESTIAL_BODIES.forEach((b) => {
        const node = bodyNodes[b.id];
        if (!node) return;
        const [bx, by, bz] = computeKeplerianPosition3D(b, simNow, 'TRUE_1_TO_1');
        node.rootGroup.position.set(bx, by, bz);
        bodyWorldPositions[b.id].set(bx, by, bz);
        node.tiltGroup.scale.setScalar(getScaledRadius(b, 'TRUE_1_TO_1'));
        node.rootGroup.visible = true;
        if (node.galaxyVolumetricGroup) {
          setGalaxyGroupOpacity(node.galaxyVolumetricGroup, 1.0);
        }
      });

      const initialTargetBody = getCelestialBody(stateRef.current.selectedBodyId);
      const initialPos = bodyWorldPositions[initialTargetBody.id] || _originVec;
      const initialRadius = getScaledRadius(initialTargetBody, 'TRUE_1_TO_1');
      const initDir = computeSunlitCameraOffsetDir(initialPos, initialTargetBody.id);
      if (!hasInitializedTargetPos) {
        controls.target.copy(initialPos);
        camera.position
          .copy(initialPos)
          .addScaledVector(initDir, Math.max(0.0000008, initialRadius * 3.25));
        previousTargetWorldPos.copy(initialPos);
        hasInitializedTargetPos = true;
      }
      controls.update();
      camera.updateMatrixWorld();

      _sunViewPos.copy(_originVec).applyMatrix4(camera.matrixWorldInverse);
      const satWorldInit = bodyWorldPositions['saturn'];
      if (satWorldInit) {
        _planetViewPos.copy(satWorldInit).applyMatrix4(camera.matrixWorldInverse);
      }
      asteroidBeltShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
      kuiperBeltShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
      saturnBoulderShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
      saturnBoulderShaderMat.uniforms.uPlanetViewPosition.value.copy(_planetViewPos);
      ALL_CELESTIAL_BODIES.forEach((b) => {
        const node = bodyNodes[b.id];
        if (!node) return;
        if (node.surfaceMaterial.uniforms.uSunViewPosition) {
          node.surfaceMaterial.uniforms.uSunViewPosition.value.copy(_sunViewPos);
        }
        if (node.atmosphereMesh) {
          const atmoMat = node.atmosphereMesh.material as THREE.ShaderMaterial;
          if (atmoMat.uniforms.uSunViewPosition) {
            atmoMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
          }
        }
        if (node.saturnRingShaderMat) {
          node.saturnRingShaderMat.uniforms.uSunViewPosition.value.copy(_sunViewPos);
          node.saturnRingShaderMat.uniforms.uPlanetViewPosition.value.copy(_planetViewPos);
        }
      });

      const prevSr7Vis = sr7.rootGroup.visible;
      const prevBeltVis = beltGroup.visible;
      const prevSatVis = satelliteGroup.visible;
      sr7.rootGroup.visible = true;
      sr7.rootGroup.position.copy(initialPos);
      beltGroup.visible = true;
      satelliteGroup.visible = true;

      renderer.compile(scene, camera);

      sr7.rootGroup.visible = prevSr7Vis;
      beltGroup.visible = prevBeltVis;
      satelliteGroup.visible = prevSatVis;

      emitBootProgress({
        progress: 96,
        stage: 'Sincronizando órbitas 1:1 e telemetria SGP4...',
        detail: 'Finalizando primeiro quadro 3D',
        loadedTextures: totalTexCount,
        totalTextures: totalTexCount,
        ready: false,
      });

      const fontsPromise =
        typeof document !== 'undefined' && 'fonts' in document
          ? Promise.race([
              document.fonts.ready,
              new Promise<void>((res) => window.setTimeout(res, 650)),
            ])
          : Promise.resolve();

      fontsPromise.finally(() => {
        if (isDisposed) return;
        requestAnimationFrame(() => {
          if (isDisposed) return;
          requestAnimationFrame(() => {
            if (isDisposed) return;
            renderer.render(scene, camera);
            emitBootProgress({
              progress: 100,
              stage: 'Observatório pronto',
              detail: 'Iniciando exploração espacial...',
              loadedTextures: totalTexCount,
              totalTextures: totalTexCount,
              ready: true,
            });
          });
        });
      });
    };

    bootTimeoutId = window.setTimeout(finalizeSceneBoot, 14000);
    Promise.all(Array.from(texturePromiseCache.values())).then(() => {
      if (!isDisposed) {
        finalizeSceneBoot();
      }
    });

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      window.clearTimeout(bootTimeoutId);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handlePointerMove);
      controls.removeEventListener('start', stopAutoCamera);
      renderer.domElement.removeEventListener('wheel', handleWheelInterrupt);
      renderer.domElement.removeEventListener('mousedown', handlePointerDown);
      renderer.domElement.removeEventListener('mouseup', handlePointerUp);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      controls.dispose();
      spaceAudio.dispose();

      skyCubeRT.dispose();
      skyboxGeo.dispose();
      skyboxMat.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      sphereGeometryUltra.dispose();
      sphereGeometryHigh.dispose();
      interiorSphereGeo.dispose();
      asteroidBeltShaderMat.dispose();
      kuiperBeltShaderMat.dispose();
      saturnBoulderShaderMat.dispose();
      warpCylGeo.dispose();
      warpCylMat.dispose();
      warpGeo.dispose();
      warpMat.dispose();
      pulseBoltGeo.dispose();
      pulseBoltMat.dispose();
      activeSatelliteOrbitLineGeo.dispose();
      activeSatelliteOrbitLineMat.dispose();
      loadedTextures.forEach((tex) => tex.dispose());

      Object.values(bodyNodes).forEach((node) => {
        node.surfaceMaterial.dispose();
        if (node.atmosphereMesh) {
          (node.atmosphereMesh.material as THREE.Material).dispose();
        }
        node.solarProminenceMat?.dispose();
        if (node.solarStormParticles) {
          node.solarStormParticles.geometry.dispose();
          (node.solarStormParticles.material as THREE.Material).dispose();
        }
        if (node.saturnRingShaderMesh) {
          node.saturnRingShaderMesh.geometry.dispose();
        }
        node.saturnRingShaderMat?.dispose();
        if (node.enceladusPlumePoints) {
          node.enceladusPlumePoints.geometry.dispose();
          (node.enceladusPlumePoints.material as THREE.Material).dispose();
        }
        node.orbitLine.geometry.dispose();
        (node.orbitLine.material as THREE.Material).dispose();
      });

      Object.values(missionLines).forEach(({ line }) => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });

      envRT.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [qualityPreference]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Cosmoscope-Style Multi-Scale Switcher & Live Vertical Scale Readout ("↕ 157.377 ly") */}
      {!spacecraftControl.isActive && (
        <>
        <div className="fixed left-3.5 top-16 sm:top-20 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-slate-950/75 backdrop-blur-xl border border-white/12 p-1 rounded-full shadow-xl">
          <button
            onClick={() => {
              const selCat = getCelestialBody(selectedBodyId).category;
              if (selCat === 'galaxy' || selectedBodyId === 'sun') {
                onSelectBody('earth', false);
              } else {
                cameraCommandRef.current.desiredDistanceMultiplier = 3.4;
                cameraCommandRef.current.activeTransition = true;
              }
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              zoomLevel !== 'SOLAR_SYSTEM' && zoomLevel !== 'COSMIC_GALAXY'
                ? 'bg-sky-500/30 text-sky-200 border border-sky-400/50 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Escala Planetária (Ver Planeta de Perto)"
          >
            <span>🌍</span>
            <span className="hidden sm:inline">Planeta</span>
          </button>
          <button
            onClick={() => {
              if (selectedBodyId === 'sun') {
                cameraCommandRef.current.desiredDistanceMultiplier = 520.0;
                cameraCommandRef.current.activeTransition = true;
              } else {
                overrideDistanceMultiplierRef.current = 520.0;
                onSelectBody('sun', false);
              }
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              zoomLevel === 'SOLAR_SYSTEM'
                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Escala do Sistema Solar (Órbitas Planetárias)"
          >
            <span>🪐</span>
            <span className="hidden sm:inline">Sistema Solar</span>
          </button>
          <button
            onClick={() => {
              onSelectBody('milky-way', false);
              cameraCommandRef.current.desiredDistanceMultiplier = 1.65;
              cameraCommandRef.current.activeTransition = true;
            }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${
              zoomLevel === 'COSMIC_GALAXY'
                ? 'bg-purple-500/30 text-purple-200 border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            title="Escala Galáctica (Via Láctea 3D)"
          >
            <span>🌌</span>
            <span className="hidden sm:inline">Galáxia</span>
          </button>
        </div>

        <div
          className="px-3 py-1.5 rounded-full bg-slate-950/75 backdrop-blur-xl border border-white/12 text-[11px] font-mono text-slate-200 shadow-xl flex items-center gap-1.5"
          title="Escala Vertical do Campo de Visão Atual"
        >
          <span className="text-sky-400 font-bold">↕</span>
          <span>{scaleReadout}</span>
        </div>
      </div>

      {/* Sleek Camera Zoom Controls on Left Edge */}
      <div className="fixed left-3.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1 bg-slate-950/70 backdrop-blur-xl border border-white/10 p-1 rounded-2xl shadow-xl">
        <button
          onClick={() => {
            cameraCommandRef.current.manualZoomStep = 1;
          }}
          className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          title="Aproximar Câmera (Zoom +)"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const sel = getCelestialBody(selectedBodyId);
            cameraCommandRef.current.desiredDistanceMultiplier =
              selectedBodyId === 'milky-way'
                ? 1.65
                : sel.category === 'galaxy'
                  ? 2.05
                  : 3.4;
            cameraCommandRef.current.activeTransition = true;
          }}
          className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors border-y border-white/5"
          title="Centralizar Astro"
        >
          <Focus className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            cameraCommandRef.current.manualZoomStep = -1;
          }}
          className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          title="Afastar Câmera (Zoom -)"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
      </>
      )}

      {/* Clean 3D-Projected Object Markers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {screenLabels.map((lbl) => {
          const isSelectedSat = lbl.kind === 'satellite' && lbl.payloadId === selectedSatelliteId;
          const isSelectedLm = lbl.kind === 'landmark' && selectedLandmark?.id === lbl.payloadId;

          if (lbl.kind === 'satellite') {
            const satObj = propagatedSatellites.find((s) => s.id === lbl.payloadId);
            return (
              <button
                key={lbl.id}
                onClick={() => satObj && onSelectSatellite(satObj)}
                style={{
                  transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -120%)`,
                }}
                className={`pointer-events-auto absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono transition-all border backdrop-blur-md ${
                  isSelectedSat
                    ? 'bg-sky-500/35 border-sky-300 text-white shadow-[0_0_18px_rgba(56,189,248,0.65)] z-30'
                    : 'bg-slate-950/75 border-white/15 text-slate-200 hover:border-sky-400 hover:bg-slate-900/95 z-20'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: lbl.color }}
                />
                <span className="font-medium">{lbl.name}</span>
                {lbl.subLabel && (
                  <span className="text-[10px] text-sky-300/90">{lbl.subLabel}</span>
                )}
              </button>
            );
          }

          if (lbl.kind === 'landmark') {
            const body = getCelestialBody(selectedBodyId);
            const lmObj = body.landmarks.find((l) => l.id === lbl.payloadId);
            return (
              <button
                key={lbl.id}
                onClick={() => lmObj && onSelectLandmark(lmObj)}
                style={{
                  transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                }}
                className={`pointer-events-auto absolute flex flex-col items-center group ${
                  isSelectedLm ? 'z-30' : 'z-20'
                }`}
              >
                <div
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border backdrop-blur-md whitespace-nowrap transition-colors ${
                    isSelectedLm
                      ? 'bg-amber-500/30 border-amber-300 text-amber-100'
                      : 'bg-slate-950/75 border-amber-500/40 text-amber-200/90 group-hover:border-amber-300'
                  }`}
                >
                  ⌖ {lbl.name}
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
              </button>
            );
          }

          if (lbl.kind === 'galaxy') {
            return (
              <button
                key={lbl.id}
                onClick={() => {
                  if (spacecraftControl.isActive) {
                    onUpdateSpacecraftControl((p) => ({
                      ...p,
                      brakeRequested: false,
                      autopilotTargetId: lbl.payloadId,
                    }));
                  } else {
                    onSelectBody(lbl.payloadId, false);
                  }
                }}
                style={{
                  transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -50%)`,
                }}
                className="pointer-events-auto absolute px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-medium tracking-wide text-white/95 hover:text-sky-300 transition-colors drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] z-20"
              >
                {lbl.name}
              </button>
            );
          }

          if (lbl.kind === 'galactic_landmark') {
            const isSolarSystemMarker = lbl.payloadId === 'solar-system-marker';
            return (
              <button
                key={lbl.id}
                onClick={() => {
                  if (isSolarSystemMarker) {
                    if (spacecraftControl.isActive) {
                      onUpdateSpacecraftControl((p) => ({
                        ...p,
                        brakeRequested: false,
                        autopilotTargetId: 'sun',
                      }));
                    } else if (selectedBodyId === 'sun') {
                      cameraCommandRef.current.desiredDistanceMultiplier = 520.0;
                      cameraCommandRef.current.activeTransition = true;
                    } else {
                      overrideDistanceMultiplierRef.current = 520.0;
                      onSelectBody('sun', false);
                    }
                  }
                }}
                style={{
                  transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
                }}
                className={`pointer-events-auto absolute flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs tracking-wide transition-all ${
                  isSolarSystemMarker
                    ? 'bg-sky-500/25 border border-sky-400/60 text-white font-semibold shadow-[0_0_16px_rgba(56,189,248,0.5)] hover:bg-sky-500/45 z-30 cursor-pointer'
                    : 'text-slate-100/90 hover:text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.98)] z-20'
                }`}
              >
                {isSolarSystemMarker && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                    style={{ backgroundColor: lbl.color, boxShadow: `0 0 8px ${lbl.color}` }}
                  />
                )}
                <span>{lbl.name}</span>
              </button>
            );
          }

          return (
            <button
              key={lbl.id}
              onClick={() => {
                if (spacecraftControl.isActive) {
                  onUpdateSpacecraftControl((p) => ({
                    ...p,
                    brakeRequested: false,
                    autopilotTargetId: lbl.payloadId,
                  }));
                } else {
                  onSelectBody(lbl.payloadId, lbl.payloadId !== selectedBodyId);
                }
              }}
              style={{
                transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
              }}
              className="pointer-events-auto absolute flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-slate-950/65 border border-white/12 text-slate-200 hover:border-sky-400/70 hover:text-white backdrop-blur-md transition-colors z-10"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: lbl.color }}
              />
              <span>{lbl.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
