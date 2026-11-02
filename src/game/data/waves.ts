// Волны миссии и боссы с фазами (GDD: «Враги и броня», «10 — тяжёлая броня»).

import type { ArmorType } from '../types'

// ─── Волны: 20 на каждой карте ─────────────────────────────────────────
// GDD: волны 1–10 — один тип брони за волну по кругу; 9-я — денежная, 10-я — босс.
// Волны 11–20: броня варьируется (в ротацию входят универсалы), 19-я — денежная,
// 20-я — финальный Колосс Разлома. HP растёт по формуле hpForWave(n).
export interface WaveDef {
  n: number
  kind: 'normal' | 'money' | 'boss'
  armor: ArmorType
  count: number
  hpMult: number
  goldMult: number
  bonusMult: number
  spawnInterval: number
}

export const TOTAL_WAVES = 20

export const WAVES: WaveDef[] = (() => {
  const cycle: ArmorType[] = ['light', 'medium', 'heavy']
  // 11–20: «случайный тип, объявленный заранее» (GDD) — фиксированная varied-ротация с универсалами
  const cycleLate: ArmorType[] = ['medium', 'universal', 'light', 'heavy', 'universal']
  const waves: WaveDef[] = []
  for (let n = 1; n <= 8; n++) {
    waves.push({
      n,
      kind: 'normal',
      armor: cycle[(n - 1) % 3],
      count: 20,
      hpMult: 1,
      goldMult: 1,
      bonusMult: 1,
      spawnInterval: 0.9,
    })
  }
  waves.push(
    { n: 9, kind: 'money', armor: 'light', count: 30, hpMult: 0.5, goldMult: 3, bonusMult: 2, spawnInterval: 0.7 },
    { n: 10, kind: 'boss', armor: 'heavy', count: 9, hpMult: 1, goldMult: 1, bonusMult: 1, spawnInterval: 0.9 } // 1 босс + 8 сопровождающих
  )
  for (let n = 11; n <= 18; n++) {
    waves.push({
      n,
      kind: 'normal',
      armor: cycleLate[(n - 11) % cycleLate.length],
      count: 20,
      hpMult: 1,
      goldMult: 1,
      bonusMult: 1,
      spawnInterval: 0.85,
    })
  }
  waves.push(
    { n: 19, kind: 'money', armor: 'light', count: 30, hpMult: 0.5, goldMult: 3, bonusMult: 2, spawnInterval: 0.7 },
    { n: 20, kind: 'boss', armor: 'heavy', count: 9, hpMult: 1, goldMult: 1, bonusMult: 1, spawnInterval: 0.9 } // Колосс Разлома
  )
  return waves
})()

/** GDD: скорость крипов +1% за волну, суммарно не больше +25% */
export const waveSpeedMult = (n: number) => 1 + Math.min(0.25, 0.01 * (n - 1))

export const BOSS_HP_MULT = 15
export const BOSS_ESCORTS = 8
export const BOSS_SPEED = 24
export const BOSS_LIVES_COST = 10


// ─── Боссы с фазами (GDD: «10 — тяжёлая броня; 20 — универсальная, призывает;
// финальный меняет тип брони каждые 25% здоровья») ───────────────────────
// Фаза включается, когда доля HP босса падает до atHp. Броня и скорость
// меняются на значения фазы, summon — периодический призыв крипов на позиции босса.
export interface BossSummonDef {
  count: number
  armor: ArmorType
  every: number // интервал призыва, с
  hpMult: number // множитель HP призываемых (мягче обычных крипов волны)
}
export interface BossPhase {
  atHp: number
  armor: ArmorType
  speedMult: number
  name: string // название фазы для всплывающей подписи
  summon?: BossSummonDef
}
export interface BossDef {
  name: string
  baseArmor: ArmorType
  phases: BossPhase[] // по убыванию atHp; переходы необратимы
}
export const BOSSES: Record<number, BossDef> = {
  10: {
    name: 'Колосс Разлома',
    baseArmor: 'heavy',
    phases: [
      { atHp: 0.5, armor: 'heavy', speedMult: 1.35, name: 'Ярость' },
    ],
  },
  20: {
    name: 'Сердце Разлома',
    baseArmor: 'universal',
    phases: [
      { atHp: 0.75, armor: 'heavy', speedMult: 1.0, name: 'Панцирь' },
      { atHp: 0.5, armor: 'medium', speedMult: 1.15, name: 'Заражённый призыв', summon: { count: 3, armor: 'medium', every: 9, hpMult: 0.5 } },
      { atHp: 0.25, armor: 'light', speedMult: 1.4, name: 'Последний рубеж', summon: { count: 4, armor: 'universal', every: 6, hpMult: 0.5 } },
    ],
  },
}
export const bossForWave = (n: number): BossDef | null => BOSSES[n] ?? null

