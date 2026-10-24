// Один спрайт на пурпурном фоне → прозрачный, уменьшенный, с зелёным минералом: node cut/cutout.mjs <in.png> <out.png> [масштаб=0.3] [красное→зелёное: 1|0]
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [, , src, dst, sc = '0.3', recolor = '1'] = process.argv
const K = Number(sc)
const im = await loadImage(src); const W0 = im.width, H0 = im.height
const c = createCanvas(W0, H0); const g = c.getContext('2d'); g.drawImage(im, 0, 0)
const id = g.getImageData(0, 0, W0, H0); const d = id.data
const bg = new Uint8Array(W0 * H0)
for (let i = 0; i < W0 * H0; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; bg[i] = r > 110 && b > 100 && gg < 0.7 * Math.min(r, b) ? 1 : 0 }
const fg = new Uint8Array(W0 * H0)
for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
  const i = y * W0 + x; if (bg[i]) continue
  let ok = 1
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W0 || yy >= H0 || bg[yy * W0 + xx]) ok = 0 }
  fg[i] = ok
}
// мелкие компоненты (<400 px) убираем
const seen = new Uint8Array(W0 * H0)
for (let s0 = 0; s0 < W0 * H0; s0++) {
  if (!fg[s0] || seen[s0]) continue
  const st = [s0], comp = []; seen[s0] = 1
  while (st.length) {
    const i = st.pop(); comp.push(i); const x = i % W0, y = (i / W0) | 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W0 || yy >= H0) continue
      const j = yy * W0 + xx; if (fg[j] && !seen[j]) { seen[j] = 1; st.push(j) }
    }
  }
  if (comp.length < 400) for (const i of comp) fg[i] = 0
}
for (let i = 0; i < W0 * H0; i++) d[i * 4 + 3] = fg[i] ? 255 : 0
g.putImageData(id, 0, 0)
const w = Math.round(W0 * K), h = Math.round(H0 * K)
const s = createCanvas(w, h); const sg = s.getContext('2d'); sg.imageSmoothingQuality = 'high'; sg.drawImage(c, 0, 0, w, h)
const sd = sg.getImageData(0, 0, w, h); const q = sd.data
let x0 = w, x1 = 0, y0 = h, y1 = 0
for (let i = 0; i < w * h; i++) {
  if (q[i * 4 + 3] < 110) { q[i * 4 + 3] = 0; continue }
  q[i * 4 + 3] = 255
  const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  const r = q[i * 4], gg = q[i * 4 + 1], b = q[i * 4 + 2]
  if (recolor === '1' && r > 50 && r - gg >= 22 && r - b >= 12) {
    const glow = r > 190 ? 1.1 : 1
    q[i * 4] = Math.min(255, r * 0.26 * glow); q[i * 4 + 1] = Math.min(255, r * 0.92 * glow); q[i * 4 + 2] = Math.min(255, r * 0.56 * glow)
  }
}
sg.putImageData(sd, 0, 0)
const o = createCanvas(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(s, -x0, -y0)
writeFileSync(dst, o.toBuffer('image/png'))
console.log(JSON.stringify({ w: x1 - x0 + 1, h: y1 - y0 + 1 }))
