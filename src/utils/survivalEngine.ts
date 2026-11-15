import {
  BodyCategory,
  CabinStationId,
  PowerPips,
  PowerSubsystemId,
  RefuelSourceKind,
  SpacecraftVariantId,
  SurvivalResourcesState,
} from '../types/astronomy';

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
    warpEnergyPercent: 100,
    warpCells: 4,
    maxWarpCells: 6,
    batteryPercent: 100,
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

  // Ship preset efficiency factors
  const fuelEfficiency =
    p.shipVariantId === 'aegis-titan' ? 0.78 : p.shipVariantId === 'xr9-phantom' ? 1.12 : 1.0;
  const warpEfficiency = p.shipVariantId === 'aegis-titan' ? 0.74 : 1.0;

  if (p.mode === 'HANGAR') {
    return {
      ...state,
      fuelPercent: 100,
      warpEnergyPercent: 100,
      warpCells: Math.max(state.warpCells, 4),
      batteryPercent: 100,
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
  } else if (p.sunDistanceUnits < 32 && !p.inPlanetaryShadow) {
    refuelSource = 'SOLAR_CORONA';
  }

  // 2. Solar irradiance & planetary shadow physics
  const solarFluxKw = p.inPlanetaryShadow
    ? 2
    : Math.min(180, Math.max(4, 180 / Math.pow(Math.max(1, p.sunDistanceUnits / 24), 1.35)));

  const lifePips = state.powerPips.lifeSupport;
  const shieldPips = state.powerPips.shields;
  const engPips = state.powerPips.engines;
  const weapPips = state.powerPips.weapons;

  // 3. Fuel & Warp Drive drain during active flight
  if (p.mode === 'SPACECRAFT') {
    const absThr = Math.abs(p.throttle);
    const ecoMult = state.ecoCruiseMode ? 0.52 : 1.0;
    const thrustBurnRate =
      (absThr * 0.24 + (p.isBraking ? 0.14 : 0) + (p.rcsActive ? 0.05 : 0)) *
      ecoMult *
      fuelEfficiency;
    fuel -= thrustBurnRate * dt;

    if (p.boostActive) {
      warpEnergy -= 2.4 * ecoMult * warpEfficiency * dt;
      fuel -= 0.09 * ecoMult * fuelEfficiency * dt;
    } else {
      // Trickle recharge warp capacitor from reactor + solar when cruising sub-warp
      const warpRegen = 0.45 + (solarFluxKw > 40 ? 1.1 : 0) + engPips * 0.18;
      warpEnergy = Math.min(100, warpEnergy + warpRegen * dt);
    }
  } else if (p.mode === 'EXPLORE') {
    // Calm idle maintenance in observatory mode
    warpEnergy = Math.min(100, warpEnergy + 0.8 * dt);
  }

  // 4. Natural/Station Resupply
  if (refuelSource === 'ORBITAL_STATION') {
    fuel = Math.min(100, fuel + 12 * dt);
    shipO2 = Math.min(100, shipO2 + 18 * dt);
    evaO2 = Math.min(100, evaO2 + 25 * dt);
    battery = Math.min(100, battery + 20 * dt);
    warpEnergy = Math.min(100, warpEnergy + 15 * dt);
  } else if (refuelSource === 'GAS_GIANT_SCOOP') {
    // Atmospheric hydrogen / He-3 harvesting near Jupiter/Saturn/Uranus/Neptune!
    fuel = Math.min(100, fuel + 5.8 * dt);
    warpEnergy = Math.min(100, warpEnergy + 4.2 * dt);
  } else if (refuelSource === 'SOLAR_CORONA') {
    battery = Math.min(100, battery + 14 * dt);
    warpEnergy = Math.min(100, warpEnergy + 5.5 * dt);
  }

  // 5. Battery & Power Load Balance
  const batteryGen = solarFluxKw * 0.065 + (fuel > 1 ? 1.4 : 0.15);
  const batteryLoad =
    0.25 +
    (p.shieldsOn ? 0.55 + shieldPips * 0.14 : 0) +
    (p.headlightsOn ? 0.18 : 0) +
    lifePips * 0.22 +
    weapPips * 0.08 +
    (p.boostActive ? 1.2 : 0);
  battery = clampPct(battery + (batteryGen - batteryLoad) * dt);

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
    warpEnergyPercent: 100,
    batteryPercent: Math.min(100, Number((state.batteryPercent + 25).toFixed(1))),
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
