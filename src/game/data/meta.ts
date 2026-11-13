// Метапрогрессия «Верстак» (docs/meta.md): детали башен и сундуки.
// Детали копятся единицами и усиливают конкретную башню в следующих миссиях.
// Экономические постройки и слитые уникальные башни вне коллекции (см. док).

import { TOWERS } from './towers'

// ─── Слоты деталей ───────────────────────────────────────────────────────
// Каждая единица детали — фиксированная прибавка. Капы подобраны так, чтобы
// полностью собранная башня была сильнее базовой на ~15–20% (docs/meta.md).

export type PartStat = 'damage' | 'cadence' | 'range'

export interface PartStatDef {
  stat: PartStat
  label: string // «урон», «скорострельность», «дальность»
  /** прибавка за единицу: damage — доля урона, cadence — доля интервала (уменьшает), range — доля дальности */
  step: number
  /** потолок единиц на этот слот */
  max: number
  /** имя детали в лоре (подставляется имя башни) */
  partName: (towerName: string) => string
}

export const PART_STATS: PartStatDef[] = [
  {
    stat: 'damage',
    label: 'урон',
    step: 0.015,
    max: 10,
    partName: (n) => `Заточенный механизм «${n}»`,
  },
  {
    stat: 'cadence',
    label: 'скорострельность',
    step: 0.01,
    max: 10,
    partName: (n) => `Отлаженная пружина «${n}»`,
  },
  {
    stat: 'range',
    label: 'дальность',
    step: 0.01,
    max: 5,
    partName: (n) => `Длинная стойка «${n}»`,
  },
]

export const PART_STAT_BY_ID = Object.fromEntries(PART_STATS.map((s) => [s.stat, s])) as Record<PartStat, PartStatDef>

// ─── Детали: по одной на каждую боевую башню и слот ──────────────────────

export interface PartDef {
  id: string // «archer-damage»
  towerId: string
  stat: PartStat
  name: string
  /** прибавка за единицу (из PART_STATS) */
  step: number
  /** потолок единиц */
  max: number
}

export const PARTS: PartDef[] = TOWERS.flatMap((t) =>
  PART_STATS.map((s) => ({
    id: `${t.id}-${s.stat}`,
    towerId: t.id,
    stat: s.stat,
    name: s.partName(t.name),
    step: s.step,
    max: s.max,
  }))
)

export const PART_BY_ID: Record<string, PartDef> = Object.fromEntries(PARTS.map((p) => [p.id, p]))

// ─── Сундуки ─────────────────────────────────────────────────────────────
// Донат-сундуки зарезервированы (docs/meta.md, этап 3) — в код их нет.

export interface ChestDef {
  id: string
  name: string
  /** диапазон единиц деталей в сундуке */
  units: [number, number]
  /** шанс выпадения (первое прохождение — всегда) */
  chance: number
}

export const CHESTS: Record<'firstClear' | 'repeatWin' | 'daily', ChestDef> = {
  firstClear: { id: 'firstClear', name: 'Сундук первопроходца', units: [3, 5], chance: 1 },
  repeatWin: { id: 'repeatWin', name: 'Походный сундук', units: [1, 3], chance: 0.25 },
  daily: { id: 'daily', name: 'Дневной сундук', units: [2, 4], chance: 1 },
}

/** Бонусный вес башни в дропе: стартовые башни чуть чаще — прогресс первых карт ощутим */
const DROP_WEIGHT: Partial<Record<string, number>> = {
  sentry: 2,
  archer: 2,
  pyro: 2,
  catapult: 1.5,
}

/**
 * Ролл содержимого сундука: units единиц, каждая — на случайную башню/слот.
 * rng подаётся снаружи (в игре — Math.random, в тестах — детерминированный).
 */
export function rollChest(chest: ChestDef, rng: () => number): Array<{ partId: string; units: number }> {
  const total = PARTS.reduce((s, p) => s + (DROP_WEIGHT[p.towerId] ?? 1), 0)
  const pick = (): PartDef => {
    let r = rng() * total
    for (const p of PARTS) {
      r -= DROP_WEIGHT[p.towerId] ?? 1
      if (r <= 0) return p
    }
    return PARTS[PARTS.length - 1]
  }
  const lo = chest.units[0]
  const hi = chest.units[1]
  const n = lo + Math.floor(rng() * (hi - lo + 1))
  const out = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const p = pick()
    out.set(p.id, (out.get(p.id) ?? 0) + 1)
  }
  return [...out].map(([partId, units]) => ({ partId, units }))
}
