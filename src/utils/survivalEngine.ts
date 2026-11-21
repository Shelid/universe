import {
  BodyCategory,
  CabinStationId,
  MiningLaserTelemetry,
  MiningRecipeId,
  MiningResourceId,
  PowerPips,
  PowerSubsystemId,
  RefuelSourceKind,
  ShipUpgradeSystemId,
  SpacecraftVariantId,
  SurvivalResourcesState,
} from '../types/astronomy';
import {
  CatalogOrbitalHotspot,
  ENERGY_MINERAL_YIELDS,
  getBodyMiningProfile,
  MINERAL_FUSION_RECIPES,
  MINING_RECIPES_BY_ID,
  MINING_RESOURCES,
  pickMinedResourceForBody,
  SHIP_UPGRADE_DEFINITIONS,
  SPACE_CONTRACTS,
} from '../data/miningCatalog';

export const POWER_PIP_TOTAL = 8;
export const MAX_PIPS_PER_SUBSYSTEM = 4;

export const DEFAULT_POWER_PIPS: PowerPips = {
  engines: 2,
  shields: 2,
  weapons: 2,
  lifeSupport: 2,
};

export const POWER_PRESETS: Record<
  'BALANCED' | 'ENGINES' | 'DEFENSE' | 'SURVIVAL',
  { label: string; pips: PowerPips }
> = {
  BALANCED: {
    label: 'Equilibrado',
    pips: { engines: 2, shields: 2, weapons: 2, lifeSupport: 2 },
  },
  ENGINES: {
    label: 'Velocidade',
    pips: { engines: 4, shields: 1, weapons: 1, lifeSupport: 2 },
  },
  DEFENSE: {
    label: 'Combate',
    pips: { engines: 2, shields: 3, weapons: 2, lifeSupport: 1 },
  },
  SURVIVAL: {
    label: 'Suporte O₂',
    pips: { engines: 1, shields: 2, weapons: 1, lifeSupport: 4 },
  },
};

export interface CabinStationDescriptor {
  id: Exclude<CabinStationId, 'NONE'>;
  title: string;
  actionHint: string;
  localPos: [number, number, number];
  accentHex: string;
  triggerRadius: number;
}

export const CABIN_STATIONS: CabinStationDescriptor[] = [
  {
    id: 'GALLEY',
    title: 'Copa Espacial & Hidratação',
    actionHint: 'Preparar Ração (+Fome) e Água (+Sede)',
    localPos: [-0.24, -0.02, -2.97],
    accentHex: '#f59e0b',
    triggerRadius: 0.17,
  },
  {
    id: 'BUNK',
    title: 'Cabine de Descanso (Beliche)',
    actionHint: 'Repousar (+Energia do Piloto e Resfriar Reator)',
    localPos: [0.24, -0.02, -2.97],
    accentHex: '#a78bfa',
    triggerRadius: 0.17,
  },
  {
    id: 'REACTOR',
    title: 'Painel Reator & Suporte O₂',
    actionHint: 'Calibrar O₂, Bateria e Reparo do Casco',
    localPos: [0.0, -0.01, -2.86],
    accentHex: '#10b981',
    triggerRadius: 0.18,
  },
  {
    id: 'AIRLOCK',
    title: 'Escotilha Airlock EVA',
    actionHint: 'Pressurizar Traje e Sair no Espaço (EVA)',
    localPos: [0.0, -0.06, -3.14],
    accentHex: '#38bdf8',
    triggerRadius: 0.14,
  },
];

export function detectNearbyCabinStation(localX: number, localZ: number): CabinStationId {
  let closest: CabinStationId = 'NONE';
  let bestDistSq = Infinity;
  for (let i = 0; i < CABIN_STATIONS.length; i++) {
    const st = CABIN_STATIONS[i];
    const dx = localX - st.localPos[0];
    const dz = localZ - st.localPos[2];
    const d2 = dx * dx + dz * dz;
    if (d2 <= st.triggerRadius * st.triggerRadius && d2 < bestDistSq) {
      bestDistSq = d2;
      closest = st.id;
    }
  }
  return closest;
}

export function adjustPowerPips(
  current: PowerPips,
  target: PowerSubsystemId,
  delta: 1 | -1
): PowerPips {
  const next: PowerPips = { ...current };
  const order: PowerSubsystemId[] = ['weapons', 'shields', 'engines', 'lifeSupport'];

  if (delta > 0) {
    if (next[target] >= MAX_PIPS_PER_SUBSYSTEM) return current;
    const sum = next.engines + next.shields + next.weapons + next.lifeSupport;
    if (sum < POWER_PIP_TOTAL) {
      next[target] += 1;
      return next;
    }
    const donor = order
      .filter((k) => k !== target && next[k] > 0)
      .sort((a, b) => next[b] - next[a])[0];
    if (!donor) return current;
    next[target] += 1;
    next[donor] -= 1;
    return next;
  }

  if (next[target] <= 0) return current;
  const receiver = order
    .filter((k) => k !== target && next[k] < MAX_PIPS_PER_SUBSYSTEM)
    .sort((a, b) => next[a] - next[b])[0];
  if (!receiver) return current;
  next[target] -= 1;
  next[receiver] += 1;
  return next;
}

export function createInitialSurvivalState(): SurvivalResourcesState {
  return {
    fuelPercent: 100,
    warpEnergyPercent: 68,
    warpCells: 1,
    maxWarpCells: 5,
    batteryPercent: 100,
    batteryBankPercent: 85,
    ecoCruiseMode: false,

    shipOxygenPercent: 100,
    evaOxygenPercent: 100,
    hullIntegrity: 100,
    hullTempC: 24,
    reactorTempC: 280,
    radiatorsDeployed: false,
    radiationPercent: 4,
    inPlanetaryShadow: false,
    solarHarvestKw: 18,

    hungerPercent: 100,
    thirstPercent: 100,
    fatiguePercent: 100,
    foodRations: 6,
    waterFlasks: 6,
    repairKits: 3,

    powerPips: { ...DEFAULT_POWER_PIPS },
    nearRefuelSource: 'HANGAR',
    nearbyCabinStation: 'NONE',
    activeStatusAlert: null,
    miningLaserActive: false,
    cargoInventory: {},
    cargoCapacityUnits: 500,
    spaceCredits: 250,
    totalMinedUnits: 0,
    shipUpgrades: {
      cargo: 1,
      laser: 1,
      batteryBank: 1,
      pulseCannon: 1,
      warpDrive: 1,
    },
    completedContractIds: [],
    destroyedTargetsCount: 0,
    mining: {
      isActive: false,
      isDrilling: false,
      inRange: false,
      targetBodyId: null,
      targetBodyName: null,
      activeResourceId: null,
      activeHotspotLabel: null,
      hotspotMultiplier: 1,
      surfaceDistanceRatio: 99,
      beamPowerKw: 0,
      extractionRatePerSec: 0,
      extractionProgress01: 0,
      lastMinedResourceId: null,
      statusMessage: 'Extrator orbital em espera. Aproxime-se de um astro e pressione X.',
    },
  };
}

export interface StepSurvivalParams {
  dt: number;
  mode: 'HANGAR' | 'SPACECRAFT' | 'EVA' | 'EXPLORE';
  shipVariantId: SpacecraftVariantId;
  throttle: number;
  boostActive: boolean;
  isBraking: boolean;
  rcsActive: boolean;
  shieldsOn: boolean;
  headlightsOn: boolean;
  walkingInside: boolean;
  cabinLocalX: number;
  cabinLocalZ: number;
  evaSprinting: boolean;
  evaMoving: boolean;
  sunDistanceUnits: number;
  nearestBodyId: string;
  nearestBodyCategory: BodyCategory;
  nearestSurfaceRatio: number; // distance / radius (~1.05 at surface skim)
  nearOrbitalStation: boolean;
  inPlanetaryShadow: boolean;
}

const clampPct = (v: number): number => Math.max(0, Math.min(100, v));

export function stepSurvivalSimulation(
  state: SurvivalResourcesState,
  p: StepSurvivalParams
): SurvivalResourcesState {
  const dt = Math.min(0.15, Math.max(0.001, p.dt));
  if (dt <= 0) return state;

  // Nave única polivalente: todas as pinturas compartilham eficiência 1.0x idêntica
  void p.shipVariantId;
  const upg = state.shipUpgrades ?? {
    cargo: 1,
    laser: 1,
    batteryBank: 1,
    pulseCannon: 1,
    warpDrive: 1,
  };
  const fuelEfficiency = 1.0;
  const warpEfficiency = Math.max(0.36, 1.0 - (upg.warpDrive - 1) * 0.16);
  const bankSolarMult = 1.0 + (upg.batteryBank - 1) * 0.35;

  if (p.mode === 'HANGAR') {
    return {
      ...state,
      fuelPercent: 100,
      warpEnergyPercent: Math.max(state.warpEnergyPercent, 68),
      warpCells: Math.max(state.warpCells, 1),
      batteryPercent: 100,
      batteryBankPercent: Math.max(state.batteryBankPercent ?? 85, 85),
      shipOxygenPercent: 100,
      evaOxygenPercent: 100,
      hullIntegrity: 100,
      hullTempC: 22,
      reactorTempC: 245,
      radiationPercent: 0,
      inPlanetaryShadow: false,
      solarHarvestKw: 45,
      hungerPercent: Math.max(state.hungerPercent, 96),
      thirstPercent: Math.max(state.thirstPercent, 96),
      fatiguePercent: Math.max(state.fatiguePercent, 96),
      foodRations: Math.max(state.foodRations, 6),
      waterFlasks: Math.max(state.waterFlasks, 6),
      repairKits: Math.max(state.repairKits, 3),
      nearRefuelSource: 'HANGAR',
      nearbyCabinStation: 'NONE',
      activeStatusAlert: null,
    };
  }

  let fuel = state.fuelPercent;
  let warpEnergy = state.warpEnergyPercent;
  const warpCells = state.warpCells;
  let battery = state.batteryPercent;
  let batteryBank = state.batteryBankPercent ?? 85;
  let shipO2 = state.shipOxygenPercent;
  let evaO2 = state.evaOxygenPercent;
  let hull = state.hullIntegrity;
  let hullTemp = state.hullTempC;
  let reactorTemp = state.reactorTempC;
  let radiation = state.radiationPercent;
  let hunger = state.hungerPercent;
  let thirst = state.thirstPercent;
  let fatigue = state.fatiguePercent;

  // 1. Determine nearby natural/station resupply source
  let refuelSource: RefuelSourceKind = 'NONE';
  const isGasGiant =
    p.nearestBodyId === 'jupiter' ||
    p.nearestBodyId === 'saturn' ||
    p.nearestBodyId === 'uranus' ||
    p.nearestBodyId === 'neptune';

  if (p.nearOrbitalStation) {
    refuelSource = 'ORBITAL_STATION';
  } else if (isGasGiant && p.nearestSurfaceRatio < 4.5 && p.mode === 'SPACECRAFT') {
    refuelSource = 'GAS_GIANT_SCOOP';
  } else if (p.sunDistanceUnits < 72 && !p.inPlanetaryShadow) {
    refuelSource = 'SOLAR_CORONA';
  }

  // 2. Solar irradiance & inverse-distance solar charging (1 AU = 149.59787 units)
  // Gentler distance falloff (0.72) so the Sun still charges the ship well at Mars/Jupiter while charging very fast near the Sun!
  const sunDistAU = Math.max(0.035, p.sunDistanceUnits / 149.59787);
  const solarFluxKw = p.inPlanetaryShadow
    ? 4
    : Math.min(520, Math.max(28, Math.round(135 / Math.pow(sunDistAU, 0.72))));

  const lifePips = state.powerPips.lifeSupport;
  const shieldPips = state.powerPips.shields;
  const engPips = state.powerPips.engines;
  const weapPips = state.powerPips.weapons;

  // 3. Fuel & Warp Drive drain during active flight (Balanced tactical consumption)
  if (p.mode === 'SPACECRAFT') {
    const absThr = Math.abs(p.throttle);
    const ecoMult = state.ecoCruiseMode ? 0.56 : 1.0;
    const thrustBurnRate =
      (absThr * 0.62 + (p.isBraking ? 0.25 : 0) + (p.rcsActive ? 0.11 : 0)) *
      ecoMult *
      fuelEfficiency;
    fuel -= thrustBurnRate * dt;

    if (p.boostActive) {
      // Medium duration warp tank (~25s of continuous FTL warp per full tank)
      warpEnergy -= 3.9 * ecoMult * warpEfficiency * dt;
      fuel -= 0.34 * ecoMult * fuelEfficiency * dt;
    } else {
      // Subtle reactor trickle + faster solar corona warp induction when close to the Sun
      const warpRegen = (solarFluxKw > 140 ? 0.26 : solarFluxKw > 75 ? 0.11 : 0.04) + engPips * 0.025;
      warpEnergy = Math.min(100, warpEnergy + warpRegen * dt);
    }
  } else if (p.mode === 'EXPLORE') {
    warpEnergy = Math.min(100, warpEnergy + 0.12 * dt);
  }

  // 4. Natural/Station Resupply
  if (refuelSource === 'ORBITAL_STATION') {
    fuel = Math.min(100, fuel + 10 * dt);
    shipO2 = Math.min(100, shipO2 + 18 * dt);
    evaO2 = Math.min(100, evaO2 + 25 * dt);
    battery = Math.min(100, battery + 22 * dt);
    batteryBank = Math.min(100, batteryBank + 15 * dt);
    warpEnergy = Math.min(100, warpEnergy + 4.5 * dt);
  } else if (refuelSource === 'GAS_GIANT_SCOOP') {
    // Atmospheric hydrogen / He-3 harvesting near Jupiter/Saturn/Uranus/Neptune!
    fuel = Math.min(100, fuel + 4.6 * dt);
    warpEnergy = Math.min(100, warpEnergy + 1.35 * dt);
    battery = Math.min(100, battery + 3.2 * dt);
  } else if (refuelSource === 'SOLAR_CORONA') {
    // Close solar approach (< 0.48 AU): accelerated solar collector recharge + Battery Bank storage!
    const coronaProximityBoost = THREE_CLAMP((72 - p.sunDistanceUnits) / 14, 0.9, 5.2);
    battery = Math.min(100, battery + 7.5 * coronaProximityBoost * dt);
    batteryBank = Math.min(100, batteryBank + 4.2 * coronaProximityBoost * dt);
    warpEnergy = Math.min(100, warpEnergy + 0.95 * coronaProximityBoost * dt);
  }

  // 5. Ship Energy & Battery Bank (Faster Solar Charging + 62% Lower Drain so Energy Lasts Much Longer!)
  const solarChargeRate = p.inPlanetaryShadow
    ? 0
    : Math.max(1.35, Math.pow(solarFluxKw / 95, 0.88) * 3.85) * bankSolarMult;
  const batteryGen = solarChargeRate + (fuel > 1 ? 0.65 : 0.12);
  const batteryLoad =
    0.12 +
    (p.mode === 'SPACECRAFT' ? Math.abs(p.throttle) * 0.16 : 0) +
    (p.shieldsOn ? 0.20 + shieldPips * 0.05 : 0) +
    (p.headlightsOn ? 0.07 : 0) +
    lifePips * 0.08 +
    weapPips * 0.04 +
    (p.boostActive ? 0.52 : 0);

  const rawNextBattery = battery + (batteryGen - batteryLoad) * dt;
  if (rawNextBattery > 100) {
    // Overflow solar/reactor energy is stored directly in the Ship's Battery Bank!
    const surplus = rawNextBattery - 100;
    battery = 100;
    batteryBank = clampPct(batteryBank + surplus * 0.72);
  } else if (rawNextBattery < 28 && batteryBank > 0.2) {
    // Automatic reserve backup: Battery Bank discharges smoothly to keep Ship Energy healthy!
    const transfer = Math.min(batteryBank, 12.0 * dt);
    battery = clampPct(rawNextBattery + transfer * 1.4);
    batteryBank = clampPct(batteryBank - transfer);
  } else {
    battery = clampPct(rawNextBattery);
  }

  // 6. Thermal Physics (Solar heat + Warp/Engine heat vs Shadow & Radiators!)
  const sunHeatTargetC = p.inPlanetaryShadow
    ? -65
    : THREE_CLAMP(-90 + solarFluxKw * 4.8, -110, 820);
  const engineHeatTarget =
    245 +
    (p.mode === 'SPACECRAFT' ? Math.abs(p.throttle) * 235 + (p.boostActive ? 390 : 0) : 15) +
    (p.isBraking ? 65 : 0);
  const coolantBonus = state.radiatorsDeployed ? 3.2 : 1.0;
  const shadowBonus = p.inPlanetaryShadow ? 1.65 : 1.0;
  const lifeCooling = lifePips * 0.22;

  const reactorTargetCool = state.radiatorsDeployed
    ? engineHeatTarget * 0.64
    : engineHeatTarget;
  reactorTemp += (reactorTargetCool - reactorTemp) * Math.min(1, dt * (0.45 + lifeCooling) * coolantBonus);

  const hullTargetC =
    sunHeatTargetC +
    Math.max(0, reactorTemp - 360) * 0.42 -
    (state.radiatorsDeployed ? 85 : 0) -
    (p.inPlanetaryShadow ? 35 : 0);
  hullTemp += (hullTargetC - hullTemp) * Math.min(1, dt * 0.35 * coolantBonus * shadowBonus);

  // Cosmic & Solar Radiation (Jupiter radiation belt / close Solar approach)
  let targetRad = 4;
  if (!p.inPlanetaryShadow && p.sunDistanceUnits < 65) {
    targetRad += Math.min(82, Math.pow(65 / Math.max(8, p.sunDistanceUnits), 1.9) * 6);
  }
  if (p.nearestBodyId === 'jupiter' && p.nearestSurfaceRatio < 4.0) {
    targetRad += 34;
  }
  const shieldFilter = (p.shieldsOn ? 0.42 + shieldPips * 0.1 : 0.1) + lifePips * 0.08;
  targetRad *= Math.max(0.18, 1 - shieldFilter);
  if (p.inPlanetaryShadow) targetRad *= 0.22;
  radiation += (clampPct(targetRad) - radiation) * Math.min(1, dt * 0.9);

  // Overheating gently chips hull integrity above 640°C
  if (hullTemp > 640 && p.mode === 'SPACECRAFT') {
    hull -= ((hullTemp - 640) / 180) * 0.85 * dt;
  }

  // 7. Oxygen ($O_2$) — Ship Life Support vs EVA Suit Tank
  if (p.mode === 'EVA') {
    // EVA uses personal helmet cylinder
    const evaDrain = (0.24 + (p.evaMoving ? 0.12 : 0) + (p.evaSprinting ? 0.28 : 0)) * dt;
    evaO2 -= evaDrain;
    // Ship idle scrubbers gently maintain cabin O2 if powered
    if (battery > 2 && lifePips > 0) {
      shipO2 = Math.min(100, shipO2 + 0.6 * dt);
    }
  } else {
    // Back inside ship / observatory refills suit cylinder from cabin supply
    if (shipO2 > 15) {
      evaO2 = Math.min(100, evaO2 + 12 * dt);
    }
    const hullLeak = hull < 55 ? (55 - hull) * 0.035 : 0;
    const scrubberGain =
      battery > 3 && lifePips > 0
        ? (0.35 + lifePips * 0.48) - (p.mode === 'SPACECRAFT' ? 0.26 : 0.18)
        : -0.35;
    shipO2 = clampPct(shipO2 + (scrubberGain - hullLeak) * dt);
  }

  // 8. Pilot Biological Needs (Hunger, Thirst, Fatigue)
  const activityMult =
    p.mode === 'EVA' && p.evaSprinting
      ? 1.75
      : p.mode === 'SPACECRAFT' && (p.walkingInside || p.boostActive)
        ? 1.25
        : p.mode === 'EXPLORE'
          ? 0.25
          : 1.0;
  // Gentle, realistic pacing (~10-16 minutes from 100% -> 20%)
  hunger -= 0.085 * activityMult * dt;
  thirst -= 0.115 * activityMult * dt;
  fatigue -= 0.072 * activityMult * dt;

  fuel = clampPct(fuel);
  warpEnergy = clampPct(warpEnergy);
  hull = clampPct(hull);
  shipO2 = clampPct(shipO2);
  evaO2 = clampPct(evaO2);
  hunger = clampPct(hunger);
  thirst = clampPct(thirst);
  fatigue = clampPct(fatigue);

  // 9. Cabin Station Proximity Detection while walking inside 3D Ship
  const nearbyCabinStation =
    p.mode === 'SPACECRAFT' && p.walkingInside
      ? detectNearbyCabinStation(p.cabinLocalX, p.cabinLocalZ)
      : 'NONE';

  // 10. Priority Status Alert
  let activeStatusAlert: string | null = null;
  if (p.mode === 'EVA' && evaO2 < 22) {
    activeStatusAlert = 'OXIGÊNIO DO TRAJE EVA CRÍTICO — Retorne à nave ou use recarga!';
  } else if (p.mode !== 'EVA' && shipO2 < 25) {
    activeStatusAlert = 'SUPORTE DE VIDA (O₂) BAIXO — Aumente energia em Suporte de Vida!';
  } else if (hullTemp > 520) {
    activeStatusAlert = 'SUPERAQUECIMENTO TÉRMICO — Ative os Radiadores (K) ou entre na sombra!';
  } else if (radiation > 68) {
    activeStatusAlert = 'RADIAÇÃO SOLAR ALTA — Ligue Escudos ou abrigue-se atrás de um planeta!';
  } else if (fuel < 15 && p.mode === 'SPACECRAFT') {
    activeStatusAlert =
      'COMBUSTÍVEL CRÍTICO — Colete em Júpiter/Saturno, Estação Orbital ou chame Drone!';
  } else if (thirst < 20 || hunger < 20) {
    activeStatusAlert = 'PILOTO COM FOME/SEDE — Use Ração/Água ou vá à Copa da nave (G)!';
  } else if (fatigue < 20) {
    activeStatusAlert = 'FADIGA ELEVADA — Descanse na Beliche da cabine (G) para recuperar foco!';
  }

  return {
    ...state,
    fuelPercent: Number(fuel.toFixed(1)),
    warpEnergyPercent: Number(warpEnergy.toFixed(1)),
    warpCells,
    batteryPercent: Number(battery.toFixed(1)),
    batteryBankPercent: Number(batteryBank.toFixed(1)),
    shipOxygenPercent: Number(shipO2.toFixed(1)),
    evaOxygenPercent: Number(evaO2.toFixed(1)),
    hullIntegrity: Number(hull.toFixed(1)),
    hullTempC: Math.round(hullTemp),
    reactorTempC: Math.round(reactorTemp),
    radiationPercent: Math.round(radiation),
    inPlanetaryShadow: p.inPlanetaryShadow,
    solarHarvestKw: Math.round(solarFluxKw),
    hungerPercent: Number(hunger.toFixed(1)),
    thirstPercent: Number(thirst.toFixed(1)),
    fatiguePercent: Number(fatigue.toFixed(1)),
    nearRefuelSource: refuelSource,
    nearbyCabinStation,
    activeStatusAlert,
  };
}

function THREE_CLAMP(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function consumeFoodRation(state: SurvivalResourcesState): SurvivalResourcesState {
  if (state.foodRations <= 0) return state;
  return {
    ...state,
    foodRations: state.foodRations - 1,
    hungerPercent: Math.min(100, Number((state.hungerPercent + 45).toFixed(1))),
    fatiguePercent: Math.min(100, Number((state.fatiguePercent + 8).toFixed(1))),
  };
}

export function consumeWaterFlask(state: SurvivalResourcesState): SurvivalResourcesState {
  if (state.waterFlasks <= 0) return state;
  return {
    ...state,
    waterFlasks: state.waterFlasks - 1,
    thirstPercent: Math.min(100, Number((state.thirstPercent + 50).toFixed(1))),
    fatiguePercent: Math.min(100, Number((state.fatiguePercent + 6).toFixed(1))),
  };
}

export function consumeWarpCell(state: SurvivalResourcesState): SurvivalResourcesState {
  if (state.warpCells <= 0) return state;
  return {
    ...state,
    warpCells: state.warpCells - 1,
    warpEnergyPercent: Math.min(100, Number((state.warpEnergyPercent + 55).toFixed(1))),
    batteryPercent: Math.min(100, Number((state.batteryPercent + 20).toFixed(1))),
  };
}

export function useRepairKitAction(state: SurvivalResourcesState): SurvivalResourcesState {
  if (state.repairKits <= 0) return state;
  return {
    ...state,
    repairKits: state.repairKits - 1,
    hullIntegrity: Math.min(100, Number((state.hullIntegrity + 45).toFixed(1))),
    shipOxygenPercent: Math.min(100, Number((state.shipOxygenPercent + 20).toFixed(1))),
  };
}

export function restInCabinBunkAction(state: SurvivalResourcesState): SurvivalResourcesState {
  return {
    ...state,
    fatiguePercent: 100,
    hullTempC: Math.max(-40, Math.min(state.hullTempC, 38)),
    reactorTempC: Math.min(state.reactorTempC, 275),
    batteryPercent: Math.min(100, Number((state.batteryPercent + 30).toFixed(1))),
    shipOxygenPercent: Math.min(100, Number((state.shipOxygenPercent + 15).toFixed(1))),
  };
}

export function calibrateReactorO2Action(state: SurvivalResourcesState): SurvivalResourcesState {
  return {
    ...state,
    shipOxygenPercent: Math.min(100, Number((state.shipOxygenPercent + 35).toFixed(1))),
    evaOxygenPercent: 100,
    batteryPercent: Math.min(100, Number((state.batteryPercent + 35).toFixed(1))),
    reactorTempC: Math.min(state.reactorTempC, 310),
  };
}

export function emergencyRescueDroneAction(state: SurvivalResourcesState): SurvivalResourcesState {
  return {
    ...state,
    fuelPercent: Math.max(state.fuelPercent, 55),
    warpEnergyPercent: Math.max(state.warpEnergyPercent, 65),
    warpCells: Math.min(state.maxWarpCells, Math.max(state.warpCells, 1)),
    shipOxygenPercent: Math.max(state.shipOxygenPercent, 85),
    evaOxygenPercent: Math.max(state.evaOxygenPercent, 85),
    batteryPercent: Math.max(state.batteryPercent, 75),
    foodRations: Math.max(state.foodRations, 2),
    waterFlasks: Math.max(state.waterFlasks, 2),
    hungerPercent: Math.max(state.hungerPercent, 65),
    thirstPercent: Math.max(state.thirstPercent, 65),
    fatiguePercent: Math.max(state.fatiguePercent, 65),
  };
}

export function fullStationResupplyAction(state: SurvivalResourcesState): SurvivalResourcesState {
  return {
    ...state,
    fuelPercent: 100,
    warpEnergyPercent: 100,
    warpCells: state.maxWarpCells,
    batteryPercent: 100,
    batteryBankPercent: 100,
    shipOxygenPercent: 100,
    evaOxygenPercent: 100,
    hullIntegrity: 100,
    hullTempC: 24,
    radiationPercent: 0,
    hungerPercent: 100,
    thirstPercent: 100,
    fatiguePercent: 100,
    foodRations: 6,
    waterFlasks: 6,
    repairKits: 3,
  };
}


export interface MiningStepInput {
  dt: number;
  clockTime: number;
  targetBodyId: string | null;
  targetBodyName: string | null;
  surfaceDistanceRatio: number;
  hotspots: CatalogOrbitalHotspot[];
  shipAimDirOnTargetWorld: { x: number; y: number; z: number } | null;
  hitNormalLocal: { x: number; y: number; z: number } | null;
}

export interface MiningStepResult {
  state: SurvivalResourcesState;
  minedUnitsThisTick: number;
  minedResourceId: MiningResourceId | null;
  activeHotspot: CatalogOrbitalHotspot | null;
  effectiveColorHex: string;
}

export function getTotalCargoUnits(
  inventory: Partial<Record<MiningResourceId, number>>
): number {
  let total = 0;
  for (const key of Object.keys(inventory) as MiningResourceId[]) {
    total += Math.max(0, Math.floor(inventory[key] ?? 0));
  }
  return total;
}

export function createIdleMiningTelemetry(
  lastMinedResourceId: MiningResourceId | null = null,
  statusMessage = 'Extrator orbital em espera. Aproxime-se de um astro e pressione X.'
): MiningLaserTelemetry {
  return {
    isActive: false,
    isDrilling: false,
    inRange: false,
    targetBodyId: null,
    targetBodyName: null,
    activeResourceId: null,
    activeHotspotLabel: null,
    hotspotMultiplier: 1,
    surfaceDistanceRatio: 99,
    beamPowerKw: 0,
    extractionRatePerSec: 0,
    extractionProgress01: 0,
    lastMinedResourceId,
    statusMessage,
  };
}

/**
 * Evaluates realistic orbital laser extraction physics:
 * - Proximity range scales fairly across 1:1 / compressed worlds via surfaceDistanceRatio (dist / radius)
 * - Detects surface geological hotspots & increases extraction yield (up to 2.6x)
 * - Consumes reactor battery and adds thermal load mitigated by Radiators (K) & Weapons PIPs
 */
export function stepMiningSimulation(
  prev: SurvivalResourcesState,
  input: MiningStepInput
): MiningStepResult {
  const dt = Math.min(0.15, Math.max(0.001, input.dt));
  const usedCargo = getTotalCargoUnits(prev.cargoInventory);
  const cargoFull = usedCargo >= prev.cargoCapacityUnits;

  const bodyId = input.targetBodyId;
  const bodyName = input.targetBodyName ?? bodyId ?? '—';
  const ratio = input.surfaceDistanceRatio;
  const maxMiningRatio = 6.8;
  const profile = bodyId ? getBodyMiningProfile(bodyId) : null;
  const inRange = Boolean(bodyId && profile && ratio <= maxMiningRatio);

  // Detect nearest geological hotspot aligned under the laser hit point on the body
  let matchedHotspot: CatalogOrbitalHotspot | null = null;
  if (input.hitNormalLocal && input.hotspots.length > 0) {
    let bestDot = -1;
    for (const spot of input.hotspots) {
      const dot =
        spot.localNormal.x * input.hitNormalLocal.x +
        spot.localNormal.y * input.hitNormalLocal.y +
        spot.localNormal.z * input.hitNormalLocal.z;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle <= spot.radiusRad && dot > bestDot) {
        bestDot = dot;
        matchedHotspot = spot;
      }
    }
  }

  const effectiveColorHex = matchedHotspot?.colorHex ?? profile?.laserColorHex ?? '#38bdf8';

  if (!prev.miningLaserActive) {
    let standbyMsg = 'Extrator pronto. Aproxime-se de qualquer astro ou asteroide.';
    if (bodyId && profile) {
      if (!profile.extractable) {
        standbyMsg = profile.restrictionReason ?? `${bodyName}: mineração restrita.`;
      } else if (inRange) {
        standbyMsg = `Em órbita de ${bodyName} — pressione [X] para acionar o Laser Extrator.`;
      } else {
        standbyMsg = `Alvo: ${bodyName} (${ratio.toFixed(1)}R). Aproxime para ≤ ${maxMiningRatio.toFixed(1)}R.`;
      }
    }
    return {
      state: {
        ...prev,
        mining: {
          ...prev.mining,
          isActive: false,
          isDrilling: false,
          inRange,
          targetBodyId: bodyId,
          targetBodyName: bodyName,
          activeResourceId: matchedHotspot?.resourceId ?? profile?.yields[0]?.resourceId ?? null,
          activeHotspotLabel: matchedHotspot?.label ?? null,
          hotspotMultiplier: matchedHotspot?.multiplier ?? 1,
          surfaceDistanceRatio: ratio,
          beamPowerKw: 0,
          extractionRatePerSec: 0,
          extractionProgress01: Math.max(0, prev.mining.extractionProgress01 - dt * 0.4),
          statusMessage: standbyMsg,
        },
      },
      minedUnitsThisTick: 0,
      minedResourceId: null,
      activeHotspot: matchedHotspot,
      effectiveColorHex,
    };
  }

  // Laser is ON
  if (!bodyId || !profile) {
    return {
      state: {
        ...prev,
        mining: {
          ...prev.mining,
          isActive: true,
          isDrilling: false,
          inRange: false,
          targetBodyId: null,
          targetBodyName: null,
          activeResourceId: null,
          activeHotspotLabel: null,
          hotspotMultiplier: 1,
          surfaceDistanceRatio: ratio,
          beamPowerKw: 18,
          extractionRatePerSec: 0,
          statusMessage: 'Sem astro ao alcance. Aproxime-se de uma lua, planeta ou asteroide.',
        },
      },
      minedUnitsThisTick: 0,
      minedResourceId: null,
      activeHotspot: null,
      effectiveColorHex,
    };
  }

  if (!profile.extractable) {
    return {
      state: {
        ...prev,
        miningLaserActive: false,
        mining: {
          ...prev.mining,
          isActive: false,
          isDrilling: false,
          inRange: false,
          targetBodyId: bodyId,
          targetBodyName: bodyName,
          activeResourceId: null,
          activeHotspotLabel: null,
          hotspotMultiplier: 1,
          surfaceDistanceRatio: ratio,
          beamPowerKw: 0,
          extractionRatePerSec: 0,
          statusMessage: profile.restrictionReason ?? `${bodyName} não permite mineração.`,
        },
      },
      minedUnitsThisTick: 0,
      minedResourceId: null,
      activeHotspot: null,
      effectiveColorHex,
    };
  }

  if (prev.batteryPercent <= 1.2) {
    return {
      state: {
        ...prev,
        miningLaserActive: false,
        mining: {
          ...prev.mining,
          isActive: false,
          isDrilling: false,
          inRange,
          targetBodyId: bodyId,
          targetBodyName: bodyName,
          beamPowerKw: 0,
          extractionRatePerSec: 0,
          statusMessage: 'Bateria esgotada! Aguarde recarga solar/reator antes de reativar [X].',
        },
      },
      minedUnitsThisTick: 0,
      minedResourceId: null,
      activeHotspot: matchedHotspot,
      effectiveColorHex,
    };
  }

  if (cargoFull) {
    return {
      state: {
        ...prev,
        miningLaserActive: false,
        mining: {
          ...prev.mining,
          isActive: false,
          isDrilling: false,
          inRange,
          targetBodyId: bodyId,
          targetBodyName: bodyName,
          beamPowerKw: 0,
          extractionRatePerSec: 0,
          statusMessage: `Porão cheio (${usedCargo}/${prev.cargoCapacityUnits} un)! Funda 2 minérios em itens raros, venda por CR ou amplie o Porão na Oficina.`,
        },
      },
      minedUnitsThisTick: 0,
      minedResourceId: null,
      activeHotspot: matchedHotspot,
      effectiveColorHex,
    };
  }

  if (!inRange) {
    return {
      state: {
        ...prev,
        mining: {
          ...prev.mining,
          isActive: true,
          isDrilling: false,
          inRange: false,
          targetBodyId: bodyId,
          targetBodyName: bodyName,
          activeResourceId: profile.yields[0]?.resourceId ?? null,
          activeHotspotLabel: null,
          hotspotMultiplier: 1,
          surfaceDistanceRatio: ratio,
          beamPowerKw: 45,
          extractionRatePerSec: 0,
          statusMessage: `Feixe em espera — aproxime de ${bodyName} (${ratio.toFixed(1)}R / máx ${maxMiningRatio.toFixed(1)}R).`,
        },
      },
      minedUnitsThisTick: 0,
      minedResourceId: null,
      activeHotspot: null,
      effectiveColorHex,
    };
  }

  // Active orbital drilling on target body (boosted by Laser Quantum Upgrade Level)
  const laserUpgradeMult = 1.0 + ((prev.shipUpgrades?.laser ?? 1) - 1) * 0.38;
  const weaponsMult = (0.72 + prev.powerPips.weapons * 0.24) * laserUpgradeMult;
  const proximityFactor = Math.max(0.32, Math.min(1.45, 1.5 - (ratio - 1.04) * 0.28));
  const hotspotMult = matchedHotspot ? matchedHotspot.multiplier : 1.0;
  const hardness = Math.max(0.5, profile.hardnessFactor);

  // Units per second
  const extractionRatePerSec =
    (0.46 * weaponsMult * proximityFactor * hotspotMult) / hardness;
  const beamPowerKw = Math.round(320 * weaponsMult * proximityFactor);

  // Energy & thermal load during active laser ablation (65% lower energy drain + direct Solar Corona & mineral energy harvesting!)
  const isSolarSiphon = bodyId === 'sun' || bodyId === 'solaris-nova';
  const batteryDrain = isSolarSiphon
    ? -26.0 * dt // Siphoning the Sun or Solaris-Nova directly recharges Ship Energy & Battery Bank rapidly!
    : (0.38 + prev.powerPips.weapons * 0.06) * dt;
  const radiatorMitigation = prev.radiatorsDeployed ? 0.42 : 1.0;
  const heatGain = (isSolarSiphon ? 5.2 : 3.6) * weaponsMult * radiatorMitigation * dt;

  let nextProgress = prev.mining.extractionProgress01 + extractionRatePerSec * dt;
  let minedUnitsThisTick = 0;
  let minedResourceId: MiningResourceId | null = null;
  const nextInventory = { ...prev.cargoInventory };
  let nextTotalMined = prev.totalMinedUnits;
  let minedEnergyBonusPct = 0;

  const activeRes =
    matchedHotspot?.resourceId ??
    prev.mining.activeResourceId ??
    profile.yields[0]?.resourceId ??
    'silicate-regolith';

  if (nextProgress >= 1) {
    const whole = Math.min(
      prev.cargoCapacityUnits - usedCargo,
      Math.floor(nextProgress)
    );
    if (whole > 0) {
      nextProgress -= whole;
      const seedRand = Math.abs(Math.sin(input.clockTime * 19.37 + nextTotalMined * 3.17)) % 1;
      const picked = pickMinedResourceForBody(bodyId, matchedHotspot, seedRand);
      nextInventory[picked] = (nextInventory[picked] ?? 0) + whole;
      nextTotalMined += whole;
      minedUnitsThisTick = whole;
      minedResourceId = picked;

      // Mining resources automatically channels thermoelectric/fusion energy into the ship's battery & Battery Bank!
      const energyYield = ENERGY_MINERAL_YIELDS[picked];
      if (energyYield) {
        minedEnergyBonusPct = energyYield.batteryPct * 0.48 * whole;
      } else {
        minedEnergyBonusPct = 6.0 * whole;
      }
    } else {
      nextProgress = 0.99;
    }
  }

  const resName = MINING_RESOURCES[minedResourceId ?? activeRes].name;
  const nextReactorTemp = Math.min(138, prev.reactorTempC + heatGain);
  const nextHullTemp = Math.min(115, prev.hullTempC + heatGain * 0.28);
  const rawMinedBattery = prev.batteryPercent - batteryDrain + minedEnergyBonusPct;
  const nextBattery = Math.max(0, Math.min(100, Number(rawMinedBattery.toFixed(2))));
  const bankOverflow = rawMinedBattery > 100 ? (rawMinedBattery - 100) * 0.85 : 0;
  const nextBatteryBank = Math.max(
    0,
    Math.min(100, Number(((prev.batteryBankPercent ?? 85) + bankOverflow).toFixed(2)))
  );

  return {
    state: {
      ...prev,
      batteryPercent: nextBattery,
      batteryBankPercent: nextBatteryBank,
      reactorTempC: Number(nextReactorTemp.toFixed(1)),
      hullTempC: Number(nextHullTemp.toFixed(1)),
      cargoInventory: nextInventory,
      totalMinedUnits: nextTotalMined,
      mining: {
        isActive: true,
        isDrilling: true,
        inRange: true,
        targetBodyId: bodyId,
        targetBodyName: bodyName,
        activeResourceId: minedResourceId ?? activeRes,
        activeHotspotLabel: matchedHotspot?.label ?? null,
        hotspotMultiplier: hotspotMult,
        surfaceDistanceRatio: Number(ratio.toFixed(2)),
        beamPowerKw,
        extractionRatePerSec: Number(extractionRatePerSec.toFixed(2)),
        extractionProgress01: Number(nextProgress.toFixed(3)),
        lastMinedResourceId: minedResourceId ?? prev.mining.lastMinedResourceId,
        statusMessage: isSolarSiphon
          ? `SIFÃO SOLAR ATIVO (+16%/s Energia): Coletando ${resName}...`
          : matchedHotspot
            ? `VEIO RICO (${hotspotMult.toFixed(1)}x): ${matchedHotspot.label} · ${resName}`
            : `Extraindo ${resName} de ${bodyName}...`,
      },
    },
    minedUnitsThisTick,
    minedResourceId,
    activeHotspot: matchedHotspot,
    effectiveColorHex,
  };
}

export function synthesizeRecipeAction(
  state: SurvivalResourcesState,
  recipeId: MiningRecipeId
): { ok: boolean; state: SurvivalResourcesState; message: string } {
  const recipe = MINING_RECIPES_BY_ID[recipeId];
  if (!recipe) {
    return { ok: false, state, message: 'Receita química desconhecida.' };
  }

  if (state.batteryPercent < recipe.energyCostPct) {
    return {
      ok: false,
      state,
      message: `Bateria insuficiente (requer ${recipe.energyCostPct}% para sintetizar).`,
    };
  }

  for (const ing of recipe.ingredients) {
    const owned = state.cargoInventory[ing.resourceId] ?? 0;
    if (owned < ing.amount) {
      const def = MINING_RESOURCES[ing.resourceId];
      return {
        ok: false,
        state,
        message: `Falta ${ing.amount - owned}x ${def.name} (${def.formula}).`,
      };
    }
  }

  const nextInventory = { ...state.cargoInventory };
  for (const ing of recipe.ingredients) {
    const nextQty = (nextInventory[ing.resourceId] ?? 0) - ing.amount;
    if (nextQty <= 0) {
      delete nextInventory[ing.resourceId];
    } else {
      nextInventory[ing.resourceId] = nextQty;
    }
  }

  const fx = recipe.effects;
  const coolingDrop = fx.coolingC ?? 0;
  const nextState: SurvivalResourcesState = {
    ...state,
    cargoInventory: nextInventory,
    batteryPercent: Math.min(
      100,
      Math.max(0, Number((state.batteryPercent - recipe.energyCostPct + (fx.battery ?? 0)).toFixed(1)))
    ),
    thirstPercent: Math.min(100, Number((state.thirstPercent + (fx.water ?? 0)).toFixed(1))),
    waterFlasks: Math.min(12, state.waterFlasks + (fx.waterFlasks ?? 0)),
    shipOxygenPercent: Math.min(100, Number((state.shipOxygenPercent + (fx.oxygen ?? 0)).toFixed(1))),
    evaOxygenPercent: Math.min(
      100,
      Number((state.evaOxygenPercent + (fx.oxygen ? fx.oxygen * 0.65 : 0)).toFixed(1))
    ),
    hungerPercent: Math.min(100, Number((state.hungerPercent + (fx.food ?? 0)).toFixed(1))),
    foodRations: Math.min(12, state.foodRations + (fx.foodRations ?? 0)),
    fuelPercent: Math.min(100, Number((state.fuelPercent + (fx.fuel ?? 0)).toFixed(1))),
    hullIntegrity: Math.min(100, Number((state.hullIntegrity + (fx.hull ?? 0)).toFixed(1))),
    repairKits: Math.min(10, state.repairKits + (fx.repairKits ?? 0)),
    warpCells: Math.min(12, state.warpCells + (fx.warpCells ?? 0)),
    warpEnergyPercent: Math.min(100, Number((state.warpEnergyPercent + (fx.warpEnergy ?? 0)).toFixed(1))),
    reactorTempC: coolingDrop > 0 ? Math.max(24, Number((state.reactorTempC - coolingDrop).toFixed(1))) : state.reactorTempC,
    hullTempC: coolingDrop > 0 ? Math.max(18, Number((state.hullTempC - coolingDrop * 0.7).toFixed(1))) : state.hullTempC,
    spaceCredits: state.spaceCredits + (fx.credits ?? 0),
  };

  return {
    ok: true,
    state: nextState,
    message: `Síntese concluída: ${recipe.outputSummary}`,
  };
}

export function sellCargoResourceAction(
  state: SurvivalResourcesState,
  resourceId: MiningResourceId,
  units = 1
): { ok: boolean; state: SurvivalResourcesState; earned: number; message: string } {
  const owned = state.cargoInventory[resourceId] ?? 0;
  if (owned <= 0) {
    return { ok: false, state, earned: 0, message: 'Sem unidades desse recurso no porão.' };
  }
  const qty = Math.min(owned, Math.max(1, units));
  const def = MINING_RESOURCES[resourceId];
  const bonusMult = state.nearRefuelSource === 'ORBITAL_STATION' ? 1.25 : 1.0;
  const earned = Math.round(def.creditValue * qty * bonusMult);
  const nextInventory = { ...state.cargoInventory };
  const rem = owned - qty;
  if (rem <= 0) delete nextInventory[resourceId];
  else nextInventory[resourceId] = rem;

  return {
    ok: true,
    earned,
    state: {
      ...state,
      cargoInventory: nextInventory,
      spaceCredits: state.spaceCredits + earned,
    },
    message: `Vendido ${qty}x ${def.name} por +${earned} CR${bonusMult > 1 ? ' (Bônus Doca +25%)' : ''}.`,
  };
}

export function sellAllCargoAction(
  state: SurvivalResourcesState
): { ok: boolean; state: SurvivalResourcesState; earned: number; message: string } {
  const bonusMult = state.nearRefuelSource === 'ORBITAL_STATION' ? 1.25 : 1.0;
  let totalEarned = 0;
  let totalSold = 0;

  for (const key of Object.keys(state.cargoInventory) as MiningResourceId[]) {
    const qty = state.cargoInventory[key] ?? 0;
    if (qty > 0) {
      totalSold += qty;
      totalEarned += Math.round(MINING_RESOURCES[key].creditValue * qty * bonusMult);
    }
  }

  if (totalSold === 0) {
    return { ok: false, state, earned: 0, message: 'Porão de mineração está vazio.' };
  }

  return {
    ok: true,
    earned: totalEarned,
    state: {
      ...state,
      cargoInventory: {},
      spaceCredits: state.spaceCredits + totalEarned,
    },
    message: `Carga vendida (${totalSold} un): +${totalEarned} Créditos Espaciais!`,
  };
}

export function discardCargoUnitAction(
  state: SurvivalResourcesState,
  resourceId: MiningResourceId,
  units = 1
): SurvivalResourcesState {
  const owned = state.cargoInventory[resourceId] ?? 0;
  if (owned <= 0) return state;
  const nextInventory = { ...state.cargoInventory };
  const rem = owned - units;
  if (rem <= 0) delete nextInventory[resourceId];
  else nextInventory[resourceId] = rem;
  return {
    ...state,
    cargoInventory: nextInventory,
  };
}

export function consumeMineralForEnergyAction(
  state: SurvivalResourcesState,
  resourceId: MiningResourceId
): { ok: boolean; state: SurvivalResourcesState; message: string } {
  const owned = state.cargoInventory[resourceId] ?? 0;
  if (owned <= 0) {
    return { ok: false, state, message: 'Sem unidades desse recurso no porão.' };
  }
  const energyYield = ENERGY_MINERAL_YIELDS[resourceId];
  const def = MINING_RESOURCES[resourceId];
  const nextInventory = { ...state.cargoInventory };
  const rem = owned - 1;
  if (rem <= 0) delete nextInventory[resourceId];
  else nextInventory[resourceId] = rem;

  const rawBattery = state.batteryPercent + energyYield.batteryPct;
  const nextBattery = Math.min(100, Number(rawBattery.toFixed(1)));
  const overflowPct = Math.max(0, rawBattery - 100);
  const addedToBank =
    state.batteryPercent >= 99
      ? energyYield.bankPct
      : Number((overflowPct * 0.8 + energyYield.bankPct * 0.35).toFixed(1));
  const nextBatteryBank = Math.min(
    100,
    Number(((state.batteryBankPercent ?? 85) + addedToBank).toFixed(1))
  );
  const nextWarp = Math.min(
    100,
    Number((state.warpEnergyPercent + (energyYield.warpPct ?? 0)).toFixed(1))
  );
  const nextFuel = Math.min(
    100,
    Number((state.fuelPercent + (energyYield.fuelPct ?? 0)).toFixed(1))
  );

  return {
    ok: true,
    state: {
      ...state,
      cargoInventory: nextInventory,
      batteryPercent: nextBattery,
      batteryBankPercent: nextBatteryBank,
      warpEnergyPercent: nextWarp,
      fuelPercent: nextFuel,
    },
    message: `${def.name} convertido: Energia ${Math.round(nextBattery)}% · Banco de Bateria ${Math.round(nextBatteryBank)}%`,
  };
}

export function transferBatteryBankToShipAction(
  state: SurvivalResourcesState
): { ok: boolean; state: SurvivalResourcesState; message: string } {
  const bank = state.batteryBankPercent ?? 0;
  if (bank <= 0.5) {
    return {
      ok: false,
      state,
      message: 'Banco de Baterias vazio — recarregue no Sol ou minere Hélio-3 / Enxofre / Titânio!',
    };
  }
  if (state.batteryPercent >= 99.5) {
    return {
      ok: false,
      state,
      message: 'Energia Principal da Nave já está em 100%! O Banco de Baterias está guardando a reserva.',
    };
  }
  const needed = 100 - state.batteryPercent;
  const bankUsed = Math.min(bank, needed * 0.65);
  const gained = Math.min(needed, bankUsed * 1.54);
  const nextBattery = Math.min(100, Number((state.batteryPercent + gained).toFixed(1)));
  const nextBank = Math.max(0, Number((bank - bankUsed).toFixed(1)));

  return {
    ok: true,
    state: {
      ...state,
      batteryPercent: nextBattery,
      batteryBankPercent: nextBank,
    },
    message: `Banco de Baterias transferiu +${Math.round(gained)}% para a Nave (Reserva no Banco: ${Math.round(nextBank)}%)`,
  };
}

/**
 * Combines 2 minerals from the cargo hold into a higher-rarity mineral + bonus Space Credits!
 */
export function fuseMineralsAction(
  state: SurvivalResourcesState,
  fusionId: string
): { ok: boolean; state: SurvivalResourcesState; message: string } {
  const recipe = MINERAL_FUSION_RECIPES.find((f) => f.id === fusionId);
  if (!recipe) {
    return { ok: false, state, message: 'Receita de fusão mineral desconhecida.' };
  }
  if (state.batteryPercent < recipe.energyCostPct) {
    return {
      ok: false,
      state,
      message: `Energia insuficiente para fusão (${recipe.energyCostPct}% necessária).`,
    };
  }
  for (const inp of recipe.inputs) {
    const owned = state.cargoInventory[inp.resourceId] ?? 0;
    if (owned < inp.amount) {
      const def = MINING_RESOURCES[inp.resourceId];
      return {
        ok: false,
        state,
        message: `Falta ${inp.amount - owned}x ${def.name} para fundir.`,
      };
    }
  }

  const nextInventory = { ...state.cargoInventory };
  for (const inp of recipe.inputs) {
    const rem = (nextInventory[inp.resourceId] ?? 0) - inp.amount;
    if (rem <= 0) delete nextInventory[inp.resourceId];
    else nextInventory[inp.resourceId] = rem;
  }
  nextInventory[recipe.outputResourceId] =
    (nextInventory[recipe.outputResourceId] ?? 0) + recipe.outputAmount;
  const outDef = MINING_RESOURCES[recipe.outputResourceId];

  return {
    ok: true,
    state: {
      ...state,
      cargoInventory: nextInventory,
      batteryPercent: Math.max(0, Number((state.batteryPercent - recipe.energyCostPct).toFixed(1))),
      spaceCredits: state.spaceCredits + recipe.bonusCredits,
    },
    message: `Fusão Concluída: +${recipe.outputAmount}x ${outDef.name} (${outDef.formula}) e +${recipe.bonusCredits} CR!`,
  };
}

/**
 * Upgrades a ship subsystem (Porão, Laser, Banco de Bateria, Canhão de Pulso [F], Motor de Dobra)
 * spending Space Credits (CR) and 1 required mineral for that tier.
 */
export function upgradeShipSystemAction(
  state: SurvivalResourcesState,
  systemId: ShipUpgradeSystemId
): { ok: boolean; state: SurvivalResourcesState; message: string } {
  const def = SHIP_UPGRADE_DEFINITIONS[systemId];
  const curUpgrades = state.shipUpgrades ?? {
    cargo: 1,
    laser: 1,
    batteryBank: 1,
    pulseCannon: 1,
    warpDrive: 1,
  };
  const curLevel = curUpgrades[systemId] ?? 1;
  if (curLevel >= def.maxLevel) {
    return { ok: false, state, message: `${def.name} já está no Nível Máximo (${def.maxLevel})!` };
  }

  const stepIndex = curLevel - 1;
  const creditCost = Math.round(def.baseCostCredits * Math.pow(1.55, stepIndex));
  const reqMineral =
    def.mineralRequirementPerLevel[
      Math.min(stepIndex, def.mineralRequirementPerLevel.length - 1)
    ];
  const reqDef = MINING_RESOURCES[reqMineral.resourceId];
  const ownedMineral = state.cargoInventory[reqMineral.resourceId] ?? 0;

  if (state.spaceCredits < creditCost) {
    return {
      ok: false,
      state,
      message: `Créditos insuficientes: requer ${creditCost} CR (você tem ${state.spaceCredits} CR).`,
    };
  }
  if (ownedMineral < reqMineral.amount) {
    return {
      ok: false,
      state,
      message: `Requer ${reqMineral.amount}x ${reqDef.name} (${reqDef.formula}) — minere ou crie na Fusão Mineral!`,
    };
  }

  const nextInventory = { ...state.cargoInventory };
  const rem = ownedMineral - reqMineral.amount;
  if (rem <= 0) delete nextInventory[reqMineral.resourceId];
  else nextInventory[reqMineral.resourceId] = rem;

  const nextLevel = curLevel + 1;
  const nextUpgrades = { ...curUpgrades, [systemId]: nextLevel };
  const nextCargoCap =
    systemId === 'cargo' ? 500 + (nextLevel - 1) * 450 : state.cargoCapacityUnits;

  return {
    ok: true,
    state: {
      ...state,
      spaceCredits: state.spaceCredits - creditCost,
      cargoInventory: nextInventory,
      cargoCapacityUnits: nextCargoCap,
      shipUpgrades: nextUpgrades,
      batteryPercent: systemId === 'batteryBank' ? 100 : state.batteryPercent,
      batteryBankPercent: systemId === 'batteryBank' ? 100 : state.batteryBankPercent,
    },
    message: `Upgrade Concluído: ${def.name} Nível ${nextLevel} (${def.getLevelBenefitLabel(nextLevel)})!`,
  };
}

/**
 * Completes an active Space Contract or SOS Rescue Mission, consuming the requested minerals and awarding CR + Warp Cells!
 */
export function completeSpaceContractAction(
  state: SurvivalResourcesState,
  contractId: string
): { ok: boolean; state: SurvivalResourcesState; message: string } {
  const contract = SPACE_CONTRACTS.find((c) => c.id === contractId);
  if (!contract) {
    return { ok: false, state, message: 'Contrato espacial não encontrado.' };
  }
  for (const req of contract.requirements) {
    const owned = state.cargoInventory[req.resourceId] ?? 0;
    if (owned < req.amount) {
      const def = MINING_RESOURCES[req.resourceId];
      return {
        ok: false,
        state,
        message: `Falta ${req.amount - owned}x ${def.name} para concluir "${contract.title}".`,
      };
    }
  }

  const nextInventory = { ...state.cargoInventory };
  for (const req of contract.requirements) {
    const rem = (nextInventory[req.resourceId] ?? 0) - req.amount;
    if (rem <= 0) delete nextInventory[req.resourceId];
    else nextInventory[req.resourceId] = rem;
  }

  const completed = state.completedContractIds ?? [];
  const nextCompleted = completed.includes(contractId) ? completed : [...completed, contractId];

  return {
    ok: true,
    state: {
      ...state,
      cargoInventory: nextInventory,
      spaceCredits: state.spaceCredits + contract.rewardCredits,
      warpCells: Math.min(12, state.warpCells + (contract.rewardWarpCells ?? 0)),
      warpEnergyPercent: Math.min(100, state.warpEnergyPercent + 35),
      completedContractIds: nextCompleted,
    },
    message: `Missão Concluída (${contract.title}): +${contract.rewardCredits} CR${
      contract.rewardWarpCells ? ` e +${contract.rewardWarpCells} Célula(s) de Dobra` : ''
    }!`,
  };
}
