import {
  CharacterPreset,
  CharacterVariantId,
  SpacecraftPreset,
  SpacecraftVariantId,
} from '../types/astronomy';

export const SPACECRAFT_HANGAR_CATALOG: SpacecraftPreset[] = [
  {
    id: 'sr7-vanguard',
    name: 'SR-7 Vanguarda',
    codename: 'ALPHA-07',
    role: 'Caça Estelar Multirole',
    description:
      'Equilíbrio preciso entre velocidade de cruzeiro orbital, resposta ágil de manche HOTAS e motores de dobra iônica estáveis.',
    accentHex: '#38bdf8',
    plumePrimaryHex: '#fb923c',
    plumeWarpHex: '#38bdf8',
    hullTintHex: '#ffffff',
    emissiveTintHex: '#0ea5e9',
    stats: {
      speed: 88,
      agility: 90,
      armor: 85,
      warp: 90,
    },
    flightMultipliers: {
      speed: 1.0,
      agility: 1.0,
      boost: 1.0,
    },
  },
  {
    id: 'xr9-phantom',
    name: 'XR-9 Phantom',
    codename: 'SPECTRE-9',
    role: 'Interceptador Stealth Orbital',
    description:
      'Revestimento furtivo em grafite e titânio dourado com propulsores de resposta ultrarrápida para interceptações na Estação Espacial.',
    accentHex: '#f59e0b',
    plumePrimaryHex: '#fbbf24',
    plumeWarpHex: '#fde047',
    hullTintHex: '#cbd5e1',
    emissiveTintHex: '#f59e0b',
    stats: {
      speed: 99,
      agility: 98,
      armor: 72,
      warp: 95,
    },
    flightMultipliers: {
      speed: 1.32,
      agility: 1.28,
      boost: 1.24,
    },
  },
  {
    id: 'aegis-titan',
    name: 'Aegis Titan-IV',
    codename: 'NOVA-IV',
    role: 'Cruzador de Exploração Profunda',
    description:
      'Fuselagem em cerâmica branca e liga verde-esmeralda projetada para missões interplanetárias prolongadas e manobras seguras em órbita.',
    accentHex: '#10b981',
    plumePrimaryHex: '#34d399',
    plumeWarpHex: '#2dd4bf',
    hullTintHex: '#f1f5f9',
    emissiveTintHex: '#10b981',
    stats: {
      speed: 84,
      agility: 78,
      armor: 99,
      warp: 99,
    },
    flightMultipliers: {
      speed: 0.94,
      agility: 0.88,
      boost: 1.42,
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
