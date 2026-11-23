// view.js — 雪原の3D（three.js）。中身（sim）を読んで描くだけで、遊びの判定はしない
// 恐竜と木は生成した絵の板（カメラの方を向く）。地面・雪の壁・川・雪玉・雪しぶき・足跡・息の白さは3D
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { ART } from './art.js'
import { HX, HZ, C } from './sim.js'

const DS = 1.2   // 恐竜の絵の大きさ（当たりの大きさは sim の PR）
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

function softTex(size = 64, stops = [[0, 1], [0.45, 0.6], [1, 0]]) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d')
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`)
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
// 足跡（3本指の恐竜）と雪玉の跡を1枚に。左半分が足跡、右半分が着地の跡
function decalTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d')
  x.clearRect(0, 0, 256, 128)
  const foot = (ox) => {
    x.save(); x.translate(ox, 64)
    const g = x.createRadialGradient(0, 14, 2, 0, 14, 30); g.addColorStop(0, 'rgba(70,95,140,.55)'); g.addColorStop(1, 'rgba(70,95,140,0)')
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 14, 22, 28, 0, 0, 7); x.fill()
    for (const [dx, dy] of [[-17, -22], [0, -30], [17, -22]]) { const h = x.createRadialGradient(dx, dy, 1, dx, dy, 12); h.addColorStop(0, 'rgba(60,85,130,.6)'); h.addColorStop(1, 'rgba(60,85,130,0)'); x.fillStyle = h; x.beginPath(); x.arc(dx, dy, 12, 0, 7); x.fill() }
    x.restore()
  }
  foot(64)
  x.save(); x.translate(192, 64)
  const r = x.createRadialGradient(0, 0, 10, 0, 0, 58); r.addColorStop(0, 'rgba(60,90,140,.42)'); r.addColorStop(0.55, 'rgba(60,90,140,.18)'); r.addColorStop(0.75, 'rgba(255,255,255,.0)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = r; x.beginPath(); x.arc(0, 0, 58, 0, 7); x.fill(); x.restore()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

export function createView(canvas, o = {}) {
  const lowQ = isTouch
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.keep })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQ ? 2 : 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = !lowQ;   // iPhone の Safari で影の地図が地面ごと暗くなった（2026-11-24 シミュレーターで確認）。スマホは丸い影だけ
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#bcdcf6')
  scene.fog = new THREE.Fog('#dfeaf6', 26, 62)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 200)

  // 光: 左上の低い冬の日ざし（背景の絵の太陽と同じ向き）と、空からの青い光
  const hemi = new THREE.HemisphereLight('#eef6ff', '#b4c6de', 1.6); scene.add(hemi)
  const sun = new THREE.DirectionalLight('#fff3e2', 1.5); sun.position.set(-7, 11, -6); scene.add(sun, sun.target)
  sun.castShadow = true; sun.shadow.mapSize.set(lowQ ? 1024 : 2048, lowQ ? 1024 : 2048)
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 10, bottom: -10, near: 1, far: 40 }); sun.shadow.bias = -0.0008; sun.shadow.radius = 3
  const fill = new THREE.DirectionalLight('#cfe0ff', 0.35); fill.position.set(5, 4, 8); scene.add(fill)

  const loader = new THREE.TextureLoader()
  const tex = { }
  const loadT = (url, srgb = true) => new Promise(ok => loader.load(url, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; ok(t) }, undefined, () => ok(null)))

  // ---------- 地面（川の所だけ掘り下げる） ----------
  const GW = 46, GD = 64
  const groundGeo = new THREE.PlaneGeometry(GW, GD, lowQ ? 92 : 138, lowQ ? 128 : 192); groundGeo.rotateX(-Math.PI / 2)
  const gpos = groundGeo.attributes.position, gbase = Float32Array.from(gpos.array)
  groundGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(gpos.count * 3), 3)); const gcol = groundGeo.attributes.color
  const groundMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, vertexColors: true })
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.receiveShadow = true; ground.position.z = -8; scene.add(ground)
  const noise = (x, z) => Math.sin(x * 0.7 + z * 0.3) * 0.5 + Math.sin(x * 0.23 - z * 0.41 + 1.3) * 0.8 + Math.sin(z * 0.9 + x * 1.7) * 0.15
  let curRH = -1
  function shapeGround(rh) {
    if (rh === curRH) return; curRH = rh
    for (let i = 0; i < gpos.count; i++) {
      const x = gbase[i * 3], z = gbase[i * 3 + 2] - 8
      const az = Math.abs(z)
      let y = -0.42 * smooth(rh + 0.28, rh - 0.12, az)                              // 川の土手
      const out = Math.max(smooth(HX + 0.6, HX + 3, Math.abs(x)), smooth(HZ + 0.6, HZ + 4, Math.abs(z)))   // 遊ぶ所の外はなだらかな起伏
      y += out * (noise(x, z) * 0.35 + 0.25) * smooth(rh + 0.3, rh + 1.6, az)
      y += (noise(x * 3.1, z * 2.7) * 0.012)                                          // 雪面のゆるい凹凸
      // 遊ぶ所のふち: 雪を寄せた低い土手
      const g2 = (v, c, w) => Math.exp(-((v - c) * (v - c)) / (w * w))
      if (Math.abs(z) < HZ + 0.6 && Math.abs(z) > rh + 0.2) y += 0.32 * g2(Math.abs(x), HX + 0.65, 0.4)
      if (Math.abs(x) < HX + 0.8) y += 0.32 * g2(Math.abs(z), HZ + 0.65, 0.4)
      gpos.setY(i, y)
      // 色: くぼみと遠くはうっすら青く
      const n2 = noise(x * 0.9 + 4, z * 0.8) * 0.5 + 0.5, hol = clamp(-y * 1.5, 0, 1)
      const c = 1 - n2 * 0.05 - hol * 0.12
      gcol.setXYZ(i, c * 0.97, c * 0.985, 1)
    }
    gpos.needsUpdate = true; gcol.needsUpdate = true; groundGeo.computeVertexNormals()
  }
  shapeGround(0.6)

  // ---------- 川 ----------
  const waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uRH: { value: 0.6 }, fogColor: { value: scene.fog.color }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } },
    vertexShader: `varying vec2 vP; varying float vFog; void main(){ vec4 w = modelMatrix*vec4(position,1.); vP = w.xz; vec4 mv = viewMatrix*w; vFog = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uT; uniform float uRH; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec2 vP; varying float vFog;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float ez = abs(vP.y)/uRH;                                   // 0=真ん中 1=岸
        vec2 q = vec2(vP.x*0.9 - uT*0.9, vP.y*2.2);
        float s = n(q*1.6) * 0.6 + n(q*4.1 + 3.0) * 0.4;
        float st = smoothstep(0.62, 0.8, n(vec2(vP.x*0.55 - uT*1.3, vP.y*5.0)));   // 流れの筋
        vec3 deep = vec3(0.13, 0.42, 0.58), shal = vec3(0.42, 0.74, 0.84);
        vec3 col = mix(deep, shal, smoothstep(0.2, 1.0, ez) * 0.8 + s * 0.25);
        col += st * 0.22;
        float foam = smoothstep(0.78, 1.0, ez + (s - 0.5) * 0.25);   // 岸の白い泡
        col = mix(col, vec3(0.93, 0.97, 1.0), foam * 0.85);
        float f = smoothstep(fogNear, fogFar, vFog);
        gl_FragColor = vec4(mix(col, fogColor, f), 0.93);
        #include <colorspace_fragment>
      }`
  })
  const water = new THREE.Mesh(new THREE.PlaneGeometry(GW, 1, 1, 1).rotateX(-Math.PI / 2), waterMat); water.position.y = -0.2; scene.add(water)
  // 流れていく氷のかけら
  const floes = []
  { const m = new THREE.MeshStandardMaterial({ color: '#f2f8ff', roughness: 0.6 })
    for (let i = 0; i < 7; i++) {
      const g = new THREE.CircleGeometry(1, 7); const p = g.attributes.position
      for (let k = 1; k < p.count; k++) { const f = 0.7 + Math.random() * 0.5; p.setX(k, p.getX(k) * f); p.setY(k, p.getY(k) * f) }
      g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); const s = 0.12 + Math.random() * 0.2; mesh.scale.set(s * 1.4, 1, s)
      mesh.position.set(-14 + Math.random() * 28, -0.17, 0); mesh.userData = { sp: 0.012 + Math.random() * 0.01, zf: Math.random() * 2 - 1, rs: (Math.random() - 0.5) * 0.01 }
      scene.add(mesh); floes.push(mesh)
    } }

  // ---------- 背景の絵（遠くの丘と森） ----------
  const bgMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, toneMapped: false })
  const bgGeo = new THREE.PlaneGeometry(48, 32); bgGeo.translate(0, 16, 0); const bg = new THREE.Mesh(bgGeo, bgMat); scene.add(bg)

  // ---------- 木・雪だるま・岩（絵の板） ----------
  const propMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.04, depthWrite: true, fog: true, toneMapped: false, color: '#f2f6fb' })
  const props = []
  function propPlane(name, x, z, hM) {
    const it = ART.props.items[name]; if (!it) return
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0)
    const U = ART.props.W, V = ART.props.H, uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (it.x + uv.getX(i) * it.w) / U, 1 - (it.y + (1 - uv.getY(i)) * it.h) / V)
    const m = new THREE.Mesh(g, propMat); m.scale.set(hM * it.w / it.h, hM, 1); m.position.set(x, 0, z); scene.add(m); props.push(m)
    const sh = new THREE.Mesh(blobGeo, blobMat); sh.scale.set(hM * it.w / it.h * 0.9, 1, hM * 0.22); sh.position.set(x, 0.015, z + 0.05); scene.add(sh)
    return m
  }
  // ---------- 丸い影 ----------
  const blobGeo = new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2)
  const blobMat = new THREE.MeshBasicMaterial({ map: softTex(64, [[0, 0.55], [0.6, 0.25], [1, 0]]), color: '#2c4468', transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false })
  const mkBlob = (sx, sz) => { const m = new THREE.Mesh(blobGeo, blobMat); m.scale.set(sx, 1, sz); m.renderOrder = 1; scene.add(m); return m }

  // ---------- 雪の壁（雪のレンガを積む。当たるたびに上から崩れる） ----------
  const brickGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.22)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, emissive: '#9fb8d8', emissiveIntensity: 0.12 })
  const MAXB = 160
  const bricks = new THREE.InstancedMesh(brickGeo, wallMat, MAXB); bricks.castShadow = true; bricks.receiveShadow = true; bricks.count = 0; scene.add(bricks)
  const wallBlobs = []
  let walls = []   // { id, list:[{m:Matrix4, row}], shown }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3()
  function buildWalls(forts) {
    for (const b of wallBlobs) scene.remove(b); wallBlobs.length = 0
    walls = []; let n = 0
    for (const f of forts) {
      const rows = 3, bh = 0.27, list = []
      for (let r = 0; r < rows; r++) {
        const cnt = Math.max(2, Math.round(f.w / 0.55)) - (r === rows - 1 ? 1 : 0), bw = f.w / Math.max(2, Math.round(f.w / 0.55))
        const off = r % 2 ? bw / 2 : 0
        for (let i = 0; i < cnt; i++) {
          const x = f.x - f.w / 2 + bw / 2 + off + i * bw; if (x > f.x + f.w / 2 - bw * 0.3) continue
          _e.set((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.06); _q.setFromEuler(_e)
          _v.set(x + (Math.random() - 0.5) * 0.03, bh / 2 + r * bh * 0.94, f.z + (Math.random() - 0.5) * 0.04)
          _s.set(bw * 0.98, bh * 1.02, f.t * (0.92 + Math.random() * 0.1))
          list.push({ mat: new THREE.Matrix4().compose(_v.clone(), _q.clone(), _s.clone()), row: r, idx: n++, alive: true, x: _v.x, y: _v.y, z: _v.z })
        }
      }
      const wb = mkBlob(f.w * 1.15, f.t * 2.6); wb.position.set(f.x + 0.12, 0.011, f.z - 0.1); wallBlobs.push(wb)
      walls.push({ id: f.id, f, list, shake: 0, wb })
    }
    syncWalls(forts, true)
  }
  const _z = new THREE.Matrix4().makeScale(0, 0, 0)
  function syncWalls(forts, init) {
    let n = 0
    for (const w of walls) {
      const f = forts.find(ff => ff.id === w.id), hp = f ? f.hp : 0, keep = Math.ceil(w.list.length * hp / C.WALL_HP)
      const alive = w.list.filter(b => b.alive)
      if (alive.length > keep) {   // 上の段から崩す
        const order = alive.slice().sort((a, b) => b.row - a.row || Math.random() - 0.5)
        for (let k = 0; k < alive.length - keep; k++) { const b = order[k]; b.alive = false; if (!init) burst(b.x, b.y, b.z, 9, 0.06, 0.9) }
      }
      for (const b of w.list) {
        if (b.alive) {
          if (w.shake > 0) { _m.copy(b.mat); _m.elements[12] += (Math.random() - 0.5) * w.shake * 0.05; bricks.setMatrixAt(n, _m) } else bricks.setMatrixAt(n, b.mat)
        } else bricks.setMatrixAt(n, _z)
        n++
      }
      w.shake = Math.max(0, w.shake - 0.12)
      if (w.wb) w.wb.visible = w.list.some(b => b.alive)
    }
    bricks.count = n; bricks.instanceMatrix.needsUpdate = true
  }

  // ---------- 恐竜（絵の板） ----------
  const unitMats = []
  const unitGeo = new THREE.PlaneGeometry(1, 1); unitGeo.translate(0, 0.5, 0)
  const unitVS = `varying vec2 vUv; varying float vFog; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vFog = -mv.z; gl_Position = projectionMatrix*mv; }`
  const unitFS = `uniform sampler2D map; uniform vec4 rect; uniform float flash; uniform float flipX; uniform float alpha; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying vec2 vUv; varying float vFog;
    void main(){ vec2 u = vec2(flipX > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y); vec4 c = texture2D(map, rect.xy + u*rect.zw);
      if (c.a < 0.03) discard;
      c.rgb = mix(c.rgb, vec3(1.0), flash);
      c.rgb = mix(c.rgb, fogColor, smoothstep(fogNear, fogFar, vFog) * 0.6);
      gl_FragColor = vec4(c.rgb, c.a * alpha);
      #include <colorspace_fragment>
    }`
  let teamTex = [null, null]
  function setTeamCanvas(team, canvasEl) {
    const t = new THREE.CanvasTexture(canvasEl); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter
    if (teamTex[team]) teamTex[team].dispose(); teamTex[team] = t
    for (const r of rigs) if (r.team === team) r.mat.uniforms.map.value = t
  }
  const rigs = []
  function makeRig(u) {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: unitVS, fragmentShader: unitFS,
      uniforms: { map: { value: teamTex[u.team] }, rect: { value: new THREE.Vector4(0, 0, 1, 1) }, flash: { value: 0 }, flipX: { value: 0 }, alpha: { value: 1 }, fogColor: { value: scene.fog.color }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } } })
    const mesh = new THREE.Mesh(unitGeo, mat); scene.add(mesh)
    const blob = mkBlob(0.9, 0.42)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }))
    ring.visible = !!u.human; ring.renderOrder = 2; scene.add(ring)
    const rev = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 48, 1, 0, 0.01).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7ee0a6', transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))
    rev.visible = false; rev.renderOrder = 2; scene.add(rev)
    const pip = new THREE.Sprite(new THREE.SpriteMaterial({ map: pipTex[2], depthWrite: false, depthTest: false, toneMapped: false })); pip.scale.set(0.42, 0.2, 1); pip.renderOrder = 20; scene.add(pip)
    const r = { id: u.id, team: u.team, mesh, mat, blob, ring, rev, pip, pose: '', stepAcc: 0, foot: 0, breath: Math.random() * 90, bob: 0, squash: 0, lastHit: -99, x: u.x, z: u.z }
    rigs.push(r); return r
  }
  function clearRigs() { for (const r of rigs) { scene.remove(r.mesh, r.blob, r.ring, r.rev, r.pip); r.mat.dispose() } rigs.length = 0 }
  // 体力の玉（頭の上）
  const pipTex = [0, 1, 2].map(n => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d')
    for (let i = 0; i < 2; i++) { const cx = 38 + i * 52; x.beginPath(); x.arc(cx, 32, 17, 0, 7); x.fillStyle = i < n ? '#ffffff' : 'rgba(30,45,70,.35)'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#26344f'; x.stroke()
      if (i < n) { x.beginPath(); x.arc(cx - 5, 26, 5, 0, 7); x.fillStyle = '#dbeafa'; x.fill() } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  })

  // ---------- 雪玉 ----------
  const ballGeo = new THREE.IcosahedronGeometry(C.BALL_R * 1.15, 2)
  { const p = ballGeo.attributes.position; for (let i = 0; i < p.count; i++) { _v.fromBufferAttribute(p, i); _v.multiplyScalar(1 + (Math.random() - 0.5) * 0.12); p.setXYZ(i, _v.x, _v.y, _v.z) } ballGeo.computeVertexNormals() }
  const ballMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, emissive: '#3a4a66', emissiveIntensity: 0.08 })
  const ballPool = []
  function ballMesh() { let b = ballPool.find(p => !p.used); if (!b) { b = { m: new THREE.Mesh(ballGeo, ballMat), sh: mkBlob(0.28, 0.2) }; b.m.castShadow = true; scene.add(b.m); ballPool.push(b) } b.used = true; b.m.visible = b.sh.visible = true; return b }

  // ---------- 粒（雪のかたまり・粉・息） ----------
  const chunkGeo = new THREE.IcosahedronGeometry(1, 0)
  const NCH = 220
  const chunks = new THREE.InstancedMesh(chunkGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, emissive: '#c9daf0', emissiveIntensity: 0.45 }), NCH); chunks.count = NCH; scene.add(chunks)
  const ch = []; for (let i = 0; i < NCH; i++) { ch.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0, r: new THREE.Euler() }); chunks.setMatrixAt(i, _z) }
  let chI = 0
  function burst(x, y, z, n, size = 0.05, power = 1, dir) {
    for (let k = 0; k < n; k++) {
      const c = ch[chI = (chI + 1) % NCH]
      c.life = 1; c.p.set(x, y, z); const a = Math.random() * Math.PI * 2, sp = (0.02 + Math.random() * 0.05) * power
      c.v.set(Math.cos(a) * sp + (dir ? dir.x * 0.03 * power : 0), (0.03 + Math.random() * 0.06) * power, Math.sin(a) * sp + (dir ? dir.z * 0.03 * power : 0))
      c.s = size * (0.5 + Math.random()); c.r.set(Math.random() * 6, Math.random() * 6, 0)
    }
    puff(x, y, z, Math.ceil(n / 2), 0.35 * power)
  }
  const NPF = 140
  const puffMat = new THREE.SpriteMaterial({ map: softTex(64, [[0, 0.95], [0.5, 0.45], [1, 0]]), transparent: true, depthWrite: false, color: '#ffffff', toneMapped: false })
  const pf = []
  for (let i = 0; i < NPF; i++) { const s = new THREE.Sprite(puffMat.clone()); s.visible = false; s.renderOrder = 9; scene.add(s); pf.push({ s, life: 0, v: new THREE.Vector3(), g: 0, size: 0, grow: 0, a: 1 }) }
  let pfI = 0
  function puff(x, y, z, n, size = 0.35, o2 = {}) {
    for (let k = 0; k < n; k++) {
      const p = pf[pfI = (pfI + 1) % NPF]; p.life = 1; p.s.visible = true; p.s.position.set(x + (Math.random() - 0.5) * 0.1, y, z + (Math.random() - 0.5) * 0.1)
      const a = Math.random() * 6.28; const sp = (o2.sp ?? 0.025) * (0.4 + Math.random())
      p.v.set(Math.cos(a) * sp + (o2.vx || 0), (o2.vy ?? 0.012) * (0.5 + Math.random()), Math.sin(a) * sp + (o2.vz || 0))
      p.size = size * (0.6 + Math.random() * 0.6); p.grow = o2.grow ?? 1.6; p.dl = o2.dl ?? 0.03; p.a = o2.a ?? 0.9; p.g = o2.g ?? 0
    }
  }
  // 降る雪
  const NF = lowQ ? 260 : 420
  const flakeGeo = new THREE.BufferGeometry(); const fpos = new Float32Array(NF * 3), fsp = []
  for (let i = 0; i < NF; i++) { fpos[i * 3] = (Math.random() - 0.5) * 24; fpos[i * 3 + 1] = Math.random() * 14; fpos[i * 3 + 2] = -14 + Math.random() * 30; fsp.push(0.008 + Math.random() * 0.014) }
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3))
  const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ map: softTex(32, [[0, 1], [0.4, 0.8], [1, 0]]), size: 0.09, transparent: true, depthWrite: false, opacity: 0.95, color: '#ffffff', toneMapped: false }))
  scene.add(flakes)

  // ---------- 足跡・着地の跡（地面に貼る） ----------
  const NDC = 260
  const decalGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const aFade = new THREE.InstancedBufferAttribute(new Float32Array(NDC), 1), aCell = new THREE.InstancedBufferAttribute(new Float32Array(NDC), 1)
  decalGeo.setAttribute('aFade', aFade); decalGeo.setAttribute('aCell', aCell)
  const decalMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { map: { value: decalTex() } },
    vertexShader: `attribute float aFade; attribute float aCell; varying vec2 vUv; varying float vF; void main(){ vUv = vec2(uv.x*0.5 + aCell*0.5, uv.y); vF = aFade; gl_Position = projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying float vF; void main(){ vec4 c = texture2D(map, vUv); gl_FragColor = vec4(c.rgb, c.a*vF);
      #include <colorspace_fragment>
    }` })
  const decals = new THREE.InstancedMesh(decalGeo, decalMat, NDC); decals.renderOrder = 1; decals.frustumCulled = false
  for (let i = 0; i < NDC; i++) decals.setMatrixAt(i, _z)
  scene.add(decals)
  const dc = []; for (let i = 0; i < NDC; i++) dc.push({ life: 0 }); let dcI = 0
  function decal(x, z, cell, size, rot) {
    const i = dcI = (dcI + 1) % NDC; dc[i].life = 1; dc[i].cell = cell
    _q.setFromAxisAngle(_v.set(0, 1, 0), rot); _m.compose(_s.set(x, 0.02 + (i % 7) * 0.0006, z), _q, _v.set(size * (cell ? 1 : 0.62), 1, size))
    decals.setMatrixAt(i, _m); aCell.setX(i, cell); aFade.setX(i, 1)
    decals.instanceMatrix.needsUpdate = true; aCell.needsUpdate = true
  }

  // ---------- 狙いの線（地面に点線） ----------
  const AIMN = 14
  const aimDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff4cf', transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }), AIMN)
  aimDots.renderOrder = 3; aimDots.count = 0; scene.add(aimDots)
  const aimEnd = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff4cf', transparent: true, depthWrite: false, toneMapped: false })); aimEnd.visible = false; aimEnd.renderOrder = 3; scene.add(aimEnd)

  // ---------- カメラを画面に合わせる ----------
  const PITCH = 0.9   // 見下ろす角度（ラジアン）。真上でなく、自陣の後ろ・高めから
  const target = new THREE.Vector3()
  const ndcOf = (x, y, z) => _v.set(x, y, z).project(camera)
  function place(d, tz) { target.set(0, 0, tz); camera.position.set(0, Math.sin(PITCH) * d, tz + Math.cos(PITCH) * d); camera.lookAt(target); camera.updateMatrixWorld(); camera.updateProjectionMatrix() }
  let topPad = 0.8, botPad = -0.62
  // カメラは2つの置き方: タイトル（低く、奥の山と空まで見せる）と遊び中（自陣の後ろ・高め）。切り替えはなめらかに
  const playPos = new THREE.Vector3(), playTgt = new THREE.Vector3(), titlePos = new THREE.Vector3(0, 2.3, HZ - 1.6), titleTgt = new THREE.Vector3(0, 1.6, -5)
  const resPos = new THREE.Vector3(0, 6.2, HZ + 4.2), resTgt = new THREE.Vector3(0, 0.5, -0.6)   // 結果: 自分のチームの後ろから、川の向こうまで
  let playFov = 46, titleFov = 52, camMode = 'title', camK = 0, resK = 0
  const _cp = new THREE.Vector3(), _ct = new THREE.Vector3()
  function poseCam(k) {
    const e = k * k * (3 - 2 * k)
    _cp.lerpVectors(titlePos, playPos, e); _ct.lerpVectors(titleTgt, playTgt, e)
    const r = resK * resK * (3 - 2 * resK); _cp.lerp(resPos, r); _ct.lerp(resTgt, r)
    camera.position.copy(_cp); camera.fov = lerp(lerp(titleFov, playFov, e), titleFov, r); camera.updateProjectionMatrix(); camera.lookAt(_ct); camera.updateMatrixWorld()
  }
  function fit(w, h) {
    renderer.setSize(w, h, false); camera.aspect = w / h
    camera.fov = w / h < 0.62 ? 46 : 38
    camera.updateProjectionMatrix()
    topPad = 1 - 2 * (o.hudTop ? o.hudTop(h) : 72) / h
    // 横: 自陣の前の方と、手前の端の左右が入る距離。縦: 奥の端が上の帯の下に来る位置。2つは互いに効くので数回まわす
    let d = 15, tz = 0
    const solveD = () => { let lo = 5, hi = 60; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; place(m, tz); if (Math.max(Math.abs(ndcOf(HX + 0.3, 0, 3.2).x), Math.abs(ndcOf(HX - 0.1, 0.9, HZ - 0.3).x)) > 0.97) lo = m; else hi = m } return hi }
    const solveTz = () => { let lo2 = -14, hi2 = 14; for (let k = 0; k < 30; k++) { const m = (lo2 + hi2) / 2; place(d, m); if (ndcOf(0, 0, -HZ - 0.2).y > Math.min(topPad, 0.5)) hi2 = m; else lo2 = m } return (lo2 + hi2) / 2 }
    for (let it = 0; it < 5; it++) { d = solveD(); tz = solveTz() }
    // 手前の自陣の端（足もと）が画面の下の端より上に来るまで引く
    const nearOk = () => { place(d, tz); return ndcOf(0, 0, HZ - 0.2).y > -0.94 && Math.abs(ndcOf(HX - 0.1, 0.9, HZ - 0.3).x) < 0.98 }
    if (!nearOk()) { let lo = d, hi = d * 3; for (let k = 0; k < 24; k++) { d = (lo + hi) / 2; tz = solveTz(); if (nearOk()) hi = d; else lo = d } d = hi; tz = solveTz() }
    place(d, tz)
    playPos.copy(camera.position); playTgt.copy(target); playFov = camera.fov
    titleFov = w / h < 0.62 ? 52 : 40
    poseCam(camK)
    { const zb = -HZ - 7.5; bg.position.set(0, -8.2, zb) }
  }

  // ---------- 外から呼ぶ所 ----------
  let decorDone = false
  async function load(onProgress) {
    const jobs = [
      loadT('assets/tex/snow_02_nor_gl.webp', false).then(t => { if (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(GW / 3.2, GD / 3.2); groundMat.normalMap = t; groundMat.normalScale.set(0.9, 0.9); groundMat.needsUpdate = true;
        const t2 = t.clone(); t2.repeat.set(1, 1); wallMat.normalMap = t2; wallMat.normalScale.set(0.5, 0.5); wallMat.needsUpdate = true; const t3 = t.clone(); t3.repeat.set(1, 1); ballMat.normalMap = t3; ballMat.needsUpdate = true } }),
      loadT('img/bg.webp').then(t => { if (t) { bgMat.map = t; bgMat.needsUpdate = true } }),
      loadT('img/props.webp').then(t => { if (t) { t.anisotropy = 4; propMat.map = t; propMat.needsUpdate = true } })
    ]
    let done = 0; jobs.forEach(j => j.then(() => onProgress && onProgress(++done / jobs.length)))
    await Promise.all(jobs)
    if (!decorDone) { decorate(); decorDone = true }
  }
  function decorate() {
    // 遊ぶ所の外まわり。種類を混ぜて、間隔と大きさをばらつかせる
    let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const trees = ['tree_a', 'tree_b', 'tree_c']
    for (let i = 0; i < 16; i++) { const side = i % 2 ? 1 : -1, z = -HZ - 4 + i * 1.25 + R() * 0.9; propPlane(trees[(R() * 3) | 0], side * (HX + 1.6 + R() * 2.6), z, 2.2 + R() * 1.6) }
    for (let i = 0; i < 7; i++) propPlane(trees[(R() * 3) | 0], -8 + i * 2.6 + R() * 1.2, -HZ - 3.2 - R() * 2.5, 2.2 + R() * 1.4)
    propPlane('snowman', HX + 1.4, -HZ + 1.2, 1.25); propPlane('snowman', -HX - 1.2, HZ - 1.6, 1.15)
    propPlane('bush', -HX - 1.0, -1.9, 0.75); propPlane('bush', HX + 1.1, 2.6, 0.7); propPlane('rock', -HX - 1.3, 3.2, 0.6); propPlane('rock', HX + 1.2, -3.4, 0.55)
    propPlane('bush', -HX - 0.9, HZ + 1.0, 0.8); propPlane('rock', 2.0, -HZ - 1.3, 0.5)
    // 自陣の後ろ: 雪玉を積んだそり・こぼれたバケツ。両脇に雪の積もった柵
    propPlane('sled', -1.7, HZ + 0.95, 0.85); propPlane('bucket', 1.9, HZ + 1.0, 0.62); propPlane('sled', 1.4, -HZ - 0.9, 0.8)
    for (const z of [-4.6, -1.6, 2.2, 4.9]) { propPlane('fence', -HX - 0.95, z + R() * 0.4, 0.62); propPlane('fence', HX + 0.95, z + 0.7 + R() * 0.4, 0.62) }
  }
  function setRound(S) {
    shapeGround(S.riverHalf())
    const rh = S.riverHalf(); water.scale.z = rh * 2 + 0.5; waterMat.uniforms.uRH.value = rh + 0.25
    for (const f of floes) f.position.z = f.userData.zf * rh * 0.6
    buildWalls(S.forts)
    clearRigs(); for (const u of S.units) makeRig(u)
    for (const b of ballPool) { b.used = false; b.m.visible = b.sh.visible = false }
    for (let i = 0; i < NDC; i++) { dc[i].life = 0; aFade.setX(i, 0) } aFade.needsUpdate = true
  }

  // 1コマ描く。S は sim、t はゲームの経過フレーム
  const camRight = new THREE.Vector3()
  let tframe = 0, shake = 0
  function render(S, opt = {}) {
    tframe++
    const dtk = 1
    // 揺れ（当たった時だけ・狙っている最中は揺らさない）
    const nowT = performance.now(), cdt = Math.min(0.1, (nowT - (render.lt || nowT)) / 1000); render.lt = nowT
    if (camMode === 'result') resK = clamp(resK + cdt / 1.2, 0, 1); else { resK = clamp(resK - cdt / 0.5, 0, 1); camK = clamp(camK + (camMode === 'play' ? cdt / 0.9 : -cdt / 0.7), 0, 1) }   // 時間で動かす（コマ落ちしても同じ長さ）
    poseCam(camK)
    if (api.camOverride) { const o2 = api.camOverride; camera.position.set(...o2.pos); camera.fov = o2.fov; camera.updateProjectionMatrix(); camera.lookAt(...o2.tgt); camera.updateMatrixWorld() }
    if (shake > 0.01 && !opt.aiming) { camera.position.x += (Math.random() - 0.5) * shake * 0.08; camera.position.y += (Math.random() - 0.5) * shake * 0.04 }
    shake *= 0.86
    const elev = Math.atan2(camera.position.y, 8)
    // 恐竜
    for (const r of rigs) {
      const u = S.units.find(v => v.id === r.id); if (!u) continue
      const vis = S.phase !== 'title'; r.mesh.visible = r.blob.visible = vis; if (!vis) { r.pip.visible = r.ring.visible = r.rev.visible = false; continue }
      const front = u.team === 1, P = front ? 'f_' : 'b_'
      const moving = Math.hypot(u.vx, u.vz) > C.MOVE * 0.25
      let pose = P + 'stand', flip = 0
      const sinceThrow = S.tick - u.thrown
      if (u.dead) pose = P + 'down'
      else if (S.phase === 'roundEnd' && S.roundWinner === u.team && S.timer < C.ROUND_GAP - 20) pose = P + 'cheer'
      else if (S.phase === 'over' && S.winner === u.team) pose = P + 'cheer'
      else if (sinceThrow >= 0 && sinceThrow < 14) pose = P + 'throw'
      else if (u.packing) pose = P + 'pack'
      else if (moving) { r.stepAcc += Math.hypot(u.vx, u.vz); const ph = Math.floor(r.stepAcc / 0.32) % 4; pose = ph === 1 || ph === 3 ? P + 'walk' : P + 'stand'; flip = ph === 3 ? 1 : 0
        if (ph !== r.foot) { r.foot = ph; if (ph % 2 === 1) { const side = ph === 1 ? -1 : 1; decal(u.x + side * 0.12, u.z + 0.05, 0, 0.3, (Math.random() - 0.5) * 0.3 + (u.team ? Math.PI : 0)); if (opt.onStep) opt.onStep(u) } } }
      // 投げる向きで左右を返す（正面の絵は左手で投げているので右へ投げる時に返す）
      if (pose.endsWith('throw')) { const cx = Math.cos(u.face); flip = front ? (cx > 0.15 ? 1 : 0) : (cx < -0.15 ? 1 : 0) }
      const ps = ART.dino.poses[pose]
      if (pose !== r.pose) { r.pose = pose; r.mat.uniforms.rect.value.set(ps.x / ART.dino.W, 1 - (ps.y + ps.h) / ART.dino.H, ps.w / ART.dino.W, ps.h / ART.dino.H) }
      r.mat.uniforms.flipX.value = flip
      r.mat.uniforms.flash.value = u.flash > 0 && !u.dead ? Math.min(1, u.flash * 1.4) * (Math.floor(tframe / 3) % 2 ? 1 : 0.5) : 0
      // 見下ろしで縦が縮むぶんを少し伸ばす。歩くと上下に弾む
      r.x += (u.x - r.x) * 0.5; r.z += (u.z - r.z) * 0.5
      const camD = Math.hypot(camera.position.z - r.z, camera.position.y), stretch = 1 / Math.max(0.72, Math.cos(Math.atan2(camera.position.y - 0.6, camera.position.z - r.z))) * 0.86 + 0.14
      const hit = S.tick - u.hitT < 10 ? 1 - (S.tick - u.hitT) / 10 : 0
      const bob = moving && !u.dead ? Math.abs(Math.sin(r.stepAcc / 0.32 * Math.PI)) * 0.05 : 0
      const breathe = 1 + Math.sin(tframe * 0.06 + r.id) * 0.012
      const k = ps.m_h * DS, sq = 1 - hit * 0.12
      r.mesh.scale.set(ps.m_w * DS * (1 + hit * 0.1), k * stretch * breathe * sq, 1)
      r.mesh.position.set(r.x, bob, r.z)
      r.mesh.rotation.set(0, 0, hit * (u.team ? 0.12 : -0.12) + (moving ? Math.sin(r.stepAcc / 0.32 * Math.PI) * 0.04 : 0))
      r.mesh.renderOrder = 10 + Math.round((r.z + 20) * 10)
      r.blob.position.set(r.x, 0.012, r.z + 0.04); r.blob.scale.set(u.dead ? 1.05 : 0.8, 1, u.dead ? 0.5 : 0.36)
      r.ring.visible = !!u.human && !u.dead && S.phase !== 'title'; r.ring.position.set(r.x, 0.03, r.z + 0.04)
      if (r.ring.visible) { r.ring.material.opacity = 0.55 + Math.sin(tframe * 0.12) * 0.25; r.ring.scale.setScalar(1 + Math.sin(tframe * 0.12) * 0.04) }
      r.rev.visible = u.dead && u.reviveT > 0
      if (r.rev.visible) { r.rev.position.set(r.x, 0.035, r.z); const pr = u.reviveT / C.REVIVE; r.rev.geometry.dispose(); r.rev.geometry = new THREE.RingGeometry(0.62, 0.76, 48, 1, Math.PI / 2, -Math.PI * 2 * pr).rotateX(-Math.PI / 2) }
      r.pip.visible = !u.dead && (S.phase === 'play' || S.phase === 'intro') && !api.hideMarks; if (api.hideMarks) r.ring.visible = false
      if (r.pip.visible) { r.pip.material.map = pipTex[Math.max(0, u.hp)]; r.pip.position.set(r.x, k * stretch + 0.28 + bob, r.z); const ps2 = front ? 0.5 : 0.42; r.pip.scale.set(ps2, ps2 / 2, 1) }
      // 息の白さ（ときどき口のあたりから）
      if (!u.dead && S.phase !== 'title' && --r.breath <= 0) { r.breath = 70 + Math.random() * 60; puff(r.x + (front ? 0.08 : 0.22) * (r.id % 2 ? 1 : -1), k * stretch * 0.72, r.z + (front ? 0.12 : -0.05), 2, 0.12, { sp: 0.004, vy: 0.006, grow: 2.2, dl: 0.022, a: 0.7 }) }
    }
    // 雪玉
    for (const b of ballPool) b.used = false
    for (const bl of S.balls) {
      const m = ballMesh(); const s = Math.min(1, bl.age / 46)
      const y = bl.age <= 46 ? 0.95 + 0.55 * 4 * s * (1 - s) * 0.5 + (1 - s) * 0.0 : Math.max(0.12, 0.95 - (bl.age - 46) * 0.045)
      m.m.position.set(bl.x, y, bl.z); m.m.rotation.set(bl.age * 0.3, bl.age * 0.2, 0)
      m.sh.position.set(bl.x, 0.014, bl.z); const ss = 0.32 - y * 0.08; m.sh.scale.set(ss, 1, ss * 0.7)
      if (bl.age % 3 === 0) puff(bl.x, y, bl.z, 1, 0.06, { sp: 0.002, vy: 0, grow: 1.2, dl: 0.07, a: 0.5 })
    }
    for (const b of ballPool) if (!b.used) { b.m.visible = b.sh.visible = false }
    syncWalls(S.forts)
    // 粒
    let anyCh = false
    for (let i = 0; i < NCH; i++) {
      const c = ch[i]; if (c.life <= 0) continue; anyCh = true
      c.v.y -= 0.0042; c.p.add(c.v)
      if (c.p.y < c.s * 0.6) { c.p.y = c.s * 0.6; c.v.multiplyScalar(0.3); c.v.y = Math.abs(c.v.y) * 0.2; c.life -= 0.02 } else c.life -= 0.006
      c.r.x += 0.1; _q.setFromEuler(c.r); const sc = c.s * Math.min(1, c.life * 3)
      _m.compose(c.p, _q, _s.set(sc, sc, sc)); chunks.setMatrixAt(i, c.life > 0 ? _m : _z)
    }
    if (anyCh || tframe % 30 === 0) chunks.instanceMatrix.needsUpdate = true
    for (const p of pf) {
      if (p.life <= 0) continue
      p.life -= p.dl; p.v.y -= p.g; p.s.position.add(p.v); p.v.multiplyScalar(0.95)
      const sz = p.size * (1 + (1 - p.life) * p.grow); p.s.scale.set(sz, sz, 1); p.s.material.opacity = Math.max(0, p.life) * p.a
      if (p.life <= 0) p.s.visible = false
    }
    // 降る雪
    for (let i = 0; i < NF; i++) { fpos[i * 3 + 1] -= fsp[i]; fpos[i * 3] += Math.sin(tframe * 0.01 + i) * 0.004; if (fpos[i * 3 + 1] < 0) fpos[i * 3 + 1] = 12 + Math.random() * 2 }
    flakeGeo.attributes.position.needsUpdate = true
    // 跡を少しずつ薄く
    let dirty = false
    for (let i = 0; i < NDC; i++) { const d = dc[i]; if (d.life <= 0) continue; d.life -= d.cell ? 0.0025 : 0.0032; aFade.setX(i, Math.max(0, Math.min(1, d.life * 1.6)) * (d.cell ? 0.9 : 0.75)); dirty = true }
    if (dirty) aFade.needsUpdate = true
    // 川
    waterMat.uniforms.uT.value = tframe / 60
    for (const f of floes) { f.position.x += f.userData.sp; f.rotation.y += f.userData.rs; if (f.position.x > 16) f.position.x = -16 }
    // 狙いの線
    if (opt.aim) {
      const { x, z, ang, len } = opt.aim, n = AIMN; aimDots.count = n
      for (let i = 0; i < n; i++) { const t = (i + 1) / (n + 1) * len; _m.makeTranslation(x + Math.cos(ang) * t, 0.04, z + Math.sin(ang) * t); aimDots.setMatrixAt(i, _m) }
      aimDots.instanceMatrix.needsUpdate = true
      aimEnd.visible = true; aimEnd.position.set(x + Math.cos(ang) * len, 0.045, z + Math.sin(ang) * len)
    } else { aimDots.count = 0; aimEnd.visible = false }
    renderer.render(scene, camera)
  }

  // 画面の座標 → 地面の上の点
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _p = new THREE.Vector2(), hitP = new THREE.Vector3()
  function groundAt(px, py, w, h) { _p.set(px / w * 2 - 1, -(py / h) * 2 + 1); ray.setFromCamera(_p, camera); return ray.ray.intersectPlane(plane, hitP) ? { x: hitP.x, z: hitP.z } : null }
  function screenOf(x, y, z, w, h) { _v.set(x, y, z).project(camera); return { x: (_v.x + 1) / 2 * w, y: (1 - _v.y) / 2 * h } }

  const api = {
    renderer, scene, camera, load, fit, render, setCam(m, now) { camMode = m; if (now) { camK = m === 'play' ? 1 : 0; resK = m === 'result' ? 1 : 0 } }, get camK() { return camK }, setRound, setTeamCanvas, groundAt, screenOf,
    fx: {
      hit(x, z, team) { burst(x, 0.75, z, 14, 0.055, 1.1); puff(x, 0.75, z, 6, 0.4, { sp: 0.03 }); shake = Math.max(shake, 1) },
      land(x, z) { burst(x, 0.08, z, 6, 0.04, 0.6); decal(x, z, 1, 0.55, Math.random() * 6) },
      wall(x, z, f) { burst(x, 0.5, z, 8, 0.05, 0.8); const w = walls.find(w2 => w2.id === f.id); if (w) w.shake = 1 },
      wallBreak(f) { burst(f.x, 0.4, f.z, 26, 0.07, 1.3); puff(f.x, 0.4, f.z, 12, 0.7, { sp: 0.04 }); shake = Math.max(shake, 1.4) },
      down(x, z) { burst(x, 0.3, z, 18, 0.06, 1.2); decal(x, z + 0.1, 1, 1.1, 0); shake = Math.max(shake, 1.6) },
      revive(x, z) { puff(x, 0.5, z, 10, 0.4, { sp: 0.03, vy: 0.02 }) },
      throwPuff(x, z) { puff(x, 0.8, z, 2, 0.15, { sp: 0.01 }) },
      shake(v) { shake = Math.max(shake, v) }
    },
    rigs
  }
  return api
}
