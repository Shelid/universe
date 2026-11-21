import {
  CharacterPreset,
  CharacterVariantId,
  SpacecraftPreset,
  SpacecraftVariantId,
} from '../types/astronomy';

export const SPACECRAFT_HANGAR_CATALOG: SpacecraftPreset[] = [
  {
    id: 'sr7-vanguard',
    name: 'Spaceship Orbital MK-I',
    codename: 'SPACESHIP-01',
    role: 'Nave Estelar Equilibrada de Exploração',
    description:
      'Nave inicial gratuita com cabine dupla 4K, porão ampliado (+100u base) e equilíbrio confiável para exploração e mineração orbital em todo o Sistema Solar.',
    unlockCostCredits: 0,
    perkBadge: 'Gratuita · +100u Porão Base',
    accentHex: '#38bdf8',
    plumePrimaryHex: '#38bdf8',
    plumeWarpHex: '#38bdf8',
    hullTintHex: '#ffffff',
    emissiveTintHex: '#00f0ff',
    stats: {
      speed: 84,
      agility: 85,
      armor: 86,
      warp: 84,
    },
    flightMultipliers: {
      speed: 1.0,
      agility: 1.0,
      boost: 1.0,
      fuelEfficiency: 1.0,
      warpEfficiency: 1.0,
      thermalShieldBonus: 0.0,
      cargoBonusUnits: 100,
    },
  },
  {
    id: 'xr9-phantom',
    name: 'SR-7 Stealth Âmbar',
    codename: 'SPECTRE-09',
    role: 'Interceptadora Rápida & Econômica',
    description:
      'Chassi leve de grafite furtivo com +22% de velocidade/agilidade 6-DOF e -20% consumo de combustível químico em voo livre e exploração entre luas.',
    unlockCostCredits: 1200,
    perkBadge: '+22% Vel./Agil. · -20% Comb.',
    accentHex: '#f59e0b',
    plumePrimaryHex: '#fbbf24',
    plumeWarpHex: '#fde047',
    hullTintHex: '#a8b4c4',
    emissiveTintHex: '#f59e0b',
    stats: {
      speed: 98,
      agility: 97,
      armor: 76,
      warp: 90,
    },
    flightMultipliers: {
      speed: 1.22,
      agility: 1.24,
      boost: 1.15,
      fuelEfficiency: 0.8,
      warpEfficiency: 0.94,
      thermalShieldBonus: 0.08,
      cargoBonusUnits: 0,
    },
  },
  {
    id: 'aegis-titan',
    name: 'SR-7 Titânio Esmeralda',
    codename: 'NOVA-04',
    role: 'Cruzadora Pesada de Expedição Profunda',
    description:
      'Blindagem térmica extrema (+38% proteção de escudo em coroa solar, anéis e reentrada), -18% consumo de Dobra Espacial e +200u extras no porão mineral.',
    unlockCostCredits: 2400,
    perkBadge: '+38% Escudo · -18% Dobra · +200u Porão',
    accentHex: '#10b981',
    plumePrimaryHex: '#34d399',
    plumeWarpHex: '#2dd4bf',
    hullTintHex: '#dbeafe',
    emissiveTintHex: '#10b981',
    stats: {
      speed: 88,
      agility: 82,
      armor: 99,
      warp: 98,
    },
    flightMultipliers: {
      speed: 1.06,
      agility: 0.94,
      boost: 1.24,
      fuelEfficiency: 0.92,
      warpEfficiency: 0.82,
      thermalShieldBonus: 0.38,
      cargoBonusUnits: 200,
    },
  },
];

export const CHARACTER_CREW_CATALOG: CharacterPreset[] = [
  {
    id: 'cmd-artemis',
    name: 'Cmdt. Elena Vance',
    callsign: 'ARTEMIS-01',
    role: 'Comandante de Missão Orbital',
    suitName: 'Traje EVA Artemis MK-V',
    description:
      'Traje pressurizado branco aeroespacial com visor polarizado ouro-azul e propulsores dorsais balanceados para acoplamento na estação.',
    accentHex: '#38bdf8',
    suitTintHex: '#ffffff',
    suitEmissiveHex: '#0284c7',
    visorLightHex: '#e0f2fe',
    jetpackFlameHex: '#38bdf8',
    stats: {
      evaThrust: 88,
      stamina: 92,
      sensorRange: 94,
    },
  },
  {
    id: 'pil-vortex',
    name: 'Capt. Lucas Vórtex',
    callsign: 'VORTEX-04',
    role: 'Piloto de Interceptação Estelar',
    suitName: 'Traje Vanguarda Âmbar',
    description:
      'Armadura espacial dourada de alta resposta tática com jetpack RCS supercomprimido e reflexos otimizados para pilotagem em cockpit.',
    accentHex: '#f59e0b',
    suitTintHex: '#fde68a',
    suitEmissiveHex: '#d97706',
    visorLightHex: '#fef3c7',
    jetpackFlameHex: '#fbbf24',
    stats: {
      evaThrust: 98,
      stamina: 86,
      sensorRange: 90,
    },
  },
  {
    id: 'eng-solaris',
    name: 'Esp. Maya Solaris',
    callsign: 'SOLARIS-09',
    role: 'Engenheira da Estação Orbital',
    suitName: 'Traje EVA Solaris Carmesim',
    description:
      'Traje de alta visibilidade com botas magnéticas de precisão para caminhar e inspecionar os módulos externos da Estação Espacial.',
    accentHex: '#f43f5e',
    suitTintHex: '#fecdd3',
    suitEmissiveHex: '#e11d48',
    visorLightHex: '#ffe4e6',
    jetpackFlameHex: '#fb7185',
    stats: {
      evaThrust: 90,
      stamina: 98,
      sensorRange: 97,
    },
  },
];

const SHIP_STORAGE_KEY = 'universe_explorer_ship_variant_v1';
const CHAR_STORAGE_KEY = 'universe_explorer_char_variant_v1';

export function getSpacecraftPreset(id: SpacecraftVariantId): SpacecraftPreset {
  return (
    SPACECRAFT_HANGAR_CATALOG.find((s) => s.id === id) || SPACECRAFT_HANGAR_CATALOG[0]
  );
}

export function getCharacterPreset(id: CharacterVariantId): CharacterPreset {
  return CHARACTER_CREW_CATALOG.find((c) => c.id === id) || CHARACTER_CREW_CATALOG[0];
}

export function loadSavedShipVariant(): SpacecraftVariantId {
  try {
    const raw = localStorage.getItem(SHIP_STORAGE_KEY);
    if (raw === 'sr7-vanguard' || raw === 'xr9-phantom' || raw === 'aegis-titan') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'sr7-vanguard';
}

export function saveShipVariant(id: SpacecraftVariantId): void {
  try {
    localStorage.setItem(SHIP_STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}

export function loadSavedCharacterVariant(): CharacterVariantId {
  try {
    const raw = localStorage.getItem(CHAR_STORAGE_KEY);
    if (raw === 'cmd-artemis' || raw === 'pil-vortex' || raw === 'eng-solaris') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'cmd-artemis';
}

export function saveCharacterVariant(id: CharacterVariantId): void {
  try {
    localStorage.setItem(CHAR_STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}
