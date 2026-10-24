// Звуки «Последнего горизонта»: короткие CC0-сэмплы из public/assets/sfx (лицензии — LICENSES.md),
// а где файла нет или он ещё грузится — синтез через Web Audio.
// События не приходят из движка — модуль сравнивает состояние игры между кадрами
// (выстрел = изменился lastShotAt башни, гибель = враг пропал без потери жизней, и т.д.).
// Поэтому звук работает и у гостя в коопе, которому мир приходит снапшотами.

import { ALL_DEFS, MAP_W } from './config'
import { pointAtLength, type Game } from './engine'
import type { CreepKind, TowerDefinition } from './types'
import { windAt } from './wind'

/** Ambient тише всего остального: итоговый уровень = громкость ambient × AMBIENT_LEVEL */
const AMBIENT_LEVEL = 0.5
const readAmbientVolume = () => {
  try {
    const v = Number(window.localStorage.getItem('zr-ambient'))
    return Number.isFinite(v) && window.localStorage.getItem('zr-ambient') !== null ? Math.max(0, Math.min(1, v)) : 0.6
  } catch {
    return 0.6
  }
}

/** Логические звуки: у каждого — свой физический источник; без файла играет синтез-запасной (SYNTH) */
type Sound =
  | 'bow' | 'crossbow' | 'catapult' | 'mortar' | 'thud' | 'boom' | 'fire' | 'frost' | 'spark' | 'time' | 'prism' | 'steam' | 'clank'
  | 'die' | 'leak' | 'horn' | 'build' | 'roll'
type Synth = 'twang' | 'thud' | 'boom' | 'zap' | 'fire' | 'chime' | 'warp' | 'clank' | 'die' | 'leak' | 'horn' | 'build' | 'roll'

/** Запасной синтез, пока файла нет или он ещё грузится */
const SYNTH: Record<Sound, Synth> = {
  bow: 'twang', crossbow: 'clank', catapult: 'thud', mortar: 'boom', thud: 'thud', boom: 'boom', fire: 'fire', frost: 'chime',
  spark: 'zap', time: 'warp', prism: 'chime', steam: 'fire', clank: 'clank', die: 'die', leak: 'leak', horn: 'horn', build: 'build', roll: 'roll',
}

/** Звук выстрела по башне: камнемёт — скрип и глухой «бух», арбалет — тугая тетива, лук — тетива и свист, огонь — «фух», мороз — звон… */
const SHOT_BY_ID: Record<string, { s: Sound; rate?: number }> = {
  sentry: { s: 'clank' }, archer: { s: 'bow' }, crossbow: { s: 'crossbow' }, catapult: { s: 'catapult' }, mauler: { s: 'thud' },
  pyro: { s: 'fire' }, hunter: { s: 'crossbow', rate: 1.1 }, ballista: { s: 'crossbow', rate: 0.78 }, mortar: { s: 'mortar' },
  golem: { s: 'thud', rate: 0.85 }, frost: { s: 'frost' }, lightning: { s: 'spark' }, chrono: { s: 'time' }, mech_guard: { s: 'clank', rate: 0.9 },
  prism: { s: 'prism' },
  // слитые
  flame_archer: { s: 'fire', rate: 1.1 }, volcano: { s: 'boom' }, thunder_crossbow: { s: 'spark', rate: 0.9 }, frost_hunter: { s: 'frost', rate: 1.2 },
  siege_engine: { s: 'catapult', rate: 0.85 }, time_guardian: { s: 'time', rate: 0.8 }, storm_mortar: { s: 'mortar', rate: 0.85 },
  steam_boiler: { s: 'steam' }, bastion: { s: 'clank', rate: 0.8 }, eternity_prism: { s: 'prism', rate: 0.75 }, auto_arsenal: { s: 'clank', rate: 1.15 },
  stone_titan: { s: 'thud', rate: 0.72 },
}
function shotSound(def: TowerDefinition): { s: Sound; rate: number } {
  const known = SHOT_BY_ID[def.id]
  if (known) return { s: known.s, rate: known.rate ?? 1 }
  // неизвестная башня: по особенностям и типу атаки
  if (def.chain) return { s: 'spark', rate: 1 }
  if (def.burn) return { s: 'fire', rate: 1 }
  if (def.slow || def.freeze) return { s: 'frost', rate: 1 }
  if (def.splash || def.slam) return { s: 'mortar', rate: 1 }
  const attack = def.merged ? def.attacks[0] : def.attack
  if (attack === 'pierce') return { s: 'bow', rate: 1 }
  if (attack === 'crush') return { s: 'thud', rate: 1 }
  if (attack === 'magic') return { s: 'prism', rate: 1 }
  return { s: 'clank', rate: 1 }
}

/**
 * Файлы public/assets/sfx: сэмплы лука, арбалета и монстров (CC0, обработаны sfx-build.mjs) и звуки, собранные
 * sfx-synth.mjs (шум, фильтры, мягкие огибающие). Громкость — gain; все файлы нормализованы по пику.
 */
const SFX_DIR = '/assets/sfx/'
const wavs = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}-${i + 1}.wav`)
const SAMPLES: Record<Sound, { files: string[]; gain: number }> = {
  bow: { files: ['bow-longbow.wav', 'bow-recurve.wav'], gain: 0.5 },
  crossbow: { files: ['crossbow-shoot.wav'], gain: 0.55 },
  catapult: { files: wavs('catapult', 3), gain: 0.6 },
  mortar: { files: wavs('mortar', 2), gain: 0.65 },
  thud: { files: wavs('thud', 3), gain: 0.6 },
  boom: { files: wavs('boom', 2), gain: 0.6 },
  fire: { files: wavs('fire', 3), gain: 0.45 },
  frost: { files: wavs('frost', 2), gain: 0.35 },
  spark: { files: wavs('spark', 3), gain: 0.4 },
  time: { files: wavs('time', 2), gain: 0.35 },
  prism: { files: wavs('prism', 1), gain: 0.3 },
  steam: { files: wavs('steam', 2), gain: 0.35 },
  clank: { files: wavs('clank', 2), gain: 0.45 },
  build: { files: wavs('build', 2), gain: 0.5 },
  roll: { files: wavs('roll', 1), gain: 0.35 },
  leak: { files: wavs('leak', 1), gain: 0.5 },
  horn: { files: wavs('horn', 1), gain: 0.5 },
  die: { files: wavs('monster', 10), gain: 0.4 },
}
/** Высота голоса гибели по виду врага: тяжёлые гудят ниже, лёгкие — выше */
const DIE_RATE: Partial<Record<CreepKind, number>> = { titan: 0.6, golem: 0.72, juggernaut: 0.8, trooper: 0.9, rider: 1.05, swarm: 1.25, wisp: 1.3 }
const MAX_VOICES = 8 // сэмплов одновременно — чтобы частая стрельба не оглушала

const MIN_GAP: Partial<Record<Sound, number>> = {
  die: 0.05, clank: 0.06, bow: 0.05, crossbow: 0.06, spark: 0.08, boom: 0.12, catapult: 0.1, mortar: 0.12, thud: 0.1, fire: 0.08, frost: 0.08,
}

/** Шаги мобов: чем тяжелее — тем глуше и ниже; тише выстрелов в 2–4 раза. stride — сколько пикселей пути между шагами */
const STEP_FILES = { light: wavs('step-light', 6), heavy: wavs('step-heavy', 4), paw: wavs('step-paw', 4) }
type StepDef = { cls: keyof typeof STEP_FILES; stride: number; gain: number; rate: number }
const STEP_BY_KIND: Partial<Record<CreepKind, StepDef>> = {
  scuttler: { cls: 'light', stride: 34, gain: 0.065, rate: 1 },
  swarm: { cls: 'light', stride: 26, gain: 0.055, rate: 1.12 },
  trooper: { cls: 'heavy', stride: 36, gain: 0.075, rate: 1.15 },
  rider: { cls: 'paw', stride: 28, gain: 0.075, rate: 1 },
  juggernaut: { cls: 'heavy', stride: 42, gain: 0.1, rate: 1 },
  golem: { cls: 'heavy', stride: 48, gain: 0.11, rate: 0.9 },
  rift: { cls: 'light', stride: 40, gain: 0.055, rate: 0.9 },
  titan: { cls: 'heavy', stride: 64, gain: 0.15, rate: 0.75 },
}
const MAX_STEP_VOICES = 3 // шагов одновременно
const MAX_STEPS_PER_FRAME = 2

/** Фоновая музыка (CC0, public/assets/music): по кругу с кроссфейдом, без ударных, тихо */
const MUSIC_DIR = '/assets/music/'
const MUSIC_FILES = ['dark-cavern-ambient-001.ogg', 'dark-place.ogg', 'the-frigid-seas.mp3']
const MUSIC_LEVEL = 0.6 // итоговый уровень = musicVolume × MUSIC_LEVEL
const MUSIC_FADE = 5 // секунд кроссфейда между проходами и треками
const readMusicVolume = () => {
  try {
    const raw = window.localStorage.getItem('zr-music')
    const v = Number(raw)
    return raw !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.35
  } catch {
    return 0.35
  }
}

export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  private lastAt = new Map<Sound, number>()
  private shots = new Map<number, number>()
  private towerIds = new Set<number>()
  private creeps = new Map<number, CreepKind>()
  private buffers = new Map<string, AudioBuffer>()
  private voices = 0
  private stepVoices = 0
  private stepLast = new Map<number, number>()
  private stepAcc = new Map<number, number>()
  private music: { gain: GainNode; bufs: (AudioBuffer | null)[]; factors: number[]; idx: number; nextAt: number } | null = null
  musicVolume = 0.35
  private lives = -1
  private wave = -1
  private phase = ''
  private shop = ''
  private ambient: {
    amb: GainNode
    windGain: GainNode
    windBp: BiquadFilterNode
    whistle: GainNode
    mineral: GainNode
    nextPop: number
    nextCreak: number
    lastTick: number
  } | null = null
  muted = false
  ambientVolume = 0.6

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
    this.loadSamples()
    this.ambientVolume = readAmbientVolume()
    this.startAmbient()
    this.musicVolume = readMusicVolume()
    this.startMusic()
    const len = this.ctx.sampleRate * 0.5
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }

  /** Ленивая загрузка сэмплов; не загрузился — звук остаётся синтезом */
  private loadSamples() {
    const ctx = this.ctx
    if (!ctx) return
    for (const files of [...Object.values(SAMPLES).map((d) => d.files), ...Object.values(STEP_FILES)]) {
      for (const name of files) {
        if (this.buffers.has(name)) continue
        fetch(SFX_DIR + name)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((ab) => ctx.decodeAudioData(ab))
          .then((buf) => {
            // нормализация на пик: у части файлов (mp3 Kenney) исходная громкость очень низкая
            let peak = 0
            for (let c = 0; c < buf.numberOfChannels; c++) for (const v of buf.getChannelData(c)) peak = Math.max(peak, Math.abs(v))
            if (peak > 0.001) for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= 0.79 / peak }
            this.buffers.set(name, buf)
          })
          .catch(() => {})
      }
    }
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05)
  }

  // ─── Ambient: тихий фон зимнего паропанка — ветер по порывам windAt, гул генератора лагеря, костры, скрип металла,
  //     низкий пульс минерала Разлома (сильнее на волне и при толпе врагов). Весь синтез в Web Audio, без сэмплов и стыков ───

  /** Громкость ambient 0..1 (запоминается); общий mute — через master */
  setAmbientVolume(v: number) {
    this.ambientVolume = Math.max(0, Math.min(1, v))
    try {
      window.localStorage.setItem('zr-ambient', String(this.ambientVolume))
    } catch {
      // не запомнили — не страшно
    }
    if (this.ambient && this.ctx) this.ambient.amb.gain.setTargetAtTime(this.ambientVolume * AMBIENT_LEVEL, this.ctx.currentTime, 0.1)
  }

  private startAmbient() {
    const ctx = this.ctx, master = this.master
    if (!ctx || !master || this.ambient) return
    const amb = ctx.createGain()
    amb.gain.value = this.ambientVolume * AMBIENT_LEVEL
    amb.connect(master)
    // зацикленный шум 6 с: случайный сигнал стыкуется без щелчка
    const loopNoise = () => {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      src.start(0, Math.random() * 5)
      return src
    }
    const pan = (p: number) => {
      const n = ctx.createStereoPanner()
      n.pan.value = p
      n.connect(amb)
      return n
    }
    // ветер: полосовой шум; сила и высота следуют за windAt
    const windBp = ctx.createBiquadFilter()
    windBp.type = 'bandpass'
    windBp.frequency.value = 300
    windBp.Q.value = 0.5
    const windLp = ctx.createBiquadFilter()
    windLp.type = 'lowpass'
    windLp.frequency.value = 900
    const windGain = ctx.createGain()
    windGain.gain.value = 0
    loopNoise().connect(windBp).connect(windLp).connect(windGain).connect(pan(0))
    // свист в порывах
    const whBp = ctx.createBiquadFilter()
    whBp.type = 'bandpass'
    whBp.frequency.value = 1300
    whBp.Q.value = 6
    const whistle = ctx.createGain()
    whistle.gain.value = 0
    loopNoise().connect(whBp).connect(whistle).connect(pan(0.1))
    // далёкий гул генератора лагеря справа: низкая пила с медленным дрожанием
    const hum = ctx.createOscillator()
    hum.type = 'sawtooth'
    hum.frequency.value = 50
    const humLp = ctx.createBiquadFilter()
    humLp.type = 'lowpass'
    humLp.frequency.value = 150
    const humGain = ctx.createGain()
    humGain.gain.value = 0.03
    const humLfo = ctx.createOscillator()
    humLfo.frequency.value = 0.35
    const humLfoGain = ctx.createGain()
    humLfoGain.gain.value = 0.007
    humLfo.connect(humLfoGain).connect(humGain.gain)
    hum.connect(humLp).connect(humGain).connect(pan(0.55))
    hum.start()
    humLfo.start()
    // пульс минерала Разлома слева: две низкие синусоиды, амплитуда медленно «дышит»
    const mineral = ctx.createGain()
    mineral.gain.value = 0.025
    const mineralAm = ctx.createGain()
    mineralAm.gain.value = 0.6
    const mLfo = ctx.createOscillator()
    mLfo.frequency.value = 0.22
    const mLfoGain = ctx.createGain()
    mLfoGain.gain.value = 0.4
    mLfo.connect(mLfoGain).connect(mineralAm.gain)
    for (const f of [46, 69]) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      o.connect(mineralAm)
      o.start()
    }
    mineralAm.connect(mineral).connect(pan(-0.6))
    mLfo.start()
    this.ambient = { amb, windGain, windBp, whistle, mineral, nextPop: 0, nextCreak: ctx.currentTime + 12 + Math.random() * 20, lastTick: 0 }
  }

  private ambientTick(game: Game) {
    const ctx = this.ctx, a = this.ambient
    if (!ctx || !a || ctx.state !== 'running') return
    const now = ctx.currentTime
    if (now - a.lastTick < 0.1) return
    a.lastTick = now
    const w = windAt(performance.now() / 1000) // 0.25..2, как у снега и дыма на экране
    const k = (w - 0.25) / 1.75
    a.windGain.gain.setTargetAtTime(0.05 + 0.09 * k, now, 0.25)
    a.windBp.frequency.setTargetAtTime(260 + 320 * k, now, 0.3)
    a.whistle.gain.setTargetAtTime(Math.max(0, w - 1.2) * 0.03, now, 0.2)
    const crowd = Math.min(1, game.creeps.length / 14)
    a.mineral.gain.setTargetAtTime(0.025 + (game.phase === 'wave' ? 0.02 + 0.04 * crowd : 0), now, 0.8)
    // потрескивание костров: редкие мягкие щелчки угольков
    if (now >= a.nextPop && this.noise) {
      const pops = 1 + Math.floor(Math.random() * 3)
      const p = Math.max(-0.6, Math.min(0.9, Math.random() * 1.5 - 0.5))
      for (let i = 0; i < pops; i++) {
        const at = now + i * (0.02 + Math.random() * 0.07)
        const src = ctx.createBufferSource()
        src.buffer = this.noise
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1200 + Math.random() * 1400
        bp.Q.value = 1.2
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 3200
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(0.05 * (0.5 + Math.random() * 0.5), at + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03 + Math.random() * 0.05)
        const pn = ctx.createStereoPanner()
        pn.pan.value = p
        src.connect(bp).connect(lp).connect(g).connect(pn).connect(a.amb)
        src.start(at, Math.random() * 0.3)
        src.stop(at + 0.12)
      }
      a.nextPop = now + 0.5 + Math.random() * 2.4
    }
    // редкий далёкий скрип металла (вышка, ворота лагеря)
    if (now >= a.nextCreak) {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(150, now)
      o.frequency.exponentialRampToValueAtTime(118, now + 1.4)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 420
      bp.Q.value = 3
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(0.02, now + 0.35)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
      const pn = ctx.createStereoPanner()
      pn.pan.value = 0.6
      o.connect(bp).connect(g).connect(pn).connect(a.amb)
      o.start(now)
      o.stop(now + 1.6)
      a.nextCreak = now + 25 + Math.random() * 35
    }
  }

  // ─── Музыка: тихие тревожные дорожки по кругу; кроссфейд убирает стыки, громкость выравнивается по RMS ───

  /** Громкость музыки 0..1 (запоминается в zr-music) */
  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v))
    try {
      window.localStorage.setItem('zr-music', String(this.musicVolume))
    } catch {
      // не запомнили — не страшно
    }
    if (this.music && this.ctx) this.music.gain.gain.setTargetAtTime(this.musicVolume * MUSIC_LEVEL, this.ctx.currentTime, 0.2)
  }

  private startMusic() {
    const ctx = this.ctx, master = this.master
    if (!ctx || !master || this.music) return
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(master)
    const m = { gain, bufs: MUSIC_FILES.map(() => null as AudioBuffer | null), factors: MUSIC_FILES.map(() => 1), idx: -1, nextAt: Infinity }
    this.music = m
    gain.gain.setTargetAtTime(this.musicVolume * MUSIC_LEVEL, ctx.currentTime, 2.5) // плавное появление
    MUSIC_FILES.forEach((name, i) => {
      fetch(MUSIC_DIR + name)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => {
          // единый уровень дорожек по RMS
          const d = buf.getChannelData(0)
          let sum = 0, n = 0
          for (let k = 0; k < d.length; k += 7) { sum += d[k] * d[k]; n++ }
          const rms = Math.sqrt(sum / Math.max(1, n))
          m.factors[i] = Math.max(0.25, Math.min(2.5, 0.08 / Math.max(rms, 1e-4)))
          m.bufs[i] = buf
          if (m.idx < 0) this.musicNext()
        })
        .catch(() => {})
    })
    // планировщик: следующий проход стартует за MUSIC_FADE до конца текущего
    window.setInterval(() => {
      if (ctx.currentTime >= m.nextAt) this.musicNext()
    }, 500)
  }

  private musicNext() {
    const m = this.music, ctx = this.ctx
    if (!m || !ctx) return
    const ready = m.bufs.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
    if (!ready.length) return
    const idx = ready.find((i) => i > m.idx) ?? ready[0]
    m.idx = idx
    const buf = m.bufs[idx]!
    const now = ctx.currentTime
    const fade = Math.min(MUSIC_FADE, buf.duration / 3)
    const f = m.factors[idx]
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(f, now + fade)
    g.gain.setValueAtTime(f, now + buf.duration - fade)
    g.gain.linearRampToValueAtTime(0, now + buf.duration)
    src.connect(g).connect(m.gain)
    src.start(now)
    src.stop(now + buf.duration + 0.1)
    m.nextAt = now + buf.duration - fade
  }

  /** Музыка на время приглушается — под рог волны */
  private duckMusic(sec = 2.5) {
    const ctx = this.ctx, m = this.music
    if (!ctx || !m) return
    const now = ctx.currentTime, level = this.musicVolume * MUSIC_LEVEL
    m.gain.gain.cancelScheduledValues(now)
    m.gain.gain.setTargetAtTime(level * 0.45, now, 0.15)
    m.gain.gain.setTargetAtTime(level, now + sec, 1)
  }

  /** Шаг моба: тихий сэмпл по виду, случайные высота и громкость, не больше MAX_STEP_VOICES одновременно */
  private playStep(def: StepDef, x: number) {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted || ctx.state !== 'running' || this.stepVoices >= MAX_STEP_VOICES) return
    const files = STEP_FILES[def.cls].filter((n) => this.buffers.has(n))
    if (!files.length) return
    const src = ctx.createBufferSource()
    src.buffer = this.buffers.get(files[Math.floor(Math.random() * files.length)])!
    src.playbackRate.value = def.rate * (0.9 + Math.random() * 0.2)
    const g = ctx.createGain()
    g.gain.value = def.gain * (0.7 + Math.random() * 0.6)
    const pan = ctx.createStereoPanner()
    pan.pan.value = Math.max(-0.7, Math.min(0.7, (x / MAP_W) * 1.4 - 0.7))
    src.connect(g).connect(pan).connect(this.master)
    this.stepVoices++
    src.onended = () => { this.stepVoices-- }
    src.start()
  }

  /** Сравнить состояние с прошлым кадром и проиграть звуки событий */
  tick(game: Game) {
    this.ambientTick(game)
    // рестарт или новая игра — запоминаем состояние молча (иначе исчезнувшие враги «погибнут» хором)
    const restarted = game.wave < this.wave || (game.phase === 'intro' && this.phase !== 'intro')
    const fresh = this.lives < 0 || restarted
    let budget = 6 // не больше 6 звуков за кадр
    const play = (s: Sound, x = MAP_W / 2, rate = 1) => {
      if (fresh || budget <= 0) return
      budget--
      this.play(s, x, rate)
    }

    // выстрелы и новые башни
    const ids = new Set<number>()
    for (const tw of game.towers) {
      ids.add(tw.id)
      const prev = this.shots.get(tw.id)
      if (prev !== undefined && tw.lastShotAt > prev) {
        const shot = shotSound(ALL_DEFS[tw.defId])
        play(shot.s, tw.x, shot.rate)
      }
      this.shots.set(tw.id, tw.lastShotAt)
      if (!this.towerIds.has(tw.id)) play('build', tw.x)
    }
    for (const id of this.shots.keys()) if (!ids.has(id)) this.shots.delete(id)
    this.towerIds = ids

    // гибель врагов и прорывы
    const alive = new Map(game.creeps.map((c) => [c.uid, c.kind] as const))
    const leaked = this.lives >= 0 && game.lives < this.lives
    for (const [uid, kind] of this.creeps) if (!alive.has(uid) && !leaked) play('die', MAP_W / 2, DIE_RATE[kind] ?? 1)
    if (leaked) play('leak', MAP_W)
    this.creeps = alive
    this.lives = game.lives

    // шаги: каждые stride пикселей пройденного пути — один шаг (по разнице dist между кадрами, поэтому слышно и у гостя коопа)
    let stepBudget = MAX_STEPS_PER_FRAME
    const seen = new Set<number>()
    for (const c of game.creeps) {
      seen.add(c.uid)
      const def = STEP_BY_KIND[c.kind]
      const prev = this.stepLast.get(c.uid)
      this.stepLast.set(c.uid, c.dist)
      if (!def || prev === undefined || fresh) continue
      const moved = c.dist - prev
      if (moved <= 0 || moved > 80) continue
      const acc = (this.stepAcc.get(c.uid) ?? Math.random() * def.stride) + moved
      if (acc >= def.stride && stepBudget > 0) {
        stepBudget--
        this.playStep(def, pointAtLength(c.dist, c.pathIdx).x)
        this.stepAcc.set(c.uid, acc - def.stride)
      } else this.stepAcc.set(c.uid, Math.min(acc, def.stride * 1.5))
    }
    for (const uid of this.stepLast.keys()) if (!seen.has(uid)) { this.stepLast.delete(uid); this.stepAcc.delete(uid) }

    // начало волны и ролл арсенала
    if (game.phase === 'wave' && (this.phase !== 'wave' || game.wave !== this.wave)) {
      play('horn')
      if (!fresh) this.duckMusic()
    }
    const shop = game.shop.join()
    if (this.shop && shop && shop !== this.shop) play('roll')
    this.shop = shop
    this.phase = game.phase
    this.wave = game.wave
  }

  private play(s: Sound, x: number, rate = 1) {
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

    // сэмпл, если загружен: случайный из списка, лёгкий разброс высоты; число голосов ограничено
    const smp = SAMPLES[s]
    const ready = smp?.files.filter((n) => this.buffers.has(n)) ?? []
    if (smp && ready.length) {
      if (this.voices >= MAX_VOICES) return
      const src = ctx.createBufferSource()
      src.buffer = this.buffers.get(ready[Math.floor(Math.random() * ready.length)])!
      src.playbackRate.value = rate * (0.93 + Math.random() * 0.14)
      const g = ctx.createGain()
      g.gain.value = smp.gain
      src.connect(g).connect(pan)
      this.voices++
      src.onended = () => { this.voices-- }
      src.start(now)
      return
    }

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

    switch (SYNTH[s]) {
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
