// Одноразовый подбор фиксированных зёрен для карт из GDD (запуск: npx tsx scripts/pick-maps.ts).
// Критерии: длина тропы в клетках и число поворотов — под особенности каждой карты.

import { generateMap } from '../src/game/map'

function turnsOf(seed: number): number {
  const m = generateMap(seed)
  return m.points.length - 2 // без входа/выхода за край
}

function cellsOf(seed: number): number {
  return generateMap(seed).cells.length
}

interface Spec {
  name: string
  min: number
  max: number
  minTurns?: number
  maxTurns?: number
}

const specs: Spec[] = [
  { name: 'mill (длинная петля)', min: 62, max: 70 },
  { name: 'bridge (мало мест, извилисто)', min: 56, max: 66, minTurns: 10 },
  { name: 'mines (много места, коротко)', min: 44, max: 49, maxTurns: 8 },
  { name: 'pass (перевал)', min: 50, max: 58 },
  { name: 'valley (долина)', min: 55, max: 64 },
]

for (const s of specs) {
  const found: string[] = []
  for (let seed = 1; seed < 5000 && found.length < 4; seed++) {
    const cells = cellsOf(seed)
    if (cells < s.min || cells > s.max) continue
    const turns = turnsOf(seed)
    if (s.minTurns !== undefined && turns < s.minTurns) continue
    if (s.maxTurns !== undefined && turns > s.maxTurns) continue
    found.push(`seed=${seed} cells=${cells} turns=${turns}`)
  }
  console.log(`${s.name}: ${found.join(' | ') || 'НЕ НАЙДЕНО'}`)
}
