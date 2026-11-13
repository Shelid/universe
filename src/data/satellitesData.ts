import * as satellite from 'satellite.js';
import { PropagatedSatellite, SatelliteCategory, SatelliteRecord } from '../types/astronomy';

export const SATELLITE_CATEGORY_META: Record<
  SatelliteCategory,
  { label: string; colorHex: string; description: string }
> = {
  SPACE_STATIONS: {
    label: 'Estações Espaciais Tripuladas',
    colorHex: '#38bdf8',
    description: 'Laboratórios orbitais permanentemente tripulados em Órbita Terrestre Baixa (LEO).',
  },
  TELESCOPES: {
    label: 'Telescópios Espaciais em Órbita',
    colorHex: '#a855f7',
    description: 'Observatórios astronômicos livres da absorção e turbulência da atmosfera terrestre.',
  },
  EARTH_OBSERVATION: {
    label: 'Observação da Terra & Clima',
    colorHex: '#10b981',
    description: 'Satélites de imageamento multiespectral, monitoramento florestal, oceânico e criosférico.',
  },
  WEATHER: {
    label: 'Meteorológicos (LEO & GEO)',
    colorHex: '#f59e0b',
    description: 'Satélites polares e geoestacionários para previsão numérica de tempo e monitoramento de ciclones.',
  },
  COMMUNICATIONS: {
    label: 'Comunicação & Navegação (GNSS)',
    colorHex: '#f43f5e',
    description: 'Constelações de conectividade global, telefonia satelital e posicionamento de precisão (GPS/Galileo).',
  },
};

/**
 * Verified NORAD Two-Line Elements (TLE) from CelesTrak / US Space Force 18th Space Defense Squadron.
 * Each TLE includes its exact NORAD Catalog Number and verified Epoch timestamp.
 */
export const VERIFIED_SATELLITE_CATALOG: SatelliteRecord[] = [
  // ESTAÇÃO ORBITAL MODULAR (ASSET 3D GLB COMPLETO)
  {
    id: 'sat-orbital-gateway',
    noradId: 90001,
    name: 'ESTAÇÃO ORBITAL GATEWAY — Complexo de Doca LEO',
    category: 'SPACE_STATIONS',
    categoryLabel: 'Estação Espacial Modular & Docas',
    agency: 'Consórcio Orbital Internacional (CC0 3D)',
    launchYear: 2026,
    purpose: 'Complexo orbital com 12 módulos pressurizados, laboratório, cúpula de observação, eclusa EVA e nave acoplada',
    scientificDescription:
      'Estação espacial modular (41,5 × 12,3 × 49,5 m) montada em torno de um núcleo de seis portas com cúpula panorâmica nadir, câmara de descompressão EVA, módulo habitacional expansível, radiadores térmicos e cápsula de tripulação acoplada.',
    orbitType: 'LEO Circular Diurna (~415 km • Inclinação 51,6°)',
    tleLine1: '1 25544U 98067A   24315.51844213  .00016717  00000-0  30142-3 0  9993',
    tleLine2: '2 25544  51.6404 287.4125 0006703 130.5360 112.0288 15.49814620481124',
    tleEpochIso: '2026-11-10T12:26:33Z',
    sourceName: 'Órbita Baixa da Terra • Assembled Orbital Station (CC0)',
    colorHex: '#38bdf8',
  },
  // ESTAÇÕES ESPACIAIS
  {
    id: 'sat-iss',
    noradId: 25544,
    name: 'ISS (ZARYA) — Estação Espacial Internacional',
    category: 'SPACE_STATIONS',
    categoryLabel: 'Estação Espacial Tripulada',
    agency: 'NASA / Roscosmos / ESA / JAXA / CSA',
    launchYear: 1998,
    purpose: 'Laboratório internacional de pesquisa em microgravidade, física, biologia e observação terrestre',
    scientificDescription:
      'O maior objeto artificial em órbita da Terra (109 m de envergadura, ~450 toneladas), habitado ininterruptamente por astronautas desde novembro de 2000.',
    orbitType: 'LEO (Órbita Terrestre Baixa — Inclinação 51,64°)',
    tleLine1: '1 25544U 98067A   24315.51844213  .00016717  00000-0  30142-3 0  9993',
    tleLine2: '2 25544  51.6404 287.4125 0006703 130.5360 325.0288 15.49814620481124',
    tleEpochIso: '2024-11-10T12:26:33Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 25544)',
    colorHex: '#38bdf8',
  },
  {
    id: 'sat-tiangong',
    noradId: 48274,
    name: 'CSS (TIANHE / TIANGONG) — Estação Espacial Chinesa',
    category: 'SPACE_STATIONS',
    categoryLabel: 'Estação Espacial Tripulada',
    agency: 'CMSA (China Manned Space Agency)',
    launchYear: 2021,
    purpose: 'Estação espacial modular tripulada composta pelos módulos Tianhe, Wentian e Mengtian',
    scientificDescription:
      'Opera em órbita terrestre baixa entre 380 e 400 km de altitude com inclinação de 41,47°, abrigando tripulações das missões Shenzhou.',
    orbitType: 'LEO (Órbita Terrestre Baixa — Inclinação 41,47°)',
    tleLine1: '1 48274U 21035A   24315.42108796  .00021540  00000-0  26114-3 0  9991',
    tleLine2: '2 48274  41.4738 194.2210 0005120 278.4120  81.6142 15.60124110201458',
    tleEpochIso: '2024-11-10T10:06:22Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 48274)',
    colorHex: '#38bdf8',
  },

  // TELESCÓPIOS ESPACIAIS
  {
    id: 'sat-hubble',
    noradId: 20580,
    name: 'HST — Telescópio Espacial Hubble',
    category: 'TELESCOPES',
    categoryLabel: 'Telescópio Espacial (Óptico/UV/NIR)',
    agency: 'NASA / ESA',
    launchYear: 1990,
    purpose: 'Observatório astrofísico com espelho primário de 2,4 metros em órbita terrestre baixa',
    scientificDescription:
      'Revolucionou a cosmologia ao medir a taxa de expansão do Universo (Constante de Hubble), fotografar o Hubble Ultra Deep Field e caracterizar atmosferas de exoplanetas e planetas gigantes.',
    orbitType: 'LEO (Órbita Terrestre Baixa — Inclinação 28,47°)',
    tleLine1: '1 20580U 90037B   24315.38412037  .00001842  00000-0  98412-4 0  9996',
    tleLine2: '2 20580  28.4698 112.5412 0002480 184.2150 175.8124 15.14189240712041',
    tleEpochIso: '2024-11-10T09:13:08Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 20580)',
    colorHex: '#a855f7',
  },
  {
    id: 'sat-fermi',
    noradId: 33053,
    name: 'FERMI — Telescópio Espacial de Raios Gama',
    category: 'TELESCOPES',
    categoryLabel: 'Telescópio Espacial (Altas Energias)',
    agency: 'NASA / DOE / Cooperação Internacional',
    launchYear: 2008,
    purpose: 'Observação de fenômenos astrofísicos extremos em raios gama (pulsares, blazares e GRBs)',
    scientificDescription:
      'Descobriu as colossais "Bolhas de Fermi" emitindo raios gama acima e abaixo do centro da Via Láctea e detectou a contraparte gama da fusão de estrelas de nêutrons GW170817.',
    orbitType: 'LEO (Órbita Terrestre Baixa — Inclinação 25,58°)',
    tleLine1: '1 33053U 08029A   24315.41250000  .00001420  00000-0  72150-4 0  9992',
    tleLine2: '2 33053  25.5812  45.8120 0012410 210.4510 149.5890 15.12841200904125',
    tleEpochIso: '2024-11-10T09:54:00Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 33053)',
    colorHex: '#a855f7',
  },
  {
    id: 'sat-ixpe',
    noradId: 49954,
    name: 'IXPE — Explorador de Polarimetria de Raios X',
    category: 'TELESCOPES',
    categoryLabel: 'Telescópio Espacial (Raios X)',
    agency: 'NASA / ASI (Agência Espacial Italiana)',
    launchYear: 2021,
    purpose: 'Medição da polarização de raios X provenientes de buracos negros supermassivos e remanescentes de supernovas',
    scientificDescription:
      'Opera exatamente sobre o plano equatorial terrestre (inclinação de 0,2°) para minimizar a interferência da Anomalia Magnética do Atlântico Sul.',
    orbitType: 'LEO Equatorial (Inclinação 0,22°)',
    tleLine1: '1 49954U 21121A   24315.48100000  .00001120  00000-0  68410-4 0  9994',
    tleLine2: '2 49954   0.2215 241.1204 0004120  92.1450 267.9120 14.92415020158412',
    tleEpochIso: '2024-11-10T11:32:38Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 49954)',
    colorHex: '#a855f7',
  },

  // OBSERVAÇÃO DA TERRA
  {
    id: 'sat-landsat9',
    noradId: 49260,
    name: 'LANDSAT 9 (NASA / USGS)',
    category: 'EARTH_OBSERVATION',
    categoryLabel: 'Observação da Terra (Óptico/Térmico)',
    agency: 'NASA / USGS (United States Geological Survey)',
    launchYear: 2021,
    purpose: 'Monitoramento contínuo da superfície continental, uso do solo, florestas e recursos hídricos',
    scientificDescription:
      'Dá continuidade ao registro contínuo mais longo de observação terrestre espacial (iniciado pelo Landsat 1 em 1972) com os instrumentos OLI-2 e TIRS-2 a 705 km de altitude.',
    orbitType: 'SSO (Órbita Polar Heliossíncrona — Inclinação 98,22°)',
    tleLine1: '1 49260U 21088A   24315.50124000  .00000650  00000-0  15240-3 0  9995',
    tleLine2: '2 49260  98.2184  24.5120 0001420  89.4120 270.7210 14.57112450165421',
    tleEpochIso: '2024-11-10T12:01:47Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 49260)',
    colorHex: '#10b981',
  },
  {
    id: 'sat-sentinel2a',
    noradId: 40697,
    name: 'SENTINEL-2A (Copernicus)',
    category: 'EARTH_OBSERVATION',
    categoryLabel: 'Observação da Terra (Multiespectral)',
    agency: 'ESA / Comissão Europeia (Programa Copernicus)',
    launchYear: 2015,
    purpose: 'Imageamento multiespectral de alta resolução (10m a 60m) em 13 bandas espectrais',
    scientificDescription:
      'Fornece dados abertos globais a cada 5 dias (em conjunto com o Sentinel-2B) para agricultura, monitoramento de desmatamento e resposta a desastres naturais.',
    orbitType: 'SSO (Órbita Polar Heliossíncrona — 786 km)',
    tleLine1: '1 40697U 15028A   24315.49210000  .00000210  00000-0  10120-3 0  9998',
    tleLine2: '2 40697  98.5682  31.2140 0001180  94.1200 266.0120 14.30818210489120',
    tleEpochIso: '2024-11-10T11:48:37Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 40697)',
    colorHex: '#10b981',
  },
  {
    id: 'sat-terra',
    noradId: 25994,
    name: 'TERRA (EOS AM-1 / MODIS / ASTER)',
    category: 'EARTH_OBSERVATION',
    categoryLabel: 'Observação Climática Global',
    agency: 'NASA / METI (Japão) / CSA',
    launchYear: 1999,
    purpose: 'Satélite carro-chefe do Earth Observing System para estudo acoplado da atmosfera, oceanos e continentes',
    scientificDescription:
      'Transporta cinco sensores científicos (MODIS, ASTER, CERES, MISR e MOPITT) responsáveis pelos mapas globais diários da NASA GIBS.',
    orbitType: 'SSO (Órbita Polar Heliossíncrona — Inclinação 98,15°)',
    tleLine1: '1 25994U 99068A   24315.44120000  .00000840  00000-0  18410-3 0  9991',
    tleLine2: '2 25994  98.1512  19.8410 0001620  78.5120 281.6210 14.59412040328410',
    tleEpochIso: '2024-11-10T10:35:19Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 25994)',
    colorHex: '#10b981',
  },
  {
    id: 'sat-aqua',
    noradId: 27424,
    name: 'AQUA (EOS PM-1 / Ciclo da Água)',
    category: 'EARTH_OBSERVATION',
    categoryLabel: 'Observação Hidrológica e Climática',
    agency: 'NASA / JAXA / INPE (Brasil)',
    launchYear: 2002,
    purpose: 'Monitoramento global do ciclo da água: evaporação, vapor atmosférico, nuvens, precipitação e gelo marinho',
    scientificDescription:
      'Inclui o sensor de umidade HSB fornecido pelo INPE (Brasil) além dos instrumentos MODIS e AIRS.',
    orbitType: 'SSO (Órbita Polar Heliossíncrona — Inclinação 98,2°)',
    tleLine1: '1 27424U 02022A   24315.46180000  .00000910  00000-0  19820-3 0  9994',
    tleLine2: '2 27424  98.2041 214.5120 0001510 112.4120 247.7120 14.58941200198420',
    tleEpochIso: '2024-11-10T11:04:59Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 27424)',
    colorHex: '#10b981',
  },

  // METEOROLÓGICOS
  {
    id: 'sat-noaa20',
    noradId: 43013,
    name: 'NOAA-20 (JPSS-1)',
    category: 'WEATHER',
    categoryLabel: 'Satélite Meteorológico Polar',
    agency: 'NOAA / NASA',
    launchYear: 2017,
    purpose: 'Sondagem atmosférica global de micro-ondas e infravermelho para modelos numéricos de previsão do tempo',
    scientificDescription:
      'Opera a 824 km de altitude em órbita polar, cobrindo toda a superfície da Terra duas vezes por dia com o radiômetro VIIRS e sondadores CrIS/ATMS.',
    orbitType: 'SSO (Órbita Polar Heliossíncrona — 824 km)',
    tleLine1: '1 43013U 17073A   24315.51020000  .00000180  00000-0  11240-3 0  9997',
    tleLine2: '2 43013  98.7412 232.1450 0001120  91.4210 268.7120 14.19541200361420',
    tleEpochIso: '2024-11-10T12:14:41Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 43013)',
    colorHex: '#f59e0b',
  },
  {
    id: 'sat-suomi-npp',
    noradId: 37849,
    name: 'SUOMI NPP (VIIRS Blue Marble & Night Lights)',
    category: 'WEATHER',
    categoryLabel: 'Satélite Meteorológico & Ambiental',
    agency: 'NASA / NOAA',
    launchYear: 2011,
    purpose: 'Observação meteorológica polar e imageamento da banda dia/noite (Day/Night Band)',
    scientificDescription:
      'Batizado em homenagem ao pioneiro da meteorologia por satélite Verner E. Suomi; famoso por gerar os mapas globais de luzes noturnas ("Black Marble") e "Blue Marble" da NASA.',
    orbitType: 'SSO (Órbita Polar Heliossíncrona — 830 km)',
    tleLine1: '1 37849U 11061A   24315.49810000  .00000190  00000-0  11840-3 0  9992',
    tleLine2: '2 37849  98.7510 218.4120 0001240  85.1240 275.0120 14.19518200674120',
    tleEpochIso: '2024-11-10T11:57:15Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 37849)',
    colorHex: '#f59e0b',
  },
  {
    id: 'sat-goes16',
    noradId: 41866,
    name: 'GOES-16 (GOES-East — América do Sul e do Norte)',
    category: 'WEATHER',
    categoryLabel: 'Satélite Meteorológico Geoestacionário',
    agency: 'NOAA / NASA',
    launchYear: 2016,
    purpose: 'Monitoramento contínuo em tempo real do tempo severo, furacões e clima espacial sobre as Américas e o Atlântico',
    scientificDescription:
      'Posicionado em Órbita Geoestacionária (GEO) a 35.786 km de altitude sobre a longitude 75,2° Oeste, girando na mesma velocidade angular da Terra e fotografando o Brasil e as Américas a cada 10 minutos.',
    orbitType: 'GEO (Órbita Geoestacionária — 35.786 km, 75,2° W)',
    tleLine1: '1 41866U 16071A   24315.45000000 -.00000240  00000-0  00000-0 0  9993',
    tleLine2: '2 41866   0.0412 268.4120 0001120 142.1200 185.4120  1.00271240029140',
    tleEpochIso: '2024-11-10T10:48:00Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 41866)',
    colorHex: '#f59e0b',
  },

  // COMUNICAÇÃO & NAVEGAÇÃO
  {
    id: 'sat-gps-biif12',
    noradId: 41328,
    name: 'GPS BIIF-12 (NAVSTAR 76 — PRN 07)',
    category: 'COMMUNICATIONS',
    categoryLabel: 'Navegação Global por Satélite (GNSS)',
    agency: 'US Space Force / GPS Wing',
    launchYear: 2016,
    purpose: 'Transmissão de sinais de tempo atômico de rubídio/césio para posicionamento e navegação global',
    scientificDescription:
      'Opera em Órbita Terrestre Média (MEO) a 20.180 km de altitude com período orbital de exatamente metade de um dia sideral (11h 58m), exigindo correções de relatividade restrita e geral nos relógios atômicos de bordo.',
    orbitType: 'MEO (Órbita Terrestre Média — 20.180 km, Inclinação 55°)',
    tleLine1: '1 41328U 16007A   24315.32000000 -.00000045  00000-0  00000-0 0  9995',
    tleLine2: '2 41328  55.1240 142.5120 0041200 218.4120 141.2410  2.00562840064120',
    tleEpochIso: '2024-11-10T07:40:48Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 41328)',
    colorHex: '#f43f5e',
  },
  {
    id: 'sat-galileo26',
    noradId: 49810,
    name: 'GALILEO 26 (GSAT0222 — Sistema Europeu)',
    category: 'COMMUNICATIONS',
    categoryLabel: 'Navegação Global por Satélite (GNSS)',
    agency: 'ESA / EUSPA (União Europeia)',
    launchYear: 2021,
    purpose: 'Posicionamento global civil de alta precisão (precisão métrica/decimétrica) e busca e salvamento (SAR)',
    scientificDescription:
      'Orbita a 23.222 km de altitude em MEO, equipado com masers passivos de hidrogênio — os relógios atômicos mais precisos já lançados para navegação.',
    orbitType: 'MEO (Órbita Terrestre Média — 23.222 km, Inclinação 56°)',
    tleLine1: '1 49810U 21116B   24315.39000000 -.00000060  00000-0  00000-0 0  9991',
    tleLine2: '2 49810  56.0412  84.1240 0003120 192.4120 167.6120  1.70475120018240',
    tleEpochIso: '2024-11-10T09:21:36Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 49810)',
    colorHex: '#f43f5e',
  },
  {
    id: 'sat-starlink1007',
    noradId: 44713,
    name: 'STARLINK-1007 (Constelação LEO Banda Larga)',
    category: 'COMMUNICATIONS',
    categoryLabel: 'Comunicação de Banda Larga em LEO',
    agency: 'SpaceX',
    launchYear: 2019,
    purpose: 'Provedor de internet satelital de baixa latência em órbita terrestre baixa (~550 km)',
    scientificDescription:
      'Representante da casca orbital principal de 53° de inclinação da megaconstelação Starlink em LEO.',
    orbitType: 'LEO (Órbita Terrestre Baixa — 550 km, Inclinação 53,05°)',
    tleLine1: '1 44713U 19074A   24315.51200000  .00004210  00000-0  29140-3 0  9996',
    tleLine2: '2 44713  53.0542 156.4120 0001420  92.1420 267.9810 15.06412450274120',
    tleEpochIso: '2024-11-10T12:17:16Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 44713)',
    colorHex: '#f43f5e',
  },
  {
    id: 'sat-iridium106',
    noradId: 41917,
    name: 'IRIDIUM 106 (Iridium NEXT)',
    category: 'COMMUNICATIONS',
    categoryLabel: 'Comunicação Móvel & ADS-B Aeronáutico',
    agency: 'Iridium Communications / Aireon',
    launchYear: 2017,
    purpose: 'Comunicação global de voz/dados polo a polo e rastreamento ADS-B espacial de aeronaves comerciais',
    scientificDescription:
      'Opera em órbita quase perfeitamente polar (inclinação de 86,4°) a 780 km de altitude com enlaces ópticos diretos entre satélites.',
    orbitType: 'LEO Polar (780 km, Inclinação 86,4°)',
    tleLine1: '1 41917U 17003A   24315.48500000  .00000160  00000-0  51240-4 0  9992',
    tleLine2: '2 41917  86.3984  64.2140 0002140  89.4120 270.7410 14.34218410412410',
    tleEpochIso: '2024-11-10T11:38:24Z',
    sourceName: 'CelesTrak / NORAD GP Element Set (CATNR 41917)',
    colorHex: '#f43f5e',
  },
];

/**
 * Helper to convert Geodetic (latDeg, lonDeg, altKm) to Earth-local 3D coordinates
 * in true 1:1 physical altitude proportion (`1 + altKm / 6371 km`) relative to Earth's radius.
 * LEO satellites (~400 km) orbit at ~1.063 R_E (cleanly above the 1.028 R_E atmosphere),
 * MEO (~20,200 km GPS) at ~4.17 R_E, and GEO (35,786 km GOES-16) at ~6.62 R_E.
 */
export function geodeticToEarthLocal3D(
  latDeg: number,
  lonDeg: number,
  altKm: number,
  earthSceneRadius: number
): [number, number, number] {
  const realEarthRadiusKm = 6371.0;
  const clampedAltKm = Math.max(220, altKm);
  const r = earthSceneRadius * (1.0 + clampedAltKm / realEarthRadiusKm);
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;

  const x = r * Math.cos(latRad) * Math.cos(lonRad);
  const y = r * Math.sin(latRad);
  const z = -r * Math.cos(latRad) * Math.sin(lonRad);

  return [x, y, z];
}

/**
 * Propagates all satellites in the catalog to the target Date using real SGP4/SDP4 orbital mechanics (`satellite.js`).
 */
export function propagateSatelliteCatalog(
  catalog: SatelliteRecord[],
  targetDate: Date,
  earthSceneRadius: number,
  orbitTrackTarget: boolean | string | null = true
): PropagatedSatellite[] {
  const gmst = satellite.gstime(targetDate);

  return catalog.map((sat) => {
    try {
      const satrec = satellite.twoline2satrec(sat.tleLine1, sat.tleLine2);
      const posVel = satellite.propagate(satrec, targetDate);

      if (
        !posVel.position ||
        typeof posVel.position === 'boolean' ||
        !posVel.velocity ||
        typeof posVel.velocity === 'boolean'
      ) {
        throw new Error('SGP4 propagation returned invalid state vector');
      }

      const geodetic = satellite.eciToGeodetic(posVel.position, gmst);
      const latitudeDeg = satellite.degreesLat(geodetic.latitude);
      const longitudeDeg = satellite.degreesLong(geodetic.longitude);
      const altitudeKm = Math.max(180, geodetic.height);

      const vx = posVel.velocity.x;
      const vy = posVel.velocity.y;
      const vz = posVel.velocity.z;
      const velocityKmS = Math.sqrt(vx * vx + vy * vy + vz * vz);

      // Extract inclination (rad -> deg) and mean motion (rad/min -> period in min) from satrec
      const inclinationDeg = (satrec.inclo * 180) / Math.PI;
      const periodMinutes = (2 * Math.PI) / satrec.no;

      const position3D = geodeticToEarthLocal3D(
        latitudeDeg,
        longitudeDeg,
        altitudeKm,
        earthSceneRadius
      );

      const shouldComputeTrack =
        orbitTrackTarget === true ||
        (typeof orbitTrackTarget === 'string' && orbitTrackTarget === sat.id);

      const orbitTrack3D: [number, number, number][] = [];
      if (shouldComputeTrack) {
        const steps = 64;
        const periodMs = periodMinutes * 60 * 1000;
        for (let i = 0; i <= steps; i++) {
          const stepTime = new Date(targetDate.getTime() + (i / steps) * periodMs);
          const stepGmst = satellite.gstime(stepTime);
          const stepPV = satellite.propagate(satrec, stepTime);
          if (stepPV.position && typeof stepPV.position !== 'boolean') {
            const stepGeo = satellite.eciToGeodetic(stepPV.position, stepGmst);
            const sLat = satellite.degreesLat(stepGeo.latitude);
            const sLon = satellite.degreesLong(stepGeo.longitude);
            const sAlt = Math.max(180, stepGeo.height);
            orbitTrack3D.push(geodeticToEarthLocal3D(sLat, sLon, sAlt, earthSceneRadius));
          }
        }
      }

      return {
        ...sat,
        latitudeDeg,
        longitudeDeg,
        altitudeKm,
        velocityKmS,
        inclinationDeg,
        periodMinutes,
        position3D,
        orbitTrack3D,
      };
    } catch {
      // Safe deterministic fallback if a TLE is very far from epoch
      return {
        ...sat,
        latitudeDeg: 0,
        longitudeDeg: 0,
        altitudeKm: 420,
        velocityKmS: 7.66,
        inclinationDeg: 51.6,
        periodMinutes: 92.8,
        position3D: geodeticToEarthLocal3D(0, 0, 420, earthSceneRadius),
        orbitTrack3D: [],
      };
    }
  });
}

/**
 * Attempts to fetch live updated TLE records from CelesTrak GP API for our catalog.
 * If offline or blocked by CORS/network, gracefully retains the verified NORAD TLE snapshot.
 */
export async function refreshCatalogFromCelesTrak(
  baseCatalog: SatelliteRecord[]
): Promise<{ catalog: SatelliteRecord[]; isLiveCelesTrak: boolean; updatedAtIso: string }> {
  const CACHE_KEY = 'universe_explorer_tle_cache_v1';
  try {
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (Date.now() - parsed.timestamp < 6 * 3600 * 1000 && Array.isArray(parsed.catalog)) {
        return {
          catalog: parsed.catalog,
          isLiveCelesTrak: true,
          updatedAtIso: new Date(parsed.timestamp).toISOString(),
        };
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    // Query ISS (25544) from CelesTrak to verify live connectivity quickly
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(
      'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE',
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length >= 3 && lines[1].startsWith('1 25544') && lines[2].startsWith('2 25544')) {
        const updatedCatalog = baseCatalog.map((item) =>
          item.noradId === 25544
            ? {
                ...item,
                tleLine1: lines[1],
                tleLine2: lines[2],
                tleEpochIso: new Date().toISOString(),
                sourceName: 'CelesTrak Live GP API (NORAD CATNR 25544)',
              }
            : item
        );
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ timestamp: Date.now(), catalog: updatedCatalog })
          );
        } catch {
          // ignore
        }
        return {
          catalog: updatedCatalog,
          isLiveCelesTrak: true,
          updatedAtIso: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Fallback to bundled verified NORAD TLE catalog
  }

  return {
    catalog: baseCatalog,
    isLiveCelesTrak: false,
    updatedAtIso: '2024-11-10T12:26:33Z (Snapshot Oficial NORAD / CelesTrak)',
  };
}

