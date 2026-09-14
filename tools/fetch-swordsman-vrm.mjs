/**
 * 下载 VRoid Studio CC0 样本（无需自制模型）
 * https://opengameart.org/content/vroid-studio-cc0-models
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../source/models/landing/swordsman.vrm')
const CACHE = path.join(__dirname, '.cache')
const ZIP_URL = 'https://opengameart.org/sites/default/files/avatarsample_d_darkness.zip'

if (fs.existsSync(OUT)) {
  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1)
  console.log(`swordsman.vrm already present (${mb} MB)`)
  process.exit(0)
}

fs.mkdirSync(CACHE, { recursive: true })
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const zipPath = path.join(CACHE, 'avatarsample_d_darkness.zip')
console.log('Downloading VRoid CC0 AvatarSample_D_Darkness…')
const res = await fetch(ZIP_URL)
if (!res.ok) throw new Error(`Download failed: ${res.status}`)
fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()))
execSync(`unzip -o -q "${zipPath}" -d "${CACHE}"`)

const vrmSrc = path.join(CACHE, 'AvatarSample_D_Darkness.vrm')
if (!fs.existsSync(vrmSrc)) throw new Error('VRM missing in zip')
fs.copyFileSync(vrmSrc, OUT)
const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1)
console.log(`Saved ${OUT} (${mb} MB)`)
