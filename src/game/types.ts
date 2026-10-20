// Типы игрового прототипа «Железный Разлом»
// Кроссплейный кооперативный Tower Defense — прототип ядра

export type ArmorType = 'light' | 'medium' | 'heavy' | 'universal'
export type AttackType = 'pierce' | 'crush' | 'magic' | 'universal'
export type Phase = 'intro' | 'preview' | 'wave' | 'over' | 'won'

export interface Vec {
  x: number
  y: number
}

/** Описание боевой башни (уровень 1) */
export interface TowerDef {
  id: string
  name: string
  attack: AttackType
  price: number
  damage: number
  interval: number // сек между выстрелами
  range: number
  projSpeed: number
  splash?: number // радиус урона по площади
  burn?: { dps: number; dur: number }
  stunChance?: number
  color: string
  glyph: string
  role: string
  l5: string // способность на 5 уровне
  merged?: false
}

/** Слитая (уникальная) башня */
export interface MergeDef {
  id: string
  name: string
  parents: [string, string]
  price: number // справочная цена (средняя цен родителей)
  attacks: [AttackType, AttackType]
  damage: number
  interval: number
  range: number
  projSpeed: number
  splash?: number
  burn?: { dps: number; dur: number }
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

/** Крип на поле */
export interface Creep {
  uid: number
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
  hammerCd: number // для молотобойца 5 ур.
}

export interface Projectile {
  uid: number
  x: number
  y: number
  targetUid: number
  targetPos: Vec | null // если цель умерла
  speed: number
  damage: number
  attacks: AttackType[] // один тип или гибрид из двух (слитые башни)
  splash?: number
  burn?: { dps: number; dur: number }
  color: string
  kind: 'arrow' | 'bolt' | 'rock' | 'orb' | 'hammer'
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
  kind: 'blast' | 'stun' | 'mark' | 'spark'
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
  time: number
  stats: GameStats
  avatar: {
    level: number
    xp: number
    xpNext: number | null
    cooldown: number
  }
  nextWaveArmor: ArmorType
  nextWaveIsBoss: boolean
  nextWaveIsMoney: boolean
  nextWaveCount: number
}
