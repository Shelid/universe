export type BodyCategory =
  | 'star'
  | 'planet'
  | 'dwarf_planet'
  | 'moon'
  | 'asteroid'
  | 'comet'
  | 'galaxy';

export type PlanetSubType =
  | 'g2v_main_sequence'
  | 'terrestrial'
  | 'gas_giant'
  | 'ice_giant'
  | 'dwarf_planet'
  | 'natural_satellite'
  | 'asteroid'
  | 'comet'
  | 'kuiper_belt_object'
  | 'galaxy_spiral'
  | 'galaxy_barred'
  | 'galaxy_elliptical'
  | 'galaxy_irregular';

export type EpistemicCertainty =
  | 'DIRECT_MEASUREMENT'
  | 'MODEL_INFERRED'
  | 'HYPOTHESIS_UNCERTAIN';

export type ZoomLevel =
  | 'SOLAR_SYSTEM'       // Nível 1: Sistema Solar
  | 'PLANETARY_APPROACH' // Nível 2: Aproximação do Planeta
  | 'ORBITAL_EXPLORATION'// Nível 3: Exploração Orbital (Luas, Sondas, Satélites)
  | 'SURFACE_EXPLORATION'// Nível 4: Exploração da Superfície
  | 'COSMIC_GALAXY';     // Nível 5: Escala Galáctica & Universo Profundo

export type ScaleMode =
  | 'EXPLORATION'            // Escala visual adaptada para exploração fluida
  | 'TRUE_SIZES'             // Proporção real de tamanhos entre planetas
  | 'PROPORTIONAL_DISTANCES' // Distâncias orbitais proporcionais em UA
  | 'TRUE_1_TO_1';           // Escala física 1:1 (distâncias e diâmetros reais na mesma unidade)

export interface KeplerianElements {
  /** Semi-major axis in AU (for heliocentric) or km (for planetocentric moons) */
  semiMajorAxisAU: number;
  /** Orbital eccentricity (0 = circle, <1 = ellipse) */
  eccentricity: number;
  /** Inclination to the ecliptic (or parent equator) in degrees */
  inclinationDeg: number;
  /** Longitude of ascending node (Ω) in degrees (J2000) */
  longitudeOfAscendingNodeDeg: number;
  /** Argument of perihelion (ω) in degrees (J2000) */
  argumentOfPerihelionDeg: number;
  /** Mean anomaly at J2000 epoch (M0) in degrees */
  meanAnomalyAtEpochDeg: number;
  /** Sidereal orbital period in Earth days */
  orbitalPeriodDays: number;
  /** Mean orbital velocity in km/s */
  meanOrbitalVelocityKmS: number;
}

export interface InteriorLayer {
  id: string;
  name: string;
  /** Outer radius fraction (0.0 to 1.0) of the body's radius */
  outerRadiusRatio: number;
  /** Inner radius fraction (0.0 to 1.0) */
  innerRadiusRatio: number;
  /** Depth or thickness range description (e.g., "0 – 35 km" or "3.480 – 6.371 km") */
  depthRangeKm: string;
  /** Hex color for 3D cross-section rendering */
  colorHex: string;
  /** Secondary accent/glow hex for shader detail */
  secondaryColorHex: string;
  /** Temperature range in this layer */
  temperatureRange: string;
  /** Pressure range in this layer */
  pressureRange: string;
  /** Physical state (Solid, Liquid, Metallic Fluid, Supercritical Ionized Fluid, etc.) */
  physicalState: string;
  /** Primary chemical composition */
  composition: string;
  /** Epistemic classification required by strict scientific integrity */
  certainty: EpistemicCertainty;
  /** Detailed explanation of how scientists know this and what uncertainties remain */
  scientificExplanation: string;
  /** Method of investigation (e.g., "Tomografia Sísmica", "Harmônicos Gravitacionais da Juno") */
  investigationMethod: string;
}

export interface AtmosphericGas {
  formula: string;
  name: string;
  percentage: number;
  displayPercentage: string;
  colorHex: string;
}

export interface AtmosphereData {
  hasAtmosphere: boolean;
  surfacePressureBars: string;
  scaleHeightKm: string;
  windSpeedMaxKmH: string;
  weatherPhenomena: string[];
  composition: AtmosphericGas[];
  scientificNotes: string;
}

export interface SurfaceLandmark {
  id: string;
  name: string;
  type: 'crater' | 'volcano' | 'canyon' | 'rover_site' | 'mountain' | 'ocean_basin' | 'region' | 'spaceport' | 'cryovolcano';
  latitudeDeg: number;
  longitudeDeg: number;
  elevationKm?: string;
  diameterKm?: string;
  description: string;
  scientificSource: string;
  missionAssociated?: string;
}

export interface ScientificImage {
  url: string;
  title: string;
  caption: string;
  credit: string;
  instrumentOrMission: string;
  dateTaken: string;
  isRealObservation: boolean; // True = real photograph/radar; False = scientific model diagram
  licenseNote: string;
}

export interface ScientificSource {
  id: string;
  institution: string;
  datasetName: string;
  url: string;
  lastUpdated: string;
  limitations: string;
}

export interface RingBandDetail {
  name: string;
  innerRadiusKm: number;
  outerRadiusKm: number;
  widthKm: number;
  opticalDepth: string;
  particleComposition: string;
  description: string;
}

export interface CelestialBodyData {
  id: string;
  name: string;
  englishName: string;
  category: BodyCategory;
  subType: PlanetSubType;
  ClassificationLabel: string;
  parentId: string | null; // null for Sun, 'sun' for planets, planet id for moons
  tagline: string;
  summary: string;

  // Physical Parameters (Real NASA JPL Planetary Fact Sheet values)
  equatorialRadiusKm: number;
  meanRadiusKm: number;
  massKg: string;
  massRelativeToEarth: string;
  meanDensityGcm3: number;
  surfaceGravityMs2: number;
  surfaceGravityG: number;
  escapeVelocityKmS: number;
  siderealRotationHours: number; // Negative = retrograde rotation
  rotationPeriodFormatted: string;
  solarDayHours: string;
  axialTiltDeg: number;
  albedoGeometric: number;
  temperatureMeanC: string;
  temperatureRangeC: string;
  distanceFromSunMeanKm: string;
  distanceFromSunAU: number;
  perihelionKm: string;
  aphelionKm: string;
  knownMoonsCount: number;
  hasRings: boolean;

  // Visual & Shader Configuration
  visualRadiusExploration: number; // Base radius in Exploration Scale mode
  explorationDistanceUnits: number; // Base orbital distance in Exploration Scale mode
  primaryColorHex: string;
  secondaryColorHex: string;
  atmosphereColorHex: string;
  orbitColorHex: string;
  textureUrls?: {
    diffuse?: string;
    bump?: string;
    clouds?: string;
    nightLights?: string;
    ringAlpha?: string;
  };
  shaderType:
    | 'sun'
    | 'mercury'
    | 'venus'
    | 'earth'
    | 'mars'
    | 'jupiter'
    | 'saturn'
    | 'uranus'
    | 'neptune'
    | 'pluto'
    | 'ceres'
    | 'moon_rocky'
    | 'moon_icy'
    | 'moon_volcanic'
    | 'moon_titan'
    | 'galaxy';

  // Orbital mechanics
  orbit: KeplerianElements;

  // Detailed sections
  atmosphere: AtmosphereData;
  interiorLayers: InteriorLayer[];
  landmarks: SurfaceLandmark[];
  ringDetails?: RingBandDetail[];
  majorMoonIds: string[];
  relatedMissionIds: string[];
  scientificCuriosities: string[];
  images: ScientificImage[];
  sources: ScientificSource[];
}

export type SatelliteCategory =
  | 'SPACE_STATIONS'
  | 'TELESCOPES'
  | 'EARTH_OBSERVATION'
  | 'WEATHER'
  | 'COMMUNICATIONS';

export interface SatelliteRecord {
  id: string;
  noradId: number;
  name: string;
  category: SatelliteCategory;
  categoryLabel: string;
  agency: string;
  launchYear: number;
  purpose: string;
  scientificDescription: string;
  orbitType: string; // e.g., "LEO (Órbita Terrestre Baixa)", "GEO (Geoestacionária)", "SSO (Heliossíncrona)"
  tleLine1: string;
  tleLine2: string;
  tleEpochIso: string;
  sourceName: string;
  colorHex: string;
}

export interface PropagatedSatellite extends SatelliteRecord {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  velocityKmS: number;
  inclinationDeg: number;
  periodMinutes: number;
  /** 3D position in Earth-local scene coordinates (normalized to Earth radius = 1) */
  position3D: [number, number, number];
  /** Pre-computed orbit path points in Earth-local scene coordinates */
  orbitTrack3D: [number, number, number][];
}

export interface MissionTrajectoryPoint {
  dateIso: string;
  label?: string;
  /** Heliocentric coordinates in AU (X, Y, Z in ecliptic plane) */
  positionAU: [number, number, number];
}

export interface SpaceMission {
  id: string;
  name: string;
  agency: string;
  launchDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXTENDED_INTERSTELLAR';
  statusLabel: string;
  targetBodyIds: string[];
  primaryTargetName: string;
  missionType: 'flyby' | 'orbiter' | 'rover' | 'space_telescope' | 'solar_probe';
  objective: string;
  keyDiscoveries: string[];
  instruments: string[];
  currentDistanceFromSunAU: number;
  colorHex: string;
  trajectoryPointsAU: MissionTrajectoryPoint[];
  imageUrl: string;
  imageCredit: string;
  sourceReference: string;
}

export interface WarpFlightState {
  isActive: boolean;
  originId: string;
  targetId: string;
  targetName: string;
  progress: number; // 0.0 to 1.0
  stage:
    | 'IDLE'
    | 'DEPARTURE'
    | 'ALIGNMENT'
    | 'STAR_STREAKS'
    | 'WARP_TUNNEL'
    | 'DECELERATION'
    | 'ARRIVAL';
  stageLabel: string;
  speedMultiplier: 1 | 2 | 5;
  isPaused: boolean;
  distanceAU: number;
  distanceKm: number;
  lightTravelTimeFormatted: string;
  apparentSpeedC: number;
}

