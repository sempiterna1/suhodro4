// Canvas-рендерер «Железного Разлома» — изометрия в духе Frostpunk.
// Движок живёт в координатах поля 960×600; здесь каждая точка проецируется камерой (iso.ts).
// Земля запечена в холст (world.ts); башни, враги, деревья и дома — спрайты из листов референса,
// отсортированные по глубине. Всё, что лежит на земле (радиусы, кольца, взрывы), рисуется через
// groundPath — в той же проекции, поэтому круги становятся эллипсами на снегу.

import { ALL_DEFS, CELL, MAP_H, MAP_W } from './config'
import type { Game } from './engine'
import { pointAtLength } from './engine'
import { getMap } from './map'
import { ASSETS, drawAsset, towerArt, type AssetName } from './assets'
import { towerSprite } from './towers'
import { drawLongShadow } from './shadows'
import { crispDraw, setLowScale } from './pixelart'
import { ISO_TH, groundPath, screenDir, toScreen } from './iso'
import { armorBody, drawMotes, drawSprite, shade } from './pixel'
import { buildBackground, drawDrift, drawPortal, drawProp, drawPropShadows, props, roadEnds } from './world'
import { windAt } from './wind'
import { applyLighting, drawBeams, drawFog, drawSmoke } from './lighting'
import { drawLolProjectile, drawLolTower } from './render-lol'
import type { Creep, CreepKind, Tower, Vec } from './types'

export type Skin = 'steam' | 'lol'

/** Призрак постройки: выбранная в арсенале башня над клеткой (центр клетки) */
export interface BuildGhost {
  x: number
  y: number
  valid: boolean
  range: number // радиус атаки выбранной башни
  glyph: string
  defId?: string
}

/**
 * Камера: z — приближение (1 — карта 960×600 целиком вписана в экран), x/y — точка карты в левом
 * верхнем углу экрана. Экран любой формы: на телефоне в портрете карта шире экрана, её двигают пальцем.
 */
export interface Camera {
  z: number
  x: number
  y: number
}

export interface ViewState {
  cam: Camera
  vw: number // размер холста на странице, CSS-пиксели
  vh: number
  skin: Skin // 'lol' — шуточный скин башен (render-lol.ts)
  lighting: boolean // динамический свет и сумрак (lighting.ts); выключается кнопкой для слабых устройств
  hoverTower: number | null
  selectedTower: number | null
  mergeFrom: number | null
  mouse: Vec | null
  buildGhost: BuildGhost | null
}

/** Масштаб башен из листа: башня 1 уровня занимает ромб клетки */
const TOWER_SCALE = 0.47
/** Опора башни — нижний угол ромба клетки */
const TOWER_FOOT = ISO_TH / 2 + 1

/**
 * Враги — звери и машины, изменённые живым минералом (лор GDD): светящиеся части спрайтов
 * перекрашены в зелень минерала (tools/preview/cut/mineral.mjs). Адаптант и искра минерала —
 * пиксельные (pixel.ts)
 */
const CREEP_ART: Partial<Record<CreepKind, { name: AssetName; s: number }>> = {
  scuttler: { name: 'creep-scout', s: 0.46 },
  swarm: { name: 'creep-runner', s: 0.42 },
  trooper: { name: 'creep-shield', s: 0.45 },
  rider: { name: 'creep-wolf', s: 0.42 },
  juggernaut: { name: 'creep-bruiser', s: 0.48 },
  golem: { name: 'creep-bruiser', s: 0.6 },
  titan: { name: 'creep-boss', s: 0.8 },
}

/** Экранная высота врага — для полосы HP, ореолов и подписей */
function creepHeight(c: Creep) {
  const art = CREEP_ART[c.kind]
  return art ? ASSETS[art.name].h * art.s : c.size * 2
}

// ─── Кэш фона (перестраивается при смене карты) ─────────────────────────
let bgCache: HTMLCanvasElement | null = null
let bgSeed = -1
/** Пикселей экрана на единицу карты при текущем приближении */
export function viewScale(view: ViewState) {
  return Math.min(view.vw / MAP_W, view.vh / MAP_H) * view.cam.z
}

/** Удержать камеру у карты: если карта уже экрана — по центру, иначе не дальше её краёв */
export function clampCamera(view: ViewState) {
  const s = viewScale(view)
  const w = view.vw / s
  const h = view.vh / s
  const cam = view.cam
  cam.x = w >= MAP_W ? (MAP_W - w) / 2 : Math.max(0, Math.min(MAP_W - w, cam.x))
  cam.y = h >= MAP_H ? (MAP_H - h) / 2 : Math.max(0, Math.min(MAP_H - h, cam.y))
}

/** Мир рисуется в холст вдвое меньше экрана и растягивается без сглаживания */
const PIXEL = 0.5
let low: HTMLCanvasElement | null = null
/** Во сколько раз увеличить подписи, чтобы на уменьшенной карте их было видно */
let labelScale = 1
let bgLow: HTMLCanvasElement | null = null

/** Куда смотрит враг на экране: помним последнее направление, чтобы на поворотах не дёргался */
const facingLeft = new Map<number, boolean>()

// ─── Основной рендер ─────────────────────────────────────────────────────
export function render(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  if (!bgCache || bgSeed !== game.mapSeed) {
    bgCache = buildBackground(getMap())
    bgSeed = game.mapSeed
    // земля в разрешении низкого холста: без приближения копируется один к одному (дёшево)
    bgLow = document.createElement('canvas')
    bgLow.width = MAP_W * PIXEL
    bgLow.height = MAP_H * PIXEL
    const g = bgLow.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(bgCache, 0, 0, bgLow.width, bgLow.height)
  }
  const lw = Math.max(1, Math.ceil(view.vw * PIXEL))
  const lh = Math.max(1, Math.ceil(view.vh * PIXEL))
  if (!low || low.width !== lw || low.height !== lh) {
    low = document.createElement('canvas')
    low.width = lw
    low.height = lh
  }
  const now = performance.now() / 1000
  const cam = view.cam
  const S = viewScale(view)
  // подписи не мельче 85% своего размера, даже когда карта на телефоне уменьшена
  labelScale = Math.max(1, 0.85 / S)
  // весь мир — в низком холсте: один пиксель = 2 пикселя экрана, у земли, спрайтов, огня и света
  // одна пиксельная сетка (спрайты при уменьшении усредняются и становятся честными пикселями)
  const L = low.getContext('2d')!
  L.setTransform(1, 0, 0, 1, 0, 0)
  L.fillStyle = '#070b14' // за краем карты — ночь
  L.fillRect(0, 0, low.width, low.height)
  const k = PIXEL * S
  L.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k)
  setLowScale(k)
  L.imageSmoothingEnabled = false
  L.drawImage(Math.abs(k - PIXEL) < 1e-6 && bgLow ? bgLow : bgCache, 0, 0, MAP_W, MAP_H)
  L.imageSmoothingEnabled = true // свет, дымка и тени — мягкие пятна, их пикселит общее растягивание

  drawPropShadows(L) // длинные тени деревьев и построек от луны
  drawDrift(L, now) // позёмка — по земле, под всем остальным

  // всё, что лежит на земле: связи слияния, кольца и радиусы башен, путь Охотницы, кольца взрывов
  drawMergeLinks(L, game, view)
  drawTowerRings(L, game, view)
  drawAvatarGround(L, game, view)
  drawGroundEffects(L, game)

  drawEntities(L, game, view, now) // деревья, дома, башни, враги, Охотница — по глубине
  drawProjectiles(L, game, view.skin)
  drawBolts(L, game)
  drawSmoke(L, now)
  drawFog(L, now)
  if (view.lighting) {
    applyLighting(L, game, now)
    drawBeams(L, now)
  }
  drawCreepBars(L, game)
  drawMotes(L, now)
  drawBuildGhost(L, view)

  // растягиваем пиксели без сглаживания; поверх — чёткий текст в полном разрешении
  ctx.clearRect(0, 0, view.vw, view.vh)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(low, 0, 0, lw / PIXEL, lh / PIXEL)
  ctx.save()
  ctx.scale(S, S)
  ctx.translate(-cam.x, -cam.y)
  drawOverlayLabels(ctx, game, view)
  drawFloats(ctx, game)
  ctx.restore()
}

/**
 * Глубина: всё, что стоит на земле, рисуется одним проходом сверху вниз по экрану —
 * кто ниже (ближе к зрителю), тот перекрывает стоящих дальше.
 */
function drawEntities(ctx: CanvasRenderingContext2D, game: Game, view: ViewState, now: number) {
  const items: { y: number; draw: () => void }[] = []
  const occupied = new Set(game.towers.map((t) => Math.floor(t.x / CELL) + ',' + Math.floor(t.y / CELL)))
  for (const p of props) {
    if (p.cell && occupied.has(p.cell)) continue
    items.push({ y: p.y, draw: () => drawProp(ctx, p, now) })
  }
  items.push({ y: roadEnds.entry.y - 4, draw: () => drawPortal(ctx, now) })
  for (const tw of game.towers) {
    const s = toScreen(tw.x, tw.y)
    items.push({ y: s.y + 4, draw: () => drawTowerBody(ctx, game, view, tw, s) })
  }
  for (const c of game.creeps) {
    const p = pointAtLength(c.dist)
    const s = toScreen(p.x, p.y)
    items.push({ y: s.y, draw: () => drawCreep(ctx, game, c, p, s) })
  }
  const av = toScreen(game.avatar.x, game.avatar.y)
  items.push({ y: av.y, draw: () => drawAvatar(ctx, game, av) })
  items.sort((a, b) => a.y - b.y)
  for (const it of items) it.draw()
}

// ─── Башни ───────────────────────────────────────────────────────────────
function drawTowerRings(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  for (const tw of game.towers) {
    const def = ALL_DEFS[tw.defId]
    const hovered = view.hoverTower === tw.id || view.selectedTower === tw.id
    const isMergeTarget = view.mergeFrom !== null && game.mergeTargetsFor(view.mergeFrom).includes(tw.id)
    const isMergeSource = view.mergeFrom === tw.id

    // радиус атаки при наведении
    if (hovered) {
      const range = def.range * (tw.level >= 4 ? 1.1 : tw.level >= 2 ? 1.05 : 1)
      groundPath(ctx, () => ctx.arc(tw.x, tw.y, range, 0, Math.PI * 2))
      ctx.fillStyle = 'rgba(255,190,110,0.08)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,190,110,0.6)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }
    // пульс-подсветка целей слияния
    if (isMergeTarget) {
      const pulse = 1 + 0.12 * Math.sin(game.time * 6)
      groundPath(ctx, () => ctx.arc(tw.x, tw.y, 26 * pulse, 0, Math.PI * 2))
      ctx.strokeStyle = '#7fd0a0'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = 'rgba(127,208,160,0.14)'
      ctx.fill()
    }
    if (isMergeSource) {
      groundPath(ctx, () => ctx.arc(tw.x, tw.y, 28, 0, Math.PI * 2))
      ctx.strokeStyle = '#ffb347'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

function drawTowerBody(ctx: CanvasRenderingContext2D, game: Game, view: ViewState, tw: Tower, s: Vec) {
  const def = ALL_DEFS[tw.defId]
  const hovered = view.hoverTower === tw.id || view.selectedTower === tw.id
  if (view.skin === 'lol') {
    drawLolTower(ctx, { ...tw, x: s.x, y: s.y - 6 }, def, game.time, hovered)
    drawLevelPips(ctx, s.x, s.y + 14, tw.level)
    return
  }
  const since = game.time - tw.lastShotAt
  const recoil = since >= 0 && since < 0.1 ? 1 : 0
  const scale = TOWER_SCALE * (def.merged ? 1.12 : 1) * (1 + (tw.level - 1) * 0.025)
  const foot = s.y + TOWER_FOOT
  // свой облик башни (towers.ts): корпус из листа + свечение стихии + навесные части
  const spr = towerSprite(def, towerArt(def))
  if (!spr) return
  const blit = (alpha = 1) => {
    ctx.save()
    ctx.globalAlpha *= alpha
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    crispDraw(ctx, spr.cv, s.x - spr.ax * scale, foot + recoil - spr.h * scale, spr.cv.width * scale, spr.h * scale)
    ctx.restore()
  }
  // длинная тень по снегу и плотная тень у основания
  drawLongShadow(ctx, spr.cv, s.x, foot - 4, spr.ax, scale, 0.3)
  ctx.fillStyle = 'rgba(14,22,52,0.35)'
  ctx.beginPath()
  ctx.ellipse(s.x + 4, s.y + 4, 24, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  blit()
  if (hovered) {
    // подсветка выбранной: тот же спрайт поверх в режиме «осветления»
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    blit(0.22)
    ctx.restore()
  }
  // вспышка выстрела у навершия
  if (since >= 0 && since < 0.08) {
    const top = foot - spr.h * scale * 0.78
    const g = ctx.createRadialGradient(s.x, top, 0, s.x, top, 16)
    g.addColorStop(0, 'rgba(255,230,160,0.85)')
    g.addColorStop(1, 'rgba(255,150,60,0)')
    ctx.fillStyle = g
    ctx.fillRect(s.x - 16, top - 16, 32, 32)
  }
  drawPennant(ctx, s.x - 20, s.y + 5, def.color, !!def.merged, game.time + tw.id)
  drawLevelPips(ctx, s.x, s.y + TOWER_FOOT + 4, tw.level)
  // слитая — золотой ромб под башней
  if (def.merged) {
    groundPath(ctx, () => ctx.rect(tw.x - CELL / 2 + 1, tw.y - CELL / 2 + 1, CELL - 2, CELL - 2))
    ctx.strokeStyle = '#ffd76a'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

/**
 * Вымпел у основания башни: по его цвету башни одной модели различаются издалека.
 * Пиксельный (блоки 2×2), полощется на ветру; у слитой — золотое навершие и кайма.
 */
function drawPennant(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, merged: boolean, t: number) {
  const X = Math.round(x / 2) * 2
  const Y = Math.round(y / 2) * 2
  ctx.fillStyle = '#0b0e14'
  ctx.fillRect(X - 1, Y - 30, 4, 32)
  ctx.fillStyle = '#5a4232' // древко
  ctx.fillRect(X, Y - 28, 2, 30)
  ctx.fillStyle = merged ? '#ffd76a' : '#c9d6e6'
  ctx.fillRect(X - 1, Y - 32, 4, 4) // навершие (у обычных — в снегу)
  // полотнище: 5 столбцов по 2 пикселя, каждый смещён волной; клин сужается к концу
  for (let i = 0; i < 5; i++) {
    const w = windAt(t)
    const wave = Math.round(Math.sin(t * (3 + w * 2.5) - i * 0.9) * (0.6 + w * 0.6)) * 2
    const h = 10 - i * 2 + 2
    const cx = X + 2 + i * 2
    const cy = Y - 28 + wave * (i / 4)
    ctx.fillStyle = '#0b0e14'
    ctx.fillRect(cx, cy - 2, 2, h + 2)
    ctx.fillStyle = i % 2 ? shade(color, 0.78) : color
    ctx.fillRect(cx, cy, 2, h - 2)
    if (merged) {
      ctx.fillStyle = '#ffd76a'
      ctx.fillRect(cx, cy + h - 4, 2, 2)
    }
  }
}

/** Уровень — латунные ромбики под башней; на 5 уровне — золотые и мерцают */
function drawLevelPips(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  for (let l = 0; l < level; l++) {
    const px = x + (l - (level - 1) / 2) * 7
    ctx.fillStyle = '#0b0e14'
    ctx.fillRect(px - 3, y - 2, 6, 5)
    ctx.fillStyle = level >= 5 ? '#ffd700' : '#ffb347'
    ctx.fillRect(px - 2, y - 1, 4, 3)
  }
}

// ─── Враги ───────────────────────────────────────────────────────────────
function drawCreep(ctx: CanvasRenderingContext2D, game: Game, c: Creep, p: Vec, s: Vec) {
  const burning = game.time < c.burnUntil && c.burnDps > 0
  const stunned = game.time < c.stunnedUntil
  const marked = game.time < c.markedUntil
  const slowed = game.time < c.slowUntil && c.slowPct > 0
  const steamed = game.time < c.vulnUntil
  const h = creepHeight(c)
  const mid = s.y - h * 0.5

  // смотрит по ходу движения на экране
  const ahead = pointAtLength(c.dist + 3)
  const sa = toScreen(ahead.x, ahead.y)
  if (Math.abs(sa.x - s.x) > 0.2) facingLeft.set(c.uid, sa.x < s.x)
  const left = facingLeft.get(c.uid) ?? false

  // пар (уязвимость) — светлое облако
  if (steamed) {
    ctx.fillStyle = 'rgba(230,236,245,0.22)'
    ctx.beginPath()
    ctx.ellipse(s.x, mid, h * 0.55, h * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // горение — ореол
  if (burning) {
    ctx.fillStyle = 'rgba(255,120,40,0.33)'
    ctx.beginPath()
    ctx.ellipse(s.x, mid, h * 0.5 + Math.sin(game.time * 12) * 1.5, h * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const art = CREEP_ART[c.kind]
  if (art && drawAssetCreep(ctx, art.name, art.s, s, left, stunned ? 0 : game.time, c.uid)) {
    // спрайт из листа нарисован
  } else {
    drawSprite(ctx, c.kind, s.x, s.y, game.time, c.uid, left, stunned, armorBody(c.armor))
  }

  // замедление — ледяная корка у ног
  if (slowed) {
    groundPath(ctx, () => ctx.arc(p.x, p.y, 14, 0, Math.PI * 2))
    ctx.strokeStyle = '#8fd8ff'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(143,216,255,0.18)'
    ctx.fill()
  }
  // оглушение — звёздочки кружатся над головой
  if (stunned) {
    for (let k = 0; k < 2; k++) {
      const a = game.time * 6 + k * Math.PI
      const sx = Math.round(s.x + Math.cos(a) * 10)
      const sy = Math.round(s.y - h - 6 + Math.sin(a) * 3)
      ctx.fillStyle = '#ffe36a'
      ctx.fillRect(sx - 1, sy - 3, 2, 6)
      ctx.fillRect(sx - 3, sy - 1, 6, 2)
    }
  }
  // метка Охотницы — прицел
  if (marked) {
    ctx.strokeStyle = '#ffb347'
    ctx.lineWidth = 1.6
    const r = h * 0.55 + 4
    for (let k = 0; k < 2; k++) {
      ctx.beginPath()
      ctx.arc(s.x, mid, r, game.time * 2 + k * Math.PI, game.time * 2 + k * Math.PI + Math.PI * 0.6)
      ctx.stroke()
    }
  }
}

/** Враг-спрайт: синяя тень, шаг — покачивание и лёгкий наклон вперёд */
function drawAssetCreep(
  ctx: CanvasRenderingContext2D, name: AssetName, scale: number, s: Vec, left: boolean, t: number, seed: number
) {
  const m = ASSETS[name]
  const step = Math.sin(t * 9 + seed)
  ctx.fillStyle = 'rgba(14,22,52,0.42)'
  ctx.beginPath()
  ctx.ellipse(s.x + 3, s.y, m.w * scale * 0.36, m.w * scale * 0.13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(s.x, s.y)
  ctx.rotate((left ? -1 : 1) * step * 0.04)
  const ok = drawAsset(ctx, name, 0, -Math.abs(step) * 1.5, scale, left)
  ctx.restore()
  return ok
}

/**
 * Полосы HP — отдельным проходом поверх всего. Чтобы в плотной колонне полосы не наслаивались:
 * у целых врагов полосы нет; рисуем от головы колонны к хвосту и пропускаем полосу, которая
 * легла бы на уже нарисованную (передний враг важнее). Босс — всегда.
 */
function drawCreepBars(ctx: CanvasRenderingContext2D, game: Game) {
  const drawn: { x: number; y: number; w: number }[] = []
  const order = [...game.creeps].sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || b.dist - a.dist)
  for (const c of order) {
    if (!c.isBoss && c.hp >= c.maxHp) continue
    const p = pointAtLength(c.dist)
    const s = toScreen(p.x, p.y)
    const w = c.isBoss ? 60 : Math.max(18, Math.round(c.size * 1.6))
    const x = Math.round(s.x - w / 2)
    const y = Math.round(s.y - creepHeight(c) - 8)
    if (!c.isBoss && drawn.some((d) => x < d.x + d.w + 2 && x + w + 2 > d.x && Math.abs(y - d.y) < 6)) continue
    drawn.push({ x, y, w })
    const hpFrac = Math.max(0, c.hp / c.maxHp)
    ctx.fillStyle = '#0b0e14'
    ctx.fillRect(x - 1, y - 1, w + 2, 6)
    ctx.fillStyle = '#3a1410'
    ctx.fillRect(x, y, w, 4)
    ctx.fillStyle = hpFrac > 0.5 ? '#5fd06a' : hpFrac > 0.25 ? '#f0b060' : '#e8402e'
    ctx.fillRect(x, y, Math.max(1, Math.round(w * hpFrac)), 4)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(x, y, Math.max(1, Math.round(w * hpFrac)), 1)
  }
}

// ─── Снаряды и эффекты ───────────────────────────────────────────────────
/** Высота полёта над землёй: вылет с верхушки башни, попадание в корпус врага */
const SHOT_FROM = 40
const SHOT_TO = 14

function drawProjectiles(ctx: CanvasRenderingContext2D, game: Game, skin: Skin) {
  for (const pr of game.projectiles) {
    const tp = pr.targetPos
    if (!tp) continue
    const dx = tp.x - pr.x
    const dy = tp.y - pr.y
    const d = Math.hypot(dx, dy) || 1

    // ядра и сферы летят по дуге, стрелы — почти прямо; по снегу под снарядом бежит его тень
    const total = pr.ox !== undefined && pr.oy !== undefined ? Math.hypot(tp.x - pr.ox, tp.y - pr.oy) : 0
    const arc = pr.kind === 'rock' ? 0.35 : pr.kind === 'orb' ? 0.18 : 0.05
    const prog = total > 0 ? Math.max(0, Math.min(1, 1 - d / total)) : 1
    const lift = Math.min(60, total * arc) * 4 * prog * (1 - prog) + SHOT_FROM + (SHOT_TO - SHOT_FROM) * prog
    const s = toScreen(pr.x, pr.y)
    ctx.fillStyle = 'rgba(14,22,52,0.4)'
    ctx.beginPath()
    ctx.ellipse(s.x, s.y, 5, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()
    const u = screenDir(dx / d, dy / d)
    // на экране снаряд ещё и снижается — наклоняем след по вертикали
    const ux = u.x
    const uy = u.y + (SHOT_FROM - SHOT_TO) / Math.max(40, total * 0.6) * 0.5
    const x = s.x
    const y = s.y - lift

    if (skin === 'lol') {
      ctx.save()
      ctx.translate(0, -lift)
      drawLolProjectile(ctx, { ...pr, x: s.x, y: s.y }, Math.atan2(uy, ux))
      ctx.restore()
      continue
    }
    if (pr.kind === 'arrow' || pr.kind === 'bolt') {
      const len = pr.kind === 'bolt' ? 14 : 10
      ctx.strokeStyle = pr.color
      ctx.lineWidth = pr.kind === 'bolt' ? 2.6 : 1.8
      ctx.beginPath()
      ctx.moveTo(x - ux * len, y - uy * len)
      ctx.lineTo(x + ux * 3, y + uy * 3)
      ctx.stroke()
      if (pr.crit) {
        ctx.fillStyle = 'rgba(255,223,107,0.5)'
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (pr.kind === 'rock') {
      // чугунное ядро с раскалённым бликом
      ctx.fillStyle = '#1c2029'
      ctx.beginPath()
      ctx.arc(x, y, 5.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = pr.color
      ctx.beginPath()
      ctx.arc(x - 1.5, y - 1.5, 2.2, 0, Math.PI * 2)
      ctx.fill()
    } else if (pr.kind === 'orb') {
      ctx.fillStyle = pr.color
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = pr.color
      ctx.beginPath()
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/** Кольца на земле: взрывы, оглушение, лечение — эллипсы в проекции */
function drawGroundEffects(ctx: CanvasRenderingContext2D, game: Game) {
  for (const e of game.effects) {
    if (e.kind === 'chain' || e.kind === 'beam') continue
    const t = (game.time - e.born) / e.dur
    if (t < 0 || t > 1) continue
    groundPath(ctx, () => ctx.arc(e.x, e.y, e.r * (0.35 + 0.65 * t), 0, Math.PI * 2))
    ctx.strokeStyle = e.color
    ctx.globalAlpha = 1 - t
    ctx.lineWidth = e.kind === 'blast' ? 3 : 2
    if (e.kind === 'stun') ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])
    if (e.kind === 'blast') {
      groundPath(ctx, () => ctx.arc(e.x, e.y, e.r * t * 0.8, 0, Math.PI * 2))
      ctx.fillStyle = e.color
      ctx.globalAlpha = (1 - t) * 0.22
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/** Молния и луч — ломаные в воздухе между башней и врагами */
function drawBolts(ctx: CanvasRenderingContext2D, game: Game) {
  for (const e of game.effects) {
    if ((e.kind !== 'chain' && e.kind !== 'beam') || !e.points || e.points.length < 2) continue
    const t = (game.time - e.born) / e.dur
    if (t < 0 || t > 1) continue
    const pts = e.points.map((p, i) => {
      const s = toScreen(p.x, p.y)
      return { x: s.x, y: s.y - (i === 0 ? SHOT_FROM : SHOT_TO) }
    })
    ctx.globalAlpha = 1 - t
    for (const [w, c] of [[5, 'rgba(255,255,255,0.25)'], [e.kind === 'beam' ? 3 : 2, e.color]] as const) {
      ctx.strokeStyle = c
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1]
        const b = pts[k]
        if (e.kind === 'chain') {
          ctx.lineTo((a.x + b.x) / 2 + Math.sin(e.born * 97 + k) * 9, (a.y + b.y) / 2 + Math.cos(e.born * 89 + k) * 6)
        }
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

// ─── Охотница ────────────────────────────────────────────────────────────
function drawAvatarGround(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  const av = game.avatar
  const near = view.mouse && Math.hypot(view.mouse.x - av.x, view.mouse.y - av.y) < 26
  if (near) {
    groundPath(ctx, () => ctx.arc(av.x, av.y, 110, 0, Math.PI * 2))
    ctx.fillStyle = 'rgba(127,208,160,0.06)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(127,208,160,0.5)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (av.target) {
    const tg = av.target
    groundPath(ctx, () => {
      ctx.moveTo(av.x, av.y)
      ctx.lineTo(tg.x, tg.y)
      ctx.moveTo(tg.x - 7, tg.y - 7)
      ctx.lineTo(tg.x + 7, tg.y + 7)
      ctx.moveTo(tg.x + 7, tg.y - 7)
      ctx.lineTo(tg.x - 7, tg.y + 7)
    })
    ctx.strokeStyle = 'rgba(127,208,160,0.6)'
    ctx.setLineDash([4, 6])
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.setLineDash([])
  }
  // бирюзовое кольцо под ногами отличает героя; пульсирует, когда способность готова
  const ring = av.cooldown <= 0 ? 17 + Math.sin(game.time * 4) * 1.5 : 16
  groundPath(ctx, () => ctx.arc(av.x, av.y, ring, 0, Math.PI * 2))
  ctx.strokeStyle = av.cooldown <= 0 ? 'rgba(127,208,160,0.9)' : 'rgba(127,208,160,0.45)'
  ctx.lineWidth = 2
  ctx.stroke()
}

let hunterLeft = false

function drawAvatar(ctx: CanvasRenderingContext2D, game: Game, s: Vec) {
  const av = game.avatar
  if (av.target) {
    const ts = toScreen(av.target.x, av.target.y)
    if (Math.abs(ts.x - s.x) > 2) hunterLeft = ts.x < s.x
  }
  const moving = !!av.target
  drawSprite(ctx, 'hunter', s.x, s.y, moving ? game.time : 0, 7, hunterLeft, !moving)
}

// ─── Подсказки поверх ────────────────────────────────────────────────────
function drawBuildGhost(ctx: CanvasRenderingContext2D, view: ViewState) {
  if (!view.buildGhost) return
  const { x, y, valid, range, glyph, defId } = view.buildGhost
  const s = toScreen(x, y)

  // радиус атаки выбранной башни
  groundPath(ctx, () => ctx.arc(x, y, range, 0, Math.PI * 2))
  ctx.fillStyle = valid ? 'rgba(255,190,110,0.08)' : 'rgba(224,82,82,0.06)'
  ctx.fill()
  ctx.strokeStyle = valid ? 'rgba(255,190,110,0.6)' : 'rgba(224,82,82,0.5)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 5])
  ctx.stroke()
  ctx.setLineDash([])

  // ромб клетки: зелёный — можно, красный — нельзя (как на референсе)
  groundPath(ctx, () => ctx.rect(x - CELL / 2 + 1, y - CELL / 2 + 1, CELL - 2, CELL - 2))
  ctx.fillStyle = valid ? 'rgba(95,208,106,0.25)' : 'rgba(232,64,46,0.25)'
  ctx.fill()
  ctx.strokeStyle = valid ? '#5fd06a' : '#e8402e'
  ctx.lineWidth = 2
  ctx.stroke()

  // полупрозрачная башня, если спрайт есть; иначе значок
  const def = defId ? ALL_DEFS[defId] : undefined
  const spr = def ? towerSprite(def, towerArt(def)) : null
  if (spr) {
    ctx.save()
    ctx.globalAlpha = valid ? 0.7 : 0.35
    crispDraw(ctx, spr.cv, s.x - spr.ax * TOWER_SCALE, s.y + TOWER_FOOT - spr.h * TOWER_SCALE, spr.cv.width * TOWER_SCALE, spr.h * TOWER_SCALE)
    ctx.restore()
  } else {
    ctx.globalAlpha = valid ? 0.85 : 0.45
    ctx.font = '18px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(glyph, s.x, s.y)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
  }
  if (!valid) {
    ctx.strokeStyle = '#e8402e'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(s.x - 9, s.y - 5)
    ctx.lineTo(s.x + 9, s.y + 5)
    ctx.moveTo(s.x + 9, s.y - 5)
    ctx.lineTo(s.x - 9, s.y + 5)
    ctx.stroke()
  }
}

/** Подписи: башня под курсором, Разлом и лагерь, Колосс, имя и уровень Охотницы */
function drawOverlayLabels(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  const text = (str: string, x: number, y: number, color: string, size = 10) => {
    ctx.font = `bold ${size * labelScale}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.lineWidth = 3 * labelScale
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(str, x, y)
    ctx.fillStyle = color
    ctx.fillText(str, x, y)
  }
  // значок и имя башни — только у той, что под курсором или выбрана (на поле их заменяют вымпелы)
  const focus = view.hoverTower ?? view.selectedTower
  const ft = focus !== null ? game.towerById(focus) : undefined
  if (ft && view.skin === 'steam') {
    const def = ALL_DEFS[ft.defId]
    const s = toScreen(ft.x, ft.y)
    text(`${def.glyph} ${def.name}`, s.x, s.y - 66, '#ffc46b', 11)
  }
  text('РАЗЛОМ', roadEnds.entry.x, roadEnds.entry.y - 34, '#a6f095')
  text('ЛАГЕРЬ', roadEnds.exit.x + 10, roadEnds.exit.y - 46, '#ffb347')
  for (const c of game.creeps) {
    if (!c.isBoss) continue
    const p = pointAtLength(c.dist)
    const s = toScreen(p.x, p.y)
    text('КОЛОСС РАЗЛОМА', s.x, s.y - creepHeight(c) - 14, '#a6f095')
  }
  const av = toScreen(game.avatar.x, game.avatar.y)
  text('ОХОТНИЦА', av.x, av.y + 16, '#7fd0a0', 9)
  text(`ур.${game.avatar.level}`, av.x + 18, av.y - 30, '#7fd0a0', 9)
}

function drawFloats(ctx: CanvasRenderingContext2D, game: Game) {
  for (const f of game.floats) {
    const t = (game.time - f.born) / 1.1
    if (t < 0 || t > 1) continue
    const s = toScreen(f.x, f.y)
    ctx.globalAlpha = 1 - t
    ctx.font = `bold ${13 * labelScale}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.fillStyle = f.color
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 3
    const y = s.y - 30 - 22 * t
    ctx.strokeText(f.text, s.x, y)
    ctx.fillText(f.text, s.x, y)
    ctx.globalAlpha = 1
  }
}

function drawMergeLinks(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  if (view.mergeFrom === null) return
  const from = game.towerById(view.mergeFrom)
  if (!from) return
  for (const t of game.mergeTargetsFor(view.mergeFrom)) {
    const to = game.towerById(t)
    if (!to) continue
    groundPath(ctx, () => {
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
    })
    ctx.strokeStyle = 'rgba(127,208,160,0.75)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 6])
    ctx.stroke()
    ctx.setLineDash([])
  }
}
