// Игровой движок прототипа «Железный Разлом»
// Чистый TypeScript без зависимости от React — в будущем переносится на Unity C#

import {
  ALL_DEFS,
  ARMOR_HP_MULT,
  ARMOR_SPEED,
  AVATAR,
  BOSS_ESCORTS,
  BOSS_GOLD_MULT,
  BOSS_HP_MULT,
  BOSS_LIVES_COST,
  BOSS_SPEED,
  CHAIN_FALLOFF,
  CHAIN_RANGE,
  COOP_HP_MULT,
  DAMAGE_MATRIX,
  FIRST_PREVIEW_TIME,
  HP_PLAYTEST_MULT,
  INFINITE_GOLD,
  LEVEL_MULT,
  LINE_WIDTH,
  MAP_H,
  MAP_W,
  MERGE_DIST,
  MERGE_MIN_LEVEL,
  MERGED_TOWERS,
  MIN_INTERVAL,
  PREVIEW_TIME,
  ROLL_COST,
  SELL_RATIO,
  SHOP_SIZE,
  SLAM_STUN,
  START_GOLD,
  START_LIVES,
  TOTAL_WAVES,
  TOWERS,
  WAVES,
  goldForKill,
  hpForWave,
  levelDamageMult,
  levelIntervalMult,
  levelRangeMult,
  markBonusForLevel,
  waveBonus,
} from './config'
import {
  type GameMap,
  cellOf,
  distToPath,
  generateMap,
  getMap,
  isPathCell,
  pathLength,
  pointAtLength,
  randomSeed,
  setMap,
  snapToCell,
} from './map'
import type { GuestCmd, Snap } from './mp-protocol'
import type {
  ArmorType,
  AttackType,
  Creep,
  Effect,
  FloatText,
  MergeDef,
  Phase,
  Projectile,
  Tower,
  TowerDefinition,
  UiState,
  Vec,
} from './types'

// ─── Путь и сетка — в map.ts (тропа генерируется по зерну) ──────────────
export { distToPath, pointAtLength }

/** Расстояние от точки p до отрезка a–b */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const bx = b.x - a.x
  const by = b.y - a.y
  const len2 = bx * bx + by * by || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by) / len2))
  return Math.hypot(p.x - (a.x + bx * t), p.y - (a.y + by * t))
}

/**
 * Проверка клетки под башню (координаты — любая точка внутри клетки).
 * null — строить можно, иначе строка с причиной запрета.
 */
export function placementError(x: number, y: number, towers: Tower[], avatar: Vec): string | null {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 'За краем карты'
  const c = cellOf(x, y)
  if (isPathCell(c)) return 'Нельзя строить на тракте'
  for (const tw of towers) {
    const tc = cellOf(tw.x, tw.y)
    if (tc.cx === c.cx && tc.cy === c.cy) return 'Клетка занята башней'
  }
  const ac = cellOf(avatar.x, avatar.y)
  if (ac.cx === c.cx && ac.cy === c.cy) return 'Охотница стоит на этой клетке'
  return null
}

export function findRecipe(a: string, b: string): MergeDef | null {
  return (
    MERGED_TOWERS.find(
      (m) =>
        (m.parents[0] === a && m.parents[1] === b) ||
        (m.parents[0] === b && m.parents[1] === a)
    ) ?? null
  )
}

export function upgradeCost(def: TowerDefinition): number {
  if (def.merged) {
    const pa = ALL_DEFS[def.parents[0]]
    const pb = ALL_DEFS[def.parents[1]]
    return Math.min(pa.price, pb.price)
  }
  return def.price
}

export function hybridMult(attacks: AttackType[], armor: ArmorType): { mult: number; attack: AttackType } {
  let best = { mult: -1, attack: attacks[0] }
  for (const a of attacks) {
    const m = DAMAGE_MATRIX[a][armor]
    if (m > best.mult) best = { mult: m, attack: a }
  }
  return best
}

/** Случайный пул арсенала: SHOP_SIZE разных боевых башен */
export function rollPool(): string[] {
  const ids = TOWERS.map((t) => t.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids.slice(0, SHOP_SIZE)
}

export interface ActionResult {
  ok: boolean
  error?: string
  towerId?: number // id построенной башни (при build)
}

interface SpawnOrder {
  t: number
  isBoss: boolean
  armor: ArmorType
}

// ─── Игровое состояние ──────────────────────────────────────────────────
export class Game {
  phase: Phase = 'intro'
  gold = START_GOLD
  lives = START_LIVES
  wave = 1 // 1-базный номер текущей/следующей волны
  speed = 1
  paused = false // пауза: время стоит, но строить/улучшать/роллить можно
  shop: string[] = [] // башни, доступные к постройке
  infiniteGold = false // чит для тестов: золото не кончается (переживает рестарт)
  private goldBeforeCheat = 0
  time = 0
  previewRemaining = 0

  creeps: Creep[] = []
  towers: Tower[] = []
  projectiles: Projectile[] = []
  effects: Effect[] = []
  floats: FloatText[] = []
  avatar = {
    x: 90,
    y: 260,
    target: null as Vec | null,
    level: 1,
    xp: 0,
    cooldown: 0,
    attackCd: 0,
  }

  stats = { kills: 0, leaked: 0, goldEarned: 0, merges: 0, bossKills: 0 }

  /** Зерно текущей карты (0 — классическая змейка). Хост передаёт его гостю в снапшоте */
  mapSeed = 0
  private mapLocked = false // useMap(): карта не меняется при рестарте (тесты)

  private uid = 1
  private spawnQueue: SpawnOrder[] = []
  private waveSpawned = 0
  private waveTotal = 0
  private waveStart = 0

  constructor() {
    this.reset()
  }

  reset() {
    this.phase = 'intro'
    this.gold = START_GOLD
    this.lives = START_LIVES
    this.wave = 1
    this.speed = 1
    this.paused = false
    // пул выпадает при старте игры (beginPreview), а не здесь: Game создаётся и на сервере
    // при SSR — случайный пул разошёлся бы с клиентским и сломал гидратацию React
    this.shop = []
    this.time = 0
    this.previewRemaining = 0
    this.creeps = []
    this.towers = []
    this.projectiles = []
    this.effects = []
    this.floats = []
    this.avatar = { x: 90, y: 260, target: null, level: 1, xp: 0, cooldown: 0, attackCd: 0 }
    this.stats = { kills: 0, leaked: 0, goldEarned: 0, merges: 0, bossKills: 0 }
    this.spawnQueue = []
    this.waveSpawned = 0
    this.waveTotal = 0
    if (this.infiniteGold) {
      this.goldBeforeCheat = this.gold
      this.refillGold()
    }
    // каждая новая игра — новая тропа
    if (!this.mapLocked) this.loadMap(generateMap(randomSeed()))
  }

  private loadMap(m: GameMap) {
    setMap(m)
    this.mapSeed = m.seed
  }

  /** Зафиксировать карту (не меняется при рестарте) — для тестов и выбора конкретной карты */
  useMap(m: GameMap) {
    this.mapLocked = true
    this.loadMap(m)
  }

  get map(): GameMap {
    return getMap()
  }

  /** Чит «бесконечное золото»: при выключении возвращается золото, что было до включения */
  setInfiniteGold(on: boolean) {
    if (on === this.infiniteGold) return
    this.infiniteGold = on
    if (on) {
      this.goldBeforeCheat = this.gold
      this.refillGold()
    } else {
      this.gold = this.goldBeforeCheat
    }
  }

  private refillGold() {
    if (this.infiniteGold) this.gold = INFINITE_GOLD
  }

  beginPreview() {
    if (this.phase !== 'intro' && this.phase !== 'wave') return
    if (this.phase === 'intro' && this.shop.length === 0) this.shop = rollPool() // первый пул бесплатный
    this.phase = 'preview'
    this.previewRemaining = this.wave === 1 ? FIRST_PREVIEW_TIME : PREVIEW_TIME
  }

  startWave() {
    if (this.phase !== 'preview') return
    const def = WAVES[this.wave - 1]
    this.phase = 'wave'
    this.waveStart = this.time
    this.spawnQueue = []
    this.waveSpawned = 0

    if (def.kind === 'boss') {
      this.spawnQueue.push({ t: 0, isBoss: true, armor: 'heavy' })
      for (let i = 0; i < BOSS_ESCORTS; i++) {
        this.spawnQueue.push({ t: 3 + i * 1.2, isBoss: false, armor: 'medium' })
      }
    } else {
      for (let i = 0; i < def.count; i++) {
        this.spawnQueue.push({ t: i * def.spawnInterval, isBoss: false, armor: def.armor })
      }
    }
    this.waveTotal = this.spawnQueue.length
  }

  setSpeed(s: number) {
    this.speed = s
  }

  setPaused(p: boolean) {
    this.paused = p
  }

  /** Открыть в арсенале все башни (тесты, будущий режим отладки) */
  unlockAllTowers() {
    this.shop = TOWERS.map((t) => t.id)
  }

  /** Ролл арсенала: новый пул из SHOP_SIZE башен за ROLL_COST золота */
  roll(): ActionResult {
    if (this.phase === 'over' || this.phase === 'won') return { ok: false, error: 'Игра окончена' }
    if (this.gold < ROLL_COST) return { ok: false, error: 'Не хватает золота' }
    this.gold -= ROLL_COST
    this.refillGold()
    this.shop = rollPool()
    return { ok: true }
  }

  // ─── Действия игрока ──────────────────────────────────────────────────
  towerById(id: number): Tower | undefined {
    return this.towers.find((t) => t.id === id)
  }

  /** Проверка места для постройки (без цены). null — можно */
  canPlace(x: number, y: number): string | null {
    return placementError(x, y, this.towers, this.avatar)
  }

  canBuild(x: number, y: number, defId: string): boolean {
    const def = ALL_DEFS[defId]
    return !!def && this.shop.includes(defId) && this.gold >= def.price && this.canPlace(x, y) === null
  }

  build(x: number, y: number, defId: string): ActionResult {
    const def = ALL_DEFS[defId]
    if (!def) return { ok: false, error: 'Нет такой башни' }
    if (!this.shop.includes(defId)) return { ok: false, error: 'Этой башни нет в арсенале — сделайте ролл' }
    const placeErr = this.canPlace(x, y)
    if (placeErr) return { ok: false, error: placeErr }
    if (this.gold < def.price) return { ok: false, error: 'Не хватает золота' }
    this.gold -= def.price
    this.refillGold()
    const at = snapToCell(x, y) // башня всегда в центре клетки
    const tower: Tower = {
      id: this.uid++,
      x: at.x,
      y: at.y,
      defId,
      level: 1,
      invested: def.price,
      cooldown: 0,
      shotCount: 0,
      hammerCd: 0,
      rampMult: 1,
      focusUid: 0,
      focusStacks: 0,
      lastShotAt: -1e9,
      aim: -Math.PI / 2,
    }
    this.towers.push(tower)
    return { ok: true, towerId: tower.id }
  }

  upgrade(id: number): ActionResult {
    const tw = this.towerById(id)
    if (!tw) return { ok: false, error: 'Башни нет' }
    if (tw.level >= 5) return { ok: false, error: 'Максимальный уровень' }
    const cost = upgradeCost(ALL_DEFS[tw.defId])
    if (this.gold < cost) return { ok: false, error: 'Не хватает золота' }
    this.gold -= cost
    this.refillGold()
    tw.invested += cost
    tw.level += 1
    return { ok: true }
  }

  sell(id: number): ActionResult {
    const tw = this.towerById(id)
    if (!tw) return { ok: false, error: 'Башни нет' }
    const refund = Math.floor(tw.invested * SELL_RATIO)
    this.gold += refund
    this.towers = this.towers.filter((t) => t.id !== id)
    this.addFloat(tw.x, tw.y - 24, `+${refund}`, '#e8c170')
    return { ok: true }
  }

  canMerge(a: number, b: number): MergeDef | null {
    const ta = this.towerById(a)
    const tb = this.towerById(b)
    if (!ta || !tb || a === b) return null
    if (ta.level < MERGE_MIN_LEVEL || tb.level < MERGE_MIN_LEVEL) return null
    const da = ALL_DEFS[ta.defId]
    const db = ALL_DEFS[tb.defId]
    if (da.merged || db.merged) return null
    if (Math.hypot(ta.x - tb.x, ta.y - tb.y) > MERGE_DIST) return null
    return findRecipe(ta.defId, tb.defId)
  }

  merge(a: number, b: number): ActionResult {
    const recipe = this.canMerge(a, b)
    if (!recipe) return { ok: false, error: 'Слияние невозможно' }
    const ta = this.towerById(a)!
    const tb = this.towerById(b)!
    const level = Math.min(ta.level, tb.level)
    const invested = ta.invested + tb.invested
    tb.defId = recipe.id
    tb.level = level
    tb.invested = invested
    tb.cooldown = 0
    tb.shotCount = 0
    tb.hammerCd = 0
    tb.rampMult = 1
    tb.focusUid = 0
    tb.focusStacks = 0
    this.towers = this.towers.filter((t) => t.id !== a)
    this.stats.merges++
    this.addFloat(tb.x, tb.y - 30, recipe.glyph + ' ' + recipe.name, '#f0a44a')
    this.effects.push({ x: tb.x, y: tb.y, r: 46, born: this.time, dur: 0.8, color: '#f0a44a', kind: 'blast' })
    return { ok: true }
  }

  mergeTargetsFor(id: number): number[] {
    const tw = this.towerById(id)
    if (!tw || tw.level < MERGE_MIN_LEVEL) return []
    return this.towers
      .filter((t) => t.id !== id && Math.hypot(t.x - tw.x, t.y - tw.y) <= MERGE_DIST)
      .map((t) => t.id)
      .filter((tid) => !!this.canMerge(id, tid))
  }

  moveAvatar(p: Vec) {
    this.avatar.target = { x: p.x, y: p.y }
  }

  useAbility(): ActionResult {
    if (this.avatar.cooldown > 0) return { ok: false, error: 'Способность перезаряжается' }
    let best: Creep | null = null
    for (const c of this.creeps) if (!best || c.hp > best.hp) best = c
    if (!best) return { ok: false, error: 'Нет цели' }
    best.markedUntil = this.time + AVATAR.abilityDur
    best.markedBonus = markBonusForLevel(this.avatar.level)
    best.goldMult = 2
    this.avatar.cooldown = AVATAR.abilityCd
    const p = pointAtLength(best.dist)
    this.effects.push({ x: p.x, y: p.y, r: 30, born: this.time, dur: 0.7, color: '#e8c170', kind: 'mark' })
    return { ok: true }
  }

  addFloat(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, text, color, born: this.time })
    if (this.floats.length > 40) this.floats.shift()
  }

  // ─── Обновление мира ──────────────────────────────────────────────────
  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.05) * this.speed
    this.refillGold() // доходы от убийств и продаж в режиме чита тоже не копятся сверх нормы
    if (this.paused) return
    if (this.phase === 'intro' || this.phase === 'over' || this.phase === 'won') return
    this.time += dt

    if (this.phase === 'preview') {
      this.previewRemaining -= dt
      if (this.previewRemaining <= 0) this.startWave()
    }

    if (this.phase === 'wave') {
      this.spawnFromQueue()
      this.updateCreeps(dt)
      // поражение — не продолжаем волну и не начисляем бонус
      if (this.phase !== 'wave') return
      this.updateTowers(dt)
      this.updateProjectiles(dt)
      this.updateAvatar(dt)

      if (this.waveSpawned >= this.waveTotal && this.creeps.length === 0) {
        this.finishWave()
      }
    }

    this.effects = this.effects.filter((e) => this.time - e.born < e.dur)
    this.floats = this.floats.filter((f) => this.time - f.born < 1.1)
  }

  private spawnFromQueue() {
    const def = WAVES[this.wave - 1]
    while (this.spawnQueue.length && this.time >= this.waveStart + this.spawnQueue[0].t) {
      const o = this.spawnQueue.shift()!
      let hp: number
      let speed: number
      let size: number
      let gold: number
      let livesCost: number
      if (o.isBoss) {
        hp = hpForWave(def.n) * BOSS_HP_MULT * HP_PLAYTEST_MULT * this.coopMult()
        speed = BOSS_SPEED
        size = 26
        gold = goldForKill(def.n) * BOSS_GOLD_MULT
        livesCost = BOSS_LIVES_COST
      } else {
        hp = hpForWave(def.n) * ARMOR_HP_MULT[o.armor] * def.hpMult * HP_PLAYTEST_MULT * this.coopMult()
        speed = ARMOR_SPEED[o.armor]
        size = o.armor === 'light' ? 11 : o.armor === 'medium' ? 13 : 15
        gold = goldForKill(def.n) * def.goldMult
        livesCost = 1
      }
      this.creeps.push({
        uid: this.uid++,
        armor: o.armor,
        hp,
        maxHp: hp,
        speed,
        dist: 0,
        size,
        isBoss: o.isBoss,
        gold,
        livesCost,
        burnDps: 0,
        burnUntil: 0,
        burnSource: '',
        stunnedUntil: 0,
        markedUntil: 0,
        markedBonus: 0,
        goldMult: 1,
        slowPct: 0,
        slowUntil: 0,
        vulnBonus: 0,
        vulnUntil: 0,
      })
      this.waveSpawned++
    }
  }

  private updateCreeps(dt: number) {
    const next: Creep[] = []
    for (const c of this.creeps) {
      // горение
      if (this.time < c.burnUntil && c.burnDps > 0) {
        this.damageCreep(c, c.burnDps * dt, 'burn')
        if (c.hp <= 0) continue
      }
      if (this.time >= c.stunnedUntil) {
        c.dist += c.speed * this.slowFactor(c) * dt
      }
      if (c.dist >= pathLength()) {
        // прорвался
        this.lives -= c.livesCost
        this.stats.leaked++
        const exit = pointAtLength(pathLength() - 30)
        this.addFloat(exit.x, exit.y - 20, `−${c.livesCost} ♥`, '#e05252')
        if (this.lives <= 0) {
          this.lives = 0
          this.phase = 'over'
          return
        }
        continue
      }
      next.push(c)
    }
    this.creeps = next
  }

  private damageCreep(c: Creep, amount: number, attacks: AttackType[] | 'burn') {
    if (c.hp <= 0) return
    let dmg = amount
    if (attacks !== 'burn') {
      // гибридная атака: против каждой цели — лучший множитель из двух типов
      let mult = 0
      for (const a of attacks) mult = Math.max(mult, DAMAGE_MATRIX[a][c.armor])
      dmg = amount * mult
    }
    if (this.time < c.markedUntil) dmg *= 1 + c.markedBonus
    if (this.time < c.vulnUntil) dmg *= 1 + c.vulnBonus
    c.hp -= dmg
    if (c.hp <= 0) this.killCreep(c)
  }

  private killCreep(c: Creep) {
    if (this.creeps.indexOf(c) < 0) return
    const g = Math.round(c.gold * c.goldMult) + AVATAR.passiveBonus
    this.gold += g
    this.stats.goldEarned += g
    this.stats.kills++
    if (c.isBoss) this.stats.bossKills++
    const p = pointAtLength(c.dist)
    this.addFloat(p.x, p.y - 18, `+${g}`, '#e8c170')
    // опыт аватара за убийства рядом
    if (Math.hypot(p.x - this.avatar.x, p.y - this.avatar.y) <= AVATAR.xpRadius) {
      this.avatar.xp++
      while (
        this.avatar.level < AVATAR.maxLevel &&
        this.avatar.xp >= AVATAR.xpThresholds[this.avatar.level]
      ) {
        this.avatar.level++
        this.addFloat(this.avatar.x, this.avatar.y - 30, `Ур. ${this.avatar.level}`, '#7fd0a0')
      }
    }
    this.creeps = this.creeps.filter((x) => x !== c)
  }

  private creepsInRange(x: number, y: number, range: number): Creep[] {
    return this.creeps.filter((c) => {
      const p = pointAtLength(c.dist)
      return Math.hypot(p.x - x, p.y - y) <= range + c.size
    })
  }

  /** Периодическая способность 5 ур.: оглушить/заморозить всех подходящих в радиусе */
  private groupStun(
    tw: Tower, range: number, dur: number, cd: number, color: string,
    filter: (c: Creep) => boolean = () => true, slowAfter?: { pct: number; dur: number }
  ) {
    tw.hammerCd -= this.lastDt
    if (tw.hammerCd > 0) return
    const hit = this.creepsInRange(tw.x, tw.y, range).filter(filter)
    if (hit.length === 0) return
    for (const c of hit) {
      c.stunnedUntil = Math.max(c.stunnedUntil, this.time + dur)
      if (slowAfter) this.applySlow(c, slowAfter.pct, c.stunnedUntil + slowAfter.dur - this.time)
    }
    tw.hammerCd = cd
    this.effects.push({ x: tw.x, y: tw.y, r: range, born: this.time, dur: 0.5, color, kind: 'stun' })
  }

  private lastDt = 0

  private updateTowers(dt: number) {
    this.lastDt = dt
    for (const tw of this.towers) {
      const def = ALL_DEFS[tw.defId]
      tw.cooldown -= dt
      const range = def.range * levelRangeMult(tw.level)

      // Периодические способности 5 уровня
      if (tw.level >= 5) {
        if (def.id === 'mauler') this.groupStun(tw, range, 1.2, 8, '#d09a4e')
        if (def.id === 'time_guardian') this.groupStun(tw, range, 1.2, 8, '#c49ad0', undefined, def.stunSlow)
        if (def.id === 'frost') this.groupStun(tw, range, 1, 6, '#7cc4e0')
        if (def.id === 'chrono') this.groupStun(tw, range, 1, 8, '#b48ad8', (c) => c.isBoss)
      }

      if (tw.cooldown > 0) continue
      // цели: крипы в радиусе, первым — тот, кто дальше всех по тропе
      const inRange = this.creepsInRange(tw.x, tw.y, range).sort((a, b) => b.dist - a.dist)
      if (inRange.length === 0) continue

      tw.cooldown = Math.max(MIN_INTERVAL, (def.interval * levelIntervalMult(tw.level)) / tw.rampMult)
      tw.shotCount++
      tw.lastShotAt = this.time
      const tp = pointAtLength(inRange[0].dist)
      tw.aim = Math.atan2(tp.y - tw.y, tp.x - tw.x)
      if (def.ramp) tw.rampMult += def.ramp * (tw.level >= 5 ? 2 : 1)
      this.fireTower(tw, def, inRange, range)
    }
  }

  /** Аура Бастиона: +урон башням рядом. Одинаковые ауры не складываются — берём сильнейшую */
  private auraMult(tw: Tower): number {
    let best = 0
    for (const o of this.towers) {
      if (o.id === tw.id) continue
      const od = ALL_DEFS[o.defId]
      if (!od.aura || Math.hypot(o.x - tw.x, o.y - tw.y) > MERGE_DIST) continue
      best = Math.max(best, od.aura * (o.level >= 5 ? 2 : 1))
    }
    return 1 + best
  }

  private fireTower(tw: Tower, def: TowerDefinition, inRange: Creep[], range: number) {
    const target = inRange[0]
    const spot = { x: tw.x, y: tw.y }
    const l5 = tw.level >= 5
    const attacks: AttackType[] = def.merged ? [...def.attacks] : [def.attack]
    let dmg = def.damage * levelDamageMult(tw.level) * this.auraMult(tw)
    if (def.waveGrowth) dmg *= 1 + def.waveGrowth * (this.wave - 1)

    let burn = def.burn ? { ...def.burn } : undefined
    let splash = def.splash
    let slow = def.slow
    let freeze = def.freeze
    let vuln = def.vuln
    let chain = def.chain
    let crit = !!def.critEvery && tw.shotCount % def.critEvery === 0

    // Способности 5 уровня, меняющие параметры выстрела
    if (l5) {
      if (def.id === 'crossbow' && tw.shotCount % 5 === 0) crit = true
      if (def.id === 'pyro') {
        // огонь перекидывается — подожжём ещё одного крипа рядом с целью
        const tp = pointAtLength(target.dist)
        const near = this.creeps.find(
          (c) => c !== target && Math.hypot(pointAtLength(c.dist).x - tp.x, pointAtLength(c.dist).y - tp.y) <= 60
        )
        if (near) this.applyBurn(near, burn, def.id)
      }
      if (def.id === 'flame_archer' && burn) burn = { dps: burn.dps * 2, dur: burn.dur }
      if (def.id === 'volcano' && splash) splash = splash * 1.3
      if (def.id === 'hunter') slow = { pct: 0.3, dur: 2 }
      if (def.id === 'lightning') chain = 7
      if (def.id === 'frost_hunter') freeze = 1
      if (def.id === 'steam_boiler') vuln = { bonus: 0.35, dur: 3 }
    }

    const base = {
      damage: dmg, attacks, burn, slow, freeze, vuln,
      stunChance: def.stunChance, stunSlow: def.stunSlow, sourceDefId: def.id,
    }

    // ── Мгновенные атаки (без снаряда) ──
    if (def.line) {
      // болт насквозь по линии; на 5 ур. — через всю карту
      const tp = pointAtLength(target.dist)
      const len = l5 ? 2000 : range
      const d = Math.hypot(tp.x - spot.x, tp.y - spot.y) || 1
      const end = { x: spot.x + ((tp.x - spot.x) / d) * len, y: spot.y + ((tp.y - spot.y) / d) * len }
      for (const c of [...this.creeps]) {
        const p = pointAtLength(c.dist)
        if (distToSegment(p, spot, end) <= LINE_WIDTH + c.size) this.applyHit(c, { ...base, heavyBonus: def.heavyBonus })
      }
      this.effects.push({ x: spot.x, y: spot.y, r: 0, born: this.time, dur: 0.25, color: def.color, kind: 'beam', points: [spot, end] })
      return
    }
    if (def.slam) {
      for (const c of inRange) {
        this.applyHit(c, base)
        if (l5 && c.hp > 0) c.stunnedUntil = Math.max(c.stunnedUntil, this.time + SLAM_STUN)
      }
      this.effects.push({ x: spot.x, y: spot.y, r: range, born: this.time, dur: 0.4, color: def.color, kind: 'blast' })
      return
    }
    if (def.projSpeed === 0) {
      // молния (цепь) или луч призмы — попадание сразу
      const targets = def.id === 'prism' && l5 ? inRange.slice(0, 5) : [target]
      let mult = 1
      if (def.focus) {
        tw.focusStacks = tw.focusUid === target.uid ? tw.focusStacks + 1 : 0
        tw.focusUid = target.uid
        mult = Math.min(l5 ? 5 : def.focus.max, 1 + def.focus.perHit * tw.focusStacks)
      }
      for (const c of targets) {
        const p = pointAtLength(c.dist)
        this.applyHit(c, { ...base, damage: dmg * mult })
        if (chain) this.chainFrom(c, chain, dmg, attacks, spot, def.color)
        else this.effects.push({ x: spot.x, y: spot.y, r: 0, born: this.time, dur: 0.15, color: def.color, kind: 'beam', points: [spot, p] })
      }
      return
    }

    // ── Снаряды ──
    let targets: Creep[] = [target]
    let dmgEach = dmg
    if (def.targets) targets = inRange.slice(0, def.targets)
    if (l5) {
      if (def.id === 'archer') targets = [target, inRange[1] ?? target] // двойной выстрел
      if (def.id === 'mortar') targets = [0, 1, 2].map((i) => inRange[i] ?? target) // залп из 3
      if (def.id === 'storm_mortar') targets = [0, 1].map((i) => inRange[i] ?? target)
      if (def.id === 'mech_guard') {
        targets = [target, target, target] // пулемётная очередь
        dmgEach = dmg * 0.6
      }
      if (def.id === 'golem') {
        // удар по 3 целям в линию: цель и ближайшие к ней по тропе
        targets = [...this.creeps]
          .filter((c) => Math.abs(c.dist - target.dist) <= 80)
          .sort((a, b) => Math.abs(a.dist - target.dist) - Math.abs(b.dist - target.dist))
          .slice(0, 3)
      }
    }
    // крит Громового арбалета вызывает цепную молнию от цели
    const critChain = def.id === 'thunder_crossbow' && crit ? (l5 ? 7 : 3) : undefined

    for (const c of targets) {
      let d = dmgEach
      if (def.id === 'sentry' && l5 && c.isBoss) d *= 1.2
      if (crit) d *= 3
      this.projectiles.push({
        uid: this.uid++,
        x: spot.x,
        y: spot.y,
        targetUid: c.uid,
        targetPos: pointAtLength(c.dist),
        speed: def.projSpeed,
        damage: d,
        attacks,
        splash,
        burn,
        slow,
        freeze,
        vuln,
        stunChance: def.stunChance,
        stunSlow: def.stunSlow,
        chain: splash ? chain : critChain,
        sourceDefId: def.id,
        sourceLevel: tw.level,
        color: def.color,
        kind: def.proj ?? 'arrow',
        crit,
      })
    }
  }

  /** Попадание по одному крипу: урон + все эффекты */
  private applyHit(
    c: Creep,
    h: {
      damage: number
      attacks: AttackType[]
      burn?: { dps: number; dur: number }
      slow?: { pct: number; dur: number }
      freeze?: number
      vuln?: { bonus: number; dur: number }
      stunChance?: number
      stunSlow?: { pct: number; dur: number }
      heavyBonus?: number
      sourceDefId: string
    }
  ) {
    const amount = h.heavyBonus && c.armor === 'heavy' ? h.damage * h.heavyBonus : h.damage
    this.damageCreep(c, amount, h.attacks)
    if (c.hp <= 0) return
    if (h.burn) this.applyBurn(c, h.burn, h.sourceDefId)
    if (h.slow) this.applySlow(c, h.slow.pct, h.slow.dur)
    if (h.vuln && (this.time >= c.vulnUntil || h.vuln.bonus >= c.vulnBonus)) {
      c.vulnBonus = h.vuln.bonus
      c.vulnUntil = this.time + h.vuln.dur
    }
    if (h.freeze) c.stunnedUntil = Math.max(c.stunnedUntil, this.time + h.freeze)
    if (h.stunChance && Math.random() < h.stunChance) {
      c.stunnedUntil = Math.max(c.stunnedUntil, this.time + 1)
      if (h.stunSlow) this.applySlow(c, h.stunSlow.pct, c.stunnedUntil + h.stunSlow.dur - this.time)
    }
  }

  private applySlow(c: Creep, pct: number, dur: number) {
    if (this.time >= c.slowUntil || pct >= c.slowPct) c.slowPct = pct
    c.slowUntil = Math.max(c.slowUntil, this.time + dur)
  }

  private slowFactor(c: Creep): number {
    return this.time < c.slowUntil ? 1 - c.slowPct : 1
  }

  /** Цепная молния: от крипа `from` прыгает к ближайшим ещё не задетым */
  private chainFrom(from: Creep, jumps: number, dmg: number, attacks: AttackType[], start: Vec, color: string) {
    const hit = new Set([from.uid])
    const points: Vec[] = [start, pointAtLength(from.dist)]
    let cur = points[1]
    let d = dmg
    for (let i = 0; i < jumps; i++) {
      let next: Creep | null = null
      let best = CHAIN_RANGE
      for (const c of this.creeps) {
        if (hit.has(c.uid)) continue
        const p = pointAtLength(c.dist)
        const dd = Math.hypot(p.x - cur.x, p.y - cur.y)
        if (dd <= best) {
          best = dd
          next = c
        }
      }
      if (!next) break
      d *= CHAIN_FALLOFF
      hit.add(next.uid)
      cur = pointAtLength(next.dist)
      points.push(cur)
      this.damageCreep(next, d, attacks)
    }
    this.effects.push({ x: start.x, y: start.y, r: 0, born: this.time, dur: 0.25, color, kind: 'chain', points })
  }

  private applyBurn(c: Creep, burn: { dps: number; dur: number } | undefined, sourceDefId: string) {
    if (!burn) return
    if (this.time >= c.burnUntil || burn.dps > c.burnDps) {
      c.burnDps = burn.dps
      c.burnSource = sourceDefId
    }
    c.burnUntil = Math.max(c.burnUntil, this.time + burn.dur)
  }

  private updateProjectiles(dt: number) {
    const next: Projectile[] = []
    for (const pr of this.projectiles) {
      const target = this.creeps.find((c) => c.uid === pr.targetUid)
      if (target) pr.targetPos = pointAtLength(target.dist)
      const tp = pr.targetPos
      if (!tp) continue // цель исчезла и точки нет
      const dx = tp.x - pr.x
      const dy = tp.y - pr.y
      const d = Math.hypot(dx, dy)
      const step = pr.speed * dt
      if (d <= step) {
        // попадание
        pr.x = tp.x
        pr.y = tp.y
        const hit = { ...pr }
        if (pr.splash) {
          const r = pr.splash
          for (const c of [...this.creeps]) {
            const p = pointAtLength(c.dist)
            if (Math.hypot(p.x - pr.x, p.y - pr.y) <= r + c.size) this.applyHit(c, hit)
          }
          this.effects.push({ x: pr.x, y: pr.y, r: r, born: this.time, dur: 0.35, color: pr.color, kind: 'blast' })
          // Грозовая мортира: молния от взрыва по N ближайшим
          if (pr.chain) {
            const near = [...this.creeps]
              .map((c) => ({ c, p: pointAtLength(c.dist) }))
              .map((o) => ({ ...o, d: Math.hypot(o.p.x - pr.x, o.p.y - pr.y) }))
              .filter((o) => o.d <= CHAIN_RANGE * 1.6)
              .sort((a, b) => a.d - b.d)
              .slice(0, pr.chain)
            for (const o of near) {
              this.damageCreep(o.c, pr.damage * 0.5, pr.attacks)
              this.effects.push({ x: pr.x, y: pr.y, r: 0, born: this.time, dur: 0.25, color: '#c9b8ff', kind: 'chain', points: [{ x: pr.x, y: pr.y }, o.p] })
            }
          }
        } else if (target) {
          this.applyHit(target, hit)
          if (pr.chain) this.chainFrom(target, pr.chain, pr.damage, pr.attacks, { x: pr.x, y: pr.y }, '#c9b8ff')
          // способность Камнемёта 5 ур.: осколки после удара
          if (pr.kind === 'rock' && pr.sourceDefId === 'catapult' && pr.sourceLevel >= 5) {
            for (const c of [...this.creeps]) {
              const p = pointAtLength(c.dist)
              if (c !== target && Math.hypot(p.x - pr.x, p.y - pr.y) <= 80) {
                this.damageCreep(c, pr.damage * 0.4, ['crush'])
              }
            }
            this.effects.push({ x: pr.x, y: pr.y, r: 80, born: this.time, dur: 0.3, color: '#c2874f', kind: 'blast' })
          }
        }
        if (pr.crit) this.addFloat(pr.x, pr.y - 26, 'КРИТ!', '#ffdf6b')
        continue
      }
      pr.x += (dx / d) * step
      pr.y += (dy / d) * step
      next.push(pr)
    }
    this.projectiles = next
  }

  private updateAvatar(dt: number) {
    const av = this.avatar
    av.cooldown = Math.max(0, av.cooldown - dt)
    av.attackCd -= dt
    if (av.target) {
      const dx = av.target.x - av.x
      const dy = av.target.y - av.y
      const d = Math.hypot(dx, dy)
      if (d < 4) {
        av.target = null
      } else {
        av.x += (dx / d) * AVATAR.speed * dt
        av.y += (dy / d) * AVATAR.speed * dt
      }
    }
    av.x = Math.max(14, Math.min(MAP_W - 14, av.x))
    av.y = Math.max(14, Math.min(MAP_H - 14, av.y))

    if (av.attackCd <= 0) {
      let target: Creep | null = null
      let bestDist = Infinity
      for (const c of this.creeps) {
        const p = pointAtLength(c.dist)
        const d = Math.hypot(p.x - av.x, p.y - av.y)
        if (d <= AVATAR.range && d < bestDist) {
          bestDist = d
          target = c
        }
      }
      if (target) {
        av.attackCd = AVATAR.interval
        this.projectiles.push({
          uid: this.uid++,
          x: av.x,
          y: av.y,
          targetUid: target.uid,
          targetPos: pointAtLength(target.dist),
          speed: 480,
          damage: AVATAR.damage,
          attacks: ['universal'],
          color: '#e8c170',
          kind: 'arrow',
          fromAvatar: true,
          sourceDefId: 'avatar',
          sourceLevel: 1,
        })
      }
    }
  }

  private finishWave() {
    const def = WAVES[this.wave - 1]
    const bonus = waveBonus(def.n) * def.bonusMult
    this.gold += bonus
    this.stats.goldEarned += bonus
    this.addFloat(MAP_W / 2, 60, `Волна ${def.n} пройдена! +${bonus} золота`, '#e8c170')
    // разгон Автоматического арсенала действует только до конца волны
    for (const tw of this.towers) tw.rampMult = 1
    this.wave++
    if (this.wave > TOTAL_WAVES) {
      this.phase = 'won'
    } else {
      this.phase = 'preview'
      this.previewRemaining = PREVIEW_TIME
    }
  }

  // ─── Снимок для UI ────────────────────────────────────────────────────
  getUiState(): UiState {
    const def = WAVES[Math.min(this.wave, TOTAL_WAVES) - 1]
    const lvl = this.avatar.level
    return {
      phase: this.phase,
      gold: Math.floor(this.gold),
      lives: this.lives,
      wave: this.wave,
      totalWaves: TOTAL_WAVES,
      coop: this.coop,
      previewRemaining: Math.max(0, this.previewRemaining),
      waveSpawned: this.waveSpawned,
      waveTotal: this.waveTotal,
      creepsAlive: this.creeps.length,
      speed: this.speed,
      paused: this.paused,
      infiniteGold: this.infiniteGold,
      shop: [...this.shop],
      rollCost: ROLL_COST,
      time: this.time,
      stats: { ...this.stats },
      avatar: {
        level: lvl,
        xp: this.avatar.xp,
        xpNext: lvl < AVATAR.maxLevel ? AVATAR.xpThresholds[lvl] : null,
        cooldown: this.avatar.cooldown,
      },
      nextWaveArmor: def.armor,
      nextWaveIsBoss: def.kind === 'boss',
      nextWaveIsMoney: def.kind === 'money',
      nextWaveCount: def.kind === 'boss' ? 1 + BOSS_ESCORTS : def.count,
    }
  }

  currentLevelMult(level: number) {
    return LEVEL_MULT[level - 1]
  }

  // ─── Мультиплеер (host-авторитарная модель) ──────────────────────────

  /** Подключён ли второй игрок (влияет на HP волн ×1.85) */
  coop = false

  private coopMult(): number {
    return this.coop ? COOP_HP_MULT : 1
  }

  setCoop(on: boolean) {
    this.coop = on
  }

  /** Полный снимок мира для гостя (JSON-совместимый) */
  serialize(): Snap {
    const def = WAVES[Math.min(this.wave, TOTAL_WAVES) - 1]
    return {
      seq: this.snapSeq++,
      phase: this.phase,
      wave: this.wave,
      gold: Math.floor(this.gold),
      lives: this.lives,
      speed: this.speed,
      paused: this.paused,
      infiniteGold: this.infiniteGold,
      shop: [...this.shop],
      mapSeed: this.mapSeed,
      time: this.time,
      previewRemaining: Math.max(0, this.previewRemaining),
      waveSpawned: this.waveSpawned,
      waveTotal: this.waveTotal,
      coop: this.coop,
      stats: { ...this.stats },
      avatar: {
        x: this.avatar.x, y: this.avatar.y, target: this.avatar.target,
        level: this.avatar.level, xp: this.avatar.xp,
        cooldown: this.avatar.cooldown, attackCd: this.avatar.attackCd,
      },
      towers: this.towers.map((t) => ({
        id: t.id, x: t.x, y: t.y, defId: t.defId, level: t.level,
        invested: t.invested, cooldown: t.cooldown,
        shotCount: t.shotCount, hammerCd: t.hammerCd,
        rampMult: t.rampMult, focusUid: t.focusUid, focusStacks: t.focusStacks,
        lastShotAt: t.lastShotAt, aim: t.aim,
      })),
      creeps: this.creeps.map((c) => ({
        uid: c.uid, armor: c.armor, hp: c.hp, maxHp: c.maxHp, speed: c.speed,
        dist: c.dist, size: c.size, isBoss: c.isBoss,
        burnDps: c.burnDps, burnUntil: c.burnUntil,
        stunnedUntil: c.stunnedUntil, markedUntil: c.markedUntil, markedBonus: c.markedBonus,
        slowPct: c.slowPct, slowUntil: c.slowUntil, vulnBonus: c.vulnBonus, vulnUntil: c.vulnUntil,
      })),
      projectiles: this.projectiles.map((p) => ({ ...p })),
      effects: this.effects.map((e) => ({ ...e })),
      floats: this.floats.map((f) => ({ ...f })),
      nextWaveArmor: def.armor,
      lastReject: this.lastReject,
    }
  }

  private snapSeq = 0
  private lastReject: string | undefined

  /**
   * Загрузка снапшота на стороне гостя. Полностью перезаписывает
   * публичное состояние — гость не симулирует, только рендерит.
   */
  applySnap(s: Snap) {
    this.phase = s.phase
    this.wave = s.wave
    this.gold = s.gold
    this.lives = s.lives
    this.speed = s.speed
    this.paused = s.paused
    this.infiniteGold = s.infiniteGold
    this.shop = [...s.shop]
    // карта гостя — та же, что у хоста: генерируем по его зерну
    if (s.mapSeed !== this.mapSeed) this.loadMap(generateMap(s.mapSeed))
    this.time = s.time
    this.previewRemaining = s.previewRemaining
    this.waveSpawned = s.waveSpawned
    this.waveTotal = s.waveTotal
    this.coop = s.coop
    this.stats = { ...s.stats }
    this.avatar = { ...s.avatar }
    this.towers = s.towers.map((t) => ({ ...t }))
    this.creeps = s.creeps.map((c) => ({
      uid: c.uid, armor: c.armor, hp: c.hp, maxHp: c.maxHp, speed: c.speed,
      dist: c.dist, size: c.size, isBoss: c.isBoss,
      gold: 0, livesCost: 1, burnSource: '',
      burnDps: c.burnDps, burnUntil: c.burnUntil,
      stunnedUntil: c.stunnedUntil, markedUntil: c.markedUntil, markedBonus: c.markedBonus,
      goldMult: 1,
      slowPct: c.slowPct, slowUntil: c.slowUntil, vulnBonus: c.vulnBonus, vulnUntil: c.vulnUntil,
    }))
    this.projectiles = s.projectiles.map((p) => ({ ...p }))
    this.effects = s.effects.map((e) => ({ ...e }))
    this.floats = s.floats.map((f) => ({ ...f }))
    if (s.lastReject) {
      this.addFloat(pointAtLength(pathLength() - 120).x, 60, s.lastReject, '#e05252')
      this.lastReject = undefined
    }
  }

  /**
   * Лёгкий тик гостя между снапшотами: только визуальная интерполяция
   * (движение крипов/снарядов/аватара), без урона, спавна и смертей —
   * следующая порция applySnap() всё исправит.
   */
  guestTick(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.05) * this.speed
    if (this.paused) return
    if (this.phase === 'intro' || this.phase === 'over' || this.phase === 'won') return
    this.time += dt
    if (this.phase === 'preview') this.previewRemaining = Math.max(0, this.previewRemaining - dt)
    for (const c of this.creeps) {
      if (this.time >= c.stunnedUntil) c.dist += c.speed * this.slowFactor(c) * dt
    }
    for (const pr of this.projectiles) {
      const tp = pr.targetPos
      if (!tp) continue
      const dx = tp.x - pr.x
      const dy = tp.y - pr.y
      const d = Math.hypot(dx, dy)
      if (d <= pr.speed * dt) {
        pr.x = tp.x
        pr.y = tp.y
      } else {
        pr.x += (dx / d) * pr.speed * dt
        pr.y += (dy / d) * pr.speed * dt
      }
    }
    const av = this.avatar
    if (av.target) {
      const dx = av.target.x - av.x
      const dy = av.target.y - av.y
      const d = Math.hypot(dx, dy)
      if (d <= AVATAR.speed * dt) {
        av.x = av.target.x
        av.y = av.target.y
      } else {
        av.x += (dx / d) * AVATAR.speed * dt
        av.y += (dy / d) * AVATAR.speed * dt
      }
    }
  }

  /** Применение команды гостя на хосте. Возвращает ошибку для релея */
  applyGuestCmd(cmd: GuestCmd): string | null {
    let res: ActionResult
    switch (cmd.t) {
      case 'build':
        res = this.build(cmd.x, cmd.y, cmd.defId)
        break
      case 'upgrade':
        res = this.upgrade(cmd.id)
        break
      case 'sell':
        res = this.sell(cmd.id)
        break
      case 'merge':
        res = this.merge(cmd.a, cmd.b)
        break
      case 'startWave':
        if (this.phase === 'preview') this.startWave()
        return null
      case 'setSpeed':
        this.speed = cmd.speed
        return null
      case 'setPaused':
        this.paused = cmd.paused
        return null
      case 'setInfiniteGold':
        this.setInfiniteGold(cmd.on)
        return null
      case 'roll':
        res = this.roll()
        break
      default:
        return 'Неизвестная команда'
    }
    if (!res.ok && res.error) {
      this.lastReject = res.error
      return res.error
    }
    return null
  }
}
