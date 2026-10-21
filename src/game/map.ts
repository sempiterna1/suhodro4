// Сетка и генерация карты «Железного Разлома».
// Поле 960×600 делится на клетки CELL×CELL. Тропа — цепочка клеток от левого края к правому,
// генерируется по зерну (seed): одно зерно = одна и та же карта у хоста и гостя.
// Башни ставятся по одной на клетку, на клетки тропы строить нельзя.

import { CELL, MAP_H, MAP_W } from './config'
import type { Vec } from './types'

export const GRID_W = MAP_W / CELL // 24
export const GRID_H = MAP_H / CELL // 15

export interface Cell {
  cx: number
  cy: number
}

export interface GameMap {
  seed: number // 0 — классическая карта прототипа
  cells: Cell[] // клетки тропы по порядку
  points: Vec[] // ломаная тропы для движения крипов (центры клеток-поворотов + выходы за край)
}

export function cellOf(x: number, y: number): Cell {
  return {
    cx: Math.max(0, Math.min(GRID_W - 1, Math.floor(x / CELL))),
    cy: Math.max(0, Math.min(GRID_H - 1, Math.floor(y / CELL))),
  }
}

export function cellCenter(c: Cell): Vec {
  return { x: c.cx * CELL + CELL / 2, y: c.cy * CELL + CELL / 2 }
}

/** Точка → центр её клетки */
export function snapToCell(x: number, y: number): Vec {
  return cellCenter(cellOf(x, y))
}

// ─── Генерация ───────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ломаная по углам цепочки клеток + вход/выход за краем карты */
function pointsFromCells(cells: Cell[]): Vec[] {
  const pts: Vec[] = []
  const first = cellCenter(cells[0])
  pts.push({ x: -30, y: first.y })
  for (let i = 0; i < cells.length; i++) {
    const prev = cells[i - 1]
    const next = cells[i + 1]
    if (!prev || !next) continue
    const turn = prev.cx - cells[i].cx !== cells[i].cx - next.cx || prev.cy - cells[i].cy !== cells[i].cy - next.cy
    if (turn) pts.push(cellCenter(cells[i]))
  }
  const last = cellCenter(cells[cells.length - 1])
  pts.push({ x: MAP_W + 30, y: last.y })
  return pts
}

/** Цепочка клеток по «углам»: от каждого угла до следующего по прямой */
function cellsFromCorners(corners: Cell[]): Cell[] {
  const cells: Cell[] = [corners[0]]
  for (let i = 1; i < corners.length; i++) {
    let { cx, cy } = cells[cells.length - 1]
    const t = corners[i]
    while (cx !== t.cx || cy !== t.cy) {
      cx += Math.sign(t.cx - cx)
      cy += Math.sign(t.cy - cy)
      cells.push({ cx, cy })
    }
  }
  return cells
}

const MIN_CELLS = 44 // тропа не короче (прототип: ~48 клеток)
const MAX_CELLS = 70

/**
 * Карта по зерну. Тропа идёт слева направо «змейкой»: горизонтальные отрезки по 3–6 клеток
 * (между вертикалями остаётся минимум 2 свободных столбца под башни) и вертикальные
 * отрезки по 4–11 клеток, чередуя направление. Не пересекается сама с собой.
 */
export function generateMap(seed: number): GameMap {
  if (seed === 0) return CLASSIC_MAP
  const rand = mulberry32(seed)
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
  for (let attempt = 0; attempt < 200; attempt++) {
    let cy = ri(2, GRID_H - 3)
    const corners: Cell[] = [{ cx: 0, cy }]
    let cx = ri(2, 5)
    corners.push({ cx, cy })
    let dir = cy < GRID_H / 2 ? 1 : -1
    while (cx < GRID_W - 1) {
      // вертикаль: в пределах 1..GRID_H-2, чтобы у краёв оставались клетки под башни
      const room = dir > 0 ? GRID_H - 2 - cy : cy - 1
      if (room >= 4) {
        cy += dir * ri(4, Math.min(11, room))
        corners.push({ cx, cy })
      }
      dir = -dir
      // горизонталь к следующей вертикали или к правому краю
      const step = ri(3, 6)
      cx = Math.min(GRID_W - 1, cx + step)
      if (GRID_W - 1 - cx < 3) cx = GRID_W - 1 // не оставлять огрызок у края
      corners.push({ cx, cy })
    }
    const cells = cellsFromCorners(corners)
    if (cells.length < MIN_CELLS || cells.length > MAX_CELLS) continue
    return { seed, cells, points: pointsFromCells(cells) }
  }
  return CLASSIC_MAP // крайне маловероятно: генератор не уложился в длину
}

/** Классическая змейка прототипа на сетке (зерно 0) — для тестов и как запасная карта */
export const CLASSIC_MAP: GameMap = (() => {
  const cells = cellsFromCorners([
    { cx: 0, cy: 3 }, { cx: 6, cy: 3 }, { cx: 6, cy: 11 }, { cx: 12, cy: 11 },
    { cx: 12, cy: 3 }, { cx: 18, cy: 3 }, { cx: 18, cy: 11 }, { cx: 23, cy: 11 },
  ])
  return { seed: 0, cells, points: pointsFromCells(cells) }
})()

export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 2147483646)
}

// ─── Активная карта (одна на страницу) ───────────────────────────────────
let current: GameMap = CLASSIC_MAP
let pathSet = new Set<string>()
let segLen: number[] = []
let segStart: number[] = []
let totalLen = 0

export function setMap(m: GameMap) {
  current = m
  pathSet = new Set(m.cells.map((c) => c.cx + ',' + c.cy))
  segLen = []
  segStart = []
  let acc = 0
  for (let i = 0; i < m.points.length - 1; i++) {
    const len = Math.hypot(m.points[i + 1].x - m.points[i].x, m.points[i + 1].y - m.points[i].y)
    segLen.push(len)
    segStart.push(acc)
    acc += len
  }
  totalLen = acc
}
setMap(CLASSIC_MAP)

export function getMap(): GameMap {
  return current
}

export function pathLength(): number {
  return totalLen
}

export function isPathCell(c: Cell): boolean {
  return pathSet.has(c.cx + ',' + c.cy)
}

export function pointAtLength(d: number): Vec {
  const P = current.points
  if (d <= 0) return { x: P[0].x, y: P[0].y }
  for (let i = 0; i < segLen.length; i++) {
    if (d <= segStart[i] + segLen[i]) {
      const t = (d - segStart[i]) / segLen[i]
      return { x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t }
    }
  }
  const last = P[P.length - 1]
  return { x: last.x, y: last.y }
}

/** Расстояние от точки до ломаной тропы */
export function distToPath(x: number, y: number): number {
  const P = current.points
  let best = Infinity
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i].x
    const ay = P[i].y
    const bx = P[i + 1].x - ax
    const by = P[i + 1].y - ay
    const len2 = bx * bx + by * by || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / len2))
    const d = Math.hypot(x - (ax + bx * t), y - (ay + by * t))
    if (d < best) best = d
  }
  return best
}
