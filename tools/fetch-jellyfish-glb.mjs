/**
 * 检查主水母 glB 是否已放入仓库
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CANDIDATES = [
  'blue_jellyfish.glb',
  'jellyfish.glb'
].map((name) => path.join(__dirname, '../source/models/landing', name))
const README = path.join(__dirname, '../source/models/landing/README.md')

for (const file of CANDIDATES) {
  if (fs.existsSync(file)) {
    const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2)
    console.log(`jellyfish GLB OK (${mb} MB) → ${file}`)
    process.exit(0)
  }
}

console.warn(`
[jellyfish] 未找到 ${CANDIDATES.join(' 或 ')}

请将 glTF Binary (.glb) 放到 source/models/landing/，详见：
  ${README}

在 GLB 就绪前，海底主水母将使用程序化占位。
`)
process.exit(0)
