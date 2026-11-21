import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  Backpack,
  BatteryCharging,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Compass,
  Crosshair,
  Droplets,
  Eye,
  Flame,
  FlaskConical,
  Gauge,
  Heart,
  Lightbulb,
  LogOut,
  Navigation,
  Orbit,
  Package,
  Pickaxe,
  Radar,
  Radiation,
  Rocket,
  RotateCcw,
  RotateCw,
  Search,
  Shield,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Thermometer,
  Trash2,
  User,
  Utensils,
  Volume2,
  VolumeX,
  Wind,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { ALL_CELESTIAL_BODIES } from '../data/solarSystemData';
import {
  CRAFTING_RECIPES,
  ENERGY_MINERAL_YIELDS,
  getBodyMiningProfile,
  MINING_RESOURCE_LIST,
  MINING_RESOURCES,
} from '../data/miningCatalog';
import { RECIPE_IMAGE_PATHS, RESOURCE_IMAGE_PATHS } from '../data/itemArtwork';
import {
  MiningRecipeId,
  MiningResourceId,
  PowerSubsystemId,
  SpacecraftControlState,
  SpacecraftTelemetry,
  SurvivalResourcesState,
} from '../types/astronomy';
import { DEFAULT_FLIGHT_CONTROL_PREFS, FlightControlPrefs } from '../utils/flightControlPrefs';
import { spaceAudio } from '../utils/spaceAudioEngine';
import {
  CABIN_STATIONS,
  getTotalCargoUnits,
  POWER_PIP_TOTAL,
  POWER_PRESETS,
} from '../utils/survivalEngine';

export interface VirtualSteerInput {
  pitch: number; // -1..1
  yaw: number;   // -1..1
  roll: number;  // -1..1
  forward: number; // -1..1
}

interface SpacecraftCockpitHUDProps {
  controlState: SpacecraftControlState;
  telemetry: SpacecraftTelemetry;
  onUpdateControl: React.Dispatch<React.SetStateAction<SpacecraftControlState>>;
  onExitSpacecraft: () => void;
  onEnterEVA?: () => void;
  onVirtualSteerChange: (input: VirtualSteerInput) => void;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
  activeShipName?: string;
  activeShipAccent?: string;
  onDeployToStation?: () => void;
  flightControlPrefs?: FlightControlPrefs;
  survival: SurvivalResourcesState;
  survivalNotice?: string | null;
  onConsumeFood: () => void;
  onConsumeWater: () => void;
  onConsumeWarpCell: () => void;
  onUseRepairKit: () => void;
  onRestInBunk: () => void;
  onCalibrateReactor: () => void;
  onToggleEcoMode: () => void;
  onToggleRadiators: () => void;
  onAdjustPowerPip: (subsystem: PowerSubsystemId, delta: 1 | -1) => void;
  onApplyPowerPreset: (presetKey: keyof typeof POWER_PRESETS) => void;
  onCallRescueDrone: () => void;
  onStationResupply: () => void;
  onCabinStationInteract: () => void;
  onToggleMiningLaser: () => void;
  onSynthesizeRecipe: (recipeId: MiningRecipeId) => void;
  onConsumeMineralForEnergy?: (resourceId: MiningResourceId) => void;
  onSellCargo: (resourceId: MiningResourceId, units?: number) => void;
  onSellAllCargo: () => void;
  onDiscardCargo: (resourceId: MiningResourceId) => void;
  onOpenBackpack?: () => void;
}

type ShipMenuTab = 'systems' | 'survival' | 'mining' | 'navigation' | 'controls';

export const SpacecraftCockpitHUD: React.FC<SpacecraftCockpitHUDProps> = ({
  controlState,
  telemetry,
  onUpdateControl,
  onExitSpacecraft,
  onEnterEVA,
  onVirtualSteerChange,
  isAudioMuted,
  onToggleAudioMuted,
  activeShipName = 'CAÇA ESTELAR',
  activeShipAccent = '#38bdf8',
  onDeployToStation,
  flightControlPrefs = DEFAULT_FLIGHT_CONTROL_PREFS,
  survival,
  survivalNotice,
  onConsumeFood,
  onConsumeWater,
  onConsumeWarpCell,
  onUseRepairKit,
  onRestInBunk,
  onCalibrateReactor,
  onToggleEcoMode,
  onToggleRadiators,
  onAdjustPowerPip,
  onApplyPowerPreset,
  onCallRescueDrone,
  onStationResupply,
  onCabinStationInteract,
  onToggleMiningLaser,
  onSynthesizeRecipe,
  onConsumeMineralForEnergy,
  onSellCargo,
  onSellAllCargo,
  onDiscardCargo,
  onOpenBackpack,
}) => {
  const [isShipMenuOpen, setIsShipMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ShipMenuTab>('systems');
  const [miningCatalogQuery, setMiningCatalogQuery] = useState('');
  const [showTouchPad, setShowTouchPad] = useState(false);
  const [audioVol, setAudioVol] = useState(() => Math.round(spaceAudio.getMasterVolume() * 100));

  // Discreet Mined Item Pickup Toast Feed (shows each extracted mineral with artwork, name & formula)
  const [minedToasts, setMinedToasts] = useState<
    Array<{
      uid: number;
      resourceId: MiningResourceId;
      addedQty: number;
      totalOwned: number;
    }>
  >([]);
  const prevCargoRef = useRef<Partial<Record<MiningResourceId, number>>>({
    ...survival.cargoInventory,
  });
  const toastUidRef = useRef(1);

  useEffect(() => {
    const prev = prevCargoRef.current;
    const curr = survival.cargoInventory;
    const newlyAdded: Array<{
      uid: number;
      resourceId: MiningResourceId;
      addedQty: number;
      totalOwned: number;
    }> = [];

    for (const res of MINING_RESOURCE_LIST) {
      const prevQty = prev[res.id] ?? 0;
      const currQty = curr[res.id] ?? 0;
      if (currQty > prevQty) {
        const uid = toastUidRef.current++;
        newlyAdded.push({
          uid,
          resourceId: res.id,
          addedQty: currQty - prevQty,
          totalOwned: currQty,
        });
      }
    }
    prevCargoRef.current = { ...curr };

    if (newlyAdded.length > 0) {
      setMinedToasts((old) => {
        const next = [...old];
        for (const item of newlyAdded) {
          const last = next[next.length - 1];
          if (last && last.resourceId === item.resourceId) {
            next[next.length - 1] = {
              ...last,
              uid: item.uid,
              addedQty: last.addedQty + item.addedQty,
              totalOwned: item.totalOwned,
            };
          } else {
            next.push(item);
          }
        }
        return next.slice(-2);
      });
      const idsToRemove = new Set(newlyAdded.map((item) => item.uid));
      const timer = window.setTimeout(() => {
        setMinedToasts((old) => old.filter((item) => !idsToRemove.has(item.uid)));
      }, 2400);
      return () => window.clearTimeout(timer);
    }
  }, [survival.cargoInventory]);

  const steerRef = useRef<VirtualSteerInput>({
    pitch: 0,
    yaw: 0,
    roll: 0,
    forward: 0,
  });

  const autopilotTargets = useMemo(
    () =>
      ALL_CELESTIAL_BODIES.filter(
        (b) =>
          b.category === 'star' ||
          b.category === 'planet' ||
          b.category === 'dwarf_planet' ||
          b.id === 'moon' ||
          b.id === 'milky-way' ||
          b.id === 'andromeda'
      ),
    []
  );

  const setVirtualAxis = (key: keyof VirtualSteerInput, value: number) => {
    steerRef.current = { ...steerRef.current, [key]: value };
    onVirtualSteerChange({ ...steerRef.current });
  };

  const holdButtonProps = (key: keyof VirtualSteerInput, value: number) => ({
    onMouseDown: () => setVirtualAxis(key, value),
    onMouseUp: () => setVirtualAxis(key, 0),
    onMouseLeave: () => {
      if (steerRef.current[key] === value) setVirtualAxis(key, 0);
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      setVirtualAxis(key, value);
    },
    onTouchEnd: () => setVirtualAxis(key, 0),
  });

  if (!controlState.isActive) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between select-none">
      {/* MINIMAL SHIP PILL BAR: ULTRA-CLEAN CAMERA, CABIN WALK & SHIP MENU */}
      <div className="px-3 pt-2.5 sm:px-4 sm:pt-3 pr-24 sm:pr-32 flex flex-col items-start gap-1">
        <div className="menu-glass-surface pointer-events-auto flex flex-wrap items-center gap-1 border rounded-full px-2 py-1 shadow-md">
          <span
            className="w-2 h-2 rounded-full ml-1 mr-0.5"
            style={{ backgroundColor: activeShipAccent }}
          />

          <button
            onClick={() =>
              onUpdateControl((prev) => ({
                ...prev,
                cameraView: prev.cameraView === 'EXTERNAL' ? 'COCKPIT' : 'EXTERNAL',
              }))
            }
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 hover:bg-white border border-slate-300/80 text-slate-900 text-[11px] font-medium transition-colors"
            title={
              controlState.walkingInside
                ? 'Alternar Visão 1ª / 3ª Pessoa dentro da Cabine (Tecla V)'
                : 'Alternar Câmera 3ª Pessoa / Cabine 1ª Pessoa (Tecla V)'
            }
          >
            {controlState.cameraView === 'EXTERNAL' ? (
              <>
                <Camera className="w-3 h-3 text-sky-700" />
                <span>{controlState.walkingInside ? '1ª Pessoa' : 'Cabine'}</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3 text-sky-700" />
                <span>3ª Pessoa</span>
              </>
            )}
          </button>

          <button
            onClick={() =>
              onUpdateControl((prev) => {
                const nextWalk = !prev.walkingInside;
                spaceAudio.playCockpitSwitch(nextWalk);
                return {
                  ...prev,
                  walkingInside: nextWalk,
                  throttle: 0,
                  boostActive: false,
                  autopilotTargetId: null,
                  brakeRequested: nextWalk ? true : false,
                  cameraView: nextWalk ? 'EXTERNAL' : prev.cameraView,
                };
              })
            }
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 hover:bg-white border border-slate-300/80 text-slate-900 text-[11px] font-medium transition-colors"
            title={
              controlState.walkingInside
                ? 'Voltar ao Assento de Comando da Nave (Tecla G)'
                : 'Levantar e Andar Livremente dentro da Nave com Colisão Física (Tecla G)'
            }
          >
            <User className="w-3 h-3 text-amber-700" />
            <span>{controlState.walkingInside ? 'Sentar' : 'Andar na Nave'}</span>
          </button>

          {!controlState.walkingInside && (
            <button
              onClick={() => setIsShipMenuOpen((open) => !open)}
              className="relative flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 hover:bg-white border border-slate-300 text-slate-900 text-[11px] font-semibold transition-all"
              title="Abrir Menu Completo da Nave (Telemetria, Radar, Piloto Automático e Sistemas)"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-700" />
              <span>Menu da Nave</span>
              {(controlState.autopilotTargetId || survival.activeStatusAlert) && (
                <span
                  className={`w-2 h-2 rounded-full animate-ping ${survival.activeStatusAlert ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                />
              )}
            </button>
          )}
        </div>

        {/* Active Harvest / Alert / Action Toast Banner */}
        <div className="flex flex-wrap items-center justify-start gap-1.5">
          {survival.nearRefuelSource !== 'NONE' && (
            <div className="pointer-events-auto flex items-center gap-1.5 bg-emerald-950/88 backdrop-blur-xl border border-emerald-400/50 rounded-full px-3 py-1 text-[10px] font-mono text-emerald-100 shadow-lg">
              {survival.nearRefuelSource === 'SOLAR_CORONA' ? (
                <Sun className="w-3 h-3 text-amber-300 animate-spin" />
              ) : (
                <BatteryCharging className="w-3 h-3 text-emerald-300 animate-pulse" />
              )}
              <span>
                {survival.nearRefuelSource === 'GAS_GIANT_SCOOP'
                  ? 'SCOOP ATMOSFÉRICO ATIVO (+Combustível)'
                  : survival.nearRefuelSource === 'SOLAR_CORONA'
                    ? 'COLETA COROA SOLAR ATIVA (+Energia / +Dobra)'
                    : survival.nearRefuelSource === 'ORBITAL_STATION'
                      ? 'DOCA ORBITAL (+Comb / +O₂ / +Provisões)'
                      : 'SOLAR / HANGAR RECARREGANDO'}
              </span>
            </div>
          )}

          {(survivalNotice || survival.activeStatusAlert) && (
            <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-xl border border-amber-400/50 rounded-full px-3 py-1 text-[10px] font-mono text-amber-100 shadow-lg">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{survivalNotice || survival.activeStatusAlert}</span>
            </div>
          )}

          {/* Clean Live Orbital Mining Laser Micro Pill (shown ONLY while actively drilling so screen stays ultra-clean) */}
          {survival.mining.isDrilling && (
            <button
              onClick={() => {
                setActiveTab('mining');
                setIsShipMenuOpen(true);
              }}
              className="menu-glass-surface pointer-events-auto flex items-center gap-2 border rounded-full px-3 py-1 text-[10px] font-mono shadow-md transition-colors"
              title="Abrir Painel de Mineração & Síntese Química"
            >
              <Pickaxe
                className={`w-3 h-3 shrink-0 ${survival.mining.isDrilling ? 'text-cyan-300 animate-pulse' : 'text-sky-300'
                  }`}
              />
              {survival.mining.isDrilling && survival.mining.activeResourceId ? (
                <>
                  <span className="font-bold text-white">
                    {MINING_RESOURCES[survival.mining.activeResourceId].name}
                  </span>
                  {survival.mining.hotspotMultiplier > 1.05 && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/30 border border-amber-400/60 text-amber-200 font-bold">
                      VEIO {survival.mining.hotspotMultiplier.toFixed(1)}×
                    </span>
                  )}
                  <span className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <span
                      className="block h-full bg-cyan-400 transition-all duration-150"
                      style={{
                        width: `${Math.round(survival.mining.extractionProgress01 * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="text-slate-300">
                    Porão {getTotalCargoUnits(survival.cargoInventory)}/{survival.cargoCapacityUnits}
                  </span>
                </>
              ) : (
                <span>
                  Órbita {survival.mining.targetBodyName ?? 'Astro'} · Pressione [X] Extrator · Porão{' '}
                  {getTotalCargoUnits(survival.cargoInventory)}/{survival.cargoCapacityUnits}
                </span>
              )}
            </button>
          )}

          {/* Active Autopilot Micro Indicator (Only visible while navigating automatically) */}
          {controlState.autopilotTargetId && (
            <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/80 backdrop-blur-xl border border-amber-400/40 rounded-full px-3 py-1 text-[11px] font-mono text-amber-200 shadow-lg">
              <Navigation className="w-3 h-3 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">{telemetry.autopilotStatus}</span>
              <button
                onClick={() =>
                  onUpdateControl((prev) => ({
                    ...prev,
                    autopilotTargetId: null,
                  }))
                }
                className="text-amber-300 hover:text-white underline ml-1"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DEDICATED SHIP INFORMATION & SYSTEMS MENU DRAWER */}
      {isShipMenuOpen && (
        <div className="menu-glass-surface pointer-events-auto fixed right-3 top-14 sm:top-16 bottom-16 w-[calc(100%-1.5rem)] sm:w-[410px] z-40 border border-sky-300/40 rounded-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="menu-glass-header px-4 py-3 border-b border-sky-200/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-sky-300" />
              <div>
                <h2 className="text-xs font-bold tracking-wider text-white font-mono uppercase">
                  CENTRAL — {activeShipName}
                </h2>
                <p className="text-[10px] text-slate-200">
                  Sistemas, Sobrevivência, Mineração & Química, Radar
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsShipMenuOpen(false)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors"
              title="Fechar Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Menu Tabs */}
          <div className="menu-glass-subbar grid grid-cols-5 border-b border-sky-200/15 text-[10px] font-mono">
            {[
              { id: 'systems' as const, label: 'Sistemas' },
              { id: 'survival' as const, label: 'Sobrev.' },
              { id: 'mining' as const, label: 'Mineração' },
              { id: 'navigation' as const, label: 'Radar' },
              { id: 'controls' as const, label: 'Controles' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-2.5 text-center transition-colors border-b-2 ${activeTab === tab.id
                  ? 'border-sky-400 text-sky-200 bg-sky-500/10 font-bold'
                  : 'border-transparent text-slate-400 hover:text-white'
                  }`}
              >
                <span>{tab.label}</span>
                {tab.id === 'survival' && survival.activeStatusAlert && (
                  <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                )}
                {tab.id === 'mining' && survival.mining.isDrilling && (
                  <span className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                )}
              </button>
            ))}
          </div>

          {/* Menu Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
            {activeTab === 'survival' && (
              <div className="space-y-3">
                {/* 1. Fuel, Warp & Resupply */}
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-amber-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Flame className="w-3.5 h-3.5" />
                      PROPULSÃO, DOBRA & ENERGIA
                    </span>
                    <span className="text-slate-400">
                      Solar +{survival.solarHarvestKw.toFixed(0)} kW
                    </span>
                  </div>

                  {[
                    {
                      label: 'Combustível Principal',
                      val: survival.fuelPercent,
                      color:
                        survival.fuelPercent < 15
                          ? 'bg-rose-500'
                          : survival.fuelPercent < 35
                            ? 'bg-amber-400'
                            : 'bg-emerald-400',
                    },
                    {
                      label: 'Energia do Núcleo de Dobra',
                      val: survival.warpEnergyPercent,
                      color: survival.warpEnergyPercent < 15 ? 'bg-rose-500' : 'bg-cyan-400',
                    },
                    {
                      label: 'Energia da Nave (Bateria & Sol)',
                      val: survival.batteryPercent,
                      color: 'bg-sky-400',
                    },
                  ].map((bar) => (
                    <div key={bar.label} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-slate-300">{bar.label}</span>
                        <span className="text-white font-bold">{Math.round(bar.val)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${bar.color}`}
                          style={{ width: `${Math.max(0, Math.min(100, bar.val))}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Photovoltaic Solar Proximity Recharge Telemetry */}
                  <div className="rounded-lg bg-slate-950/75 border border-amber-400/35 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5" />
                      <span>Recarga Solar: {Math.round(survival.solarHarvestKw)} kW</span>
                    </span>
                    <span className="text-emerald-300 font-bold">
                      {survival.inPlanetaryShadow
                        ? 'Sombra Planetária (0%/s)'
                        : `+${(Math.pow(survival.solarHarvestKw / 95, 1.12) * 2.15).toFixed(1)}%/s`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] font-mono">
                    <button
                      onClick={onToggleEcoMode}
                      className={`py-1.5 px-2 rounded-lg border transition-colors ${survival.ecoCruiseMode
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      ECO Cruise (Y): {survival.ecoCruiseMode ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={onConsumeWarpCell}
                      disabled={survival.warpCells <= 0}
                      className="py-1.5 px-2 rounded-lg border bg-cyan-500/20 hover:bg-cyan-500/35 disabled:opacity-40 border-cyan-400/45 text-cyan-100 transition-colors"
                    >
                      Célula Dobra ({survival.warpCells})
                    </button>
                    {survival.nearRefuelSource === 'ORBITAL_STATION' && (
                      <button
                        onClick={onStationResupply}
                        className="col-span-2 py-1.5 px-2 rounded-lg border bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-400/60 text-emerald-100 font-bold transition-colors"
                      >
                        Reabastecer Completo na Doca Orbital
                      </button>
                    )}
                    <button
                      onClick={onCallRescueDrone}
                      className={`col-span-2 py-1.5 px-2 rounded-lg border transition-colors ${survival.fuelPercent < 18 || survival.warpEnergyPercent < 12
                        ? 'bg-amber-500/30 hover:bg-amber-500/45 border-amber-400 text-amber-100 font-bold animate-pulse'
                        : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-300'
                        }`}
                    >
                      Chamar Drone de Socorro (Combustível & Célula)
                    </button>
                  </div>
                </div>

                {/* 2. Thermal, Shadow & Radiation */}
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-rose-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Thermometer className="w-3.5 h-3.5" />
                      TÉRMICA, SOMBRA 3D & RADIAÇÃO
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded ${survival.inPlanetaryShadow
                        ? 'bg-indigo-500/30 text-indigo-200'
                        : 'bg-amber-500/20 text-amber-200'
                        }`}
                    >
                      {survival.inPlanetaryShadow ? 'EM SOMBRA' : 'LUZ SOLAR'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono text-center">
                    <div className="bg-slate-950/70 rounded-lg p-1.5 border border-white/5">
                      <div className="text-slate-400">CASCO</div>
                      <div
                        className={`font-bold mt-0.5 ${survival.hullTempC > 650 ? 'text-rose-400' : 'text-sky-200'
                          }`}
                      >
                        {Math.round(survival.hullTempC)}°C
                      </div>
                    </div>
                    <div className="bg-slate-950/70 rounded-lg p-1.5 border border-white/5">
                      <div className="text-slate-400">REATOR</div>
                      <div className="font-bold text-amber-200 mt-0.5">
                        {Math.round(survival.reactorTempC)}°C
                      </div>
                    </div>
                    <div className="bg-slate-950/70 rounded-lg p-1.5 border border-white/5">
                      <div className="text-slate-400 flex items-center justify-center gap-0.5">
                        <Radiation className="w-2.5 h-2.5" />
                        <span>RAD</span>
                      </div>
                      <div
                        className={`font-bold mt-0.5 ${survival.radiationPercent > 65 ? 'text-rose-400' : 'text-emerald-300'
                          }`}
                      >
                        {Math.round(survival.radiationPercent)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <button
                      onClick={onToggleRadiators}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border transition-colors ${survival.radiatorsDeployed
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <Snowflake className="w-3 h-3" />
                      <span>Radiadores (K): {survival.radiatorsDeployed ? 'ON' : 'OFF'}</span>
                    </button>
                    <button
                      onClick={onCalibrateReactor}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border bg-indigo-500/20 hover:bg-indigo-500/35 border-indigo-400/45 text-indigo-100 transition-colors"
                    >
                      <Wind className="w-3 h-3" />
                      <span>Purificar O₂ / Filtros</span>
                    </button>
                  </div>
                </div>

                {/* 3. Oxygen, Hull & Pilot Vitals */}
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Heart className="w-3.5 h-3.5" />
                      SUPORTE DE VIDA & PILOTO
                    </span>
                    <span className="text-slate-400">Casco {Math.round(survival.hullIntegrity)}%</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    {[
                      { label: 'O₂ Cabine', val: survival.shipOxygenPercent, col: 'bg-cyan-400' },
                      { label: 'O₂ Traje EVA', val: survival.evaOxygenPercent, col: 'bg-sky-400' },
                      { label: 'Saciedade (Fome)', val: survival.hungerPercent, col: 'bg-emerald-400' },
                      { label: 'Hidratação (Sede)', val: survival.thirstPercent, col: 'bg-blue-400' },
                      { label: 'Energia / Descanso', val: survival.fatiguePercent, col: 'bg-amber-400' },
                      { label: 'Integridade Casco', val: survival.hullIntegrity, col: 'bg-teal-400' },
                    ].map((v) => (
                      <div key={v.label} className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-slate-300 truncate">{v.label}</span>
                          <span className="text-white font-bold">{Math.round(v.val)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${v.val < 20 ? 'bg-rose-500' : v.col
                              }`}
                            style={{ width: `${Math.max(0, Math.min(100, v.val))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5 text-[10px] font-mono">
                    <button
                      onClick={onConsumeFood}
                      disabled={survival.foodRations <= 0}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-40 border-emerald-400/45 text-emerald-100 transition-colors"
                    >
                      <Utensils className="w-3 h-3" />
                      <span>Ração ({survival.foodRations})</span>
                    </button>
                    <button
                      onClick={onConsumeWater}
                      disabled={survival.waterFlasks <= 0}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border bg-sky-500/20 hover:bg-sky-500/35 disabled:opacity-40 border-sky-400/45 text-sky-100 transition-colors"
                    >
                      <Droplets className="w-3 h-3" />
                      <span>Água ({survival.waterFlasks})</span>
                    </button>
                    <button
                      onClick={onRestInBunk}
                      className="py-1.5 px-2 rounded-lg border bg-amber-500/20 hover:bg-amber-500/35 border-amber-400/45 text-amber-100 transition-colors"
                    >
                      Descansar (Beliche)
                    </button>
                    <button
                      onClick={onUseRepairKit}
                      disabled={survival.repairKits <= 0}
                      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border bg-white/10 hover:bg-white/20 disabled:opacity-40 border-white/20 text-white transition-colors"
                    >
                      <Wrench className="w-3 h-3" />
                      <span>Reparo ({survival.repairKits})</span>
                    </button>
                  </div>
                </div>

                {/* 4. 8-Pip Power Distribution */}
                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-sky-300">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Zap className="w-3.5 h-3.5" />
                      DISTRIBUIÇÃO DE ENERGIA
                    </span>
                    <span>
                      {survival.powerPips.engines +
                        survival.powerPips.shields +
                        survival.powerPips.weapons +
                        survival.powerPips.lifeSupport}
                      /{POWER_PIP_TOTAL} PIPs
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
                    {(Object.keys(POWER_PRESETS) as Array<keyof typeof POWER_PRESETS>).map((key) => (
                      <button
                        key={key}
                        onClick={() => onApplyPowerPreset(key)}
                        className="py-1 px-1 rounded bg-white/5 hover:bg-sky-500/25 border border-white/10 text-slate-200 truncate transition-colors"
                      >
                        {POWER_PRESETS[key].label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {(
                      [
                        { id: 'engines', label: 'Motores', color: 'bg-amber-400' },
                        { id: 'shields', label: 'Escudos', color: 'bg-indigo-400' },
                        { id: 'weapons', label: 'Armas / Laser', color: 'bg-rose-400' },
                        { id: 'lifeSupport', label: 'Sup. Vida / O₂', color: 'bg-emerald-400' },
                      ] as const
                    ).map((sub) => {
                      const val = survival.powerPips[sub.id];
                      return (
                        <div key={sub.id} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="text-slate-300 w-24 truncate">{sub.label}</span>
                          <div className="flex items-center gap-1 flex-1 justify-end">
                            <button
                              onClick={() => onAdjustPowerPip(sub.id, -1)}
                              className="w-5 h-5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 flex items-center justify-center"
                            >
                              -
                            </button>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map((pip) => (
                                <span
                                  key={pip}
                                  className={`w-3.5 h-2.5 rounded-sm ${val >= pip ? sub.color : 'bg-slate-800 border border-white/10'
                                    }`}
                                />
                              ))}
                            </div>
                            <button
                              onClick={() => onAdjustPowerPip(sub.id, 1)}
                              className="w-5 h-5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mining' && (() => {
              const usedCargo = getTotalCargoUnits(survival.cargoInventory);
              const targetBodyId = survival.mining.targetBodyId || telemetry.nearestBodyId;
              const targetBodyObj = ALL_CELESTIAL_BODIES.find((b) => b.id === targetBodyId);
              const bodyProfile = getBodyMiningProfile(targetBodyId);
              const cargoEntries = (Object.keys(survival.cargoInventory) as MiningResourceId[])
                .map((id) => ({
                  def: MINING_RESOURCES[id],
                  qty: survival.cargoInventory[id] ?? 0,
                }))
                .filter((e) => e.qty > 0);
              const totalCargoValue = cargoEntries.reduce(
                (acc, e) =>
                  acc +
                  Math.round(
                    e.def.creditValue *
                    e.qty *
                    (survival.nearRefuelSource === 'ORBITAL_STATION' ? 1.25 : 1.0)
                  ),
                0
              );
              const qNorm = miningCatalogQuery.trim().toLowerCase();
              const filteredCatalog = MINING_RESOURCE_LIST.filter(
                (r) =>
                  !qNorm ||
                  r.name.toLowerCase().includes(qNorm) ||
                  r.formula.toLowerCase().includes(qNorm) ||
                  r.commonSources.toLowerCase().includes(qNorm) ||
                  r.description.toLowerCase().includes(qNorm)
              );

              return (
                <div className="space-y-3">
                  {/* 1. Live Orbital Extractor Telemetry & Toggle */}
                  <div className="bg-slate-900/85 border border-cyan-500/30 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                        <Pickaxe className="w-3.5 h-3.5" />
                        EXTRATOR ORBITAL A LASER
                      </span>
                      <button
                        onClick={onToggleMiningLaser}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition-all ${survival.miningLaserActive || controlState.miningLaserActive
                          ? 'bg-cyan-500/35 border-cyan-300 text-white shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                          : 'bg-white/5 hover:bg-white/15 border-white/15 text-cyan-200'
                          }`}
                      >
                        {survival.miningLaserActive || controlState.miningLaserActive
                          ? 'Desligar [X]'
                          : 'Ativar Feixe [X]'}
                      </button>
                    </div>

                    <div className="bg-slate-950/75 border border-white/10 rounded-lg p-2.5 space-y-1.5 text-[10px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">ASTRO EM MIRA</span>
                        <span className="text-white font-bold">
                          {survival.mining.targetBodyName ?? targetBodyObj?.name ?? telemetry.nearestBodyName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-snug font-sans">
                        <strong className="text-slate-200">{bodyProfile.bodyTypeLabel}:</strong>{' '}
                        {bodyProfile.extractable
                          ? bodyProfile.extractionMethod
                          : bodyProfile.restrictionReason}
                      </div>

                      {bodyProfile.extractable && (
                        <>
                          <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                            <div className="bg-slate-900/80 rounded p-1 border border-white/5">
                              <div className="text-[9px] text-slate-400">DISTÂNCIA</div>
                              <div
                                className={`font-bold ${survival.mining.inRange ? 'text-emerald-300' : 'text-amber-300'
                                  }`}
                              >
                                {survival.mining.surfaceDistanceRatio.toFixed(1)}R
                              </div>
                            </div>
                            <div className="bg-slate-900/80 rounded p-1 border border-white/5">
                              <div className="text-[9px] text-slate-400">POTÊNCIA</div>
                              <div className="font-bold text-cyan-300">
                                {survival.mining.beamPowerKw} kW
                              </div>
                            </div>
                            <div className="bg-slate-900/80 rounded p-1 border border-white/5">
                              <div className="text-[9px] text-slate-400">TAXA</div>
                              <div className="font-bold text-amber-200">
                                {survival.mining.extractionRatePerSec.toFixed(2)} u/s
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-cyan-200 truncate">
                                {survival.mining.activeHotspotLabel
                                  ? `★ Veio ${survival.mining.hotspotMultiplier.toFixed(1)}×: ${survival.mining.activeHotspotLabel}`
                                  : survival.mining.activeResourceId
                                    ? `Alvo: ${MINING_RESOURCES[survival.mining.activeResourceId].name}`
                                    : survival.mining.statusMessage}
                              </span>
                              <span className="text-white font-bold ml-1">
                                {Math.round(survival.mining.extractionProgress01 * 100)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-cyan-400 to-sky-300 transition-all duration-150"
                                style={{
                                  width: `${Math.round(survival.mining.extractionProgress01 * 100)}%`,
                                }}
                              />
                            </div>
                          </div>

                          {/* Expected Yield Composition Pills */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {bodyProfile.yields.map((y) => {
                              const r = MINING_RESOURCES[y.resourceId];
                              return (
                                <span
                                  key={y.resourceId}
                                  className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-slate-200 flex items-center gap-1"
                                  title={`${r.name} — ${y.veinNote}`}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: r.colorHex }}
                                  />
                                  <span>{r.formula.split(' ')[0]}</span>
                                  <span className="text-slate-400">{Math.round(y.weight * 100)}%</span>
                                </span>
                              );
                            })}
                          </div>
                        </>
                      )}
                      <div className="text-[9px] text-sky-300/90 pt-0.5">
                        Dica: use o Radar [R] em órbita para destacar os 3 veios geológicos ricos na superfície.
                      </div>
                    </div>
                  </div>

                  {/* 2. Cargo Hold & Orbital Market */}
                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        PORÃO MINERAL ({usedCargo}/{survival.cargoCapacityUnits})
                      </span>
                      <div className="flex items-center gap-2">
                        {onOpenBackpack && (
                          <button
                            onClick={onOpenBackpack}
                            className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/45 text-cyan-100 flex items-center gap-1 transition-colors"
                            title="Abrir Visão Completa da Mochila (Tecla I)"
                          >
                            <Backpack className="w-3 h-3" />
                            <span>Mochila [I]</span>
                          </button>
                        )}
                        <span className="text-emerald-300 font-bold flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {survival.spaceCredits.toLocaleString('pt-BR')} CR
                        </span>
                      </div>
                    </div>

                    {cargoEntries.length === 0 ? (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Porão vazio. Aproxime-se da Lua, Marte, Júpiter, Saturno ou asteroides e acione{' '}
                        <strong className="text-cyan-300">[X]</strong> para extrair recursos.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {cargoEntries.map(({ def, qty }) => (
                          <div
                            key={def.id}
                            className="flex items-center justify-between gap-2 bg-slate-950/75 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-mono"
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              <img
                                src={RESOURCE_IMAGE_PATHS[def.id]}
                                alt={def.name}
                                className="w-8 h-8 rounded-lg object-cover border border-white/15 shrink-0 bg-[#060b16]"
                              />
                              <div className="truncate">
                                <div className="text-white font-bold truncate">{def.name}</div>
                                <div className="text-[9px] text-slate-400">
                                  {qty} un · {def.formula} · {def.creditValue} CR/un
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {ENERGY_MINERAL_YIELDS[def.id] && onConsumeMineralForEnergy && (
                                <button
                                  onClick={() => onConsumeMineralForEnergy(def.id)}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-amber-100 font-bold"
                                  title={`Converter no reator: ${ENERGY_MINERAL_YIELDS[def.id]?.label}`}
                                >
                                  ⚡+{ENERGY_MINERAL_YIELDS[def.id]?.batteryPct}%
                                </button>
                              )}
                              <button
                                onClick={() => onSellCargo(def.id, 1)}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-100"
                                title="Vender 1 unidade por Créditos"
                              >
                                +{Math.round(def.creditValue * (survival.nearRefuelSource === 'ORBITAL_STATION' ? 1.25 : 1))}
                              </button>
                              <button
                                onClick={() => onDiscardCargo(def.id)}
                                className="p-1 rounded bg-white/5 hover:bg-rose-500/30 border border-white/10 text-slate-400 hover:text-rose-200"
                                title="Descartar 1 unidade"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={onSellAllCargo}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-100 text-[10px] font-mono font-bold transition-colors"
                        >
                          Liquidar Toda a Carga (+{totalCargoValue} CR
                          {survival.nearRefuelSource === 'ORBITAL_STATION' ? ' · Bônus Doca +25%' : ''})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. Chemical Synthesis & Crafting Lab */}
                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300">
                      <span className="font-bold flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5" />
                        MÁQUINA DE COMBINAÇÃO &amp; SÍNTESE (10)
                      </span>
                      <span className="text-sky-200 font-bold">
                        ⚡ Energia {Math.round(survival.batteryPercent)}%
                      </span>
                    </div>

                    <div className="space-y-2">
                      {CRAFTING_RECIPES.map((recipe) => {
                        const hasIngs = recipe.ingredients.every(
                          (ing) => (survival.cargoInventory[ing.resourceId] ?? 0) >= ing.amount
                        );
                        const hasEnergy = survival.batteryPercent >= recipe.energyCostPct;
                        const canCraft = hasIngs && hasEnergy;
                        return (
                          <div
                            key={recipe.id}
                            className={`rounded-xl p-2.5 border transition-colors ${canCraft
                              ? 'bg-slate-950/90 border-emerald-400/45'
                              : 'bg-slate-950/60 border-white/10'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={RECIPE_IMAGE_PATHS[recipe.id]}
                                  alt={recipe.name}
                                  className="w-9 h-9 rounded-lg object-cover border border-white/15 shrink-0 bg-[#060b16]"
                                />
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold text-white leading-tight truncate">
                                    {recipe.name}
                                  </div>
                                  <div className="text-[9px] font-mono text-cyan-300 mt-0.5 truncate">
                                    {recipe.formula}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => onSynthesizeRecipe(recipe.id)}
                                disabled={!canCraft}
                                className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-mono font-bold transition-colors ${canCraft
                                  ? 'bg-emerald-500/30 hover:bg-emerald-500/45 border-emerald-300 text-white'
                                  : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                                  }`}
                              >
                                Sintetizar
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                              {recipe.scienceNote}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[9px] font-mono">
                              {recipe.ingredients.map((ing) => {
                                const def = MINING_RESOURCES[ing.resourceId];
                                const owned = survival.cargoInventory[ing.resourceId] ?? 0;
                                const ok = owned >= ing.amount;
                                return (
                                  <span
                                    key={ing.resourceId}
                                    className={`px-1.5 py-0.5 rounded border ${ok
                                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                                      : 'bg-rose-500/10 border-rose-400/25 text-slate-300'
                                      }`}
                                  >
                                    {owned}/{ing.amount} {def.formula.split(' ')[0]}
                                  </span>
                                );
                              })}
                              <span
                                className={`px-1.5 py-0.5 rounded border ${hasEnergy
                                  ? 'bg-sky-500/15 border-sky-400/30 text-sky-200'
                                  : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                                  }`}
                              >
                                ⚡ {recipe.energyCostPct}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Astrochemical Resource Catalog */}
                  <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-purple-300">
                      <span className="font-bold flex items-center gap-1.5">
                        <Atom className="w-3.5 h-3.5" />
                        CATÁLOGO ASTROQUÍMICO (10)
                      </span>
                      <span className="text-slate-400">{survival.totalMinedUnits} extraídos</span>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={miningCatalogQuery}
                        onChange={(e) => setMiningCatalogQuery(e.target.value)}
                        placeholder="Filtrar minério, fórmula ou planeta..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      {filteredCatalog.map((res) => {
                        const rarityLabel =
                          res.rarity === 'EXOTIC'
                            ? 'EXÓTICO'
                            : res.rarity === 'RARE'
                              ? 'RARO'
                              : res.rarity === 'UNCOMMON'
                                ? 'INCOMUM'
                                : 'COMUM';
                        return (
                          <div
                            key={res.id}
                            className="bg-slate-950/75 border border-white/10 rounded-lg p-2 flex items-start gap-2.5"
                          >
                            <img
                              src={RESOURCE_IMAGE_PATHS[res.id]}
                              alt={res.name}
                              loading="lazy"
                              className="w-11 h-11 rounded-lg object-cover border border-white/15 shrink-0 bg-[#060b16] mt-0.5"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                                <span className="font-bold text-white flex items-center gap-1.5 truncate">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: res.colorHex }}
                                  />
                                  {res.name}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-slate-300 shrink-0">
                                  {rarityLabel} · {res.creditValue} CR
                                </span>
                              </div>
                              <div className="flex justify-between text-[9px] font-mono text-cyan-300">
                                <span>{res.formula}</span>
                                <span className="text-slate-400">{res.unitMassKg} kg/un</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-snug">
                                {res.description}
                              </p>
                              <div className="text-[9px] font-mono text-emerald-300/90">
                                Fontes: {res.commonSources}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === 'systems' && (
              <>
                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900/75 border border-white/10 rounded-xl p-2.5">
                    <div className="text-[10px] font-mono text-slate-400">VELOCIDADE</div>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">
                      {telemetry.speedFormatted}
                    </div>
                  </div>
                  <div className="bg-slate-900/75 border border-white/10 rounded-xl p-2.5">
                    <div className="text-[10px] font-mono text-slate-400">ASTRO PRÓXIMO</div>
                    <div className="text-sm font-bold text-amber-200 truncate mt-0.5">
                      {telemetry.nearestBodyName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {telemetry.nearestDistanceFormatted}
                    </div>
                  </div>
                  <div className="bg-slate-900/75 border border-white/10 rounded-xl p-2.5">
                    <div className="text-[10px] font-mono text-slate-400">REATOR / CASCO</div>
                    <div className="text-xs font-bold text-emerald-300 font-mono mt-0.5">
                      {Math.round(telemetry.reactorTempC)}°C • {telemetry.hullIntegrity}%
                    </div>
                  </div>
                  <div className="bg-slate-900/75 border border-white/10 rounded-xl p-2.5">
                    <div className="text-[10px] font-mono text-slate-400">ATITUDE (P / Y / R)</div>
                    <div className="text-xs font-bold text-sky-200 font-mono mt-0.5">
                      {telemetry.pitchDeg}° / {telemetry.yawDeg}° / {telemetry.rollDeg}°
                    </div>
                  </div>
                </div>

                {/* Propulsion Fine Control */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-sky-300 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      POTÊNCIA DOS MOTORES
                    </span>
                    <span className="font-bold text-amber-300">
                      {Math.round(controlState.throttle * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-0.5}
                    max={1}
                    step={0.05}
                    value={controlState.throttle}
                    onChange={(e) =>
                      onUpdateControl((prev) => ({
                        ...prev,
                        brakeRequested: false,
                        throttle: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono">
                    {[
                      { label: 'PARAR', val: 0 },
                      { label: '25%', val: 0.25 },
                      { label: '60%', val: 0.6 },
                      { label: '100%', val: 1.0 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() =>
                          onUpdateControl((prev) => ({
                            ...prev,
                            throttle: preset.val,
                            brakeRequested: preset.val === 0,
                          }))
                        }
                        className={`py-1.5 rounded-lg border transition-colors ${Math.abs(controlState.throttle - preset.val) < 0.04
                          ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ship Systems Switches */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">EQUIPAMENTOS DA NAVE</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <button
                      onClick={() =>
                        onUpdateControl((prev) => {
                          spaceAudio.playCockpitSwitch(!prev.headlightsOn);
                          return { ...prev, headlightsOn: !prev.headlightsOn };
                        })
                      }
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${controlState.headlightsOn
                        ? 'bg-amber-400/25 border-amber-300 text-amber-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Faróis (L)</span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateControl((prev) => {
                          spaceAudio.playCockpitSwitch(!prev.sasEnabled);
                          return { ...prev, sasEnabled: !prev.sasEnabled };
                        })
                      }
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${controlState.sasEnabled
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>
                        {controlState.sasEnabled ? 'SAS: ATIVO' : 'MODO: NEWTON'} (Z)
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateControl((prev) => ({
                          ...prev,
                          radarPulseTimestamp: performance.now(),
                        }))
                      }
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl border bg-sky-500/15 hover:bg-sky-500/30 border-sky-400/40 text-sky-200 transition-all"
                    >
                      <Radar className="w-3.5 h-3.5" />
                      <span>Scanner 3D (R)</span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateControl((prev) => {
                          spaceAudio.playCockpitSwitch(!prev.shieldsOn);
                          return { ...prev, shieldsOn: !prev.shieldsOn };
                        })
                      }
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${controlState.shieldsOn
                        ? 'bg-indigo-500/30 border-indigo-400 text-indigo-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Escudos</span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateControl((prev) => {
                          spaceAudio.playCockpitSwitch(!prev.interiorLightsOn);
                          return { ...prev, interiorLightsOn: !prev.interiorLightsOn };
                        })
                      }
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${controlState.interiorLightsOn
                        ? 'bg-sky-500/25 border-sky-300 text-sky-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Luz Cabine (O)</span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateControl((prev) => ({
                          ...prev,
                          firePulseCount: prev.firePulseCount + 1,
                        }))
                      }
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl border bg-rose-500/20 hover:bg-rose-500/35 border-rose-400/40 text-rose-100 transition-all"
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>Pulso (F)</span>
                    </button>

                    <button
                      onClick={() =>
                        onUpdateControl((prev) => ({
                          ...prev,
                          cameraView: 'EXTERNAL',
                          recenterTrigger: (prev.recenterTrigger || 0) + 1,
                        }))
                      }
                      className="flex items-center gap-2 py-2 px-2.5 rounded-xl border bg-white/5 hover:bg-white/15 border-white/10 text-slate-200 transition-all"
                    >
                      <Orbit className="w-3.5 h-3.5 text-sky-300" />
                      <span>Centralizar (C)</span>
                    </button>

                    <button
                      onClick={() => {
                        spaceAudio.playCockpitSwitch(!showTouchPad);
                        setShowTouchPad((v) => !v);
                      }}
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${showTouchPad
                        ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                    >
                      <Gauge className="w-3.5 h-3.5" />
                      <span>Manche Tátil</span>
                    </button>
                  </div>
                </div>

                {/* Master Audio Volume inside Ship Menu */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-emerald-300 flex items-center gap-1.5">
                      {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      EFEITOS SONOROS & MOTORES
                    </span>
                    <button
                      onClick={onToggleAudioMuted}
                      className="text-[10px] underline text-slate-300 hover:text-white"
                    >
                      {isAudioMuted ? 'Ativar' : `${audioVol}%`}
                    </button>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={isAudioMuted ? 0 : audioVol}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAudioVol(val);
                      spaceAudio.unlock();
                      spaceAudio.setMasterVolume(val / 100);
                      if (val > 0 && isAudioMuted) onToggleAudioMuted();
                    }}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>

                {/* Quick Exit / EVA / Station Actions (moved from top bar to keep flight screen clean) */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-mono text-slate-400">OPERAÇÕES EXTERNAS</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-medium">
                    {onEnterEVA && (
                      <button
                        onClick={() => {
                          setIsShipMenuOpen(false);
                          onEnterEVA();
                        }}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/45 text-cyan-100 transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-cyan-300" />
                        <span>Sair EVA</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsShipMenuOpen(false);
                        onExitSpacecraft();
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Modo Explorar</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'navigation' && (
              <>
                {/* Autopilot Selector */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5" />
                      PILOTO AUTOMÁTICO
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {telemetry.autopilotStatus}
                    </span>
                  </div>
                  <select
                    value={controlState.autopilotTargetId || ''}
                    onChange={(e) =>
                      onUpdateControl((prev) => ({
                        ...prev,
                        autopilotTargetId: e.target.value || null,
                      }))
                    }
                    className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="">Piloto Manual (Voo Livre)</option>
                    <option value="sat-orbital-gateway">Estação Espacial Orbital (Órbita da Terra)</option>
                    {autopilotTargets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {onDeployToStation && (
                    <button
                      onClick={onDeployToStation}
                      className="w-full py-1.5 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/45 text-sky-100 text-[11px] font-semibold transition-colors"
                    >
                      Aproximar da Estação Espacial Orbital
                    </button>
                  )}
                </div>

                {/* Interactive 360° Radar */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 flex flex-col items-center gap-2.5">
                  <div className="text-[10px] font-mono text-sky-300 self-start">
                    RADAR ESPACIAL 360° (CLIQUE NO ALVO)
                  </div>
                  <div className="relative w-36 h-36 rounded-full bg-slate-950 border border-sky-500/40 flex items-center justify-center overflow-hidden shadow-inner">
                    <div className="absolute inset-4 rounded-full border border-sky-500/20" />
                    <div className="absolute inset-10 rounded-full border border-sky-500/15" />
                    <div className="w-2 h-2 rounded-full bg-amber-400 z-10" />

                    {telemetry.nearbyContacts.slice(0, 7).map((c) => {
                      const rad = (c.bearingDeg * Math.PI) / 180;
                      const distNorm = Math.min(1, Math.log10(1 + c.distanceUnits) / 3.8);
                      const px = Math.sin(rad) * distNorm * 58;
                      const py = -Math.cos(rad) * distNorm * 58;
                      return (
                        <button
                          key={c.id}
                          onClick={() =>
                            onUpdateControl((prev) => ({
                              ...prev,
                              autopilotTargetId: c.id,
                            }))
                          }
                          style={{ transform: `translate(${px}px, ${py}px)` }}
                          title={`${c.name} (${c.distanceFormatted}) — Travar rota`}
                          className={`absolute w-2.5 h-2.5 rounded-full transition-transform hover:scale-150 ${c.category === 'star'
                            ? 'bg-amber-300'
                            : c.category === 'galaxy'
                              ? 'bg-purple-400'
                              : 'bg-sky-400'
                            }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Nearby Objects List */}
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-1.5">
                  <div className="text-[10px] font-mono text-slate-400 mb-1">
                    CORPOS CELESTES MAIS PRÓXIMOS
                  </div>
                  {telemetry.nearbyContacts.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        onUpdateControl((prev) => ({
                          ...prev,
                          autopilotTargetId: c.id,
                        }))
                      }
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${controlState.autopilotTargetId === c.id
                        ? 'bg-amber-500/20 border border-amber-400/50 text-amber-100'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200'
                        }`}
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-[10px] font-mono text-sky-300 shrink-0 ml-2">
                        {c.distanceFormatted}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'controls' && (
              <div className="space-y-2.5 text-slate-200">
                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 space-y-1.5">
                  <div className="text-[11px] font-mono text-sky-300 font-bold mb-1">
                    TECLADO & MOUSE
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Propulsão / Desacelerar</span>
                    <span className="font-mono text-white">W / S</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Virar (Esquerda / Direita)</span>
                    <span className="font-mono text-white">A / D</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subir / Descer</span>
                    <span className="font-mono text-white">
                      {flightControlPrefs.invertPitchArrows ? '↓ Sobe / ↑ Desce' : '↑ Sobe / ↓ Desce'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inclinar / Rolar Asas (360°)</span>
                    <span className="font-mono text-white">
                      {flightControlPrefs.invertRollArrows ? '← Dir. / → Esq.' : '← Esq. / → Dir.'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Andar Dentro da Nave / Sentar</span>
                    <span className="font-mono text-amber-300">G</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Interagir na Cabine (A Pé)</span>
                    <span className="font-mono text-amber-300">E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Radiadores Térmicos</span>
                    <span className="font-mono text-cyan-300">K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Extrator Orbital a Laser</span>
                    <span className="font-mono text-cyan-300">X</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mochila &amp; Inventário Completo</span>
                    <span className="font-mono text-cyan-300">I</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Luzes da Cabine</span>
                    <span className="font-mono text-sky-300">O</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Modo ECO Combustível</span>
                    <span className="font-mono text-emerald-300">Y</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Motor de Dobra</span>
                    <span className="font-mono text-cyan-300">Shift</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Freio Inercial</span>
                    <span className="font-mono text-rose-300">Espaço</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">3ª Pessoa / Cabine</span>
                    <span className="font-mono text-white">V</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Centralizar Câmera</span>
                    <span className="font-mono text-white">C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Orbitar / Girar Visão</span>
                    <span className="font-mono text-white">Arrastar + Scroll</span>
                  </div>
                </div>

                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                  <p>
                    No espaço (<strong className="text-emerald-300">Z</strong> alterna <strong className="text-white">SAS</strong> / <strong className="text-amber-300">NEWTON</strong>): ao zerar o motor (0%), a nave continua deslizando por inércia. Use <strong className="text-rose-300">Espaço</strong> para acionar os retrofoguetes e frear.
                  </p>
                  <p>
                    Dentro da <strong className="text-sky-300">Cabine 3D</strong>, arraste com o mouse ou dedo para <strong className="text-white">olhar livremente em 360°</strong>, use o <strong className="text-white">Scroll</strong> para dar zoom nos instrumentos e <strong className="text-white">C</strong> (ou duplo clique) para centralizar a visão. Em modo andar (<strong className="text-amber-300">G</strong>), aproxime-se da Copa, Beliche, Reator ou Airlock e pressione <strong className="text-amber-300">E</strong> para interagir.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OPTIONAL COMPACT TOUCH D-PAD (Hidden on screen unless user enables for mobile touch flight) */}
      {showTouchPad && !controlState.walkingInside && (
        <div className="pointer-events-auto fixed left-3 bottom-20 z-30 bg-slate-950/85 backdrop-blur-xl border border-sky-500/35 rounded-2xl p-2 shadow-xl">
          <div className="grid grid-cols-3 gap-1">
            <button
              {...holdButtonProps('roll', 1)}
              className="w-8 h-8 rounded-lg bg-white/5 active:bg-sky-500/40 flex items-center justify-center text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              {...holdButtonProps('pitch', 1)}
              className="w-8 h-8 rounded-lg bg-white/10 active:bg-sky-500/45 flex items-center justify-center text-white"
              title="Subir (Seta ↑)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              {...holdButtonProps('roll', -1)}
              className="w-8 h-8 rounded-lg bg-white/5 active:bg-sky-500/40 flex items-center justify-center text-slate-200"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              {...holdButtonProps('yaw', 1)}
              className="w-8 h-8 rounded-lg bg-white/10 active:bg-sky-500/45 flex items-center justify-center text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              {...holdButtonProps('forward', 1)}
              className="w-8 h-8 rounded-lg bg-amber-500/25 active:bg-amber-500/60 flex items-center justify-center text-amber-200 font-bold text-[10px]"
            >
              W
            </button>
            <button
              {...holdButtonProps('yaw', -1)}
              className="w-8 h-8 rounded-lg bg-white/10 active:bg-sky-500/45 flex items-center justify-center text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div />
            <button
              {...holdButtonProps('pitch', -1)}
              className="w-8 h-8 rounded-lg bg-white/10 active:bg-sky-500/45 flex items-center justify-center text-white"
              title="Descer (Seta ↓)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <div />
          </div>
        </div>
      )}

      {/* DISCREET MINED ITEM PICKUP TOAST STACK (Appears smoothly as each mineral unit is extracted) */}
      {minedToasts.length > 0 && (
        <div
          className="pointer-events-none fixed left-3.5 bottom-24 sm:bottom-20 z-30 flex flex-col gap-1.5 max-w-[270px]"
          data-testid="mined-toast-stack"
        >
          {minedToasts.map((toast) => {
            const def = MINING_RESOURCES[toast.resourceId];
            return (
              <div
                key={toast.uid}
                onClick={() => onOpenBackpack?.()}
                className="menu-glass-surface pointer-events-auto cursor-pointer animate-mining-toast flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border border-cyan-300/45 shadow-lg hover:border-cyan-200 transition-all"
                style={{
                  boxShadow: `0 10px 26px rgba(4, 12, 28, 0.55), inset 0 0 16px ${def.colorHex}26`,
                }}
                data-testid={`mined-toast-${toast.resourceId}`}
                title="Clique para inspecionar na Mochila [I]"
              >
                <div
                  className="relative w-9 h-9 rounded-xl overflow-hidden bg-[#060b16] border border-white/20 shrink-0"
                  style={{ boxShadow: `0 0 12px ${def.colorHex}55` }}
                >
                  <img
                    src={RESOURCE_IMAGE_PATHS[toast.resourceId]}
                    alt={def.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 font-mono">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-white truncate">
                      +{toast.addedQty} {def.name}
                    </span>
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0"
                      style={{
                        backgroundColor: `${def.colorHex}28`,
                        color: '#0f172a',
                        border: `1px solid ${def.colorHex}66`,
                      }}
                    >
                      {def.formula.split(' ')[0]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-200 mt-0.5">
                    <span>No porão: {toast.totalOwned} un</span>
                    <span className="text-emerald-300 font-semibold">
                      +{def.creditValue * toast.addedQty} CR
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLEAN SLIM BOTTOM FLIGHT PILL + SURVIVAL MINI-BAR (Leaves ~93% of Viewport Unobstructed!) */}
      <div className="pb-3 px-3 flex flex-col items-center gap-1.5">
        {controlState.walkingInside &&
          (() => {
            const stationMeta = CABIN_STATIONS.find((s) => s.id === survival.nearbyCabinStation);
            if (!stationMeta) return null;
            return (
              <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-950/90 backdrop-blur-xl border border-amber-400/55 rounded-2xl px-3.5 py-2 shadow-2xl">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-ping shrink-0"
                  style={{ backgroundColor: stationMeta.accentHex }}
                />
                <div className="text-[11px] font-mono">
                  <div className="text-white font-bold">{stationMeta.title}</div>
                  <div className="text-[10px] text-slate-300">{stationMeta.actionHint}</div>
                </div>
                <button
                  onClick={onCabinStationInteract}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/30 hover:bg-amber-500/45 border border-amber-400 text-amber-100 text-[10px] font-mono font-bold transition-colors shrink-0"
                >
                  [E] Interagir
                </button>
              </div>
            );
          })()}

        {!controlState.walkingInside && (
          <div className="menu-glass-surface pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 border border-sky-300/30 rounded-full px-3 py-1 shadow-lg text-[10px] font-mono">
            <button
              onClick={() => {
                setActiveTab('survival');
                setIsShipMenuOpen(true);
              }}
              className="flex items-center gap-2 text-slate-200 hover:text-white transition-colors"
              title="Abrir Painel de Sobrevivência e Recursos da Nave"
            >
              <span
                className={
                  survival.fuelPercent < 18
                    ? 'text-rose-400 font-bold animate-pulse'
                    : 'text-emerald-300'
                }
              >
                COMB {Math.round(survival.fuelPercent)}%
              </span>
              <span className="text-white/20">·</span>
              <span
                className={
                  survival.warpEnergyPercent < 15 ? 'text-amber-300 font-bold' : 'text-cyan-300'
                }
              >
                DOBRA {Math.round(survival.warpEnergyPercent)}%
              </span>
              <span className="text-white/20">·</span>
              <span
                className={
                  survival.batteryPercent < 20
                    ? 'text-rose-300 font-bold animate-pulse'
                    : 'text-amber-200'
                }
                title="Energia Elétrica Principal da Nave (Recarrega pelo Sol ou Minerando Recursos de Energia)"
              >
                ENERGIA {Math.round(survival.batteryPercent)}%
                {!survival.inPlanetaryShadow && survival.solarHarvestKw >= 35
                  ? ` ☀+${(Math.pow(survival.solarHarvestKw / 95, 1.12) * 2.15).toFixed(1)}%/s`
                  : ''}
              </span>
              <span className="text-white/20">·</span>
              <span
                className={
                  survival.shipOxygenPercent < 30
                    ? 'text-rose-400 font-bold animate-pulse'
                    : 'text-sky-300'
                }
              >
                O₂ {Math.round(survival.shipOxygenPercent)}%
              </span>
              <span className="text-white/20">·</span>
              <span
                className={survival.hullTempC > 520 ? 'text-rose-400 font-bold' : 'text-slate-300'}
              >
                {Math.round(survival.hullTempC)}°C
              </span>
              <span className="hidden sm:inline text-white/20">·</span>
              <span
                className={`hidden sm:inline ${survival.hungerPercent < 25 ||
                  survival.thirstPercent < 25 ||
                  survival.fatiguePercent < 20
                  ? 'text-amber-300 font-bold'
                  : 'text-slate-300'
                  }`}
              >
                PILOTO{' '}
                {Math.round(
                  (survival.hungerPercent + survival.thirstPercent + survival.fatiguePercent) / 3
                )}
                %
              </span>
            </button>

            <div className="h-3 w-px bg-white/15 mx-0.5" />

            <button
              onClick={onToggleEcoMode}
              className={`px-1.5 py-0.5 rounded border transition-colors ${survival.ecoCruiseMode
                ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200 font-bold'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
                }`}
              title="Alternar Modo ECO de Economia de Combustível (Y)"
            >
              ECO
            </button>
            <button
              onClick={onToggleRadiators}
              className={`px-1.5 py-0.5 rounded border transition-colors ${survival.radiatorsDeployed
                ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200 font-bold'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
                }`}
              title="Estender / Retrair Radiadores Térmicos (K)"
            >
              RAD
            </button>
            <button
              onClick={onToggleMiningLaser}
              className={`px-1.5 py-0.5 rounded border transition-colors ${survival.mining.isDrilling
                ? 'bg-cyan-500/35 border-cyan-300 text-white font-bold animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.55)]'
                : survival.miningLaserActive || controlState.miningLaserActive
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-bold'
                  : survival.mining.inRange
                    ? 'bg-emerald-500/20 border-emerald-400/55 text-emerald-200 font-bold'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
                }`}
              title="Ativar / Desligar Laser Extrator Orbital (Tecla X)"
            >
              EXT
            </button>
            {onOpenBackpack && (
              <button
                onClick={onOpenBackpack}
                className="px-1.5 py-0.5 rounded border bg-cyan-500/15 hover:bg-cyan-500/30 border-cyan-400/45 text-cyan-200 font-bold transition-colors flex items-center gap-1"
                title="Abrir Mochila & Porão Mineral (Tecla I)"
              >
                <Backpack className="w-3 h-3" />
                <span className="hidden sm:inline">I</span>
              </button>
            )}
            {survival.fuelPercent < 18 && (
              <button
                onClick={onCallRescueDrone}
                className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/45 border border-amber-400 text-amber-100 font-bold animate-pulse"
                title="Chamar Drone de Socorro de Emergência"
              >
                SOCORRO
              </button>
            )}
          </div>
        )}

        {controlState.walkingInside ? (
          <div className="menu-glass-surface pointer-events-auto flex flex-wrap items-center justify-center gap-2 sm:gap-3 border border-emerald-400/45 rounded-full px-4 py-1.5 shadow-xl text-[11px] font-mono text-slate-100">
            <span className="text-emerald-300 font-bold">CABINE (A PÉ)</span>
            <span className="text-white/25">·</span>
            <span>W/A/S/D Mover</span>
            <span className="hidden sm:inline text-white/25">·</span>
            <span className="hidden sm:inline">E Interagir · Shift Correr · Espaço Pulo</span>
            <span className="text-white/25">·</span>
            <span>V 1ª/3ª Pessoa</span>
            <span className="text-white/25">·</span>
            <button
              onClick={() =>
                onUpdateControl((prev) => {
                  spaceAudio.playCockpitSwitch(false);
                  return { ...prev, walkingInside: false, brakeRequested: false };
                })
              }
              className="px-2.5 py-0.5 rounded-full bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/45 text-amber-100 text-[10px] font-bold transition-colors"
            >
              G Sentar no Comando
            </button>
          </div>
        ) : (
          <div className="menu-glass-surface pointer-events-auto flex items-center gap-2 sm:gap-3 border border-sky-300/35 rounded-full px-3.5 py-1.5 shadow-xl max-w-full">
            <div className="text-[11px] font-mono text-white font-bold whitespace-nowrap">
              {telemetry.speedFormatted}
            </div>

            <div className="h-4 w-px bg-white/15" />

            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={Math.max(0, controlState.throttle)}
                onChange={(e) =>
                  onUpdateControl((prev) => ({
                    ...prev,
                    brakeRequested: false,
                    throttle: parseFloat(e.target.value),
                  }))
                }
                className="w-16 sm:w-28 accent-amber-400 cursor-pointer"
                title="Manete de Potência"
              />
              <span className="text-[10px] font-mono text-amber-300 w-8 text-right">
                {Math.round(controlState.throttle * 100)}%
              </span>
            </div>

            <button
              onClick={() =>
                onUpdateControl((prev) => ({
                  ...prev,
                  brakeRequested: false,
                  boostActive: !prev.boostActive,
                  throttle: !prev.boostActive && prev.throttle < 0.5 ? 0.85 : prev.throttle,
                }))
              }
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold font-mono transition-all ${controlState.boostActive
                ? 'bg-cyan-500/35 border-cyan-300 text-white shadow-[0_0_12px_rgba(34,211,238,0.5)]'
                : 'bg-white/5 hover:bg-white/15 border-white/15 text-cyan-200'
                }`}
              title="Motor de Dobra (Shift)"
            >
              <Zap className="w-3 h-3" />
              <span className="hidden sm:inline">Dobra</span>
            </button>

            <button
              onClick={() =>
                onUpdateControl((prev) => ({
                  ...prev,
                  throttle: 0,
                  boostActive: false,
                  autopilotTargetId: null,
                  brakeRequested: true,
                }))
              }
              className="px-2.5 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/35 text-rose-100 text-[10px] font-bold font-mono transition-colors"
              title="Freio Total (Espaço)"
            >
              Freio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
