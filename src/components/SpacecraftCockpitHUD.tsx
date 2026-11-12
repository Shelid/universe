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
  Radar,
  RotateCcw,
  RotateCw,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ALL_CELESTIAL_BODIES } from '../data/solarSystemData';
import {
  SpacecraftControlState,
  SpacecraftTelemetry,
} from '../types/astronomy';

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
}

export const SpacecraftCockpitHUD: React.FC<SpacecraftCockpitHUDProps> = ({
  controlState,
  telemetry,
  onUpdateControl,
  onExitSpacecraft,
  onVirtualSteerChange,
}) => {
  const [isConsoleMinimized, setIsConsoleMinimized] = useState(false);
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
      {/* TOP BAR: SR-7 FLIGHT MODE STATUS & CAMERA / AUTOPILOT CONTROLS */}
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl border border-sky-500/40 rounded-2xl px-3 py-2 shadow-[0_0_24px_rgba(14,165,233,0.2)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
            <div>
              <div className="text-xs font-bold tracking-wider text-white font-mono">
                NAVE SR-7 EXPLORER
              </div>
              <div className="text-[10px] text-sky-300/90 font-mono">
                {controlState.cameraView === 'COCKPIT'
                  ? 'CABINE DE COMANDO (1ª PESSOA)'
                  : 'CÂMERA EXTERNA (3ª PESSOA)'}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 mx-1" />

          <button
            onClick={() =>
              onUpdateControl((prev) => ({
                ...prev,
                cameraView: prev.cameraView === 'COCKPIT' ? 'EXTERNAL' : 'COCKPIT',
              }))
            }
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-100 text-xs font-medium transition-colors"
            title="Alternar entre Interior da Cabine e Visão Externa (Tecla V)"
          >
            {controlState.cameraView === 'COCKPIT' ? (
              <>
                <Eye className="w-3.5 h-3.5 text-sky-300" />
                <span className="hidden sm:inline">Ver Por Fora</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-sky-300" />
                <span className="hidden sm:inline">Entrar na Cabine</span>
              </>
            )}
          </button>

          <button
            onClick={onExitSpacecraft}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 text-xs font-medium transition-colors"
            title="Sair da Nave e Voltar ao Modo Observatório"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair da Nave</span>
          </button>
        </div>

        {/* AUTOPILOT TARGET SELECTOR & TELEMETRY SUMMARY */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl border border-white/15 rounded-2xl px-3 py-1.5 shadow-xl">
          <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <select
            value={controlState.autopilotTargetId || ''}
            onChange={(e) =>
              onUpdateControl((prev) => ({
                ...prev,
                autopilotTargetId: e.target.value || null,
              }))
            }
            className="bg-transparent text-xs text-slate-100 font-medium focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[190px]"
            title="Escolher destino para Piloto Automático"
          >
            <option value="" className="bg-slate-950 text-slate-400">
              Piloto Manual (Livre)
            </option>
            {autopilotTargets.map((b) => (
              <option key={b.id} value={b.id} className="bg-slate-950 text-white">
                Destino: {b.name}
              </option>
            ))}
          </select>

          {controlState.autopilotTargetId && (
            <button
              onClick={() =>
                onUpdateControl((prev) => ({
                  ...prev,
                  autopilotTargetId: null,
                }))
              }
              className="px-2 py-1 rounded-lg bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[10px] font-mono hover:bg-amber-500/40"
            >
              DESLIGAR
            </button>
          )}
        </div>
      </div>

      {/* CENTER HOLOGRAPHIC FLIGHT RETICLE (1st-Person HUD Overlay) */}
      {controlState.cameraView === 'COCKPIT' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-56 h-56 flex items-center justify-center opacity-80">
            {/* Artificial Horizon Pitch/Roll Ring */}
            <div
              style={{
                transform: `rotate(${(-telemetry.rollDeg).toFixed(1)}deg)`,
              }}
              className="w-40 h-40 rounded-full border border-sky-400/25 flex items-center justify-center transition-transform duration-75"
            >
              <div className="w-28 h-px bg-gradient-to-r from-transparent via-sky-400/45 to-transparent" />
            </div>

            {/* Fixed Center Boresight Crosshair */}
            <Crosshair
              className={`absolute w-7 h-7 ${
                controlState.boostActive ? 'text-cyan-300' : 'text-sky-400/75'
              }`}
              strokeWidth={1.3}
            />

            {/* Left Speed Tape */}
            <div className="absolute -left-16 top-1/2 -translate-y-1/2 text-right font-mono">
              <div className="text-[9px] text-sky-400/80">VELOCIDADE</div>
              <div className="text-xs font-bold text-white">{telemetry.speedFormatted}</div>
            </div>

            {/* Right Target Proximity Tape */}
            <div className="absolute -right-24 top-1/2 -translate-y-1/2 text-left font-mono">
              <div className="text-[9px] text-amber-400/85">ALVO PRÓXIMO</div>
              <div className="text-xs font-bold text-amber-200 truncate max-w-[110px]">
                {telemetry.nearestBodyName}
              </div>
              <div className="text-[10px] text-slate-300">{telemetry.nearestDistanceFormatted}</div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM TACTICAL COCKPIT INSTRUMENT CONSOLE */}
      <div className="px-2 sm:px-4 pb-2 sm:pb-3 flex flex-col items-center">
        {/* Console Toggle Pill */}
        <button
          onClick={() => setIsConsoleMinimized((v) => !v)}
          className="pointer-events-auto mb-1 px-3 py-0.5 rounded-t-xl bg-slate-950/90 border border-b-0 border-sky-500/35 text-[10px] font-mono text-sky-300 hover:text-white flex items-center gap-1"
        >
          <Gauge className="w-3 h-3" />
          <span>{isConsoleMinimized ? 'ABRIR PAINEL DA CABINE' : 'MINIMIZAR PAINEL'}</span>
        </button>

        {!isConsoleMinimized && (
          <div className="pointer-events-auto w-full max-w-5xl max-h-[42vh] md:max-h-none overflow-y-auto bg-slate-950/88 backdrop-blur-2xl border border-sky-500/35 rounded-2xl p-2.5 sm:p-3.5 shadow-[0_-10px_40px_rgba(2,6,23,0.9)] grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* LEFT MODULE: ENGINE THROTTLE, BOOST/WARP & INERTIAL BRAKE */}
            <div className="md:col-span-4 flex flex-col gap-2 bg-slate-900/65 border border-white/10 rounded-xl p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-sky-300 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  MANETE DE POTÊNCIA
                </span>
                <span
                  className={`font-bold ${
                    controlState.boostActive
                      ? 'text-cyan-300'
                      : controlState.throttle > 0
                        ? 'text-amber-300'
                        : 'text-slate-300'
                  }`}
                >
                  {Math.round(controlState.throttle * 100)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-rose-400">RÉ</span>
                <input
                  type="range"
                  min={-0.5}
                  max={1}
                  step={0.05}
                  value={controlState.throttle}
                  onChange={(e) =>
                    onUpdateControl((prev) => ({
                      ...prev,
                      throttle: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <span className="text-[9px] font-mono text-amber-300">MÁX</span>
              </div>

              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
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
                    className={`py-1 rounded-lg border transition-colors ${
                      Math.abs(controlState.throttle - preset.val) < 0.04
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() =>
                    onUpdateControl((prev) => ({
                      ...prev,
                      boostActive: !prev.boostActive,
                      throttle: !prev.boostActive && prev.throttle < 0.5 ? 0.85 : prev.throttle,
                    }))
                  }
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-[11px] font-bold font-mono transition-all ${
                    controlState.boostActive
                      ? 'bg-cyan-500/35 border-cyan-300 text-white shadow-[0_0_18px_rgba(34,211,238,0.55)] animate-pulse'
                      : 'bg-slate-800/80 border-white/15 text-cyan-200 hover:border-cyan-400/60'
                  }`}
                  title="Ativar Motor de Dobra / Hipervelocidade (Segure Shift)"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>DOBRA {controlState.boostActive ? 'ON' : 'OFF'}</span>
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
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 text-[11px] font-bold font-mono transition-colors"
                  title="Freio Inercial Instantâneo (Tecla Espaço)"
                >
                  <span>FREIO TOTAL</span>
                </button>
              </div>
            </div>

            {/* CENTER MODULE: TACTILE FLIGHT STEERING PAD & RADAR CONTACTS */}
            <div className="md:col-span-4 flex items-center justify-between gap-2 bg-slate-900/65 border border-white/10 rounded-xl p-2.5">
              {/* Directional Flight D-Pad (Works with Mouse & Touch!) */}
              <div className="flex flex-col items-center gap-1">
                <div className="text-[9px] font-mono text-slate-400 uppercase">Manche / Direção</div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    {...holdButtonProps('roll', 1)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-sky-500/25 border border-white/10 flex items-center justify-center text-slate-300 active:bg-sky-500/40"
                    title="Rolar Esquerda (Q)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    {...holdButtonProps('pitch', 1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-white active:bg-sky-500/50"
                    title="Subir Nariz (Seta Cima)"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    {...holdButtonProps('roll', -1)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-sky-500/25 border border-white/10 flex items-center justify-center text-slate-300 active:bg-sky-500/40"
                    title="Rolar Direita (E)"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    {...holdButtonProps('yaw', 1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-white active:bg-sky-500/50"
                    title="Virar Esquerda (A)"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    {...holdButtonProps('forward', 1)}
                    className="w-8 h-8 rounded-lg bg-amber-500/25 hover:bg-amber-500/45 border border-amber-400/50 flex items-center justify-center text-amber-200 font-bold text-[10px] active:bg-amber-500/60"
                    title="Segurar para Impulso Direto (W)"
                  >
                    W
                  </button>
                  <button
                    {...holdButtonProps('yaw', -1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-white active:bg-sky-500/50"
                    title="Virar Direita (D)"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div />
                  <button
                    {...holdButtonProps('pitch', -1)}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-sky-500/30 border border-sky-400/30 flex items-center justify-center text-white active:bg-sky-500/50"
                    title="Descer Nariz (Seta Baixo)"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <div />
                </div>
              </div>

              {/* Mini 360° Proximity Radar */}
              <div className="flex flex-col items-center flex-1 min-w-[120px]">
                <div className="relative w-24 h-24 rounded-full bg-slate-950 border border-sky-500/40 flex items-center justify-center overflow-hidden shadow-inner">
                  <div className="absolute inset-3 rounded-full border border-sky-500/20" />
                  <div className="absolute inset-7 rounded-full border border-sky-500/15" />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 z-10" />

                  {telemetry.nearbyContacts.slice(0, 6).map((c) => {
                    const rad = (c.bearingDeg * Math.PI) / 180;
                    const distNorm = Math.min(1, Math.log10(1 + c.distanceUnits) / 3.8);
                    const px = Math.sin(rad) * distNorm * 40;
                    const py = -Math.cos(rad) * distNorm * 40;
                    return (
                      <button
                        key={c.id}
                        onClick={() =>
                          onUpdateControl((prev) => ({
                            ...prev,
                            autopilotTargetId: c.id,
                          }))
                        }
                        style={{
                          transform: `translate(${px}px, ${py}px)`,
                        }}
                        title={`${c.name} (${c.distanceFormatted}) — Clique para alinhar`}
                        className={`absolute w-2 h-2 rounded-full transition-transform hover:scale-150 ${
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
                <div className="text-[9px] font-mono text-sky-300/90 mt-1 truncate max-w-[130px]">
                  {telemetry.autopilotStatus !== 'OFF'
                    ? `AUTO: ${telemetry.autopilotStatus}`
                    : `RADAR: ${telemetry.nearestBodyName}`}
                </div>
              </div>
            </div>

            {/* RIGHT MODULE: TACTICAL COCKPIT SWITCHES (HEADLIGHTS, SAS, SCANNER, CANNONS, CABIN LIGHT) */}
            <div className="md:col-span-4 flex flex-col gap-1.5 bg-slate-900/65 border border-white/10 rounded-xl p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>PAINEL DE SISTEMAS SR-7</span>
                <span className="text-emerald-400">
                  REATOR {Math.round(telemetry.reactorTempC)}°C
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() =>
                    onUpdateControl((prev) => ({ ...prev, headlightsOn: !prev.headlightsOn }))
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border text-[10px] font-mono transition-all ${
                    controlState.headlightsOn
                      ? 'bg-amber-400/25 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.35)]'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Ligar/Desligar Faróis Táticos 3D (Tecla L)"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>FARÓIS</span>
                </button>

                <button
                  onClick={() =>
                    onUpdateControl((prev) => ({ ...prev, sasEnabled: !prev.sasEnabled }))
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border text-[10px] font-mono transition-all ${
                    controlState.sasEnabled
                      ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Estabilizador Inercial SAS (Tecla Z)"
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
                  className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border bg-sky-500/15 hover:bg-sky-500/30 border-sky-400/40 text-sky-200 text-[10px] font-mono transition-all active:scale-95"
                  title="Disparar Varredura 3D do Scanner (Tecla R)"
                >
                  <Radar className="w-3.5 h-3.5" />
                  <span>SCANNER</span>
                </button>

                <button
                  onClick={() =>
                    onUpdateControl((prev) => ({ ...prev, shieldsOn: !prev.shieldsOn }))
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border text-[10px] font-mono transition-all ${
                    controlState.shieldsOn
                      ? 'bg-indigo-500/30 border-indigo-400 text-indigo-100'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Escudos Defletores"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>ESCUDOS</span>
                </button>

                <button
                  onClick={() =>
                    onUpdateControl((prev) => ({
                      ...prev,
                      interiorLightsOn: !prev.interiorLightsOn,
                    }))
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border text-[10px] font-mono transition-all ${
                    controlState.interiorLightsOn
                      ? 'bg-sky-500/25 border-sky-300 text-sky-100'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                  title="Iluminação Interna da Cabine"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>LUZ CABINE</span>
                </button>

                <button
                  onClick={() =>
                    onUpdateControl((prev) => ({
                      ...prev,
                      firePulseCount: prev.firePulseCount + 1,
                    }))
                  }
                  className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl border bg-rose-500/20 hover:bg-rose-500/40 border-rose-400/50 text-rose-100 text-[10px] font-mono transition-all active:scale-95"
                  title="Disparar Pulsos de Sondagem Ventral (Tecla F)"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>DISPARAR</span>
                </button>
              </div>

              <div className="text-[9px] font-mono text-slate-400 text-center">
                WASD / Setas: Voar • Q/E: Rolar • Shift: Dobra • Espaço: Freio • F: Pulso
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

