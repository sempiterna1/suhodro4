// Превью шуточного скина: все башни в момент брызг, 3 кадра на башню → PNG
import { createCanvas } from '@napi-rs/canvas'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'

// модули игры — CommonJS для tsx, берём через dynamic import и .default
const load = async (p: string) => {
  const m = await import(pathToFileURL(resolve(process.argv[1], '../../../src/game', p)).href)
  return m.default ?? m
}

async function main() {
  const { drawLolTower } = await load('render-lol.ts')
  const { MERGED_TOWERS, TOWERS } = await load('config.ts')
  const defs = [...TOWERS, ...MERGED_TOWERS]
  const frames = [0.06, 0.16, 0.3] // секунды после выстрела
  const CW = 130
  const CH = 120
  const cols = 3 * 3 // 3 башни в ряд × 3 кадра
  const rows = Math.ceil(defs.length / 3)
  const cv = createCanvas(CW * cols, CH * rows)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#2b2115'
  ctx.fillRect(0, 0, cv.width, cv.height)

  defs.forEach((def: { id: string; name: string }, i: number) => {
    frames.forEach((f, j) => {
      const cx = ((i % 3) * 3 + j) * CW
      const cy = Math.floor(i / 3) * CH
      const tw = {
        id: i + 1, x: cx + 45, y: cy + 80, defId: def.id, level: 3, invested: 0, cooldown: 0, shotCount: 1,
        hammerCd: 0, rampMult: 1, focusUid: 0, focusStacks: 0, lastShotAt: 10, aim: -0.6,
      }
      drawLolTower(ctx, tw, def, 10 + f, false)
      ctx.fillStyle = '#e8c170'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      if (j === 0) ctx.fillText(def.name, cx + 4, cy + 12)
      ctx.strokeStyle = '#000'
      ctx.strokeRect(cx, cy, CW, CH)
    })
  })
  const out = process.argv[2]
  writeFileSync(out, cv.toBuffer('image/png'))
  console.log('saved', out, cv.width, cv.height)
}
main()
