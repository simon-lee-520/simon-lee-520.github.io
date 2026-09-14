/** 按 scroll 混合结果设置 group 透明度（保留原有视觉转场） */
export function setGroupSceneOpacity (group, opacity) {
  if (!group) return
  group.visible = opacity > 0.002
  group.traverse((obj) => {
    if (obj.userData?.noSceneBlend) return
    const materials = obj.material
      ? Array.isArray(obj.material)
        ? obj.material
        : [obj.material]
      : []
    for (const mat of materials) {
      if (!mat || mat.opacity === undefined) continue
      if (mat.userData.sceneBaseOpacity === undefined) {
        mat.userData.sceneBaseOpacity = mat.opacity > 0.01 ? mat.opacity : 1
      }
      mat.opacity = mat.userData.sceneBaseOpacity * opacity
      mat.transparent = mat.opacity < 0.999
      mat.needsUpdate = true
    }
  })
}
