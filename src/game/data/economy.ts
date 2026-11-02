// Экономика и уровни башен: золото, HP волн, продажа, прокачка, магазин, паузы.

// ─── Формулы экономики (GDD: «Экономика») ───────────────────────────────
export const HP_BASE = 60
export const hpForWave = (n: number) =>
  HP_BASE * (1 + 0.15 * n) * Math.pow(1.1, n)

// Плейтест v2.1: волны проходятся слишком тяжело — глобальный −30% HP
export const HP_PLAYTEST_MULT = 0.7

// Кооп-скейлинг из GDD: HP волн при 2 игроках ×1.85 (3 игрока ×2.7, 4 ×3.55)
export const COOP_HP_MULT = 1.85

export const goldForKill = (n: number) => Math.floor(2 + n / 3)
export const waveBonus = (n: number) => 25 + 6 * n

export const START_GOLD = 150
export const START_LIVES = 20
export const BOSS_GOLD_MULT = 20

// ─── Уровни башен (GDD: «Башни и уровни») ───────────────────────────────
export const LEVEL_MULT = [1.0, 1.9, 3.2, 5.0, 7.5]
export const MAX_LEVEL = 5
export const SELL_RATIO = 0.7
export const MERGE_MIN_LEVEL = 3

// Множитель урона и модификаторы уровня
export function levelDamageMult(level: number) {
  return LEVEL_MULT[level - 1]
}
export function levelRangeMult(level: number) {
  return level >= 4 ? 1.1 : level >= 2 ? 1.05 : 1.0
}
export function levelIntervalMult(level: number) {
  return level >= 3 ? 0.9 : 1.0
}

// ─── Арсенал с роллом (отход от GDD «все башни доступны сразу») ─────────
// В продаже — пул из SHOP_SIZE разных башен; ролл за ROLL_COST золота меняет весь пул.
export const SHOP_SIZE = 5
export const ROLL_COST = 10

// Чит «бесконечное золото» для тестов: золото держится на этом уровне
export const INFINITE_GOLD = 99999

// Пауза между волнами (GDD: «Пауза 20 секунд»)
export const PREVIEW_TIME = 20
export const FIRST_PREVIEW_TIME = 12
