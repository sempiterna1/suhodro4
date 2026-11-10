// Headless-симулятор миссии «Последний горизонт» (этап 1).
// Без рендера, React и DOM: одна и та же игра прогоняется с фиксированным зерном,
// политикой игрока и выдаёт отчёт по волнам + журнал событий.
//
// Политики:
//   none     — игрок ничего не делает (базовая линия «без башен»);
//   random   — случайная застройка/прокачка/слияния (детерминированная по seed);
//   scripted — «разумный игрок»: пара башен под слияние, прокачка до 3, слияние,
//              затем следующая пара; способность и аватар используются.
//
// Модуль не знает про файлы и CLI — это делает scripts/sim.ts.

import { Game, findRecipe } from './engine'
import { ALL_DEFS, defFootprint } from './data/towers'
import { ALL_ITEMS, ITEM_SLOTS_TOTAL } from './data/items'
import { CELL, MAP_DEFS, MAP_H, MAP_W, MERGE_DIST, type MapDef } from './data/maps'
import { FIRST_PREVIEW_TIME, MAX_LEVEL, MERGE_MIN_LEVEL, PREVIEW_TIME, ROLL_COST } from './data/economy'
import { TOTAL_WAVES, WAVES, armorsForWave } from './data/waves'
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type DifficultyId } from './data/difficulties'
import { mulberry32, randInt } from './rng'
import { pathLength, pointAtLength } from './map'
import type { AvatarId } from './data/avatars'
import type { ArmorType, GameEvent, GameStats, Tower, Vec } from './types'

export type SimPolicyId = 'none' | 'random' | 'scripted'
export type SimOutcome = 'won' | 'lost' | 'waveLimit' | 'timeout'

export interface SimOptions {
  seed?: number
  mapId?: string
  policy?: SimPolicyId
  /** all — все башни открыты (лаборатория баланса); pool — случайный арсенал с роллами */
  shop?: 'all' | 'pool'
  /** Сложность миссии: Новобранец / Ветеран / Кошмар */
  difficulty?: DifficultyId
  coop?: boolean
  avatarId?: AvatarId
  /** Шаг симуляции, с (не больше 0.05 — ограничение движка) */
  dt?: number
  /** Предохранитель по боевому времени, с */
  maxSeconds?: number
  /** Остановиться после N волн (для тестов); по умолчанию вся миссия */
  maxWaves?: number
}

export interface SimWaveRow {
  wave: number
  kind: string
  /** Типы брони волны: «light» или «light+heavy» */
  armor: string
  armors: ArmorType[]
  planned: number
  spawned: number
  killed: number
  leaked: number
  /** Урон, нанесённый главному зданию за волну */
  buildingDamage: number
  damage: number
  dps: number
  duration: number
  goldStart: number
  goldEnd: number
  goldEarned: number
  towerCount: number
  built: number
  upgrades: number
  merges: number
  sells: number
  bossPhases: string[]
  completed: boolean
}

export interface SimTowerUsage {
  name: string
  built: number
  upgrades: number
  merges: number
  sells: number
  surviving: number
  maxLevel: number
}

export interface SimReport {
  seed: number
  policy: SimPolicyId
  difficulty: DifficultyId
  difficultyName: string
  map: { id: string; name: string; seed: number }
  shop: 'all' | 'pool'
  coop: boolean
  avatarId: AvatarId
  dt: number
  outcome: SimOutcome
  wavesCompleted: number
  totalWaves: number
  waves: SimWaveRow[]
  combatSeconds: number
  /** Боевое время + паузы между волнами (первая и последующие — из economy.ts) */
  estimatedMissionSeconds: number
  gold: number
  buildingHp: number
  buildingMaxHp: number
  stats: GameStats
  towerUsage: Record<string, SimTowerUsage>
  events: GameEvent[]
}

interface WaveRun {
  wave: number
  def: (typeof WAVES)[number]
  armors: ArmorType[]
  planned: number
  startTime: number
  startGold: number
  startBuildingHp: number
  startStats: GameStats
  eventIndex: number
}

interface Policy {
  beforeWave: (g: Game) => void
  tick: (g: Game, dt: number) => void
}

const AVATAR_IDS: AvatarId[] = ['hunter', 'voevoda', 'archmage', 'engineer']

const round2 = (n: number) => Math.round(n * 100) / 100

// ─── Кандидаты под застройку ─────────────────────────────────────────────

interface PlacementHelper {
  samples: Vec[]
  cells: Vec[]
}

function samplePolyline(points: Vec[], step = 20): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

function placementHelper(g: Game): PlacementHelper {
  // Все тропы карты, включая ещё не открытый второй выход: башни должны
  // прикрывать его заранее, иначе после 16-й волны половина карты пустая.
  const map = g.map
  const samples = samplePolyline(map.points)
  if (map.points2) samples.push(...samplePolyline(map.points2))
  const cells: Vec[] = []
  for (let cy = 0; cy < MAP_H / CELL; cy++) {
    for (let cx = 0; cx < MAP_W / CELL; cx++) cells.push({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 })
  }
  return { samples, cells }
}

function coverage(h: PlacementHelper, p: Vec, range: number): number {
  let n = 0
  for (const s of h.samples) if (Math.hypot(s.x - p.x, s.y - p.y) <= range) n++
  return n
}

/** Свободные клетки с покрытием тропы, лучшие — первыми */
function rankedCells(g: Game, h: PlacementHelper, range: number): Array<Vec & { score: number }> {
  const out: Array<Vec & { score: number }> = []
  for (const c of h.cells) {
    if (g.canPlace(c.x, c.y) !== null) continue
    const score = coverage(h, c, range)
    if (score > 0) out.push({ ...c, score })
  }
  out.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x)
  return out
}

/** Все валидные места-якоря (для не бьющих построек: экономика с range 0 не имеет «лучших» клеток) */
function freeAnchors(g: Game, h: PlacementHelper, fp = 1): Vec[] {
  return h.cells.filter((c) => g.canPlace(c.x, c.y, fp) === null)
}

/** Индекс копии defId в руке: покупаем, только если карточка лежит в пуле (одна карточка на ролл) */
function ensureHand(g: Game, defId: string): number {
  const idx = g.hand.indexOf(defId)
  if (idx >= 0) return idx
  if (!g.buy(defId).ok) return -1
  return g.hand.length - 1
}

function buildFromHand(g: Game, defId: string, x: number, y: number): Tower | null {
  // покупка → руки → установка: новая механика (прокачка/постройка только из руки)
  const idx = ensureHand(g, defId)
  if (idx < 0) return null
  const res = g.placeFromHand(idx, x, y)
  if (res.ok && res.towerId) return g.towerById(res.towerId) ?? null
  return null // копия остаётся в руке — пригодится при следующей попытке
}

function buildBest(g: Game, defId: string, h: PlacementHelper): Tower | null {
  const def = ALL_DEFS[defId]
  if (!def || g.gold < def.price) return null
  // экономические постройки не покрывают тропу (range 0) — ставим в любое свободное место
  const cells = def.range > 0 ? rankedCells(g, h, def.range) : freeAnchors(g, h, defFootprint(def))
  for (const c of cells) {
    const tw = buildFromHand(g, defId, c.x, c.y)
    if (tw) return tw
  }
  return null
}

function buildNear(g: Game, defId: string, anchor: Tower, h: PlacementHelper, maxDist = MERGE_DIST - 12): Tower | null {
  const def = ALL_DEFS[defId]
  if (!def || g.gold < def.price) return null
  const cells = rankedCells(g, h, def.range).filter(
    (c) => Math.hypot(c.x - anchor.x, c.y - anchor.y) <= maxDist
  )
  for (const c of cells) {
    const tw = buildFromHand(g, defId, c.x, c.y)
    if (tw) return tw
  }
  return null
}

function findBase(g: Game, defId: string): Tower | undefined {
  return g.towers.find((t) => t.defId === defId)
}

/** Прокачка башни копией из руки: копия покупается, только если карточка в пуле */
function levelUp(g: Game, t: Tower): boolean {
  const idx = ensureHand(g, t.defId)
  if (idx < 0) return false
  return g.levelFromHand(idx, t.id).ok
}

/** Слить любую готовую пару (3+ уровня, рецепт и дистанция уже проверяются движком) */
function mergeAny(g: Game): boolean {
  for (const t of [...g.towers]) {
    if (t.level < MERGE_MIN_LEVEL) continue
    const targets = g.mergeTargetsFor(t.id)
    if (targets.length === 0) continue
    if (g.merge(t.id, targets[0]).ok) return true
  }
  return false
}

/** Подтащить одну из башен пары к другой (перенос бесплатный, но один раз на башню) */
function moveCloser(g: Game, a: Tower, b: Tower, h: PlacementHelper): boolean {
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    if (from.moved) continue
    const cells = rankedCells(g, h, ALL_DEFS[from.defId].range).filter(
      (c) => Math.hypot(c.x - to.x, c.y - to.y) <= MERGE_DIST - 12
    )
    for (const c of cells) {
      if (g.moveTower(from.id, c.x, c.y).ok) return true
    }
  }
  return false
}

// ─── Политика «ничего не делаем» ─────────────────────────────────────────

const nonePolicy: Policy = { beforeWave: () => {}, tick: () => {} }

// ─── Случайная политика ──────────────────────────────────────────────────

function makeRandomPolicy(seed: number): Policy {
  const rng = mulberry32((seed ^ 0x51ed270b) >>> 0)
  return {
    beforeWave(g) {
      const h = placementHelper(g)
      for (let step = 0; step < 40; step++) {
        const canBuild = g.shop.some((id) => ALL_DEFS[id] && g.gold >= ALL_DEFS[id].price)
        const mergeables = g.towers.filter((t) => t.level >= MERGE_MIN_LEVEL && g.mergeTargetsFor(t.id).length > 0)
        const upgradables = g.towers.filter((t) => t.level < MAX_LEVEL && g.gold >= ALL_DEFS[t.defId].price)

        if (g.towers.length < 3 && canBuild) {
          if (randomBuild(g, h, rng)) continue
        }
        const roll = rng()
        if (mergeables.length && roll < 0.18) {
          const t = mergeables[randInt(rng, mergeables.length)]
          g.merge(t.id, g.mergeTargetsFor(t.id)[0])
          continue
        }
        if (upgradables.length && roll < 0.45) {
          const t = upgradables[randInt(rng, upgradables.length)]
          levelUp(g, t)
          continue
        }
        if (canBuild) {
          if (randomBuild(g, h, rng)) continue
        }
        if (g.gold >= 10 && rng() < 0.25) {
          if (g.roll().ok) continue
        }
        break
      }
    },
    tick(g) {
      if (g.creeps.length > 0 && g.avatar.cooldown <= 0) g.useAbility()
    },
  }
}

function randomBuild(g: Game, h: PlacementHelper, rng: () => number): boolean {
  const affordable = g.shop.filter((id) => ALL_DEFS[id] && g.gold >= ALL_DEFS[id].price)
  if (affordable.length === 0) return false
  const defId = affordable[randInt(rng, affordable.length)]
  const cells = rankedCells(g, h, ALL_DEFS[defId].range)
  if (cells.length === 0) return false
  // немного случайности: не всегда лучшая клетка
  const pick = cells[Math.min(cells.length - 1, randInt(rng, Math.min(6, cells.length)))]
  return !!buildFromHand(g, defId, pick.x, pick.y)
}

// ─── Скриптовая политика «разумного игрока» ──────────────────────────────

/** Пары башен в порядке приоритета: дешёвая, затем площадь, контроль, поддержка */
const PAIR_PLAN: Array<[string, string]> = [
  ['archer', 'pyro'], // Огненная лучница
  ['catapult', 'pyro'], // Вулкан
  ['mauler', 'chrono'], // Страж времени
  ['frost', 'pyro'], // Паровой котёл
  ['mortar', 'lightning'], // Грозовая мортира
  ['sentry', 'mech_guard'], // Бастион
  ['hunter', 'frost'], // Морозный ловчий
  ['crossbow', 'lightning'], // Громовой арбалет
  ['ballista', 'golem'], // Осадная машина
  ['prism', 'chrono'], // Призма вечности
  ['archer', 'mech_guard'], // Автоматический арсенал
  ['catapult', 'golem'], // Каменный титан
]

function makeScriptedPolicy(shopAll = false): Policy {
  const skipped = new Set<number>()
  // Режим «весь арсенал»: эконом-карты считаются всегда доступными
  const availAll = shopAll
  let lastAvatarOrder = -100
  let lastHelper: PlacementHelper | null = null
  let lastHelperSeed = -1

  const helper = (g: Game): PlacementHelper => {
    if (!lastHelper || lastHelperSeed !== g.mapSeed) {
      lastHelper = placementHelper(g)
      lastHelperSeed = g.mapSeed
    }
    return lastHelper
  }

  const activePair = (g: Game): number => {
    // Пара «активна», если обе половины уже есть (поле или рука): работаем над ней в первую очередь
    for (let i = 0; i < PAIR_PLAN.length; i++) {
      if (skipped.has(i)) continue
      const recipe = findRecipe(PAIR_PLAN[i][0], PAIR_PLAN[i][1])
      if (!recipe || g.towers.some((t) => t.defId === recipe.id)) continue
      const [da, db] = PAIR_PLAN[i]
      const have = (id: string) => !!findBase(g, id) || g.hand.includes(id)
      if (have(da) && have(db)) return i
    }
    // Иначе — первая пара, у которой есть хоть какой-то след (поле/рука/пул): начинаем её собирать
    for (let i = 0; i < PAIR_PLAN.length; i++) {
      if (skipped.has(i)) continue
      const recipe = findRecipe(PAIR_PLAN[i][0], PAIR_PLAN[i][1])
      if (!recipe || g.towers.some((t) => t.defId === recipe.id)) continue
      const [da, db] = PAIR_PLAN[i]
      if (
        findBase(g, da) || findBase(g, db) ||
        g.hand.includes(da) || g.hand.includes(db) ||
        g.shop.includes(da) || g.shop.includes(db)
      ) return i
    }
    return -1
  }

  const upgradeStep = (g: Game, h: PlacementHelper): boolean => {
    const idx = activePair(g)
    if (idx >= 0) {
      const [da, db] = PAIR_PLAN[idx]
      const a = findBase(g, da)
      const b = findBase(g, db)
      const pending = [a, b].filter((t): t is Tower => !!t && t.level < MERGE_MIN_LEVEL)
      pending.sort((x, y) => x.level - y.level || x.id - y.id)
      for (const t of pending) {
        if (g.gold >= ALL_DEFS[t.defId].price && levelUp(g, t)) return true
      }
    }
    // Слитые башни — главный источник урона, качаем их после сборки пары
    const merged = g.towers.filter((t) => ALL_DEFS[t.defId].merged && t.level < MAX_LEVEL)
    merged.sort((a, b) => b.level - a.level || a.id - b.id)
    for (const t of merged) {
      if (g.gold >= ALL_DEFS[t.defId].price && levelUp(g, t)) return true
    }
    // Базовые башни вне текущей пары — не выше 3, чтобы не терять уровни при слиянии
    const base = g.towers.filter((t) => !ALL_DEFS[t.defId].merged && t.level < MERGE_MIN_LEVEL)
    base.sort((a, b) => a.level - b.level || a.id - b.id)
    for (const t of base) {
      if (g.gold >= ALL_DEFS[t.defId].price && levelUp(g, t)) return true
    }
    if (activePair(g) < 0) {
      const rest = g.towers.filter((t) => t.level < MAX_LEVEL)
      rest.sort((a, b) => b.level - a.level || a.id - b.id)
      for (const t of rest) {
        if (g.gold >= ALL_DEFS[t.defId].price && levelUp(g, t)) return true
      }
    }
    return false
  }

  const planStep = (g: Game, h: PlacementHelper): boolean => {
    const idx = activePair(g)
    if (idx < 0) return false
    const [da, db] = PAIR_PLAN[idx]
    const a = findBase(g, da)
    const b = findBase(g, db)
    if (a && b) {
      if (Math.hypot(a.x - b.x, a.y - b.y) > MERGE_DIST) {
        if (moveCloser(g, a, b, h)) return true
        skipped.add(idx)
        return true
      }
      return false // ждём прокачки до 3
    }
    if (a && !b) {
      const def = ALL_DEFS[db]
      const upCost = ALL_DEFS[a.defId].price
      // Если напарник пока не по карману вместе с прокачкой — сначала усиливаем
      // уже стоящую башню: один L3 держит ранние волны лучше двух L1.
      if (a.level < MERGE_MIN_LEVEL && g.gold < def.price + upCost && g.gold >= upCost) {
        if (levelUp(g, a)) return true
      }
      if (g.gold < def.price) return false
      if (buildNear(g, db, a, h)) return true
      skipped.add(idx)
      return true
    }
    if (!a && b) {
      const def = ALL_DEFS[da]
      const upCost = ALL_DEFS[b.defId].price
      if (b.level < MERGE_MIN_LEVEL && g.gold < def.price + upCost && g.gold >= upCost) {
        if (levelUp(g, b)) return true
      }
      if (g.gold < def.price) return false
      if (buildNear(g, da, b, h)) return true
      skipped.add(idx)
      return true
    }
    const def = ALL_DEFS[da]
    if (g.gold < def.price) return false
    if (buildBest(g, da, h)) return true
    skipped.add(idx)
    return true
  }

  const extraStep = (g: Game, h: PlacementHelper): boolean => {
    // Оборона важнее плана: пока башен мало, строим любое доступное из пула
    if (activePair(g) >= 0 && g.towers.length >= 5) return false
    if (g.towers.length < 12) {
      const affordable = g.shop
        .filter((id) => ALL_DEFS[id] && g.gold >= ALL_DEFS[id].price)
        .sort((a, b) => ALL_DEFS[b].price - ALL_DEFS[a].price)
      for (const id of affordable) if (buildBest(g, id, h)) return true
    }
    return false
  }

  // ─── Фарм-политика (этап 3): деньги должны работать — шахты, бур, лавка ───
  // Оборона всегда первична (шаг ставится после plan/upgrade/extra), у
  // экономических свои потолок и «врата по волне»: пока золота мало,
  // оно идёт в урон, не в экономику.
  const ECON_PLAN = [
    { id: 'mine', gateWave: 11, cap: 2, buffer: 150 }, // шахта — излишек в эссенцию для лавки (после boss-10)
    { id: 'sluice', gateWave: 11, cap: 1, buffer: 150 }, // стан — золотой дифференциал
    { id: 'deep_drill', gateWave: 13, cap: 1, buffer: 300 }, // 4 клетки и 160 — большая ставка на экономику
  ]
  const econStep = (g: Game, h: PlacementHelper): boolean => {
    // Оборона первична: экономику не строим, пока не выстроен каркас башен
    // (тот же порог, что у добивки extraStep) и не прошли ранние волны
    if (g.towers.length < 5) return false
    for (const w of ECON_PLAN) {
      const have = g.towers.filter((t) => t.defId === w.id).length
      if (have >= w.cap || g.wave < w.gateWave) continue
      const price = ALL_DEFS[w.id]?.price ?? 0
      // В режиме all («весь арсенал») эконом-карты доступны всегда: роллимый
      // пул заменяет их при открытии с вероятностью ~2.4% на карточку, что
      // не должно калечить экономическую стратегию в симуляторе.
      if (g.gold < price + w.buffer || !(availAll || g.shop.includes(w.id))) continue
      const built = buildBest(g, w.id, h)
      if (built || g.hand.includes(w.id)) return true
      // постановка может не удаться (нет валидного блока 2×2) — копия в руке ждёт
      return g.hand.includes(w.id)
    }
    return false
  }

  // Лавка предметов: весь излишек эссенции конвертируется в экипировку.
  // Берём самое дорогое доступное (ценность предмета растёт с ценой), редкие
  // версии просто покупаются дальше как обычные — их сила уже в цене.
  const itemStep = (g: Game): boolean => {
    if (g.items.length >= ITEM_SLOTS_TOTAL || g.itemShop.length === 0) return false
    const affordable = g.itemShop
      .map((o, idx) => ({ idx, def: ALL_ITEMS[o.id] }))
      .filter((o) => !!o.def && g.essence >= o.def.price)
    if (affordable.length === 0) return false
    affordable.sort((a, b) => b.def!.price - a.def!.price)
    return g.buyItem(affordable[0].idx).ok
  }

  // Карточка одна на пул: если нужной пары нет ни в пуле, ни в руке — роллим.
  // Как живой игрок: ищем нужные башни прокруткой магазина. Но только когда
  // оборона уже стоит (башен ≥ 3) и осталось золото и на ролл, и на карточку.
  let rollsLeft = 0
  const maybeRollForPlan = (g: Game): boolean => {
    if (rollsLeft <= 0 || g.towers.length < 3) return false
    const idx = activePair(g)
    if (idx < 0) return false
    for (const id of PAIR_PLAN[idx]) {
      if (g.hand.includes(id) || g.shop.includes(id)) continue
      if (g.gold < ROLL_COST + ALL_DEFS[id].price) continue
      rollsLeft--
      return g.roll().ok
    }
    return false
  }

  // Припасти копии уже стоящих родителей активной пары: карточка одна на ролл,
  // так что выгодно брать её сразу — прокачка потом использует копию из руки.
  const stockpileStep = (g: Game): boolean => {
    const idx = activePair(g)
    if (idx < 0) return false
    for (const id of PAIR_PLAN[idx]) {
      const onField = findBase(g, id)
      if (!onField) continue // первую копию сразу ставит planStep
      const inHand = g.hand.filter((h) => h === id).length
      if (inHand >= MAX_LEVEL - onField.level) continue // копий хватает
      if (g.gold >= ALL_DEFS[id].price + ROLL_COST && g.shop.includes(id)) return g.buy(id).ok
    }
    return false
  }

  return {
    beforeWave(g) {
      const h = helper(g)
      rollsLeft = 4
      // Слияния бесплатны — делаем их сразу
      for (let i = 0; i < 30 && mergeAny(g); i++) {}
      for (let step = 0; step < 200; step++) {
        if (mergeAny(g)) continue
        // оборонный каркас и прокачка первыми; экономика после них — берёт то,
        // что план не потратил, но раньше запаса копий и добивки поля: иначе
        // stockpile скупает все излишки, а к концу миссии не остаётся клеток
        if (planStep(g, h)) continue
        if (upgradeStep(g, h)) continue
        if (econStep(g, h)) continue
        if (extraStep(g, h)) continue
        if (stockpileStep(g)) continue
        if (maybeRollForPlan(g)) continue
        if (itemStep(g)) continue
        break
      }
    },
    tick(g, _dt) {
      if (g.creeps.length > 0) {
        // Аватар идёт за передним крипом и бьёт способностью по готовности
        if (g.time - lastAvatarOrder > 1.5) {
          const lead = g.creeps.reduce((a, b) =>
            b.dist / pathLength(b.pathIdx) > a.dist / pathLength(a.pathIdx) ? b : a
          )
          const p = pointAtLength(Math.min(pathLength(lead.pathIdx) - 30, lead.dist + 50), lead.pathIdx)
          g.moveAvatar(p)
          lastAvatarOrder = g.time
        }
        if (g.avatar.cooldown <= 0) g.useAbility()
      }
    },
  }
}

function makePolicy(id: SimPolicyId, seed: number, shopAll = false): Policy {
  if (id === 'none') return nonePolicy
  if (id === 'random') return makeRandomPolicy(seed)
  return makeScriptedPolicy(shopAll)
}

// ─── Прогон миссии ───────────────────────────────────────────────────────

function liveStats(g: Game): GameStats {
  return { ...g.stats }
}

function recordWave(run: WaveRun, g: Game, completed: boolean): SimWaveRow {
  const ev = g.events.slice(run.eventIndex)
  const duration = Math.max(0, g.time - run.startTime)
  const damage = g.stats.damageDealt - run.startStats.damageDealt
  const killed = g.stats.kills - run.startStats.kills
  const leaked = g.stats.leaked - run.startStats.leaked
  const ui = g.getUiState()
  return {
    wave: run.wave,
    kind: run.def.kind,
    armor: run.armors.join('+'),
    armors: [...run.armors],
    planned: run.planned,
    spawned: ui.waveSpawned,
    killed,
    leaked,
    buildingDamage: run.startBuildingHp - g.buildingHp,
    damage: round2(damage),
    dps: round2(duration > 0 ? damage / duration : 0),
    duration: round2(duration),
    goldStart: run.startGold,
    goldEnd: g.gold,
    goldEarned: g.stats.goldEarned - run.startStats.goldEarned,
    towerCount: g.towers.length,
    built: ev.filter((e) => e.type === 'build').length,
    upgrades: ev.filter((e) => e.type === 'upgrade').length,
    merges: ev.filter((e) => e.type === 'merge').length,
    sells: ev.filter((e) => e.type === 'sell').length,
    bossPhases: ev.filter((e) => e.type === 'bossPhase').map((e) => e.text ?? 'фаза'),
    completed,
  }
}

function towerUsage(g: Game): Record<string, SimTowerUsage> {
  const usage: Record<string, SimTowerUsage> = {}
  const take = (defId: string): SimTowerUsage | null => {
    const def = ALL_DEFS[defId]
    if (!def) return null
    const u = (usage[defId] ??= {
      name: def.name,
      built: 0,
      upgrades: 0,
      merges: 0,
      sells: 0,
      surviving: 0,
      maxLevel: 0,
    })
    return u
  }
  for (const e of g.events) {
    if (!e.defId) continue
    const u = take(e.defId)
    if (!u) continue
    if (e.type === 'build') u.built++
    else if (e.type === 'upgrade') {
      u.upgrades++
      u.maxLevel = Math.max(u.maxLevel, e.level ?? 0)
    } else if (e.type === 'merge') {
      u.merges++
      u.maxLevel = Math.max(u.maxLevel, e.level ?? 0)
    } else if (e.type === 'sell') u.sells++
  }
  for (const t of g.towers) {
    const u = take(t.defId)
    if (!u) continue
    u.surviving++
    u.maxLevel = Math.max(u.maxLevel, t.level)
  }
  return usage
}

export function runSimulation(opts: SimOptions = {}): SimReport {
  const seed = opts.seed ?? 20261029
  const policyId = opts.policy ?? 'scripted'
  const map: MapDef = MAP_DEFS.find((m) => m.id === (opts.mapId ?? 'tract')) ?? MAP_DEFS[0]
  const shop = opts.shop ?? 'all'
  const difficulty = opts.difficulty ?? DEFAULT_DIFFICULTY
  if (!DIFFICULTIES[difficulty]) throw new Error(`Неизвестная сложность: ${difficulty}`)
  const coop = opts.coop ?? false
  const avatarId = opts.avatarId ?? 'hunter'
  if (!AVATAR_IDS.includes(avatarId)) throw new Error(`Неизвестный аватар: ${avatarId}`)
  const dt = Math.max(1 / 240, Math.min(0.05, opts.dt ?? 1 / 30))
  const maxSeconds = opts.maxSeconds ?? 3 * 60 * 60
  const maxWaves = Math.max(1, Math.min(TOTAL_WAVES, opts.maxWaves ?? TOTAL_WAVES))
  const policy = makePolicy(policyId, seed, shop === 'all')
  const diff = DIFFICULTIES[difficulty]

  const g = new Game(seed)
  if (!g.setDifficulty(difficulty).ok) throw new Error(`Сложность ${difficulty} недоступна`)
  g.selectMap(map.seed)
  g.setCoop(coop)
  g.setAvatar(avatarId)
  if (shop === 'all') g.unlockAllTowers()
  g.beginPreview()

  const waves: SimWaveRow[] = []
  let current: WaveRun | null = null
  let outcome: SimOutcome = 'timeout'

  const stop = (res: SimOutcome) => {
    outcome = res
    if (current) {
      waves.push(recordWave(current, g, false))
      current = null
    }
  }

  while (true) {
    if (g.phase === 'won') {
      outcome = 'won'
      break
    }
    if (g.phase === 'over') {
      outcome = 'lost'
      break
    }
    if (g.phase === 'intro') {
      g.beginPreview()
      continue
    }
    if (g.phase === 'preview') {
      if (g.wave > maxWaves) {
        outcome = 'waveLimit'
        break
      }
      policy.beforeWave(g)
      const def = WAVES[g.wave - 1]
      const run: WaveRun = {
        wave: g.wave,
        def,
        armors: armorsForWave(def, diff.mixedWavesFrom),
        planned: 0,
        startTime: g.time,
        startGold: g.gold,
        startBuildingHp: g.buildingHp,
        startStats: liveStats(g),
        eventIndex: g.events.length,
      }
      g.startWave()
      run.planned = g.getUiState().waveTotal
      current = run
      continue
    }
    // phase === 'wave'
    policy.tick(g, dt)
    g.update(dt)
    if (current && g.phase !== 'wave') {
      waves.push(recordWave(current, g, g.phase !== 'over'))
      current = null
    }
    if (g.time > maxSeconds) {
      stop('timeout')
      break
    }
  }

  if (current) waves.push(recordWave(current, g, false))
  const combatSeconds = waves.reduce((s, w) => s + w.duration, 0)
  // Первая пауза и каждая следующая — как в игре (симулятор их пропускает)
  const estimatedMissionSeconds =
    combatSeconds +
    (waves.length > 0 ? FIRST_PREVIEW_TIME + Math.max(0, waves.length - 1) * PREVIEW_TIME : 0)

  return {
    seed,
    policy: policyId,
    difficulty,
    difficultyName: diff.name,
    map: { id: map.id, name: map.name, seed: map.seed },
    shop,
    coop,
    avatarId,
    dt,
    outcome,
    wavesCompleted: waves.filter((w) => w.completed).length,
    totalWaves: TOTAL_WAVES,
    waves,
    combatSeconds: round2(combatSeconds),
    estimatedMissionSeconds: round2(estimatedMissionSeconds),
    gold: g.gold,
    buildingHp: g.buildingHp,
    buildingMaxHp: g.buildingMaxHp,
    stats: { ...g.stats },
    towerUsage: towerUsage(g),
    events: g.events.map((e) => ({ ...e })),
  }
}

/** Человекочитаемая метка результата */
export function outcomeLabel(outcome: SimOutcome): string {
  return outcome === 'won'
    ? 'победа'
    : outcome === 'lost'
      ? 'поражение'
      : outcome === 'timeout'
        ? 'таймаут'
        : 'лимит волн'
}
