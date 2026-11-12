import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Crosshair,
  Eye,
  Flame,
  Gauge,
  Lightbulb,
  LogOut,
  Navigation,
  Orbit,
  Radar,
  Rocket,
  RotateCcw,
  RotateCw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { ALL_CELESTIAL_BODIES } from '../data/solarSystemData';
import {
  SpacecraftControlState,
  SpacecraftTelemetry,
} from '../types/astronomy';
import { spaceAudio } from '../utils/spaceAudioEngine';

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
  onVirtualSteerChange: (input: VirtualSteerInput) => void;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
}

type ShipMenuTab = 'systems' | 'navigation' | 'controls';

export const SpacecraftCockpitHUD: React.FC<SpacecraftCockpitHUDProps> = ({
  controlState,
  telemetry,
  onUpdateControl,
  onExitSpacecraft,
  onVirtualSteerChange,
  isAudioMuted,
  onToggleAudioMuted,
}) => {
  const [isShipMenuOpen, setIsShipMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ShipMenuTab>('systems');
  const [showTouchPad, setShowTouchPad] = useState(false);
  const [audioVol, setAudioVol] = useState(() => Math.round(spaceAudio.getMasterVolume() * 100));

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
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between select-none">
      {/* MINIMAL TOP BAR: COMPACT CAMERA, SHIP MENU & EXIT */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-slate-950/80 backdrop-blur-xl border border-white/15 rounded-full px-3 py-1.5 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="text-xs font-bold tracking-wider text-white font-mono">
            SR-7
          </span>

          <div className="h-4 w-px bg-white/15 mx-0.5" />

          <button
            onClick={() =>
              onUpdateControl((prev) => ({
                ...prev,
                cameraView: prev.cameraView === 'EXTERNAL' ? 'COCKPIT' : 'EXTERNAL',
              }))
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-100 text-[11px] font-medium transition-colors"
            title="Alternar Câmera 3ª Pessoa / Cabine 1ª Pessoa (Tecla V)"
          >
            {controlState.cameraView === 'EXTERNAL' ? (
              <>
                <Camera className="w-3.5 h-3.5 text-sky-300" />
                <span>Cabine</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-sky-300" />
                <span>3ª Pessoa</span>
              </>
            )}
          </button>

          {controlState.cameraView === 'EXTERNAL' && (
            <button
              onClick={() =>
                onUpdateControl((prev) => ({
                  ...prev,
                  recenterTrigger: (prev.recenterTrigger || 0) + 1,
                }))
              }
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 text-[11px] transition-colors"
              title="Alinhar Câmera Atrás da Nave (Tecla C)"
            >
              <Orbit className="w-3 h-3 text-slate-300" />
              <span>Centralizar</span>
            </button>
          )}

          <button
            onClick={() => setIsShipMenuOpen((open) => !open)}
            className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all ${
              isShipMenuOpen
                ? 'bg-cyan-500/30 border-cyan-300 text-white shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                : 'bg-white/10 hover:bg-white/15 border-white/20 text-white'
            }`}
            title="Abrir Menu Completo da Nave (Telemetria, Radar, Piloto Automático e Sistemas)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
            <span>Menu da Nave</span>
            {controlState.autopilotTargetId && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            onClick={onToggleAudioMuted}
            className={`p-1.5 rounded-full border transition-colors ${
              isAudioMuted
                ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/35'
            }`}
            title={isAudioMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Áudio'}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onExitSpacecraft}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 text-[11px] font-medium transition-colors"
            title="Sair da Nave"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>

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

      {/* ULTRA-SUBTLE CENTER BORESIGHT DOT IN 1ST-PERSON COCKPIT ONLY */}
      {controlState.cameraView === 'COCKPIT' && !isShipMenuOpen && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <Crosshair
            className={`w-5 h-5 ${
              controlState.boostActive ? 'text-cyan-300/75' : 'text-sky-300/45'
            }`}
            strokeWidth={1.2}
          />
        </div>
      )}

      {/* DEDICATED SHIP INFORMATION & SYSTEMS MENU DRAWER */}
      {isShipMenuOpen && (
        <div className="pointer-events-auto fixed right-3 top-14 sm:top-16 bottom-16 w-[calc(100%-1.5rem)] sm:w-[400px] z-40 bg-slate-950/92 backdrop-blur-2xl border border-sky-500/35 rounded-2xl shadow-[0_16px_50px_rgba(2,6,23,0.95)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-sky-400" />
              <div>
                <h2 className="text-xs font-bold tracking-wider text-white font-mono">
                  CENTRAL DA NAVE SR-7 EXPLORER
                </h2>
                <p className="text-[10px] text-slate-400">
                  Telemetria, Sistemas, Radar e Piloto Automático
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsShipMenuOpen(false)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
              title="Fechar Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Menu Tabs */}
          <div className="grid grid-cols-3 border-b border-white/10 text-[11px] font-mono bg-slate-900/30">
            {[
              { id: 'systems' as const, label: 'Sistemas' },
              { id: 'navigation' as const, label: 'Radar & Rota' },
              { id: 'controls' as const, label: 'Controles' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 text-center transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-sky-400 text-sky-200 bg-sky-500/10 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Menu Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
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
                        className={`py-1.5 rounded-lg border transition-colors ${
                          Math.abs(controlState.throttle - preset.val) < 0.04
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
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${
                        controlState.headlightsOn
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
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${
                        controlState.sasEnabled
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>SAS {controlState.sasEnabled ? 'ON' : 'OFF'}</span>
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
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${
                        controlState.shieldsOn
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
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${
                        controlState.interiorLightsOn
                          ? 'bg-sky-500/25 border-sky-300 text-sky-100'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Luz Cabine (I)</span>
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
                      className={`flex items-center gap-2 py-2 px-2.5 rounded-xl border transition-all ${
                        showTouchPad
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
                    {autopilotTargets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
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
                          className={`absolute w-2.5 h-2.5 rounded-full transition-transform hover:scale-150 ${
                            c.category === 'star'
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                        controlState.autopilotTargetId === c.id
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
                    <span className="text-slate-400">Acelerar / Reduzir</span>
                    <span className="font-mono text-white">W / S</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Virar e Inclinar</span>
                    <span className="font-mono text-white">A / D e Setas</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rolar Nave</span>
                    <span className="font-mono text-white">Q / E</span>
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

                <div className="bg-slate-900/75 border border-white/10 rounded-xl p-3 text-[11px] text-slate-300 leading-relaxed">
                  Na câmera <strong className="text-white">3ª Pessoa</strong>, você pode arrastar com o mouse ou dedo ao redor da SR-7 para inspecionar a nave em qualquer ângulo — ao acelerar ou manobrar, a câmera retorna suavemente para trás dos motores. Use o botão <strong className="text-sky-300">Manche Tátil</strong> na barra inferior se quiser pilotar diretamente pelo toque.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OPTIONAL COMPACT TOUCH D-PAD (Hidden on screen unless user enables for mobile touch flight) */}
      {showTouchPad && (
        <div className="pointer-events-auto fixed left-3 bottom-16 z-30 bg-slate-950/85 backdrop-blur-xl border border-sky-500/35 rounded-2xl p-2 shadow-xl">
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
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <div />
          </div>
        </div>
      )}

      {/* CLEAN SLIM BOTTOM FLIGHT PILL (Leaves ~95% of Viewport Unobstructed!) */}
      <div className="pb-3 px-3 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-slate-950/78 backdrop-blur-xl border border-white/15 rounded-full px-3.5 py-1.5 shadow-xl max-w-full">
          <div className="text-[11px] font-mono text-white font-bold whitespace-nowrap">
            {telemetry.speedFormatted}
          </div>

          <div className="h-4 w-px bg-white/15" />

          <div className="flex items-center gap-1.5">
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
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold font-mono transition-all ${
              controlState.boostActive
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
            className="px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/35 text-rose-100 text-[10px] font-bold font-mono transition-colors"
            title="Freio Total (Espaço)"
          >
            Freio
          </button>

          <button
            onClick={() => setShowTouchPad((v) => !v)}
            className={`p-1.5 rounded-full border transition-colors ${
              showTouchPad
                ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                : 'bg-white/5 hover:bg-white/15 border-white/10 text-slate-300'
            }`}
            title="Mostrar/Ocultar Manche na Tela"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
