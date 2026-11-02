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

import { Game, findRecipe, upgradeCost } from './engine'
import { ALL_DEFS } from './data/towers'
import { CELL, MAP_DEFS, MAP_H, MAP_W, MERGE_DIST, type MapDef } from './data/maps'
import { MAX_LEVEL, MERGE_MIN_LEVEL } from './data/economy'
import { TOTAL_WAVES, WAVES } from './data/waves'
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
  armor: ArmorType
  planned: number
  spawned: number
  killed: number
  leaked: number
  livesLost: number
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
  /** Боевое время + паузы между волнами (12 с перед первой, 20 с перед остальными) */
  estimatedMissionSeconds: number
  gold: number
  lives: number
  stats: GameStats
  towerUsage: Record<string, SimTowerUsage>
  events: GameEvent[]
}

interface WaveRun {
  wave: number
  def: (typeof WAVES)[number]
  planned: number
  startTime: number
  startGold: number
  startLives: number
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

interface PlacementHelper {
  samples: Vec[]
  cells: Vec[]
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

function buildBest(g: Game, defId: string, h: PlacementHelper): Tower | null {
  const def = ALL_DEFS[defId]
  if (!def || g.gold < def.price) return null
  const cells = rankedCells(g, h, def.range)
  for (const c of cells) {
    const res = g.build(c.x, c.y, defId)
    if (res.ok && res.towerId) return g.towerById(res.towerId) ?? null
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
    const res = g.build(c.x, c.y, defId)
    if (res.ok && res.towerId) return g.towerById(res.towerId) ?? null
  }
  return null
}

function findBase(g: Game, defId: string): Tower | undefined {
  return g.towers.find((t) => t.defId === defId)
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
        const upgradables = g.towers.filter((t) => t.level < MAX_LEVEL && g.gold >= upgradeCost(ALL_DEFS[t.defId]))

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
          g.upgrade(t.id)
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
  return g.build(pick.x, pick.y, defId).ok
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

function makeScriptedPolicy(): Policy {
  const skipped = new Set<number>()
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
    for (let i = 0; i < PAIR_PLAN.length; i++) {
      if (skipped.has(i)) continue
      const recipe = findRecipe(PAIR_PLAN[i][0], PAIR_PLAN[i][1])
      if (!recipe) continue
      if (!g.towers.some((t) => t.defId === recipe.id)) return i
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
        const cost = upgradeCost(ALL_DEFS[t.defId])
        if (g.gold >= cost && g.upgrade(t.id).ok) return true
      }
    }
    // Слитые башни — главный источник урона, качаем их после сборки пары
    const merged = g.towers.filter((t) => ALL_DEFS[t.defId].merged && t.level < MAX_LEVEL)
    merged.sort((a, b) => b.level - a.level || a.id - b.id)
    for (const t of merged) {
      const cost = upgradeCost(ALL_DEFS[t.defId])
      if (g.gold >= cost && g.upgrade(t.id).ok) return true
    }
    // Базовые башни вне текущей пары — не выше 3, чтобы не терять уровни при слиянии
    const base = g.towers.filter((t) => !ALL_DEFS[t.defId].merged && t.level < MERGE_MIN_LEVEL)
    base.sort((a, b) => a.level - b.level || a.id - b.id)
    for (const t of base) {
      const cost = upgradeCost(ALL_DEFS[t.defId])
      if (g.gold >= cost && g.upgrade(t.id).ok) return true
    }
    if (activePair(g) < 0) {
      const rest = g.towers.filter((t) => t.level < MAX_LEVEL)
      rest.sort((a, b) => b.level - a.level || a.id - b.id)
      for (const t of rest) {
        const cost = upgradeCost(ALL_DEFS[t.defId])
        if (g.gold >= cost && g.upgrade(t.id).ok) return true
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
      if (g.gold < def.price) return false
      if (buildNear(g, db, a, h)) return true
      skipped.add(idx)
      return true
    }
    if (!a && b) {
      const def = ALL_DEFS[da]
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
    if (activePair(g) >= 0) return false
    if (g.towers.length < 12) {
      const affordable = g.shop
        .filter((id) => ALL_DEFS[id] && g.gold >= ALL_DEFS[id].price)
        .sort((a, b) => ALL_DEFS[b].price - ALL_DEFS[a].price)
      for (const id of affordable) if (buildBest(g, id, h)) return true
    }
    return false
  }

  return {
    beforeWave(g) {
      const h = helper(g)
      // Слияния бесплатны — делаем их сразу
      for (let i = 0; i < 30 && mergeAny(g); i++) {}
      for (let step = 0; step < 200; step++) {
        if (mergeAny(g)) continue
        if (planStep(g, h)) continue
        if (upgradeStep(g, h)) continue
        if (extraStep(g, h)) continue
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

function makePolicy(id: SimPolicyId, seed: number): Policy {
  if (id === 'none') return nonePolicy
  if (id === 'random') return makeRandomPolicy(seed)
  return makeScriptedPolicy()
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
    armor: run.def.armor,
    planned: run.planned,
    spawned: ui.waveSpawned,
    killed,
    leaked,
    livesLost: run.startLives - g.lives,
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
  const coop = opts.coop ?? false
  const avatarId = opts.avatarId ?? 'hunter'
  if (!AVATAR_IDS.includes(avatarId)) throw new Error(`Неизвестный аватар: ${avatarId}`)
  const dt = Math.max(1 / 240, Math.min(0.05, opts.dt ?? 1 / 30))
  const maxSeconds = opts.maxSeconds ?? 3 * 60 * 60
  const maxWaves = Math.max(1, Math.min(TOTAL_WAVES, opts.maxWaves ?? TOTAL_WAVES))
  const policy = makePolicy(policyId, seed)

  const g = new Game(seed)
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
      const run: WaveRun = {
        wave: g.wave,
        def: WAVES[g.wave - 1],
        planned: 0,
        startTime: g.time,
        startGold: g.gold,
        startLives: g.lives,
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
  // Первая пауза 12 с, каждая следующая — 20 с (даже если симулятор их пропускает)
  const estimatedMissionSeconds =
    combatSeconds + (waves.length > 0 ? 12 + Math.max(0, waves.length - 1) * 20 : 0)

  return {
    seed,
    policy: policyId,
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
    lives: g.lives,
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
