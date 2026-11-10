// Башни, слияния и механики атаки: определения, способности 5 уровня, константы механик.
// Лорные имена — docs/towers.md (10.11.2026). id и механика не меняются без обновления документа.

import type { AttackType, MergeDef, RarityId, TowerDef } from '../types'

// ─── 15 боевых башен (GDD: «15 боевых башен») ───────────────────────────
// Первые 6 — из прототипа; остальные 9 добавлены по таблице GDD.
// Урон в секунду ~ пропорционален цене (ориентир GDD), числа — стартовые, под плейтест.
export const TOWERS: TowerDef[] = [
  {
    id: 'sentry',
    name: 'Клапанный пулемёт',
    attack: 'universal',
    price: 40,
    damage: 6,
    interval: 0.75,
    range: 120,
    projSpeed: 420,
    color: '#b0a08a',
    glyph: '⚙',
    role: 'дешёвая стартовая',
    l5: '+20% урона по боссам',
    merged: false,
  },
  {
    id: 'archer',
    name: 'Гарпунница',
    attack: 'pierce',
    price: 50,
    damage: 5,
    interval: 0.5,
    range: 140,
    projSpeed: 520,
    color: '#8fae6b',
    glyph: '🎯',
    role: 'быстрая, одна цель',
    l5: 'Двойной выстрел',
    merged: false,
  },
  {
    id: 'crossbow',
    name: 'Гвоздемёт',
    attack: 'pierce',
    price: 90,
    damage: 15,
    interval: 1.0,
    range: 150,
    projSpeed: 620,
    proj: 'bolt',
    color: '#7f9bb3',
    glyph: '🔩',
    role: 'критический урон',
    l5: 'Крит ×3 каждый 5-й выстрел',
    merged: false,
  },
  {
    id: 'catapult',
    name: 'Шлакомёт',
    attack: 'crush',
    price: 70,
    damage: 12,
    interval: 1.7,
    range: 130,
    projSpeed: 240,
    proj: 'rock',
    splash: 55,
    color: '#c2874f',
    glyph: '💥',
    role: 'урон по площади',
    l5: 'Осколки после удара',
    merged: false,
  },
  {
    id: 'mauler',
    name: 'Паровой копёр',
    attack: 'crush',
    price: 110,
    damage: 20,
    interval: 1.1,
    range: 100,
    projSpeed: 480,
    proj: 'hammer',
    stunChance: 0.15,
    color: '#d09a4e',
    glyph: '🔨',
    role: 'оглушение',
    l5: 'Оглушение группы раз в 8 с',
    merged: false,
  },
  {
    id: 'pyro',
    name: 'Жаровня',
    attack: 'magic',
    price: 70,
    damage: 7,
    interval: 1.0,
    range: 120,
    projSpeed: 380,
    proj: 'orb',
    burn: { dps: 4, dur: 3 },
    color: '#d4694f',
    glyph: '🔥',
    role: 'горение со временем',
    l5: 'Огонь перекидывается на соседей',
    merged: false,
  },
  // ── новые башни из таблицы GDD ──
  {
    id: 'hunter',
    name: 'Тройная гарпунница',
    attack: 'pierce',
    price: 130,
    damage: 7,
    interval: 0.9,
    range: 140,
    projSpeed: 540,
    targets: 3,
    color: '#a3b86c',
    glyph: '🔱',
    role: 'стрела в 3 цели',
    l5: 'Сеть: замедление 30%',
    merged: false,
  },
  {
    id: 'ballista',
    name: 'Шпаломёт',
    attack: 'pierce',
    price: 170,
    damage: 30,
    interval: 1.6,
    range: 180,
    projSpeed: 0, // мгновенный болт по линии
    line: true,
    color: '#9c8f6a',
    glyph: '🛤',
    role: 'пробивает линию врагов',
    l5: 'Болт проходит через всю тропу',
    merged: false,
  },
  {
    id: 'mortar',
    name: 'Мортира',
    attack: 'crush',
    price: 150,
    damage: 22,
    interval: 2.4,
    range: 210,
    projSpeed: 200,
    proj: 'rock',
    splash: 75,
    color: '#8c7a5b',
    glyph: '💣',
    role: 'большая дальность и площадь',
    l5: 'Залп из 3 снарядов',
    merged: false,
  },
  {
    id: 'golem',
    name: 'Латунный голем',
    attack: 'crush',
    price: 160,
    damage: 60,
    interval: 2.6,
    range: 90,
    projSpeed: 420,
    proj: 'hammer',
    color: '#a07850',
    glyph: '🗿',
    role: 'медленный, огромный урон',
    l5: 'Удар по 3 целям в линию',
    merged: false,
  },
  {
    id: 'frost',
    name: 'Морозный конденсатор',
    attack: 'magic',
    price: 100,
    damage: 8,
    interval: 1.0,
    range: 130,
    projSpeed: 400,
    proj: 'orb',
    slow: { pct: 0.35, dur: 2 },
    color: '#7cc4e0',
    glyph: '❄',
    role: 'замедление',
    l5: 'Заморозка на 1 с каждые 6 с',
    merged: false,
  },
  {
    id: 'lightning',
    name: 'Разрядник',
    attack: 'magic',
    price: 120,
    damage: 12,
    interval: 1.3,
    range: 140,
    projSpeed: 0, // молния мгновенная
    chain: 3, // цель + 3 прыжка = 4 цели
    color: '#c9b8ff',
    glyph: '⚡',
    role: 'цепь на 4 цели',
    l5: 'Цепь на 8 целей',
    merged: false,
  },
  {
    id: 'chrono',
    name: 'Сигнал ИИ',
    attack: 'magic',
    price: 150,
    damage: 14,
    interval: 1.1,
    range: 140,
    projSpeed: 380,
    proj: 'orb',
    slow: { pct: 0.25, dur: 2 },
    color: '#b48ad8',
    glyph: '📡',
    role: 'взлом: замедление и урон',
    l5: 'Остановка времени у босса на 1 с',
    merged: false,
  },
  {
    id: 'mech_guard',
    name: 'Автоканон',
    attack: 'universal',
    price: 100,
    damage: 10,
    interval: 0.6,
    range: 130,
    projSpeed: 520,
    proj: 'bolt',
    color: '#a9a39a',
    glyph: '🔫',
    role: 'сбалансированная',
    l5: 'Пулемётная очередь',
    merged: false,
  },
  {
    id: 'prism',
    name: 'Шахтный резонатор',
    attack: 'universal',
    price: 240,
    damage: 14,
    interval: 0.9,
    range: 150,
    projSpeed: 0, // луч мгновенный
    waveGrowth: 0.1,
    color: '#8fe0d0',
    glyph: '💎',
    role: 'урон растёт с номером волны',
    l5: 'Луч в 5 целей',
    merged: false,
  },
]


// ─── Редкости (задача 19): Латунная → Стальная → Кристальная → Минеральная → Разломная ──
// Ниши + лёгкий множитель ДПС (~+8–12% за ступень): роль важнее тиража — «мусорных»
// обычных башен нет, редкость оплачивает механику. weight — вес карточки в ролле,
// fromWave — волна, с которой редкость начинает выпадать (гейтинг без pity).
// P(карточки данной редкости) при полном ростере: 46/27/14/6/1.2%, экономические ≈ 5% каждая.

export interface RarityDef {
  id: RarityId
  name: string
  color: string
  /** Множитель урона (применяется один раз, в engine.fireTower) */
  dpsMult: number
  /** Вес в взвешенном ролле арсенала */
  weight: number
  /** Номер волны, с которой редкость может выпасть */
  fromWave: number
}

export const RARITIES: RarityDef[] = [
  { id: 'brass', name: 'Латунная', color: '#c9a25e', dpsMult: 1, weight: 30, fromWave: 1 },
  { id: 'steel', name: 'Стальная', color: '#aebdd0', dpsMult: 1.08, weight: 22, fromWave: 1 },
  { id: 'crystal', name: 'Кристальная', color: '#7cd8e8', dpsMult: 1.17, weight: 15, fromWave: 1 },
  { id: 'mineral', name: 'Минеральная', color: '#8fe07a', dpsMult: 1.26, weight: 10, fromWave: 8 },
  { id: 'rift', name: 'Разломная', color: '#c07ce8', dpsMult: 1.36, weight: 4, fromWave: 15 },
]

export const RARITY_BY_ID: Record<RarityId, RarityDef> = Object.fromEntries(
  RARITIES.map((r) => [r.id, r])
) as Record<RarityId, RarityDef>

/** Множители ДПС по редкости: Латунная 1 → Разломная ≈ ×1.36 */
export const RARITY_DPS: Record<RarityId, number> = Object.fromEntries(
  RARITIES.map((r) => [r.id, r.dpsMult])
) as Record<RarityId, number>

/** Вес карточки экономической постройки (стан, шахта) — вне системы редкостей */
export const RARITY_ECON_WEIGHT = 8

/** Маппинг редкостей по силе/цене башен: Латунные 40–90, Стальные 100–120,
 * Кристальные 130–150, Минеральные 160–170, Разломная 240 */
const RARITY_MAP: Record<string, RarityId> = {
  sentry: 'brass',
  archer: 'brass',
  catapult: 'brass',
  pyro: 'brass',
  crossbow: 'brass',
  frost: 'steel',
  mech_guard: 'steel',
  mauler: 'steel',
  lightning: 'steel',
  hunter: 'crystal',
  mortar: 'crystal',
  chrono: 'crystal',
  golem: 'mineral',
  ballista: 'mineral',
  prism: 'rift',
}

for (const t of TOWERS) {
  const r = RARITY_MAP[t.id]
  if (!r) throw new Error(`У боевой башни ${t.id} не задана редкость в RARITY_MAP`)
  t.rarity = r
}

// ─── Экономические постройки (этап 3: золото вместо атаки) ─────────────
// Роллятся вместе с боевыми на общих основаниях (вес RARITY_ECON_WEIGHT),
// редкости не имеют. Прокачка — общей моделью копии, доход растёт с уровнем.
// Глубинный бур задаёт доход точной кривой incomeByLevel (10 → 45).

/**
 * Доход экономической постройки за пройденную волну на данном уровне:
 * точная кривая incomeByLevel (бур) или формула «уровень × базу, на 5 ур. ×2».
 * Структурный тип: MergeDef не платит, все поля опциональны.
 */
export interface EconSource {
  income?: number
  essence?: number
  incomeByLevel?: number[]
}

export function econIncomeAt(def: EconSource, level: number): number {
  const curve = def.incomeByLevel
  if (curve?.length) return curve[Math.max(1, Math.min(level, curve.length)) - 1] ?? 0
  const base = def.essence ?? def.income ?? 0
  return base * level * (level >= 5 ? 2 : 1)
}

/** Доход на 5-м уровне: конец кривой (бур: 45) или «база × 5 × 2» */
export function econIncomeAt5(def: EconSource): number {
  const curve = def.incomeByLevel
  if (curve?.length) return curve[curve.length - 1] ?? 0
  const base = def.essence ?? def.income ?? 0
  return base * 5 * 2
}

/** Прирост за один уровень копии (для «За уровень»): первый шаг кривой или база */
export function econIncomeBase(def: EconSource): number {
  const curve = def.incomeByLevel
  if (curve?.length) return curve[0] ?? 0
  return def.essence ?? def.income ?? 0
}

/** Размер блока постройки в клетках (слитые башни и обычные — 1×1) */
export function defFootprint(def: TowerDef | MergeDef | undefined): number {
  return def && 'footprint' in def ? def.footprint ?? 1 : 1
}

export const ECONOMY_TOWERS: TowerDef[] = [
  {
    id: 'sluice',
    name: 'Промывочный стан',
    attack: 'universal',
    price: 70,
    damage: 0,
    interval: 1,
    range: 0,
    projSpeed: 0,
    income: 7,
    color: '#e8c170',
    glyph: '🪙',
    role: 'не атакует: золото за каждую пройденную волну',
    l5: 'Добыча удвоена',
    merged: false,
  },
  {
    id: 'mine',
    name: 'Кристальная шахта',
    attack: 'universal',
    price: 80,
    damage: 0,
    interval: 1,
    range: 0,
    projSpeed: 0,
    essence: 4,
    color: '#a6f095',
    glyph: '💠',
    role: 'не атакует: эссенция за каждую пройденную волну',
    l5: 'Добыча удвоена',
    merged: false,
  },
  {
    id: 'deep_drill',
    name: 'Глубинный бур',
    attack: 'universal',
    price: 160,
    damage: 0,
    interval: 1,
    range: 0,
    projSpeed: 0,
    essence: 10,
    footprint: 2, // большой слот 2×2 (план этапа 3)
    incomeByLevel: [10, 16, 24, 33, 45], // точная кривая этапа 3: 10 → 45
    color: '#7fd0a0',
    glyph: '⛏',
    role: 'большая шахта 2×2: много эссенции за волну, занимает 4 клетки',
    l5: 'Пиковая добыча 45 💠 за волну',
    merged: false,
  },
]

export const ECONOMY_IDS: string[] = ECONOMY_TOWERS.map((t) => t.id)

// ─── Слитые башни (GDD: «Слияние башен», все 12 рецептов) ───────────────
export const MERGED_TOWERS: MergeDef[] = [
  {
    id: 'flame_archer',
    name: 'Горящий гарпун',
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
    desc: 'Горящие гарпуны, поджог скапливается',
    l5: 'Горение вдвое сильнее',
    merged: true,
  },
  {
    id: 'volcano',
    name: 'Шлаковый вулкан',
    parents: ['catapult', 'pyro'],
    price: 70,
    attacks: ['crush', 'magic'],
    damage: 16,
    interval: 1.8,
    range: 140,
    projSpeed: 240,
    proj: 'rock',
    splash: 60,
    burn: { dps: 6, dur: 3 },
    color: '#c74e2e',
    glyph: '🌋',
    desc: 'Снаряды оставляют лужи лавы',
    l5: 'Радиус взрыва +30%',
    merged: true,
  },
  // ── 10 рецептов, добавленных по таблице GDD ──
  {
    id: 'thunder_crossbow',
    name: 'Громовой гвоздемёт',
    parents: ['crossbow', 'lightning'],
    price: 105,
    attacks: ['pierce', 'magic'],
    damage: 18,
    interval: 1.0,
    range: 155,
    projSpeed: 620,
    proj: 'bolt',
    critEvery: 4,
    color: '#a9b4ff',
    glyph: '🌩',
    desc: 'Каждый крит вызывает цепную молнию',
    l5: 'Молния бьёт по 8 целям',
    merged: true,
  },
  {
    id: 'frost_hunter',
    name: 'Морозная гарпунница',
    parents: ['hunter', 'frost'],
    price: 115,
    attacks: ['pierce', 'magic'],
    damage: 9,
    interval: 0.9,
    range: 145,
    projSpeed: 540,
    targets: 3,
    freeze: 0.5,
    color: '#9ad8e8',
    glyph: '🧊',
    desc: '3 стрелы, каждая замораживает на 0,5 с',
    l5: 'Заморозка 1 с',
    merged: true,
  },
  {
    id: 'siege_engine',
    name: 'Осадная машина',
    parents: ['ballista', 'golem'],
    price: 165,
    attacks: ['pierce', 'crush'],
    damage: 45,
    interval: 1.8,
    range: 190,
    projSpeed: 0,
    line: true,
    heavyBonus: 2,
    color: '#b08a5a',
    glyph: '🛞',
    desc: 'Пробивает линию, ×2 урона по тяжёлым',
    l5: 'Болт проходит через всю тропу',
    merged: true,
  },
  {
    id: 'time_guardian',
    name: 'Глушитель',
    parents: ['mauler', 'chrono'],
    price: 130,
    attacks: ['crush', 'magic'],
    damage: 24,
    interval: 1.1,
    range: 110,
    projSpeed: 480,
    proj: 'hammer',
    stunChance: 0.25,
    stunSlow: { pct: 0.4, dur: 3 },
    color: '#c49ad0',
    glyph: '⌛',
    desc: 'Оглушённые враги замедляются ещё на 3 с',
    l5: 'Оглушение группы раз в 8 с',
    merged: true,
  },
  {
    id: 'storm_mortar',
    name: 'Грозовая мортира',
    parents: ['mortar', 'lightning'],
    price: 135,
    attacks: ['crush', 'magic'],
    damage: 24,
    interval: 2.4,
    range: 210,
    projSpeed: 200,
    proj: 'rock',
    splash: 75,
    chain: 5,
    color: '#9f8fe0',
    glyph: '⛈',
    desc: 'Взрыв бьёт молнией по 5 ближайшим',
    l5: 'Залп из 2 снарядов',
    merged: true,
  },
  {
    id: 'steam_boiler',
    name: 'Паровой котёл',
    parents: ['frost', 'pyro'],
    price: 85,
    attacks: ['magic', 'magic'],
    damage: 9,
    interval: 1.2,
    range: 130,
    projSpeed: 340,
    proj: 'orb',
    splash: 45,
    slow: { pct: 0.2, dur: 2 },
    vuln: { bonus: 0.2, dur: 3 },
    color: '#d8d0c0',
    glyph: '♨',
    desc: 'Пар: цели получают +20% урона от всех башен',
    l5: 'Пар даёт +35% урона',
    merged: true,
  },
  {
    id: 'bastion',
    name: 'Бастион',
    parents: ['sentry', 'mech_guard'],
    price: 70,
    attacks: ['universal', 'universal'],
    damage: 9,
    interval: 0.4,
    range: 135,
    projSpeed: 520,
    proj: 'bolt',
    aura: 0.1,
    color: '#c8b48a',
    glyph: '🏰',
    desc: 'Мощная очередь и аура +10% урона соседям',
    l5: 'Аура +20% урона',
    merged: true,
  },
  {
    id: 'eternity_prism',
    name: 'Око ИИ',
    parents: ['prism', 'chrono'],
    price: 165,
    attacks: ['universal', 'magic'],
    damage: 14,
    interval: 0.5,
    range: 160,
    projSpeed: 0,
    waveGrowth: 0.1,
    focus: { perHit: 0.15, max: 3 },
    color: '#c0a0f0',
    glyph: '🔮',
    desc: 'Луч усиливается, пока держит цель',
    l5: 'Луч усиливается до ×5',
    merged: true,
  },
  {
    id: 'auto_arsenal',
    name: 'Автогарпун',
    parents: ['archer', 'mech_guard'],
    price: 75,
    attacks: ['pierce', 'universal'],
    damage: 7,
    interval: 0.6,
    range: 140,
    projSpeed: 560,
    ramp: 0.03,
    color: '#b0b890',
    glyph: '⚙',
    desc: 'Скорость атаки растёт без предела во время волны',
    l5: 'Разгон вдвое быстрее',
    merged: true,
  },
  {
    id: 'stone_titan',
    name: 'Шлаковый титан',
    parents: ['catapult', 'golem'],
    price: 115,
    attacks: ['crush', 'crush'],
    damage: 40,
    interval: 2.4,
    range: 110,
    projSpeed: 0,
    slam: true,
    color: '#9a8468',
    glyph: '⛰',
    desc: 'Удар сотрясает землю: урон по всей ближней тропе',
    l5: 'Удар оглушает на 0,5 с',
    merged: true,
  },
]

// Цена карточки слитой башни в магазине = сумма цен родителей: копии из магазина
// нужны, чтобы качать слитую башню копией из «руки» (решение о прокачке 03.11.2026).
// Дешёвая «цена слияния» остаётся в invested двух построенных башен — это не затрагивается.
// Редкость — наследуется старшая из родителей (решение задачи 19).
for (const m of MERGED_TOWERS) {
  const pa = TOWERS.find((t) => t.id === m.parents[0])
  const pb = TOWERS.find((t) => t.id === m.parents[1])
  if (pa && pb) m.price = pa.price + pb.price
  const ra = pa?.rarity ? RARITIES.findIndex((r) => r.id === pa.rarity) : -1
  const rb = pb?.rarity ? RARITIES.findIndex((r) => r.id === pb.rarity) : -1
  const idx = Math.max(ra, rb)
  if (idx >= 0) m.rarity = RARITIES[idx].id
}

// Параметры механик (общие для всех башен)
export const CHAIN_RANGE = 90 // дальность прыжка молнии
export const CHAIN_FALLOFF = 0.8 // каждый прыжок — ×0.8 урона
export const LINE_WIDTH = 16 // полуширина болта Шпаломёта
export const SLAM_STUN = 0.5
export const MIN_INTERVAL = 0.08 // предел разгона Автогарпуна (защита от бесконечного цикла)

export const ALL_DEFS: Record<string, TowerDef | MergeDef> = Object.fromEntries(
  [...TOWERS, ...ECONOMY_TOWERS, ...MERGED_TOWERS].map((d) => [d.id, d])
)
