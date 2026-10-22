// Метаданные спрайтов для игры: размер и точка опоры (центр «пятна» нижних непрозрачных строк).
// Запуск: node cut/meta.mjs ../../public/assets ../../src/game/assets.json
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readdirSync, writeFileSync } from 'node:fs'
const [dir, out] = process.argv.slice(2)
const meta = {}
for (const f of readdirSync(dir).filter((f) => f.endsWith('.png')).sort()) {
  const im = await loadImage(`${dir}/${f}`)
  const g = createCanvas(im.width, im.height).getContext('2d'); g.drawImage(im, 0, 0)
  const d = g.getImageData(0, 0, im.width, im.height).data
  // опора по x — середина непрозрачных пикселей в нижней пятой части (дым и огонь сверху не сбивают)
  let sx = 0, n = 0
  for (let y = Math.floor(im.height * 0.8); y < im.height; y++) for (let x = 0; x < im.width; x++) if (d[(y * im.width + x) * 4 + 3] > 128) { sx += x; n++ }
  meta[f.replace('.png', '')] = { w: im.width, h: im.height, ax: Math.round(n ? sx / n : im.width / 2) }
}
writeFileSync(out, JSON.stringify(meta, null, 1) + '\n')
console.log(Object.keys(meta).length, 'sprites')
