// Замер частей освещения по отдельности
import { createCanvas } from '@napi-rs/canvas'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

;(globalThis as unknown as { document: unknown }).document = { createElement: () => createCanvas(1, 1) }
const load = async (p: string) => {
  const m = await import(pathToFileURL(resolve(process.argv[1], '../../../src/game', p)).href)
  return m.default ?? m
}

async function main() {
  const { Game } = await load('engine.ts')
  const { generateMap } = await load('map.ts')
  const { buildPixelBackground, LOW_W, LOW_H } = await load('pixel.ts')
  const { applyLighting, drawFog, drawSmoke } = await load('lighting.ts')
  const g = new Game()
  g.useMap(generateMap(1987654321))
  buildPixelBackground(g.map)
  const cv = createCanvas(LOW_W, LOW_H)
  const L = cv.getContext('2d')
  const time = (name: string, fn: () => void) => {
    for (let i = 0; i < 20; i++) fn()
    const t0 = performance.now()
    for (let i = 0; i < 300; i++) fn()
    console.log(`${name}: ${((performance.now() - t0) / 300).toFixed(3)} ms`)
  }
  time('applyLighting', () => applyLighting(L, g, performance.now() / 1000))
  time('drawFog', () => drawFog(L, performance.now() / 1000))
  time('drawSmoke', () => drawSmoke(L, performance.now() / 1000))
  time('fullscreen lighter blit', () => {
    L.globalCompositeOperation = 'lighter'
    L.drawImage(cv, 0, 0)
    L.globalCompositeOperation = 'source-over'
  })
}
main()
