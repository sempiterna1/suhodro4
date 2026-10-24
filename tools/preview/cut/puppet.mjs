// Марионеточная ходьба из одного кадра шага: node cut/puppet.mjs <лента.png> <кадр> <выход.png> [бедро 0..1] [кадров]
// Ноги делятся по осям бедро→стопа; каждая качается вокруг бедра от своей позы шага до позы другой ноги
// (через проходную), корпус остаётся целым; кадры опускаются на землю по самому низкому пикселю (отсюда подскок)
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [, , src, idx, dst, hipK = '0.5', nF = '8'] = process.argv
const N = Number(nF), PAD = 30
const im = await loadImage(src)
const fw = im.width / 6, fh = im.height
const c0 = createCanvas(fw, fh); const g0 = c0.getContext('2d'); g0.drawImage(im, -Number(idx) * fw, 0)
const sp = g0.getImageData(0, 0, fw, fh).data
const A = (x, y) => (x < 0 || y < 0 || x >= fw || y >= fh ? 0 : sp[(y * fw + x) * 4 + 3])
let y0 = fh, y1 = 0
for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (A(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
const hipY = Math.round(y0 + (y1 - y0) * Number(hipK))
// стопы: нижние 12% силуэта делятся на левую и правую группы по среднему X
const pts = []
for (let y = Math.round(y1 - (y1 - y0) * 0.12); y <= y1; y++) for (let x = 0; x < fw; x++) if (A(x, y)) pts.push([x, y])
const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
const grp = (f) => { const q = pts.filter(f); return [q.reduce((a, p) => a + p[0], 0) / q.length, q.reduce((a, p) => a + p[1], 0) / q.length] }
const FL = grp((p) => p[0] < mx), FR = grp((p) => p[0] >= mx)
// бедро — середина силуэта по X на линии бёдер
let hx0 = fw, hx1 = 0
for (let x = 0; x < fw; x++) if (A(x, hipY)) { hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x) }
const P = [(hx0 + hx1) / 2, hipY]
const ang = (F) => Math.atan2(F[0] - P[0], F[1] - P[1]) // от вертикали, + = стопа вправо (вперёд)
const aL0 = ang(FL), aR0 = ang(FR), mid = (aL0 + aR0) / 2
const dist = (x, y, F) => { const dx = F[0] - P[0], dy = F[1] - P[1], t = Math.max(0, Math.min(1, ((x - P[0]) * dx + (y - P[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - P[0] - dx * t, y - P[1] - dy * t) }
const ARM = 14 // дальше от осей ног — висящие руки: остаются с корпусом
const armPx = (x, y) => y >= hipY + 6 && y < hipY + 28 && (Math.min(dist(x, y, FL), dist(x, y, FR)) > ARM || (Math.abs(x - P[0]) > 22 && Math.min(dist(x, y, FL), dist(x, y, FR)) > 5))
const legOf = (x, y) => (dist(x, y, FL) <= dist(x, y, FR) ? 0 : 1)
const W = fw + PAD * 2, H = fh
const px = (x, y) => { const i = (y * fw + x) * 4; return [sp[i], sp[i + 1], sp[i + 2]] }
const out = new Uint8ClampedArray(W * N * H * 4)
function draw(ox, mask, a, dy) {
  const ca = Math.cos(a), sa = Math.sin(a)
  for (let y = 0; y < H; y++) for (let x = -PAD; x < fw + PAD; x++) {
    const X = x - P[0], Y = y - dy - P[1]
    const sx = Math.round(ca * X + sa * Y + P[0]), sy = Math.round(-sa * X + ca * Y + P[1])
    if (!A(sx, sy) || !mask(sx, sy)) continue
    const p = px(sx, sy), o = (y * W * N + ox + x + PAD) * 4
    out[o] = p[0]; out[o + 1] = p[1]; out[o + 2] = p[2]; out[o + 3] = 255
  }
}
const LIFT = 9, LEAN = 2 * Math.PI / 180
for (let i = 0; i < N; i++) {
  const f = (i / N) * Math.PI * 2, ox = i * W
  const dL = (mid - aL0) * (1 - Math.cos(f)), dR = (mid - aR0) * (1 - Math.cos(f))
  // нога идёт из позы шага через проходную в позу другой ноги: переносящая нога поднимается
  const liftL = f > Math.PI ? Math.sin(f - Math.PI) * LIFT : 0, liftR = f < Math.PI ? Math.sin(f) * LIFT : 0
  // у ноги, что вначале впереди (R), перенос — вторая половина цикла
  const swingL = f < Math.PI ? Math.sin(f) * LIFT : 0, swingR = f > Math.PI ? Math.sin(f - Math.PI) * LIFT : 0
  draw(ox, (x, y) => y >= hipY - 12 && !armPx(x, y) && legOf(x, y) === 0, -dL, -swingL)
  draw(ox, (x, y) => y >= hipY - 12 && !armPx(x, y) && legOf(x, y) === 1, -dR, -swingR)
  draw(ox, (x, y) => y < hipY + 6 || armPx(x, y), LEAN * Math.sin(f), 0)
}
// обломки: компоненты мельче 160 px в кадре убираем
for (let i = 0; i < N; i++) {
  const seen = new Uint8Array(W * H), at = (x, y) => (y * W * N + i * W + x) * 4 + 3
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || !out[at(s0 % W, (s0 / W) | 0)]) continue
    const st = [s0], comp = []; seen[s0] = 1
    while (st.length) { const j = st.pop(); comp.push(j); const x = j % W, y = (j / W) | 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const k = yy * W + xx; if (!seen[k] && out[at(xx, yy)]) { seen[k] = 1; st.push(k) } } }
    if (comp.length < 160) for (const j of comp) out[at(j % W, (j / W) | 0)] = 0
  }
}
// каждый кадр опускается на землю: самый низкий пиксель — на H-2
const fin = createCanvas(W * N, H); const gf = fin.getContext('2d')
for (let i = 0; i < N; i++) {
  let low = 0
  for (let y = H - 1; y >= 0 && !low; y--) for (let x = i * W; x < (i + 1) * W; x++) if (out[(y * W * N + x) * 4 + 3]) { low = y; break }
  const cf = createCanvas(W, H); const id = cf.getContext('2d').createImageData(W, H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let k = 0; k < 4; k++) id.data[(y * W + x) * 4 + k] = out[(y * W * N + i * W + x) * 4 + k]
  cf.getContext('2d').putImageData(id, 0, 0)
  gf.drawImage(cf, i * W, H - 2 - low)
}
writeFileSync(dst, fin.toBuffer('image/png'))
console.log(JSON.stringify({ w: W, h: H, ax: Math.round(P[0] + PAD), hipY, frames: N, aL0, aR0 }))
