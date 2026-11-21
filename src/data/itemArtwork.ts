import type { MiningRecipeId, MiningResourceId, SurvivalResourcesState } from '../types/astronomy';

export type ProvisionItemId = 'waterFlasks' | 'foodRations' | 'repairKits' | 'warpCells';

export interface ProvisionItemDefinition {
  id: ProvisionItemId;
  name: string;
  formula: string;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC';
  colorHex: string;
  imagePath: string;
  description: string;
  effectSummary: string;
  actionLabel: string;
  unitMassKg: number;
  craftRecipeId: MiningRecipeId;
}

export const RESOURCE_IMAGE_PATHS: Record<MiningResourceId, string> = {
  'water-ice': '/images/items/water-ice.webp',
  'silicate-regolith': '/images/items/silicate-regolith.webp',
  'iron-nickel': '/images/items/iron-nickel.webp',
  'titanium-ilmenite': '/images/items/titanium-ilmenite.webp',
  'cryo-methane': '/images/items/cryo-methane.webp',
  'ammonia-hydrates': '/images/items/ammonia-hydrates.webp',
  'sulfur-compounds': '/images/items/sulfur-compounds.webp',
  'helium-3': '/images/items/helium-3.webp',
  'platinum-group': '/images/items/platinum-group.webp',
  'exotic-silicates': '/images/items/exotic-silicates.webp',
};

export const RECIPE_IMAGE_PATHS: Record<MiningRecipeId, string> = {
  'purify-water': '/images/items/purify-water.webp',
  'synthesize-o2': '/images/items/synthesize-o2.webp',
  'biomass-ration': '/images/items/biomass-ration.webp',
  'hydrazine-fuel': '/images/items/hydrazine-fuel.webp',
  'titanium-plates': '/images/items/titanium-plates.webp',
  'cryo-coolant': '/images/items/cryo-coolant.webp',
  'battery-capacitor': '/images/items/sulfur-compounds.webp',
  'platinum-reactor-catalyst': '/images/items/platinum-group.webp',
  'he3-warp-cell': '/images/items/he3-warp-cell.webp',
  'interstellar-resonator': '/images/items/interstellar-resonator.webp',
};

export const PROVISION_ITEMS: ProvisionItemDefinition[] = [
  {
    id: 'waterFlasks',
    name: 'Cantil de Água Purificada',
    formula: 'H₂O · Grau Orbital',
    rarity: 'COMMON',
    colorHex: '#38bdf8',
    imagePath: RECIPE_IMAGE_PATHS['purify-water'],
    description:
      'Cantil pressurizado com cartucho filtrante mineralizante obtido por fusão e purificação UV de gelo espacial.',
    effectSummary: '+42% Hidratação do piloto ao consumir.',
    actionLabel: 'Beber Água',
    unitMassKg: 0.9,
    craftRecipeId: 'purify-water',
  },
  {
    id: 'foodRations',
    name: 'Ração Energética de Biomassa',
    formula: 'CH₂O · Liofilizado',
    rarity: 'COMMON',
    colorHex: '#f59e0b',
    imagePath: RECIPE_IMAGE_PATHS['biomass-ration'],
    description:
      'Kit hermético de barras nutricionais de alta densidade calórica e ampola bioestimulante para longas missões.',
    effectSummary: '+42% Saciedade e +12% Energia do piloto.',
    actionLabel: 'Comer Ração',
    unitMassKg: 0.7,
    craftRecipeId: 'biomass-ration',
  },
  {
    id: 'repairKits',
    name: 'Kit de Reparo Estrutural Ti-6Al-4V',
    formula: 'Ti-6Al-4V · Nanossolda',
    rarity: 'UNCOMMON',
    colorHex: '#818cf8',
    imagePath: RECIPE_IMAGE_PATHS['titanium-plates'],
    description:
      'Conjunto de placas hexagonais de titânio forjado com grampo magnético e micro-tocha a laser para selagem de microfissuras no casco.',
    effectSummary: '+34% Integridade do casco da SR-7.',
    actionLabel: 'Aplicar Reparo',
    unitMassKg: 4.5,
    craftRecipeId: 'titanium-plates',
  },
  {
    id: 'warpCells',
    name: 'Célula de Dobra Quântica ³He',
    formula: '³He + Exótico · Alcubierre',
    rarity: 'EXOTIC',
    colorHex: '#e879f9',
    imagePath: RECIPE_IMAGE_PATHS['he3-warp-cell'],
    description:
      'Cápsula supercondutora contendo plasma de Hélio-3 estabilizado em campo magnético toroidal para recarga instantânea do motor de dobra.',
    effectSummary: '+50% Energia de Dobra Quântica.',
    actionLabel: 'Injetar Célula',
    unitMassKg: 3.2,
    craftRecipeId: 'he3-warp-cell',
  },
];

export function getProvisionQuantity(
  survival: SurvivalResourcesState,
  id: ProvisionItemId
): number {
  return survival[id] ?? 0;
}
