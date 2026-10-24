// Пиксельные спрайты «Железного Разлома»: палитра и существа, нарисованные строками символов
// (Охотница, кристалл и искра Разлома; остальные враги — картинки из листа, см. assets.ts).
// Плюс снегопад поверх мира и превью башен для карточек арсенала.

import { ARMOR_COLORS, MAP_H, MAP_W } from './config'
import { towerArt } from './assets'
import { towerThumbUrl } from './towers'
import { windAt, windPath } from './wind'
import type { ArmorType, CreepKind, TowerDefinition } from './types'

// ─── Цвета ───────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgb(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `rgb(${c(r)},${c(g)},${c(b)})`
}
/** Темнее/светлее цвета: k < 1 — темнее, k > 1 — светлее */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex)
  return k <= 1 ? rgb(r * k, g * k, b * k) : rgb(r + (255 - r) * (k - 1), g + (255 - g) * (k - 1), b + (255 - b) * (k - 1))
}

/** Общая палитра спрайтов. A/a/h — броня врага (основной, тень, блик) подставляются при отрисовке */
const PALETTE: Record<string, string> = {
  K: '#0e0d12', // контур
  B: '#d4a85a', // латунь
  b: '#7d5a2c', // тёмная латунь
  S: '#a8adb3', // сталь
  s: '#61666d', // тёмная сталь
  D: '#3c4046', // воронёная сталь
  E: '#ff3b24', // глаз ИИ
  e: '#ffc2b0', // блик глаза
  W: '#ece6d6', // пар
  F: '#ff8a1e', // огонь
  f: '#ffdc4a', // жёлтое пламя
  G: '#a6f095', // кристалл Разлома
  g: '#4e9a46', // тёмный кристалл
  L: '#eaffdf', // светлый кристалл
  P: '#6b4a2e', // кожа (снаряжение)
  p: '#3f2a18', // тёмная кожа
  C: '#3f7a5a', // плащ
  c: '#275040', // тень плаща
  T: '#e8b48a', // лицо
  H: '#c06a2a', // волосы
  R: '#b03a32', // красное знамя
  r: '#6e2220',
  M: '#a9b8cf', // латы
  m: '#5f7391',
  V: '#6a5ac8', // мантия мага
  v: '#3e3478',
  Y: '#d9a441', // золочёная отделка
  O: '#c8742e', // куртка инженера
  o: '#8a4a1c',
  Q: '#9fd2ff', // стёкла очков
}

// ─── Спрайты: строки символов палитры, «.» — прозрачно. Все смотрят вправо ─
interface SpriteDef {
  frames: string[][]
  fps: number
  bob?: number // покачивание по вертикали, LOW-пиксели (парящие)
}

export const SPRITES: Record<CreepKind | 'hunter' | 'voevoda' | 'archmage' | 'engineer', SpriteDef> = {
  // паровой паук: котёл-брюшко на шести лапах, труба с паром
  scuttler: {
    fps: 8,
    frames: [
      [
        '......bB...W....',
        '......bB........',
        '.....KKKKKK.....',
        '...KKhhAAAAKK...',
        '..KhAAAAAAAAEK..',
        '..KAAABBBAAAeK..',
        '..KAAAAAAAAAAK..',
        '..KaAAAAAAAAaK..',
        '...KaaaaaaaaK...',
        '..K.sK.sK.sK.s..',
        '.s..s..s..s..s..',
        's...s...s....s..',
      ],
      [
        '......bB........',
        '......bB..W.....',
        '.....KKKKKK.....',
        '...KKhhAAAAKK...',
        '..KhAAAAAAAAEK..',
        '..KAAABBBAAAeK..',
        '..KAAAAAAAAAAK..',
        '..KaAAAAAAAAaK..',
        '...KaaaaaaaaK...',
        '...sK.s.Ks..Ks..',
        '..s..s.s..s..s..',
        '.s...s..s...s...',
      ],
    ],
  },
  // заводной жук: панцирь со швом, заводной ключ сзади, трепещущие крылья
  swarm: {
    fps: 14,
    frames: [
      [
        '....WW..WW....',
        '...WhW..WhW...',
        '....KKKKKK....',
        '..KKhAAAAAKK..',
        '.KhAAAAAAAAEK.',
        'KBKAAAKAAAAeK.',
        '.BKaAAKAAAAaK.',
        '..KKaaKaaaKK..',
        '...s.s..s.s...',
        '..s..s..s..s..',
      ],
      [
        '..............',
        '..WWW....WWW..',
        '....KKKKKK....',
        '..KKhAAAAAKK..',
        '.KhAAAAAAAAEK.',
        'KbKAAAKAAAAeK.',
        '.bKaAAKAAAAaK.',
        '..KKaaKaaaKK..',
        '....s.s..s.s..',
        '...s..s.s..s..',
      ],
    ],
  },
  // заводной пехотинец: стальной шлем с глазом, винтовка, заводной ключ на спине
  trooper: {
    fps: 7,
    frames: [
      [
        '....KKKK....',
        '...KSSSsK...',
        '...KSSEeK...',
        '...KsSSSK...',
        '....KKKK....',
        '..BKKAAKK...',
        '.BbKhAAAAK..',
        '..BKAABAAKS.',
        '.BbKAAAAAKS.',
        '..BKaAAAaK..',
        '...KKaaKK...',
        '...KsK.KsK..',
        '...Ks...Ks..',
        '..Kss...Kss.',
      ],
      [
        '....KKKK....',
        '...KSSSsK...',
        '...KSSEeK...',
        '...KsSSSK...',
        '....KKKK....',
        '..bKKAAKK...',
        '.BBKhAAAAK..',
        '..bKAABAAKS.',
        '.BBKAAAAAKS.',
        '..bKaAAAaK..',
        '...KKaaKK...',
        '...KsKKsK...',
        '....KsKs....',
        '...KssKss...',
      ],
    ],
  },
  // паровой наездник: всадник на байке-котле, выхлоп, колёса со спицами
  rider: {
    fps: 12,
    frames: [
      [
        '.......KKK........',
        '......KSEeK.......',
        '......KTTTK.......',
        '.......KAK........',
        '..W...KAAAK.......',
        '.WW.KKKAAAKKKK....',
        '...KbBBBBBBBBhK...',
        '..KBBbbbbbbbBAAK..',
        '.KsKKBBBBBBKKAAK..',
        'KsSsK.KKKK.KsSsK..',
        'KSDSK......KSDSK..',
        '.KsK........KsK...',
      ],
      [
        '.......KKK........',
        '......KSEeK.......',
        '......KTTTK.......',
        '.......KAK........',
        '.W....KAAAK.......',
        'W.W.KKKAAAKKKK....',
        '...KbBBBBBBBBhK...',
        '..KBBbbbbbbbBAAK..',
        '.KsKKBBBBBBKKAAK..',
        'KSsSK.KKKK.KSsSK..',
        'KsDsK......KsDsK..',
        '.KsK........KsK...',
      ],
    ],
  },
  // котельный латник: бронекорпус с клёпками, две дымящие трубы, смотровая щель
  juggernaut: {
    fps: 5,
    frames: [
      [
        '...bB....bB.....',
        '...bB.W..bB..W..',
        '..KKKKKKKKKKK...',
        '.KhhAAAAAAAAAK..',
        '.KhAAAAAAAAAAK..',
        '.KAABBAAAASSSK..',
        '.KAABBAAAASEeK..',
        '.KAAAAAAAASSSK..',
        '.KaKKKKKKKKKaK..',
        '.KaAABAABAAAaK..',
        '.KaaaaaaaaaaaK..',
        '..KKsK..KKsK....',
        '...Kss...Kss....',
        '..KSSS..KSSS....',
      ],
      [
        '...bB....bB.....',
        '...bB..W.bB.W...',
        '..KKKKKKKKKKK...',
        '.KhhAAAAAAAAAK..',
        '.KhAAAAAAAAAAK..',
        '.KAABBAAAASSSK..',
        '.KAABBAAAASEeK..',
        '.KAAAAAAAASSSK..',
        '.KaKKKKKKKKKaK..',
        '.KaAABAABAAAaK..',
        '.KaaaaaaaaaaaK..',
        '..KKsK...KKsK...',
        '..Kss....Kss....',
        '.KSSS....KSSS...',
      ],
    ],
  },
  // заражённый автоматон: клёпаный корпус, в груди вместо топки — кристалл минерала, стальные руки
  golem: {
    fps: 4,
    frames: [
      [
        '.....KKKKKKKK.....',
        '....KhhAAAAAAK....',
        '...KhAAAAAAAAAK...',
        '...KAAAAAAAEeAK...',
        '...KAABAAABAAAK...',
        '..KKKKKKKKKKKKKK..',
        '.KSSKAAAAAAAAKSSK.',
        '.KSsKAAKKKKAAKSsK.',
        '.KSsKAAKGLKAAKSsK.',
        '.KSsKAAKGGKAAKSsK.',
        '.KSSKAAKKKKAAKSSK.',
        '.KssKAABAABAAKssK.',
        '..KK.KaaaaaaK.KK..',
        '.....KKKKKKKK.....',
        '.....KsK..KsK.....',
        '....KSSK..KSSK....',
      ],
      [
        '.....KKKKKKKK.....',
        '....KhhAAAAAAK....',
        '...KhAAAAAAAAAK...',
        '...KAAAAAAAEeAK...',
        '...KAABAAABAAAK...',
        '..KKKKKKKKKKKKKK..',
        '.KSSKAAAAAAAAKSSK.',
        '.KSsKAAKKKKAAKSsK.',
        '.KSsKAAKLGKAAKSsK.',
        '.KSsKAAKGLKAAKSsK.',
        '.KSSKAAKKKKAAKSSK.',
        '.KssKAABAABAAKssK.',
        '..KK.KaaaaaaK.KK..',
        '.....KKKKKKKK.....',
        '....KsK..KsK......',
        '...KSSK..KSSK.....',
      ],
    ],
  },
  // кристалл Разлома: парящий самородок минерала с глазом, осколки вокруг
  rift: {
    fps: 3,
    bob: 2,
    frames: [
      [
        '......KK......',
        '.....KLGK.....',
        '....KLGGgK....',
        '...KLGGGGgK...',
        '..KKGGGGGgKK..',
        '.KLGGEeGGGgK..',
        '.KGGGeeGGGgK..',
        '..KGGGGGGgK...',
        '...KgGGGggK...',
        '....KgGggK....',
        '.....KggK.....',
        '......KK......',
        '..............',
        '....g.....g...',
      ],
      [
        '......KK......',
        '.....KLGK.....',
        '....KLGGgK....',
        '...KLGGGGgK...',
        '..KKGGGGGgKK..',
        '.KLGGEeGGGgK..',
        '.KGGGeeGGGgK..',
        '..KGGGGGGgK...',
        '...KgGGGggK...',
        '....KgGggK....',
        '.....KggK.....',
        '......KK......',
        '...g.......g..',
        '..............',
      ],
    ],
  },
  // искра Разлома: светящееся ядро с огненным хвостом
  wisp: {
    fps: 10,
    bob: 3,
    frames: [
      [
        '..........K.',
        '....KKK..KLK',
        '..WKLLLK..K.',
        '.WGKLEeLK...',
        'WGGKLLLLK...',
        '.WGKLLLK....',
        '..W.KKK.....',
      ],
      [
        '..........K.',
        '....KKK..KLK',
        '..GKLLLK..K.',
        '.GWKLEeLK...',
        'GWGKLLLLK...',
        '.GWKLLLK....',
        '..G.KKK.....',
      ],
    ],
  },
  // Титан-ИИ: купол с огромным глазом, венец шестерён, топка в груди, руки-орудия
  titan: {
    fps: 3,
    frames: [
      [
        '.........KKKKKKKKKK.........',
        '.......KKBbBbBbBbBbKK.......',
        '......KhhAAAAAAAAAAAAK......',
        '.....KhAAAAKKKKKKAAAAAK.....',
        '.....KAAAAKDDDDDDKAAAAK.....',
        '.....KAAAAKDEEEeDKAAAAK.....',
        '.....KAAAAKDEEeeDKAAAAK.....',
        '.....KAAAAKDDDDDDKAAAAK.....',
        '.....KaAAAAKKKKKKAAAAaK.....',
        '..KKKKKKKKKKKKKKKKKKKKKKKK..',
        '.KSSSKAAABAAAAAAAABAAAKSSSK.',
        '.KSsSKAAAAAKKKKKKAAAAAKSsSK.',
        '.KSsSKAAAAKFFFFFFKAAAAKSsSK.',
        '.KSsSKAAAAKFffffFKAAAAKSsSK.',
        '.KSsSKAAAAKFFFFFFKAAAAKSsSK.',
        '.KSSSKAAAAAKKKKKKAAAAAKSSSK.',
        '.KDDDKaAABAAAAAAAABAAaKDDDK.',
        '..KKK.KaaaaaaaaaaaaaaK.KKK..',
        '......KKKKKKKKKKKKKKKK......',
        '.......KsSK......KsSK.......',
        '.......KsSK......KsSK.......',
        '......KSSSSK....KSSSSK......',
        '.....KDDDDDDK..KDDDDDDK.....',
      ],
      [
        '.........KKKKKKKKKK.........',
        '.......KKbBbBbBbBbBKK.......',
        '......KhhAAAAAAAAAAAAK......',
        '.....KhAAAAKKKKKKAAAAAK.....',
        '.....KAAAAKDDDDDDKAAAAK.....',
        '.....KAAAAKDEEeeDKAAAAK.....',
        '.....KAAAAKDEEEeDKAAAAK.....',
        '.....KAAAAKDDDDDDKAAAAK.....',
        '.....KaAAAAKKKKKKAAAAaK.....',
        '..KKKKKKKKKKKKKKKKKKKKKKKK..',
        '.KSSSKAAABAAAAAAAABAAAKSSSK.',
        '.KSsSKAAAAAKKKKKKAAAAAKSsSK.',
        '.KSsSKAAAAKFffffFKAAAAKSsSK.',
        '.KSsSKAAAAKFFFFFFKAAAAKSsSK.',
        '.KSsSKAAAAKFffffFKAAAAKSsSK.',
        '.KSSSKAAAAAKKKKKKAAAAAKSSSK.',
        '.KDDDKaAABAAAAAAAABAAaKDDDK.',
        '..KKK.KaaaaaaaaaaaaaaK.KKK..',
        '......KKKKKKKKKKKKKKKK......',
        '.......KsSK......KsSK.......',
        '........KsSK....KsSK........',
        '.......KSSSSK..KSSSSK.......',
        '......KDDDDDDKKDDDDDDK......',
      ],
    ],
  },
  // Воевода: латы, красное знамя на древке
  voevoda: {
    fps: 8,
    frames: [
      [
        '....KKK..bRR',
        '...KMMMK.bRR',
        '..KMmTTK.bRr',
        '..KMTTTK.b..',
        '...KTTK..b..',
        '..KMMMMK.b..',
        '.KMMPMMMKb..',
        '.KMMPMMMKB..',
        '.KmMPMMmKb..',
        '..KmPPmK.b..',
        '..KpKKpK.b..',
        '..Kp..Kp.b..',
        '.Kpp..Kpp.b.',
      ],
      [
        '....KKK..bRR',
        '...KMMMK.bRR',
        '..KMmTTK.bRr',
        '..KMTTTK.b..',
        '...KTTK..b..',
        '..KMMMMK.b..',
        '.KMMPMMMKb..',
        '.KMMPMMMKB..',
        '.KmMPMMmKb..',
        '..KmPPmK.b..',
        '..KpKKpK.b..',
        '...KpKp..b..',
        '..KppKpp.b..',
      ],
    ],
  },
  // Архимаг: остроконечный колпак, фиолетовая мантия, посох с кристаллом
  archmage: {
    fps: 8,
    frames: [
      [
        '....K....gLg',
        '...KVK...bg.',
        '..KVVVK..b..',
        '.KVVTTVK.b..',
        '..KVTTK..b..',
        '..KVVVVK.b..',
        '.KVVYVVVKb..',
        '.KVVYVVVKB..',
        '.KvVYVVvKb..',
        '..KvVVvK.b..',
        '.KvvvvvvKb..',
        '..KpKKpK.b..',
        '..Kp..Kp.b..',
      ],
      [
        '....K....gLg',
        '...KVK...bg.',
        '..KVVVK..b..',
        '.KVVTTVK.b..',
        '..KVTTK..b..',
        '..KVVVVK.b..',
        '.KVVYVVVKb..',
        '.KVVYVVVKB..',
        '.KvVYVVvKb..',
        '..KvVVvK.b..',
        '.KvvvvvvKb..',
        '...KpKp..b..',
        '..KppKpp.b..',
      ],
    ],
  },
  // Инженер: очки-гогглы, латунный шлем, оранжевая куртка, гаечный ключ
  engineer: {
    fps: 8,
    frames: [
      [
        '....KKK.....',
        '...KYYYK....',
        '..KYQQQYK...',
        '..KTTTTK..B.',
        '...KTTK..Bb.',
        '..KOOOOK.b..',
        '.KOOYOOOKb..',
        '.KOOYOOOKb..',
        '.KoOYOOoKB..',
        '..KoYYoK.b..',
        '..KpKKpK....',
        '..Kp..Kp....',
        '.Kpp..Kpp...',
      ],
      [
        '....KKK.....',
        '...KYYYK....',
        '..KYQQQYK...',
        '..KTTTTK..B.',
        '...KTTK..Bb.',
        '..KOOOOK.b..',
        '.KOOYOOOKb..',
        '.KOOYOOOKb..',
        '.KoOYOOoKB..',
        '..KoYYoK.b..',
        '..KpKKpK....',
        '...KpKp.....',
        '..KppKpp....',
      ],
    ],
  },
  // Охотница: капюшон-плащ, латунный лук
  hunter: {
    fps: 8,
    frames: [
      [
        '....KKK.....',
        '...KCCCK....',
        '..KCcTTK....',
        '..KCTTHK....',
        '...KTTK..B..',
        '..KCCCCK.bB.',
        '.KCCPCCCKBb.',
        '.KCCPCCCKB..',
        '.KcCPCCcKb..',
        '..KcPPcK.B..',
        '..KpKKpK....',
        '..Kp..Kp....',
        '.Kpp..Kpp...',
      ],
      [
        '....KKK.....',
        '...KCCCK....',
        '..KCcTTK....',
        '..KCTTHK....',
        '...KTTK..B..',
        '..KCCCCK.bB.',
        '.KCCPCCCKBb.',
        '.KCCPCCCKB..',
        '.KcCPCCcKb..',
        '..KcPPcK.B..',
        '..KpKKpK....',
        '...KpKp.....',
        '..KppKpp....',
      ],
    ],
  },
}

// ─── Кэш спрайтов: (вид, кадр, броня, зеркало) → маленький холст ─────────
const spriteCache = new Map<string, HTMLCanvasElement>()

function buildSprite(rows: string[], body: string, flip: boolean): HTMLCanvasElement {
  const h = rows.length
  const w = rows[0].length
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')!
  const pal: Record<string, string> = { ...PALETTE, A: body, a: shade(body, 0.68), h: shade(body, 1.35) }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x]
      if (ch === '.') continue
      ctx.fillStyle = pal[ch] ?? '#ff00ff'
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1)
    }
  }
  return cv
}

const portraitCache = new Map<string, string>()
/** Портрет аватара для HUD и выбора: первый кадр спрайта, крупно, без сглаживания (data URL) */
export function avatarPortrait(id: 'hunter' | 'voevoda' | 'archmage' | 'engineer', scale = 4): string {
  if (typeof document === 'undefined') return ''
  const key = id + scale
  let url = portraitCache.get(key)
  if (!url) {
    const src = buildSprite(SPRITES[id].frames[0], '#888888', false)
    const cv = document.createElement('canvas')
    cv.width = src.width * scale
    cv.height = src.height * scale
    const g = cv.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(src, 0, 0, cv.width, cv.height)
    url = cv.toDataURL()
    portraitCache.set(key, url)
  }
  return url
}

function sprite(id: keyof typeof SPRITES, frame: number, body: string, flip: boolean) {
  const key = `${id}|${frame}|${body}|${flip ? 1 : 0}`
  let cv = spriteCache.get(key)
  if (!cv) {
    cv = buildSprite(SPRITES[id].frames[frame], body, flip)
    spriteCache.set(key, cv)
  }
  return cv
}

/**
 * Пиксельный спрайт ногами в точку экрана (sx, sy), увеличенный в scale раз без сглаживания.
 * Нужен существам без картинки из листа: Охотнице, адаптанту и искре минерала (и как запасной вариант).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D, id: keyof typeof SPRITES, sx: number, sy: number, time: number, seed: number,
  facingLeft: boolean, stunned: boolean, body = '#888888', scale = 2
) {
  const def = SPRITES[id]
  const frame = stunned ? 0 : Math.floor(time * def.fps + seed * 0.37) % def.frames.length
  const img = sprite(id, frame, body, facingLeft)
  const w = img.width * scale
  const h = img.height * scale
  const lift = def.bob ? 4 * scale : 0
  const bob = def.bob ? Math.round(Math.sin(time * 3 + seed) * def.bob) * scale : 0
  ctx.save()
  ctx.fillStyle = 'rgba(14,22,52,0.42)'
  ctx.beginPath()
  ctx.ellipse(sx + 2, sy, w * 0.36, w * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, Math.round(sx - w / 2), Math.round(sy - h - lift + bob), w, h)
  ctx.restore()
}

export function armorBody(armor: ArmorType) {
  return ARMOR_COLORS[armor]
}

// ─── Превью башни для карточек арсенала — тот же спрайт, что на поле ─────
export function towerThumb(def: TowerDefinition): string {
  return towerThumbUrl(def, towerArt(def))
}

// ─── Снегопад и угольки: летят по ветру над полем (экранные координаты 960×600) ─
/** Детерминированные частицы: положение — функция от номера и времени, без состояния */
export function drawMotes(ctx: CanvasRenderingContext2D, time: number) {
  const W = MAP_W
  const H = MAP_H
  const wnd = windAt(time)
  const path = windPath(time)
  for (let i = 0; i < 260; i++) {
    if (i % 17 === 0) {
      // тлеющий уголёк — поднимается от огней и уносится ветром
      const x = Math.floor((((i * 197.3 + path * 18) % (W + 40)) + W + 40) % (W + 40)) - 20
      const y = Math.floor((i * 107.7) % H + Math.sin(time * 0.8 + i) * 12 - (time * 8 + i * 23) % 80)
      ctx.fillStyle = `rgba(255,150,60,${0.45 + 0.25 * Math.sin(time * 2 + i * 1.7)})`
      ctx.fillRect(x, ((y % H) + H) % H, 2, 2)
      continue
    }
    // снежинки: ближний слой крупнее, быстрее и ярче; падают наискосок по ветру и чуть петляют
    const near = i % 4 === 0
    const fall = near ? 46 + (i % 5) * 4 : 18 + (i % 7) * 3
    const drift = near ? 34 : 17
    const y = (i * 107.7 + time * fall) % (H + 20) - 10
    const x = ((((i * 194.3 + path * drift + Math.sin(time * 1.3 + i) * 6) % (W + 40)) + W + 40) % (W + 40)) - 20
    ctx.fillStyle = `rgba(236,243,255,${near ? 0.9 : 0.45 + 0.2 * Math.sin(i)})`
    const s = near ? (i % 8 === 0 ? 4 : 3) : 2
    // в порыв снежинка вытягивается по ветру
    const streak = Math.max(0, wnd - 1) * (near ? 6 : 3)
    ctx.fillRect(Math.floor(x - streak), Math.floor(y), s + Math.round(streak), s)
  }
}
