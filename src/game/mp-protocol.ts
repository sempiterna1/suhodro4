// Прототип мультиплеера «Железный Разлом»
// Модель: host-авторитарная. Хост симулирует мир (engine.ts), гость
// получает снапшоты и отправляет команды. Сервис-ретранслятор —
// mini-services/mp-service (socket.io, порт 3003, только relay).

import type { AvatarId } from './config'
import type { DifficultyId } from './data/difficulties'
import type {
  ArmorType, AvatarState, Creep, Effect, FloatText, GameStats, Phase, Projectile, Tower,
} from './types'

/** Снапшот состояния мира: хост → гость, 10 Гц */
export interface Snap {
  seq: number
  phase: Phase
  wave: number
  gold: number
  /** Эссенция (этап 3): вторая валюта миссии, добывается шахтами */
  essence: number
  buildingHp: number
  buildingMaxHp: number
  difficulty: DifficultyId
  speed: number
  paused: boolean
  infiniteGold: boolean
  shop: string[]
  /** купленные башни, ожидающие установки/прокачки («рука») */
  hand?: string[]
  /** открытые слитые башни — не теряются при ролле */
  discovered?: string[]
  mapSeed: number // гость генерирует ту же тропу по зерну (map.ts)
  time: number
  previewRemaining: number
  waveSpawned: number
  waveTotal: number
  coop: boolean
  stats: GameStats
  avatarId: AvatarId
  avatar: Pick<AvatarState, 'x' | 'y' | 'target' | 'level' | 'xp' | 'cooldown' | 'attackCd'>
  towers: Array<Pick<Tower, 'id' | 'x' | 'y' | 'defId' | 'level' | 'invested' | 'cooldown' | 'shotCount' | 'hammerCd'
    | 'rampMult' | 'focusUid' | 'focusStacks' | 'lastShotAt' | 'aim' | 'hasteUntil' | 'hasteMult' | 'moved'>>
  creeps: Array<
    Pick<Creep, 'uid' | 'kind' | 'armor' | 'hp' | 'maxHp' | 'speed' | 'dist' | 'pathIdx' | 'size' | 'isBoss'
      | 'burnDps' | 'burnUntil' | 'stunnedUntil' | 'markedUntil' | 'markedBonus'
      | 'slowPct' | 'slowUntil' | 'vulnBonus' | 'vulnUntil'
      | 'bossPhase' | 'nextSummonAt' | 'nightmareSummonAt'>
  >
  projectiles: Projectile[]
  effects: Effect[]
  floats: FloatText[]
  nextWaveArmor: ArmorType
  nextWaveArmors: ArmorType[]
  /** последнее отклонённое действие гостя (для тоста) */
  lastReject?: string
}

/** Команда гостя → хост */
export type GuestCmd =
  | { t: 'buy'; defId: string }
  | { t: 'placeHand'; idx: number; x: number; y: number }
  | { t: 'levelHand'; idx: number; id: number }
  | { t: 'sell'; id: number }
  | { t: 'move'; id: number; x: number; y: number }
  | { t: 'merge'; a: number; b: number }
  | { t: 'startWave' }
  | { t: 'setSpeed'; speed: number }
  | { t: 'setPaused'; paused: boolean }
  | { t: 'setInfiniteGold'; on: boolean }
  | { t: 'roll' }
