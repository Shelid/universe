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
      varying vec3 vNormal;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      varying vec2 vUv;
      varying vec3 vTangent;
      varying vec3 vBitangent;

      void main() {
        vUv = uv;
        vLocalPos = normalize(position);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        mat3 normalMat = mat3(modelMatrix);
        vNormal = normalize(normalMat * normal);

        // Compute spherical tangent frame for 4K normal / crater relief mapping
        vec3 localTangent = normalize(vec3(-position.z, 0.0, position.x + 0.0001));
        vec3 localBitangent = normalize(cross(normal, localTangent));
        vTangent = normalize(normalMat * localTangent);
        vBitangent = normalize(normalMat * localBitangent);

        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunPosition;
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

      varying vec3 vNormal;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      varying vec2 vUv;
      varying vec3 vTangent;
      varying vec3 vBitangent;

      ${NOISE_GLSL}

      void main() {
        // 1. Sample all 4K textures in uniform control flow at top of main()
        vec3 sampledDiffuse = texture2D(uDiffuseMap, vUv).rgb;
        // Neighboring texels for crisp 4K crater/terrain normal relief on Moon, Mercury, Mars
        float texStepU = 0.00035;
        float texStepV = 0.00065;
        vec3 sampledDiffuseRight = texture2D(uDiffuseMap, vUv + vec2(texStepU, 0.0)).rgb;
        vec3 sampledDiffuseUp = texture2D(uDiffuseMap, vUv + vec2(0.0, texStepV)).rgb;

        // Animated 4K Cloud UVs + Sun-offset shadow UVs
        vec2 cloudUv = vec2(fract(vUv.x - uTime * 0.00035), vUv.y);
        vec2 cloudShadowUv = vec2(fract(cloudUv.x + 0.0018), clamp(cloudUv.y - 0.0014, 0.0, 1.0));
        vec3 sampledClouds = texture2D(uCloudsMap, cloudUv).rgb;
        vec3 sampledCloudsShadow = texture2D(uCloudsMap, cloudShadowUv).rgb;

        vec3 sampledNight = texture2D(uNightMap, vUv).rgb;
        vec3 sampledAux = texture2D(uAuxMap, vUv).rgb;
        vec3 sampledNormal = texture2D(uNormalMap, vUv).rgb;

        if (uCutawayEnabled > 0.5) {
          if (vLocalPos.x > 0.0 && vLocalPos.y > -0.12 && vLocalPos.z > 0.0) {
            discard;
          }
        }

        vec3 baseN = normalize(vNormal);
        vec3 T = normalize(vTangent);
        vec3 B = normalize(vBitangent);
        vec3 L = normalize(uSunPosition - vWorldPos);
        vec3 V = normalize(vViewDir);
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
      uAtmosphereColor: { value: new THREE.Color(atmosphereHex) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunPosition;
      uniform vec3 uAtmosphereColor;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

      void main() {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(uSunPosition - vWorldPos);
        vec3 V = normalize(vViewDir);

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
 * and real-time shadow of Saturn cast across the ring plane.
 */
export function createSaturnRingsShaderMaterial(saturnRadiusSceneUnits: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetRadius: { value: saturnRadiusSceneUnits },
      uInnerRadius: { value: saturnRadiusSceneUnits * 1.18 },
      uOuterRadius: { value: saturnRadiusSceneUnits * 2.42 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunPosition;
      uniform vec3 uPlanetPosition;
      uniform float uPlanetRadius;
      uniform float uInnerRadius;
      uniform float uOuterRadius;

      varying vec3 vWorldPos;
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

        // Real-time shadow of Saturn cast onto the rings
        vec3 toSun = normalize(uSunPosition - vWorldPos);
        vec3 fromPlanet = vWorldPos - uPlanetPosition;
        float proj = dot(fromPlanet, toSun);
        float shadowFactor = 1.0;
        if (proj < 0.0) {
          vec3 closestVec = fromPlanet - proj * toSun;
          vec3 scaledClosest = vec3(closestVec.x, closestVec.y / 0.902, closestVec.z);
          float perpDist = length(scaledClosest);
          shadowFactor = smoothstep(uPlanetRadius * 0.95, uPlanetRadius * 1.02, perpDist);
        }

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
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
