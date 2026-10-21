// Генерация карты и постройка по сетке.
// Карта: по зерну детерминирована, тропа непрерывна, слева направо, без самокасаний, в пределах длины.
// Сетка: башня встаёт в центр клетки, на тропу и в занятую клетку — нельзя; гость получает ту же карту.

import { Game } from '../src/game/engine'
import { CELL } from '../src/game/config'
import { CLASSIC_MAP, GRID_H, GRID_W, cellCenter, generateMap, isPathCell, pathLength } from '../src/game/map'

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

// ─── Генератор: 500 зёрен ───
{
  const bad: string[] = []
  const lengths: number[] = []
  for (let seed = 1; seed <= 500; seed++) {
    const m = generateMap(seed)
    const c = m.cells
    lengths.push(c.length)
    const key = (p: { cx: number; cy: number }) => p.cx + ',' + p.cy
    if (m.seed !== seed) bad.push(`${seed}: запасная карта`)
    if (c[0].cx !== 0 || c[c.length - 1].cx !== GRID_W - 1) bad.push(`${seed}: не от края до края`)
    if (new Set(c.map(key)).size !== c.length) bad.push(`${seed}: клетка повторяется`)
    for (let i = 1; i < c.length; i++) {
      if (Math.abs(c[i].cx - c[i - 1].cx) + Math.abs(c[i].cy - c[i - 1].cy) !== 1) bad.push(`${seed}: разрыв на ${i}`)
    }
    if (c.some((p) => p.cy < 1 || p.cy > GRID_H - 2)) bad.push(`${seed}: тропа у самого края`)
    // самокасание: соседние по сетке клетки тропы должны быть соседями и по порядку
    const idx = new Map(c.map((p, i) => [key(p), i]))
    for (let i = 0; i < c.length; i++) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const j = idx.get(c[i].cx + dx + ',' + (c[i].cy + dy))
        if (j !== undefined && Math.abs(j - i) !== 1) bad.push(`${seed}: тропа касается себя`)
      }
    }
  }
  check('500 карт: от края до края, непрерывны, без повторов и самокасаний', bad.length === 0, bad.slice(0, 3).join('; '))
  check('длина тропы 44–70 клеток', Math.min(...lengths) >= 44 && Math.max(...lengths) <= 70,
    `от ${Math.min(...lengths)} до ${Math.max(...lengths)}`)
  check('карты разные', new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(generateMap(i + 1).cells))).size > 40)
  check('одно зерно — одна карта', JSON.stringify(generateMap(777)) === JSON.stringify(generateMap(777)))
  check('зерно 0 — классическая змейка', generateMap(0) === CLASSIC_MAP)
}

// ─── Игра на случайной карте: новая карта на рестарт, крипы идут по тропе ───
{
  const g = new Game()
  const s1 = g.mapSeed
  g.reset()
  check('рестарт генерирует новую карту', g.mapSeed !== s1 && g.mapSeed !== 0)
  const len = pathLength()
  g.beginPreview()
  g.startWave()
  for (let i = 0; i < 20 * 60 * 3; i++) g.update(1 / 20) // без башен — все дойдут
  check('без башен крипы проходят всю тропу', g.stats.leaked > 0, `длина ${Math.round(len)} px, утечек ${g.stats.leaked}`)
}

// ─── Постройка по сетке ───
{
  const g = new Game()
  g.useMap(CLASSIC_MAP)
  g.unlockAllTowers()
  g.beginPreview()
  g.gold = 1e6
  const r = g.build(305, 215, 'archer') // клетка (7,5)
  const tw = g.towerById(r.towerId!)!
  check('башня встаёт в центр клетки', r.ok && tw.x === 7 * CELL + CELL / 2 && tw.y === 5 * CELL + CELL / 2, `${tw.x},${tw.y}`)
  const same = g.build(318, 230, 'sentry') // та же клетка
  check('в занятую клетку строить нельзя', !same.ok, same.error)
  const p = cellCenter(CLASSIC_MAP.cells[10])
  const onPath = g.build(p.x, p.y, 'sentry')
  check('на тропу строить нельзя', !onPath.ok, onPath.error)
  const next = g.build(345, 215, 'sentry') // соседняя клетка (8,5)
  check('в соседнюю клетку строить можно', next.ok)
  let freeCells = 0
  for (let cx = 0; cx < GRID_W; cx++) for (let cy = 0; cy < GRID_H; cy++) if (!isPathCell({ cx, cy })) freeCells++
  check('клеток под башни', freeCells === GRID_W * GRID_H - CLASSIC_MAP.cells.length, String(freeCells))
}

// ─── Кооп: гость получает ту же карту ───
{
  const host = new Game()
  const seed = host.mapSeed
  const cells = JSON.stringify(host.map.cells)
  const guest = new Game() // создаёт свою случайную карту
  guest.applySnap(host.serialize())
  check('гость строит ту же тропу по зерну хоста', guest.mapSeed === seed && JSON.stringify(guest.map.cells) === cells)
}

console.log(failed ? `\n✗ провалено проверок: ${failed}` : '\n✓✓ Карта и сетка работают')
process.exit(failed ? 1 : 0)
