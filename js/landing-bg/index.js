import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createCitySunsetEnvScene } from './environments/city-sunset.js'
import { MOBILE_MQ, PALETTE, BOUNDARY_12_VH, BOUNDARY_23_VH } from './constants.js'
import { computeScrollState, computeCameraPose } from './scroll-director.js'
import { createPointerSystem } from './interaction/pointer.js'
import { updateOceanXYBounds } from './ocean-bounds.js'
import { createSpaceScene } from './scenes/space.js'
import { createCityScene } from './scenes/city.js'
import { createOceanScene } from './scenes/ocean.js'
import {
  createFeaturedSharedUniforms,
  FEATURED_CYAN,
  getOceanColorExperimentFlags
} from './materials/featured-scene.js'
import { createSkills } from './character/skills.js'
import { createPostPipeline } from './post/composer.js'
import { updateFogVeils } from './scenes/enclosure.js'
import {
  applyFeaturedCamera,
  clearFeaturedCamera,
  computeFeaturedActMetrics,
  featuredLayoutHeight,
  resolveOceanFeaturedMetrics
} from './engine/featured-viewport.js'
import { ActVisual } from './engine/act-visual.js'
import { setGroupSceneOpacity } from './engine/scene-blend.js'
import {
  updateMotion,
  applyCameraParallax,
  getScrollTopVelocity
} from './engine/motion.js'

/** 转场区额外视口 padding（vh），保证 blend 期间仍 tick */
function blendPaddingPx () {
  return window.innerHeight * 0.12
}

function detectQualityTier () {
  const mem = navigator.deviceMemory
  if (mem !== undefined && mem <= 4) return 'mid'
  return 'high'
}

function getPixelRatioCap (tier) {
  const dpr = window.devicePixelRatio || 1
  if (tier === 'high') return Math.min(dpr, 2.0)
  return Math.min(dpr, 2)
}

function shouldSkip () {
  if (window.__landingBgInited) return true
  if (!document.body.classList.contains('page-landing')) return true
  if (window.matchMedia(MOBILE_MQ).matches) return true
  return false
}

function shouldPreloadCity (scrollState) {
  return scrollState.blend12 > 0 || scrollState.scrollVh > BOUNDARY_12_VH - 40
}

function shouldPreloadOcean (scrollState) {
  return scrollState.blend23 > 0 || scrollState.scrollVh > BOUNDARY_23_VH - 40
}

export function initLandingBackground () {
  import('../landing-dom.js')
    .then(({ initLandingDomEffects }) => initLandingDomEffects())
    .catch(() => {})

  if (shouldSkip()) {
    document.body.classList.add('landing-fallback-static')
    return
  }

  try {
    initWebGLBackground()
  } catch (err) {
    console.warn('[landing-bg] WebGL init failed, using static fallback', err)
    document.body.classList.add('landing-fallback-static')
  }
}

function initWebGLBackground () {
  const canvas = document.createElement('canvas')
  canvas.id = 'bg-tech-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.prepend(canvas)

  let qualityTier = detectQualityTier()
  const pad = blendPaddingPx()

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(getPixelRatioCap(qualityTier))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.58
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  /** 实验 1：海底幕强制 PR=1（对齐线上无 setPixelRatio）；离开后恢复 */
  let oceanPixelRatioLocked = false

  function applyRendererPixelRatio (oceanInteractive) {
    const next = oceanInteractive ? 1 : getPixelRatioCap(qualityTier)
    const cur = renderer.getPixelRatio()
    if (Math.abs(cur - next) < 1e-6 && oceanPixelRatioLocked === oceanInteractive) return
    oceanPixelRatioLocked = oceanInteractive
    renderer.setPixelRatio(next)
    renderer.setSize(window.innerWidth, window.innerHeight)
    postPipeline.setSize(window.innerWidth, window.innerHeight)
  }

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const roomEnvMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  const cityEnvMap = pmrem.fromScene(createCitySunsetEnvScene(), 0.04).texture
  pmrem.dispose()
  scene.environment = roomEnvMap
  scene.environmentIntensity = 1
  scene.fog = new THREE.FogExp2(PALETTE.fogSpace, 0.012)

  const hemi = new THREE.HemisphereLight(0x283848, 0x060810, 0.22)
  const fill = new THREE.AmbientLight(0x1a2030, 0.18)
  const hemiBase = { color: hemi.color.clone(), ground: hemi.groundColor.clone(), intensity: hemi.intensity }
  const fillBase = { color: fill.color.clone(), intensity: fill.intensity }
  scene.add(hemi, fill)

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2500)
  const lookTarget = new THREE.Vector3()
  const postPipeline = createPostPipeline(renderer, scene, camera)

  let skipHeavyUpdates = false
  let fpsWindowStart = 0
  let fpsWindowFrames = 0
  let frameIndex = 0

  const spaceScene = createSpaceScene()
  scene.add(spaceScene.group)

  const featuredCameraPosition = new THREE.Vector3()
  const featuredMouse3 = new THREE.Vector3()
  const featuredSharedUniforms = createFeaturedSharedUniforms(
    featuredCameraPosition,
    featuredMouse3
  )

  const actVisuals = [
    new ActVisual({
      refDomId: 'landing-hero',
      actIndex: 1,
      paddingBottom: pad,
      group: spaceScene.group,
      update: (state, now) => spaceScene.update?.(state, now)
    }),
    new ActVisual({
      refDomId: 'landing-act-2',
      actIndex: 2,
      paddingTop: pad,
      paddingBottom: pad,
      mount: () => createCityScene()
    }),
    new ActVisual({
      refDomId: 'landing-content',
      actIndex: 3,
      paddingTop: pad,
      mount: () =>
        createOceanScene({
          cameraPosition: featuredCameraPosition,
          mouse3: featuredMouse3,
          sharedUniforms: featuredSharedUniforms,
          renderer,
          // 与线上 size 模块 i.height 一致（不是 scissor 可见高）
          getViewportCssHeight: () => featuredLayoutHeight()
        })
    })
  ]

  for (const visual of actVisuals) visual.bindDom()

  const skills = createSkills({
    swordsmanGroup: spaceScene.swordsman.group,
    scene,
    postPipeline,
    swordsman: spaceScene.swordsman
  })
  spaceScene.swordsman.setSkills?.(skills)
  spaceScene.swordsman.setPostPipeline?.(postPipeline)
  const pointer = createPointerSystem({
    camera,
    swordsman: spaceScene.swordsman,
    skills,
    getScrollState: () => scrollState,
    getFeaturedMetrics: () => {
      const visual = getActVisual(3)
      if (!visual?.refDom) return null
      return resolveOceanFeaturedMetrics(visual)
    },
    cameraPosition: featuredCameraPosition,
    mouse3: featuredMouse3,
    sharedUniforms: featuredSharedUniforms
  })

  let scrollState = computeScrollState(window.scrollY)
  /** 上次已应用到幕状态的 scrollY；用于捕获无 scroll 事件的浏览器滚动恢复 */
  let appliedScrollY = Number.NaN
  /** 海底交互边沿：刚进入时做一次纵向重生扫刷 */
  let oceanWasInteractive = false

  /** 诊断探针：只读。控制台执行 __landingBgProbe.snapshot() */
  window.__landingBgProbe = {
    snapshot () {
      const points = []
      scene.traverse((obj) => {
        if (!obj.isPoints || !obj.material?.uniforms?.u_viewportHeight) return
        const u = obj.material.uniforms
        points.push({
          count: obj.geometry?.attributes?.position?.count ?? 0,
          u_viewportHeight: u.u_viewportHeight.value,
          u_particleScale: u.u_particleScale?.value,
          u_lightDistance: u.u_lightDistance?.value,
          scatterDiv: u.u_lightScatterDivider?.value,
          lightPos: u.u_lightPosition?.value?.toArray?.() ?? null,
          camUniform: u.u_cameraPosition?.value?.toArray?.() ?? null
        })
      })
      return {
        oceanInteractive: !!scrollState?.oceanInteractive,
        actOcean: document.body.classList.contains('act-ocean'),
        pixelRatio: renderer.getPixelRatio(),
        drawingBuffer: [renderer.domElement.width, renderer.domElement.height],
        cssSize: [renderer.domElement.clientWidth, renderer.domElement.clientHeight],
        layoutH:
          (window.innerWidth || 1) > 1280
            ? window.innerHeight
            : Math.max(1, (window.innerHeight || 1) - 70),
        screenH: window.screen?.height,
        pointCountFormula: 64 * Math.ceil((window.screen?.height || window.innerHeight) / 30),
        camera: {
          near: camera.near,
          far: camera.far,
          fov: camera.fov,
          aspect: camera.aspect,
          pos: camera.position.toArray(),
          view: camera.view
            ? {
                fullWidth: camera.view.fullWidth,
                fullHeight: camera.view.fullHeight,
                offsetX: camera.view.offsetX,
                offsetY: camera.view.offsetY,
                width: camera.view.width,
                height: camera.view.height
              }
            : null
        },
        featuredCameraPosition: featuredCameraPosition.toArray(),
        featuredMouse3: featuredMouse3.toArray(),
        particleY: getActVisual(3)?.sceneModule?.samplePositionYStats?.() ?? null,
        points
      }
    }
  }

  function getActVisual (actIndex) {
    return actVisuals.find((v) => v.actIndex === actIndex)
  }

  function ensureLazyActs (state) {
    if (shouldPreloadCity(state)) getActVisual(2).ensureMounted(scene)
    if (shouldPreloadOcean(state)) getActVisual(3).ensureMounted(scene)
  }

  /**
   * 从 window.scrollY 同步幕状态。
   * 刷新时浏览器常在脚本之后才恢复滚动，且不一定派发 scroll —— 必须每帧校对。
   */
  function syncScrollState (force = false) {
    const y = window.scrollY
    if (!force && y === appliedScrollY) return false
    appliedScrollY = y
    scrollState = computeScrollState(y)
    testActViewports()
    applyScrollState(scrollState)
    return true
  }

  function updateOceanFeaturedCamera () {
    const visual = getActVisual(3)
    if (!visual?.refDom) return
    const metrics = resolveOceanFeaturedMetrics(visual)
    applyFeaturedCamera(camera, lookTarget, metrics, 0)
    camera.matrixWorld.decompose(
      featuredCameraPosition,
      new THREE.Quaternion(),
      new THREE.Vector3()
    )
  }

  function applyScrollState (state) {
    ensureLazyActs(state)

    const spaceOpacity = 1 - state.blend12
    const cityOpacity = state.blend12 * (1 - state.blend23)
    const oceanOpacity = state.actIndex >= 3 ? 1 : state.blend23

    const spaceVisual = getActVisual(1)
    const cityVisual = getActVisual(2)
    const oceanVisual = getActVisual(3)

    spaceVisual.setOpacity(spaceOpacity)
    cityVisual.setOpacity(cityOpacity)
    oceanVisual.setOpacity(oceanOpacity)

    if (spaceVisual.group) {
      setGroupSceneOpacity(spaceVisual.group, spaceOpacity)
      spaceVisual.group.visible = spaceVisual.shouldDraw()
    }
    if (cityVisual.group) {
      cityVisual.group.userData.sceneOpacity = cityOpacity
      setGroupSceneOpacity(cityVisual.group, cityOpacity)
      cityVisual.group.visible = cityVisual.shouldDraw()
    }
    if (oceanVisual.group) {
      oceanVisual.group.userData.sceneOpacity = oceanOpacity
      setGroupSceneOpacity(oceanVisual.group, oceanOpacity)
      oceanVisual.group.visible = oceanVisual.shouldDraw()
    }

    document.body.classList.toggle('act-ocean', state.oceanInteractive)

    pointer.setOceanMode?.(state.oceanInteractive)
    applyRendererPixelRatio(state.oceanInteractive)

    if (state.oceanInteractive && !oceanWasInteractive) {
      oceanVisual.sceneModule?.seedVerticalSpread?.()
    }
    oceanWasInteractive = state.oceanInteractive

    const fogColor = new THREE.Color(PALETTE.fogSpace)
      .lerp(new THREE.Color(PALETTE.fogCity), state.blend12)
      .lerp(new THREE.Color(PALETTE.fogOcean), state.blend23)

    if (state.oceanInteractive) {
      const oceanTheme =
        getActVisual(3)?.sceneModule?.getTheme?.() || FEATURED_CYAN
      const bg = new THREE.Color(oceanTheme.backgroundColor)
      scene.fog.color.copy(bg)
      scene.fog.density = 0
      renderer.setClearColor(bg)
      // 对齐线上 r112：无 tone mapping、无 sRGB 出屏编码（否则体积光偏暗）
      renderer.toneMapping = THREE.NoToneMapping
      renderer.toneMappingExposure = 1
      // 取证：?oceanColorExp=srgbOut 时改回 SRGB，对比是否偏冷
      renderer.outputColorSpace = getOceanColorExperimentFlags().srgbOut
        ? THREE.SRGBColorSpace
        : THREE.LinearSRGBColorSpace
      if (scene.environment !== roomEnvMap) scene.environment = roomEnvMap
      scene.environmentIntensity = 1
      hemi.color.copy(hemiBase.color)
      hemi.groundColor.copy(hemiBase.ground)
      hemi.intensity = hemiBase.intensity
      fill.color.copy(fillBase.color)
      fill.intensity = fillBase.intensity
    } else {
      scene.fog.color.copy(fogColor)
      const cityFog = state.blend12 * (1 - state.blend23)
      // 城市幕原模型直出：关雾、关城市向 bloom 偏置；ACES 中性曝光
      scene.fog.density = THREE.MathUtils.lerp(
        0.014,
        THREE.MathUtils.lerp(0.0, 0.0095, state.blend23),
        cityFog
      )
      renderer.setClearColor(fogColor)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      updateFogVeils(scene, fogColor)
      clearFeaturedCamera(camera, { near: 0.1, far: 2500 })
      // 城市幕：暖色户外 IBL；离开则回到室内 Room 探针
      const useCityEnv = cityOpacity > 0.4 && oceanOpacity < 0.25
      if (useCityEnv) {
        if (scene.environment !== cityEnvMap) scene.environment = cityEnvMap
        scene.environmentIntensity = 0.95
        hemi.color.setHex(0xffd0b0)
        hemi.groundColor.setHex(0x1a0c14)
        hemi.intensity = 0.12
        fill.color.setHex(0xffe8d8)
        fill.intensity = 0.08
      } else {
        if (scene.environment !== roomEnvMap) scene.environment = roomEnvMap
        scene.environmentIntensity = 1
        hemi.color.copy(hemiBase.color)
        hemi.groundColor.copy(hemiBase.ground)
        hemi.intensity = hemiBase.intensity
        fill.color.copy(fillBase.color)
        fill.intensity = fillBase.intensity
      }
      if (cityOpacity > 0.45) {
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05
      } else {
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        const cityExposure = 1.48 - cityOpacity * 0.32
        renderer.toneMappingExposure = THREE.MathUtils.lerp(
          cityExposure,
          1.18,
          state.blend23
        )
      }
    }

    postPipeline.setActBloom?.({
      cityOpacity,
      oceanOpacity,
      blend12: state.blend12,
      oceanInteractive: state.oceanInteractive
    })
    postPipeline.setActGrade?.({
      spaceOpacity,
      cityOpacity,
      oceanOpacity,
      blend12: state.blend12,
      oceanInteractive: state.oceanInteractive
    })
    postPipeline.setOceanBlend?.(state.blend23)

    const shadowsNeeded = spaceOpacity > 0.08 && spaceVisual.shouldTick()
    if (renderer.shadowMap.enabled !== shadowsNeeded) {
      renderer.shadowMap.enabled = shadowsNeeded
    }

    if (!state.oceanInteractive) {
      const pose = computeCameraPose(state.progress, state.scrollVh)
      camera.position.set(...pose.position)
      if (pose.up) camera.up.set(...pose.up)
      else camera.up.set(0, 1, 0)
      lookTarget.set(...pose.lookAt)
      camera.lookAt(lookTarget)
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }

    const parallaxWeight = state.oceanInteractive
      ? 0
      : Math.max(spaceOpacity, oceanOpacity) * (1 - state.blend12 * 0.35)
    applyCameraParallax(camera, lookTarget, parallaxWeight)

    if (state.actIndex >= 3 || state.blend23 > 0.01) {
      updateOceanXYBounds(camera)
    }
  }

  function testActViewports () {
    const vh = window.innerHeight
    const scrollY = window.scrollY
    for (const visual of actVisuals) {
      visual.testViewport(vh, scrollY)
    }
  }

  let scrollTicking = false
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return
      scrollTicking = true
      requestAnimationFrame(() => {
        syncScrollState()
        scrollTicking = false
      })
    },
    { passive: true }
  )

  // bfcache / 部分浏览器的滚动恢复
  window.addEventListener('pageshow', () => syncScrollState(true))

  function onResize () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    // 保持当前幕的 PR（海底=1），只重设尺寸
    renderer.setSize(window.innerWidth, window.innerHeight)
    postPipeline.setSize(window.innerWidth, window.innerHeight)
    const city = getActVisual(2)
    if (city?.mounted && city.sceneModule?.onResize) city.sceneModule.onResize()
    syncScrollState(true)
  }
  window.addEventListener('resize', onResize)

  let lastFrameTime = 0

  function trackFps (now) {
    if (qualityTier === 'low') return

    if (!fpsWindowStart) fpsWindowStart = now
    fpsWindowFrames++

    const elapsed = now - fpsWindowStart
    if (elapsed < 3000) return

    const avgFps = (fpsWindowFrames / elapsed) * 1000
    if (avgFps < 18) {
      qualityTier = 'low'
      skipHeavyUpdates = true
      // 海底实验锁 PR=1 时不要被 FPS 降级改回去
      if (!oceanPixelRatioLocked) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
        renderer.setSize(window.innerWidth, window.innerHeight)
        postPipeline.setSize(window.innerWidth, window.innerHeight)
      }
    }

    fpsWindowStart = now
    fpsWindowFrames = 0
  }

  function animate (now) {
    requestAnimationFrame(animate)
    const delta = lastFrameTime ? now - lastFrameTime : 16
    lastFrameTime = now
    frameIndex++

    trackFps(now)
    updateMotion(delta)
    // 必须先于 ensureLazyActs：捕获无事件的 scroll restoration
    syncScrollState()
    if (scrollState.oceanInteractive) {
      updateOceanFeaturedCamera()
      pointer.updateFromElastic?.()
    }

    const foreground = document.getElementById('landing-foreground')
    if (foreground && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const skew = Math.max(-6, Math.min(6, getScrollTopVelocity() / 24))
      foreground.style.transform = `skewY(${skew}deg) translateZ(0)`
    }

    const spaceVisual = getActVisual(1)
    const cityVisual = getActVisual(2)
    const oceanVisual = getActVisual(3)

    const cityWasMounted = cityVisual.mounted
    const oceanWasMounted = oceanVisual.mounted
    ensureLazyActs(scrollState)
    // sync 未触发时若本帧才懒挂载，补一次透明度
    if (cityVisual.mounted && !cityWasMounted && cityVisual.group) {
      cityVisual.group.userData.sceneOpacity = cityVisual.opacity
      setGroupSceneOpacity(cityVisual.group, cityVisual.opacity)
      cityVisual.group.visible = cityVisual.shouldDraw()
    }
    if (oceanVisual.mounted && !oceanWasMounted && oceanVisual.group) {
      oceanVisual.group.userData.sceneOpacity = oceanVisual.opacity
      setGroupSceneOpacity(oceanVisual.group, oceanVisual.opacity)
      oceanVisual.group.visible = oceanVisual.shouldDraw()
    }

    spaceVisual.tick(scrollState, now, delta)

    const skipCityOcean = qualityTier === 'low' && skipHeavyUpdates && frameIndex % 2 === 0
    if (!skipCityOcean) {
      if (cityVisual.mounted && cityVisual.shouldTick()) {
        cityVisual.tick(now, delta, camera)
      }
      if (oceanVisual.mounted && oceanVisual.shouldTick()) {
        const followTarget =
          scrollState.oceanInteractive ? pointer.getFollowTarget() : null
        oceanVisual.tick(followTarget, now, delta, null, camera)
      }
    }

    try {
      postPipeline.render()
    } catch (err) {
      console.error('[landing-bg] render failed', err)
      renderer.render(scene, camera)
    }
  }

  syncScrollState(true)
  // 再等两帧：部分浏览器在 load 后才写回 scrollY
  requestAnimationFrame(() => {
    syncScrollState(true)
    requestAnimationFrame(() => syncScrollState(true))
  })
  // 必须走 rAF，直接 animate() 时 now 为 undefined → matte phase 变 NaN 会拖垮整段 WebGL
  requestAnimationFrame(animate)
  document.body.classList.add('landing-bg-ready')
  window.__landingBgInited = true
}
