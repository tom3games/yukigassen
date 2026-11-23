// game.js — 画面（タイトル・遊び方・遊び中・結果）と操作、音、1秒60コマの進行
import './sfx.js'
import { createSim, C, HX, HZ, DIFF, mulberry } from './sim.js'
import { createBot } from './bot.js'
import { createView } from './view.js'
import { tintCanvas } from './tint.js'
import { ART } from './art.js'
import { SKINS, ENEMY, ENEMY_ALT, WARM, T } from './data.js'

const $ = s => document.querySelector(s)
const Q = new URLSearchParams(location.search)
const isTouch = matchMedia('(pointer: coarse)').matches
const Snd = window.Snd
window.__jsUp = true

// ---------- セーブ ----------
const SAVE_KEY = 'yk3_save'
const DEF = { coins: 0, skin: 'aqua', owned: ['aqua'], diff: 0, team: 2, tut: false, lang: '' }
let save = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.owned) return Object.assign({}, DEF, s) } catch (e) {} return Object.assign({}, DEF) })()
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch (e) {} }
let lang = Q.get('lang') || save.lang || (/^ja/i.test(navigator.language || 'ja') ? 'ja' : 'en')
const L = () => T[lang]
let muted = (() => { try { return localStorage.getItem('yk_mute') === '1' } catch (e) { return false } })()
Snd.setMute(muted)

// ---------- 音 ----------
const STEPS = [1, 2, 3, 4, 5, 6, 7].map(i => `snd/step${i}.mp3`)
Snd.def({
  throw: ['snd/swish.mp3', 'snd/swish3.mp3', 'snd/swish6.mp3'], hit: 'snd/snowhit.mp3', wall: ['snd/step1.mp3', 'snd/step3.mp3', 'snd/step7.mp3'],
  wallBreak: ['snd/land1.mp3', 'snd/land2.mp3'], pack: ['snd/step2.mp3', 'snd/step4.mp3', 'snd/step5.mp3'], step: STEPS,
  down: 'snd/land1.mp3', cloth: 'snd/cloth.mp3', revive: 'snd/chime.mp3', whistle: 'snd/whistle.mp3', good: 'snd/j_good.mp3', bad: 'snd/j_bad.mp3',
  applause: 'snd/applause.mp3', coin: 'snd/coin.mp3', click: 'snd/click.mp3'
})
const ambOn = () => { Snd.loop('amb', 'snd/wind_loop.wav', 0.14); Snd.loop('kids', 'snd/kids.mp3', 0.07) }
const bgmOn = on => Snd.loop('bgm', on ? 'snd/bgm.mp3' : null, 0.2, 1.2)
let firstTouch = false
addEventListener('pointerdown', () => { Snd.init(); if (!firstTouch) { firstTouch = true; ambOn() } }, true)

// ---------- 3D と中身 ----------
const cv = $('#cv')
const view = createView(cv, { hudTop: h => (window.__safeTop || 0) + 66, keep: Q.has('keep') })
const S = createSim({ team: save.team, diff: save.diff, rng: Q.get('seed') ? mulberry(+Q.get('seed')) : Math.random })
let W = innerWidth, H = innerHeight
function resize() { W = innerWidth; H = innerHeight; view.fit(W, H) }
addEventListener('resize', resize)

// ---------- 恐竜の色 ----------
let dinoImg = null
const tinted = {}
function tintFor(key, t) { if (!tinted[key]) tinted[key] = tintCanvas(dinoImg, t); return tinted[key] }
const skinOf = id => SKINS.find(s => s.id === id) || SKINS[0]
function hueCss(t, l = 58) { return `hsl(${t.hue} ${Math.round(Math.min(1, t.s) * 70 + 10)}% ${t.s < 0.3 ? 88 : l}%)` }
function applyTeams() {
  const sk = skinOf(save.skin), en = WARM.includes(sk.id) ? ENEMY_ALT : ENEMY
  view.setTeamCanvas(0, tintFor('s_' + sk.id, sk)); view.setTeamCanvas(1, tintFor(WARM.includes(sk.id) ? 'e_alt' : 'e', en))
  document.documentElement.style.setProperty('--me', hueCss(sk)); document.documentElement.style.setProperty('--foe', hueCss(en, 62))
  drawFaces()
}
// 頭だけの小さい絵（上の帯の生き残り）
function faceCanvas(team) {
  const sk = skinOf(save.skin), src = team === 0 ? tintFor('s_' + sk.id, sk) : tintFor(WARM.includes(sk.id) ? 'e_alt' : 'e', WARM.includes(sk.id) ? ENEMY_ALT : ENEMY)
  const p = ART.dino.poses.f_stand, c = document.createElement('canvas'); c.width = 64; c.height = 64
  c.getContext('2d').drawImage(src, p.x + p.w * 0.06, p.y + p.h * 0.05, p.w * 0.88, p.w * 0.88, 0, 0, 64, 64); return c
}
let faceSrc = [null, null]
function drawFaces() { if (!dinoImg) return; faceSrc = [faceCanvas(0), faceCanvas(1)]; hudBuilt = false }

// ---------- 画面の切り替え ----------
const views = ['#vTitle', '#vHow', '#vResult', '#hud']
function show(id) { for (const v of views) $(v).hidden = v !== id; if (id === '#hud') $('#hud').hidden = false }
let mode = 'title'

// ---------- 文言 ----------
function texts() {
  const t = L(); document.documentElement.lang = lang
  $('#tSub').textContent = t.sub; $('#bPlay span').textContent = t.play; $('#bHow').textContent = t.howto; $('#bLang').textContent = t.lang
  $('#lDiff').textContent = t.diffL; $('#lTeam').textContent = t.teamL
  document.querySelectorAll('#segDiff button').forEach((b, i) => b.textContent = t.diff[i])
  document.querySelectorAll('#segTeam button').forEach((b, i) => b.textContent = t.team(i + 1))
  $('#howTitle').textContent = t.howTitle; $('#bHowClose').textContent = t.close; $('#howCredit').textContent = t.credit
  const list = isTouch ? t.howTouch : t.howPC
  $('#howList').innerHTML = list.map(([k, s]) => `<li><svg viewBox="0 0 40 40" aria-hidden="true">${ICON[k]}</svg><span>${s}</span></li>`).join('')
  $('#bAgain').textContent = t.again; $('#bToTitle').textContent = t.toTitle; $('#bPost').textContent = t.post; $('#bSave').textContent = t.save
  if ($('#ldText')) $('#ldText').textContent = t.loading
  renderSkin()
}
const ICON = {
  move: '<circle cx="20" cy="20" r="14" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="26" cy="15" r="6" fill="currentColor"/>',
  aim: '<path d="M8 32 L30 10" stroke="currentColor" stroke-width="3" stroke-dasharray="3 5" stroke-linecap="round"/><circle cx="31" cy="9" r="6" fill="#fff" stroke="currentColor" stroke-width="2.5"/>',
  pack: '<circle cx="20" cy="22" r="9" fill="#fff" stroke="currentColor" stroke-width="2.5"/><path d="M6 24c0-7 4-11 7-11M34 24c0-7-4-11-7-11" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/>',
  revive: '<path d="M20 34c-8-5-13-10-13-16a6 6 0 0 1 13-3 6 6 0 0 1 13 3c0 6-5 11-13 16z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>',
  win: '<path d="M11 33V7M11 8h18l-4 6 4 6H11" stroke="currentColor" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'
}

// ---------- タイトル ----------
let viewSkin = Math.max(0, SKINS.findIndex(s => s.id === save.skin))
function renderSkin() {
  const sk = SKINS[viewSkin], t = L(), owned = save.owned.includes(sk.id)
  $('#coinN').textContent = save.coins
  $('#skinName').textContent = t.skin[sk.id]
  const b = $('#bSkin')
  if (save.skin === sk.id) { b.textContent = t.using; b.disabled = true; b.dataset.k = 'using' }
  else if (owned) { b.textContent = t.use; b.disabled = false; b.dataset.k = 'use' }
  else if (save.coins >= sk.cost) { b.innerHTML = COIN + t.buy(sk.cost); b.disabled = false; b.dataset.k = 'buy' }
  else { b.innerHTML = COIN + t.need(sk.cost - save.coins); b.disabled = true; b.dataset.k = 'need' }
  if (dinoImg) {
    const p = ART.dino.poses.f_stand, c = $('#pv'), x = c.getContext('2d'), src = tintFor('s_' + sk.id, sk)
    c.width = p.w; c.height = p.h; x.clearRect(0, 0, p.w, p.h); x.globalAlpha = owned ? 1 : 0.55; x.drawImage(src, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h)
  }
  document.querySelectorAll('#segDiff button').forEach((bb, i) => bb.setAttribute('aria-pressed', i === save.diff))
  document.querySelectorAll('#segTeam button').forEach((bb, i) => bb.setAttribute('aria-pressed', i + 1 === save.team))
}
const COIN = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#f3c34c" stroke="#9a6a16" stroke-width="1.6"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#c78f22" stroke-width="1.4"/></svg>'
$('#bPrev').onclick = () => { viewSkin = (viewSkin + SKINS.length - 1) % SKINS.length; renderSkin() }
$('#bNext').onclick = () => { viewSkin = (viewSkin + 1) % SKINS.length; renderSkin() }
$('#bSkin').onclick = () => {
  const sk = SKINS[viewSkin]
  if (!save.owned.includes(sk.id)) { if (save.coins < sk.cost) return; save.coins -= sk.cost; save.owned.push(sk.id); Snd.play('coin', { vol: 0.7 }) }
  else Snd.play('click', { vol: 0.6 })
  save.skin = sk.id; persist(); applyTeams(); renderSkin()
}
document.querySelectorAll('#segDiff button').forEach((b, i) => b.onclick = () => { save.diff = i; persist(); renderSkin(); Snd.play('click', { vol: 0.5 }) })
document.querySelectorAll('#segTeam button').forEach((b, i) => b.onclick = () => { save.team = i + 1; persist(); renderSkin(); Snd.play('click', { vol: 0.5 }); S.preview(save.team); view.setRound(S) })
$('#bHow').onclick = () => { show('#vHow'); mode = 'how' }
$('#bHowClose').onclick = () => { show('#vTitle'); mode = 'title' }
$('#bLang').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; save.lang = lang; persist(); texts() }
function setMute(m) { muted = m; Snd.setMute(m); try { localStorage.setItem('yk_mute', m ? '1' : '0') } catch (e) {} document.querySelectorAll('.bMute').forEach(b => b.setAttribute('aria-pressed', m)) }
document.querySelectorAll('.bMute').forEach(b => b.onclick = e => { e.stopPropagation(); setMute(!muted) })
setMute(muted)
$('#bPlay').onclick = () => { Snd.init(); Snd.play('click', { vol: 0.7 }); startMatch() }
$('#bAgain').onclick = () => { Snd.play('click', { vol: 0.7 }); startMatch() }
$('#bToTitle').onclick = () => toTitle()
$('#bQuit').onclick = e => { e.stopPropagation(); toTitle() }

function toTitle() { mode = 'title'; view.setCam('title', true); bgmOn(false); S.preview(save.team); view.setRound(S); show('#vTitle'); renderSkin() }

// ---------- 試合 ----------
let bot = Q.has('bot') ? createBot(S, { kind: Q.get('bot') === 'idle' ? 'idle' : 'human' }) : null
let tut = null
function startMatch() {
  mode = 'play'; S.start(save.team, save.diff); hudBuilt = false
  show('#hud'); clearPads(); bgmOn(true); view.setCam('play')
  tut = save.tut || Q.has('notut') ? null : { t: 0, threw: false, packShown: false }
  onRound()
}
function onRound() { view.setRound(S); hudBuilt = false; S.input.mx = S.input.mz = 0; S.input.pack = false; S.input.throwAng = null; clearPads() }

// ---------- 上の帯 ----------
let hudBuilt = false
function buildHud() {
  for (const t of [0, 1]) {
    const box = $(t ? '#foeFaces' : '#meFaces'); box.innerHTML = ''
    for (const u of S.units.filter(v => v.team === t)) { const c = document.createElement('canvas'); c.width = c.height = 64; c.className = 'face'; c.dataset.id = u.id; if (faceSrc[t]) c.getContext('2d').drawImage(faceSrc[t], 0, 0); box.appendChild(c) }
  }
  hudBuilt = true
}
let lastHud = ''
function updateHud() {
  if (!hudBuilt) buildHud()
  const key = S.units.map(u => u.dead ? 0 : 1).join('') + S.wins.join('') + S.round + S.me.ammo + S.input.pack + lang
  if (key === lastHud) return; lastHud = key
  document.querySelectorAll('.face').forEach(c => c.classList.toggle('out', !!S.units.find(u => u.id === +c.dataset.id && u.dead)))
  for (const t of [0, 1]) $(t ? '#foeWins' : '#meWins').innerHTML = [0, 1, 2].map(i => `<i class="${i < S.wins[t] ? 'on' : ''}"></i>`).join('')
  $('#roundNo').textContent = L().round(S.round)
  document.querySelectorAll('#ammo i').forEach((b, i) => b.classList.toggle('on', i < S.me.ammo))
  $('#bPack').classList.toggle('on', !!S.input.pack)
  $('#bPack').classList.toggle('need', S.me.ammo === 0 && !S.input.pack && !S.me.dead)
}

// ---------- 大きい文字 ----------
let bannerT = 0
function banner(text, cls = '', frames = 70) { const b = $('#banner'); b.textContent = text; b.className = 'show ' + cls; bannerT = frames }

// ---------- 操作（スマホ: 左で動く・右でなぞって投げる・まんなかで ためる / PC: キーとクリック） ----------
const pads = { move: null, aim: null }
const padEl = { move: $('#padL'), aim: $('#padR') }
const PADR = () => Math.max(46, Math.min(W, H) * 0.13)
function clearPads() { pads.move = pads.aim = null; for (const k in padEl) padEl[k].classList.remove('on'); S.input.mx = S.input.mz = 0; view.aim = null }
const touchEl = $('#touch')
touchEl.addEventListener('pointerdown', e => {
  if (mode !== 'play') return
  e.preventDefault()
  if (e.pointerType === 'mouse') { mouseThrow(e.clientX, e.clientY); return }
  const k = e.clientX < W / 2 ? 'move' : 'aim'
  if (pads[k]) return
  pads[k] = { id: e.pointerId, bx: e.clientX, by: e.clientY, tx: e.clientX, ty: e.clientY, t0: performance.now() }
  const el = padEl[k]; el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'; el.classList.add('on'); el.querySelector('.knob').style.transform = 'translate(-50%,-50%)'
  try { touchEl.setPointerCapture(e.pointerId) } catch (er) {}
}, { passive: false })
touchEl.addEventListener('pointermove', e => {
  for (const k in pads) { const p = pads[k]; if (p && p.id === e.pointerId) { p.tx = e.clientX; p.ty = e.clientY; const v = padVec(p); padEl[k].querySelector('.knob').style.transform = `translate(calc(-50% + ${v.x * v.f / (v.len || 1) * PADR()}px), calc(-50% + ${v.y * v.f / (v.len || 1) * PADR()}px))` } }
}, { passive: false })
const endPad = e => {
  for (const k in pads) {
    const p = pads[k]; if (!p || p.id !== e.pointerId) continue
    if (k === 'aim' && e.type === 'pointerup') releaseAim(p)
    pads[k] = null; padEl[k].classList.remove('on'); if (k === 'move') { S.input.mx = S.input.mz = 0 } else view.aim = null
  }
}
touchEl.addEventListener('pointerup', endPad); touchEl.addEventListener('pointercancel', endPad)
function padVec(p) { const dx = p.tx - p.bx, dy = p.ty - p.by, len = Math.hypot(dx, dy); return { x: dx, y: dy, len, f: Math.min(1, len / PADR()) } }
// 画面上のなぞった向き → 地面の上の向き（遠近のぶんを直す）
function screenDirToAng(dx, dy) {
  const me = S.me, s0 = view.screenOf(me.x, 0, me.z, W, H), l = Math.hypot(dx, dy) || 1
  const g = view.groundAt(s0.x + dx / l * 140, s0.y + dy / l * 140, W, H)
  return g ? Math.atan2(g.z - me.z, g.x - me.x) : Math.atan2(dy, dx)
}
function aimAng() { const p = pads.aim; if (!p) return null; const v = padVec(p); if (v.len < 14) return null; return screenDirToAng(v.x, v.y) }
function releaseAim(p) {
  const me = S.me; if (!me || me.dead) return
  const v = padVec(p); let ang
  if (v.len >= 14) ang = screenDirToAng(v.x, v.y)
  else { const e = S.nearestEnemy(me); if (!e) return; ang = Math.atan2(e.z - me.z, e.x - me.x) }
  S.input.throwAng = ang
  if (tut) tut.threw = true
}
function mouseThrow(x, y) { const me = S.me; if (!me || me.dead) return; const g = view.groundAt(x, y, W, H); if (!g) return; S.input.throwAng = Math.atan2(g.z - me.z, g.x - me.x); if (tut) tut.threw = true }
const keys = {}
addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true
  if (mode === 'play' && (e.key === ' ' || e.key.toLowerCase() === 'r')) { e.preventDefault(); togglePack() }
})
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false })
function togglePack() { if (S.me.dead) return; S.input.pack = !S.input.pack; if (S.input.pack && S.me.ammo >= C.AMMO_MAX) S.input.pack = false }
$('#bPack').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Snd.init(); togglePack() })
// PC のマウスで狙いの線を出す
let mouseAim = null
touchEl.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') mouseAim = { x: e.clientX, y: e.clientY } })
touchEl.addEventListener('pointerleave', () => { mouseAim = null })

function readInput() {
  if (bot) { bot(); return }
  let mx = 0, mz = 0
  if (pads.move) { const v = padVec(pads.move), R = PADR(); if (v.len > R * 0.16) { mx = Math.max(-1, Math.min(1, v.x / R)); mz = Math.max(-1, Math.min(1, v.y / R)) } }
  if (keys.a || keys.arrowleft) mx = -1; if (keys.d || keys.arrowright) mx = 1; if (keys.w || keys.arrowup) mz = -1; if (keys.s || keys.arrowdown) mz = 1
  S.input.mx = mx; S.input.mz = mz
}

// ---------- 出来事 → 絵と音 ----------
function onEvents() {
  for (const e of S.events) {
    switch (e.type) {
      case 'throw': Snd.play('throw', { vol: e.u.human ? 0.75 : 0.45, rate: 1.05 }); view.fx.throwPuff(e.u.x, e.u.z); break
      case 'hit': Snd.play('hit', { vol: 0.9, rate: 1.1 }); view.fx.hit(e.x, e.z, e.u.team); if (e.u.human) hurt(); if (e.b && S.units.find(u => u.id === e.b.owner && u.human)) Snd.duck(0.7, 0.4); break
      case 'wallHit': Snd.play('wall', { vol: 0.55, rate: 0.8 }); view.fx.wall(e.x, e.z, e.f); break
      case 'wallBreak': Snd.play('wallBreak', { vol: 0.8 }); view.fx.wallBreak(e.f); break
      case 'land': view.fx.land(e.x, e.z); Snd.play('step', { vol: 0.25, rate: 1.3 }); break
      case 'down': Snd.play('down', { vol: 0.8 }); Snd.play('cloth', { vol: 0.5, delay: 0.08 }); view.fx.down(e.u.x, e.u.z); break
      case 'revive': Snd.play('revive', { vol: 0.6 }); view.fx.revive(e.u.x, e.u.z); break
      case 'pack': if (e.u.human) Snd.play('pack', { vol: 0.55, rate: 0.9 }); break
      case 'round': onRound(); banner(L().round(e.n), '', C.INTRO - 18); break
      case 'go': banner(L().go, 'go', 40); Snd.play('whistle', { vol: 0.55 }); break
      case 'roundEnd': { const w = e.w === 0; banner(w ? L().roundWin : L().roundLose, w ? 'win' : 'lose', 90); Snd.play(w ? 'good' : 'bad', { vol: 0.7, jitter: 0 }); Snd.duck(0.35, 1.4); clearPads(); break }
      case 'matchEnd': setTimeout(() => showResult(e.w), 900); break
    }
  }
  S.events.length = 0
}
function hurt() { const h = $('#hurt'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on') }

// ---------- 教え（最初の1回だけ・文字は2つまで） ----------
function updateTut() {
  const el = $('#tut'); if (!tut || S.round > 1) { if (el.className) el.className = ''; if (tut && S.round > 1) { save.tut = true; persist(); tut = null } return }
  tut.t++
  let cls = ''
  if (S.phase === 'play') {
    if (!tut.threw) cls = tut.t < 240 ? 'move aim' : 'aim'
    else if (S.me.ammo === 0 && !S.input.pack) cls = 'pack'
  }
  const k = cls + lang
  if (el.dataset.k !== k) {
    el.dataset.k = k; el.className = cls
    const t = L()
    $('#tutMove b').textContent = isTouch ? t.tutMove : 'WASD'
    $('#tutAim b').textContent = isTouch ? t.tutAim : (lang === 'ja' ? 'クリックで なげる' : 'Click to throw')
    $('#tutPack b').textContent = t.tutPack
  }
}

// ---------- 結果 ----------
function showResult(w) {
  if (mode !== 'play') return
  mode = 'result'; bgmOn(false); view.setCam('result')
  save.coins += S.coins; persist()
  const t = L(), won = w === 0
  $('#rStamp').textContent = won ? t.win : t.lose; $('#rStamp').className = (won ? 'win' : 'lose') + (lang === 'en' ? ' en' : '')
  $('#rScore').innerHTML = `<b>${S.wins[0]}</b><span>-</span><b>${S.wins[1]}</b>`
  $('#rCoins').innerHTML = COIN + t.coins(S.coins)
  const next = SKINS.find(s => !save.owned.includes(s.id) && save.coins >= s.cost)
  $('#rNew').textContent = next ? t.newSkin : ''
  Snd.play(won ? 'good' : 'bad', { vol: 0.8, jitter: 0 }); if (won) Snd.play('applause', { vol: 0.45, delay: 0.3 }); if (S.coins) Snd.play('coin', { vol: 0.5, delay: 0.7 })
  show('#vResult')
  const url = 'https://tom3games.com/play/yukigassen/'
  $('#bPost').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(t.postText(won, S.wins[0], S.wins[1])) + '&url=' + encodeURIComponent(url), '_blank', 'noopener')
  $('#bSave').onclick = () => saveImage(won)
}
function saveImage(won) {
  view.render(S, {}); const shot = cv.toDataURL('image/jpeg', 0.9)
  const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d')
    const s = Math.max(1080 / img.width, 1350 / img.height); x.drawImage(img, (1080 - img.width * s) / 2, (1350 - img.height * s) / 2, img.width * s, img.height * s)
    x.fillStyle = 'rgba(247,251,255,.86)'; x.fillRect(0, 1350 - 300, 1080, 300)
    x.fillStyle = '#1f2b45'; x.textAlign = 'center'; x.font = '120px "Mochiy Pop One", sans-serif'; x.fillText(`${S.wins[0]} - ${S.wins[1]}`, 540, 1350 - 150)
    x.font = '56px "Mochiy Pop One", sans-serif'; x.fillText((won ? L().win : L().lose) + '  ゆきがっせん', 540, 1350 - 60)
    c.toBlob(async b => {
      const f = new File([b], 'yukigassen.png', { type: 'image/png' })
      try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return } } catch (e) {}
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'yukigassen.png'; a.click()
    }, 'image/png')
  }; img.src = shot
}

// ---------- 進行（60コマ/秒で固定） ----------
let acc = 0, last = performance.now(), paused = false, fpsN = 0, fpsT = 0, fps = 60
function frame(now) {
  requestAnimationFrame(frame)
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  fpsN++; fpsT += dt; if (fpsT >= 1) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0 }
  if (!paused) { acc += dt; let n = 0; while (acc >= 1 / 60 && n < 6) { tick(); acc -= 1 / 60; n++ } if (n >= 6) acc = 0 }
  draw()
}
function tick() {
  if (mode === 'play') { readInput() }
  S.step(); onEvents()
  if (mode === 'play') { updateHud(); updateTut(); if (bannerT > 0 && --bannerT === 0) $('#banner').className = '' }
  const dm = $('#downMsg'), down = mode === 'play' && S.me && S.me.dead && S.phase === 'play'
  if (down !== !dm.hidden) { dm.hidden = !down; dm.textContent = S.units.some(u => u.team === 0 && !u.dead) ? L().downMe : L().downSolo }
}
function draw() {
  let aim = null
  if (mode === 'play' && S.me && !S.me.dead) {
    let a = aimAng()
    if (a == null && mouseAim && !isTouch) { const g = view.groundAt(mouseAim.x, mouseAim.y, W, H); if (g) a = Math.atan2(g.z - S.me.z, g.x - S.me.x) }
    if (a != null) aim = { x: S.me.x, z: S.me.z, ang: a, len: 6.5 }
  }
  view.render(S, { aim, aiming: !!pads.aim, onStep: u => { if (mode === 'play' && (u.human || Math.random() < 0.3)) Snd.play('step', { vol: u.human ? 0.22 : 0.08 }) } })
}

// ---------- 読み込み ----------
async function boot() {
  const bar = $('#ldBar i'); let parts = 0; const tot = 2
  const step = () => { parts++; bar.style.width = Math.round(parts / tot * 100) + '%' }
  window.__safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0
  resize()
  const img = new Image(); img.decoding = 'async'
  const imgP = new Promise(ok => { img.onload = () => ok(img); img.onerror = () => ok(null); img.src = 'img/dino.webp?v=' + (window.__V || 1) })
  const [di] = await Promise.all([imgP.then(r => { step(); return r }), view.load(p => { bar.style.width = Math.round((parts + p) / tot * 100) + '%' }).then(step)])
  dinoImg = di
  applyTeams(); texts()
  S.preview(save.team); view.setRound(S); resize()
  show('#vTitle')
  const ld = $('#loading'); ld.classList.add('out'); setTimeout(() => ld.remove(), 450)
  window.__ykReady = true
  if (Q.has('auto')) startMatch()
}
requestAnimationFrame(frame)
boot()

// ---------- 検証用の窓口 ----------
window.yk = {
  S, view, C, HX, HZ,
  get mode() { return mode }, get fps() { return fps }, get save() { return save },
  dbg: { pause(b = true) { paused = b }, step(n = 1) { for (let i = 0; i < n; i++) tick(); draw() }, fast(n = 60) { for (let i = 0; i < n && mode === 'play'; i++) tick(); draw() } },
  get soundCalls() { return Object.assign({}, Snd.played) }, packXY() { const r = $('#bPack').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } },
  start: () => startMatch(), toTitle, setLang(l) { lang = l; texts() },
  useBot(kind = 'human') { bot = createBot(S, { kind }) }, noBot() { bot = null },
  meXY() { return view.screenOf(S.me.x, 0.6, S.me.z, W, H) },
  unitXY(id) { const u = S.units.find(v => v.id === id); return u ? view.screenOf(u.x, 0.6, u.z, W, H) : null },
  forceEnd(w = 0) { S.wins[w] = C.ROUND_WIN; S.winner = w; S.phase = 'over'; S.events.push({ type: 'matchEnd', w }) },
  setSkin(id) { save.skin = id; if (!save.owned.includes(id)) save.owned.push(id); applyTeams(); renderSkin() }
}
