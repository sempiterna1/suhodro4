// Canvas-рендерер прототипа «Железный Разлом» — стимпанк-стиль

import {
  ALL_DEFS,
  ARMOR_COLORS,
  MAP_H,
  MAP_W,
  PATH,
  PATH_WIDTH,
  SPOTS,
  SPOT_RADIUS,
} from './config'
import type { Game } from './engine'
import { pointAtLength } from './engine'
import type { Vec } from './types'

export interface ViewState {
  hoverSpot: number | null
  selectedSpot: number | null
  mergeFrom: number | null
  mouse: Vec | null
}

// ─── Кэш статичного фона ─────────────────────────────────────────────────
let bgCache: HTMLCanvasElement | null = null

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

  // плиты
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 1.5
  for (let x = 0; x <= MAP_W; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, MAP_H)
    ctx.stroke()
  }
  for (let y = 0; y <= MAP_H; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(MAP_W, y)
    ctx.stroke()
  }
  // заклёпки на стыках плит
  ctx.fillStyle = 'rgba(176,141,87,0.16)'
  for (let x = 32; x < MAP_W; x += 64) {
    for (let y = 32; y < MAP_H; y += 64) {
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // декоративные шестерни
  drawGear(ctx, 80, 520, 42, 10, 'rgba(140,110,70,0.10)')
  drawGear(ctx, 130, 560, 26, 8, 'rgba(140,110,70,0.13)')
  drawGear(ctx, 900, 90, 52, 12, 'rgba(140,110,70,0.10)')
  drawGear(ctx, 840, 60, 24, 8, 'rgba(140,110,70,0.13)')
  drawGear(ctx, 480, 290, 66, 14, 'rgba(140,110,70,0.06)')

  // тропа — клёпаный металлический настил
  const trace = () => {
    ctx.beginPath()
    ctx.moveTo(PATH[0].x, PATH[0].y)
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y)
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'butt'
  trace()
  ctx.strokeStyle = '#15100a'
  ctx.lineWidth = PATH_WIDTH + 12
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
  const total = ctxPathLength()
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

function ctxPathLength() {
  let len = 0
  for (let i = 0; i < PATH.length - 1; i++) {
    len += Math.hypot(PATH[i + 1].x - PATH[i].x, PATH[i + 1].y - PATH[i].y)
  }
  return len
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
  if (!bgCache) bgCache = buildBackground()
  ctx.clearRect(0, 0, MAP_W, MAP_H)
  ctx.drawImage(bgCache, 0, 0)

  drawMergeLinks(ctx, game, view)
  drawSpots(ctx, game, view)
  drawTowers(ctx, game, view)
  drawCreeps(ctx, game)
  drawEffects(ctx, game)
  drawProjectiles(ctx, game)
  drawAvatar(ctx, game, view)
  drawFloats(ctx, game)
}

function drawSpots(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  SPOTS.forEach((s, i) => {
    const built = !!game.towers[i]
    const hovered = view.hoverSpot === i
    const selected = view.selectedSpot === i
    const mergeTarget = view.mergeFrom !== null && game.mergeTargetsFor(view.mergeFrom).includes(i)
    const mergeSource = view.mergeFrom === i

    ctx.save()
    ctx.translate(s.x, s.y)

    if (mergeTarget) {
      const pulse = 1 + 0.12 * Math.sin(game.time * 6)
      ctx.beginPath()
      ctx.arc(0, 0, SPOT_RADIUS + 7 * pulse, 0, Math.PI * 2)
      ctx.strokeStyle = '#7fd0a0'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = 'rgba(127,208,160,0.12)'
      ctx.fill()
    }
    if (mergeSource) {
      ctx.beginPath()
      ctx.arc(0, 0, SPOT_RADIUS + 8, 0, Math.PI * 2)
      ctx.strokeStyle = '#e8c170'
      ctx.lineWidth = 3
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    if (!built) {
      ctx.beginPath()
      ctx.arc(0, 0, SPOT_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = '#2e2416'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = hovered ? '#e8c170' : 'rgba(138,109,59,0.75)'
      ctx.stroke()
      // 4 заклёпки
      ctx.fillStyle = 'rgba(176,141,87,0.55)'
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2
        ctx.beginPath()
        ctx.arc(Math.cos(a) * (SPOT_RADIUS - 5), Math.sin(a) * (SPOT_RADIUS - 5), 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.fillStyle = hovered ? '#e8c170' : 'rgba(176,141,87,0.4)'
      ctx.fill()
      if (hovered) {
        ctx.font = 'bold 10px Georgia, serif'
        ctx.fillStyle = '#e8c170'
        ctx.textAlign = 'center'
        ctx.fillText('+', 0, -SPOT_RADIUS - 5)
      }
    }
    ctx.restore()
  })
}

function drawTowers(ctx: CanvasRenderingContext2D, game: Game, view: ViewState) {
  for (const tw of game.towers) {
    if (!tw) continue
    const def = ALL_DEFS[tw.defId]
    const s = SPOTS[tw.spot]
    const hovered = view.hoverSpot === tw.spot || view.selectedSpot === tw.spot

    // радиус атаки при наведении
    if (hovered) {
      const range = def.range * (tw.level >= 4 ? 1.1 : tw.level >= 2 ? 1.05 : 1)
      ctx.beginPath()
      ctx.arc(s.x, s.y, range, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(232,193,112,0.05)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(232,193,112,0.45)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // шестигранная бронзовая платформа
    ctx.save()
    ctx.translate(s.x, s.y)
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

function drawCreeps(ctx: CanvasRenderingContext2D, game: Game) {
  for (const c of game.creeps) {
    const p = pointAtLength(c.dist)
    const burning = game.time < c.burnUntil && c.burnDps > 0
    const stunned = game.time < c.stunnedUntil
    const marked = game.time < c.markedUntil

    // горение — ореол
    if (burning) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, c.size + 5 + Math.sin(game.time * 12) * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(230,110,50,0.35)'
      ctx.fill()
    }

    // тело
    ctx.beginPath()
    ctx.arc(p.x, p.y, c.size, 0, Math.PI * 2)
    ctx.fillStyle = ARMOR_COLORS[c.armor]
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = c.isBoss ? '#3a1010' : 'rgba(0,0,0,0.5)'
    ctx.stroke()

    // «глаз» ИИ
    ctx.beginPath()
    ctx.arc(p.x, p.y, c.size * 0.32, 0, Math.PI * 2)
    ctx.fillStyle = c.isBoss ? '#ff5040' : '#1a140e'
    ctx.fill()
    if (c.isBoss) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, c.size * 0.15, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd0c0'
      ctx.fill()
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

    // полоса HP
    const w = Math.max(c.size * 2.4, 22)
    const hpFrac = Math.max(0, c.hp / c.maxHp)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(p.x - w / 2, p.y - c.size - 9, w, 4)
    ctx.fillStyle = hpFrac > 0.5 ? '#7fd0a0' : hpFrac > 0.25 ? '#e8c170' : '#e05252'
    ctx.fillRect(p.x - w / 2 + 0.5, p.y - c.size - 8.5, (w - 1) * hpFrac, 3)

    if (c.isBoss) {
      ctx.font = 'bold 10px Georgia, serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffb0a0'
      ctx.fillText('ТИТАН-ИИ', p.x, p.y - c.size - 14)
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, game: Game) {
  for (const pr of game.projectiles) {
    const tp = pr.targetPos
    if (!tp) continue
    const dx = tp.x - pr.x
    const dy = tp.y - pr.y
    const d = Math.hypot(dx, dy) || 1
    const ux = dx / d
    const uy = dy / d

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
      ctx.fillStyle = 'rgba(212,105,79,0.25)'
      ctx.fill()
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
  const near = view.mouse && Math.hypot(view.mouse.x - av.x, view.mouse.y - av.y) < 26

  if (near) {
    ctx.beginPath()
    ctx.arc(av.x, av.y, 110, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(232,193,112,0.05)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(232,193,112,0.4)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  // линия движения
  if (av.target) {
    ctx.strokeStyle = 'rgba(232,193,112,0.5)'
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

  // фигура — латунный круг с луком
  ctx.beginPath()
  ctx.arc(av.x, av.y, 13, 0, Math.PI * 2)
  ctx.fillStyle = '#d9a441'
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#5a3d1e'
  ctx.stroke()
  ctx.font = '14px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🏹', av.x, av.y + 1)
  ctx.textBaseline = 'alphabetic'

  // бейдж уровня
  ctx.beginPath()
  ctx.arc(av.x + 10, av.y - 10, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#3a2e1c'
  ctx.fill()
  ctx.strokeStyle = '#e8c170'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.font = 'bold 8px Georgia, serif'
  ctx.fillStyle = '#e8c170'
  ctx.fillText(String(av.level), av.x + 10, av.y - 7)
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
  const from = SPOTS[view.mergeFrom]
  for (const t of game.mergeTargetsFor(view.mergeFrom)) {
    const to = SPOTS[t]
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
