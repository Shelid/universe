import type {
  MiningRecipeId,
  MiningResourceId,
} from '../types/astronomy';

export type CatalogResourceCategory =
  | 'VOLATILE'
  | 'SILICATE'
  | 'METALLIC'
  | 'ISOTOPE'
  | 'EXOTIC';

export interface CatalogResourceDefinition {
  id: MiningResourceId;
  name: string;
  formula: string;
  category: CatalogResourceCategory;
  rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EXOTIC';
  unitMassKg: number;
  creditValue: number;
  colorHex: string;
  description: string;
  commonSources: string;
}

export interface CatalogRecipeIngredient {
  resourceId: MiningResourceId;
  amount: number;
}

export interface CatalogSynthesisRecipe {
  id: MiningRecipeId;
  name: string;
  formula: string;
  category: 'SURVIVAL' | 'PROPULSION' | 'ENGINEERING' | 'HIGH_TECH';
  ingredients: CatalogRecipeIngredient[];
  energyCostPct: number;
  outputSummary: string;
  effects: {
    water?: number;
    waterFlasks?: number;
    oxygen?: number;
    food?: number;
    foodRations?: number;
    fuel?: number;
    hull?: number;
    repairKits?: number;
    warpEnergy?: number;
    warpCells?: number;
    coolingC?: number;
    battery?: number;
    credits?: number;
  };
  scienceNote: string;
}

export interface CatalogMiningYield {
  resourceId: MiningResourceId;
  weight: number;
  purity: number;
  veinNote: string;
}

export interface CatalogCelestialMiningProfile {
  bodyId: string;
  bodyTypeLabel: string;
  extractable: boolean;
  restrictionReason?: string;
  extractionMethod: string;
  hardnessFactor: number;
  laserColorHex: string;
  yields: CatalogMiningYield[];
}

export interface CatalogOrbitalHotspot {
  id: string;
  bodyId: string;
  label: string;
  resourceId: MiningResourceId;
  localNormal: { x: number; y: number; z: number };
  multiplier: number;
  radiusRad: number;
  colorHex: string;
}

export const MINING_RESOURCES: Record<MiningResourceId, CatalogResourceDefinition> = {
  'water-ice': {
    id: 'water-ice',
    name: 'Gelo de Água Criogênico',
    formula: 'H₂O (s)',
    category: 'VOLATILE',
    rarity: 'COMMON',
    unitMassKg: 14,
    creditValue: 26,
    colorHex: '#38bdf8',
    description:
      'Gelo subsuperficial de alta pureza extraído de crateras permanentemente sombreadas, plumas criovulcânicas e crostas oceânicas congeladas. Base para água potável e eletrólise de oxigênio.',
    commonSources: 'Lua, Europa, Encélado, Ganimedes, Ceres, Cometas',
  },
  'silicate-regolith': {
    id: 'silicate-regolith',
    name: 'Regolito Silicatado',
    formula: 'MgFeSiO₄ / SiO₂',
    category: 'SILICATE',
    rarity: 'COMMON',
    unitMassKg: 22,
    creditValue: 18,
    colorHex: '#d6b48a',
    description:
      'Poeira mineral rica em olivina, piroxênio e oxigênio quimicamente ligado em óxidos metálicos. Fornece massa de blindagem e macronutrientes minerais para bioponia.',
    commonSources: 'Mercúrio, Lua, Fobos, Vesta, Bennu, Marte',
  },
  'iron-nickel': {
    id: 'iron-nickel',
    name: 'Liga Ferro-Níquel Meteórica',
    formula: 'Fe-Ni (γ-taenita)',
    category: 'METALLIC',
    rarity: 'COMMON',
    unitMassKg: 34,
    creditValue: 34,
    colorHex: '#94a3b8',
    description:
      'Metal siderófilo nativo cristalizado em resfriamento lento de núcleos planetesimais. Essencial para chapas estruturais de reparo do casco e blindagem antirradiação.',
    commonSources: '16 Psyche, Vesta, Mercúrio, Fobos, Deimos',
  },
  'titanium-ilmenite': {
    id: 'titanium-ilmenite',
    name: 'Ilmenita de Titânio',
    formula: 'FeTiO₃',
    category: 'METALLIC',
    rarity: 'UNCOMMON',
    unitMassKg: 28,
    creditValue: 58,
    colorHex: '#cbd5e1',
    description:
      'Óxido denso de ferro e titânio encontrado em mares basálticos lunares e crostas vulcânicas antigas. Fundida em placas aeroespaciais leves e resistentes a impactos.',
    commonSources: 'Lua (Mares), Mercúrio, Marte, Io, Vesta',
  },
  'cryo-methane': {
    id: 'cryo-methane',
    name: 'Metano & Hidrocarbonetos Criogênicos',
    formula: 'CH₄ / C₂H₆',
    category: 'VOLATILE',
    rarity: 'UNCOMMON',
    unitMassKg: 12,
    creditValue: 46,
    colorHex: '#22d3ee',
    description:
      'Hidrocarbonetos leves coletados em lagos criogênicos de Titã, atmosferas de gigantes gelados e geleiras de N₂/CH₄ do Cinturão de Kuiper.',
    commonSources: 'Titã, Urano, Netuno, Tritão, Plutão, Quaoar',
  },
  'ammonia-hydrates': {
    id: 'ammonia-hydrates',
    name: 'Hidratos de Amônia & Azoto',
    formula: 'NH₃·H₂O / CHNOPS',
    category: 'VOLATILE',
    rarity: 'UNCOMMON',
    unitMassKg: 16,
    creditValue: 52,
    colorHex: '#4ade80',
    description:
      'Fonte estratégica de nitrogênio reduzido e água ligada. Permite sintetizar hidrazina para propulsão química e proteínas/vitaminas nas estufas hidropônicas.',
    commonSources: 'Encélado, Titã, Tritão, Caronte, Ceres, Cometas',
  },
  'sulfur-compounds': {
    id: 'sulfur-compounds',
    name: 'Compostos Sulfurosos & Silicatos Ácidos',
    formula: 'SO₂ / S₈ / FeS',
    category: 'SILICATE',
    rarity: 'UNCOMMON',
    unitMassKg: 20,
    creditValue: 44,
    colorHex: '#facc15',
    description:
      'Depósitos vulcânicos de enxofre alotrópico e dióxido de enxofre congelado. Recurso energético secundário: recarrega +30% da Energia da Nave como eletrólito de alta descarga.',
    commonSources: 'Io, Vênus (alta atmosfera), Europa, Mimas',
  },
  'helium-3': {
    id: 'helium-3',
    name: 'Isótopo Hélio-3 Solar (Energia)',
    formula: '³He',
    category: 'ISOTOPE',
    rarity: 'RARE',
    unitMassKg: 4,
    creditValue: 135,
    colorHex: '#3b82f6',
    description:
      'Recurso energético primário da nave! Isótopo implantado pelo vento solar ou sifonado da Coroa Solar, Lua, Mercúrio e gigantes gasosos. Repõe +45% da Energia da Nave ao ser minerado ou injetado no reator.',
    commonSources: 'Sol (Coroa Solar), Lua, Mercúrio, Júpiter, Saturno, Urano, Netuno',
  },
  'platinum-group': {
    id: 'platinum-group',
    name: 'Metais do Grupo da Platina (PGM)',
    formula: 'Pt / Ir / Os / Rh',
    category: 'METALLIC',
    rarity: 'RARE',
    unitMassKg: 38,
    creditValue: 165,
    colorHex: '#e2e8f0',
    description:
      'Catalisadores nobres de altíssima densidade provenientes de asteroides metálicos diferenciados. Valiosíssimos na Estação Orbital e indispensáveis em eletrodos de dobra.',
    commonSources: '16 Psyche, Bennu, Apophis, Vesta, Reia',
  },
  'exotic-silicates': {
    id: 'exotic-silicates',
    name: 'Silicatos Amorfos Interestelares',
    formula: 'SiC / Nano-grafeno',
    category: 'EXOTIC',
    rarity: 'EXOTIC',
    unitMassKg: 18,
    creditValue: 260,
    colorHex: '#c084fc',
    description:
      'Grãos pré-solares irradiados por raios cósmicos interestelares e cometas primordiais da Nuvem de Oort. Apresentam ressonância quântica útil em bobinas de dobra e fusão de cristais lendários.',
    commonSources: '1I/ʻOumuamua, Krystallos-V, Arrokoth, Gonggong, Halley, 67P',
  },
  'void-crystal': {
    id: 'void-crystal',
    name: 'Cristal de Vácuo Quântico',
    formula: 'Qr·SiC₄ (Lendário)',
    category: 'EXOTIC',
    rarity: 'EXOTIC',
    unitMassKg: 10,
    creditValue: 420,
    colorHex: '#38bdf8',
    description:
      'Cristal hiperbarométrico formado sob 400 GPa em Super-Terras glaciais e mundos de diamante, ou obtido pela fusão de Silicatos Exóticos com Platina. Repõe +65% da Energia e do Banco de Baterias.',
    commonSources: 'Tyche-IX, Krystallos-V, Xylos-Omega, Fusão Mineral',
  },
  'solar-plasma-core': {
    id: 'solar-plasma-core',
    name: 'Núcleo de Plasma Estelar Condensado',
    formula: '³He·H⁺ (p)',
    category: 'ISOTOPE',
    rarity: 'EXOTIC',
    unitMassKg: 8,
    creditValue: 540,
    colorHex: '#fde047',
    description:
      'Esfera magnética de plasma estelar estabilizado, extraída da estrela Solaris-Nova, caldeiras de Ignis-Prime, tempestades de Aether-IX ou fundindo Hélio-3 com Cristal de Vácuo. Repõe +85% de Energia.',
    commonSources: 'Estrela Solaris-Nova, Ignis-Prime, Aether-IX, Fusão Mineral',
  },
  'chronos-alloy': {
    id: 'chronos-alloy',
    name: 'Superliga Aether-Platina',
    formula: 'Pt₃Ir·TiC',
    category: 'METALLIC',
    rarity: 'EXOTIC',
    unitMassKg: 24,
    creditValue: 680,
    colorHex: '#34d399',
    description:
      'Superliga metamaterial indestrutível extraída do núcleo metálico de Nyx-Obsidian e recifes de Xylos-Omega, ou forjada na Fusão Mineral. Indispensável para evoluir os sistemas da nave na Oficina.',
    commonSources: 'Nyx-Obsidian, Xylos-Omega, Chronos-Prime, Fusão Mineral',
  },
  'andromeda-hypercrystal': {
    id: 'andromeda-hypercrystal',
    name: 'Hipercristal de Andrômeda (Supremo)',
    formula: 'Ω-³He·SiC',
    category: 'EXOTIC',
    rarity: 'EXOTIC',
    unitMassKg: 6,
    creditValue: 950,
    colorHex: '#e879f9',
    description:
      'O recurso mineral mais raro e valioso do cosmos! Extraído nos anéis quânticos de Chronos-Prime e Aether-IX ou criado pela fusão de Núcleo de Plasma com Superliga Aether-Platina. Restaura 100% da Energia e do Banco!',
    commonSources: 'Chronos-Prime, Aether-IX, Estrela Solaris-Nova, Fusão Mineral',
  },
};

export const MINING_RESOURCE_LIST: CatalogResourceDefinition[] = Object.values(MINING_RESOURCES);

/**
 * Direct Ship Energy & Battery Bank replenishment yields when mining or injecting minerals into the Reactor/Battery Bank.
 */
export const ENERGY_MINERAL_YIELDS: Record<
  MiningResourceId,
  { batteryPct: number; bankPct: number; warpPct?: number; fuelPct?: number; label: string }
> = {
  'helium-3': {
    batteryPct: 45,
    bankPct: 35,
    warpPct: 14,
    label: '+45% Energia / Banco · +14% Dobra',
  },
  'exotic-silicates': {
    batteryPct: 40,
    bankPct: 32,
    warpPct: 10,
    label: '+40% Energia / Banco · +10% Dobra',
  },
  'platinum-group': {
    batteryPct: 35,
    bankPct: 28,
    label: '+35% Energia / Banco (Catalisador)',
  },
  'sulfur-compounds': {
    batteryPct: 30,
    bankPct: 25,
    label: '+30% Energia / Banco (Eletrólito Li-S)',
  },
  'cryo-methane': {
    batteryPct: 25,
    bankPct: 20,
    fuelPct: 12,
    label: '+25% Energia / Banco · +12% Combustível',
  },
  'titanium-ilmenite': {
    batteryPct: 22,
    bankPct: 18,
    label: '+22% Energia / Banco (Termopar FeTiO₃)',
  },
  'ammonia-hydrates': {
    batteryPct: 18,
    bankPct: 15,
    fuelPct: 8,
    label: '+18% Energia / Banco · +8% Combustível',
  },
  'iron-nickel': {
    batteryPct: 15,
    bankPct: 12,
    label: '+15% Energia / Banco (Anodo Metálico)',
  },
  'water-ice': {
    batteryPct: 14,
    bankPct: 12,
    label: '+14% Energia / Banco (Célula H₂/O₂)',
  },
  'silicate-regolith': {
    batteryPct: 12,
    bankPct: 10,
    label: '+12% Energia / Banco (Termossílica)',
  },
  'void-crystal': {
    batteryPct: 65,
    bankPct: 55,
    warpPct: 25,
    label: '+65% Energia / Banco · +25% Dobra',
  },
  'solar-plasma-core': {
    batteryPct: 85,
    bankPct: 75,
    warpPct: 35,
    label: '+85% Energia / Banco · +35% Dobra',
  },
  'chronos-alloy': {
    batteryPct: 75,
    bankPct: 65,
    fuelPct: 25,
    label: '+75% Energia / Banco · +25% Combustível',
  },
  'andromeda-hypercrystal': {
    batteryPct: 100,
    bankPct: 100,
    warpPct: 60,
    fuelPct: 40,
    label: '+100% Energia & Banco · +60% Dobra',
  },
};

export const CELESTIAL_MINING_PROFILES: Record<string, CatalogCelestialMiningProfile> = {
  sun: {
    bodyId: 'sun',
    bodyTypeLabel: 'Estrela Anã Amarela (G2V) — Coleta Fotovoltaica & Plasma Solar',
    extractable: true,
    extractionMethod:
      'Sifonagem magnetohidrodinâmica da coroa solar para recarga rápida da Energia da Nave e captura de Hélio-3 puro',
    hardnessFactor: 0.55,
    laserColorHex: '#fde047',
    yields: [
      {
        resourceId: 'helium-3',
        weight: 0.74,
        purity: 0.99,
        veinNote: 'Plasma coronal rico em ³He e prótons solares energéticos',
      },
      {
        resourceId: 'exotic-silicates',
        weight: 0.26,
        purity: 0.96,
        veinNote: 'Cristais refratários condensados na zona de ejeção coronal',
      },
    ],
  },
  earth: {
    bodyId: 'earth',
    bodyTypeLabel: 'Planeta Telúrico Oceânico & Crosta Silicatada',
    extractable: true,
    extractionMethod: 'Micro-ablação orbital controlada em cordilheiras basálticas e captação de gelo estratosférico',
    hardnessFactor: 0.85,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'water-ice', weight: 0.30, purity: 0.96, veinNote: 'Cristais de gelo polar e alta troposfera' },
      { resourceId: 'silicate-regolith', weight: 0.26, purity: 0.90, veinNote: 'Escudos continentais de quartzo-basalto' },
      { resourceId: 'iron-nickel', weight: 0.18, purity: 0.88, veinNote: 'Formações ferríferas bandadas' },
      { resourceId: 'titanium-ilmenite', weight: 0.14, purity: 0.86, veinNote: 'Areias minerais ricas em ilmenita' },
      { resourceId: 'helium-3', weight: 0.12, purity: 0.84, veinNote: 'Captura exosférica e magnetopausa terrestre' },
    ],
  },
  mercury: {
    bodyId: 'mercury',
    bodyTypeLabel: 'Planeta Rochoso Rico em Núcleo Metálico',
    extractable: true,
    extractionMethod: 'Ablação laser em escarpas férreas & extração solar de ³He nas altas latitudes',
    hardnessFactor: 1.15,
    laserColorHex: '#fb923c',
    yields: [
      { resourceId: 'iron-nickel', weight: 0.40, purity: 0.92, veinNote: 'Escarpa férrea exposta' },
      { resourceId: 'titanium-ilmenite', weight: 0.28, purity: 0.86, veinNote: 'Planície basáltica Caloris' },
      { resourceId: 'silicate-regolith', weight: 0.18, purity: 0.78, veinNote: 'Regolito superficial' },
      { resourceId: 'helium-3', weight: 0.14, purity: 0.94, veinNote: 'Armadilha polar de vento solar' },
    ],
  },
  venus: {
    bodyId: 'venus',
    bodyTypeLabel: 'Planeta Rochoso com Atmosfera Densa Sulfurosa',
    extractable: true,
    extractionMethod: 'Sifonagem ionizada em nuvens altas de H₂SO₄ & ablação de platôs vulcânicos',
    hardnessFactor: 1.25,
    laserColorHex: '#facc15',
    yields: [
      { resourceId: 'sulfur-compounds', weight: 0.56, purity: 0.95, veinNote: 'Nuvem estratosférica de SO₂' },
      { resourceId: 'silicate-regolith', weight: 0.26, purity: 0.80, veinNote: 'Escudo basáltico Maxwell Montes' },
      { resourceId: 'titanium-ilmenite', weight: 0.18, purity: 0.84, veinNote: 'Derrame lávico de Ovda Regio' },
    ],
  },
  moon: {
    bodyId: 'moon',
    bodyTypeLabel: 'Satélite Rochoso Anidro + Polos Criogênicos',
    extractable: true,
    extractionMethod: 'Desorção térmica de regolito (³He) e sublimação laser em crateras polares',
    hardnessFactor: 0.88,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'silicate-regolith', weight: 0.34, purity: 0.90, veinNote: 'Terras altas anortosíticas' },
      { resourceId: 'titanium-ilmenite', weight: 0.26, purity: 0.91, veinNote: 'Mare Tranquillitatis rico em Ti' },
      { resourceId: 'water-ice', weight: 0.24, purity: 0.89, veinNote: 'Cratera polar Shackleton' },
      { resourceId: 'helium-3', weight: 0.16, purity: 0.96, veinNote: 'Regolito irradiado sem atmosfera' },
    ],
  },
  mars: {
    bodyId: 'mars',
    bodyTypeLabel: 'Planeta Telúrico Oxidado + Calotas de Gelo',
    extractable: true,
    extractionMethod: 'Sublimação de permafrost subsuperficial e redução laser de óxidos de Fe/Ti',
    hardnessFactor: 0.95,
    laserColorHex: '#f97316',
    yields: [
      { resourceId: 'silicate-regolith', weight: 0.30, purity: 0.88, veinNote: 'Basalto olivínico Syrtis Major' },
      { resourceId: 'water-ice', weight: 0.24, purity: 0.87, veinNote: 'Glaciar enterrado em Arcadia Planitia' },
      { resourceId: 'iron-nickel', weight: 0.18, purity: 0.84, veinNote: 'Hematita cristalina Meridiani' },
      { resourceId: 'titanium-ilmenite', weight: 0.16, purity: 0.82, veinNote: 'Província vulcânica Tharsis' },
      { resourceId: 'helium-3', weight: 0.12, purity: 0.85, veinNote: 'Regolito marciano exposto ao vento solar' },
    ],
  },
  phobos: {
    bodyId: 'phobos',
    bodyTypeLabel: 'Lua Capturada / Asteroide Condrito Carbonáceo',
    extractable: true,
    extractionMethod: 'Ablação direta de baixa gravidade no regolito da cratera Stickney',
    hardnessFactor: 0.72,
    laserColorHex: '#cbd5e1',
    yields: [
      { resourceId: 'silicate-regolith', weight: 0.42, purity: 0.88, veinNote: 'Brecha carbonácea Stickney' },
      { resourceId: 'iron-nickel', weight: 0.32, purity: 0.85, veinNote: 'Inclusões metálicas condríticas' },
      { resourceId: 'water-ice', weight: 0.26, purity: 0.80, veinNote: 'Filossilicatos hidratados' },
    ],
  },
  deimos: {
    bodyId: 'deimos',
    bodyTypeLabel: 'Lua Capturada Tipo-D Rica em Voláteis',
    extractable: true,
    extractionMethod: 'Extração microgravitacional suave por feixe contínuo de média potência',
    hardnessFactor: 0.70,
    laserColorHex: '#a5f3fc',
    yields: [
      { resourceId: 'silicate-regolith', weight: 0.45, purity: 0.86, veinNote: 'Manto fino de poeira tipo-D' },
      { resourceId: 'ammonia-hydrates', weight: 0.30, purity: 0.83, veinNote: 'Matriz orgânica hidratada' },
      { resourceId: 'water-ice', weight: 0.25, purity: 0.81, veinNote: 'Gelo intersticial preservado' },
    ],
  },
  ceres: {
    bodyId: 'ceres',
    bodyTypeLabel: 'Planeta Anão Criovulcânico (Cinturão Principal)',
    extractable: true,
    extractionMethod: 'Perfuração laser em domos salinos (Cratera Occator) e manto gelado',
    hardnessFactor: 0.80,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'water-ice', weight: 0.44, purity: 0.96, veinNote: 'Salmoura congelada Cratera Occator' },
      { resourceId: 'ammonia-hydrates', weight: 0.32, purity: 0.91, veinNote: 'Argilas amoniacais Ahuna Mons' },
      { resourceId: 'silicate-regolith', weight: 0.24, purity: 0.84, veinNote: 'Crosta carbonatada externa' },
    ],
  },
  vesta: {
    bodyId: 'vesta',
    bodyTypeLabel: 'Protoplaneta Basáltico Diferenciado',
    extractable: true,
    extractionMethod: 'Corte laser profundo nas escarpas de Rheasilvia rumo ao manto metálico',
    hardnessFactor: 0.96,
    laserColorHex: '#cbd5e1',
    yields: [
      { resourceId: 'iron-nickel', weight: 0.38, purity: 0.93, veinNote: 'Diogenito metálico Rheasilvia' },
      { resourceId: 'titanium-ilmenite', weight: 0.28, purity: 0.89, veinNote: 'Eucrito basáltico de impacto' },
      { resourceId: 'silicate-regolith', weight: 0.22, purity: 0.85, veinNote: 'Brecha howardítica' },
      { resourceId: 'platinum-group', weight: 0.12, purity: 0.88, veinNote: 'Veio siderófilo do pico central' },
    ],
  },
  psyche: {
    bodyId: 'psyche',
    bodyTypeLabel: 'Núcleo Protoplanetário Metálico Exposto (16 Psyche)',
    extractable: true,
    extractionMethod: 'Fusão laser de alta densidade em ligas Fe-Ni maciças e veios siderófilos nobres',
    hardnessFactor: 1.08,
    laserColorHex: '#f8fafc',
    yields: [
      { resourceId: 'iron-nickel', weight: 0.52, purity: 0.98, veinNote: 'Escudo sólido de Fe-Ni puro' },
      { resourceId: 'platinum-group', weight: 0.32, purity: 0.95, veinNote: 'Concentração excepcional de Ir/Pt' },
      { resourceId: 'titanium-ilmenite', weight: 0.16, purity: 0.90, veinNote: 'Inclusões metálicas refratárias' },
    ],
  },
  bennu: {
    bodyId: 'bennu',
    bodyTypeLabel: 'Asteroide Pilha-de-Entulho Carbonáceo (Tipo B)',
    extractable: true,
    extractionMethod: 'Pulso vaporizador de precisão capturando jatos orgânicos e hidratos',
    hardnessFactor: 0.62,
    laserColorHex: '#4ade80',
    yields: [
      { resourceId: 'water-ice', weight: 0.30, purity: 0.88, veinNote: 'Argilas aquosas filossilicatadas' },
      { resourceId: 'ammonia-hydrates', weight: 0.28, purity: 0.90, veinNote: 'Veios carbonatados orgânicos' },
      { resourceId: 'silicate-regolith', weight: 0.26, purity: 0.84, veinNote: 'Pedregulhos condríticos soltos' },
      { resourceId: 'platinum-group', weight: 0.16, purity: 0.89, veinNote: 'PEP metálico microgranular' },
    ],
  },
  apophis: {
    bodyId: 'apophis',
    bodyTypeLabel: 'Asteroide Silicatado NEA (Tipo Sq)',
    extractable: true,
    extractionMethod: 'Corte de baixa inércia térmica sobre regolito rochoso de níquel-ferro',
    hardnessFactor: 0.84,
    laserColorHex: '#f59e0b',
    yields: [
      { resourceId: 'silicate-regolith', weight: 0.44, purity: 0.91, veinNote: 'Piroxênio condrítico ordinário' },
      { resourceId: 'iron-nickel', weight: 0.38, purity: 0.90, veinNote: 'Nódulos metálicos LL-condríticos' },
      { resourceId: 'platinum-group', weight: 0.18, purity: 0.87, veinNote: 'Grãos refratários de platina' },
    ],
  },
  jupiter: {
    bodyId: 'jupiter',
    bodyTypeLabel: 'Gigante Gasoso (Hidrogênio / Hélio)',
    extractable: true,
    extractionMethod: 'Sifonagem magneto-ótica na alta troposfera para separar isótopos de ³He e NH₃',
    hardnessFactor: 1.32,
    laserColorHex: '#60a5fa',
    yields: [
      { resourceId: 'helium-3', weight: 0.56, purity: 0.97, veinNote: 'Corrente de jato equatorial rica em ³He' },
      { resourceId: 'ammonia-hydrates', weight: 0.28, purity: 0.90, veinNote: 'Nuvens de cristais de amônia (0,7 bar)' },
      { resourceId: 'sulfur-compounds', weight: 0.16, purity: 0.85, veinNote: 'Cinturões de hidrossulfeto de amônio' },
    ],
  },
  io: {
    bodyId: 'io',
    bodyTypeLabel: 'Lua Hiper-Vulcânica (Forçamento de Maré)',
    extractable: true,
    extractionMethod: 'Captura de plumas sulfurosas & ablação de fluxos de silicatos ultramáficos',
    hardnessFactor: 1.12,
    laserColorHex: '#fde047',
    yields: [
      { resourceId: 'sulfur-compounds', weight: 0.54, purity: 0.99, veinNote: 'Patera Loki — enxofre fundido e SO₂' },
      { resourceId: 'silicate-regolith', weight: 0.26, purity: 0.86, veinNote: 'Lava komatiítica ultramáfica' },
      { resourceId: 'titanium-ilmenite', weight: 0.20, purity: 0.88, veinNote: 'Óxidos refratários das caldeiras' },
    ],
  },
  europa: {
    bodyId: 'europa',
    bodyTypeLabel: 'Lua Oceânica com Crosta de Gelo Tectônica',
    extractable: true,
    extractionMethod: 'Sublimação laser limpa em fraturas caóticas e sais oceânicos sulfatados',
    hardnessFactor: 0.78,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'water-ice', weight: 0.66, purity: 0.99, veinNote: 'Conamara Chaos — gelo puríssimo H₂O' },
      { resourceId: 'sulfur-compounds', weight: 0.20, purity: 0.87, veinNote: 'Faixas avermelhadas de sais sulfatados' },
      { resourceId: 'ammonia-hydrates', weight: 0.14, purity: 0.84, veinNote: 'Cristais de hidratos da pluma oceânica' },
    ],
  },
  ganymede: {
    bodyId: 'ganymede',
    bodyTypeLabel: 'Maior Lua do Sistema (Gelo + Núcleo Metálico)',
    extractable: true,
    extractionMethod: 'Extração criogênica seletiva entre sulcos brilhantes de água e terrenos escuros',
    hardnessFactor: 0.82,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'water-ice', weight: 0.54, purity: 0.96, veinNote: 'Uruk Sulcus — cristas de gelo jovem' },
      { resourceId: 'silicate-regolith', weight: 0.26, purity: 0.86, veinNote: 'Galileo Regio rico em silicatos' },
      { resourceId: 'ammonia-hydrates', weight: 0.20, purity: 0.85, veinNote: 'Fendas criotectônicas hidratadas' },
    ],
  },
  callisto: {
    bodyId: 'callisto',
    bodyTypeLabel: 'Lua Antiga Crivada de Crateras (Gelo + Rocha)',
    extractable: true,
    extractionMethod: 'Sublimação de anéis concêntricos de gelo e regolito silicatado primitivo',
    hardnessFactor: 0.84,
    laserColorHex: '#7dd3fc',
    yields: [
      { resourceId: 'water-ice', weight: 0.46, purity: 0.92, veinNote: 'Borda brilhante de Valhalla' },
      { resourceId: 'silicate-regolith', weight: 0.34, purity: 0.88, veinNote: 'Manto escuro carbonáceo primordial' },
      { resourceId: 'ammonia-hydrates', weight: 0.20, purity: 0.86, veinNote: 'Voláteis orgânicos sob as crateras' },
    ],
  },
  saturn: {
    bodyId: 'saturn',
    bodyTypeLabel: 'Gigante Gasoso Rico em Hélio & Amônia',
    extractable: true,
    extractionMethod: 'Colheita estratosférica por feixe ionizante em bandas de H₂/³He e hexágono polar',
    hardnessFactor: 1.28,
    laserColorHex: '#93c5fd',
    yields: [
      { resourceId: 'helium-3', weight: 0.54, purity: 0.95, veinNote: 'Alta atmosfera baixa em gravidade' },
      { resourceId: 'ammonia-hydrates', weight: 0.32, purity: 0.93, veinNote: 'Camada superior de gelo de NH₃' },
      { resourceId: 'cryo-methane', weight: 0.14, purity: 0.86, veinNote: 'Traços estratosféricos de CH₄' },
    ],
  },
  enceladus: {
    bodyId: 'enceladus',
    bodyTypeLabel: 'Lua Criovulcânica Ativa (Listras de Tigre)',
    extractable: true,
    extractionMethod: 'Captação direta de gêiseres sul-polares ricos em H₂O pura, NH₃ e sílica hidrotermal',
    hardnessFactor: 0.65,
    laserColorHex: '#22d3ee',
    yields: [
      { resourceId: 'water-ice', weight: 0.62, purity: 1.0, veinNote: 'Pluma de Alexandria/Damascus Sulcus' },
      { resourceId: 'ammonia-hydrates', weight: 0.28, purity: 0.95, veinNote: 'Jato hidrotermal rico em NH₃ e sais' },
      { resourceId: 'cryo-methane', weight: 0.10, purity: 0.90, veinNote: 'Clatratos de metano da pluma' },
    ],
  },
  titan: {
    bodyId: 'titan',
    bodyTypeLabel: 'Lua com Atmosfera Densa de N₂ & Mares de Metano',
    extractable: true,
    extractionMethod: 'Sifonagem laser criogênica sobre Kraken Mare & dunas de compostos orgânicos',
    hardnessFactor: 0.86,
    laserColorHex: '#22d3ee',
    yields: [
      { resourceId: 'cryo-methane', weight: 0.56, purity: 0.98, veinNote: 'Lagos de metano/etano Kraken Mare' },
      { resourceId: 'ammonia-hydrates', weight: 0.28, purity: 0.94, veinNote: 'Atmosfera de N₂ e manto de água-amônia' },
      { resourceId: 'water-ice', weight: 0.16, purity: 0.90, veinNote: 'Embasamento rígido de gelo de água' },
    ],
  },
  mimas: {
    bodyId: 'mimas',
    bodyTypeLabel: 'Lua Gelada Porosa de Baixa Densidade',
    extractable: true,
    extractionMethod: 'Vaporização rápida em blocos de gelo poroso na bacia da Cratera Herschel',
    hardnessFactor: 0.68,
    laserColorHex: '#67e8f9',
    yields: [
      { resourceId: 'water-ice', weight: 0.72, purity: 0.95, veinNote: 'Parede maciça de gelo em Herschel' },
      { resourceId: 'sulfur-compounds', weight: 0.16, purity: 0.80, veinNote: 'Inclusões sulfurosas internas' },
      { resourceId: 'silicate-regolith', weight: 0.12, purity: 0.78, veinNote: 'Poeira mineral dos anéis E/G' },
    ],
  },
  iapetus: {
    bodyId: 'iapetus',
    bodyTypeLabel: 'Lua Dicotômica (Hemisfério Escuro Orgânico / Gelo)',
    extractable: true,
    extractionMethod: 'Perfuração dual na Crista Equatorial e bacias brilhantes de água pura',
    hardnessFactor: 0.76,
    laserColorHex: '#7dd3fc',
    yields: [
      { resourceId: 'water-ice', weight: 0.54, purity: 0.95, veinNote: 'Roncevaux Terra brilhante' },
      { resourceId: 'cryo-methane', weight: 0.24, purity: 0.88, veinNote: 'Depósitos carbonáceos de Cassini Regio' },
      { resourceId: 'ammonia-hydrates', weight: 0.22, purity: 0.86, veinNote: 'Tolinatos nitrogenados da crista equatorial' },
    ],
  },
  rhea: {
    bodyId: 'rhea',
    bodyTypeLabel: 'Lua Gelada com Falhas Tectônicas e Núcleo Rochoso',
    extractable: true,
    extractionMethod: 'Ablação de penhascos cintilantes ricos em água congelada e silicatos profundos',
    hardnessFactor: 0.78,
    laserColorHex: '#bae6fd',
    yields: [
      { resourceId: 'water-ice', weight: 0.56, purity: 0.94, veinNote: 'Escarpas brilhantes Inktomi' },
      { resourceId: 'silicate-regolith', weight: 0.28, purity: 0.85, veinNote: 'Material rochoso exposto' },
      { resourceId: 'platinum-group', weight: 0.16, purity: 0.84, veinNote: 'Vestígios siderófilos em Tirawa' },
    ],
  },
  uranus: {
    bodyId: 'uranus',
    bodyTypeLabel: 'Gigante de Gelo (H₂, He, CH₄, NH₃)',
    extractable: true,
    extractionMethod: 'Sifonagem de nuvens médias para coleta combinada de ³He e metano atmosférico',
    hardnessFactor: 1.24,
    laserColorHex: '#22d3ee',
    yields: [
      { resourceId: 'helium-3', weight: 0.44, purity: 0.96, veinNote: 'Razão D/³He otimizada na estratosfera' },
      { resourceId: 'cryo-methane', weight: 0.36, purity: 0.96, veinNote: 'Nuvens cianas ricas em CH₄' },
      { resourceId: 'ammonia-hydrates', weight: 0.20, purity: 0.91, veinNote: 'Deck de sulfeto de amônio' },
    ],
  },
  titania: {
    bodyId: 'titania',
    bodyTypeLabel: 'Maior Lua Uraniana (Gelo de Água & CO₂)',
    extractable: true,
    extractionMethod: 'Extração em cânions tectônicos gigantes (Messina Chasma)',
    hardnessFactor: 0.80,
    laserColorHex: '#67e8f9',
    yields: [
      { resourceId: 'water-ice', weight: 0.50, purity: 0.94, veinNote: 'Falha glacial Messina Chasma' },
      { resourceId: 'silicate-regolith', weight: 0.28, purity: 0.85, veinNote: 'Crosta silicatada escura' },
      { resourceId: 'cryo-methane', weight: 0.22, purity: 0.87, veinNote: 'Gelo volátil escurecido por radiação' },
    ],
  },
  neptune: {
    bodyId: 'neptune',
    bodyTypeLabel: 'Gigante de Gelo Dinâmico Rico em Metano & Hélio-3',
    extractable: true,
    extractionMethod: 'Feixe coletor em ventos supersônicos de cirros de metano e camadas profundas de ³He',
    hardnessFactor: 1.30,
    laserColorHex: '#3b82f6',
    yields: [
      { resourceId: 'helium-3', weight: 0.46, purity: 0.97, veinNote: 'Fluxo polar rico em ³He' },
      { resourceId: 'cryo-methane', weight: 0.38, purity: 0.97, veinNote: 'Cirros criogênicos azuis de metano' },
      { resourceId: 'ammonia-hydrates', weight: 0.16, purity: 0.90, veinNote: 'Camadas profundas de NH₃' },
    ],
  },
  triton: {
    bodyId: 'triton',
    bodyTypeLabel: 'Lua Retrógrada Capturada (Gêiseres de Nitrogênio/Metano)',
    extractable: true,
    extractionMethod: 'Sublimação de planícies cantalupo, metano congelado e plumas criovulcânicas',
    hardnessFactor: 0.78,
    laserColorHex: '#a5f3fc',
    yields: [
      { resourceId: 'cryo-methane', weight: 0.40, purity: 0.95, veinNote: 'Calota sul de gelo de CH₄/CO' },
      { resourceId: 'ammonia-hydrates', weight: 0.32, purity: 0.94, veinNote: 'Fontes de nitrogênio e hidratos' },
      { resourceId: 'water-ice', weight: 0.28, purity: 0.93, veinNote: 'Terreno cantalupo de H₂O cristalina' },
    ],
  },
  pluto: {
    bodyId: 'pluto',
    bodyTypeLabel: 'Planeta Anão de Kuiper (Sputnik Planitia)',
    extractable: true,
    extractionMethod: 'Sublimação criogênica nas bacias convectivas de N₂/CH₄ e montanhas de gelo de água',
    hardnessFactor: 0.76,
    laserColorHex: '#67e8f9',
    yields: [
      { resourceId: 'cryo-methane', weight: 0.42, purity: 0.96, veinNote: 'Células de convecção Sputnik Planitia' },
      { resourceId: 'water-ice', weight: 0.34, purity: 0.94, veinNote: 'Montes Tenzing — rocha de gelo H₂O' },
      { resourceId: 'ammonia-hydrates', weight: 0.24, purity: 0.90, veinNote: 'Vulcão de lama amoniacal Wright Mons' },
    ],
  },
  charon: {
    bodyId: 'charon',
    bodyTypeLabel: 'Satélite Binário Gelado com Polo de Tolinas (Mordor)',
    extractable: true,
    extractionMethod: 'Corte de penhascos em Serenity Chasma e coleta de hidratos orgânicos polares',
    hardnessFactor: 0.78,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'water-ice', weight: 0.50, purity: 0.95, veinNote: 'Muralha glacial Serenity Chasma' },
      { resourceId: 'ammonia-hydrates', weight: 0.34, purity: 0.93, veinNote: 'Calota Mordor Macula' },
      { resourceId: 'cryo-methane', weight: 0.16, purity: 0.87, veinNote: 'Depósitos voláteis capturados de Plutão' },
    ],
  },
  quaoar: {
    bodyId: 'quaoar',
    bodyTypeLabel: 'Objeto Clássico do Cinturão de Kuiper (KBO)',
    extractable: true,
    extractionMethod: 'Ablação de crosta criovulcânica com gelo cristalino e etano/metano',
    hardnessFactor: 0.84,
    laserColorHex: '#a78bfa',
    yields: [
      { resourceId: 'water-ice', weight: 0.42, purity: 0.92, veinNote: 'Gelo cristalino recém-exposto' },
      { resourceId: 'cryo-methane', weight: 0.36, purity: 0.93, veinNote: 'Reserva superficial de CH₄ e C₂H₆' },
      { resourceId: 'ammonia-hydrates', weight: 0.22, purity: 0.88, veinNote: 'Hidrato de amônia criovulcânico' },
    ],
  },
  orcus: {
    bodyId: 'orcus',
    bodyTypeLabel: 'Plutino Criovulcânico Rico em Amônia',
    extractable: true,
    extractionMethod: 'Sublimação seletiva de amônia hidratada pura e gelo de água cristalino',
    hardnessFactor: 0.80,
    laserColorHex: '#4ade80',
    yields: [
      { resourceId: 'water-ice', weight: 0.46, purity: 0.94, veinNote: 'Crosta brilhante H₂O' },
      { resourceId: 'ammonia-hydrates', weight: 0.38, purity: 0.95, veinNote: 'Assinatura espectral forte de NH₃' },
      { resourceId: 'cryo-methane', weight: 0.16, purity: 0.85, veinNote: 'Voláteis de superfície' },
    ],
  },
  gonggong: {
    bodyId: 'gonggong',
    bodyTypeLabel: 'Planeta Anão Vermelho do Disco Disperso',
    extractable: true,
    extractionMethod: 'Extração profunda de metano irradiado e silicatos pré-solares do disco disperso',
    hardnessFactor: 0.90,
    laserColorHex: '#c084fc',
    yields: [
      { resourceId: 'cryo-methane', weight: 0.38, purity: 0.94, veinNote: 'Tolinas avermelhadas ricas em CH₄' },
      { resourceId: 'water-ice', weight: 0.36, purity: 0.90, veinNote: 'Manto criogênico interno' },
      { resourceId: 'exotic-silicates', weight: 0.26, purity: 0.89, veinNote: 'Grãos amorfos irradiados pelo espaço profundo' },
    ],
  },
  arrokoth: {
    bodyId: 'arrokoth',
    bodyTypeLabel: 'Planetesimal Binário de Contato Primordial (KBO)',
    extractable: true,
    extractionMethod: 'Sondagem laser delicada de metanol/etano congelado e silicatos inalterados há 4,5 Ga',
    hardnessFactor: 0.64,
    laserColorHex: '#d8b4fe',
    yields: [
      { resourceId: 'cryo-methane', weight: 0.38, purity: 0.93, veinNote: 'Gelo primordial do colo de contato' },
      { resourceId: 'water-ice', weight: 0.34, purity: 0.90, veinNote: 'Núcleo poroso hidratado' },
      { resourceId: 'exotic-silicates', weight: 0.28, purity: 0.92, veinNote: 'Poeira nebular intocada da formação solar' },
    ],
  },
  halley: {
    bodyId: 'halley',
    bodyTypeLabel: 'Cometa Periódico Rico em Voláteis & Poeira Primordial',
    extractable: true,
    extractionMethod: 'Coleta de jatos sublimados de coma e perfuração da crosta carbonácea negra',
    hardnessFactor: 0.58,
    laserColorHex: '#22d3ee',
    yields: [
      { resourceId: 'water-ice', weight: 0.44, purity: 0.96, veinNote: '80% do núcleo volátil sublimado' },
      { resourceId: 'ammonia-hydrates', weight: 0.24, purity: 0.91, veinNote: 'Gases cianídricos e amônia da coma' },
      { resourceId: 'cryo-methane', weight: 0.18, purity: 0.89, veinNote: 'Gelo de CH₄ e CO primordial' },
      { resourceId: 'exotic-silicates', weight: 0.14, purity: 0.91, veinNote: 'Grãos pré-solares da cauda de poeira' },
    ],
  },
  'comet-67p': {
    bodyId: 'comet-67p',
    bodyTypeLabel: 'Cometa Bilobado (Churyumov-Gerasimenko)',
    extractable: true,
    extractionMethod: 'Ablação controlada nos penhascos de Hathor e jatos orgânicos de água',
    hardnessFactor: 0.60,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'water-ice', weight: 0.42, purity: 0.95, veinNote: 'Penhasco estratificado Aswan' },
      { resourceId: 'ammonia-hydrates', weight: 0.26, purity: 0.92, veinNote: 'Compostos nitrogenados e glicina' },
      { resourceId: 'silicate-regolith', weight: 0.18, purity: 0.84, veinNote: 'Agregados porosos de poeira' },
      { resourceId: 'exotic-silicates', weight: 0.14, purity: 0.90, veinNote: 'Carboneto de silício pré-solar' },
    ],
  },
  oumuamua: {
    bodyId: 'oumuamua',
    bodyTypeLabel: 'Visitante Interestelar Hyper-Denso (1I/ʻOumuamua)',
    extractable: true,
    extractionMethod: 'Raspagem coerente de baixa energia na casca orgânica irradiada por galáxia distante',
    hardnessFactor: 0.92,
    laserColorHex: '#c084fc',
    yields: [
      { resourceId: 'exotic-silicates', weight: 0.54, purity: 0.99, veinNote: 'Matriz cristalina extra-solar rara' },
      { resourceId: 'cryo-methane', weight: 0.28, purity: 0.94, veinNote: 'Gelo intersticial super-irradiado' },
      { resourceId: 'platinum-group', weight: 0.18, purity: 0.93, veinNote: 'Anomalia metálica densa no núcleo' },
    ],
  },
  'tyche-prime': {
    bodyId: 'tyche-prime',
    bodyTypeLabel: 'Super-Terra Glacial Quântica 4K (Fronteira Externa · 52,4 UA)',
    extractable: true,
    extractionMethod: 'Perfuração criogênica de fendas abissais de Gelo VII e cristais de vácuo',
    hardnessFactor: 0.78,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'void-crystal', weight: 0.42, purity: 0.98, veinNote: 'Fenda abissal de Cristal de Vácuo Quântico' },
      { resourceId: 'helium-3', weight: 0.32, purity: 0.97, veinNote: 'Clatratos polares de Hélio-3' },
      { resourceId: 'water-ice', weight: 0.26, purity: 0.99, veinNote: 'Gelo VII de altíssima pureza' },
    ],
  },
  'ignis-prime': {
    bodyId: 'ignis-prime',
    bodyTypeLabel: 'Planeta Tectônico Hipervulcânico de Magma 4K (58,8 UA)',
    extractable: true,
    extractionMethod: 'Sifonagem magnetotérmica em rios de lava incandescente e caldeiras de plasma',
    hardnessFactor: 0.85,
    laserColorHex: '#f97316',
    yields: [
      { resourceId: 'solar-plasma-core', weight: 0.40, purity: 0.98, veinNote: 'Caldeira ativa de Núcleo de Plasma' },
      { resourceId: 'sulfur-compounds', weight: 0.26, purity: 0.96, veinNote: 'Gêiseres vulcânicos de enxofre puro' },
      { resourceId: 'platinum-group', weight: 0.20, purity: 0.95, veinNote: 'Derrame magmático rico em platina' },
      { resourceId: 'titanium-ilmenite', weight: 0.14, purity: 0.94, veinNote: 'Basalto negro de titânio' },
    ],
  },
  'krystallos-v': {
    bodyId: 'krystallos-v',
    bodyTypeLabel: 'Exoplaneta Cristalino de Diamante & Quartzo 4K (65,2 UA)',
    extractable: true,
    extractionMethod: 'Corte óptico ressonante em cordilheiras de diamante e carbeto de silício quântico',
    hardnessFactor: 0.88,
    laserColorHex: '#c084fc',
    yields: [
      { resourceId: 'void-crystal', weight: 0.48, purity: 0.99, veinNote: 'Maciço de Cristal de Vácuo & Diamante' },
      { resourceId: 'exotic-silicates', weight: 0.34, purity: 0.98, veinNote: 'Cristais prismáticos de SiC quântico' },
      { resourceId: 'platinum-group', weight: 0.18, purity: 0.95, veinNote: 'Inclusões nobres nos anéis internos' },
    ],
  },
  'solaris-nova': {
    bodyId: 'solaris-nova',
    bodyTypeLabel: 'Estrela Hipergigante do Setor Andrômeda (Sifão Estelar +30%/s Energia)',
    extractable: true,
    extractionMethod: 'Sifonagem magnetohidrodinâmica direta de Núcleos de Plasma Estelar e Hipercristais',
    hardnessFactor: 0.50,
    laserColorHex: '#fde047',
    yields: [
      { resourceId: 'solar-plasma-core', weight: 0.52, purity: 1.0, veinNote: 'Arco coronal de Plasma Estelar Condensado' },
      { resourceId: 'helium-3', weight: 0.28, purity: 1.0, veinNote: 'Vento estelar puro de Hélio-3' },
      { resourceId: 'andromeda-hypercrystal', weight: 0.20, purity: 0.99, veinNote: 'Singularidade magnética coronal' },
    ],
  },
  'xylos-omega': {
    bodyId: 'xylos-omega',
    bodyTypeLabel: 'Super-Terra Oceânica & Bioluminescente 4K (Setor Andrômeda · 94,5 UA)',
    extractable: true,
    extractionMethod: 'Extração limpa em recifes organometálicos bioluminescentes e dorsais oceânicas',
    hardnessFactor: 0.72,
    laserColorHex: '#10b981',
    yields: [
      { resourceId: 'chronos-alloy', weight: 0.42, purity: 0.98, veinNote: 'Recife bioluminescente de Superliga Aether-Platina' },
      { resourceId: 'void-crystal', weight: 0.28, purity: 0.97, veinNote: 'Fossa abissal cristalina' },
      { resourceId: 'ammonia-hydrates', weight: 0.16, purity: 0.98, veinNote: 'Biomassa marinha rica em nitrogênio' },
      { resourceId: 'water-ice', weight: 0.14, purity: 1.0, veinNote: 'Calota polar oceânica pura' },
    ],
  },
  'aether-ix': {
    bodyId: 'aether-ix',
    bodyTypeLabel: 'Hipergigante Gasoso Anelado de Tempestades 4K (Setor Andrômeda · 104,0 UA)',
    extractable: true,
    extractionMethod: 'Colheita eletromagnética em super-tempestades de plasma e anéis luminosos',
    hardnessFactor: 0.82,
    laserColorHex: '#38bdf8',
    yields: [
      { resourceId: 'solar-plasma-core', weight: 0.38, purity: 0.99, veinNote: 'Vórtice anticiclônico de Plasma Estelar' },
      { resourceId: 'andromeda-hypercrystal', weight: 0.28, purity: 0.98, veinNote: 'Anel ressonante de Hipercristal de Andrômeda' },
      { resourceId: 'helium-3', weight: 0.22, purity: 0.99, veinNote: 'Corrente de jato equatorial de ³He' },
      { resourceId: 'cryo-methane', weight: 0.12, purity: 0.97, veinNote: 'Nuvens superiores de hidrocarbonetos' },
    ],
  },
  'nyx-obsidian': {
    bodyId: 'nyx-obsidian',
    bodyTypeLabel: 'Planeta Metálico de Platina & Obsidiana 4K (Setor Andrômeda · 114,0 UA)',
    extractable: true,
    extractionMethod: 'Fusão laser de alta precisão em maciços expostos de Superliga Aether-Platina',
    hardnessFactor: 0.86,
    laserColorHex: '#818cf8',
    yields: [
      { resourceId: 'chronos-alloy', weight: 0.50, purity: 0.99, veinNote: 'Escarpa pura de Superliga Aether-Platina' },
      { resourceId: 'platinum-group', weight: 0.28, purity: 0.99, veinNote: 'Cratera espelhada de Platina-Irídio' },
      { resourceId: 'titanium-ilmenite', weight: 0.22, purity: 0.97, veinNote: 'Manto de obsidiana-titânio' },
    ],
  },
  'chronos-prime': {
    bodyId: 'chronos-prime',
    bodyTypeLabel: 'Gigante Quântico Anelado 4K (Setor Profundo de Andrômeda · 125,0 UA)',
    extractable: true,
    extractionMethod: 'Captura harmônica de Hipercristais de Andrômeda na divisão dourada dos anéis',
    hardnessFactor: 0.80,
    laserColorHex: '#e879f9',
    yields: [
      { resourceId: 'andromeda-hypercrystal', weight: 0.48, purity: 1.0, veinNote: 'Santuário Quântico de Hipercristal de Andrômeda' },
      { resourceId: 'chronos-alloy', weight: 0.24, purity: 0.99, veinNote: 'Nódulos anelares de Superliga Aether-Platina' },
      { resourceId: 'void-crystal', weight: 0.16, purity: 0.98, veinNote: 'Cristal de Vácuo polar' },
      { resourceId: 'solar-plasma-core', weight: 0.12, purity: 0.98, veinNote: 'Fluxo auroral de plasma condensado' },
    ],
  },
};

export const CRAFTING_RECIPES: CatalogSynthesisRecipe[] = [
  {
    id: 'purify-water',
    name: 'Purificação & Destilação de Água Potável',
    formula: '2 H₂O (gelo) → +1 Cantil + 32% Hidratação',
    category: 'SURVIVAL',
    ingredients: [{ resourceId: 'water-ice', amount: 2 }],
    energyCostPct: 4,
    outputSummary: '+1 Cantil de Água & +32% Hidratação',
    effects: { water: 32, waterFlasks: 1 },
    scienceNote: 'Fusão a vácuo seguida de filtragem osmótica e remineralização segura para consumo humano.',
  },
  {
    id: 'synthesize-o2',
    name: 'Eletrólise Criogênica de Oxigênio (O₂)',
    formula: '2 H₂O → O₂ (gás) + H₂ (descarte)',
    category: 'SURVIVAL',
    ingredients: [{ resourceId: 'water-ice', amount: 2 }],
    energyCostPct: 7,
    outputSummary: '+34% Oxigênio (O₂) na cabine e traje EVA',
    effects: { oxygen: 34 },
    scienceNote: 'Eletrólise em membrana polimérica (MES): quebra moléculas de gelo em oxigênio respirável puro.',
  },
  {
    id: 'biomass-ration',
    name: 'Síntese Biopônica de Rações Nutritivas',
    formula: 'H₂O + NH₃ + SiO₂ → +1 Ração + 36% Saciedade',
    category: 'SURVIVAL',
    ingredients: [
      { resourceId: 'water-ice', amount: 1 },
      { resourceId: 'ammonia-hydrates', amount: 1 },
      { resourceId: 'silicate-regolith', amount: 1 },
    ],
    energyCostPct: 6,
    outputSummary: '+1 Ração & +36% Saciedade + +8% Água',
    effects: { food: 36, foodRations: 1, water: 8 },
    scienceNote: 'Microalgas e hidroponia acelerada combinam nitrogênio (NH₃), água e minerais do regolito em rações completas.',
  },
  {
    id: 'hydrazine-fuel',
    name: 'Refino Químico de Propelente (Hidrazina)',
    formula: '2 NH₃ + CH₄ → Propelente Δv (+34%)',
    category: 'PROPULSION',
    ingredients: [
      { resourceId: 'ammonia-hydrates', amount: 2 },
      { resourceId: 'cryo-methane', amount: 1 },
    ],
    energyCostPct: 8,
    outputSummary: '+34% Combustível Químico dos Propulsores',
    effects: { fuel: 34 },
    scienceNote: 'Metano atua como combustível denso junto a derivados nitrogenados de amônia para propulsão orbital.',
  },
  {
    id: 'titanium-plates',
    name: 'Forja Orbital de Placas Fe-Ni-Ti',
    formula: '2 Fe-Ni + FeTiO₃ → Blindagem (+30% Casco & +1 Kit)',
    category: 'ENGINEERING',
    ingredients: [
      { resourceId: 'iron-nickel', amount: 2 },
      { resourceId: 'titanium-ilmenite', amount: 1 },
    ],
    energyCostPct: 9,
    outputSummary: '+30% Integridade do Casco & +1 Kit de Reparo',
    effects: { hull: 30, repairKits: 1 },
    scienceNote: 'Sinterização a laser une a tenacidade do ferro-níquel meteórico à leveza térmica do titânio.',
  },
  {
    id: 'cryo-coolant',
    name: 'Fluido Refrigerante Bifásico & Escudo Térmico',
    formula: 'H₂O + SO₂ + NH₃ → Resfriamento (-32°C) + 18% Energia',
    category: 'ENGINEERING',
    ingredients: [
      { resourceId: 'water-ice', amount: 1 },
      { resourceId: 'sulfur-compounds', amount: 1 },
      { resourceId: 'ammonia-hydrates', amount: 1 },
    ],
    energyCostPct: 4,
    outputSummary: 'Resfria Reator/Casco (-32°C) & +18% Energia da Nave',
    effects: { coolingC: 32, battery: 18, hull: 6 },
    scienceNote: 'Ciclo amônia-enxofre-água maximiza o calor latente de evaporação nos radiadores térmicos da nave.',
  },
  {
    id: 'battery-capacitor',
    name: 'Célula de Energia da Nave Li-Enxofre (Bateria)',
    formula: 'SO₂ + SiO₂ + Fe-Ni → +52% Energia da Nave & +10% Casco',
    category: 'ENGINEERING',
    ingredients: [
      { resourceId: 'sulfur-compounds', amount: 1 },
      { resourceId: 'silicate-regolith', amount: 1 },
      { resourceId: 'iron-nickel', amount: 1 },
    ],
    energyCostPct: 0,
    outputSummary: '+52% Energia da Nave (Bateria) & +10% Casco',
    effects: { battery: 52, hull: 10 },
    scienceNote: 'Eletrólito sólido de sulfeto-silicato com eletrodos de ferro-níquel recarrega instantaneamente o banco de energia principal da nave.',
  },
  {
    id: 'platinum-reactor-catalyst',
    name: 'Catalisador Platinado de Reator & Propulsão',
    formula: 'Pt + CH₄ + SiO₂ → +65% Energia, +40% Combustível & +180 CR',
    category: 'PROPULSION',
    ingredients: [
      { resourceId: 'platinum-group', amount: 1 },
      { resourceId: 'cryo-methane', amount: 1 },
      { resourceId: 'silicate-regolith', amount: 1 },
    ],
    energyCostPct: 2,
    outputSummary: '+65% Energia da Nave, +40% Combustível & +180 CR',
    effects: { battery: 65, fuel: 40, credits: 180 },
    scienceNote: 'Malha catalítica de platina-irídio reforma metano criogênico com eficiência máxima para a turbina e o gerador elétrico.',
  },
  {
    id: 'he3-warp-cell',
    name: 'Célula de Dobra Espacial Aneutrônica D-³He',
    formula: '2 ³He + 2 FeTiO₃ + H₂O → +1 Célula & +38% Dobra',
    category: 'HIGH_TECH',
    ingredients: [
      { resourceId: 'helium-3', amount: 2 },
      { resourceId: 'titanium-ilmenite', amount: 2 },
      { resourceId: 'water-ice', amount: 1 },
    ],
    energyCostPct: 12,
    outputSummary: '+1 Célula de Dobra & +38% Combustível de Dobra',
    effects: { warpEnergy: 38, warpCells: 1 },
    scienceNote: 'Isótopo Hélio-3 refinado com deutério da água e blindado em titânio alimenta o motor de dobra interestelar.',
  },
  {
    id: 'interstellar-resonator',
    name: 'Sintetizador Quântico Interestelar (Súper-Pacote)',
    formula: 'SiC Exótico + Pt + 2 ³He → Sobrecarga Total + 650 CR',
    category: 'HIGH_TECH',
    ingredients: [
      { resourceId: 'exotic-silicates', amount: 1 },
      { resourceId: 'platinum-group', amount: 1 },
      { resourceId: 'helium-3', amount: 2 },
    ],
    energyCostPct: 14,
    outputSummary: '+60% Dobra, +1 Célula, +45% Energia, +35% Comb & +650 CR',
    effects: { warpEnergy: 60, warpCells: 1, battery: 45, hull: 30, fuel: 35, coolingC: 25, credits: 650 },
    scienceNote: 'Catalisadores de platina e silicatos interestelares maximizam a eficiência do reator de dobra e geram dados científicos valiosos.',
  },
];

export function getRecipesUsingResource(
  resourceId: MiningResourceId
): CatalogSynthesisRecipe[] {
  return CRAFTING_RECIPES.filter((recipe) =>
    recipe.ingredients.some((ing) => ing.resourceId === resourceId)
  );
}

/**
 * MINERAL FUSION TREE (Combine 2 minerals to transmute/create a rarer mineral + free up Cargo Hold space!)
 */
export interface CatalogMineralFusionRecipe {
  id: string;
  name: string;
  inputs: [CatalogRecipeIngredient, CatalogRecipeIngredient];
  outputResourceId: MiningResourceId;
  outputAmount: number;
  energyCostPct: number;
  bonusCredits: number;
  description: string;
}

export const MINERAL_FUSION_RECIPES: CatalogMineralFusionRecipe[] = [
  {
    id: 'fuse-titanium',
    name: 'Fusão Termometálica → Ilmenita de Titânio',
    inputs: [
      { resourceId: 'iron-nickel', amount: 2 },
      { resourceId: 'silicate-regolith', amount: 1 },
    ],
    outputResourceId: 'titanium-ilmenite',
    outputAmount: 1,
    energyCostPct: 3,
    bonusCredits: 25,
    description: 'Funde 2x Ferro-Níquel + 1x Regolito em 1x Ilmenita de Titânio (Incomum).',
  },
  {
    id: 'fuse-methane',
    name: 'Síntese Criogênica → Metano Criogênico',
    inputs: [
      { resourceId: 'water-ice', amount: 2 },
      { resourceId: 'silicate-regolith', amount: 1 },
    ],
    outputResourceId: 'cryo-methane',
    outputAmount: 1,
    energyCostPct: 3,
    bonusCredits: 20,
    description: 'Combina 2x Gelo de Água + 1x Regolito em 1x Metano Criogênico (Incomum).',
  },
  {
    id: 'fuse-sulfur',
    name: 'Condensação Ácida → Compostos Sulfurosos',
    inputs: [
      { resourceId: 'ammonia-hydrates', amount: 1 },
      { resourceId: 'silicate-regolith', amount: 2 },
    ],
    outputResourceId: 'sulfur-compounds',
    outputAmount: 1,
    energyCostPct: 3,
    bonusCredits: 25,
    description: 'Reage 1x Amônia + 2x Regolito para extrair 1x Compostos Sulfurosos (Incomum · +30% Energia).',
  },
  {
    id: 'fuse-helium3',
    name: 'Transmutação Isotópica → Hélio-3 Solar (Energia)',
    inputs: [
      { resourceId: 'cryo-methane', amount: 2 },
      { resourceId: 'sulfur-compounds', amount: 1 },
    ],
    outputResourceId: 'helium-3',
    outputAmount: 1,
    energyCostPct: 4,
    bonusCredits: 60,
    description: 'Funde 2x Metano + 1x Enxofre em 1x Isótopo Hélio-3 Solar (Raro · +45% Energia).',
  },
  {
    id: 'fuse-platinum',
    name: 'Refino Siderófilo → Metais da Platina (PGM)',
    inputs: [
      { resourceId: 'titanium-ilmenite', amount: 2 },
      { resourceId: 'iron-nickel', amount: 1 },
    ],
    outputResourceId: 'platinum-group',
    outputAmount: 1,
    energyCostPct: 4,
    bonusCredits: 70,
    description: 'Purifica 2x Titânio + 1x Ferro-Níquel em 1x Metais do Grupo da Platina (Raro · 165 CR).',
  },
  {
    id: 'fuse-exotic-silicates',
    name: 'Cristalização Quântica → Silicatos Interestelares',
    inputs: [
      { resourceId: 'helium-3', amount: 1 },
      { resourceId: 'platinum-group', amount: 1 },
    ],
    outputResourceId: 'exotic-silicates',
    outputAmount: 1,
    energyCostPct: 5,
    bonusCredits: 95,
    description: 'Une 1x Hélio-3 + 1x Platina em 1x Silicatos Amorfos Interestelares (Exótico · 260 CR).',
  },
  {
    id: 'fuse-void-crystal',
    name: 'Compressão Hiperbarométrica → Cristal de Vácuo Quântico',
    inputs: [
      { resourceId: 'exotic-silicates', amount: 1 },
      { resourceId: 'titanium-ilmenite', amount: 2 },
    ],
    outputResourceId: 'void-crystal',
    outputAmount: 1,
    energyCostPct: 6,
    bonusCredits: 150,
    description: 'Funde 1x Silicatos Exóticos + 2x Titânio em 1x Cristal de Vácuo Quântico (Lendário · 420 CR).',
  },
  {
    id: 'fuse-solar-plasma',
    name: 'Confinamento Magnético → Núcleo de Plasma Estelar',
    inputs: [
      { resourceId: 'helium-3', amount: 2 },
      { resourceId: 'void-crystal', amount: 1 },
    ],
    outputResourceId: 'solar-plasma-core',
    outputAmount: 1,
    energyCostPct: 6,
    bonusCredits: 210,
    description: 'Condensa 2x Hélio-3 + 1x Cristal de Vácuo em 1x Núcleo de Plasma Estelar (Lendário · 540 CR).',
  },
  {
    id: 'fuse-chronos-alloy',
    name: 'Forja Metamaterial → Superliga Aether-Platina',
    inputs: [
      { resourceId: 'platinum-group', amount: 2 },
      { resourceId: 'void-crystal', amount: 1 },
    ],
    outputResourceId: 'chronos-alloy',
    outputAmount: 1,
    energyCostPct: 6,
    bonusCredits: 260,
    description: 'Une 2x Platina + 1x Cristal de Vácuo em 1x Superliga Aether-Platina (Lendário · 680 CR).',
  },
  {
    id: 'fuse-andromeda-hypercrystal',
    name: 'Singularidade Suprema → Hipercristal de Andrômeda',
    inputs: [
      { resourceId: 'solar-plasma-core', amount: 1 },
      { resourceId: 'chronos-alloy', amount: 1 },
    ],
    outputResourceId: 'andromeda-hypercrystal',
    outputAmount: 1,
    energyCostPct: 8,
    bonusCredits: 450,
    description: 'Funde 1x Núcleo de Plasma + 1x Superliga Aether-Platina no supremo Hipercristal de Andrômeda (950 CR · 100% Energia)!',
  },
];

export function getFusionsUsingResource(
  resourceId: MiningResourceId
): CatalogMineralFusionRecipe[] {
  return MINERAL_FUSION_RECIPES.filter(
    (f) =>
      f.outputResourceId === resourceId ||
      f.inputs.some((inp) => inp.resourceId === resourceId)
  );
}

/**
 * SHIP UPGRADE WORKSHOP DEFINITIONS (Spends Space Credits CR + Mined/Fused Minerals!)
 */
export interface ShipUpgradeDefinition {
  id: 'cargo' | 'laser' | 'batteryBank' | 'pulseCannon' | 'warpDrive';
  name: string;
  maxLevel: number;
  baseCostCredits: number;
  mineralRequirementPerLevel: Array<{ resourceId: MiningResourceId; amount: number }>;
  getLevelBenefitLabel: (level: number) => string;
  description: string;
}

export const SHIP_UPGRADE_DEFINITIONS: Record<
  'cargo' | 'laser' | 'batteryBank' | 'pulseCannon' | 'warpDrive',
  ShipUpgradeDefinition
> = {
  cargo: {
    id: 'cargo',
    name: 'Expansão do Porão de Carga',
    maxLevel: 5,
    baseCostCredits: 320,
    mineralRequirementPerLevel: [
      { resourceId: 'iron-nickel', amount: 2 },
      { resourceId: 'titanium-ilmenite', amount: 2 },
      { resourceId: 'platinum-group', amount: 2 },
      { resourceId: 'chronos-alloy', amount: 1 },
    ],
    getLevelBenefitLabel: (lvl) => `Capacidade: ${500 + (lvl - 1) * 450} unidades`,
    description: 'Amplia o porão da nave de 500 un até 2.300 un para longas expedições intergalácticas.',
  },
  laser: {
    id: 'laser',
    name: 'Laser Extrator Orbital Quântico',
    maxLevel: 5,
    baseCostCredits: 380,
    mineralRequirementPerLevel: [
      { resourceId: 'titanium-ilmenite', amount: 2 },
      { resourceId: 'helium-3', amount: 2 },
      { resourceId: 'exotic-silicates', amount: 1 },
      { resourceId: 'void-crystal', amount: 1 },
    ],
    getLevelBenefitLabel: (lvl) => `Velocidade de Extração: +${(lvl - 1) * 38}%`,
    description: 'Aumenta a taxa de extração por segundo e reduz o aquecimento do feixe.',
  },
  batteryBank: {
    id: 'batteryBank',
    name: 'Banco de Baterias & Coletores Solares',
    maxLevel: 5,
    baseCostCredits: 350,
    mineralRequirementPerLevel: [
      { resourceId: 'sulfur-compounds', amount: 2 },
      { resourceId: 'helium-3', amount: 2 },
      { resourceId: 'void-crystal', amount: 1 },
      { resourceId: 'solar-plasma-core', amount: 1 },
    ],
    getLevelBenefitLabel: (lvl) => `Recarga Solar & Banco: +${(lvl - 1) * 35}%`,
    description: 'Acelera a captação solar mesmo longe do Sol e aumenta a eficiência do Banco de Baterias.',
  },
  pulseCannon: {
    id: 'pulseCannon',
    name: 'Canhões de Pulso de Plasma [F]',
    maxLevel: 5,
    baseCostCredits: 360,
    mineralRequirementPerLevel: [
      { resourceId: 'iron-nickel', amount: 2 },
      { resourceId: 'sulfur-compounds', amount: 2 },
      { resourceId: 'platinum-group', amount: 1 },
      { resourceId: 'solar-plasma-core', amount: 1 },
    ],
    getLevelBenefitLabel: (lvl) => `Dano & Saque Balístico: +${(lvl - 1) * 45}%`,
    description: 'Destrói Meteoros de Cristal e Drones Sentinelas com mais dano e multiplica os minérios dropados!',
  },
  warpDrive: {
    id: 'warpDrive',
    name: 'Motor de Dobra Intergaláctica',
    maxLevel: 5,
    baseCostCredits: 420,
    mineralRequirementPerLevel: [
      { resourceId: 'cryo-methane', amount: 2 },
      { resourceId: 'helium-3', amount: 2 },
      { resourceId: 'void-crystal', amount: 1 },
      { resourceId: 'andromeda-hypercrystal', amount: 1 },
    ],
    getLevelBenefitLabel: (lvl) => `Economia de Dobra: -${(lvl - 1) * 16}% consumo`,
    description: 'Reduz o consumo do combustível de dobra e acelera viagens para o Setor de Andrômeda.',
  },
};

/**
 * ACTIVE SPACE CONTRACTS & SOS RESCUE MISSIONS (Gives high CR rewards & purpose to exploration!)
 */
export interface SpaceMissionContract {
  id: string;
  kind: 'SOS_RESCUE' | 'LOGISTICS' | 'DEEP_SPACE';
  title: string;
  targetBodyId: string;
  targetBodyName: string;
  requirements: CatalogRecipeIngredient[];
  rewardCredits: number;
  rewardWarpCells?: number;
  description: string;
}

export const SPACE_CONTRACTS: SpaceMissionContract[] = [
  {
    id: 'sos-lunar-capsule',
    kind: 'SOS_RESCUE',
    title: '🚨 SOS: Cápsula Científica em Órbita Lunar',
    targetBodyId: 'moon',
    targetBodyName: 'Lua',
    requirements: [
      { resourceId: 'water-ice', amount: 2 },
      { resourceId: 'helium-3', amount: 1 },
    ],
    rewardCredits: 580,
    rewardWarpCells: 1,
    description: 'Tripulação com suporte de vida crítico solicita Gelo de Água (O₂) e Hélio-3 de emergência.',
  },
  {
    id: 'contract-mars-colony',
    kind: 'LOGISTICS',
    title: '📦 Logística: Blindagem para Base de Marte',
    targetBodyId: 'mars',
    targetBodyName: 'Marte',
    requirements: [
      { resourceId: 'iron-nickel', amount: 2 },
      { resourceId: 'titanium-ilmenite', amount: 2 },
    ],
    rewardCredits: 740,
    description: 'Entrega de ligas estruturais para expansão dos domos pressurizados de Arcadia Planitia.',
  },
  {
    id: 'sos-jupiter-probe',
    kind: 'SOS_RESCUE',
    title: '🚨 SOS: Sonda Criogênica em Europa / Júpiter',
    targetBodyId: 'jupiter',
    targetBodyName: 'Júpiter',
    requirements: [
      { resourceId: 'sulfur-compounds', amount: 2 },
      { resourceId: 'platinum-group', amount: 1 },
    ],
    rewardCredits: 960,
    rewardWarpCells: 1,
    description: 'Substituição de baterias Li-Enxofre e eletrodos de platina corroídos pela radiação joviana.',
  },
  {
    id: 'contract-frontier-tyche',
    kind: 'DEEP_SPACE',
    title: '🌌 Expedição Fronteira: Cristais de Tyche-IX',
    targetBodyId: 'tyche-prime',
    targetBodyName: 'Tyche-IX (Super-Terra Glacial)',
    requirements: [
      { resourceId: 'void-crystal', amount: 2 },
    ],
    rewardCredits: 1450,
    rewardWarpCells: 2,
    description: 'Fornecer 2x Cristais de Vácuo Quântico extraídos de Tyche-IX/Krystallos-V ou criados por Fusão.',
  },
  {
    id: 'contract-andromeda-core',
    kind: 'DEEP_SPACE',
    title: '🌟 Missão Andrômeda: Hipercristal & Plasma',
    targetBodyId: 'chronos-prime',
    targetBodyName: 'Chronos-Prime (Setor Andrômeda)',
    requirements: [
      { resourceId: 'solar-plasma-core', amount: 1 },
      { resourceId: 'andromeda-hypercrystal', amount: 1 },
    ],
    rewardCredits: 2800,
    rewardWarpCells: 3,
    description: 'Contrato supremo da Doca Orbital: entregar 1x Núcleo de Plasma Estelar e 1x Hipercristal de Andrômeda.',
  },
];

export const MINING_RECIPES_BY_ID: Record<MiningRecipeId, CatalogSynthesisRecipe> =
  CRAFTING_RECIPES.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<MiningRecipeId, CatalogSynthesisRecipe>);

const FALLBACK_ASTEROID_PROFILE: CatalogCelestialMiningProfile = {
  bodyId: 'unknown',
  bodyTypeLabel: 'Corpo Menor Silicatado',
  extractable: true,
  extractionMethod: 'Ablação laser padrão sobre regolito mineral e bolsas de gelo',
  hardnessFactor: 0.9,
  laserColorHex: '#38bdf8',
  yields: [
    { resourceId: 'silicate-regolith', weight: 0.45, purity: 0.85, veinNote: 'Regolito superficial' },
    { resourceId: 'iron-nickel', weight: 0.30, purity: 0.86, veinNote: 'Inclusões metálicas' },
    { resourceId: 'water-ice', weight: 0.25, purity: 0.82, veinNote: 'Gelo intersticial' },
  ],
};

export function getBodyMiningProfile(bodyId: string): CatalogCelestialMiningProfile {
  return CELESTIAL_MINING_PROFILES[bodyId] ?? { ...FALLBACK_ASTEROID_PROFILE, bodyId };
}

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRand(seed: number): () => number {
  let state = seed || 123456789;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Generates 3 persistent geological surface hotspots for any extractable world
 * using deterministic Fibonacci sphere distribution + yield table weights.
 */
export function generateHotspotsForBody(bodyId: string): CatalogOrbitalHotspot[] {
  const profile = getBodyMiningProfile(bodyId);
  if (!profile.extractable || profile.yields.length === 0) return [];

  const rand = seededRand(hashSeed(`hotspot-${bodyId}`));
  const sortedYields = [...profile.yields].sort((a, b) => b.weight - a.weight);
  const count = Math.min(3, Math.max(2, sortedYields.length));
  const spots: CatalogOrbitalHotspot[] = [];

  for (let i = 0; i < count; i++) {
    const yEntry = sortedYields[Math.min(sortedYields.length - 1, i === 0 ? sortedYields.length - 1 : i - 1)];
    const resDef = MINING_RESOURCES[yEntry.resourceId];
    const theta = rand() * Math.PI * 2 + (i * Math.PI * 2) / count;
    const zVal = -0.55 + (i / Math.max(1, count - 1)) * 1.1 + (rand() - 0.5) * 0.2;
    const clampedY = Math.max(-0.82, Math.min(0.82, zVal));
    const rHoriz = Math.sqrt(Math.max(0.05, 1 - clampedY * clampedY));

    spots.push({
      id: `${bodyId}-spot-${i}`,
      bodyId,
      label: yEntry.veinNote,
      resourceId: yEntry.resourceId,
      localNormal: {
        x: Math.cos(theta) * rHoriz,
        y: clampedY,
        z: Math.sin(theta) * rHoriz,
      },
      multiplier: i === 0 ? 2.6 : 2.1,
      radiusRad: 0.44,
      colorHex: resDef.colorHex,
    });
  }

  return spots;
}

export function pickMinedResourceForBody(
  bodyId: string,
  activeHotspot: CatalogOrbitalHotspot | null,
  randValue = Math.random()
): MiningResourceId {
  const profile = getBodyMiningProfile(bodyId);
  if (!profile.extractable || profile.yields.length === 0) {
    return 'silicate-regolith';
  }

  if (activeHotspot && randValue < 0.72) {
    return activeHotspot.resourceId;
  }

  const totalWeight = profile.yields.reduce((sum, item) => sum + item.weight, 0);
  let cursor = ((randValue * 7919) % 1) * totalWeight;
  for (const entry of profile.yields) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry.resourceId;
    }
  }
  return profile.yields[0].resourceId;
}
