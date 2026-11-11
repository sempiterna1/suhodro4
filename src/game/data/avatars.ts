// Аватары (GDD, приложение: «Аватар и предметы»): способности, перезарядки, пассивки, опыт.
// ─── Аватары (GDD, приложение — 4 архетипа; имена и профессии в лоре колонии, задача 22) ───
// Способности, перезарядки и пассивки — из таблицы GDD, механики не менялись: Сорока — быстрая
// следопытка конвоя, Кузьма и Гайка — ближе к башням, Фитиль — дальний подрывник и хрупкий.
// ids (hunter/voevoda/archmage/engineer) — внутренние, не менялись: совместимость сохранений и тестов.
export type AvatarId = 'hunter' | 'voevoda' | 'archmage' | 'engineer'
export interface AvatarDef {
  id: AvatarId
  name: string
  role: string
  speed: number
  range: number
  damage: number
  interval: number
  abilityName: string
  abilityCd: number
  abilityDur: number
  abilityDesc: string
  passive: string
  passiveBonus: number // Сорока: +золота за убийство
  xpRadius: number
  maxLevel: number
  xpThresholds: number[]
  color: string
  glyph: string
}

const XP_THRESHOLDS = [0, 3, 7, 12, 18, 25, 33, 42, 52, 65]

export const AVATARS: Record<AvatarId, AvatarDef> = {
  hunter: {
    id: 'hunter', name: 'Сорока', role: 'Следопытка конвоя: дымовой шашкой метит самую сильную тварь',
    speed: 110, range: 110, damage: 6, interval: 0.8,
    abilityName: 'Дымовая шашка', abilityCd: 30, abilityDur: 8,
    abilityDesc: 'Шашка метит цель: +50% урона по ней, награда за голову ×2',
    passive: 'Сдаёт трофеи: +1 золото с каждой твари', passiveBonus: 1,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#7fd0a0', glyph: '💨',
  },
  voevoda: {
    id: 'voevoda', name: 'Кузьма', role: 'Старшина смены: паровым гудком разгоняет башни рядом',
    speed: 95, range: 100, damage: 7, interval: 0.9,
    abilityName: 'Гудок смены', abilityCd: 60, abilityDur: 8,
    abilityDesc: 'Гудок ускоряет башни в радиусе 3 мест: +40% скорости атаки на 8 с',
    passive: 'Авторитет смены: +5% урона башням рядом с аватаром', passiveBonus: 0,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#e05a4a', glyph: '📯',
  },
  archmage: {
    id: 'archmage', name: 'Фитиль', role: 'Подрывник: шахтный заряд бьёт по площади, поддерживает минеральные башни',
    speed: 90, range: 135, damage: 8, interval: 1.0,
    abilityName: 'Шахтный заряд', abilityCd: 45, abilityDur: 0,
    abilityDesc: 'Бросок бомбы: урон по площади, 500% урона аватара',
    passive: 'Точная смесь: +10% урона минеральных (магич.) башен', passiveBonus: 0,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#e06a28', glyph: '🧨',
  },
  engineer: {
    id: 'engineer', name: 'Гайка', role: 'Механик лагеря: перегружает башню паром, выгодно продаёт детали',
    speed: 100, range: 105, damage: 5, interval: 0.7,
    abilityName: 'Перегрузка', abilityCd: 50, abilityDur: 10,
    abilityDesc: 'Ближайшая к аватару башня атакует вдвое быстрее 10 с',
    passive: 'Торгуется за детали: продажа башен возвращает 85% вместо 70%', passiveBonus: 0,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#e0a23a', glyph: '🔧',
  },
}
export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[]
export const SELL_RATIO_ENGINEER = 0.85
export const VOEVODA_RADIUS = 120 // 3 места (клетка 40)

/** Сорока — аватар по умолчанию; константа сохранена для совместимости */
export const AVATAR = {
  name: 'Сорока',
  speed: 110,
  range: 110,
  damage: 6,
  interval: 0.8,
  abilityName: 'Дымовая шашка',
  abilityCd: 30,
  abilityDur: 8,
  abilityDesc: 'Шашка метит цель: +50% урона по ней, награда за голову ×2',
  passive: 'Сдаёт трофеи: +1 золото с каждой твари',
  passiveBonus: 1,
  xpRadius: 150,
  maxLevel: 10,
  // кумулятивный опыт для уровней 2..10
  xpThresholds: [0, 3, 7, 12, 18, 25, 33, 42, 52, 65],
}

export const markBonusForLevel = (level: number) => 0.5 + 0.05 * (level - 1)

