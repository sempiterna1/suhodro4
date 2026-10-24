// Типы игрового прототипа «Железный Разлом»
// Кроссплейный кооперативный Tower Defense — прототип ядра

export type ArmorType = 'light' | 'medium' | 'heavy' | 'universal'
export type AttackType = 'pierce' | 'crush' | 'magic' | 'universal'
export type Phase = 'intro' | 'preview' | 'wave' | 'over' | 'won'

export interface Vec {
  x: number
  y: number
}

export type ProjectileKind = 'arrow' | 'bolt' | 'rock' | 'orb' | 'hammer'

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
  color: string
  glyph: string
  role: string
  l5: string // способность на 5 уровне
  merged?: false
}

/** Слитая (уникальная) башня */
export interface MergeDef extends AttackFx {
  id: string
  name: string
  parents: [string, string]
  price: number // справочная цена (средняя цен родителей)
  // одинаковые типы = рецепт одного типа атаки (Паровой котёл, Бастион, Каменный титан)
  attacks: [AttackType, AttackType]
  damage: number
  interval: number
  range: number
  projSpeed: number
  color: string
  glyph: string
  desc: string
  l5: string
  merged: true
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
  dist: number // пройдено по тропе, px
  size: number
  isBoss: boolean
  gold: number
  livesCost: number
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
  hasteUntil?: number // до какого времени башня ускорена (Боевой клич Воеводы ×1.4, Перегрузка Инженера ×2)
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
}

export interface UiState {
  phase: Phase
  gold: number
  lives: number
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
  shop: string[] // id башен, доступных к постройке (пул арсенала)
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
  nextWaveIsBoss: boolean
  nextWaveIsMoney: boolean
  nextWaveCount: number
  mapName: string // название выбранной карты (MAP_DEFS)
  mapFeature: string
}
