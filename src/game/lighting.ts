// Свет и атмосфера «Железного Разлома» поверх изометрического мира (экранные координаты 960×600).
// Поле погружено в холодный зимний сумрак; в нём светятся генератор, окна домов, фонари, жаровни,
// портал и кристаллы минерала, башни, выстрелы, взрывы, огненные снаряды, заражённые и Охотница. Карта света
// считается в низком разрешении и растягивается со сглаживанием — свет ложится мягкими пятнами.
// Дым и морозная дымка — тоже здесь. Текст и подсказки рисуются позже и остаются яркими.

import { ALL_DEFS, MAP_H, MAP_W } from './config'
import type { Game } from './engine'
import { pointAtLength } from './engine'
import { toScreen } from './iso'
import { mapLights } from './world'
import { windAt, windPath } from './wind'

interface Light {
  x: number // экранные пиксели
  y: number
  r: number // радиус
  i: number // яркость 0..1 — насколько «прорезает» сумрак
  color?: [number, number, number] // цветной отсвет (необязательно)
  glow?: number // сила цветного отсвета 0..1
}

const AMBIENT = 0.42 // плотность сумрака: 0 — светло, 1 — тьма
const Q = 4 // карта света в Q раз меньше экрана

let darkCv: HTMLCanvasElement | null = null
let glowCv: HTMLCanvasElement | null = null

/**
 * Готовое пятно света (радиальный градиент 32×32) — рисуется один раз на цвет и потом только
 * штампуется drawImage: в разы дешевле, чем строить градиент на каждый источник каждый кадр.
 * core — доля радиуса с плотной серединой.
 */
const stamps = new Map<string, HTMLCanvasElement>()
function stamp(r: number, g: number, b: number, core: number): HTMLCanvasElement {
  const key = `${r},${g},${b},${core}`
  let cv = stamps.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = 32
    cv.height = 32
    const c = cv.getContext('2d')!
    const grad = c.createRadialGradient(16, 16, 0, 16, 16, 16)
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
    grad.addColorStop(core, `rgba(${r},${g},${b},0.5)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    c.fillStyle = grad
    c.fillRect(0, 0, 32, 32)
    stamps.set(key, cv)
  }
  return cv
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Мерцание огня: сумма двух синусов, без состояния */
function flicker(t: number, seed: number) {
  return 0.82 + 0.1 * Math.sin(t * 9 + seed * 1.7) + 0.08 * Math.sin(t * 23 + seed * 3.1)
}

const WARM: [number, number, number] = [255, 150, 60]
/** Свет живого минерала — зелёный, как портал Разлома; люди — тёплые огни, мир — холодный */
const MINERAL_RGB: [number, number, number] = [90, 230, 130]

function collectLights(game: Game, t: number): Light[] {
  const lights: Light[] = []
  for (const m of mapLights) {
    const f = flicker(t, m.seed)
    if (m.kind === 'generator') lights.push({ x: m.x, y: m.y, r: 150 * f, i: 0.9, color: WARM, glow: 0.55 * f })
    else if (m.kind === 'window') lights.push({ x: m.x, y: m.y, r: 56, i: 0.6, color: WARM, glow: 0.35 * f })
    else if (m.kind === 'lantern') lights.push({ x: m.x, y: m.y, r: 44 * f, i: 0.7, color: [255, 170, 80], glow: 0.45 * f })
    else if (m.kind === 'furnace') lights.push({ x: m.x, y: m.y, r: 52 * f, i: 0.75, color: [255, 120, 40], glow: 0.55 * f })
    else if (m.kind === 'crystal') lights.push({ x: m.x, y: m.y, r: 28 * (0.85 + 0.15 * Math.sin(t * 1.7 + m.seed)), i: 0.3, color: MINERAL_RGB, glow: 0.22 })
    else if (m.kind === 'search') {
      const sp = searchSpot(m, t)
      lights.push({ x: sp.x, y: sp.y, r: 44, i: 0.75, color: [210, 225, 255], glow: 0.35 })
    } else if (m.kind === 'beacon') {
      if (Math.sin(t * 3) > 0.2) lights.push({ x: m.x, y: m.y, r: 26, i: 0.6, color: [255, 50, 40], glow: 0.8 })
    } else if (m.kind === 'portal') lights.push({ x: m.x, y: m.y, r: 70, i: 0.55, color: [96, 190, 150], glow: 0.28 * f })
    else if (m.kind !== 'chimney') lights.push({ x: m.x, y: m.y, r: 60, i: 0.8, color: WARM, glow: 0.5 * f })
  }
  for (const tw of game.towers) {
    const def = ALL_DEFS[tw.defId]
    const s = toScreen(tw.x, tw.y)
    const magic = def.merged ? def.attacks.includes('magic') : def.attack === 'magic'
    // у каждой башни тёплый круг света из окон; магические светятся своим цветом
    lights.push({ x: s.x, y: s.y - 14, r: magic ? 54 : 48, i: 0.7, color: magic ? hexRgb(def.color) : WARM, glow: magic ? 0.4 : 0.32 })
    const since = game.time - tw.lastShotAt
    if (since >= 0 && since < 0.09) lights.push({ x: s.x, y: s.y - 40, r: 56, i: 0.9, color: hexRgb(def.color), glow: 0.55 })
  }
  for (const pr of game.projectiles) {
    if (pr.kind !== 'orb' && !pr.burn) continue
    const s = toScreen(pr.x, pr.y)
    lights.push({ x: s.x, y: s.y - 24, r: 22, i: 0.6, color: hexRgb(pr.color), glow: 0.5 })
  }
  for (const e of game.effects) {
    const k = 1 - (game.time - e.born) / e.dur
    if (k <= 0) continue
    if (e.kind === 'blast') {
      const s = toScreen(e.x, e.y)
      lights.push({ x: s.x, y: s.y, r: Math.max(30, e.r * 1.6), i: 0.9 * k, color: [255, 150, 60], glow: 0.6 * k })
    }
    if ((e.kind === 'chain' || e.kind === 'beam') && e.points) {
      for (const p of e.points) {
        const s = toScreen(p.x, p.y)
        lights.push({ x: s.x, y: s.y - 16, r: 30, i: 0.8 * k, color: hexRgb(e.color), glow: 0.5 * k })
      }
    }
  }
  for (const c of game.creeps) {
    const p = pointAtLength(c.dist, c.pathIdx)
    const s = toScreen(p.x, p.y)
    const burning = game.time < c.burnUntil && c.burnDps > 0
    // минерал в телах заражённых светится зелёным; горящие — огнём
    lights.push({ x: s.x, y: s.y - 14, r: c.isBoss ? 44 : 16, i: 0.4, color: MINERAL_RGB, glow: c.isBoss ? 0.5 : 0.32 })
    if (burning) lights.push({ x: s.x, y: s.y - 8, r: 26, i: 0.6, color: [255, 130, 40], glow: 0.45 })
  }
  const av = toScreen(game.avatar.x, game.avatar.y)
  lights.push({ x: av.x, y: av.y - 10, r: 46, i: 0.7, color: [127, 208, 160], glow: 0.2 })
  return lights
}

/** Наложить сумрак и свет на экранный контекст */
export function applyLighting(ctx: CanvasRenderingContext2D, game: Game, t: number) {
  const W = MAP_W / Q
  const H = MAP_H / Q
  if (!darkCv) {
    darkCv = document.createElement('canvas')
    darkCv.width = W
    darkCv.height = H
    glowCv = document.createElement('canvas')
    glowCv.width = W
    glowCv.height = H
  }
  const lights = collectLights(game, t)

  // 1. холодный сумрак с вырезанными пятнами света
  const d = darkCv.getContext('2d')!
  d.globalCompositeOperation = 'source-over'
  d.clearRect(0, 0, W, H)
  d.fillStyle = `rgba(8,14,36,${AMBIENT})`
  d.fillRect(0, 0, W, H)
  d.globalCompositeOperation = 'destination-out'
  const hole = stamp(0, 0, 0, 0.5)
  for (const l of lights) {
    d.globalAlpha = Math.min(1, l.i)
    d.drawImage(hole, (l.x - l.r) / Q, (l.y - l.r) / Q, (l.r * 2) / Q, (l.r * 2) / Q)
  }
  d.globalAlpha = 1

  // 2. цветной отсвет (огонь тёплый, магия своим цветом) — чуть уже пятна света
  const gl = glowCv!.getContext('2d')!
  gl.clearRect(0, 0, W, H)
  for (const l of lights) {
    if (!l.color || !l.glow) continue
    const rr = l.r * 0.8
    gl.globalAlpha = Math.min(1, l.glow)
    gl.drawImage(stamp(l.color[0], l.color[1], l.color[2], 0.25), (l.x - rr) / Q, (l.y - rr) / Q, (rr * 2) / Q, (rr * 2) / Q)
  }
  gl.globalAlpha = 1

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(darkCv, 0, 0, MAP_W, MAP_H)
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(glowCv!, 0, 0, MAP_W, MAP_H)
  ctx.restore()
}

/** Куда смотрит прожектор вышки: пятно ходит по эллипсу вокруг неё и иногда замирает */
function searchSpot(m: { gx?: number; gy?: number; seed: number }, t: number) {
  const a = t * 0.35 + Math.sin(t * 0.21 + m.seed) * 1.2
  return { x: (m.gx ?? 0) + Math.cos(a) * 130, y: (m.gy ?? 0) + Math.sin(a) * 62 + 20 }
}

/** Луч прожектора: светлый конус от фонаря к пятну на снегу (поверх сумрака) */
export function drawBeams(ctx: CanvasRenderingContext2D, t: number) {
  for (const m of mapLights) {
    if (m.kind !== 'search') continue
    const sp = searchSpot(m, t)
    const dx = sp.x - m.x
    const dy = sp.y - m.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createLinearGradient(m.x, m.y, sp.x, sp.y)
    g.addColorStop(0, 'rgba(210,225,255,0.22)')
    g.addColorStop(1, 'rgba(210,225,255,0.04)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(m.x + nx * 2, m.y + ny * 2)
    ctx.lineTo(sp.x + nx * 26, sp.y + ny * 14)
    ctx.lineTo(sp.x - nx * 26, sp.y - ny * 14)
    ctx.lineTo(m.x - nx * 2, m.y - ny * 2)
    ctx.fill()
    ctx.restore()
  }
}

/** Дым генератора и жаровен: тёмные клубы поднимаются и сносятся ветром */
export function drawSmoke(ctx: CanvasRenderingContext2D, t: number) {
  for (const m of mapLights) {
    const big = m.kind === 'generator'
    if (!big && m.kind !== 'furnace' && m.kind !== 'chimney') continue
    const chim = m.kind === 'chimney'
    const n = big ? 14 : chim ? 8 : 5
    const wnd = windAt(t)
    for (let k = 0; k < n; k++) {
      const p = (t * (big ? 0.12 : 0.3) + k / n + m.seed * 0.13) % 1
      // столб поднимается и гнётся по ветру: снос растёт к верху (p²) и с силой ветра
      const x = m.x + p * p * (big ? 110 : 46) * wnd + Math.sin(p * 6 + m.seed + k) * (big ? 6 : 3)
      const y = m.y - (big ? 18 : chim ? 2 : 10) - p * (big ? 120 : 40) / (0.6 + wnd * 0.4)
      const s = (big ? 8 : chim ? 2.5 : 3) + p * (big ? 22 : 9)
      ctx.fillStyle = `rgba(52,56,68,${(big ? 0.5 : 0.45) * (1 - p)})`
      ctx.beginPath()
      ctx.arc(x, y, s, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

let fogCv: HTMLCanvasElement | null = null

/** Морозная дымка в два слоя с разной скоростью — даёт ощущение глубины (рисуется до света) */
export function drawFog(ctx: CanvasRenderingContext2D, t: number) {
  const W = MAP_W / 8
  const H = MAP_H / 8
  if (!fogCv) {
    fogCv = document.createElement('canvas')
    fogCv.width = W
    fogCv.height = H
  }
  const f = fogCv.getContext('2d')!
  f.clearRect(0, 0, W, H)
  const layers = [
    { n: 6, speed: 1.6, alpha: 0.09, r: 22 },
    { n: 4, speed: 3.2, alpha: 0.07, r: 30 },
  ]
  for (const ly of layers) {
    for (let i = 0; i < ly.n; i++) {
      const x = ((((i * 47.3 + windPath(t) * ly.speed * 1.4) % (W + ly.r * 2)) + W + ly.r * 2) % (W + ly.r * 2)) - ly.r
      const y = (i * 29.7) % H + Math.sin(t * 0.2 + i) * 3
      const g = f.createRadialGradient(x, y, 0, x, y, ly.r)
      g.addColorStop(0, `rgba(200,216,240,${ly.alpha})`)
      g.addColorStop(1, 'rgba(200,216,240,0)')
      f.fillStyle = g
      f.fillRect(x - ly.r, y - ly.r, ly.r * 2, ly.r * 2)
    }
  }
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(fogCv, 0, 0, MAP_W, MAP_H)
  ctx.restore()
}
