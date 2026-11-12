import React from 'react';
import { SceneBootProgress } from '../types/astronomy';
import { ResolvedQualityTier } from '../utils/performanceProfile';
import { UniverseLogo } from './UniverseLogo';

interface LoadingScreenProps {
  bootProgress: SceneBootProgress;
  resolvedTier: ResolvedQualityTier;
  isFadingOut: boolean;
  isReconfiguring?: boolean;
}

const COSMIC_DECOR_STARS = [
  { left: '8%', top: '14%', size: 2, opacity: 0.55 },
  { left: '16%', top: '76%', size: 1.5, opacity: 0.45 },
  { left: '22%', top: '28%', size: 2.5, opacity: 0.7 },
  { left: '29%', top: '86%', size: 2, opacity: 0.5 },
  { left: '38%', top: '12%', size: 1.5, opacity: 0.6 },
  { left: '49%', top: '9%', size: 2, opacity: 0.45 },
  { left: '63%', top: '16%', size: 2.5, opacity: 0.65 },
  { left: '72%', top: '81%', size: 2, opacity: 0.55 },
  { left: '79%', top: '24%', size: 1.5, opacity: 0.5 },
  { left: '86%', top: '65%', size: 2.5, opacity: 0.7 },
  { left: '91%', top: '19%', size: 2, opacity: 0.6 },
  { left: '13%', top: '48%', size: 2, opacity: 0.4 },
  { left: '88%', top: '44%', size: 1.5, opacity: 0.45 },
  { left: '44%', top: '89%', size: 2, opacity: 0.5 },
];

const TIER_LABEL_MAP: Record<ResolvedQualityTier, string> = {
  low: 'Modo Leve (Mobile / GPU Básica)',
  medium: 'Modo Equilibrado (Fluido)',
  high: 'Modo Ultra 4K (GPU Dedicada)',
};

/**
 * Tela de carregamento cinematográfica inicial com emblema animado,
 * telemetria real de pré-carregamento de texturas NASA/VRAM e compilação WebGL.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  bootProgress,
  resolvedTier,
  isFadingOut,
  isReconfiguring = false,
}) => {
  const clampedPct = Math.max(0, Math.min(100, Math.round(bootProgress.progress)));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando Universe Explorer"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#02040a] px-5 transition-all duration-700 ease-out ${
        isFadingOut ? 'opacity-0 scale-[1.03] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle deep-space radial nebula glow (zero heavy canvas overhead during texture upload) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(14, 116, 144, 0.22) 0%, rgba(30, 58, 138, 0.14) 34%, rgba(2, 4, 10, 0.98) 76%)',
        }}
        aria-hidden="true"
      />

      {/* Lightweight starfield accents */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {COSMIC_DECOR_STARS.map((star, idx) => (
          <span
            key={idx}
            className="absolute rounded-full bg-sky-100"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              boxShadow: '0 0 8px rgba(125, 211, 252, 0.7)',
            }}
          />
        ))}
      </div>

      {/* Concentric astrometry orbital backdrop ring */}
      <div
        className="pointer-events-none absolute w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] rounded-full border border-sky-400/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute w-[460px] h-[460px] sm:w-[660px] sm:h-[660px] rounded-full border border-indigo-400/5"
        aria-hidden="true"
      />

      {/* Central brand + real progress telemetry module */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <UniverseLogo size="hero" animated className="mb-5" />

        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-3 py-1 mb-3 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-sky-300">
            {isReconfiguring ? 'Otimizando Motor 3D' : 'Observatório Espacial 3D'}
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-[0.14em] text-white drop-shadow-[0_4px_24px_rgba(56,189,248,0.28)]">
          UNIVERSE{' '}
          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-indigo-400 bg-clip-text text-transparent">
            EXPLORER
          </span>
        </h1>

        <p className="mt-2 text-[11px] sm:text-xs font-mono tracking-[0.18em] text-slate-400 uppercase">
          Escala Real 1:1 • Via Láctea 3D • Nave SR-7
        </p>

        {/* Glassmorphic live telemetry progress panel */}
        <div className="mt-8 w-full rounded-2xl border border-white/12 bg-slate-950/80 p-4 sm:p-5 shadow-[0_20px_60px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 text-xs mb-2.5">
            <span className="font-medium text-slate-200 truncate text-left">
              {bootProgress.stage}
            </span>
            <span className="font-mono font-semibold text-sky-300 shrink-0 tabular-nums">
              {clampedPct}%
            </span>
          </div>

          {/* Precision illuminated progress bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/10">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-indigo-400 transition-[width] duration-300 ease-out shadow-[0_0_16px_rgba(56,189,248,0.75)]"
              style={{ width: `${clampedPct}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-1/2 animate-universe-shimmer" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
            <span className="truncate max-w-[230px] text-left text-slate-300">
              {bootProgress.detail}
            </span>
            {bootProgress.totalTextures > 0 && (
              <span className="text-sky-300/90 shrink-0 tabular-nums">
                {bootProgress.loadedTextures}/{bootProgress.totalTextures} texturas
              </span>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="text-amber-300/90">Escala Física 1:1</span>
            <span className="text-slate-300 truncate">{TIER_LABEL_MAP[resolvedTier]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

