// Сложности миссии (GDD: «Карты и сложности»).
// Три режима отличаются HP заражённых, стартовым золотом и запасом прочности
// главного здания. Кошмар дополнительно смешивает броню с 11-й волны и даёт
// каждому боссу вторую способность — дополнительный призыв подкреплений.
//
// Целевой win-rate — ориентир для симулятора и плейтестов, а не жёсткое правило:
// Новобранец ≈ 70%, Ветеран ≈ 50%, Кошмар ≈ 30% на первой карте.

export type DifficultyId = 'recruit' | 'veteran' | 'nightmare'

export interface DifficultyDef {
  id: DifficultyId
  name: string
  short: string // короткое имя для HUD и отчётов
  desc: string
  color: string
  /** Множитель HP всех крипов и боссов */
  creepHpMult: number
  /**
   * За сколько волн множитель HP выходит на полную силу (0 — сразу).
   * Нужен Кошмару: ×1.4 с первой волны — это стена на старте, когда у игрока
   * всего 120 золота и две башни.
   */
  hpRampWaves: number
  /** Стартовое золото миссии */
  startGold: number
  /** Множитель HP главного здания относительно BUILDING_BASE_HP */
  buildingHpMult: number
  /** Сколько волн брони показывать заранее (1 — ближайшая, 2 — Новобранец) */
  armorForecastWaves: number
  /** С какой волны смешивать два типа брони (null — не смешивать) */
  mixedWavesFrom: number | null
  /** Вторая способность боссов (дополнительный призыв) */
  bossExtraAbility: boolean
  /** Ориентир win-rate для первой карты, % */
  targetWinRate: number
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  recruit: {
    id: 'recruit',
    name: 'Новобранец',
    short: 'Новобранец',
    desc: 'Заражённые слабее, золота больше, здание крепче. Броня следующей волны видна на две волны вперёд.',
    color: '#7fd0a0',
    creepHpMult: 0.75,
    hpRampWaves: 0,
    startGold: 200,
    buildingHpMult: 1.4,
    armorForecastWaves: 2,
    mixedWavesFrom: null,
    bossExtraAbility: false,
    targetWinRate: 70,
  },
  veteran: {
    id: 'veteran',
    name: 'Ветеран',
    short: 'Ветеран',
    desc: 'Базовая миссия: стандартные HP, золото и прочность здания. Броня следующей волны видна заранее.',
    color: '#f2c94c',
    creepHpMult: 1.0,
    hpRampWaves: 0,
    startGold: 150,
    buildingHpMult: 1.0,
    armorForecastWaves: 1,
    mixedWavesFrom: null,
    bossExtraAbility: false,
    targetWinRate: 50,
  },
  nightmare: {
    id: 'nightmare',
    name: 'Кошмар',
    short: 'Кошмар',
    desc: 'Заражённые крепче, золота меньше, здание хрупче. С 11-й волны броня смешана, у боссов вторая способность.',
    color: '#e05252',
    creepHpMult: 1.4,
    hpRampWaves: 9,
    startGold: 120,
    buildingHpMult: 0.75,
    armorForecastWaves: 1,
    mixedWavesFrom: 11,
    bossExtraAbility: true,
    targetWinRate: 30,
  },
}

export const DIFFICULTY_IDS: DifficultyId[] = ['recruit', 'veteran', 'nightmare']

export const DEFAULT_DIFFICULTY: DifficultyId = 'veteran'

export const difficultyDef = (id: DifficultyId): DifficultyDef => DIFFICULTIES[id] ?? DIFFICULTIES.veteran
