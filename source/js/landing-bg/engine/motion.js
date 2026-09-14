/**
 * 弹性鼠标与滚动速度
 */
const _mouse = { x: 0, y: 0 }
const _elastic = { x: 0, y: 0 }
const _vel = { x: 0, y: 0 }

let _lastScrollY = 0
let _scrollVelocity = 0
let _bound = false
let _reducedMotion = false

function onPointerMove (e) {
  _mouse.x = e.clientX
  _mouse.y = e.clientY
}

function onScroll () {
  const y = window.scrollY
  _scrollVelocity = y - _lastScrollY
  _lastScrollY = y
}

function bind () {
  if (_bound) return
  _bound = true
  _reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  _lastScrollY = window.scrollY
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
}

/**
 * @param {number} deltaMs
 */
export function updateMotion (deltaMs) {
  bind()
  if (_reducedMotion) {
    _elastic.x = _mouse.x
    _elastic.y = _mouse.y
    _vel.x = 0
    _vel.y = 0
    return
  }

  const dt = Math.min(deltaMs, 48)
  const pull = 0.15 * (dt / 16)
  const damp = Math.pow(0.8, dt / 16)

  _vel.x += (_mouse.x - _elastic.x) * pull
  _vel.y += (_mouse.y - _elastic.y) * pull
  _vel.x *= damp
  _vel.y *= damp
  _elastic.x += _vel.x
  _elastic.y += _vel.y
}

export function getElasticMouse () {
  return _elastic
}

export function getScrollTopVelocity () {
  return _scrollVelocity
}

/** 归一化设备坐标 -1..1 */
export function getElasticNdc () {
  const w = window.innerWidth || 1
  const h = window.innerHeight || 1
  return {
    x: (_elastic.x / w) * 2 - 1,
    y: 1 - (_elastic.y / h) * 2
  }
}

/**
 * 相机视差偏移（弧度），weight 0..1
 * @param {import('three').PerspectiveCamera} camera
 * @param {import('three').Vector3} lookTarget
 * @param {number} weight
 */
export function applyCameraParallax (camera, lookTarget, weight) {
  if (_reducedMotion || weight < 0.01) return

  const ndc = getElasticNdc()
  const targetX = ndc.x * 0.2 * weight
  const targetY = ndc.y * 0.12 * weight

  camera.rotation.x += (targetX - camera.rotation.x) * 0.04
  camera.rotation.y += (targetY - camera.rotation.y) * 0.04
  camera.lookAt(lookTarget)
}
