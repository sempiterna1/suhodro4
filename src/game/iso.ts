// Изометрическая камера «Железного Разлома».
// Игра считает всё в координатах поля MAP_W×MAP_H (клетка CELL = 40) — движок, кооп и тесты
// о камере не знают. Здесь поле поворачивается на 45° и сплющивается вдвое: клетка становится
// ромбом 48×24 экранных пикселя, а поле — большим ромбом, вписанным в холст того же размера.
// Вокруг ромба остаются углы холста — там лес, скалы и город.

import { CELL, MAP_H, MAP_W } from './config'
import type { Vec } from './types'

/** Ромб клетки на экране */
export const ISO_TW = 48
export const ISO_TH = 24
/** Верхний угол поля (клетка 0,0): ромб вписан в холст MAP_W×MAP_H с полями по краям */
export const ISO_OX = (MAP_W - (MAP_W - MAP_H) * (ISO_TW / 2 / CELL)) / 2
export const ISO_OY = (MAP_H - (MAP_W + MAP_H) * (ISO_TH / 2 / CELL)) / 2

const KX = ISO_TW / 2 / CELL // 0.6
const KY = ISO_TH / 2 / CELL // 0.3

/** Точка поля → точка экрана (холст 960×600) */
export function toScreen(x: number, y: number): Vec {
  return { x: ISO_OX + (x - y) * KX, y: ISO_OY + (x + y) * KY }
}

/** Точка экрана → точка поля (на земле) */
export function toWorld(sx: number, sy: number): Vec {
  const u = (sx - ISO_OX) / KX
  const v = (sy - ISO_OY) / KY
  return { x: (u + v) / 2, y: (v - u) / 2 }
}

export function insideField(p: Vec) {
  return p.x >= 0 && p.y >= 0 && p.x < MAP_W && p.y < MAP_H
}

/**
 * Построить путь на земле: fn рисует контур в координатах поля (дуги, прямоугольники, линии),
 * а после выхода матрица возвращается — fill/stroke идут уже в экранных пикселях,
 * поэтому толщина линий не сплющивается.
 */
export function groundPath(ctx: CanvasRenderingContext2D, fn: () => void) {
  ctx.save()
  ctx.transform(KX, KY, -KX, KY, ISO_OX, ISO_OY)
  ctx.beginPath()
  fn()
  ctx.restore()
}

/** Экранное направление для направления в поле (единичный вектор) */
export function screenDir(dx: number, dy: number): Vec {
  const sx = (dx - dy) * KX
  const sy = (dx + dy) * KY
  const l = Math.hypot(sx, sy) || 1
  return { x: sx / l, y: sy / l }
}
