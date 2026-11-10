import React, { useState } from 'react';
import {
  Calendar,
  Compass,
  Cpu,
  ExternalLink,
  Navigation,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';
import { SPACE_MISSIONS } from '../data/missionsData';
import { SpaceMission } from '../types/astronomy';
import { getCelestialBody } from '../data/solarSystemData';

interface MissionsExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMissionId: string | null;
  onSelectMissionTrajectory: (missionId: string | null) => void;
  onFlyToBody: (bodyId: string) => void;
}

export const MissionsExplorerModal: React.FC<MissionsExplorerModalProps> = ({
  isOpen,
  onClose,
  activeMissionId,
  onSelectMissionTrajectory,
  onFlyToBody,
}) => {
  const [selectedMission, setSelectedMission] = useState<SpaceMission>(
    SPACE_MISSIONS.find((m) => m.id === activeMissionId) || SPACE_MISSIONS[0]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-5xl h-[82vh] bg-slate-900/95 border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white">
                Arquivo de Missões Espaciais & Sondas Interplanetárias
              </h2>
              <p className="text-xs text-slate-400">
                Trajetórias heliocêntricas 3D, instrumentação científica e descobertas históricas (NASA / ESA / JAXA / CSA)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Mission Selector */}
          <div className="w-80 border-r border-white/10 bg-slate-950/50 overflow-y-auto p-3 space-y-2">
            {SPACE_MISSIONS.map((mission) => {
              const isSelected = selectedMission.id === mission.id;
              return (
                <button
                  key={mission.id}
                  onClick={() => setSelectedMission(mission)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg'
                      : 'bg-slate-900/60 border-white/10 text-slate-300 hover:bg-slate-900 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-display font-bold text-white flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: mission.colorHex }}
                      />
                      {mission.name}
                    </span>
                    <span className="text-[10px] font-mono text-sky-300">
                      {mission.currentDistanceFromSunAU} UA
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {mission.primaryTargetName}
                  </div>
                  <div className="mt-1.5 inline-block text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                    {mission.statusLabel}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Mission Dossier */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-sky-400 mb-1">
                  <span>{selectedMission.agency}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {selectedMission.launchDate}
                  </span>
                </div>
                <h3 className="text-2xl font-display font-bold text-white">
                  {selectedMission.name}
                </h3>
                <div className="text-xs text-amber-300 font-mono mt-1">
                  Destino Principal: {selectedMission.primaryTargetName} • Distância Heliocêntrica:{' '}
                  {selectedMission.currentDistanceFromSunAU} UA
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    onSelectMissionTrajectory(selectedMission.id);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition-all shadow-lg"
                >
                  <Compass className="w-4 h-4" />
                  <span>Visualizar Trajetória 3D no Espaço</span>
                </button>
              </div>
            </div>

            {/* Mission Image & Objective */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl overflow-hidden border border-white/15 bg-black flex flex-col">
                <img
                  src={selectedMission.imageUrl}
                  alt={selectedMission.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-2.5 bg-slate-950 text-[10px] font-mono text-slate-400">
                  Crédito: {selectedMission.imageCredit}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-mono uppercase text-sky-400 mb-1.5">
                    Objetivo Científico da Missão
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedMission.objective}
                  </p>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-1.5">
                    Corpos Celestes Visitados (Clique para Viajar até lá):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMission.targetBodyIds.map((bId) => {
                      const b = getCelestialBody(bId);
                      return (
                        <button
                          key={bId}
                          onClick={() => {
                            onFlyToBody(bId);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-sky-500/25 border border-white/15 hover:border-sky-400 text-xs text-white transition-all"
                        >
                          <Navigation className="w-3 h-3 text-sky-400" />
                          <span>Viajar para {b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Key Discoveries */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2.5">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Descobertas Científicas e Marcos Históricos
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                {selectedMission.keyDiscoveries.map((disc, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{disc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instruments & Waypoints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                <div className="text-xs font-mono uppercase text-emerald-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" />
                  Instrumentação Científica a Bordo
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMission.instruments.map((inst, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-mono text-slate-300"
                    >
                      {inst}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
                <div className="text-xs font-mono uppercase text-sky-400">
                  Cronologia de Marcos da Trajetória
                </div>
                <div className="space-y-1.5 text-xs">
                  {selectedMission.trajectoryPointsAU.map((wp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1 border-b border-white/5 last:border-0"
                    >
                      <span className="text-slate-300">{wp.label}</span>
                      <span className="font-mono text-[11px] text-sky-300">{wp.dateIso}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Referência Oficial de Dados: {selectedMission.sourceReference}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

