import './mute-auto.mjs'
// og.png（1200x630）を作る: 遊んでいる場面＋題名。node og.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: '5396' } })
await new Promise(r => setTimeout(r, 400))
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } })
await p.goto('http://localhost:5396/?seed=11&notut&lang=ja'); await p.waitForFunction(() => window.__ykReady)
await p.evaluate(() => { yk.useBot('human'); yk.start() })
// 雪玉が飛んでいて、誰かに当たった直後を探す
await p.waitForFunction(() => yk.S.phase === 'play', null, { timeout: 8000 })
for (let i = 0; i < 3000; i++) { const ok = await p.evaluate(() => { yk.dbg.pause(true); yk.dbg.step(1); const m = yk.S.me; return !m.dead && yk.S.tick - m.thrown === 6 && yk.S.units.filter(u => u.team === 1 && !u.dead).length === 2 && yk.S.balls.length >= 2 }); if (ok) break }
await p.evaluate(() => { yk.view.hideMarks = true; const m = yk.S.me; yk.view.camOverride = { pos: [m.x - 1.0, 3.0, m.z + 3.4], tgt: [m.x + 0.6, 0.7, m.z - 5.5], fov: 40 }; yk.dbg.step(2) })
await p.addStyleTag({ content: '#hud{display:none!important}#og{position:fixed;left:36px;top:34px;padding:18px 34px 22px 26px;border-radius:28px;background:radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,.75) 70%,rgba(255,255,255,0));transform:rotate(-3deg);text-align:left;z-index:50;font-family:"Mochiy Pop One",sans-serif;color:#1f2b45}#og h1{font-weight:400;font-size:92px;line-height:1;text-shadow:0 4px 0 #fff,0 10px 26px rgba(40,70,110,.35)}#og p{margin-top:14px;font-size:30px;letter-spacing:.06em;text-shadow:0 2px 0 #fff,0 0 16px #fff}' })
await p.evaluate(() => { const d = document.createElement('div'); d.id = 'og'; d.innerHTML = '<h1>ゆきがっせん</h1><p>川ごしに 雪玉を投げ合え</p>'; document.body.appendChild(d) })
await p.waitForTimeout(500)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
