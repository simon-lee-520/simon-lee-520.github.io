/**
 * 检查鱼群 glB 是否已放入仓库
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CANDIDATES = [
  'fish.glb',
  'shiny_fish.glb'
].map((name) => path.join(__dirname, '../source/models/landing', name))
const README = path.join(__dirname, '../docs/landing/models.md')

for (const file of CANDIDATES) {
  if (fs.existsSync(file)) {
    const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2)
    console.log(`fish GLB OK (${mb} MB) → ${file}`)
    process.exit(0)
  }
}

console.warn(`
[fish] 未找到 ${CANDIDATES.join(' 或 ')}

请将瘦身后的 glTF Binary (.glb) 放到 source/models/landing/，详见：
  ${README}

在 GLB 就绪前，海底鱼群将使用程序化占位。
`)
process.exit(0)
