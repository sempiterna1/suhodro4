// Вырезает башни-рендеры из макетных листов (Desktop/TD/*.jpg) в прозрачные PNG
// public/assets/art-*.png: тесный кадр вокруг башни, фон от кромки, крупнейшая
// компонента (отсекает искры/дым/эффекты), эрозия кромки, обрезка, высота 140.
// Запуск: node scripts/extract-tower-arts.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'C:/Users/magic/Desktop/TD'
const OUT = 'public/assets'
mkdirSync(OUT, { recursive: true })

// [файл, id игры, left%, top%, right%, bottom%] — кадр только вокруг башни с пьедесталом
const SHEETS = [
  ['Bow.jpg', 'archer', 1.0, 8.8, 58.6, 67.4],
  ['Crossbow.jpg', 'crossbow', 2.0, 9.8, 58.6, 67.4],
  ['Hunter.jpg', 'hunter', 2.0, 8.8, 60.5, 67.4],
  ['Hammer.jpg', 'mauler', 1.0, 8.8, 58.6, 67.4],
  ['Pyro.jpg', 'pyro', 2.0, 8.8, 59.6, 69.3],
  ['Golem.jpg', 'golem', 2.0, 7.8, 58.6, 66.4],
  ['Chronomant.jpg', 'chrono', 3.0, 8.8, 58.6, 67.4],
  ['Stone.jpg', 'catapult', 2.0, 7.8, 58.6, 70.3],
  ['Maket — копия.jpg', 'prism', 0.8, 10.4, 60.6, 77.8],
  ['Maket Ice.jpg', 'frost', 2.0, 6.8, 58.6, 68.4],
]

const T = Number(process.env.T ?? 26) // порог близости к цвету фона (RGB-евклид): ниже — не съедает тёмные стены
const HOLE_MIN = Number(process.env.HOLE ?? 30) // замкнутые области фона больше этой площади — прозрачные
const T_HOLE = Number(process.env.TH ?? 12) // для замкнутых «дыр» порог строже: текстурные тёмные стены не трогаем
const TARGET_H = 140 // высота эталонных корпусов башен (127–138)

async function extract(file, id, l, t, r, b) {
  const meta = await sharp(join(SRC, file)).metadata()
  const W = meta.width, H = meta.height
  const L = Math.max(0, Math.floor((l / 100) * W))
  const Tp = Math.max(0, Math.floor((t / 100) * H))
  const R = Math.min(W, Math.ceil((r / 100) * W))
  const B = Math.min(H, Math.ceil((b / 100) * H))
  const { data, info } = await sharp(join(SRC, file))
    .extract({ left: L, top: Tp, width: R - L, height: B - Tp })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height
  const px = new Uint8ClampedArray(data)

  const idx = (x, y) => (y * w + x) * 4
  // цвет фона — среднее по угловым блокам 8×8 (там гарантированно только фон)
  let br = 0, bg = 0, bb = 0, n = 0
  for (const [cx, cy] of [[0, 0], [w - 8, 0], [0, h - 8], [w - 8, h - 8]]) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = idx(cx + x, cy + y)
      br += px[i]; bg += px[i + 1]; bb += px[i + 2]; n++
    }
  }
  br /= n; bg /= n; bb /= n
  const dist = (i) => {
    const dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }
  const isBg = (i) => dist(i) <= T

  // заливка фона от кромки кадра
  const seen = new Uint8Array(w * h)
  const qx = new Int32Array(w * h), qy = new Int32Array(w * h)
  let qh = 0, qt = 0
  const push = (x, y) => {
    const p = y * w + x
    if (seen[p] || !isBg(p * 4)) return
    seen[p] = 1; qx[qt] = x; qy[qt] = y; qt++
  }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (qh < qt) {
    const x = qx[qh], y = qy[qh]; qh++
    px[(y * w + x) * 4 + 3] = 0
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }

  // замкнутые области цвета фона (между тетивой и корпусом) — тоже прозрачные
  const isHoleBg = (i) => dist(i) <= T_HOLE
  const holeSeen = new Uint8Array(w * h)
  const holePx = new Int32Array(w * h)
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || holeSeen[s] || !isHoleBg(s * 4)) continue
    let size = 0
    qh = qt = 0
    qx[qt] = s % w; qy[qt] = (s / w) | 0; qt++
    holeSeen[s] = 1
    holePx[size++] = s
    while (qh < qt) {
      const x = qx[qh], y = qy[qh]; qh++
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const np = ny * w + nx
        if (seen[np] || holeSeen[np] || !isHoleBg(np * 4)) continue
        holeSeen[np] = 1; qx[qt] = nx; qy[qt] = ny; qt++
        holePx[size++] = np
      }
    }
    if (size > HOLE_MIN) {
      for (let k = 0; k < size; k++) { seen[holePx[k]] = 1; px[holePx[k] * 4 + 3] = 0 }
    }
  }

  // крупнейшая связная компонента непрозрачных — сама башня
  const lab = new Int32Array(w * h).fill(-1)
  let best = -1, bestSize = 0, cl = 0
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || lab[s] >= 0) continue
    let size = 0
    qh = qt = 0
    qx[qt] = s % w; qy[qt] = (s / w) | 0; qt++
    lab[s] = cl
    while (qh < qt) {
      const x = qx[qh], y = qy[qh]; qh++
      size++
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const np = ny * w + nx
        if (seen[np] || lab[np] >= 0) continue
        lab[np] = cl; qx[qt] = nx; qy[qt] = ny; qt++
      }
    }
    if (size > bestSize) { bestSize = size; best = cl }
    cl++
  }
  for (let p = 0; p < w * h; p++) {
    px[p * 4 + 3] = lab[p] === best ? 255 : 0
  }

  // эрозия альфы на 1px — снять тёмный ореол JPEG
  const alpha0 = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) alpha0[p] = px[p * 4 + 3]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    if (!alpha0[p]) continue
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !alpha0[ny * w + nx]) { px[p * 4 + 3] = 0; break }
    }
  }

  // bbox по альфе
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[idx(x, y) + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) throw new Error(file + ': пусто после вырезки')
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1
  await sharp(Buffer.from(px.buffer, 0, w * h * 4), { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .resize({ height: TARGET_H, fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3' })
    .png()
    .toFile(join(OUT, `art-${id}.png`))
  const out = await sharp(join(OUT, `art-${id}.png`)).metadata()
  console.log(`${file} -> art-${id}.png  crop ${cw}x${ch}  out ${out.width}x${out.height}`)
}

for (const [file, id, l, t, r, b] of SHEETS) await extract(file, id, l, t, r, b)

// контактный лист результата на шахматке для визуальной проверки
const ids = SHEETS.map(([, id]) => id)
const cellW = 190, cellH = 200, cols = 5, rows = 2
const comps = []
for (let i = 0; i < ids.length; i++) {
  const buf = await sharp(join(OUT, `art-${ids[i]}.png`)).resize({ width: cellW - 16, height: cellH - 30, fit: 'inside' }).png().toBuffer()
  const checker = await sharp({ create: { width: cellW, height: cellH, channels: 4, background: '#9a9a9a' } }).png().toBuffer()
  const layer = await sharp(checker)
    .composite([{ input: buf, gravity: 'center' }, {
      input: Buffer.from(`<svg width="${cellW}" height="18"><text x="4" y="14" font-size="13" fill="#fff" font-family="sans-serif">art-${ids[i]}</text></svg>`),
      top: cellH - 18, left: 0,
    }])
    .png().toBuffer()
  comps.push({ input: layer, left: (i % cols) * cellW, top: ((i / cols) | 0) * cellH })
}
await sharp({ create: { width: cols * cellW, height: rows * cellH, channels: 4, background: '#666666' } })
  .composite(comps).jpeg({ quality: 90 }).toFile('scripts/tower-arts-preview.jpg')
console.log('preview: scripts/tower-arts-preview.jpg')
