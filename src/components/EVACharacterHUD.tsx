import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Lightbulb,
  LogOut,
  Radar,
  Rocket,
  SlidersHorizontal,
  User,
  Zap,
} from 'lucide-react';

export interface EVAVirtualInput {
  moveX: number; // -1..1 (strafe)
  moveZ: number; // -1..1 (-1 forward, +1 backward -> matches W/S)
  moveY: number; // -1..1 (ascend/descend zero-G)
  sprint: boolean;
}

interface EVACharacterHUDProps {
  visorLightOn: boolean;
  onToggleVisorLight: () => void;
  onRecenterCamera: () => void;
  onTriggerRadarScan: () => void;
  onEnterShip: () => void;
  onExitToExplorer: () => void;
  onOpenMenu: () => void;
  onVirtualInputChange: (input: EVAVirtualInput) => void;
  speedFormatted: string;
  nearestBodyName: string;
  activeCharacterName?: string;
  onWalkOnStation?: () => void;
}

export const EVACharacterHUD: React.FC<EVACharacterHUDProps> = ({
  visorLightOn,
  onToggleVisorLight,
  onRecenterCamera,
  onTriggerRadarScan,
  onEnterShip,
  onExitToExplorer,
  onOpenMenu,
  onVirtualInputChange,
  speedFormatted,
  nearestBodyName,
  activeCharacterName = 'ASTRONAUTA EVA',
  onWalkOnStation,
}) => {
  const [showTouchControls, setShowTouchControls] = useState(false);
  const inputRef = useRef<EVAVirtualInput>({
    moveX: 0,
    moveZ: 0,
    moveY: 0,
    sprint: false,
  });

  const setInput = <K extends keyof EVAVirtualInput>(key: K, val: EVAVirtualInput[K]) => {
    inputRef.current = { ...inputRef.current, [key]: val };
    onVirtualInputChange({ ...inputRef.current });
  };

  const holdAxis = (key: 'moveX' | 'moveY' | 'moveZ', val: number) => ({
    onPointerDown: () => setInput(key, val),
    onPointerUp: () => setInput(key, 0),
    onPointerLeave: () => setInput(key, 0),
    onPointerCancel: () => setInput(key, 0),
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4">
      {/* Top EVA Action Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-11 sm:pt-12">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-slate-950/78 backdrop-blur-xl border border-cyan-400/35 rounded-full px-3 py-1.5 shadow-xl">
          <div className="flex items-center gap-1.5 pr-2 border-r border-white/10">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-mono font-bold text-cyan-100 uppercase">
              {activeCharacterName}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 pr-2 border-r border-white/10 text-[10px] font-mono text-slate-300">
            <span>VEL {speedFormatted}</span>
            <span className="text-slate-500">·</span>
            <span className="text-amber-200">{nearestBodyName}</span>
          </div>

          <button
            onClick={onToggleVisorLight}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              visorLightOn
                ? 'bg-sky-500/25 border-sky-400/50 text-sky-100'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
            }`}
            title="Lanterna do Capacete (L)"
          >
            <Lightbulb className="w-3 h-3" />
            <span className="hidden sm:inline">Lanterna</span>
          </button>

          <button
            onClick={onTriggerRadarScan}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-[11px] font-medium transition-colors"
            title="Escanear Balizas / Área (R)"
          >
            <Radar className="w-3 h-3" />
            <span className="hidden sm:inline">Escanear</span>
          </button>

          <button
            onClick={onRecenterCamera}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 text-[11px] transition-colors"
            title="Centralizar Câmera (C)"
          >
            <Compass className="w-3 h-3" />
          </button>

          <button
            onClick={onEnterShip}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/55 text-amber-100 text-[11px] font-semibold transition-colors"
            title="Embarcar na Nave Caça Estelar"
          >
            <Rocket className="w-3.5 h-3.5 text-amber-300" />
            <span>Entrar na Nave</span>
          </button>

          {onWalkOnStation && (
            <button
              onClick={onWalkOnStation}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/55 text-sky-100 text-[11px] font-semibold transition-colors"
              title="Pousar sobre o deck da Estação Espacial em Órbita da Terra"
            >
              <span>Estação Orbital</span>
            </button>
          )}

          <button
            onClick={() => setShowTouchControls((v) => !v)}
            className={`sm:hidden p-1.5 rounded-full border transition-colors ${
              showTouchControls
                ? 'bg-sky-500/30 border-sky-400 text-white'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
            title="Controles Touch"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onExitToExplorer}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 text-[11px] transition-colors"
            title="Voltar ao Observatório"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>

        <button
          onClick={onOpenMenu}
          className="pointer-events-auto hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/78 hover:bg-slate-900 backdrop-blur-xl border border-white/15 text-xs text-slate-200 transition-colors"
        >
          <span>Menu (M)</span>
        </button>
      </div>

      {/* Bottom EVA Touch Pad + Clean Keyboard Key Hint Strip */}
      <div className="flex flex-col items-center gap-2">
        {showTouchControls && (
          <div className="pointer-events-auto w-full flex items-end justify-between gap-4 px-2">
            {/* Walk D-Pad */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950/80 backdrop-blur-xl p-2 rounded-2xl border border-cyan-400/30 shadow-xl">
              <div />
              <button
                {...holdAxis('moveZ', -1)}
                className="w-11 h-11 rounded-xl bg-white/10 active:bg-sky-500/50 flex items-center justify-center text-white"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <div />
              <button
                {...holdAxis('moveX', -1)}
                className="w-11 h-11 rounded-xl bg-white/10 active:bg-sky-500/50 flex items-center justify-center text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                {...holdAxis('moveZ', 1)}
                className="w-11 h-11 rounded-xl bg-white/10 active:bg-sky-500/50 flex items-center justify-center text-white"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <button
                {...holdAxis('moveX', 1)}
                className="w-11 h-11 rounded-xl bg-white/10 active:bg-sky-500/50 flex items-center justify-center text-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Vertical Zero-G & Jetpack Sprint */}
            <div className="flex flex-col gap-1.5 bg-slate-950/80 backdrop-blur-xl p-2 rounded-2xl border border-cyan-400/30 shadow-xl">
              <button
                {...holdAxis('moveY', 1)}
                className="px-4 py-2.5 rounded-xl bg-cyan-500/25 active:bg-cyan-500/60 text-xs font-mono font-bold text-cyan-100"
              >
                SUBIR
              </button>
              <button
                onPointerDown={() => setInput('sprint', true)}
                onPointerUp={() => setInput('sprint', false)}
                onPointerLeave={() => setInput('sprint', false)}
                className="px-4 py-2.5 rounded-xl bg-amber-500/30 active:bg-amber-500/60 text-xs font-mono font-bold text-amber-100 flex items-center justify-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>TURBO</span>
              </button>
              <button
                {...holdAxis('moveY', -1)}
                className="px-4 py-2.5 rounded-xl bg-white/10 active:bg-sky-500/50 text-xs font-mono font-bold text-slate-200"
              >
                DESCER
              </button>
            </div>
          </div>
        )}

        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 bg-slate-950/70 backdrop-blur-lg border border-white/10 rounded-full px-3.5 py-1 text-[10px] font-mono text-slate-300 shadow-lg">
          <span>
            <strong className="text-cyan-300">W A S D</strong> Mover
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <strong className="text-amber-300">Shift</strong> Propulsor / Correr
          </span>
          <span className="text-slate-600">·</span>
          <span>
            <strong className="text-sky-300">Espaço / Ctrl</strong> Subir / Descer
          </span>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            <strong className="text-emerald-300">Arrastar Mouse</strong> Olhar 360°
          </span>
        </div>
      </div>
    </div>
  );
};
