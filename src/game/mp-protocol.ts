// Прототип мультиплеера «Железный Разлом»
// Модель: host-авторитарная. Хост симулирует мир (engine.ts), гость
// получает снапшоты и отправляет команды. Сервис-ретранслятор —
// mini-services/mp-service (socket.io, порт 3003, только relay).

import type {
  ArmorType, AvatarState, Creep, Effect, FloatText, Phase, Projectile, Tower,
} from './types'

/** Снапшот состояния мира: хост → гость, 10 Гц */
export interface Snap {
  seq: number
  phase: Phase
  wave: number
  gold: number
  lives: number
  speed: number
  paused: boolean
  infiniteGold: boolean
  shop: string[]
  time: number
  previewRemaining: number
  waveSpawned: number
  waveTotal: number
  coop: boolean
  stats: { kills: number; leaked: number; goldEarned: number; merges: number; bossKills: number }
  avatar: Pick<AvatarState, 'x' | 'y' | 'target' | 'level' | 'xp' | 'cooldown' | 'attackCd'>
  towers: Array<Pick<Tower, 'id' | 'x' | 'y' | 'defId' | 'level' | 'invested' | 'cooldown' | 'shotCount' | 'hammerCd'
    | 'rampMult' | 'focusUid' | 'focusStacks' | 'lastShotAt' | 'aim'>>
  creeps: Array<
    Pick<Creep, 'uid' | 'armor' | 'hp' | 'maxHp' | 'speed' | 'dist' | 'size' | 'isBoss'
      | 'burnDps' | 'burnUntil' | 'stunnedUntil' | 'markedUntil' | 'markedBonus'
      | 'slowPct' | 'slowUntil' | 'vulnBonus' | 'vulnUntil'>
  >
  projectiles: Projectile[]
  effects: Effect[]
  floats: FloatText[]
  nextWaveArmor: ArmorType
  /** последнее отклонённое действие гостя (для тоста) */
  lastReject?: string
}

/** Команда гостя → хост */
export type GuestCmd =
  | { t: 'build'; x: number; y: number; defId: string }
  | { t: 'upgrade'; id: number }
  | { t: 'sell'; id: number }
  | { t: 'merge'; a: number; b: number }
  | { t: 'startWave' }
  | { t: 'setSpeed'; speed: number }
  | { t: 'setPaused'; paused: boolean }
  | { t: 'setInfiniteGold'; on: boolean }
  | { t: 'roll' }
