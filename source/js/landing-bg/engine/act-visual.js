import { ViewportVisual } from './visual.js'

/**
 * 单幕 Visual：绑定 DOM section ↔ Three.js group，支持懒挂载与按视口/透明度 tick
 */
export class ActVisual extends ViewportVisual {
  constructor ({
    refDomId,
    actIndex,
    paddingTop = 0,
    paddingBottom = 0,
    mount = null,
    group = null,
    update = null
  }) {
    super({ refDomId, paddingTop, paddingBottom })
    this.actIndex = actIndex
    this.mount = mount
    this.group = group
    this.updateFn = update
    this.sceneModule = null
    this.mounted = group != null
    this._opacity = 1
  }

  get opacity () {
    return this._opacity
  }

  setOpacity (value) {
    this._opacity = value
  }

  /** @param {import('three').Scene} scene */
  ensureMounted (scene) {
    if (this.mounted) return this.sceneModule
    if (!this.mount) return null

    const mod = this.mount()
    if (!mod?.group) return null

    this.sceneModule = mod
    this.group = mod.group
    this.updateFn = mod.update?.bind(mod) ?? null
    scene.add(this.group)
    this.mounted = true
    return mod
  }

  /**
   * 是否执行本幕 simulation（视口可见或转场中仍有一定透明度）
   */
  shouldTick () {
    if (this._opacity > 0.01) return true
    if (this._opacity > 0.002 && this.needsRender) return true
    return false
  }

  /**
   * 是否参与绘制（完全离屏且透明则 skip traverse）
   */
  shouldDraw () {
    if (this._opacity <= 0.002) return false
    if (this.needsRender) return true
    return this._opacity > 0.05
  }

  tick (...args) {
    if (!this.shouldTick()) return
    this.updateFn?.(...args)
  }
}
