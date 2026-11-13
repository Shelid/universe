import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Eye,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  Monitor,
  Orbit,
  Pause,
  Play,
  Rocket,
  Satellite,
  Search,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ALL_CELESTIAL_BODIES } from '../data/solarSystemData';
import {
  CHARACTER_CREW_CATALOG,
  SPACECRAFT_HANGAR_CATALOG,
} from '../data/hangarCatalog';
import {
  BodyCategory,
  CelestialBodyData,
  CharacterPreset,
  CharacterVariantId,
  SpacecraftPreset,
  SpacecraftVariantId,
} from '../types/astronomy';
import { QualityPreference, ResolvedQualityTier } from '../utils/performanceProfile';

export type GamePlayerMode = 'EXPLORE' | 'SPACECRAFT' | 'EVA';
export type CommandMenuTab = 'hangar' | 'crew' | 'station' | 'travel' | 'graphics';

interface GameCommandMenuProps {
  isOpen: boolean;
  initialTab?: CommandMenuTab;
  onClose: () => void;
  playerMode: GamePlayerMode;
  onSwitchMode: (mode: GamePlayerMode) => void;
  onLaunchShipCockpit: () => void;
  selectedShipId: SpacecraftVariantId;
  onSelectShip: (id: SpacecraftVariantId) => void;
  selectedCharacterId: CharacterVariantId;
  onSelectCharacter: (id: CharacterVariantId) => void;
  onDeployToStation: (mode: 'ORBIT_INSPECT' | 'SHIP_DOCK' | 'EVA_WALK') => void;
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
  onChangeQuality: (pref: QualityPreference) => void;
  isAudioMuted: boolean;
  onToggleAudioMuted: () => void;
  audioVolume: number;
  onChangeAudioVolume: (vol: number) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const BODY_CATEGORIES: Array<{ id: 'all' | BodyCategory; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'star', label: 'Estrela' },
  { id: 'planet', label: 'Planetas' },
  { id: 'dwarf_planet', label: 'Anões' },
  { id: 'moon', label: 'Luas' },
  { id: 'galaxy', label: 'Galáxias' },
];

const StatBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="space-y-1">
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

const FighterSilhouetteSvg: React.FC<{ accentHex: string; hullTintHex: string }> = ({
  accentHex,
  hullTintHex,
}) => (
  <svg viewBox="0 0 120 70" className="w-24 h-14 drop-shadow-[0_0_12px_rgba(56,189,248,0.28)]">
    <defs>
      <linearGradient id={`hull-${accentHex.replace('#', '')}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={hullTintHex} stopOpacity="0.92" />
        <stop offset="100%" stopColor="#334155" stopOpacity="0.95" />
      </linearGradient>
    </defs>
    {/* Swept forward starfighter silhouette */}
    <path
      d="M60 6 L72 26 L108 46 L100 54 L76 48 L70 58 L60 53 L50 58 L44 48 L20 54 L12 46 L48 26 Z"
      fill={`url(#hull-${accentHex.replace('#', '')})`}
      stroke={accentHex}
      strokeWidth="1.6"
    />
    {/* Crystal cockpit canopy */}
    <path d="M60 17 L65 30 L60 36 L55 30 Z" fill="#7dd3fc" fillOpacity="0.72" />
    {/* Thruster nozzles */}
    <circle cx="51" cy="59" r="3" fill={accentHex} />
    <circle cx="60" cy="56" r="3.8" fill={accentHex} />
    <circle cx="69" cy="59" r="3" fill={accentHex} />
  </svg>
);

const AstronautBadgeSvg: React.FC<{ accentHex: string; suitTintHex: string }> = ({
  accentHex,
  suitTintHex,
}) => (
  <svg viewBox="0 0 80 80" className="w-16 h-16 drop-shadow-[0_0_12px_rgba(34,211,238,0.25)]">
    {/* Backpack */}
    <rect x="20" y="34" width="40" height="32" rx="8" fill="#1e293b" stroke={accentHex} strokeWidth="1.5" />
    {/* Torso armor */}
    <rect x="24" y="42" width="32" height="28" rx="9" fill={suitTintHex} stroke={accentHex} strokeWidth="1.6" />
    {/* Helmet shell */}
    <circle cx="40" cy="27" r="16" fill={suitTintHex} stroke={accentHex} strokeWidth="1.8" />
    {/* Reflective visor */}
    <ellipse cx="40" cy="27" rx="10.5" ry="8" fill="#0f172a" stroke={accentHex} strokeWidth="1.3" />
    <path d="M33 23 Q40 20 46 24" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    {/* Chest telemetry core */}
    <rect x="33" y="49" width="14" height="8" rx="2" fill="#0f172a" stroke={accentHex} strokeWidth="1" />
    <circle cx="37" cy="53" r="1.6" fill={accentHex} />
    <circle cx="43" cy="53" r="1.6" fill="#10b981" />
  </svg>
);

export const GameCommandMenu: React.FC<GameCommandMenuProps> = ({
  isOpen,
  initialTab,
  onClose,
  playerMode,
  onSwitchMode,
  onLaunchShipCockpit,
  selectedShipId,
  onSelectShip,
  selectedCharacterId,
  onSelectCharacter,
  onDeployToStation,
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
  const [activeTab, setActiveTab] = useState<CommandMenuTab>(initialTab || 'hangar');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | BodyCategory>('all');

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const activeShip: SpacecraftPreset = useMemo(
    () =>
      SPACECRAFT_HANGAR_CATALOG.find((s) => s.id === selectedShipId) ||
      SPACECRAFT_HANGAR_CATALOG[0],
    [selectedShipId]
  );

  const activeCharacter: CharacterPreset = useMemo(
    () =>
      CHARACTER_CREW_CATALOG.find((c) => c.id === selectedCharacterId) ||
      CHARACTER_CREW_CATALOG[0],
    [selectedCharacterId]
  );

  const filteredBodies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_CELESTIAL_BODIES.filter((b) => {
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.ClassificationLabel.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, categoryFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/78 backdrop-blur-lg">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#060b16]/95 border border-sky-400/35 rounded-3xl shadow-[0_28px_100px_rgba(0,0,0,0.92)] flex flex-col overflow-hidden">
        {/* Tactical HUD Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.2)]">
              <Rocket className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-display font-bold text-white tracking-wider uppercase">
                  COSMOS COMMAND · HANGAR & ÓRBITA
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 border border-emerald-400/40 text-emerald-300">
                  {resolvedQualityTier === 'high'
                    ? '4K ULTRA ALTA'
                    : resolvedQualityTier === 'medium'
                      ? 'MÉDIA'
                      : 'LEVE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-[260px] sm:max-w-lg">
                Nave: <span className="text-sky-300">{activeShip.name}</span> · Tripulação:{' '}
                <span className="text-cyan-300">{activeCharacter.name}</span> · Local:{' '}
                <span className="text-amber-300">{selectedBody.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Game Mode Switcher */}
            <div className="hidden md:flex items-center bg-slate-950/90 border border-white/10 rounded-full p-0.5 gap-0.5">
              {[
                { id: 'EXPLORE' as const, label: 'Câmera', icon: Globe },
                { id: 'SPACECRAFT' as const, label: 'Pilotar', icon: Rocket },
                { id: 'EVA' as const, label: 'Astronauta', icon: User },
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
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      active
                        ? 'bg-sky-500 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/25 border border-white/15 text-slate-200 hover:text-white text-xs font-semibold transition-colors"
              title="Fechar Menu e Jogar (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao Jogo</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-5 border-b border-white/10 bg-slate-900/50 text-[11px] font-mono">
          {[
            { id: 'hangar' as const, label: 'Escolher Nave', icon: Rocket },
            { id: 'crew' as const, label: 'Personagem', icon: User },
            { id: 'station' as const, label: 'Estação Orbital', icon: Satellite },
            { id: 'travel' as const, label: 'Mapa & Missões', icon: Compass },
            { id: 'graphics' as const, label: 'Gráficos 4K', icon: Monitor },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-3 px-2 border-b-2 transition-all ${
                  active
                    ? 'border-sky-400 text-sky-200 bg-sky-500/12 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* TAB 1: HANGAR - ESCOLHER NAVE */}
          {activeTab === 'hangar' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide">
                    Hangar de Aeronaves Estelares
                  </h3>
                  <p className="text-xs text-slate-400">
                    Escolha sua nave para pilotar em 3ª pessoa ou na cabine interativa 4K.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onSwitchMode('SPACECRAFT');
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Decolar Agora</span>
                  </button>
                  <button
                    onClick={() => {
                      onLaunchShipCockpit();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-100 font-semibold text-xs transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-300" />
                    <span>Cabine 4K</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {SPACECRAFT_HANGAR_CATALOG.map((ship) => {
                  const isSelected = ship.id === selectedShipId;
                  return (
                    <div
                      key={ship.id}
                      onClick={() => onSelectShip(ship.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelectShip(ship.id);
                      }}
                      className={`group cursor-pointer relative rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3.5 ${
                        isSelected
                          ? 'bg-slate-900/95 border-sky-400 shadow-[0_0_28px_rgba(56,189,248,0.2)]'
                          : 'bg-slate-900/55 border-white/10 hover:border-white/25 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border"
                            style={{
                              color: ship.accentHex,
                              borderColor: `${ship.accentHex}55`,
                              backgroundColor: `${ship.accentHex}15`,
                            }}
                          >
                            {ship.codename}
                          </span>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              EQUIPADA
                            </span>
                          )}
                        </div>

                        <div className="h-20 rounded-xl bg-slate-950/85 border border-white/5 flex items-center justify-center">
                          <FighterSilhouetteSvg
                            accentHex={ship.accentHex}
                            hullTintHex={ship.hullTintHex}
                          />
                        </div>

                        <div>
                          <div className="text-sm font-display font-bold text-white">
                            {ship.name}
                          </div>
                          <div className="text-[11px] font-mono text-sky-300/90">
                            {ship.role}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                            {ship.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <StatBar label="Velocidade" value={ship.stats.speed} color={ship.accentHex} />
                        <StatBar label="Agilidade" value={ship.stats.agility} color={ship.accentHex} />
                        <StatBar label="Blindagem" value={ship.stats.armor} color={ship.accentHex} />
                        <StatBar label="Dobra" value={ship.stats.warp} color={ship.accentHex} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TRIPULAÇÃO - ESCOLHER PERSONAGEM */}
          {activeTab === 'crew' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide">
                    Seleção de Astronauta & Traje EVA
                  </h3>
                  <p className="text-xs text-slate-400">
                    Escolha seu astronauta com animação completa para pilotar ou caminhar na Estação Espacial.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      onDeployToStation('EVA_WALK');
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-all"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Caminhar na Estação (EVA)</span>
                  </button>
                  <button
                    onClick={() => {
                      onSwitchMode('EVA');
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 font-semibold text-xs transition-all"
                  >
                    <span>EVA Local Atual</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {CHARACTER_CREW_CATALOG.map((char) => {
                  const isSelected = char.id === selectedCharacterId;
                  return (
                    <div
                      key={char.id}
                      onClick={() => onSelectCharacter(char.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') onSelectCharacter(char.id);
                      }}
                      className={`cursor-pointer rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3.5 ${
                        isSelected
                          ? 'bg-slate-900/95 border-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.2)]'
                          : 'bg-slate-900/55 border-white/10 hover:border-white/25 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border"
                            style={{
                              color: char.accentHex,
                              borderColor: `${char.accentHex}55`,
                              backgroundColor: `${char.accentHex}15`,
                            }}
                          >
                            {char.callsign}
                          </span>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              SELECIONADO
                            </span>
                          )}
                        </div>

                        <div className="h-20 rounded-xl bg-slate-950/85 border border-white/5 flex items-center justify-center">
                          <AstronautBadgeSvg
                            accentHex={char.accentHex}
                            suitTintHex={char.suitTintHex}
                          />
                        </div>

                        <div>
                          <div className="text-sm font-display font-bold text-white">
                            {char.name}
                          </div>
                          <div className="text-[11px] font-mono text-cyan-300/90">
                            {char.suitName}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                            {char.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <StatBar
                          label="Impulso EVA"
                          value={char.stats.evaThrust}
                          color={char.accentHex}
                        />
                        <StatBar
                          label="Resistência"
                          value={char.stats.stamina}
                          color={char.accentHex}
                        />
                        <StatBar
                          label="Sensor Orbital"
                          value={char.stats.sensorRange}
                          color={char.accentHex}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: ESTAÇÃO ESPACIAL ORBITAL */}
          {activeTab === 'station' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gradient-to-br from-slate-900/95 via-sky-950/35 to-slate-900/95 border border-sky-400/35 p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-sky-300 uppercase">
                      <Satellite className="w-4 h-4 text-sky-400" />
                      <span>Órbita Terrestre Baixa · 415 km · Inclinação 51,6°</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-display font-bold text-white">
                      Estação Espacial Orbital Gateway (12 Módulos & Docas)
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Complexo pressurizado completo (41,5 × 12,3 × 49,5 m) com núcleo central de seis portas, laboratório científico, cúpula de observação nadir voltada para a Terra, eclusa de descompressão EVA, painéis solares, radiadores térmicos e cápsula de tripulação acoplada.
                    </p>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-slate-950/85 border border-white/10 text-[11px] font-mono space-y-0.5">
                    <div className="text-slate-400">ARQUITETURA</div>
                    <div className="text-emerald-300 font-bold">12 Módulos Pressurizados</div>
                    <div className="text-sky-300">66.0k Triângulos · 3D PBR</div>
                  </div>
                </div>

                {/* 3 Direct Game Deployment Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => {
                      onDeployToStation('EVA_WALK');
                      onClose();
                    }}
                    className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-all shadow-[0_0_24px_rgba(34,211,238,0.3)]"
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <User className="w-4 h-4" />
                      <span>Caminhar na Estação (EVA)</span>
                    </div>
                    <span className="text-[11px] text-slate-900/80 text-left">
                      Pousar sobre o casco e andar pelos módulos com botas magnéticas e jetpack.
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      onDeployToStation('SHIP_DOCK');
                      onClose();
                    }}
                    className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-100 transition-all"
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Rocket className="w-4 h-4 text-amber-300" />
                      <span>Aproximar Nave para Doca</span>
                    </div>
                    <span className="text-[11px] text-amber-200/80 text-left">
                      Posicionar {activeShip.name} em voo estacionário ao lado da eclusa EVA.
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      onDeployToStation('ORBIT_INSPECT');
                      onClose();
                    }}
                    className="flex flex-col items-start gap-1 p-3.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/45 text-sky-100 transition-all"
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Orbit className="w-4 h-4 text-sky-300" />
                      <span>Inspecionar na Órbita 3D</span>
                    </div>
                    <span className="text-[11px] text-sky-200/80 text-left">
                      Aproximar câmera de observação orbitando livremente ao redor da estação.
                    </span>
                  </button>
                </div>

                {/* Earth Surface / Satellites Modal Shortcut */}
                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400">
                    Deseja visualizar também ISS, Hubble e demais satélites SGP4 em órbita da Terra?
                  </span>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenEarthSurface();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-emerald-200 font-medium transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Painel Orbital da Terra</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESTINOS & MISSÕES */}
          {activeTab === 'travel' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar planeta, estrela, lua ou galáxia..."
                    className="w-full bg-slate-900/90 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenDossier();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/40 text-sky-200 text-xs font-semibold shrink-0"
                >
                  Ficha: {selectedBody.name}
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenMissions();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-xs font-semibold shrink-0"
                >
                  Missões NASA/ESA
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {BODY_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryFilter(c.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      categoryFilter === c.id
                        ? 'bg-sky-500/25 border-sky-400 text-sky-100'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredBodies.map((body) => {
                  const active = body.id === selectedBody.id;
                  return (
                    <button
                      key={body.id}
                      onClick={() => {
                        onSelectBody(body.id, true);
                        onClose();
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-sky-500/25 border-sky-400 text-white'
                          : 'bg-slate-900/75 border-white/10 hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: body.primaryColorHex,
                          boxShadow: `0 0 8px ${body.primaryColorHex}`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{body.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {body.ClassificationLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Contextual Celestial Actions */}
              <div className="bg-slate-900/65 border border-white/10 rounded-2xl p-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    onToggleInterior();
                    onClose();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                    isExploringInterior
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Corte Interno 3D ({selectedBody.name})</span>
                </button>
                {selectedBody.id === 'saturn' && (
                  <button
                    onClick={() => {
                      onToggleSaturnRingDive();
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                      saturnRingDiveMode
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                    }`}
                  >
                    Mergulhar nos Anéis de Saturno
                  </button>
                )}
                {selectedBody.id === 'venus' && (
                  <button
                    onClick={() => {
                      onToggleVenusRadar();
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                      venusRadarMode
                        ? 'bg-orange-500/25 border-orange-400 text-orange-200'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                    }`}
                  >
                    Radar Geológico de Vênus
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: GRÁFICOS 4K & SISTEMA */}
          {activeTab === 'graphics' && (
            <div className="space-y-4">
              {/* Graphics Quality Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Qualidade Gráfica & Texturas 4K
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Perfil Ativo: <strong className="text-white uppercase">{resolvedQualityTier}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    {
                      id: 'HIGH' as const,
                      title: 'Alta (4K Ultra)',
                      desc: 'DPR 2.5x, Texturas 4K, 16x Anisotropia, AA completo',
                      badge: 'RECOMENDADO',
                    },
                    {
                      id: 'MEDIUM' as const,
                      title: 'Média',
                      desc: 'DPR 2.0x, equilíbrio fluido entre detalhe e FPS',
                      badge: '',
                    },
                    {
                      id: 'LOW' as const,
                      title: 'Desempenho',
                      desc: 'Otimizado para notebooks econômicos e economia de GPU',
                      badge: '',
                    },
                    {
                      id: 'AUTO' as const,
                      title: 'Automática',
                      desc: 'Ajuste dinâmico por placa de vídeo detectada',
                      badge: '',
                    },
                  ].map((q) => {
                    const active = qualityPreference === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => onChangeQuality(q.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                          active
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_18px_rgba(16,185,129,0.2)]'
                            : 'bg-slate-900/70 border-white/10 hover:border-white/25 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold">{q.title}</span>
                          {q.badge && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200">
                              {q.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 leading-snug">{q.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Simulation Time & Visual Layers */}
                <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Simulação Orbital</span>
                    <button
                      onClick={onTogglePause}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium"
                    >
                      {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[11px] font-mono">
                    {[
                      { label: 'Real', speed: 0 },
                      { label: '1d/s', speed: 1 },
                      { label: '10d/s', speed: 10 },
                      { label: '100d/s', speed: 100 },
                    ].map((s) => (
                      <button
                        key={s.label}
                        onClick={() => onChangeTimeSpeed(s.speed)}
                        className={`py-1.5 rounded-lg border transition-colors ${
                          timeSpeedDaysPerSec === s.speed
                            ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs pt-1">
                    {[
                      { label: 'Órbitas 3D', val: showOrbits, toggle: () => onToggleOrbits(!showOrbits) },
                      { label: 'Rótulos HUD', val: showLabels, toggle: () => onToggleLabels(!showLabels) },
                      { label: 'Asteroides', val: showAsteroidBelt, toggle: () => onToggleAsteroidBelt(!showAsteroidBelt) },
                      { label: 'Dobra Espacial', val: cinematicTravelEnabled, toggle: () => onToggleCinematicTravel(!cinematicTravelEnabled) },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.toggle}
                        className={`py-1.5 px-2.5 rounded-xl border text-left text-[11px] font-medium transition-colors ${
                          item.val
                            ? 'bg-sky-500/20 border-sky-400/50 text-sky-100'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        {item.val ? '✓ ' : ''}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Audio, Fullscreen & Game Controls */}
                <div className="bg-slate-900/75 border border-white/10 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">Áudio & Tela Cheia</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={onToggleAudioMuted}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200"
                        title={isAudioMuted ? 'Ativar som' : 'Silenciar'}
                      >
                        {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={onToggleFullscreen}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200"
                        title="Tela Cheia"
                      >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
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
                  <div className="bg-slate-950/75 border border-white/5 rounded-xl p-2.5 text-[11px] text-slate-300 space-y-1 font-mono">
                    <div>
                      <span className="text-amber-300">NAVE:</span> W/S Motor · A/D/Setas Manobra · Shift Dobra · V Cabine
                    </div>
                    <div>
                      <span className="text-cyan-300">EVA ESTAÇÃO:</span> W/A/S/D Andar · Shift Correr · Espaço Jetpack · L Lanterna
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
