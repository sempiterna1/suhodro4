// Поле боя, сетка и карты (GDD: «Карты и сложности»).
// ─── Поле и сетка ────────────────────────────────────────────────────────
// Тропа генерируется по зерну для каждой игры — см. map.ts (зерно 0 — классическая змейка)
export const MAP_W = 1280
export const MAP_H = 720
export const CELL = 40 // сетка 32×18 клеток; одна башня — одна клетка

export const PATH_WIDTH = 36 // ширина настила тропы (меньше клетки — видны края)

export const SPOT_RADIUS = 18 // платформа башни внутри клетки
// Максимальная дистанция между башнями для слияния (аналог «соседних площадок»)
export const MERGE_DIST = 140


import type { BiomeId } from '../biomes'

// ─── Карты (GDD: «Карты и сложности») ───────────────────────────────────
// У каждой карты фиксированное зерно — тропа всегда одна и та же (GDD: «Тропы
// фиксированы и видны с начала матча»), у хоста и гостя совпадает автоматически.
// Сами узоры троп заданы в map.ts (PATH_SHAPES): у каждой карты свой характерный вид.
// Биом задаёт визуальный облик карты (biomes.ts): палитра, пропсы, атмосфера.
export interface MapDef {
  id: string
  name: string
  feature: string // особенность из GDD
  seed: number
  biome: BiomeId // визуальный облик карты
  creepSpeedMult: number // «Ледяной перевал: крипы быстрее на 10%»
  universalExtra: number // «Пепельная долина»: +N универсальных врагов в обычной волне
  /**
   * За сколько волн добавляется ещё один универсальный враг (0/undefined — все
   * с первой волны). Ранние волны финала не должны получать сразу весь пакет:
   * иначе +3 универсала с 1-й волны роняют экономику (см. worklog Task 30).
   */
  universalExtraRamp?: number
  /** GDD «Второй выход»: с этой волны открывается второй портал, крипы делятся поровну */
  secondExitWave?: number
  /** Метапрогрессия (docs/meta.md): множитель HP заражённых — лесенка «каждая карта сложнее предыдущей» */
  hpMult: number
  /**
   * За сколько волн множитель HP карты выходит на полную силу (0/undefined — сразу).
   * Как hpRampWaves у сложности: финальные карты с короткой тропой не должны
   * быть стеной на старте, когда у игрока всего две башни (см. worklog Task 30).
   */
  hpRampWaves?: number
}

export const MAP_DEFS: MapDef[] = [
  { id: 'tract', name: 'Пограничный тракт', feature: 'обучающая: простая тропа, много мест', seed: 0, biome: 'taiga', creepSpeedMult: 1, universalExtra: 0, hpMult: 1.0 },
  { id: 'mill', name: 'Старая мельница', feature: 'длинная петля — простор для площадных башен', seed: 47, biome: 'marsh', creepSpeedMult: 1, universalExtra: 0, hpMult: 1.08 },
  { id: 'bridge', name: 'Каменный мост', feature: 'тропа извилиста, мест мало — сливайте башни', seed: 1, biome: 'canyon', creepSpeedMult: 1, universalExtra: 0, hpMult: 1.16 },
  { id: 'mines', name: 'Заброшенные шахты', feature: 'короткая тропа — максимум мест под стройку', seed: 150, biome: 'wasteland', creepSpeedMult: 1, universalExtra: 0, hpMult: 1.24 },
  { id: 'pass', name: 'Ледяной перевал', feature: 'заражённые быстрее на 10%', seed: 3, biome: 'highland', creepSpeedMult: 1.1, universalExtra: 0, hpMult: 1.32 },
  { id: 'valley', name: 'Пепельная долина', feature: 'универсальные враги прибывают всё плотнее; крепость растёт к 25-й волне; с 16-й — второй выход', seed: 8, biome: 'ashvalley', creepSpeedMult: 1, universalExtra: 3, universalExtraRamp: 16, secondExitWave: 16, hpMult: 1.4, hpRampWaves: 24 },
]

/** Определение карты по зерну (зерно уникально в рамках MAP_DEFS) */
export const mapDefBySeed = (seed: number): MapDef =>
  MAP_DEFS.find((d) => d.seed === seed) ?? MAP_DEFS[0]

