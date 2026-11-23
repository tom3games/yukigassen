import '../mute-auto.mjs'
// 画面を撮る（無音）。node tools/shot.mjs [chromium|webkit] [幅x高さ ...]
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = new URL('..', import.meta.url).pathname
mkdirSync(ROOT + 'shots', { recursive: true })
const PORT = 5391
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const eng = process.argv[2] === 'webkit' ? webkit : chromium
const sizes = (process.argv.slice(3).length ? process.argv.slice(3) : ['390x844']).map(s => s.split('x').map(Number))
const b = await eng.launch()
for (const [w, h] of sizes) {
  const touch = w < 700
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch && eng === chromium, locale: 'ja-JP' })
  const p = await ctx.newPage(); const errs = []
  p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\./.test(r.url())) errs.push('reqfail ' + r.url()) })
  const t0 = Date.now()
  await p.goto(`http://localhost:${PORT}/?seed=3&notut`); await p.waitForFunction(() => window.__ykReady, null, { timeout: 20000 })
  const ready = Date.now() - t0
  await p.waitForTimeout(600)
  const tag = `${eng === webkit ? 'wk' : 'cr'}_${w}x${h}`
  await p.screenshot({ path: `${ROOT}shots/${tag}_title.png` })
  const over = await p.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }))
  await p.evaluate(() => { yk.useBot('human'); yk.start() })
  await p.waitForTimeout(4200)
  await p.screenshot({ path: `${ROOT}shots/${tag}_play.png` })
  await p.waitForTimeout(3000)
  await p.screenshot({ path: `${ROOT}shots/${tag}_play2.png` })
  const fps = await p.evaluate(() => yk.fps)
  console.log(tag, 'ready', ready + 'ms', 'fps', fps.toFixed(0), JSON.stringify(over), errs.length ? errs.slice(0, 5) : 'no errors')
  await ctx.close()
}
await b.close(); server.kill()
