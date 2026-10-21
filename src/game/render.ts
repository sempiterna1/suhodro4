// Canvas-рендерер прототипа «Железный Разлом» — пиксельный ретро-стиль.
// Мир (фон, башни, враги, снаряды, эффекты) рисуется в маленький LOW-холст (pixel.ts) и
// растягивается без сглаживания. Текст и подсказки (цифры, подписи, значки башен, призрак
// постройки) рисуются поверх в полном разрешении, чтобы оставаться читаемыми.

import {
  ALL_DEFS,
  CELL,
  MAP_H,
  MAP_W,
  SPOT_RADIUS,
} from './config'
import type { Game } from './engine'
import { pointAtLength } from './engine'
import { getMap } from './map'
import { LOW_H, LOW_W, PX, armorBody, buildPixelBackground, drawMotes, drawPixelTower, drawPlants, drawSprite } from './pixel'
import { applyLighting, drawFog, drawSmoke } from './lighting'
import { drawLolProjectile, drawLolTower } from './render-lol'
import type { Creep, Tower, Vec } from './types'

export type Skin = 'steam' | 'lol'

/** Призрак постройки: выбранная в арсенале башня над клеткой (центр клетки) */
export interface BuildGhost {
  x: number
  y: number
  valid: boolean
  range: number // радиус атаки выбранной башни
  glyph: string
}

export interface ViewState {
  skin: Skin // 'lol' — шуточный скин башен (render-lol.ts)
  lighting: boolean // динамический свет и сумрак (lighting.ts); выключается кнопкой для слабых устройств
  hoverTower: number | null
  selectedTower: number | null
  mergeFrom: number | null
  mouse: Vec | null
  buildGhost: BuildGhost | null
}

// ─── Кэш пиксельного фона (перестраивается при смене карты) ─────────────
let bgCache: HTMLCanvasElement | null = null
let bgSeed = -1
let low: HTMLCanvasElement | null = null

/** Куда смотрит враг: помним последнее горизонтальное направление (на вертикалях не дёргается) */
const facingLeft = new Map<number, boolean>()

/** Рисовать в LOW-пикселях напрямую (без масштаба мира) — для спрайтов и пиксельных полос */
function pixelPass(L: CanvasRenderingContext2D, fn: () => void) {
  L.save()
  L.setTransform(1, 0, 0, 1, 0, 0)
  fn()
  L.restore()
}

// ─── Основной рендер ─────────────────────────────────────────────────────
export function render(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  if (!bgCache || bgSeed !== game.mapSeed) {
    bgCache = buildPixelBackground(getMap())
    bgSeed = game.mapSeed
  }
  if (!low) {
    low = document.createElement('canvas')
    low.width = LOW_W
    low.height = LOW_H
  }
  const L = low.getContext('2d')!
  L.setTransform(1, 0, 0, 1, 0, 0)
  L.imageSmoothingEnabled = false
  L.clearRect(0, 0, LOW_W, LOW_H)
  L.drawImage(bgCache, 0, 0)
  // растения качаются по реальным часам — на паузе ветер не стихает
  drawPlants(L, getMap(), performance.now() / 1000)

  const now = performance.now() / 1000
  // дым из печей — до фигур, он стелется низко
  pixelPass(L, () => drawSmoke(L, now))

  // мир — в координатах поля, масштабом в LOW
  L.setTransform(PX, 0, 0, PX, 0, 0)
  drawMergeLinks(L, game, view)
  drawTowers(L, game, view) // только кольца выделения и радиусы — под фигурами
  drawEntities(L, game, view) // башни, враги, Охотница — с сортировкой по глубине
  drawEffects(L, game)
  drawProjectiles(L, game, view.skin)
  // туман, затем свет (сумрак со светящимися пятнами) — до полос HP, чтобы они оставались яркими
  drawFog(L, now)
  if (view.lighting) applyLighting(L, game, now)
  L.setTransform(PX, 0, 0, PX, 0, 0)
  drawCreepBars(L, game)
  // пыль и угольки поверх мира — по реальным часам, как и ветер
  pixelPass(L, () => drawMotes(L, now))

  // растягиваем пиксели без сглаживания
  ctx.clearRect(0, 0, MAP_W, MAP_H)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(low, 0, 0, MAP_W, MAP_H)

  // чёткий слой поверх: подсказки и текст
  drawBuildGhost(ctx, view)
  drawOverlayLabels(ctx, game, view)
  drawFloats(ctx, game)
}

/** Подписи в полном разрешении: значки башен, ВХОД/ВЫХОД, Титан, уровень и имя Охотницы */
function drawOverlayLabels(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  const text = (s: string, x: number, y: number, color: string, size = 10) => {
    ctx.font = `bold ${size}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'
    ctx.strokeText(s, x, y)
    ctx.fillStyle = color
    ctx.fillText(s, x, y)
  }
  // значок типа башни — маленькая бирка в углу клетки (форма башни общая для типа атаки)
  if (view.skin === 'steam') {
    ctx.font = '12px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const tw of game.towers) ctx.fillText(ALL_DEFS[tw.defId].glyph, tw.x + CELL / 2 - 7, tw.y - CELL / 2 + 6)
    ctx.textBaseline = 'alphabetic'
  }
  const m = getMap()
  const first = m.points[1]
  const last = m.points[m.points.length - 2]
  text('ВХОД', 26, first.y - 26, '#a6f095')
  text('ВЫХОД', MAP_W - 30, last.y - 26, '#ff9a7a')
  for (const c of game.creeps) {
    if (!c.isBoss) continue
    const p = pointAtLength(c.dist)
    text('ТИТАН-ИИ', p.x, p.y - c.size - 18, '#ffb0a0')
  }
  const av = game.avatar
  text('ОХОТНИЦА', av.x, av.y + 26, '#7fd0a0', 9)
  text(`ур.${av.level}`, av.x + 16, av.y - 14, '#7fd0a0', 9)
}

function drawBuildGhost(ctx: CanvasRenderingContext2D, view: ViewState) {
  if (!view.buildGhost) return
  const { x, y, valid, range, glyph } = view.buildGhost
  const color = valid ? '#e8c170' : '#e05252'

  // радиус атаки выбранной башни
  ctx.beginPath()
  ctx.arc(x, y, range, 0, Math.PI * 2)
  ctx.fillStyle = valid ? 'rgba(232,193,112,0.07)' : 'rgba(224,82,82,0.06)'
  ctx.fill()
  ctx.strokeStyle = valid ? 'rgba(232,193,112,0.55)' : 'rgba(224,82,82,0.45)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 5])
  ctx.stroke()
  ctx.setLineDash([])

  // подсветка клетки
  ctx.fillStyle = valid ? 'rgba(232,193,112,0.18)' : 'rgba(224,82,82,0.2)'
  ctx.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  if (!valid) ctx.setLineDash([5, 4])
  ctx.strokeRect(x - CELL / 2 + 1, y - CELL / 2 + 1, CELL - 2, CELL - 2)
  ctx.setLineDash([])

  // полупрозрачный значок башни
  ctx.globalAlpha = valid ? 0.85 : 0.45
  ctx.font = '18px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, x, y + 1)
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = 1
  if (!valid) {
    // перечёркивание — нельзя
    ctx.beginPath()
    ctx.moveTo(x - SPOT_RADIUS + 4, y - SPOT_RADIUS + 4)
    ctx.lineTo(x + SPOT_RADIUS - 4, y + SPOT_RADIUS - 4)
    ctx.strokeStyle = '#e05252'
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
}

function drawTowers(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  for (const tw of game.towers) {
    const def = ALL_DEFS[tw.defId]
    const hovered = view.hoverTower === tw.id || view.selectedTower === tw.id
    const isMergeTarget = view.mergeFrom !== null && game.mergeTargetsFor(view.mergeFrom).includes(tw.id)
    const isMergeSource = view.mergeFrom === tw.id

    // радиус атаки при наведении
    if (hovered) {
      const range = def.range * (tw.level >= 4 ? 1.1 : tw.level >= 2 ? 1.05 : 1)
      ctx.beginPath()
      ctx.arc(tw.x, tw.y, range, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(232,193,112,0.05)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(232,193,112,0.45)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // пульс-подсветка целей слияния
    if (isMergeTarget) {
      const pulse = 1 + 0.12 * Math.sin(game.time * 6)
      ctx.beginPath()
      ctx.arc(tw.x, tw.y, SPOT_RADIUS + 7 * pulse, 0, Math.PI * 2)
      ctx.strokeStyle = '#7fd0a0'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = 'rgba(127,208,160,0.12)'
      ctx.fill()
    }
    if (isMergeSource) {
      ctx.beginPath()
      ctx.arc(tw.x, tw.y, SPOT_RADIUS + 8, 0, Math.PI * 2)
      ctx.strokeStyle = '#e8c170'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

  }
}

/** Одна башня (кольца выделения рисует drawTowers заранее, под всеми фигурами) */
function drawTowerBody(ctx: CanvasRenderingContext2D, game: Game, view: ViewState, tw: Tower) {
  const def = ALL_DEFS[tw.defId]
  const hovered = view.hoverTower === tw.id || view.selectedTower === tw.id
  if (view.skin === 'lol') {
    drawLolTower(ctx, tw, def, game.time, hovered)
    drawLevelPips(ctx, tw.x, tw.y + 22, tw.level)
    return
  }
  // пиксельная башня: цоколь, колонна и навершие по типу атаки (pixel.ts)
  pixelPass(ctx, () => drawPixelTower(ctx, tw, def, game.time, hovered))
}

/**
 * Глубина: башни, враги и Охотница рисуются одним проходом от верха экрана к низу —
 * кто ниже (ближе к зрителю), тот перекрывает стоящих выше.
 */
function drawEntities(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  const items: { y: number; draw: () => void }[] = []
  for (const tw of game.towers) items.push({ y: tw.y + 10, draw: () => drawTowerBody(ctx, game, view, tw) })
  for (const c of game.creeps) {
    const p = pointAtLength(c.dist)
    items.push({ y: p.y, draw: () => drawCreep(ctx, game, c, p) })
  }
  items.push({ y: game.avatar.y + 6, draw: () => drawAvatar(ctx, game, view) })
  items.sort((a, b) => a.y - b.y)
  for (const it of items) it.draw()
}

function drawLevelPips(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  for (let l = 0; l < level; l++) {
    ctx.beginPath()
    ctx.arc(x + (l - (level - 1) / 2) * 7, y, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = level >= 5 ? '#ffd700' : '#e8c170'
    ctx.fill()
  }
}

function drawCreep(ctx: CanvasRenderingContext2D, game: Game, c: Creep, p: Vec) {
  {
    const burning = game.time < c.burnUntil && c.burnDps > 0
    const stunned = game.time < c.stunnedUntil
    const marked = game.time < c.markedUntil
    const slowed = game.time < c.slowUntil && c.slowPct > 0
    const steamed = game.time < c.vulnUntil

    // пар (уязвимость) — светлое облако
    if (steamed) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, c.size + 8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(230,225,210,0.22)'
      ctx.fill()
    }

    // горение — ореол
    if (burning) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, c.size + 5 + Math.sin(game.time * 12) * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(230,110,50,0.35)'
      ctx.fill()
    }

    // тело — пиксельный спрайт вида (pixel.ts), смотрит по ходу движения
    const ahead = pointAtLength(c.dist + 3)
    if (Math.abs(ahead.x - p.x) > 0.5) facingLeft.set(c.uid, ahead.x < p.x)
    pixelPass(ctx, () =>
      drawSprite(ctx, c.kind, p, game.time, c.uid, facingLeft.get(c.uid) ?? false, stunned, armorBody(c.armor))
    )

    // замедление — ледяная кайма
    if (slowed) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, c.size + 2, 0, Math.PI * 2)
      ctx.strokeStyle = '#7cc4e0'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // оглушение — пиксельные звёздочки кружатся над головой
    if (stunned) {
      pixelPass(ctx, () => {
        for (let k = 0; k < 2; k++) {
          const a = game.time * 6 + k * Math.PI
          const sx = Math.round((p.x + Math.cos(a) * 8) * PX)
          const sy = Math.round((p.y - c.size - 10 + Math.sin(a) * 2) * PX)
          ctx.fillStyle = '#ffe36a'
          ctx.fillRect(sx, sy - 1, 1, 3)
          ctx.fillRect(sx - 1, sy, 3, 1)
        }
      })
    }

    // метка охотницы — прицел
    if (marked) {
      ctx.strokeStyle = '#e8c170'
      ctx.lineWidth = 1.6
      const r = c.size + 6
      for (let k = 0; k < 2; k++) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, game.time * 2 + k * Math.PI, game.time * 2 + k * Math.PI + Math.PI * 0.6)
        ctx.stroke()
      }
    }

  }
}

/**
 * Полосы HP — отдельным проходом поверх всего. Чтобы в плотной колонне полосы не наслаивались:
 * у целых врагов полосы нет; рисуем от головы колонны к хвосту и пропускаем полосу, которая
 * легла бы на уже нарисованную (передний враг важнее). Босс — всегда, с подписью.
 */
function drawCreepBars(ctx: CanvasRenderingContext2D, game: Game) {
  // в LOW-пикселях: полоса 2 пикселя высотой с чёрной рамкой (подпись Титана — в чётком слое)
  pixelPass(ctx, () => {
    const drawn: { x: number; y: number; w: number }[] = []
    const order = [...game.creeps].sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || b.dist - a.dist)
    for (const c of order) {
      if (!c.isBoss && c.hp >= c.maxHp) continue
      const p = pointAtLength(c.dist)
      const w = c.isBoss ? 28 : Math.max(Math.round(c.size), 9)
      const x = Math.round(p.x * PX - w / 2)
      const y = Math.round((p.y - c.size) * PX) - 7
      if (!c.isBoss && drawn.some((d) => x < d.x + d.w + 1 && x + w + 1 > d.x && Math.abs(y - d.y) < 4)) continue
      drawn.push({ x, y, w })
      const hpFrac = Math.max(0, c.hp / c.maxHp)
      ctx.fillStyle = '#140d07'
      ctx.fillRect(x - 1, y - 1, w + 2, 4)
      ctx.fillStyle = '#3a1410'
      ctx.fillRect(x, y, w, 2)
      ctx.fillStyle = hpFrac > 0.5 ? '#7fd0a0' : hpFrac > 0.25 ? '#e8c170' : '#e05252'
      ctx.fillRect(x, y, Math.max(1, Math.round(w * hpFrac)), 2)
    }
  })
}

function drawProjectiles(ctx: CanvasRenderingContext2D, game: Game, skin: Skin) {
  for (const pr of game.projectiles) {
    const tp = pr.targetPos
    if (!tp) continue
    const dx = tp.x - pr.x
    const dy = tp.y - pr.y
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d

    // высота полёта: ядра и сферы летят по дуге (парабола от точки вылета к цели), стрелы — почти прямо;
    // по земле под снарядом бежит его тень — так видно, что он в воздухе
    const total = pr.ox !== undefined && pr.oy !== undefined ? Math.hypot(tp.x - pr.ox, tp.y - pr.oy) : 0
    const arc = pr.kind === 'rock' ? 0.35 : pr.kind === 'orb' ? 0.18 : 0.05
    const prog = total > 0 ? Math.max(0, Math.min(1, 1 - d / total)) : 1
    const lift = Math.min(60, total * arc) * 4 * prog * (1 - prog)
    if (lift > 1) {
      ctx.beginPath()
      ctx.ellipse(pr.x, pr.y + 2, 4, 2, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fill()
    }
    ctx.save()
    ctx.translate(0, -lift)

    if (skin === 'lol') {
      drawLolProjectile(ctx, pr, Math.atan2(uy, ux))
      ctx.restore()
      continue
    }

    if (pr.kind === 'arrow' || pr.kind === 'bolt') {
      const len = pr.kind === 'bolt' ? 12 : 9
      ctx.strokeStyle = pr.color
      ctx.lineWidth = pr.kind === 'bolt' ? 2.6 : 1.8
      ctx.beginPath()
      ctx.moveTo(pr.x - ux * len, pr.y - uy * len)
      ctx.lineTo(pr.x + ux * 3, pr.y + uy * 3)
      ctx.stroke()
      if (pr.crit) {
        ctx.beginPath()
        ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,223,107,0.5)'
        ctx.fill()
      }
    } else if (pr.kind === 'rock') {
      ctx.beginPath()
      ctx.arc(pr.x, pr.y, 5.5, 0, Math.PI * 2)
      ctx.fillStyle = pr.color
      ctx.fill()
      ctx.strokeStyle = '#2a1c10'
      ctx.lineWidth = 1
      ctx.stroke()
    } else if (pr.kind === 'orb') {
      ctx.beginPath()
      ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = pr.color
      ctx.fill()
      ctx.beginPath()
      ctx.arc(pr.x, pr.y, 7, 0, Math.PI * 2)
      ctx.fillStyle = pr.color
      ctx.globalAlpha = 0.25
      ctx.fill()
      ctx.globalAlpha = 1
    } else {
      // hammer
      ctx.beginPath()
      ctx.arc(pr.x, pr.y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = pr.color
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, game: Game) {
  for (const e of game.effects) {
    const t = (game.time - e.born) / e.dur
    if (t < 0 || t > 1) continue
    // молния и болт/луч — ломаная по точкам
    if ((e.kind === 'chain' || e.kind === 'beam') && e.points && e.points.length > 1) {
      ctx.globalAlpha = 1 - t
      ctx.strokeStyle = e.color
      ctx.lineWidth = e.kind === 'beam' ? 3 : 2
      ctx.beginPath()
      ctx.moveTo(e.points[0].x, e.points[0].y)
      for (let k = 1; k < e.points.length; k++) {
        const a = e.points[k - 1]
        const b = e.points[k]
        if (e.kind === 'chain') {
          // зигзаг между точками
          const mx = (a.x + b.x) / 2 + Math.sin(e.born * 97 + k) * 8
          const my = (a.y + b.y) / 2 + Math.cos(e.born * 89 + k) * 8
          ctx.lineTo(mx, my)
        }
        ctx.lineTo(b.x, b.y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
      continue
    }
    ctx.beginPath()
    ctx.arc(e.x, e.y, e.r * (0.35 + 0.65 * t), 0, Math.PI * 2)
    ctx.strokeStyle = e.color
    ctx.globalAlpha = 1 - t
    ctx.lineWidth = e.kind === 'blast' ? 3 : 2
    if (e.kind === 'stun') ctx.setLineDash([7, 5])
    ctx.stroke()
    ctx.setLineDash([])
    if (e.kind === 'blast') {
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.r * t * 0.8, 0, Math.PI * 2)
      ctx.fillStyle = e.color
      ctx.globalAlpha = (1 - t) * 0.18
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

function drawAvatar(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  const av = game.avatar
  const t = game.time
  const near = view.mouse && Math.hypot(view.mouse.x - av.x, view.mouse.y - av.y) < 26

  if (near) {
    ctx.beginPath()
    ctx.arc(av.x, av.y, 110, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(127,208,160,0.05)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(127,208,160,0.45)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // линия движения
  if (av.target) {
    ctx.strokeStyle = 'rgba(127,208,160,0.55)'
    ctx.setLineDash([4, 6])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(av.x, av.y)
    ctx.lineTo(av.target.x, av.target.y)
    ctx.stroke()
    ctx.setLineDash([])
    // маркер цели
    ctx.beginPath()
    ctx.moveTo(av.target.x - 6, av.target.y - 6)
    ctx.lineTo(av.target.x + 6, av.target.y + 6)
    ctx.moveTo(av.target.x + 6, av.target.y - 6)
    ctx.lineTo(av.target.x - 6, av.target.y + 6)
    ctx.stroke()
  }

  // бирюзовое кольцо под ногами отличает героя от башен и врагов; пульсирует, когда способность готова
  const ring = av.cooldown <= 0 ? 15 + Math.sin(t * 4) * 1.5 : 14
  ctx.beginPath()
  ctx.ellipse(av.x, av.y + 8, ring, ring * 0.45, 0, 0, Math.PI * 2)
  ctx.strokeStyle = av.cooldown <= 0 ? 'rgba(127,208,160,0.9)' : 'rgba(127,208,160,0.45)'
  ctx.lineWidth = 2
  ctx.stroke()

  // пиксельный спрайт: смотрит туда, куда идёт (уровень и подпись — в чётком слое)
  if (av.target && Math.abs(av.target.x - av.x) > 2) hunterLeft = av.target.x < av.x
  const moving = !!av.target
  pixelPass(ctx, () => drawSprite(ctx, 'hunter', { x: av.x, y: av.y }, moving ? t : 0, 7, hunterLeft, !moving))
}

let hunterLeft = false

function drawFloats(ctx: CanvasRenderingContext2D, game: Game) {
  for (const f of game.floats) {
    const t = (game.time - f.born) / 1.1
    if (t < 0 || t > 1) continue
    ctx.globalAlpha = 1 - t
    ctx.font = 'bold 13px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = f.color
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 3
    const y = f.y - 22 * t
    ctx.strokeText(f.text, f.x, y)
    ctx.fillText(f.text, f.x, y)
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
    ctx.strokeStyle = 'rgba(127,208,160,0.7)'
    ctx.lineWidth = 2.5
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}
