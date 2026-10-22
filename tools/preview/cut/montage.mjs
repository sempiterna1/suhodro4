import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readdirSync, writeFileSync } from 'node:fs'
const dir = process.argv[2]; const files = readdirSync(dir).filter((f) => f.endsWith('.png') && !f.startsWith('_'))
const c = createCanvas(1300, 760); const g = c.getContext('2d'); g.fillStyle = '#8597b0'; g.fillRect(0, 0, 1300, 760)
let x = 4, y = 4, rh = 0
for (const f of files) { const im = await loadImage(`${dir}/${f}`); if (x + im.width > 1296) { x = 4; y += rh + 14; rh = 0 }
  g.drawImage(im, x, y); g.fillStyle = '#000'; g.font = '10px sans-serif'; g.fillText(f.replace('.png', ''), x, y + im.height + 10); x += im.width + 8; rh = Math.max(rh, im.height) }
writeFileSync(process.argv[3], c.toBuffer('image/png'))
