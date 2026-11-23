# 生成した絵（マゼンタ背景）を切り抜いて、1枚にまとめる。~/tools/pyimg/bin/python art/key.py
# 出力: img/dino.webp（恐竜12ポーズ）・img/props.webp（木3・雪だるま・茂み・岩）・img/bg.webp（遠景）・js/art.js（各ポーズの位置と大きさ）
import numpy as np, os, json
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../'
PX_PER_M = 626.0   # 立ち姿 約720px ＝ 1.15m

def keyed(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = np.minimum(r, b) - g
    al = 1 - np.clip((k - 22) / (90 - 22), 0, 1)
    sp = np.clip(np.minimum(r, b) - g, 0, None) * (al > 0)
    r2 = np.clip(r - sp, 0, 255); b2 = np.clip(b - sp * 0.85, 0, 255)
    im = Image.fromarray(np.dstack([r2, g, b2, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    A = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6)); im.putalpha(A)
    return im

def split3(im, n=3):
    m = np.asarray(im.split()[3]) > 100
    cols = m.sum(0) > 2
    runs, x = [], 0
    W = len(cols)
    while x < W:
        if cols[x]:
            s = x
            while x < W and cols[x]: x += 1
            runs.append([s, x])
        else: x += 1
    # 隙間の小さい物はつなぐ
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 24: merged[-1][1] = r[1]
        else: merged.append(r)
    merged = [r for r in merged if r[1] - r[0] > 40]
    colsum = m.sum(0)
    while len(merged) < n:                      # 足りない時は一番広い所を、真ん中あたりの一番細い列で割る
        i = max(range(len(merged)), key=lambda j: merged[j][1] - merged[j][0]); a, b = merged[i]
        lo, hi = a + (b - a) // 5, b - (b - a) // 5
        cut = lo + int(np.argmin(colsum[lo:hi]))
        merged[i:i + 1] = [[a, cut], [cut, b]]
    if len(merged) != n:
        print('  split fallback', path_note, [tuple(r) for r in merged]); merged = [[i * W // n, (i + 1) * W // n] for i in range(n)]
    out = []
    for x0, x1 in merged:
        c = im.crop((max(0, x0 - 6), 0, min(W, x1 + 6), im.height))
        bb = c.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox()
        out.append(c.crop(bb))
    return out

def pack(parts, scale, sheet_w, name, pad=6):
    ims = {k: v.resize((round(v.width * scale), round(v.height * scale)), Image.LANCZOS) for k, v in parts.items()}
    x = y = pad; shelf = 0; pos = {}
    for k in sorted(ims, key=lambda k: -ims[k].height):
        im = ims[k]
        if x + im.width + pad > sheet_w: x = pad; y += shelf + pad; shelf = 0
        pos[k] = dict(x=x, y=y, w=im.width, h=im.height); x += im.width + pad; shelf = max(shelf, im.height)
    H = y + shelf + pad; H = (H + 3) // 4 * 4
    A = Image.new('RGBA', (sheet_w, H), (0, 0, 0, 0))
    for k, im in ims.items(): A.paste(im, (pos[k]['x'], pos[k]['y']))
    A.save(OUT + 'img/' + name + '.webp', quality=88, method=6, alpha_quality=92)
    A.save(D + '/raw/_' + name + '_check.png')
    print(name, A.size, os.path.getsize(OUT + 'img/' + name + '.webp') // 1024, 'KB')
    return pos, H

SHEETS = {
  'front_a': ['f_stand', 'f_walk', 'f_throw'], 'back_b': ['b_stand', 'b_walk', 'b_throw'],
  'front_c': ['f_pack', 'f_down', 'f_cheer'], 'back_d': ['b_pack', 'b_down', 'b_cheer'],
}
parts = {}
for sh, names in SHEETS.items():
    path_note = sh
    for n, im in zip(names, split3(keyed(D + '/raw/' + sh + '.png'))): parts[n] = im
SC = 0.5
pos, H = pack(parts, SC, 2048, 'dino')
dino = {k: dict(pos[k], m_w=round(parts[k].width / PX_PER_M, 3), m_h=round(parts[k].height / PX_PER_M, 3)) for k in parts}

props = {}
for sh, names in {'trees_e': ['tree_a', 'tree_b', 'tree_c'], 'props_f': ['snowman', 'bush', 'rock'], 'props_h': ['sled', 'fence', 'bucket']}.items():
    path_note = sh
    for n, im in zip(names, split3(keyed(D + '/raw/' + sh + '.png'))): props[n] = im
pos2, H2 = pack(props, 0.42, 2048, 'props')
pr = {k: dict(pos2[k], px_h=props[k].height) for k in props}

bg = Image.open(D + '/raw/bg_g.png').convert('RGB')
bg.save(OUT + 'img/bg.webp', quality=82, method=6); print('bg', bg.size, os.path.getsize(OUT + 'img/bg.webp') // 1024, 'KB')
open(OUT + 'js/art.js', 'w').write('// art/key.py が作る。x,y,w,h は絵の中の位置（px）、m_w,m_h は世界での大きさ（m）\nexport const ART = ' + json.dumps({'dino': {'W': 2048, 'H': H, 'poses': dino}, 'props': {'W': 2048, 'H': H2, 'items': pr}}, separators=(',', ':')) + '\n')
