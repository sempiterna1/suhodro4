// Звуки «Железного Разлома»: синтез через Web Audio, без звуковых файлов.
// События не приходят из движка — модуль сравнивает состояние игры между кадрами
// (выстрел = изменился lastShotAt башни, гибель = враг пропал без потери жизней, и т.д.).
// Поэтому звук работает и у гостя в коопе, которому мир приходит снапшотами.

import { ALL_DEFS, MAP_W } from './config'
import type { Game } from './engine'
import type { TowerDefinition } from './types'

type Sound = 'twang' | 'thud' | 'boom' | 'zap' | 'fire' | 'chime' | 'warp' | 'clank' | 'die' | 'leak' | 'horn' | 'build' | 'roll'

/** Какой звук у выстрела башни: по особенностям, затем по типу атаки */
function shotSound(def: TowerDefinition): Sound {
  if (def.chain) return 'zap'
  if (def.burn) return 'fire'
  if (def.slow || def.freeze) return def.id === 'chrono' || def.id === 'time_guardian' ? 'warp' : 'chime'
  if (def.splash || def.slam) return 'boom'
  const attack = def.merged ? def.attacks[0] : def.attack
  if (attack === 'pierce') return 'twang'
  if (attack === 'crush') return 'thud'
  if (attack === 'magic') return 'zap'
  return 'clank'
}

const MIN_GAP: Partial<Record<Sound, number>> = { die: 0.05, clank: 0.06, twang: 0.05, zap: 0.08, boom: 0.12 }

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private lastAt = new Map<Sound, number>()
  private shots = new Map<number, number>()
  private towerIds = new Set<number>()
  private creeps = new Set<number>()
  private lives = -1
  private wave = -1
  private phase = ''
  private shop = ''
  muted = false

  /** Аудио в браузере можно включить только после жеста пользователя — вызывать на первый клик/клавишу */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.55
    // мягкий компрессор — пачка выстрелов не хрипит
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 6
    this.master.connect(comp).connect(this.ctx.destination)
    const len = this.ctx.sampleRate * 0.5
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05)
  }

  /** Сравнить состояние с прошлым кадром и проиграть звуки событий */
  tick(game: Game) {
    // рестарт или новая игра — запоминаем состояние молча (иначе исчезнувшие враги «погибнут» хором)
    const restarted = game.wave < this.wave || (game.phase === 'intro' && this.phase !== 'intro')
    const fresh = this.lives < 0 || restarted
    let budget = 6 // не больше 6 звуков за кадр
    const play = (s: Sound, x = MAP_W / 2) => {
      if (fresh || budget <= 0) return
      budget--
      this.play(s, x)
    }

    // выстрелы и новые башни
    const ids = new Set<number>()
    for (const tw of game.towers) {
      ids.add(tw.id)
      const prev = this.shots.get(tw.id)
      if (prev !== undefined && tw.lastShotAt > prev) play(shotSound(ALL_DEFS[tw.defId]), tw.x)
      this.shots.set(tw.id, tw.lastShotAt)
      if (!this.towerIds.has(tw.id)) play('build', tw.x)
    }
    for (const id of this.shots.keys()) if (!ids.has(id)) this.shots.delete(id)
    this.towerIds = ids

    // гибель врагов и прорывы
    const alive = new Set(game.creeps.map((c) => c.uid))
    const leaked = this.lives >= 0 && game.lives < this.lives
    for (const uid of this.creeps) if (!alive.has(uid) && !leaked) play('die')
    if (leaked) play('leak', MAP_W)
    this.creeps = alive
    this.lives = game.lives

    // начало волны и ролл арсенала
    if (game.phase === 'wave' && (this.phase !== 'wave' || game.wave !== this.wave)) play('horn')
    const shop = game.shop.join()
    if (this.shop && shop && shop !== this.shop) play('roll')
    this.shop = shop
    this.phase = game.phase
    this.wave = game.wave
  }

  private play(s: Sound, x: number) {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return
    const now = ctx.currentTime
    const gap = MIN_GAP[s] ?? 0.04
    if (now - (this.lastAt.get(s) ?? -1) < gap) return
    this.lastAt.set(s, now)

    // звук слышен с той стороны экрана, где событие
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / MAP_W) * 1.4 - 0.7))
    pan.connect(this.master)

    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = now) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.setValueAtTime(f0, at)
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur)
      g.gain.setValueAtTime(vol, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      o.connect(g).connect(pan)
      o.start(at)
      o.stop(at + dur + 0.02)
    }
    const hiss = (filter: BiquadFilterType, freq: number, dur: number, vol: number, at = now) => {
      if (!this.noise) return
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      const f = ctx.createBiquadFilter()
      f.type = filter
      f.frequency.value = freq
      const g = ctx.createGain()
      g.gain.setValueAtTime(vol, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      src.connect(f).connect(g).connect(pan)
      src.start(at, Math.random() * 0.3)
      src.stop(at + dur + 0.02)
    }

    switch (s) {
      case 'twang': // тетива: высокий щелчок с падением тона
        tone('triangle', 720, 190, 0.12, 0.12)
        hiss('highpass', 3000, 0.04, 0.05)
        break
      case 'thud': // тяжёлый удар
        tone('sine', 150, 45, 0.22, 0.3)
        hiss('lowpass', 500, 0.1, 0.12)
        break
      case 'boom': // взрыв: низкий шум и удар
        hiss('lowpass', 700, 0.35, 0.28)
        tone('sine', 110, 35, 0.3, 0.25)
        break
      case 'zap': // молния: пила с резким спадом сквозь полосовой фильтр
        tone('sawtooth', 1400, 180, 0.14, 0.07)
        hiss('bandpass', 2500, 0.08, 0.06)
        break
      case 'fire': // огонь: шипение
        hiss('bandpass', 900, 0.22, 0.12)
        break
      case 'chime': // лёд: звон двух нот
        tone('sine', 1560, 1500, 0.3, 0.05)
        tone('sine', 2340, 2300, 0.22, 0.03)
        break
      case 'warp': // время: плывущий тон
        tone('sine', 300, 900, 0.25, 0.06)
        break
      case 'clank': // механизм: короткий металлический клац
        tone('square', 900, 600, 0.04, 0.05)
        hiss('highpass', 4000, 0.03, 0.04)
        break
      case 'die': // враг развалился: лязг и шипение пара
        tone('square', 320, 70, 0.12, 0.06)
        hiss('highpass', 1800, 0.18, 0.05)
        break
      case 'leak': // прорыв: тревожный гудок
        tone('sawtooth', 220, 180, 0.35, 0.08)
        tone('sawtooth', 233, 190, 0.35, 0.06)
        break
      case 'horn': // начало волны: паровой рог из двух нот
        tone('sawtooth', 110, 105, 0.9, 0.07)
        tone('sawtooth', 165, 160, 0.9, 0.05)
        hiss('lowpass', 1200, 0.6, 0.05)
        break
      case 'build': // постройка: стук и звонкая заклёпка
        tone('sine', 180, 70, 0.15, 0.25)
        tone('square', 1200, 1100, 0.05, 0.05, now + 0.08)
        break
      case 'roll': // ролл: три щелчка «тасовки»
        for (let i = 0; i < 3; i++) tone('square', 700 + i * 150, 650 + i * 150, 0.03, 0.05, now + i * 0.06)
        break
    }
  }
}
