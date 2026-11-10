import React, { useRef, useState } from 'react';
import {
  Compass,
  Globe,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Mountain,
  Navigation,
  Plus,
  Minus,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';

interface EarthLocationPreset {
  id: string;
  name: string;
  category: 'Formação Geográfica' | 'Ecossistema & Clima' | 'Base Espacial' | 'Metrópole';
  lat: number;
  lon: number;
  zoom: number;
  elevation: string;
  scientificSummary: string;
  geologicalContext: string;
  sensorSource: string;
}

const EARTH_SURFACE_PRESETS: EarthLocationPreset[] = [
  {
    id: 'loc-amazon-encontro',
    name: 'Encontro das Águas & Bacia Amazônica (Manaus, Brasil)',
    category: 'Ecossistema & Clima',
    lat: -3.135,
    lon: -59.905,
    zoom: 12,
    elevation: '22 m (nível fluvial)',
    scientificSummary:
      'Confluência entre o Rio Negro (águas escuras, ácidas, ricas em ácidos húmicos e pobres em sedimentos) e o Rio Solimões (águas barrentas carregadas de sedimentos andinos), que correm lado a lado sem se misturar devido a diferenças de velocidade, temperatura e densidade.',
    geologicalContext:
      'Bacia sedimentar intracratônica amazônica drenando ~7 milhões de km² e descarregando 20% de toda a água doce fluvial que chega aos oceanos da Terra.',
    sensorSource: 'Satélites Sentinel-2 (ESA) / Landsat 9 (NASA/USGS) / Maxar WorldView',
  },
  {
    id: 'loc-alcantara',
    name: 'Centro de Lançamento de Alcântara (Maranhão, Brasil)',
    category: 'Base Espacial',
    lat: -2.373,
    lon: -44.396,
    zoom: 13,
    elevation: '42 m (falésias costeiras)',
    scientificSummary:
      'Localizado a apenas 2°22′ ao sul da linha do Equador, Alcântara aproveita a velocidade linear máxima de rotação da Terra (~465 m/s ou 1.674 km/h), economizando até 30% de propelente para inserção em órbitas geoestacionárias.',
    geologicalContext: 'Formação Itapecuru sobre falésias costeiras voltadas para o Oceano Atlântico Equatorial livre.',
    sensorSource: 'Imagens orbitais de alta resolução Esri World Imagery / CNES / AEB',
  },
  {
    id: 'loc-everest',
    name: 'Monte Everest / Chomolungma (Cordilheira do Himalaia)',
    category: 'Formação Geográfica',
    lat: 27.9881,
    lon: 86.925,
    zoom: 13,
    elevation: '8.848,86 m (ponto mais alto da litosfera continental)',
    scientificSummary:
      'O pico mais elevado da Terra acima do nível do mar. O topo do Everest é composto pelo "Calcário Qomolangma" — rochas sedimentares marinhas com fósseis de trilobitas e crinoides do Ordoviciano (~450 milhões de anos) que foram empurradas do fundo do antigo Oceano Tétis até a estratosfera!',
    geologicalContext:
      'Zona de colisão continental ativa onde a Placa Indiana converge para o norte a ~5 cm/ano sob a Placa Euroasiática.',
    sensorSource: 'NASA SRTM DEM / Satélites ópticos ortorretificados',
  },
  {
    id: 'loc-richat',
    name: 'Estrutura de Richat — "Olho do Saara" (Mauritânia)',
    category: 'Formação Geográfica',
    lat: 21.124,
    lon: -11.402,
    zoom: 11,
    elevation: '400 – 485 m',
    scientificSummary:
      'Estrutura geológica circular de 40 km de diâmetro usada como ponto de referência visual pelos astronautas desde as missões Gemini e Apollo. Inicialmente suspeita de ser uma cratera de impacto, estudos de campo provaram tratar-se de um domo anticlinal magmático profundamente erodido.',
    geologicalContext:
      'Anéis concêntricos de quartzito paleozoico resistente à erosão intercalados com vales de rochas menos resistentes (100 milhões de anos).',
    sensorSource: 'NASA Earth Observatory / ASTER / Landsat 8-9',
  },
  {
    id: 'loc-grand-canyon',
    name: 'Grand Canyon do Rio Colorado (Arizona, EUA)',
    category: 'Formação Geográfica',
    lat: 36.098,
    lon: -112.095,
    zoom: 12,
    elevation: '2.100 m (borda) / 730 m (leito do rio)',
    scientificSummary:
      'Garganta tectônica e fluvial de 446 km de extensão e até 1.857 m de profundidade que expõe quase 2 bilhões de anos de história geológica da Terra em camadas estratigráficas contínuas (desde o Xisto Vishnu na base até o Calcário Kaibab no topo).',
    geologicalContext: 'Soerguimento do Platô do Colorado combinado com incisão fluvial acelerada nos últimos 5 a 6 milhões de anos.',
    sensorSource: 'USGS National Map / NASA Landsat & Sentinel-2',
  },
  {
    id: 'loc-ksc',
    name: 'Kennedy Space Center — Complexo 39A & 39B (Flórida, EUA)',
    category: 'Base Espacial',
    lat: 28.6083,
    lon: -80.6041,
    zoom: 14,
    elevation: '3 m (Ilha Merritt)',
    scientificSummary:
      'Plataforma histórica de onde partiram a Apollo 11 rumo à Lua (1969), os Ônibus Espaciais e as missões Artemis. Ao sul encontram-se os complexos de Cabo Canaveral de onde decolaram as sondas Voyager 1 e 2, Cassini, New Horizons e Perseverance.',
    geologicalContext: 'Ilha-barreira costeira atlântica em latitude 28,5° N.',
    sensorSource: 'USGS High Resolution Orthoimagery / NASA KSC',
  },
  {
    id: 'loc-rio',
    name: 'Baía de Guanabara, Pão de Açúcar & Maciço da Tijuca (Rio de Janeiro)',
    category: 'Metrópole',
    lat: -22.9519,
    lon: -43.2105,
    zoom: 13,
    elevation: '0 – 1.021 m (Pico da Tijuca)',
    scientificSummary:
      'Exemplo clássico mundial de relevo de "mares de morros" e inselbergs granítico-gnáissicos (Pão de Açúcar e Corcovado) esculpidos por intemperismo tropical e tectônica de rifteamento cenozoico adjacente a uma baía costeira.',
    geologicalContext: 'Cinturão Orogênico Ribeira formado durante a amalgamação do supercontinente Gondwana (~580 milhões de anos).',
    sensorSource: 'IBGE / INPE / Mosaico Satelital Esri World Imagery',
  },
];

type BaseLayerType = 'SATELLITE' | 'TERRAIN_RELIEF' | 'OSM_SCIENTIFIC';

interface EarthSurfaceExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulationTimeMs: number;
}

/**
 * Converts (lat, lon, zoom) to fractional Slippy Map tile coordinates (X, Y).
 */
function latLonToTileXY(latDeg: number, lonDeg: number, zoom: number): { x: number; y: number } {
  const latRad = (Math.max(-85.05, Math.min(85.05, latDeg)) * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lonDeg + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function tileXYToLatLon(x: number, y: number, zoom: number): { lat: number; lon: number } {
  const n = Math.pow(2, zoom);
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lon };
}

export const EarthSurfaceExplorerModal: React.FC<EarthSurfaceExplorerModalProps> = ({
  isOpen,
  onClose,
  simulationTimeMs,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<EarthLocationPreset>(EARTH_SURFACE_PRESETS[0]);
  const [centerLat, setCenterLat] = useState<number>(EARTH_SURFACE_PRESETS[0].lat);
  const [centerLon, setCenterLon] = useState<number>(EARTH_SURFACE_PRESETS[0].lon);
  const [zoom, setZoom] = useState<number>(EARTH_SURFACE_PRESETS[0].zoom);
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>('SATELLITE');
  const [showPlaceLabels, setShowPlaceLabels] = useState<boolean>(true);
  const [showNasaClouds, setShowNasaClouds] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null);
  const lastWheelTimeRef = useRef<number>(0);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: EarthLocationPreset) => {
    setSelectedPreset(preset);
    setCenterLat(preset.lat);
    setCenterLon(preset.lon);
    setZoom(preset.zoom);
  };

  // Compute local solar illumination status at (centerLat, centerLon) for simulationTimeMs
  const simDate = new Date(simulationTimeMs);
  const utcHours = simDate.getUTCHours() + simDate.getUTCMinutes() / 60;
  const localSolarHour = (((utcHours + centerLon / 15) % 24) + 24) % 24;
  const isDaylightAtLocation = localSolarHour >= 6 && localSolarHour <= 18;

  // Build slippy tile grid (5x4 tiles of 256x256 px) around centerTile
  const centerTile = latLonToTileXY(centerLat, centerLon, zoom);
  const baseTileX = Math.floor(centerTile.x);
  const baseTileY = Math.floor(centerTile.y);
  const fracX = centerTile.x - baseTileX;
  const fracY = centerTile.y - baseTileY;
  const maxTileIndex = Math.pow(2, zoom);

  const tiles: {
    key: string;
    gx: number;
    gy: number;
    url: string;
    labelUrl?: string;
    cloudUrl?: string;
  }[] = [];

  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = ((baseTileX + dx) % maxTileIndex + maxTileIndex) % maxTileIndex;
      const ty = baseTileY + dy;
      if (ty < 0 || ty >= maxTileIndex) continue;

      let url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
      if (baseLayer === 'TERRAIN_RELIEF') {
        url = `https://tile.opentopomap.org/${zoom}/${tx}/${ty}.png`;
      } else if (baseLayer === 'OSM_SCIENTIFIC') {
        url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      }

      const labelUrl = showPlaceLabels
        ? `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${zoom}/${ty}/${tx}`
        : undefined;

      const cloudUrl =
        showNasaClouds && zoom <= 9
          ? `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-06-15/GoogleMapsCompatible_Level9/${zoom}/${ty}/${tx}.jpg`
          : undefined;

      tiles.push({
        key: `${zoom}-${tx}-${ty}-${dx}-${dy}`,
        gx: dx,
        gy: dy,
        url,
        labelUrl,
        cloudUrl,
      });
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, lat: centerLat, lon: centerLon });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const dxPx = e.clientX - dragStart.x;
    const dyPx = e.clientY - dragStart.y;
    const startTile = latLonToTileXY(dragStart.lat, dragStart.lon, zoom);
    const nextTileX = startTile.x - dxPx / 256;
    const nextTileY = Math.max(0.05, Math.min(Math.pow(2, zoom) - 0.05, startTile.y - dyPx / 256));
    const nextCoords = tileXYToLatLon(nextTileX, nextTileY, zoom);
    setCenterLat(Number(nextCoords.lat.toFixed(5)));
    setCenterLon(Number((((nextCoords.lon + 180) % 360 + 360) % 360 - 180).toFixed(5)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const isResolutionWarningActive =
    (baseLayer === 'SATELLITE' && zoom >= 17) ||
    (baseLayer === 'TERRAIN_RELIEF' && zoom >= 15) ||
    (showNasaClouds && zoom > 9);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex flex-col animate-fadeIn">
      {/* Top Telemetry Header */}
      <div className="h-14 border-b border-white/10 bg-slate-900/80 px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Nível 4 — Exploração da Superfície
              </span>
              <h2 className="text-sm font-display font-bold text-white">
                Observatório Geoespacial da Terra — Imagens Reais de Satélite & Topografia
              </h2>
            </div>
            <p className="text-[11px] text-slate-400">
               Dados orbitais reais licenciados (USGS / NASA Earthdata GIBS / Esri World Imagery / Copernicus Sentinel-2 / OpenTopoMap)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-white/10 text-xs font-mono">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-slate-300">
              LAT: <strong className="text-white">{centerLat.toFixed(4)}°</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">
              LON: <strong className="text-white">{centerLon.toFixed(4)}°</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-sky-300">ZOOM NÍVEL {zoom}</span>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Voltar à Órbita 3D da Terra</span>
          </button>
        </div>
      </div>

      {/* Main Content Split: Left Locations + Center Satellite Tile Viewport + Right Scientific Dossier */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Regiões, Formações Geográficas & Bases Espaciais */}
        <div className="w-80 border-r border-white/10 bg-slate-900/60 flex flex-col overflow-y-auto p-3.5 space-y-4">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Camadas de Sensoriamento Remoto
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => setBaseLayer('SATELLITE')}
                className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                  baseLayer === 'SATELLITE'
                    ? 'bg-sky-500/20 border-sky-400 text-white font-semibold'
                    : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div>Satélite Óptico Real (Cores Verdadeiras)</div>
                <div className="text-[10px] text-slate-400">
                  Mosaico multiespectral Landsat / Sentinel-2 / Maxar
                </div>
              </button>

              <button
                onClick={() => setBaseLayer('TERRAIN_RELIEF')}
                className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                  baseLayer === 'TERRAIN_RELIEF'
                    ? 'bg-amber-500/20 border-amber-400 text-white font-semibold'
                    : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div>Relevo Topográfico & Curvas de Nível (SRTM)</div>
                <div className="text-[10px] text-slate-400">
                  Altimetria de radar NASA SRTM & OpenTopoMap
                </div>
              </button>

              <button
                onClick={() => setBaseLayer('OSM_SCIENTIFIC')}
                className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                  baseLayer === 'OSM_SCIENTIFIC'
                    ? 'bg-emerald-500/20 border-emerald-400 text-white font-semibold'
                    : 'bg-slate-950/60 border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div>Cartografia Política & Cidades (OpenStreetMap)</div>
                <div className="text-[10px] text-slate-400">
                  Fronteiras, malha urbana, hidrografia e topônimos
                </div>
              </button>
            </div>

            <div className="mt-2.5 space-y-1.5">
              <label className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-950/50 border border-white/5 text-xs text-slate-300 cursor-pointer">
                <span>Rótulos de Cidades, Países e Oceanos</span>
                <input
                  type="checkbox"
                  checked={showPlaceLabels}
                  onChange={(e) => setShowPlaceLabels(e.target.checked)}
                  className="accent-sky-400"
                />
              </label>
              <label className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-950/50 border border-white/5 text-xs text-slate-300 cursor-pointer">
                <span>Cobertura de Nuvens NASA MODIS (Zoom ≤ 9)</span>
                <input
                  type="checkbox"
                  checked={showNasaClouds}
                  onChange={(e) => {
                    setShowNasaClouds(e.target.checked);
                    if (e.target.checked && zoom > 8) setZoom(7);
                  }}
                  className="accent-sky-400"
                />
              </label>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-sky-400 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Expedições Geográficas & Científicas
            </h3>
            <div className="space-y-1.5">
              {EARTH_SURFACE_PRESETS.map((preset) => {
                const active = selectedPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      active
                        ? 'bg-sky-500/20 border-sky-400/80 text-white shadow-md'
                        : 'bg-slate-950/50 border-white/10 text-slate-300 hover:bg-slate-900 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-sky-300 mb-0.5">
                      <span>{preset.category}</span>
                      <span>
                        {preset.lat.toFixed(1)}°, {preset.lon.toFixed(1)}°
                      </span>
                    </div>
                    <div className="text-xs font-semibold leading-snug">{preset.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Interactive Real Satellite Slippy Viewport */}
        <div
          className="flex-1 relative bg-slate-950 overflow-hidden cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            const now = performance.now();
            if (now - lastWheelTimeRef.current < 160) return;
            lastWheelTimeRef.current = now;
            if (e.deltaY < 0) setZoom((z) => Math.min(18, z + 1));
            if (e.deltaY > 0) setZoom((z) => Math.max(2, z - 1));
          }}
        >
          {/* Tile Canvas Grid */}
          <div className="absolute inset-0 pointer-events-none">
            {tiles.map((t) => {
              const leftOffset = `calc(50% + ${(t.gx - fracX) * 256}px)`;
              const topOffset = `calc(50% + ${(t.gy - fracY) * 256}px)`;
              return (
                <div
                  key={t.key}
                  style={{
                    position: 'absolute',
                    left: leftOffset,
                    top: topOffset,
                    width: 256,
                    height: 256,
                  }}
                >
                  <img
                    src={t.url}
                    alt=""
                    draggable={false}
                    className="w-64 h-64 object-cover block"
                  />
                  {t.cloudUrl && (
                    <img
                      src={t.cloudUrl}
                      alt=""
                      draggable={false}
                      className="w-64 h-64 object-cover block absolute inset-0 opacity-65 mix-blend-screen"
                    />
                  )}
                  {t.labelUrl && (
                    <img
                      src={t.labelUrl}
                      alt=""
                      draggable={false}
                      className="w-64 h-64 object-cover block absolute inset-0"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Center Crosshair Reticle */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border border-sky-400/70 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-300" />
            </div>
          </div>

          {/* Zoom Controls Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-1.5 bg-slate-950/85 border border-white/15 p-1.5 rounded-xl backdrop-blur-md">
            <button
              onClick={() => setZoom((z) => Math.min(18, z + 1))}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              title="Aproximar (Zoom In)"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono text-center text-sky-300 py-0.5 border-y border-white/10">
              Z{zoom}
            </div>
            <button
              onClick={() => setZoom((z) => Math.max(2, z - 1))}
              className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors"
              title="Afastar (Zoom Out)"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Scientific Resolution & Coverage Transparency Notice */}
          {isResolutionWarningActive && (
            <div className="absolute top-4 left-4 max-w-md bg-amber-950/90 border border-amber-400/60 text-amber-100 px-3.5 py-2.5 rounded-xl backdrop-blur-md text-xs flex items-start gap-2.5 shadow-lg">
              <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-200">
                  Aviso de Limite de Resolução do Sensor Orbital
                </div>
                <p className="text-[11px] text-amber-100/90 mt-0.5 leading-relaxed">
                  {showNasaClouds && zoom > 9
                    ? 'A camada diária de nuvens MODIS Terra da NASA GIBS possui resolução nativa de 250m (até Zoom 9). Em zooms maiores, os blocos ópticos base (Sentinel/Landsat/Maxar) são priorizados.'
                    : 'Você atingiu o limite de ampliação óptica disponível para esta coordenada pública. Nenhuma textura ou edifício fictício é gerado artificialmente para preservar rigor científico.'}
                </p>
              </div>
            </div>
          )}

          {/* Bottom Attribution & Scale Bar */}
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-slate-950/85 border border-white/10 px-3.5 py-2 rounded-xl backdrop-blur-md text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>Integridade de Dados:</strong> Imagens reais de satélite — sem geração procedural fictícia de cidades.
              </span>
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Fontes: Esri World Imagery • USGS • NASA Earthdata GIBS • Copernicus Sentinel • OpenStreetMap Contributors
            </div>
          </div>
        </div>

        {/* Right Sidebar: Scientific & Geographical Analysis of Focused Region */}
        <div className="w-80 border-l border-white/10 bg-slate-900/60 p-4 overflow-y-auto space-y-4">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                Iluminação Solar Real no Local
              </span>
              <Sun
                className={`w-4 h-4 ${
                  isDaylightAtLocation ? 'text-amber-400' : 'text-indigo-400'
                }`}
              />
            </div>
            <div className="text-xs font-semibold text-white">
              {isDaylightAtLocation
                ? 'Hemisfério Diurno (Iluminado pelo Sol)'
                : 'Hemisfério Noturno (Sombra Terrestre)'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Hora Solar Local Aproximada: {Math.floor(localSolarHour)
                .toString()
                .padStart(2, '0')}
              h{Math.floor((localSolarHour % 1) * 60)
                .toString()
                .padStart(2, '0')}
              m
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-emerald-400">
              <Mountain className="w-4 h-4" />
              <span>Dossiê Geográfico & Geológico</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5">
              <div className="text-[10px] font-mono text-sky-300 uppercase">
                {selectedPreset.category}
              </div>
              <h4 className="text-sm font-display font-bold text-white">
                {selectedPreset.name}
              </h4>
              <div className="text-xs font-mono text-amber-300">
                Altitude / Elevação: {selectedPreset.elevation}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedPreset.scientificSummary}
              </p>
              <div className="pt-2 border-t border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Contexto Geodinâmico
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedPreset.geologicalContext}
                </p>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="text-[10px] font-mono uppercase text-slate-400 mb-0.5">
                  Sensores e Missões Fonte
                </div>
                <p className="text-[11px] text-sky-300 font-mono">
                  {selectedPreset.sensorSource}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/30 text-xs text-sky-100 space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-sky-300" />
              <span>Como Explorar Livremente</span>
            </div>
            <p className="text-[11px] text-sky-200/80 leading-relaxed">
              Arraste o mapa com o mouse para navegar por qualquer continente, oceano, cordilheira ou cidade da Terra, e use a roda do mouse para controlar o nível de aproximação até a resolução máxima dos satélites.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

