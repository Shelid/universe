import React, { useEffect, useMemo, useState } from 'react';
import {
  Atom,
  Backpack,
  CheckCircle2,
  Coins,
  FlaskConical,
  Gem,
  Package,
  Scale,
  Search,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  MINING_RECIPES_BY_ID,
  MINING_RESOURCE_LIST,
  MINING_RESOURCES,
} from '../data/miningCatalog';
import {
  PROVISION_ITEMS,
  ProvisionItemDefinition,
  ProvisionItemId,
  RECIPE_IMAGE_PATHS,
  RESOURCE_IMAGE_PATHS,
} from '../data/itemArtwork';
import {
  MiningRecipeId,
  MiningResourceId,
  SurvivalResourcesState,
} from '../types/astronomy';
import { getTotalCargoUnits } from '../utils/survivalEngine';
import type { GamePlayerMode } from './GameCommandMenu';

interface BackpackModalProps {
  isOpen: boolean;
  onClose: () => void;
  survival: SurvivalResourcesState;
  survivalNotice?: string | null;
  playerMode: GamePlayerMode;
  onConsumeFood: () => void;
  onConsumeWater: () => void;
  onUseRepairKit: () => void;
  onConsumeWarpCell: () => void;
  onSynthesizeRecipe: (recipeId: MiningRecipeId) => void;
  onSellCargo: (resourceId: MiningResourceId, units?: number) => void;
  onSellAllCargo: () => void;
  onDiscardCargo: (resourceId: MiningResourceId) => void;
}

type BackpackTab = 'owned' | 'minerals' | 'provisions' | 'catalog';
type SortMode = 'qty' | 'value' | 'rarity';

type UnifiedBackpackItem =
  | {
      kind: 'provision';
      key: string;
      id: ProvisionItemId;
      name: string;
      formula: string;
      rarity: ProvisionItemDefinition['rarity'];
      colorHex: string;
      imagePath: string;
      qty: number;
      unitMassKg: number;
      creditValue: number;
      description: string;
      subtitle: string;
      recipeId: MiningRecipeId;
      statLabel: string;
    }
  | {
      kind: 'mineral';
      key: string;
      id: MiningResourceId;
      name: string;
      formula: string;
      rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC';
      colorHex: string;
      imagePath: string;
      qty: number;
      unitMassKg: number;
      creditValue: number;
      description: string;
      subtitle: string;
    }
  | {
      kind: 'module';
      key: string;
      id: MiningRecipeId;
      name: string;
      formula: string;
      rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC';
      colorHex: string;
      imagePath: string;
      qty: number;
      unitMassKg: number;
      creditValue: number;
      description: string;
      subtitle: string;
      recipeId: MiningRecipeId;
    };

const RARITY_META: Record<
  'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC',
  { label: string; rank: number; pillClass: string }
> = {
  COMMON: {
    label: 'COMUM',
    rank: 1,
    pillClass: 'bg-slate-500/20 text-slate-200 border-slate-400/35',
  },
  UNCOMMON: {
    label: 'INCOMUM',
    rank: 2,
    pillClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
  },
  RARE: {
    label: 'RARO',
    rank: 3,
    pillClass: 'bg-amber-500/20 text-amber-200 border-amber-400/45',
  },
  EXOTIC: {
    label: 'EXÓTICO',
    rank: 4,
    pillClass: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50',
  },
};

const MODULE_META: Array<{
  recipeId: MiningRecipeId;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC';
  colorHex: string;
  unitMassKg: number;
  creditValue: number;
  description: string;
  subtitle: string;
}> = [
  {
    recipeId: 'synthesize-o2',
    rarity: 'COMMON',
    colorHex: '#22d3ee',
    unitMassKg: 1.8,
    creditValue: 45,
    description:
      'Eletrólise catalítica de água e nitratos minerais gerando gás oxigênio puro respirável direto para os tanques da nave e do traje EVA.',
    subtitle: 'Injeta +38% O₂ na Cabine & +50% no Traje EVA',
  },
  {
    recipeId: 'hydrazine-fuel',
    rarity: 'UNCOMMON',
    colorHex: '#f97316',
    unitMassKg: 6.2,
    creditValue: 95,
    description:
      'Síntese hipergólica de amônia e metano criogênico em propelente denso de alto impulso para os propulsores principais da SR-7.',
    subtitle: 'Abastece +36% do Tanque de Propulsão Química',
  },
  {
    recipeId: 'cryo-coolant',
    rarity: 'RARE',
    colorHex: '#06b6d4',
    unitMassKg: 3.4,
    creditValue: 135,
    description:
      'Cartucho bifásico super-resfriado para o loop térmico dos radiadores e dissipação instantânea de superaquecimento do reator.',
    subtitle: 'Reduz temperatura do casco (-165°C) e limpa radiação',
  },
  {
    recipeId: 'interstellar-resonator',
    rarity: 'EXOTIC',
    colorHex: '#10b981',
    unitMassKg: 2.1,
    creditValue: 480,
    description:
      'Artefato cristalográfico avançado obtido pela fusão de silicatos exóticos quânticos, Hélio-3 e ligas nobres platinoides.',
    subtitle: 'Restaura Casco/Energia/Dobra + Bônus de +240 CR',
  },
];

export const BackpackModal: React.FC<BackpackModalProps> = ({
  isOpen,
  onClose,
  survival,
  survivalNotice,
  playerMode,
  onConsumeFood,
  onConsumeWater,
  onUseRepairKit,
  onConsumeWarpCell,
  onSynthesizeRecipe,
  onSellCargo,
  onSellAllCargo,
  onDiscardCargo,
}) => {
  const [activeTab, setActiveTab] = useState<BackpackTab>('owned');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMode>('qty');
  const [selectedKey, setSelectedKey] = useState<string>('mineral:water-ice');

  const dockBonusMultiplier = survival.nearRefuelSource === 'ORBITAL_STATION' ? 1.25 : 1.0;

  const allItems: UnifiedBackpackItem[] = useMemo(() => {
    const provisions: UnifiedBackpackItem[] = PROVISION_ITEMS.map((p) => {
      const qty = survival[p.id] ?? 0;
      const statLabel =
        p.id === 'waterFlasks'
          ? `Hidratação Piloto: ${Math.round(survival.thirstPercent)}%`
          : p.id === 'foodRations'
            ? `Saciedade Piloto: ${Math.round(survival.hungerPercent)}%`
            : p.id === 'repairKits'
              ? `Integridade Casco: ${Math.round(survival.hullIntegrity)}%`
              : `Energia de Dobra: ${Math.round(survival.warpEnergyPercent)}%`;
      return {
        kind: 'provision',
        key: `provision:${p.id}`,
        id: p.id,
        name: p.name,
        formula: p.formula,
        rarity: p.rarity,
        colorHex: p.colorHex,
        imagePath: p.imagePath,
        qty,
        unitMassKg: p.unitMassKg,
        creditValue: 0,
        description: p.description,
        subtitle: p.effectSummary,
        recipeId: p.craftRecipeId,
        statLabel,
      };
    });

    const minerals: UnifiedBackpackItem[] = MINING_RESOURCE_LIST.map((r) => ({
      kind: 'mineral',
      key: `mineral:${r.id}`,
      id: r.id,
      name: r.name,
      formula: r.formula,
      rarity: r.rarity,
      colorHex: r.colorHex,
      imagePath: RESOURCE_IMAGE_PATHS[r.id],
      qty: survival.cargoInventory[r.id] ?? 0,
      unitMassKg: r.unitMassKg,
      creditValue: r.creditValue,
      description: r.description,
      subtitle: r.commonSources,
    }));

    const modules: UnifiedBackpackItem[] = MODULE_META.map((m) => {
      const recipe = MINING_RECIPES_BY_ID[m.recipeId];
      return {
        kind: 'module',
        key: `module:${m.recipeId}`,
        id: m.recipeId,
        name: recipe.name,
        formula: recipe.formula,
        rarity: m.rarity,
        colorHex: m.colorHex,
        imagePath: RECIPE_IMAGE_PATHS[m.recipeId],
        qty: 0,
        unitMassKg: m.unitMassKg,
        creditValue: m.creditValue,
        description: m.description,
        subtitle: m.subtitle,
        recipeId: m.recipeId,
      };
    });

    return [...provisions, ...minerals, ...modules];
  }, [survival]);

  const usedCargoUnits = getTotalCargoUnits(survival.cargoInventory);
  const totalProvisions =
    survival.waterFlasks + survival.foodRations + survival.repairKits + survival.warpCells;

  const { totalMassKg, totalCargoValue } = useMemo(() => {
    let mass = 0;
    let value = 0;
    for (const r of MINING_RESOURCE_LIST) {
      const qty = survival.cargoInventory[r.id] ?? 0;
      if (qty > 0) {
        mass += qty * r.unitMassKg;
        value += qty * Math.round(r.creditValue * dockBonusMultiplier);
      }
    }
    for (const p of PROVISION_ITEMS) {
      mass += (survival[p.id] ?? 0) * p.unitMassKg;
    }
    return { totalMassKg: mass, totalCargoValue: value };
  }, [dockBonusMultiplier, survival]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allItems.filter((item) => {
      if (activeTab === 'owned') {
        if (item.kind === 'module') return false;
        if (item.qty <= 0 && item.kind === 'mineral') return false;
      } else if (activeTab === 'minerals') {
        if (item.kind !== 'mineral') return false;
      } else if (activeTab === 'provisions') {
        if (item.kind === 'mineral') return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.formula.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'qty') {
        if (b.qty !== a.qty) return b.qty - a.qty;
        return RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
      }
      if (sortBy === 'value') {
        return b.creditValue - a.creditValue;
      }
      if (RARITY_META[b.rarity].rank !== RARITY_META[a.rarity].rank) {
        return RARITY_META[b.rarity].rank - RARITY_META[a.rarity].rank;
      }
      return b.qty - a.qty;
    });
  }, [activeTab, allItems, query, sortBy]);

  useEffect(() => {
    if (!isOpen) return;
    const stillVisible = visibleItems.some((item) => item.key === selectedKey);
    if (!stillVisible && visibleItems.length > 0) {
      setSelectedKey(visibleItems[0].key);
    }
  }, [isOpen, selectedKey, visibleItems]);

  if (!isOpen) return null;

  const selectedItem =
    allItems.find((i) => i.key === selectedKey) ?? visibleItems[0] ?? allItems[0];

  const handleUseProvision = (id: ProvisionItemId) => {
    if (id === 'waterFlasks') onConsumeWater();
    else if (id === 'foodRations') onConsumeFood();
    else if (id === 'repairKits') onUseRepairKit();
    else onConsumeWarpCell();
  };

  const selectedRecipe =
    selectedItem.kind === 'provision' || selectedItem.kind === 'module'
      ? MINING_RECIPES_BY_ID[selectedItem.recipeId]
      : null;

  const canCraftSelected = selectedRecipe
    ? selectedRecipe.ingredients.every(
        (ing) => (survival.cargoInventory[ing.resourceId] ?? 0) >= ing.amount
      ) && survival.batteryPercent >= selectedRecipe.energyCostPct
    : false;

  const modeLabel =
    playerMode === 'EVA'
      ? 'Traje Orbital EVA'
      : playerMode === 'SPACECRAFT'
        ? 'Nave SR-7 em Voo'
        : 'Observatório Espacial';

  const cargoFillPct = Math.min(
    100,
    Math.round((usedCargoUnits / Math.max(1, survival.cargoCapacityUnits)) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-900/48 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="backpack-modal"
    >
      <div className="menu-glass-surface relative w-full max-w-6xl h-[90vh] max-h-[820px] rounded-3xl border border-sky-300/40 flex flex-col overflow-hidden text-slate-100">
        {/* Subtle Top Decorative Gradient Accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/85 to-transparent" />

        {/* HEADER BAR */}
        <div className="menu-glass-header shrink-0 px-4 py-3.5 sm:px-6 border-b border-sky-200/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              <Backpack className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold tracking-wide text-white uppercase">
                  Mochila de Campo &amp; Porão Mineral
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 text-[10px] font-mono text-cyan-200">
                  ATALHO [I]
                </span>
                <span className="hidden md:inline px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                  {modeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inspecione espécimes astroquímicos minerados, acione provisões e sintetize módulos em voo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Capacity Pill */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 flex items-center gap-2.5">
              <Package className="w-3.5 h-3.5 text-amber-300" />
              <div className="text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Porão</span>
                  <span className="text-white font-bold">
                    {usedCargoUnits}/{survival.cargoCapacityUnits}
                  </span>
                </div>
                <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                  <div
                    className={`h-full transition-all ${
                      cargoFillPct > 88 ? 'bg-rose-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${cargoFillPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Weight Pill */}
            <div className="hidden sm:flex px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 items-center gap-2 text-[11px] font-mono">
              <Scale className="w-3.5 h-3.5 text-sky-300" />
              <span className="text-slate-300">{totalMassKg.toFixed(1)} kg</span>
            </div>

            {/* Credits Pill */}
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/50 border border-emerald-400/35 flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-200">
              <Coins className="w-3.5 h-3.5 text-emerald-300" />
              <span>{survival.spaceCredits.toLocaleString('pt-BR')} CR</span>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/15 hover:border-rose-400/50 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              title="Fechar Mochila (I ou Esc)"
              aria-label="Fechar Mochila"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Notice Toast inside Backpack */}
        {survivalNotice && (
          <div className="shrink-0 px-5 py-1.5 bg-cyan-500/12 border-b border-cyan-400/25 flex items-center gap-2 text-[11px] font-mono text-cyan-200">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="truncate">{survivalNotice}</span>
          </div>
        )}

        {/* FILTER TOOLBAR */}
        <div className="menu-glass-subbar shrink-0 px-4 py-2.5 sm:px-6 border-b border-sky-200/15 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'owned', label: `Na Mochila (${usedCargoUnits + totalProvisions} un)` },
                { id: 'minerals', label: `Minérios (${usedCargoUnits} un)` },
                { id: 'provisions', label: `Suprimentos & Módulos` },
                { id: 'catalog', label: `Todos os Itens (${allItems.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-semibold border transition-all ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/25 border-cyan-300 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar item, fórmula, planeta..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-400"
              aria-label="Ordenar inventário"
            >
              <option value="qty">Por Estoque</option>
              <option value="value">Por Valor (CR)</option>
              <option value="rarity">Por Raridade</option>
            </select>
          </div>
        </div>

        {/* MAIN SPLIT BODY: GRID + INSPECTOR */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT GRID */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
            {visibleItems.length === 0 ? (
              <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <Package className="w-7 h-7 text-slate-500" />
                </div>
                <h3 className="text-sm font-bold text-white">Nenhum item correspondente</h3>
                <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                  {activeTab === 'owned' && usedCargoUnits === 0
                    ? 'Seu porão mineral ainda está vazio. Aproxime-se de planetas ou asteroides na SR-7 e dispare o Laser Extrator [X], ou explore a aba "Todos os Itens".'
                    : 'Tente limpar a busca ou selecionar a aba "Todos os Itens" para visualizar os 18 espécimes e módulos.'}
                </p>
                {activeTab !== 'catalog' && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setActiveTab('catalog');
                    }}
                    className="mt-4 px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/45 text-cyan-100 text-xs font-mono font-bold transition-colors"
                  >
                    Ver Todos os 18 Itens
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {visibleItems.map((item) => {
                  const isSelected = selectedItem?.key === item.key;
                  const rarityInfo = RARITY_META[item.rarity];
                  const dimmed = item.kind !== 'module' && item.qty === 0;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setSelectedKey(item.key)}
                      onDoubleClick={() => {
                        if (item.kind === 'provision' && item.qty > 0) {
                          handleUseProvision(item.id);
                        }
                      }}
                      className={`group relative text-left rounded-2xl p-2 border transition-all flex flex-col gap-2 overflow-hidden ${
                        isSelected
                          ? 'bg-slate-900 border-cyan-300 ring-2 ring-cyan-400/35 shadow-[0_8px_28px_rgba(34,211,238,0.22)]'
                          : 'bg-slate-900/65 hover:bg-slate-900/95 border-white/10 hover:border-white/25'
                      } ${dimmed ? 'opacity-65 hover:opacity-100' : ''}`}
                      data-testid={`backpack-card-${item.id}`}
                    >
                      {/* Square Image Frame */}
                      <div
                        className="relative w-full aspect-square rounded-xl overflow-hidden bg-[#060b16] border border-white/10"
                        style={{
                          boxShadow: isSelected
                            ? `inset 0 0 24px ${item.colorHex}33`
                            : `inset 0 0 14px ${item.colorHex}1c`,
                        }}
                      >
                        <img
                          src={item.imagePath}
                          alt={item.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />

                        {/* Corner Badge: Stock Quantity */}
                        {item.kind !== 'module' ? (
                          <span
                            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-bold backdrop-blur-md border ${
                              item.qty > 0
                                ? 'bg-slate-950/85 border-cyan-400/50 text-white'
                                : 'bg-slate-950/75 border-white/15 text-slate-400'
                            }`}
                          >
                            ×{item.qty}
                          </span>
                        ) : (
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg text-[9px] font-mono font-bold bg-emerald-950/85 border border-emerald-400/45 text-emerald-200 backdrop-blur-md">
                            SÍNTESE
                          </span>
                        )}

                        {/* Bottom-left subtle color indicator bar */}
                        <span
                          className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-slate-950/85 border border-white/15 text-slate-200 max-w-[85%] truncate"
                        >
                          {item.formula.split(' ')[0]}
                        </span>
                      </div>

                      {/* Card Caption */}
                      <div className="px-0.5">
                        <div className="text-xs font-semibold text-white truncate leading-tight">
                          {item.name}
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-1 text-[10px] font-mono">
                          <span
                            className={`px-1.5 py-0.2 rounded border text-[9px] ${rarityInfo.pillClass}`}
                          >
                            {rarityInfo.label}
                          </span>
                          <span className="text-slate-400">
                            {item.creditValue > 0
                              ? `${Math.round(item.creditValue * dockBonusMultiplier)} CR`
                              : `${item.unitMassKg} kg`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT INSPECTOR PANEL */}
          {selectedItem && (
            <div className="w-full lg:w-[370px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-slate-950/75 p-3.5 sm:p-4 overflow-y-auto flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                {/* Large Studio Artwork Preview */}
                <div className="flex items-start gap-3 lg:flex-col lg:items-stretch">
                  <div
                    className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-full lg:h-44 shrink-0 rounded-2xl overflow-hidden bg-[#060b16] border border-white/15"
                    style={{
                      boxShadow: `0 10px 36px ${selectedItem.colorHex}26, inset 0 0 28px ${selectedItem.colorHex}22`,
                    }}
                  >
                    <img
                      src={selectedItem.imagePath}
                      alt={selectedItem.name}
                      className="w-full h-full object-contain bg-[#060b16]"
                    />
                    <span
                      className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold backdrop-blur-md ${RARITY_META[selectedItem.rarity].pillClass}`}
                    >
                      {RARITY_META[selectedItem.rarity].label}
                    </span>
                    {selectedItem.kind !== 'module' && (
                      <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-lg bg-slate-950/90 border border-cyan-400/50 text-xs font-mono font-bold text-white">
                        {selectedItem.qty} un
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      {selectedItem.kind === 'mineral' ? (
                        <>
                          <Gem className="w-3.5 h-3.5" /> Espécime Astroquímico
                        </>
                      ) : selectedItem.kind === 'provision' ? (
                        <>
                          <Wrench className="w-3.5 h-3.5" /> Provisão de Sobrevivência
                        </>
                      ) : (
                        <>
                          <Atom className="w-3.5 h-3.5" /> Módulo / Síntese Química
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white leading-snug">
                      {selectedItem.name}
                    </h3>
                    <div className="text-xs font-mono text-amber-300">{selectedItem.formula}</div>
                  </div>
                </div>

                {/* Telemetry Stats Row */}
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="rounded-xl bg-slate-900/90 border border-white/10 p-2">
                    <div className="text-[9px] text-slate-400 uppercase">Estoque</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {selectedItem.kind === 'module' ? 'Receita' : `${selectedItem.qty} un`}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/90 border border-white/10 p-2">
                    <div className="text-[9px] text-slate-400 uppercase">Massa</div>
                    <div className="text-xs font-bold text-sky-200 mt-0.5">
                      {selectedItem.unitMassKg} kg/un
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-900/90 border border-white/10 p-2">
                    <div className="text-[9px] text-slate-400 uppercase">Mercado</div>
                    <div className="text-xs font-bold text-emerald-300 mt-0.5">
                      {selectedItem.creditValue > 0
                        ? `${Math.round(selectedItem.creditValue * dockBonusMultiplier)} CR`
                        : 'Uso Bordo'}
                    </div>
                  </div>
                </div>

                {/* Scientific Description */}
                <div className="rounded-2xl bg-slate-900/75 border border-white/10 p-3 space-y-2">
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedItem.description}
                  </p>
                  <div className="pt-1.5 border-t border-white/10 text-[11px] font-mono text-emerald-300/95">
                    {selectedItem.kind === 'mineral' ? (
                      <span>Fontes: {selectedItem.subtitle}</span>
                    ) : (
                      <span>Efeito: {selectedItem.subtitle}</span>
                    )}
                  </div>
                  {selectedItem.kind === 'provision' && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{selectedItem.statLabel}</span>
                    </div>
                  )}
                </div>

                {/* Recipe Requirements for Provisions & Modules */}
                {selectedRecipe && (
                  <div className="rounded-2xl bg-slate-900/75 border border-white/10 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300">
                      <span className="font-bold flex items-center gap-1.5">
                        <FlaskConical className="w-3.5 h-3.5" />
                        FABRICAÇÃO A BORDO
                      </span>
                      <span className="text-slate-400">
                        Bateria {Math.round(survival.batteryPercent)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                      {selectedRecipe.ingredients.map((ing) => {
                        const def = MINING_RESOURCES[ing.resourceId];
                        const owned = survival.cargoInventory[ing.resourceId] ?? 0;
                        const ok = owned >= ing.amount;
                        return (
                          <span
                            key={ing.resourceId}
                            className={`px-2 py-0.5 rounded-lg border ${
                              ok
                                ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-200'
                                : 'bg-rose-500/10 border-rose-400/25 text-slate-300'
                            }`}
                          >
                            {owned}/{ing.amount} {def.name.split(' ')[0]}
                          </span>
                        );
                      })}
                      <span
                        className={`px-2 py-0.5 rounded-lg border ${
                          survival.batteryPercent >= selectedRecipe.energyCostPct
                            ? 'bg-sky-500/15 border-sky-400/35 text-sky-200'
                            : 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                        }`}
                      >
                        ⚡ {selectedRecipe.energyCostPct}% Bat
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* INSPECTOR ACTION BUTTONS */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                {selectedItem.kind === 'provision' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleUseProvision(selectedItem.id)}
                      disabled={selectedItem.qty <= 0}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-colors ${
                        selectedItem.qty > 0
                          ? 'bg-sky-500/25 hover:bg-sky-500/40 border-sky-300 text-white'
                          : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {PROVISION_ITEMS.find((p) => p.id === selectedItem.id)?.actionLabel ?? 'Usar'}
                    </button>
                    <button
                      onClick={() => onSynthesizeRecipe(selectedItem.recipeId)}
                      disabled={!canCraftSelected}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-colors ${
                        canCraftSelected
                          ? 'bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-300 text-white'
                          : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Sintetizar +1
                    </button>
                  </div>
                )}

                {selectedItem.kind === 'module' && (
                  <button
                    onClick={() => onSynthesizeRecipe(selectedItem.recipeId)}
                    disabled={!canCraftSelected}
                    className={`w-full py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-colors ${
                      canCraftSelected
                        ? 'bg-emerald-500/30 hover:bg-emerald-500/45 border-emerald-300 text-white'
                        : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Sintetizar Módulo Agora
                  </button>
                )}

                {selectedItem.kind === 'mineral' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSellCargo(selectedItem.id, 1)}
                        disabled={selectedItem.qty <= 0}
                        className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-mono font-bold transition-colors ${
                          selectedItem.qty > 0
                            ? 'bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-400/50 text-emerald-100'
                            : 'bg-white/5 border-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Vender 1 (+{Math.round(selectedItem.creditValue * dockBonusMultiplier)} CR)
                      </button>
                      <button
                        onClick={() => onDiscardCargo(selectedItem.id)}
                        disabled={selectedItem.qty <= 0}
                        className={`p-2 rounded-xl border transition-colors ${
                          selectedItem.qty > 0
                            ? 'bg-white/5 hover:bg-rose-500/25 border-white/15 hover:border-rose-400/50 text-slate-300 hover:text-rose-200'
                            : 'bg-white/5 border-white/10 text-slate-600 cursor-not-allowed'
                        }`}
                        title="Descartar 1 unidade no espaço"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {selectedItem.qty > 1 && (
                      <button
                        onClick={() => onSellCargo(selectedItem.id, selectedItem.qty)}
                        className="w-full py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-mono font-bold transition-colors"
                      >
                        Vender Lote Completo (×{selectedItem.qty} = +
                        {selectedItem.qty *
                          Math.round(selectedItem.creditValue * dockBonusMultiplier)}{' '}
                        CR)
                      </button>
                    )}
                  </div>
                )}

                {totalCargoValue > 0 && (
                  <button
                    onClick={onSellAllCargo}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/45 text-amber-100 text-[11px] font-mono font-bold transition-colors"
                  >
                    Liquidar Todo o Porão (+{totalCargoValue.toLocaleString('pt-BR')} CR
                    {dockBonusMultiplier > 1 ? ' · Bônus Doca +25%' : ''})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
