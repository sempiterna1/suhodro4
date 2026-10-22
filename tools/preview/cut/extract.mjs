// Вырезает ассеты из листа: фон, связанный с краем рамки, — прозрачный, кромка — полупрозрачная
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync } from 'node:fs'
const [src, outDir, listFile] = process.argv.slice(2)
const list = JSON.parse((await import('node:fs')).readFileSync(listFile, 'utf8'))
const img = await loadImage(src)
const G = createCanvas(img.width, img.height).getContext('2d'); G.drawImage(img, 0, 0)
const BG = [6, 21, 30]
mkdirSync(outDir, { recursive: true })
const sheet = createCanvas(1400, 900); const S = sheet.getContext('2d')
S.fillStyle = '#8597b0'; S.fillRect(0, 0, 1400, 900)
let sx = 4, sy = 4, rowH = 0
for (const [name, x0, y0, x1, y1, mode = "one", thr = 24] of list) {
  const w = x1 - x0, h = y1 - y0
  const id = G.getImageData(x0, y0, w, h); const d = id.data
  const dist = (p) => Math.hypot(d[p] - BG[0], d[p + 1] - BG[1], d[p + 2] - BG[2])
  const bg = new Uint8Array(w * h); const st = []
  for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x) }
  for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1) }
  while (st.length) { const p = st.pop(); if (bg[p] || dist(p * 4) > thr) continue; bg[p] = 1; const x = p % w
    if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (p >= w) st.push(p - w); if (p < w * (h - 1)) st.push(p + w) }
  for (let p = 0; p < w * h; p++) {
    const i = p * 4
    if (bg[p]) { d[i + 3] = 0; continue }
    // кромка рядом с фоном: прозрачность по расстоянию до цвета фона, цвет «вычитаем» из смеси
    const x = p % w, y = (p / w) | 0
    const near = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w])
    if (near) {
      const a = Math.max(0.15, Math.min(1, (dist(i) - 10) / 45))
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - BG[k] * (1 - a)) / a))
      d[i + 3] = Math.round(a * 255)
    }
  }
  // связные компоненты непрозрачных пикселей (с расширением на 3 пикселя — дым и искры держатся вместе)
  const R = mode === 'split' ? 2 : 4
  const op = (p) => d[p * 4 + 3] > 40
  const lab = new Int32Array(w * h); const comps = []
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!op(s0) || lab[s0]) continue
    const id2 = comps.length + 1; const st2 = [s0]; lab[s0] = id2; const px = []
    while (st2.length) { const p = st2.pop(); px.push(p); const x = p % w, y = (p / w) | 0
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const X = x + dx, Y = y + dy
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const q = Y * w + X; if (!lab[q] && op(q)) { lab[q] = id2; st2.push(q) } } }
    comps.push(px)
  }
  const maxA = Math.max(...comps.map((c) => c.length))
  const keep = mode === 'split' ? comps.filter((c) => c.length >= 120) : [comps.filter((c) => c.length >= maxA * 0.12).flat()]
  keep.forEach((pxs, k) => {
    const set = new Set(pxs); let bx0 = w, by0 = h, bx1 = 0, by1 = 0
    for (const p of pxs) { const x = p % w, y = (p / w) | 0; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y) }
    // полупрозрачная кромка тоже принадлежит компоненту — расширяем рамку на 1
    bx0 = Math.max(0, bx0 - 1); by0 = Math.max(0, by0 - 1); bx1 = Math.min(w - 1, bx1 + 1); by1 = Math.min(h - 1, by1 + 1)
    const cw = bx1 - bx0 + 1, ch = by1 - by0 + 1
    const out = new Uint8ClampedArray(cw * ch * 4)
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const p = (y + by0) * w + x + bx0
      let own = set.has(p)
      if (!own && d[p * 4 + 3] > 0) for (const q of [p - 1, p + 1, p - w, p + w]) if (set.has(q)) own = true
      if (!own) continue
      for (let k2 = 0; k2 < 4; k2++) out[(y * cw + x) * 4 + k2] = d[p * 4 + k2]
    }
    const c = createCanvas(cw, ch); const cc = c.getContext('2d'); const im = cc.createImageData(cw, ch); im.data.set(out); cc.putImageData(im, 0, 0)
    const nm = mode === 'split' ? `${name}-${k + 1}` : name
    writeFileSync(`${outDir}/${nm}.png`, c.toBuffer('image/png'))
    if (sx + cw > 1396) { sx = 4; sy += rowH + 16; rowH = 0 }
    S.drawImage(c, sx, sy); S.fillStyle = '#000'; S.font = '10px sans-serif'; S.fillText(nm, sx, sy + ch + 11)
    sx += cw + 8; rowH = Math.max(rowH, ch)
  })
}
writeFileSync(`${outDir}/_sheet.png`, sheet.toBuffer('image/png'))
