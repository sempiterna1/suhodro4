// Облики врагов в стимпанк-стиле — машины пробудившегося ИИ.
// Цвет корпуса = тип брони (ARMOR_COLORS), чтобы броня читалась с одного взгляда;
// силуэт и анимация — свои у каждого вида. Всё рисуется кодом, без картинок.

import { ARMOR_COLORS } from './config'
import type { Creep, Vec } from './types'

const OUTLINE = 'rgba(20,12,6,0.85)'
const BRASS = '#c9a25a'
const DARK = '#6e5e48' // «тёмный металл» — светлее пола карты (#2b2115), иначе лапы и колёса пропадают
const EYE = '#ff5a3c'

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke = true) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.4
    ctx.stroke()
  }
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number) {
  const glow = 0.6 + 0.4 * Math.sin(time * 6)
  circle(ctx, x, y, r * 1.6, `rgba(255,90,60,${0.18 * glow})`, false)
  circle(ctx, x, y, r, EYE, false)
  circle(ctx, x + r * 0.3, y - r * 0.3, r * 0.35, '#ffd0c0', false)
}

/** Пар из трубы — три клубка, уплывают назад */
function steam(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const t = (time * 1.4 + i / 3 + seed * 0.37) % 1
    ctx.globalAlpha = 0.45 * (1 - t)
    circle(ctx, x - t * r * 2.2, y - t * r * 0.6, r * (0.3 + t * 0.5), '#d8d2c4', false)
  }
  ctx.globalAlpha = 1
}

function rivets(ctx: CanvasRenderingContext2D, r: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    circle(ctx, Math.cos(a) * r, Math.sin(a) * r, 1.1, BRASS, false)
  }
}

/**
 * Тело врага. Локальная система: +x — направление движения.
 * stunned — механизм «заклинило»: ноги и колёса не двигаются.
 */
export function drawCreepBody(
  ctx: CanvasRenderingContext2D, c: Creep, p: Vec, heading: number, time: number, stunned: boolean
) {
  const s = c.size
  const t = stunned ? 0 : time
  const body = ARMOR_COLORS[c.armor]
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(heading)

  switch (c.kind) {
    case 'scuttler': {
      // паровой паук: круглый котёл на шести суставчатых лапах
      ctx.strokeStyle = '#9a8566'
      ctx.lineWidth = 1.8
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1
        const k = (i % 3) - 1
        const swing = Math.sin(t * 16 + i * 2.1) * 0.35
        const ax = k * s * 0.55
        ctx.beginPath()
        ctx.moveTo(ax, 0)
        ctx.lineTo(ax + Math.cos(swing) * s * 0.4, side * s * 0.95)
        ctx.lineTo(ax + s * 0.3 + Math.sin(swing) * s * 0.3, side * s * 1.35)
        ctx.stroke()
      }
      circle(ctx, 0, 0, s * 0.8, body)
      circle(ctx, -s * 0.35, 0, s * 0.3, BRASS) // труба
      steam(ctx, -s * 0.45, 0, s * 0.5, t, c.uid)
      eye(ctx, s * 0.45, 0, s * 0.18, time)
      break
    }
    case 'swarm': {
      // заводной жук: панцирь из двух створок, трепещущие крылья, ключ сзади
      const flap = Math.sin(t * 40) * 0.25
      ctx.globalAlpha = 0.5
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.ellipse(-s * 0.1, side * s * 0.75, s * 0.7, s * 0.35, side * (0.5 + flap), 0, Math.PI * 2)
        ctx.fillStyle = '#e8e2d0'
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, s, s * 0.75, 0, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.4
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(-s, 0)
      ctx.lineTo(s * 0.55, 0) // шов между створками
      ctx.stroke()
      ctx.save()
      ctx.translate(-s * 1.05, 0)
      ctx.rotate(t * 6)
      ctx.fillStyle = BRASS
      ctx.fillRect(-1, -s * 0.45, 2, s * 0.9) // заводной ключ
      ctx.restore()
      eye(ctx, s * 0.65, 0, s * 0.16, time)
      break
    }
    case 'trooper': {
      // заводной пехотинец (вид сверху): плечи-наплечники, шлем, крутящийся ключ на спине
      const step = Math.sin(t * 10) * s * 0.25
      circle(ctx, step, -s * 0.55, s * 0.28, DARK) // ноги
      circle(ctx, -step, s * 0.55, s * 0.28, DARK)
      ctx.beginPath()
      ctx.roundRect(-s * 0.6, -s * 0.85, s * 1.1, s * 1.7, s * 0.35)
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.4
      ctx.stroke()
      circle(ctx, s * 0.15, 0, s * 0.45, '#8c8f94') // шлем
      ctx.save()
      ctx.translate(-s * 0.75, 0)
      ctx.rotate(t * 5)
      ctx.fillStyle = BRASS
      ctx.fillRect(-1.2, -s * 0.5, 2.4, s)
      ctx.fillRect(-s * 0.3, -1.2, s * 0.6, 2.4)
      ctx.restore()
      eye(ctx, s * 0.45, 0, s * 0.14, time)
      break
    }
    case 'rider': {
      // паровой наездник: вытянутый байк-котёл на двух колёсах, выхлоп сзади
      for (const wx of [-s * 0.75, s * 0.75]) {
        ctx.save()
        ctx.translate(wx, 0)
        ctx.rotate(t * 14)
        circle(ctx, 0, 0, s * 0.42, DARK)
        ctx.strokeStyle = BRASS
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(-s * 0.4, 0)
        ctx.lineTo(s * 0.4, 0)
        ctx.moveTo(0, -s * 0.4)
        ctx.lineTo(0, s * 0.4)
        ctx.stroke()
        ctx.restore()
      }
      ctx.beginPath()
      ctx.roundRect(-s * 0.8, -s * 0.38, s * 1.6, s * 0.76, s * 0.3)
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.4
      ctx.stroke()
      circle(ctx, 0, 0, s * 0.32, '#5c5348') // наездник
      steam(ctx, -s * 0.95, 0, s * 0.5, t, c.uid)
      eye(ctx, s * 0.7, 0, s * 0.13, time)
      break
    }
    case 'juggernaut': {
      // котельный латник: квадратный бронекорпус, клёпки, две дымовые трубы
      ctx.beginPath()
      ctx.roundRect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7, s * 0.25)
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1.8
      ctx.stroke()
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(-s * 0.85, -s * 0.15, s * 1.7, s * 0.3) // броневой пояс
      for (const [x, y] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) circle(ctx, x * s, y * s, 1.3, BRASS, false)
      for (const side of [-1, 1]) {
        circle(ctx, -s * 0.45, side * s * 0.4, s * 0.2, BRASS)
        steam(ctx, -s * 0.5, side * s * 0.4, s * 0.45, t, c.uid + side)
      }
      ctx.fillStyle = DARK
      ctx.fillRect(s * 0.45, -s * 0.35, s * 0.3, s * 0.7) // смотровая щель
      eye(ctx, s * 0.6, 0, s * 0.13, time)
      break
    }
    case 'golem': {
      // клёпаный голем: массивный корпус, светящаяся топка, руки-поршни
      const pump = Math.sin(t * 6) * s * 0.15
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.roundRect(-s * 0.2 + pump * side, side * s * 0.75 - s * 0.22, s * 0.9, s * 0.44, s * 0.15)
        ctx.fillStyle = '#5c5f64'
        ctx.fill()
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
      circle(ctx, 0, 0, s * 0.85, body)
      rivets(ctx, s * 0.68, 10)
      const fire = 0.6 + 0.4 * Math.sin(time * 9 + c.uid)
      circle(ctx, -s * 0.05, 0, s * 0.34, `rgba(255,${120 + 60 * fire},40,0.95)`) // топка
      circle(ctx, -s * 0.05, 0, s * 0.55, `rgba(255,140,40,${0.18 * fire})`, false)
      eye(ctx, s * 0.55, 0, s * 0.12, time)
      break
    }
    case 'rift':
    case 'wisp': {
      // порождения Разлома: кристалл из вращающихся осколков / искра с хвостом
      const n = c.kind === 'rift' ? 5 : 3
      const spin = time * (c.kind === 'rift' ? 1.5 : 4)
      circle(ctx, 0, 0, s * 1.05, 'rgba(122,168,116,0.18)', false)
      if (c.kind === 'wisp') {
        for (let i = 1; i <= 4; i++) circle(ctx, -i * s * 0.45, Math.sin(time * 8 + i) * 2, s * (0.5 - i * 0.09), 'rgba(160,230,150,0.35)', false)
      }
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2
        ctx.save()
        ctx.rotate(a)
        ctx.beginPath()
        ctx.moveTo(s * 0.2, 0)
        ctx.lineTo(s * 0.55, -s * 0.22)
        ctx.lineTo(s * 0.95, 0)
        ctx.lineTo(s * 0.55, s * 0.22)
        ctx.closePath()
        ctx.fillStyle = body
        ctx.fill()
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 1.1
        ctx.stroke()
        ctx.restore()
      }
      circle(ctx, 0, 0, s * 0.35, '#dfffd0')
      eye(ctx, 0, 0, s * 0.14, time)
      break
    }
    case 'titan': {
      // Титан-ИИ: шестигранный бронекорпус, вращающийся венец шестерён, огромный красный глаз
      ctx.save()
      ctx.rotate(time * 0.6)
      ctx.fillStyle = '#7a5c34'
      for (let i = 0; i < 12; i++) {
        ctx.save()
        ctx.rotate((i / 12) * Math.PI * 2)
        ctx.fillRect(s * 0.95, -s * 0.09, s * 0.22, s * 0.18)
        ctx.restore()
      }
      ctx.restore()
      ctx.beginPath()
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        if (k === 0) ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s)
        else ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s)
      }
      ctx.closePath()
      ctx.fillStyle = body
      ctx.fill()
      ctx.strokeStyle = '#3a1010'
      ctx.lineWidth = 2.5
      ctx.stroke()
      rivets(ctx, s * 0.78, 12)
      for (const side of [-1, 1]) {
        circle(ctx, -s * 0.5, side * s * 0.5, s * 0.16, BRASS)
        steam(ctx, -s * 0.55, side * s * 0.5, s * 0.5, time, c.uid + side)
      }
      circle(ctx, s * 0.1, 0, s * 0.42, DARK)
      eye(ctx, s * 0.1, 0, s * 0.26, time)
      break
    }
  }
  ctx.restore()
}
