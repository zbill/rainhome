// Rainlet 单仓库聚合构建脚本
// 构建 clock 与 quiz 两个子应用，并把主站静态文件一并聚合到 dist/
// 供 EdgeOne Pages 部署（输出目录 dist，edge-functions 由平台从仓库根自动识别）
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'dist')
const log = (m) => console.log(`[build] ${m}`)

// 1. 清理旧产物
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// 2. 构建 clock（base=/clock/）
log('构建 clock ...')
execSync('npm ci', { cwd: join(root, 'clock'), stdio: 'inherit' })
execSync('npm run build', { cwd: join(root, 'clock'), stdio: 'inherit' })

// 3. 构建 quiz（base=/quiz/）
log('构建 quiz ...')
execSync('npm ci', { cwd: join(root, 'quiz'), stdio: 'inherit' })
execSync('npm run build', { cwd: join(root, 'quiz'), stdio: 'inherit' })

// 4. 聚合子应用产物
log('聚合子应用产物 ...')
cpSync(join(root, 'clock', 'dist'), join(dist, 'clock'), { recursive: true })
cpSync(join(root, 'quiz', 'dist'), join(dist, 'quiz'), { recursive: true })

// 5. 拷贝主站静态文件（部署在根路径 /）
for (const item of ['index.html', 'css', 'js', 'icons', 'favicon.svg', 'robots.txt']) {
  if (existsSync(join(root, item))) {
    cpSync(join(root, item), join(dist, item), { recursive: true })
  }
}

log('构建完成 → dist/（主站根 + clock/ + quiz/）')
