// Заражение минералом: красные светящиеся части спрайтов врагов перекрашиваются в зелень минерала
// (тот же цвет, что у портала Разлома). Запуск после extract.mjs: node cut/mineral.mjs <png>...
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
for (const f of process.argv.slice(2)) {
  const im = await loadImage(f)
  const c = createCanvas(im.width, im.height); const g = c.getContext('2d'); g.drawImage(im, 0, 0)
  const id = g.getImageData(0, 0, im.width, im.height); const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2]
    if (d[i + 3] === 0 || r < 50 || r - gg < 22 || r - b < 12) continue
    // красноватый пиксель целиком переносится на зелёную шкалу той же яркости; яркое — светится
    const glow = r > 190 ? 1.1 : 1
    d[i] = Math.min(255, r * 0.26 * glow); d[i + 1] = Math.min(255, r * 0.92 * glow); d[i + 2] = Math.min(255, r * 0.56 * glow)
  }
  g.putImageData(id, 0, 0)
  writeFileSync(f, c.toBuffer('image/png'))
}
console.log('ok', process.argv.length - 2)
