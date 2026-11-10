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


// ─── Карты (GDD: «Карты и сложности») ───────────────────────────────────
// У каждой карты фиксированное зерно — тропа всегда одна и та же (GDD: «Тропы
// фиксированы и видны с начала матча»), у хоста и гостя совпадает автоматически.
// Сами узоры троп заданы в map.ts (PATH_SHAPES): у каждой карты свой характерный вид.
export interface MapDef {
  id: string
  name: string
  feature: string // особенность из GDD
  seed: number
  creepSpeedMult: number // «Ледяной перевал: крипы быстрее на 10%»
  universalExtra: number // «Пепельная долина»: +N универсальных врагов в обычной волне
  /** GDD «Второй выход»: с этой волны открывается второй портал, крипы делятся поровну */
  secondExitWave?: number
}

export const MAP_DEFS: MapDef[] = [
  { id: 'tract', name: 'Пограничный тракт', feature: 'обучающая: простая тропа, много мест', seed: 0, creepSpeedMult: 1, universalExtra: 0 },
  { id: 'mill', name: 'Старая мельница', feature: 'длинная петля — простор для площадных башен', seed: 47, creepSpeedMult: 1, universalExtra: 0 },
  { id: 'bridge', name: 'Каменный мост', feature: 'тропа извилиста, мест мало — сливайте башни', seed: 1, creepSpeedMult: 1, universalExtra: 0 },
  { id: 'mines', name: 'Заброшенные шахты', feature: 'короткая тропа — максимум мест под стройку', seed: 150, creepSpeedMult: 1, universalExtra: 0 },
  { id: 'pass', name: 'Ледяной перевал', feature: 'заражённые быстрее на 10%', seed: 3, creepSpeedMult: 1.1, universalExtra: 0 },
  { id: 'valley', name: 'Пепельная долина', feature: 'универсальные враги в каждой волне; с 16-й волны — второй выход', seed: 8, creepSpeedMult: 1, universalExtra: 3, secondExitWave: 16 },
]

/** Определение карты по зерну (зерно уникально в рамках MAP_DEFS) */
export const mapDefBySeed = (seed: number): MapDef =>
  MAP_DEFS.find((d) => d.seed === seed) ?? MAP_DEFS[0]

