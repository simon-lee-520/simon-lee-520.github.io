import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const BloomCompositeShader = {
  uniforms: {
    tDiffuse: { value: null }, // base
    tBloom: { value: null }, // bloom texture
    u_bloomEnabled: { value: 1 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBloom;
    uniform float u_bloomEnabled;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      if (u_bloomEnabled < 0.5) {
        gl_FragColor = base;
        return;
      }
      vec3 bloom = texture2D(tBloom, vUv).rgb;
      gl_FragColor = vec4(base.rgb + bloom, base.a);
    }
  `
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    u_greyRatio: { value: 0 },
    u_tint: { value: new THREE.Vector3(1, 1, 1) },
    u_topFade: { value: 0 },
    u_bottomFade: { value: 1 },
    u_resolution: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float u_greyRatio;
    uniform vec3 u_tint;
    uniform float u_topFade;
    uniform float u_bottomFade;
    uniform vec2 u_resolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    vec3 dither(vec3 color, vec2 fragCoord) {
      float n = hash(fragCoord) * 2.0 - 1.0;
      return color + n * (1.0 / 255.0);
    }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * u_tint;

      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(luma * 0.85 + 0.04), u_greyRatio);

      float edge = 1.0;
      if (u_topFade > 0.001) edge *= smoothstep(0.0, u_topFade, vUv.y);
      if (u_bottomFade < 0.999) edge *= smoothstep(1.0, u_bottomFade, vUv.y);

      col = dither(col, gl_FragCoord.xy);
      gl_FragColor = vec4(col, c.a * edge);
    }
  `
}

function shouldEnableBloom () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return true
}

export function createPostPipeline (renderer, scene, camera) {
  if (!shouldEnableBloom()) {
    return createBasicPipeline(renderer, scene, camera)
  }

  /** 选择性 Bloom：bloomComposer 只渲染 Bloom 层；finalComposer 渲染全场景并合成 bloom */
  const bloomComposer = new EffectComposer(renderer)
  bloomComposer.renderToScreen = false
  bloomComposer.addPass(new RenderPass(scene, camera))

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.95,
    0.55,
    0.2
  )
  bloomComposer.addPass(bloomPass)

  const finalComposer = new EffectComposer(renderer)
  finalComposer.addPass(new RenderPass(scene, camera))

  const compositePass = new ShaderPass(BloomCompositeShader)
  // bloom 纹理由 render() 时从 bloomComposer.readBuffer 注入
  compositePass.uniforms.tBloom.value = null
  finalComposer.addPass(compositePass)

  const gradePass = new ShaderPass(GradeShader)
  finalComposer.addPass(gradePass)
  finalComposer.addPass(new OutputPass())

  const bloomCity = { strength: 0.95, threshold: 0.2, radius: 0.55 }
  const bloomOcean = { strength: 1.12, threshold: 0.05, radius: 0.72 }

  camera.layers.enable(0)
  camera.layers.enable(1)

  let useBloom = true
  const gradeUniforms = gradePass.uniforms
  const compositeUniforms = compositePass.uniforms

  function applyBloomMix (oceanT) {
    const t = Math.max(0, Math.min(1, oceanT))
    bloomPass.strength = bloomCity.strength + (bloomOcean.strength - bloomCity.strength) * t
    bloomPass.threshold = bloomCity.threshold + (bloomOcean.threshold - bloomCity.threshold) * t
    bloomPass.radius = bloomCity.radius + (bloomOcean.radius - bloomCity.radius) * t
  }

  return {
    bloomEnabled: true,
    render () {
      if (!useBloom) {
        renderer.render(scene, camera)
        return
      }

      // Bloom 层渲染时，避免用场景 clearColor（海底雾色）铺满导致“整屏发青”
      const prevClear = renderer.getClearColor(new THREE.Color())
      const prevClearAlpha = renderer.getClearAlpha()
      renderer.setClearColor(0x000000, 1)

      const prevMask = camera.layers.mask
      camera.layers.set(1)
      bloomComposer.render()
      camera.layers.mask = prevMask

      renderer.setClearColor(prevClear, prevClearAlpha)

      // EffectComposer 会 swap buffer：render 后结果在 readBuffer
      compositeUniforms.tBloom.value = bloomComposer.readBuffer.texture

      finalComposer.render()
    },
    setSize (width, height) {
      bloomComposer.setSize(width, height)
      finalComposer.setSize(width, height)
      bloomPass.resolution.set(width, height)
      gradeUniforms.u_resolution.value.set(width, height)
    },
    setOceanBlend (blend23) {
      applyBloomMix(blend23)
    },
    setActBloom ({ cityOpacity = 0, oceanOpacity = 0, blend12 = 0, oceanInteractive = false }) {
      const neonWeight = cityOpacity + oceanOpacity
      /** featured usePostprocessing: false — 海底交互全程禁用 bloom */
      const oceanFull = oceanInteractive || oceanOpacity >= 0.92
      useBloom = neonWeight >= 0.04 && !oceanFull
      compositeUniforms.u_bloomEnabled.value = useBloom ? 1 : 0
      if (!useBloom) {
        gradeUniforms.u_greyRatio.value = Math.max(0, blend12 * 0.35 - oceanOpacity * 0.1)
        return
      }
      const oceanT = neonWeight > 0 ? oceanOpacity / neonWeight : 0
      applyBloomMix(oceanT)

      // 仅在转场带内去饱和；稳定停留在某一幕时不压色（避免海底长期发灰）
      const edge12 = blend12 * (1 - blend12) * 4
      const edge23 = oceanOpacity * (1 - oceanOpacity) * 4
      gradeUniforms.u_greyRatio.value = Math.min(0.38, Math.max(edge12, edge23) * 0.14)
    },
    setActGrade ({ spaceOpacity = 1, cityOpacity = 0, oceanOpacity = 0, blend12 = 0, oceanInteractive = false }) {
      if (oceanInteractive) {
        gradeUniforms.u_tint.value.set(1, 1, 1)
        gradeUniforms.u_greyRatio.value = 0
        gradeUniforms.u_topFade.value = 0
        gradeUniforms.u_bottomFade.value = 1
        return
      }
      const space = new THREE.Color(0.92, 0.98, 1.05)
      const city = new THREE.Color(1.05, 0.92, 1.02)
      /** 海底以 #041113 为基准，调色略偏中性，避免整屏发青 */
      const ocean = new THREE.Color(0.98, 1.0, 1.0)
      const tint = new THREE.Color()
      tint.copy(space).multiplyScalar(spaceOpacity)
      tint.lerp(city, cityOpacity)
      tint.lerp(ocean, oceanOpacity)
      gradeUniforms.u_tint.value.set(tint.r, tint.g, tint.b)

      const edge = Math.max(blend12, oceanOpacity) * 0.12 + 0.02
      gradeUniforms.u_topFade.value = edge
      gradeUniforms.u_bottomFade.value = 1 - edge
    },
    pulseBloom (amount = 0.15, durationMs = 280) {
      const base = bloomPass.strength
      const peak = base + amount
      const start = performance.now()
      function tick (now) {
        const t = Math.min((now - start) / durationMs, 1)
        const wave = Math.sin(t * Math.PI)
        bloomPass.strength = base + amount * wave
        if (t < 1) requestAnimationFrame(tick)
        else bloomPass.strength = base
      }
      requestAnimationFrame(tick)
    }
  }
}

function createBasicPipeline (renderer, scene, camera) {
  return {
    bloomEnabled: false,
    render () {
      renderer.render(scene, camera)
    },
    setSize () {},
    setOceanBlend () {},
    setActBloom () {},
    setActGrade () {},
    pulseBloom () {}
  }
}
