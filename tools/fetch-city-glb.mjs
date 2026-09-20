/**
 * 检查城市 glB；若缺失或 --force 则从 Downloads 原版温和压缩生成
 * （禁用 join/simplify，避免把 2.5D 卡片压成细条）
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '../source/models/landing/city.glb')
const README = path.join(__dirname, '../docs/landing/models.md')
const SRC_CANDIDATES = [
  path.join(process.env.HOME || '', 'Downloads/au_revoir_sketchfab_please_read_below.glb'),
  path.join(process.env.HOME || '', 'Downloads/au_revoir_sketchfab_please_read_below(1).glb')
]

const force = process.argv.includes('--force')
if (fs.existsSync(FILE) && !force) {
  const mb = (fs.statSync(FILE).size / 1024 / 1024).toFixed(2)
  console.log(`city GLB OK (${mb} MB) → ${FILE}`)
  process.exit(0)
}

const src = SRC_CANDIDATES.find((p) => fs.existsSync(p))
if (src) {
  console.log(
    force && fs.existsSync(FILE)
      ? `[city] --force：从原版重新压缩：\n  ${src}`
      : `[city] 未找到成品，从原版温和压缩：\n  ${src}`
  )
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  const r = spawnSync(
    'npx',
    [
      '--yes',
      '@gltf-transform/cli@4.1.1',
      'optimize',
      src,
      FILE,
      '--compress',
      'draco',
      '--texture-compress',
      'webp',
      '--texture-size',
      '1024',
      '--join',
      'false',
      '--simplify',
      'false',
      '--flatten',
      'false',
      '--instance',
      'false',
      '--palette',
      'false',
      '--weld',
      'false'
    ],
    { stdio: 'inherit', cwd: '/tmp' }
  )
  if (r.status === 0 && fs.existsSync(FILE)) {
    const mb = (fs.statSync(FILE).size / 1024 / 1024).toFixed(2)
    console.log(`city GLB written (${mb} MB) → ${FILE}`)
    process.exit(0)
  }
}

console.warn(`
[city] 未找到 ${FILE}

请将瘦身后的城市 glTF Binary (.glb) 放到 source/models/landing/city.glb，详见：
  ${README}

推荐压缩（勿开 join/simplify）：
  cd /tmp && npx --yes @gltf-transform/cli@4.1.1 optimize \\
    ~/Downloads/au_revoir_sketchfab_please_read_below.glb \\
    ${FILE} \\
    --compress draco --texture-compress webp --texture-size 1024 \\
    --join false --simplify false --flatten false --instance false --palette false --weld false

缺失时第二幕仅使用 2D matte 远景。
`)
process.exit(0)
