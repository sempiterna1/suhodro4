// Гибель из одного вырезанного спрайта: падение назад вокруг ступней, вспышка, распад на осколки
// node cut/deathsheet.mjs <спрайт.png> <лист.png> [кадров=8] [угол падения°=82]
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [, , src, dst, nF = '8', fallDeg = '82'] = process.argv
const N = Number(nF), FALL = Number(fallDeg) * Math.PI / 180
const im = await loadImage(src)
const fw = im.width, fh = im.height
const c0 = createCanvas(fw, fh); const g0 = c0.getContext('2d'); g0.drawImage(im, 0, 0)
const sp = g0.getImageData(0, 0, fw, fh).data
const M = Math.max(fw, fh)
const W = Math.round(M * 1.35), H = Math.round(M * 0.9) + 6
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
// ступни — опора в низу по центру масс нижних строк
let sx = 0, n = 0
for (let y = fh - 4; y < fh; y++) for (let x = 0; x < fw; x++) if (sp[(y * fw + x) * 4 + 3]) { sx += x; n++ }
const pivot = [sx / Math.max(1, n), fh - 1]
const out = createCanvas(W * N, H); const og = out.getContext('2d')
const ease = (t) => 1 - (1 - t) ** 2.2
for (let k = 0; k < N; k++) {
  const t = k / (N - 1)
  const fall = ease(Math.min(1, t * 1.25))
  const a = -FALL * fall // против часовой: падает назад (влево)
  const ca = Math.cos(a), sa = Math.sin(a)
  const dis = Math.max(0, (t - 0.45) / 0.55) // доля распада
  const ox = Math.round(W * 0.8), oy = H - 3
  const img = og.createImageData(W, H)
  const put = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255 }
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const i = (y * fw + x) * 4
    if (!sp[i + 3]) continue
    const hv = hash(x, y, 7)
    if (hv < dis * 0.95) continue // распалось
    // прямое преобразование: поворот вокруг ступней
    const X = x - pivot[0], Y = y - pivot[1]
    let dx = ca * X - sa * Y, dy = sa * X + ca * Y
    // осколки: оставшиеся пиксели дрожат и уходят вверх-в стороны
    const drift = dis * 10 * hash(x, y, 3)
    dx += (hash(x, y, 5) - 0.5) * drift; dy -= drift * 0.8
    // вспышка в начале, затем затемнение
    let r = sp[i], g = sp[i + 1], b = sp[i + 2]
    const flash = k === 0 ? 0 : k === 1 ? 0.35 : Math.max(0, 0.3 - k * 0.05)
    r += (190 - r) * flash; g += (255 - g) * flash; b += (200 - b) * flash
    const dark = 0.25 * t
    r *= 1 - dark; g *= 1 - dark; b *= 1 - dark
    const px = Math.round(ox + dx), py = Math.round(oy + dy * 1)
    put(px, py, r, g, b)
    // поворот оставляет дырки — заполняем соседний пиксель
    if (fall > 0.05) put(px + 1, py, r, g, b)
  }
  og.putImageData(img, k * W, 0)
}
writeFileSync(dst, out.toBuffer('image/png'))
console.log(JSON.stringify({ w: W, h: H, ax: Math.round(W * 0.8), frames: N }))
