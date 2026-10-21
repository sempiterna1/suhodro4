// Пиксельная графика «Железного Разлома» (ретро).
// Мир рисуется в холст LOW_W×LOW_H (половина разрешения поля) и растягивается без сглаживания —
// один «пиксель» = 2×2 экранных. Здесь: палитра, спрайты врагов и Охотницы (по пикселям, 2 кадра),
// пиксельный фон с тропой и декором (по зерну карты) и процедурные пиксельные башни.
// Координаты функций draw* — в пикселях поля (960×600); переводятся в LOW сами.

import { ARMOR_COLORS, CELL, MAP_H, MAP_W } from './config'
import type { GameMap } from './map'
import type { ArmorType, CreepKind, Tower, TowerDefinition, Vec } from './types'

export const PX = 0.5 // масштаб LOW-холста относительно поля
export const LOW_W = MAP_W * PX // 480
export const LOW_H = MAP_H * PX // 300
const LC = CELL * PX // клетка в LOW-пикселях (20)

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
  K: '#140d07', // контур
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
}

// ─── Спрайты: строки символов палитры, «.» — прозрачно. Все смотрят вправо ─
interface SpriteDef {
  frames: string[][]
  fps: number
  bob?: number // покачивание по вертикали, LOW-пиксели (парящие)
}

export const SPRITES: Record<CreepKind | 'hunter', SpriteDef> = {
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
  // клёпаный голем: массивный корпус, горящая топка в груди, стальные руки
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
        '.KSsKAAKFfKAAKSsK.',
        '.KSsKAAKFFKAAKSsK.',
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
        '.KSsKAAKfFKAAKSsK.',
        '.KSsKAAKFfKAAKSsK.',
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

function sprite(id: keyof typeof SPRITES, frame: number, body: string, flip: boolean) {
  const key = `${id}|${frame}|${body}|${flip ? 1 : 0}`
  let cv = spriteCache.get(key)
  if (!cv) {
    cv = buildSprite(SPRITES[id].frames[frame], body, flip)
    spriteCache.set(key, cv)
  }
  return cv
}

/** Чёрный силуэт спрайта — для длинной тени (кэш рядом со спрайтом) */
function silhouette(img: HTMLCanvasElement, key: string) {
  let cv = spriteCache.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const c = cv.getContext('2d')!
    c.drawImage(img, 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = '#000'
    c.fillRect(0, 0, cv.width, cv.height)
    spriteCache.set(key, cv)
  }
  return cv
}

/**
 * Длинная тень: силуэт «ложится» на землю вниз-вправо (свет сверху-слева).
 * Матрица переворачивает силуэт вниз, сжимает по высоте и скашивает вправо; основание — у ног.
 * lift — насколько фигура над землёй (парящие): тень отрывается от ног.
 */
function longShadow(L: CanvasRenderingContext2D, sil: HTMLCanvasElement, cx: number, by: number, lift = 0) {
  L.save()
  L.globalAlpha = lift ? 0.22 : 0.32
  L.setTransform(1, 0, -0.75, -0.4, cx, by + 1 + lift)
  L.drawImage(sil, -Math.floor(sil.width / 2), -sil.height)
  L.restore()
}

/** Пиксельная тень-овал под фигурой (LOW-координаты) */
function shadow(L: CanvasRenderingContext2D, cx: number, by: number, w: number) {
  L.fillStyle = 'rgba(0,0,0,0.35)'
  L.fillRect(cx - Math.round(w / 2) + 1, by, w - 2, 1)
  L.fillRect(cx - Math.round(w / 2) + 2, by + 1, w - 4, 1)
}

/**
 * Спрайт с ногами у точки p (центр клетки тропы). L — LOW-контекст с единичной матрицей.
 * facingLeft — зеркалим; stunned — анимация на паузе.
 */
export function drawSprite(
  L: CanvasRenderingContext2D, id: keyof typeof SPRITES, p: Vec, time: number, seed: number,
  facingLeft: boolean, stunned: boolean, body = '#888888'
) {
  const def = SPRITES[id]
  const frame = stunned ? 0 : Math.floor(time * def.fps + seed * 0.37) % def.frames.length
  const img = sprite(id, frame, body, facingLeft)
  const cx = Math.round(p.x * PX)
  const bob = def.bob ? Math.round(Math.sin(time * 3 + seed) * def.bob) : 0
  const by = Math.round(p.y * PX + img.height / 2 - 1)
  longShadow(L, silhouette(img, `${id}|${frame}|${body}|${facingLeft ? 1 : 0}|sh`), cx, by, def.bob ? 4 : 0)
  shadow(L, cx, by + 1, Math.max(6, Math.round(img.width * 0.7)))
  L.drawImage(img, cx - Math.floor(img.width / 2), by - img.height + 1 - (def.bob ? 2 : 0) + bob)
}

export function armorBody(armor: ArmorType) {
  return ARMOR_COLORS[armor]
}

// ─── Фон: земля, тропа, декор (по зерну карты) ───────────────────────────
// только 32-битная целочисленная арифметика: с обычным умножением большие зёрна карты
// теряли точность, и «случайный» декор вырождался в ровную сетку
function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const GROUND = ['#201811', '#231a12', '#1d150f', '#261c13']

/** Большая стальная плита пола: клёпки по углам, шов посередине, ржавые пятна */
function floorPlate(L: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number) {
  const base = r() > 0.5 ? '#2c2925' : '#29261f'
  px(L, x, y, '#120e0a', w, h)
  px(L, x + 1, y + 1, base, w - 2, h - 2)
  px(L, x + 1, y + 1, '#3a362f', w - 2, 1) // блик сверху
  px(L, x + 1, y + 1, '#35322b', 1, h - 2)
  px(L, x + 1, y + h - 2, '#1a1712', w - 2, 1) // тень снизу
  px(L, x + w - 2, y + 1, '#1d1a15', 1, h - 2)
  // шов по середине длинной стороны
  if (w >= h) px(L, x + Math.floor(w / 2), y + 2, '#1a1712', 1, h - 4)
  else px(L, x + 2, y + Math.floor(h / 2), '#1a1712', w - 4, 1)
  for (const [cx, cy] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) {
    px(L, x + cx, y + cy, '#4e483d')
    px(L, x + cx + 1, y + cy + 1, '#15110d')
  }
  // ржавые потёки
  const n = Math.floor(r() * 4)
  for (let i = 0; i < n; i++) {
    const rx = x + 3 + Math.floor(r() * (w - 6))
    const ry = y + 3 + Math.floor(r() * (h - 6))
    px(L, rx, ry, '#4a2e1c', 2, 1)
    px(L, rx + 1, ry + 1, '#3a2416', 1, 2)
  }
}

/** Труба вдоль границы клеток: стальной корпус с бликом, латунные фланцы */
function pipe(L: CanvasRenderingContext2D, x: number, y: number, len: number, vertical: boolean) {
  const W = vertical ? 4 : len
  const H = vertical ? len : 4
  px(L, x, y, '#100c08', W, H)
  if (vertical) {
    px(L, x + 1, y, '#5a5f66', 2, len)
    px(L, x + 1, y, '#8a9096', 1, len)
  } else {
    px(L, x, y + 1, '#5a5f66', len, 2)
    px(L, x, y + 1, '#8a9096', len, 1)
  }
  for (let i = 4; i < len - 2; i += LC) {
    if (vertical) px(L, x - 1, y + i, '#7d5a2c', 6, 2)
    else px(L, x + i, y - 1, '#7d5a2c', 2, 6)
  }
}

/** Светящийся декор карты: собирается при построении фона, освещение читает его каждый кадр */
export interface MapLight {
  x: number // LOW-пиксели
  y: number
  kind: 'lantern' | 'furnace' | 'crystal' | 'portal' | 'gate'
  seed: number // для мерцания
}
export const mapLights: MapLight[] = []
/** Номер вида в DECOR → какой свет он даёт (фонарь, печь, кристаллы) */
const LIGHT_DECOR: Record<number, MapLight['kind']> = { 2: 'crystal', 6: 'lantern', 10: 'furnace' }

export function buildPixelBackground(map: GameMap): HTMLCanvasElement {
  mapLights.length = 0
  const cv = document.createElement('canvas')
  cv.width = LOW_W
  cv.height = LOW_H
  const L = cv.getContext('2d')!
  const seed = map.seed + 17
  let rs = (seed * 2654435761) >>> 0
  const r = () => {
    rs = (Math.imul(rs ^ (rs >>> 15), 2246822519) + 0x9e3779b9) >>> 0
    return rs / 4294967296
  }

  // земля: тёмная утоптанная почва пятнами по 2×2 и редкие камешки
  const img = L.createImageData(LOW_W, LOW_H)
  const ground = GROUND.map(hexToRgb)
  for (let y = 0; y < LOW_H; y++) {
    for (let x = 0; x < LOW_W; x++) {
      const n = hash(x >> 1, y >> 1, seed)
      const big = hash(x >> 4, y >> 4, seed + 3)
      let c = ground[Math.floor((n * 0.6 + big * 0.4) * ground.length) % ground.length]
      if (hash(x, y, seed + 9) > 0.993) c = [64, 52, 36]
      const i = (y * LOW_W + x) * 4
      img.data[i] = c[0]
      img.data[i + 1] = c[1]
      img.data[i + 2] = c[2]
      img.data[i + 3] = 255
    }
  }
  L.putImageData(img, 0, 0)

  const cols = MAP_W / CELL
  const rows = MAP_H / CELL
  // индустриальный пол: стальные плиты на 2–4 клетки (тропа ляжет поверх)
  for (let i = 0; i < 22; i++) {
    const w = 2 + Math.floor(r() * 3)
    const h = 2 + Math.floor(r() * 2)
    const cx = Math.floor(r() * (cols - w + 1))
    const cy = Math.floor(r() * (rows - h + 1))
    floorPlate(L, cx * LC, cy * LC, w * LC, h * LC, r)
  }
  // трубы по границам клеток
  for (let i = 0; i < 7; i++) {
    const vertical = r() > 0.5
    const len = (3 + Math.floor(r() * 6)) * LC
    const cx = Math.floor(r() * cols)
    const cy = Math.floor(r() * rows)
    pipe(L, cx * LC - 2, cy * LC - 2, len, vertical)
  }

  // еле заметная сетка клеток постройки — точки по углам
  L.fillStyle = 'rgba(176,141,87,0.16)'
  for (let x = LC; x < LOW_W; x += LC) for (let y = LC; y < LOW_H; y += LC) L.fillRect(x, y, 1, 1)

  // мелкий декор в углах клеток (центр остаётся под башню)
  const onPath = new Set(map.cells.map((c) => c.cx + ',' + c.cy))
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      if (onPath.has(cx + ',' + cy)) continue
      if (hash(cx, cy, seed + 101) > 0.32) continue
      const kind = Math.floor(hash(cx, cy, seed + 202) * DECOR.length)
      const corner = Math.floor(hash(cx, cy, seed + 303) * 4)
      const ox = cx * LC + (corner % 2 ? LC - 9 : 1)
      const oy = cy * LC + (corner < 2 ? 1 : LC - 9)
      DECOR[kind](L, ox, oy, hash(cx, cy, seed + 404))
      // светящийся декор становится источником света (lighting.ts)
      const lightKind = LIGHT_DECOR[kind]
      if (lightKind) mapLights.push({ x: ox + 4, y: oy + (lightKind === 'lantern' ? 1 : 4), kind: lightKind, seed: cx * 31 + cy })
    }
  }

  // тропа — светлая каменно-латунная плитка 2×2 на клетку со швами
  for (const c of map.cells) {
    const x0 = c.cx * LC
    const y0 = c.cy * LC
    px(L, x0, y0, '#3a3022', LC, LC) // швы
    for (const [dx, dy] of [[0, 0], [10, 0], [0, 10], [10, 10]]) {
      const tx = x0 + dx + 1
      const ty = y0 + dy + 1
      const shadeK = hash(c.cx * 2 + dx, c.cy * 2 + dy, seed + 7)
      px(L, tx, ty, shadeK > 0.5 ? '#5e5137' : '#584b32', 9, 9)
      px(L, tx, ty, '#6f6145', 9, 1) // блик
      px(L, tx, ty, '#695b40', 1, 9)
      px(L, tx, ty + 8, '#483d29', 9, 1) // тень
      px(L, tx + 8, ty, '#4c402c', 1, 9)
      if (shadeK > 0.82) px(L, tx + 3, ty + 4, '#463b28', 3, 1) // трещина
      if (shadeK < 0.08) px(L, tx + 2, ty + 2, '#8a6d3b') // латунная клёпка
    }
  }
  for (const c of map.cells) {
    const x0 = c.cx * LC
    const y0 = c.cy * LC
    const edge = (dx: number, dy: number) => !onPath.has(c.cx + dx + ',' + (c.cy + dy))
    // светлый кант по краю тропы и тёмный контур снаружи, как бордюр
    if (edge(0, -1)) {
      px(L, x0, y0, '#7a6a48', LC, 1)
      px(L, x0, y0 - 1, '#120d08', LC, 1)
    }
    if (edge(0, 1)) {
      px(L, x0, y0 + LC - 1, '#2e2619', LC, 1)
      px(L, x0, y0 + LC, '#120d08', LC, 1)
      px(L, x0, y0 + LC + 1, 'rgba(0,0,0,0.35)', LC, 1)
    }
    if (edge(-1, 0) && c.cx > 0) {
      px(L, x0, y0, '#7a6a48', 1, LC)
      px(L, x0 - 1, y0, '#120d08', 1, LC)
    }
    if (edge(1, 0) && c.cx < cols - 1) {
      px(L, x0 + LC - 1, y0, '#2e2619', 1, LC)
      px(L, x0 + LC, y0, '#120d08', 1, LC)
      px(L, x0 + LC + 1, y0, 'rgba(0,0,0,0.35)', 1, LC)
    }
  }

  // входной портал Разлома и выходные ворота города
  const first = map.cells[0]
  const last = map.cells[map.cells.length - 1]
  drawPortal(L, 0, first.cy * LC)
  drawGate(L, LOW_W - 7, last.cy * LC)
  mapLights.push({ x: 3, y: first.cy * LC + LC / 2, kind: 'portal', seed: 1 })
  mapLights.push({ x: LOW_W - 4, y: last.cy * LC + LC / 2, kind: 'gate', seed: 2 })

  // виньетка по краям
  for (let i = 0; i < 8; i++) {
    L.fillStyle = `rgba(0,0,0,${0.28 - i * 0.034})`
    L.fillRect(0, i, LOW_W, 1)
    L.fillRect(0, LOW_H - 1 - i, LOW_W, 1)
    L.fillRect(i, 0, 1, LOW_H)
    L.fillRect(LOW_W - 1 - i, 0, 1, LOW_H)
  }
  return cv
}

function px(L: CanvasRenderingContext2D, x: number, y: number, c: string, w = 1, h = 1) {
  L.fillStyle = c
  L.fillRect(x, y, w, h)
}

/** Мелкий декор 8×8 в углу клетки. r — случайное 0..1 для вариаций */
const DECOR: ((L: CanvasRenderingContext2D, x: number, y: number, r: number) => void)[] = [
  // камни
  (L, x, y, r) => {
    px(L, x + 1, y + 4, '#5a5048', 3, 2)
    px(L, x + 1, y + 4, '#6e6458', 2, 1)
    px(L, x + 4, y + 5, '#4a4038', 2, 2)
    if (r > 0.5) px(L, x + 5, y + 2, '#5a5048', 2, 2)
    px(L, x + 1, y + 6, '#1c140c', 5, 1)
  },
  // сухая трава
  (L, x, y) => {
    px(L, x + 1, y + 5, '#5a5a2a', 1, 2)
    px(L, x + 2, y + 3, '#6e6a30', 1, 4)
    px(L, x + 3, y + 4, '#4f4f24', 1, 3)
    px(L, x + 5, y + 2, '#6e6a30', 1, 5)
    px(L, x + 6, y + 4, '#5a5a2a', 1, 3)
  },
  // кристаллы минерала
  (L, x, y, r) => {
    const c = r > 0.5 ? ['#7ad0c8', '#3c8a84', '#d8fff8'] : ['#a6f095', '#4e9a46', '#eaffdf']
    px(L, x + 2, y + 2, c[0], 1, 5)
    px(L, x + 3, y + 1, c[2], 1, 1)
    px(L, x + 3, y + 2, c[0], 1, 5)
    px(L, x + 1, y + 4, c[1], 1, 3)
    px(L, x + 5, y + 3, c[0], 1, 4)
    px(L, x + 6, y + 4, c[1], 1, 3)
    px(L, x + 1, y + 7, '#1c140c', 6, 1)
  },
  // ржавая шестерня в земле
  (L, x, y) => {
    px(L, x + 2, y + 1, '#8e4b2b', 4, 6)
    px(L, x + 1, y + 2, '#8e4b2b', 6, 4)
    px(L, x + 3, y + 3, '#2a2015', 2, 2)
    px(L, x + 3, y, '#8e4b2b', 2, 1)
    px(L, x + 3, y + 7, '#8e4b2b', 2, 1)
    px(L, x, y + 3, '#8e4b2b', 1, 2)
    px(L, x + 7, y + 3, '#8e4b2b', 1, 2)
    px(L, x + 2, y + 1, '#b06a3a', 2, 1)
  },
  // ящик
  (L, x, y) => {
    px(L, x + 1, y + 1, '#140d07', 7, 7)
    px(L, x + 2, y + 2, '#7a5634', 5, 5)
    px(L, x + 2, y + 2, '#8e6a42', 5, 1)
    px(L, x + 2, y + 4, '#5c3f24', 5, 1)
    px(L, x + 4, y + 2, '#5c3f24', 1, 5)
  },
  // бочка
  (L, x, y) => {
    px(L, x + 2, y + 1, '#140d07', 5, 7)
    px(L, x + 3, y + 1, '#5a3c22', 3, 6)
    px(L, x + 2, y + 2, '#6e4a2a', 5, 4)
    px(L, x + 2, y + 2, '#8a8f96', 5, 1)
    px(L, x + 2, y + 5, '#8a8f96', 5, 1)
    px(L, x + 3, y + 3, '#86603a', 1, 2)
  },
  // фонарь на столбе
  (L, x, y) => {
    px(L, x + 3, y + 2, '#3c4046', 1, 6)
    px(L, x + 2, y, '#140d07', 3, 3)
    px(L, x + 3, y + 1, '#ffd060', 1, 1)
    px(L, x + 1, y, 'rgba(255,208,96,0.18)', 5, 4)
    px(L, x + 2, y + 7, '#3c4046', 3, 1)
  },
  // кости
  (L, x, y) => {
    px(L, x + 1, y + 4, '#cfc6b0', 5, 1)
    px(L, x, y + 3, '#cfc6b0', 1, 3)
    px(L, x + 6, y + 3, '#cfc6b0', 1, 3)
    px(L, x + 4, y + 1, '#d8d0bc', 3, 2)
    px(L, x + 5, y + 2, '#140d07', 1, 1)
  },
  // масляная лужа
  (L, x, y) => {
    px(L, x + 1, y + 4, '#120d0a', 6, 2)
    px(L, x + 2, y + 3, '#120d0a', 4, 4)
    px(L, x + 3, y + 4, '#4a3a6a', 1, 1)
    px(L, x + 5, y + 5, '#3a5a5a', 1, 1)
  },
  // обломок трубы с вентилем
  (L, x, y) => {
    px(L, x, y + 4, '#140d07', 8, 3)
    px(L, x, y + 5, '#6e7378', 8, 1)
    px(L, x, y + 4, '#9aa0a6', 8, 1)
    px(L, x + 3, y + 1, '#8e4b2b', 3, 1)
    px(L, x + 4, y + 2, '#5a3c22', 1, 2)
  },
  // машина-печь с решёткой и тлеющим огнём
  (L, x, y, r) => {
    px(L, x, y, '#100c08', 8, 8)
    px(L, x + 1, y + 1, '#3c4046', 6, 6)
    px(L, x + 1, y + 1, '#565b62', 6, 1)
    px(L, x + 2, y + 3, '#1a140e', 4, 3)
    px(L, x + 2, y + 4, r > 0.5 ? '#ff8a1e' : '#c8501a', 4, 1)
    px(L, x + 2, y + 3, '#565b62', 1, 3)
    px(L, x + 4, y + 3, '#565b62', 1, 3)
    px(L, x + 6, y - 1, '#2a2016', 1, 2) // труба
  },
  // вентиляционная решётка в полу
  (L, x, y) => {
    px(L, x, y + 1, '#0e0a07', 8, 6)
    px(L, x + 1, y + 2, '#1a1612', 6, 4)
    for (let i = 0; i < 6; i += 2) px(L, x + 1 + i, y + 2, '#3c4046', 1, 4)
    px(L, x, y + 1, '#3a362f', 8, 1)
  },
  // паровой вентиль с манометром
  (L, x, y) => {
    px(L, x + 3, y + 3, '#5a5f66', 2, 5)
    px(L, x + 1, y + 1, '#140d07', 6, 4)
    px(L, x + 2, y + 2, '#d8d0bc', 4, 2)
    px(L, x + 4, y + 2, '#ff3b24', 1, 1)
    px(L, x + 2, y + 7, '#7d5a2c', 4, 1)
  },
]

/** Портал Разлома у входа: тёмная арка с зелёным свечением */
function drawPortal(L: CanvasRenderingContext2D, x: number, y: number) {
  px(L, x, y - 3, '#140d07', 6, LC + 6)
  px(L, x, y - 2, '#3c4046', 5, LC + 4)
  px(L, x, y, '#0c1a10', 4, LC)
  for (let i = 0; i < LC; i += 2) px(L, x + 1 + (i % 4 ? 1 : 0), y + i, '#5ad07a', 1, 1)
  px(L, x + 5, y - 3, '#a6f095', 1, 1)
  px(L, x + 5, y + LC + 2, '#a6f095', 1, 1)
}

/** Ворота города у выхода: латунные створки с красным огнём тревоги */
function drawGate(L: CanvasRenderingContext2D, x: number, y: number) {
  px(L, x, y - 3, '#140d07', 7, LC + 6)
  px(L, x + 1, y - 2, '#7d5a2c', 6, LC + 4)
  px(L, x + 2, y, '#d4a85a', 1, LC)
  px(L, x + 4, y, '#d4a85a', 1, LC)
  px(L, x + 1, y - 3, '#ff3b24', 2, 1)
  px(L, x + 1, y + LC + 2, '#ff3b24', 2, 1)
}

// ─── Башни: процедурный пиксельный рисунок 16×18 по типу атаки ───────────
/**
 * Каменный цоколь + латунная колонна с полосой цвета башни + навершие по типу атаки:
 * пронзающая — арбалет, сокрушающая — ствол (смотрит на цель), магическая — сфера,
 * универсальная — шестерня. Слитые — с золотой окантовкой. Уровень — пипсы на цоколе.
 */
export function drawPixelTower(
  L: CanvasRenderingContext2D, tw: Tower, def: TowerDefinition, time: number, hovered: boolean
) {
  const cx = Math.round(tw.x * PX)
  const cy = Math.round(tw.y * PX)
  const attack = def.merged ? def.attacks[0] : def.attack
  const accent = def.color
  const trim = def.merged ? '#ffd76a' : '#d4a85a'
  const outline = hovered ? '#ffd700' : '#140d07'
  const recoil = time - tw.lastShotAt < 0.12 ? 1 : 0

  // длинная тень башни вниз-вправо: ступенчатый пиксельный параллелограмм (свет сверху-слева)
  for (let i = 0; i < 7; i++) {
    L.fillStyle = `rgba(0,0,0,${0.3 - i * 0.025})`
    L.fillRect(cx - 6 + Math.round(i * 1.6), cy + 8 + i, 14 - Math.round(i * 0.6), 1)
  }
  shadow(L, cx, cy + 8, 16)
  // цоколь из камня
  px(L, cx - 8, cy + 2, outline, 16, 7)
  px(L, cx - 7, cy + 3, '#5a5048', 14, 5)
  px(L, cx - 7, cy + 3, '#6e6458', 14, 1)
  px(L, cx - 3, cy + 5, '#4a4038', 1, 3)
  px(L, cx + 3, cy + 4, '#4a4038', 1, 3)
  px(L, cx - 7, cy + 7, '#3a3028', 14, 1)
  // колонна
  px(L, cx - 5, cy - 6, outline, 10, 9)
  px(L, cx - 4, cy - 5, '#7d5a2c', 8, 8)
  px(L, cx - 4, cy - 5, trim, 8, 1)
  px(L, cx - 4, cy - 1, accent, 8, 2) // полоса цвета башни
  px(L, cx - 3, cy - 4, '#9a7238', 1, 3)
  px(L, cx - 4, cy + 2, trim, 8, 1)

  // навершие
  const a = tw.aim
  if (attack === 'crush') {
    // ствол по направлению на цель (8 направлений), с отдачей
    const dir = Math.round(a / (Math.PI / 4))
    const dx = Math.round(Math.cos(dir * Math.PI / 4))
    const dy = Math.round(Math.sin(dir * Math.PI / 4))
    px(L, cx - 4, cy - 10, outline, 8, 5)
    px(L, cx - 3, cy - 9, '#3c4046', 6, 3)
    for (let i = 1; i <= 5 - recoil; i++) px(L, cx - 1 + dx * i, cy - 8 + dy * i, i === 5 - recoil ? '#140d07' : accent, 2, 2)
  } else if (attack === 'pierce') {
    // арбалет: дуга и ложе, смотрит на цель (лево/право)
    const right = Math.cos(a) >= 0 ? 1 : -1
    px(L, cx - 1, cy - 12, outline, 3, 7)
    px(L, cx, cy - 11, '#9a7238', 1, 5)
    px(L, cx - 4 * right, cy - 9, accent, 1, 1)
    px(L, cx + 4 * right, cy - 9, accent, 1, 1)
    px(L, cx - 3, cy - 10, accent, 7, 1)
    px(L, cx + (recoil ? 1 : 3) * right, cy - 8, '#e8e2d0', 2, 1) // болт
  } else if (attack === 'magic') {
    // сфера на подставке, мерцает
    const glow = 0.5 + 0.5 * Math.sin(time * 4 + tw.id)
    px(L, cx - 4, cy - 14, `rgba(255,255,255,${0.08 + 0.1 * glow})`, 8, 8)
    px(L, cx - 3, cy - 13, outline, 6, 6)
    px(L, cx - 2, cy - 12, accent, 4, 4)
    px(L, cx - 1, cy - 12, shade(accent, 1.5), 1, 1)
    px(L, cx - 2, cy - 7, '#7d5a2c', 4, 1)
  } else {
    // шестерня, вращается (смена кадра)
    const f = Math.floor(time * 4 + tw.id) % 2
    px(L, cx - 4, cy - 13, outline, 8, 8)
    px(L, cx - 3, cy - 12, accent, 6, 6)
    px(L, cx - 1, cy - 10, '#140d07', 2, 2)
    if (f) {
      px(L, cx - 1, cy - 14, accent, 2, 1)
      px(L, cx - 1, cy - 5, accent, 2, 1)
      px(L, cx - 5, cy - 10, accent, 1, 2)
      px(L, cx + 4, cy - 10, accent, 1, 2)
    } else {
      px(L, cx - 4, cy - 13, accent, 1, 1)
      px(L, cx + 3, cy - 13, accent, 1, 1)
      px(L, cx - 4, cy - 6, accent, 1, 1)
      px(L, cx + 3, cy - 6, accent, 1, 1)
    }
  }
  if (def.merged) {
    px(L, cx - 8, cy + 2, trim, 16, 1)
    px(L, cx - 8, cy + 8, trim, 16, 1)
  }
  // пипсы уровня на цоколе
  for (let l = 0; l < tw.level; l++) px(L, cx - tw.level * 2 + 1 + l * 4, cy + 5, tw.level >= 5 ? '#ffd700' : '#e8c170', 2, 1)
  // 5 ур. — мерцающая золотая рамка
  if (tw.level >= 5 && Math.floor(time * 3) % 2 === 0) {
    px(L, cx - 9, cy + 1, '#ffd700', 1, 9)
    px(L, cx + 8, cy + 1, '#ffd700', 1, 9)
  }
}


// ─── Растения: живой слой поверх фона, качаются на ветру ─────────────────
type PlantKind = 'grass' | 'reed' | 'fern' | 'bush' | 'flower'
interface Plant {
  x: number // LOW-пиксели, основание
  y: number
  kind: PlantKind
  h: number
  tone: number
  phase: number
}

const PLANT_TONES = ['#4f5f22', '#5e6e2a', '#6f7d34', '#7a6f34']
const FLOWER_TONES = ['#c8501a', '#e8c14a', '#7ad0c8', '#b48ad8']
let plantsSeed = -1
let plants: Plant[] = []

/** Где растёт: у краёв свободных клеток (центр клетки — под башню), гуще у тропы */
function buildPlants(map: GameMap) {
  plantsSeed = map.seed
  plants = []
  const seed = map.seed + 911
  const onPath = new Set(map.cells.map((c) => c.cx + ',' + c.cy))
  const kinds: PlantKind[] = ['grass', 'grass', 'grass', 'reed', 'fern', 'bush', 'flower']
  for (let cx = 0; cx < MAP_W / CELL; cx++) {
    for (let cy = 0; cy < MAP_H / CELL; cy++) {
      if (onPath.has(cx + ',' + cy)) continue
      const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => onPath.has(cx + dx + ',' + (cy + dy)))
      const n = hash(cx, cy, seed) < (nearPath ? 0.75 : 0.35) ? 1 + Math.floor(hash(cx, cy, seed + 1) * 3) : 0
      for (let i = 0; i < n; i++) {
        const a = hash(cx * 7 + i, cy * 5, seed + 2)
        const b = hash(cx * 3, cy * 11 + i, seed + 3)
        // вдоль одного из краёв клетки
        const side = Math.floor(hash(cx + i, cy - i, seed + 4) * 4)
        const along = 2 + Math.floor(a * (LC - 4))
        const x = cx * LC + (side === 0 ? 2 : side === 1 ? LC - 3 : along)
        const y = cy * LC + (side === 2 ? 4 : side === 3 ? LC - 1 : along)
        const kind = kinds[Math.floor(b * kinds.length)]
        plants.push({ x, y, kind, h: 3 + Math.floor(b * 4), tone: Math.floor(a * PLANT_TONES.length), phase: a * 6.28 })
      }
    }
  }
  // сначала дальние (выше по экрану) — ближние перекрывают их
  plants.sort((p, q) => p.y - q.y)
}

/** Стебель/травинка: чем выше, тем сильнее отклоняется по ветру */
function blade(L: CanvasRenderingContext2D, x: number, y: number, h: number, wind: number, color: string, tip?: string) {
  for (let i = 0; i < h; i++) {
    const t = i / Math.max(1, h - 1)
    const off = Math.round(wind * t * t)
    L.fillStyle = i === h - 1 && tip ? tip : color
    L.fillRect(x + off, y - i, 1, 1)
  }
}

/** Растения в LOW-контексте (единичная матрица). time — секунды (идёт и на паузе — ветер не стоит) */
export function drawPlants(L: CanvasRenderingContext2D, map: GameMap, time: number) {
  if (plantsSeed !== map.seed) buildPlants(map)
  // порывы: медленная волна, бегущая по полю слева направо
  for (const p of plants) {
    const gust = 0.7 + 0.5 * Math.sin(time * 0.45 - p.x * 0.02) + 0.25 * Math.sin(time * 1.3 + p.y * 0.05)
    const sway = Math.sin(time * 2.1 + p.phase + p.x * 0.09) * 0.6 + gust
    const c = PLANT_TONES[p.tone]
    const dark = shade(c.startsWith('#') ? c : '#5e6e2a', 0.7)
    switch (p.kind) {
      case 'grass':
        blade(L, p.x - 1, p.y, p.h - 1, sway * 1.2, dark)
        blade(L, p.x, p.y, p.h + 1, sway * 1.6, c, shade(c, 1.3))
        blade(L, p.x + 1, p.y, p.h, sway * 1.4, c)
        break
      case 'reed':
        blade(L, p.x, p.y, p.h + 5, sway * 2.2, '#6a6a2a')
        blade(L, p.x + 2, p.y, p.h + 3, sway * 1.9, dark)
        L.fillStyle = '#6b4a2e' // початок камыша
        L.fillRect(p.x + Math.round(sway * 2.2), p.y - p.h - 5, 1, 2)
        break
      case 'fern': {
        // две выгнутые ветки с листочками
        for (const dir of [-1, 1]) {
          for (let i = 0; i < p.h + 1; i++) {
            const t = i / p.h
            const bx = p.x + dir * Math.round(i * 0.7) + Math.round(sway * t * t * 1.5)
            const by = p.y - Math.round(i * 0.8)
            L.fillStyle = i % 2 ? c : dark
            L.fillRect(bx, by, 1, 1)
            if (i % 2 === 0 && i > 0) L.fillRect(bx + dir, by - 1, 1, 1)
          }
        }
        break
      }
      case 'bush': {
        // куст: тёмный низ неподвижен, верх колышется
        const top = Math.round(sway * 0.8)
        L.fillStyle = dark
        L.fillRect(p.x - 3, p.y - 2, 7, 2)
        L.fillStyle = c
        L.fillRect(p.x - 2 + top, p.y - 4, 5, 2)
        L.fillRect(p.x - 1 + top, p.y - 5, 3, 1)
        L.fillStyle = shade(c, 1.3)
        L.fillRect(p.x - 1 + top, p.y - 4, 1, 1)
        L.fillStyle = '#8e3a2a' // ягоды
        L.fillRect(p.x + 1 + top, p.y - 3, 1, 1)
        break
      }
      case 'flower':
        blade(L, p.x, p.y, p.h + 1, sway * 1.3, dark)
        L.fillStyle = FLOWER_TONES[p.tone]
        L.fillRect(p.x + Math.round(sway * 1.3) - 1, p.y - p.h - 1, 2, 2)
        L.fillStyle = '#ffe9a0'
        L.fillRect(p.x + Math.round(sway * 1.3), p.y - p.h - 1, 1, 1)
        break
    }
  }
}

// ─── Превью башни для карточек арсенала (data URL, кэш по id) ────────────
const thumbCache = new Map<string, string>()

/** Пиксельная башня 1 уровня на прозрачном фоне 20×25 — для <img> с image-rendering: pixelated */
export function towerThumb(def: TowerDefinition): string {
  const hit = thumbCache.get(def.id)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = 20
  cv.height = 25
  const ctx = cv.getContext('2d')!
  const tw: Tower = {
    id: 1, x: 10 / PX, y: 14 / PX, defId: def.id, level: 1, invested: 0, cooldown: 0, shotCount: 0,
    hammerCd: 0, rampMult: 1, focusUid: 0, focusStacks: 0, lastShotAt: -1e9, aim: -Math.PI / 4,
  }
  drawPixelTower(ctx, tw, def, 0, false)
  const url = cv.toDataURL()
  thumbCache.set(def.id, url)
  return url
}


// ─── Пыль и угольки: дрейфуют по ветру над полем (атмосфера) ─────────────
/** Детерминированные частицы: положение — функция от номера и времени, без состояния */
export function drawMotes(L: CanvasRenderingContext2D, time: number) {
  for (let i = 0; i < 46; i++) {
    const ember = i % 7 === 0 // каждая седьмая — тлеющий уголёк
    const speed = 6 + (i % 5) * 3
    const x = Math.floor((i * 97.3 + time * speed) % (LOW_W + 20)) - 10
    const y = Math.floor((i * 53.7) % LOW_H + Math.sin(time * 0.8 + i) * 6 - (ember ? (time * 4 + i * 11) % 40 : 0))
    const a = 0.25 + 0.25 * Math.sin(time * 2 + i * 1.7)
    L.fillStyle = ember ? `rgba(255,150,60,${a + 0.2})` : `rgba(230,220,190,${a * 0.6})`
    L.fillRect(x, ((y % LOW_H) + LOW_H) % LOW_H, 1, 1)
  }
}