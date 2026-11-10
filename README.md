# UNIVERSE EXPLORER — Plataforma Interativa de Exploração Espacial 3D e Ciência Planetária

Uma plataforma web 3D interativa, cinematográfica e cientificamente fundamentada para exploração do Sistema Solar diretamente no navegador.

---

## Funcionalidades Implementadas

1. **Sistema Solar 3D & Efemérides Keplerianas (J2000)**
   - Sol, 8 planetas principais (**Mercúrio, Vênus, Terra, Marte, Júpiter, Saturno, Urano, Netuno**), planetas anões (**Plutão e Ceres**), principais luas (**Lua, Io, Europa, Ganimedes, Calisto, Titã, Encélado e Tritão**), Cinturão Principal de Asteroides e Cinturão de Kuiper.
   - Posições orbitais tridimensionais calculadas resolvendo a Equação de Kepler ($M = E - e \sin E$) com elementos orbitais J2000 do **NASA JPL Horizons**.
   - Inclinação axial real (incluindo os $97,77^\circ$ de Urano e rotações retrógradas de Vênus, Urano, Plutão e Tritão).

2. **Sistema de Zoom Progressivo (4 Níveis)**
   - **Nível 1 — Sistema Solar**: Visão heliocêntrica de órbitas, cinturões e trajetórias de sondas.
   - **Nível 2 — Aproximação Planetária**: Shaders GLSL de múltiplas camadas, espalhamento atmosférico de Rayleigh, faixas zonais, Grande Mancha Vermelha e terminador dia/noite.
   - **Nível 3 — Exploração Orbital**: Luas naturais, sistema de partículas dos anéis de Saturno e satélites artificiais da Terra rastreados via **SGP4**.
   - **Nível 4 — Exploração da Superfície**:
     - Na **Terra**: Observatório Geoespacial com imagens reais de satélite (Esri World Imagery / USGS / NASA Earthdata GIBS MODIS / Copernicus Sentinel / OpenTopoMap) com aviso transparente de limite de resolução óptica.
     - Nos demais mundos: Marcadores 3D em coordenadas planetocêntricas reais (**Olympus Mons, Valles Marineris, Cratera Jezero / Perseverance, Cratera Gale / Curiosity, Bacia Caloris, Maxwell Montes, Sputnik Planitia, Listras de Tigre de Encélado**).

3. **Satélites Artificiais da Terra (CelesTrak NORAD TLE + Propagação SGP4)**
   - Integração com `satellite.js` (modelo físico **SGP4/SDP4**) e elementos orbitais de duas linhas (TLE) do **NORAD / CelesTrak**.
   - Categorias filtráveis: **Estações Espaciais (ISS, Tiangong)**, **Telescópios Espaciais (Hubble, Fermi, IXPE)**, **Observação da Terra (Landsat 9, Sentinel-2A, Terra, Aqua)**, **Meteorológicos (NOAA-20, Suomi NPP, GOES-16)** e **Comunicação & Navegação (GPS, Galileo, Starlink, Iridium)**.

4. **Saturno — Sistema de Anéis de Partículas & Divisão de Cassini**
   - Renderização combinada: shader radial de profundidade óptica (Anéis D, C, B, **Divisão de Cassini**, Anel A com **Lacuna de Encke** e Anel F) com projeção de sombra planetária em tempo real + **Sistema de 5.500 Partículas 3D de Gelo** em órbita kepleriana e modo dedicado **"Mergulhar nos Anéis de Partículas"**.

5. **Exploração do Interior 3D (Corte Tridimensional / 3D Cutaway)**
   - Corte em cunha tridimensional revelando camadas internas concêntricas (núcleo, manto, oceano subterrâneo, crosta) com classificação epistemológica explícita:
     - `Medição Direta / In-Situ` (ex.: sismometria terrestre, Apollo e InSight em Marte)
     - `Inferido por Modelos Físicos` (ex.: harmônicos gravitacionais da Juno em Júpiter e kronossismologia dos anéis de Saturno)
     - `Em Investigação / Incerteza Científica` (ex.: interiores profundos de Urano e Netuno).

6. **Viagens Espaciais Cinematográficas (Túnel de Dobra Espacial)**
   - Sequência animada de afastamento orbital, alongamento relativístico de estrelas, túnel de dobra espacial 3D e desaceleração até o planeta de destino, acompanhada de nota científica educativa informando o tempo real de viagem na velocidade da luz ($c$).

7. **Sistema de Escalas Adaptáveis com Transparência Científica**
   - Alternância em tempo real entre **Modo Exploração**, **Proporção Real de Tamanhos**, **Distâncias Proporcionais em UA** e **Escala Científica Real 1:1**.

---

## Como Executar Localmente

### Pré-requisitos
- **Node.js** 18+ (testado em Node.js v24)

### Instalação e Execução em Desenvolvimento
```bash
npm install
npm run dev
```
Acesse no navegador: `http://localhost:5173`

### Compilação para Produção (Build)
```bash
npm run build
npm run preview
```
Os arquivos otimizados para publicação estática (Netlify, Vercel, GitHub Pages, Cloudflare Pages) são gerados na pasta `dist/`.

