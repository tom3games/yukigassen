// sim.js — 雪合戦の中身（three を使わない）。60Hz の1コマずつ step() で進める。node の bot 試験（tools/sim.mjs）からも使う
// 座標: 地面の上の x（左右）と z（手前が +）。自分のチーム（team 0）が手前、相手（team 1）が奥。真ん中を川が x の向きに流れる
// 元: mini-arcade/yukigassen.html（Canvas2D 版）の遊びをそのまま移した。画面の px を m に直してある
export const HX = 2.6, HZ = 6.2, FD = HZ * 2
export const C = {
  HP: 2, AMMO_MAX: 3, RELOAD: 34, THROW_CD: 16, REVIVE: 240, ROUND_WIN: 3,
  BALL_SPD: 0.15, BALL_LIFE: 80, BALL_R: 0.12, HIT_R: 0.4, PR: 0.36, MOVE: 0.042, WALL_T: 0.46, WALL_HP: 8,
  INTRO: 80, ROUND_GAP: 100, END_GAP: 80
}
// 難しさ: 狙いのずれ（ラジアン）・投げる間隔（コマ）・よけるか・撃ち控え
export const DIFF = [
  { id: 'easy', err: 0.3, rmin: 52, rvar: 50, dodge: 0.1, skip: 0.45, rescue: false },
  { id: 'normal', err: 0.23, rmin: 38, rvar: 40, dodge: 0.28, skip: 0.25, rescue: true },
  { id: 'hard', err: 0.17, rmin: 28, rvar: 30, dodge: 0.5, skip: 0.1, rescue: true }
]
// 壁の置き方: [横の位置 0〜1, 川からの近さ, 幅 0〜1]（上下対称に置く）と川の幅
export const MAPS = [
  { id: 'hiroba', riv: 0.09, f: [[0.3, 0.26, 0.32], [0.76, 0.26, 0.24]] },
  { id: 'nakajima', riv: 0.085, f: [[0.5, 0.3, 0.34], [0.2, 0.14, 0.2], [0.8, 0.14, 0.2]] },
  { id: 'futamata', riv: 0.1, f: [[0.28, 0.3, 0.24], [0.72, 0.3, 0.24], [0.5, 0.12, 0.26]] },
  { id: 'hiroi', riv: 0.12, f: [[0.5, 0.24, 0.42]] }
]

export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export function createSim(o = {}) {
  const S = {
    team: o.team ?? 2, diff: o.diff ?? 1, rng: o.rng ?? Math.random,
    units: [], balls: [], forts: [], wins: [0, 0], round: 0, map: MAPS[0],
    phase: 'title', timer: 0, tick: 0, winner: -1, roundWinner: -1, coins: 0, events: [],
    input: { mx: 0, mz: 0, pack: false, throwAng: null }, me: null, hits: [0, 0], throws: [0, 0], meThrows: 0
  }
  const R = () => S.rng()
  const ev = (type, d = {}) => S.events.push(Object.assign({ type }, d))
  const riverHalf = () => Math.max(0.55, FD * S.map.riv / 2)
  S.riverHalf = riverHalf
  const inFort = (x, z, pad) => { for (const f of S.forts) if (x > f.x - f.w / 2 - pad && x < f.x + f.w / 2 + pad && z > f.z - f.t / 2 - pad && z < f.z + f.t / 2 + pad) return f; return null }
  S.inFort = inFort

  function buildArena() {
    S.map = MAPS[(S.round - 1) % MAPS.length]
    S.forts = []
    let id = 0
    for (const s of [1, -1]) for (const [fx, fy, fw] of S.map.f) S.forts.push({ id: id++, x: (fx - 0.5) * HX * 2, z: s * FD * Math.min(fy, 0.22), w: fw * HX * 2, t: C.WALL_T, hp: C.WALL_HP, max: C.WALL_HP, side: s > 0 ? 0 : 1 })
  }
  function makeUnit(team, idx, human) {
    const dir = team === 0 ? 1 : -1, baseZ = dir * (HZ - 0.75)
    const n = S.team, x0 = (idx - (n - 1) / 2) * 1.15
    let x = Math.max(-HX + C.PR, Math.min(HX - C.PR, x0)), z = baseZ, g = 0
    while (inFort(x, z, C.PR * 0.7) && g++ < 40) z += dir * 0.1
    return { id: team * 10 + idx, team, idx, human, x, z, vx: 0, vz: 0, hp: C.HP, dead: false, reviveT: 0,
      ammo: C.AMMO_MAX, regen: 0, cd: 0, face: team === 0 ? -Math.PI / 2 : Math.PI / 2, flash: 0, packing: false,
      role: idx === 0 ? 'attack' : idx === 1 ? 'mid' : 'defend', aiThrow: 10 + (R() * 30 | 0), dodged: new Set(), stuckT: 0, unstick: 0, ux: 0, uz: 0, thrown: -99, hitT: -99, walk: 0 }
  }
  function startRound() {
    S.round++; buildArena(); S.units = []; S.balls = []
    for (let t = 0; t < 2; t++) for (let i = 0; i < S.team; i++) S.units.push(makeUnit(t, i, t === 0 && i === 0))
    S.me = S.units[0]; S.phase = 'intro'; S.timer = C.INTRO; S.roundWinner = -1
    S.input.pack = false; S.input.throwAng = null
    ev('round', { n: S.round, map: S.map.id })
  }
  S.start = function (team, diff) {
    if (team) S.team = team; if (diff != null) S.diff = diff
    S.wins = [0, 0]; S.round = 0; S.coins = 0; S.winner = -1; S.hits = [0, 0]; S.throws = [0, 0]; startRound()
  }
  S.preview = function (team) { S.team = team || S.team; S.round = 0; startRound(); S.phase = 'title' }   // タイトルの後ろの景色

  const nearestEnemy = u => { let b = null, bd = 1e9; for (const o of S.units) { if (o.team === u.team || o.dead) continue; const d = Math.hypot(o.x - u.x, o.z - u.z); if (d < bd) { bd = d; b = o } } return b }
  S.nearestEnemy = nearestEnemy
  const losClear = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.18); for (let i = 1; i < n; i++) { const t = i / n; if (inFort(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.04)) return false } return true }

  const blocker = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.18); for (let i = 1; i < n; i++) { const t = i / n, f = inFort(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.04); if (f) return f } return null }
  function throwBall(u, ang) {
    if (u.dead || u.cd > 0 || u.ammo <= 0) return false
    u.cd = C.THROW_CD; u.ammo--; u.regen = 0; u.face = ang; u.packing = false; u.thrown = S.tick
    const b = { id: S.tick * 10 + u.id % 10 + u.team * 5, x: u.x + Math.cos(ang) * C.PR, z: u.z + Math.sin(ang) * C.PR, vx: Math.cos(ang) * C.BALL_SPD, vz: Math.sin(ang) * C.BALL_SPD, team: u.team, owner: u.id, life: C.BALL_LIFE, age: 0, x0: u.x, z0: u.z }
    S.balls.push(b); S.throws[u.team]++; if (u.human) S.meThrows++
    ev('throw', { u, b })
    return true
  }
  S.throwBall = throwBall

  function hitUnit(o, b) {
    o.hp--; o.flash = 1; o.hitT = S.tick
    const a = Math.atan2(o.z - b.z, o.x - b.x); o.vx += Math.cos(a) * 0.08; o.vz += Math.sin(a) * 0.08
    S.hits[b.team]++
    ev('hit', { u: o, b, x: b.x, z: b.z })
    if (o.hp <= 0) { o.dead = true; o.packing = false; o.reviveT = 0; ev('down', { u: o }); checkRound() }
  }
  function stepBalls() {
    for (let i = S.balls.length - 1; i >= 0; i--) {
      const b = S.balls[i]
      const steps = Math.max(1, Math.ceil(C.BALL_SPD / (C.HIT_R * 0.5))); let gone = false
      for (let s = 0; s < steps && !gone; s++) {
        b.x += b.vx / steps; b.z += b.vz / steps
        if (b.x < -HX - 0.6 || b.x > HX + 0.6 || b.z < -HZ - 0.6 || b.z > HZ + 0.6) { gone = true; ev('miss', { b }); break }
        const f = inFort(b.x, b.z, 0)
        if (f) {
          f.hp--; ev('wallHit', { f, x: b.x, z: b.z, b })
          if (f.hp <= 0) { S.forts.splice(S.forts.indexOf(f), 1); ev('wallBreak', { f }) }
          gone = true; break
        }
        for (const o of S.units) { if (o.team === b.team || o.dead) continue; if (Math.hypot(o.x - b.x, o.z - b.z) < C.HIT_R + C.BALL_R) { hitUnit(o, b); gone = true; break } }
      }
      b.age++
      if (!gone && --b.life <= 0) { gone = true; ev('land', { b, x: b.x, z: b.z }) }
      if (gone) S.balls.splice(i, 1)
    }
  }
  function checkRound() {
    if (S.phase !== 'play') return
    const a0 = S.units.some(u => u.team === 0 && !u.dead), a1 = S.units.some(u => u.team === 1 && !u.dead)
    if (a0 && a1) return
    const w = a0 ? 0 : 1; S.wins[w]++; S.roundWinner = w
    if (w === 0) S.coins += 10
    S.phase = 'roundEnd'; S.timer = S.wins[w] >= C.ROUND_WIN ? C.END_GAP : C.ROUND_GAP
    ev('roundEnd', { w, wins: S.wins.slice() })
  }
  function stepRevive() {
    for (const d of S.units) {
      if (!d.dead) continue
      let helper = null
      for (const u of S.units) { if (u === d || u.dead || u.team !== d.team) continue; if (Math.hypot(u.x - d.x, u.z - d.z) < C.PR * 1.9) { helper = u; break } }
      if (helper) { d.reviveT++; if (d.reviveT >= C.REVIVE) { d.dead = false; d.hp = 1; d.ammo = C.AMMO_MAX; d.reviveT = 0; d.flash = 1; ev('revive', { u: d, by: helper }) } }
      else d.reviveT = Math.max(0, d.reviveT - 2)
    }
  }
  function moveUnit(u, mx, mz) {
    if (u.dead) return
    u.vx += (mx * C.MOVE - u.vx) * 0.2; u.vz += (mz * C.MOVE - u.vz) * 0.2
    const pad = C.PR * 0.7, stuck = inFort(u.x, u.z, pad)
    const nx = u.x + u.vx; if (stuck || !inFort(nx, u.z, pad)) u.x = nx; else u.vx *= -0.2
    const nz = u.z + u.vz; if (stuck || !inFort(u.x, nz, pad)) u.z = nz; else u.vz *= -0.2
    u.x = Math.max(-HX + C.PR, Math.min(HX - C.PR, u.x))
    const rh = riverHalf()
    if (u.team === 0) u.z = Math.max(rh + C.PR * 0.5, Math.min(HZ - C.PR, u.z))
    else u.z = Math.min(-rh - C.PR * 0.5, Math.max(-HZ + C.PR, u.z))
    const sp = Math.hypot(u.vx, u.vz)
    if (Math.abs(mx) + Math.abs(mz) > 0.1) u.face = Math.atan2(mz, mx)
    u.walk += sp
    if (u.cd > 0) u.cd--
    if (u.flash > 0) u.flash = Math.max(0, u.flash - 0.08)
  }
  function controlHuman(u) {
    const I = S.input
    if (u.dead) { I.throwAng = null; return }
    if (I.throwAng != null) { throwBall(u, I.throwAng); I.throwAng = null; I.pack = false }
    const mv = Math.abs(I.mx) + Math.abs(I.mz) > 0.15
    if (mv && I.pack) I.pack = false                         // 動いたら ためる を切る（スイッチ式）
    if (I.pack && u.ammo >= C.AMMO_MAX) I.pack = false        // 満タンで自動で切れる
    u.packing = I.pack
    if (u.packing) {
      if (++u.regen >= C.RELOAD) { u.ammo++; u.regen = 0; ev('pack', { u }) }
      moveUnit(u, 0, 0); return
    }
    let mx = I.mx, mz = I.mz; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l }
    moveUnit(u, mx, mz)
  }
  function controlAI(u) {
    if (u.dead) return
    const D = DIFF[S.diff] || DIFF[1]
    if (u.ammo < C.AMMO_MAX) { if (++u.regen >= C.RELOAD) { u.ammo++; u.regen = 0 } }
    u.packing = u.ammo === 0
    const rh = riverHalf(), e = nearestEnemy(u)
    let goRev = null
    if (D.rescue) {
      let dm = null, dd = 1e9
      for (const o of S.units) if (o.dead && o.team === u.team) { const d = Math.hypot(o.x - u.x, o.z - u.z); if (d < dd) { dd = d; dm = o } }
      if (dm) { let closest = true; for (const a of S.units) { if (a === u || a.dead || a.team !== u.team || a.human) continue; if (Math.hypot(a.x - dm.x, a.z - dm.z) < dd) { closest = false; break } } if (closest) goRev = dm }
    }
    let tx, tz
    if (goRev) { tx = goRev.x; tz = goRev.z }
    else {
      const bank = u.team === 0 ? rh + C.PR + FD * 0.06 : -rh - C.PR - FD * 0.06
      tz = bank + (u.role === 'defend' ? (u.team === 0 ? FD * 0.14 : -FD * 0.14) : 0)
      tx = (e ? e.x : 0) + Math.sin(S.tick * 0.025 + u.idx * 2 + u.team) * HX * 2 * 0.13 + (u.idx - (S.team - 1) / 2) * 1.2   // 味方と横に散らばる
      tx = Math.max(-HX + C.PR, Math.min(HX - C.PR, tx))
      if (e && !losClear(u.x, u.z, e.x, e.z)) {                 // 壁で見えない時は壁の端へ回る（元の版はここで止まって終わらなかった）
        const f = blocker(u.x, u.z, e.x, e.z)
        if (f) { const l = f.x - f.w / 2 - 0.7, r = f.x + f.w / 2 + 0.7; tx = (Math.abs(u.x - l) < Math.abs(u.x - r) || r > HX - C.PR) && l > -HX + C.PR ? l : r }
      }
    }
    for (const b of S.balls) {
      if (b.team === u.team) continue
      const dx = u.x - b.x, dz = u.z - b.z
      if (Math.hypot(dx, dz) < 1.7 && (dx * b.vx + dz * b.vz) > 0 && !u.dodged.has(b.id)) {   // 自分に向かって来る玉は1回だけよけるか決める
        u.dodged.add(b.id); if (R() < D.dodge) u.dodge = { dir: b.vx >= 0 ? -1 : 1, t: 18 }
      }
    }
    if (u.dodge && u.dodge.t-- > 0) tx = u.x + u.dodge.dir * 1.3
    else u.dodge = null
    if (u.dodged.size > 40) u.dodged.clear()
    { const f = inFort(tx, tz, C.PR + 0.1); if (f) tz = f.z + (u.team === 0 ? -1 : 1) * (f.t / 2 + C.PR + 0.15) }   // 行き先が壁の中なら川の側へ
    if (u.unstick > 0) { u.unstick--; tx = u.ux; tz = u.uz }
    let ax = tx - u.x, az = tz - u.z; const d = Math.hypot(ax, az) || 1; ax /= d; az /= d; if (d < 0.18) { ax = 0; az = 0 }
    const px = u.x, pz = u.z
    moveUnit(u, ax, az)
    // 動きたいのに動けない時間が続いたら、少しの間だけ別の所へ（壁の角で止まらない）
    if ((ax || az) && Math.hypot(u.x - px, u.z - pz) < C.MOVE * 0.25) { if (++u.stuckT > 30) { u.stuckT = 0; u.unstick = 40; u.ux = u.x + (R() < 0.5 ? -1.6 : 1.6); u.uz = u.z + (u.team === 0 ? 0.8 : -0.8) } } else u.stuckT = 0
    const los = e && losClear(u.x, u.z, e.x, e.z)
    u.noLos = los ? 0 : (u.noLos || 0) + 1                      // 2秒以上隠れられたら壁ごと崩しにかかる
    if (e && u.cd <= 0 && u.ammo > 0 && !goRev && (los || u.noLos > 120)) {
      if (--u.aiThrow <= 0) {
        const solo = S.team === 1 && u.team === 1 ? 1.15 : u.team === 0 ? (S.team === 3 ? 1.1 : 1.3) : 1   // 1対1 は相手を少しゆるく。味方の CPU は主役を食わないよう少し弱く
        if (R() >= D.skip) throwBall(u, Math.atan2(e.z - u.z, e.x - u.x) + (R() * 2 - 1) * D.err * solo)
        u.aiThrow = (D.rmin + (R() * D.rvar | 0)) * solo | 0
      }
    }
  }

  S.step = function () {
    S.tick++
    if (S.phase === 'title') { for (const u of S.units) { u.vx *= 0.8; u.vz *= 0.8 } return }
    if (S.phase === 'intro') { if (--S.timer <= 0) { S.phase = 'play'; ev('go') } return }
    if (S.phase === 'over') return
    if (S.phase === 'roundEnd') {
      for (const u of S.units) { u.vx *= 0.85; u.vz *= 0.85; u.x += u.vx; u.z += u.vz }
      stepBalls()
      if (--S.timer <= 0) {
        if (S.wins[0] >= C.ROUND_WIN || S.wins[1] >= C.ROUND_WIN) { S.winner = S.wins[0] >= C.ROUND_WIN ? 0 : 1; if (S.winner === 0) S.coins += 50; S.phase = 'over'; ev('matchEnd', { w: S.winner }) }
        else startRound()
      }
      return
    }
    for (const u of S.units) { if (u.human) controlHuman(u); else controlAI(u) }
    // 味方どうしは重ならない（軽く押し合う）
    for (const a of S.units) for (const b of S.units) {
      if (a.id >= b.id || a.team !== b.team || a.dead || b.dead) continue
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = C.PR * 2.2
      if (d < min && d > 1e-4) { const k = (min - d) / d * 0.25; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k }
      else if (d <= 1e-4) { a.x -= 0.05; b.x += 0.05 }
    }
    stepBalls(); stepRevive()
  }
  return S
}
