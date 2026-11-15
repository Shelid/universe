import React, { useState } from 'react';
import {
  Check,
  Eye,
  Globe,
  Maximize2,
  Minimize2,
  Monitor,
  Play,
  Rocket,
  Satellite,
  SlidersHorizontal,
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
import { HangarCameraFocus } from '../utils/hangarBayModel';
import { FlightControlPrefs } from '../utils/flightControlPrefs';
import { QualityPreference, ResolvedQualityTier } from '../utils/performanceProfile';
import { UniverseLogo } from './UniverseLogo';

export type LobbyStartDestination = 'EXPLORE' | 'STATION_ORBIT' | 'SPACECRAFT_COCKPIT' | 'EVA_STATION';
type HangarMenuTab = 'mission' | 'ships' | 'character' | 'settings';

interface MainMenuLobbyProps {
  isOpen: boolean;
  startDestination: LobbyStartDestination;
  onChangeStartDestination: (dest: LobbyStartDestination) => void;
  selectedShipId: SpacecraftVariantId;
  onSelectShip: (id: SpacecraftVariantId) => void;
  selectedCharacterId: CharacterVariantId;
  onSelectCharacter: (id: CharacterVariantId) => void;
  lobbyFocusTarget: HangarCameraFocus;
  onChangeLobbyFocusTarget: (focus: HangarCameraFocus) => void;
  qualityPreference: QualityPreference;
  resolvedQualityTier: ResolvedQualityTier;
  onChangeQuality: (pref: QualityPreference) => void;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
  audioVolume: number;
  onChangeAudioVolume: (vol: number) => void;
  flightControlPrefs: FlightControlPrefs;
  onChangeFlightControlPrefs: (prefs: FlightControlPrefs) => void;
  showOrbits: boolean;
  onToggleOrbits: (v: boolean) => void;
  showLabels: boolean;
  onToggleLabels: (v: boolean) => void;
  showAsteroidBelt: boolean;
  onToggleAsteroidBelt: (v: boolean) => void;
  cinematicTravelEnabled: boolean;
  onToggleCinematicTravel: (v: boolean) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
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
    subtitle: 'Vista Externa 3D em Órbita da Terra',
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
    subtitle: 'Flutuar no Exterior da Estação',
    icon: User,
    accentClass: 'border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.22)]',
  },
];

const StatBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="space-y-0.5">
    <div className="flex items-center justify-between text-[10px] font-mono">
      <span className="text-slate-400 uppercase">{label}</span>
      <span className="font-bold text-slate-200">{value}</span>
    </div>
    <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(8, value))}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

export const MainMenuLobby: React.FC<MainMenuLobbyProps> = ({
  isOpen,
  startDestination,
  onChangeStartDestination,
  selectedShipId,
  onSelectShip,
  selectedCharacterId,
  onSelectCharacter,
  lobbyFocusTarget,
  onChangeLobbyFocusTarget,
  qualityPreference,
  resolvedQualityTier,
  onChangeQuality,
  isAudioMuted,
  onToggleAudioMuted,
  audioVolume,
  onChangeAudioVolume,
  flightControlPrefs,
  onChangeFlightControlPrefs,
  showOrbits,
  onToggleOrbits,
  showLabels,
  onToggleLabels,
  showAsteroidBelt,
  onToggleAsteroidBelt,
  cinematicTravelEnabled,
  onToggleCinematicTravel,
  isFullscreen,
  onToggleFullscreen,
  onStartGame,
}) => {
  const [activeTab, setActiveTab] = useState<HangarMenuTab>('mission');

  if (!isOpen) return null;

  const activeShip =
    SPACECRAFT_HANGAR_CATALOG.find((s) => s.id === selectedShipId) ||
    SPACECRAFT_HANGAR_CATALOG[0];
  const activeChar =
    CHARACTER_CREW_CATALOG.find((c) => c.id === selectedCharacterId) ||
    CHARACTER_CREW_CATALOG[0];
  const activeDest =
    DESTINATION_OPTIONS.find((d) => d.id === startDestination) || DESTINATION_OPTIONS[0];

  const handleTabSelect = (tab: HangarMenuTab) => {
    setActiveTab(tab);
    if (tab === 'ships') {
      onChangeLobbyFocusTarget('SHIP');
    } else if (tab === 'character') {
      onChangeLobbyFocusTarget('CHARACTER');
    } else if (tab === 'mission') {
      onChangeLobbyFocusTarget('OVERVIEW');
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col sm:flex-row justify-between">
      {/* Subtle left studio vignette gradient so Hangar text reads crisply while 3D Galpão gleams on right */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full sm:w-[540px] bg-gradient-to-r from-[#040812]/88 via-[#040812]/48 to-transparent"
        aria-hidden="true"
      />

      {/* Left AAA Pre-Game Hangar Command Menu */}
      <aside className="pointer-events-auto relative z-10 w-full sm:w-[430px] lg:w-[465px] h-full sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:my-4 sm:ml-4 bg-[#050a16]/88 sm:bg-[#050a16]/84 backdrop-blur-2xl border-r sm:border border-sky-400/30 sm:rounded-3xl shadow-[0_24px_90px_rgba(0,0,0,0.92)] flex flex-col overflow-hidden">
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
                <span>Hangar de Preparação 3D</span>
              </div>
              <h1 className="text-base sm:text-lg font-display font-bold tracking-wider text-white truncate">
                UNIVERSE EXPLORER
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl border bg-slate-900/90 border-white/10 text-slate-300 hover:text-white hover:border-white/25 transition-all"
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
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
        </div>

        {/* Hangar Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 px-3 py-2 border-b border-white/10 bg-slate-950/65">
          {([
            { id: 'mission', label: 'Missão', icon: Globe },
            { id: 'ships', label: 'Naves', icon: Rocket },
            { id: 'character', label: 'Personagem', icon: User },
            { id: 'settings', label: 'Config.', icon: SlidersHorizontal },
          ] as Array<{ id: HangarMenuTab; label: string; icon: React.FC<{ className?: string }> }>).map(
            (tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabSelect(tab.id)}
                  className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                    active
                      ? 'bg-sky-500/22 border-sky-400/70 text-white shadow-[0_0_14px_rgba(56,189,248,0.2)]'
                      : 'bg-white/[0.03] border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-sky-300' : ''}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            }
          )}
        </div>

        {/* Tab Content Scroll Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3.5 space-y-3.5">
          {activeTab === 'mission' && (
            <>
              <section className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <span>Ponto de Partida</span>
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

              {/* Active Kit Summary Cards (Click jumps straight to Ship / Character tab) */}
              <section className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Equipamento Pronto no Galpão
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleTabSelect('ships')}
                    className="p-3 rounded-2xl border border-white/10 bg-slate-900/75 hover:border-sky-400/50 text-left flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: activeShip.accentHex,
                          boxShadow: `0 0 10px ${activeShip.accentHex}`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase text-slate-400">Nave Estelar</div>
                        <div className="text-xs font-bold text-white truncate">{activeShip.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{activeShip.role}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-sky-300 shrink-0">Trocar →</span>
                  </button>

                  <button
                    onClick={() => handleTabSelect('character')}
                    className="p-3 rounded-2xl border border-white/10 bg-slate-900/75 hover:border-cyan-400/50 text-left flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: activeChar.accentHex,
                          boxShadow: `0 0 10px ${activeChar.accentHex}`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase text-slate-400">Comandante / EVA</div>
                        <div className="text-xs font-bold text-white truncate">{activeChar.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{activeChar.suitName}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-300 shrink-0">Trocar →</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {activeTab === 'ships' && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Frota no Galpão (Ao Vivo 3D)</span>
                <span className="font-semibold" style={{ color: activeShip.accentHex }}>
                  {activeShip.codename}
                </span>
              </div>
              <div className="space-y-2">
                {SPACECRAFT_HANGAR_CATALOG.map((ship) => {
                  const active = ship.id === selectedShipId;
                  return (
                    <button
                      key={ship.id}
                      onClick={() => {
                        onSelectShip(ship.id);
                        onChangeLobbyFocusTarget('SHIP');
                      }}
                      className={`w-full p-3 rounded-2xl border text-left transition-all space-y-2 ${
                        active
                          ? 'bg-slate-900 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.22)]'
                          : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: ship.accentHex,
                              boxShadow: `0 0 8px ${ship.accentHex}`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{ship.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{ship.role}</div>
                          </div>
                        </div>
                        {active && (
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-[9px] font-mono font-bold text-sky-200 shrink-0">
                            SELECIONADA
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{ship.description}</p>
                      <div className="grid grid-cols-3 gap-2 pt-0.5">
                        <StatBar label="Vel." value={ship.stats.speed} color={ship.accentHex} />
                        <StatBar label="Blind." value={ship.stats.armor} color="#34d399" />
                        <StatBar label="Agil." value={ship.stats.agility} color="#fbbf24" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'character' && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span>Astronautas (Ao Vivo 3D)</span>
                <span className="font-semibold" style={{ color: activeChar.accentHex }}>
                  {activeChar.callsign}
                </span>
              </div>
              <div className="space-y-2">
                {CHARACTER_CREW_CATALOG.map((char) => {
                  const active = char.id === selectedCharacterId;
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        onSelectCharacter(char.id);
                        onChangeLobbyFocusTarget('CHARACTER');
                      }}
                      className={`w-full p-3 rounded-2xl border text-left transition-all space-y-2 ${
                        active
                          ? 'bg-slate-900 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.22)]'
                          : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: char.accentHex,
                              boxShadow: `0 0 8px ${char.accentHex}`,
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{char.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {char.role} · {char.suitName}
                            </div>
                          </div>
                        </div>
                        {active && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-[9px] font-mono font-bold text-cyan-200 shrink-0">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">{char.description}</p>
                      <div className="grid grid-cols-3 gap-2 pt-0.5">
                        <StatBar label="EVA" value={char.stats.evaThrust} color={char.accentHex} />
                        <StatBar label="Suporte" value={char.stats.stamina} color="#34d399" />
                        <StatBar label="Visor" value={char.stats.sensorRange} color="#38bdf8" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-3">
              {/* Flight Controls Inversion */}
              <section className="bg-slate-900/75 border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                  Controles de Voo da Nave (Setas)
                </div>
                <div className="space-y-1.5">
                  <button
                    onClick={() =>
                      onChangeFlightControlPrefs({
                        ...flightControlPrefs,
                        invertPitchArrows: !flightControlPrefs.invertPitchArrows,
                      })
                    }
                    className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 text-xs transition-all ${
                      flightControlPrefs.invertPitchArrows
                        ? 'bg-sky-500/20 border-sky-400/60 text-sky-100'
                        : 'bg-slate-950/75 border-white/10 text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">Subir / Descer (Setas ↑ / ↓)</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {flightControlPrefs.invertPitchArrows
                          ? 'Ativo: ↓ Sobe · ↑ Desce (Manche Invertido)'
                          : 'Padrão: ↑ Sobe · ↓ Desce'}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 shrink-0">
                      {flightControlPrefs.invertPitchArrows ? '↓ / ↑' : '↑ / ↓'}
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      onChangeFlightControlPrefs({
                        ...flightControlPrefs,
                        invertRollArrows: !flightControlPrefs.invertRollArrows,
                      })
                    }
                    className={`w-full px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 text-xs transition-all ${
                      flightControlPrefs.invertRollArrows
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-100'
                        : 'bg-slate-950/75 border-white/10 text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">Inclinar Asas 360° (Setas ← / →)</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {flightControlPrefs.invertRollArrows
                          ? 'Invertido: ← Inclina Direita · → Inclina Esquerda'
                          : 'Padrão: ← Inclina Esquerda · → Inclina Direita'}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/10 shrink-0">
                      {flightControlPrefs.invertRollArrows ? 'INV' : 'NORMAL'}
                    </span>
                  </button>
                </div>
              </section>

              {/* Graphics Quality */}
              <section className="bg-slate-900/75 border border-white/10 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Qualidade Gráfica</span>
                  </span>
                  <span className="text-emerald-300 font-bold">
                    {resolvedQualityTier === 'high'
                      ? '4K ULTRA'
                      : resolvedQualityTier === 'medium'
                        ? 'MÉDIA'
                        : 'LEVE'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { id: 'AUTO', label: 'Auto' },
                    { id: 'HIGH', label: 'Alta 4K' },
                    { id: 'MEDIUM', label: 'Média' },
                    { id: 'LOW', label: 'Leve' },
                  ] as Array<{ id: QualityPreference; label: string }>).map((q) => {
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

              {/* Audio & Visual Simulation Layers */}
              <section className="bg-slate-900/75 border border-white/10 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Áudio & Simulação</span>
                  <span className="text-[10px] font-mono text-sky-300">
                    {isAudioMuted ? 'MUDO' : `${audioVolume}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={isAudioMuted ? 0 : audioVolume}
                  onChange={(e) => onChangeAudioVolume(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { label: 'Órbitas 3D', val: showOrbits, toggle: () => onToggleOrbits(!showOrbits) },
                    { label: 'Nomes Planetas', val: showLabels, toggle: () => onToggleLabels(!showLabels) },
                    {
                      label: 'Asteroides',
                      val: showAsteroidBelt,
                      toggle: () => onToggleAsteroidBelt(!showAsteroidBelt),
                    },
                    {
                      label: 'Dobra Espacial',
                      val: cinematicTravelEnabled,
                      toggle: () => onToggleCinematicTravel(!cinematicTravelEnabled),
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.toggle}
                      className={`py-1.5 px-2.5 rounded-xl border text-left text-[11px] font-medium transition-colors ${
                        item.val
                          ? 'bg-sky-500/20 border-sky-400/50 text-sky-100'
                          : 'bg-slate-950/75 border-white/10 text-slate-400'
                      }`}
                    >
                      {item.val ? '✓ ' : ''}
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Hero Launch Action */}
        <div className="p-4 sm:px-5 sm:py-4 border-t border-white/10 bg-slate-950/92 space-y-2">
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

      {/* Top-Right Galpão Camera Inspection & Pressurization Pill */}
      <div className="pointer-events-none hidden md:flex flex-col items-end justify-between p-5 z-10">
        <div className="pointer-events-auto bg-slate-950/78 backdrop-blur-xl border border-white/12 rounded-2xl px-4 py-2.5 text-right shadow-xl space-y-2">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-amber-300">
              GALPÃO 01 · SETOR DE PREPARAÇÃO
            </div>
            <div className="text-xs font-bold text-white mt-0.5">
              {activeShip.name} <span className="text-slate-500">·</span>{' '}
              <span className="text-cyan-300">{activeChar.name}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5">
            {([
              { id: 'OVERVIEW', label: 'Galpão Geral', icon: Eye },
              { id: 'SHIP', label: 'Focar Nave', icon: Rocket },
              { id: 'CHARACTER', label: 'Astronauta', icon: User },
            ] as Array<{
              id: HangarCameraFocus;
              label: string;
              icon: React.FC<{ className?: string }>;
            }>).map((cam) => {
              const Icon = cam.icon;
              const active = lobbyFocusTarget === cam.id;
              return (
                <button
                  key={cam.id}
                  onClick={() => onChangeLobbyFocusTarget(cam.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold transition-all ${
                    active
                      ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{cam.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-slate-400">
            Arraste o mouse na área livre para girar dentro do galpão em 360°
          </div>
        </div>

        <div className="bg-slate-950/68 backdrop-blur-md border border-white/10 rounded-full px-3.5 py-1.5 text-[10px] font-mono text-slate-300">
          DENTRO DO JOGO: <span className="text-sky-300 font-bold">M</span> MENU ·{' '}
          <span className="text-emerald-300 font-bold">H</span> TELA LIMPA
        </div>
      </div>
    </div>
  );
};
