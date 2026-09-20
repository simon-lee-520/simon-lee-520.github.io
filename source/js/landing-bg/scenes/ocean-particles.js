import * as THREE from 'three'
import { FEATURED_CYAN, hexToRgbVec3 } from '../materials/featured-scene.js'

/** 线上 featured 粒子：sprite 图集 32×8 */
const SPRITE_URL = '/models/landing/sprite.png'
const SPRITE_COLS = 32
const SPRITE_ROWS = 8
const SPRITE_COUNT = SPRITE_COLS * SPRITE_ROWS

const SIMPLEX_DERIV = `
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
float permute(float x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float taylorInvSqrt(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www;
  return p;
}
#define F4 0.309016994374947451
vec4 simplexNoiseDerivatives4(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(v + dot(v, vec4(F4)));
  vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0;
  vec3 isX = step(x0.yzw, x0.xxx);
  vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0);
  vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
  vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;
  i = mod289(i);
  float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute(permute(permute(permute(
    i.w + vec4(i1.w, i2.w, i3.w, 1.0))
    + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
    + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
    + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = grad4(j0, ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4, p4));
  vec3 values0 = vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2));
  vec2 values1 = vec2(dot(p3, x3), dot(p4, x4));
  vec3 m0 = max(0.5 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
  vec2 m1 = max(0.5 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  vec3 temp0 = -6.0 * m0 * m0 * values0;
  vec2 temp1 = -6.0 * m1 * m1 * values1;
  vec3 mmm0 = m0 * m0 * m0;
  vec2 mmm1 = m1 * m1 * m1;
  float dx = temp0[0] * x0.x + temp0[1] * x1.x + temp0[2] * x2.x + temp1[0] * x3.x + temp1[1] * x4.x + mmm0[0] * p0.x + mmm0[1] * p1.x + mmm0[2] * p2.x + mmm1[0] * p3.x + mmm1[1] * p4.x;
  float dy = temp0[0] * x0.y + temp0[1] * x1.y + temp0[2] * x2.y + temp1[0] * x3.y + temp1[1] * x4.y + mmm0[0] * p0.y + mmm0[1] * p1.y + mmm0[2] * p2.y + mmm1[0] * p3.y + mmm1[1] * p4.y;
  float dz = temp0[0] * x0.z + temp0[1] * x1.z + temp0[2] * x2.z + temp1[0] * x3.z + temp1[1] * x4.z + mmm0[0] * p0.z + mmm0[1] * p1.z + mmm0[2] * p2.z + mmm1[0] * p3.z + mmm1[1] * p4.z;
  float dw = temp0[0] * x0.w + temp0[1] * x1.w + temp0[2] * x2.w + temp1[0] * x3.w + temp1[1] * x4.w + mmm0[0] * p0.w + mmm0[1] * p1.w + mmm0[2] * p2.w + mmm1[0] * p3.w + mmm1[1] * p4.w;
  return vec4(dx, dy, dz, dw) * 49.0;
}
`

/** featured 用的是 curl4Mid（不是 curl4Low） */
const CURL = `
${SIMPLEX_DERIV}
vec3 curl(in vec3 p, in float noiseTime, in float persistence) {
  vec4 xNoisePotentialDerivatives = vec4(0.0);
  vec4 yNoisePotentialDerivatives = vec4(0.0);
  vec4 zNoisePotentialDerivatives = vec4(0.0);
  for (int i = 0; i < 2; ++i) {
    float twoPowI = pow(2.0, float(i));
    float scale = 0.5 * twoPowI * pow(max(0.0, persistence), float(i));
    xNoisePotentialDerivatives += simplexNoiseDerivatives4(vec4(p * twoPowI, noiseTime)) * scale;
    yNoisePotentialDerivatives += simplexNoiseDerivatives4(vec4((p + vec3(123.4, 129845.6, -1239.1)) * twoPowI, noiseTime)) * scale;
    zNoisePotentialDerivatives += simplexNoiseDerivatives4(vec4((p + vec3(-9519.0, 9051.0, -123.0)) * twoPowI, noiseTime)) * scale;
  }
  return vec3(
    zNoisePotentialDerivatives[1] - yNoisePotentialDerivatives[2],
    xNoisePotentialDerivatives[2] - zNoisePotentialDerivatives[0],
    yNoisePotentialDerivatives[0] - xNoisePotentialDerivatives[1]
  );
}
`

const GET_SCATTER_FN = `
float getScatter(vec3 start, vec3 dir, vec3 lightPos, float d) {
  vec3 q = start - lightPos;
  float b = dot(dir, q);
  float c = dot(q, q);
  float t = c - b * b;
  float s = 1.0 / sqrt(max(0.0, t));
  float l = s * (atan((d + b) * s) - atan(b * s));
  return pow(max(0.0, l / u_lightScatterDivider), u_lightScatterPowInv);
}
`

function nextPow2 (n) {
  return 2 ** Math.ceil(Math.log2(Math.max(1, n)))
}

function powerTwoTextureSize (count) {
  const w = nextPow2(Math.sqrt(count))
  const h = nextPow2(Math.ceil(count / w))
  return { w, h }
}

function makeFloatTarget (w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false
  })
  rt.texture.colorSpace = THREE.NoColorSpace
  return rt
}

/**
 * featured 幕粒子：位置存在 float 贴图里，curl 推动，sprite 法线受光。
 * 常量与着色器来自线上 index.js，不做额外观感层。
 */
function resolveViewportCssHeight (getViewportCssHeight) {
  const fromMetrics = getViewportCssHeight?.()
  if (Number.isFinite(fromMetrics) && fromMetrics > 0) return fromMetrics
  const winH = window.innerHeight || 1
  return (window.innerWidth || 1) > 1280 ? winH : Math.max(1, winH - 70)
}

function resolvePointViewportHeight (renderer, getViewportCssHeight) {
  const cssH = resolveViewportCssHeight(getViewportCssHeight)
  // 线上无 setPixelRatio，i.height 即 drawing buffer 高；我们有 DPR 时要乘上，CSS 点径才对齐
  const dpr = renderer.getPixelRatio?.() || window.devicePixelRatio || 1
  return cssH * dpr
}

export function createFeaturedParticleField (
  renderer,
  sharedUniforms,
  cameraPosition,
  { getViewportCssHeight } = {}
) {
  // 线上：pointCount = 64 * ceil(screen.height / 30)，贴图补齐后全画
  const pointCount = 64 * Math.ceil((window.screen?.height || window.innerHeight) / 30)
  const { w, h } = powerTwoTextureSize(pointCount)
  const count = w * h

  // tall film 水平半宽≈2.1；default 球心必须在 0，线上的 +2 会整团顶死在右缘
  const REBORN_Y_SPAN = 1.6
  const seed = new Float32Array(count * 4)
  for (let s = 0, t = 0; s < count; s++, t += 4) {
    const n = 1.8 * (0.7 + 0.3 * Math.random())
    const o = (Math.random() - 0.5) * Math.PI
    const a = Math.random() * Math.PI * 2
    seed[t] = n * Math.cos(a) * Math.cos(o)
    seed[t + 1] = n * Math.sin(o)
    seed[t + 2] = n * Math.sin(a) * Math.cos(o) * 2
    seed[t + 3] = s / count
  }
  const defaultTex = new THREE.DataTexture(seed, w, h, THREE.RGBAFormat, THREE.FloatType)
  defaultTex.magFilter = THREE.NearestFilter
  defaultTex.minFilter = THREE.NearestFilter
  defaultTex.colorSpace = THREE.NoColorSpace
  defaultTex.needsUpdate = true

  const rtA = makeFloatTarget(w, h)
  const rtB = makeFloatTarget(w, h)

  const simUniforms = {
    u_defaultPositionTexture: { value: defaultTex },
    u_positionTexture: { value: defaultTex },
    u_speed: { value: 0.0027 },
    u_dieSpeed: { value: 0.012 },
    u_curlSize: { value: 0.33 },
    u_rebornCenter: { value: new THREE.Vector3(0, 0, 0) },
    u_rebornYSpan: { value: REBORN_Y_SPAN },
    u_time: { value: 0 },
    u_attractor: { value: sharedUniforms.u_lightPosition.value }
  }

  const simMaterial = new THREE.ShaderMaterial({
    uniforms: simUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 v_uv;
      void main () {
        v_uv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D u_positionTexture;
      uniform sampler2D u_defaultPositionTexture;
      uniform float u_time;
      uniform float u_speed;
      uniform float u_dieSpeed;
      uniform float u_curlSize;
      uniform vec3 u_attractor;
      uniform vec3 u_rebornCenter;
      uniform float u_rebornYSpan;
      varying vec2 v_uv;
      ${CURL}
      void main () {
        vec4 positionInfo = texture2D(u_positionTexture, v_uv);
        positionInfo.w -= u_dieSpeed;
        if (positionInfo.w < 0.0) {
          positionInfo = texture2D(u_defaultPositionTexture, v_uv);
          positionInfo.w = positionInfo.w + 1.0;
          // 线上：default + rebornCenter；竖向 band 补直进幕没有长滚换代
          float bandY = fract(v_uv.x * 17.0 + v_uv.y * 29.0);
          positionInfo.xyz = positionInfo.xyz + u_rebornCenter;
          positionInfo.y += (bandY - 0.5) * u_rebornYSpan;
        } else {
          vec3 toAttractor = positionInfo.xyz - u_attractor;
          float attractorWeight = smoothstep(2.7, 0.36, length(toAttractor));
          positionInfo.xyz += curl(positionInfo.xyz * u_curlSize, u_time, 0.2 + (1.0 - positionInfo.w) * 0.2) * u_speed * (attractorWeight * attractorWeight * 4.0 + mix(2.0, 1.0, positionInfo.w));
          toAttractor = positionInfo.xyz - u_attractor;
          positionInfo.xyz += toAttractor * attractorWeight * -0.015;
        }
        gl_FragColor = positionInfo;
      }
    `
  })

  const simScene = new THREE.Scene()
  const simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial)
  quad.frustumCulled = false
  simScene.add(quad)

  const sprite = new THREE.TextureLoader().load(SPRITE_URL)
  sprite.magFilter = THREE.LinearFilter
  sprite.minFilter = THREE.LinearFilter
  sprite.colorSpace = THREE.NoColorSpace
  sprite.generateMipmaps = false

  const positions = new Float32Array(count * 3)
  const spriteIndex = new Float32Array(count)
  const pointSize = new Float32Array(count)
  for (let i = 0, y = 0; i < count; i++, y += 3) {
    positions[y] = ((i % w) + 0.5) / w
    positions[y + 1] = (Math.floor(i / w) + 0.5) / h
    positions[y + 2] = 0.2 + 0.8 * Math.random()
    spriteIndex[i] = Math.floor(Math.random() * SPRITE_COUNT) + 0.5
    pointSize[i] = 0.7 * Math.random() + 0.3
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('a_spriteIndex', new THREE.BufferAttribute(spriteIndex, 1))
  geo.setAttribute('a_pointSize', new THREE.BufferAttribute(pointSize, 1))

  const pointUniforms = {
    u_positionTexture: { value: rtB.texture },
    u_time: { value: 0 },
    u_color: { value: hexToRgbVec3(FEATURED_CYAN.pointColor) },
    u_viewportHeight: {
      value: resolvePointViewportHeight(renderer, getViewportCssHeight)
    },
    u_particleScale: { value: 12 },
    u_spriteTexture: { value: sprite },
    u_spriteTileTexelSizes: { value: new THREE.Vector2(1 / SPRITE_COLS, 1 / SPRITE_ROWS) },
    u_spriteTileSizes: { value: new THREE.Vector2(SPRITE_COLS, SPRITE_ROWS) },
    u_spriteCount: { value: SPRITE_COUNT },
    u_spriteIndexOffset: { value: 0 },
    u_depthFrom: { value: 1.021215625 },
    u_depthTo: { value: -1.01572 / 0.96 },
    u_lightDistance: sharedUniforms.u_lightDistance,
    u_diffMultiplier: sharedUniforms.u_diffMultiplier,
    u_specMultiplier: sharedUniforms.u_specMultiplier,
    u_lightColor: sharedUniforms.u_lightColor,
    u_lightScatterDivider: sharedUniforms.u_lightScatterDivider,
    u_lightScatterPowInv: sharedUniforms.u_lightScatterPowInv,
    u_lightPosition: sharedUniforms.u_lightPosition,
    u_cameraPosition: sharedUniforms.u_cameraPosition,
    u_lightViewPosition: sharedUniforms.u_lightViewPosition
  }

  const pointMaterial = new THREE.ShaderMaterial({
    uniforms: pointUniforms,
    blending: THREE.NoBlending,
    vertexShader: `
      attribute float a_spriteIndex;
      attribute float a_pointSize;
      uniform sampler2D u_positionTexture;
      uniform float u_viewportHeight;
      uniform vec2 u_spriteTileSizes;
      uniform float u_spriteIndexOffset;
      uniform float u_particleScale;
      varying vec3 v_worldPosition;
      varying vec3 v_viewPosition;
      varying float v_halfPointSize;
      varying vec2 v_spriteUvOffset;
      varying float v_brightness;
      void main () {
        vec4 positionInfo = texture2D(u_positionTexture, position.xy);
        vec3 pos = positionInfo.xyz;
        v_worldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float pointSize = position.z * (smoothstep(0.0, 0.2, positionInfo.a) * smoothstep(1.0, 0.8, positionInfo.a) * 35.0) / abs(mvPosition.z) * u_viewportHeight / 1080.0 * u_particleScale;
        v_viewPosition = -mvPosition.xyz;
        mvPosition.x += step(pointSize, 0.01) * 10000.0;
        gl_Position = projectionMatrix * mvPosition;
        pointSize = max(2.5, pointSize);
        gl_PointSize = pointSize;
        float spriteIndex = mod(a_spriteIndex + u_spriteIndexOffset, 256.0);
        float spriteIndexXf = mod(spriteIndex, u_spriteTileSizes.x);
        v_spriteUvOffset = vec2(
          floor(spriteIndexXf),
          floor((spriteIndex - spriteIndexXf + 0.5) / u_spriteTileSizes.x)
        ) / u_spriteTileSizes;
        v_brightness = smoothstep(0.9, 0.95, position.x);
        v_halfPointSize = pointSize * 0.5 / u_viewportHeight * 2.0 / gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform float u_lightDistance;
      uniform float u_diffMultiplier;
      uniform float u_specMultiplier;
      uniform vec3 u_cameraPosition;
      uniform vec3 u_lightColor;
      uniform vec3 u_lightPosition;
      uniform vec3 u_lightViewPosition;
      uniform vec3 u_color;
      uniform float u_lightScatterDivider;
      uniform float u_lightScatterPowInv;
      uniform sampler2D u_spriteTexture;
      uniform vec2 u_spriteTileTexelSizes;
      uniform float u_depthFrom;
      uniform float u_depthTo;
      varying vec3 v_worldPosition;
      varying vec3 v_viewPosition;
      varying float v_halfPointSize;
      varying vec2 v_spriteUvOffset;
      varying float v_brightness;
      float clampRange (float minVal, float maxVal, float val) {
        return clamp((val - minVal) / (maxVal - minVal), 0.0, 1.0);
      }
      ${GET_SCATTER_FN}
      void main () {
        vec2 uv = v_spriteUvOffset + gl_PointCoord.xy * u_spriteTileTexelSizes;
        uv.y = 1.0 - uv.y;
        vec3 N = pow(texture2D(u_spriteTexture, uv).xyz, vec3(2.2)) * 2.0 - 1.0;
        if (N.z < 0.0) discard;
        float depth = mix(u_depthFrom, u_depthTo, N.z);
        N.z = sqrt(1.0 - N.x * N.x - N.y * N.y);
        N = normalize(N);
        vec3 viewGeometryPosition = -v_viewPosition + vec3(N.xy * 0.96, depth) * v_halfPointSize;
        vec3 LtoG = u_lightViewPosition - viewGeometryPosition;
        vec3 nLtoG = normalize(LtoG);
        float distLtoG = length(LtoG);
        float dotNL = dot(N, nLtoG);
        float lightDistanceWeight = pow(clampRange(u_lightDistance, 0.0, distLtoG), 5.0) * (1.0 + v_brightness);
        float diffuseFactor = smoothstep(-0.75 - v_brightness, 0.75, dotNL);
        vec3 color = u_color * diffuseFactor * lightDistanceWeight * u_diffMultiplier;
        float specDotValue = dot(reflect(normalize(viewGeometryPosition), N), nLtoG);
        float spec = smoothstep(0.8 - v_brightness, 0.85, specDotValue) * u_specMultiplier * lightDistanceWeight;
        color += spec * u_lightColor;
        vec3 toCameraWorld = v_worldPosition - u_cameraPosition;
        vec3 nToCameraWorldDir = normalize(toCameraWorld);
        float toCameraDist = length(toCameraWorld);
        float scatter = getScatter(u_cameraPosition, nToCameraWorldDir, u_lightPosition, toCameraDist);
        color += color * 0.15 * (0.65 + 0.4 * scatter) + scatter * u_lightColor;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  })

  const points = new THREE.Points(geo, pointMaterial)
  points.frustumCulled = false
  points.userData.noSceneBlend = true

  let prev = rtA
  let curr = rtB
  let primed = false

  function renderSim (target) {
    const prevTarget = renderer.getRenderTarget()
    const prevAutoClear = renderer.autoClear
    const prevTone = renderer.toneMapping
    const prevSpace = renderer.outputColorSpace
    renderer.autoClear = true
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    renderer.setRenderTarget(target)
    renderer.render(simScene, simCam)
    renderer.setRenderTarget(prevTarget)
    renderer.autoClear = prevAutoClear
    renderer.toneMapping = prevTone
    renderer.outputColorSpace = prevSpace
  }

  function stepSim (dt, { rebornY, dieSpeed } = {}) {
    if (!primed) {
      simUniforms.u_positionTexture.value = defaultTex
      renderSim(curr)
      primed = true
    }
    const swap = prev
    prev = curr
    curr = swap
    simUniforms.u_positionTexture.value = prev.texture
    simUniforms.u_speed.value = 0.0027
    simUniforms.u_dieSpeed.value = dieSpeed != null ? dieSpeed : 0.012
    simUniforms.u_time.value += 0.3 * dt
    // tall film 可见带绕 lookAt(0)；不要用 2*camY+1（居中裁切时 camY≈-1.6 → 重生掉到屏下）
    const attr = simUniforms.u_attractor.value
    simUniforms.u_rebornCenter.value.set(
      attr.x * 0.35,
      (rebornY != null ? rebornY : 0) + attr.y * 0.35,
      attr.z * 0.35
    )
    renderSim(curr)
    pointUniforms.u_positionTexture.value = curr.texture
  }

  /**
   * 进幕补一轮换代，让竖直 band 立刻铺开（不改吸引点）。
   */
  let verticalSeeded = false
  function seedVerticalSpread () {
    if (verticalSeeded) return
    verticalSeeded = true
    for (let i = 0; i < 100; i++) {
      stepSim(1 / 60, { dieSpeed: 0.03 })
    }
    simUniforms.u_dieSpeed.value = 0.012
  }

  return {
    points,
    seedVerticalSpread,
    /** 诊断：读回位置 RT 的 Y 分布（min/max/p10/p90） */
    samplePositionYStats () {
      const buf = new Float32Array(w * h * 4)
      renderer.readRenderTargetPixels(curr, 0, 0, w, h, buf)
      const ys = []
      const xs = []
      for (let i = 0; i < buf.length; i += 4) {
        xs.push(buf[i])
        ys.push(buf[i + 1])
      }
      ys.sort((a, b) => a - b)
      xs.sort((a, b) => a - b)
      const at = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))]
      return {
        n: ys.length,
        min: ys[0],
        p10: at(ys, 0.1),
        p50: at(ys, 0.5),
        p90: at(ys, 0.9),
        max: ys[ys.length - 1],
        span: ys[ys.length - 1] - ys[0],
        xP10: at(xs, 0.1),
        xP50: at(xs, 0.5),
        xP90: at(xs, 0.9),
        rebornY: simUniforms.u_rebornCenter.value.y,
        rebornYSpan: simUniforms.u_rebornYSpan.value,
        attractor: simUniforms.u_attractor.value.toArray()
      }
    },
    update (deltaMs, theme = FEATURED_CYAN) {
      const dt = Math.min(0.04, Math.max(0, (deltaMs || 16) / 1e3))
      stepSim(dt)
      pointUniforms.u_time.value += dt
      pointUniforms.u_viewportHeight.value = resolvePointViewportHeight(
        renderer,
        getViewportCssHeight
      )
      hexToRgbVec3(theme.pointColor ?? FEATURED_CYAN.pointColor, pointUniforms.u_color.value)
      pointUniforms.u_spriteIndexOffset.value =
        (pointUniforms.u_spriteIndexOffset.value + 1) % SPRITE_COUNT
    }
  }
}
