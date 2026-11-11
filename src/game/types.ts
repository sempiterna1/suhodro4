// Типы игрового прототипа «Железный Разлом»
// Кроссплейный кооперативный Tower Defense — прототип ядра

export type ArmorType = 'light' | 'medium' | 'heavy' | 'universal'
export type AttackType = 'pierce' | 'crush' | 'magic' | 'universal'
export type Phase = 'intro' | 'preview' | 'wave' | 'over' | 'won'
export type WaveKind = 'normal' | 'money' | 'boss'

export interface Vec {
  x: number
  y: number
}

export type ProjectileKind = 'arrow' | 'bolt' | 'rock' | 'orb' | 'hammer'

/** Редкости башен (лор «Последнего горизонта»): Латунная → Стальная → Кристальная → Минеральная → Разломная */
export type RarityId = 'brass' | 'steel' | 'crystal' | 'mineral' | 'rift'

/**
 * Механики атаки, общие для боевых и слитых башен (все поля необязательны).
 * Способности 5 уровня, которые не сводятся к числам, — в engine.ts по id башни.
 */
export interface AttackFx {
  proj?: ProjectileKind // вид снаряда (по умолчанию стрела)
  splash?: number // радиус урона по площади
  burn?: { dps: number; dur: number }
  stunChance?: number // шанс оглушить на 1 с
  targets?: number // сколько целей за выстрел (Ловчий — 3 стрелы)
  slow?: { pct: number; dur: number } // замедление при попадании
  freeze?: number // заморозка (остановка) при попадании, с
  chain?: number // цепная молния: сколько доп. целей
  line?: boolean // мгновенный болт насквозь по линии (Баллиста)
  slam?: boolean // удар по всем врагам в радиусе (Каменный титан)
  waveGrowth?: number // +доля урона за каждую волну после первой (Призма)
  vuln?: { bonus: number; dur: number } // цель получает +bonus урона от всех башен (Пар)
  heavyBonus?: number // множитель урона по тяжёлой броне (Осадная машина)
  aura?: number // +доля урона башням в радиусе слияния (Бастион)
  ramp?: number // +доля скорости атаки за выстрел до конца волны (Арсенал)
  focus?: { perHit: number; max: number } // луч усиливается, пока держит цель (Призма вечности)
  stunSlow?: { pct: number; dur: number } // оглушённые дополнительно замедляются (Страж времени)
  critEvery?: number // крит ×3 каждый N-й выстрел
}

/** Описание боевой башни (уровень 1) */
export interface TowerDef extends AttackFx {
  id: string
  name: string
  attack: AttackType
  price: number
  damage: number
  interval: number // сек между выстрелами
  range: number
  projSpeed: number
  /** Этап 3: золото за пройденную волну за каждый уровень (экономические постройки не атакуют) */
  income?: number
  /** Этап 3: эссенция за пройденную волну за каждый уровень (валюта лавки предметов) */
  essence?: number
  /** Занимает блок footprint×footprint клеток (якорь — верхняя левая клетка); по умолчанию 1 */
  footprint?: number
  /** Доход по уровням точной таблицей (Глубинный бур 10→45); задана — формула «уровень × базу, на 5 ур. ×2» не применяется */
  incomeByLevel?: number[]
  color: string
  glyph: string
  role: string
  l5: string // способность на 5 уровне
  /** Редкость карточки в арсенале (у экономических построек не задана — вне системы редкостей) */
  rarity?: RarityId
  merged?: false
}

/** Слитая (уникальная) башня */
export interface MergeDef extends AttackFx {
  id: string
  name: string
  parents: [string, string]
  price: number // справочная цена (средняя цен родителей)
  // одинаковые типы = рецепт одного типа атаки (Паровой котёл, Бастион, Шлаковый титан)
  attacks: [AttackType, AttackType]
  damage: number
  interval: number
  range: number
  projSpeed: number
  color: string
  glyph: string
  desc: string
  l5: string
  /** Слитые наследуют старшую редкость родителей — проставляется автоматически в data/towers.ts */
  rarity?: RarityId
  merged: true
  income?: never // слитые башни не бывают экономическими
  essence?: never
}

export type TowerDefinition = TowerDef | MergeDef

/** Позиция для постройки (плейтест v2.1 — свободное размещение) */
export interface BuildPos {
  x: number
  y: number
}

/** Вид врага: облик и небольшие отличия скорости/HP внутри типа брони (config.ts CREEP_KINDS) */
export type CreepKind =
  | 'scuttler' | 'swarm' // лёгкие
  | 'trooper' | 'rider' // средние
  | 'juggernaut' | 'golem' // тяжёлые
  | 'rift' | 'wisp' // универсальные
  | 'titan' // босс

/** Крип на поле */
export interface Creep {
  uid: number
  kind: CreepKind
  armor: ArmorType
  hp: number
  maxHp: number
  speed: number
  dist: number // пройдено по своей тропе, px
  pathIdx: number // 0 — основная тропа, 1 — второй выход (GDD «Второй выход»)
  size: number
  isBoss: boolean
  gold: number
  /** Урон по главному зданию при прорыве (обычный крип/босс) */
  buildingDamage: number
  burnDps: number
  burnUntil: number
  burnSource: string
  stunnedUntil: number
  markedUntil: number
  markedBonus: number // доп. % урона по помеченной цели
  goldMult: number
  slowPct: number // текущее замедление 0..1
  slowUntil: number
  vulnBonus: number // доп. % получаемого урона (Паровой котёл)
  vulnUntil: number
  bossPhase?: number // индекс текущей фазы босса (0 = базовая), только для isBoss
  nextSummonAt?: number // time следующего призыва (фазы с summon)
  nightmareSummonAt?: number // time следующего призыва второй способности (Кошмар)
}

export interface Tower {
  id: number // уникальный id (для выбора в UI)
  x: number
  y: number // свободная позиция на карте
  defId: string
  level: number // 1..5
  invested: number
  cooldown: number
  shotCount: number
  hammerCd: number // таймер периодических способностей 5 ур. (молот, заморозка, остановка времени)
  rampMult: number // разгон скорости атаки в волне (Автоматический арсенал), 1 = без разгона
  focusUid: number // кого держит луч (Призма вечности)
  focusStacks: number
  lastShotAt: number // время последнего выстрела (для анимации атаки)
  aim: number // угол на последнюю цель, рад
  hasteUntil?: number // до какого времени башня ускорена (Гудок Кузьмы ×1.4, Перегрузка Гайки ×2)
  hasteMult?: number
  moved?: boolean // башню уже переносили: перенос доступен один раз
}

export interface Projectile {
  uid: number
  x: number
  y: number
  targetUid: number
  targetPos: Vec | null // если цель умерла
  ox?: number // точка вылета — для дуги полёта при отрисовке
  oy?: number
  speed: number
  damage: number
  attacks: AttackType[] // один тип или гибрид из двух (слитые башни)
  splash?: number
  burn?: { dps: number; dur: number }
  slow?: { pct: number; dur: number }
  freeze?: number
  stunChance?: number
  stunSlow?: { pct: number; dur: number }
  vuln?: { bonus: number; dur: number }
  chain?: number // со splash — молния по N ближайшим к взрыву, без splash — N прыжков от цели
  color: string
  kind: ProjectileKind
  crit?: boolean
  fromAvatar?: boolean
  sourceDefId: string
  sourceLevel: number
}

export interface FloatText {
  x: number
  y: number
  text: string
  color: string
  born: number
}

export interface Effect {
  x: number
  y: number
  r: number
  born: number
  dur: number
  color: string
  kind: 'blast' | 'stun' | 'mark' | 'spark' | 'chain' | 'beam' | 'corpse'
  points?: Vec[] // ломаная для 'chain' (молния) и 'beam' (болт/луч)
  creep?: CreepKind // для 'corpse': какой враг погиб (спрайт гибели)
  uid?: number // для 'corpse': uid погибшего, чтобы взять его направление взгляда
}

export interface AvatarState {
  x: number
  y: number
  target: Vec | null
  level: number
  xp: number
  cooldown: number
  attackCd: number
}

export interface GameStats {
  kills: number
  leaked: number
  goldEarned: number
  merges: number
  bossKills: number
  /** Фактически нанесённый урон (без overkill) — для DPS в симуляторе и статистике */
  damageDealt: number
  /** Урон по источникам (id башни/аватара) за карту — для таблички HUD */
  damageByTower: Record<string, number>
}

/** Тип события в журнале партии (этап 1: разбор баланса и реплеи) */
export type GameEventType =
  | 'build'
  | 'buy'
  | 'upgrade'
  | 'sell'
  | 'merge'
  | 'roll'
  | 'itemBuy'
  | 'itemSell'
  | 'itemRoll'
  | 'leak'
  | 'bossPhase'
  | 'bossAbility'
  | 'waveStart'
  | 'waveEnd'
  | 'income'
  | 'win'
  | 'lose'

/**
 * Одно событие партии. Журнал живёт в Game.events, ограничен по длине
 * и не попадает в кооп-снапшоты (это отладочные данные хоста).
 */
export interface GameEvent {
  t: number // игровое время, с
  wave: number // номер волны на момент события
  type: GameEventType
  defId?: string // башня/результат слияния
  towerId?: number
  level?: number
  x?: number
  y?: number
  amount?: number // цена, возврат, бонус, урон/потеря жизней
  creepKind?: CreepKind
  armor?: ArmorType
  phase?: number // номер фазы босса
  text?: string // человекочитаемая подпись (фаза, рецепт)
}

export interface UiState {
  phase: Phase
  gold: number
  /** Эссенция (этап 3): вторая валюта миссии, добывается шахтами, тратится в лавке */
  essence: number
  /** экипированные предметы (макс. 6 слотов: оружие/доспех/амулет/2 кольца/реликвия) */
  items: Array<{ id: string; rare: boolean }>
  /** текущие 4 предложения лавки */
  itemShop: Array<{ id: string; rare: boolean }>
  /** HP главного здания (поражение при 0) */
  buildingHp: number
  buildingMaxHp: number
  difficulty: import('./data/difficulties').DifficultyId
  difficultyName: string
  wave: number // номер текущей/следующей волны (1-базный)
  totalWaves: number
  coop: boolean // подключён второй игрок (HP ×1.85)
  previewRemaining: number
  waveSpawned: number
  waveTotal: number
  creepsAlive: number
  speed: number
  paused: boolean
  infiniteGold: boolean // чит для тестов
  shop: string[] // id башен, доступных к покупке (пул арсенала + открытые слитые)
  /** купленные башни, ожидающие установки/прокачки на поле («рука») */
  hand: string[]
  rollCost: number
  time: number
  stats: GameStats
  avatar: {
    level: number
    xp: number
    xpNext: number | null
    cooldown: number
    id: import('./config').AvatarId
  }
  nextWaveArmor: ArmorType
  /** Все типы брони ближайшей волны (на смешанных волнах — два) */
  nextWaveArmors: ArmorType[]
  /** Прогноз брони: 1 волна на Ветеране/Кошмаре, 2 — на Новобранце */
  armorForecast: Array<{ wave: number; armors: ArmorType[]; kind: WaveKind }>
  nextWaveIsBoss: boolean
  nextWaveBossName: string | null // имя босса с фазами (BOSSES), для боссовых волн
  nextWaveIsMoney: boolean
  nextWaveCount: number
  mapName: string // название выбранной карты (MAP_DEFS)
  mapFeature: string
  secondExitWave: number | null // волна открытия второго выхода на этой карте (null — его нет)
}
