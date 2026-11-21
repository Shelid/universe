import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CabinStationId,
  CelestialBodyData,
  CharacterVariantId,
  MiningResourceId,
  NearbySpacecraftContact,
  PropagatedSatellite,
  SatelliteCategory,
  ScaleMode,
  SceneBootProgress,
  SpacecraftControlState,
  SpacecraftTelemetry,
  SpacecraftVariantId,
  SurfaceLandmark,
  SurvivalResourcesState,
  WarpFlightState,
  ZoomLevel,
} from '../types/astronomy';
import { getCharacterPreset, getSpacecraftPreset } from '../data/hangarCatalog';
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
import { createSR7Spacecraft3DGroup, SR7SpacecraftRefs } from '../utils/sr7SpacecraftModel';
import { createAstronautCharacter3D, AstronautCharacterRefs } from '../utils/astronautCharacterModel';
import { createOrbitalStation3DGroup } from '../utils/orbitalStationModel';
import { createHangarBay3D, HangarCameraFocus } from '../utils/hangarBayModel';
import { DEFAULT_FLIGHT_CONTROL_PREFS, FlightControlPrefs } from '../utils/flightControlPrefs';
import {
  createInitialSurvivalState,
  stepMiningSimulation,
  stepSurvivalSimulation,
} from '../utils/survivalEngine';
import {
  CatalogOrbitalHotspot,
  generateHotspotsForBody,
  getBodyMiningProfile,
  MINING_RESOURCES,
} from '../data/miningCatalog';
import { propagateSingleSatellite, VERIFIED_SATELLITE_CATALOG } from '../data/satellitesData';
import { spaceAudio } from '../utils/spaceAudioEngine';
import { VirtualSteerInput } from './SpacecraftCockpitHUD';
import { EVAVirtualInput } from './EVACharacterHUD';

export interface StationDeployCommand {
  seq: number;
  mode: 'ORBIT_INSPECT' | 'SHIP_DOCK' | 'EVA_WALK';
}

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
  evaActive?: boolean;
  evaVisorLightOn?: boolean;
  evaRecenterTrigger?: number;
  evaRadarTrigger?: number;
  evaVirtualInput?: EVAVirtualInput;
  selectedShipId?: SpacecraftVariantId;
  selectedCharacterId?: CharacterVariantId;
  stationDeployCommand?: StationDeployCommand;
  lobbyShowcaseActive?: boolean;
  lobbyFocusTarget?: HangarCameraFocus;
  flightControlPrefs?: FlightControlPrefs;
  survivalStateRef?: React.MutableRefObject<SurvivalResourcesState>;
  onSyncSurvivalState?: (next: SurvivalResourcesState) => void;
  onTriggerCabinStationAction?: (stationId: Exclude<CabinStationId, 'NONE'>) => void;
  bodySelectSeq?: number;
  hideHud?: boolean;
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
  'tyche-prime': {
    diffuse: '/textures/earth_day_sss_4k.jpg',
    clouds: '/textures/earth_clouds_sss_4k.jpg',
    night: '/textures/earth_night_sss_4k.jpg',
    aux: '/textures/earth_bump_roughness_clouds_4096.jpg',
    normal: '/textures/earth_normal_2048.jpg',
  },
  'ignis-prime': {
    diffuse: '/textures/mars_4k.jpg',
  },
  'krystallos-v': {
    diffuse: '/textures/uranus_2k.jpg',
  },
  'solaris-nova': {
    diffuse: '/textures/sun_4k.jpg',
  },
  'xylos-omega': {
    diffuse: '/textures/earth_day_sss_4k.jpg',
    clouds: '/textures/earth_clouds_sss_4k.jpg',
    night: '/textures/earth_night_sss_4k.jpg',
    aux: '/textures/earth_bump_roughness_clouds_4096.jpg',
    normal: '/textures/earth_normal_2048.jpg',
  },
  'aether-ix': {
    diffuse: '/textures/jupiter_4k.jpg',
  },
  'nyx-obsidian': {
    diffuse: '/textures/mercury_4k.jpg',
  },
  'chronos-prime': {
    diffuse: '/textures/saturn_4k.jpg',
  },
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
  'tyche-prime': {
    diffuse: '/textures/earth_day_4096.jpg',
    clouds: '/textures/earth_clouds_1024.png',
    night: '/textures/earth_night_4096.jpg',
    aux: '/textures/earth_bump_roughness_clouds_4096.jpg',
    normal: '/textures/earth_normal_2048.jpg',
  },
  'ignis-prime': { diffuse: '/textures/mars_2k.jpg' },
  'krystallos-v': { diffuse: '/textures/uranus_2k.jpg' },
  'solaris-nova': { diffuse: '/textures/sun_2k.jpg' },
  'xylos-omega': {
    diffuse: '/textures/earth_day_4096.jpg',
    clouds: '/textures/earth_clouds_1024.png',
    night: '/textures/earth_night_4096.jpg',
    aux: '/textures/earth_bump_roughness_clouds_4096.jpg',
    normal: '/textures/earth_normal_2048.jpg',
  },
  'aether-ix': { diffuse: '/textures/jupiter_2k.jpg' },
  'nyx-obsidian': { diffuse: '/textures/mercury_2k.jpg' },
  'chronos-prime': { diffuse: '/textures/saturn_2k.jpg' },
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
  evaActive = false,
  evaVisorLightOn = true,
  evaRecenterTrigger = 0,
  evaRadarTrigger = 0,
  evaVirtualInput,
  selectedShipId = 'sr7-vanguard',
  selectedCharacterId = 'cmd-artemis',
  stationDeployCommand,
  lobbyShowcaseActive = false,
  lobbyFocusTarget = 'OVERVIEW',
  flightControlPrefs = DEFAULT_FLIGHT_CONTROL_PREFS,
  survivalStateRef,
  onSyncSurvivalState,
  onTriggerCabinStationAction,
  bodySelectSeq = 0,
  hideHud = false,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [screenLabels, setScreenLabels] = useState<ScreenLabel[]>([]);
  const [scaleReadout, setScaleReadout] = useState<string>('18.400 km');

  const sr7InstanceRef = useRef<SR7SpacecraftRefs | null>(null);
  const astronautInstanceRef = useRef<AstronautCharacterRefs | null>(null);

  useEffect(() => {
    sr7InstanceRef.current?.setVariant(getSpacecraftPreset(selectedShipId));
  }, [selectedShipId]);

  useEffect(() => {
    astronautInstanceRef.current?.setVariant(getCharacterPreset(selectedCharacterId));
  }, [selectedCharacterId]);

  const internalSimTimeRef = useRef<number>(simulationTimeMs);
  const fallbackSurvivalRef = useRef<SurvivalResourcesState>(createInitialSurvivalState());
  const activeSurvivalRef = survivalStateRef || fallbackSurvivalRef;

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
    evaActive,
    evaVisorLightOn,
    evaRecenterTrigger,
    evaRadarTrigger,
    evaVirtualInput,
    selectedShipId,
    selectedCharacterId,
    stationDeployCommand,
    lobbyShowcaseActive,
    lobbyFocusTarget,
    flightControlPrefs,
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
    onSyncSurvivalState,
    onTriggerCabinStationAction,
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
      evaActive,
      evaVisorLightOn,
      evaRecenterTrigger,
      evaRadarTrigger,
      evaVirtualInput,
      selectedShipId,
      selectedCharacterId,
      stationDeployCommand,
      lobbyShowcaseActive,
      lobbyFocusTarget,
      flightControlPrefs,
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
      onSyncSurvivalState,
      onTriggerCabinStationAction,
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
  }, [selectedBodyId, saturnRingDiveMode, warpState.isActive, bodySelectSeq]);

  useEffect(() => {
    if (isExploringInterior) {
      cameraCommandRef.current.activeTransition = true;
      cameraCommandRef.current.desiredDistanceMultiplier = 2.85;
    }
  }, [isExploringInterior]);

  const prevSelectedSatIdRef = useRef<string | null>(selectedSatelliteId);
  useEffect(() => {
    if (
      selectedSatelliteId &&
      selectedBodyId === 'earth' &&
      selectedSatelliteId !== 'sat-orbital-gateway'
    ) {
      cameraCommandRef.current.activeTransition = true;
      cameraCommandRef.current.desiredDistanceMultiplier = 1.95;
    } else if (
      !selectedSatelliteId &&
      prevSelectedSatIdRef.current !== null &&
      selectedBodyId === 'earth' &&
      !warpState.isActive
    ) {
      cameraCommandRef.current.activeTransition = true;
      cameraCommandRef.current.desiredDistanceMultiplier = 3.4;
    }
    prevSelectedSatIdRef.current = selectedSatelliteId;
  }, [selectedSatelliteId, selectedBodyId, warpState.isActive]);

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
    renderer.toneMappingExposure = 1.18;
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
      hangarTransitionActive = false;
      if (
        stateRef.current.spacecraftControl.isActive &&
        stateRef.current.spacecraftControl.cameraView === 'EXTERNAL'
      ) {
        lastManualOrbitTimestamp = performance.now();
      }
    };
    controls.addEventListener('start', stopAutoCamera);
    let cockpitFovTargetOffset = 0;
    let cockpitFovOffset = 0;
    let externalZoomTargetMult = 1.0;
    let externalZoomMult = 1.0;
    const handleWheelInterrupt = (e: WheelEvent) => {
      cameraCommandRef.current.activeTransition = false;
      if (stateRef.current.spacecraftControl.isActive) {
        if (stateRef.current.spacecraftControl.cameraView === 'COCKPIT') {
          cockpitFovTargetOffset = THREE.MathUtils.clamp(
            cockpitFovTargetOffset + Math.sign(e.deltaY) * 4.5,
            -28,
            12
          );
        } else {
          externalZoomTargetMult = THREE.MathUtils.clamp(
            externalZoomTargetMult + Math.sign(e.deltaY) * 0.14,
            0.55,
            2.85
          );
        }
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

    // REAL 3D SOLAR KEY LIGHT, PLANETARY ALBEDO BOUNCE ("EARTHSHINE") & HIGH-CONTRAST HDR PMREM REFLECTIONS
    const sunPointLight = new THREE.PointLight('#fff8eb', 2.4, 0, 0);
    sunPointLight.position.set(0, 0, 0);
    scene.add(sunPointLight);

    const sunKeyDirLight = new THREE.DirectionalLight('#fff9ed', 3.4);
    sunKeyDirLight.visible = false;
    scene.add(sunKeyDirLight);
    scene.add(sunKeyDirLight.target);

    const planetAlbedoLight = new THREE.DirectionalLight('#38bdf8', 0.95);
    planetAlbedoLight.visible = false;
    scene.add(planetAlbedoLight);
    scene.add(planetAlbedoLight.target);

    const spaceHemisphereLight = new THREE.HemisphereLight('#93c5fd', '#090d16', 0.28);
    scene.add(spaceHemisphereLight);

    // High-Dynamic-Range (1024x512) Studio Space & Solar Specular Reflection Environment (PMREM)
    // Makes PBR metallic hull panels, engine nozzles, solar wings & cockpit canopy gleam with cinema-grade contrast
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 1024;
    envCanvas.height = 512;
    const envCtx = envCanvas.getContext('2d')!;
    const skyGrad = envCtx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0.0, '#040814');
    skyGrad.addColorStop(0.38, '#0c1930');
    skyGrad.addColorStop(0.49, '#1e3a5f');
    skyGrad.addColorStop(0.51, '#17253b');
    skyGrad.addColorStop(0.65, '#080d1a');
    skyGrad.addColorStop(1.0, '#020409');
    envCtx.fillStyle = skyGrad;
    envCtx.fillRect(0, 0, 1024, 512);

    // Subtle ecliptic Milky Way reflection band
    const eclipticBand = envCtx.createLinearGradient(0, 210, 0, 302);
    eclipticBand.addColorStop(0, 'rgba(56, 189, 248, 0)');
    eclipticBand.addColorStop(0.5, 'rgba(125, 211, 252, 0.22)');
    eclipticBand.addColorStop(1, 'rgba(56, 189, 248, 0)');
    envCtx.fillStyle = eclipticBand;
    envCtx.fillRect(0, 210, 1024, 92);

    // Intense multi-layered solar specular disk & golden corona highlight in reflection map
    const sunOuterGlow = envCtx.createRadialGradient(780, 168, 8, 780, 168, 240);
    sunOuterGlow.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    sunOuterGlow.addColorStop(0.12, 'rgba(255, 250, 220, 0.98)');
    sunOuterGlow.addColorStop(0.28, 'rgba(253, 224, 71, 0.65)');
    sunOuterGlow.addColorStop(0.55, 'rgba(249, 115, 22, 0.22)');
    sunOuterGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    envCtx.fillStyle = sunOuterGlow;
    envCtx.fillRect(520, 0, 504, 420);

    // Earthshine / planetary cyan-sapphire bounce reflection lobe
    const nebSpot = envCtx.createRadialGradient(256, 310, 12, 256, 310, 260);
    nebSpot.addColorStop(0, 'rgba(56, 189, 248, 0.68)');
    nebSpot.addColorStop(0.45, 'rgba(14, 165, 233, 0.25)');
    nebSpot.addColorStop(1, 'rgba(15, 23, 42, 0)');
    envCtx.fillStyle = nebSpot;
    envCtx.fillRect(0, 60, 520, 452);

    const envEquirectTex = new THREE.CanvasTexture(envCanvas);
    envEquirectTex.mapping = THREE.EquirectangularReflectionMapping;
    envEquirectTex.colorSpace = THREE.SRGBColorSpace;
    const envRT = pmremGenerator.fromEquirectangular(envEquirectTex);
    scene.environment = envRT.texture;
    envEquirectTex.dispose();

    const shipRimLight = new THREE.DirectionalLight('#e0f2fe', 0.72);
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
    let shipTexLoaded = 0;
    let shipTexTotal = 0;
    let astronautLoaded = 0;
    let stationLoaded = 0;
    let lastBootProgressEmitMs = 0;

    const emitUnifiedBootProgress = (detail: string, forceEmit = false) => {
      if (isDisposed || bootCompleted) return;
      const totalUnits = totalTexCount + Math.max(1, shipTexTotal) + 2;
      const doneUnits = settledTexCount + shipTexLoaded + astronautLoaded + stationLoaded;
      const nowMs = performance.now();
      if (!forceEmit && doneUnits < totalUnits && nowMs - lastBootProgressEmitMs < 85) {
        return;
      }
      lastBootProgressEmitMs = nowMs;
      const pct = 22 + Math.round((doneUnits / Math.max(1, totalUnits)) * 68);
      const stage =
        shipTexTotal > 0 && shipTexLoaded < shipTexTotal
          ? 'Carregando Nave Espacial 3D & Cabine...'
          : settledTexCount < totalTexCount
            ? 'Carregando texturas planetárias NASA...'
            : astronautLoaded + stationLoaded < 2
              ? 'Carregando Astronauta & Estação Orbital...'
              : 'Preparando shaders 3D...';
      emitBootProgress({
        progress: Math.min(90, pct),
        stage,
        detail,
        loadedTextures: doneUnits,
        totalTextures: totalUnits,
        ready: false,
      });
    };

    emitBootProgress({
      progress: 22,
      stage: 'Carregando universo, nave e texturas 3D...',
      detail: 'Preparando downloads e cache em VRAM',
      loadedTextures: 0,
      totalTextures: totalTexCount + 2,
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
            emitUnifiedBootProgress(getTextureDisplayLabel(url));
            resolve(optimized);
          },
          undefined,
          () => {
            if (isDisposed) {
              resolve(null);
              return;
            }
            settledTexCount++;
            emitUnifiedBootProgress(`Fallback procedural: ${getTextureDisplayLabel(url)}`);
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
      if (body.id === 'sun' || body.id === 'solaris-nova' || body.category === 'galaxy') {
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

      if (body.id === 'sun' || body.id === 'solaris-nova') {
        const coronaMat = createSolarCoronaMaterial();
        atmosphereMesh = new THREE.Mesh(sphereGeometryUltra, coronaMat);
        atmosphereMesh.scale.setScalar(1.38);
        tiltGroup.add(atmosphereMesh);

        // Volumetric Wide Optical Solar Bloom & Anamorphic Lens Flare Halo
        const solarFlareCanvas = document.createElement('canvas');
        solarFlareCanvas.width = 512;
        solarFlareCanvas.height = 512;
        const sfCtx = solarFlareCanvas.getContext('2d')!;
        const sfGrad = sfCtx.createRadialGradient(256, 256, 6, 256, 256, 250);
        sfGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.98)');
        sfGrad.addColorStop(0.14, 'rgba(254, 249, 195, 0.82)');
        sfGrad.addColorStop(0.32, 'rgba(253, 224, 71, 0.42)');
        sfGrad.addColorStop(0.62, 'rgba(249, 115, 22, 0.12)');
        sfGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        sfCtx.fillStyle = sfGrad;
        sfCtx.fillRect(0, 0, 512, 512);
        // Subtle horizontal anamorphic streak + 4 coronal diffraction rays
        sfCtx.save();
        sfCtx.translate(256, 256);
        const rayAngles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
        rayAngles.forEach((ang, rIdx) => {
          sfCtx.save();
          sfCtx.rotate(ang);
          const rx = rIdx === 0 ? 245 : rIdx === 1 ? 185 : 135;
          const ry = rIdx === 0 ? 11 : 6;
          const rg = sfCtx.createRadialGradient(0, 0, 1, 0, 0, rx);
          rg.addColorStop(0.0, 'rgba(255, 255, 255, 0.72)');
          rg.addColorStop(0.35, 'rgba(254, 240, 138, 0.28)');
          rg.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
          sfCtx.fillStyle = rg;
          sfCtx.scale(1, ry / rx);
          sfCtx.beginPath();
          sfCtx.arc(0, 0, rx, 0, Math.PI * 2);
          sfCtx.fill();
          sfCtx.restore();
        });
        sfCtx.restore();
        const solarFlareTex = new THREE.CanvasTexture(solarFlareCanvas);
        solarFlareTex.colorSpace = THREE.SRGBColorSpace;
        const solarBloomSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: solarFlareTex,
            transparent: true,
            opacity: 0.88,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        solarBloomSprite.scale.setScalar(5.8);
        tiltGroup.add(solarBloomSprite);

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

      if (
        body.id === 'uranus' ||
        body.id === 'neptune' ||
        body.id === 'haumea' ||
        body.id === 'krystallos-v' ||
        body.id === 'aether-ix' ||
        body.id === 'chronos-prime'
      ) {
        const uRingGeo = new THREE.RingGeometry(
          body.id === 'haumea' ? 1.55 : 1.32,
          body.id === 'chronos-prime' || body.id === 'aether-ix'
            ? 2.25
            : body.id === 'uranus' || body.id === 'krystallos-v'
              ? 1.95
              : body.id === 'haumea'
                ? 1.82
                : 1.78,
          perf.tier === 'low' ? 56 : 88
        );
        const uRingMat = new THREE.MeshBasicMaterial({
          color:
            body.id === 'chronos-prime'
              ? '#e879f9'
              : body.id === 'aether-ix'
                ? '#fde047'
                : body.id === 'krystallos-v'
                  ? '#c084fc'
                  : body.id === 'uranus'
                    ? '#67e8f9'
                    : body.id === 'haumea'
                      ? '#e2e8f0'
                      : '#60a5fa',
          side: THREE.DoubleSide,
          transparent: true,
          opacity:
            body.id === 'chronos-prime' || body.id === 'aether-ix' || body.id === 'krystallos-v'
              ? 0.42
              : body.id === 'uranus'
                ? 0.24
                : body.id === 'haumea'
                  ? 0.35
                  : 0.14,
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

    // REALISTIC 3D ORBITAL MINING LASER RIG + SURFACE CRATER + UPWARD ORE PARTICLE STREAM
    // Note: CylinderGeometry(radiusTop at y=+1 planet impact, radiusBottom at y=0 ship emitter lens)
    // Perspective makes y=0 (~7 shipScales from camera) appear ~80x larger in screen pixels than y=1 (planet surface),
    // so radiusBottom is tightly focused to match the ship's 0.085 turret lens while radiusTop expands at the planet crater!
    const miningBeamGroup = new THREE.Group();
    miningBeamGroup.visible = false;
    scene.add(miningBeamGroup);

    const miningCoreGeo = new THREE.CylinderGeometry(0.42, 0.055, 1.0, 18, 1, true);
    miningCoreGeo.translate(0, 0.5, 0);
    const miningCoreMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const miningCoreMesh = new THREE.Mesh(miningCoreGeo, miningCoreMat);

    const miningSheathGeo = new THREE.CylinderGeometry(0.95, 0.11, 1.0, 20, 1, true);
    miningSheathGeo.translate(0, 0.5, 0);
    const miningSheathMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const miningSheathMesh = new THREE.Mesh(miningSheathGeo, miningSheathMat);

    const miningCoronaGeo = new THREE.CylinderGeometry(1.65, 0.17, 1.0, 20, 1, true);
    miningCoronaGeo.translate(0, 0.5, 0);
    const miningCoronaMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const miningCoronaMesh = new THREE.Mesh(miningCoronaGeo, miningCoronaMat);

    miningBeamGroup.add(miningCoronaMesh, miningSheathMesh, miningCoreMesh);

    const miningMuzzleGlowMat = new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const miningMuzzleGlow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 12), miningMuzzleGlowMat);
    miningBeamGroup.add(miningMuzzleGlow);

    const miningCraterGroup = new THREE.Group();
    miningCraterGroup.visible = false;
    scene.add(miningCraterGroup);

    // Photorealistic GLSL Surface Ablation Caldera, Molten Crust Fractures & Volumetric 3D Fireball Plume
    // Uses NormalBlending with organic noise-warped dark scorched thermal contrast so it pops vividly even over bright sunlit clouds without any circular gray ring!
    const createVolumetricFirePlumeTexture = (): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;

      // Irregular turbulent dark volcanic smoke & scorched thermal cloud base (non-circular organic clusters)
      const smokePuffs = [
        { x: 128, y: 128, r: 92, a: 0.88 },
        { x: 96, y: 108, r: 64, a: 0.78 },
        { x: 162, y: 114, r: 60, a: 0.78 },
        { x: 108, y: 158, r: 62, a: 0.76 },
        { x: 154, y: 150, r: 58, a: 0.75 },
        { x: 126, y: 92, r: 56, a: 0.74 },
        { x: 86, y: 136, r: 50, a: 0.68 },
        { x: 170, y: 136, r: 48, a: 0.68 },
      ];
      for (const s of smokePuffs) {
        const g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, s.r);
        g.addColorStop(0.0, `rgba(22, 7, 3, ${s.a})`);
        g.addColorStop(0.55, `rgba(68, 12, 5, ${s.a * 0.65})`);
        g.addColorStop(1.0, 'rgba(22, 7, 3, 0.0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Billowing crimson-orange-gold fiery plasma lobes inside the smoke plume
      const fireLobes = [
        { x: 128, y: 128, r: 74, c0: 'rgba(255,255,255,1.0)', c1: 'rgba(253,224,71,0.96)', c2: 'rgba(249,115,22,0.92)', c3: 'rgba(153,27,27,0.0)' },
        { x: 104, y: 112, r: 52, c0: 'rgba(254,240,138,0.96)', c1: 'rgba(249,115,22,0.9)', c2: 'rgba(220,38,38,0.75)', c3: 'rgba(127,29,29,0.0)' },
        { x: 154, y: 118, r: 50, c0: 'rgba(254,240,138,0.96)', c1: 'rgba(234,88,12,0.9)', c2: 'rgba(185,28,28,0.72)', c3: 'rgba(127,29,29,0.0)' },
        { x: 114, y: 150, r: 52, c0: 'rgba(253,224,71,0.95)', c1: 'rgba(249,115,22,0.88)', c2: 'rgba(185,28,28,0.72)', c3: 'rgba(127,29,29,0.0)' },
        { x: 148, y: 144, r: 48, c0: 'rgba(254,215,170,0.94)', c1: 'rgba(234,88,12,0.86)', c2: 'rgba(153,27,27,0.68)', c3: 'rgba(127,29,29,0.0)' },
        { x: 128, y: 98, r: 46, c0: 'rgba(255,255,255,0.98)', c1: 'rgba(250,204,21,0.92)', c2: 'rgba(249,115,22,0.82)', c3: 'rgba(127,29,29,0.0)' },
      ];
      for (const l of fireLobes) {
        const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
        g.addColorStop(0.0, l.c0);
        g.addColorStop(0.28, l.c1);
        g.addColorStop(0.64, l.c2);
        g.addColorStop(1.0, l.c3);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crisp optical welding-arc diffraction rays on top of the fiery plasma core
      ctx.save();
      ctx.translate(128, 128);
      const flareAngles = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];
      flareAngles.forEach((ang, idx) => {
        ctx.save();
        ctx.rotate(ang);
        const rx = idx < 2 ? 122 : 86;
        const ry = idx < 2 ? 7 : 4.5;
        const rg = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
        rg.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
        rg.addColorStop(0.35, 'rgba(253, 224, 71, 0.68)');
        rg.addColorStop(0.7, 'rgba(249, 115, 22, 0.28)');
        rg.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = rg;
        ctx.scale(1, ry / rx);
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const firePlumeTex = createVolumetricFirePlumeTexture();

    // 1. Custom GLSL Molten Crust Fracture & Scorched Caldera Disc (Flush on Planet Surface, NormalBlending for high contrast on bright clouds)
    const miningCraterDiscMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLaserColor: { value: new THREE.Color('#38bdf8') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uLaserColor;
        varying vec2 vUv;

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          if (r > 1.0) discard;

          float a = atan(p.y, p.x);

          // Domain-warped organic outer boundary (eliminates perfect geometric circle look)
          float boundaryWarp =
            0.12 * sin(a * 5.0 + uTime * 3.2) +
            0.08 * cos(a * 9.0 - uTime * 4.8) +
            0.05 * sin(a * 15.0 + uTime * 6.5);
          float rw = r + boundaryWarp * smoothstep(0.15, 0.85, r);
          if (rw > 0.96) discard;

          // 1. White-hot laser contact focal point
          float core = exp(-r * r * 22.0);

          // 2. Jagged radial molten magma fissures & tectonic fractures
          float waveA = sin(a * 8.0 + sin(r * 16.0 - uTime * 8.5) * 1.8);
          float waveB = cos(a * 13.0 - cos(r * 22.0 - uTime * 10.5) * 1.5);
          float crackPattern = pow(max(0.0, 1.0 - abs(waveA * 0.55 + waveB * 0.45)), 2.8);
          float crackMask = crackPattern * smoothstep(0.88, 0.08, rw) * smoothstep(0.02, 0.16, r);

          // 3. Boiling turbulent magma & dark volcanic smoke bed
          float granule = 0.5 + 0.5 * sin(r * 26.0 - uTime * 15.0 + sin(a * 7.0 + uTime * 4.5) * 2.2);
          float fireZone = exp(-rw * rw * 4.8) * (0.65 + 0.35 * granule);
          float scorchBed = smoothstep(0.94, 0.22, rw);

          vec3 darkScorch = vec3(0.09, 0.03, 0.015);
          vec3 deepCrimson = vec3(0.78, 0.11, 0.03);
          vec3 fieryOrange = vec3(0.98, 0.40, 0.05);
          vec3 goldMagma = vec3(1.0, 0.86, 0.28);
          vec3 whiteHot = vec3(1.0, 1.0, 0.96);

          vec3 col = mix(darkScorch, deepCrimson, fireZone);
          col = mix(col, fieryOrange, smoothstep(0.22, 0.72, fireZone + crackMask * 0.65));
          col = mix(col, goldMagma, clamp(crackMask * 1.15 + core * 0.6, 0.0, 1.0));
          col = mix(col, whiteHot, clamp(core * 1.35, 0.0, 1.0));

          float alpha = clamp(scorchBed * 0.92 + core, 0.0, 0.98) * smoothstep(0.96, 0.62, rw);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const miningCraterDisc = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), miningCraterDiscMat);
    miningCraterDisc.rotation.x = -Math.PI / 2;
    miningCraterDisc.position.y = 0.02;

    // 2. Camera-Facing 3D Turbulent Fireball & Dark Smoke Plume Sprite (NormalBlending so it is 100% visible from any angle over Earth)
    const miningCraterDomeMat = new THREE.SpriteMaterial({
      map: firePlumeTex,
      transparent: true,
      opacity: 0.96,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const miningCraterDome = new THREE.Sprite(miningCraterDomeMat);
    miningCraterDome.position.y = 0.14;

    // 3. Counter-Rotating Secondary Fireball Cloud Sprite for boiling volumetric motion
    const miningCraterHaloMat = new THREE.SpriteMaterial({
      map: firePlumeTex,
      color: '#fed7aa',
      transparent: true,
      opacity: 0.92,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const miningCraterHalo = new THREE.Sprite(miningCraterHaloMat);
    miningCraterHalo.position.y = 0.22;

    // 4. 3D Vertical Plasma Excavation Geyser Plume (shoots perpendicular to planet surface normal)
    const miningPlumeConeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLaserColor: { value: new THREE.Color('#38bdf8') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uLaserColor;
        varying vec2 vUv;

        void main() {
          float h = vUv.y;
          float angle = vUv.x * 6.2831853;
          float streak1 = 0.5 + 0.5 * sin(angle * 6.0 + h * 10.0 - uTime * 16.0);
          float streak2 = 0.5 + 0.5 * cos(angle * 11.0 - h * 14.0 - uTime * 22.0);
          float jet = pow(streak1 * 0.6 + streak2 * 0.4, 1.5);

          float baseFade = smoothstep(0.0, 0.10, h);
          float topFade = pow(max(0.0, 1.0 - h), 1.5);
          float alpha = baseFade * topFade * (0.45 + 0.55 * jet) * 0.94;

          vec3 baseCol = vec3(1.0, 0.96, 0.80);
          vec3 midCol = vec3(0.96, 0.38, 0.05);
          vec3 tipCol = vec3(0.18, 0.05, 0.02);
          vec3 col = mix(baseCol, midCol, smoothstep(0.0, 0.52, h));
          col = mix(col, tipCol, smoothstep(0.52, 0.98, h));

          gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        }
      `,
    });
    const plumeConeGeo = new THREE.CylinderGeometry(0.42, 0.14, 1.15, 24, 1, true);
    plumeConeGeo.translate(0, 0.575, 0);
    const miningPlumeCone = new THREE.Mesh(plumeConeGeo, miningPlumeConeMat);

    const miningCraterLight = new THREE.PointLight('#fb923c', 2.8, 0, 1.4);
    miningCraterLight.position.set(0, 0.25, 0);
    miningCraterGroup.add(
      miningCraterDisc,
      miningCraterDome,
      miningPlumeCone,
      miningCraterHalo,
      miningCraterLight
    );

    // Planetary Impact High-Velocity Laser Ablation Micro-Sparks (64 razor-sharp incandescent needles, NOT round pebbles!)
    const MINING_EJECTA_COUNT = 64;
    const miningEjectaGeo = new THREE.CylinderGeometry(0.01, 0.042, 1.0, 6);
    const miningEjectaMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.96,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const miningEjectaInstanced = new THREE.InstancedMesh(
      miningEjectaGeo,
      miningEjectaMat,
      MINING_EJECTA_COUNT
    );
    miningEjectaInstanced.frustumCulled = false;
    miningEjectaInstanced.visible = false;
    scene.add(miningEjectaInstanced);

    const MINING_STREAM_COUNT = 56;
    const miningStreamGeo = new THREE.OctahedronGeometry(1, 0);
    const miningStreamMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const miningStreamInstanced = new THREE.InstancedMesh(
      miningStreamGeo,
      miningStreamMat,
      MINING_STREAM_COUNT
    );
    miningStreamInstanced.frustumCulled = false;
    miningStreamInstanced.visible = false;
    scene.add(miningStreamInstanced);

    // 3D GEOLOGICAL VEIN HOTSPOTS GROUP (surface beacons anchored to planet spinMesh)
    const hotspotGroup = new THREE.Group();
    hotspotGroup.visible = false;
    scene.add(hotspotGroup);
    const hotspotBeacons = Array.from({ length: 3 }, () => {
      const grp = new THREE.Group();
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.56,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.94, 28), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;

      const beamMat = new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 1.35, 12, 1, true), beamMat);
      spire.position.y = 0.7;
      grp.add(ring, spire);
      hotspotGroup.add(grp);
      return { grp, ring, ringMat, beamMat };
    });

    let activeHotspotsBodyId: string | null = null;
    let activeHotspotsList: CatalogOrbitalHotspot[] = [];
    const _miningTmpMat4 = new THREE.Matrix4();
    const _miningShipToTarget = new THREE.Vector3();
    const _miningBeamStart = new THREE.Vector3();
    const _miningBeamDir = new THREE.Vector3();
    const _miningBeamEnd = new THREE.Vector3();
    const _miningNormalWorld = new THREE.Vector3();
    const _miningNormalLocal = new THREE.Vector3();
    const _miningPerpU = new THREE.Vector3();
    const _miningPerpV = new THREE.Vector3();
    const _miningParticlePos = new THREE.Vector3();
    const _miningScaleVec = new THREE.Vector3();
    const _miningSpinInvQuat = new THREE.Quaternion();
    const _miningDummyQuat = new THREE.Quaternion();
    const _miningColorTmp = new THREE.Color();

    // SR-7 EXPLORER 3D SPACECRAFT & INTERACTIVE 4K COCKPIT + VENTRAL PULSE PROJECTILES
    const sr7 = createSR7Spacecraft3DGroup({
      maxAnisotropy,
      onLoadProgress: (loaded, total, detail) => {
        shipTexLoaded = loaded;
        shipTexTotal = total;
        emitUnifiedBootProgress(detail, loaded >= total);
      },
    });
    sr7.rootGroup.scale.setScalar(0.34);
    sr7.rootGroup.visible = false;
    sr7.setVariant(getSpacecraftPreset(stateRef.current.selectedShipId || 'sr7-vanguard'));
    sr7InstanceRef.current = sr7;
    scene.add(sr7.rootGroup);

    // RIGGED 3D ASTRONAUT CHARACTER (Shared seamlessly between Cockpit Pilot Seat & Zero-G EVA Mode)
    const astronaut = createAstronautCharacter3D();
    astronaut.modelReadyPromise.finally(() => {
      astronautLoaded = 1;
      emitUnifiedBootProgress('Astronauta 3D carregado', true);
    });
    astronaut.rootGroup.scale.setScalar(0.43);
    astronaut.rootGroup.visible = false;
    astronaut.setVariant(getCharacterPreset(stateRef.current.selectedCharacterId || 'cmd-artemis'));
    astronautInstanceRef.current = astronaut;
    sr7.pilotSeatAnchor.add(astronaut.rootGroup);

    // ASSEMBLED ORBITAL STATION GLB (41.5m x 12.34m x 49.49m in Earth LEO)
    const orbitalStation = createOrbitalStation3DGroup();
    orbitalStation.modelReadyPromise.finally(() => {
      stationLoaded = 1;
      emitUnifiedBootProgress('Estação Orbital 3D carregada', true);
    });
    const orbitalStationWorldPos = new THREE.Vector3();
    let orbitalStationWorldScale = 0.0000145;
    let hasOrbitalStationPos = false;
    let prevStationDeploySeq = stateRef.current.stationDeployCommand?.seq || 0;
    const _stationXAxis = new THREE.Vector3();
    const _stationYAxis = new THREE.Vector3();
    const _stationZAxis = new THREE.Vector3();
    const _stationBasisMat = new THREE.Matrix4();
    const _evaRelVec = new THREE.Vector3();
    let activeNearPlane = 0.00005;
    const gatewayRecordFallback = VERIFIED_SATELLITE_CATALOG[0];

    // PRISTINE PRE-GAME 3D HANGAR BAY ("GALPÃO ESPACIAL" — replaces universe behind MainMenuLobby)
    const hangarBay = createHangarBay3D();
    hangarBay.rootGroup.visible = false;
    scene.add(hangarBay.rootGroup);
    const _spaceBgColor = new THREE.Color('#010206');
    const _hangarBgColor = new THREE.Color('#070b12');
    let hangarTransitionActive = false;
    const _hangarFocusCamPos = new THREE.Vector3();
    const _hangarFocusTarget = new THREE.Vector3();

    let wasLobbyShowcaseActive = false;
    let prevLobbyFocusTarget: HangarCameraFocus = stateRef.current.lobbyFocusTarget || 'OVERVIEW';
    let wasEvaActive = false;
    let evaAttachedToShip = true;
    const evaVelocity = new THREE.Vector3();
    const evaForward = new THREE.Vector3();
    const evaRight = new THREE.Vector3();
    const evaUp = new THREE.Vector3();
    const evaMoveDir = new THREE.Vector3();
    const evaTargetPos = new THREE.Vector3();
    const evaDisplacement = new THREE.Vector3();
    let prevEvaRecenterTrigger = stateRef.current.evaRecenterTrigger || 0;
    let prevEvaRadarTrigger = stateRef.current.evaRadarTrigger || 0;
    let evaRadarAgeSec = 99;
    let prevSpaceParkedValid = false;
    let shipAnchorMode: 'NONE' | 'STATION' | 'BODY' = 'NONE';
    let shipAnchorBodyId = 'earth';
    const prevShipAnchorWorldPos = new THREE.Vector3();

    const projectileGroup = new THREE.Group();
    scene.add(projectileGroup);

    interface ActivePulseBolt {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      age: number;
    }
    const activePulseBolts: ActivePulseBolt[] = [];
    const pulseBoltGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.85, 8);
    pulseBoltGeo.rotateX(Math.PI / 2);
    const pulseBoltMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
    });

    // 3D ORBITAL BALLISTIC METEORITES & PIRATE SENTINEL DRONES (Gives full gameplay purpose to Pulse Cannon [F] & Shields!)
    const combatEncounterGroup = new THREE.Group();
    combatEncounterGroup.visible = false;
    scene.add(combatEncounterGroup);

    interface OrbitalCombatTarget {
      kind: 'CRYSTAL_METEOR' | 'SENTINEL_DRONE';
      group: THREE.Group;
      coreMat: THREE.MeshBasicMaterial;
      orbitAngle: number;
      orbitSpeed: number;
      distOffsetMult: number;
      heightOffsetMult: number;
      hp: number;
      maxHp: number;
      respawnTimer: number;
      fireCooldown: number;
    }

    const orbitalCombatTargets: OrbitalCombatTarget[] = [];
    const meteorRockGeo = new THREE.DodecahedronGeometry(0.45, 0);
    const meteorCrystalGeo = new THREE.OctahedronGeometry(0.56, 0);
    const droneChassisGeo = new THREE.OctahedronGeometry(0.38, 1);
    const droneWingGeo = new THREE.BoxGeometry(1.15, 0.06, 0.32);
    const droneEyeGeo = new THREE.SphereGeometry(0.18, 10, 10);

    const meteorRockMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.72,
      metalness: 0.28,
    });
    const droneChassisMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.32,
      metalness: 0.85,
    });

    // 5 Peaceful Destructible Crystal-Vein Meteorites around the active planet (No enemy drones!)
    for (let ti = 0; ti < 5; ti++) {
      const grp = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.92,
      });

      const rock = new THREE.Mesh(meteorRockGeo, meteorRockMat);
      const crystal = new THREE.Mesh(meteorCrystalGeo, coreMat);
      crystal.rotation.set(0.6, 0.8, 0.3);
      grp.add(rock, crystal);

      combatEncounterGroup.add(grp);
      orbitalCombatTargets.push({
        kind: 'CRYSTAL_METEOR',
        group: grp,
        coreMat,
        orbitAngle: (ti / 5) * Math.PI * 2,
        orbitSpeed: 0.08 + (ti % 4) * 0.035,
        distOffsetMult: 10.5 + ti * 3.8,
        heightOffsetMult: ((ti % 3) - 1) * 3.0,
        hp: 1.0,
        maxHp: 1.0,
        respawnTimer: 0,
        fireCooldown: 999,
      });
    }

    // Sentinel Drone red laser line & 3D combat explosion flash sprite
    const sentinelLaserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    ]);
    const sentinelLaserMat = new THREE.LineBasicMaterial({
      color: '#f43f5e',
      transparent: true,
      opacity: 0.9,
    });
    const sentinelLaserLine = new THREE.Line(sentinelLaserGeo, sentinelLaserMat);
    sentinelLaserLine.visible = false;
    scene.add(sentinelLaserLine);
    let sentinelLaserVisualTimer = 0;

    const combatExplosionSpriteMat = new THREE.SpriteMaterial({
      map: firePlumeTex,
      transparent: true,
      opacity: 0,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const combatExplosionSprite = new THREE.Sprite(combatExplosionSpriteMat);
    combatExplosionSprite.visible = false;
    scene.add(combatExplosionSprite);
    let combatExplosionAge = 99;

    // 6-DOF Spacecraft Flight Physics State
    const pressedKeys = new Set<string>();
    const shipVelocity = new THREE.Vector3();
    let shipYaw = 0;
    let shipPitch = 0;
    let angVelPitch = 0;
    let angVelYaw = 0;
    let angVelRoll = 0;
    let manualRollAngle = 0;
    let boostBlend = 0;
    let continuousThrottle = 0;
    let appliedThrottle = 0;
    let brakeBlend = 0;
    let wasWalkingInside = false;
    const interiorWalkPos = new THREE.Vector3(0, -0.081, -3.18);
    const interiorWalkVel = new THREE.Vector3();
    let interiorWalkYaw = 0;
    let walkGrounded = true;
    let lastSyncedReactThrottle = 0;
    let throttleSyncTimer = 0;
    let lastManualOrbitTimestamp = 0;
    let wasSpacecraftActive = false;
    let prevCameraView: 'COCKPIT' | 'EXTERNAL' = 'EXTERNAL';
    let lastFirePulseCount = 0;
    let muzzleFlashAlpha = 0;
    let isCockpitLooking = false;
    let isExternalLooking = false;
    let isCockpitSteerDragging = false;
    let cockpitLastLookX = 0;
    let cockpitLastLookY = 0;
    let cockpitLookTargetYaw = 0;
    let cockpitLookTargetPitch = 0;
    let cockpitLookYaw = 0;
    let cockpitLookPitch = 0;
    let externalLookTargetYaw = 0;
    let externalLookTargetPitch = 0;
    let externalLookYaw = 0;
    let externalLookPitch = 0;
    const externalCamQuat = new THREE.Quaternion();
    let hasExternalCamQuat = false;
    let cockpitDragOriginX = 0;
    let cockpitDragOriginY = 0;
    let cockpitDragSteerX = 0;
    let cockpitDragSteerY = 0;
    let cockpitSteerSmoothX = 0;
    let cockpitSteerSmoothY = 0;
    let currentShipScale = 0.000035;
    let lastTelemetrySync = 0;
    let lastSurvivalSync = 0;
    const _shadowRayDir = new THREE.Vector3();
    const _shadowToBody = new THREE.Vector3();
    const computeInPlanetaryShadow = (
      pos: THREE.Vector3,
      scaleMode: ScaleMode,
      positions: Record<string, THREE.Vector3>
    ): boolean => {
      const sunPos = positions['sun'];
      if (!sunPos) return false;
      _shadowRayDir.subVectors(sunPos, pos);
      const distToSun = _shadowRayDir.length();
      if (distToSun < 1e-6) return false;
      _shadowRayDir.divideScalar(distToSun);
      for (let i = 0; i < ALL_CELESTIAL_BODIES.length; i++) {
        const b = ALL_CELESTIAL_BODIES[i];
        if (b.id === 'sun' || b.category === 'galaxy' || b.category === 'star') {
          continue;
        }
        const bPos = positions[b.id];
        if (!bPos) continue;
        const bRad = Math.max(0.00015, getScaledRadius(b, scaleMode));
        _shadowToBody.subVectors(bPos, pos);
        const proj = _shadowToBody.dot(_shadowRayDir);
        if (proj <= bRad * 0.25 || proj >= distToSun) continue;
        const perpSq = _shadowToBody.lengthSq() - proj * proj;
        if (perpSq < bRad * bRad * 0.96) return true;
      }
      return false;
    };
    let prevRecenterTrigger = stateRef.current.spacecraftControl.recenterTrigger || 0;
    let prevRadarAudioTs = 0;
    let prevBrakeAudio = false;
    let prevAutopilotIdAudio: string | null = null;
    let prevMiningActiveAudio = false;
    let prevMiningDrillingAudio = false;
    let prevBoostAudio = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      spaceAudio.unlock();
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (stateRef.current.evaActive && !stateRef.current.spacecraftControl.isActive) {
        pressedKeys.add(e.code);
        if (e.code === 'Space') e.preventDefault();
        return;
      }

      if (!stateRef.current.spacecraftControl.isActive) return;

      pressedKeys.add(e.code);

      if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      const isWalking = Boolean(stateRef.current.spacecraftControl.walkingInside);

      if (e.code === 'KeyG' && !e.repeat) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        callbacksRef.current.onUpdateSpacecraftControl((prev) => {
          const nextWalk = !prev.walkingInside;
          spaceAudio.playCockpitSwitch(nextWalk);
          return {
            ...prev,
            walkingInside: nextWalk,
            throttle: 0,
            boostActive: false,
            autopilotTargetId: null,
            brakeRequested: nextWalk,
            cameraView: nextWalk ? 'EXTERNAL' : prev.cameraView,
          };
        });
      } else if (e.code === 'Space') {
        if (isWalking) return;
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
      } else if (e.code === 'KeyB' && !isWalking) {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => {
          const cur = prev.cockpitSeat || 'LEFT';
          const next = cur === 'LEFT' ? 'CENTER' : cur === 'CENTER' ? 'RIGHT' : 'LEFT';
          return { ...prev, cameraView: 'COCKPIT', cockpitSeat: next };
        });
      } else if (e.code === 'KeyX' && !e.repeat && !isWalking) {
        (document.activeElement as HTMLElement | null)?.blur?.();
        callbacksRef.current.onUpdateSpacecraftControl((prev) => {
          const nextActive = !prev.miningLaserActive;
          spaceAudio.playCockpitSwitch(nextActive);
          return { ...prev, miningLaserActive: nextActive };
        });
      } else if (e.code === 'KeyC') {
        lastManualOrbitTimestamp = 0;
        const TAU = Math.PI * 2;
        cockpitLookYaw = (((cockpitLookYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
        externalLookYaw = (((externalLookYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
        cockpitLookTargetYaw = 0;
        cockpitLookTargetPitch = 0;
        cockpitFovTargetOffset = 0;
        externalLookTargetYaw = 0;
        externalLookTargetPitch = isWalking ? -0.18 : 0;
        externalZoomTargetMult = 1.0;
        if (!isWalking) {
          manualRollAngle = 0;
          sr7.hullGroup.rotation.z = 0;
          sr7.interiorGroup.rotation.z = 0;
        }
      } else if (e.code === 'KeyF' && !isWalking) {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          firePulseCount: prev.firePulseCount + 1,
        }));
      } else if (e.code === 'KeyO') {
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          interiorLightsOn: !prev.interiorLightsOn,
        }));
      } else if (e.code === 'KeyK' && !e.repeat) {
        const nextRad = !activeSurvivalRef.current.radiatorsDeployed;
        activeSurvivalRef.current = {
          ...activeSurvivalRef.current,
          radiatorsDeployed: nextRad,
        };
        spaceAudio.playRadiatorToggle(nextRad);
        callbacksRef.current.onSyncSurvivalState?.(activeSurvivalRef.current);
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          radiatorsDeployed: nextRad,
        }));
      } else if (e.code === 'KeyY' && !e.repeat) {
        const nextEco = !activeSurvivalRef.current.ecoCruiseMode;
        activeSurvivalRef.current = {
          ...activeSurvivalRef.current,
          ecoCruiseMode: nextEco,
        };
        spaceAudio.playCockpitSwitch();
        callbacksRef.current.onSyncSurvivalState?.(activeSurvivalRef.current);
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          ecoCruiseMode: nextEco,
        }));
      } else if (e.code === 'KeyE' && !e.repeat && isWalking) {
        const stId = activeSurvivalRef.current.nearbyCabinStation;
        if (stId && stId !== 'NONE') {
          callbacksRef.current.onTriggerCabinStationAction?.(stId);
        }
      } else if (e.code === 'KeyW' && !e.repeat && !isWalking) {
        continuousThrottle = Math.min(1, Number((continuousThrottle + 0.025).toFixed(3)));
        lastSyncedReactThrottle = continuousThrottle;
        callbacksRef.current.onUpdateSpacecraftControl((prev) => ({
          ...prev,
          brakeRequested: false,
          throttle: continuousThrottle,
        }));
      } else if (e.code === 'KeyS' && !e.repeat && !isWalking) {
        continuousThrottle = Math.max(0, Number((continuousThrottle - 0.025).toFixed(3)));
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
      if (stateRef.current.spacecraftControl.isActive) {
        const isWalking = Boolean(stateRef.current.spacecraftControl.walkingInside);
        if (e.button === 2 && !isWalking) {
          isCockpitSteerDragging = true;
          cockpitDragOriginX = e.clientX;
          cockpitDragOriginY = e.clientY;
        } else if (e.button === 0) {
          if (stateRef.current.spacecraftControl.cameraView === 'COCKPIT') {
            isCockpitLooking = true;
            cockpitLastLookX = e.clientX;
            cockpitLastLookY = e.clientY;
          } else {
            isExternalLooking = true;
            cockpitLastLookX = e.clientX;
            cockpitLastLookY = e.clientY;
            lastManualOrbitTimestamp = performance.now();
          }
        }
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      const isWalking = Boolean(stateRef.current.spacecraftControl.walkingInside);
      if (isCockpitLooking) {
        if ((e.buttons & 1) === 0) {
          isCockpitLooking = false;
        } else {
          const dx = e.clientX - cockpitLastLookX;
          const dy = e.clientY - cockpitLastLookY;
          cockpitLastLookX = e.clientX;
          cockpitLastLookY = e.clientY;
          cockpitLookTargetYaw = isWalking
            ? cockpitLookTargetYaw - dx * 0.0046
            : cockpitLookTargetYaw + dx * 0.0046;
          cockpitLookTargetPitch = THREE.MathUtils.clamp(
            cockpitLookTargetPitch + (isWalking ? -dy : dy) * 0.0044,
            -1.32,
            1.48
          );
        }
      }
      if (isExternalLooking) {
        if ((e.buttons & 1) === 0) {
          isExternalLooking = false;
        } else {
          const dx = e.clientX - cockpitLastLookX;
          const dy = e.clientY - cockpitLastLookY;
          cockpitLastLookX = e.clientX;
          cockpitLastLookY = e.clientY;
          lastManualOrbitTimestamp = performance.now();
          externalLookTargetYaw = externalLookTargetYaw - dx * 0.0058;
          externalLookTargetPitch = THREE.MathUtils.clamp(
            externalLookTargetPitch - dy * 0.005,
            isWalking ? -1.05 : -1.48,
            isWalking ? 0.55 : 1.48
          );
        }
      }
      if (isCockpitSteerDragging) {
        if ((e.buttons & 2) === 0 || isWalking) {
          isCockpitSteerDragging = false;
          cockpitDragSteerX = 0;
          cockpitDragSteerY = 0;
        } else {
          const dx = e.clientX - cockpitDragOriginX;
          const dy = e.clientY - cockpitDragOriginY;
          if (Math.hypot(dx, dy) >= 4) {
            cockpitDragSteerX = THREE.MathUtils.clamp(-dx * 0.0055, -1.0, 1.0);
            cockpitDragSteerY = THREE.MathUtils.clamp(dy * 0.0045, -1.0, 1.0);
          }
        }
      }
    };

    const handlePointerUp = (e: MouseEvent) => {
      isCockpitLooking = false;
      isExternalLooking = false;
      isCockpitSteerDragging = false;
      cockpitDragSteerX = 0;
      cockpitDragSteerY = 0;

      if (e.button !== 0) return;

      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);

      if (stateRef.current.spacecraftControl.isActive) {
        if (stateRef.current.spacecraftControl.cameraView === 'COCKPIT') {
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
        // Never raycast planets/clickableMeshes while piloting the ship (prevents accidental autopilot or camera ejection)
        return;
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
          callbacksRef.current.onSelectBody(
            bodyId,
            bodyId !== stateRef.current.selectedBodyId
          );
        }
      }
    };

    const handleDoubleClick = () => {
      if (stateRef.current.spacecraftControl.isActive) {
        const TAU = Math.PI * 2;
        cockpitLookYaw = (((cockpitLookYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
        externalLookYaw = (((externalLookYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
        cockpitLookTargetYaw = 0;
        cockpitLookTargetPitch = 0;
        cockpitFovTargetOffset = 0;
        externalLookTargetYaw = 0;
        externalLookTargetPitch = 0;
        externalZoomTargetMult = 1.0;
        lastManualOrbitTimestamp = 0;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (stateRef.current.spacecraftControl.isActive) {
        e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      spaceAudio.unlock();
      if (stateRef.current.spacecraftControl.isActive && e.touches.length === 1) {
        if (stateRef.current.spacecraftControl.cameraView === 'COCKPIT') {
          isCockpitLooking = true;
        } else {
          isExternalLooking = true;
          lastManualOrbitTimestamp = performance.now();
        }
        cockpitLastLookX = e.touches[0].clientX;
        cockpitLastLookY = e.touches[0].clientY;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - cockpitLastLookX;
      const dy = e.touches[0].clientY - cockpitLastLookY;
      cockpitLastLookX = e.touches[0].clientX;
      cockpitLastLookY = e.touches[0].clientY;
      if (isCockpitLooking) {
        cockpitLookTargetYaw = cockpitLookTargetYaw + dx * 0.0052;
        cockpitLookTargetPitch = THREE.MathUtils.clamp(cockpitLookTargetPitch + dy * 0.005, -1.32, 1.48);
      } else if (isExternalLooking) {
        lastManualOrbitTimestamp = performance.now();
        externalLookTargetYaw = externalLookTargetYaw - dx * 0.0058;
        externalLookTargetPitch = THREE.MathUtils.clamp(
          externalLookTargetPitch - dy * 0.005,
          -1.48,
          1.48
        );
      }
    };
    const handleTouchEnd = () => {
      isCockpitLooking = false;
      isExternalLooking = false;
      isCockpitSteerDragging = false;
      cockpitDragSteerX = 0;
      cockpitDragSteerY = 0;
    };

    renderer.domElement.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('mouseup', handlePointerUp);
    renderer.domElement.addEventListener('dblclick', handleDoubleClick);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
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

    const applyHangarShowcaseFrame = (dtStep: number, timeSec: number, forceSnap: boolean) => {
      const activeShipPresetLobby = getSpacecraftPreset(stateRef.current.selectedShipId || 'sr7-vanguard');
      const focusMode: HangarCameraFocus = stateRef.current.lobbyFocusTarget || 'OVERVIEW';

      // Completely conceal ALL universe meshes, skybox stars, orbits & cosmic lights so zero game world leaks behind the Hangar menu
      starGroup.visible = false;
      sunPointLight.visible = false;
      sunKeyDirLight.visible = false;
      planetAlbedoLight.visible = false;
      spaceHemisphereLight.visible = false;
      shipRimLight.visible = false;
      beltGroup.visible = false;
      missionsGroup.visible = false;
      satelliteGroup.visible = false;
      warpTunnelGroup.visible = false;
      projectileGroup.visible = false;
      combatEncounterGroup.visible = false;
      sentinelLaserLine.visible = false;
      combatExplosionSprite.visible = false;
      activeSatelliteOrbitLine.visible = false;
      ALL_CELESTIAL_BODIES.forEach((b) => {
        const node = bodyNodes[b.id];
        if (node) {
          node.rootGroup.visible = false;
          node.orbitLine.visible = false;
        }
      });

      if (!(scene.background as THREE.Color).equals(_hangarBgColor)) {
        (scene.background as THREE.Color).copy(_hangarBgColor);
      }

      hangarBay.rootGroup.visible = true;
      hangarBay.setAccentColor(activeShipPresetLobby.accentHex);
      hangarBay.update(timeSec);

      if (Math.abs(camera.fov - 44) > 0.1) {
        camera.fov = 44;
        camera.updateProjectionMatrix();
      }

      // True 1:1 metric scale: glbWrapper uses 0.14 internal scale, so 1 / 0.14 restores native 53.08m x 43.19m x 17.32m starship alongside 1.90m astronaut
      const hangarShipScale = 1 / 0.14;
      currentShipScale = hangarShipScale;
      sr7.setLandingGearDeployed(true);
      sr7.rootGroup.visible = true;
      sr7.rootGroup.scale.setScalar(hangarShipScale);
      manualRollAngle = 0;
      sr7.hullGroup.rotation.z = 0;
      sr7.interiorGroup.rotation.z = 0;
      sr7.rootGroup.position.set(
        hangarBay.shipAnchorPos.x,
        hangarBay.padTopY - sr7.getFloorOffsetY(true) * hangarShipScale,
        hangarBay.shipAnchorPos.z
      );
      sr7.rootGroup.rotation.set(0, 2.18, 0);

      sr7.updateAnimations({
        dt: dtStep,
        clockTime: timeSec,
        throttle: 0.04,
        boostActive: false,
        headlightsOn: true,
        interiorLightsOn: true,
        shieldsOn: false,
        pitchInput: 0,
        rollInput: 0,
        yawInput: 0,
        pitchDeg: 0,
        rollDeg: 0,
        radarPulseAgeSec: 99,
        muzzleFlashAlpha: 0,
        speedFormatted: 'GALPÃO 01',
        nearestName: activeShipPresetLobby.name,
        nearestDist: 'EM MANUTENÇÃO',
        reactorTempC: 245,
        sasEnabled: true,
        autopilotActive: false,
        isCockpitView: false,
        shipScale: hangarShipScale,
        driftAngleDeg: 0,
      });

      // Position standing Astronaut on the Hangar floor right beside the pad (clear of left sidebar)
      if (evaAttachedToShip) {
        scene.add(astronaut.rootGroup);
        evaAttachedToShip = false;
      }
      astronaut.rootGroup.visible = true;
      astronaut.rootGroup.scale.setScalar(1.0);
      astronaut.rootGroup.position.set(
        hangarBay.astronautAnchorPos.x,
        0.002,
        hangarBay.astronautAnchorPos.z
      );
      astronaut.rootGroup.rotation.set(0, Math.PI + 0.34, 0);

      astronaut.update({
        dt: dtStep,
        clockTime: timeSec,
        mode: 'EVA_IDLE',
        moveSpeed01: 0,
        boostActive: false,
        pitchTilt: 0,
        rollTilt: 0,
        visorLightOn: false,
        worldScale: 1.0,
      });

      // Frame either Overview (1:1 Ship + full 1.90m Astronaut), Ship Inspection, or Close-up Astronaut (offset right for left sidebar)
      if (focusMode === 'SHIP') {
        _hangarFocusTarget.set(
          hangarBay.shipAnchorPos.x - 10.5,
          5.2,
          hangarBay.shipAnchorPos.z
        );
        _hangarFocusCamPos.set(
          hangarBay.shipAnchorPos.x - 21.0,
          14.2,
          hangarBay.shipAnchorPos.z + 63.0
        );
      } else if (focusMode === 'CHARACTER') {
        _hangarFocusTarget.set(
          hangarBay.astronautAnchorPos.x - 0.72,
          1.02,
          hangarBay.astronautAnchorPos.z
        );
        _hangarFocusCamPos.set(
          hangarBay.astronautAnchorPos.x - 0.30,
          1.48,
          hangarBay.astronautAnchorPos.z + 3.25
        );
      } else {
        _hangarFocusTarget.set(-5.5, 3.8, -5.0);
        _hangarFocusCamPos.set(-21.5, 2.35, 42.5);
      }

      if (forceSnap || !wasLobbyShowcaseActive) {
        wasLobbyShowcaseActive = true;
        prevLobbyFocusTarget = focusMode;
        hangarTransitionActive = false;
        const prevDamping = controls.enableDamping;
        controls.enableDamping = false;
        controls.target.copy(_hangarFocusTarget);
        camera.position.copy(_hangarFocusCamPos);
        controls.update();
        controls.enableDamping = prevDamping;
        hasInitializedTargetPos = true;
      } else if (focusMode !== prevLobbyFocusTarget) {
        prevLobbyFocusTarget = focusMode;
        hangarTransitionActive = true;
      }

      if (hangarTransitionActive) {
        const lerpAlpha = 1 - Math.exp(-dtStep * 6.2);
        controls.target.lerp(_hangarFocusTarget, lerpAlpha);
        camera.position.lerp(_hangarFocusCamPos, lerpAlpha);
        if (
          controls.target.distanceTo(_hangarFocusTarget) < 0.025 &&
          camera.position.distanceTo(_hangarFocusCamPos) < 0.04
        ) {
          hangarTransitionActive = false;
        }
      }

      controls.enabled = true;
      controls.minDistance = focusMode === 'CHARACTER' ? 1.85 : 9.5;
      controls.maxDistance = focusMode === 'CHARACTER' ? 16.0 : 88.0;
      controls.minPolarAngle = 0.24;
      controls.maxPolarAngle = Math.PI * 0.54;
      controls.update();

      // Keep camera strictly inside the 132m x 132m x 36m 1:1 Hangar walls & ceiling
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -59.5, 59.5);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.55, 31.5);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -59.5, 60.5);
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -42.0, 42.0);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0.35, 16.0);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, -42.0, 44.0);
    };

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
      if (!st.spacecraftControl.isActive) {
        miningBeamGroup.visible = false;
        miningCraterGroup.visible = false;
        miningStreamInstanced.visible = false;
        miningEjectaInstanced.visible = false;
        hotspotGroup.visible = false;
        combatEncounterGroup.visible = false;
        sentinelLaserLine.visible = false;
        combatExplosionSprite.visible = false;
      }

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

      // Position Earth Satellites 3D Spacecraft Models & Guaranteed Assembled Orbital Station in LEO
      const earthPos = bodyWorldPositions['earth'];
      hasOrbitalStationPos = false;
      if (earthPos) {
        satelliteGroup.position.copy(earthPos);
        const pendingStationCmd =
          st.stationDeployCommand && st.stationDeployCommand.seq !== prevStationDeploySeq;
        const isStationFocused =
          st.selectedSatelliteId === 'sat-orbital-gateway' ||
          Boolean(pendingStationCmd) ||
          Boolean(st.lobbyShowcaseActive);
        const nearEarthForSats =
          st.selectedBodyId === 'earth' ||
          camera.position.distanceTo(earthPos) < 0.16 ||
          (prevSpaceParkedValid && sr7.rootGroup.position.distanceTo(earthPos) < 0.16);
        const showEarthSats = (nearEarthForSats || isStationFocused) && !st.isExploringInterior;
        satelliteGroup.visible = showEarthSats;

        if (showEarthSats) {
          const currentEarthRadius = getScaledRadius(getCelestialBody('earth'), st.scaleMode);
          const satRadiusScale = currentEarthRadius / 1.25;
          const earthShipRefScale = THREE.MathUtils.clamp(
            currentEarthRadius * 0.0038,
            0.0000028,
            0.00175
          );
          orbitalStationWorldScale = earthShipRefScale * 0.72;

          let positionedGateway = false;
          const positionGatewayModel = (satPos: [number, number, number]) => {
            if (!satModelMap['sat-orbital-gateway']) {
              satModelMap['sat-orbital-gateway'] = orbitalStation.rootGroup;
              satelliteGroup.add(orbitalStation.rootGroup);
            }
            const model = orbitalStation.rootGroup;
            model.visible =
              nearEarthForSats || isStationFocused || Boolean(st.enabledSatelliteCategories['SPACE_STATIONS']);
            if (model.visible) {
              model.position.set(satPos[0], satPos[1], satPos[2]);
              // Orient Nadir Cupola (-Y) toward Earth and horizontal solar truss tangent to LEO orbit
              _stationYAxis.set(satPos[0], satPos[1], satPos[2]).normalize();
              _stationZAxis.crossVectors(_worldUp, _stationYAxis);
              if (_stationZAxis.lengthSq() < 1e-6) _stationZAxis.set(0, 0, 1);
              _stationZAxis.normalize();
              _stationXAxis.crossVectors(_stationYAxis, _stationZAxis).normalize();
              _stationBasisMat.makeBasis(_stationXAxis, _stationYAxis, _stationZAxis);
              model.quaternion.setFromRotationMatrix(_stationBasisMat);
              model.scale.setScalar(orbitalStationWorldScale);

              orbitalStationWorldPos.copy(earthPos).add(model.position);
              hasOrbitalStationPos = true;

              const isCloseToStation =
                isStationFocused ||
                camera.position.distanceTo(orbitalStationWorldPos) < orbitalStationWorldScale * 145;
              orbitalStation.update(clockTime, isCloseToStation, orbitalStationWorldScale);
            }
            positionedGateway = true;
          };

          st.propagatedSatellites.forEach((sat) => {
            if (sat.id === 'sat-orbital-gateway') {
              positionGatewayModel(sat.position3D);
              return;
            }
            let model = satModelMap[sat.id];
            if (!model) {
              model = createDetailedSatellite3DGroup(sat);
              satelliteGroup.add(model);
              satModelMap[sat.id] = model;
            }
            const catVisible = nearEarthForSats && !!st.enabledSatelliteCategories[sat.category];
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

          // Fallback guarantee: always mount Orbital Station even if stale cache omitted it
          if (!positionedGateway && gatewayRecordFallback) {
            const fallbackSat = propagateSingleSatellite(
              gatewayRecordFallback,
              new Date(currentSimTimeMs),
              currentEarthRadius,
              false
            );
            positionGatewayModel(fallbackSat.position3D);
          }

          const selectedSat =
            st.propagatedSatellites.find((s) => s.id === st.selectedSatelliteId) ||
            (st.selectedSatelliteId === 'sat-orbital-gateway' && gatewayRecordFallback
              ? propagateSingleSatellite(
                gatewayRecordFallback,
                new Date(currentSimTimeMs),
                currentEarthRadius,
                true
              )
              : undefined);
          if (st.showOrbits && selectedSat && selectedSat.orbitTrack3D.length > 1) {
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

      // Dynamic logarithmic near plane adjustment for sub-meter Cockpit / EVA / Station hull / Hangar Bay
      const wantUltraCloseNear =
        st.spacecraftControl.isActive ||
        st.evaActive ||
        st.lobbyShowcaseActive ||
        (st.selectedBodyId === 'earth' && st.selectedSatelliteId === 'sat-orbital-gateway');
      const desiredNear = st.lobbyShowcaseActive
        ? 0.08
        : st.spacecraftControl.isActive
          ? Math.max(0.00000025, currentShipScale * 0.012)
          : wantUltraCloseNear
            ? 0.0000018
            : 0.00005;
      if (Math.abs(desiredNear - activeNearPlane) > 1e-8) {
        activeNearPlane = desiredNear;
        camera.near = desiredNear;
        camera.updateProjectionMatrix();
      }

      if (!st.lobbyShowcaseActive) {
        hangarBay.rootGroup.visible = false;
        starGroup.visible = true;
        sunPointLight.visible = true;
        spaceHemisphereLight.visible = true;
        projectileGroup.visible = true;
        if (!(scene.background as THREE.Color).equals(_spaceBgColor)) {
          (scene.background as THREE.Color).copy(_spaceBgColor);
        }
        sr7.setLandingGearDeployed(false);
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI;
      }

      // Maintain parked/flying Spacecraft position in its local orbital reference frame
      // (Orbital Station or nearest celestial body) so leaving and returning to the ship
      // keeps it at the exact same spot relative to the station or planet!
      if (prevSpaceParkedValid && !st.lobbyShowcaseActive) {
        _tmpV1.set(0, 0, 0);
        if (shipAnchorMode === 'STATION' && hasOrbitalStationPos) {
          _tmpV1.subVectors(orbitalStationWorldPos, prevShipAnchorWorldPos);
        } else if (shipAnchorMode === 'BODY' && bodyWorldPositions[shipAnchorBodyId]) {
          _tmpV1.subVectors(bodyWorldPositions[shipAnchorBodyId], prevShipAnchorWorldPos);
        }
        if (_tmpV1.lengthSq() > 0 && _tmpV1.lengthSq() < 0.25) {
          sr7.rootGroup.position.add(_tmpV1);
          if ((st.spacecraftControl.isActive && wasSpacecraftActive) || (st.evaActive && wasEvaActive)) {
            camera.position.add(_tmpV1);
            controls.target.add(_tmpV1);
            if (st.evaActive && !evaAttachedToShip) {
              astronaut.rootGroup.position.add(_tmpV1);
            }
          }
        }

        if (
          hasOrbitalStationPos &&
          (sr7.rootGroup.position.distanceTo(orbitalStationWorldPos) < orbitalStationWorldScale * 380 ||
            (st.evaActive &&
              !evaAttachedToShip &&
              astronaut.rootGroup.position.distanceTo(orbitalStationWorldPos) <
              orbitalStationWorldScale * 380))
        ) {
          shipAnchorMode = 'STATION';
          prevShipAnchorWorldPos.copy(orbitalStationWorldPos);
        } else {
          let bestBodyId = 'earth';
          let bestRatio = Infinity;
          for (let i = 0; i < ALL_CELESTIAL_BODIES.length; i++) {
            const b = ALL_CELESTIAL_BODIES[i];
            if (b.category === 'galaxy') continue;
            const bPos = bodyWorldPositions[b.id];
            if (!bPos) continue;
            const bRad = Math.max(0.00015, getScaledRadius(b, st.scaleMode));
            const ratio = sr7.rootGroup.position.distanceTo(bPos) / bRad;
            if (ratio < bestRatio) {
              bestRatio = ratio;
              bestBodyId = b.id;
            }
          }
          shipAnchorMode = 'BODY';
          shipAnchorBodyId = bestBodyId;
          if (bodyWorldPositions[bestBodyId]) {
            prevShipAnchorWorldPos.copy(bodyWorldPositions[bestBodyId]);
          }
        }
      } else {
        shipAnchorMode = 'NONE';
      }

      // Handle explicit Station Deploy actions (Orbit Close-Up / Ship Approach / EVA Deck Walk)
      const stationCmd = st.stationDeployCommand;
      if (stationCmd && stationCmd.seq !== prevStationDeploySeq && hasOrbitalStationPos) {
        prevStationDeploySeq = stationCmd.seq;
        const earthShipScale = THREE.MathUtils.clamp(
          getScaledRadius(getCelestialBody('earth'), st.scaleMode) * 0.0038,
          0.0000028,
          0.00175
        );
        currentShipScale = earthShipScale;
        const resetControlsDamping = (nextTarget: THREE.Vector3) => {
          const prevDamping = controls.enableDamping;
          controls.enableDamping = false;
          controls.target.copy(nextTarget);
          controls.update();
          controls.enableDamping = prevDamping;
        };

        if (stationCmd.mode === 'SHIP_DOCK') {
          _tmpV1
            .copy(orbitalStation.shipApproachLocal)
            .multiplyScalar(orbitalStationWorldScale)
            .applyQuaternion(orbitalStation.rootGroup.quaternion);
          sr7.rootGroup.position.copy(orbitalStationWorldPos).add(_tmpV1);
          sr7.rootGroup.lookAt(orbitalStationWorldPos);
          shipVelocity.set(0, 0, 0);
          angVelPitch = 0;
          angVelYaw = 0;
          angVelRoll = 0;
          manualRollAngle = 0;
          sr7.hullGroup.rotation.z = 0;
          sr7.interiorGroup.rotation.z = 0;
          continuousThrottle = 0;
          lastSyncedReactThrottle = 0;
          prevSpaceParkedValid = true;
          shipAnchorMode = 'STATION';
          prevShipAnchorWorldPos.copy(orbitalStationWorldPos);
          wasSpacecraftActive = true;
          wasLobbyShowcaseActive = false;
          sr7.rootGroup.scale.setScalar(currentShipScale);
          sr7.chaseCameraAnchor.updateWorldMatrix(true, false);
          sr7.chaseCameraAnchor.getWorldPosition(_tmpV2);
          camera.position.copy(_tmpV2);
          externalCamQuat.copy(sr7.rootGroup.quaternion);
          camera.quaternion.copy(externalCamQuat);
          hasExternalCamQuat = true;
          controls.minDistance = Math.max(1e-7, currentShipScale * 2.85);
          controls.maxDistance = 200000;
          resetControlsDamping(sr7.rootGroup.position);
        } else if (stationCmd.mode === 'EVA_WALK') {
          _tmpV1
            .copy(orbitalStation.shipApproachLocal)
            .multiplyScalar(orbitalStationWorldScale)
            .applyQuaternion(orbitalStation.rootGroup.quaternion);
          sr7.rootGroup.position.copy(orbitalStationWorldPos).add(_tmpV1);
          sr7.rootGroup.lookAt(orbitalStationWorldPos);
          sr7.rootGroup.scale.setScalar(currentShipScale);
          prevSpaceParkedValid = true;
          shipAnchorMode = 'STATION';
          prevShipAnchorWorldPos.copy(orbitalStationWorldPos);

          if (evaAttachedToShip) {
            scene.add(astronaut.rootGroup);
            evaAttachedToShip = false;
          }

          // Spawn Astronaut in open space outside the Orbital Station facing the exterior modules
          _tmpV2
            .copy(orbitalStation.walkSpawnLocal)
            .multiplyScalar(orbitalStationWorldScale)
            .applyQuaternion(orbitalStation.rootGroup.quaternion);
          astronaut.rootGroup.position.copy(orbitalStationWorldPos).add(_tmpV2);
          astronaut.rootGroup.quaternion.copy(orbitalStation.rootGroup.quaternion);
          evaVelocity.set(0, 0, 0);
          wasEvaActive = true;
          wasLobbyShowcaseActive = false;

          _tmpV3.set(0, 1, 0).applyQuaternion(orbitalStation.rootGroup.quaternion).normalize();
          _tmpV4.set(0, 0, -1).applyQuaternion(astronaut.rootGroup.quaternion).normalize();
          _tmpV5.set(1, 0, 0).applyQuaternion(astronaut.rootGroup.quaternion).normalize();
          camera.position
            .copy(astronaut.rootGroup.position)
            .addScaledVector(_tmpV3, currentShipScale * 1.45)
            .addScaledVector(_tmpV5, currentShipScale * 0.48)
            .addScaledVector(_tmpV4, -currentShipScale * 4.2);
          _tmpV6
            .copy(astronaut.rootGroup.position)
            .addScaledVector(_tmpV3, currentShipScale * 0.55);
          controls.minDistance = Math.max(1e-7, currentShipScale * 0.95);
          controls.maxDistance = 200000;
          resetControlsDamping(_tmpV6);
        } else {
          // ORBIT_INSPECT: frame the 12-module Orbital Station from the exterior with Earth behind it
          wasLobbyShowcaseActive = false;
          cameraCommandRef.current.activeTransition = false;
          if (!prevSpaceParkedValid) {
            _tmpV1
              .copy(orbitalStation.shipApproachLocal)
              .multiplyScalar(orbitalStationWorldScale)
              .applyQuaternion(orbitalStation.rootGroup.quaternion);
            sr7.rootGroup.position.copy(orbitalStationWorldPos).add(_tmpV1);
            sr7.rootGroup.lookAt(orbitalStationWorldPos);
            sr7.rootGroup.scale.setScalar(currentShipScale);
            prevSpaceParkedValid = true;
            shipAnchorMode = 'STATION';
            prevShipAnchorWorldPos.copy(orbitalStationWorldPos);
          }
          if (earthPos) {
            previousTargetWorldPos.copy(earthPos);
            hasInitializedTargetPos = true;
          }
          const gatewayDist = orbitalStationWorldScale * orbitalStation.stationFocusDistanceLocal;
          const localViewDir = _tmpV3
            .set(-0.68, 0.42, 0.60)
            .normalize()
            .applyQuaternion(orbitalStation.rootGroup.quaternion);
          camera.position
            .copy(orbitalStationWorldPos)
            .addScaledVector(localViewDir, gatewayDist);
          controls.minDistance = Math.max(1e-6, orbitalStationWorldScale * 34.0);
          controls.maxDistance = 200000;
          resetControlsDamping(orbitalStationWorldPos);
        }
      }

      // CINEMATIC INTERPLANETARY WARP FLIGHT OR NORMAL CAMERA TRACKING
      const selectedBody = getCelestialBody(st.selectedBodyId);
      const targetPos = bodyWorldPositions[selectedBody.id] || _originVec;
      const targetRadius = getScaledRadius(selectedBody, st.scaleMode);

      if (st.warpState.isActive) {
        sr7.rootGroup.visible = false;
        astronaut.rootGroup.visible = false;
        shipRimLight.visible = false;
        wasSpacecraftActive = false;
        wasEvaActive = false;
        wasLobbyShowcaseActive = false;
        controls.enabled = true;
        controls.minDistance = 0.0000004;
        controls.maxDistance = 200000;
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

        // Final orbital camera position on the sunlit hemisphere of the destination planet (comfortable panoramic distance)
        const arrivalOffsetDir = computeSunlitCameraOffsetDir(destPos, destBody.id);
        const mult = destBody.id === 'sun' ? 5.2 : 4.45;
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
          const prevDamp = controls.enableDamping;
          controls.enableDamping = false;
          controls.target.copy(destPos);
          controls.update();
          controls.enableDamping = prevDamp;
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
      } else if (st.lobbyShowcaseActive) {
        // ====================================================================
        // PRE-GAME ENCLOSED 3D HANGAR BAY ("GALPÃO ESPACIAL" — Zero Game World)
        // ====================================================================
        wasWarpingLastFrame = false;
        wasSpacecraftActive = false;
        wasEvaActive = false;
        prevSpaceParkedValid = false;
        spaceAudio.updateFrame({ dt, clockTime, mode: 'OBSERVATORY' });
        applyHangarShowcaseFrame(dt, clockTime, false);
        activeSurvivalRef.current = stepSurvivalSimulation(activeSurvivalRef.current, {
          dt,
          mode: 'HANGAR',
          shipVariantId: st.selectedShipId || 'sr7-vanguard',
          throttle: 0,
          boostActive: false,
          isBraking: false,
          rcsActive: false,
          shieldsOn: false,
          headlightsOn: false,
          walkingInside: false,
          cabinLocalX: 0,
          cabinLocalZ: 0,
          evaSprinting: false,
          evaMoving: false,
          sunDistanceUnits: 149.6,
          nearestBodyId: 'earth',
          nearestBodyCategory: 'planet',
          nearestSurfaceRatio: 10,
          nearOrbitalStation: true,
          inPlanetaryShadow: false,
        });
        if (now - lastSurvivalSync > 240) {
          lastSurvivalSync = now;
          cb.onSyncSurvivalState?.(activeSurvivalRef.current);
        }
      } else if (st.spacecraftControl.isActive) {
        wasWarpingLastFrame = false;
        const sc = st.spacecraftControl;

        if (!wasSpacecraftActive) {
          if (!prevSpaceParkedValid) {
            if (hasOrbitalStationPos && st.selectedSatelliteId === 'sat-orbital-gateway') {
              _tmpV1
                .copy(orbitalStation.shipApproachLocal)
                .multiplyScalar(orbitalStationWorldScale)
                .applyQuaternion(orbitalStation.rootGroup.quaternion);
              sr7.rootGroup.position.copy(orbitalStationWorldPos).add(_tmpV1);
              _tmpMat4.lookAt(sr7.rootGroup.position, orbitalStationWorldPos, _worldUp);
              sr7.rootGroup.quaternion.setFromRotationMatrix(_tmpMat4);
              shipAnchorMode = 'STATION';
              prevShipAnchorWorldPos.copy(orbitalStationWorldPos);
            } else {
              const initScale = THREE.MathUtils.clamp(
                Math.max(0.00015, targetRadius) * 0.0038,
                0.0000028,
                0.00175
              );
              currentShipScale = initScale;
              sr7.rootGroup.scale.setScalar(currentShipScale);
              const spawnDir = computeSunlitCameraOffsetDir(targetPos, selectedBody.id);
              const spawnDist =
                selectedBody.category === 'galaxy'
                  ? targetRadius * 1.45
                  : targetRadius * 3.65 + initScale * 11.0;
              sr7.rootGroup.position.copy(targetPos).addScaledVector(spawnDir, spawnDist);
              _tmpMat4.lookAt(sr7.rootGroup.position, targetPos, _worldUp);
              sr7.rootGroup.quaternion.setFromRotationMatrix(_tmpMat4);
              shipAnchorMode = 'BODY';
              shipAnchorBodyId = selectedBody.id;
              prevShipAnchorWorldPos.copy(targetPos);
            }
            manualRollAngle = 0;
            prevSpaceParkedValid = true;
          }
          shipVelocity.set(0, 0, 0);
          angVelPitch = 0;
          angVelYaw = 0;
          angVelRoll = 0;
          sr7.hullGroup.rotation.z = manualRollAngle;
          sr7.interiorGroup.rotation.z = manualRollAngle;
          continuousThrottle = sc.throttle;
          appliedThrottle = sc.throttle;
          brakeBlend = 0;
          prevMiningActiveAudio = false;
          prevMiningDrillingAudio = false;
          prevBoostAudio = false;
          lastSyncedReactThrottle = sc.throttle;
          lastManualOrbitTimestamp = 0;
          cockpitLookTargetYaw = 0;
          cockpitLookTargetPitch = 0;
          cockpitLookYaw = 0;
          cockpitLookPitch = 0;
          cockpitFovTargetOffset = 0;
          cockpitFovOffset = 0;
          externalLookTargetYaw = 0;
          externalLookTargetPitch = 0;
          externalLookYaw = 0;
          externalLookPitch = 0;
          externalZoomTargetMult = 1.0;
          externalZoomMult = 1.0;
          externalCamQuat.copy(sr7.rootGroup.quaternion);
          _tmpEuler.setFromQuaternion(sr7.rootGroup.quaternion, 'YXZ');
          shipPitch = THREE.MathUtils.clamp(_tmpEuler.x, -1.42, 1.42);
          shipYaw = _tmpEuler.y;
          hasExternalCamQuat = true;
          wasSpacecraftActive = true;
          wasLobbyShowcaseActive = false;
          wasWalkingInside = false;
          wasEvaActive = false;
          prevCameraView = sc.cameraView;
          lastFirePulseCount = sc.firePulseCount;
        }

        // Compute true orbital-vessel scale from the most dominant nearby celestial body around the ship
        let dominantBody = selectedBody;
        let dominantRadius = Math.max(0.00015, targetRadius);
        let nearestPlanetDist = sr7.rootGroup.position.distanceTo(targetPos);
        let nearestPlanetRadius = Math.max(0.00015, targetRadius);
        let bestProxRatio = Infinity;

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

        const effectiveRefRadius =
          dominantBody.category === 'galaxy' || bestProxRatio > 1800
            ? Math.min(0.45, Math.max(0.015, dominantRadius * 0.05))
            : dominantRadius;
        const desiredShipScale = THREE.MathUtils.clamp(
          effectiveRefRadius * 0.0038,
          0.0000028,
          0.00175
        );
        currentShipScale = THREE.MathUtils.lerp(
          currentShipScale,
          desiredShipScale,
          Math.min(1, dt * 4.5)
        );
        sr7.rootGroup.scale.setScalar(currentShipScale);

        // Dynamic Physical Solar Key Light + Planetary Albedo Bounce Light ("Earthshine") + Grazing Rim Light
        shipRimLight.visible = true;
        _tmpV2.set(0.45, 0.85, 0.35).normalize();
        shipRimLight.position
          .copy(sr7.rootGroup.position)
          .addScaledVector(_tmpV2, currentShipScale * 26);
        shipRimLight.target.position.copy(sr7.rootGroup.position);
        shipRimLight.target.updateMatrixWorld();

        // 1. Directional Solar Key Light aligned accurately from the Sun (0,0,0) toward the spacecraft
        const sunPosVec = bodyWorldPositions['sun'] || _originVec;
        _tmpV3.subVectors(sunPosVec, sr7.rootGroup.position);
        const sunDist = Math.max(0.01, _tmpV3.length());
        _tmpV3.divideScalar(sunDist);
        sunKeyDirLight.visible = true;
        sunKeyDirLight.position
          .copy(sr7.rootGroup.position)
          .addScaledVector(_tmpV3, currentShipScale * 34);
        sunKeyDirLight.target.position.copy(sr7.rootGroup.position);
        sunKeyDirLight.target.updateMatrixWorld();
        const sunDistAu = Math.max(0.12, sunDist / 149.59787);
        const baseSolarKeyIntensity = THREE.MathUtils.clamp(
          3.65 / Math.pow(sunDistAu, 0.38),
          1.75,
          5.8
        );
        sunKeyDirLight.intensity = activeSurvivalRef.current.inPlanetaryShadow
          ? 0.22
          : baseSolarKeyIntensity;

        // 2. Planetary Albedo Bounce Light ("Earthshine / Planetshine") from nearest celestial body onto ship hull
        const domWorldPos = bodyWorldPositions[dominantBody.id];
        if (domWorldPos && dominantBody.id !== 'sun' && bestProxRatio < 14.0) {
          _tmpV4.subVectors(domWorldPos, sr7.rootGroup.position).normalize();
          planetAlbedoLight.visible = true;
          planetAlbedoLight.color.set(
            dominantBody.atmosphere.hasAtmosphere
              ? dominantBody.atmosphereColorHex
              : dominantBody.primaryColorHex
          );
          planetAlbedoLight.position
            .copy(sr7.rootGroup.position)
            .addScaledVector(_tmpV4, currentShipScale * 24);
          planetAlbedoLight.target.position.copy(sr7.rootGroup.position);
          planetAlbedoLight.target.updateMatrixWorld();
          const proximityBounce = THREE.MathUtils.clamp(1.85 / Math.pow(Math.max(1.05, bestProxRatio), 0.85), 0.12, 1.45);
          planetAlbedoLight.intensity = proximityBounce;
        } else {
          planetAlbedoLight.visible = false;
        }

        const isWalkingInside = Boolean(sc.walkingInside);
        if (isWalkingInside) {
          if (!wasWalkingInside) {
            wasWalkingInside = true;
            evaAttachedToShip = false;
            sr7.interiorWalkerAnchor.add(astronaut.rootGroup);
            astronaut.rootGroup.scale.setScalar(0.095);
            interiorWalkPos.set(-0.21, -0.081, -3.06);
            interiorWalkVel.set(0, 0, 0);
            interiorWalkYaw = 0;
            walkGrounded = true;
            cockpitLookTargetYaw = 0;
            cockpitLookTargetPitch = 0;
            cockpitLookYaw = 0;
            cockpitLookPitch = 0;
            externalLookTargetYaw = 0;
            externalLookTargetPitch = -0.16;
            externalLookYaw = 0;
            externalLookPitch = -0.16;
            externalZoomTargetMult = 1.0;
            externalZoomMult = 1.0;
          }

          // Walk direction vectors in hullGroup-local XZ aligned with the player's camera yaw
          const activeWalkYaw =
            sc.cameraView === 'COCKPIT' ? cockpitLookYaw : externalLookYaw;
          const walkFwdX = -Math.sin(activeWalkYaw);
          const walkFwdZ = -Math.cos(activeWalkYaw);
          const walkRightX = Math.cos(activeWalkYaw);
          const walkRightZ = -Math.sin(activeWalkYaw);

          const moveFwd =
            (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp') ? 1 : 0) -
            (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown') ? 1 : 0);
          const moveRight =
            (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight') ? 1 : 0) -
            (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft') ? 1 : 0);
          const isRunning =
            pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight');

          const walkInputLen = Math.hypot(moveFwd, moveRight);
          const targetWalkSpeed = walkInputLen > 0.01 ? (isRunning ? 0.36 : 0.21) : 0;
          const wishX =
            walkInputLen > 0.01
              ? (walkFwdX * moveFwd + walkRightX * moveRight) / walkInputLen
              : 0;
          const wishZ =
            walkInputLen > 0.01
              ? (walkFwdZ * moveFwd + walkRightZ * moveRight) / walkInputLen
              : 0;

          const accelLerp = Math.min(1, dt * (walkInputLen > 0.01 ? 14 : 11));
          interiorWalkVel.x = THREE.MathUtils.lerp(
            interiorWalkVel.x,
            wishX * targetWalkSpeed,
            accelLerp
          );
          interiorWalkVel.z = THREE.MathUtils.lerp(
            interiorWalkVel.z,
            wishZ * targetWalkSpeed,
            accelLerp
          );

          if (walkGrounded && pressedKeys.has('Space')) {
            interiorWalkVel.y = 0.26;
            walkGrounded = false;
          }
          interiorWalkVel.y -= 0.92 * dt;

          const walkRadius = 0.024;
          const walkHeight = 0.165;
          const horizSpd = Math.hypot(interiorWalkVel.x, interiorWalkVel.z);
          const substeps = Math.max(
            1,
            Math.min(5, Math.ceil((horizSpd * dt) / (walkRadius * 0.45)))
          );
          const subDt = dt / substeps;
          const collider = sr7.interiorCollider;
          walkGrounded = false;

          for (let step = 0; step < substeps; step++) {
            interiorWalkPos.addScaledVector(interiorWalkVel, subDt);
            if (collider) {
              const colRes = collider.resolveCapsule(interiorWalkPos, walkRadius, walkHeight);
              if (colRes.grounded && interiorWalkVel.y < 0) {
                interiorWalkVel.y = 0;
                walkGrounded = true;
              }
              if (colRes.hitCeiling && interiorWalkVel.y > 0) {
                interiorWalkVel.y = 0;
              }
              if (interiorWalkVel.y <= 0.005) {
                _tmpV4.set(interiorWalkPos.x, interiorWalkPos.y + 0.045, interiorWalkPos.z);
                const floorDist = collider.probeFloor(_tmpV4, 0.085);
                if (floorDist < 0.056) {
                  interiorWalkPos.y = _tmpV4.y - floorDist;
                  if (interiorWalkVel.y < 0) interiorWalkVel.y = 0;
                  walkGrounded = true;
                }
              }
            } else {
              interiorWalkPos.x = THREE.MathUtils.clamp(interiorWalkPos.x, -0.26, 0.26);
              interiorWalkPos.z = THREE.MathUtils.clamp(interiorWalkPos.z, -3.28, -2.72);
              if (interiorWalkPos.y <= -0.081) {
                interiorWalkPos.y = -0.081;
                if (interiorWalkVel.y < 0) interiorWalkVel.y = 0;
                walkGrounded = true;
              }
            }
          }

          const finalHorizSpd = Math.hypot(interiorWalkVel.x, interiorWalkVel.z);
          if (sc.cameraView === 'COCKPIT') {
            interiorWalkYaw = activeWalkYaw;
          } else if (finalHorizSpd > 0.018) {
            const targetFacing = Math.atan2(-interiorWalkVel.x, -interiorWalkVel.z);
            const deltaYaw = Math.atan2(
              Math.sin(targetFacing - interiorWalkYaw),
              Math.cos(targetFacing - interiorWalkYaw)
            );
            interiorWalkYaw += deltaYaw * Math.min(1, dt * 12);
          }

          astronaut.rootGroup.position.copy(interiorWalkPos);
          astronaut.rootGroup.rotation.set(0, interiorWalkYaw, 0);
          astronaut.rootGroup.visible = sc.cameraView !== 'COCKPIT';

          const walkNorm01 = THREE.MathUtils.clamp(finalHorizSpd / 0.36, 0, 1);
          const walkAnimMode =
            walkNorm01 < 0.06 ? 'EVA_IDLE' : isRunning ? 'EVA_RUN' : 'EVA_WALK';
          astronaut.update({
            dt,
            clockTime,
            mode: walkAnimMode,
            moveSpeed01: walkNorm01,
            boostActive: isRunning && walkNorm01 > 0.06,
            pitchTilt: 0,
            rollTilt: 0,
            visorLightOn: st.evaVisorLightOn,
            worldScale: currentShipScale * 0.095,
          });
        } else {
          if (wasWalkingInside) {
            wasWalkingInside = false;
            evaAttachedToShip = false;
            externalLookTargetYaw = 0;
            externalLookTargetPitch = 0;
          }
          // Attach shared Astronaut character to Commander pilot seat (visible in 3rd-person or when seated in Co-Pilot/Center)
          if (!evaAttachedToShip) {
            sr7.pilotSeatAnchor.add(astronaut.rootGroup);
            astronaut.rootGroup.scale.setScalar(0.165);
            astronaut.rootGroup.position.set(0, 0, 0);
            astronaut.rootGroup.rotation.set(0, 0, 0);
            evaAttachedToShip = true;
          }
          astronaut.rootGroup.visible =
            sc.cameraView === 'EXTERNAL' ||
            (sc.cameraView === 'COCKPIT' && Boolean(sc.cockpitSeat) && sc.cockpitSeat !== 'LEFT');
          astronaut.update({
            dt,
            clockTime,
            mode: 'SEATED',
            moveSpeed01: 0,
            boostActive: false,
            pitchTilt: angVelPitch / 0.42,
            rollTilt: angVelRoll / 0.68,
            visorLightOn: false,
            worldScale: currentShipScale,
          });
        }

        sr7.rootGroup.visible = true;

        // 1. Gather Smooth 6-DOF Starfighter Attitude & Propulsion Inputs
        const vSteer = st.virtualSteerInput;
        cockpitSteerSmoothX = THREE.MathUtils.lerp(
          cockpitSteerSmoothX,
          isWalkingInside ? 0 : cockpitDragSteerX,
          Math.min(1, dt * 11.0)
        );
        cockpitSteerSmoothY = THREE.MathUtils.lerp(
          cockpitSteerSmoothY,
          isWalkingInside ? 0 : cockpitDragSteerY,
          Math.min(1, dt * 11.0)
        );
        if (!isCockpitSteerDragging || isWalkingInside) {
          const dragDecay = Math.exp(-dt * 10.5);
          cockpitDragSteerX *= dragDecay;
          cockpitDragSteerY *= dragDecay;
        }

        // Configurable vertical pitch & wing roll on Arrow keys (default: ↓ climb / ↑ dive, ← roll left / → roll right)
        const pitchDir = st.flightControlPrefs?.invertPitchArrows ? -1 : 1;
        const rollDir = st.flightControlPrefs?.invertRollArrows ? -1 : 1;
        let pitchInput = isWalkingInside
          ? 0
          : ((pressedKeys.has('ArrowUp') ? 1 : 0) - (pressedKeys.has('ArrowDown') ? 1 : 0)) *
          pitchDir +
          (vSteer?.pitch || 0) +
          cockpitSteerSmoothY;
        let yawInput = isWalkingInside
          ? 0
          : (pressedKeys.has('KeyA') ? 1 : 0) -
          (pressedKeys.has('KeyD') ? 1 : 0) +
          (vSteer?.yaw || 0) +
          cockpitSteerSmoothX;
        let rollInput = isWalkingInside
          ? 0
          : ((pressedKeys.has('ArrowLeft') ? 1 : 0) - (pressedKeys.has('ArrowRight') ? 1 : 0)) *
          rollDir +
          (vSteer?.roll || 0);

        pitchInput = THREE.MathUtils.clamp(pitchInput, -1.1, 1.1);
        yawInput = THREE.MathUtils.clamp(yawInput, -1.1, 1.1);
        rollInput = THREE.MathUtils.clamp(rollInput, -1.1, 1.1);

        const wHeld = !isWalkingInside && (pressedKeys.has('KeyW') || (vSteer?.forward || 0) > 0.1);
        const sHeld = !isWalkingInside && (pressedKeys.has('KeyS') || (vSteer?.forward || 0) < -0.1);
        const isSteeringActively =
          !isWalkingInside && (Math.abs(pitchInput) > 0.05 || Math.abs(yawInput) > 0.05);

        // Synchronize keyboard W/S & HUD throttle slider seamlessly (smooth slow ramp)
        const isManualAttitudeInput = isSteeringActively || Math.abs(rollInput) > 0.05;
        if (isWalkingInside) {
          continuousThrottle = 0;
        } else if (Math.abs(sc.throttle - lastSyncedReactThrottle) > 0.002 && !wHeld && !sHeld) {
          continuousThrottle = Math.max(0, sc.throttle);
          lastSyncedReactThrottle = continuousThrottle;
        } else {
          if (wHeld) {
            continuousThrottle = THREE.MathUtils.clamp(continuousThrottle + dt * 0.28, 0, 1.0);
          } else if (sHeld) {
            continuousThrottle = THREE.MathUtils.clamp(continuousThrottle - dt * 0.34, 0, 1.0);
          }
          throttleSyncTimer += dt;
          if (
            throttleSyncTimer > 0.075 &&
            (Math.abs(continuousThrottle - lastSyncedReactThrottle) > 0.015 ||
              (sc.brakeRequested && wHeld) ||
              (sc.autopilotTargetId && isManualAttitudeInput))
          ) {
            throttleSyncTimer = 0;
            const nextSync = Number(continuousThrottle.toFixed(2));
            lastSyncedReactThrottle = nextSync;
            cb.onUpdateSpacecraftControl((prev) => ({
              ...prev,
              autopilotTargetId: isManualAttitudeInput ? null : prev.autopilotTargetId,
              brakeRequested: prev.brakeRequested && !wHeld,
              throttle: nextSync,
            }));
          }
        }

        const activeShipPreset = getSpacecraftPreset(st.selectedShipId || 'sr7-vanguard');
        const sunPosForSurv = bodyWorldPositions['sun'];
        const shipSunDist = sunPosForSurv
          ? sr7.rootGroup.position.distanceTo(sunPosForSurv)
          : sr7.rootGroup.position.length();
        const shipNearStation =
          hasOrbitalStationPos &&
          sr7.rootGroup.position.distanceTo(orbitalStationWorldPos) < orbitalStationWorldScale * 48;
        const shipInShadow = computeInPlanetaryShadow(
          sr7.rootGroup.position,
          st.scaleMode,
          bodyWorldPositions
        );
        const autoTargetUuid = isWalkingInside ? null : sc.autopilotTargetId;
        const autoTargetPosCheck =
          autoTargetUuid === 'sat-orbital-gateway' && hasOrbitalStationPos
            ? orbitalStationWorldPos
            : autoTargetUuid
              ? bodyWorldPositions[autoTargetUuid]
              : null;
        const isAutopilotFarWarp =
          Boolean(autoTargetPosCheck) &&
          sr7.rootGroup.position.distanceTo(autoTargetPosCheck!) >
          Math.max(0.002, dominantRadius * 8.5);
        const rawBoostingWanted =
          !isWalkingInside &&
          (sc.boostActive ||
            isAutopilotFarWarp ||
            pressedKeys.has('ShiftLeft') ||
            pressedKeys.has('ShiftRight'));
        const boosting = rawBoostingWanted && activeSurvivalRef.current.warpEnergyPercent > 0.35;
        if (sc.boostActive && rawBoostingWanted && !boosting) {
          cb.onUpdateSpacecraftControl((prev) =>
            prev.boostActive ? { ...prev, boostActive: false } : prev
          );
        }

        const isBrakingEarly =
          isWalkingInside ||
          (sc.brakeRequested && !wHeld && !isSteeringActively && !boosting) ||
          pressedKeys.has('Space') ||
          (sHeld && continuousThrottle <= 0.02 && appliedThrottle <= 0.04);
        const rcsIsActive =
          Math.abs(pitchInput) + Math.abs(yawInput) + Math.abs(rollInput) > 0.05;

        const liveSurv = (activeSurvivalRef.current = stepSurvivalSimulation(
          activeSurvivalRef.current,
          {
            dt,
            mode: 'SPACECRAFT',
            shipVariantId: st.selectedShipId || 'sr7-vanguard',
            throttle: continuousThrottle,
            boostActive: boosting,
            isBraking: isBrakingEarly,
            rcsActive: rcsIsActive,
            shieldsOn: sc.shieldsOn,
            headlightsOn: sc.headlightsOn,
            walkingInside: isWalkingInside,
            cabinLocalX: interiorWalkPos.x,
            cabinLocalZ: interiorWalkPos.z,
            evaSprinting: false,
            evaMoving: false,
            sunDistanceUnits: shipSunDist,
            nearestBodyId: dominantBody.id,
            nearestBodyCategory: dominantBody.category,
            nearestSurfaceRatio: Number.isFinite(bestProxRatio) ? bestProxRatio : 9999,
            nearOrbitalStation: shipNearStation,
            inPlanetaryShadow: shipInShadow,
          }
        ));

        const fatigueMult = liveSurv.fatiguePercent < 18 ? 0.78 : 1.0;
        const enginePipMult = 0.74 + liveSurv.powerPips.engines * 0.12;
        const ecoCruiseMult = liveSurv.ecoCruiseMode ? 0.85 : 1.0;
        const fuelStarveMult =
          liveSurv.fuelPercent <= 0.05 ? 0.16 : liveSurv.fuelPercent < 10 ? 0.55 : 1.0;
        const thermalThrottleMult = liveSurv.hullTempC > 680 ? 0.72 : 1.0;

        const agilityMult = activeShipPreset.flightMultipliers.agility * fatigueMult;
        const speedMult =
          activeShipPreset.flightMultipliers.speed *
          enginePipMult *
          ecoCruiseMult *
          fuelStarveMult *
          thermalThrottleMult;
        const boostMult =
          activeShipPreset.flightMultipliers.boost * (0.85 + liveSurv.powerPips.engines * 0.075);

        const targetAngPitch = pitchInput * 0.40 * agilityMult;
        const targetAngYaw = yawInput * 0.46 * agilityMult;
        const targetAngRoll = rollInput * 0.68 * agilityMult;

        const rotAccel = Math.min(1, dt * 2.6);
        const rotDamp = Math.min(1, dt * (isWalkingInside || sc.sasEnabled ? 3.8 : 0.65));
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
          Math.abs(rollInput) > 0.01 ? rotAccel : rotDamp
        );

        // Clean 'YXZ' pitch/yaw integration capped at +-81 deg (eliminates uncontrolled zenith flipping & roll drift)
        if (Math.abs(angVelPitch) > 0.0002 || Math.abs(angVelYaw) > 0.0002) {
          shipPitch = THREE.MathUtils.clamp(shipPitch + angVelPitch * dt, -1.42, 1.42);
          if (Math.abs(shipPitch) >= 1.419 && Math.sign(angVelPitch) === Math.sign(shipPitch)) {
            angVelPitch *= Math.exp(-dt * 12);
          }
          shipYaw += angVelYaw * dt;
          _tmpEuler.set(shipPitch, shipYaw, 0, 'YXZ');
          sr7.rootGroup.quaternion.setFromEuler(_tmpEuler);
        }

        // 100% Player-Chosen 360° Ship Inclination / Roll (Never auto-banks on turns, never auto-levels!)
        // Player can incline to any angle or fly upside-down ("de ponta cabeça", 180°) with ArrowLeft / ArrowRight or HUD Roll buttons.
        if (Math.abs(angVelRoll) > 0.0005) {
          manualRollAngle = Math.atan2(
            Math.sin(manualRollAngle + angVelRoll * dt),
            Math.cos(manualRollAngle + angVelRoll * dt)
          );
        }
        sr7.hullGroup.rotation.z = manualRollAngle;
        sr7.interiorGroup.rotation.z = manualRollAngle;

        // 2. Autopilot Alignment & Smooth Automated Approach (Never ejects camera out of ship!)
        const autoTargetId = isWalkingInside ? null : sc.autopilotTargetId;
        const isStationAutoTarget = autoTargetId === 'sat-orbital-gateway' && hasOrbitalStationPos;
        const autoPos = isStationAutoTarget
          ? orbitalStationWorldPos
          : autoTargetId
            ? bodyWorldPositions[autoTargetId]
            : null;
        let autopilotStatus: SpacecraftTelemetry['autopilotStatus'] = 'OFF';
        let autoThrottleDrive = isWalkingInside
          ? 0
          : boosting
            ? Math.max(continuousThrottle, 0.68)
            : continuousThrottle;

        if (autoPos && autoTargetId) {
          const autoBody = getCelestialBody(isStationAutoTarget ? 'earth' : autoTargetId);
          const autoRadius = getScaledRadius(autoBody, st.scaleMode);
          // Comfortable panoramic orbital stop distance (further back from the planet surface)
          const stopDist = isStationAutoTarget
            ? orbitalStationWorldScale * 28.0
            : autoBody.category === 'galaxy'
              ? autoRadius * 1.45
              : autoRadius * 4.55 + currentShipScale * 14.0;
          const distToAuto = sr7.rootGroup.position.distanceTo(autoPos);

          if (distToAuto <= stopDist) {
            autopilotStatus = 'ARRIVED';
            shipVelocity.multiplyScalar(Math.exp(-dt * 6.8));
            if (shipVelocity.length() < currentShipScale * 0.12) {
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
            }
          } else {
            _tmpMat4.lookAt(sr7.rootGroup.position, autoPos, _worldUp);
            _tmpQuat1.setFromRotationMatrix(_tmpMat4);
            const alignAngle = sr7.rootGroup.quaternion.angleTo(_tmpQuat1);

            if (Math.abs(pitchInput) < 0.08 && Math.abs(yawInput) < 0.08) {
              sr7.rootGroup.quaternion.slerp(_tmpQuat1, Math.min(1, dt * 3.4));
              _tmpEuler.setFromQuaternion(sr7.rootGroup.quaternion, 'YXZ');
              shipPitch = THREE.MathUtils.clamp(_tmpEuler.x, -1.42, 1.42);
              shipYaw = _tmpEuler.y;
            }
            autopilotStatus = alignAngle > 0.14 ? 'ALIGNING' : 'CRUISING';
            if (!sc.brakeRequested && !sHeld) {
              autoThrottleDrive =
                alignAngle > 0.35
                  ? 0.32
                  : distToAuto > stopDist * 3.8
                    ? 1.0
                    : distToAuto > stopDist * 1.75
                      ? 0.48
                      : 0.22;
            }
          }
        }

        // 3. Fluid Realistic Sub-Warp Spacecraft Propulsion + Relativistic Dobra Espacial
        boostBlend = THREE.MathUtils.lerp(
          boostBlend,
          boosting ? 1 : 0,
          Math.min(1, dt * (boosting ? 2.4 : 2.1))
        );
        const isBrakingNow =
          isWalkingInside ||
          (sc.brakeRequested && !wHeld && !isSteeringActively && !boosting) ||
          pressedKeys.has('Space') ||
          (sHeld && continuousThrottle <= 0.02 && appliedThrottle <= 0.04);

        const targetThrottle = isBrakingNow
          ? 0
          : THREE.MathUtils.clamp(autoThrottleDrive + Math.max(0, vSteer?.forward || 0), 0, 1.2);
        appliedThrottle = THREE.MathUtils.lerp(
          appliedThrottle,
          targetThrottle,
          Math.min(1, dt * (targetThrottle >= appliedThrottle ? 2.8 : isBrakingNow ? 3.8 : 3.2))
        );
        brakeBlend = THREE.MathUtils.lerp(
          brakeBlend,
          isBrakingNow ? 1 : 0,
          Math.min(1, dt * (isBrakingNow ? 3.0 : 5.5))
        );
        const effectiveThrottle = appliedThrottle;

        const nearestClearance = Math.max(
          currentShipScale * 14,
          nearestPlanetDist - nearestPlanetRadius * 1.02
        );
        const subWarpSpeedCap =
          THREE.MathUtils.clamp(
            Math.max(currentShipScale * 2.4, nearestClearance * 0.042),
            currentShipScale * 2.4,
            Math.max(currentShipScale * 26.0, 22.0)
          ) * speedMult;
        const warpSpeedCap =
          THREE.MathUtils.clamp(
            Math.max(currentShipScale * 28.0, nearestClearance * 0.95),
            currentShipScale * 28.0,
            2400.0
          ) *
          3.0 *
          boostMult *
          speedMult;
        const adaptiveCruise = autoPos
          ? THREE.MathUtils.clamp(
            sr7.rootGroup.position.distanceTo(autoPos) * (boosting ? 0.38 : 0.24),
            currentShipScale * 3.5,
            boosting ? 2200.0 : 950.0
          ) * speedMult
          : THREE.MathUtils.lerp(
            subWarpSpeedCap,
            warpSpeedCap,
            Math.pow(THREE.MathUtils.clamp(boostBlend, 0, 1), 1.35)
          );

        const maxSpeed = adaptiveCruise;
        const throttleCurve =
          effectiveThrottle > 1.0
            ? 1.0 + (effectiveThrottle - 1.0) * 0.6
            : Math.pow(Math.max(0, effectiveThrottle), 1.65);
        const shipForward = _tmpV1.set(0, 0, -1).applyQuaternion(sr7.rootGroup.quaternion).normalize();

        if (isBrakingNow) {
          const brakeDrag = 0.55 + brakeBlend * 2.15;
          shipVelocity.multiplyScalar(Math.exp(-dt * brakeDrag));
          if (shipVelocity.length() < currentShipScale * 0.008) {
            shipVelocity.set(0, 0, 0);
          }
        } else if (effectiveThrottle > 0.005 || boostBlend > 0.05) {
          const targetCruiseSpeed = maxSpeed * Math.min(1.0, throttleCurve);
          const spd = shipVelocity.length();
          if (spd > 1e-8) {
            const alignRate = sc.sasEnabled ? 5.8 : 1.8;
            _tmpV2.copy(shipForward).multiplyScalar(spd);
            shipVelocity.lerp(_tmpV2, Math.min(1, dt * alignRate));
          }
          const alignedSpd = shipVelocity.length();
          const speedResponse =
            targetCruiseSpeed >= alignedSpd
              ? (boosting ? 1.75 : 0.92) * (0.36 + 0.64 * Math.min(1, effectiveThrottle))
              : sHeld
                ? 1.55
                : 1.05;
          const nextSpd = THREE.MathUtils.lerp(
            alignedSpd,
            targetCruiseSpeed,
            Math.min(1, dt * speedResponse)
          );
          if (alignedSpd > 1e-8) {
            shipVelocity.setLength(nextSpd);
          } else {
            shipVelocity.copy(shipForward).multiplyScalar(nextSpd);
          }
          if (nextSpd < currentShipScale * 0.005 && targetCruiseSpeed <= 1e-9) {
            shipVelocity.set(0, 0, 0);
          }
        } else if (sc.sasEnabled) {
          // Smooth inertial coast deceleration when throttle rests at 0%
          const spd = shipVelocity.length();
          if (spd > 1e-8) {
            _tmpV2.copy(shipForward).multiplyScalar(spd);
            shipVelocity.lerp(_tmpV2, Math.min(1, dt * 5.2));
          }
          shipVelocity.multiplyScalar(Math.exp(-dt * 0.65));
          if (shipVelocity.length() < currentShipScale * 0.006) {
            shipVelocity.set(0, 0, 0);
          }
        }

        const shipDisplacement = _tmpV3.copy(shipVelocity).multiplyScalar(dt);
        sr7.rootGroup.position.add(shipDisplacement);

        // Planetary Upper-Atmosphere Keep-Out (prevents flying inside planet meshes; skims smoothly over horizon)
        const dominantWorldPos = bodyWorldPositions[dominantBody.id];
        if (dominantWorldPos && dominantBody.category !== 'galaxy') {
          const minPlanetSurfaceDist = dominantRadius * 1.038 + currentShipScale * 2.5;
          _tmpV4.subVectors(sr7.rootGroup.position, dominantWorldPos);
          const curPlanetDist = _tmpV4.length();
          if (curPlanetDist < minPlanetSurfaceDist && curPlanetDist > 1e-9) {
            _tmpV4.divideScalar(curPlanetDist);
            sr7.rootGroup.position.copy(dominantWorldPos).addScaledVector(_tmpV4, minPlanetSurfaceDist);
            const inwardVel = shipVelocity.dot(_tmpV4);
            if (inwardVel < 0) {
              shipVelocity.addScaledVector(_tmpV4, -inwardVel);
            }
          }
        }

        if (
          hasOrbitalStationPos &&
          orbitalStation.enforceExteriorKeepOutWorld(
            sr7.rootGroup.position,
            orbitalStationWorldScale,
            3.8
          )
        ) {
          shipVelocity.multiplyScalar(0.15);
        }

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

        cockpitFovOffset = THREE.MathUtils.lerp(cockpitFovOffset, cockpitFovTargetOffset, Math.min(1, dt * 10));
        const targetFov = isWalkingInside
          ? THREE.MathUtils.clamp(
            (sc.cameraView === 'COCKPIT' ? 68 : 62) + cockpitFovOffset,
            42,
            86
          )
          : sc.cameraView === 'COCKPIT'
            ? THREE.MathUtils.clamp(
              THREE.MathUtils.lerp(76, 85, boostBlend) + cockpitFovOffset,
              44,
              94
            )
            : THREE.MathUtils.lerp(48, 58, boostBlend);
        if (Math.abs(camera.fov - targetFov) > 0.1) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, dt * 6.5));
          camera.updateProjectionMatrix();
        }

        // 5. Twin Ventral Plasma Pulse Cannons [F], Orbital Crystal Meteorites & Pirate Sentinel Drones Combat
        const showCombatTargets = !isWalkingInside && bestProxRatio < 18.0;
        combatEncounterGroup.visible = showCombatTargets;

        if (showCombatTargets) {
          const domProfile = getBodyMiningProfile(dominantBody.id);
          const crystalHex = domProfile.yields[0]
            ? MINING_RESOURCES[domProfile.yields[0].resourceId].colorHex
            : '#38bdf8';

          for (let ti = 0; ti < orbitalCombatTargets.length; ti++) {
            const tgt = orbitalCombatTargets[ti];
            if (tgt.respawnTimer > 0) {
              tgt.respawnTimer -= dt;
              tgt.group.visible = false;
              if (tgt.respawnTimer <= 0) {
                tgt.hp = tgt.maxHp;
                tgt.orbitAngle += 2.1;
                tgt.group.visible = true;
              }
              continue;
            }
            tgt.group.visible = true;
            tgt.orbitAngle += tgt.orbitSpeed * dt;
            const ringR = currentShipScale * tgt.distOffsetMult;
            const hOff =
              currentShipScale *
              (tgt.heightOffsetMult + Math.sin(clockTime * 1.2 + ti * 1.4) * 1.8);

            // Orbit around the ship's local orbital zone so targets are always reachable & fun to shoot with Pulse [F]
            tgt.group.position.set(
              sr7.rootGroup.position.x + Math.cos(tgt.orbitAngle) * ringR,
              sr7.rootGroup.position.y + hOff,
              sr7.rootGroup.position.z + Math.sin(tgt.orbitAngle) * ringR
            );
            const targetMeshScale =
              currentShipScale * (tgt.kind === 'SENTINEL_DRONE' ? 0.85 : 0.95);
            tgt.group.scale.setScalar(targetMeshScale);

            if (tgt.kind === 'CRYSTAL_METEOR') {
              tgt.coreMat.color.set(crystalHex);
              tgt.group.rotation.x += dt * 0.9;
              tgt.group.rotation.y += dt * 1.2;
            } else {
              tgt.group.lookAt(sr7.rootGroup.position);
              tgt.fireCooldown -= dt;
              // Sentinel Drones fire plasma laser at the ship when in orbital zone (testing Shields!)
              if (tgt.fireCooldown <= 0 && bestProxRatio < 8.5) {
                tgt.fireCooldown = 5.5 + (ti % 3) * 1.8;
                const posAttr = sentinelLaserGeo.getAttribute('position') as THREE.BufferAttribute;
                posAttr.setXYZ(0, tgt.group.position.x, tgt.group.position.y, tgt.group.position.z);
                posAttr.setXYZ(
                  1,
                  sr7.rootGroup.position.x,
                  sr7.rootGroup.position.y,
                  sr7.rootGroup.position.z
                );
                posAttr.needsUpdate = true;
                sentinelLaserLine.visible = true;
                sentinelLaserVisualTimer = 0.28;

                // Shields absorb 88% of sentinel laser fire!
                const curS = activeSurvivalRef.current;
                if (sc.shieldsOn && curS.batteryPercent > 2) {
                  activeSurvivalRef.current = {
                    ...curS,
                    batteryPercent: Math.max(0, Number((curS.batteryPercent - 0.8).toFixed(1))),
                  };
                } else {
                  activeSurvivalRef.current = {
                    ...curS,
                    hullIntegrity: Math.max(5, Number((curS.hullIntegrity - 2.4).toFixed(1))),
                  };
                }
              }
            }
          }
        }

        if (sentinelLaserVisualTimer > 0) {
          sentinelLaserVisualTimer -= dt;
          if (sentinelLaserVisualTimer <= 0) {
            sentinelLaserLine.visible = false;
          }
        }

        if (combatExplosionAge < 0.55) {
          combatExplosionAge += dt;
          const prog = combatExplosionAge / 0.55;
          combatExplosionSprite.visible = true;
          combatExplosionSprite.scale.setScalar(currentShipScale * (1.2 + prog * 3.4));
          combatExplosionSpriteMat.opacity = (1.0 - prog) * 0.96;
          combatExplosionSpriteMat.rotation = clockTime * 4.5;
        } else {
          combatExplosionSprite.visible = false;
        }

        if (sc.firePulseCount > lastFirePulseCount) {
          lastFirePulseCount = sc.firePulseCount;
          muzzleFlashAlpha = 1.0;
          spaceAudio.playPlasmaPulse();
          const pulseLvl = activeSurvivalRef.current.shipUpgrades?.pulseCannon ?? 1;
          const boltSpeed =
            Math.max(currentShipScale * 115, currentSpeed * 1.8 + currentShipScale * 110) *
            (1 + (pulseLvl - 1) * 0.18);

          // Smart target lock: aim at closest Crystal Meteorite or Sentinel Drone within forward cone
          let lockedTarget: OrbitalCombatTarget | null = null;
          let bestLockScore = Infinity;
          if (showCombatTargets) {
            for (const tgt of orbitalCombatTargets) {
              if (tgt.respawnTimer > 0 || !tgt.group.visible) continue;
              _tmpV6.subVectors(tgt.group.position, sr7.rootGroup.position);
              const d = _tmpV6.length();
              if (d < 1e-7 || d > currentShipScale * 48) continue;
              _tmpV6.divideScalar(d);
              const dot = shipForward.dot(_tmpV6);
              if (dot > 0.25) {
                const score = d * (1.35 - dot);
                if (score < bestLockScore) {
                  bestLockScore = score;
                  lockedTarget = tgt;
                }
              }
            }
          }

          sr7.hullGroup.updateWorldMatrix(true, false);
          sr7.muzzlePositionsLocal.forEach((muzzleLocal) => {
            const boltMesh = new THREE.Mesh(pulseBoltGeo, pulseBoltMat);
            boltMesh.scale.setScalar(currentShipScale * 1.25);
            _tmpV5.copy(muzzleLocal);
            sr7.hullGroup.localToWorld(_tmpV5);
            boltMesh.position.copy(_tmpV5);
            if (lockedTarget) {
              _tmpV4.subVectors(lockedTarget.group.position, _tmpV5).normalize();
              boltMesh.lookAt(lockedTarget.group.position);
              _tmpV4.multiplyScalar(boltSpeed);
            } else {
              sr7.hullGroup.getWorldQuaternion(boltMesh.quaternion);
              _tmpV4.copy(shipForward).multiplyScalar(boltSpeed);
            }
            projectileGroup.add(boltMesh);
            activePulseBolts.push({ mesh: boltMesh, velocity: _tmpV4.clone(), age: 0 });
          });
        }
        muzzleFlashAlpha = Math.max(0, muzzleFlashAlpha - dt * 7.5);

        const pulseDamage = 1.0 + ((activeSurvivalRef.current.shipUpgrades?.pulseCannon ?? 1) - 1) * 0.65;
        const hitRadius = currentShipScale * 2.15;

        for (let i = activePulseBolts.length - 1; i >= 0; i--) {
          const bolt = activePulseBolts[i];
          bolt.age += dt;
          bolt.mesh.position.addScaledVector(bolt.velocity, dt);

          let hitSomething = false;
          if (showCombatTargets) {
            for (const tgt of orbitalCombatTargets) {
              if (tgt.respawnTimer > 0 || !tgt.group.visible) continue;
              if (bolt.mesh.position.distanceTo(tgt.group.position) <= hitRadius) {
                hitSomething = true;
                tgt.hp -= pulseDamage;
                combatExplosionSprite.position.copy(tgt.group.position);
                combatExplosionAge = 0;

                if (tgt.hp <= 0) {
                  tgt.respawnTimer = tgt.kind === 'SENTINEL_DRONE' ? 9.5 : 6.0;
                  tgt.group.visible = false;

                  // Award rare mineral drop + Space Credits directly to cargo hold!
                  const curS = activeSurvivalRef.current;
                  const usedUnits = Object.values(curS.cargoInventory).reduce(
                    (acc, v) => acc + (v ?? 0),
                    0
                  );
                  const domProf = getBodyMiningProfile(dominantBody.id);
                  const dropPool: MiningResourceId[] =
                    tgt.kind === 'SENTINEL_DRONE'
                      ? ['void-crystal', 'helium-3', 'platinum-group', 'solar-plasma-core']
                      : domProf.yields.length > 0
                        ? domProf.yields.map((y) => y.resourceId)
                        : ['helium-3', 'titanium-ilmenite', 'void-crystal'];
                  const pickedRes =
                    dropPool[Math.floor(Math.abs(Math.sin(clockTime * 37.3 + i)) * dropPool.length)] ||
                    'helium-3';
                  const pulseBonusQty = Math.min(
                    Math.max(0, curS.cargoCapacityUnits - usedUnits),
                    (tgt.kind === 'SENTINEL_DRONE' ? 2 : 3) +
                      Math.floor(((curS.shipUpgrades?.pulseCannon ?? 1) - 1) * 0.75)
                  );
                  const creditBonus =
                    (tgt.kind === 'SENTINEL_DRONE' ? 320 : 115) +
                    ((curS.shipUpgrades?.pulseCannon ?? 1) - 1) * 65;

                  const nextInv = { ...curS.cargoInventory };
                  if (pulseBonusQty > 0) {
                    nextInv[pickedRes] = (nextInv[pickedRes] ?? 0) + pulseBonusQty;
                  }
                  const nextSurv: SurvivalResourcesState = {
                    ...curS,
                    cargoInventory: nextInv,
                    totalMinedUnits: curS.totalMinedUnits + pulseBonusQty,
                    spaceCredits: curS.spaceCredits + creditBonus,
                    batteryPercent: Math.min(100, curS.batteryPercent + 12),
                    destroyedTargetsCount: (curS.destroyedTargetsCount ?? 0) + 1,
                  };
                  activeSurvivalRef.current = nextSurv;
                  if (survivalStateRef) survivalStateRef.current = nextSurv;
                  spaceAudio.playMiningYieldChime(
                    tgt.kind === 'SENTINEL_DRONE' ? 'EXOTIC' : 'RARE'
                  );
                  lastSurvivalSync = now;
                  cb.onSyncSurvivalState?.(nextSurv);
                }
                break;
              }
            }
          }

          if (hitSomething || bolt.age > 2.2) {
            projectileGroup.remove(bolt.mesh);
            activePulseBolts.splice(i, 1);
          }
        }

        // 6. Camera Placement: Cabin Walkthrough OR Locked 6-DOF Starfighter Chase Rig OR 1st-Person Cockpit
        controls.enabled = false;
        const curRecenter = sc.recenterTrigger || 0;
        if (curRecenter !== prevRecenterTrigger) {
          prevRecenterTrigger = curRecenter;
          lastManualOrbitTimestamp = 0;
          const TAU = Math.PI * 2;
          cockpitLookYaw = (((cockpitLookYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
          externalLookYaw = (((externalLookYaw + Math.PI) % TAU) + TAU) % TAU - Math.PI;
          cockpitLookTargetYaw = 0;
          cockpitLookTargetPitch = 0;
          cockpitFovTargetOffset = 0;
          externalLookTargetYaw = 0;
          externalLookTargetPitch = isWalkingInside ? -0.18 : 0;
          externalZoomTargetMult = 1.0;
          if (!isWalkingInside) {
            manualRollAngle = 0;
            sr7.hullGroup.rotation.z = 0;
            sr7.interiorGroup.rotation.z = 0;
          }
        }

        if (isWalkingInside) {
          if (prevCameraView !== sc.cameraView) {
            if (sc.cameraView === 'COCKPIT') {
              cockpitLookTargetYaw = externalLookYaw;
              cockpitLookYaw = externalLookYaw;
              cockpitLookTargetPitch = 0;
              cockpitLookPitch = 0;
            } else {
              externalLookTargetYaw = cockpitLookYaw;
              externalLookYaw = cockpitLookYaw;
              externalLookTargetPitch = -0.18;
              externalLookPitch = -0.18;
            }
          }
          cockpitLookYaw = THREE.MathUtils.lerp(
            cockpitLookYaw,
            cockpitLookTargetYaw,
            Math.min(1, dt * 15)
          );
          cockpitLookPitch = THREE.MathUtils.lerp(
            cockpitLookPitch,
            cockpitLookTargetPitch,
            Math.min(1, dt * 15)
          );
          externalLookYaw = THREE.MathUtils.lerp(
            externalLookYaw,
            externalLookTargetYaw,
            Math.min(1, dt * 14)
          );
          externalLookPitch = THREE.MathUtils.lerp(
            externalLookPitch,
            externalLookTargetPitch,
            Math.min(1, dt * 14)
          );
          externalZoomMult = THREE.MathUtils.lerp(
            externalZoomMult,
            externalZoomTargetMult,
            Math.min(1, dt * 10)
          );

          sr7.interiorGroup.updateWorldMatrix(true, false);

          if (sc.cameraView === 'COCKPIT') {
            _tmpV4.set(interiorWalkPos.x, interiorWalkPos.y + 0.146, interiorWalkPos.z);
            _tmpV5.set(interiorWalkPos.x, interiorWalkPos.y + 0.105, interiorWalkPos.z);
            const safeEyeLocal = sr7.interiorCollider
              ? sr7.interiorCollider.clampCamera(_tmpV5, _tmpV4, 0.014)
              : _tmpV4.clone();
            camera.position.copy(safeEyeLocal);
            sr7.interiorGroup.localToWorld(camera.position);
            sr7.interiorGroup.getWorldQuaternion(camera.quaternion);
            _tmpEuler.set(cockpitLookPitch, cockpitLookYaw, 0, 'YXZ');
            _tmpQuat1.setFromEuler(_tmpEuler);
            camera.quaternion.multiply(_tmpQuat1);
            const camForward = _tmpV6.set(0, 0, -1).applyQuaternion(camera.quaternion);
            controls.target
              .copy(camera.position)
              .addScaledVector(camForward, Math.max(0.0001, currentShipScale * 8));
          } else {
            _tmpV4.set(interiorWalkPos.x, interiorWalkPos.y + 0.125, interiorWalkPos.z);
            const walkCamDist = THREE.MathUtils.clamp(0.24 * externalZoomMult, 0.14, 0.44);
            _tmpEuler.set(externalLookPitch, externalLookYaw, 0, 'YXZ');
            _tmpQuat1.setFromEuler(_tmpEuler);
            _tmpV6.set(0.024, 0.014, walkCamDist).applyQuaternion(_tmpQuat1).add(_tmpV4);
            const safeCamLocal = sr7.interiorCollider
              ? sr7.interiorCollider.clampCamera(_tmpV4, _tmpV6, 0.014)
              : _tmpV6.clone();
            if (safeCamLocal.distanceTo(_tmpV4) < 0.055) {
              astronaut.rootGroup.visible = false;
            }
            camera.position.copy(safeCamLocal);
            sr7.interiorGroup.localToWorld(camera.position);
            _tmpV5.copy(_tmpV4);
            sr7.interiorGroup.localToWorld(_tmpV5);
            sr7.interiorGroup.getWorldQuaternion(_tmpQuat1);
            _tmpV6.set(0, 1, 0).applyQuaternion(_tmpQuat1).normalize();
            _tmpMat4.lookAt(camera.position, _tmpV5, _tmpV6);
            camera.quaternion.setFromRotationMatrix(_tmpMat4);
            controls.target.copy(_tmpV5);
          }
        } else if (sc.cameraView === 'COCKPIT') {
          if (prevCameraView !== 'COCKPIT') {
            cockpitLookTargetYaw = 0;
            cockpitLookTargetPitch = 0;
            cockpitLookYaw = 0;
            cockpitLookPitch = 0;
            cockpitFovTargetOffset = 0;
            cockpitFovOffset = 0;
          }
          cockpitLookYaw = THREE.MathUtils.lerp(
            cockpitLookYaw,
            cockpitLookTargetYaw,
            Math.min(1, dt * 15)
          );
          cockpitLookPitch = THREE.MathUtils.lerp(
            cockpitLookPitch,
            cockpitLookTargetPitch,
            Math.min(1, dt * 15)
          );

          sr7.interiorGroup.updateWorldMatrix(true, false);
          sr7.cockpitSeatAnchor.updateWorldMatrix(true, false);
          sr7.cockpitSeatAnchor.getWorldPosition(_tmpV4);
          sr7.interiorGroup.getWorldQuaternion(camera.quaternion);

          // Ergonomic pilot neck pivot & shoulder-check lean so turning 360° views cabin & screens without clipping headrest
          const lookBackFactor = Math.max(0, (Math.abs(cockpitLookYaw) - 1.1) / 1.85);
          _tmpV5
            .set(
              Math.sin(-cockpitLookYaw) * 0.008,
              lookBackFactor * 0.006,
              -0.008 * (1 - Math.cos(cockpitLookYaw)) - lookBackFactor * 0.010
            )
            .multiplyScalar(currentShipScale)
            .applyQuaternion(camera.quaternion);
          camera.position.copy(_tmpV4).add(_tmpV5);

          // Smooth Free-Look ('YXZ') inside the 360°-rolled cockpit frame
          _tmpEuler.set(
            cockpitLookPitch + angVelPitch * -0.024,
            cockpitLookYaw + angVelYaw * -0.024,
            angVelRoll * -0.036,
            'YXZ'
          );
          _tmpQuat1.setFromEuler(_tmpEuler);
          camera.quaternion.multiply(_tmpQuat1);
          const camForward = _tmpV6.set(0, 0, -1).applyQuaternion(camera.quaternion);
          controls.target
            .copy(camera.position)
            .addScaledVector(camForward, Math.max(0.0001, currentShipScale * 18));
        } else {
          if (prevCameraView !== 'EXTERNAL' || !hasExternalCamQuat) {
            externalLookTargetYaw = 0;
            externalLookTargetPitch = 0;
            externalLookYaw = 0;
            externalLookPitch = 0;
            externalCamQuat.copy(sr7.rootGroup.quaternion);
            hasExternalCamQuat = true;
          }

          // Preserve user's 360° external orbit angle freely around the spacecraft (press C or double-click to recenter)
          externalLookYaw = THREE.MathUtils.lerp(
            externalLookYaw,
            externalLookTargetYaw,
            Math.min(1, dt * 14)
          );
          externalLookPitch = THREE.MathUtils.lerp(
            externalLookPitch,
            externalLookTargetPitch,
            Math.min(1, dt * 14)
          );
          externalZoomMult = THREE.MathUtils.lerp(
            externalZoomMult,
            externalZoomTargetMult,
            Math.min(1, dt * 10)
          );

          // Smooth chase camera slerp to ship attitude without jarring bounce
          externalCamQuat.slerp(sr7.rootGroup.quaternion, Math.min(1, dt * 5.8));

          _tmpEuler.set(externalLookPitch, externalLookYaw, 0, 'YXZ');
          _tmpQuat1.setFromEuler(_tmpEuler);
          const finalChaseQuat = _tmpQuat1.premultiply(externalCamQuat);

          const chaseDist = (7.95 + boostBlend * 1.65) * externalZoomMult * currentShipScale;
          const chaseHeight = (1.35 + angVelPitch * 0.05) * currentShipScale;
          const chaseSideLag = -angVelYaw * 0.12 * currentShipScale;

          _tmpV4.set(chaseSideLag, chaseHeight, chaseDist).applyQuaternion(finalChaseQuat);
          camera.position.copy(sr7.rootGroup.position).add(_tmpV4);

          if (hasOrbitalStationPos) {
            orbitalStation.enforceExteriorKeepOutWorld(
              camera.position,
              orbitalStationWorldScale,
              1.6
            );
          }

          // Center orbit look-at target on spacecraft body so 360° view stays centered from front, sides, top, bottom & rear
          const forwardFocusOffset = -0.55 * Math.cos(externalLookYaw) * currentShipScale;
          _tmpV5
            .set(0, 0.06 * currentShipScale, forwardFocusOffset)
            .applyQuaternion(sr7.rootGroup.quaternion)
            .add(sr7.rootGroup.position);
          _tmpV6.set(0, 1, 0).applyQuaternion(finalChaseQuat).normalize();
          _tmpMat4.lookAt(camera.position, _tmpV5, _tmpV6);
          camera.quaternion.setFromRotationMatrix(_tmpMat4);
          controls.target.copy(sr7.rootGroup.position);
        }

        // 6B. ORBITAL LASER MINING & ASTROCHEMICAL EXTRACTION PHYSICS
        sr7.rootGroup.updateWorldMatrix(true, false);
        sr7.hullGroup.updateWorldMatrix(true, false);
        _miningBeamStart.copy(sr7.miningEmitterLocalPos);
        sr7.hullGroup.localToWorld(_miningBeamStart);

        let miningTargetBody: CelestialBodyData | null = null;
        let miningTargetDistRatio = 999;
        let miningTargetRadius = 1;
        let bestMiningScore = Infinity;

        for (let bi = 0; bi < ALL_CELESTIAL_BODIES.length; bi++) {
          const cand = ALL_CELESTIAL_BODIES[bi];
          if (cand.category === 'galaxy') continue;
          const bPos = bodyWorldPositions[cand.id];
          if (!bPos) continue;
          const bRad = Math.max(0.00008, getScaledRadius(cand, st.scaleMode));
          _miningShipToTarget.subVectors(bPos, _miningBeamStart);
          const d = _miningShipToTarget.length();
          const ratio = d / bRad;
          if (ratio > 8.2) continue;
          const dirToBody = _miningShipToTarget.divideScalar(Math.max(1e-9, d));
          const aimDot = THREE.MathUtils.clamp(shipForward.dot(dirToBody), -1, 1);
          const aimBonus = aimDot > 0.55 ? 0.58 : aimDot > 0.15 ? 0.85 : 1.15;
          const score = ratio * aimBonus;
          if (score < bestMiningScore) {
            bestMiningScore = score;
            miningTargetBody = cand;
            miningTargetDistRatio = ratio;
            miningTargetRadius = bRad;
          }
        }

        const miningLaserRequested = Boolean(sc.miningLaserActive);
        let hitNormalLocalObj: { x: number; y: number; z: number } | null = null;
        let aimDirObj: { x: number; y: number; z: number } | null = {
          x: shipForward.x,
          y: shipForward.y,
          z: shipForward.z,
        };
        let hasValidBeamGeom = false;
        let miningTargetPosVec: THREE.Vector3 | null = null;

        if (miningTargetBody) {
          miningTargetPosVec = bodyWorldPositions[miningTargetBody.id] || null;
          if (activeHotspotsBodyId !== miningTargetBody.id) {
            activeHotspotsBodyId = miningTargetBody.id;
            activeHotspotsList = generateHotspotsForBody(miningTargetBody.id);
          }

          if (miningTargetPosVec) {
            // Ray-sphere test along ship nose; fall back to nadir gimbal toward planet horizon
            _miningShipToTarget.subVectors(_miningBeamStart, miningTargetPosVec);
            const bCoeff = _miningShipToTarget.dot(shipForward);
            const cCoeff = _miningShipToTarget.lengthSq() - miningTargetRadius * miningTargetRadius;
            const disc = bCoeff * bCoeff - cCoeff;

            if (disc >= 0) {
              const tHit = -bCoeff - Math.sqrt(disc);
              if (tHit > 0 && tHit < miningTargetRadius * 6.5) {
                _miningBeamEnd.copy(_miningBeamStart).addScaledVector(shipForward, tHit);
                _miningNormalWorld.subVectors(_miningBeamEnd, miningTargetPosVec).normalize();
                hasValidBeamGeom = true;
              }
            }

            if (!hasValidBeamGeom) {
              // Ventral gimballed laser aims forward & down onto the sub-orbital surface ahead of the nose
              _miningNormalWorld
                .subVectors(_miningBeamStart, miningTargetPosVec)
                .normalize()
                .addScaledVector(shipForward, 0.52)
                .normalize();
              _miningBeamEnd
                .copy(miningTargetPosVec)
                .addScaledVector(_miningNormalWorld, miningTargetRadius * 1.002);
              hasValidBeamGeom = true;
            }

            const targetNode = bodyNodes[miningTargetBody.id];
            if (targetNode) {
              targetNode.spinMesh.updateWorldMatrix(true, false);
              targetNode.spinMesh.getWorldQuaternion(_miningSpinInvQuat).invert();
              _miningNormalLocal.copy(_miningNormalWorld).applyQuaternion(_miningSpinInvQuat).normalize();
              hitNormalLocalObj = {
                x: _miningNormalLocal.x,
                y: _miningNormalLocal.y,
                z: _miningNormalLocal.z,
              };
            } else {
              hitNormalLocalObj = {
                x: _miningNormalWorld.x,
                y: _miningNormalWorld.y,
                z: _miningNormalWorld.z,
              };
            }
          }
        } else {
          activeHotspotsBodyId = null;
          activeHotspotsList = [];
        }

        const miningRadarAgeSec =
          sc.radarPulseTimestamp > 0 ? (now - sc.radarPulseTimestamp) / 1000 : 99;
        const miningPrevState: SurvivalResourcesState = {
          ...liveSurv,
          miningLaserActive: miningLaserRequested,
        };
        const miningStep = stepMiningSimulation(miningPrevState, {
          dt,
          clockTime,
          targetBodyId: miningTargetBody?.id ?? null,
          targetBodyName: miningTargetBody?.name ?? null,
          surfaceDistanceRatio: miningTargetDistRatio,
          hotspots: activeHotspotsList,
          shipAimDirOnTargetWorld: aimDirObj,
          hitNormalLocal: hitNormalLocalObj,
        });
        const postMiningSurv = miningStep.state;
        if (survivalStateRef) {
          survivalStateRef.current = postMiningSurv;
        }
        if (miningLaserRequested && !postMiningSurv.miningLaserActive) {
          cb.onUpdateSpacecraftControl((prev) =>
            prev.miningLaserActive ? { ...prev, miningLaserActive: false } : prev
          );
        }
        if (miningStep.minedUnitsThisTick > 0) {
          const minedDef = miningStep.minedResourceId
            ? MINING_RESOURCES[miningStep.minedResourceId]
            : null;
          spaceAudio.playMiningYieldChime(minedDef?.rarity ?? 'COMMON');
          lastSurvivalSync = now;
          cb.onSyncSurvivalState?.(postMiningSurv);
        }

        // Render 3D Orbital Laser Beam, Surface Ablation Crater & Helical Upward Ore Stream
        const showMiningBeam =
          postMiningSurv.mining.isDrilling &&
          hasValidBeamGeom &&
          (!isWalkingInside || sc.cameraView === 'EXTERNAL');
        miningBeamGroup.visible = showMiningBeam;
        miningCraterGroup.visible = showMiningBeam;
        miningStreamInstanced.visible = showMiningBeam;
        miningEjectaInstanced.visible = showMiningBeam;

        if (showMiningBeam) {
          _miningColorTmp.set(miningStep.effectiveColorHex);
          _miningBeamDir.subVectors(_miningBeamEnd, _miningBeamStart);
          const beamLen = _miningBeamDir.length();
          if (beamLen > 1e-7) {
            _miningBeamDir.divideScalar(beamLen);
            const pulse = 0.9 + 0.12 * Math.sin(clockTime * 28.0);
            const radiusScale = currentShipScale * 0.42 * pulse;

            miningBeamGroup.position.copy(_miningBeamStart);
            miningBeamGroup.quaternion.setFromUnitVectors(_worldUp, _miningBeamDir);
            miningCoreMesh.scale.set(radiusScale, beamLen, radiusScale);
            miningSheathMesh.scale.set(radiusScale, beamLen, radiusScale);
            miningCoronaMesh.scale.set(radiusScale, beamLen, radiusScale);
            miningMuzzleGlow.scale.setScalar(currentShipScale * 0.45 * pulse);

            miningSheathMat.color.copy(_miningColorTmp);
            miningSheathMat.opacity = 0.56 + 0.14 * Math.sin(clockTime * 19.0);
            miningCoronaMat.color.copy(_miningColorTmp);
            miningCoronaMat.opacity = 0.24 + 0.08 * Math.cos(clockTime * 15.0);
            miningMuzzleGlowMat.color.copy(_miningColorTmp);
            miningCoreMat.opacity = 0.94 + 0.06 * Math.sin(clockTime * 34.0);

            // Properly-Scaled Orbital Laser Impact Caldera, Molten Crust Fractures & Volumetric Fireball Plume
            const craterSize = THREE.MathUtils.clamp(
              beamLen * 0.048,
              currentShipScale * 1.18,
              miningTargetRadius * 0.045
            );
            miningCraterGroup.position.copy(_miningBeamEnd);
            miningCraterGroup.quaternion.setFromUnitVectors(_worldUp, _miningNormalWorld);
            miningCraterGroup.scale.setScalar(craterSize);
            miningCraterLight.intensity = 3.1 + Math.sin(clockTime * 32.0) * 0.95;
            miningCraterLight.distance = craterSize * 12.0;

            // Update GLSL shader uniforms for molten crust fissures & vertical plasma geyser plume
            miningCraterDiscMat.uniforms.uTime.value = clockTime;
            miningCraterDiscMat.uniforms.uLaserColor.value.copy(_miningColorTmp);
            miningPlumeConeMat.uniforms.uTime.value = clockTime;
            miningPlumeConeMat.uniforms.uLaserColor.value.copy(_miningColorTmp);

            // Animate 3D counter-rotating turbulent fireball & dark volcanic smoke plumes
            const burstA = (clockTime * 2.1) % 1.0;
            const scaleA = 0.88 + burstA * 0.78;
            miningCraterDome.scale.set(scaleA, scaleA, 1);
            miningCraterDomeMat.rotation = clockTime * 1.8;
            miningCraterDomeMat.opacity = 0.78 + Math.sin(burstA * Math.PI) * 0.22;

            const burstB = (clockTime * 2.1 + 0.5) % 1.0;
            const scaleB = 0.82 + burstB * 0.96;
            miningCraterHalo.scale.set(scaleB, scaleB, 1);
            miningCraterHaloMat.rotation = -clockTime * 1.5 + 1.4;
            miningCraterHaloMat.opacity = Math.sin(burstB * Math.PI) * 0.94;

            const geyserStretch = 1.05 + 0.28 * Math.sin(clockTime * 24.0);
            miningPlumeCone.scale.set(1.08, geyserStretch, 1.08);

            // Perspective-compensated dual counter-rotating helical stream (funnels tightly into ship turret at frac=0, expands at planet crater at frac=1)
            _miningPerpU.set(0, 1, 0).cross(_miningBeamDir);
            if (_miningPerpU.lengthSq() < 1e-4) _miningPerpU.set(1, 0, 0).cross(_miningBeamDir);
            _miningPerpU.normalize();
            _miningPerpV.crossVectors(_miningBeamDir, _miningPerpU).normalize();
            miningStreamMat.color.copy(_miningColorTmp);

            for (let pi = 0; pi < MINING_STREAM_COUNT; pi++) {
              const isDownwardPulse = pi % 2 === 0;
              const strandIdx = Math.floor(pi / 2);
              const strandTotal = MINING_STREAM_COUNT / 2;
              const frac = isDownwardPulse
                ? (clockTime * 1.65 + strandIdx / strandTotal) % 1.0
                : 1.0 - ((clockTime * 0.95 + strandIdx / strandTotal) % 1.0);
              const theta =
                (isDownwardPulse ? -clockTime * 10.5 : clockTime * 8.2) + strandIdx * 1.45;
              const localRadius = THREE.MathUtils.lerp(
                currentShipScale * 0.032,
                craterSize * 0.34,
                frac
              );
              const spiralRad =
                localRadius * (0.45 + 0.55 * Math.sin(frac * Math.PI)) * (isDownwardPulse ? 0.85 : 1.2);
              _miningParticlePos
                .copy(_miningBeamStart)
                .addScaledVector(_miningBeamDir, beamLen * frac)
                .addScaledVector(_miningPerpU, Math.cos(theta) * spiralRad)
                .addScaledVector(_miningPerpV, Math.sin(theta) * spiralRad);
              _miningDummyQuat.setFromAxisAngle(_miningBeamDir, theta);
              const pScale =
                THREE.MathUtils.lerp(currentShipScale * 0.016, craterSize * 0.095, frac) *
                (isDownwardPulse ? 0.95 : 0.75 + (pi % 3) * 0.32);
              _miningScaleVec.set(
                pScale,
                isDownwardPulse ? pScale * 1.8 : pScale,
                pScale
              );
              _miningTmpMat4.compose(_miningParticlePos, _miningDummyQuat, _miningScaleVec);
              miningStreamInstanced.setMatrixAt(pi, _miningTmpMat4);
            }
            miningStreamInstanced.instanceMatrix.needsUpdate = true;

            // High-Velocity Razor-Sharp Micro-Sparks & Laser Ablation Streaks (aligned along parabolic velocity vector)
            const ejectaSizeBase = craterSize * 0.22;
            for (let ei = 0; ei < MINING_EJECTA_COUNT; ei++) {
              const life = (clockTime * 2.4 + ei * (1 / MINING_EJECTA_COUNT)) % 1.0;
              const az = ei * 2.39996 + Math.floor(clockTime * 2.4 + ei / MINING_EJECTA_COUNT) * 0.7;
              const speedBias = 0.55 + (ei % 5) * 0.22;
              const radialDist = craterSize * (0.06 + life * 0.92 * speedBias);
              const lift = craterSize * (life * (1.15 - life * 0.85) * 1.15 * speedBias);
              _miningParticlePos
                .copy(_miningBeamEnd)
                .addScaledVector(_miningNormalWorld, lift)
                .addScaledVector(_miningPerpU, Math.cos(az) * radialDist)
                .addScaledVector(_miningPerpV, Math.sin(az) * radialDist);

              // Tangent velocity direction for realistic elongated spark streak orientation
              const dRadial = 0.92 * speedBias;
              const dLift = (1.15 - 2.0 * life * 0.85) * 1.15 * speedBias;
              _tmpV6
                .copy(_miningNormalWorld)
                .multiplyScalar(dLift)
                .addScaledVector(_miningPerpU, Math.cos(az) * dRadial)
                .addScaledVector(_miningPerpV, Math.sin(az) * dRadial)
                .normalize();
              _miningDummyQuat.setFromUnitVectors(_worldUp, _tmpV6);
              const sparkFade = Math.sin(life * Math.PI);
              const eScale = ejectaSizeBase * sparkFade;
              _miningScaleVec.set(eScale * 0.55, eScale * 1.65, eScale * 0.55);
              _miningTmpMat4.compose(_miningParticlePos, _miningDummyQuat, _miningScaleVec);
              miningEjectaInstanced.setMatrixAt(ei, _miningTmpMat4);
            }
            miningEjectaInstanced.instanceMatrix.needsUpdate = true;
          }
        }

        // Render 3D Geological Surface Vein Hotspots (visible in close orbit or during Radar R scan)
        const targetNodeForSpots = miningTargetBody ? bodyNodes[miningTargetBody.id] : undefined;
        const showHotspots =
          Boolean(miningTargetBody && targetNodeForSpots && activeHotspotsList.length > 0) &&
          (miningTargetDistRatio <= 5.5 || miningRadarAgeSec < 16.0);
        hotspotGroup.visible = showHotspots;
        if (showHotspots && targetNodeForSpots && miningTargetPosVec) {
          targetNodeForSpots.spinMesh.updateWorldMatrix(true, false);
          const altClearance = Math.max(
            currentShipScale * 4.0,
            (miningTargetDistRatio - 1.0) * miningTargetRadius
          );
          const spotScale = THREE.MathUtils.clamp(
            altClearance * 0.065,
            currentShipScale * 1.15,
            miningTargetRadius * 0.012
          );
          const pulseSpot = 1.0 + 0.16 * Math.sin(clockTime * 4.5);
          hotspotBeacons.forEach((bcn, idx) => {
            const spot = activeHotspotsList[idx];
            if (!spot) {
              bcn.grp.visible = false;
              return;
            }
            bcn.grp.visible = true;
            _miningParticlePos
              .set(spot.localNormal.x * 1.007, spot.localNormal.y * 1.007, spot.localNormal.z * 1.007)
              .applyMatrix4(targetNodeForSpots.spinMesh.matrixWorld);
            _miningNormalWorld.subVectors(_miningParticlePos, miningTargetPosVec!).normalize();
            bcn.grp.position.copy(_miningParticlePos);
            bcn.grp.quaternion.setFromUnitVectors(_worldUp, _miningNormalWorld);
            bcn.grp.scale.setScalar(spotScale * pulseSpot);
            bcn.ring.rotation.z = clockTime * 1.4;
            bcn.ringMat.color.set(spot.colorHex);
            bcn.beamMat.color.set(spot.colorHex);
            const isActiveSpot = miningStep.activeHotspot?.id === spot.id;
            bcn.ringMat.opacity = isActiveSpot ? 0.98 : miningRadarAgeSec < 12 ? 0.85 : 0.62;
            bcn.beamMat.opacity = isActiveSpot ? 0.68 : 0.34;
          });
        }

        if (prevCameraView !== sc.cameraView) {
          spaceAudio.playCameraSwitch(sc.cameraView);
        }
        prevCameraView = sc.cameraView;

        if (sc.radarPulseTimestamp !== prevRadarAudioTs) {
          prevRadarAudioTs = sc.radarPulseTimestamp;
          if (sc.radarPulseTimestamp > 0) spaceAudio.playRadarScan();
        }
        if (isBrakingNow && !prevBrakeAudio) {
          spaceAudio.playBrakeRetro();
        }
        prevBrakeAudio = isBrakingNow;
        if (boosting && !prevBoostAudio) {
          spaceAudio.playAfterburnerIgnite();
        }
        prevBoostAudio = boosting;

        const nowMiningActive = Boolean(postMiningSurv.mining.isActive);
        const nowMiningDrilling = Boolean(postMiningSurv.mining.isDrilling);
        if (nowMiningActive && !prevMiningActiveAudio) {
          spaceAudio.playMiningEngage(nowMiningDrilling);
        } else if (!nowMiningActive && prevMiningActiveAudio) {
          spaceAudio.playMiningDisengage();
        } else if (nowMiningDrilling && !prevMiningDrillingAudio) {
          spaceAudio.playMiningSurfaceLock();
        }
        prevMiningActiveAudio = nowMiningActive;
        prevMiningDrillingAudio = nowMiningDrilling;

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
          isBraking: isBrakingNow,
          rcsIntensity: Math.min(1, Math.hypot(pitchInput, yawInput, rollInput)),
          miningIntensity: nowMiningDrilling ? 1.0 : nowMiningActive ? 0.36 : 0,
          miningDrilling: nowMiningDrilling,
          miningHotspotMult: postMiningSurv.mining.hotspotMultiplier || 1,
        });

        // 7. Compute Nearest Contacts & Ship-Relative Radar Bearings (throttled ~9 Hz to eliminate per-frame GC allocations)
        const shouldSyncTelemetryNow = now - lastTelemetrySync > 110;
        let radarContacts: NearbySpacecraftContact[] = [];
        let nearestContact: NearbySpacecraftContact | undefined;
        if (shouldSyncTelemetryNow) {
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
          if (hasOrbitalStationPos) {
            const stDist = sr7.rootGroup.position.distanceTo(orbitalStationWorldPos);
            const stRel = _tmpV2
              .copy(orbitalStationWorldPos)
              .sub(sr7.rootGroup.position)
              .applyQuaternion(_tmpQuat1);
            const stBearing = THREE.MathUtils.radToDeg(Math.atan2(stRel.x, -stRel.z));
            const stHoriz = Math.max(0.0001, Math.hypot(stRel.x, stRel.z));
            const stElev = THREE.MathUtils.radToDeg(Math.atan2(stRel.y, stHoriz));
            const stMeters = stDist * 1_000_000_000;
            const stFormatted =
              stMeters < 5000
                ? `${Math.round(stMeters)} m`
                : `${(stMeters / 1000).toFixed(1)} km`;
            contactsUnsorted.push({
              id: 'sat-orbital-gateway',
              name: 'Estação Espacial Orbital',
              category: 'planet',
              distanceUnits: stDist,
              distanceFormatted: stFormatted,
              bearingDeg: stBearing,
              elevationDeg: stElev,
            });
          }
          contactsUnsorted.sort((a, b) => a.distanceUnits - b.distanceUnits);
          nearestContact = contactsUnsorted[0];
          radarContacts = contactsUnsorted.slice(0, 7);
        }

        let speedFormatted = '0 km/h';
        if (currentSpeed > currentShipScale * 0.004) {
          const speedRatioToSubWarp = currentSpeed / Math.max(1e-9, subWarpSpeedCap);
          const subWarpKmSec =
            Math.pow(THREE.MathUtils.clamp(speedRatioToSubWarp, 0, 1.08), 1.15) * 16.5;
          const warpEngagement = Math.max(
            boostBlend,
            THREE.MathUtils.smoothstep(speedRatioToSubWarp, 1.08, 2.0)
          );
          const warpKmSec = Math.max(
            subWarpKmSec,
            currentSpeed * 1_000_000 * THREE.MathUtils.smoothstep(warpEngagement, 0.12, 0.65)
          );
          const displayKmSec = autoPos
            ? Math.max(subWarpKmSec, currentSpeed * 1_000_000)
            : THREE.MathUtils.lerp(
              subWarpKmSec,
              warpKmSec,
              THREE.MathUtils.smoothstep(warpEngagement, 0.08, 0.5)
            );

          if (displayKmSec < 1.0) {
            const kmPerHour = Math.max(1, Math.round(displayKmSec * 3600));
            speedFormatted = `${kmPerHour.toLocaleString('pt-BR')} km/h`;
          } else if (displayKmSec < 100.0) {
            speedFormatted = `${displayKmSec.toFixed(1).replace('.', ',')} km/s`;
          } else if (displayKmSec < 299_792) {
            speedFormatted = `${Math.round(displayKmSec).toLocaleString('pt-BR')} km/s`;
          } else if (displayKmSec < 299_792 * 180) {
            speedFormatted = `${(displayKmSec / 299_792).toFixed(1).replace('.', ',')} c`;
          } else {
            speedFormatted = `${Math.round(currentSpeed * 12).toLocaleString('pt-BR')} ly/s`;
          }
        }

        const radarAgeSec =
          sc.radarPulseTimestamp > 0 ? (now - sc.radarPulseTimestamp) / 1000 : 99;
        _tmpEuler.setFromQuaternion(sr7.rootGroup.quaternion, 'YXZ');
        const pitchDegVal = Math.round(THREE.MathUtils.radToDeg(_tmpEuler.x));
        const yawDegVal = Math.round(THREE.MathUtils.radToDeg(_tmpEuler.y));
        const rollDegVal = Math.round(
          THREE.MathUtils.radToDeg(manualRollAngle)
        );
        const liveReactorTemp = Math.round(postMiningSurv.reactorTempC);

        sr7.updateAnimations({
          dt,
          clockTime,
          throttle: isBrakingNow ? appliedThrottle * (1 - brakeBlend) : effectiveThrottle,
          boostActive: boosting,
          isBraking: isBrakingNow,
          headlightsOn: sc.headlightsOn,
          interiorLightsOn: sc.interiorLightsOn,
          shieldsOn: sc.shieldsOn,
          pitchInput: angVelPitch / 0.42,
          rollInput: angVelRoll / 0.68,
          yawInput: angVelYaw / 0.46,
          pitchDeg: pitchDegVal,
          rollDeg: rollDegVal,
          radarPulseAgeSec: radarAgeSec,
          muzzleFlashAlpha,
          speedFormatted,
          nearestName: nearestContact?.name || dominantBody.name || 'Espaço Profundo',
          nearestDist: nearestContact?.distanceFormatted || `${bestProxRatio.toFixed(1)}R`,
          reactorTempC: liveReactorTemp,
          sasEnabled: sc.sasEnabled,
          autopilotActive: Boolean(autoTargetId),
          isCockpitView: sc.cameraView === 'COCKPIT' || isWalkingInside,
          cockpitSeat: sc.cockpitSeat || 'LEFT',
          shipScale: currentShipScale,
          driftAngleDeg,
          radiatorsDeployed: postMiningSurv.radiatorsDeployed,
          hullTempC: postMiningSurv.hullTempC,
          walkingInside: isWalkingInside,
          nearbyCabinStation: postMiningSurv.nearbyCabinStation,
          miningActive: postMiningSurv.mining.isDrilling,
          miningColorHex: miningStep.effectiveColorHex,
        });

        // Sync Live Telemetry to HUD (throttled ~9 Hz)
        if (shouldSyncTelemetryNow) {
          lastTelemetrySync = now;
          cb.onSyncSpacecraftTelemetry({
            speedUnitsPerSec: currentSpeed,
            speedFormatted,
            fuelPercent: Number(postMiningSurv.fuelPercent.toFixed(1)),
            hullIntegrity: Number(postMiningSurv.hullIntegrity.toFixed(1)),
            reactorTempC: liveReactorTemp,
            pitchDeg: pitchDegVal,
            yawDeg: yawDegVal,
            rollDeg: rollDegVal,
            nearestBodyId: nearestContact?.id || 'sun',
            nearestBodyName: nearestContact?.name || 'Sol',
            nearestDistanceFormatted: nearestContact?.distanceFormatted || '0 km',
            nearbyContacts: radarContacts,
            autopilotStatus,
            survival: postMiningSurv,
          });
        }
        if (now - lastSurvivalSync > 190) {
          lastSurvivalSync = now;
          cb.onSyncSurvivalState?.(postMiningSurv);
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
      } else if (st.evaActive) {
        miningBeamGroup.visible = false;
        miningCraterGroup.visible = false;
        miningStreamInstanced.visible = false;
        miningEjectaInstanced.visible = false;
        hotspotGroup.visible = false;
        // ====================================================================
        // RIGGED ASTRONAUT EVA SPACEWALK / SURFACE MODE (Next to Parked Ship)
        // ====================================================================
        wasWarpingLastFrame = false;
        wasSpacecraftActive = false;
        wasLobbyShowcaseActive = false;
        wasWalkingInside = false;
        warpTunnelGroup.visible = false;
        if (Math.abs(camera.fov - 48) > 0.1) {
          camera.fov = 48;
          camera.updateProjectionMatrix();
        }
        spaceAudio.updateFrame({ dt, clockTime, mode: 'OBSERVATORY' });

        // Park Light Fighter visibly beside Astronaut!
        if (!prevSpaceParkedValid) {
          if (hasOrbitalStationPos && st.selectedSatelliteId === 'sat-orbital-gateway') {
            _tmpV1
              .copy(orbitalStation.shipApproachLocal)
              .multiplyScalar(orbitalStationWorldScale)
              .applyQuaternion(orbitalStation.rootGroup.quaternion);
            sr7.rootGroup.position.copy(orbitalStationWorldPos).add(_tmpV1);
            sr7.rootGroup.lookAt(orbitalStationWorldPos);
            shipAnchorMode = 'STATION';
            prevShipAnchorWorldPos.copy(orbitalStationWorldPos);
          } else {
            const spawnDir = computeSunlitCameraOffsetDir(targetPos, selectedBody.id);
            const spawnDist =
              selectedBody.category === 'galaxy'
                ? targetRadius * 1.45
                : targetRadius * 2.55 + currentShipScale * 7.5;
            sr7.rootGroup.position.copy(targetPos).addScaledVector(spawnDir, spawnDist);
            sr7.rootGroup.lookAt(targetPos);
            shipAnchorMode = 'BODY';
            shipAnchorBodyId = selectedBody.id;
            prevShipAnchorWorldPos.copy(targetPos);
          }
          manualRollAngle = 0;
          prevSpaceParkedValid = true;
        }

        // Compute scale & planetary keep-out from the actual nearest celestial body around the ship/astronaut
        let evaDominantBody = selectedBody;
        let evaDominantRadius = Math.max(0.00015, targetRadius);
        let evaBestProxRatio = Infinity;
        for (let i = 0; i < ALL_CELESTIAL_BODIES.length; i++) {
          const b = ALL_CELESTIAL_BODIES[i];
          if (b.category === 'galaxy') continue;
          const bPos = bodyWorldPositions[b.id];
          if (!bPos) continue;
          const bRad = Math.max(0.00015, getScaledRadius(b, st.scaleMode));
          const bDist = sr7.rootGroup.position.distanceTo(bPos);
          const ratio = bDist / bRad;
          if (ratio < evaBestProxRatio) {
            evaBestProxRatio = ratio;
            evaDominantBody = b;
            evaDominantRadius = bRad;
          }
        }
        const effectiveEvaRefRadius =
          evaDominantBody.category === 'galaxy' || evaBestProxRatio > 1800
            ? Math.min(0.45, Math.max(0.015, evaDominantRadius * 0.05))
            : evaDominantRadius;
        const desiredEvaShipScale = THREE.MathUtils.clamp(
          effectiveEvaRefRadius * 0.0038,
          0.0000028,
          0.00175
        );
        currentShipScale = desiredEvaShipScale;
        const astronautScale = currentShipScale * 0.44;

        sr7.rootGroup.scale.setScalar(currentShipScale);
        sr7.hullGroup.rotation.z = manualRollAngle;
        sr7.interiorGroup.rotation.z = manualRollAngle;
        sr7.rootGroup.visible = true;
        sr7.updateAnimations({
          dt,
          clockTime,
          throttle: 0,
          boostActive: false,
          headlightsOn: true,
          interiorLightsOn: true,
          shieldsOn: false,
          pitchInput: 0,
          rollInput: 0,
          yawInput: 0,
          pitchDeg: 0,
          rollDeg: Math.round(THREE.MathUtils.radToDeg(manualRollAngle)),
          radarPulseAgeSec: evaRadarAgeSec < 2.2 ? evaRadarAgeSec : 99,
          muzzleFlashAlpha: 0,
          speedFormatted: 'PARKED',
          nearestName: evaDominantBody.name,
          nearestDist: 'EVA',
          reactorTempC: 315,
          sasEnabled: true,
          autopilotActive: false,
          isCockpitView: false,
          shipScale: currentShipScale,
          driftAngleDeg: 0,
        });

        // Detach Astronaut from cockpit seat into world scene cleanly
        if (evaAttachedToShip) {
          scene.add(astronaut.rootGroup);
          evaAttachedToShip = false;
        }
        astronaut.rootGroup.visible = true;
        astronaut.rootGroup.scale.setScalar(astronautScale);

        evaUp.set(0, 1, 0);

        if (!wasEvaActive) {
          // Always spawn Astronaut right beside the parked ship (keeping the ship in its exact spot!)
          _tmpV1.set(1, 0, 0.35).normalize().applyQuaternion(sr7.rootGroup.quaternion);
          astronaut.rootGroup.position
            .copy(sr7.rootGroup.position)
            .addScaledVector(_tmpV1, currentShipScale * 2.55);
          astronaut.rootGroup.quaternion.copy(sr7.rootGroup.quaternion);
          _tmpV2
            .set(0, 1.35, 3.6)
            .multiplyScalar(currentShipScale)
            .applyQuaternion(astronaut.rootGroup.quaternion);
          camera.position.copy(astronaut.rootGroup.position).add(_tmpV2);
          evaVelocity.set(0, 0, 0);
          wasEvaActive = true;

          controls.target
            .copy(astronaut.rootGroup.position)
            .addScaledVector(evaUp, astronautScale * 1.15);
        }

        // Handle EVA Recenter & Radar triggers
        if (st.evaRecenterTrigger !== prevEvaRecenterTrigger) {
          prevEvaRecenterTrigger = st.evaRecenterTrigger;
          _tmpV2
            .set(0, 1.35, 3.6)
            .multiplyScalar(currentShipScale)
            .applyQuaternion(astronaut.rootGroup.quaternion);
          camera.position.copy(astronaut.rootGroup.position).add(_tmpV2);
        }
        if (st.evaRadarTrigger !== prevEvaRadarTrigger) {
          prevEvaRadarTrigger = st.evaRadarTrigger;
          evaRadarAgeSec = 0;
        } else {
          evaRadarAgeSec = Math.min(99, evaRadarAgeSec + dt);
        }

        // Camera-relative EVA locomotion inputs (Keyboard + Touch)
        const vEva = st.evaVirtualInput;
        const moveForwardInput =
          (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp') ? 1 : 0) -
          (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown') ? 1 : 0) -
          (vEva?.moveZ || 0);
        const moveRightInput =
          (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight') ? 1 : 0) -
          (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft') ? 1 : 0) +
          (vEva?.moveX || 0);
        const moveUpInput =
          (pressedKeys.has('Space') ? 1 : 0) -
          (pressedKeys.has('ControlLeft') || pressedKeys.has('ControlRight') || pressedKeys.has('KeyX') ? 1 : 0) +
          (vEva?.moveY || 0);
        const evaSprinting =
          pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight') || Boolean(vEva?.sprint);

        camera.getWorldDirection(evaForward);
        // Project camera forward cleanly onto the horizontal deck plane orthogonal to evaUp
        const forwardDotUp = evaForward.dot(evaUp);
        evaForward.addScaledVector(evaUp, -forwardDotUp);
        if (evaForward.lengthSq() < 1e-6) {
          evaForward.set(0, 0, -1).applyQuaternion(astronaut.rootGroup.quaternion);
          evaForward.addScaledVector(evaUp, -evaForward.dot(evaUp));
        }
        evaForward.normalize();
        evaRight.crossVectors(evaForward, evaUp).normalize();

        evaMoveDir
          .set(0, 0, 0)
          .addScaledVector(evaForward, moveForwardInput)
          .addScaledVector(evaRight, moveRightInput)
          .addScaledVector(evaUp, moveUpInput);

        const moveMag = evaMoveDir.length();
        const maxEvaSpeed = currentShipScale * (evaSprinting ? 14.5 : 5.4);
        if (moveMag > 0.01) {
          evaMoveDir.divideScalar(moveMag);
          const accel = currentShipScale * (evaSprinting ? 40.0 : 20.0);
          evaVelocity.addScaledVector(evaMoveDir, accel * dt);
          if (evaVelocity.length() > maxEvaSpeed) {
            evaVelocity.setLength(maxEvaSpeed);
          }

          // Smoothly rotate Astronaut to stay upright along evaUp while facing horizontal travel (-Z)
          _evaRelVec.copy(evaMoveDir).addScaledVector(evaUp, -evaMoveDir.dot(evaUp));
          if (_evaRelVec.lengthSq() > 0.002) {
            _evaRelVec.normalize();
            _stationXAxis.crossVectors(_evaRelVec, evaUp).normalize();
            _stationZAxis.crossVectors(_stationXAxis, evaUp).normalize(); // +Z = -forward
            _stationBasisMat.makeBasis(_stationXAxis, evaUp, _stationZAxis);
            _tmpQuat1.setFromRotationMatrix(_stationBasisMat);
            astronaut.rootGroup.quaternion.slerp(_tmpQuat1, Math.min(1, dt * 11));
          }
        } else {
          // Comfortable micro-damping EVA thruster stabilization
          evaVelocity.multiplyScalar(Math.exp(-dt * 5.2));
        }

        _tmpV5.copy(astronaut.rootGroup.position);
        evaDisplacement.copy(evaVelocity).multiplyScalar(dt);
        astronaut.rootGroup.position.add(evaDisplacement);

        // Planetary Upper-Atmosphere Keep-Out (prevents astronaut from ever falling inside Earth or any planet!)
        const evaDominantWorldPos = bodyWorldPositions[evaDominantBody.id];
        if (evaDominantWorldPos && evaDominantBody.category !== 'galaxy') {
          const minEvaPlanetSurfaceDist = evaDominantRadius * 1.038 + currentShipScale * 2.2;
          _tmpV4.subVectors(astronaut.rootGroup.position, evaDominantWorldPos);
          const curEvaPlanetDist = _tmpV4.length();
          if (curEvaPlanetDist < minEvaPlanetSurfaceDist && curEvaPlanetDist > 1e-9) {
            _tmpV4.divideScalar(curEvaPlanetDist);
            astronaut.rootGroup.position
              .copy(evaDominantWorldPos)
              .addScaledVector(_tmpV4, minEvaPlanetSurfaceDist);
            const inwardEvaVel = evaVelocity.dot(_tmpV4);
            if (inwardEvaVel < 0) {
              evaVelocity.addScaledVector(_tmpV4, -inwardEvaVel);
            }
          }
        }

        // Orbital Station Exterior Hull Keep-Out (Station is exterior-only; prevent entering modules)
        const isGroundedOnStation = false;
        if (hasOrbitalStationPos) {
          if (
            orbitalStation.enforceExteriorKeepOutWorld(
              astronaut.rootGroup.position,
              orbitalStationWorldScale,
              2.2
            )
          ) {
            evaVelocity.multiplyScalar(0.15);
          }
        }

        // Follow camera seamlessly with OrbitControls around Astronaut's actual post-collision displacement
        evaDisplacement.subVectors(astronaut.rootGroup.position, _tmpV5);
        camera.position.add(evaDisplacement);
        if (hasOrbitalStationPos) {
          orbitalStation.enforceExteriorKeepOutWorld(
            camera.position,
            orbitalStationWorldScale,
            1.6
          );
        }
        evaTargetPos
          .copy(astronaut.rootGroup.position)
          .addScaledVector(evaUp, astronautScale * 1.15);
        controls.enabled = true;
        controls.target.copy(evaTargetPos);
        controls.minDistance = Math.max(1e-7, currentShipScale * 0.95);
        controls.maxDistance = 200000;
        controls.update();

        // Rim-light both Astronaut & parked Light Fighter in deep space
        shipRimLight.visible = true;
        _tmpV2.set(0.5, 0.9, 0.4);
        shipRimLight.position
          .copy(astronaut.rootGroup.position)
          .addScaledVector(_tmpV2, currentShipScale * 22);
        shipRimLight.target.position.copy(astronaut.rootGroup.position);
        shipRimLight.target.updateMatrixWorld();

        const evaSpeedUnits = evaVelocity.length();
        const speedNorm01 = maxEvaSpeed > 0 ? THREE.MathUtils.clamp(evaSpeedUnits / maxEvaSpeed, 0, 1) : 0;
        const isMovingVertical = Math.abs(moveUpInput) > 0.05;
        const evaMode =
          speedNorm01 < 0.06
            ? 'EVA_IDLE'
            : isGroundedOnStation && !isMovingVertical
              ? evaSprinting
                ? 'EVA_RUN'
                : 'EVA_WALK'
              : isMovingVertical || !isGroundedOnStation
                ? evaSprinting && !isMovingVertical
                  ? 'EVA_RUN'
                  : 'EVA_JETPACK'
                : 'EVA_WALK';

        astronaut.update({
          dt,
          clockTime,
          mode: evaMode,
          moveSpeed01: speedNorm01,
          boostActive: evaSprinting && speedNorm01 > 0.05,
          pitchTilt: -moveForwardInput * 0.4,
          rollTilt: moveRightInput * 0.35,
          visorLightOn: st.evaVisorLightOn,
          worldScale: currentShipScale,
        });

        const sunPosForEva = bodyWorldPositions['sun'];
        const evaSunDist = sunPosForEva
          ? astronaut.rootGroup.position.distanceTo(sunPosForEva)
          : astronaut.rootGroup.position.length();
        const evaNearStation =
          hasOrbitalStationPos &&
          astronaut.rootGroup.position.distanceTo(orbitalStationWorldPos) < orbitalStationWorldScale * 48;
        const evaInShadow = computeInPlanetaryShadow(
          astronaut.rootGroup.position,
          st.scaleMode,
          bodyWorldPositions
        );
        const liveEvaSurv = (activeSurvivalRef.current = stepSurvivalSimulation(
          activeSurvivalRef.current,
          {
            dt,
            mode: 'EVA',
            shipVariantId: st.selectedShipId || 'sr7-vanguard',
            throttle: 0,
            boostActive: false,
            isBraking: false,
            rcsActive: false,
            shieldsOn: false,
            headlightsOn: st.evaVisorLightOn,
            walkingInside: false,
            cabinLocalX: 0,
            cabinLocalZ: 0,
            evaSprinting,
            evaMoving: moveMag > 0.05 || Math.abs(moveUpInput) > 0.05,
            sunDistanceUnits: evaSunDist,
            nearestBodyId: evaDominantBody.id,
            nearestBodyCategory: evaDominantBody.category,
            nearestSurfaceRatio: Number.isFinite(evaBestProxRatio) ? evaBestProxRatio : 9999,
            nearOrbitalStation: evaNearStation,
            inPlanetaryShadow: evaInShadow,
          }
        ));

        if (now - lastTelemetrySync > 110) {
          lastTelemetrySync = now;
          const spdKmS = Math.round(evaSpeedUnits * 1_000_000);
          cb.onSyncSpacecraftTelemetry({
            speedUnitsPerSec: evaSpeedUnits,
            speedFormatted: spdKmS > 0 ? `${spdKmS.toLocaleString('pt-BR')} km/s` : '0 km/s',
            fuelPercent: Number(liveEvaSurv.fuelPercent.toFixed(1)),
            hullIntegrity: Number(liveEvaSurv.hullIntegrity.toFixed(1)),
            reactorTempC: Math.round(liveEvaSurv.hullTempC),
            pitchDeg: 0,
            yawDeg: 0,
            rollDeg: 0,
            nearestBodyId: selectedBody.id,
            nearestBodyName: selectedBody.name,
            nearestDistanceFormatted: 'EVA',
            nearbyContacts: [],
            autopilotStatus: 'OFF',
            survival: liveEvaSurv,
          });
        }
        if (now - lastSurvivalSync > 190) {
          lastSurvivalSync = now;
          cb.onSyncSurvivalState?.(liveEvaSurv);
        }
      } else {
        const returningFromLobby = wasLobbyShowcaseActive;
        // Keep parked spacecraft visible in space and preserve prevSpaceParkedValid so returning to "Nave" resumes at the exact same spot!
        sr7.rootGroup.visible = prevSpaceParkedValid;
        sr7.hullGroup.rotation.z = 0;
        sr7.interiorGroup.rotation.z = 0;
        astronaut.rootGroup.visible = false;
        wasLobbyShowcaseActive = false;
        wasSpacecraftActive = false;
        wasWalkingInside = false;
        wasEvaActive = false;
        prevBrakeAudio = false;
        prevAutopilotIdAudio = null;
        if (!evaAttachedToShip) {
          sr7.pilotSeatAnchor.add(astronaut.rootGroup);
          astronaut.rootGroup.scale.setScalar(0.43);
          astronaut.rootGroup.position.set(0, 0, 0);
          astronaut.rootGroup.rotation.set(0, 0, 0);
          evaAttachedToShip = true;
        }
        spaceAudio.updateFrame({ dt, clockTime, mode: 'OBSERVATORY' });
        const exploreSunPos = bodyWorldPositions['sun'];
        const exploreSunDist = exploreSunPos
          ? camera.position.distanceTo(exploreSunPos)
          : camera.position.length();
        activeSurvivalRef.current = stepSurvivalSimulation(activeSurvivalRef.current, {
          dt,
          mode: 'EXPLORE',
          shipVariantId: st.selectedShipId || 'sr7-vanguard',
          throttle: 0,
          boostActive: false,
          isBraking: false,
          rcsActive: false,
          shieldsOn: false,
          headlightsOn: false,
          walkingInside: false,
          cabinLocalX: 0,
          cabinLocalZ: 0,
          evaSprinting: false,
          evaMoving: false,
          sunDistanceUnits: exploreSunDist,
          nearestBodyId: selectedBody.id,
          nearestBodyCategory: selectedBody.category,
          nearestSurfaceRatio: 10,
          nearOrbitalStation: false,
          inPlanetaryShadow: false,
        });
        if (now - lastSurvivalSync > 240) {
          lastSurvivalSync = now;
          cb.onSyncSurvivalState?.(activeSurvivalRef.current);
        }
        controls.enabled = true;
        const isGatewayFocused =
          st.selectedBodyId === 'earth' &&
          st.selectedSatelliteId === 'sat-orbital-gateway' &&
          hasOrbitalStationPos;
        if (isGatewayFocused) {
          shipRimLight.visible = true;
          _tmpV2.set(0.55, 0.85, 0.45);
          shipRimLight.position
            .copy(orbitalStationWorldPos)
            .addScaledVector(_tmpV2, orbitalStationWorldScale * 48);
          shipRimLight.target.position.copy(orbitalStationWorldPos);
          shipRimLight.target.updateMatrixWorld();
        } else {
          shipRimLight.visible = false;
        }
        controls.minDistance = isGatewayFocused
          ? Math.max(1e-6, orbitalStationWorldScale * 34.0)
          : selectedBody.id === 'milky-way'
            ? 2.2
            : Math.max(0.0000004, targetRadius * 1.18);
        controls.maxDistance = 200000;
        wasWarpingLastFrame = false;
        warpTunnelGroup.visible = false;
        if (Math.abs(camera.fov - 46) > 0.1) {
          camera.fov = 46;
          camera.updateProjectionMatrix();
        }

        const mwWorldPos = bodyWorldPositions['milky-way'] || _originVec;
        const isExternalGalaxy =
          selectedBody.category === 'galaxy' && selectedBody.id !== 'milky-way';

        if (returningFromLobby && !isGatewayFocused) {
          const initDir = computeSunlitCameraOffsetDir(targetPos, selectedBody.id);
          const startMult = cameraCommandRef.current.desiredDistanceMultiplier || 3.4;
          const prevDamp = controls.enableDamping;
          controls.enableDamping = false;
          controls.target.copy(targetPos);
          camera.position
            .copy(targetPos)
            .addScaledVector(initDir, Math.max(0.0000008, targetRadius * startMult));
          controls.update();
          controls.enableDamping = prevDamp;
          previousTargetWorldPos.copy(targetPos);
          hasInitializedTargetPos = true;
          cameraCommandRef.current.activeTransition = false;
        } else if (hasInitializedTargetPos) {
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
          const minAllowed = isGatewayFocused
            ? Math.max(1e-6, orbitalStationWorldScale * 34.0)
            : selectedBody.id === 'milky-way'
              ? 2.2
              : Math.max(0.0000004, targetRadius * 1.24);
          const maxLen = 190000;
          const nextLen = THREE.MathUtils.clamp(offset.length() * factor, minAllowed, maxLen);
          offset.setLength(nextLen);
          camera.position.copy(zoomAnchor).add(offset);
          if (!isExternalGalaxy && step > 0 && distFromOrigin > galThresholds.fadeStart) {
            controls.target.lerp(_originVec, 0.32);
          }
        }

        if (cameraCommandRef.current.activeTransition) {
          if (isGatewayFocused) {
            const gatewayDist = orbitalStationWorldScale * orbitalStation.stationFocusDistanceLocal;
            const localViewDir = _tmpV3
              .set(-0.65, 0.34, 0.68)
              .normalize()
              .applyQuaternion(orbitalStation.rootGroup.quaternion);
            const goalCamPos = _tmpV2
              .copy(orbitalStationWorldPos)
              .addScaledVector(localViewDir, gatewayDist);
            camera.position.lerp(goalCamPos, 0.12);
            controls.target.lerp(orbitalStationWorldPos, 0.18);
            if (camera.position.distanceTo(goalCamPos) < gatewayDist * 0.03) {
              controls.target.copy(orbitalStationWorldPos);
              cameraCommandRef.current.activeTransition = false;
            }
          } else {
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
            camera.position.lerp(goalCamPos, 0.11);
            controls.target.lerp(targetPos, 0.18);
            if (camera.position.distanceTo(goalCamPos) < desiredDist * 0.03) {
              controls.target.copy(targetPos);
              cameraCommandRef.current.activeTransition = false;
            }
          }
        } else {
          // Continuous Multi-Scale Orbit Pivot Interpolation:
          // Smoothly transitions controls.target between Sagittarius A* (at Galactic Scale)
          // and the Solar System / Selected Planet (at Solar System & Planetary Scale)
          if (isGatewayFocused) {
            controls.target.lerp(orbitalStationWorldPos, 0.18);
          } else if (isExternalGalaxy) {
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

        if (hasOrbitalStationPos && isGatewayFocused) {
          orbitalStation.enforceExteriorKeepOutWorld(
            camera.position,
            orbitalStationWorldScale,
            2.4
          );
        }

        if (cameraCommandRef.current.activeTransition) {
          const prevDamp = controls.enableDamping;
          controls.enableDamping = false;
          controls.update();
          controls.enableDamping = prevDamp;
        } else {
          controls.update();
        }

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
      if (st.lobbyShowcaseActive) {
        targetNear = 0.08;
      } else if (st.spacecraftControl.isActive) {
        targetNear = st.spacecraftControl.walkingInside
          ? THREE.MathUtils.clamp(currentShipScale * 0.008, 1e-8, 0.0005)
          : st.spacecraftControl.cameraView === 'COCKPIT'
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
        if (st.lobbyShowcaseActive) {
          setScreenLabels((prev) => (prev.length > 0 ? [] : prev));
        } else {
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
      }

      renderer.render(scene, camera);
    };

    const finalizeSceneBoot = () => {
      if (isDisposed || bootCompleted) return;
      bootCompleted = true;
      window.clearTimeout(bootTimeoutId);

      emitBootProgress({
        progress: 88,
        stage: 'Compilando shaders 3D, Via Láctea e nave...',
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
      const prevAstroVis = astronaut.rootGroup.visible;
      const prevHangarVis = hangarBay.rootGroup.visible;
      const prevBeltVis = beltGroup.visible;
      const prevSatVis = satelliteGroup.visible;
      sr7.rootGroup.visible = true;
      astronaut.rootGroup.visible = true;
      hangarBay.rootGroup.visible = true;
      sr7.rootGroup.position.copy(initialPos);
      beltGroup.visible = true;
      satelliteGroup.visible = true;

      renderer.compile(scene, camera);

      sr7.rootGroup.visible = prevSr7Vis;
      astronaut.rootGroup.visible = prevAstroVis;
      hangarBay.rootGroup.visible = prevHangarVis;
      beltGroup.visible = prevBeltVis;
      satelliteGroup.visible = prevSatVis;

      const totalLoadedFinal = totalTexCount + Math.max(1, shipTexTotal) + 2;

      emitBootProgress({
        progress: 96,
        stage: 'Sincronizando órbitas 1:1 e telemetria SGP4...',
        detail: 'Finalizando primeiro quadro 3D',
        loadedTextures: totalLoadedFinal,
        totalTextures: totalLoadedFinal,
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
            if (stateRef.current.lobbyShowcaseActive) {
              applyHangarShowcaseFrame(0.016, 0, true);
            }
            renderer.render(scene, camera);
            emitBootProgress({
              progress: 100,
              stage: 'Hangar 100% carregado',
              detail: 'Abrindo menu espacial...',
              loadedTextures: totalLoadedFinal,
              totalTextures: totalLoadedFinal,
              ready: true,
            });
          });
        });
      });
    };

    // Wait genuinely for ALL planet textures, spaceship geometry + all PBR textures, astronaut & orbital station
    // (180s failsafe prevents infinite hang only if browser loses network permanently)
    bootTimeoutId = window.setTimeout(finalizeSceneBoot, 180000);
    Promise.all([
      ...Array.from(texturePromiseCache.values()),
      sr7.modelReadyPromise,
      astronaut.modelReadyPromise,
      orbitalStation.modelReadyPromise,
    ]).then(() => {
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
      renderer.domElement.removeEventListener('dblclick', handleDoubleClick);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      sr7InstanceRef.current = null;
      astronautInstanceRef.current = null;
      sr7.dispose();
      astronaut.dispose();
      orbitalStation.dispose();
      hangarBay.dispose();
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

      {/* Compact Top-Left Scale Switcher & Live Vertical Scale Readout (Minimal clean screen) */}
      {!spacecraftControl.isActive && !lobbyShowcaseActive && !hideHud && (
        <div className="fixed left-3 top-3 z-20 flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-slate-950/70 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-xl">
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
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${zoomLevel !== 'SOLAR_SYSTEM' && zoomLevel !== 'COSMIC_GALAXY'
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
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${zoomLevel === 'SOLAR_SYSTEM'
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
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 ${zoomLevel === 'COSMIC_GALAXY'
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
            className="hidden sm:flex px-2.5 py-1 rounded-full bg-slate-950/65 backdrop-blur-xl border border-white/10 text-[10px] font-mono text-slate-300 shadow-lg items-center gap-1"
            title="Escala Vertical do Campo de Visão Atual"
          >
            <span className="text-sky-400 font-bold">↕</span>
            <span>{scaleReadout}</span>
          </div>
        </div>
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
                className={`pointer-events-auto absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono transition-all border backdrop-blur-md ${isSelectedSat
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
                className={`pointer-events-auto absolute flex flex-col items-center group ${isSelectedLm ? 'z-30' : 'z-20'
                  }`}
              >
                <div
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium border backdrop-blur-md whitespace-nowrap transition-colors ${isSelectedLm
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
                className={`pointer-events-auto absolute flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs tracking-wide transition-all ${isSolarSystemMarker
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
