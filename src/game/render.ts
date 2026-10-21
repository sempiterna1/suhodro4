// Canvas-рендерер прототипа «Железный Разлом» — стимпанк-стиль

import {
  ALL_DEFS,
  ARMOR_COLORS,
  CELL,
  MAP_H,
  MAP_W,
  PATH_WIDTH,
  SPOT_RADIUS,
} from './config'
import type { Game } from './engine'
import { pointAtLength } from './engine'
import { getMap, pathLength } from './map'
import { drawCreepBody } from './render-creeps'
import { drawLolProjectile, drawLolTower } from './render-lol'
import type { Vec } from './types'

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
  hoverTower: number | null
  selectedTower: number | null
  mergeFrom: number | null
  mouse: Vec | null
  buildGhost: BuildGhost | null
}

// ─── Кэш статичного фона (перестраивается при смене карты) ──────────────
let bgCache: HTMLCanvasElement | null = null
let bgSeed = -1

function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    ctx.save()
    ctx.rotate(a)
    ctx.fillRect(r * 0.75, -r * 0.14, r * 0.45, r * 0.28)
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function buildBackground(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = MAP_W
  cv.height = MAP_H
  const ctx = cv.getContext('2d')!

  // пол — тёмные стальные плиты
  const grad = ctx.createLinearGradient(0, 0, MAP_W, MAP_H)
  grad.addColorStop(0, '#261d12')
  grad.addColorStop(0.5, '#2b2115')
  grad.addColorStop(1, '#221a10')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, MAP_W, MAP_H)

  // плиты = клетки сетки постройки
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1.2
  for (let x = 0; x <= MAP_W; x += CELL) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, MAP_H)
    ctx.stroke()
  }
  for (let y = 0; y <= MAP_H; y += CELL) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(MAP_W, y)
    ctx.stroke()
  }
  // заклёпки на углах клеток
  ctx.fillStyle = 'rgba(176,141,87,0.14)'
  for (let x = CELL; x < MAP_W; x += CELL) {
    for (let y = CELL; y < MAP_H; y += CELL) {
      ctx.beginPath()
      ctx.arc(x, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // декоративные шестерни
  drawGear(ctx, 80, 520, 42, 10, 'rgba(140,110,70,0.10)')
  drawGear(ctx, 130, 560, 26, 8, 'rgba(140,110,70,0.13)')
  drawGear(ctx, 900, 90, 52, 12, 'rgba(140,110,70,0.10)')
  drawGear(ctx, 840, 60, 24, 8, 'rgba(140,110,70,0.13)')
  drawGear(ctx, 480, 290, 66, 14, 'rgba(140,110,70,0.06)')

  // клетки тропы — тёмная подложка, чтобы было видно, куда строить нельзя
  ctx.fillStyle = 'rgba(10,7,4,0.35)'
  for (const c of getMap().cells) ctx.fillRect(c.cx * CELL, c.cy * CELL, CELL, CELL)

  // тропа — клёпаный металлический настил
  const PATH = getMap().points
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(PATH[0].x, PATH[0].y)
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y)
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'butt'
  trace()
  ctx.strokeStyle = '#15100a'
  ctx.lineWidth = PATH_WIDTH + 4 // кромка не вылезает за клетки тропы
  ctx.stroke()
  trace()
  ctx.strokeStyle = '#3d3122'
  ctx.lineWidth = PATH_WIDTH
  ctx.stroke()
  trace()
  ctx.strokeStyle = 'rgba(90,72,48,0.55)'
  ctx.lineWidth = PATH_WIDTH - 12
  ctx.stroke()
  // центральная пунктирная направляющая
  trace()
  ctx.setLineDash([14, 18])
  ctx.strokeStyle = 'rgba(176,141,87,0.28)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.setLineDash([])

  // заклёпки по краям тропы
  const total = pathLength()
  ctx.fillStyle = 'rgba(20,14,8,0.55)'
  for (let d = 10; d < total; d += 30) {
    const p = pointAtLength(d)
    const n = normalAt(d)
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(p.x + n.x * (PATH_WIDTH / 2 - 4) * s, p.y + n.y * (PATH_WIDTH / 2 - 4) * s, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // портал входа
  const entry = pointAtLength(4)
  ctx.beginPath()
  ctx.arc(entry.x, entry.y, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0a06'
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#8a6d3b'
  ctx.stroke()
  // портал выхода
  const exitP = pointAtLength(total - 4)
  ctx.beginPath()
  ctx.arc(exitP.x, exitP.y, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#0d0a06'
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#a0522d'
  ctx.stroke()

  // подписи
  ctx.font = 'bold 11px Georgia, serif'
  ctx.fillStyle = 'rgba(232,193,112,0.75)'
  ctx.textAlign = 'center'
  ctx.fillText('ВХОД', entry.x + 2, entry.y - 32)
  ctx.fillText('ВЫХОД', exitP.x - 4, exitP.y - 32)

  return cv
}

function normalAt(d: number): Vec {
  const eps = 2
  const a = pointAtLength(Math.max(0, d - eps))
  const b = pointAtLength(d + eps)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: -dy / len, y: dx / len }
}

// ─── Основной рендер ─────────────────────────────────────────────────────
export function render(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  if (!bgCache || bgSeed !== game.mapSeed) {
    bgCache = buildBackground()
    bgSeed = game.mapSeed
  }
  ctx.clearRect(0, 0, MAP_W, MAP_H)
  ctx.drawImage(bgCache, 0, 0)

  drawMergeLinks(ctx, game, view)
  drawBuildGhost(ctx, view)
  drawTowers(ctx, game, view)
  drawCreeps(ctx, game)
  drawEffects(ctx, game)
  drawProjectiles(ctx, game, view.skin)
  drawCreepBars(ctx, game)
  drawAvatar(ctx, game, view)
  drawFloats(ctx, game)
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

    if (view.skin === 'lol') {
      drawLolTower(ctx, tw, def, game.time, hovered)
      drawLevelPips(ctx, tw.x, tw.y + 22, tw.level)
      continue
    }

    // шестигранная бронзовая платформа
    ctx.save()
    ctx.translate(tw.x, tw.y)
    ctx.beginPath()
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6
      const px = Math.cos(a) * (SPOT_RADIUS + 1)
      const py = Math.sin(a) * (SPOT_RADIUS + 1)
      if (k === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = '#3a2e1c'
    ctx.fill()
    ctx.strokeStyle = hovered ? '#e8c170' : '#8a6d3b'
    ctx.lineWidth = 2
    ctx.stroke()

    // глиф типа
    ctx.font = '17px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(def.glyph, 0, 1)

    // пипсы уровня
    for (let l = 0; l < tw.level; l++) {
      ctx.beginPath()
      ctx.arc((l - (tw.level - 1) / 2) * 7, SPOT_RADIUS + 7, 2.4, 0, Math.PI * 2)
      ctx.fillStyle = tw.level >= 5 ? '#ffd700' : '#e8c170'
      ctx.fill()
    }

    // уникальный облик 5 уровня — золотое свечение
    if (tw.level >= 5) {
      ctx.beginPath()
      ctx.arc(0, 0, SPOT_RADIUS + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,215,0,0.55)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()
    ctx.textBaseline = 'alphabetic'
  }
}

function drawLevelPips(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  for (let l = 0; l < level; l++) {
    ctx.beginPath()
    ctx.arc(x + (l - (level - 1) / 2) * 7, y, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = level >= 5 ? '#ffd700' : '#e8c170'
    ctx.fill()
  }
}

function drawCreeps(ctx: CanvasRenderingContext2D, game: Game) {
  for (const c of game.creeps) {
    const p = pointAtLength(c.dist)
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

    // тело — свой стимпанк-облик у каждого вида врага (render-creeps.ts)
    const ahead = pointAtLength(c.dist + 3)
    drawCreepBody(ctx, c, p, Math.atan2(ahead.y - p.y, ahead.x - p.x), game.time, game.time < c.stunnedUntil)

    // замедление — ледяная кайма
    if (slowed) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, c.size + 2, 0, Math.PI * 2)
      ctx.strokeStyle = '#7cc4e0'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // оглушение — звёздочки
    if (stunned) {
      ctx.font = '10px "Noto Color Emoji",sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('✦', p.x + Math.sin(game.time * 7) * 8, p.y - c.size - 8)
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
  const drawn: { x: number; y: number; w: number }[] = []
  const BAR_H = 4
  const order = [...game.creeps].sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || b.dist - a.dist)
  for (const c of order) {
    if (!c.isBoss && c.hp >= c.maxHp) continue
    const p = pointAtLength(c.dist)
    const w = c.isBoss ? 56 : Math.max(c.size * 2, 18)
    const x = p.x - w / 2
    const y = p.y - c.size - 9
    if (!c.isBoss && drawn.some((d) => x < d.x + d.w && x + w > d.x && Math.abs(y - d.y) < BAR_H + 2)) continue
    drawn.push({ x, y, w })
    const hpFrac = Math.max(0, c.hp / c.maxHp)
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(x - 1, y - 1, w + 2, BAR_H + 2)
    ctx.fillStyle = hpFrac > 0.5 ? '#7fd0a0' : hpFrac > 0.25 ? '#e8c170' : '#e05252'
    ctx.fillRect(x, y, w * hpFrac, BAR_H)
    if (c.isBoss) {
      ctx.font = 'bold 10px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffb0a0'
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.lineWidth = 3
      ctx.strokeText('ТИТАН-ИИ', p.x, y - 4)
      ctx.fillText('ТИТАН-ИИ', p.x, y - 4)
    }
  }
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

    if (skin === 'lol') {
      drawLolProjectile(ctx, pr, Math.atan2(uy, ux))
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

  // тень под героем
  ctx.beginPath()
  ctx.ellipse(av.x, av.y + 13, 11, 4, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fill()

  // герой отличается от башен: бирюзовое живое кольцо + тёмный силуэт
  // (башни — латунные шестигранники, герой — круглый тёмный с зелёным)

  // мягкая пульсация, когда способность готова
  if (av.cooldown <= 0) {
    const glow = 20 + Math.sin(t * 4) * 2.5
    ctx.beginPath()
    ctx.arc(av.x, av.y, glow, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(127,208,160,0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // вращающееся пунктирное кольцо — «карточка» героя
  ctx.save()
  ctx.translate(av.x, av.y)
  ctx.rotate(-t * 1.4)
  ctx.beginPath()
  ctx.arc(0, 0, 17, 0, Math.PI * 2)
  ctx.setLineDash([9, 7])
  ctx.strokeStyle = '#7fd0a0'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // тело — тёмный диск с бирюзовой каймой
  ctx.beginPath()
  ctx.arc(av.x, av.y, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#1f2d24'
  ctx.fill()
  ctx.lineWidth = 2.2
  ctx.strokeStyle = '#7fd0a0'
  ctx.stroke()

  // силуэт охотницы — эмодзи лука на тёмном диске
  ctx.font = '15px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🏹', av.x, av.y + 1)
  ctx.textBaseline = 'alphabetic'

  // бейдж уровня (бирюзовый, в отличие от латунных пипсов башен)
  ctx.beginPath()
  ctx.arc(av.x + 11, av.y - 11, 7.5, 0, Math.PI * 2)
  ctx.fillStyle = '#1f2d24'
  ctx.fill()
  ctx.strokeStyle = '#7fd0a0'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.font = 'bold 9px Georgia, serif'
  ctx.fillStyle = '#7fd0a0'
  ctx.textAlign = 'center'
  ctx.fillText(String(av.level), av.x + 11, av.y - 7.5)

  // подпись героя
  ctx.font = 'bold 8px Georgia, serif'
  ctx.fillStyle = 'rgba(127,208,160,0.85)'
  ctx.textAlign = 'center'
  ctx.fillText('ОХОТНИЦА', av.x, av.y + 30)
}

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
