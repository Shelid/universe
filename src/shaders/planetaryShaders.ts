import * as THREE from 'three';

function createDefaultTexture(r: number, g: number, b: number, a = 255): THREE.DataTexture {
  const data = new Uint8Array([r, g, b, a]);
  const texture = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

const DEFAULT_WHITE_TEXTURE = createDefaultTexture(255, 255, 255, 255);
const DEFAULT_BLACK_TEXTURE = createDefaultTexture(0, 0, 0, 255);
const DEFAULT_FLAT_NORMAL_TEXTURE = createDefaultTexture(128, 128, 255, 255);

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 6; i++) {
    value += amplitude * snoise(p * frequency);
    frequency *= 2.08;
    amplitude *= 0.49;
  }
  return value;
}

float ridgedFbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  float weight = 1.0;
  for (int i = 0; i < 5; i++) {
    float n = 1.0 - abs(snoise(p * frequency));
    n = n * n * weight;
    weight = clamp(n * 2.0, 0.0, 1.0);
    value += n * amplitude;
    frequency *= 2.15;
    amplitude *= 0.5;
  }
  return value;
}
`;

/**
 * 4K Solar Photosphere & Chromosphere Shader with active magnetic flares,
 * boiling solar granulation, sunspot umbra/penumbra, and solar storm filaments.
 */
export function createSunShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uDiffuseMap: { value: DEFAULT_WHITE_TEXTURE },
      uHasDiffuseMap: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vLocalPos = normalize(position);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uDiffuseMap;
      uniform float uHasDiffuseMap;
      varying vec3 vNormal;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      varying vec2 vUv;

      ${NOISE_GLSL}

      void main() {
        vec3 sampledSunTex = texture2D(uDiffuseMap, vUv).rgb;
        vec3 p = vLocalPos;
        float t = uTime * 0.12;

        // Domain-warped magnetohydrodynamic plasma turbulence
        vec3 warp = vec3(
          fbm(p * 3.2 + vec3(t, -t * 0.5, 0.0)),
          fbm(p * 3.2 + vec3(0.0, t * 0.7, -t)),
          fbm(p * 3.2 + vec3(-t * 0.6, 0.0, t))
        );

        float plasmaBase = fbm(p * 5.5 + warp * 0.85);
        float magneticFilaments = ridgedFbm(p * 6.5 - warp * 0.65 + vec3(t * 0.4));
        float fineGranules = snoise(p * 28.0 + vec3(uTime * 0.35)) * 0.5 + 0.5;

        // Active solar storm flare zones along +/- 18 deg active latitude belts
        float beltMask = exp(-pow((abs(p.y) - 0.24) * 5.2, 2.0));
        float stormRegion = smoothstep(0.48, 0.82, magneticFilaments * (0.6 + 0.7 * beltMask));
        float sunspotUmbra = smoothstep(0.68, 0.79, snoise(p * 7.5 + warp * 0.3) * beltMask);

        vec3 deepCrimson = vec3(0.55, 0.07, 0.01);
        vec3 solarOrange = vec3(0.98, 0.34, 0.03);
        vec3 photosphereGold = vec3(1.0, 0.72, 0.16);
        vec3 flareWhiteHot = vec3(1.0, 0.98, 0.88) * 1.45;
        vec3 darkSpot = vec3(0.16, 0.02, 0.0);

        float heat = clamp(0.45 + plasmaBase * 0.45 + fineGranules * 0.15, 0.0, 1.0);
        vec3 color = mix(deepCrimson, solarOrange, smoothstep(0.15, 0.55, heat));
        color = mix(color, photosphereGold, smoothstep(0.50, 0.88, heat));
        color = mix(color, flareWhiteHot, stormRegion * 0.85);
        color = mix(color, darkSpot, sunspotUmbra * 0.9);

        if (uHasDiffuseMap > 0.5) {
          color = mix(color, sampledSunTex * 1.28 + flareWhiteHot * stormRegion * 0.48, 0.62);
        }

        // Limb darkening in center + intense chromospheric solar storm rim at the edge
        float mu = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
        float limbDarkening = mix(0.48, 1.06, pow(mu, 0.38));
        float spiculeFlare = pow(1.0 - mu, 2.6) * (0.8 + 0.9 * magneticFilaments);

        vec3 finalColor = color * limbDarkening + vec3(1.0, 0.42, 0.08) * spiculeFlare * 1.25;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

/**
 * Dynamic Volumetric Solar Corona & CME Streamer Halo
 */
export function createSolarCoronaMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;

      ${NOISE_GLSL}

      void main() {
        float viewDot = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float edge = clamp(1.0 - viewDot, 0.0, 1.0);
        float coronaFalloff = pow(edge, 2.1);

        vec3 radialDir = normalize(vLocalPos);
        float rays = ridgedFbm(radialDir * 6.0 + vec3(uTime * 0.22, -uTime * 0.15, uTime * 0.1));
        float pulse = 0.75 + 0.45 * sin(uTime * 1.4 + rays * 5.0);

        vec3 innerCorona = vec3(1.0, 0.85, 0.42);
        vec3 outerStorm = vec3(1.0, 0.28, 0.03);
        vec3 coronaColor = mix(outerStorm, innerCorona, pow(edge, 1.4));

        float alpha = coronaFalloff * (0.55 + 0.55 * rays * pulse) * 0.85;
        gl_FragColor = vec4(coronaColor * (1.0 + rays * 0.6), alpha);
      }
    `,
  });
}

/**
 * Animated 3D Solar Prominence / Magnetic Loop Shader (Plasma Arches erupting from Sun)
 */
export function createSolarProminenceMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocalPos;
      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vLocalPos;

      ${NOISE_GLSL}

      void main() {
        float flow = fbm(vLocalPos * 4.5 - vec3(uTime * 0.9, uTime * 0.5, 0.0));
        float archFade = sin(vUv.x * 3.14159265);
        float coreGlow = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float intensity = archFade * pow(max(coreGlow, 0.0), 1.5) * (0.65 + 0.65 * flow);
        vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.88, 0.45), intensity);
        gl_FragColor = vec4(col * 1.4, clamp(intensity * 0.9, 0.0, 1.0));
      }
    `,
  });
}

export type PlanetShaderCodeId =
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
  | 'moon_titan';

const SHADER_TYPE_MAP: Record<PlanetShaderCodeId, number> = {
  mercury: 1,
  venus: 2,
  earth: 3,
  mars: 4,
  jupiter: 5,
  saturn: 6,
  uranus: 7,
  neptune: 8,
  pluto: 9,
  ceres: 10,
  moon_rocky: 11,
  moon_icy: 12,
  moon_volcanic: 13,
  moon_titan: 14,
};

/**
 * 4K Ultra-High-Definition Planetary Surface Shader
 * Supports 4K Diffuse Albedo, 4K Dynamic Cloud Layer with Drop Shadows, 4K NASA Black Marble Night Lights,
 * 4K Bathymetry/Land/Elevation Aux Map, and 4K Crater/Topography Normal Perturbation.
 */
export function createPlanetSurfaceMaterial(
  shaderType: PlanetShaderCodeId,
  primaryHex: string,
  secondaryHex: string,
  atmosphereHex: string
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uSunViewPosition: { value: new THREE.Vector3(0, 0, 0) },
      uShaderType: { value: SHADER_TYPE_MAP[shaderType] || 1 },
      uPrimaryColor: { value: new THREE.Color(primaryHex) },
      uSecondaryColor: { value: new THREE.Color(secondaryHex) },
      uAtmosphereColor: { value: new THREE.Color(atmosphereHex) },
      uVenusRadarMode: { value: 0.0 },
      uCutawayEnabled: { value: 0.0 },
      uDiffuseMap: { value: DEFAULT_WHITE_TEXTURE },
      uHasDiffuseMap: { value: 0.0 },
      uCloudsMap: { value: DEFAULT_BLACK_TEXTURE },
      uHasCloudsMap: { value: 0.0 },
      uNightMap: { value: DEFAULT_BLACK_TEXTURE },
      uHasNightMap: { value: 0.0 },
      uAuxMap: { value: DEFAULT_WHITE_TEXTURE },
      uHasAuxMap: { value: 0.0 },
      uNormalMap: { value: DEFAULT_FLAT_NORMAL_TEXTURE },
      uHasNormalMap: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vViewNormal;
      varying vec3 vLocalPos;
      varying vec3 vViewPos;
      varying vec2 vUv;
      varying vec3 vViewTangent;
      varying vec3 vViewBitangent;

      void main() {
        vUv = uv;
        vLocalPos = normalize(position);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);

        // Compute spherical tangent frame in View Space for crisp float64-derived crater & normal relief
        vec3 localTangent = normalize(vec3(-position.z, 0.0, position.x + 0.0001));
        vec3 localBitangent = normalize(cross(normal, localTangent));
        vViewTangent = normalize(normalMatrix * localTangent);
        vViewBitangent = normalize(normalMatrix * localBitangent);

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunPosition;
      uniform vec3 uSunViewPosition;
      uniform int uShaderType;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uAtmosphereColor;
      uniform float uVenusRadarMode;
      uniform float uCutawayEnabled;
      uniform sampler2D uDiffuseMap;
      uniform float uHasDiffuseMap;
      uniform sampler2D uCloudsMap;
      uniform float uHasCloudsMap;
      uniform sampler2D uNightMap;
      uniform float uHasNightMap;
      uniform sampler2D uAuxMap;
      uniform float uHasAuxMap;
      uniform sampler2D uNormalMap;
      uniform float uHasNormalMap;

      varying vec3 vViewNormal;
      varying vec3 vLocalPos;
      varying vec3 vViewPos;
      varying vec2 vUv;
      varying vec3 vViewTangent;
      varying vec3 vViewBitangent;

      ${NOISE_GLSL}

      void main() {
        if (uCutawayEnabled > 0.5) {
          if (vLocalPos.x > 0.0 && vLocalPos.y > -0.12 && vLocalPos.z > 0.0) {
            discard;
          }
        }

        // Uniformly gate texture fetches so untextured moons & non-Earth bodies skip unused lookups
        vec3 sampledDiffuse = uHasDiffuseMap > 0.5 ? texture2D(uDiffuseMap, vUv).rgb : uPrimaryColor;
        vec3 sampledDiffuseRight = sampledDiffuse;
        vec3 sampledDiffuseUp = sampledDiffuse;
        if (uHasDiffuseMap > 0.5 && (uShaderType == 1 || uShaderType == 4 || uShaderType == 11)) {
          float texStepU = 0.00035;
          float texStepV = 0.00065;
          sampledDiffuseRight = texture2D(uDiffuseMap, vUv + vec2(texStepU, 0.0)).rgb;
          sampledDiffuseUp = texture2D(uDiffuseMap, vUv + vec2(0.0, texStepV)).rgb;
        }

        vec3 sampledClouds = vec3(0.0);
        vec3 sampledCloudsShadow = vec3(0.0);
        if (uHasCloudsMap > 0.5) {
          vec2 cloudUv = vec2(fract(vUv.x - uTime * 0.00035), vUv.y);
          vec2 cloudShadowUv = vec2(fract(cloudUv.x + 0.0018), clamp(cloudUv.y - 0.0014, 0.0, 1.0));
          sampledClouds = texture2D(uCloudsMap, cloudUv).rgb;
          sampledCloudsShadow = texture2D(uCloudsMap, cloudShadowUv).rgb;
        }

        vec3 sampledNight = uHasNightMap > 0.5 ? texture2D(uNightMap, vUv).rgb : vec3(0.0);
        vec3 sampledAux = uHasAuxMap > 0.5 ? texture2D(uAuxMap, vUv).rgb : vec3(0.0);
        vec3 sampledNormal = uHasNormalMap > 0.5 ? texture2D(uNormalMap, vUv).rgb : vec3(0.5, 0.5, 1.0);

        vec3 baseN = normalize(vViewNormal);
        vec3 T = normalize(vViewTangent);
        vec3 B = normalize(vViewBitangent);
        vec3 L = normalize(uSunViewPosition - vViewPos);
        vec3 V = normalize(-vViewPos);
        vec3 p = vLocalPos;

        // Compute surface normal with 4K relief
        vec3 N = baseN;
        if (uShaderType == 3 && uHasNormalMap > 0.5) {
          // Earth 2K/4K topographic normal map
          vec3 mapN = sampledNormal * 2.0 - 1.0;
          mapN.xy *= 1.35;
          N = normalize(T * mapN.x + B * mapN.y + baseN * mapN.z);
        } else if (uHasDiffuseMap > 0.5 && (uShaderType == 1 || uShaderType == 4 || uShaderType == 11)) {
          // Real 4K Crater & Canyon relief derived directly from NASA 4K mosaic luminance gradients!
          float h0 = dot(sampledDiffuse, vec3(0.333));
          float hx = dot(sampledDiffuseRight, vec3(0.333)) - h0;
          float hy = dot(sampledDiffuseUp, vec3(0.333)) - h0;
          float bumpStrength = (uShaderType == 4) ? 2.2 : 3.2;
          N = normalize(baseN - (T * hx + B * hy) * bumpStrength);
        }

        vec3 H = normalize(L + V);
        float NdotL = dot(N, L);
        float baseNdotL = dot(baseN, L);
        float NdotV = max(dot(baseN, V), 0.0);

        float dayFactor = smoothstep(-0.12, 0.22, NdotL);
        float baseDayFactor = smoothstep(-0.14, 0.22, baseNdotL);
        float twilightFactor = smoothstep(-0.22, 0.05, baseNdotL) * (1.0 - smoothstep(0.05, 0.32, baseNdotL));
        float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.8);

        vec3 albedo = uPrimaryColor;
        float specularStrength = 0.03;
        float shininess = 32.0;
        vec3 nightEmission = vec3(0.0);
        vec3 extraSpecular = vec3(0.0);

        // =========================================================================
        // 3: EARTH — 4K BLUE MARBLE + BATHYMETRY + 4K CLOUDS + 4K BLACK MARBLE LIGHTS
        // =========================================================================
        if (uShaderType == 3) {
          // Land/Ocean mask from 4K earth_bump_roughness_clouds_4096.jpg (.g channel = land mask, .r = elevation)
          float isLand = 0.3;
          float elevation = 0.0;
          if (uHasAuxMap > 0.5) {
            elevation = sampledAux.r;
            isLand = smoothstep(0.15, 0.45, sampledAux.g);
          } else if (uHasDiffuseMap > 0.5) {
            float oceanSignal = sampledDiffuse.b - max(sampledDiffuse.r, sampledDiffuse.g * 0.90);
            isLand = 1.0 - smoothstep(0.03, 0.11, oceanSignal);
          }
          float isOcean = 1.0 - isLand;

          if (uHasDiffuseMap > 0.5) {
            // 1. Rich Photographic Ocean Grading (Deep Sapphire + Sunlit Cobalt + Turquoise Coastal Shelves)
            // Detect turquoise shallow reefs/shelves (Bahamas, Caribbean, Gulf of Mexico, Great Barrier Reef)
            float shallowShelf = clamp((sampledDiffuse.g - sampledDiffuse.r * 1.15) * 4.5, 0.0, 1.0) * isOcean;
            float coastalEdge = smoothstep(0.45, 0.0, sampledAux.g) * smoothstep(0.0, 0.15, sampledAux.g);

            vec3 deepAbyssal = vec3(0.018, 0.11, 0.34);
            vec3 sunlitCobalt = vec3(0.045, 0.28, 0.64);
            vec3 turquoiseShelf = vec3(0.06, 0.58, 0.78);

            // Blend ocean based on solar illumination and coastal bathymetry
            vec3 oceanColor = mix(deepAbyssal, sunlitCobalt, smoothstep(-0.05, 0.75, baseNdotL) * 0.85 + 0.15);
            oceanColor = mix(oceanColor, sampledDiffuse * vec3(0.85, 1.15, 1.42), 0.38);
            oceanColor = mix(oceanColor, turquoiseShelf, clamp(shallowShelf * 0.85 + coastalEdge * 0.25, 0.0, 0.85));

            // 2. Crisp 4K Continental Land Grading (Lush forests, golden deserts, snow peaks)
            vec3 landColor = pow(sampledDiffuse, vec3(0.92)) * vec3(1.06, 1.08, 0.98);
            // Boost high-altitude mountain contrast (Andes, Rockies, Himalayas)
            landColor = mix(landColor, landColor * 1.15, smoothstep(0.25, 0.75, elevation));

            albedo = mix(oceanColor, landColor, isLand);
          }

          // 3. 4K Swirling Cloud Layer with Realistic Surface Drop Shadows
          float cloudDensity = 0.0;
          float cloudShadow = 0.0;
          if (uHasCloudsMap > 0.5) {
            // earth_clouds_sss_4k.jpg is a crisp 4K grayscale cloud map
            float rawCloud = sampledClouds.r;
            cloudDensity = smoothstep(0.08, 0.72, rawCloud);
            cloudShadow = smoothstep(0.12, 0.75, sampledCloudsShadow.r);
          }

          // Darken ocean & continents slightly under cloud drop-shadow on the day side
          albedo *= (1.0 - cloudShadow * (1.0 - cloudDensity * 0.7) * 0.32 * baseDayFactor);

          // Cloud tops: brilliant white in sunlight, warm rose-gold at sunset terminator, deep slate on night side
          vec3 cloudDayColor = mix(vec3(0.98, 0.99, 1.0), vec3(1.0, 0.78, 0.58), twilightFactor * 0.45);
          albedo = mix(albedo, cloudDayColor, cloudDensity * 0.92);

          // 4. Dual-Lobe Ocean Specular Sun-Glint (Silky water sheen + crisp solar reflection)
          float oceanMask = isOcean * (1.0 - cloudDensity * 0.88);
          float broadGlint = pow(max(dot(N, H), 0.0), 16.0) * 0.24;
          float sharpGlint = pow(max(dot(N, H), 0.0), 76.0) * 0.52;
          extraSpecular = vec3(0.75, 0.90, 1.0) * (broadGlint + sharpGlint) * oceanMask * baseDayFactor;
          specularStrength = 0.0;

          // 5. 4K NASA Black Marble City Lights on the Night Side (Zero fake polka-dots!)
          if (uHasNightMap > 0.5) {
            float nightMask = smoothstep(0.10, -0.18, baseNdotL);
            // Strip dark navy background of earth_night_sss_4k.jpg so only true urban filaments glow
            float lightIntensity = max(max(sampledNight.r, sampledNight.g) - 0.11, 0.0);
            float crispLights = pow(clamp(lightIntensity * 1.45, 0.0, 1.0), 1.25);
            vec3 cityGold = mix(vec3(1.0, 0.68, 0.28), vec3(1.0, 0.94, 0.78), smoothstep(0.3, 0.85, crispLights));
            nightEmission = cityGold * crispLights * nightMask * (1.0 - cloudDensity * 0.72) * 2.1;
          }

          // 6. Rayleigh Sky-Blue Atmospheric Scattering across sunlit globe & limb
          vec3 rayleighSky = vec3(0.20, 0.60, 1.0);
          float limbScatter = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.35);
          float sunwardHorizon = smoothstep(-0.28, 0.45, baseNdotL);

          vec3 litEarth =
            albedo * (0.035 + 0.965 * mix(baseDayFactor, dayFactor, 0.65)) +
            extraSpecular +
            rayleighSky * limbScatter * sunwardHorizon * 0.78 +
            vec3(0.95, 0.48, 0.20) * twilightFactor * (0.12 + cloudDensity * 0.14) +
            nightEmission;

          gl_FragColor = vec4(litEarth, 1.0);
          return;
        }

        // =========================================================================
        // 1: MERCURY, 10: CERES, 11: MOON_ROCKY — 4K NASA MESSENGER & LRO MOSAICS
        // =========================================================================
        else if (uShaderType == 1 || uShaderType == 10 || uShaderType == 11) {
          if (uHasDiffuseMap > 0.5) {
            // Pure 4K NASA LRO (Moon) or MESSENGER (Mercury) photographic mosaic with Lommel-Seeliger contrast
            vec3 photo = pow(sampledDiffuse, vec3(1.06)) * 1.08;
            if (uShaderType == 1) {
              // Subtle warm slate-bronze tint characteristic of MESSENGER enhanced color Mercury
              photo *= vec3(1.03, 0.99, 0.95);
            }
            albedo = photo;

            // Lommel-Seeliger airless regolith lighting (crisp crater shadows at terminator, no plastic shine)
            float mu0 = max(NdotL, 0.0);
            float mu = max(NdotV, 0.08);
            float lommel = (mu0 / (mu0 + mu * 0.65)) * 1.38;
            float softTerm = smoothstep(-0.08, 0.12, NdotL);
            float regolithLight = mix(mu0, lommel, 0.55) * softTerm;

            vec3 litRegolith = albedo * (0.025 + 0.975 * regolithLight);
            gl_FragColor = vec4(litRegolith, 1.0);
            return;
          } else {
            // Procedural fallback for Ceres / minor rocky moons without 4K map
            float basins = fbm(p * 3.2);
            float ridges = ridgedFbm(p * 8.5);
            float micro = fbm(p * 24.0);
            float elev = clamp(0.5 + basins * 0.35 + ridges * 0.22 + micro * 0.12, 0.0, 1.0);
            albedo = mix(uSecondaryColor * 0.58, uPrimaryColor * 1.18, elev);
            if (uShaderType == 10) {
              float occatorDist = distance(p, normalize(vec3(-0.48, 0.34, 0.81)));
              albedo = mix(albedo, vec3(0.98, 0.99, 1.0), smoothstep(0.09, 0.015, occatorDist));
            }
          }
        }

        // =========================================================================
        // 2: VENUS — 4K SULFURIC ATMOSPHERE & 4K MAGELLAN RADAR TOPOGRAPHY
        // =========================================================================
        else if (uShaderType == 2) {
          if (uVenusRadarMode < 0.5) {
            if (uHasDiffuseMap > 0.5) {
              vec2 venusUv = vec2(fract(vUv.x + uTime * 0.0012), vUv.y);
              vec3 venusAtmo = texture2D(uDiffuseMap, venusUv).rgb;
              albedo = pow(venusAtmo, vec3(0.96)) * vec3(1.04, 1.0, 0.92);
            } else {
              float chevron = sin(p.y * 8.5 + fbm(p * 3.5) * 3.8);
              albedo = mix(vec3(0.80, 0.59, 0.24), vec3(0.98, 0.91, 0.68), chevron * 0.5 + 0.5);
            }
            specularStrength = 0.12;
          } else {
            if (uHasAuxMap > 0.5) {
              // Real 4K Magellan SAR Radar Surface Map of Venus!
              albedo = pow(sampledAux, vec3(1.08)) * vec3(1.12, 0.95, 0.82);
            } else {
              float topo = fbm(p * 3.8) + 0.55 * ridgedFbm(p * 9.5);
              albedo = mix(vec3(0.22, 0.08, 0.01), vec3(0.95, 0.55, 0.12), smoothstep(-0.25, 0.55, topo));
            }
          }
        }

        // =========================================================================
        // 4: MARS — 4K VIKING / MRO GLOBAL MOSAIC + DUST ATMOSPHERE RIM
        // =========================================================================
        else if (uShaderType == 4) {
          if (uHasDiffuseMap > 0.5) {
            albedo = pow(sampledDiffuse, vec3(1.02)) * 1.05;
          } else {
            float n = fbm(p * 3.0);
            albedo = mix(vec3(0.28, 0.11, 0.06), vec3(0.82, 0.38, 0.18), smoothstep(-0.3, 0.4, n));
          }
        }

        // =========================================================================
        // 5: JUPITER — 4K CASSINI/JUNO GLOBAL MOSAIC
        // =========================================================================
        else if (uShaderType == 5) {
          if (uHasDiffuseMap > 0.5) {
            albedo = pow(sampledDiffuse, vec3(0.98)) * 1.06;
          } else {
            float bands = sin(p.y * 28.0 + fbm(p * 4.0) * 1.5) * 0.5 + 0.5;
            albedo = mix(vec3(0.76, 0.44, 0.22), vec3(0.96, 0.91, 0.82), bands);
          }
        }

        // =========================================================================
        // 6: SATURN — 4K CASSINI MOSAIC + NORTH POLAR HEXAGON
        // =========================================================================
        else if (uShaderType == 6) {
          if (uHasDiffuseMap > 0.5) {
            albedo = pow(sampledDiffuse, vec3(0.98)) * 1.05;
          } else {
            float bands = sin(p.y * 42.0) * 0.5 + 0.5;
            albedo = mix(vec3(0.82, 0.69, 0.45), vec3(0.93, 0.84, 0.62), bands);
          }
        }

        // =========================================================================
        // 7: URANUS & 8: NEPTUNE — 2K VOYAGER 2 / HUBBLE MAPS
        // =========================================================================
        else if (uShaderType == 7 || uShaderType == 8) {
          if (uHasDiffuseMap > 0.5) {
            albedo = sampledDiffuse * 1.05;
          } else {
            albedo = uPrimaryColor;
          }
        }

        // =========================================================================
        // 9: PLUTO & TRITON
        // =========================================================================
        else if (uShaderType == 9) {
          float n = fbm(p * 3.8);
          vec3 cthulhuTholin = vec3(0.42, 0.19, 0.13);
          vec3 methaneOchre = vec3(0.85, 0.69, 0.57);
          vec3 sputnikHeart = vec3(0.97, 0.95, 0.92);
          albedo = mix(cthulhuTholin, methaneOchre, smoothstep(-0.25, 0.28, n));
          float heartDist = length((p - normalize(vec3(0.45, 0.22, 0.86))) * vec3(1.1, 1.2, 1.0));
          albedo = mix(albedo, sputnikHeart, smoothstep(0.38, 0.12, heartDist));
        }

        // =========================================================================
        // 12: MOON_ICY (EUROPA, ENCELADUS, GANYMEDE, CALLISTO)
        // =========================================================================
        else if (uShaderType == 12) {
          float iceBase = fbm(p * 4.5);
          float crack1 = 1.0 - smoothstep(0.0, 0.038, abs(sin(p.x * 16.0 + p.y * 10.0 + fbm(p * 5.5) * 2.6)));
          float crack2 = 1.0 - smoothstep(0.0, 0.032, abs(sin(p.z * 18.0 - p.y * 12.0 + fbm(p * 6.5) * 2.3)));
          float fractures = clamp(crack1 + crack2, 0.0, 1.0);
          albedo = mix(vec3(0.94, 0.97, 1.0), uSecondaryColor, fractures * 0.68 + (1.0 - iceBase) * 0.12);
          specularStrength = 0.28;
        }

        // =========================================================================
        // 13: MOON_VOLCANIC (IO)
        // =========================================================================
        else if (uShaderType == 13) {
          float sulfur = fbm(p * 4.5);
          float calderas = smoothstep(0.60, 0.75, snoise(p * 9.0));
          albedo = mix(vec3(0.92, 0.39, 0.08), vec3(0.97, 0.86, 0.24), smoothstep(-0.3, 0.35, sulfur));
          albedo = mix(albedo, vec3(0.12, 0.06, 0.04), calderas);
          nightEmission = vec3(1.0, 0.30, 0.02) * calderas * smoothstep(0.15, -0.25, baseNdotL) * 1.5;
        }

        // =========================================================================
        // 14: MOON_TITAN
        // =========================================================================
        else if (uShaderType == 14) {
          float hazeBands = sin(p.y * 12.0) * 0.5 + 0.5;
          float surfaceDunes = fbm(p * 4.5);
          albedo = mix(vec3(0.56, 0.32, 0.10), vec3(0.92, 0.59, 0.17), smoothstep(-0.2, 0.35, surfaceDunes) * 0.4 + 0.6);
          albedo = mix(albedo, vec3(0.96, 0.69, 0.26), hazeBands * 0.25);
          specularStrength = 0.20;
        }

        float spec = pow(max(dot(N, H), 0.0), shininess) * specularStrength * dayFactor;
        vec3 atmosphereRim = uAtmosphereColor * fresnel * (dayFactor * 0.55 + twilightFactor * 0.75);
        vec3 twilightTint = vec3(0.96, 0.44, 0.18) * twilightFactor * 0.12;

        vec3 litColor =
          albedo * (0.045 + 0.955 * dayFactor) +
          twilightTint +
          vec3(1.0, 0.98, 0.94) * spec +
          atmosphereRim +
          nightEmission;

        gl_FragColor = vec4(litColor, 1.0);
      }
    `,
  });
}

export function createAtmosphereHaloMaterial(atmosphereHex: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uSunViewPosition: { value: new THREE.Vector3(0, 0, 0) },
      uAtmosphereColor: { value: new THREE.Color(atmosphereHex) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vViewNormal;
      varying vec3 vViewPos;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunViewPosition;
      uniform vec3 uAtmosphereColor;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;

      void main() {
        vec3 N = normalize(vViewNormal);
        vec3 L = normalize(uSunViewPosition - vViewPos);
        vec3 V = normalize(-vViewPos);

        float viewDot = abs(dot(N, V));
        float rim = pow(clamp(1.0 - viewDot, 0.0, 1.0), 2.8);
        float sunLight = smoothstep(-0.25, 0.45, dot(N, L));
        float alpha = rim * (0.06 + 0.94 * sunLight) * 0.88;

        gl_FragColor = vec4(uAtmosphereColor * 1.25, alpha);
      }
    `,
  });
}

/**
 * Ultra-Detailed Saturn Ring System Shader with hundreds of fine Cassini ringlets,
 * crystalline ice forward/back-scattering, Cassini Division, Encke & Keeler gaps,
 * and real-time shadow of Saturn cast across the ring plane in View Space (zero float32 jitter).
 */
export function createSaturnRingsShaderMaterial(saturnRadiusSceneUnits: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uSunViewPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetViewPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetRadius: { value: saturnRadiusSceneUnits },
      uInnerRadius: { value: saturnRadiusSceneUnits * 1.18 },
      uOuterRadius: { value: saturnRadiusSceneUnits * 2.42 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vViewPos;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPos = mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunViewPosition;
      uniform vec3 uPlanetViewPosition;
      uniform float uPlanetRadius;
      uniform float uInnerRadius;
      uniform float uOuterRadius;

      varying vec3 vViewPos;
      varying vec3 vLocalPos;

      void main() {
        float r = length(vLocalPos.xy);
        float t = clamp((r - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);
        if (t <= 0.0 || t >= 1.0) discard;

        float wave1 = sin(t * 620.0) * 0.5 + 0.5;
        float wave2 = cos(t * 210.0 + sin(t * 45.0) * 2.0) * 0.5 + 0.5;
        float wave3 = sin(t * 1450.0) * 0.5 + 0.5;
        float microStructure = 0.78 + 0.14 * wave1 + 0.08 * wave3;

        vec3 ringColor = vec3(0.88, 0.81, 0.68);
        float alpha = 0.0;

        // D Ring (0.00 - 0.085)
        if (t < 0.085) {
          alpha = smoothstep(0.0, 0.075, t) * 0.14 * microStructure;
          ringColor = vec3(0.58, 0.53, 0.47);
        }
        // C Ring / Crepe Ring (0.085 - 0.305)
        else if (t < 0.305) {
          alpha = (0.26 + 0.12 * wave2) * microStructure;
          ringColor = mix(vec3(0.64, 0.59, 0.52), vec3(0.76, 0.70, 0.60), wave1);
        }
        // B Ring (0.305 - 0.635): Dense, brilliant crystalline water ice
        else if (t < 0.635) {
          float bEdge = smoothstep(0.305, 0.33, t) * (1.0 - smoothstep(0.62, 0.635, t));
          alpha = (0.82 + 0.16 * wave2) * bEdge * microStructure;
          ringColor = mix(vec3(0.85, 0.77, 0.63), vec3(0.98, 0.93, 0.82), 0.45 + 0.55 * wave2);
        }
        // CASSINI DIVISION (0.635 - 0.695): 4,700 km resonance gap with faint Huygens ringlet
        else if (t < 0.695) {
          float huygensRinglet = exp(-pow((t - 0.652) * 220.0, 2.0)) * 0.28;
          alpha = 0.03 + huygensRinglet;
          ringColor = vec3(0.52, 0.48, 0.44);
        }
        // A Ring (0.695 - 0.945): With sharp Encke Gap (0.875) & Keeler Gap (0.936)
        else if (t < 0.945) {
          float enckeGap = 1.0 - smoothstep(0.011, 0.002, abs(t - 0.875)) * 0.96;
          float keelerGap = 1.0 - smoothstep(0.004, 0.001, abs(t - 0.936)) * 0.98;
          alpha = (0.62 + 0.08 * wave1) * enckeGap * keelerGap * microStructure;
          ringColor = mix(vec3(0.80, 0.75, 0.66), vec3(0.91, 0.86, 0.78), wave2 * 0.5);
        }
        // F Ring (0.978 - 0.992): Narrow braided shepherd ring
        else {
          float fRing = exp(-pow((t - 0.984) * 160.0, 2.0));
          alpha = fRing * 0.75;
          ringColor = vec3(0.94, 0.91, 0.85);
        }

        // Real-time shadow of Saturn cast onto the rings in View Space
        vec3 toSun = normalize(uSunViewPosition - vViewPos);
        vec3 fromPlanet = vViewPos - uPlanetViewPosition;
        float proj = dot(fromPlanet, toSun);
        float shadowFactor = 1.0;
        if (proj < 0.0) {
          vec3 closestVec = fromPlanet - proj * toSun;
          float perpDist = length(closestVec);
          shadowFactor = smoothstep(uPlanetRadius * 0.93, uPlanetRadius * 1.01, perpDist);
        }

        vec3 viewDir = normalize(-vViewPos);
        float phaseScatter = 1.0 + 0.25 * pow(max(dot(viewDir, -toSun), 0.0), 3.0);

        vec3 finalColor = ringColor * phaseScatter * (0.06 + 0.94 * shadowFactor);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });
}

/**
 * Volumetric Spacetime Warp Cylinder Shader for Smooth Interplanetary Flight
 */
export function createWarpTunnelShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      void main() {
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vPos;

      ${NOISE_GLSL}

      void main() {
        float angle = vUv.x * 6.2831853;
        float zCoord = vUv.y * 12.0 - uTime * 9.5;
        vec3 samplePos = vec3(cos(angle) * 2.5, sin(angle) * 2.5, zCoord);

        float streaks = ridgedFbm(samplePos * vec3(2.2, 2.2, 0.35));
        float plasma = fbm(samplePos * vec3(1.2, 1.2, 0.2) + vec3(0.0, 0.0, -uTime * 4.0));

        float endFade = sin(vUv.y * 3.14159265);
        float alpha = endFade * pow(streaks, 2.2) * uIntensity * 0.72;

        vec3 cyanShift = vec3(0.20, 0.78, 1.0);
        vec3 indigoCore = vec3(0.45, 0.35, 1.0);
        vec3 whiteStreak = vec3(0.92, 0.97, 1.0);

        vec3 col = mix(indigoCore, cyanShift, plasma * 0.5 + 0.5);
        col = mix(col, whiteStreak, smoothstep(0.65, 0.95, streaks));

        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
      }
    `,
  });
}

/**
 * 360° Deep Space & Interior Milky Way Panorama Skybox Shader
 * Renders the authentic night sky viewed from the Orion Arm inside the Milky Way:
 * - Tilted at 60.2° Galactic Plane inclination relative to the Ecliptic
 * - Warm golden-amber Galactic Center (Sagittarius) glow
 * - Silvery-blue diffuse starlight band along the Galactic Equator
 * - Dark interstellar extinction filaments ("The Great Rift" / Cygnus Rift) via ridgedFbm
 * - Subtle H-II emission regions (Orion, Carina, Lagoon, North America Nebulae)
 * - Smoothly dims the interior Milky Way band as uMacroGalaxyFade -> 1.0 when zooming out to intergalactic space
 */
export function createDeepSpaceSkyboxMaterial(bakeMilkyWayOnly = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMacroGalaxyFade: { value: 0.0 },
      uBakeMilkyWayOnly: { value: bakeMilkyWayOnly ? 1.0 : 0.0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uMacroGalaxyFade;
      uniform float uBakeMilkyWayOnly;
      varying vec3 vDir;

      ${NOISE_GLSL}

      void main() {
        vec3 d = normalize(vDir);

        // Rotate ecliptic direction into Galactic Coordinates (~60.2° inclination)
        float inc = 1.0507; // 60.2 deg
        float cI = cos(inc);
        float sI = sin(inc);
        float rotAz = 0.48;
        float cA = cos(rotAz);
        float sA = sin(rotAz);
        vec3 d1 = vec3(d.x * cA - d.z * sA, d.y, d.x * sA + d.z * cA);
        vec3 gDir = vec3(d1.x, d1.y * cI - d1.z * sI, d1.y * sI + d1.z * cI);

        // Galactic latitude b = asin(gDir.y), longitude l = atan(gDir.z, gDir.x)
        float galLat = gDir.y;

        // Multi-scale organic warp along the galactic equator
        float warp = fbm(gDir * 2.6 + vec3(1.7, -0.8, 2.3)) * 0.075;
        float warpedLat = galLat + warp;

        // Diffuse Milky Way band profile (narrow bright spine + wide soft halo)
        float mainBand = exp(-pow(warpedLat / 0.145, 2.0));
        float wideGlow = exp(-pow(warpedLat / 0.34, 2.0));

        // Galactic Center direction (toward Sagittarius A* at +X/-Z in world space)
        vec3 sgrDir = normalize(vec3(0.95, -0.02, -0.31));
        float towardCenter = max(dot(d, sgrDir), 0.0);
        float bulgeProximity = pow(towardCenter, 2.4) * exp(-pow(warpedLat / 0.22, 2.0));

        // Fine stellar cloud structure along the Milky Way band
        float starCloudA = fbm(gDir * 5.2 + vec3(0.4, 1.1, -0.9));
        float starCloudB = fbm(gDir * 13.5 - vec3(2.1, 0.5, 1.4));
        float cloudDensity = clamp(0.58 + 0.32 * starCloudA + 0.18 * starCloudB, 0.0, 1.35);

        // Great Rift dark interstellar dust lanes splitting the Milky Way spine
        float riftNoise = ridgedFbm(vec3(gDir.x * 4.8, warpedLat * 14.0, gDir.z * 4.8) + vec3(0.8, 0.0, -1.2));
        float dustCoreMask = exp(-pow(warpedLat / 0.068, 2.0));
        float dustExtinction = clamp(smoothstep(0.42, 0.86, riftNoise) * dustCoreMask * 0.78, 0.0, 0.82);

        // Subtle H-II emission nebulae knots along the galactic plane
        float nebNoise = fbm(gDir * 8.5 + vec3(3.1, -1.7, 0.6));
        float hIIGlow = smoothstep(0.32, 0.72, nebNoise) * mainBand * (0.35 + 0.65 * towardCenter);

        // Deep cosmic void base color (ultra-clean dark slate-indigo black)
        vec3 voidColor = vec3(0.004, 0.007, 0.016);

        // Milky Way palette: silvery-slate outer arms, warm golden-ivory Sagittarius core, rose-magenta H-II regions
        vec3 armStarlight = vec3(0.11, 0.15, 0.25);
        vec3 innerDiskWarm = vec3(0.26, 0.22, 0.17);
        vec3 bulgeGold = vec3(0.42, 0.31, 0.20);
        vec3 hIIColor = vec3(0.28, 0.10, 0.18);
        vec3 darkDustColor = vec3(0.012, 0.014, 0.022);

        vec3 mwColor = armStarlight * (mainBand * 0.75 + wideGlow * 0.32) * cloudDensity;
        mwColor += innerDiskWarm * mainBand * pow(towardCenter, 1.3) * 0.65 * cloudDensity;
        mwColor += bulgeGold * bulgeProximity * 0.85 * (0.7 + 0.3 * starCloudA);
        mwColor += hIIColor * hIIGlow * 0.45;

        // Apply Great Rift dark dust absorption
        mwColor = mix(mwColor, darkDustColor, dustExtinction);

        // Faint extragalactic cosmic web glow remaining when zoomed outside the Milky Way
        float cosmicWeb = max(0.0, fbm(d * 3.2) * 0.5 + 0.2) * 0.018;
        vec3 intergalacticBg = voidColor + vec3(0.012, 0.018, 0.032) * cosmicWeb;

        // As the camera zooms out into intergalactic space (uMacroGalaxyFade -> 1.0),
        // the interior 360° Milky Way band fades down so the 3D Volumetric Milky Way takes over cleanly
        if (uBakeMilkyWayOnly > 0.5) {
          gl_FragColor = vec4(mwColor + vec3(0.012, 0.018, 0.032) * cosmicWeb, 1.0);
          return;
        }
        float interiorVisibility = 1.0 - uMacroGalaxyFade * 0.86;
        vec3 finalSky = intergalacticBg + mwColor * interiorVisibility;

        gl_FragColor = vec4(finalSky, 1.0);
      }
    `,
  });
}

/**
 * Ultra-fast pre-baked CubeMap Skybox Shader (~50x less mobile GPU fragment cost vs live 35-octave noise).
 */
export function createBakedDeepSpaceSkyboxMaterial(skyCubeTexture: THREE.CubeTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMacroGalaxyFade: { value: 0.0 },
      uSkyCube: { value: skyCubeTexture },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uMacroGalaxyFade;
      uniform samplerCube uSkyCube;
      varying vec3 vDir;

      void main() {
        vec3 bakedBands = textureCube(uSkyCube, normalize(vDir)).rgb;
        vec3 voidColor = vec3(0.004, 0.007, 0.016);
        float interiorVisibility = 1.0 - uMacroGalaxyFade * 0.86;
        gl_FragColor = vec4(voidColor + bakedBands * interiorVisibility, 1.0);
      }
    `,
  });
}

/**
 * Custom GLSL Per-Star Magnitude & Blackbody Shader for 45,000 Realistic Background Stars
 * - Faint stars (94%) render as ultra-crisp 1px-2.2px pinpoints with sub-pixel anti-aliasing
 * - Medium constellation stars (5%) render with soft Gaussian photospheres
 * - Only the top ~1% brightest navigational stars (aMagnitude > 0.91) render Airy halos & delicate 4-point diffraction rays
 */
export function createRealisticStarfieldMaterial(
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      attribute float aMagnitude;
      attribute float aPhase;
      attribute vec3 aColor;

      uniform float uTime;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vMagnitude;
      varying float vTwinkle;

      void main() {
        vColor = aColor;
        vMagnitude = aMagnitude;

        // Subtle scintillation only on faint/medium stars
        float twinkleAmp = mix(0.18, 0.04, aMagnitude);
        vTwinkle = 1.0 - twinkleAmp + twinkleAmp * sin(uTime * (1.4 + aMagnitude * 1.8) + aPhase);

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Nonlinear magnitude-to-size mapping:
        // Faint background stars: 1.1px - 2.3px
        // Medium stars: 2.5px - 4.8px
        // Bright hero stars (aMagnitude > 0.90): up to 13px to accommodate delicate diffraction rays
        float basePx = 1.15 + pow(aMagnitude, 3.2) * 3.8;
        if (aMagnitude > 0.91) {
          float heroT = (aMagnitude - 0.91) / 0.09;
          basePx += heroT * 9.5;
        }
        gl_PointSize = basePx * uPixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vMagnitude;
      varying float vTwinkle;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv) * 2.0;
        if (d > 1.0) discard;

        // Crisp Gaussian core + soft Airy halo
        float core = exp(-d * d * (vMagnitude > 0.91 ? 18.0 : 9.5));
        float halo = exp(-d * 4.2) * (0.22 + 0.45 * vMagnitude);

        float spike = 0.0;
        if (vMagnitude > 0.91) {
          float heroStrength = (vMagnitude - 0.91) / 0.09;
          float sx = exp(-abs(uv.y) * 42.0) * exp(-abs(uv.x) * 4.5);
          float sy = exp(-abs(uv.x) * 42.0) * exp(-abs(uv.y) * 4.5);
          spike = (sx + sy) * 0.65 * heroStrength;
        }

        float intensity = (core + halo + spike) * vTwinkle;
        float brightness = 0.28 + 0.72 * pow(vMagnitude, 1.45);
        float alpha = clamp(intensity * brightness, 0.0, 1.0);
        if (alpha < 0.015) discard;

        vec3 finalCol = mix(vColor, vec3(1.0, 0.99, 0.97), clamp(core * 0.75 + spike * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export interface VolumetricGalaxyDiskConfig {
  galaxyId: string;
  subType: string;
  coreColorHex: string;
  bulgeColorHex: string;
  armColorHex: string;
  nebulaColorHex: string;
  layerOffset?: number;
}

/**
 * High-Definition Volumetric Spiral / Barred / Elliptical / Sombrero Galaxy Disk Shader
 * Inspired by Cosmoscope.space:
 * - Renders continuous, silky-smooth galactic luminosity so the galaxy never looks like sparse disconnected dots
 * - Features a warm golden-white central barred bulge, 4 logarithmic density-wave spiral arms + Orion Spur,
 *   dark winding interstellar dust extinction lanes, and rose-magenta H-II star-forming knots
 * - Supports uOpacity for seamless continuous zoom transitions between Galactic Scale and Solar System Scale
 */
export function createGalaxyVolumetricDiskMaterial(
  cfg: VolumetricGalaxyDiskConfig,
  highQualityShader = true
): THREE.ShaderMaterial {
  const isElliptical = cfg.subType === 'galaxy_elliptical';
  const isIrregular = cfg.subType === 'galaxy_irregular';
  const isBarred = cfg.subType === 'galaxy_barred';
  const isSombrero = cfg.galaxyId === 'sombrero-galaxy';
  const isWhirlpool = cfg.galaxyId === 'whirlpool-galaxy';
  const isMilkyWay = cfg.galaxyId === 'milky-way';

  let galaxyTypeInt = 0; // 0 = Barred Spiral (Milky Way)
  if (isElliptical) galaxyTypeInt = 3;
  else if (isSombrero) galaxyTypeInt = 2;
  else if (isIrregular) galaxyTypeInt = 4;
  else if (!isBarred) galaxyTypeInt = 1; // Grand-design spiral (Andromeda, Triangulum, Whirlpool)

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1.0 },
      uGalaxyType: { value: galaxyTypeInt },
      uArmCount: { value: isMilkyWay ? 4.0 : 2.0 },
      uSpiralWinding: {
        value: isWhirlpool ? 4.2 : cfg.galaxyId === 'triangulum' ? 2.8 : 3.4,
      },
      uIsWhirlpool: { value: isWhirlpool ? 1.0 : 0.0 },
      uLayerFactor: { value: cfg.layerOffset ?? 1.0 },
      uHighDetail: { value: highQualityShader ? 1.0 : 0.0 },
      uCoreColor: { value: new THREE.Color(cfg.coreColorHex) },
      uBulgeColor: { value: new THREE.Color(cfg.bulgeColorHex) },
      uArmColor: { value: new THREE.Color(cfg.armColorHex) },
      uNebulaColor: { value: new THREE.Color(cfg.nebulaColorHex) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vLocalPos;

      void main() {
        vUv = uv;
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uGalaxyType;
      uniform float uArmCount;
      uniform float uSpiralWinding;
      uniform float uIsWhirlpool;
      uniform float uLayerFactor;
      uniform float uHighDetail;
      uniform vec3 uCoreColor;
      uniform vec3 uBulgeColor;
      uniform vec3 uArmColor;
      uniform vec3 uNebulaColor;

      varying vec2 vUv;
      varying vec3 vLocalPos;

      ${NOISE_GLSL}

      void main() {
        if (uOpacity <= 0.002) discard;

        // Plane coordinates in [-1, 1] across the galaxy diameter
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;

        float theta = atan(p.y, p.x);
        vec3 pos3 = vec3(p.x * 3.2, uLayerFactor * 0.35, p.y * 3.2);

        float nCoarse = fbm(pos3 * 1.35 + vec3(0.7, 1.2, -0.5));
        float nMedium = uHighDetail > 0.5 ? fbm(pos3 * 3.4 - vec3(1.4, 0.3, 2.1)) : nCoarse * 0.72;
        float nFine = uHighDetail > 0.5 ? fbm(pos3 * 8.2 + vec3(2.3, -1.9, 0.8)) : snoise(pos3 * 7.5);
        float nRidged = uHighDetail > 0.5 ? ridgedFbm(pos3 * 3.8 + vec3(0.5, 0.2, -1.1)) : abs(nCoarse) * 0.78 + 0.22;

        vec3 col = vec3(0.0);
        float alpha = 0.0;

        // TYPE 3: Giant Elliptical Galaxy (M87)
        if (uGalaxyType > 2.5 && uGalaxyType < 3.5) {
          vec2 pEll = vec2(p.x / 1.12, p.y / 0.88);
          float rE = length(pEll);
          float deVaucouleurs = exp(-pow(rE * 3.1, 0.65)) * 1.35;
          float corePeak = exp(-rE * rE * 36.0);
          float cloudMod = 0.88 + 0.12 * nCoarse;
          col = mix(uBulgeColor, uCoreColor, clamp(corePeak + exp(-rE * 4.5) * 0.5, 0.0, 1.0)) * cloudMod;
          alpha = clamp((deVaucouleurs + corePeak * 0.6) * (1.0 - smoothstep(0.78, 0.99, r)), 0.0, 0.95);
        }
        // TYPE 2: Sombrero Galaxy (M104) with luminous bulge & sharp equatorial dust lane ring
        else if (uGalaxyType > 1.5 && uGalaxyType < 2.5) {
          float bulge = exp(-r * r * 11.5) * 1.25 + exp(-r * 3.6) * 0.55;
          float outerRing = exp(-pow((r - 0.74) / 0.095, 2.0)) * (0.75 + 0.25 * nMedium);
          float dustRing = exp(-pow((r - 0.71) / 0.032, 2.0)) * (0.78 + 0.22 * nRidged);

          col = mix(uBulgeColor, uCoreColor, exp(-r * r * 22.0));
          col = mix(col, uArmColor, outerRing * 0.65);
          col = mix(col, vec3(0.03, 0.025, 0.03), clamp(dustRing * 0.88, 0.0, 0.88));
          alpha = clamp((bulge + outerRing * 0.78) * (1.0 - smoothstep(0.84, 0.99, r)), 0.0, 0.96);
        }
        // TYPE 4: Irregular Magellanic Galaxy (LMC)
        else if (uGalaxyType > 3.5) {
          vec2 barP = vec2(p.x * 0.9 + p.y * 0.22, p.y * 1.8 - p.x * 0.25);
          float barGlow = exp(-dot(barP, barP) * 5.2) * (0.75 + 0.35 * nCoarse);
          vec2 tarantulaP = p - vec2(0.32, 0.18);
          float tarantulaGlow = exp(-dot(tarantulaP, tarantulaP) * 32.0) * (0.8 + 0.4 * nFine);
          float irrDisk = exp(-r * r * 3.4) * clamp(0.55 + 0.45 * nCoarse + 0.25 * nMedium, 0.0, 1.2);

          col = mix(uArmColor, uCoreColor, clamp(barGlow * 0.85, 0.0, 1.0));
          col = mix(col, uNebulaColor, clamp(tarantulaGlow * 0.85, 0.0, 1.0));
          alpha = clamp((irrDisk * 0.65 + barGlow * 0.55 + tarantulaGlow * 0.65) * (1.0 - smoothstep(0.75, 0.98, r)), 0.0, 0.92);
        }
        // TYPE 0 & 1: Barred Spiral (Milky Way) & Grand-Design Spiral (Andromeda, Triangulum, Whirlpool)
        else {
          // 1. Central Galactic Core & Barred Bulge (warm golden-cream like Cosmoscope's Milky Way)
          float barAngle = 0.42;
          float cB = cos(barAngle);
          float sB = sin(barAngle);
          vec2 bPos = vec2(p.x * cB + p.y * sB, -p.x * sB + p.y * cB);
          vec2 barScale = uGalaxyType < 0.5 ? vec2(1.0 / 0.34, 1.0 / 0.165) : vec2(1.0 / 0.24, 1.0 / 0.21);
          float barDist = length(bPos * barScale);

          float nuclearCore = exp(-r * r * 68.0) * 1.35;
          float centralBulge = exp(-pow(barDist, 1.55) * 1.65) * (0.92 + 0.12 * nCoarse);
          float softInnerHalo = exp(-r * r * 5.2) * 0.48;

          // 2. Logarithmic Density-Wave Spiral Arms
          float logR = log(max(r, 0.045));
          float spiralPhase = theta * uArmCount - logR * (uSpiralWinding * uArmCount) + nCoarse * 0.85;
          float primaryArms = pow(0.5 + 0.5 * cos(spiralPhase), 1.85);

          // Secondary branching spurs (including the Orion-Cygnus Spur where the Solar System lives!)
          float spurPhase = theta * (uArmCount * 2.0) - logR * (uSpiralWinding * uArmCount * 2.15) + nMedium * 1.25;
          float secondarySpurs = pow(0.5 + 0.5 * cos(spurPhase), 2.6) * 0.48;

          // Radial envelope for spiral arms (smoothly emerging from the bar/bulge and tapering at the outer rim)
          float armRadialMask = smoothstep(0.08, 0.24, r) * (1.0 - smoothstep(0.66, 0.97, r));
          float cloudGranularity = clamp(0.62 + 0.28 * nMedium + 0.22 * nFine, 0.2, 1.35);
          float armLuminosity = (primaryArms * 0.82 + secondarySpurs) * armRadialMask * cloudGranularity;

          // 3. Diffuse Stellar Disk Continuum (fills the inter-arm regions with realistic silvery-blue mist)
          float diskContinuum = exp(-r * r * 3.1) * (1.0 - smoothstep(0.74, 0.99, r)) * (0.34 + 0.16 * nCoarse);

          // 4. Dark Winding Interstellar Dust Extinction Lanes along the concave inner edges of spiral arms
          float dustPhase = spiralPhase + 0.62;
          float dustSpiral = pow(0.5 + 0.5 * cos(dustPhase), 3.4);
          float dustFilaments = smoothstep(0.44, 0.86, nRidged) * (0.45 + 0.55 * dustSpiral);
          float dustMask = smoothstep(0.07, 0.20, r) * (1.0 - smoothstep(0.62, 0.88, r));
          float dustExtinction = clamp(dustFilaments * dustMask * 0.72, 0.0, 0.78);

          // 5. H-II Star-Forming Emission Nebulae Knots along the spiral crests
          float hIIMask = pow(primaryArms, 3.2) * smoothstep(0.54, 0.82, nFine) * armRadialMask;

          // Combine colors:
          // Golden-ivory center -> warm amber-gold inner bar -> cool silvery-blue & lavender-blue outer spiral arms
          vec3 bulgeCol = mix(uBulgeColor, uCoreColor, clamp(nuclearCore * 0.85 + exp(-r * r * 20.0) * 0.5, 0.0, 1.0));
          vec3 armCol = mix(uBulgeColor * 0.85, uArmColor, smoothstep(0.14, 0.46, r));
          armCol = mix(armCol, vec3(0.82, 0.88, 1.0), primaryArms * 0.35 * smoothstep(0.22, 0.65, r));

          vec3 totalLight =
            bulgeCol * (nuclearCore + centralBulge * 0.95 + softInnerHalo * 0.55) +
            armCol * (armLuminosity * 0.88 + diskContinuum * 0.65) +
            uNebulaColor * (hIIMask * 0.62);

          // Interstellar dark dust absorption (rich dark umber-slate lanes like Cosmoscope's Milky Way)
          vec3 darkDustTone = vec3(0.035, 0.032, 0.048);
          totalLight = mix(totalLight, darkDustTone, dustExtinction * (1.0 - nuclearCore * 0.8));

          // Optional companion galaxy NGC 5195 for Whirlpool Galaxy (M51)
          if (uIsWhirlpool > 0.5) {
            vec2 compP = p - vec2(0.76, 0.44);
            float compR = length(compP);
            float compGlow = exp(-compR * compR * 48.0) * 1.15;
            totalLight += mix(uBulgeColor, uCoreColor, 0.6) * compGlow;
          }

          col = totalLight;
          float rawAlpha =
            nuclearCore +
            centralBulge * 0.88 +
            softInnerHalo * 0.45 +
            armLuminosity * 0.76 +
            diskContinuum * 0.55 +
            dustExtinction * 0.28;
          alpha = clamp(rawAlpha * (1.0 - smoothstep(0.80, 0.995, r)), 0.0, 0.95);
        }

        // Multi-plane volumetric layer attenuation
        float layerAlphaScale = uLayerFactor < 0.99 ? 0.36 : 0.84;
        gl_FragColor = vec4(col, alpha * layerAlphaScale * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}

/**
 * Custom GLSL Point Shader for 85,000 Variable-Size 3D Galaxy Star Particles & Globular Clusters
 * Scales point size smoothly with perspective and supports uOpacity for continuous multi-scale zoom!
 */
export function createGalaxyStarParticlesMaterial(pixelRatio = Math.min(window.devicePixelRatio || 1, 2)): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1.0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute vec3 color;

      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vSize;

      void main() {
        vColor = color;
        vSize = aSize;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Perspective-attenuated star size with crisp clamp so galaxy stars look like fine diamond dust
        float dist = max(-mvPosition.z, 1.0);
        float scaledSize = (aSize * 420.0 / dist) * uPixelRatio;
        gl_PointSize = clamp(scaledSize, 1.0 * uPixelRatio, 5.2 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vSize;

      void main() {
        if (uOpacity <= 0.002) discard;

        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv) * 2.0;
        if (d > 1.0) discard;

        float core = exp(-d * d * 10.5);
        float halo = exp(-d * 3.8) * 0.32;
        float alpha = clamp((core + halo) * uOpacity, 0.0, 1.0);
        if (alpha < 0.015) discard;

        vec3 col = mix(vColor, vec3(1.0, 0.99, 0.96), core * 0.55);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

