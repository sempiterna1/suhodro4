// Аватары (GDD, приложение: «Аватар и предметы»): способности, перезарядки, пассивки, опыт.
// ─── Аватары (GDD, приложение: «Аватар и предметы» — 4 архетипа, не утверждены окончательно) ───
// Способности, перезарядки и пассивки — из таблицы GDD. Чисел скорости, дальности и урона аватаров в GDD нет —
// они подобраны разумно: Охотница — быстрая стрелок-разведчица, Воевода и Инженер — ближе к башням, Архимаг — дальний и хрупкий.
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
  passiveBonus: number // Охотница: +золота за убийство
  xpRadius: number
  maxLevel: number
  xpThresholds: number[]
  color: string
  glyph: string
}

const XP_THRESHOLDS = [0, 3, 7, 12, 18, 25, 33, 42, 52, 65]

export const AVATARS: Record<AvatarId, AvatarDef> = {
  hunter: {
    id: 'hunter', name: 'Охотница', role: 'Разведчица: метит самую сильную цель',
    speed: 110, range: 110, damage: 6, interval: 0.8,
    abilityName: 'Метка добычи', abilityCd: 30, abilityDur: 8,
    abilityDesc: 'Цель получает +50% урона, золото за неё ×2',
    passive: '+1 золото за каждое убийство', passiveBonus: 1,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#7fd0a0', glyph: '🏹',
  },
  voevoda: {
    id: 'voevoda', name: 'Воевода', role: 'Командир: разгоняет башни рядом',
    speed: 95, range: 100, damage: 7, interval: 0.9,
    abilityName: 'Боевой клич', abilityCd: 60, abilityDur: 8,
    abilityDesc: 'Башни в радиусе 3 мест получают +40% скорости атаки на 8 с',
    passive: '+5% урона башням рядом с аватаром', passiveBonus: 0,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#e05a4a', glyph: '🚩',
  },
  archmage: {
    id: 'archmage', name: 'Архимаг', role: 'Чародей: бьёт по площади, усиливает магию',
    speed: 90, range: 135, damage: 8, interval: 1.0,
    abilityName: 'Метеор', abilityCd: 45, abilityDur: 0,
    abilityDesc: 'Магический урон по площади, 500% урона аватара',
    passive: '+10% урона магическим башням', passiveBonus: 0,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#8d7af0', glyph: '☄',
  },
  engineer: {
    id: 'engineer', name: 'Инженер', role: 'Механик: ускоряет башню, выгодная продажа',
    speed: 100, range: 105, damage: 5, interval: 0.7,
    abilityName: 'Перегрузка', abilityCd: 50, abilityDur: 10,
    abilityDesc: 'Ближайшая к аватару башня атакует вдвое быстрее 10 с',
    passive: 'Продажа башен возвращает 85% вместо 70%', passiveBonus: 0,
    xpRadius: 150, maxLevel: 10, xpThresholds: XP_THRESHOLDS, color: '#e0a23a', glyph: '🔧',
  },
}
export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[]
export const SELL_RATIO_ENGINEER = 0.85
export const VOEVODA_RADIUS = 120 // 3 места (клетка 40)

/** Охотница — аватар по умолчанию; константа сохранена для совместимости */
export const AVATAR = {
  name: 'Охотница',
  speed: 110,
  range: 110,
  damage: 6,
  interval: 0.8,
  abilityName: 'Метка добычи',
  abilityCd: 30,
  abilityDur: 8,
  abilityDesc: 'Цель получает +50% урона, золото за неё ×2',
  passive: '+1 золото за каждое убийство',
  passiveBonus: 1,
  xpRadius: 150,
  maxLevel: 10,
  // кумулятивный опыт для уровней 2..10
  xpThresholds: [0, 3, 7, 12, 18, 25, 33, 42, 52, 65],
}

export const markBonusForLevel = (level: number) => 0.5 + 0.05 * (level - 1)

