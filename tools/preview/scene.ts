// Превью целой сцены в пиксельном стиле: карта с декором, башни всех типов атаки, все виды врагов
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readdirSync, writeFileSync } from 'node:fs'

// рендерер создаёт холсты через document.createElement('canvas') — подставляем napi-canvas
;(globalThis as unknown as { document: unknown }).document = {
  createElement: () => {
    const c = createCanvas(1, 1)
    return c
  },
}

const load = async (p: string) => {
  const m = await import(pathToFileURL(resolve(process.argv[1], '../../../src/game', p)).href)
  return m.default ?? m
}

async function main() {
  const { Game } = await load('engine.ts')
  const { render } = await load('render.ts')
  // спрайты из public/assets — в браузере их грузит assets.ts, здесь подкладываем сами
  const { registerAsset } = await load('assets.ts')
  const dir = resolve(process.argv[1], '../../../public/assets')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.png'))) registerAsset(f.replace('.png', ''), await loadImage(resolve(dir, f)))
  const { pointAtLength } = await load('map.ts')
  const seed = Number(process.argv[3] ?? 12345)
  const { generateMap } = await load('map.ts')
  const g = new Game()
  g.useMap(generateMap(seed))
  g.unlockAllTowers()
  g.beginPreview()
  g.gold = 1e6
  // башни: по одной на клетку рядом с тропой, разных типов атаки
  const ids = ['archer', 'catapult', 'pyro', 'sentry', 'frost', 'mortar', 'lightning', 'mech_guard', 'ballista', 'golem']
  let k = 0
  for (let cx = 1; cx < 23 && k < ids.length; cx += 2) {
    for (let cy = 1; cy < 14 && k < ids.length; cy++) {
      const x = cx * 40 + 20
      const y = cy * 40 + 20
      if (g.canPlace(x, y) === null) {
        // только у тропы — проверяем расстояние до неё
        let near = false
        for (let d = 0; d < 3000; d += 20) {
          const p = pointAtLength(d)
          if (Math.hypot(p.x - x, p.y - y) < 70) { near = true; break }
        }
        if (near) {
          const r = g.build(x, y, ids[k])
          if (r.ok) {
            g.towerById(r.towerId).level = 1 + (k % 5)
            k++
            cy += 2
          }
        }
      }
    }
  }
  g.startWave()
  for (let i = 0; i < 160; i++) g.update(0.05)
  // все виды врагов вдоль тропы — для показа
  const kinds = ['scuttler', 'swarm', 'trooper', 'rider', 'juggernaut', 'golem', 'rift', 'wisp', 'titan']
  const armor: Record<string, string> = { scuttler: 'light', swarm: 'light', trooper: 'medium', rider: 'medium', juggernaut: 'heavy', golem: 'heavy', rift: 'universal', wisp: 'universal', titan: 'heavy' }
  const size: Record<string, number> = { scuttler: 11, swarm: 9, trooper: 13, rider: 13, juggernaut: 15, golem: 16, rift: 13, wisp: 11, titan: 26 }
  kinds.forEach((kind, i) => {
    g.creeps.push({
      uid: 900 + i, kind, armor: armor[kind], hp: 60, maxHp: 100, speed: 30, dist: 260 + i * 150, size: size[kind],
      isBoss: kind === 'titan', gold: 1, livesCost: 1, burnDps: 0, burnUntil: 0, burnSource: '', stunnedUntil: 0,
      markedUntil: 0, markedBonus: 0, goldMult: 1, slowPct: 0, slowUntil: 0, vulnBonus: 0, vulnUntil: 0,
    })
  })
  const cv = createCanvas(960, 600)
  const ctx = cv.getContext('2d')
  render(ctx, g, { cam: { z: 1, x: 0, y: 0 }, vw: 960, vh: 600, skin: 'steam', lighting: true, hoverTower: null, selectedTower: null, mergeFrom: null, mouse: null, buildGhost: null })
  writeFileSync(process.argv[2], cv.toBuffer('image/png'))
  console.log('saved; towers', g.towers.length, 'creeps', g.creeps.length)
}
main()
