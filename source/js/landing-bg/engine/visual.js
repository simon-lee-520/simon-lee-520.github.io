/**
 * DOM 区块视口检测（testViewport / needsRender）
 */
export class ViewportVisual {
  constructor ({ refDomId, paddingTop = 0, paddingBottom = 0 }) {
    this.refDomId = refDomId
    this.refDom = null
    this.paddingTop = paddingTop
    this.paddingBottom = paddingBottom
    this.needsRender = false
    this.inBaseRange = false
    this.refDomRect = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0
    }
    this._cacheRect = null
    this._cacheScrollY = -1
  }

  bindDom () {
    this.refDom = document.getElementById(this.refDomId)
  }

  /**
   * @param {number} viewportHeight
   * @param {number} scrollY
   * @param {boolean} force
   */
  testViewport (viewportHeight = window.innerHeight, scrollY = window.scrollY, force = false) {
    if (!this.refDom) {
      this.needsRender = false
      this.inBaseRange = false
      return false
    }

    if (force || this._cacheScrollY !== scrollY) {
      this._cacheRect = this.refDom.getBoundingClientRect()
      this._cacheScrollY = scrollY
    }

    const n = this._cacheRect
    const o = this.refDomRect
    o.left = n.left
    o.top = n.top
    o.right = n.right
    o.bottom = n.bottom
    o.width = n.width
    o.height = n.height

    let top = Math.max(0, o.top)
    let bottom = Math.min(viewportHeight, o.bottom)
    this.inBaseRange = top + 1 < viewportHeight && bottom > 1

    top = Math.max(0, o.top - this.paddingTop)
    bottom = Math.min(viewportHeight, o.bottom + this.paddingBottom)
    this.needsRender = top + 1 < viewportHeight && bottom > 1
    return this.needsRender
  }
}
