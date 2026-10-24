// Ходьба из одного вырезанного спрайта: node cut/puppet2.mjs <спрайт.png> <лист.png> <biped|quad> [бедро 0..1=0.5] [кадров=8] [размах°=16] [подскок=4]
// biped: две ноги по осям бедро→стопа (если ноги сомкнуты — размах задаётся параметром);
// quad: передние и задние лапы делятся по вертикали, качаются вокруг своего плеча/бедра по диагонали
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [, , src, dst, mode = 'biped', hipK = '0.5', nF = '8', swDeg = '16', bobPx = '4'] = process.argv
const SPLIT = process.env.SPLIT || 'axis'
const N = Number(nF), SWR = Number(swDeg) * Math.PI / 180, BOB = Number(bobPx)
const im = await loadImage(src)
const fw = im.width, fh = im.height, PAD = Math.round(fw * 0.25)
const c0 = createCanvas(fw, fh); const g0 = c0.getContext('2d'); g0.drawImage(im, 0, 0)
const sp = g0.getImageData(0, 0, fw, fh).data
const A = (x, y) => (x < 0 || y < 0 || x >= fw || y >= fh ? 0 : sp[(y * fw + x) * 4 + 3])
let y0 = fh, y1 = 0
for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (A(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
const hipY = Math.round(y0 + (y1 - y0) * Number(hipK))
let hx0 = fw, hx1 = 0
for (let x = 0; x < fw; x++) if (A(x, hipY)) { hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x) }
const P = [(hx0 + hx1) / 2, hipY]
const lowPts = []
for (let y = hipY + Math.round((y1 - y0) * 0.12); y <= y1; y++) for (let x = 0; x < fw; x++) if (A(x, y)) lowPts.push([x, y])
const mxFeet = P[0]
// стопа ноги — центр самых дальних от бедра точек группы
const footOf = (f) => {
  const q = lowPts.filter(f); if (!q.length) return [P[0], y1]
  const dd = q.map((p) => Math.hypot(p[0] - P[0], p[1] - P[1])), mx = Math.max(...dd)
  const far = q.filter((p, k) => dd[k] > mx * 0.88)
  return [far.reduce((a, p) => a + p[0], 0) / far.length, far.reduce((a, p) => a + p[1], 0) / far.length]
}
const FL = footOf((p) => p[0] < mxFeet), FR = footOf((p) => p[0] >= mxFeet)
const W = fw + PAD * 2, H = fh
const px = (x, y) => { const i = (y * fw + x) * 4; return [sp[i], sp[i + 1], sp[i + 2]] }
const out = new Uint8ClampedArray(W * N * H * 4)
function draw(ox, mask, a, dy, pv) {
  const ca = Math.cos(a), sa = Math.sin(a)
  for (let y = 0; y < H; y++) for (let x = -PAD; x < fw + PAD; x++) {
    const X = x - pv[0], Y = y - dy - pv[1]
    const sx = Math.round(ca * X + sa * Y + pv[0]), sy = Math.round(-sa * X + ca * Y + pv[1])
    if (!A(sx, sy) || !mask(sx, sy)) continue
    const p = px(sx, sy), o = (y * W * N + ox + x + PAD) * 4
    out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = 255
  }
}
const LIFT = Math.max(3, fh * 0.06), deg = Math.PI / 180
let info = {}
if (mode === 'stomp') {
  // тяжёлая поступь без разреза: цельный спрайт, стороны ног попеременно поднимаются и сдвигаются, корпус перекатывается
  const R = y1 - y0, LIFTS = Math.max(3, R * 0.055), SWPX = R * 0.05
  for (let i = 0; i < N; i++) {
    const f = (i / N) * Math.PI * 2, ox = i * W
    const sn = Math.sin(f), lean = 2.2 * deg * sn
    const cl = Math.cos(lean), sl = Math.sin(lean)
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      if (!A(x, y)) continue
      const v = Math.max(0, Math.min(1, (y - hipY) / Math.max(1, y1 - hipY)))
      const sd = Math.max(-1, Math.min(1, (x - P[0]) / (R * 0.14)))
      const wl = Math.max(0, -sd), wr = Math.max(0, sd)
      let dy = -BOB * Math.abs(sn) - LIFTS * v * (Math.max(0, sn) * wl + Math.max(0, -sn) * wr)
      let dx = -SWPX * v * sd * sn
      const X = x - P[0], Y = y - y1
      const rx = cl * X - sl * Y + P[0] + dx, ry = sl * X + cl * Y + y1 + dy
      const p = px(x, y)
      for (const [ax2, ay2] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const ix = Math.round(rx) + ax2 + PAD, iy = Math.round(ry) + ay2
        if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue
        const o = (iy * W * N + ox + ix) * 4
        out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = 255
      }
    }
  }
} else if (mode === 'quad') {
  const split = mxFeet
  const pivots = [[hx0 + (hx1 - hx0) * 0.15, hipY], [hx0 + (hx1 - hx0) * 0.85, hipY]]
  const legs = (g) => (x, y) => y >= hipY - 6 && (g === 0 ? x < split : x >= split)
  for (let i = 0; i < N; i++) {
    const f = (i / N) * Math.PI * 2, ox = i * W
    for (const g of [0, 1]) {
      const ph = g === 0 ? 0 : Math.PI
      const a = -SWR * Math.sin(f + ph), up = Math.max(0, Math.cos(f + ph)) * LIFT
      draw(ox, legs(g), -a, -up, pivots[g])
    }
    draw(ox, (x, y) => y < hipY + 4, 1.2 * deg * Math.sin(f), 0, P)
  }
  info = { split }
} else {
  const ang = (F) => Math.atan2(F[0] - P[0], F[1] - P[1])
  let aL0 = ang(FL), aR0 = ang(FR)
  if (Math.abs(aL0 - aR0) < SWR * 1.2) { aL0 = -SWR; aR0 = SWR }
  const mid = (aL0 + aR0) / 2
  const R = y1 - y0
  const dist = (x, y, F) => { const dx = F[0] - P[0], dy = F[1] - P[1], t = Math.max(0, Math.min(1, ((x - P[0]) * dx + (y - P[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - P[0] - dx * t, y - P[1] - dy * t) }
  const OV = Math.max(4, R * 0.03)
  const legOf = (x, y) => (SPLIT === 'x' ? (x < P[0] + OV ? 0 : 1) : (dist(x, y, FL) <= dist(x, y, FR) ? 0 : 1))
  const inLeg = (x, y, g) => (SPLIT === 'x' ? (g === 0 ? x < P[0] + OV : x >= P[0] - OV) : legOf(x, y) === g)
  const md = (x, y) => Math.min(dist(x, y, FL), dist(x, y, FR))
  const armPx = (x, y) => !process.env.NOARM && y >= hipY + 6 && y < hipY + R * 0.2 && (md(x, y) > R * 0.1 || (Math.abs(x - P[0]) > R * 0.15 && md(x, y) > 5))
  const LEAN = 2 * deg
  for (let i = 0; i < N; i++) {
    const f = (i / N) * Math.PI * 2, ox = i * W
    const dL = (mid - aL0) * (1 - Math.cos(f)), dR = (mid - aR0) * (1 - Math.cos(f))
    const swingL = f < Math.PI ? Math.sin(f) * LIFT : 0, swingR = f > Math.PI ? Math.sin(f - Math.PI) * LIFT : 0
    draw(ox, (x, y) => y >= hipY - 12 && !armPx(x, y) && inLeg(x, y, 0), -dL, -swingL, P)
    draw(ox, (x, y) => y >= hipY - 12 && !armPx(x, y) && inLeg(x, y, 1), -dR, -swingR, P)
    draw(ox, (x, y) => y < hipY + 6 || armPx(x, y), LEAN * Math.sin(f), 0, P)
  }
  info = { aL0, aR0 }
}
// обломки: отдельные куски мельче 1.5% силуэта
let area = 0
for (let i = 0; i < fw * fh; i++) if (sp[i * 4 + 3]) area++
const CRUMB = Math.max(90, area * 0.015)
for (let i = 0; i < N; i++) {
  const seen = new Uint8Array(W * H), at = (x, y) => (y * W * N + i * W + x) * 4 + 3
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || !out[at(s0 % W, (s0 / W) | 0)]) continue
    const st = [s0], comp = []; seen[s0] = 1
    while (st.length) {
      const j = st.pop(); comp.push(j); const x = j % W, y = (j / W) | 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        const k = yy * W + xx; if (!seen[k] && out[at(xx, yy)]) { seen[k] = 1; st.push(k) }
      }
    }
    if (comp.length < CRUMB) for (const j of comp) out[at(j % W, (j / W) | 0)] = 0
  }
}
// каждый кадр — на землю по низшему пикселю; запас сверху под подскок
const HH = H + Math.ceil(BOB) + 2
const fin = createCanvas(W * N, HH); const gf = fin.getContext('2d')
for (let i = 0; i < N; i++) {
  let low = 0
  for (let y = H - 1; y >= 0 && !low; y--) for (let x = i * W; x < (i + 1) * W; x++) if (out[(y * W * N + x) * 4 + 3]) { low = y; break }
  const cf = createCanvas(W, H); const id = cf.getContext('2d').createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) id.data[(y * W + x) * 4 + k] = out[(y * W * N + i * W + x) * 4 + k]
  cf.getContext('2d').putImageData(id, 0, 0)
  gf.drawImage(cf, i * W, HH - 2 - low)
}
writeFileSync(dst, fin.toBuffer('image/png'))
console.log(JSON.stringify({ w: W, h: HH, ax: Math.round(P[0] + PAD), frames: N, ...info }))
