import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Clock,
  Compass,
  Disc,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  Orbit,
  Pause,
  Play,
  Radio,
  Rocket,
  RotateCcw,
  Ruler,
  Satellite,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PropagatedSatellite,
  SatelliteCategory,
  SatelliteRecord,
  ScaleMode,
  SpacecraftControlState,
  SpacecraftTelemetry,
  SpaceMission,
  SurfaceLandmark,
  WarpFlightState,
  ZoomLevel,
} from './types/astronomy';
import {
  SpacecraftCockpitHUD,
  VirtualSteerInput,
} from './components/SpacecraftCockpitHUD';
import {
  ALL_CELESTIAL_BODIES,
  getCelestialBody,
  getScaledRadius,
} from './data/solarSystemData';
import {
  propagateSatelliteCatalog,
  refreshCatalogFromCelesTrak,
  VERIFIED_SATELLITE_CATALOG,
} from './data/satellitesData';
import { SPACE_MISSIONS } from './data/missionsData';
import { UniverseCanvas } from './components/UniverseCanvas';
import { ScientificDossierPanel } from './components/ScientificDossierPanel';
import { EarthSurfaceExplorerModal } from './components/EarthSurfaceExplorerModal';
import { MissionsExplorerModal } from './components/MissionsExplorerModal';
import { WarpOverlayHUD } from './components/WarpOverlayHUD';

const ZOOM_LEVEL_META: Record<ZoomLevel, { step: number; title: string }> = {
  SOLAR_SYSTEM: {
    step: 1,
    title: 'Nível 1 • Sistema Solar',
  },
  PLANETARY_APPROACH: {
    step: 2,
    title: 'Nível 2 • Aproximação Planetária',
  },
  ORBITAL_EXPLORATION: {
    step: 3,
    title: 'Nível 3 • Órbita & Satélites',
  },
  SURFACE_EXPLORATION: {
    step: 4,
    title: 'Nível 4 • Superfície & Relevo',
  },
  COSMIC_GALAXY: {
    step: 5,
    title: 'Nível 5 • Escala Galáctica & Cosmos',
  },
};

export type NavDockMode = 'PLANETS' | 'MOONS' | 'DWARFS' | 'ASTEROIDS_COMETS' | 'GALAXIES';

export function App() {
  // Core Navigation & Selection State
  const [selectedBodyId, setSelectedBodyId] = useState<string>('earth');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('PLANETARY_APPROACH');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('EXPLORATION');
  // Closed by default so the initial screen is clean, spacious, and cinematic!
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(false);
  const [isQuickCardOpen, setIsQuickCardOpen] = useState<boolean>(true);
  const [navDockMode, setNavDockMode] = useState<NavDockMode>('PLANETS');
  const [isLayersMenuOpen, setIsLayersMenuOpen] = useState<boolean>(false);
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

  // Search Omnibox State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
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
    cameraView: 'COCKPIT',
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

  useEffect(() => {
    refreshCatalogFromCelesTrak(VERIFIED_SATELLITE_CATALOG).then((res) => {
      setSatelliteCatalog(res.catalog);
      setIsLiveCelesTrak(res.isLiveCelesTrak);
      setTleUpdatedAtIso(res.updatedAtIso);
    });
  }, []);

  const launchSpacecraftSR7 = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setIsDossierOpen(false);
    setIsExploringInterior(false);
    setWarpState((w) => ({ ...w, isActive: false, stage: 'IDLE' }));
    setSpacecraftControl((prev) => ({
      ...prev,
      isActive: true,
      cameraView: 'COCKPIT',
      throttle: 0,
      brakeRequested: false,
      autopilotTargetId: null,
    }));
  }, []);

  const handleSyncSimulationTime = useCallback((nextTimeMs: number) => {
    setSimulationTimeMs(nextTimeMs);
  }, []);

  const earthRadiusScene = useMemo(
    () => getScaledRadius(getCelestialBody('earth'), scaleMode),
    [scaleMode]
  );

  // Note: To prevent satellites from zipping around Earth like crazy when the user fast-forwards planetary orbits,
  // we propagate satellites using real UTC time (or real-time when timeSpeedDaysPerSec == 0).
  const satellitePropagationDate = useMemo(() => {
    if (timeSpeedDaysPerSec === 0) {
      return new Date(simulationTimeMs);
    }
    return new Date();
  }, [simulationTimeMs, timeSpeedDaysPerSec]);

  const propagatedSatellites = useMemo(() => {
    return propagateSatelliteCatalog(
      satelliteCatalog,
      satellitePropagationDate,
      earthRadiusScene,
      true
    );
  }, [satelliteCatalog, satellitePropagationDate, earthRadiusScene]);

  const currentSelectedSatellite = useMemo(() => {
    if (!selectedSatellite) return null;
    return propagatedSatellites.find((s) => s.id === selectedSatellite.id) || selectedSatellite;
  }, [propagatedSatellites, selectedSatellite]);

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
      setIsQuickCardOpen(true);
      if (targetBody.category === 'galaxy') {
        setNavDockMode('GALAXIES');
        setZoomLevel('COSMIC_GALAXY');
      } else if (targetBody.category === 'moon') {
        setNavDockMode('MOONS');
        setZoomLevel('ORBITAL_EXPLORATION');
      } else if (targetBody.category === 'dwarf_planet') {
        setNavDockMode('DWARFS');
        setZoomLevel('PLANETARY_APPROACH');
      } else if (targetBody.category === 'asteroid' || targetBody.category === 'comet') {
        setNavDockMode('ASTEROIDS_COMETS');
        setZoomLevel('PLANETARY_APPROACH');
      } else {
        setNavDockMode('PLANETS');
        setZoomLevel('PLANETARY_APPROACH');
      }
    },
    [cinematicTravelEnabled, selectedBodyId]
  );

  // Search Omnibox Results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: {
      id: string;
      title: string;
      subtitle: string;
      categoryLabel: string;
      onSelect: () => void;
    }[] = [];

    ALL_CELESTIAL_BODIES.forEach((b) => {
      if (
        b.name.toLowerCase().includes(q) ||
        b.englishName.toLowerCase().includes(q) ||
        b.ClassificationLabel.toLowerCase().includes(q)
      ) {
        const catLbl =
          b.category === 'galaxy'
            ? 'Galáxia'
            : b.category === 'moon'
            ? 'Lua'
            : b.category === 'dwarf_planet'
            ? 'Planeta Anão'
            : b.category === 'asteroid'
            ? 'Asteroide'
            : b.category === 'comet'
            ? 'Cometa'
            : 'Planeta';

        results.push({
          id: `sr-body-${b.id}`,
          title: b.name,
          subtitle: b.ClassificationLabel,
          categoryLabel: catLbl,
          onSelect: () => handleSelectBody(b.id, true),
        });
      }
      b.landmarks.forEach((lm) => {
        if (lm.name.toLowerCase().includes(q) || lm.description.toLowerCase().includes(q)) {
          results.push({
            id: `sr-lm-${lm.id}`,
            title: lm.name,
            subtitle: `Formação em ${b.name}`,
            categoryLabel: 'Superfície',
            onSelect: () => {
              handleSelectBody(b.id, false);
              setSelectedLandmark(lm);
              setIsDossierOpen(true);
            },
          });
        }
      });
    });

    propagatedSatellites.forEach((sat) => {
      if (
        sat.name.toLowerCase().includes(q) ||
        String(sat.noradId).includes(q) ||
        sat.purpose.toLowerCase().includes(q)
      ) {
        results.push({
          id: `sr-sat-${sat.id}`,
          title: sat.name,
          subtitle: `NORAD #${sat.noradId} • ${Math.round(sat.altitudeKm)} km`,
          categoryLabel: 'Satélite',
          onSelect: () => {
            handleSelectBody('earth', false);
            setSelectedSatellite(sat);
          },
        });
      }
    });

    SPACE_MISSIONS.forEach((m) => {
      if (m.name.toLowerCase().includes(q) || m.primaryTargetName.toLowerCase().includes(q)) {
        results.push({
          id: `sr-mis-${m.id}`,
          title: m.name,
          subtitle: m.primaryTargetName,
          categoryLabel: 'Missão',
          onSelect: () => {
            setActiveMissionId(m.id);
            setShowMissionTrajectories(true);
            setIsMissionsModalOpen(true);
          },
        });
      }
    });

    return results.slice(0, 10);
  }, [handleSelectBody, propagatedSatellites, searchQuery]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const zoomMeta = ZOOM_LEVEL_META[zoomLevel];

  const mainNavBodies = useMemo(() => {
    switch (navDockMode) {
      case 'PLANETS':
        return ALL_CELESTIAL_BODIES.filter(
          (b) => b.category === 'star' || b.category === 'planet'
        );
      case 'MOONS':
        return ALL_CELESTIAL_BODIES.filter((b) => b.category === 'moon');
      case 'DWARFS':
        return ALL_CELESTIAL_BODIES.filter((b) => b.category === 'dwarf_planet');
      case 'ASTEROIDS_COMETS':
        return ALL_CELESTIAL_BODIES.filter(
          (b) => b.category === 'asteroid' || b.category === 'comet'
        );
      case 'GALAXIES':
        return ALL_CELESTIAL_BODIES.filter((b) => b.category === 'galaxy');
    }
  }, [navDockMode]);

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
      />

      {/* 2. STREAMLINED RESPONSIVE TOP BAR */}
      {!spacecraftControl.isActive && (
      <header className="pointer-events-none fixed top-0 inset-x-0 z-30 px-2 sm:px-4 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        {/* Left: Brand Identity + Zoom Level Pill */}
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-slate-950/85 backdrop-blur-xl border border-white/10 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-lg">
          <div className="flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-2.5 sm:border-r border-white/10">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.4)] shrink-0">
              <Orbit className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <span className="text-[11px] sm:text-xs font-display font-bold tracking-wider text-white truncate">
              UNIVERSE<span className="hidden sm:inline"> EXPLORER</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className={`w-1.5 h-1.5 rounded-full ${
                    step <= zoomMeta.step ? 'bg-sky-400' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-mono text-sky-300">{zoomMeta.title}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-white/10">
            <Ruler className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={scaleMode}
              onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
              className="bg-transparent text-slate-300 hover:text-white font-mono text-[11px] focus:outline-none cursor-pointer"
              title="Escala Visual Adaptada por padrão para facilitar a visualização"
            >
              <option value="EXPLORATION" className="bg-slate-950">
                Escala Adaptada (Exploração)
              </option>
              <option value="TRUE_SIZES" className="bg-slate-950">
                Escala: Proporção Real de Tamanhos
              </option>
              <option value="PROPORTIONAL_DISTANCES" className="bg-slate-950">
                Escala: Distâncias Reais (UA)
              </option>
              <option value="TRUE_1_TO_1" className="bg-slate-950">
                Escala Científica 1:1 Exata
              </option>
            </select>
          </div>
        </div>

        {/* Right: Search + Pilot SR-7 + Missions + Layers Popover + Fullscreen */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">

          {/* Search Omnibox */}
          <div className="relative w-24 sm:w-56">
            <div className="flex items-center bg-slate-950/85 backdrop-blur-xl border border-white/10 focus-within:border-sky-400 rounded-xl px-2 sm:px-3 py-1.5 shadow-lg">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 sm:mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
                placeholder="Buscar..."
                className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white text-xs ml-1"
                >
                  ✕
                </button>
              )}
            </div>

            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-1.5 bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-white/5">
                {searchResults.map((res) => (
                  <button
                    key={res.id}
                    onMouseDown={() => {
                      res.onSelect();
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-sky-500/20 flex items-center justify-between transition-colors"
                  >
                    <div className="truncate pr-2">
                      <div className="text-xs font-semibold text-white truncate">
                        {res.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{res.subtitle}</div>
                    </div>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-sky-300 shrink-0">
                      {res.categoryLabel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={launchSpacecraftSR7}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-600/90 to-orange-500/90 hover:from-red-500 hover:to-orange-400 border border-amber-300/60 text-xs font-bold text-white backdrop-blur-xl shadow-[0_0_20px_rgba(239,68,68,0.45)] transition-all"
            title="Entrar na Cabine 3D da Nave SR-7 Explorer e Navegar Livremente pelo Espaço"
          >
            <Rocket className="w-3.5 h-3.5 text-amber-200 shrink-0" />
            <span className="hidden sm:inline">Pilotar Nave SR-7</span>
            <span className="sm:hidden">Nave SR-7</span>
          </button>

          <button
            onClick={() => setIsMissionsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/10 hover:border-sky-400/50 text-xs font-medium text-slate-200 hover:text-white backdrop-blur-xl shadow-lg transition-all"
          >
            <Rocket className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Missões</span>
          </button>

          {/* Clean Layers & Visual Settings Popover */}
          <div className="relative">
            <button
              onClick={() => setIsLayersMenuOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium backdrop-blur-xl shadow-lg transition-all ${
                isLayersMenuOpen
                  ? 'bg-sky-500/25 border-sky-400 text-white'
                  : 'bg-slate-950/75 border-white/10 text-slate-200 hover:text-white'
              }`}
              title="Opções Visuais e Camadas"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Visualização</span>
            </button>

            {isLayersMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-3 shadow-2xl z-50 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400 pb-1 border-b border-white/10">
                  <span>Camadas do Observatório</span>
                  <button
                    onClick={() => setIsLayersMenuOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {[
                  { label: 'Linhas de Órbita 3D', val: showOrbits, set: setShowOrbits },
                  { label: 'Nomes e Marcadores', val: showLabels, set: setShowLabels },
                  {
                    label: 'Cinturões de Asteroides',
                    val: showAsteroidBelt,
                    set: setShowAsteroidBelt,
                  },
                  {
                    label: 'Trajetórias de Sondas',
                    val: showMissionTrajectories,
                    set: setShowMissionTrajectories,
                  },
                  {
                    label: 'Viagem em Dobra Espacial',
                    val: cinematicTravelEnabled,
                    set: setCinematicTravelEnabled,
                  },
                ].map((item) => (
                  <label
                    key={item.label}
                    className="flex items-center justify-between text-xs text-slate-200 py-1 px-1.5 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <span>{item.label}</span>
                    <input
                      type="checkbox"
                      checked={item.val}
                      onChange={(e) => item.set(e.target.checked)}
                      className="accent-sky-400"
                    />
                  </label>
                ))}

                <div className="pt-2 border-t border-white/10 lg:hidden">
                  <div className="text-[10px] font-mono uppercase text-amber-300 mb-1">
                    Escala do Universo
                  </div>
                  <select
                    value={scaleMode}
                    onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
                    className="w-full bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="EXPLORATION">Escala Adaptada (Exploração)</option>
                    <option value="TRUE_SIZES">Proporção Real de Tamanhos</option>
                    <option value="PROPORTIONAL_DISTANCES">Distâncias Reais (UA)</option>
                    <option value="TRUE_1_TO_1">Escala Científica 1:1 Exata</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-950/75 hover:bg-slate-900 border border-white/10 text-slate-300 hover:text-white backdrop-blur-xl shadow-lg transition-all"
            title="Tela Cheia"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>
      )}

      {/* 3. SLEEK FLOATING TELEMETRY CARD (Closeable on Smartphone & Desktop!) */}
      {!isDossierOpen && !warpState.isActive && !spacecraftControl.isActive && (
        <div className="pointer-events-none fixed left-3 right-3 sm:left-auto sm:right-4 top-16 z-20 flex flex-col items-end gap-2">
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
            </div>
          )}

          {/* Compact Selected Body / Galaxy Card (With Close Button for Smartphones!) */}
          {isQuickCardOpen ? (
            <div className="pointer-events-auto w-full sm:w-80 max-w-sm bg-slate-950/85 backdrop-blur-2xl border border-white/15 rounded-2xl p-3 sm:p-4 shadow-2xl space-y-2.5">
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
                    <h2 className="text-lg sm:text-xl font-display font-bold text-white truncate">
                      {selectedBody.name}
                    </h2>
                  </div>
                </div>

                <button
                  onClick={() => setIsQuickCardOpen(false)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-xl bg-white/10 hover:bg-rose-500/25 border border-white/15 text-slate-200 hover:text-white text-[11px] font-medium transition-colors"
                  title="Fechar card de informações"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="sm:hidden">Fechar</span>
                </button>
              </div>

              <p className="text-[11px] sm:text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {selectedBody.tagline}
              </p>

              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono bg-slate-900/80 p-2 rounded-xl border border-white/5">
                <div>
                  <div className="text-slate-400">DIÂMETRO</div>
                  <div className="text-white font-semibold mt-0.5 truncate">
                    {selectedBody.category === 'galaxy'
                      ? `${(selectedBody.meanRadiusKm * 2).toLocaleString('pt-BR')} al`
                      : `${(selectedBody.meanRadiusKm * 2).toLocaleString('pt-BR')} km`}
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

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <button
                  onClick={() => setIsDossierOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-all shadow-md"
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
                  <span>{selectedBody.category === 'galaxy' ? 'Estrutura 3D' : 'Interior 3D'}</span>
                </button>
              </div>

              {selectedBodyId === 'earth' && (
                <button
                  onClick={() => setIsEarthSurfaceModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-medium transition-all"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Explorar Superfície (Satélite Nível 4)</span>
                </button>
              )}

              {selectedBodyId === 'saturn' && (
                <button
                  onClick={() => setSaturnRingDiveMode((v) => !v)}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                    saturnRingDiveMode
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-white/5 hover:bg-white/10 border-white/15 text-amber-200'
                  }`}
                >
                  <Disc className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {saturnRingDiveMode
                      ? 'Voltar à Visão Global de Saturno'
                      : 'Mergulhar nos Anéis e Fragmentos 3D'}
                  </span>
                </button>
              )}

              {selectedBodyId === 'venus' && (
                <button
                  onClick={() => setVenusRadarMode((v) => !v)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/50 text-orange-200 text-xs font-medium transition-all"
                >
                  <Radio className="w-3.5 h-3.5 text-orange-400" />
                  <span>
                    {venusRadarMode ? 'Ver Atmosfera Densa' : 'Radar Magellan (Ver Superfície)'}
                  </span>
                </button>
              )}

              <button
                onClick={launchSpacecraftSR7}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600/85 to-orange-500/85 hover:from-red-500 hover:to-orange-400 border border-amber-300/50 text-white text-xs font-bold shadow-[0_0_16px_rgba(239,68,68,0.3)] transition-all"
              >
                <Rocket className="w-3.5 h-3.5 text-amber-200" />
                <span>Pilotar Nave SR-7 Explorer</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsQuickCardOpen(true)}
              className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950/85 hover:bg-slate-900 border border-white/15 text-xs font-medium text-white shadow-xl backdrop-blur-xl transition-all"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: selectedBody.primaryColorHex }}
              />
              <span>{selectedBody.name}</span>
              <span className="text-[10px] font-mono text-sky-400">• Abrir Info</span>
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

      {/* 5. UNIFIED, MINIMALIST BOTTOM PLANETARY DOCK & TIME CONTROLLER */}
      {!warpState.isActive && !spacecraftControl.isActive && (
        <footer className="pointer-events-none fixed bottom-3 inset-x-3 z-20 flex flex-wrap items-center justify-center gap-2">
          {/* Quick SR-7 Spacecraft Flight Mode Launcher Pill */}
          <button
            onClick={launchSpacecraftSR7}
            className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-red-600/90 to-orange-500/90 hover:from-red-500 hover:to-orange-400 border border-amber-300/60 text-xs font-bold text-white shadow-[0_0_18px_rgba(239,68,68,0.4)] backdrop-blur-xl transition-all"
            title="Entrar na Cabine 3D da Nave SR-7 Explorer e Navegar Livremente"
          >
            <Rocket className="w-3.5 h-3.5 text-amber-200" />
            <span>Pilotar Nave SR-7</span>
          </button>

          {/* Compact Time Speed Pill */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-2xl shadow-xl">
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="p-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 transition-colors"
              title={isPaused ? 'Retomar' : 'Pausar'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-1">
              {[
                { label: 'Tempo Real (1x)', val: 0 },
                { label: '1h/s', val: 0.0416 },
                { label: '1d/s', val: 1 },
                { label: '15d/s', val: 15 },
              ].map((spd) => (
                <button
                  key={spd.label}
                  onClick={() => {
                    setTimeSpeedDaysPerSec(spd.val);
                    setIsPaused(false);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${
                    !isPaused && timeSpeedDaysPerSec === spd.val
                      ? 'bg-sky-500/30 border border-sky-400/60 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Switcher (Sistema Solar vs Galáxias) + Planetary / Galactic Navigation Dock */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-xl border border-white/10 px-2.5 py-1.5 rounded-2xl shadow-xl overflow-x-auto max-w-full">
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-white/10 shrink-0 mr-1 gap-0.5">
              <button
                onClick={() => setNavDockMode('PLANETS')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  navDockMode === 'PLANETS'
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Planetas Principais do Sistema Solar"
              >
                🪐 Planetas ({ALL_CELESTIAL_BODIES.filter((b) => b.category === 'star' || b.category === 'planet').length})
              </button>
              <button
                onClick={() => setNavDockMode('MOONS')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  navDockMode === 'MOONS'
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Grandes Luas e Satélites Naturais"
              >
                🌕 Luas ({ALL_CELESTIAL_BODIES.filter((b) => b.category === 'moon').length})
              </button>
              <button
                onClick={() => setNavDockMode('DWARFS')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  navDockMode === 'DWARFS'
                    ? 'bg-cyan-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Planetas Anões e Mundos Transnetunianos do Cinturão de Kuiper"
              >
                ❄️ Anões ({ALL_CELESTIAL_BODIES.filter((b) => b.category === 'dwarf_planet').length})
              </button>
              <button
                onClick={() => setNavDockMode('ASTEROIDS_COMETS')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  navDockMode === 'ASTEROIDS_COMETS'
                    ? 'bg-emerald-400 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Asteroides Notáveis, Cometas e Visitantes Interestelares"
              >
                ☄️ Asteroides ({ALL_CELESTIAL_BODIES.filter((b) => b.category === 'asteroid' || b.category === 'comet').length})
              </button>
              <button
                onClick={() => setNavDockMode('GALAXIES')}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  navDockMode === 'GALAXIES'
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Via Láctea e Galáxias do Universo Profundo"
              >
                🌌 Galáxias ({ALL_CELESTIAL_BODIES.filter((b) => b.category === 'galaxy').length})
              </button>
            </div>

            {mainNavBodies.map((body) => {
              const isSelected =
                selectedBodyId === body.id || selectedBody.parentId === body.id;
              return (
                <button
                  key={body.id}
                  onClick={() => handleSelectBody(body.id, true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all shrink-0 border ${
                    isSelected
                      ? 'bg-sky-500/25 border-sky-400/80 text-white shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                      : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: body.primaryColorHex,
                      boxShadow: isSelected ? `0 0 8px ${body.primaryColorHex}` : undefined,
                    }}
                  />
                  <span>{body.name}</span>
                </button>
              );
            })}
          </div>
        </footer>
      )}

      {/* 6. CINEMATIC WARP SPACE TRAVEL HUD */}
      <WarpOverlayHUD warpState={warpState} onUpdateWarpState={setWarpState} />

      {/* 6B. SR-7 EXPLORER 3D COCKPIT & FLIGHT CONTROL HUD */}
      {spacecraftControl.isActive && (
        <SpacecraftCockpitHUD
          controlState={spacecraftControl}
          telemetry={spacecraftTelemetry}
          onUpdateControl={setSpacecraftControl}
          onExitSpacecraft={() => {
            setSpacecraftControl((prev) => ({
              ...prev,
              isActive: false,
              throttle: 0,
              boostActive: false,
              autopilotTargetId: null,
            }));
          }}
          onVirtualSteerChange={setVirtualSteerInput}
        />
      )}

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
