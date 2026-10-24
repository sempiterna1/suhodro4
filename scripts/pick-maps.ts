// Одноразовый подбор фиксированных зёрен для карт из GDD (запуск: npx tsx scripts/pick-maps.ts).
// Критерии: длина тропы «меандром» в клетках и число поворотов — под особенности каждой карты.
// Для карт со вторым выходом зерно проверяется с зондирующей записью в реестре:
// генератор смотрит MapDef.secondExitWave, поэтому временно добавляем карту с нужным зерном.

import { MAP_DEFS, type MapDef } from '../src/game/config'
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
  secondExit?: boolean // требовать вторую тропу приличной длины
}

const specs: Spec[] = [
  { name: 'mill (длинная петля)', min: 84, max: 100 },
  { name: 'bridge (мало мест, извилисто)', min: 70, max: 84, minTurns: 14 },
  { name: 'mines (много места, коротко)', min: 56, max: 64, maxTurns: 12 },
  { name: 'pass (перевал)', min: 64, max: 76 },
  { name: 'valley (долина, второй выход)', min: 68, max: 84, secondExit: true },
]

// зонд: генератор видит secondExitWave только у карт из реестра
const probe: MapDef = {
  id: '__probe', name: 'probe', feature: '', seed: -1,
  creepSpeedMult: 1, universalExtra: 0, secondExitWave: 16,
}
MAP_DEFS.push(probe)
const secondOf = (seed: number): number => {
  probe.seed = seed
  return generateMap(seed).cells2?.length ?? 0
}

const used = new Set<number>()
for (const s of specs) {
  const found: string[] = []
  for (let seed = 1; seed < 8000 && found.length < 5; seed++) {
    if (used.has(seed)) continue
    const cells = cellsOf(seed)
    if (cells < s.min || cells > s.max) continue
    const turns = turnsOf(seed)
    if (s.minTurns !== undefined && turns < s.minTurns) continue
    if (s.maxTurns !== undefined && turns > s.maxTurns) continue
    if (s.secondExit) {
      const second = secondOf(seed)
      if (second < 44) continue
      found.push(`seed=${seed} cells=${cells} turns=${turns} second=${second}`)
      continue
    }
    found.push(`seed=${seed} cells=${cells} turns=${turns}`)
  }
  console.log(`${s.name}: ${found.join(' | ') || 'НЕ НАЙДЕНО'}`)
  if (found[0]) used.add(Number(/seed=(\d+)/.exec(found[0])![1]))
}
MAP_DEFS.pop()
