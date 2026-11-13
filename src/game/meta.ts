// Метапрогрессия «Верстак» (docs/meta.md): сохранение, лесенка карт, бонусы башен.
// Модуль не знает про React и движок: UI читает/пишет сейв, движок получает
// бонусы через колбэк (Game.metaBonus), headless-симулятор живёт без мета —
// это базовая линия баланса.

import { MAP_DEFS, type MapDef } from './data/maps'
import { CHESTS, PART_BY_ID, PARTS, PART_STAT_BY_ID, rollChest, type PartStat } from './data/meta'

export interface MetaSave {
  v: 1
  /** единицы деталей: «archer-damage» → сколько накоплено */
  parts: Record<string, number>
  /** открытые карты (id из MAP_DEFS), первая открыта всегда */
  unlocked: string[]
  /** метка последнего дневного сундука (сутки по локальному времени) */
  dailyAt: number | null
  wins: number
  winsByMap: Record<string, number>
}

export const META_KEY = 'zr-meta'

export function emptyMeta(): MetaSave {
  return { v: 1, parts: {}, unlocked: [MAP_DEFS[0].id], dailyAt: null, wins: 0, winsByMap: {} }
}

// ─── Хранилище: localStorage в браузере, память в тестах и на сервере ────

let memoryStorage: Record<string, string> | null = null

function store(): Pick<Storage, 'getItem' | 'setItem'> {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  memoryStorage ??= {}
  return {
    getItem: (k) => memoryStorage![k] ?? null,
    setItem: (k, v) => {
      memoryStorage![k] = v
    },
  }
}

export function loadMeta(): MetaSave {
  const raw = store().getItem(META_KEY)
  if (!raw) return emptyMeta()
  try {
    const parsed = JSON.parse(raw) as MetaSave
    if (parsed.v !== 1) return migrate(parsed)
    // защита от битых сейвов: недостающие поля добираются пустыми
    return { ...emptyMeta(), ...parsed }
  } catch {
    return emptyMeta()
  }
}

export function saveMeta(m: MetaSave): void {
  store().setItem(META_KEY, JSON.stringify(m))
}

/** Схема пока одна; миграции появятся при изменении v */
function migrate(old: { v?: number }): MetaSave {
  return { ...emptyMeta(), ...old, v: 1 } as MetaSave
}

/** Очистка (для тестов и «сбросить прогресс») */
export function resetMeta(): void {
  store().setItem(META_KEY, JSON.stringify(emptyMeta()))
}

/** Тестам и отладке: прямое хранилище (память в Node, localStorage в браузере) */
export function rawStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  return store()
}

// ─── Лесенка карт ────────────────────────────────────────────────────────

export function isMapUnlocked(m: MetaSave, mapId: string): boolean {
  return m.unlocked.includes(mapId)
}

/** Индекс первой неоткрытой карты в реестре = сколько карт пройдено */
export function mapProgress(m: MetaSave): number {
  return m.unlocked.length
}

/**
 * Победа на карте: открывает следующую, возвращает id открытой карты или null.
 * Порядок лесенки — реестр MAP_DEFS; повторная победа ничего не открывает.
 */
export function unlockNextMap(m: MetaSave, wonMapId: string): string | null {
  const idx = MAP_DEFS.findIndex((d) => d.id === wonMapId)
  if (idx < 0) return null
  const next = MAP_DEFS[idx + 1]
  if (!next || m.unlocked.includes(next.id)) return null
  m.unlocked.push(next.id)
  return next.id
}

// ─── Бонусы башен ────────────────────────────────────────────────────────

export interface TowerMetaBonus {
  /** множитель урона (1 = нет деталей) */
  damage: number
  /** множитель интервала (<1 = быстрее) */
  cadence: number
  /** множитель дальности */
  range: number
}

/** Единицы детали с учётом капа */
export function partUnits(m: MetaSave, partId: string): number {
  const def = PART_BY_ID[partId]
  if (!def) return 0
  return Math.min(def.max, m.parts[partId] ?? 0)
}

export function towerMetaBonus(m: MetaSave, towerId: string): TowerMetaBonus {
  const out: TowerMetaBonus = { damage: 1, cadence: 1, range: 1 }
  for (const stat of Object.keys(PART_STAT_BY_ID) as PartStat[]) {
    const units = partUnits(m, `${towerId}-${stat}`)
    if (units <= 0) continue
    const step = PART_STAT_BY_ID[stat].step
    if (stat === 'damage') out.damage = 1 + units * step
    else if (stat === 'cadence') out.cadence = 1 - units * step // интервал уменьшается
    else out.range = 1 + units * step
  }
  return out
}

// ─── Сундуки: выдача ─────────────────────────────────────────────────────

export interface ChestDrop {
  chest: string
  parts: Array<{ partId: string; units: number }>
}

/** Сундук за победу: первое прохождение — гарантированный, повторы — по шансу */
export function chestForWin(m: MetaSave, wonMapId: string, rng: () => number = Math.random): ChestDrop | null {
  const first = !m.winsByMap[wonMapId]
  const chest = first ? CHESTS.firstClear : CHESTS.repeatWin
  if (rng() >= chest.chance) return null
  return { chest: chest.id, parts: rollChest(chest, rng) }
}

/** Сутки по локальному времени: дневной сундук — один в день */
export function dayKey(ts: number = Date.now()): number {
  const d = new Date(ts)
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

export function dailyReady(m: MetaSave, now: number = Date.now()): boolean {
  return m.dailyAt === null || dayKey(m.dailyAt) !== dayKey(now)
}

export function chestForDaily(m: MetaSave, rng: () => number = Math.random): ChestDrop {
  return { chest: CHESTS.daily.id, parts: rollChest(CHESTS.daily, rng) }
}

/** Вписать дроп в сейв: увеличивает единицы (кап проверяет partUnits при чтении) */
export function applyDrop(m: MetaSave, drop: ChestDrop): void {
  for (const { partId, units } of drop.parts) {
    m.parts[partId] = (m.parts[partId] ?? 0) + units
  }
}

/** Служит ли карта открытой по умолчанию (первая) — для SSR-проверок UI */
export function firstMap(): MapDef {
  return MAP_DEFS[0]
}

/** Сводка коллекции для Верстака: по каждой боевой башне — единицы и капы */
export function collectionRows(m: MetaSave): Array<{
  towerId: string
  stats: Array<{ stat: PartStat; units: number; max: number; step: number }>
}> {
  return PARTS.reduce<Array<{ towerId: string; stats: Array<{ stat: PartStat; units: number; max: number; step: number }> }>>(
    (acc, p) => {
      let row = acc.find((r) => r.towerId === p.towerId)
      if (!row) {
        row = { towerId: p.towerId, stats: [] }
        acc.push(row)
      }
      row.stats.push({ stat: p.stat, units: partUnits(m, p.id), max: p.max, step: p.step })
      return acc
    },
    []
  )
}
