// Сетка и генерация карты «Железного Разлома».
// Поле 960×600 делится на клетки CELL×CELL. Тропа — цепочка клеток от левого края к правому,
// генерируется по зерну (seed): одно зерно = одна и та же карта у хоста и гостя.
// Башни ставятся по одной на клетку, на клетки тропы строить нельзя.
// На картах со вторым выходом (GDD) есть вторая тропа: до волны открытия она невидима
// и не мешает стройке, после — крипы делятся между тропами поровну.

import { CELL, MAP_H, MAP_W, mapDefBySeed } from './config'
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
  /** Второй выход (GDD): есть у карт с MapDef.secondExitWave */
  cells2?: Cell[]
  points2?: Vec[]
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

/** Ломаная по углам цепочки клеток; вход и выход продолжают крайние отрезки за край карты */
function pointsFromCells(cells: Cell[]): Vec[] {
  const pts: Vec[] = []
  const inDir = { x: Math.sign(cells[1].cx - cells[0].cx), y: Math.sign(cells[1].cy - cells[0].cy) }
  const first = cellCenter(cells[0])
  pts.push({ x: first.x - inDir.x * 50, y: first.y - inDir.y * 50 })
  for (let i = 0; i < cells.length; i++) {
    const prev = cells[i - 1]
    const next = cells[i + 1]
    if (!prev || !next) continue
    const turn = prev.cx - cells[i].cx !== cells[i].cx - next.cx || prev.cy - cells[i].cy !== cells[i].cy - next.cy
    if (turn) pts.push(cellCenter(cells[i]))
  }
  const n = cells.length
  const outDir = { x: Math.sign(cells[n - 1].cx - cells[n - 2].cx), y: Math.sign(cells[n - 1].cy - cells[n - 2].cy) }
  const last = cellCenter(cells[n - 1])
  pts.push({ x: last.x + outDir.x * 50, y: last.y + outDir.y * 50 })
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
// вторая тропа может быть короче: это дополнительная угроза, объявленная заранее
const MIN_CELLS2 = 32
const MAX_CELLS2 = 80

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
    const map: GameMap = { seed, cells, points: pointsFromCells(cells) }
    if (mapDefBySeed(seed).secondExitWave) {
      const cells2 = secondPathCells(seed, cells)
      if (cells2) {
        map.cells2 = cells2
        map.points2 = pointsFromCells(cells2)
      }
    }
    return map
  }
  return CLASSIC_MAP // крайне маловероятно: генератор не уложился в длину
}

/** Клетки тропы и их ортогональные соседи — зона отчуждения вокруг настила */
function blockedAround(cells: Cell[]): Set<string> {
  const s = new Set<string>()
  for (const c of cells) {
    s.add(c.cx + ',' + c.cy)
    s.add(c.cx + 1 + ',' + c.cy)
    s.add(c.cx - 1 + ',' + c.cy)
    s.add(c.cx + ',' + (c.cy + 1))
    s.add(c.cx + ',' + (c.cy - 1))
  }
  return s
}

/** Карта расстояний до клеток тропы (в шагах): для выбора опорных точек подальше от неё */
function distanceMap(primary: Cell[]): Int16Array {
  const d = new Int16Array(GRID_W * GRID_H).fill(-1)
  let front = primary
  for (const c of front) d[c.cy * GRID_W + c.cx] = 0
  let step = 0
  while (front.length) {
    step++
    const next: Cell[] = []
    for (const c of front) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.cx + dx
        const ny = c.cy + dy
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue
        if (d[ny * GRID_W + nx] !== -1) continue
        d[ny * GRID_W + nx] = step
        next.push({ cx: nx, cy: ny })
      }
    }
    front = next
  }
  return d
}

/**
 * Маршрут Дейкстрой: клетки первой тропы непроходимы, клетки вплотную к ней —
 * с большим штрафом (маршрут держится поодаль, но не ломается об их лабиринт).
 */
function dijkstraRoute(from: Cell, to: Cell, primary: Set<string>, dist: Int16Array): Cell[] | null {
  const idx = (c: Cell) => c.cy * GRID_W + c.cx
  const key = (c: Cell) => c.cx + ',' + c.cy
  const cost = new Float64Array(GRID_W * GRID_H).fill(Infinity)
  const prev = new Map<string, string | null>()
  cost[idx(from)] = 0
  prev.set(key(from), null)
  const open: Cell[] = [from]
  while (open.length) {
    // минимальный по стоимости узел (сетка маленькая — линейный поиск достаточен)
    let bi = 0
    for (let i = 1; i < open.length; i++) if (cost[idx(open[i])] < cost[idx(open[bi])]) bi = i
    const cur = open.splice(bi, 1)[0]
    if (cur.cx === to.cx && cur.cy === to.cy) {
      const cells: Cell[] = []
      let k: string | null = key(cur)
      while (k) {
        const [x, y] = k.split(',').map(Number)
        cells.unshift({ cx: x, cy: y })
        k = prev.get(k) ?? null
      }
      return cells
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.cx + dx
      const ny = cur.cy + dy
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue
      if (primary.has(nx + ',' + ny)) continue
      const step = dist[ny * GRID_W + nx] === 1 ? 8 : 1 // прижимание к настилу — дорого
      const nc = cost[idx(cur)] + step
      if (nc < cost[ny * GRID_W + nx]) {
        cost[ny * GRID_W + nx] = nc
        prev.set(nx + ',' + ny, key(cur))
        open.push({ cx: nx, cy: ny })
      }
    }
  }
  return null
}

/**
 * Вторая тропа (GDD «Второй выход»): входит с северной кромки (первая тропа её не
 * использует) и выходит к лагерю на правой кромке. Случайная змейка здесь не годится —
 * лабиринт первой тропы почти всегда перегораживает путь, поэтому маршрут прокладывается
 * Дейкстрой по свободным клеткам через случайные опорные точки: и обход препятствий,
 * и извилистость. null — тропа не строится (карта остаётся с одним выходом).
 */
function secondPathCells(seed: number, primary: Cell[]): Cell[] | null {
  const primarySet = new Set(primary.map((c) => c.cx + ',' + c.cy))
  const dist = distanceMap(primary)
  const free = (cx: number, cy: number) =>
    cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H && !primarySet.has(cx + ',' + cy)
  const far = (cx: number, cy: number) => free(cx, cy) && dist[cy * GRID_W + cx] >= 2
  const rand = mulberry32((seed ^ 0x5f356495) >>> 0)
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))
  for (let attempt = 0; attempt < 120; attempt++) {
    // вход — верхняя кромка, выход — правая; желательно в двух клетках от первой тропы
    let entry: Cell | null = null
    for (let t = 0; t < 10 && !entry; t++) {
      const c = { cx: ri(0, 12), cy: 0 }
      if (t < 9 ? far(c.cx, c.cy) : free(c.cx, c.cy)) entry = c
    }
    let exit: Cell | null = null
    for (let t = 0; t < 10 && !exit; t++) {
      const c = { cx: GRID_W - 1, cy: ri(0, GRID_H - 2) }
      if (t < 9 ? far(c.cx, c.cy) : free(c.cx, c.cy)) exit = c
    }
    if (!entry || !exit) continue
    // опорные точки слева направо, по возможности не в «карманах» у самой тропы;
    // первая — прямо под входом: тропа заходит на поле вертикально, с северной кромки
    const wps: Cell[] = []
    const firstWp = { cx: entry.cx, cy: Math.min(GRID_H - 2, entry.cy + ri(2, 5)) }
    if (free(firstWp.cx, firstWp.cy)) wps.push(firstWp)
    const n = ri(1, 5)
    for (let i = 1; i <= n; i++) {
      let wp: Cell | null = null
      for (let t = 0; t < 8 && !wp; t++) {
        const c = {
          cx: Math.round(((GRID_W - 2) * i) / (n + 1) + (rand() - 0.5) * 4),
          cy: ri(0, GRID_H - 2),
        }
        if (t < 7 ? far(c.cx, c.cy) : free(c.cx, c.cy)) wp = c
      }
      if (wp) wps.push(wp)
    }
    let cells: Cell[] = [entry]
    let cur = entry
    let ok = true
    for (const wp of [...wps, exit]) {
      const seg = dijkstraRoute(cur, wp, primarySet, dist)
      if (!seg) {
        ok = false
        break
      }
      cells = cells.concat(seg.slice(1))
      cur = wp
    }
    if (!ok) continue
    if (cells.length < MIN_CELLS2 || cells.length > MAX_CELLS2) continue
    return cells
  }
  return null
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
interface PathGeom {
  cells: Cell[]
  points: Vec[]
  cellSet: Set<string>
  segLen: number[]
  segStart: number[]
  total: number
}

function geomOf(cells: Cell[], points: Vec[]): PathGeom {
  const segLen: number[] = []
  const segStart: number[] = []
  let acc = 0
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
    segLen.push(len)
    segStart.push(acc)
    acc += len
  }
  return { cells, points, cellSet: new Set(cells.map((c) => c.cx + ',' + c.cy)), segLen, segStart, total: acc }
}

let current: GameMap = CLASSIC_MAP
let paths: PathGeom[] = []
/** Вторая тропа открыта (волна открытия наступила): блокирует клетки и видна на поле */
let secondActive = false

export function setMap(m: GameMap) {
  current = m
  paths = [geomOf(m.cells, m.points)]
  if (m.cells2 && m.points2) paths.push(geomOf(m.cells2, m.points2))
  secondActive = false
}
setMap(CLASSIC_MAP)

export function getMap(): GameMap {
  return current
}

/** Есть ли на карте второй выход (независимо от того, открыт ли он) */
export function hasSecondPath(): boolean {
  return paths.length > 1
}

/** Открыть/закрыть вторую тропу — вызывается движком при смене волны */
export function setSecondPathActive(on: boolean) {
  if (paths.length > 1) secondActive = on
}

export function isSecondPathActive(): boolean {
  return secondActive
}

export function pathLength(idx = 0): number {
  return (paths[idx] ?? paths[0]).total
}

export function isPathCell(c: Cell): boolean {
  if (paths[0].cellSet.has(c.cx + ',' + c.cy)) return true
  return secondActive && !!paths[1]?.cellSet.has(c.cx + ',' + c.cy)
}

export function pointAtLength(d: number, idx = 0): Vec {
  const P = (paths[idx] ?? paths[0]).points
  const g = paths[idx] ?? paths[0]
  if (d <= 0) return { x: P[0].x, y: P[0].y }
  for (let i = 0; i < g.segLen.length; i++) {
    if (d <= g.segStart[i] + g.segLen[i]) {
      const t = (d - g.segStart[i]) / g.segLen[i]
      return { x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t }
    }
  }
  const last = P[P.length - 1]
  return { x: last.x, y: last.y }
}

/** Расстояние от точки до ближайшей активной тропы */
export function distToPath(x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < paths.length; i++) {
    if (i === 1 && !secondActive) break
    const P = paths[i].points
    for (let j = 0; j < P.length - 1; j++) {
      const ax = P[j].x
      const ay = P[j].y
      const bx = P[j + 1].x - ax
      const by = P[j + 1].y - ay
      const len2 = bx * bx + by * by || 1
      const t = Math.max(0, Math.min(1, ((x - ax) * bx + (y - ay) * by) / len2))
      const d = Math.hypot(x - (ax + bx * t), y - (ay + by * t))
      if (d < best) best = d
    }
  }
  return best
}
