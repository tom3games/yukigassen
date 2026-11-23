// 恐竜の絵の水色（体）だけ色を変える。帽子・マフラー（クリーム）・ほっぺ・目・雪玉（ほぼ白）は変えない
// 絵1枚につき1回だけ計算して canvas を返す（three の CanvasTexture とタイトルの見本で使う）
export function tintCanvas(img, t, rect) {
  const sx = rect ? rect.x : 0, sy = rect ? rect.y : 0, w = rect ? rect.w : img.width, h = rect ? rect.h : img.height
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, sx, sy, w, h, 0, 0, w, h)
  if (!t || (t.hue === 195 && t.s === 1 && t.v === 1)) return c
  const d = x.getImageData(0, 0, w, h), p = d.data, dh = t.hue - 195
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue
    const r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn
    if (dl < 0.001) continue
    const s = dl / mx
    let hh
    if (mx === r) hh = 60 * (((g - b) / dl) % 6); else if (mx === g) hh = 60 * ((b - r) / dl + 2); else hh = 60 * ((r - g) / dl + 4)
    if (hh < 0) hh += 360
    if (hh < 168 || hh > 232 || s < 0.13 || mx < 0.25) continue   // 水色の体と白っぽいお腹だけ
    // 白に近い所（雪玉・お腹の明るい所）は少しだけ回す
    const k = Math.min(1, (s - 0.13) / 0.12)
    const nh = ((hh + dh * k) % 360 + 360) % 360, ns = Math.min(1, s * (1 + (t.s - 1) * k)), nv = Math.min(1, mx * (1 + (t.v - 1) * k))
    const C = nv * ns, X = C * (1 - Math.abs((nh / 60) % 2 - 1)), m = nv - C
    let R, G, B
    if (nh < 60) [R, G, B] = [C, X, 0]; else if (nh < 120) [R, G, B] = [X, C, 0]; else if (nh < 180) [R, G, B] = [0, C, X]
    else if (nh < 240) [R, G, B] = [0, X, C]; else if (nh < 300) [R, G, B] = [X, 0, C]; else [R, G, B] = [C, 0, X]
    p[i] = (R + m) * 255; p[i + 1] = (G + m) * 255; p[i + 2] = (B + m) * 255
  }
  x.putImageData(d, 0, 0)
  return c
}
