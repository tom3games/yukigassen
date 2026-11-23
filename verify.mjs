import './mute-auto.mjs'
// ゆきがっせんの検査。node verify.mjs（無音。Chromium と WebKit）
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = +(process.env.VPORT || 5393)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
  console.log(results[results.length - 1])
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '?seed=5') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('keep')) localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__ykReady, null, { timeout: 30000 })
  return p
}
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  if (de.scrollWidth > W + 1) over.push('pagew:' + de.scrollWidth)
  for (const el of document.querySelectorAll('.view:not([hidden]) button, .view:not([hidden]) canvas, #hud:not([hidden]) button')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
    const r = el.getBoundingClientRect(); if (!r.width) continue
    if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.left) + ',' + Math.round(r.top) + '-' + Math.round(r.right) + ',' + Math.round(r.bottom))
  }
  return { H, over: over.slice(0, 6) }
})
// 描いた絵の明るさの散らばり（ほぼ単色＝何も描けていない）
const variance = p => p.evaluate(() => new Promise(ok => requestAnimationFrame(() => {
  const c = document.querySelector('#cv'), x = document.createElement('canvas'); x.width = 64; x.height = 128; const g = x.getContext('2d'); g.drawImage(c, 0, 0, 64, 128)
  const d = g.getImageData(0, 0, 64, 128).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  ok(Math.round(s2 / n - (s / n) ** 2))
})))
// Chromium だけ: 本物の指のなぞり（CDP の touch）
async function drag(p, x0, y0, x1, y1, steps = 8, hold = 0) {
  const cdp = await p.context().newCDPSession(p)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] })
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps, id: 1 }] }); await p.waitForTimeout(16) }
  if (hold) await p.waitForTimeout(hold)
  return async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
}

const browser = await chromium.launch(MUTE_LAUNCH)
const t0 = Date.now()
const p = await open(browser, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
await t('起動時にエラーが出ない・準備完了まで', async () => { expect(p.errs.length === 0, p.errs.join('|')); return { ms: Date.now() - t0 } })
await t('ブラウザの拡大が起きない', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
})
await t('OGP 一式と canonical・転送がある', async () => {
  const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]'), !!document.querySelector('link[rel=canonical]'), !!document.getElementById('ghMove')))
  expect(r.every(Boolean), JSON.stringify(r))
})
await t('タイトルの3Dが描けている（明るさの散らばり）', async () => { const v = await variance(p); expect(v > 150, v); return v })
await t('色を変える: コインが足りない色は選べない・足りれば買える', async () => {
  const r = await p.evaluate(async () => {
    const out = {}; document.querySelector('#bNext').click(); out.need = document.querySelector('#bSkin').dataset.k
    yk.save.coins = 500; document.querySelector('#bPrev').click(); document.querySelector('#bNext').click(); out.buy = document.querySelector('#bSkin').dataset.k
    document.querySelector('#bSkin').click(); out.after = document.querySelector('#bSkin').dataset.k; out.skin = yk.save.skin; out.coins = yk.save.coins
    const me = getComputedStyle(document.documentElement).getPropertyValue('--me'); out.me = me
    return out
  })
  expect(r.need === 'need' && r.buy === 'buy' && r.after === 'using' && r.skin === 'yuzu' && r.coins === 380, JSON.stringify(r)); return r
})
await t('遊び方が開いて閉じる（スマホ用の文）', async () => {
  await p.tap('#bHow'); const a = await p.evaluate(() => ({ open: !document.querySelector('#vHow').hidden, n: document.querySelectorAll('#howList li').length, txt: document.querySelector('#howList').textContent }))
  await p.screenshot({ path: ROOT + '/shots/v_how.png' })
  await p.tap('#bHowClose'); const b = await p.evaluate(() => !document.querySelector('#vTitle').hidden)
  expect(a.open && a.n === 5 && /なぞって/.test(a.txt) && b, JSON.stringify(a))
})
// --- 遊び中（本物の指で）
await p.tap('#bPlay')
await p.waitForFunction(() => yk.S.phase === 'play', null, { timeout: 5000 })
await p.waitForTimeout(400)
await t('最初の1回だけ教えが出る（文字は2つまで）', async () => {
  const r = await p.evaluate(() => ({ cls: document.querySelector('#tut').className, texts: [...document.querySelectorAll('#tut>div')].filter(d => getComputedStyle(d).display !== 'none').length }))
  await p.screenshot({ path: ROOT + '/shots/v_tut.png' })
  expect(/aim/.test(r.cls) && r.texts <= 2, JSON.stringify(r)); return r
})
await t('左をなぞると自分が動く（本物の指）', async () => {
  await p.evaluate(() => yk.dbg.pause(false))
  const a = await p.evaluate(() => ({ x: yk.S.me.x, z: yk.S.me.z }))
  const up = await drag(p, 90, 640, 160, 640, 6, 900); await up()
  const b = await p.evaluate(() => ({ x: yk.S.me.x, z: yk.S.me.z }))
  expect(b.x - a.x > 0.6, JSON.stringify({ a, b })); return { dx: +(b.x - a.x).toFixed(2) }
})
await t('右をなぞって離すと、なぞった向きに雪玉を投げる（狙いの線も出る）', async () => {
  const before = await p.evaluate(() => ({ th: yk.S.meThrows, ammo: yk.S.me.ammo }))
  const up = await drag(p, 290, 640, 290, 520, 6, 120)
  const aim = await p.evaluate(() => yk.view.scene.children.filter(o => o.isInstancedMesh && o.count === 14).length)
  await p.screenshot({ path: ROOT + '/shots/v_aim.png' })
  await up(); await p.waitForTimeout(60)
  const r = await p.evaluate(() => { const b = yk.S.balls.find(bb => bb.owner === yk.S.me.id); return { th: yk.S.meThrows, ammo: yk.S.me.ammo, ang: b ? Math.atan2(b.vz, b.vx) : null } })
  expect(r.th === before.th + 1 && r.ammo === before.ammo - 1 && r.ang != null && r.ang < -1.1 && r.ang > -2.0 && aim >= 1, JSON.stringify({ before, r, aim })); return { ang: +r.ang.toFixed(2) }
})
await t('ちょんと押すと近い相手へ投げる', async () => {
  await p.waitForTimeout(400)
  const before = await p.evaluate(() => yk.S.meThrows)
  await p.touchscreen.tap(300, 600); await p.waitForTimeout(80)
  const r = await p.evaluate(() => yk.S.meThrows)
  expect(r === before + 1, r)
})
await t('ためる はスイッチ式（1回押すと入りっぱなし・光る・玉が増える・もう一度で切れる）', async () => {
  const xy = await p.evaluate(() => yk.packXY())
  await p.touchscreen.tap(xy.x, xy.y); await p.waitForTimeout(100)
  const on = await p.evaluate(() => ({ pack: yk.S.input.pack, cls: document.querySelector('#bPack').className, ammo: yk.S.me.ammo }))
  await p.waitForTimeout(900)
  const mid = await p.evaluate(() => ({ ammo: yk.S.me.ammo, pack: yk.S.input.pack }))
  if (mid.pack) { await p.touchscreen.tap(xy.x, xy.y); await p.waitForTimeout(80) }
  const off = await p.evaluate(() => yk.S.input.pack)
  expect(on.pack && /on/.test(on.cls) && mid.ammo > on.ammo && !off, JSON.stringify({ on, mid, off })); return { from: on.ammo, to: mid.ammo }
})
await t('音を鳴らす操作のあとも実際には無音（Chromium）・音は呼ばれている', async () => {
  const r = await p.evaluate(() => ({ ok: window.__muteOk(), calls: window.__soundCalls, played: yk.soundCalls }))
  expect(r.ok && r.played.throw > 0 && r.played.click > 0, JSON.stringify(r)); return { throw: r.played.throw }
})
await t('遊び中の画面に余計な文字がない（同時に2つまで）', async () => {
  const n = await p.evaluate(() => [...document.querySelectorAll('#banner.show, #downMsg:not([hidden]), #tut>div')].filter(e => getComputedStyle(e).display !== 'none' && e.textContent.trim()).length)
  expect(n <= 2, n); return n
})
// 人の速さの bot で最後まで（早送り）
await t('人の速さの bot で 勝ち負けまで通る・結果画面が出る', async () => {
  await p.evaluate(() => { yk.useBot('human') })
  let r
  for (let i = 0; i < 80; i++) { r = await p.evaluate(() => { yk.dbg.fast(600); return { mode: yk.mode, phase: yk.S.phase, w: yk.S.wins } }); if (r.phase === 'over') break }
  await p.waitForFunction(() => yk.mode === 'result', null, { timeout: 5000 })
  await p.waitForTimeout(700)
  await p.screenshot({ path: ROOT + '/shots/v_result.png' })
  const res = await p.evaluate(() => ({ stamp: document.querySelector('#rStamp').textContent, score: document.querySelector('#rScore').textContent, again: !!document.querySelector('#bAgain'), support: !!document.querySelector('#tmSupport'), home: !!document.querySelector('#tmHome'), coins: yk.save.coins }))
  expect(/かち|まけ/.test(res.stamp) && res.again && res.support && res.home, JSON.stringify(res)); return Object.assign(r, res)
})
await t('結果: もう一回で次の試合が始まる', async () => {
  await p.tap('#bAgain'); await p.waitForTimeout(200)
  const r = await p.evaluate(() => ({ mode: yk.mode, round: yk.S.round, wins: yk.S.wins }))
  expect(r.mode === 'play' && r.round === 1 && r.wins.join() === '0,0', JSON.stringify(r))
})
await t('何もしない通しは負ける（最低の結果）', async () => {
  await p.evaluate(() => { yk.useBot('idle') })
  let r; for (let i = 0; i < 80; i++) { r = await p.evaluate(() => { yk.dbg.fast(600); return { phase: yk.S.phase, w: yk.S.wins, winner: yk.S.winner } }); if (r.phase === 'over') break }
  expect(r.winner === 1, JSON.stringify(r)); return r.w
})
await t('タイトルへ戻れる', async () => {
  await p.waitForFunction(() => yk.mode === 'result', null, { timeout: 5000 }); await p.tap('#bToTitle'); await p.waitForTimeout(300)
  const r = await p.evaluate(() => ({ mode: yk.mode, title: !document.querySelector('#vTitle').hidden, hud: document.querySelector('#hud').hidden }))
  expect(r.mode === 'title' && r.title && r.hud, JSON.stringify(r))
})
await t('英語に切り替わる', async () => {
  await p.tap('#bLang'); await p.waitForTimeout(100)
  const r = await p.evaluate(() => ({ play: document.querySelector('#bPlay').textContent, diff: document.querySelector('#segDiff').textContent, lang: document.documentElement.lang }))
  await p.screenshot({ path: ROOT + '/shots/v_title_en.png' })
  await p.tap('#bLang')
  expect(r.play === 'PLAY' && /Easy/.test(r.diff) && r.lang === 'en', JSON.stringify(r))
})
await t('3人ずつでも、1人ずつでも始まって終わる', async () => {
  const out = {}
  for (const n of [3, 1]) {
    await p.evaluate(n => { document.querySelectorAll('#segTeam button')[n - 1].click() }, n)
    await p.tap('#bPlay'); await p.evaluate(() => yk.useBot('human'))
    let r; for (let i = 0; i < 80; i++) { r = await p.evaluate(() => { yk.dbg.fast(600); return { phase: yk.S.phase, units: yk.S.units.length, w: yk.S.wins } }); if (r.phase === 'over') break }
    out[n] = r; await p.waitForFunction(() => yk.mode === 'result', null, { timeout: 5000 }); await p.tap('#bToTitle'); await p.waitForTimeout(150)
  }
  expect(out[3].units === 6 && out[3].phase === 'over' && out[1].units === 2 && out[1].phase === 'over', JSON.stringify(out)); return out
})
await t('Chromium: エラーなし（通しのあと）', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.context().close()

// --- 3サイズ × 全画面で一画面に収まる
for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [430, 932, 'big']]) {
  const q = await open(browser, { viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }, '?seed=2&notut')
  const v = {}
  v.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.tap('#bHow'); v.how = await fit(q); await q.tap('#bHowClose')
  await q.tap('#bPlay'); await q.evaluate(() => yk.useBot('human')); await q.waitForTimeout(2600); v.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await t(`${name}: 自陣の四隅と相手の奥の端が画面の中`, async () => {
    const r = await q.evaluate(() => { const { HX, HZ, C } = yk, W = innerWidth, H = innerHeight, out = []
      for (const [x, z, y] of [[-HX + C.PR, HZ - C.PR, 1.3], [HX - C.PR, HZ - C.PR, 1.3], [-HX + C.PR, 0.8, 1.3], [HX - C.PR, 0.8, 1.3], [-HX + C.PR, -HZ + C.PR, 1.3], [HX - C.PR, -HZ + C.PR, 1.3], [0, HZ - C.PR, 0]]) {
        const s = yk.view.screenOf(x, y, z, W, H); if (s.x < 4 || s.x > W - 4 || s.y < 60 || s.y > H - 4) out.push([x, z, Math.round(s.x), Math.round(s.y)]) }
      return out })
    expect(!r.length, JSON.stringify(r))
  })
  await q.evaluate(() => yk.forceEnd(0)); await q.waitForFunction(() => yk.mode === 'result', null, { timeout: 5000 }); await q.waitForTimeout(700); v.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  for (const [k, r] of Object.entries(v)) await t(`一画面に収まる ${name} ${w}x${h} ${k}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: エラーなし`, async () => { expect(!q.errs.length, q.errs.join('|')) })
  await q.context().close()
}
// --- X のアプリ内ブラウザ: 下 52px に操作が入らない
{
  const q = await open(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, '?seed=2&notut&inapp=x')
  await q.tap('#bPlay'); await q.waitForTimeout(300)
  await t('X の中: ためるボタンが下 52px より上', async () => { const r = await q.evaluate(() => document.querySelector('#bPack').getBoundingClientRect().bottom); expect(r <= 844 - 52, r); return Math.round(r) })
  await q.context().close()
}
// --- PC（マウスとキー）
{
  const q = await open(browser, { viewport: { width: 1280, height: 800 } }, '?seed=4&notut')
  await q.screenshot({ path: `${ROOT}/shots/pc-title.png` })
  await q.click('#bPlay'); await q.waitForFunction(() => yk.S.phase === 'play', null, { timeout: 5000 })
  await t('PC: キーで動き、クリックした所へ投げる', async () => {
    const a = await q.evaluate(() => yk.S.me.x)
    await q.keyboard.down('d'); await q.waitForTimeout(700); await q.keyboard.up('d')
    const b = await q.evaluate(() => yk.S.me.x)
    const e = await q.evaluate(() => { const en = yk.S.units.find(u => u.team === 1); return yk.view.screenOf(en.x, 0, en.z, innerWidth, innerHeight) })
    const th = await q.evaluate(() => yk.S.meThrows); await q.mouse.click(e.x, e.y); await q.waitForTimeout(60)
    const th2 = await q.evaluate(() => yk.S.meThrows)
    await q.keyboard.press(' '); const pk = await q.evaluate(() => yk.S.input.pack)
    await q.screenshot({ path: `${ROOT}/shots/pc-play.png` })
    expect(b - a > 0.5 && th2 === th + 1 && pk, JSON.stringify({ a, b, th, th2, pk }))
  })
  await t('PC: エラーなし', async () => { expect(!q.errs.length, q.errs.join('|')) })
  await q.context().close()
}
await browser.close()

// --- WebKit（iPhone 相当）
const wb = await webkit.launch()
{
  const wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '?seed=6&notut')
  await t('WebKit: タイトルが描けている', async () => { await wp.screenshot({ path: `${ROOT}/shots/wk-title.png` }); const v = await variance(wp); expect(v > 150, v); return v })
  await wp.tap('#bPlay'); await wp.waitForTimeout(1500)
  await t('WebKit: ちょんと押すと投げる・ためるが切り替わる', async () => {
    await wp.waitForFunction(() => yk.S.phase === 'play', null, { timeout: 5000 })
    const th = await wp.evaluate(() => yk.S.meThrows); await wp.touchscreen.tap(300, 600); await wp.waitForTimeout(80)
    const th2 = await wp.evaluate(() => yk.S.meThrows)
    const xy = await wp.evaluate(() => yk.packXY()); await wp.touchscreen.tap(xy.x, xy.y); await wp.waitForTimeout(60)
    const pk = await wp.evaluate(() => yk.S.input.pack)
    await wp.screenshot({ path: `${ROOT}/shots/wk-play.png` })
    expect(th2 === th + 1 && pk, JSON.stringify({ th, th2, pk }))
  })
  await t('WebKit: 2本指の touchmove を止める', async () => {
    const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
    expect(r, r)
  })
  await t('WebKit: 人の速さの bot で結果まで', async () => {
    await wp.evaluate(() => yk.useBot('human'))
    let r; for (let i = 0; i < 80; i++) { r = await wp.evaluate(() => { yk.dbg.fast(600); return { phase: yk.S.phase, w: yk.S.wins } }); if (r.phase === 'over') break }
    await wp.waitForFunction(() => yk.mode === 'result', null, { timeout: 5000 }); await wp.waitForTimeout(700)
    await wp.screenshot({ path: `${ROOT}/shots/wk-result.png` }); return r.w
  })
  await t('WebKit: 実際には無音', async () => { const r = await wp.evaluate(() => window.__muteOk()); expect(r, r) })
  await t('WebKit: エラーなし', async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
}
await wb.close()
server.kill()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
