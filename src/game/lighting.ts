// Свет и атмосфера «Железного Разлома» (поверх пиксельного мира, в LOW-холсте).
// Поле погружено в сумрак; в нём светятся фонари, печи, кристаллы, портал, башни, выстрелы, взрывы,
// огненные снаряды, глаза врагов и Охотница. Карта света считается в четверть разрешения поля и
// растягивается без сглаживания — свет ложится крупными ступенями, как в ретро-играх.
// Дым из печей и туман — тоже здесь. Текст и подсказки рисуются позже и остаются яркими.

import { ALL_DEFS } from './config'
import type { Game } from './engine'
import { pointAtLength } from './engine'
import { LOW_H, LOW_W, PX, mapLights } from './pixel'

interface Light {
  x: number // LOW-пиксели
  y: number
  r: number // радиус, LOW-пиксели
  i: number // яркость 0..1 — насколько «прорезает» сумрак
  color?: [number, number, number] // цветной отсвет (необязательно)
  glow?: number // сила цветного отсвета 0..1
}

const AMBIENT = 0.5 // плотность сумрака: 0 — светло, 1 — тьма
const Q = 2 // карта света в Q раз меньше LOW-холста

let darkCv: HTMLCanvasElement | null = null
let glowCv: HTMLCanvasElement | null = null

/**
 * Готовое пятно света (радиальный градиент 16×16 — для пиксельного света больше не нужно) — рисуется один раз на цвет и потом только
 * штампуется drawImage: так в разы дешевле, чем строить градиент на каждый источник каждый кадр.
 * core — доля радиуса с плотной серединой (для «прорезания» сумрака — шире, для отсвета — уже).
 */
const stamps = new Map<string, HTMLCanvasElement>()
function stamp(r: number, g: number, b: number, core: number): HTMLCanvasElement {
  const key = `${r},${g},${b},${core}`
  let cv = stamps.get(key)
  if (!cv) {
    cv = document.createElement('canvas')
    cv.width = 16
    cv.height = 16
    const c = cv.getContext('2d')!
    const grad = c.createRadialGradient(8, 8, 0, 8, 8, 8)
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
    grad.addColorStop(core, `rgba(${r},${g},${b},0.55)`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    c.fillStyle = grad
    c.fillRect(0, 0, 16, 16)
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

function collectLights(game: Game, t: number): Light[] {
  const lights: Light[] = []
  for (const m of mapLights) {
    const f = flicker(t, m.seed)
    if (m.kind === 'lantern') lights.push({ x: m.x, y: m.y, r: 26 * f, i: 0.85, color: [255, 196, 110], glow: 0.35 * f })
    else if (m.kind === 'furnace') lights.push({ x: m.x, y: m.y, r: 20 * f, i: 0.75, color: [255, 130, 40], glow: 0.4 * f })
    else if (m.kind === 'crystal') lights.push({ x: m.x, y: m.y, r: 12, i: 0.45, color: [150, 240, 170], glow: 0.25 })
    else if (m.kind === 'portal') lights.push({ x: m.x, y: m.y, r: 44, i: 0.9, color: [110, 230, 120], glow: 0.45 * f })
    else lights.push({ x: m.x, y: m.y, r: 34, i: 0.8, color: [255, 80, 50], glow: 0.35 * f })
  }
  for (const tw of game.towers) {
    const def = ALL_DEFS[tw.defId]
    const x = tw.x * PX
    const y = tw.y * PX - 6
    const magic = def.merged ? def.attacks.includes('magic') : def.attack === 'magic'
    // у каждой башни свой небольшой круг света; магические светятся своим цветом
    lights.push({ x, y, r: magic ? 22 : 16, i: 0.6, color: magic ? hexRgb(def.color) : [255, 210, 140], glow: magic ? 0.35 : 0.12 })
    // вспышка выстрела
    const since = game.time - tw.lastShotAt
    if (since >= 0 && since < 0.09) lights.push({ x, y: y - 4, r: 24, i: 0.9, color: hexRgb(def.color), glow: 0.5 })
  }
  for (const pr of game.projectiles) {
    if (pr.kind === 'orb' || pr.burn) lights.push({ x: pr.x * PX, y: pr.y * PX, r: 10, i: 0.6, color: hexRgb(pr.color), glow: 0.5 })
  }
  for (const e of game.effects) {
    const k = 1 - (game.time - e.born) / e.dur
    if (k <= 0) continue
    if (e.kind === 'blast') lights.push({ x: e.x * PX, y: e.y * PX, r: Math.max(14, e.r * PX * 1.4), i: 0.9 * k, color: [255, 150, 60], glow: 0.6 * k })
    if ((e.kind === 'chain' || e.kind === 'beam') && e.points) {
      for (const p of e.points) lights.push({ x: p.x * PX, y: p.y * PX, r: 14, i: 0.8 * k, color: hexRgb(e.color), glow: 0.5 * k })
    }
  }
  for (const c of game.creeps) {
    const p = pointAtLength(c.dist)
    const burning = game.time < c.burnUntil && c.burnDps > 0
    // красный глаз ИИ и огонь горящих
    lights.push({ x: p.x * PX, y: p.y * PX - 3, r: c.isBoss ? 16 : 5, i: 0.4, color: [255, 60, 40], glow: c.isBoss ? 0.45 : 0.3 })
    if (burning) lights.push({ x: p.x * PX, y: p.y * PX, r: 12, i: 0.6, color: [255, 130, 40], glow: 0.4 })
  }
  const av = game.avatar
  lights.push({ x: av.x * PX, y: av.y * PX, r: 22, i: 0.7, color: [127, 208, 160], glow: 0.2 })
  return lights
}

/** Наложить сумрак и свет на LOW-контекст (единичная матрица) */
export function applyLighting(L: CanvasRenderingContext2D, game: Game, t: number) {
  const W = LOW_W / Q
  const H = LOW_H / Q
  if (!darkCv) {
    darkCv = document.createElement('canvas')
    darkCv.width = W
    darkCv.height = H
    glowCv = document.createElement('canvas')
    glowCv.width = W
    glowCv.height = H
  }
  const lights = collectLights(game, t)

  // 1. сумрак с вырезанными пятнами света
  const d = darkCv.getContext('2d')!
  d.globalCompositeOperation = 'source-over'
  d.clearRect(0, 0, W, H)
  d.fillStyle = `rgba(6,5,14,${AMBIENT})`
  d.fillRect(0, 0, W, H)
  d.globalCompositeOperation = 'destination-out'
  const hole = stamp(0, 0, 0, 0.55)
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
    gl.drawImage(stamp(l.color[0], l.color[1], l.color[2], 0.3), (l.x - rr) / Q, (l.y - rr) / Q, (rr * 2) / Q, (rr * 2) / Q)
  }
  gl.globalAlpha = 1

  L.save()
  L.setTransform(1, 0, 0, 1, 0, 0)
  L.imageSmoothingEnabled = false
  L.drawImage(darkCv, 0, 0, LOW_W, LOW_H)
  L.globalCompositeOperation = 'lighter'
  L.drawImage(glowCv!, 0, 0, LOW_W, LOW_H)
  L.restore()
}

/** Дым из печей: клубы поднимаются и сносятся ветром (LOW-контекст, единичная матрица) */
export function drawSmoke(L: CanvasRenderingContext2D, t: number) {
  for (const m of mapLights) {
    if (m.kind !== 'furnace') continue
    for (let k = 0; k < 5; k++) {
      const p = (t * 0.35 + k / 5 + m.seed * 0.13) % 1
      const x = Math.round(m.x + 2 + p * 7 + Math.sin(p * 6 + m.seed) * 1.5)
      const y = Math.round(m.y - 6 - p * 16)
      const s = 1 + Math.floor(p * 3)
      L.fillStyle = `rgba(150,140,125,${0.45 * (1 - p)})`
      L.fillRect(x, y, s, s)
    }
  }
}

let fogCv: HTMLCanvasElement | null = null

/** Туман в два слоя с разной скоростью — даёт ощущение глубины (рисуется до света) */
export function drawFog(L: CanvasRenderingContext2D, t: number) {
  const W = LOW_W / 4
  const H = LOW_H / 4
  if (!fogCv) {
    fogCv = document.createElement('canvas')
    fogCv.width = W
    fogCv.height = H
  }
  const f = fogCv.getContext('2d')!
  f.clearRect(0, 0, W, H)
  const layers = [
    { n: 6, speed: 1.2, alpha: 0.07, r: 22 },
    { n: 4, speed: 2.6, alpha: 0.05, r: 30 },
  ]
  for (const ly of layers) {
    for (let i = 0; i < ly.n; i++) {
      const x = ((i * 47.3 + t * ly.speed) % (W + ly.r * 2)) - ly.r
      const y = (i * 29.7) % H + Math.sin(t * 0.2 + i) * 3
      const g = f.createRadialGradient(x, y, 0, x, y, ly.r)
      g.addColorStop(0, `rgba(190,180,160,${ly.alpha})`)
      g.addColorStop(1, 'rgba(190,180,160,0)')
      f.fillStyle = g
      f.fillRect(x - ly.r, y - ly.r, ly.r * 2, ly.r * 2)
    }
  }
  L.save()
  L.setTransform(1, 0, 0, 1, 0, 0)
  L.imageSmoothingEnabled = false
  L.drawImage(fogCv, 0, 0, LOW_W, LOW_H)
  L.restore()
}
