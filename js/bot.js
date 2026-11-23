// bot.js — 人の速さで遊ぶ bot（試験用。ゲーム本体の ?bot=1 と tools/sim.mjs の両方から使う）
// 見てから動くまで 0.5〜1秒遅れる・狙いがずれる・ときどき迷う。玉が切れたら ためる。何もしない型 idle も持つ
import { C, HX } from './sim.js'
export function createBot(S, o = {}) {
  const R = o.rng || Math.random, kind = o.kind || 'human'
  const st = { wait: 30, plan: null, aimErr: o.aimErr ?? 0.16, react: o.react ?? [30, 60], packAt: 0, sway: R() * 6 }
  return function tick() {
    const I = S.input, u = S.me
    if (kind === 'idle' || !u || S.phase !== 'play') { I.mx = I.mz = 0; return }
    if (u.dead) { I.mx = I.mz = 0; I.pack = false; return }
    if (--st.wait > 0) return                         // 考えている間は前の操作のまま
    st.wait = st.react[0] + (R() * (st.react[1] - st.react[0]) | 0)
    const e = S.nearestEnemy(u)
    // 玉が無い → 止まって ためる（スイッチを入れる）
    if (u.ammo === 0 || (u.ammo < C.AMMO_MAX && !e)) { I.mx = I.mz = 0; I.pack = true; return }
    if (I.pack && u.ammo < 2) return
    I.pack = false
    // 倒れた仲間が近ければ助けに行く
    const down = S.units.find(o2 => o2.team === 0 && o2.dead && !o2.human)
    if (down && Math.hypot(down.x - u.x, down.z - u.z) < 3 && R() < 0.6) { const dx = down.x - u.x, dz = down.z - u.z, l = Math.hypot(dx, dz) || 1; I.mx = dx / l; I.mz = dz / l; return }
    // 前の岸へ寄りつつ左右にふらふら
    const bankZ = S.riverHalf() + C.PR + 1.1, tx = Math.max(-HX + 0.6, Math.min(HX - 0.6, (e ? e.x : 0) + Math.sin(S.tick * 0.02 + st.sway) * 1.6))
    let mx = tx - u.x, mz = bankZ - u.z; const l = Math.hypot(mx, mz)
    if (l < 0.3) { mx = 0; mz = 0 } else { mx /= l; mz /= l }
    I.mx = mx; I.mz = mz
    if (e && u.ammo > 0 && R() < 0.75) I.throwAng = Math.atan2(e.z - u.z, e.x - u.x) + (R() * 2 - 1) * st.aimErr
  }
}
