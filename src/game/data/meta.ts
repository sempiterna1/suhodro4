// Метапрогрессия «Верстак» (docs/meta.md): детали башен и сундуки.
// Детали копятся единицами и усиливают конкретную башню в следующих миссиях.
// Экономические постройки и слитые уникальные башни вне коллекции (см. док).

import { TOWERS } from './towers'
import { MAP_DEFS } from './maps'

/** id карт кампании в порядке лесенки — для ачивки «Все тракты» */
const MAP_IDS = MAP_DEFS.map((d) => d.id)

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
  /** иконка сундука (эмодзи) для наград и СОБЫТИЙ */
  icon: string
  /** акцентный цвет рамки/заголовка (hex) */
  accent: string
}

export const CHESTS: Record<'firstClear' | 'repeatWin' | 'daily' | 'dailyTask' | 'achievement', ChestDef> = {
  firstClear: { id: 'firstClear', name: 'Сундук первопроходца', units: [3, 5], chance: 1, icon: '🗝️', accent: '#e0a832' },
  repeatWin: { id: 'repeatWin', name: 'Походный сундук', units: [1, 3], chance: 0.25, icon: '🧰', accent: '#9db4d0' },
  daily: { id: 'daily', name: 'Дневной сундук', units: [2, 4], chance: 1, icon: '🎁', accent: '#7fd0a0' },
  dailyTask: { id: 'dailyTask', name: 'Награда задачи дня', units: [1, 3], chance: 1, icon: '📋', accent: '#c49ad0' },
  achievement: { id: 'achievement', name: 'Сундук за ачивку', units: [1, 3], chance: 1, icon: '🏆', accent: '#ffd700' },
}

// ─── Ачивки (этап 2, docs/meta.md): одноразовые сундуки за подвиги ───────
// Каждая ачивка берётся один раз (список achieved в сейве); сундук за неё
// единожды. Контекст проверки — итоги миссии + сейв (победы, коллекция).

export interface AchievementCtx {
  /** итоги миссии: утечки, слияния, сложность */
  leaked: number
  merges: number
  difficulty: string
  /** сейв на момент проверки (победы уже посчитаны в нём) */
  wins: number
  winsByMap: Record<string, number>
  parts: Record<string, number>
  unlocked: string[]
}

export interface AchievementDef {
  id: string
  name: string
  desc: string
  icon: string
  /** диапазон единиц деталей в сундуке за ачивку */
  reward: [number, number]
  check: (ctx: AchievementCtx) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'clean-defense',
    name: 'Идеальная оборона',
    desc: 'Победите в миссии, не пропустив ни одного заражённого',
    icon: '🛡️',
    reward: [2, 4],
    check: (c) => c.leaked === 0,
  },
  {
    id: 'merger-5',
    name: 'Мастер слияний',
    desc: 'Совершите 5 слияний башен за одну миссию',
    icon: '🔗',
    reward: [1, 3],
    check: (c) => c.merges >= 5,
  },
  {
    id: 'nightmare-victory',
    name: 'Кошмар удержан',
    desc: 'Победите на сложности «Кошмар»',
    icon: '💀',
    reward: [3, 5],
    check: (c) => c.difficulty === 'nightmare',
  },
  {
    id: 'all-tracts',
    name: 'Все тракты',
    desc: 'Победите хотя бы раз на каждой карте кампании',
    icon: '🗺️',
    reward: [4, 6],
    check: (c) => MAP_IDS.every((id) => c.winsByMap[id]),
  },
  {
    id: 'veteran-10',
    name: 'Ветеран горизонта',
    desc: 'Одержите 10 побед суммарно',
    icon: '🎖️',
    reward: [2, 3],
    check: (c) => c.wins >= 10,
  },
  {
    id: 'full-set',
    name: 'Полный комплект',
    desc: 'Доведите любую деталь до потолка коллекции',
    icon: '⚙️',
    reward: [1, 2],
    check: (c) => PARTS.some((p) => Math.min(p.max, c.parts[p.id] ?? 0) >= p.max),
  },
]

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
