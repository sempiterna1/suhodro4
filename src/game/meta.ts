// Метапрогрессия «Верстак» (docs/meta.md): сохранение, лесенка карт, бонусы башен.
// Модуль не знает про React и движок: UI читает/пишет сейв, движок получает
// бонусы через колбэк (Game.metaBonus), headless-симулятор живёт без мета —
// это базовая линия баланса.

import { MAP_DEFS, type MapDef } from './data/maps'
import { ACHIEVEMENTS, CHESTS, PART_BY_ID, PARTS, PART_STAT_BY_ID, rollChest, type AchievementCtx, type AchievementDef, type ChestDef, type PartStat } from './data/meta'

/** Ачивки читает UI из рантайм-модуля (проверка — evaluateAchievements) */
export { ACHIEVEMENTS }
import { mulberry32 } from './rng'

export interface DailyTasksSave {
  /** метка дня, к которому относятся счётчики (сутки по локальному времени) */
  at: number | null
  /** побед сегодня */
  wins: number
  /** карты, на которых сегодня была победа */
  maps: Record<string, boolean>
  /** id взятых наград за задачи дня */
  claimed: string[]
}

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
  /** задачи дня: прогресс и взятые награды (старые сейвы добираются пустыми в loadMeta) */
  daily: DailyTasksSave
  /** взятые ачивки (этап 2): сундук за каждую выдаётся один раз */
  achieved: string[]
  /** имена билдов (этап 2): towerId → название, придуманное игроком */
  builds: Record<string, string>
}

export const META_KEY = 'zr-meta'

export function emptyMeta(): MetaSave {
  return {
    v: 1,
    parts: {},
    unlocked: [MAP_DEFS[0].id],
    dailyAt: null,
    wins: 0,
    winsByMap: {},
    daily: { at: null, wins: 0, maps: {}, claimed: [] },
    achieved: [],
    builds: {},
  }
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

// ─── Задачи дня (панель «События» хаб-меню) ──────────────────────────────
// Награда за активность в сутки: победы и разнообразие карт. Прогресс живёт
// в сейве (meta.daily) и обнуляется при смене дня; награда каждой задачи —
// детерминированный ролл деталей, зависящий только от даты и задачи.

export interface DailyTaskDef {
  id: string
  goal: number
  text: string
  /** диапазон единиц деталей в награде */
  reward: [number, number]
}

export const DAILY_TASKS: DailyTaskDef[] = [
  { id: 'daily-win-1', goal: 1, text: 'Победи в одной миссии', reward: [1, 2] },
  { id: 'daily-win-2', goal: 2, text: 'Победи в двух миссиях за день', reward: [1, 2] },
  { id: 'daily-maps-2', goal: 2, text: 'Победи на двух разных картах за день', reward: [2, 3] },
]

/** Сбросить счётчики задач, если наступил новый день (мутирует сейв) */
export function ensureDailyTasks(m: MetaSave, now: number = Date.now()): void {
  if (m.daily.at === null || dayKey(m.daily.at) !== dayKey(now)) {
    m.daily = { at: now, wins: 0, maps: {}, claimed: [] }
  }
}

/** Победа сегодня на карте: двигает счётчики задач (мутирует сейв) */
export function registerWinTasks(m: MetaSave, mapId: string, now: number = Date.now()): void {
  ensureDailyTasks(m, now)
  m.daily.wins += 1
  m.daily.maps[mapId] = true
}

/** Прогресс задачи дня: 0..goal (без мутирования сейва) */
export function taskProgress(m: MetaSave, taskId: string, now: number = Date.now()): number {
  const def = DAILY_TASKS.find((t) => t.id === taskId)
  if (!def || m.daily.at === null || dayKey(m.daily.at) !== dayKey(now)) return 0
  if (taskId === 'daily-maps-2') return Math.min(def.goal, Object.keys(m.daily.maps).length)
  return Math.min(def.goal, m.daily.wins)
}

/** Награда задачи уже взята (в сегодняшних сутках)? */
export function taskClaimed(m: MetaSave, taskId: string, now: number = Date.now()): boolean {
  if (m.daily.at === null || dayKey(m.daily.at) !== dayKey(now)) return false
  return m.daily.claimed.includes(taskId)
}

/** Можно ли взять награду задачи */
export function taskClaimable(m: MetaSave, taskId: string, now: number = Date.now()): boolean {
  const def = DAILY_TASKS.find((t) => t.id === taskId)
  if (!def) return false
  return taskProgress(m, taskId, now) >= def.goal && !taskClaimed(m, taskId, now)
}

/**
 * Награда задачи: детерминированный ролл деталей — зерно зависит только от
 * дня и номера задачи, поэтому дроп не «перекатывается» между проверками.
 */
export function taskReward(taskId: string, now: number = Date.now()): ChestDrop {
  const idx = Math.max(0, DAILY_TASKS.findIndex((t) => t.id === taskId))
  const def = DAILY_TASKS[idx]
  const chest: ChestDef = { ...CHESTS.dailyTask, units: def.reward }
  return { chest: chest.id, parts: rollChest(chest, mulberry32(dayKey(now) * 131 + idx)) }
}

/** Взять награду задачи: отмечает в сейве и возвращает дроп (null — нельзя взять) */
export function claimTask(m: MetaSave, taskId: string, now: number = Date.now()): ChestDrop | null {
  ensureDailyTasks(m, now)
  if (!taskClaimable(m, taskId, now)) return null
  m.daily.claimed.push(taskId)
  return taskReward(taskId, now)
}

// ─── Ачивки (этап 2): одноразовые сундуки за подвиги ─────────────────────
// Каждая ачивка берётся один раз; сундук за неё выдаётся единожды при
// первом выполнении. Проверка — по итогам миссии и сейву (см. AchievementCtx).

export function isAchieved(m: MetaSave, achId: string): boolean {
  return m.achieved.includes(achId)
}

/**
 * Проверить ачивки по итогам миссии: новые вписывает в сейв (одноразово)
 * и возвращает их определения — за каждую роллится сундук.
 */
export function evaluateAchievements(m: MetaSave, ctx: AchievementCtx): AchievementDef[] {
  const fresh = ACHIEVEMENTS.filter((a) => !m.achieved.includes(a.id) && a.check(ctx))
  m.achieved.push(...fresh.map((a) => a.id))
  return fresh
}

/** Сундук за ачивку: ролл по диапазону награды этой ачивки */
export function chestForAchievement(a: AchievementDef, rng: () => number = Math.random): ChestDrop {
  const chest: ChestDef = { ...CHESTS.achievement, units: a.reward }
  return { chest: chest.id, parts: rollChest(chest, rng) }
}

// ─── Имена билдов (этап 2): игрок называет свою сборку башни ─────────────

/** Имя билда башни, придуманное игроком (null — не названа) */
export function buildName(m: MetaSave, towerId: string): string | null {
  return m.builds[towerId] ?? null
}

/** Задать имя билда (пустая строка/null — сбросить); хранится до 24 символов */
export function setBuildName(m: MetaSave, towerId: string, name: string | null): void {
  const clean = (name ?? '').trim()
  if (clean) m.builds[towerId] = clean.slice(0, 24)
  else delete m.builds[towerId]
}
