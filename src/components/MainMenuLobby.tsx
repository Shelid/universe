import React from 'react';
import {
  Check,
  Globe,
  Monitor,
  Play,
  Rocket,
  Satellite,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CHARACTER_CREW_CATALOG,
  SPACECRAFT_HANGAR_CATALOG,
} from '../data/hangarCatalog';
import { CharacterVariantId, SpacecraftVariantId } from '../types/astronomy';
import { QualityPreference, ResolvedQualityTier } from '../utils/performanceProfile';
import { UniverseLogo } from './UniverseLogo';

export type LobbyStartDestination = 'EXPLORE' | 'STATION_ORBIT' | 'SPACECRAFT_COCKPIT' | 'EVA_STATION';

interface MainMenuLobbyProps {
  isOpen: boolean;
  startDestination: LobbyStartDestination;
  onChangeStartDestination: (dest: LobbyStartDestination) => void;
  selectedShipId: SpacecraftVariantId;
  onSelectShip: (id: SpacecraftVariantId) => void;
  selectedCharacterId: CharacterVariantId;
  onSelectCharacter: (id: CharacterVariantId) => void;
  qualityPreference: QualityPreference;
  resolvedQualityTier: ResolvedQualityTier;
  onChangeQuality: (pref: QualityPreference) => void;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
  onStartGame: () => void;
}

const DESTINATION_OPTIONS: Array<{
  id: LobbyStartDestination;
  title: string;
  subtitle: string;
  icon: React.FC<{ className?: string }>;
  accentClass: string;
}> = [
  {
    id: 'EXPLORE',
    title: 'Explorar Universo',
    subtitle: 'Planetas, Luas & Via Láctea 1:1',
    icon: Globe,
    accentClass: 'border-sky-400 bg-sky-500/20 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.22)]',
  },
  {
    id: 'STATION_ORBIT',
    title: 'Estação Orbital',
    subtitle: 'Complexo 3D em Órbita da Terra',
    icon: Satellite,
    accentClass: 'border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.24)]',
  },
  {
    id: 'SPACECRAFT_COCKPIT',
    title: 'Pilotar Nave',
    subtitle: 'Decolar na Cabine 4K 6-DOF',
    icon: Rocket,
    accentClass: 'border-amber-400 bg-amber-500/20 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.22)]',
  },
  {
    id: 'EVA_STATION',
    title: 'Astronauta (EVA)',
    subtitle: 'Caminhar sobre a Estação',
    icon: User,
    accentClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.22)]',
  },
];

export const MainMenuLobby: React.FC<MainMenuLobbyProps> = ({
  isOpen,
  startDestination,
  onChangeStartDestination,
  selectedShipId,
  onSelectShip,
  selectedCharacterId,
  onSelectCharacter,
  qualityPreference,
  resolvedQualityTier,
  onChangeQuality,
  isAudioMuted,
  onToggleAudioMuted,
  onStartGame,
}) => {
  if (!isOpen) return null;

  const activeShip =
    SPACECRAFT_HANGAR_CATALOG.find((s) => s.id === selectedShipId) ||
    SPACECRAFT_HANGAR_CATALOG[0];
  const activeChar =
    CHARACTER_CREW_CATALOG.find((c) => c.id === selectedCharacterId) ||
    CHARACTER_CREW_CATALOG[0];
  const activeDest =
    DESTINATION_OPTIONS.find((d) => d.id === startDestination) || DESTINATION_OPTIONS[0];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col sm:flex-row justify-between">
      {/* Subtle left cinematic vignette gradient so text pops while keeping 3D ship & astronaut vivid */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full sm:w-[560px] bg-gradient-to-r from-[#020612]/90 via-[#020612]/55 to-transparent"
        aria-hidden="true"
      />

      {/* Left AAA Pre-Game Hangar Command Sidebar */}
      <aside className="pointer-events-auto relative z-10 w-full sm:w-[430px] lg:w-[465px] h-full sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:my-4 sm:ml-4 bg-[#050a16]/86 sm:bg-[#050a16]/82 backdrop-blur-2xl border-r sm:border border-sky-400/30 sm:rounded-3xl shadow-[0_24px_90px_rgba(0,0,0,0.92)] flex flex-col overflow-hidden">
        {/* Game Brand Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 bg-gradient-to-r from-slate-950/90 via-sky-950/35 to-slate-950/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <UniverseLogo
              size="sm"
              animated
              className="w-10 h-10 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.45)] shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-sky-300">
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Simulador Espacial 1:1</span>
              </div>
              <h1 className="text-base sm:text-lg font-display font-bold tracking-wider text-white truncate">
                UNIVERSE EXPLORER
              </h1>
            </div>
          </div>

          <button
            onClick={onToggleAudioMuted}
            className={`p-2 rounded-xl border transition-all shrink-0 ${
              isAudioMuted
                ? 'bg-slate-900/90 border-white/10 text-slate-400 hover:text-white'
                : 'bg-emerald-500/18 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/30'
            }`}
            title={isAudioMuted ? 'Ativar Áudio Espacial' : 'Silenciar Áudio'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Interactive Pre-Game Setup Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-4">
          {/* 1. MODO DE INÍCIO */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <span>1. Escolher Experiência Inicial</span>
              <span className="text-sky-300 font-semibold">{activeDest.title}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DESTINATION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = startDestination === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onChangeStartDestination(opt.id)}
                    className={`text-left p-2.5 rounded-2xl border transition-all flex flex-col gap-1 ${
                      active
                        ? opt.accentClass
                        : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4" />
                      {active && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-xs font-bold leading-tight mt-0.5">{opt.title}</div>
                    <div className="text-[10px] opacity-75 leading-snug">{opt.subtitle}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. ESCOLHER NAVE (LIVE 3D PREVIEW) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <span>2. Escolher Nave (Ao Vivo 3D)</span>
              <span className="font-semibold" style={{ color: activeShip.accentHex }}>
                {activeShip.codename}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SPACECRAFT_HANGAR_CATALOG.map((ship) => {
                const active = ship.id === selectedShipId;
                return (
                  <button
                    key={ship.id}
                    onClick={() => onSelectShip(ship.id)}
                    className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      active
                        ? 'bg-slate-900 border-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.22)]'
                        : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: ship.accentHex,
                          boxShadow: `0 0 8px ${ship.accentHex}`,
                        }}
                      />
                      <span className="text-[9px] font-mono text-slate-400 uppercase">
                        VEL {ship.stats.speed}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-white leading-tight truncate">
                      {ship.name}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">{ship.role}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. ESCOLHER PERSONAGEM / ASTRONAUTA (LIVE 3D PREVIEW) */}
          <section className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <span>3. Escolher Astronauta (Ao Vivo 3D)</span>
              <span className="font-semibold" style={{ color: activeChar.accentHex }}>
                {activeChar.callsign}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {CHARACTER_CREW_CATALOG.map((char) => {
                const active = char.id === selectedCharacterId;
                return (
                  <button
                    key={char.id}
                    onClick={() => onSelectCharacter(char.id)}
                    className={`p-2 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      active
                        ? 'bg-slate-900 border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.22)]'
                        : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: char.accentHex,
                          boxShadow: `0 0 8px ${char.accentHex}`,
                        }}
                      />
                      <span className="text-[9px] font-mono text-slate-400 uppercase">
                        EVA {char.stats.evaThrust}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-white leading-tight truncate">
                      {char.name}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">{char.suitName}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. GRÁFICOS RÁPIDOS */}
          <section className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>Qualidade Gráfica</span>
              </span>
              <span className="text-emerald-300 font-bold">
                {resolvedQualityTier === 'high'
                  ? '4K ULTRA ALTA'
                  : resolvedQualityTier === 'medium'
                    ? 'MÉDIA'
                    : 'LEVE'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'AUTO' as const, label: 'Auto' },
                { id: 'HIGH' as const, label: 'Alta 4K' },
                { id: 'MEDIUM' as const, label: 'Média' },
                { id: 'LOW' as const, label: 'Leve' },
              ].map((q) => {
                const active = qualityPreference === q.id;
                return (
                  <button
                    key={q.id}
                    onClick={() => onChangeQuality(q.id)}
                    className={`py-1.5 rounded-xl border text-[11px] font-semibold transition-all ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                        : 'bg-slate-950/75 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Hero Launch Action */}
        <div className="p-4 sm:px-5 sm:py-4 border-t border-white/10 bg-slate-950/90 space-y-2">
          <button
            onClick={onStartGame}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400 hover:brightness-110 active:scale-[0.99] text-slate-950 font-display font-bold text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-[0_0_32px_rgba(56,189,248,0.45)] transition-all"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Iniciar Missão</span>
          </button>
          <p className="text-[10px] font-mono text-center text-slate-400 truncate">
            {activeShip.name} · {activeChar.name} · {activeDest.title}
          </p>
        </div>
      </aside>

      {/* Live 3D Showcase Telemetry Pill on Right Corner (never blocks 3D Ship & Astronaut center-right) */}
      <div className="pointer-events-none hidden md:flex flex-col items-end justify-between p-5 z-10">
        <div className="bg-slate-950/72 backdrop-blur-xl border border-white/12 rounded-2xl px-4 py-2.5 text-right shadow-xl">
          <div className="text-[10px] font-mono uppercase tracking-widest text-sky-400">
            Visualização Ao Vivo em Órbita da Terra
          </div>
          <div className="text-xs font-bold text-white mt-0.5">
            {activeShip.name} <span className="text-slate-500">·</span>{' '}
            <span className="text-cyan-300">{activeChar.name}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Arraste o mouse na área à direita para inspecionar sua nave e astronauta em 360°
          </div>
        </div>

        <div className="bg-slate-950/65 backdrop-blur-md border border-white/10 rounded-full px-3.5 py-1.5 text-[10px] font-mono text-slate-300">
          TECLA <span className="text-sky-300 font-bold">M</span> DURANTE O JOGO ABRE O MENU COMPLETO
        </div>
      </div>
    </div>
  );
};

