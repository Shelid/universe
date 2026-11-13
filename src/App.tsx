import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Disc,
  Globe,
  Layers,
  Menu,
  Radio,
  Rocket,
  Satellite,
  SlidersHorizontal,
  User,
  Volume2,
  VolumeX,
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
  WarpFlightState,
  ZoomLevel,
} from './types/astronomy';
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
  const [lobbyStartDestination, setLobbyStartDestination] =
    useState<LobbyStartDestination>('EXPLORE');
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
  const [cinematicTravelEnabled, setCinematicTravelEnabled] = useState<boolean>(true);

  // Time & Ephemeris Simulation State — Defaults to REAL-TIME (0 = 1s per 1s) so Earth & Satellites move calmly!
  const [simulationTimeMs, setSimulationTimeMs] = useState<number>(() => Date.now());
  const [timeSpeedDaysPerSec, setTimeSpeedDaysPerSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Visual Layer Toggles
  const [showOrbits, setShowOrbits] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
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
  });

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
      }));
    },
    [launchSpacecraftSR7, spacecraftControl.isActive]
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
        }));
        setEvaActive(true);
      } else {
        spaceAudio.playSelectBody('planet');
        setEvaActive(false);
        setSpacecraftControl((prev) => ({ ...prev, isActive: false, throttle: 0 }));
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
    }));
    setWarpState((w) => ({ ...w, isActive: false, stage: 'IDLE' }));
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
      setSelectedInteriorLayerId(targetBody.interiorLayers[0]?.id || null);

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
      setIsQuickCardOpen(true);
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
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const solarMainStrip = useMemo(
    () =>
      ALL_CELESTIAL_BODIES.filter(
        (b) => b.category === 'star' || b.category === 'planet'
      ),
    []
  );

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
        qualityPreference={qualityPreference}
        onResolvedQualityChange={setResolvedQualityTier}
        onBootProgress={setBootProgress}
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

      {/* 1C. PRE-GAME HANGAR / ORBITAL LOBBY SHOWCASING 3D SHIP & ASTRONAUT */}
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
          qualityPreference={qualityPreference}
          resolvedQualityTier={resolvedQualityTier}
          onChangeQuality={handleChangeQualityPreference}
          isAudioMuted={isAudioMuted}
          onToggleAudioMuted={toggleAudioMuted}
          onStartGame={handleStartFromLobby}
        />
      )}

      {/* 2. AAA GAME TOP HUD BAR */}
      {!isMainMenuOpen && (
      <header className="pointer-events-none fixed top-0 inset-x-0 z-30 px-2.5 sm:px-4 py-2 flex items-center justify-between gap-2">
        {/* Left: Compact Brand + Selected Body Focus + Estação Orbital Quick Deploy */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={() => openMenuOnTab('travel')}
            className="flex items-center gap-2 bg-slate-950/82 hover:bg-slate-900/95 backdrop-blur-xl border border-white/15 px-2.5 sm:px-3 py-1.5 rounded-full shadow-lg transition-colors"
            title="Mapa Estelar e Planetas (M)"
          >
            <UniverseLogo
              size="sm"
              animated={false}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-md shadow-[0_0_12px_rgba(56,189,248,0.35)]"
            />
            <span className="hidden lg:inline text-[11px] font-display font-bold tracking-wider text-white">
              COSMOS
            </span>
            <span className="hidden lg:inline text-slate-600">·</span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: selectedBody.primaryColorHex,
                boxShadow: `0 0 8px ${selectedBody.primaryColorHex}`,
              }}
            />
            <span className="text-[11px] font-medium text-sky-200 max-w-[85px] sm:max-w-[130px] truncate">
              {selectedBody.name}
            </span>
          </button>

          <button
            onClick={() => handleDeployToStation('ORBIT_INSPECT')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-cyan-500/18 hover:bg-cyan-500/32 border border-cyan-400/45 text-[11px] font-semibold text-cyan-100 backdrop-blur-xl shadow-lg transition-all"
            title="Ir para a Estação Espacial em Órbita da Terra (Inspecionar, Aproximar ou Caminhar em EVA)"
          >
            <Satellite className="w-3.5 h-3.5 text-cyan-300" />
            <span>Estação Orbital</span>
          </button>

          <button
            onClick={() => openMenuOnTab('hangar')}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-950/82 hover:bg-slate-900 border border-white/12 text-[11px] text-slate-200 backdrop-blur-xl shadow-lg transition-all"
            title="Hangar de Naves e Personagem"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: activeShipPreset.accentHex }}
            />
            <span className="font-mono text-slate-200">{activeShipPreset.name}</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-cyan-300">{activeCharacterPreset.callsign}</span>
          </button>
        </div>

        {/* Center: Clean 3-Mode Player Switcher (Observatório | Nave | Astronauta) */}
        <div className="pointer-events-auto flex items-center bg-slate-950/85 backdrop-blur-xl border border-white/15 p-1 rounded-full shadow-lg gap-0.5">
          {[
            { id: 'EXPLORE' as const, label: 'Explorar', icon: Globe },
            { id: 'SPACECRAFT' as const, label: 'Nave', icon: Rocket },
            { id: 'EVA' as const, label: 'Astronauta', icon: User },
          ].map((m) => {
            const Icon = m.icon;
            const active = playerMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => switchPlayerMode(m.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  active
                    ? m.id === 'SPACECRAFT'
                      ? 'bg-amber-500 text-slate-950 shadow-[0_0_14px_rgba(245,158,11,0.45)]'
                      : m.id === 'EVA'
                        ? 'bg-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(34,211,238,0.45)]'
                        : 'bg-sky-500 text-slate-950 shadow-[0_0_14px_rgba(56,189,248,0.4)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className={active ? 'inline' : 'hidden sm:inline'}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Quality 4K Badge + Audio Mute + Hangar/Game Menu */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={() => openMenuOnTab('graphics')}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/28 border border-emerald-400/40 text-[10px] font-mono font-bold text-emerald-200 backdrop-blur-xl transition-all"
            title="Configurar Qualidade Gráfica 4K"
          >
            <span>
              {resolvedQualityTier === 'high'
                ? '4K ALTA'
                : resolvedQualityTier === 'medium'
                  ? 'MÉDIA'
                  : 'LEVE'}
            </span>
          </button>

          <button
            onClick={toggleAudioMuted}
            className={`p-2 rounded-full border backdrop-blur-xl shadow-lg transition-all ${
              isAudioMuted
                ? 'bg-slate-950/78 border-white/12 text-slate-400 hover:text-white'
                : 'bg-emerald-500/18 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30'
            }`}
            title={isAudioMuted ? 'Ativar Áudio' : 'Silenciar Áudio'}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => openMenuOnTab('hangar')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-xs font-semibold text-white backdrop-blur-xl shadow-[0_0_16px_rgba(56,189,248,0.22)] transition-all"
            title="Abrir Menu de Jogo, Hangar & Personagens (M)"
          >
            <Menu className="w-3.5 h-3.5 text-sky-300" />
            <span>Menu</span>
          </button>
        </div>
      </header>
      )}

      {/* 3. SLEEK FLOATING BODY SUMMARY (Explorer Mode Only, Collapsed by Default) */}
      {!isMainMenuOpen && !isDossierOpen && !warpState.isActive && playerMode === 'EXPLORE' && (
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
                  >
                    Caminhar (EVA)
                  </button>
                  <button
                    onClick={() => handleDeployToStation('SHIP_DOCK')}
                    className="py-1.5 px-2.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-100 font-semibold text-[11px] transition-colors"
                  >
                    Aproximar Nave
                  </button>
                </div>
              )}
            </div>
          )}

          {isQuickCardOpen ? (
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
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                    isExploringInterior
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
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                    saturnRingDiveMode
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
          ) : (
            <button
              onClick={() => setIsQuickCardOpen(true)}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/75 hover:bg-slate-900 border border-white/12 text-[11px] font-medium text-slate-200 shadow-lg backdrop-blur-xl transition-all"
            >
              <BookOpen className="w-3 h-3 text-sky-400" />
              <span>Dados de {selectedBody.name}</span>
            </button>
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

      {/* 5. MINIMALIST BOTTOM PLANETARY QUICK-STRIP (Explorer Mode Only) */}
      {!isMainMenuOpen && !warpState.isActive && playerMode === 'EXPLORE' && (
        <footer className="pointer-events-none fixed bottom-3 inset-x-3 z-20 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-1 bg-slate-950/75 backdrop-blur-xl border border-white/12 px-2 py-1 rounded-full shadow-xl overflow-x-auto max-w-full">
            {solarMainStrip.map((body) => {
              const isSelected =
                selectedBodyId === body.id || selectedBody.parentId === body.id;
              return (
                <button
                  key={body.id}
                  onClick={() => handleSelectBody(body.id, true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ${
                    isSelected
                      ? 'bg-sky-500/25 border border-sky-400/70 text-white'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: body.primaryColorHex }}
                  />
                  <span>{body.name}</span>
                </button>
              );
            })}

            <button
              onClick={() => openMenuOnTab('station')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/18 hover:bg-cyan-500/32 border border-cyan-400/45 text-[11px] text-cyan-200 font-semibold shrink-0 ml-1"
              title="Estação Espacial em Órbita da Terra"
            >
              <Satellite className="w-3 h-3 text-cyan-300" />
              <span className="hidden sm:inline">Estação Orbital</span>
            </button>

            <button
              onClick={() => openMenuOnTab('hangar')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 hover:bg-sky-500/20 border border-white/10 text-[11px] text-sky-300 font-medium shrink-0"
              title="Abrir Menu, Hangar de Naves e Personagens"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">Hangar</span>
            </button>
          </div>
        </footer>
      )}

      {/* 6. CINEMATIC WARP SPACE TRAVEL HUD */}
      <WarpOverlayHUD warpState={warpState} onUpdateWarpState={setWarpState} />

      {/* 6B. LIGHT FIGHTER 3D COCKPIT & FLIGHT CONTROL HUD */}
      {!isMainMenuOpen && spacecraftControl.isActive && (
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
        />
      )}

      {/* 6C. RIGGED ASTRONAUT EVA SPACEWALK HUD */}
      {!isMainMenuOpen && playerMode === 'EVA' && (
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
