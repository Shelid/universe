import { CelestialBodyData, ScaleMode } from '../types/astronomy';
import { SUN_AND_PLANETS } from './solarSystemPlanets';
import { MOONS_AND_DWARF_PLANETS } from './solarSystemMoonsAndDwarfs';
import { COSMIC_GALAXIES, MISSING_DWARF_PLANETS_AND_WORLDS } from './galaxiesData';
import { EXTRA_SOLAR_SYSTEM_BODIES } from './extraSolarSystemBodies';

export const ALL_CELESTIAL_BODIES: CelestialBodyData[] = [
  ...SUN_AND_PLANETS,
  ...MOONS_AND_DWARF_PLANETS,
  ...MISSING_DWARF_PLANETS_AND_WORLDS,
  ...EXTRA_SOLAR_SYSTEM_BODIES,
  ...COSMIC_GALAXIES,
];

export const CELESTIAL_BODIES_BY_ID: Record<string, CelestialBodyData> = Object.fromEntries(
  ALL_CELESTIAL_BODIES.map((body) => [body.id, body])
);

export function getCelestialBody(id: string): CelestialBodyData {
  return CELESTIAL_BODIES_BY_ID[id] || CELESTIAL_BODIES_BY_ID['earth'];
}

export function getChildMoons(parentId: string): CelestialBodyData[] {
  return ALL_CELESTIAL_BODIES.filter((b) => b.parentId === parentId && b.category === 'moon');
}

export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // 2000-01-01T12:00:00Z

/**
 * Returns the visual radius in 3D scene units for a given body and ScaleMode.
 */
export function getScaledRadius(body: CelestialBodyData, scaleMode: ScaleMode): number {
  if (body.category === 'galaxy') {
    // True Hierarchical Multi-Scale Galactic Radii:
    // Milky Way has radius 1,800 units (diameter 3,600 units = 105,700 ly), completely encompassing the Solar System!
    switch (body.id) {
      case 'milky-way':
        return 1800.0;
      case 'large-magellanic-cloud':
        return 380.0;
      case 'andromeda':
        return 2200.0;
      case 'triangulum':
        return 950.0;
      case 'whirlpool-galaxy':
        return 1350.0;
      case 'sombrero-galaxy':
        return 1450.0;
      case 'm87-galaxy':
        return 2600.0;
      default:
        return 1200.0;
    }
  }
  switch (scaleMode) {
    case 'EXPLORATION':
      return body.visualRadiusExploration;
    case 'TRUE_SIZES': {
      // Earth radius = 0.65 scene units. Sun is capped at 14 units (with note) or proportional
      const earthRadiusKm = 6371.0;
      if (body.id === 'sun') return 7.5; // Sun in true planet ratio would be 71 units, overlapping inner orbits
      return Math.max(0.08, (body.meanRadiusKm / earthRadiusKm) * 0.55);
    }
    case 'PROPORTIONAL_DISTANCES':
      return body.visualRadiusExploration * 0.85;
    case 'TRUE_1_TO_1': {
      // 1 scene unit = 1,000,000 km -> Earth is 0.006371 units, Sun is 0.696 units, 1 AU is 149.6 units
      return Math.max(0.004, body.meanRadiusKm / 1_000_000);
    }
  }
}

/**
 * Returns the orbital semi-major axis in 3D scene units for a given body and ScaleMode.
 */
export function getScaledOrbitalRadius(body: CelestialBodyData, scaleMode: ScaleMode): number {
  if (body.id === 'sun') return 0;
  if (body.category === 'galaxy') return body.explorationDistanceUnits;

  if (body.category === 'moon' && body.parentId) {
    const parent = getCelestialBody(body.parentId);
    const parentRadius = getScaledRadius(parent, scaleMode);
    if (scaleMode === 'TRUE_1_TO_1') {
      const distKm = body.orbit.semiMajorAxisAU * 149_597_870.7;
      return Math.max(parentRadius * 1.4, distKm / 1_000_000);
    }
    return parentRadius * 1.35 + body.explorationDistanceUnits;
  }

  switch (scaleMode) {
    case 'EXPLORATION':
    case 'TRUE_SIZES':
      return body.explorationDistanceUnits;
    case 'PROPORTIONAL_DISTANCES': {
      // 1 AU = 22 scene units + Sun offset of 8 units
      return 8.0 + body.orbit.semiMajorAxisAU * 18.0;
    }
    case 'TRUE_1_TO_1': {
      // 1 scene unit = 1,000,000 km => 1 AU = 149.59787 units
      return body.orbit.semiMajorAxisAU * 149.59787;
    }
  }
}

/**
 * Solves Kepler's Equation M = E - e * sin(E) using Newton-Raphson iteration
 * and returns the 3D position [x, y, z] in scene units for a given timestamp (ms UTC) and ScaleMode.
 */
export function computeKeplerianPosition3D(
  body: CelestialBodyData,
  timeMs: number,
  scaleMode: ScaleMode
): [number, number, number] {
  if (body.id === 'sun') return [0, 0, 0];

  // Galaxies occupy vast cosmological positions in the Local Group and Virgo Supercluster.
  // Crucially, the Milky Way's center (Sagittarius A*) is offset to [+909.0, -21.6, -297.0]
  // so that its Orion Arm Solar System landmark ([-0.505, 0.012, 0.165] * 1800) lands at [0, 0, 0] —
  // the exact 3D position of our Sun and Solar System!
  if (body.category === 'galaxy') {
    switch (body.id) {
      case 'milky-way':
        return [909.0, -21.6, -297.0];
      case 'large-magellanic-cloud':
        return [2450.0, -1180.0, 780.0]; // LMC (163.000 ly)
      case 'andromeda':
        return [7400.0, 2600.0, -5600.0]; // M31 (2,5 Milhões de ly)
      case 'triangulum':
        return [8600.0, 1950.0, -4400.0]; // M33 (2,7 Milhões de ly)
      case 'whirlpool-galaxy':
        return [-11800.0, 4800.0, 8200.0]; // M51 (23 Milhões de ly)
      case 'sombrero-galaxy':
        return [13600.0, -5200.0, 9800.0]; // M104 (31 Milhões de ly)
      case 'm87-galaxy':
        return [-17200.0, 8800.0, -12600.0]; // M87 no Aglomerado de Virgem (53 Milhões de ly)
      default:
        return [6500.0, 1500.0, 6500.0];
    }
  }

  const daysSinceJ2000 = (timeMs - J2000_EPOCH_MS) / 86_400_000;
  const {
    eccentricity: e,
    inclinationDeg,
    longitudeOfAscendingNodeDeg,
    argumentOfPerihelionDeg,
    meanAnomalyAtEpochDeg,
    orbitalPeriodDays,
  } = body.orbit;

  const a = getScaledOrbitalRadius(body, scaleMode);
  if (orbitalPeriodDays === 0 || a === 0) return [0, 0, 0];

  const degToRad = Math.PI / 180;
  const meanMotionDegPerDay = 360.0 / orbitalPeriodDays;
  let M = (meanAnomalyAtEpochDeg + meanMotionDegPerDay * daysSinceJ2000) % 360.0;
  if (M < 0) M += 360.0;
  const M_rad = M * degToRad;

  // Solve E - e*sin(E) = M via Newton-Raphson
  let E = M_rad;
  for (let i = 0; i < 7; i++) {
    const dE = (E - e * Math.sin(E) - M_rad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-7) break;
  }

  // Heliocentric/parentocentric coordinates in the orbital plane
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);

  const v = Math.atan2(yv, xv); // True anomaly
  const r = Math.sqrt(xv * xv + yv * yv);

  const i_rad = inclinationDeg * degToRad;
  const omega_rad = argumentOfPerihelionDeg * degToRad;
  const Omega_rad = longitudeOfAscendingNodeDeg * degToRad;

  // Convert from orbital plane to 3D ecliptic coordinates (Y is up in Three.js, X-Z is ecliptic plane)
  const u = v + omega_rad;
  const xEcliptic =
    r * (Math.cos(Omega_rad) * Math.cos(u) - Math.sin(Omega_rad) * Math.sin(u) * Math.cos(i_rad));
  const zEcliptic =
    r * (Math.sin(Omega_rad) * Math.cos(u) + Math.cos(Omega_rad) * Math.sin(u) * Math.cos(i_rad));
  const yEcliptic = r * (Math.sin(u) * Math.sin(i_rad));

  // If this body is a moon, add its parent planet's 3D position
  if (body.category === 'moon' && body.parentId) {
    const parent = getCelestialBody(body.parentId);
    const [px, py, pz] = computeKeplerianPosition3D(parent, timeMs, scaleMode);
    return [px + xEcliptic, py + yEcliptic, pz + zEcliptic];
  }

  return [xEcliptic, yEcliptic, zEcliptic];
}

/**
 * Generates an array of 3D points representing the complete closed Keplerian ellipse
 * of a body around its parent (or around the origin if local).
 */
export function generateKeplerianOrbitCurvePoints(
  body: CelestialBodyData,
  scaleMode: ScaleMode,
  segments = 180
): [number, number, number][] {
  if (body.id === 'sun' || body.category === 'galaxy') return [];

  const a = getScaledOrbitalRadius(body, scaleMode);
  const {
    eccentricity: e,
    inclinationDeg,
    longitudeOfAscendingNodeDeg,
    argumentOfPerihelionDeg,
  } = body.orbit;

  const degToRad = Math.PI / 180;
  const i_rad = inclinationDeg * degToRad;
  const omega_rad = argumentOfPerihelionDeg * degToRad;
  const Omega_rad = longitudeOfAscendingNodeDeg * degToRad;

  const points: [number, number, number][] = [];
  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * Math.PI * 2;
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);

    const u = v + omega_rad;
    const x =
      r * (Math.cos(Omega_rad) * Math.cos(u) - Math.sin(Omega_rad) * Math.sin(u) * Math.cos(i_rad));
    const z =
      r * (Math.sin(Omega_rad) * Math.cos(u) + Math.cos(Omega_rad) * Math.sin(u) * Math.cos(i_rad));
    const y = r * (Math.sin(u) * Math.sin(i_rad));
    points.push([x, y, z]);
  }
  return points;
}

