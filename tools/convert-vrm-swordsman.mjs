/**
 * 将 VRoid CC0 样本 VRM 转为站点用 swordsman.glb（需 Node 18+）
 * 来源：OpenGameArt VRoid Studio CC0 — AvatarSample_D_Darkness
 * https://opengameart.org/content/vroid-studio-cc0-models
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, loadImage } from 'canvas'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

globalThis.self = globalThis
globalThis.window = globalThis
globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return createCanvas(2, 2)
    return {}
  }
}
globalThis.createImageBitmap = async (blob) => {
  const buf = Buffer.from(await blob.arrayBuffer())
  const img = await loadImage(buf)
  const canvas = createCanvas(img.width, img.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return canvas
}

globalThis.FileReader = class FileReader {
  constructor () {
    this.result = null
    this.onload = null
    this.onerror = null
  }

  readAsArrayBuffer (blob) {
    blob.arrayBuffer()
      .then((buf) => {
        this.result = buf
        this.onload?.({ target: this })
      })
      .catch((err) => this.onerror?.(err))
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const VRM_CANDIDATES = [
  path.join(ROOT, 'tools/.cache/AvatarSample_D_Darkness.vrm'),
  '/tmp/AvatarSample_D_Darkness.vrm'
]

const OUT_GLB = path.join(ROOT, 'source/models/landing/swordsman.glb')
const CACHE_DIR = path.join(ROOT, 'tools/.cache')
const VRM_URL =
  'https://opengameart.org/sites/default/files/avatarsample_d_darkness.zip'

async function ensureVrm () {
  for (const p of VRM_CANDIDATES) {
    if (fs.existsSync(p)) return p
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const zipPath = path.join(CACHE_DIR, 'avatarsample_d_darkness.zip')
  const vrmPath = path.join(CACHE_DIR, 'AvatarSample_D_Darkness.vrm')
  if (!fs.existsSync(vrmPath)) {
    console.log('Downloading VRoid CC0 sample…')
    const res = await fetch(VRM_URL)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
    const { execSync } = await import('child_process')
    execSync(`unzip -o -q "${zipPath}" -d "${CACHE_DIR}"`)
  }
  if (!fs.existsSync(vrmPath)) throw new Error('VRM not found after unzip')
  return vrmPath
}

function bakeTextureImages (root) {
  const slots = ['map', 'normalMap', 'emissiveMap', 'aoMap', 'roughnessMap', 'metalnessMap']
  root.traverse((o) => {
    if (!o.isMesh) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      if (!m) continue
      for (const slot of slots) {
        const tex = m[slot]
        if (!tex?.image) continue
        const img = tex.image
        if (typeof img.getContext === 'function') continue
        const w = img.width ?? img.naturalWidth ?? 2
        const h = img.height ?? img.naturalHeight ?? 2
        const canvas = createCanvas(w, h)
        canvas.getContext('2d').drawImage(img, 0, 0)
        tex.image = canvas
      }
    }
  })
}

function bakeMaterialsForExport (root) {
  root.traverse((o) => {
    if (!o.isMesh) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    const baked = mats.map((m) => {
      if (!m || m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) return m
      const std = new THREE.MeshStandardMaterial({
        color: m.color?.clone?.() ?? new THREE.Color(0xffffff),
        map: m.map ?? null,
        normalMap: m.normalMap ?? null,
        emissive: m.emissive?.clone?.() ?? new THREE.Color(0x000000),
        emissiveIntensity: m.emissiveIntensity ?? 0,
        metalness: 0.12,
        roughness: 0.52,
        transparent: m.transparent ?? false,
        opacity: m.opacity ?? 1,
        alphaTest: m.alphaTest ?? 0,
        side: m.side ?? THREE.FrontSide
      })
      if (std.map) std.map.colorSpace = THREE.SRGBColorSpace
      m.dispose?.()
      return std
    })
    o.material = baked.length === 1 ? baked[0] : baked
  })
}

function loadVrm (vrmPath) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.register((parser) => new VRMLoaderPlugin(parser))
    const data = fs.readFileSync(vrmPath)
    loader.parse(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      path.dirname(vrmPath) + '/',
      (gltf) => {
        const vrm = gltf.userData.vrm
        if (!vrm) {
          reject(new Error('No VRM in file'))
          return
        }
        resolve(vrm)
      },
      reject
    )
  })
}

function exportGlb (object) {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter()
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(Buffer.from(result))
          return
        }
        reject(new Error('Expected binary GLB'))
      },
      reject,
      { binary: true, onlyVisible: true, truncateDrawRange: true }
    )
  })
}

async function main () {
  const vrmPath = await ensureVrm()
  console.log('Loading', vrmPath)
  const vrm = await loadVrm(vrmPath)

  VRMUtils.removeUnnecessaryVertices(vrm.scene)
  VRMUtils.combineSkeletons(vrm.scene)
  VRMUtils.combineMorphs(vrm)
  bakeMaterialsForExport(vrm.scene)
  bakeTextureImages(vrm.scene)

  const scene = new THREE.Scene()
  const model = vrm.scene
  model.rotation.y = Math.PI
  scene.add(model)

  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
      o.frustumCulled = true
    }
  })

  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const targetHeight = 1.95
  const scale = targetHeight / size.y
  model.scale.setScalar(scale)
  model.updateMatrixWorld(true)
  const box2 = new THREE.Box3().setFromObject(model)
  model.position.y -= box2.min.y
  model.position.x -= (box2.min.x + box2.max.x) * 0.5
  model.position.z -= (box2.min.z + box2.max.z) * 0.5

  console.log('Exporting GLB…')
  const buffer = await exportGlb(scene)
  fs.writeFileSync(OUT_GLB, buffer)
  const mb = (buffer.length / 1024 / 1024).toFixed(2)
  console.log(`Wrote ${OUT_GLB} (${mb} MB)`)

  vrm.dispose?.()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
