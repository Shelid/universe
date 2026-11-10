import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  Cpu,
  Database,
  Disc,
  Eye,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  MapPin,
  Orbit,
  Radio,
  Rocket,
  Satellite,
  Sparkles,
  Thermometer,
  Wind,
  X,
} from 'lucide-react';
import {
  CelestialBodyData,
  EpistemicCertainty,
  PropagatedSatellite,
  SatelliteCategory,
  SpaceMission,
  SurfaceLandmark,
} from '../types/astronomy';
import { getChildMoons } from '../data/solarSystemData';
import { SATELLITE_CATEGORY_META } from '../data/satellitesData';
import { SPACE_MISSIONS } from '../data/missionsData';

type DossierTab =
  | 'OVERVIEW'
  | 'CHARACTERISTICS'
  | 'ATMOSPHERE'
  | 'INTERIOR'
  | 'MOONS_RINGS'
  | 'MISSIONS'
  | 'CURIOSITIES'
  | 'SOURCES';

interface ScientificDossierPanelProps {
  body: CelestialBodyData;
  isOpen: boolean;
  onClose: () => void;
  onSelectBody: (bodyId: string, triggerWarp?: boolean) => void;
  isExploringInterior: boolean;
  onToggleInterior: (val: boolean) => void;
  selectedInteriorLayerId: string | null;
  onSelectInteriorLayer: (layerId: string) => void;
  venusRadarMode: boolean;
  onToggleVenusRadar: (val: boolean) => void;
  saturnRingDiveMode: boolean;
  onToggleSaturnRingDive: (val: boolean) => void;
  onOpenEarthSurfaceModal: () => void;
  propagatedSatellites: PropagatedSatellite[];
  enabledSatelliteCategories: Record<SatelliteCategory, boolean>;
  onToggleSatelliteCategory: (cat: SatelliteCategory) => void;
  selectedSatellite: PropagatedSatellite | null;
  onSelectSatellite: (sat: PropagatedSatellite | null) => void;
  tleUpdatedAtIso: string;
  isLiveCelesTrak: boolean;
  selectedLandmark: SurfaceLandmark | null;
  onSelectLandmark: (lm: SurfaceLandmark | null) => void;
  onSelectMission: (mission: SpaceMission) => void;
}

const CERTAINTY_BADGE: Record<
  EpistemicCertainty,
  { label: string; colorClass: string; icon: React.ReactNode; description: string }
> = {
  DIRECT_MEASUREMENT: {
    label: 'Medição Direta / In-Situ',
    colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    description: 'Confirmado por sismometria direta, amostragem de retorno, sondas atmosféricas ou radar.',
  },
  MODEL_INFERRED: {
    label: 'Inferido por Modelos Físicos',
    colorClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    icon: <Cpu className="w-3.5 h-3.5 text-sky-400" />,
    description: 'Determinado indiretamente via harmônicos gravitacionais, momento de inércia, libração ou indução magnética.',
  },
  HYPOTHESIS_UNCERTAIN: {
    label: 'Em Investigação / Incerteza Científica',
    colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: <HelpCircle className="w-3.5 h-3.5 text-amber-400" />,
    description: 'Fronteira científica ativa onde os dados atuais permitem mais de uma interpretação física.',
  },
};

export const ScientificDossierPanel: React.FC<ScientificDossierPanelProps> = ({
  body,
  isOpen,
  onClose,
  onSelectBody,
  isExploringInterior,
  onToggleInterior,
  selectedInteriorLayerId,
  onSelectInteriorLayer,
  venusRadarMode,
  onToggleVenusRadar,
  saturnRingDiveMode,
  onToggleSaturnRingDive,
  onOpenEarthSurfaceModal,
  propagatedSatellites,
  enabledSatelliteCategories,
  onToggleSatelliteCategory,
  selectedSatellite,
  onSelectSatellite,
  tleUpdatedAtIso,
  isLiveCelesTrak,
  selectedLandmark,
  onSelectLandmark,
  onSelectMission,
}) => {
  const [activeTab, setActiveTab] = useState<DossierTab>('OVERVIEW');

  if (!isOpen) return null;

  const childMoons = getChildMoons(body.id);
  const relatedMissions = SPACE_MISSIONS.filter(
    (m) =>
      body.relatedMissionIds.includes(m.id) || m.targetBodyIds.includes(body.id)
  );

  const tabs: { id: DossierTab; label: string; icon: React.ReactNode }[] = [
    { id: 'OVERVIEW', label: 'Visão Geral', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'CHARACTERISTICS', label: 'Características', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'ATMOSPHERE', label: 'Atmosfera', icon: <Wind className="w-3.5 h-3.5" /> },
    { id: 'INTERIOR', label: 'Interior 3D', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'MOONS_RINGS', label: 'Luas & Anéis', icon: <Orbit className="w-3.5 h-3.5" /> },
    { id: 'MISSIONS', label: 'Exploração', icon: <Rocket className="w-3.5 h-3.5" /> },
    { id: 'CURIOSITIES', label: 'Curiosidades', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'SOURCES', label: 'Fontes', icon: <Database className="w-3.5 h-3.5" /> },
  ];

  return (
    <aside className="w-full sm:w-[430px] md:w-[465px] max-h-[calc(100vh-5.5rem)] bg-slate-950/82 backdrop-blur-2xl border border-white/12 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden z-30">
      {/* Header Banner */}
      <div className="p-4 border-b border-white/10 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-950/90 relative">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: body.orbitColorHex }}
              />
              <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400">
                {body.ClassificationLabel}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                {body.name}
              </h2>
              <span className="text-xs font-mono text-slate-400">({body.englishName})</span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{body.tagline}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Minimizar Painel Científico"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Planet-Specific Special Experience Action Buttons */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              const nextVal = !isExploringInterior;
              onToggleInterior(nextVal);
              if (nextVal) setActiveTab('INTERIOR');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isExploringInterior
                ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10 hover:border-sky-400/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExploringInterior ? 'Fechar Corte Interno 3D' : 'Explorar Interior 3D'}</span>
          </button>

          {body.id === 'earth' && (
            <button
              onClick={onOpenEarthSurfaceModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Explorar Superfície (Satélite Nível 4)</span>
            </button>
          )}

          {body.id === 'venus' && (
            <button
              onClick={() => onToggleVenusRadar(!venusRadarMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                venusRadarMode
                  ? 'bg-orange-500/25 border-orange-400 text-orange-200'
                  : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-orange-400" />
              <span>
                {venusRadarMode ? 'Modo Atmosfera Densa' : 'Radar Magellan (Ver Solo)'}
              </span>
            </button>
          )}

          {body.id === 'saturn' && (
            <button
              onClick={() => {
                onToggleSaturnRingDive(!saturnRingDiveMode);
                if (!saturnRingDiveMode) setActiveTab('MOONS_RINGS');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                saturnRingDiveMode
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
              }`}
            >
              <Disc className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {saturnRingDiveMode
                  ? 'Visão Global de Saturno'
                  : 'Mergulhar nos Anéis de Partículas'}
              </span>
            </button>
          )}

          {body.parentId && body.parentId !== 'sun' && (
            <button
              onClick={() => onSelectBody(body.parentId!, false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-sky-500/15 border border-sky-400/40 text-sky-200 hover:bg-sky-500/25"
            >
              <span>← Voltar ao Planeta Principal</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (8 Scientific Sections) */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-900/70 border-b border-white/10">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'INTERIOR' && !isExploringInterior) {
                  onToggleInterior(true);
                }
              }}
              className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg text-[11px] font-medium transition-all ${
                isActive
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Selected Satellite Card (if on Earth and a satellite is clicked) */}
        {body.id === 'earth' && selectedSatellite && (
          <div className="p-3.5 rounded-xl bg-sky-950/60 border border-sky-400/50 space-y-2 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Satellite className="w-4 h-4 text-sky-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-300">
                  Satélite Artificial Selecionado • NORAD #{selectedSatellite.noradId}
                </span>
              </div>
              <button
                onClick={() => onSelectSatellite(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <h4 className="text-sm font-display font-bold text-white">
              {selectedSatellite.name}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedSatellite.scientificDescription}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
              <div className="bg-slate-950/70 p-2 rounded border border-white/10">
                <div className="text-slate-400 text-[10px]">ALTITUDE INSTANTÂNEA</div>
                <div className="text-sky-300 font-semibold">
                  {selectedSatellite.altitudeKm.toFixed(1)} km
                </div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-white/10">
                <div className="text-slate-400 text-[10px]">VELOCIDADE ORBITAL</div>
                <div className="text-emerald-300 font-semibold">
                  {selectedSatellite.velocityKmS.toFixed(2)} km/s (
                  {Math.round(selectedSatellite.velocityKmS * 3600).toLocaleString('pt-BR')} km/h)
                </div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-white/10">
                <div className="text-slate-400 text-[10px]">PONTO SUBSATELITAL</div>
                <div className="text-white">
                  {selectedSatellite.latitudeDeg.toFixed(2)}°,{' '}
                  {selectedSatellite.longitudeDeg.toFixed(2)}°
                </div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded border border-white/10">
                <div className="text-slate-400 text-[10px]">PERÍODO & INCLINAÇÃO</div>
                <div className="text-white">
                  {selectedSatellite.periodMinutes.toFixed(1)} min •{' '}
                  {selectedSatellite.inclinationDeg.toFixed(2)}°
                </div>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-white/10">
              <span>Agência: {selectedSatellite.agency}</span>
              <span>Época TLE: {selectedSatellite.tleEpochIso.slice(0, 16)}Z</span>
            </div>
          </div>
        )}

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-3.5 rounded-xl border border-white/10">
              {body.summary}
            </p>

            {/* Quick Key Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Diâmetro Médio
                </div>
                <div className="text-sm font-mono font-semibold text-white mt-0.5">
                  {(body.meanRadiusKm * 2).toLocaleString('pt-BR')} km
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Distância Média ao Sol
                </div>
                <div className="text-sm font-mono font-semibold text-sky-300 mt-0.5">
                  {body.distanceFromSunAU > 0
                    ? `${body.distanceFromSunAU} UA`
                    : 'Centro Heliocêntrico'}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Gravidade Superficial
                </div>
                <div className="text-sm font-mono font-semibold text-white mt-0.5">
                  {body.surfaceGravityMs2} m/s² ({body.surfaceGravityG} g)
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Temperatura Média
                </div>
                <div className="text-sm font-mono font-semibold text-amber-300 mt-0.5">
                  {body.temperatureMeanC.split('(')[0].trim()}
                </div>
              </div>
            </div>

            {/* Authentic NASA/ESA Scientific Photograph with Source Attribution */}
            {body.images.map((img, idx) => (
              <div
                key={idx}
                className="rounded-xl overflow-hidden border border-white/15 bg-slate-900/80"
              >
                <div className="relative h-44 bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/85 border border-emerald-400/50 text-[10px] font-mono text-emerald-300">
                    {img.isRealObservation
                      ? '✓ Fotografia / Sensor Real'
                      : 'Modelo Científico'}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  <div className="text-xs font-semibold text-white">{img.title}</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{img.caption}</p>
                  <div className="pt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-slate-400 border-t border-white/10">
                    <span>Fonte: {img.credit}</span>
                    <span>Data: {img.dateTaken}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Surface Landmarks & Rover Landing Sites (Interactive 3D Pinpoints) */}
            {body.landmarks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Formações Geológicas & Sítios de Pouso
                  </h3>
                  {selectedLandmark && (
                    <button
                      onClick={() => onSelectLandmark(null)}
                      className="text-[10px] font-mono text-sky-400 hover:underline"
                    >
                      Limpar foco
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {body.landmarks.map((lm) => {
                    const isSelected = selectedLandmark?.id === lm.id;
                    return (
                      <button
                        key={lm.id}
                        onClick={() => onSelectLandmark(isSelected ? null : lm)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white'
                            : 'bg-slate-900/60 border-white/10 text-slate-200 hover:border-amber-400/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-amber-200">
                            ⌖ {lm.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {lm.latitudeDeg.toFixed(1)}°, {lm.longitudeDeg.toFixed(1)}°
                          </span>
                        </div>
                        {(lm.elevationKm || lm.diameterKm) && (
                          <div className="text-[10px] font-mono text-amber-300/90 mt-0.5">
                            {[lm.elevationKm, lm.diameterKm].filter(Boolean).join(' • ')}
                          </div>
                        )}
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          {lm.description}
                        </p>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">
                          Fonte: {lm.scientificSource}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Earth Artificial Satellites Tracker Controls (Section 3) */}
            {body.id === 'earth' && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-sky-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <Satellite className="w-3.5 h-3.5" />
                    Rastreamento Orbital de Satélites (SGP4 / NORAD)
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    {isLiveCelesTrak ? 'CelesTrak Live' : 'NORAD TLE Verificado'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Posições orbitais calculadas em tempo real via propagador matemático{' '}
                  <code className="text-sky-300">SGP4/SDP4 (satellite.js)</code> a partir dos
                  elementos de duas linhas (TLE). Clique em qualquer categoria para filtrar ou em um
                  satélite para traçar sua órbita 3D:
                </p>

                {/* Category Filter Toggles */}
                <div className="grid grid-cols-1 gap-1.5">
                  {(Object.keys(SATELLITE_CATEGORY_META) as SatelliteCategory[]).map((cat) => {
                    const meta = SATELLITE_CATEGORY_META[cat];
                    const enabled = enabledSatelliteCategories[cat];
                    const count = propagatedSatellites.filter((s) => s.category === cat).length;
                    return (
                      <div
                        key={cat}
                        onClick={() => onToggleSatelliteCategory(cat)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all text-xs ${
                          enabled
                            ? 'bg-slate-950/90 border-white/20 text-white'
                            : 'bg-slate-950/30 border-white/5 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor: enabled ? meta.colorHex : '#475569',
                            }}
                          />
                          <span>{meta.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {enabled ? `${count} ativos` : 'Oculto'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Clickable List of Tracked Satellites */}
                <div className="max-h-48 overflow-y-auto space-y-1 pt-1 pr-1">
                  {propagatedSatellites
                    .filter((s) => enabledSatelliteCategories[s.category])
                    .map((sat) => {
                      const isSel = selectedSatellite?.id === sat.id;
                      return (
                        <button
                          key={sat.id}
                          onClick={() => onSelectSatellite(isSel ? null : sat)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                            isSel
                              ? 'bg-sky-500/25 border-sky-400 text-white'
                              : 'bg-slate-950/60 border-white/5 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="font-semibold">{sat.name.split('—')[0]}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                              #{sat.noradId}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-sky-300 shrink-0">
                            {Math.round(sat.altitudeKm)} km • {sat.velocityKmS.toFixed(1)} km/s
                          </div>
                        </button>
                      );
                    })}
                </div>

                <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-white/10">
                  Última atualização TLE: {tleUpdatedAtIso}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CARACTERÍSTICAS FÍSICAS E ORBITAIS */}
        {activeTab === 'CHARACTERISTICS' && (
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-sky-400">
              Parâmetros Físicos e Orbitais (NASA JPL Fact Sheet)
            </div>
            <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden text-xs">
              {[
                ['Raio Equatorial', `${body.equatorialRadiusKm.toLocaleString('pt-BR')} km`],
                ['Raio Médio Volumétrico', `${body.meanRadiusKm.toLocaleString('pt-BR')} km`],
                ['Massa Absoluta', body.massKg],
                ['Massa Relativa à Terra', body.massRelativeToEarth],
                ['Densidade Média', `${body.meanDensityGcm3} g/cm³`],
                [
                  'Gravidade Equatorial',
                  `${body.surfaceGravityMs2} m/s² (${body.surfaceGravityG} g)`,
                ],
                ['Velocidade de Escape', `${body.escapeVelocityKmS} km/s`],
                ['Período de Rotação Sideral', body.rotationPeriodFormatted],
                ['Duração do Dia Solar', body.solarDayHours],
                ['Inclinação Axial (Obliquidade)', `${body.axialTiltDeg}°`],
                ['Albedo Geométrico', `${body.albedoGeometric}`],
                ['Distância Média ao Sol', body.distanceFromSunMeanKm],
                ['Periélio / Perigeu', body.perihelionKm],
                ['Afélio / Apogeu', body.aphelionKm],
                [
                  'Período Orbital Sideral',
                  body.orbit.orbitalPeriodDays > 0
                    ? `${body.orbit.orbitalPeriodDays.toLocaleString('pt-BR')} dias terrestres`
                    : 'Centro Orbital',
                ],
                [
                  'Velocidade Orbital Média',
                  `${body.orbit.meanOrbitalVelocityKmS} km/s`,
                ],
                ['Excentricidade Orbital (e)', `${body.orbit.eccentricity}`],
                ['Inclinação à Eclíptica (i)', `${body.orbit.inclinationDeg}°`],
                ['Variação Térmica', body.temperatureRangeC],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-2 hover:bg-white/5"
                >
                  <span className="text-slate-400">{label}</span>
                  <span className="font-mono text-white text-right max-w-[58%]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ATMOSFERA & CLIMA */}
        {activeTab === 'ATMOSPHERE' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Pressão Superficial
                </div>
                <div className="text-xs font-mono font-semibold text-sky-300 mt-1">
                  {body.atmosphere.surfacePressureBars}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Velocidade Máx. de Ventos
                </div>
                <div className="text-xs font-mono font-semibold text-amber-300 mt-1">
                  {body.atmosphere.windSpeedMaxKmH}
                </div>
              </div>
            </div>

            {/* Chemical Composition Breakdown with Visual Bars */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-2.5">
              <div className="text-xs font-mono uppercase tracking-wider text-sky-400">
                Composição Química Atmosférica / Exosférica
              </div>
              {body.atmosphere.composition.map((gas) => (
                <div key={gas.formula} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white font-medium">
                      <strong className="font-mono text-sky-300">{gas.formula}</strong> —{' '}
                      {gas.name}
                    </span>
                    <span className="font-mono text-slate-300">{gas.displayPercentage}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, Math.min(100, gas.percentage))}%`,
                        backgroundColor: gas.colorHex,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Weather Phenomena */}
            <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5" />
                Dinâmica Atmosférica e Fenômenos Meteorológicos
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {body.atmosphere.weatherPhenomena.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-sky-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-xs text-sky-100 leading-relaxed">
              <strong>Nota Científica:</strong> {body.atmosphere.scientificNotes}
            </div>
          </div>
        )}

        {/* TAB 4: INTERIOR PLANETÁRIO (3D CUTAWAY + EPISTEMIC CERTAINTY) */}
        {activeTab === 'INTERIOR' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-between gap-2">
              <div className="text-xs text-amber-100">
                <strong>Corte Tridimensional (3D Cutaway):</strong> Visualize as camadas internas
                diretamente no modelo 3D ao lado.
              </div>
              <button
                onClick={() => onToggleInterior(!isExploringInterior)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  isExploringInterior
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-amber-300 border border-amber-400/40'
                }`}
              >
                {isExploringInterior ? 'Corte 3D Ativo' : 'Ativar Corte 3D'}
              </button>
            </div>

            {/* Epistemic Legend */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Rigor Epistemológico: O que é medido vs. modelado
              </div>
              <div className="grid grid-cols-1 gap-1 text-[11px]">
                {Object.entries(CERTAINTY_BADGE).map(([key, meta]) => (
                  <div key={key} className="flex items-center gap-2 text-slate-300">
                    {meta.icon}
                    <span>
                      <strong className="text-white">{meta.label}:</strong> {meta.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Concentric Layers List (from surface to core or core to surface) */}
            <div className="space-y-2.5">
              {[...body.interiorLayers].reverse().map((layer) => {
                const cert = CERTAINTY_BADGE[layer.certainty];
                const isSelected = selectedInteriorLayerId === layer.id;
                return (
                  <div
                    key={layer.id}
                    onClick={() => onSelectInteriorLayer(layer.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-900 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                        : 'bg-slate-900/65 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                          style={{ backgroundColor: layer.colorHex }}
                        />
                        <h4 className="text-xs font-display font-bold text-white">
                          {layer.name}
                        </h4>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border shrink-0 ${cert.colorClass}`}
                      >
                        {cert.icon}
                        <span>{cert.label}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-white/5">
                      <div>
                        <span className="text-slate-400">Profundidade: </span>
                        <span className="text-white">{layer.depthRangeKm}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Temperatura: </span>
                        <span className="text-amber-300">{layer.temperatureRange}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Pressão: </span>
                        <span className="text-sky-300">{layer.pressureRange}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Estado: </span>
                        <span className="text-emerald-300">{layer.physicalState}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300">
                      <strong className="text-slate-200">Composição:</strong> {layer.composition}
                    </div>

                    <div className="text-xs text-slate-300 leading-relaxed pt-1 border-t border-white/10">
                      {layer.scientificExplanation}
                    </div>

                    <div className="text-[10px] font-mono text-sky-300/90">
                      Método Científico: {layer.investigationMethod}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: LUAS & ANÉIS */}
        {activeTab === 'MOONS_RINGS' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Satélites Naturais Conhecidos (IAU)
                </div>
                <div className="text-lg font-display font-bold text-white">
                  {body.knownMoonsCount} {body.knownMoonsCount === 1 ? 'Lua' : 'Luas'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Sistema de Anéis Planetários
                </div>
                <div className="text-sm font-mono font-semibold text-sky-300">
                  {body.hasRings ? 'Presente' : 'Ausente'}
                </div>
              </div>
            </div>

            {/* Interactive Moons List */}
            {childMoons.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400">
                  Luas Principais Modeladas em 3D (Clique para Viajar)
                </h3>
                <div className="space-y-2">
                  {childMoons.map((moon) => (
                    <button
                      key={moon.id}
                      onClick={() => onSelectBody(moon.id, false)}
                      className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-sky-400/60 transition-all flex items-center justify-between group"
                    >
                      <div className="pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: moon.primaryColorHex }}
                          />
                          <span className="text-sm font-display font-bold text-white group-hover:text-sky-300">
                            {moon.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Ø {(moon.meanRadiusKm * 2).toLocaleString('pt-BR')} km
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                          {moon.tagline}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Saturn's Detailed Ring System Breakdown */}
            {body.ringDetails && body.ringDetails.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Disc className="w-3.5 h-3.5" />
                    Anatomia dos Anéis de Saturno (Dados Cassini)
                  </h3>
                  <button
                    onClick={() => onToggleSaturnRingDive(!saturnRingDiveMode)}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30"
                  >
                    {saturnRingDiveMode ? 'Sair do Plano dos Anéis' : 'Aproximar Câmera aos Anéis'}
                  </button>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-white/10">
                  Os anéis de Saturno <strong>não são estruturas sólidas</strong>: são um sistema
                  colisional de bilhões de partículas independentes de gelo de água pura (99%) com
                  tamanhos de mícrons a blocos de 10 metros, orbitando entre 66.900 km e 140.680 km
                  do centro de Saturno.
                </p>

                <div className="space-y-2">
                  {body.ringDetails.map((ring) => (
                    <div
                      key={ring.name}
                      className="p-3 rounded-xl bg-slate-900/75 border border-white/10 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-200">{ring.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Largura: {ring.widthKm.toLocaleString('pt-BR')} km
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-sky-300">
                        Raio Orbital: {ring.innerRadiusKm.toLocaleString('pt-BR')} –{' '}
                        {ring.outerRadiusKm.toLocaleString('pt-BR')} km • Prof. Óptica τ:{' '}
                        {ring.opticalDepth}
                      </div>
                      <div className="text-[11px] text-emerald-300">
                        Composição: {ring.particleComposition}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{ring.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: MISSÕES ESPACIAIS RELACIONADAS */}
        {activeTab === 'MISSIONS' && (
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-sky-400">
              Missões Espaciais Históricas e Ativas
            </div>
            {relatedMissions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 text-xs text-slate-300">
                Consulte o menu global de Missões Espaciais no topo da tela para explorar todas as
                sondas interplanetárias e suas trajetórias 3D.
              </div>
            ) : (
              relatedMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-display font-bold text-white">
                      {mission.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30">
                      {mission.statusLabel}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {mission.agency} • Lançamento: {mission.launchDate}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{mission.objective}</p>
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-mono uppercase text-amber-300">
                      Principais Descobertas Científicas:
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      {mission.keyDiscoveries.slice(0, 3).map((d, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => onSelectMission(mission)}
                    className="w-full mt-2 py-1.5 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-medium transition-colors"
                  >
                    Destacar Trajetória 3D da Missão no Espaço
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 7: CURIOSIDADES CIENTÍFICAS */}
        {activeTab === 'CURIOSITIES' && (
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Fatos Astrofísicos e Planetologia Comparada
            </div>
            {body.scientificCuriosities.map((curiosity, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-slate-900/75 border border-amber-500/30 text-xs text-slate-200 leading-relaxed flex items-start gap-3"
              >
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p>{curiosity}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 8: FONTES E REFERÊNCIAS CIENTÍFICAS */}
        {activeTab === 'SOURCES' && (
          <div className="space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Catálogos Oficiais, Efemérides e Limitações Conhecidas
            </div>
            {body.sources.map((src) => (
              <div
                key={src.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2 text-xs"
              >
                <div className="font-semibold text-white">{src.datasetName}</div>
                <div className="text-[11px] font-mono text-sky-300">
                  Instituição: {src.institution}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Última revisão dos dados: {src.lastUpdated}
                </div>
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-100/90">
                  <div className="font-semibold text-amber-300 flex items-center gap-1 mb-0.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Limitações Científicas Conhecidas:
                  </div>
                  {src.limitations}
                </div>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[11px] font-mono text-sky-400 hover:underline pt-1"
                >
                  ↗ Acessar Referência Oficial ({src.url})
                </a>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] text-slate-400 leading-relaxed">
              <strong>Efemérides Orbitais:</strong> Elementos keplerianos J2000 derivados do Jet
              Propulsion Laboratory (JPL Horizons DE440/DE441) e NASA Planetary Fact Sheet.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

