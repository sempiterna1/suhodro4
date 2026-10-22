// Замер стоимости кадра: render() со светом и без, на сцене с башнями и врагами
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
  const { render } = await load('render.ts')
  const { generateMap } = await load('map.ts')
  const g = new Game()
  g.useMap(generateMap(1987654321))
  g.unlockAllTowers()
  g.beginPreview()
  g.gold = 1e6
  const ids = ['archer', 'catapult', 'pyro', 'frost', 'lightning', 'mortar', 'mech_guard', 'prism']
  let k = 0
  for (let cx = 1; cx < 23; cx++) for (let cy = 1; cy < 14; cy++) {
    if (k >= 30) break
    if (g.canPlace(cx * 40 + 20, cy * 40 + 20) === null && (cx + cy) % 3 === 0) {
      if (g.build(cx * 40 + 20, cy * 40 + 20, ids[k % ids.length]).ok) k++
    }
  }
  g.startWave()
  for (let i = 0; i < 200; i++) g.update(0.05)
  const cv = createCanvas(960, 600)
  const ctx = cv.getContext('2d')
  const view = (lighting: boolean) => ({ skin: 'steam', lighting, hoverTower: null, selectedTower: null, mergeFrom: null, mouse: null, buildGhost: null })
  for (const lighting of [false, true]) {
    for (let i = 0; i < 20; i++) render(ctx, g, view(lighting)) // прогрев
    const t0 = performance.now()
    const N = 200
    for (let i = 0; i < N; i++) {
      g.update(0.016)
      render(ctx, g, view(lighting))
    }
    console.log(`lighting=${lighting}: ${((performance.now() - t0) / N).toFixed(2)} ms/кадр, башен ${g.towers.length}, врагов ${g.creeps.length}, снарядов ${g.projectiles.length}`)
  }
}
main()
