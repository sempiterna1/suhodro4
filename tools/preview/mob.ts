// Покадровая полоса ходьбы и гибели одного врага в сцене, ×3: npx -y tsx@4.19.2 mob.ts <kind> out/<файл>.png
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readdirSync, writeFileSync } from 'node:fs'
;(globalThis as unknown as { document: unknown }).document = { createElement: () => createCanvas(1, 1) }
const load = async (p: string) => { const m = await import(pathToFileURL(resolve(process.argv[1], '../../../src/game', p)).href); return m.default ?? m }
async function main() {
  const kind = process.argv[2] ?? 'scuttler'
  const { Game } = await load('engine.ts'); const { render } = await load('render.ts')
  const { registerAsset } = await load('assets.ts'); const { generateMap, pointAtLength } = await load('map.ts'); const { toScreen } = await load('iso.ts')
  const dir = resolve(process.argv[1], '../../../public/assets')
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.png'))) registerAsset(f.replace('.png', ''), await loadImage(resolve(dir, f)))
  const g = new Game(); g.useMap(generateMap(12345)); g.beginPreview(); g.startWave()
  for (let i = 0; i < 20; i++) g.update(0.05)
  const mk = () => ({ uid: 2, kind, armor: 'light', hp: 100, maxHp: 100, speed: 30, dist: 340, size: 11, isBoss: kind === 'titan', gold: 1, livesCost: 1, burnDps: 0, burnUntil: 0, burnSource: '', stunnedUntil: 0, markedUntil: 0, markedBonus: 0, goldMult: 1, slowPct: 0, slowUntil: 0, vulnBonus: 0, vulnUntil: 0 })
  g.creeps = [mk()]
  const p = pointAtLength(340), sc = toScreen(p.x, p.y)
  const N = 8, W = Number(process.env.CW ?? 60), H = Number(process.env.CH ?? 56), S = Number(process.env.CS ?? 4)
  const out = createCanvas(W * S * N, H * S * 2); const o = out.getContext('2d'); o.imageSmoothingEnabled = false
  const view = { cam: { z: 1, x: 0, y: 0 }, vw: 960, vh: 600, skin: 'steam', lighting: false, hoverTower: null, selectedTower: null, mergeFrom: null, mouse: null, buildGhost: null }
  const base = g.time
  const shot = (i: number, row: number) => {
    const cv = createCanvas(960, 600); render(cv.getContext('2d'), g, view)
    o.drawImage(cv, sc.x - W / 2, sc.y - H + 14, W, H, i * W * S, row * H * S, W * S, H * S)
  }
  for (let i = 0; i < N; i++) { g.time = base + i / 12; shot(i, 0) }
  g.creeps = []
  const t0 = base + 5
  for (let i = 0; i < N; i++) {
    g.time = t0
    g.effects = [{ x: p.x, y: p.y, r: 0, born: t0 - (i / N) * 0.95, dur: 1, color: '', kind: 'corpse', creep: kind, uid: 2 }]
    shot(i, 1)
  }
  writeFileSync(process.argv[3] ?? 'out/mob.png', out.toBuffer('image/png'))
}
main()
