// Шуточный скин «lol»: башни-фаллосы и «брызги» вместо выстрелов.
// Включается переключателем в верхней панели или ссылкой ?skin=lol.
// Только отрисовка — механика и баланс не меняются. Удаляется вместе с этим файлом.

import type { AttackType, Projectile, Tower, TowerDefinition } from './types'

const SKIN = '#e9b896'
const SKIN_DARK = '#c98d6c'
const DROP = '#f6f2e6' // основной цвет брызг

// ─── Стили брызг: у каждой башни свой ────────────────────────────────────
type SquirtKind =
  | 'jet' // тонкая быстрая струя
  | 'blob' // крупные капли с провисанием
  | 'spray' // широкий веер мелких капель
  | 'sparkle' // искры-капли во все стороны конусом
  | 'triple' // три струи веером
  | 'zigzag' // ломаная струя (молния)
  | 'ring' // во все стороны (удар по площади)
  | 'spiral' // закрученная струя (время)
  | 'burst' // короткая очередь из нескольких порций

interface SquirtStyle {
  kind: SquirtKind
  n: number // капель
  len: number // длина вылета, px
  size: number // радиус капли
  spread: number // разброс угла, рад
  dur: number // длительность, с
  tint?: string // подкраска капель
}

const BY_ATTACK: Record<AttackType, SquirtStyle> = {
  pierce: { kind: 'jet', n: 7, len: 60, size: 2.2, spread: 0.08, dur: 0.3 },
  crush: { kind: 'blob', n: 4, len: 34, size: 5, spread: 0.5, dur: 0.45 },
  magic: { kind: 'sparkle', n: 10, len: 42, size: 2, spread: 0.9, dur: 0.4 },
  universal: { kind: 'spray', n: 12, len: 46, size: 1.6, spread: 0.35, dur: 0.3 },
}

const BY_TOWER: Record<string, Partial<SquirtStyle>> = {
  sentry: { kind: 'spray', n: 8, len: 36 },
  archer: { kind: 'jet', n: 6, len: 64 },
  crossbow: { kind: 'jet', n: 9, len: 80, size: 2.6 },
  hunter: { kind: 'triple', n: 12, len: 58 },
  ballista: { kind: 'jet', n: 14, len: 120, size: 2.4, spread: 0.03 },
  catapult: { kind: 'blob', n: 3, len: 40, size: 6 },
  mauler: { kind: 'blob', n: 5, len: 26, size: 4.5 },
  mortar: { kind: 'blob', n: 6, len: 52, size: 5.5, spread: 0.7 },
  golem: { kind: 'blob', n: 2, len: 30, size: 9, dur: 0.6 },
  pyro: { kind: 'sparkle', tint: '#ffb070' },
  frost: { kind: 'sparkle', tint: '#bfe8ff' },
  lightning: { kind: 'zigzag', n: 12, len: 70, tint: '#e2d6ff' },
  chrono: { kind: 'spiral', n: 12, len: 50, tint: '#e0c8ff' },
  mech_guard: { kind: 'burst', n: 9, len: 54 },
  prism: { kind: 'jet', n: 10, len: 75, tint: '#c8fff4' },
  // слитые — сочетания стилей родителей
  flame_archer: { kind: 'jet', n: 8, len: 66, tint: '#ffc890' },
  volcano: { kind: 'blob', n: 5, len: 44, size: 6, tint: '#ffb070' },
  thunder_crossbow: { kind: 'zigzag', n: 12, len: 85, tint: '#e2d6ff' },
  frost_hunter: { kind: 'triple', n: 12, len: 60, tint: '#bfe8ff' },
  siege_engine: { kind: 'jet', n: 16, len: 130, size: 3, spread: 0.03 },
  time_guardian: { kind: 'spiral', n: 10, len: 34, size: 3.5, tint: '#e0c8ff' },
  storm_mortar: { kind: 'blob', n: 6, len: 52, size: 5, tint: '#e2d6ff' },
  steam_boiler: { kind: 'spray', n: 18, len: 40, size: 2.2, spread: 0.8, tint: '#ffffff' },
  bastion: { kind: 'burst', n: 12, len: 50 },
  eternity_prism: { kind: 'spiral', n: 14, len: 80, tint: '#e8d8ff' },
  auto_arsenal: { kind: 'burst', n: 10, len: 60, size: 1.8 },
  stone_titan: { kind: 'ring', n: 18, len: 44, size: 4, dur: 0.5 },
}

function styleFor(def: TowerDefinition): SquirtStyle {
  const attack = def.merged ? def.attacks[0] : def.attack
  return { ...BY_ATTACK[attack], ...BY_TOWER[def.id] }
}

// детерминированный «рандом» — капли одного выстрела не дрожат между кадрами
function rng(seed: number) {
  let s = Math.floor(seed) % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, tint?: string) {
  if (r <= 0.2) return
  // капля-слеза, вытянутая по направлению полёта
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(-r * 2.2, 0)
  ctx.quadraticCurveTo(-r * 0.2, -r, r, 0)
  ctx.quadraticCurveTo(-r * 0.2, r, -r * 2.2, 0)
  ctx.closePath()
  ctx.fillStyle = tint ?? DROP
  ctx.fill()
  ctx.beginPath()
  ctx.arc(r * 0.2, -r * 0.3, r * 0.35, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fill()
  ctx.restore()
}

/** Брызги из кончика башни после выстрела */
function drawSquirt(
  ctx: CanvasRenderingContext2D, tw: Tower, def: TowerDefinition,
  tip: { x: number; y: number }, time: number
) {
  const st = styleFor(def)
  const p = (time - tw.lastShotAt) / st.dur
  if (p < 0 || p > 1) return
  const ease = 1 - (1 - p) * (1 - p)
  const rand = rng(tw.id * 7919 + Math.round(tw.lastShotAt * 1000))
  ctx.globalAlpha = 1 - p * 0.85

  for (let i = 0; i < st.n; i++) {
    const r1 = rand()
    const r2 = rand()
    let a = tw.aim + (r1 - 0.5) * st.spread * 2
    let d = st.len * ease * (0.55 + 0.45 * r2)
    let ox = 0
    let oy = 0
    switch (st.kind) {
      case 'jet':
        // капли цепочкой вдоль струи
        d = st.len * ease * (i / st.n) + st.len * 0.15 * ease
        break
      case 'triple':
        a = tw.aim + ((i % 3) - 1) * 0.38 + (r1 - 0.5) * 0.06
        d = st.len * ease * (0.4 + 0.6 * (Math.floor(i / 3) / Math.ceil(st.n / 3)))
        break
      case 'blob':
        oy = 18 * p * p // провисание под тяжестью
        break
      case 'ring':
        a = (i / st.n) * Math.PI * 2 + r1 * 0.2
        break
      case 'zigzag': {
        const k = i / st.n
        d = st.len * ease * k
        const side = i % 2 === 0 ? 1 : -1
        ox = Math.cos(tw.aim + Math.PI / 2) * side * 7
        oy = Math.sin(tw.aim + Math.PI / 2) * side * 7
        break
      }
      case 'spiral': {
        const k = i / st.n
        d = st.len * ease * k
        const sw = Math.sin(k * 10 + time * 14) * 9 * k
        ox = Math.cos(tw.aim + Math.PI / 2) * sw
        oy = Math.sin(tw.aim + Math.PI / 2) * sw
        break
      }
      case 'burst': {
        // три порции подряд с паузами
        const wave = i % 3
        const local = Math.min(1, Math.max(0, (p - wave * 0.18) / 0.6))
        d = st.len * local * (0.7 + 0.3 * r2)
        if (local <= 0) continue
        break
      }
      case 'spray':
      case 'sparkle':
        break
    }
    const x = tip.x + Math.cos(a) * d + ox
    const y = tip.y + Math.sin(a) * d + oy
    const size = st.size * (st.kind === 'sparkle' ? 0.6 + r2 : 1) * (1 - p * 0.5)
    drop(ctx, x, y, size, a, st.tint)
  }
  ctx.globalAlpha = 1
}

/** Башня в шуточном скине. Основание — в точке башни, кончик смотрит на цель */
export function drawLolTower(
  ctx: CanvasRenderingContext2D, tw: Tower, def: TowerDefinition,
  time: number, hovered: boolean
) {
  const s = 0.85 + 0.07 * tw.level // уровень = размер
  const sinceShot = time - tw.lastShotAt
  const recoil = sinceShot >= 0 && sinceShot < 0.15 ? 1 - sinceShot / 0.15 : 0
  const len = (24 - recoil * 4) * s // отдача — короче на миг
  const wobble = Math.sin(time * 3 + tw.id) * 0.06
  const angle = tw.aim + Math.PI / 2 + wobble // вверх по локальной оси = к цели

  // тень
  ctx.beginPath()
  ctx.ellipse(tw.x, tw.y + 6, 16 * s, 6 * s, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fill()

  ctx.save()
  ctx.translate(tw.x, tw.y)
  ctx.rotate(angle)
  const outline = hovered ? '#ffd700' : 'rgba(60,30,20,0.7)'
  ctx.lineWidth = hovered ? 2 : 1.4
  ctx.strokeStyle = outline

  // основание
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(side * 7 * s, 5 * s, 7.5 * s, 0, Math.PI * 2)
    ctx.fillStyle = SKIN_DARK
    ctx.fill()
    ctx.stroke()
  }
  // ствол
  const w = 11 * s
  ctx.beginPath()
  ctx.roundRect(-w / 2, -len, w, len + 4 * s, w / 2)
  ctx.fillStyle = SKIN
  ctx.fill()
  ctx.stroke()
  // у слитых — латунное кольцо
  if (def.merged) {
    ctx.fillStyle = '#e8c170'
    ctx.fillRect(-w / 2, -len * 0.45, w, 3 * s)
  }
  // головка — цвет типа атаки
  ctx.beginPath()
  ctx.ellipse(0, -len - 2 * s, 7.5 * s, 6.5 * s, 0, 0, Math.PI * 2)
  ctx.fillStyle = def.color
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -len - 8 * s)
  ctx.lineTo(0, -len - 5 * s)
  ctx.strokeStyle = 'rgba(60,30,20,0.6)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()

  // значок башни у основания (без поворота, чтобы читался)
  ctx.font = '11px "Segoe UI Emoji","Noto Color Emoji",sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(def.glyph, tw.x, tw.y + 16 * s)
  ctx.textBaseline = 'alphabetic'

  // брызги из кончика
  const tipD = len + 9 * s
  const tip = {
    x: tw.x + Math.cos(angle - Math.PI / 2) * tipD,
    y: tw.y + Math.sin(angle - Math.PI / 2) * tipD,
  }
  drawSquirt(ctx, tw, def, tip, time)
}

/** Снаряд в шуточном скине — капля вместо стрелы/ядра */
export function drawLolProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, angle: number) {
  const r = pr.kind === 'rock' ? 5 : pr.kind === 'orb' ? 3.6 : pr.kind === 'hammer' ? 4 : 2.6
  drop(ctx, pr.x, pr.y, r, angle, pr.fromAvatar ? '#e8c170' : DROP)
}
