import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Compass,
  Gauge,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Rocket,
  Search,
  SlidersHorizontal,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ALL_CELESTIAL_BODIES } from '../data/solarSystemData';
import { CelestialBodyData } from '../types/astronomy';
import { QualityPreference, ResolvedQualityTier } from '../utils/performanceProfile';
import { UniverseLogo } from './UniverseLogo';

export type ActivePlayerMode = 'EXPLORE' | 'SPACECRAFT' | 'EVA';
export type CommandMenuTab = 'travel' | 'missions' | 'encyclopedia' | 'system';

interface GameCommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  playerMode: ActivePlayerMode;
  onSwitchMode: (mode: ActivePlayerMode) => void;
  selectedBody: CelestialBodyData;
  onSelectBody: (bodyId: string, triggerWarp?: boolean) => void;
  onOpenDossier: () => void;
  onOpenMissions: () => void;
  onOpenEarthSurface: () => void;
  isExploringInterior: boolean;
  onToggleInterior: () => void;
  venusRadarMode: boolean;
  onToggleVenusRadar: () => void;
  saturnRingDiveMode: boolean;
  onToggleSaturnRingDive: () => void;
  timeSpeedDaysPerSec: number;
  onChangeTimeSpeed: (speed: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  showOrbits: boolean;
  onToggleOrbits: (v: boolean) => void;
  showLabels: boolean;
  onToggleLabels: (v: boolean) => void;
  showAsteroidBelt: boolean;
  onToggleAsteroidBelt: (v: boolean) => void;
  showMissionTrajectories: boolean;
  onToggleMissionTrajectories: (v: boolean) => void;
  cinematicTravelEnabled: boolean;
  onToggleCinematicTravel: (v: boolean) => void;
  qualityPreference: QualityPreference;
  resolvedQualityTier: ResolvedQualityTier;
  onChangeQuality: (q: QualityPreference) => void;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
  audioVolume: number;
  onChangeAudioVolume: (vol0to100: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

type CategoryFilter = 'ALL' | 'PLANETS' | 'MOONS' | 'SMALL' | 'GALAXIES';

export const GameCommandMenu: React.FC<GameCommandMenuProps> = ({
  isOpen,
  onClose,
  playerMode,
  onSwitchMode,
  selectedBody,
  onSelectBody,
  onOpenDossier,
  onOpenMissions,
  onOpenEarthSurface,
  isExploringInterior,
  onToggleInterior,
  venusRadarMode,
  onToggleVenusRadar,
  saturnRingDiveMode,
  onToggleSaturnRingDive,
  timeSpeedDaysPerSec,
  onChangeTimeSpeed,
  isPaused,
  onTogglePause,
  showOrbits,
  onToggleOrbits,
  showLabels,
  onToggleLabels,
  showAsteroidBelt,
  onToggleAsteroidBelt,
  showMissionTrajectories,
  onToggleMissionTrajectories,
  cinematicTravelEnabled,
  onToggleCinematicTravel,
  qualityPreference,
  resolvedQualityTier,
  onChangeQuality,
  isAudioMuted,
  onToggleAudioMuted,
  audioVolume,
  onChangeAudioVolume,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [activeTab, setActiveTab] = useState<CommandMenuTab>('travel');
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState<CategoryFilter>('ALL');

  const filteredBodies = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return ALL_CELESTIAL_BODIES.filter((b) => {
      const catMatch =
        catFilter === 'ALL'
          ? true
          : catFilter === 'PLANETS'
            ? b.category === 'star' || b.category === 'planet'
            : catFilter === 'MOONS'
              ? b.category === 'moon'
              : catFilter === 'SMALL'
                ? b.category === 'dwarf_planet' || b.category === 'asteroid' || b.category === 'comet'
                : b.category === 'galaxy';

      if (!catMatch) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.englishName.toLowerCase().includes(q) ||
        b.ClassificationLabel.toLowerCase().includes(q)
      );
    });
  }, [catFilter, searchTerm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-3 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[88vh] bg-slate-950/92 backdrop-blur-2xl border border-sky-400/25 rounded-3xl shadow-[0_24px_80px_rgba(2,6,23,0.95)] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-sky-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UniverseLogo
              size="sm"
              animated={false}
              className="w-9 h-9 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.35)]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-display font-bold tracking-wider text-white">
                  CENTRAL COSMOS
                </h2>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/35 text-sky-200">
                  {playerMode === 'SPACECRAFT'
                    ? 'Caça Estelar'
                    : playerMode === 'EVA'
                      ? 'Astronauta EVA'
                      : 'Observatório'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Navegue pelo sistema solar, explore missões reais ou alterne entre Nave e Astronauta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Fechar Menu (Esc ou M)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Quick Selector Bar */}
        <div className="px-5 py-2.5 bg-slate-900/50 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">Modo Atual:</span>
            {[
              { id: 'EXPLORE' as const, label: 'Explorar Cosmos', icon: Globe },
              { id: 'SPACECRAFT' as const, label: 'Pilotar Nave', icon: Rocket },
              { id: 'EVA' as const, label: 'Astronauta (EVA)', icon: User },
            ].map((m) => {
              const Icon = m.icon;
              const active = playerMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onSwitchMode(m.id);
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    active
                      ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-[0_0_16px_rgba(56,189,248,0.4)]'
                      : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Foco: <span className="text-sky-300 font-semibold">{selectedBody.name}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-white/10 bg-slate-900/30 text-xs font-medium">
          {[
            { id: 'travel' as const, label: 'Mapa & Viagem', icon: Compass },
            { id: 'missions' as const, label: 'Missões & Voo', icon: Rocket },
            { id: 'encyclopedia' as const, label: 'Enciclopédia', icon: BookOpen },
            { id: 'system' as const, label: 'Sistema & Áudio', icon: SlidersHorizontal },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 py-3 border-b-2 transition-all ${
                  active
                    ? 'border-sky-400 text-white bg-sky-500/10 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-sky-400' : ''}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'travel' && (
            <>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 flex items-center bg-slate-900/90 border border-white/15 focus-within:border-sky-400 rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar planeta, lua, asteroide ou galáxia..."
                    className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-xs text-slate-400 hover:text-white ml-2"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'ALL' as const, label: 'Todos' },
                    { id: 'PLANETS' as const, label: 'Planetas' },
                    { id: 'MOONS' as const, label: 'Luas' },
                    { id: 'SMALL' as const, label: 'Asteroides' },
                    { id: 'GALAXIES' as const, label: 'Galáxias' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setCatFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        catFilter === f.id
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filteredBodies.map((body) => {
                  const isCurrent = selectedBody.id === body.id;
                  return (
                    <button
                      key={body.id}
                      onClick={() => {
                        onSelectBody(body.id, true);
                        onClose();
                      }}
                      className={`text-left p-3 rounded-2xl border transition-all flex items-center gap-3 ${
                        isCurrent
                          ? 'bg-sky-500/20 border-sky-400/70 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                          : 'bg-slate-900/70 hover:bg-slate-800/80 border-white/10 hover:border-sky-400/40'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 border border-white/25"
                        style={{
                          backgroundColor: body.primaryColorHex,
                          boxShadow: `0 0 12px ${body.primaryColorHex}`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-semibold text-white truncate">
                          {body.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {body.ClassificationLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'missions' && (
            <div className="space-y-4">
              {/* Historical & Active NASA/ESA Missions Card */}
              <div className="bg-gradient-to-br from-sky-950/50 via-slate-900/90 to-indigo-950/50 border border-sky-400/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-lg">
                  <h3 className="text-sm sm:text-base font-display font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    Missões Históricas &amp; Sondas Reais (NASA / ESA)
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Explore trajetórias espaciais autênticas em 3D de Voyager 1 e 2, Apollo 11, Telescópio James Webb, Cassini e sondas interplanetárias pelo Sistema Solar.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenMissions();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 border border-sky-300 text-slate-950 text-xs font-bold shadow-[0_0_20px_rgba(56,189,248,0.3)] transition-colors"
                >
                  Explorar Missões NASA/ESA
                </button>
              </div>

              {/* Spacecraft & EVA Quick Deployment Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-amber-300 text-sm font-semibold">
                      <Rocket className="w-4 h-4" />
                      <span>Voo Espacial Livre &amp; Cabine 3D</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Pilote o Caça Estelar em física espacial realista com vidro transparente de cabine e visão 360° pelo cosmos.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSwitchMode('SPACECRAFT');
                      onClose();
                    }}
                    className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-semibold transition-colors"
                  >
                    Pilotar Nave
                  </button>
                </div>

                <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-300 text-sm font-semibold">
                      <User className="w-4 h-4" />
                      <span>Caminhada Espacial EVA (Astronauta)</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Controle o Astronauta articulado ao lado da nave estacionada em órbita com lanterna de capacete e jetpack RCS.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSwitchMode('EVA');
                      onClose();
                    }}
                    className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-200 text-xs font-semibold transition-colors"
                  >
                    Sair em EVA
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'encyclopedia' && (
            <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-5 h-5 rounded-full border border-white/30"
                    style={{
                      backgroundColor: selectedBody.primaryColorHex,
                      boxShadow: `0 0 14px ${selectedBody.primaryColorHex}`,
                    }}
                  />
                  <div>
                    <div className="text-[10px] font-mono uppercase text-sky-400">
                      {selectedBody.ClassificationLabel}
                    </div>
                    <h3 className="text-lg font-display font-bold text-white">{selectedBody.name}</h3>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDossier();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Abrir Ficha Científica Completa</span>
                  </button>

                  <button
                    onClick={onToggleInterior}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      isExploringInterior
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                        : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedBody.category === 'galaxy' ? 'Estrutura 3D' : 'Corte Interior 3D'}</span>
                  </button>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {selectedBody.tagline}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-slate-950/80 border border-white/5 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400">DIÂMETRO</div>
                  <div className="text-white font-semibold mt-0.5">
                    {(selectedBody.meanRadiusKm * 2).toLocaleString('pt-BR')}{' '}
                    {selectedBody.category === 'galaxy' ? 'al' : 'km'}
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-white/5 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400">DISTÂNCIA SOLAR</div>
                  <div className="text-sky-300 font-semibold mt-0.5">
                    {selectedBody.distanceFromSunAU > 0
                      ? `${selectedBody.distanceFromSunAU} UA`
                      : selectedBody.distanceFromSunMeanKm.split('(')[0]}
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-white/5 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400">TEMPERATURA MÉDIA</div>
                  <div className="text-amber-300 font-semibold mt-0.5">
                    {selectedBody.temperatureMeanC.split('(')[0]}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedBody.id === 'earth' && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenEarthSurface();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-semibold"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Explorar Superfície de Satélite Nível 4</span>
                  </button>
                )}

                {selectedBody.id === 'venus' && (
                  <button
                    onClick={() => {
                      onToggleVenusRadar();
                      onClose();
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                      venusRadarMode
                        ? 'bg-orange-500/30 border-orange-400 text-orange-200'
                        : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                    }`}
                  >
                    {venusRadarMode ? 'Radar Magellan: ON' : 'Ativar Radar de Nuvens (Vênus)'}
                  </button>
                )}

                {selectedBody.id === 'saturn' && (
                  <button
                    onClick={() => {
                      onToggleSaturnRingDive();
                      onClose();
                    }}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-semibold ${
                      saturnRingDiveMode
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                        : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-200'
                    }`}
                  >
                    {saturnRingDiveMode ? 'Mergulho nos Anéis: ON' : 'Mergulhar nos Anéis de Saturno'}
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Time Speed & Layers */}
              <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="text-xs font-mono uppercase text-sky-300 font-semibold">
                  Simulação Orbital &amp; Camadas 3D
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={onTogglePause}
                    className="p-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/30"
                    title={isPaused ? 'Retomar' : 'Pausar'}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  {[
                    { label: 'Real 1x', val: 0 },
                    { label: '1h/s', val: 0.0416 },
                    { label: '1d/s', val: 1 },
                    { label: '15d/s', val: 15 },
                  ].map((spd) => (
                    <button
                      key={spd.label}
                      onClick={() => onChangeTimeSpeed(spd.val)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-mono border transition-all ${
                        !isPaused && timeSpeedDaysPerSec === spd.val
                          ? 'bg-sky-500/30 border-sky-400 text-white font-semibold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {spd.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  {[
                    { label: 'Linhas de Órbita 3D', val: showOrbits, set: onToggleOrbits },
                    { label: 'Nomes e Marcadores', val: showLabels, set: onToggleLabels },
                    { label: 'Cinturões de Asteroides', val: showAsteroidBelt, set: onToggleAsteroidBelt },
                    {
                      label: 'Trajetórias de Sondas',
                      val: showMissionTrajectories,
                      set: onToggleMissionTrajectories,
                    },
                    {
                      label: 'Viagem Cinematográfica em Dobra',
                      val: cinematicTravelEnabled,
                      set: onToggleCinematicTravel,
                    },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center justify-between text-xs text-slate-200 py-1.5 px-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="accent-sky-400 w-4 h-4"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Graphics, Audio & Controls Guide */}
              <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-sky-300 font-semibold flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" />
                    Qualidade Gráfica &amp; Áudio
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30">
                    {resolvedQualityTier === 'low'
                      ? 'Leve'
                      : resolvedQualityTier === 'medium'
                        ? 'Equilibrado'
                        : 'Ultra'}
                  </span>
                </div>

                <select
                  value={qualityPreference}
                  onChange={(e) => onChangeQuality(e.target.value as QualityPreference)}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="AUTO">Automático (Detectar Hardware)</option>
                  <option value="LOW">Leve (Celular / Notebook)</option>
                  <option value="MEDIUM">Equilibrado (Fluido)</option>
                  <option value="HIGH">Ultra Realista (GPU Dedicada)</option>
                </select>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={onToggleAudioMuted}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium ${
                      isAudioMuted
                        ? 'bg-white/5 border-white/10 text-slate-400'
                        : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                    }`}
                  >
                    {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span>{isAudioMuted ? 'Mudo' : 'Som Ativo'}</span>
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={audioVolume}
                    onChange={(e) => onChangeAudioVolume(Number(e.target.value))}
                    className="flex-1 accent-cyan-400 cursor-pointer"
                  />

                  <button
                    onClick={onToggleFullscreen}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-slate-200"
                    title="Tela Cheia"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                </div>

                <div className="bg-slate-950/80 border border-white/10 rounded-xl p-3 space-y-1.5 text-[11px] font-mono text-slate-300">
                  <div className="text-sky-300 font-semibold uppercase text-[10px]">
                    Resumo de Controles
                  </div>
                  <div>Nave: W/S Acele., A/D/Q/E Girar, Mouse Olhar, F/Botão Esq. Atirar, R Radar</div>
                  <div>Astronauta EVA: W/A/S/D Mover, Shift Propulsor/Correr, Espaço/Ctrl Subir/Descer, L Lanterna</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

