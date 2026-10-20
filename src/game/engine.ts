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
  DAMAGE_MATRIX,
  FIRST_PREVIEW_TIME,
  LEVEL_MULT,
  MAP_H,
  MAP_W,
  MERGE_MIN_LEVEL,
  MERGED_TOWERS,
  NEIGHBOR_DIST,
  PATH,
  PREVIEW_TIME,
  SELL_RATIO,
  SPOTS,
  START_GOLD,
  START_LIVES,
  TOTAL_WAVES,
  WAVES,
  goldForKill,
  hpForWave,
  levelDamageMult,
  levelIntervalMult,
  levelRangeMult,
  markBonusForLevel,
  waveBonus,
} from './config'
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

// ─── Утилиты пути ────────────────────────────────────────────────────────
const segLen: number[] = []
const segStart: number[] = []
let pathLength = 0
{
  let acc = 0
  for (let i = 0; i < PATH.length - 1; i++) {
    const dx = PATH[i + 1].x - PATH[i].x
    const dy = PATH[i + 1].y - PATH[i].y
    const len = Math.hypot(dx, dy)
    segLen.push(len)
    segStart.push(acc)
    acc += len
  }
  pathLength = acc
}

export function pointAtLength(d: number): Vec {
  if (d <= 0) return { x: PATH[0].x, y: PATH[0].y }
  if (d >= pathLength) {
    const last = PATH[PATH.length - 1]
    return { x: last.x, y: last.y }
  }
  for (let i = 0; i < segLen.length; i++) {
    if (d <= segStart[i] + segLen[i]) {
      const t = (d - segStart[i]) / segLen[i]
      return {
        x: PATH[i].x + (PATH[i + 1].x - PATH[i].x) * t,
        y: PATH[i].y + (PATH[i + 1].y - PATH[i].y) * t,
      }
    }
  }
  const last = PATH[PATH.length - 1]
  return { x: last.x, y: last.y }
}

// ─── Соседство площадок (для слияния) ───────────────────────────────────
export const NEIGHBORS: number[][] = SPOTS.map((a, i) =>
  SPOTS.map((b, j) => (i !== j && Math.hypot(a.x - b.x, a.y - b.y) <= NEIGHBOR_DIST ? j : -1)).filter(
    (j) => j >= 0
  )
)

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

export interface ActionResult {
  ok: boolean
  error?: string
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
  time = 0
  previewRemaining = 0

  creeps: Creep[] = []
  towers: (Tower | undefined)[] = new Array(SPOTS.length).fill(undefined)
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
    this.time = 0
    this.previewRemaining = 0
    this.creeps = []
    this.towers = new Array(SPOTS.length).fill(undefined)
    this.projectiles = []
    this.effects = []
    this.floats = []
    this.avatar = { x: 90, y: 260, target: null, level: 1, xp: 0, cooldown: 0, attackCd: 0 }
    this.stats = { kills: 0, leaked: 0, goldEarned: 0, merges: 0, bossKills: 0 }
    this.spawnQueue = []
    this.waveSpawned = 0
    this.waveTotal = 0
  }

  beginPreview() {
    if (this.phase !== 'intro' && this.phase !== 'wave') return
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

  // ─── Действия игрока ──────────────────────────────────────────────────
  canBuild(spot: number, defId: string): boolean {
    const def = ALL_DEFS[defId]
    return !this.towers[spot] && !!def && this.gold >= def.price
  }

  build(spot: number, defId: string): ActionResult {
    const def = ALL_DEFS[defId]
    if (!def) return { ok: false, error: 'Нет такой башни' }
    if (this.towers[spot]) return { ok: false, error: 'Место занято' }
    if (this.gold < def.price) return { ok: false, error: 'Не хватает золота' }
    this.gold -= def.price
    this.towers[spot] = {
      spot,
      defId,
      level: 1,
      invested: def.price,
      cooldown: 0,
      shotCount: 0,
      hammerCd: 0,
    }
    return { ok: true }
  }

  upgrade(spot: number): ActionResult {
    const tw = this.towers[spot]
    if (!tw) return { ok: false, error: 'Башни нет' }
    if (tw.level >= 5) return { ok: false, error: 'Максимальный уровень' }
    const cost = upgradeCost(ALL_DEFS[tw.defId])
    if (this.gold < cost) return { ok: false, error: 'Не хватает золота' }
    this.gold -= cost
    tw.invested += cost
    tw.level += 1
    return { ok: true }
  }

  sell(spot: number): ActionResult {
    const tw = this.towers[spot]
    if (!tw) return { ok: false, error: 'Башни нет' }
    const refund = Math.floor(tw.invested * SELL_RATIO)
    this.gold += refund
    this.towers[spot] = undefined
    this.addFloat(SPOTS[spot].x, SPOTS[spot].y - 24, `+${refund}`, '#e8c170')
    return { ok: true }
  }

  canMerge(a: number, b: number): MergeDef | null {
    const ta = this.towers[a]
    const tb = this.towers[b]
    if (!ta || !tb || a === b) return null
    if (ta.level < MERGE_MIN_LEVEL || tb.level < MERGE_MIN_LEVEL) return null
    const da = ALL_DEFS[ta.defId]
    const db = ALL_DEFS[tb.defId]
    if (da.merged || db.merged) return null
    if (!NEIGHBORS[a].includes(b)) return null
    return findRecipe(ta.defId, tb.defId)
  }

  merge(a: number, b: number): ActionResult {
    const recipe = this.canMerge(a, b)
    if (!recipe) return { ok: false, error: 'Слияние невозможно' }
    const ta = this.towers[a]!
    const tb = this.towers[b]!
    const level = Math.min(ta.level, tb.level)
    const invested = ta.invested + tb.invested
    this.towers[b] = { spot: b, defId: recipe.id, level, invested, cooldown: 0, shotCount: 0, hammerCd: 0 }
    this.towers[a] = undefined
    this.stats.merges++
    this.addFloat(SPOTS[b].x, SPOTS[b].y - 30, recipe.glyph + ' ' + recipe.name, '#f0a44a')
    this.effects.push({ x: SPOTS[b].x, y: SPOTS[b].y, r: 46, born: this.time, dur: 0.8, color: '#f0a44a', kind: 'blast' })
    return { ok: true }
  }

  mergeTargetsFor(spot: number): number[] {
    const tw = this.towers[spot]
    if (!tw || tw.level < MERGE_MIN_LEVEL) return []
    return NEIGHBORS[spot].filter((n) => !!this.canMerge(spot, n))
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
        hp = hpForWave(def.n) * BOSS_HP_MULT
        speed = BOSS_SPEED
        size = 26
        gold = goldForKill(def.n) * BOSS_GOLD_MULT
        livesCost = BOSS_LIVES_COST
      } else {
        hp = hpForWave(def.n) * ARMOR_HP_MULT[o.armor] * def.hpMult
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
        c.dist += c.speed * dt
      }
      if (c.dist >= pathLength) {
        // прорвался
        this.lives -= c.livesCost
        this.stats.leaked++
        const exit = pointAtLength(pathLength - 30)
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

  private updateTowers(dt: number) {
    for (const tw of this.towers) {
      if (!tw) continue
      const def = ALL_DEFS[tw.defId]
      const spot = SPOTS[tw.spot]
      tw.cooldown -= dt

      // Пассивка Молотобойца 5 ур.: оглушение группы раз в 8 с
      if (def.id === 'mauler' && tw.level >= 5) {
        tw.hammerCd -= dt
        if (tw.hammerCd <= 0) {
          const range = def.range * levelRangeMult(tw.level)
          const inRange = this.creeps.filter(
            (c) => {
              const p = pointAtLength(c.dist)
              return Math.hypot(p.x - spot.x, p.y - spot.y) <= range
            }
          )
          if (inRange.length > 0) {
            for (const c of inRange) c.stunnedUntil = Math.max(c.stunnedUntil, this.time + 1.2)
            tw.hammerCd = 8
            this.effects.push({ x: spot.x, y: spot.y, r: range, born: this.time, dur: 0.5, color: '#d09a4e', kind: 'stun' })
          }
        }
      }

      if (tw.cooldown > 0) continue
      const range = def.range * levelRangeMult(tw.level)
      // цель: крип, дальше всех по тропе в радиусе
      let target: Creep | null = null
      for (const c of this.creeps) {
        const p = pointAtLength(c.dist)
        if (Math.hypot(p.x - spot.x, p.y - spot.y) <= range) {
          if (!target || c.dist > target.dist) target = c
        }
      }
      if (!target) continue

      tw.cooldown = def.interval * levelIntervalMult(tw.level)
      tw.shotCount++
      this.fireTower(tw, def, target, range)
    }
  }

  private fireTower(tw: Tower, def: TowerDefinition, target: Creep, range: number) {
    const spot = SPOTS[tw.spot]
    const dmg = def.damage * levelDamageMult(tw.level)
    let burn = def.burn ? { ...def.burn } : undefined
    let splash = def.splash

    // Способности 5 уровня
    let crit = false
    let shots = 1
    if (!def.merged) {
      if (def.id === 'sentry' && tw.level >= 5 && target.isBoss) {
        // +20% урона по боссам — учтём множителем
      }
      if (def.id === 'archer' && tw.level >= 5) shots = 2
      if (def.id === 'crossbow' && tw.level >= 5 && tw.shotCount % 5 === 0) crit = true
      if (def.id === 'pyro' && tw.level >= 5) {
        // огонь перекидывается — подожжём ещё одного крипа рядом с целью
        const tp = pointAtLength(target.dist)
        const near = this.creeps.find(
          (c) => c !== target && Math.hypot(pointAtLength(c.dist).x - tp.x, pointAtLength(c.dist).y - tp.y) <= 60
        )
        if (near) this.applyBurn(near, burn, def.id)
      }
    } else {
      if (def.id === 'flame_archer' && tw.level >= 5 && burn) burn = { dps: burn.dps * 2, dur: burn.dur }
      if (def.id === 'volcano' && tw.level >= 5 && splash) splash = splash * 1.3
    }

    const fire = (c: Creep, dmgMult = 1) => {
      let d = dmg * dmgMult
      if (def.id === 'sentry' && tw.level >= 5 && c.isBoss) d *= 1.2
      if (crit) d *= 3
      this.projectiles.push({
        uid: this.uid++,
        x: spot.x,
        y: spot.y,
        targetUid: c.uid,
        targetPos: pointAtLength(c.dist),
        speed: def.projSpeed,
        damage: d,
        attacks: def.merged ? [...def.attacks] : [def.attack],
        splash: splash,
        burn: burn,
        sourceDefId: def.id,
        sourceLevel: tw.level,
        color: def.color,
        kind:
          def.id === 'catapult' || def.id === 'volcano'
            ? 'rock'
            : def.id === 'crossbow'
              ? 'bolt'
              : def.id === 'pyro'
                ? 'orb'
                : def.id === 'mauler'
                  ? 'hammer'
                  : 'arrow',
        crit,
      })
    }

    if (shots === 2) {
      fire(target)
      const second = this.creeps.find((c) => c !== target) ?? target
      fire(second)
    } else {
      fire(target)
    }
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
        if (pr.splash) {
          const r = pr.splash
          for (const c of [...this.creeps]) {
            const p = pointAtLength(c.dist)
            if (Math.hypot(p.x - pr.x, p.y - pr.y) <= r + c.size) {
              this.damageCreep(c, pr.damage, pr.attacks)
              if (pr.burn) this.applyBurn(c, pr.burn, pr.sourceDefId)
            }
          }
          this.effects.push({ x: pr.x, y: pr.y, r: r, born: this.time, dur: 0.35, color: pr.color, kind: 'blast' })
        } else if (target) {
          this.damageCreep(target, pr.damage, pr.attacks)
          if (pr.burn) this.applyBurn(target, pr.burn, pr.sourceDefId)
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
      previewRemaining: Math.max(0, this.previewRemaining),
      waveSpawned: this.waveSpawned,
      waveTotal: this.waveTotal,
      creepsAlive: this.creeps.length,
      speed: this.speed,
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
}
