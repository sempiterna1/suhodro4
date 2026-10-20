// Конфигурация баланса прототипа — все формулы и числа из GDD_Tower_Defense_v2
// «Данные баланса: JSON/ресурсы конфигурации — баланс без перекомпиляции»

import type {
  ArmorType,
  AttackType,
  MergeDef,
  TowerDef,
  Vec,
} from './types'

// ─── Матрица урона (GDD: «Матрица урона») ───────────────────────────────
// Специализированная атака бьёт «свою» броню на 150%,
// универсальная — любую на 80%, кроме универсальной брони.
export const DAMAGE_MATRIX: Record<AttackType, Record<ArmorType, number>> = {
  pierce: { light: 1.5, medium: 1.0, heavy: 0.7, universal: 0.9 },
  crush: { light: 0.7, medium: 1.5, heavy: 1.0, universal: 0.9 },
  magic: { light: 1.0, medium: 0.7, heavy: 1.5, universal: 0.9 },
  universal: { light: 0.8, medium: 0.8, heavy: 0.8, universal: 1.2 },
}

// Множители HP по типу брони (GDD: «Враги и броня»)
export const ARMOR_HP_MULT: Record<ArmorType, number> = {
  light: 0.7,
  medium: 1.0,
  heavy: 1.4,
  universal: 1.1,
}

export const ARMOR_SPEED: Record<ArmorType, number> = {
  light: 40,
  medium: 34,
  heavy: 28,
  universal: 34,
}

export const ARMOR_NAMES: Record<ArmorType, string> = {
  light: 'Лёгкая',
  medium: 'Средняя',
  heavy: 'Тяжёлая',
  universal: 'Универсальная',
}

export const ARMOR_COLORS: Record<ArmorType, string> = {
  light: '#d4b483',
  medium: '#9aa0a6',
  heavy: '#6b6f76',
  universal: '#7aa874',
}

export const ATTACK_NAMES: Record<AttackType, string> = {
  pierce: 'Пронзающая',
  crush: 'Сокрушающая',
  magic: 'Магическая',
  universal: 'Универсальная',
}

// ─── Формулы экономики (GDD: «Экономика») ───────────────────────────────
export const HP_BASE = 60
export const hpForWave = (n: number) =>
  HP_BASE * (1 + 0.15 * n) * Math.pow(1.1, n)

// Плейтест v2.1: волны проходятся слишком тяжело — глобальный −30% HP
export const HP_PLAYTEST_MULT = 0.7

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

// ─── 6 башен прототипа (GDD: «15 боевых башен», срез прототипа) ─────────
export const TOWERS: TowerDef[] = [
  {
    id: 'sentry',
    name: 'Стражник',
    attack: 'universal',
    price: 40,
    damage: 6,
    interval: 0.75,
    range: 120,
    projSpeed: 420,
    color: '#b0a08a',
    glyph: '🛡',
    role: 'дешёвая стартовая',
    l5: '+20% урона по боссам',
    merged: false,
  },
  {
    id: 'archer',
    name: 'Лучница',
    attack: 'pierce',
    price: 50,
    damage: 5,
    interval: 0.5,
    range: 140,
    projSpeed: 520,
    color: '#8fae6b',
    glyph: '🏹',
    role: 'быстрая, одна цель',
    l5: 'Двойной выстрел',
    merged: false,
  },
  {
    id: 'crossbow',
    name: 'Арбалетчик',
    attack: 'pierce',
    price: 90,
    damage: 15,
    interval: 1.0,
    range: 150,
    projSpeed: 620,
    color: '#7f9bb3',
    glyph: '🎯',
    role: 'критический урон',
    l5: 'Крит ×3 каждый 5-й выстрел',
    merged: false,
  },
  {
    id: 'catapult',
    name: 'Камнемёт',
    attack: 'crush',
    price: 70,
    damage: 12,
    interval: 1.7,
    range: 130,
    projSpeed: 240,
    splash: 55,
    color: '#c2874f',
    glyph: '💥',
    role: 'урон по площади',
    l5: 'Осколки после удара',
    merged: false,
  },
  {
    id: 'mauler',
    name: 'Молотобоец',
    attack: 'crush',
    price: 110,
    damage: 20,
    interval: 1.1,
    range: 100,
    projSpeed: 480,
    stunChance: 0.15,
    color: '#d09a4e',
    glyph: '🔨',
    role: 'оглушение',
    l5: 'Оглушение группы раз в 8 с',
    merged: false,
  },
  {
    id: 'pyro',
    name: 'Пиромант',
    attack: 'magic',
    price: 70,
    damage: 7,
    interval: 1.0,
    range: 120,
    projSpeed: 380,
    burn: { dps: 4, dur: 3 },
    color: '#d4694f',
    glyph: '🔥',
    role: 'горение со временем',
    l5: 'Огонь перекидывается на соседей',
    merged: false,
  },
]

// ─── Слитые башни (GDD: «Слияние башен», 2 из 12 рецептов) ──────────────
export const MERGED_TOWERS: MergeDef[] = [
  {
    id: 'flame_archer',
    name: 'Огненная лучница',
    parents: ['archer', 'pyro'],
    price: 60,
    attacks: ['pierce', 'magic'],
    damage: 7,
    interval: 0.5,
    range: 145,
    projSpeed: 520,
    burn: { dps: 5, dur: 3 },
    color: '#e0863f',
    glyph: '☄',
    desc: 'Горящие стрелы, поджог скапливается',
    l5: 'Горение вдвое сильнее',
    merged: true,
  },
  {
    id: 'volcano',
    name: 'Вулкан',
    parents: ['catapult', 'pyro'],
    price: 70,
    attacks: ['crush', 'magic'],
    damage: 16,
    interval: 1.8,
    range: 140,
    projSpeed: 240,
    splash: 60,
    burn: { dps: 6, dur: 3 },
    color: '#c74e2e',
    glyph: '🌋',
    desc: 'Снаряды оставляют лужи лавы',
    l5: 'Радиус взрыва +30%',
    merged: true,
  },
]

export const ALL_DEFS: Record<string, TowerDef | MergeDef> = Object.fromEntries(
  [...TOWERS, ...MERGED_TOWERS].map((d) => [d.id, d])
)

// ─── Карта «Пограничный тракт» (карта 1 из GDD) ─────────────────────────
export const MAP_W = 960
export const MAP_H = 600

// Фиксированная тропа — змейка от левого входа к правому выходу
export const PATH: Vec[] = [
  { x: -30, y: 150 },
  { x: 240, y: 150 },
  { x: 240, y: 450 },
  { x: 480, y: 450 },
  { x: 480, y: 150 },
  { x: 720, y: 150 },
  { x: 720, y: 450 },
  { x: 990, y: 450 },
]

export const PATH_WIDTH = 44

// ─── Свободная постройка (плейтест v2.1: башни можно ставить где угодно) ──
export const SPOT_RADIUS = 20
// Минимальная дистанция от центра тропы (тропа 44px + запас под платформу)
export const BUILD_PATH_CLEAR = 42
// Минимальная дистанция между башнями (платформы не перекрываются)
export const TOWER_GAP = 44
// Минимальная дистанция от Охотницы при постройке
export const AVATAR_BUILD_CLEAR = 28
// Максимальная дистанция между башнями для слияния (аналог «соседних площадок»)
export const MERGE_DIST = 140

// ─── Волны прототипа: 10 волн до первого босса ──────────────────────────
// GDD: волны 1–10 — один тип брони за волну, по кругу;
// 9-я — денежная, 10-я — босс.
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

export const TOTAL_WAVES = 10

export const WAVES: WaveDef[] = (() => {
  const cycle: ArmorType[] = ['light', 'medium', 'heavy']
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
  waves.push({
    n: 9,
    kind: 'money',
    armor: 'light',
    count: 30,
    hpMult: 0.5,
    goldMult: 3,
    bonusMult: 2,
    spawnInterval: 0.7,
  })
  waves.push({
    n: 10,
    kind: 'boss',
    armor: 'heavy',
    count: 9, // 1 босс + 8 сопровождающих
    hpMult: 1,
    goldMult: 1,
    bonusMult: 1,
    spawnInterval: 0.9,
  })
  return waves
})()

export const BOSS_HP_MULT = 15
export const BOSS_ESCORTS = 8
export const BOSS_SPEED = 24
export const BOSS_LIVES_COST = 10

// ─── Аватар «Охотница» (GDD: «Аватар и предметы») ───────────────────────
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

// Пауза между волнами (GDD: «Пауза 20 секунд»)
export const PREVIEW_TIME = 20
export const FIRST_PREVIEW_TIME = 12
