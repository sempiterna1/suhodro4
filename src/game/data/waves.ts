// Волны миссии и боссы с фазами (GDD: «Враги и броня», «10 — тяжёлая броня»).
//
// Структура миссии (этап 2, 30 волн):
//   1–8   — один тип брони по кругу;
//   9     — денежная; 10 — босс «Колосс Разлома»;
//   11–18 — объявленная заранее броня, в ротации универсалы;
//   19    — денежная; 20 — босс «Матка Разлома» с призывом;
//   21–28 — смешанные волны из двух типов брони;
//   29    — денежная; 30 — финальный 4-фазный «Сердце Разлома».
// HP растёт по формуле hpForWave(n), скорость — waveSpeedMult(n).

import type { ArmorType, WaveKind } from '../types'

export interface WaveDef {
  n: number
  kind: WaveKind
  /** Основной (объявленный) тип брони; на смешанных волнах — первый из armors */
  armor: ArmorType
  /** Все типы брони волны: на 21–30 их два */
  armors: ArmorType[]
  count: number
  hpMult: number
  goldMult: number
  bonusMult: number
  spawnInterval: number
}

export const TOTAL_WAVES = 30

/** Смешанные волны 21–28: пары брони, которые чередуются внутри волны */
const MIXED_PAIRS: ArmorType[][] = [
  ['light', 'heavy'],
  ['medium', 'light'],
  ['heavy', 'universal'],
  ['light', 'medium'],
  ['heavy', 'light'],
  ['universal', 'medium'],
  ['light', 'heavy'],
  ['medium', 'universal'],
]

export const WAVES: WaveDef[] = (() => {
  const early: ArmorType[] = ['light', 'medium', 'heavy']
  // 11–18: «случайный тип, объявленный заранее» (GDD) — фиксированная varied-ротация
  const late: ArmorType[] = ['medium', 'universal', 'light', 'heavy', 'universal']
  const waves: WaveDef[] = []
  const add = (
    n: number,
    kind: WaveKind,
    armors: ArmorType[],
    count: number,
    spawnInterval: number,
    hpMult = 1,
    goldMult = 1,
    bonusMult = 1
  ) => {
    waves.push({ n, kind, armor: armors[0], armors, count, hpMult, goldMult, bonusMult, spawnInterval })
  }

  for (let n = 1; n <= 8; n++) add(n, 'normal', [early[(n - 1) % early.length]], 20, 0.9)

  add(9, 'money', ['light'], 30, 0.7, 0.5, 3, 2)
  add(10, 'boss', ['heavy'], 9, 0.9) // 1 босс + 8 сопровождающих

  for (let n = 11; n <= 18; n++) add(n, 'normal', [late[(n - 11) % late.length]], 22, 0.85)

  add(19, 'money', ['light'], 32, 0.7, 0.5, 3, 2)
  add(20, 'boss', ['universal'], 9, 0.9, 1.15) // Матка Разлома

  // 21–28: смешанные волны, к финалу плотность и HP растут
  const lateHp = [1.3, 1.35, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]
  for (let n = 21; n <= 28; n++) {
    const count = n <= 24 ? 34 : 36
    add(n, 'normal', MIXED_PAIRS[n - 21], count, 0.75, lateHp[n - 21])
  }

  add(29, 'money', ['light', 'universal'], 40, 0.7, 0.5, 3, 2)
  add(30, 'boss', ['universal'], 9, 0.9, 2.0) // Сердце Разлома, 4 фазы
  return waves
})()

/** GDD: скорость крипов +1% за волну, суммарно не больше +25% */
export const waveSpeedMult = (n: number) => 1 + Math.min(0.25, 0.01 * (n - 1))

/**
 * Броня волны с учётом сложности. На Кошмаре с 11-й волны к одиночной броне
 * добавляется вторая: типы чередуются внутри волны. Готовые смешанные волны
 * 21–30 не меняются — они уже состоят из двух типов.
 */
const NIGHTMARE_MIX: ArmorType[] = ['heavy', 'light', 'universal', 'medium']
export function armorsForWave(def: WaveDef, mixedWavesFrom: number | null): ArmorType[] {
  if (mixedWavesFrom === null || def.n < mixedWavesFrom || def.kind === 'boss') return def.armors
  if (def.armors.length > 1) return def.armors
  const offset = def.n - mixedWavesFrom
  let second = NIGHTMARE_MIX[offset % NIGHTMARE_MIX.length]
  for (let k = 1; second === def.armors[0] && k < NIGHTMARE_MIX.length; k++) {
    second = NIGHTMARE_MIX[(offset + k) % NIGHTMARE_MIX.length]
  }
  return [def.armors[0], second]
}

export const BOSS_HP_MULT = 15
export const BOSS_ESCORTS = 8
export const BOSS_SPEED = 24

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
/** Вторая способность босса на Кошмаре: дополнительный призыв вне фаз */
export interface BossNightmareAbility {
  name: string
  every: number
  firstDelay: number
  count: number
  armor: ArmorType
  hpMult: number
}
export interface BossDef {
  name: string
  baseArmor: ArmorType
  phases: BossPhase[] // по убыванию atHp; переходы необратимы
  nightmare?: BossNightmareAbility
}
export const BOSSES: Record<number, BossDef> = {
  10: {
    name: 'Колосс Разлома',
    baseArmor: 'heavy',
    phases: [{ atHp: 0.5, armor: 'heavy', speedMult: 1.35, name: 'Ярость' }],
    nightmare: { name: 'Зов панцирников', every: 12, firstDelay: 6, count: 2, armor: 'heavy', hpMult: 0.6 },
  },
  20: {
    name: 'Матка Разлома',
    baseArmor: 'universal',
    phases: [
      {
        atHp: 0.6,
        armor: 'universal',
        speedMult: 1.1,
        name: 'Зов выводка',
        summon: { count: 3, armor: 'medium', every: 10, hpMult: 0.5 },
      },
      {
        atHp: 0.3,
        armor: 'heavy',
        speedMult: 1.25,
        name: 'Панцирь матки',
        summon: { count: 2, armor: 'universal', every: 8, hpMult: 0.6 },
      },
    ],
    nightmare: { name: 'Волна выводка', every: 10, firstDelay: 6, count: 3, armor: 'medium', hpMult: 0.5 },
  },
  30: {
    name: 'Сердце Разлома',
    baseArmor: 'universal',
    phases: [
      { atHp: 0.75, armor: 'heavy', speedMult: 1.0, name: 'Панцирь' },
      { atHp: 0.5, armor: 'medium', speedMult: 1.15, name: 'Заражённый призыв', summon: { count: 3, armor: 'medium', every: 9, hpMult: 0.5 } },
      { atHp: 0.25, armor: 'light', speedMult: 1.4, name: 'Последний рубеж', summon: { count: 4, armor: 'universal', every: 6, hpMult: 0.5 } },
    ],
    nightmare: { name: 'Пульс Разлома', every: 9, firstDelay: 6, count: 3, armor: 'universal', hpMult: 0.5 },
  },
}
export const bossForWave = (n: number): BossDef | null => BOSSES[n] ?? null
