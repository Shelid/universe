import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Disc,
  Eye,
  EyeOff,
  Globe,
  Layers,
  Menu,
  Radio,
  Satellite,
  X,
} from 'lucide-react';
import { spaceAudio } from './utils/spaceAudioEngine';
import {
  QualityPreference,
  ResolvedQualityTier,
  loadSavedQualityPreference,
  saveQualityPreference,
} from './utils/performanceProfile';
import {
  CabinStationId,
  PowerSubsystemId,
  PropagatedSatellite,
  SatelliteCategory,
  SatelliteRecord,
  ScaleMode,
  SceneBootProgress,
  SpacecraftControlState,
  SpacecraftTelemetry,
  SpacecraftVariantId,
  CharacterVariantId,
  SpaceMission,
  SurfaceLandmark,
  SurvivalResourcesState,
  WarpFlightState,
  ZoomLevel,
} from './types/astronomy';
import {
  adjustPowerPips,
  calibrateReactorO2Action,
  consumeFoodRation,
  consumeWarpCell,
  consumeWaterFlask,
  createInitialSurvivalState,
  emergencyRescueDroneAction,
  fullStationResupplyAction,
  POWER_PRESETS,
  restInCabinBunkAction,
  useRepairKitAction,
} from './utils/survivalEngine';
import {
  getCharacterPreset,
  getSpacecraftPreset,
  loadSavedCharacterVariant,
  loadSavedShipVariant,
  saveCharacterVariant,
  saveShipVariant,
} from './data/hangarCatalog';
import {
  SpacecraftCockpitHUD,
  VirtualSteerInput,
} from './components/SpacecraftCockpitHUD';
import {
  CommandMenuTab,
  GameCommandMenu,
  GamePlayerMode,
} from './components/GameCommandMenu';
import {
  EVACharacterHUD,
  EVAVirtualInput,
} from './components/EVACharacterHUD';
import {
  ALL_CELESTIAL_BODIES,
  getCelestialBody,
  getScaledRadius,
} from './data/solarSystemData';
import {
  propagateSatelliteCatalog,
  propagateSingleSatellite,
  refreshCatalogFromCelesTrak,
  VERIFIED_SATELLITE_CATALOG,
} from './data/satellitesData';
import { StationDeployCommand, UniverseCanvas } from './components/UniverseCanvas';
import { HangarCameraFocus } from './utils/hangarBayModel';
import {
  FlightControlPrefs,
  loadSavedFlightControlPrefs,
  saveFlightControlPrefs,
} from './utils/flightControlPrefs';
import { LoadingScreen } from './components/LoadingScreen';
import { LobbyStartDestination, MainMenuLobby } from './components/MainMenuLobby';
import { UniverseLogo } from './components/UniverseLogo';
import { ScientificDossierPanel } from './components/ScientificDossierPanel';
import { EarthSurfaceExplorerModal } from './components/EarthSurfaceExplorerModal';
import { MissionsExplorerModal } from './components/MissionsExplorerModal';
import { WarpOverlayHUD } from './components/WarpOverlayHUD';

const INITIAL_BOOT_PROGRESS: SceneBootProgress = {
  progress: 4,
  stage: 'Preparando motor espacial 3D...',
  detail: 'Analisando perfil de GPU e VRAM',
  loadedTextures: 0,
  totalTextures: 0,
  ready: false,
};

export function App() {
  // Core Navigation & Selection State (Unified True 1:1 Scale & Adaptive Performance)
  const [selectedBodyId, setSelectedBodyId] = useState<string>('earth');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('PLANETARY_APPROACH');
  const scaleMode: ScaleMode = 'TRUE_1_TO_1';
  const [qualityPreference, setQualityPreference] = useState<QualityPreference>(() =>
    loadSavedQualityPreference()
  );
  const [resolvedQualityTier, setResolvedQualityTier] = useState<ResolvedQualityTier>('high');
  const [bootProgress, setBootProgress] = useState<SceneBootProgress>(INITIAL_BOOT_PROGRESS);
  const [showLoadingScreen, setShowLoadingScreen] = useState<boolean>(true);
  const [isLoadingFading, setIsLoadingFading] = useState<boolean>(false);
  const [isReconfiguringGpu, setIsReconfiguringGpu] = useState<boolean>(false);
  // Closed by default so the initial screen is clean, spacious, and cinematic!
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [isQuickCardOpen, setIsQuickCardOpen] = useState<boolean>(false);
  const [isMainMenuOpen, setIsMainMenuOpen] = useState<boolean>(true);
  const [isHudHidden, setIsHudHidden] = useState<boolean>(false);
  const [lobbyStartDestination, setLobbyStartDestination] =
    useState<LobbyStartDestination>('EXPLORE');
  const [lobbyFocusTarget, setLobbyFocusTarget] = useState<HangarCameraFocus>('OVERVIEW');
  const [flightControlPrefs, setFlightControlPrefs] = useState<FlightControlPrefs>(() =>
    loadSavedFlightControlPrefs()
  );
  const handleChangeFlightControlPrefs = useCallback((next: FlightControlPrefs) => {
    setFlightControlPrefs(next);
    saveFlightControlPrefs(next);
  }, []);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState<boolean>(false);
  const [commandMenuTab, setCommandMenuTab] = useState<CommandMenuTab>('hangar');
  const [selectedShipId, setSelectedShipId] = useState<SpacecraftVariantId>(() =>
    loadSavedShipVariant()
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<CharacterVariantId>(() =>
    loadSavedCharacterVariant()
  );
  const [stationDeployCommand, setStationDeployCommand] = useState<StationDeployCommand>({
    seq: 0,
    mode: 'ORBIT_INSPECT',
  });
  const [bodySelectSeq, setBodySelectSeq] = useState<number>(0);
  const [cinematicTravelEnabled, setCinematicTravelEnabled] = useState<boolean>(true);

  // Time & Ephemeris Simulation State — Defaults to REAL-TIME (0 = 1s per 1s) so Earth & Satellites move calmly!
  const [simulationTimeMs, setSimulationTimeMs] = useState<number>(() => Date.now());
  const [timeSpeedDaysPerSec, setTimeSpeedDaysPerSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Visual Layer Toggles (Disabled by default for a clean 3D view; player can enable in Menu)
  const [showOrbits, setShowOrbits] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(false);
  const [showAsteroidBelt, setShowAsteroidBelt] = useState<boolean>(true);
  const [showMissionTrajectories, setShowMissionTrajectories] = useState<boolean>(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);

  // Special Planetary Experience States
  const [isExploringInterior, setIsExploringInterior] = useState<boolean>(false);
  const [selectedInteriorLayerId, setSelectedInteriorLayerId] = useState<string | null>(null);
  const [venusRadarMode, setVenusRadarMode] = useState<boolean>(false);
  const [saturnRingDiveMode, setSaturnRingDiveMode] = useState<boolean>(false);
  const [isEarthSurfaceModalOpen, setIsEarthSurfaceModalOpen] = useState<boolean>(false);
  const [isMissionsModalOpen, setIsMissionsModalOpen] = useState<boolean>(false);
  const [selectedLandmark, setSelectedLandmark] = useState<SurfaceLandmark | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Earth Artificial Satellites State (CelesTrak + SGP4)
  const [satelliteCatalog, setSatelliteCatalog] = useState<SatelliteRecord[]>(
    VERIFIED_SATELLITE_CATALOG
  );
  const [isLiveCelesTrak, setIsLiveCelesTrak] = useState<boolean>(false);
  const [tleUpdatedAtIso, setTleUpdatedAtIso] = useState<string>(
    '2024-11-10T12:26:33Z (NORAD / CelesTrak)'
  );
  const [enabledSatelliteCategories, setEnabledSatelliteCategories] = useState<
    Record<SatelliteCategory, boolean>
  >({
    SPACE_STATIONS: true,
    TELESCOPES: true,
    EARTH_OBSERVATION: true,
    WEATHER: true,
    COMMUNICATIONS: true,
  });
  const [selectedSatellite, setSelectedSatellite] = useState<PropagatedSatellite | null>(null);

  // Cinematic Warp Flight State
  const [warpState, setWarpState] = useState<WarpFlightState>({
    isActive: false,
    originId: 'earth',
    targetId: 'saturn',
    targetName: 'Saturno',
    progress: 0,
    stage: 'IDLE',
    stageLabel: '',
    speedMultiplier: 1,
    isPaused: false,
    distanceAU: 0,
    distanceKm: 0,
    lightTravelTimeFormatted: '0 min',
    apparentSpeedC: 0,
  });

  // SR-7 Explorer Spacecraft & Interactive 3D Cockpit Flight State
  const [spacecraftControl, setSpacecraftControl] = useState<SpacecraftControlState>({
    isActive: false,
    cameraView: 'EXTERNAL',
    throttle: 0,
    boostActive: false,
    headlightsOn: true,
    sasEnabled: true,
    shieldsOn: true,
    radarPulseTimestamp: 0,
    autopilotTargetId: null,
    brakeRequested: false,
    firePulseCount: 0,
    interiorLightsOn: true,
    recenterTrigger: 0,
    walkingInside: false,
    ecoCruiseMode: false,
    radiatorsDeployed: false,
  });

  // Survival & Ship Resources Engine State (Ref as 60fps authority + React mirror for HUD)
  const survivalRef = useRef<SurvivalResourcesState>(createInitialSurvivalState());
  const [survivalState, setSurvivalState] = useState<SurvivalResourcesState>(survivalRef.current);
  const [survivalNotice, setSurvivalNotice] = useState<string | null>(null);
  const survivalNoticeTimerRef = useRef<number | null>(null);

  const showSurvivalNotice = useCallback((msg: string) => {
    setSurvivalNotice(msg);
    if (survivalNoticeTimerRef.current !== null) {
      window.clearTimeout(survivalNoticeTimerRef.current);
    }
    survivalNoticeTimerRef.current = window.setTimeout(() => {
      setSurvivalNotice(null);
      survivalNoticeTimerRef.current = null;
    }, 3400);
  }, []);

  const handleSyncSurvivalState = useCallback((next: SurvivalResourcesState) => {
    survivalRef.current = next;
    setSurvivalState(next);
  }, []);

  const [spacecraftTelemetry, setSpacecraftTelemetry] = useState<SpacecraftTelemetry>({
    speedUnitsPerSec: 0,
    speedFormatted: '0 km/s',
    fuelPercent: 100,
    hullIntegrity: 100,
    reactorTempC: 340,
    pitchDeg: 0,
    yawDeg: 0,
    rollDeg: 0,
    nearestBodyId: 'earth',
    nearestBodyName: 'Terra',
    nearestDistanceFormatted: '0 km',
    nearbyContacts: [],
    autopilotStatus: 'OFF',
  });

  const [virtualSteerInput, setVirtualSteerInput] = useState<VirtualSteerInput>({
    pitch: 0,
    yaw: 0,
    roll: 0,
    forward: 0,
  });

  // Rigged Astronaut EVA State
  const [evaActive, setEvaActive] = useState<boolean>(false);
  const [evaVisorLightOn, setEvaVisorLightOn] = useState<boolean>(true);
  const [evaRecenterTrigger, setEvaRecenterTrigger] = useState<number>(0);
  const [evaRadarTrigger, setEvaRadarTrigger] = useState<number>(0);
  const [evaVirtualInput, setEvaVirtualInput] = useState<EVAVirtualInput>({
    moveX: 0,
    moveZ: 0,
    moveY: 0,
    sprint: false,
  });

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState<number>(() =>
    Math.round(spaceAudio.getMasterVolume() * 100)
  );

  const toggleAudioMuted = useCallback(() => {
    spaceAudio.unlock();
    setIsAudioMuted((prev) => {
      const next = !prev;
      spaceAudio.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    refreshCatalogFromCelesTrak(VERIFIED_SATELLITE_CATALOG).then((res) => {
      setSatelliteCatalog(res.catalog);
      setIsLiveCelesTrak(res.isLiveCelesTrak);
      setTleUpdatedAtIso(res.updatedAtIso);
    });
  }, []);

  useEffect(() => {
    if (!bootProgress.ready) {
      setShowLoadingScreen(true);
      setIsLoadingFading(false);
      return;
    }
    const fadeTimer = window.setTimeout(() => {
      setIsLoadingFading(true);
    }, 260);
    const unmountTimer = window.setTimeout(() => {
      setShowLoadingScreen(false);
      setIsLoadingFading(false);
      setIsReconfiguringGpu(false);
    }, 980);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [bootProgress.ready]);

  const playerMode: GamePlayerMode = spacecraftControl.isActive
    ? 'SPACECRAFT'
    : evaActive
      ? 'EVA'
      : 'EXPLORE';

  const activeShipPreset = useMemo(() => getSpacecraftPreset(selectedShipId), [selectedShipId]);
  const activeCharacterPreset = useMemo(
    () => getCharacterPreset(selectedCharacterId),
    [selectedCharacterId]
  );

  const openMenuOnTab = useCallback((tab: CommandMenuTab) => {
    setCommandMenuTab(tab);
    setIsCommandMenuOpen(true);
  }, []);

  const launchSpacecraftSR7 = useCallback((cockpitFirst = false) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    spaceAudio.unlock();
    spaceAudio.playShipStartup();
    setEvaActive(false);
    setIsDossierOpen(false);
    setIsExploringInterior(false);
    setWarpState((w) => ({ ...w, isActive: false, stage: 'IDLE' }));
    setSpacecraftControl((prev) => ({
      ...prev,
      isActive: true,
      cameraView: cockpitFirst ? 'COCKPIT' : 'EXTERNAL',
      throttle: 0,
      brakeRequested: false,
      autopilotTargetId: null,
      walkingInside: false,
      recenterTrigger: (prev.recenterTrigger || 0) + 1,
    }));
  }, []);

  const switchPlayerMode = useCallback(
    (nextMode: GamePlayerMode) => {
      if (nextMode === 'SPACECRAFT') {
        launchSpacecraftSR7(false);
        return;
      }
      if (nextMode === 'EVA') {
        (document.activeElement as HTMLElement | null)?.blur?.();
        spaceAudio.unlock();
        spaceAudio.playCockpitSwitch(true);
        setIsDossierOpen(false);
        setIsExploringInterior(false);
        setWarpState((w) => ({ ...w, isActive: false, stage: 'IDLE' }));
        setSpacecraftControl((prev) => ({
          ...prev,
          isActive: false,
          throttle: 0,
          boostActive: false,
          autopilotTargetId: null,
          walkingInside: false,
        }));
        setEvaActive(true);
        return;
      }
      // EXPLORE
      if (spacecraftControl.isActive) spaceAudio.playShipShutdown();
      setEvaActive(false);
      setSpacecraftControl((prev) => ({
        ...prev,
        isActive: false,
        throttle: 0,
        boostActive: false,
        autopilotTargetId: null,
        walkingInside: false,
      }));
    },
    [launchSpacecraftSR7, spacecraftControl.isActive]
  );

  const handleConsumeFood = useCallback(() => {
    const cur = survivalRef.current;
    if (cur.foodRations <= 0) {
      showSurvivalNotice('Sem rações disponíveis — reabasteça na Estação Orbital ou chame Drone.');
      return;
    }
    const next = consumeFoodRation(cur);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('food');
    showSurvivalNotice(`Ração consumida · Saciedade ${Math.round(next.hungerPercent)}% (${next.foodRations} un restantes)`);
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleConsumeWater = useCallback(() => {
    const cur = survivalRef.current;
    if (cur.waterFlasks <= 0) {
      showSurvivalNotice('Sem cantis de água disponíveis — reabasteça na Estação Orbital.');
      return;
    }
    const next = consumeWaterFlask(cur);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('water');
    showSurvivalNotice(`Água ingerida · Hidratação ${Math.round(next.thirstPercent)}% (${next.waterFlasks} un restantes)`);
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleConsumeWarpCell = useCallback(() => {
    const cur = survivalRef.current;
    if (cur.warpCells <= 0) {
      showSurvivalNotice('Sem Células de Dobra reserva — recarregue na Coroa Solar ou Doca Orbital.');
      return;
    }
    const next = consumeWarpCell(cur);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('cell');
    showSurvivalNotice(`Célula de Dobra injetada · Núcleo em 100% (${next.warpCells} un restantes)`);
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleUseRepairKit = useCallback(() => {
    const cur = survivalRef.current;
    if (cur.repairKits <= 0) {
      showSurvivalNotice('Sem Kits de Reparo — reabasteça na Doca Orbital.');
      return;
    }
    const next = useRepairKitAction(cur);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('repair');
    showSurvivalNotice(`Casco selado (${Math.round(next.hullIntegrity)}%) · ${next.repairKits} kits restantes`);
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleRestInBunk = useCallback(() => {
    const next = restInCabinBunkAction(survivalRef.current);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playRestChime();
    showSurvivalNotice('Descanso concluído na beliche · Energia do piloto 100% e reator resfriado');
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleCalibrateReactor = useCallback(() => {
    const next = calibrateReactorO2Action(survivalRef.current);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('repair');
    showSurvivalNotice(`Filtros & Reator calibrados · O₂ Cabine ${Math.round(next.shipOxygenPercent)}%`);
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleCallRescueDrone = useCallback(() => {
    const next = emergencyRescueDroneAction(survivalRef.current);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('cell');
    showSurvivalNotice('Drone de Socorro entregou combustível, O₂ e provisões de emergência!');
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleStationResupply = useCallback(() => {
    const next = fullStationResupplyAction(survivalRef.current);
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('cell');
    showSurvivalNotice('Reabastecimento completo concluído pela Doca Orbital!');
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleEmergencyEvaO2Refill = useCallback(() => {
    const cur = survivalRef.current;
    const next: SurvivalResourcesState = {
      ...cur,
      evaOxygenPercent: Math.min(100, Number((cur.evaOxygenPercent + 45).toFixed(1))),
    };
    handleSyncSurvivalState(next);
    spaceAudio.unlock();
    spaceAudio.playProvisionUse('water');
    showSurvivalNotice(`Cartucho reserva injetado no traje · O₂ ${Math.round(next.evaOxygenPercent)}%`);
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleToggleEcoMode = useCallback(() => {
    const cur = survivalRef.current;
    const nextEco = !cur.ecoCruiseMode;
    handleSyncSurvivalState({ ...cur, ecoCruiseMode: nextEco });
    setSpacecraftControl((prev) => ({ ...prev, ecoCruiseMode: nextEco }));
    spaceAudio.unlock();
    spaceAudio.playCockpitSwitch(nextEco);
    showSurvivalNotice(
      nextEco ? 'Modo ECO Cruise ativado (-42% gasto de combustível)' : 'Modo ECO Cruise desativado'
    );
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleToggleRadiators = useCallback(() => {
    const cur = survivalRef.current;
    const nextRad = !cur.radiatorsDeployed;
    handleSyncSurvivalState({ ...cur, radiatorsDeployed: nextRad });
    setSpacecraftControl((prev) => ({ ...prev, radiatorsDeployed: nextRad }));
    spaceAudio.unlock();
    spaceAudio.playRadiatorToggle(nextRad);
    showSurvivalNotice(
      nextRad ? 'Aletas Radiadoras Térmicas estendidas!' : 'Aletas Radiadoras Térmicas retraídas'
    );
  }, [handleSyncSurvivalState, showSurvivalNotice]);

  const handleAdjustPowerPip = useCallback(
    (subsystem: PowerSubsystemId, delta: 1 | -1) => {
      const cur = survivalRef.current;
      const nextPips = adjustPowerPips(cur.powerPips, subsystem, delta);
      handleSyncSurvivalState({ ...cur, powerPips: nextPips });
      setSpacecraftControl((prev) => ({ ...prev, powerPips: nextPips }));
      spaceAudio.unlock();
      spaceAudio.playCockpitSwitch(delta > 0);
    },
    [handleSyncSurvivalState]
  );

  const handleApplyPowerPreset = useCallback(
    (presetKey: keyof typeof POWER_PRESETS) => {
      const preset = POWER_PRESETS[presetKey];
      const nextPips = { ...preset.pips };
      handleSyncSurvivalState({ ...survivalRef.current, powerPips: nextPips });
      setSpacecraftControl((prev) => ({ ...prev, powerPips: nextPips }));
      spaceAudio.unlock();
      spaceAudio.playCockpitSwitch(true);
      showSurvivalNotice(`Energia distribuída: ${preset.label}`);
    },
    [handleSyncSurvivalState, showSurvivalNotice]
  );

  const handleCabinStationAction = useCallback(
    (stationId: CabinStationId) => {
      const cur = survivalRef.current;
      if (stationId === 'GALLEY') {
        let updated = cur;
        let didFood = false;
        let didWater = false;
        if (updated.foodRations > 0 && updated.hungerPercent < 95) {
          updated = consumeFoodRation(updated);
          didFood = true;
        }
        if (updated.waterFlasks > 0 && updated.thirstPercent < 95) {
          updated = consumeWaterFlask(updated);
          didWater = true;
        }
        if (!didFood && !didWater) {
          if (updated.foodRations <= 0 && updated.waterFlasks <= 0) {
            showSurvivalNotice('Copa vazia — reabasteça na Doca Orbital ou chame Drone.');
          } else {
            showSurvivalNotice('Copa: piloto já está bem alimentado e hidratado!');
          }
          return;
        }
        handleSyncSurvivalState(updated);
        spaceAudio.unlock();
        spaceAudio.playProvisionUse(didFood ? 'food' : 'water');
        showSurvivalNotice(
          `Copa da Nave: Saciedade ${Math.round(updated.hungerPercent)}% · Hidratação ${Math.round(updated.thirstPercent)}%`
        );
      } else if (stationId === 'BUNK') {
        handleRestInBunk();
      } else if (stationId === 'REACTOR') {
        let updated = calibrateReactorO2Action(cur);
        if (updated.hullIntegrity < 90 && updated.repairKits > 0) {
          updated = useRepairKitAction(updated);
        }
        handleSyncSurvivalState(updated);
        spaceAudio.unlock();
        spaceAudio.playProvisionUse('repair');
        showSurvivalNotice(
          `Painel do Reator: O₂ ${Math.round(updated.shipOxygenPercent)}% · Bateria ${Math.round(updated.batteryPercent)}% · Casco ${Math.round(updated.hullIntegrity)}%`
        );
      } else if (stationId === 'AIRLOCK') {
        switchPlayerMode('EVA');
      }
    },
    [handleRestInBunk, handleSyncSurvivalState, showSurvivalNotice, switchPlayerMode]
  );

  // Global Menu & EVA Hotkeys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') setIsCommandMenuOpen(false);
        return;
      }
      if (isMainMenuOpen) return;
      const key = e.key.toLowerCase();
      if (key === 'm' || e.key === 'Tab') {
        e.preventDefault();
        setIsCommandMenuOpen((o) => !o);
      } else if (key === 'h') {
        setIsHudHidden((v) => !v);
      } else if (e.key === 'Escape') {
        setIsCommandMenuOpen(false);
      } else if (evaActive && !spacecraftControl.isActive) {
        if (key === 'l') {
          spaceAudio.playCockpitSwitch(!evaVisorLightOn);
          setEvaVisorLightOn((v) => !v);
        } else if (key === 'r') {
          spaceAudio.playRadarScan();
          setEvaRadarTrigger((n) => n + 1);
        } else if (key === 'c') {
          setEvaRecenterTrigger((n) => n + 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [evaActive, evaVisorLightOn, isMainMenuOpen, spacecraftControl.isActive]);

  const handleSyncSimulationTime = useCallback((nextTimeMs: number) => {
    setSimulationTimeMs(nextTimeMs);
  }, []);

  const handleChangeQualityPreference = useCallback(
    (pref: QualityPreference) => {
      if (pref === qualityPreference) return;
      setIsReconfiguringGpu(true);
      setBootProgress({
        progress: 6,
        stage: 'Reconfigurando motor WebGL...',
        detail: 'Ajustando texturas e shaders para o novo perfil',
        loadedTextures: 0,
        totalTextures: 0,
        ready: false,
      });
      setQualityPreference(pref);
      saveQualityPreference(pref);
    },
    [qualityPreference]
  );

  const earthRadiusScene = useMemo(
    () => getScaledRadius(getCelestialBody('earth'), 'TRUE_1_TO_1'),
    []
  );

  // Propagate Earth SGP4 satellites only while Earth or Earth Surface Modal is active;
  // generate high-precision 64-step orbital track ONLY for the focused satellite.
  const shouldPropagateLiveSatellites = selectedBodyId === 'earth' || isEarthSurfaceModalOpen;
  const [frozenSatTimeMs, setFrozenSatTimeMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (shouldPropagateLiveSatellites) {
      setFrozenSatTimeMs(timeSpeedDaysPerSec === 0 ? simulationTimeMs : Date.now());
    }
  }, [shouldPropagateLiveSatellites, simulationTimeMs, timeSpeedDaysPerSec]);

  const satellitePropagationDate = useMemo(
    () => new Date(frozenSatTimeMs),
    [frozenSatTimeMs]
  );

  const propagatedSatellites = useMemo(() => {
    return propagateSatelliteCatalog(
      satelliteCatalog,
      satellitePropagationDate,
      earthRadiusScene,
      selectedSatellite?.id ?? null
    );
  }, [satelliteCatalog, satellitePropagationDate, earthRadiusScene, selectedSatellite?.id]);

  const currentSelectedSatellite = useMemo(() => {
    if (!selectedSatellite) return null;
    return propagatedSatellites.find((s) => s.id === selectedSatellite.id) || selectedSatellite;
  }, [propagatedSatellites, selectedSatellite]);

  const handleDeployToStation = useCallback(
    (mode: 'ORBIT_INSPECT' | 'SHIP_DOCK' | 'EVA_WALK') => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      spaceAudio.unlock();
      setIsMainMenuOpen(false);
      setIsCommandMenuOpen(false);
      setSelectedBodyId('earth');
      setZoomLevel('ORBITAL_EXPLORATION');
      setIsDossierOpen(false);
      setIsQuickCardOpen(false);
      setIsExploringInterior(false);
      setWarpState((w) => ({ ...w, isActive: false, stage: 'IDLE' }));
      setEnabledSatelliteCategories((prev) => ({ ...prev, SPACE_STATIONS: true }));

      const gatewaySat =
        propagatedSatellites.find((s) => s.id === 'sat-orbital-gateway') ||
        propagateSingleSatellite(
          VERIFIED_SATELLITE_CATALOG[0],
          satellitePropagationDate,
          earthRadiusScene,
          true
        );
      setSelectedSatellite(gatewaySat);

      if (mode === 'SHIP_DOCK') {
        spaceAudio.playShipStartup();
        setEvaActive(false);
        setSpacecraftControl((prev) => ({
          ...prev,
          isActive: true,
          cameraView: 'EXTERNAL',
          throttle: 0,
          brakeRequested: false,
          autopilotTargetId: null,
          walkingInside: false,
          recenterTrigger: (prev.recenterTrigger || 0) + 1,
        }));
      } else if (mode === 'EVA_WALK') {
        spaceAudio.playCockpitSwitch(true);
        setSpacecraftControl((prev) => ({
          ...prev,
          isActive: false,
          throttle: 0,
          boostActive: false,
          autopilotTargetId: null,
          walkingInside: false,
        }));
        setEvaActive(true);
      } else {
        spaceAudio.playSelectBody('planet');
        setEvaActive(false);
        setSpacecraftControl((prev) => ({
          ...prev,
          isActive: false,
          throttle: 0,
          walkingInside: false,
        }));
      }
      setStationDeployCommand((prev) => ({ seq: prev.seq + 1, mode }));
    },
    [earthRadiusScene, propagatedSatellites, satellitePropagationDate]
  );

  const handleReturnToLobby = useCallback(() => {
    setIsCommandMenuOpen(false);
    setIsDossierOpen(false);
    setIsQuickCardOpen(false);
    setIsExploringInterior(false);
    setEvaActive(false);
    setSpacecraftControl((prev) => ({
      ...prev,
      isActive: false,
      throttle: 0,
      boostActive: false,
      autopilotTargetId: null,
      walkingInside: false,
    }));
    setWarpState((w) => ({ ...w, isActive: false, stage: 'IDLE' }));
    setLobbyFocusTarget('OVERVIEW');
    setIsMainMenuOpen(true);
  }, []);

  const handleStartFromLobby = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    spaceAudio.unlock();
    if (lobbyStartDestination === 'STATION_ORBIT') {
      handleDeployToStation('ORBIT_INSPECT');
      return;
    }
    if (lobbyStartDestination === 'SPACECRAFT_COCKPIT') {
      setIsMainMenuOpen(false);
      setSelectedSatellite(null);
      launchSpacecraftSR7(true);
      return;
    }
    if (lobbyStartDestination === 'EVA_STATION') {
      handleDeployToStation('EVA_WALK');
      return;
    }
    setIsMainMenuOpen(false);
    setSelectedSatellite(null);
    setSelectedBodyId('earth');
    setZoomLevel('PLANETARY_APPROACH');
    switchPlayerMode('EXPLORE');
  }, [handleDeployToStation, launchSpacecraftSR7, lobbyStartDestination, switchPlayerMode]);

  const selectedBody = useMemo(() => getCelestialBody(selectedBodyId), [selectedBodyId]);

  const handleSelectBody = useCallback(
    (targetId: string, triggerWarp = true) => {
      const targetBody = getCelestialBody(targetId);
      const originBody = getCelestialBody(selectedBodyId);

      setSelectedLandmark(null);
      setSelectedSatellite(null);
      setSaturnRingDiveMode(false);
      setIsExploringInterior(false);
      setEvaActive(false);
      setSpacecraftControl((prev) => ({
        ...prev,
        isActive: false,
        throttle: 0,
        boostActive: false,
        autopilotTargetId: null,
        walkingInside: false,
      }));
      setSelectedInteriorLayerId(targetBody.interiorLayers[0]?.id || null);
      setBodySelectSeq((s) => s + 1);

      const isDifferentMajorBody =
        targetId !== selectedBodyId &&
        targetBody.parentId !== selectedBodyId &&
        originBody.parentId !== targetId;

      if (triggerWarp && cinematicTravelEnabled && isDifferentMajorBody) {
        spaceAudio.unlock();
        spaceAudio.playWarpEngage();
        const dAU = Math.max(
          0.05,
          Math.abs(targetBody.distanceFromSunAU - originBody.distanceFromSunAU)
        );
        const dKm = dAU * 149_597_870.7;
        const lightSeconds = dKm / 299_792.458;
        const lightMinutes = lightSeconds / 60;
        const lightFormatted =
          lightMinutes < 60
            ? `${lightMinutes.toFixed(1)} minutos-luz`
            : `${(lightMinutes / 60).toFixed(2)} horas-luz`;

        setWarpState({
          isActive: true,
          originId: selectedBodyId,
          targetId,
          targetName: targetBody.name,
          progress: 0,
          stage: 'DEPARTURE',
          stageLabel: 'Afastamento Orbital e Alinhamento',
          speedMultiplier: 1,
          isPaused: false,
          distanceAU: dAU,
          distanceKm: dKm,
          lightTravelTimeFormatted: lightFormatted,
          apparentSpeedC: 12.5,
        });
      }

      setSelectedBodyId(targetId);
      if (!triggerWarp || !cinematicTravelEnabled || !isDifferentMajorBody) {
        spaceAudio.playSelectBody(targetBody.category);
      }
      setIsQuickCardOpen(false);
      if (targetBody.category === 'galaxy') {
        setZoomLevel('COSMIC_GALAXY');
      } else if (targetBody.category === 'moon') {
        setZoomLevel('ORBITAL_EXPLORATION');
      } else {
        setZoomLevel('PLANETARY_APPROACH');
      }
    },
    [cinematicTravelEnabled, selectedBodyId]
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsFullscreen(false);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#02040a] text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. 3D INTERACTIVE UNIVERSE WEBGL SCENE */}
      <UniverseCanvas
        selectedBodyId={selectedBodyId}
        onSelectBody={handleSelectBody}
        zoomLevel={zoomLevel}
        onZoomLevelChange={setZoomLevel}
        scaleMode={scaleMode}
        simulationTimeMs={simulationTimeMs}
        onSyncSimulationTime={handleSyncSimulationTime}
        timeSpeedDaysPerSec={timeSpeedDaysPerSec}
        isPaused={isPaused}
        showOrbits={showOrbits}
        showLabels={showLabels}
        showAsteroidBelt={showAsteroidBelt}
        showMissionTrajectories={showMissionTrajectories}
        activeMissionId={activeMissionId}
        isExploringInterior={isExploringInterior}
        selectedInteriorLayerId={selectedInteriorLayerId}
        onSelectInteriorLayer={(layerId) => {
          setSelectedInteriorLayerId(layerId);
          setIsDossierOpen(true);
        }}
        venusRadarMode={venusRadarMode}
        saturnRingDiveMode={saturnRingDiveMode}
        propagatedSatellites={propagatedSatellites}
        enabledSatelliteCategories={enabledSatelliteCategories}
        selectedSatelliteId={currentSelectedSatellite?.id || null}
        onSelectSatellite={(sat) => {
          setSelectedSatellite(sat);
        }}
        selectedLandmark={selectedLandmark}
        onSelectLandmark={(lm) => {
          setSelectedLandmark(lm);
          setIsDossierOpen(true);
        }}
        warpState={warpState}
        onUpdateWarpState={setWarpState}
        spacecraftControl={spacecraftControl}
        onUpdateSpacecraftControl={setSpacecraftControl}
        onSyncSpacecraftTelemetry={setSpacecraftTelemetry}
        virtualSteerInput={virtualSteerInput}
        evaActive={evaActive}
        evaVisorLightOn={evaVisorLightOn}
        evaRecenterTrigger={evaRecenterTrigger}
        evaRadarTrigger={evaRadarTrigger}
        evaVirtualInput={evaVirtualInput}
        selectedShipId={selectedShipId}
        selectedCharacterId={selectedCharacterId}
        stationDeployCommand={stationDeployCommand}
        lobbyShowcaseActive={isMainMenuOpen && !warpState.isActive}
        lobbyFocusTarget={lobbyFocusTarget}
        flightControlPrefs={flightControlPrefs}
        bodySelectSeq={bodySelectSeq}
        qualityPreference={qualityPreference}
        onResolvedQualityChange={setResolvedQualityTier}
        onBootProgress={setBootProgress}
        hideHud={isHudHidden}
        survivalStateRef={survivalRef}
        onSyncSurvivalState={handleSyncSurvivalState}
        onTriggerCabinStationAction={handleCabinStationAction}
      />

      {/* 1B. CINEMATIC PRELOAD SPLASH SCREEN WITH LOGO */}
      {showLoadingScreen && (
        <LoadingScreen
          bootProgress={bootProgress}
          resolvedTier={resolvedQualityTier}
          isFadingOut={isLoadingFading}
          isReconfiguring={isReconfiguringGpu}
        />
      )}

      {/* 1C. PRE-GAME HANGAR BAY MENU SHOWCASING 3D SHIP, ASTRONAUT & CONFIGURAÇÕES (NO GAME WORLD BEHIND) */}
      {!showLoadingScreen && isMainMenuOpen && (
        <MainMenuLobby
          isOpen={true}
          startDestination={lobbyStartDestination}
          onChangeStartDestination={setLobbyStartDestination}
          selectedShipId={selectedShipId}
          onSelectShip={(id) => {
            setSelectedShipId(id);
            saveShipVariant(id);
          }}
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={(id) => {
            setSelectedCharacterId(id);
            saveCharacterVariant(id);
          }}
          lobbyFocusTarget={lobbyFocusTarget}
          onChangeLobbyFocusTarget={setLobbyFocusTarget}
          qualityPreference={qualityPreference}
          resolvedQualityTier={resolvedQualityTier}
          onChangeQuality={handleChangeQualityPreference}
          isAudioMuted={isAudioMuted}
          onToggleAudioMuted={toggleAudioMuted}
          audioVolume={audioVolume}
          onChangeAudioVolume={(vol) => {
            setAudioVolume(vol);
            spaceAudio.setMasterVolume(vol / 100);
          }}
          flightControlPrefs={flightControlPrefs}
          onChangeFlightControlPrefs={handleChangeFlightControlPrefs}
          showOrbits={showOrbits}
          onToggleOrbits={setShowOrbits}
          showLabels={showLabels}
          onToggleLabels={setShowLabels}
          showAsteroidBelt={showAsteroidBelt}
          onToggleAsteroidBelt={setShowAsteroidBelt}
          cinematicTravelEnabled={cinematicTravelEnabled}
          onToggleCinematicTravel={setCinematicTravelEnabled}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onStartGame={handleStartFromLobby}
        />
      )}

      {/* 2. MINIMAL FLOATING CORNER MENU & CLEAN-SCREEN TOGGLE */}
      {!isMainMenuOpen && (
        <div className="pointer-events-auto fixed top-3 right-3 z-30 flex items-center gap-1.5">
          <button
            onClick={() => setIsHudHidden((v) => !v)}
            className={`p-2 rounded-full border backdrop-blur-xl transition-all ${isHudHidden
              ? 'bg-slate-950/40 hover:bg-slate-950/85 border-white/10 text-slate-400 hover:text-white opacity-45 hover:opacity-100'
              : 'bg-slate-950/70 hover:bg-slate-900 border-white/15 text-slate-300 hover:text-white shadow-lg'
              }`}
            title={isHudHidden ? 'Mostrar Interface (H)' : 'Ocultar HUD — Tela 100% Limpa (H)'}
          >
            {isHudHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          {!isHudHidden && (
            <button
              onClick={() => openMenuOnTab('hangar')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/75 hover:bg-slate-900 border border-sky-400/40 text-xs font-semibold text-white backdrop-blur-xl shadow-lg transition-all"
              title="Abrir Menu de Jogo, Modos, Hangar & Planetas (M)"
            >
              <Menu className="w-3.5 h-3.5 text-sky-300" />
              <span>Menu</span>
            </button>
          )}
        </div>
      )}

      {/* 3. SLEEK FLOATING BODY / SATELLITE SUMMARY (Shown ONLY when explicitly selected) */}
      {!isMainMenuOpen && !isHudHidden && !isDossierOpen && !warpState.isActive && playerMode === 'EXPLORE' && (
        <div className="pointer-events-none fixed left-3 right-3 sm:left-auto sm:right-4 top-14 z-20 flex flex-col items-end gap-2">
          {/* Selected Satellite Quick Card */}
          {selectedBodyId === 'earth' && currentSelectedSatellite && (
            <div className="pointer-events-auto w-full sm:w-80 max-w-sm bg-slate-950/90 backdrop-blur-2xl border border-sky-400/50 rounded-2xl p-3.5 shadow-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-sky-400 flex items-center gap-1">
                  <Satellite className="w-3.5 h-3.5" />
                  NORAD #{currentSelectedSatellite.noradId}
                </span>
                <button
                  onClick={() => setSelectedSatellite(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-[10px] font-medium"
                  title="Fechar Satélite"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Fechar</span>
                </button>
              </div>
              <div className="text-xs font-display font-bold text-white">
                {currentSelectedSatellite.name}
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">
                {currentSelectedSatellite.purpose}
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
                <div className="bg-slate-900/90 px-2 py-1 rounded border border-white/5">
                  <span className="text-slate-400">ALT: </span>
                  <span className="text-sky-300 font-semibold">
                    {currentSelectedSatellite.altitudeKm.toFixed(0)} km
                  </span>
                </div>
                <div className="bg-slate-900/90 px-2 py-1 rounded border border-white/5">
                  <span className="text-slate-400">VEL: </span>
                  <span className="text-emerald-300 font-semibold">
                    {currentSelectedSatellite.velocityKmS.toFixed(2)} km/s
                  </span>
                </div>
              </div>
              {currentSelectedSatellite.id === 'sat-orbital-gateway' && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={() => handleDeployToStation('EVA_WALK')}
                    className="py-1.5 px-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[11px] transition-colors"
                    title="Flutuar com o Astronauta no exterior da Estação Orbital (EVA)"
                  >
                    EVA Externo
                  </button>
                  <button
                    onClick={() => handleDeployToStation('SHIP_DOCK')}
                    className="py-1.5 px-2.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-100 font-semibold text-[11px] transition-colors"
                    title="Posicionar a Nave no exterior da Estação Orbital"
                  >
                    Aproximar Nave
                  </button>
                </div>
              )}
            </div>
          )}

          {isQuickCardOpen && (
            <div className="pointer-events-auto w-full sm:w-80 max-w-sm bg-slate-950/85 backdrop-blur-2xl border border-white/15 rounded-2xl p-3.5 shadow-2xl space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400 truncate">
                    {selectedBody.ClassificationLabel}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: selectedBody.primaryColorHex,
                        boxShadow: `0 0 10px ${selectedBody.primaryColorHex}`,
                      }}
                    />
                    <h2 className="text-lg font-display font-bold text-white truncate">
                      {selectedBody.name}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setIsQuickCardOpen(false)}
                  className="shrink-0 p-1.5 rounded-xl bg-white/10 hover:bg-rose-500/25 border border-white/15 text-slate-200 hover:text-white transition-colors"
                  title="Minimizar card"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                {selectedBody.tagline}
              </p>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-slate-900/80 p-2 rounded-xl border border-white/5">
                <div>
                  <div className="text-slate-400">DIÂMETRO</div>
                  <div className="text-white font-semibold mt-0.5 truncate">
                    {(selectedBody.meanRadiusKm * 2).toLocaleString('pt-BR')}{' '}
                    {selectedBody.category === 'galaxy' ? 'al' : 'km'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">DISTÂNCIA</div>
                  <div className="text-sky-300 font-semibold mt-0.5 truncate">
                    {selectedBody.category === 'galaxy'
                      ? selectedBody.distanceFromSunMeanKm.split('(')[0].trim()
                      : selectedBody.distanceFromSunAU > 0
                        ? `${selectedBody.distanceFromSunAU} UA`
                        : '0 UA'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">
                    {selectedBody.category === 'galaxy' ? 'ESTRELAS' : 'TEMP.'}
                  </div>
                  <div className="text-amber-300 font-semibold mt-0.5 truncate">
                    {selectedBody.category === 'galaxy'
                      ? selectedBody.massRelativeToEarth.split('(')[0].trim()
                      : selectedBody.temperatureMeanC.split('(')[0].trim()}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => setIsDossierOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ficha Científica</span>
                </button>

                <button
                  onClick={() => setIsExploringInterior((v) => !v)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${isExploringInterior
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                    : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Interior</span>
                </button>
              </div>

              {selectedBodyId === 'earth' && (
                <button
                  onClick={() => setIsEarthSurfaceModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-medium transition-all"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Superfície Nível 4</span>
                </button>
              )}

              {selectedBodyId === 'saturn' && (
                <button
                  onClick={() => setSaturnRingDiveMode((v) => !v)}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all ${saturnRingDiveMode
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                    : 'bg-white/5 hover:bg-white/10 border-white/15 text-amber-200'
                    }`}
                >
                  <Disc className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {saturnRingDiveMode ? 'Visão Global de Saturno' : 'Mergulhar nos Anéis 3D'}
                  </span>
                </button>
              )}

              {selectedBodyId === 'venus' && (
                <button
                  onClick={() => setVenusRadarMode((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/50 text-orange-200 text-xs font-medium transition-all"
                >
                  <Radio className="w-3.5 h-3.5 text-orange-400" />
                  <span>{venusRadarMode ? 'Ver Atmosfera' : 'Radar de Superfície'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. FULL SCIENTIFIC DOSSIER DRAWER (Opened on Demand) */}
      <div className="pointer-events-none fixed inset-x-2 sm:left-auto sm:right-4 top-14 sm:top-16 z-30 flex justify-end">
        <div className="pointer-events-auto">
          <ScientificDossierPanel
            body={selectedBody}
            isOpen={isDossierOpen}
            onClose={() => setIsDossierOpen(false)}
            onSelectBody={handleSelectBody}
            isExploringInterior={isExploringInterior}
            onToggleInterior={(val) => {
              setIsExploringInterior(val);
              if (val && !selectedInteriorLayerId) {
                setSelectedInteriorLayerId(selectedBody.interiorLayers[0]?.id || null);
              }
            }}
            selectedInteriorLayerId={selectedInteriorLayerId}
            onSelectInteriorLayer={setSelectedInteriorLayerId}
            venusRadarMode={venusRadarMode}
            onToggleVenusRadar={setVenusRadarMode}
            saturnRingDiveMode={saturnRingDiveMode}
            onToggleSaturnRingDive={setSaturnRingDiveMode}
            onOpenEarthSurfaceModal={() => setIsEarthSurfaceModalOpen(true)}
            propagatedSatellites={propagatedSatellites}
            enabledSatelliteCategories={enabledSatelliteCategories}
            onToggleSatelliteCategory={(cat) =>
              setEnabledSatelliteCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
            }
            selectedSatellite={currentSelectedSatellite}
            onSelectSatellite={setSelectedSatellite}
            tleUpdatedAtIso={tleUpdatedAtIso}
            isLiveCelesTrak={isLiveCelesTrak}
            selectedLandmark={selectedLandmark}
            onSelectLandmark={setSelectedLandmark}
            onSelectMission={(mission: SpaceMission) => {
              setActiveMissionId(mission.id);
              setShowMissionTrajectories(true);
            }}
          />
        </div>
      </div>

      {/* 6. CINEMATIC WARP SPACE TRAVEL HUD */}
      <WarpOverlayHUD warpState={warpState} onUpdateWarpState={setWarpState} />

      {/* 6B. LIGHT FIGHTER 3D COCKPIT & FLIGHT CONTROL HUD */}
      {!isMainMenuOpen && !isHudHidden && spacecraftControl.isActive && (
        <SpacecraftCockpitHUD
          controlState={spacecraftControl}
          telemetry={spacecraftTelemetry}
          onUpdateControl={setSpacecraftControl}
          onExitSpacecraft={() => switchPlayerMode('EXPLORE')}
          onEnterEVA={() => switchPlayerMode('EVA')}
          onVirtualSteerChange={setVirtualSteerInput}
          isAudioMuted={isAudioMuted}
          onToggleAudioMuted={toggleAudioMuted}
          activeShipName={activeShipPreset.name}
          activeShipAccent={activeShipPreset.accentHex}
          onDeployToStation={() => handleDeployToStation('SHIP_DOCK')}
          flightControlPrefs={flightControlPrefs}
          survival={survivalState}
          survivalNotice={survivalNotice}
          onConsumeFood={handleConsumeFood}
          onConsumeWater={handleConsumeWater}
          onConsumeWarpCell={handleConsumeWarpCell}
          onUseRepairKit={handleUseRepairKit}
          onRestInBunk={handleRestInBunk}
          onCalibrateReactor={handleCalibrateReactor}
          onToggleEcoMode={handleToggleEcoMode}
          onToggleRadiators={handleToggleRadiators}
          onAdjustPowerPip={handleAdjustPowerPip}
          onApplyPowerPreset={handleApplyPowerPreset}
          onCallRescueDrone={handleCallRescueDrone}
          onStationResupply={handleStationResupply}
          onCabinStationInteract={() =>
            handleCabinStationAction(survivalRef.current.nearbyCabinStation)
          }
        />
      )}

      {/* 6C. RIGGED ASTRONAUT EVA SPACEWALK HUD */}
      {!isMainMenuOpen && !isHudHidden && playerMode === 'EVA' && (
        <EVACharacterHUD
          visorLightOn={evaVisorLightOn}
          onToggleVisorLight={() => {
            spaceAudio.playCockpitSwitch(!evaVisorLightOn);
            setEvaVisorLightOn((v) => !v);
          }}
          onRecenterCamera={() => setEvaRecenterTrigger((n) => n + 1)}
          onTriggerRadarScan={() => {
            spaceAudio.playRadarScan();
            setEvaRadarTrigger((n) => n + 1);
          }}
          onEnterShip={() => switchPlayerMode('SPACECRAFT')}
          onExitToExplorer={() => switchPlayerMode('EXPLORE')}
          onOpenMenu={() => openMenuOnTab('crew')}
          onVirtualInputChange={setEvaVirtualInput}
          speedFormatted={spacecraftTelemetry.speedFormatted}
          nearestBodyName={spacecraftTelemetry.nearestBodyName}
          activeCharacterName={activeCharacterPreset.name}
          onWalkOnStation={() => handleDeployToStation('EVA_WALK')}
          survival={survivalState}
          survivalNotice={survivalNotice}
          onUseFood={handleConsumeFood}
          onUseWater={handleConsumeWater}
          onEmergencyO2Refill={handleEmergencyEvaO2Refill}
        />
      )}

      {/* 6D. AAA GAME COMMAND MENU, HANGAR & STATION DEPLOYMENT */}
      <GameCommandMenu
        isOpen={isCommandMenuOpen}
        initialTab={commandMenuTab}
        onClose={() => setIsCommandMenuOpen(false)}
        playerMode={playerMode}
        onSwitchMode={switchPlayerMode}
        onLaunchShipCockpit={() => launchSpacecraftSR7(true)}
        selectedShipId={selectedShipId}
        onSelectShip={(id) => {
          setSelectedShipId(id);
          saveShipVariant(id);
        }}
        selectedCharacterId={selectedCharacterId}
        onSelectCharacter={(id) => {
          setSelectedCharacterId(id);
          saveCharacterVariant(id);
        }}
        onDeployToStation={handleDeployToStation}
        selectedBody={selectedBody}
        onSelectBody={handleSelectBody}
        onOpenDossier={() => setIsDossierOpen(true)}
        onOpenMissions={() => setIsMissionsModalOpen(true)}
        onOpenEarthSurface={() => setIsEarthSurfaceModalOpen(true)}
        isExploringInterior={isExploringInterior}
        onToggleInterior={() => setIsExploringInterior((v) => !v)}
        venusRadarMode={venusRadarMode}
        onToggleVenusRadar={() => setVenusRadarMode((v) => !v)}
        saturnRingDiveMode={saturnRingDiveMode}
        onToggleSaturnRingDive={() => setSaturnRingDiveMode((v) => !v)}
        timeSpeedDaysPerSec={timeSpeedDaysPerSec}
        onChangeTimeSpeed={(spd) => {
          setTimeSpeedDaysPerSec(spd);
          setIsPaused(false);
        }}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused((p) => !p)}
        showOrbits={showOrbits}
        onToggleOrbits={setShowOrbits}
        showLabels={showLabels}
        onToggleLabels={setShowLabels}
        showAsteroidBelt={showAsteroidBelt}
        onToggleAsteroidBelt={setShowAsteroidBelt}
        showMissionTrajectories={showMissionTrajectories}
        onToggleMissionTrajectories={setShowMissionTrajectories}
        cinematicTravelEnabled={cinematicTravelEnabled}
        onToggleCinematicTravel={setCinematicTravelEnabled}
        qualityPreference={qualityPreference}
        resolvedQualityTier={resolvedQualityTier}
        onChangeQuality={handleChangeQualityPreference}
        isAudioMuted={isAudioMuted}
        onToggleAudioMuted={toggleAudioMuted}
        audioVolume={audioVolume}
        onChangeAudioVolume={(vol) => {
          setAudioVolume(vol);
          spaceAudio.setMasterVolume(vol / 100);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onReturnToLobby={handleReturnToLobby}
        flightControlPrefs={flightControlPrefs}
        onChangeFlightControlPrefs={handleChangeFlightControlPrefs}
      />

      {/* 7. LEVEL 4 EARTH SATELLITE SURFACE EXPLORER MODAL */}
      <EarthSurfaceExplorerModal
        isOpen={isEarthSurfaceModalOpen}
        onClose={() => setIsEarthSurfaceModalOpen(false)}
        simulationTimeMs={simulationTimeMs}
      />

      {/* 8. HISTORICAL & ACTIVE SPACE MISSIONS MODAL */}
      <MissionsExplorerModal
        isOpen={isMissionsModalOpen}
        onClose={() => setIsMissionsModalOpen(false)}
        activeMissionId={activeMissionId}
        onSelectMissionTrajectory={(mId) => {
          setActiveMissionId(mId);
          setShowMissionTrajectories(true);
        }}
        onFlyToBody={(bId) => handleSelectBody(bId, true)}
      />
    </div>
  );
}

export default App;
