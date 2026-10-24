// Лист ходьбы 2x3 на пурпурном фоне → ряд кадров с прозрачностью: node cut/walksheet.mjs <лист> <выход.png> [масштаб]
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [, , src, dst, sc = '0.3'] = process.argv
const K = Number(sc), COLS = 3, ROWS = 2
const im = await loadImage(src)
const cw = Math.floor(im.width / COLS), ch = Math.floor(im.height / ROWS)
const frames = []
for (let n = 0; n < COLS * ROWS; n++) {
  const c = createCanvas(cw, ch); const g = c.getContext('2d')
  g.drawImage(im, -(n % COLS) * cw, -Math.floor(n / COLS) * ch)
  const id = g.getImageData(0, 0, cw, ch); const d = id.data
  const bg = new Uint8Array(cw * ch)
  for (let i = 0; i < cw * ch; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; bg[i] = r > 110 && b > 100 && gg < 0.7 * Math.min(r, b) ? 1 : 0 }
  // эрозия маски на 1 px — убирает пурпурную кромку
  const fg = new Uint8Array(cw * ch)
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x
    if (bg[i]) continue
    let ok = 1
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= cw || yy >= ch || bg[yy * cw + xx]) ok = 0 }
    fg[i] = ok
  }
  // мелкие компоненты <40 px
  const seen = new Uint8Array(cw * ch)
  for (let s0 = 0; s0 < cw * ch; s0++) {
    if (!fg[s0] || seen[s0]) continue
    const st = [s0], comp = []; seen[s0] = 1
    while (st.length) { const i = st.pop(); comp.push(i); const x = i % cw, y = (i / cw) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) continue; const j = yy * cw + xx; if (fg[j] && !seen[j]) { seen[j] = 1; st.push(j) } } }
    if (comp.length < 40) for (const i of comp) fg[i] = 0
  }
  for (let i = 0; i < cw * ch; i++) d[i * 4 + 3] = fg[i] ? 255 : 0
  g.putImageData(id, 0, 0)
  // уменьшение и порог альфы 110
  const w = Math.round(cw * K), h = Math.round(ch * K)
  const s = createCanvas(w, h); const sg = s.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, w, h)
  const sd = sg.getImageData(0, 0, w, h); const q = sd.data
  let x0 = w, x1 = 0, y0 = h, y1 = 0, sx = 0, cnt = 0; const hx = [] 
  for (let i = 0; i < w * h; i++) {
    if (q[i * 4 + 3] < 110) { q[i * 4 + 3] = 0; continue }
    q[i * 4 + 3] = 255
    const x = i % w, y = (i / w) | 0
    hx.push([x, y]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); sx += x; cnt++
    const r = q[i * 4], gg = q[i * 4 + 1], b = q[i * 4 + 2]
    if (r > 50 && r - gg >= 22 && r - b >= 12) { const glow = r > 190 ? 1.1 : 1; q[i * 4] = Math.min(255, r * 0.26 * glow); q[i * 4 + 1] = Math.min(255, r * 0.92 * glow); q[i * 4 + 2] = Math.min(255, r * 0.56 * glow) }
  }
  sg.putImageData(sd, 0, 0)
  const cut = y0 + (y1 - y0) * 0.35; const top = hx.filter(([, y]) => y <= cut); frames.push({ s, w, h, x0, x1, y0, y1, cx: top.reduce((a, [x]) => a + x, 0) / top.length })
}
// общий размер ячейки: опора по центру тяжести X, низ ячейки с отступом 2 px
const left = Math.max(...frames.map((f) => f.cx - f.x0)), right = Math.max(...frames.map((f) => f.x1 - f.cx))
const H = Math.max(...frames.map((f) => f.y1 - f.y0 + 1)) + 2
const half = Math.ceil(Math.max(left, right)) + 2
const W = half * 2
const out = createCanvas(W * frames.length, H); const o = out.getContext('2d')
frames.forEach((f, i) => o.drawImage(f.s, f.x0, f.y0, f.x1 - f.x0 + 1, f.y1 - f.y0 + 1, i * W + Math.round(half - (f.cx - f.x0)), H - 2 - (f.y1 - f.y0 + 1), f.x1 - f.x0 + 1, f.y1 - f.y0 + 1))
writeFileSync(dst, out.toBuffer('image/png'))
console.log(JSON.stringify({ w: W, h: H, ax: half, frames: frames.length }))
