import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { MOBILE_MQ, PALETTE, BOUNDARY_12_VH, BOUNDARY_23_VH } from './constants.js'
import { computeScrollState, computeCameraPose } from './scroll-director.js'
import { createPointerSystem } from './interaction/pointer.js'
import { updateOceanXYBounds } from './ocean-bounds.js'
import { createSpaceScene } from './scenes/space.js'
import { createCityScene } from './scenes/city.js'
import { createOceanScene } from './scenes/ocean.js'
import {
  createFeaturedSharedUniforms,
  FEATURED_CYAN
} from './materials/featured-scene.js'
import { createSkills } from './character/skills.js'
import { createPostPipeline } from './post/composer.js'
import { updateFogVeils } from './scenes/enclosure.js'
import {
  applyFeaturedCamera,
  clearFeaturedCamera,
  computeFeaturedActMetrics
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

  const scene = new THREE.Scene()
  const envScene = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(envScene, 0.04).texture
  pmrem.dispose()
  scene.fog = new THREE.FogExp2(PALETTE.fogSpace, 0.012)

  const hemi = new THREE.HemisphereLight(0x283848, 0x060810, 0.22)
  const fill = new THREE.AmbientLight(0x1a2030, 0.18)
  scene.add(hemi, fill)

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 500)
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
          sharedUniforms: featuredSharedUniforms
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
      return computeFeaturedActMetrics(visual)
    },
    cameraPosition: featuredCameraPosition,
    mouse3: featuredMouse3,
    sharedUniforms: featuredSharedUniforms
  })

  let scrollState = computeScrollState(0)

  function getActVisual (actIndex) {
    return actVisuals.find((v) => v.actIndex === actIndex)
  }

  function ensureLazyActs (state) {
    if (shouldPreloadCity(state)) getActVisual(2).ensureMounted(scene)
    if (shouldPreloadOcean(state)) getActVisual(3).ensureMounted(scene)
  }

  function updateOceanFeaturedCamera () {
    const visual = getActVisual(3)
    if (!visual?.refDom) return
    const metrics = computeFeaturedActMetrics(visual)
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
      setGroupSceneOpacity(cityVisual.group, cityOpacity)
      cityVisual.group.visible = cityVisual.shouldDraw()
    }
    if (oceanVisual.group) {
      setGroupSceneOpacity(oceanVisual.group, oceanOpacity)
      oceanVisual.group.visible = oceanVisual.shouldDraw()
    }

    document.body.classList.toggle('act-ocean', state.oceanInteractive)

    pointer.setOceanMode?.(state.oceanInteractive)

    const fogColor = new THREE.Color(PALETTE.fogSpace)
      .lerp(new THREE.Color(PALETTE.fogCity), state.blend12)
      .lerp(new THREE.Color(PALETTE.fogOcean), state.blend23)

    if (state.oceanInteractive) {
      const bg = new THREE.Color(FEATURED_CYAN.backgroundColor)
      scene.fog.color.copy(bg)
      scene.fog.density = 0
      renderer.setClearColor(bg)
      renderer.toneMapping = THREE.NoToneMapping
      renderer.toneMappingExposure = 1
    } else {
      scene.fog.color.copy(fogColor)
      const cityFog = state.blend12 * (1 - state.blend23)
      scene.fog.density = THREE.MathUtils.lerp(
        0.014,
        THREE.MathUtils.lerp(0.008, 0.0095, state.blend23),
        cityFog
      )
      renderer.setClearColor(fogColor)
      updateFogVeils(scene, fogColor)
      clearFeaturedCamera(camera)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = THREE.MathUtils.lerp(1.58, 1.18, state.blend23)
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

  function onScroll () {
    scrollState = computeScrollState(window.scrollY)
    testActViewports()
    applyScrollState(scrollState)
  }

  let scrollTicking = false
  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return
      scrollTicking = true
      requestAnimationFrame(() => {
        onScroll()
        scrollTicking = false
      })
    },
    { passive: true }
  )

  function onResize () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    postPipeline.setSize(window.innerWidth, window.innerHeight)
    const city = getActVisual(2)
    if (city?.mounted && city.sceneModule?.onResize) city.sceneModule.onResize()
    onScroll()
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
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
    if (scrollState.oceanInteractive) {
      updateOceanFeaturedCamera()
      pointer.updateFromElastic?.()
    }
    testActViewports()

    const foreground = document.getElementById('landing-foreground')
    if (foreground && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const skew = Math.max(-6, Math.min(6, getScrollTopVelocity() / 24))
      foreground.style.transform = `skewY(${skew}deg) translateZ(0)`
    }

    const spaceVisual = getActVisual(1)
    const cityVisual = getActVisual(2)
    const oceanVisual = getActVisual(3)

    ensureLazyActs(scrollState)

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

  onScroll()
  animate()
  document.body.classList.add('landing-bg-ready')
  window.__landingBgInited = true
}
