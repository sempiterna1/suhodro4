import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'
const [,, out, cols, ...files] = process.argv
const ims = await Promise.all(files.map((f) => loadImage(f)))
const S = 480 / Math.max(...ims.map(i => i.width)) , C = Number(cols), rows = Math.ceil(ims.length / C)
const cw = Math.round(Math.max(...ims.map(i=>i.width))*S), ch = Math.round(Math.max(...ims.map(i=>i.height))*S)
const c = createCanvas(cw*C, ch*rows); const g = c.getContext('2d')
ims.forEach((im,i)=>g.drawImage(im,(i%C)*cw,Math.floor(i/C)*ch,cw,ch))
writeFileSync(out, c.toBuffer('image/png'))
