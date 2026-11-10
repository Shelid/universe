import React from 'react';
import { FastForward, Info, Pause, Play, Sparkles } from 'lucide-react';
import { WarpFlightState } from '../types/astronomy';

interface WarpOverlayHUDProps {
  warpState: WarpFlightState;
  onUpdateWarpState: React.Dispatch<React.SetStateAction<WarpFlightState>>;
}

export const WarpOverlayHUD: React.FC<WarpOverlayHUDProps> = ({
  warpState,
  onUpdateWarpState,
}) => {
  if (!warpState.isActive) return null;

  const pct = Math.round(warpState.progress * 100);

  return (
    <div className="fixed inset-x-0 bottom-8 z-40 flex flex-col items-center pointer-events-none px-4">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl bg-slate-950/85 backdrop-blur-2xl border border-sky-400/50 p-4 shadow-[0_0_50px_rgba(56,189,248,0.35)] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/25 border border-sky-400 flex items-center justify-center text-sky-300 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400">
                Transição Interplanetária Cinematográfica • Destino: {warpState.targetName}
              </div>
              <div className="text-sm font-display font-bold text-white">
                {warpState.stageLabel}
              </div>
            </div>
          </div>

          <div className="text-right font-mono">
            <div className="text-xs text-sky-300 font-bold">{pct}%</div>
            <div className="text-[10px] text-slate-400">
              Distância: {warpState.distanceAU.toFixed(2)} UA (
              {(warpState.distanceKm / 1_000_000).toFixed(1)} milhões km)
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-cyan-300 to-indigo-400 transition-all duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Scientific Integrity Notice + Flight Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-400/30 px-2.5 py-1 rounded-lg">
            <Info className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>
              <strong>Nota Científica:</strong> Dobra espacial é artística. Na velocidade real da
              luz (<em>c</em>), esta viagem levaria{' '}
              <strong className="text-white">{warpState.lightTravelTimeFormatted}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() =>
                onUpdateWarpState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium"
            >
              {warpState.isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" /> Retomar
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pausar
                </>
              )}
            </button>

            {([1, 2, 5] as const).map((spd) => (
              <button
                key={spd}
                onClick={() =>
                  onUpdateWarpState((prev) => ({ ...prev, speedMultiplier: spd }))
                }
                className={`px-2 py-1 rounded-lg text-xs font-mono border ${
                  warpState.speedMultiplier === spd
                    ? 'bg-sky-500/30 border-sky-400 text-white'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}

            <button
              onClick={() =>
                onUpdateWarpState((prev) => ({
                  ...prev,
                  isActive: false,
                  progress: 1,
                  stage: 'IDLE',
                }))
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Chegar Agora</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

