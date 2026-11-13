// Мир вокруг тропы в изометрии: земля запекается в один холст по зерну карты; у каждой карты —
// свой биом (biomes.ts): палитра земли, материал настила, утёс, озеро, мелочи на грунте, наборы
// пропсов, частицы и цвет сумрака. Деревья, скалы, дома, генератор, стены и фонари — спрайты-
// «пропсы», которые рисуются каждый кадр вместе с башнями и врагами, отсортированные по глубине.
// Внутри поля пропсы стоят на свободных клетках и прячутся, когда на клетку ставят башню.
// Вход и выход тропы — на разных кромках у каждой карты: портал Разлома стоит за кромкой входа,
// лагерь беженцев с паровой базой — за кромкой выхода, частокол с воротами — вдоль этой кромки.

import { CELL, MAP_H, MAP_W } from './config'
import { ASSETS, asset, drawAsset, type AssetName } from './assets'
import { drawLongShadow } from './shadows'
import { crispDraw } from './pixelart'
import { ISO_OX, ISO_TW, toScreen, toWorld } from './iso'
import type { GameMap } from './map'
import { GRID_H, GRID_W, cellCenter } from './map'
import { mapDefBySeed } from './data/maps'
import { biomeOf, type BiomeDef, type PropEntry, type RGB, type RoadStyle } from './biomes'
import { radioMast, steamBase, watchtower, wreck, type Baked } from './machines'
import { swayAt, windAt, windPath } from './wind'
import type { Vec } from './types'

const CLIFF = 30 // высота утёса под передним краем поля, экранные пиксели

/** Цвета обочин настила: верх вала и низ, по материалу дороги */
const ROAD_BANK: Record<RoadStyle, { hi: RGB; lo: RGB }> = {
  wood: { hi: [204, 216, 232], lo: [170, 184, 206] }, // снежные валы
  bogwood: { hi: [76, 86, 64], lo: [56, 64, 48] }, // кочки и мох
  stone: { hi: [152, 140, 122], lo: [112, 100, 88] }, // щебень
  gravel: { hi: [92, 82, 66], lo: [66, 58, 50] }, // отвалы породы
  ice: { hi: [216, 228, 244], lo: [180, 194, 214] }, // снежные валы
  ash: { hi: [108, 102, 110], lo: [78, 72, 80] }, // пепел
}

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Светящиеся места карты: освещение читает их каждый кадр (экранные координаты) */
export interface MapLight {
  x: number
  y: number
  kind: 'lantern' | 'furnace' | 'crystal' | 'portal' | 'gate' | 'generator' | 'window' | 'beacon' | 'chimney' | 'search'
  seed: number
  gx?: number // у прожектора — точка на земле под ним
  gy?: number
}
export const mapLights: MapLight[] = []

/** Пропс: спрайт опорой в точку экрана; cell — клетка поля, на которой он стоит (прячется под башней) */
export interface Prop {
  name: AssetName | 'crystal' | 'baked' | 'fire' // crystal — друза минерала, fire — костёр (рисуются процедурно); baked — постройка (machines.ts)
  baked?: Baked
  x: number
  y: number
  s: number
  flip?: boolean
  cell?: string
}
export const props: Prop[] = []

/** Где начинается и кончается дорога (экран) — для портала Разлома и надписей.
 *  entry2/exit2 — второй выход (GDD): заполняются, когда он открыт (withSecond) */
export const roadEnds = {
  entry: { x: 0, y: 0 },
  exit: { x: 0, y: 0 },
  entry2: { x: 0, y: 0 },
  exit2: { x: 0, y: 0 },
  /** Генератор главного здания в лагере (экранная точка основания) */
  camp: { x: 0, y: 0 },
}

/** Экранная глубина точки под передним левым краем поля (y = MAP_H); <0 — над краем */
function belowFrontEdge(sx: number, sy: number) {
  const x = (sx - ISO_OX) / (ISO_TW / 2 / CELL) + MAP_H
  if (x < -20 || x > MAP_W + 4) return -1
  return sy - toScreen(x, MAP_H).y
}

// ─── Кромки поля: вход и выход тропы ─────────────────────────────────────
type Edge = 'W' | 'E' | 'N' | 'S'

/** Кромка входа: куда смотрит первый шаг тропы */
function entryEdgeOf(cells: { cx: number; cy: number }[]): Edge {
  const a = cells[0]
  const b = cells[1]
  if (b.cx > a.cx) return 'W'
  if (b.cx < a.cx) return 'E'
  return b.cy > a.cy ? 'N' : 'S'
}

/** Кромка выхода: куда смотрит последний шаг тропы */
function exitEdgeOf(cells: { cx: number; cy: number }[]): Edge {
  const a = cells[cells.length - 2]
  const b = cells[cells.length - 1]
  if (b.cx > a.cx) return 'E'
  if (b.cx < a.cx) return 'W'
  return b.cy > a.cy ? 'S' : 'N'
}

/** Точка поля на кромке, где тропу пересекает граница (центр мира) */
function edgePoint(edge: Edge, line: number): Vec {
  if (edge === 'W') return { x: 0, y: line * CELL + CELL / 2 }
  if (edge === 'E') return { x: MAP_W, y: line * CELL + CELL / 2 }
  if (edge === 'N') return { x: line * CELL + CELL / 2, y: 0 }
  return { x: line * CELL + CELL / 2, y: MAP_H }
}

/** Наружная нормаль кромки — куда продолжается тропа за поле */
const OUT_DIR: Record<Edge, Vec> = { W: { x: -1, y: 0 }, E: { x: 1, y: 0 }, N: { x: 0, y: -1 }, S: { x: 0, y: 1 } }

/** Взвешенный выбор записи пропсов из набора биома (веса в наборе относительные) */
function pickProp(list: PropEntry[], roll: number): PropEntry | null {
  let total = 0
  for (const e of list) total += e.w
  if (total <= 0) return null
  let x = roll * total
  for (const e of list) {
    x -= e.w
    if (x <= 0) return e
  }
  return list[list.length - 1]
}

// ─── Земля ───────────────────────────────────────────────────────────────
/** withSecond — запечь и вторую тропу (GDD «Второй выход» открылся) */
export function buildBackground(map: GameMap, withSecond = false): HTMLCanvasElement {
  mapLights.length = 0
  props.length = 0
  shadowLayer = null
  const W = MAP_W
  const H = MAP_H
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const L = cv.getContext('2d')!
  const seed = map.seed + 17
  const B: BiomeDef = biomeOf(mapDefBySeed(map.seed).biome)
  const second = withSecond && map.cells2 ? map.cells2 : null
  const onPath = new Set(map.cells.map((c) => c.cx + ',' + c.cy))
  if (second) for (const c of second) onPath.add(c.cx + ',' + c.cy)
  const first = map.cells[0]
  const last = map.cells[map.cells.length - 1]
  const first2 = second ? second[0] : null
  const last2 = second ? second[second.length - 1] : null
  // кромки входа и выхода — у каждой карты свои (не всегда слева направо)
  const inEdge = entryEdgeOf(map.cells)
  const outEdge = exitEdgeOf(map.cells)
  const inEdge2 = first2 && second ? entryEdgeOf(second) : null
  const outEdge2 = last2 && second ? exitEdgeOf(second) : null
  const entryP = cellCenter(first)
  const exitP = cellCenter(last)
  const inDir = { x: Math.sign(map.cells[1].cx - first.cx), y: Math.sign(map.cells[1].cy - first.cy) }
  const outDir = { x: Math.sign(last.cx - map.cells[map.cells.length - 2].cx), y: Math.sign(last.cy - map.cells[map.cells.length - 2].cy) }
  const exitLine = outEdge === 'W' || outEdge === 'E' ? last.cy : last.cx
  const exit2Line = last2 && outEdge2 === outEdge ? (outEdge === 'W' || outEdge === 'E' ? last2.cy : last2.cx) : null
  roadEnds.entry2 = { x: 0, y: 0 }
  roadEnds.exit2 = { x: 0, y: 0 }
  /** Коридор к воротам — не застраивать домами и кострами (у второй тропы свои ворота там же) */
  const nearGate = (wx: number, wy: number, pad: number) => {
    const c = outEdge === 'W' || outEdge === 'E' ? wy : wx
    if (Math.abs(c - (exitLine * CELL + CELL / 2)) < pad) return true
    return exit2Line !== null && Math.abs(c - (exit2Line * CELL + CELL / 2)) < pad
  }

  /** Дороги за краем поля: продолжение тропы за каждую кромку входа/выхода */
  const arms: { edge: Edge; line: number }[] = [
    { edge: inEdge, line: inEdge === 'W' || inEdge === 'E' ? first.cy : first.cx },
    { edge: outEdge, line: exitLine },
  ]
  if (first2 && inEdge2) arms.push({ edge: inEdge2, line: inEdge2 === 'W' || inEdge2 === 'E' ? first2.cy : first2.cx })
  if (last2 && outEdge2) arms.push({ edge: outEdge2, line: outEdge2 === 'W' || outEdge2 === 'E' ? last2.cy : last2.cx })

  /** Клетка дороги? Внутри поля — клетки тропы, за краем — продолжения входов/выходов */
  const road = (cx: number, cy: number) => {
    if (cx < 0) return arms.some((a) => a.edge === 'W' && a.line === cy)
    if (cx >= GRID_W) return arms.some((a) => a.edge === 'E' && a.line === cy)
    if (cy < 0) return arms.some((a) => a.edge === 'N' && a.line === cx)
    if (cy >= GRID_H) return arms.some((a) => a.edge === 'S' && a.line === cx)
    return onPath.has(cx + ',' + cy)
  }

  /** Точка мира у дороги за краем поля (для отсева леса и расстановки фонарей) */
  const nearArm = (wx: number, wy: number, pad: number) =>
    arms.some((a) => {
      const line = a.line * CELL + CELL / 2
      if (a.edge === 'W') return wx < 0 && Math.abs(wy - line) < pad
      if (a.edge === 'E') return wx > MAP_W && Math.abs(wy - line) < pad
      if (a.edge === 'N') return wy < 0 && Math.abs(wx - line) < pad
      return wy > MAP_H && Math.abs(wx - line) < pad
    })

  /** Портал Разлома за кромкой входа; у южного входа — ниже кромки утёса, в низине */
  const portalW: Vec = inEdge === 'W' ? { x: -70, y: entryP.y }
    : inEdge === 'E' ? { x: MAP_W + 70, y: entryP.y }
    : inEdge === 'N' ? { x: entryP.x, y: -90 }
    : { x: entryP.x, y: MAP_H + 120 }

  /** Рамка лагеря: зона построек за кромкой выхода (мировые координаты) */
  const campBox = outEdge === 'E' ? { x0: MAP_W + 8, x1: MAP_W + 460, y0: -20, y1: MAP_H + 20 }
    : outEdge === 'W' ? { x0: -460, x1: -8, y0: -20, y1: MAP_H + 20 }
    : outEdge === 'N' ? { x0: 20, x1: MAP_W - 20, y0: -300, y1: -8 }
    : { x0: 20, x1: MAP_W - 20, y0: MAP_H + 130, y1: MAP_H + 340 }
  const inCamp = (wx: number, wy: number) => wx >= campBox.x0 && wx <= campBox.x1 && wy >= campBox.y0 && wy <= campBox.y1

  // расстояние каждой клетки до тропы (в шагах по клеткам): декор — не ближе 2, крупный — от 3
  const dist = new Map<string, number>()
  let front = [...onPath]
  for (const k of front) dist.set(k, 0)
  for (let d = 1; front.length; d++) {
    const next: string[] = []
    for (const k of front) {
      const [x, y] = k.split(',').map(Number)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = x + dx + ',' + (y + dy)
        if (x + dx < 0 || y + dy < 0 || x + dx >= GRID_W || y + dy >= GRID_H || dist.has(nk)) continue
        dist.set(nk, d)
        next.push(nk)
      }
    }
    front = next
  }
  const far = (cx: number, cy: number) => dist.get(cx + ',' + cy) ?? 0

  // заражение: от портала Разлома по земле расползается живой минерал — серо-зелёная корка и светящиеся жилы
  const rift = portalW
  const infection = (wx: number, wy: number) => {
    const d = Math.hypot(wx - rift.x, (wy - rift.y) * 1.3)
    const n = hash(Math.floor(wx / 40), Math.floor(wy / 40), seed + 61)
    return Math.max(0, Math.min(1, (270 - d) / 220)) ** 1.4 * (0.5 + 0.5 * n)
  }
  const infect = (c: [number, number, number], wx: number, wy: number, k: number): [number, number, number] => {
    if (k <= 0.05) return c
    // жилы — пересечение двух изогнутых волн; ближе к Разлому толще и ярче
    const f = Math.sin(wx * 0.045 + 2.3 * Math.sin(wy * 0.031)) * Math.sin(wy * 0.052 + 1.7 * Math.sin(wx * 0.027))
    if (Math.abs(f) < 0.025 + k * 0.03) return k > 0.45 ? [74, 150, 122] : [58, 104, 100]
    const t = k * 0.5
    return [c[0] + (52 - c[0]) * t, c[1] + (78 - c[1]) * t, c[2] + (90 - c[2]) * t]
  }

  // водоём — на самом дальнем от тропы и от портала месте поля: замёрзшее озеро или болото
  let lake: { x: number; y: number; rx: number; ry: number } | null = null
  if (B.lake !== 'none') {
    let best = 2
    for (const [k, d] of dist) {
      const [x, y] = k.split(',').map(Number)
      const wx = x * CELL + CELL / 2
      const wy = y * CELL + CELL / 2
      const score = d + hash(x, y, seed + 13) * 0.5
      // озеро целиком на поле, не у самого края
      const inside = wx > 70 && wy > 56 && wx < MAP_W - 70 && wy < MAP_H - 56
      if (d >= 3 && inside && infection(wx, wy) < 0.1 && score > best) {
        best = score
        lake = { x: wx, y: wy, rx: 46, ry: 34 }
      }
    }
  }
  const inLake = (wx: number, wy: number, pad = 0) =>
    !!lake && ((wx - lake.x) / (lake.rx + pad)) ** 2 + ((wy - lake.y) / (lake.ry + pad)) ** 2 < 1

  // ─── Рваная кромка арены и вода за ней ──────────────────────────────────
  // Поле — остров: кромка дрожит гладким шумом (мысы и заливы), за ней мокрый
  // берег, вода биома с рябью и бликами, дальше — тёмная низина. У причалов
  // тропы (портал, ворота и лагерь) воды нет — там каменная суши.
  const WALL_W = 50 // толщина южной стены утёса в мировых единицах (30 экранных px)
  const SHORE_W = 14 // ширина мокрого берега за кромкой
  const vnoise = (x: number, s: number) => {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return hash(i, 0, s) * (1 - u) + hash(i + 1, 0, s) * u
  }
  /** Смещение рваной кромки: наружу до +40 (мыс), внутрь до −8 — поле не поддаётся воде */
  const edgeJit = (e: Edge, along: number) => {
    const s = seed + 301 + e.charCodeAt(0) * 17
    const n = vnoise(along / 300, s) * 0.72 + vnoise(along / 90, s + 11) * 0.28 - 0.5
    return n > 0 ? n * 80 : n * 16
  }
  /** Глубина воды за кромкой: заливы и мысы по шуму */
  const waterLen = (e: Edge, along: number) => 60 + vnoise(along / 210, seed + 500 + e.charCodeAt(0) * 23) * 120
  /** Рваное расстояние до кромки арены: >0 — на поле, ≤0 — за кромкой (edge — какая ближе) */
  const beyondEdge = (wx: number, wy: number) => {
    const dw = wx + edgeJit('W', wy)
    const de = MAP_W - wx + edgeJit('E', wy)
    const dn = wy + edgeJit('N', wx)
    const ds = MAP_H - wy + edgeJit('S', wx)
    const d = Math.min(dw, de, dn, ds)
    return { d, edge: (dw === d ? 'W' : de === d ? 'E' : dn === d ? 'N' : 'S') as Edge }
  }
  /** Точка в воде за кромкой (shore — и на мокром берегу): лес и мелочи грунта туда не ставим */
  const inOuterWater = (wx: number, wy: number, shore = false) => {
    const b = beyondEdge(wx, wy)
    if (b.d > 0 || inCamp(wx, wy) || nearArm(wx, wy, 120)) return false
    const base = (b.edge === 'S' ? WALL_W : 0) + (shore ? 0 : SHORE_W)
    const along = b.edge === 'W' || b.edge === 'E' ? wy : wx
    return b.d <= -base && b.d > -(base + waterLen(b.edge, along))
  }
  /** Палитра воды за кромкой по водоёму биома; none — смоляная вода с зеленцой минерала */
  const WSTYLE = B.lake === 'frozen'
    ? { foam: [214, 228, 244] as RGB, shallow: [120, 156, 190] as RGB, deep: [40, 62, 90] as RGB, glint: [224, 238, 252] as RGB }
    : B.lake === 'bog'
      ? { foam: [126, 138, 108] as RGB, shallow: [58, 74, 56] as RGB, deep: [30, 40, 34] as RGB, glint: [146, 160, 122] as RGB }
      : { foam: [104, 148, 126] as RGB, shallow: [46, 66, 70] as RGB, deep: [22, 32, 40] as RGB, glint: [112, 172, 142] as RGB }

  // попиксельно по блокам 2×2: так земля остаётся «пиксельной», как на референсе
  const img = L.createImageData(W, H)
  const put = (bx: number, by: number, c: [number, number, number], k = 1) => {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const i = ((by * 2 + dy) * W + bx * 2 + dx) * 4
        img.data[i] = c[0] * k
        img.data[i + 1] = c[1] * k
        img.data[i + 2] = c[2] * k
        img.data[i + 3] = 255
      }
    }
  }
  for (let by = 0; by < H / 2; by++) {
    for (let bx = 0; bx < W / 2; bx++) {
      const sx = bx * 2 + 1
      const sy = by * 2 + 1
      const w = toWorld(sx, sy)
      const cx = Math.floor(w.x / CELL)
      const cy = Math.floor(w.y / CELL)
      const dith = hash(bx, by, seed + 9)
      // настил тропы: и на поле, и за краем (у южного входа/выхода — рез-овраг сквозь утёс)
      if (road(cx, cy)) {
        const u = w.x - cx * CELL
        const v = w.y - cy * CELL
        const hor = road(cx - 1, cy) || road(cx + 1, cy)
        const across = hor ? v : u // координата поперёк дороги 0..40
        const along = hor ? u : v // вдоль дороги
        let c: RGB = [40, 34, 28] // тёмная подбивка под настилом
        const seam = across % 10 < 1.7
        if (B.road === 'wood') {
          // деревянный настил тракта: доски поперёк хода, швы, снежная пыль
          if (seam) c = [54, 42, 34]
          else {
            const woodN = hash(Math.floor(across / 10) + cx * 7 + cy * 13, Math.floor(along / 13), seed + 8)
            const tones: RGB[] = [[188, 150, 102], [168, 130, 86], [200, 162, 112], [154, 118, 76]]
            c = tones[Math.floor(woodN * tones.length)]
            if (hash(Math.floor(w.x / 3), Math.floor(w.y / 3), seed + 9) > 0.86) c = [c[0] - 18, c[1] - 15, c[2] - 10] // зерно
            if (hash(Math.floor(w.x / 5), Math.floor(w.y / 5), seed + 32) > 0.91) c = [212, 222, 236] // снежная пыль
          }
        } else if (B.road === 'bogwood') {
          // старый настил по болоту: тёмные доски, между ними сочится мох
          if (seam) c = [38, 32, 26]
          else {
            const woodN = hash(Math.floor(across / 10) + cx * 7 + cy * 13, Math.floor(along / 13), seed + 8)
            const tones: RGB[] = [[118, 100, 78], [98, 84, 66], [130, 110, 86], [88, 76, 60]]
            c = tones[Math.floor(woodN * tones.length)]
            if (hash(Math.floor(w.x / 4), Math.floor(w.y / 4), seed + 9) > 0.9) c = [76, 90, 58] // мох
          }
        } else if (B.road === 'stone') {
          // каменные плиты моста: крупные квадры поперёк хода, тёмные швы и щербины
          const slab = across % 14 < 2.2
          if (slab) c = [46, 40, 34]
          else {
            const slabN = hash(Math.floor(across / 14) + cx * 11 + cy * 3, Math.floor(along / 16), seed + 8)
            const tones: RGB[] = [[128, 116, 100], [112, 102, 88], [140, 128, 110], [100, 92, 80]]
            c = tones[Math.floor(slabN * tones.length)]
            if (hash(Math.floor(w.x / 3), Math.floor(w.y / 3), seed + 9) > 0.88) c = [82, 74, 64] // щербинка
          }
        } else if (B.road === 'gravel') {
          // укатанный гравий шахтёрской дороги с галькой
          const n = hash(Math.floor(w.x / 6), Math.floor(w.y / 6), seed + 8)
          const tones: RGB[] = [[72, 62, 52], [62, 54, 46], [80, 68, 56], [56, 48, 42]]
          c = tones[Math.floor(n * tones.length)]
          if (hash(Math.floor(w.x / 2.5), Math.floor(w.y / 2.5), seed + 9) > 0.93) c = [96, 84, 70] // галька
        } else if (B.road === 'ice') {
          // укатанный снежно-ледяной наст перевала: блестит полосами вдоль хода
          const n = hash(Math.floor(w.x / 9), Math.floor(w.y / 9), seed + 8)
          const tones: RGB[] = [[196, 208, 226], [182, 196, 216], [208, 220, 236], [172, 186, 208]]
          c = tones[Math.floor(n * tones.length)]
          if (Math.sin(along * 0.35 + across * 0.2) > 0.86) c = [228, 238, 250] // ледяной отблеск
        } else {
          // пепельный рез долины: тёмный шлак, из трещин сочится зелень минерала
          const n = hash(Math.floor(w.x / 7), Math.floor(w.y / 7), seed + 8)
          const tones: RGB[] = [[64, 58, 62], [56, 50, 54], [72, 64, 68], [48, 44, 48]]
          c = tones[Math.floor(n * tones.length)]
          if (hash(Math.floor(w.x / 4), Math.floor(w.y / 4), seed + 9) > 0.92) c = [58, 96, 78] // жилы минерала
        }
        if (dith < 0.03) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.82]
        // обочины: у стороны, где соседа-дороги нет
        const edgeD = Math.min(
          road(cx - 1, cy) ? 99 : u,
          road(cx + 1, cy) ? 99 : CELL - u,
          road(cx, cy - 1) ? 99 : v,
          road(cx, cy + 1) ? 99 : CELL - v,
        )
        const bank = 4 + hash(Math.floor(w.x / 5), Math.floor(w.y / 5), seed + 31) * 4
        const bankC = ROAD_BANK[B.road]
        if (edgeD < bank) c = edgeD < bank * 0.45 ? bankC.hi : bankC.lo
        else if (edgeD < bank + 3) c = [c[0] * 0.76, c[1] * 0.78, c[2] * 0.86]
        put(bx, by, infect(c, w.x, w.y, infection(w.x, w.y) * 0.6))
        continue
      }

      // ─── За рваной кромкой: стена утёса (юг), мокрый берег, вода, низина ──
      const be = beyondEdge(w.x, w.y)
      if (be.d <= 0) {
        const eDist = -be.d // насколько за рваным силуэтом (мировые единицы)
        const south = be.edge === 'S'
        const wallBase = south ? WALL_W : 0
        const along = be.edge === 'W' || be.edge === 'E' ? w.y : w.x
        const dry = inCamp(w.x, w.y) || nearArm(w.x, w.y, 120) // у причалов и лагеря воды нет
        let c: RGB
        if (south && eDist < WALL_W) {
          // стена утёса следует рваному силуэту: снежная шапка, порода с прожилками, к низу темнее
          const capTop = 3 + Math.floor(hash(bx >> 1, 7, seed) * 5)
          if (eDist * 0.6 < capTop) c = eDist * 0.6 < 2 ? B.cliff.cap : B.cliff.capDeep
          else {
            const streak = hash(bx, Math.floor((eDist / WALL_W) * 5), seed + 3)
            const tone = streak > 0.75 ? B.cliff.face[0] : streak > 0.4 ? B.cliff.face[1] : B.cliff.face[2]
            c = dith > 0.94 ? B.cliff.streak : tone
            if (eDist > WALL_W * 0.8) c = [c[0] * 0.85, c[1] * 0.85, c[2] * 0.9]
          }
        } else if (eDist < wallBase + SHORE_W) {
          // мокрый берег: тёмная земля; у самой воды — светлая кромка пены
          const n = hash(Math.floor(w.x / 9), Math.floor(w.y / 9), seed)
          const big = hash(Math.floor(w.x / 50), Math.floor(w.y / 50), seed + 3)
          const pal = B.ground.lowland
          c = pal[Math.floor((n * 0.5 + big * 0.5) * pal.length) % pal.length]
          c = [c[0] * 0.5, c[1] * 0.54, c[2] * 0.62]
          if (eDist > wallBase + SHORE_W - 4.5 && dith > 0.4) c = WSTYLE.foam
        } else if (!dry && eDist < wallBase + SHORE_W + waterLen(be.edge, along)) {
          // вода: рябь из двух волн; у берега светлее (отражает небо), в глубину темнеет
          const rip = Math.sin(w.x * 0.11 + Math.sin(w.y * 0.05) * 2.6) * Math.sin(w.y * 0.07 - w.x * 0.023 + 1.1)
          const shoreK = 1 - Math.min(1, Math.max(0, (eDist - wallBase - SHORE_W) / Math.max(24, waterLen(be.edge, along))))
          const mix = Math.min(1, Math.max(0, rip * 0.5 + 0.28)) * shoreK
          c = [
            WSTYLE.deep[0] + (WSTYLE.shallow[0] - WSTYLE.deep[0]) * mix,
            WSTYLE.deep[1] + (WSTYLE.shallow[1] - WSTYLE.deep[1]) * mix,
            WSTYLE.deep[2] + (WSTYLE.shallow[2] - WSTYLE.deep[2]) * mix,
          ]
          if (dith > 0.968 || (rip > 0.8 && dith > 0.4)) c = WSTYLE.glint
        } else {
          // тёмная низина за водой и каменная суша у причалов
          const n = hash(Math.floor(w.x / 9), Math.floor(w.y / 9), seed)
          const big = hash(Math.floor(w.x / 50), Math.floor(w.y / 50), seed + 3)
          c = B.ground.lowland[Math.floor((n * 0.5 + big * 0.5) * B.ground.lowland.length) % B.ground.lowland.length]
          if (dith > 0.985) c = B.ground.dithHi
          else if (dith < 0.012) c = B.ground.dithLo
          // утоптанный грунт вокруг лагеря беженцев
          if (inCamp(w.x, w.y) && hash(Math.floor(w.x / 14), Math.floor(w.y / 14), seed + 5) > 1 - B.camp.trample) c = B.camp.dirt
        }
        put(bx, by, infect(c, w.x, w.y, infection(w.x, w.y)))
        continue
      }

      // ─── Поле-остров: светлая земля; пятна идут ромбами по сетке мира ─────
      const n = hash(Math.floor(w.x / 9), Math.floor(w.y / 9), seed)
      const big = hash(Math.floor(w.x / 50), Math.floor(w.y / 50), seed + 3)
      let c = B.ground.plateau[Math.floor((n * 0.5 + big * 0.5) * B.ground.plateau.length) % B.ground.plateau.length]
      if (dith > 0.985) c = B.ground.dithHi
      else if (dith < 0.012) c = B.ground.dithLo
      // сырой тёмный ободок у самой кромки — береговой панцирь
      if (be.d < 7) c = [c[0] * 0.82, c[1] * 0.85, c[2] * 0.92]
      // вода: замёрзшее озеро с трещинами или мутное болото; по краю — кромка
      if (lake && inLake(w.x, w.y, 6)) {
        const e = ((w.x - lake.x) / lake.rx) ** 2 + ((w.y - lake.y) / lake.ry) ** 2
        if (e > 1) c = B.lake === 'bog' ? [96, 100, 80] : [196, 208, 226]
        else if (B.lake === 'bog') {
          const rn = hash(Math.floor(w.x / 8), Math.floor(w.y / 8), seed + 21)
          c = rn > 0.8 ? [58, 74, 54] : rn > 0.4 ? [42, 56, 46] : [34, 46, 40] // тёмная вода с рябью
          if (dith > 0.97) c = [76, 92, 68]
        } else {
          const cr = Math.abs(Math.sin(w.x * 0.11 + Math.sin(w.y * 0.07) * 3) * Math.sin(w.y * 0.09 + w.x * 0.02))
          c = cr < 0.05 ? [150, 186, 214] : e < 0.5 ? [64, 98, 136] : [80, 116, 152]
          if (dith > 0.97) c = [214, 232, 248]
        }
      }
      put(bx, by, infect(c, w.x, w.y, infection(w.x, w.y)))
    }
  }
  L.putImageData(img, 0, 0)
  groundDetails(L, seed, (cx, cy) => road(cx, cy), inLake, B, (x, y) => inOuterWater(x, y, true))

  // ─── Пропсы ───────────────────────────────────────────────────────────
  let rs = (seed * 2654435761) >>> 0
  const r = () => {
    rs = (Math.imul(rs ^ (rs >>> 15), 2246822519) + 0x9e3779b9) >>> 0
    return rs / 4294967296
  }
  const add = (name: Prop['name'], wx: number, wy: number, s: number, extra: Partial<Prop> = {}) => {
    const p = toScreen(wx, wy)
    props.push({ name, x: p.x, y: p.y, s, ...extra })
    return p
  }
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]

  // декор на поле — подальше от тропы, чтобы не занимать лучшие места под башни:
  // в 1 клетке от тропы мелочи биома, в 2 — редкие, от 3 — постройки, костры и рощи.
  // Наборы берутся из биома карты (biomes.ts): тайга — ели и сани, болото — сухостой,
  // ущелье — скалы, пустошь — обломки и шлак.
  let tower = false
  let crash = false
  let huts = 0
  let fires = 0
  /** Поставить пропс из записи набора: имя случайно из списка, масштаб из диапазона */
  const place = (e: PropEntry, x: number, y: number, cell?: string) => {
    const s = e.s ? e.s[0] + r() * (e.s[1] - e.s[0]) : 0.2 + r() * 0.08
    const p = add(e.names[Math.floor(r() * e.names.length)], x, y, s, {
      flip: e.flip ? r() > 0.5 : false,
      ...(cell ? { cell } : {}),
    })
    if (e.light === 'lantern') mapLights.push({ x: p.x, y: p.y - 26, kind: 'lantern', seed: Math.floor(x * 3 + y) })
    else if (e.light === 'window') mapLights.push({ x: p.x, y: p.y - 14, kind: 'window', seed: Math.floor(x + y) })
    return p
  }
  for (let cx = 0; cx < GRID_W; cx++) {
    for (let cy = 0; cy < GRID_H; cy++) {
      const d = far(cx, cy)
      if (d < 1) continue
      if (d === 1) {
        const roll1 = hash(cx, cy, seed + 131)
        const ox = cx * CELL + CELL / 2 + (hash(cx, cy, seed + 7) - 0.5) * 18
        const oy = cy * CELL + CELL / 2 + (hash(cx, cy, seed + 8) - 0.5) * 18
        if (infection(ox, oy) > 0.35 || inLake(ox, oy, 8)) continue
        if (roll1 < 0.13) {
          const e = pickProp(B.props.near, roll1 / 0.13)
          if (e) place(e, ox, oy, cx + ',' + cy)
        }
        continue
      }
      const roll = hash(cx, cy, seed + 101)
      const wx = cx * CELL + CELL / 2 + (hash(cx, cy, seed + 5) - 0.5) * 14
      const wy = cy * CELL + CELL / 2 + (hash(cx, cy, seed + 6) - 0.5) * 14
      if (inLake(wx, wy, 12)) continue
      const cell = cx + ',' + cy
      // у Разлома лес уже мёртв: друзы минерала и сухие деревья вместо елей (лор — на всех картах)
      if (infection(wx, wy) > 0.35) {
        if (roll < 0.35) {
          const p = add('crystal', wx, wy, 0.55 + hash(cx, cy, 9) * 0.4, { cell })
          mapLights.push({ x: p.x, y: p.y - 10, kind: 'crystal', seed: cx * 7 + cy })
        } else if (roll < 0.5) add('prop-deadtree', wx, wy, 0.3, { flip: r() > 0.5, cell })
        continue
      }
      if (d === 2) {
        if (roll < 0.2) {
          const e = pickProp(B.props.mid, roll / 0.2)
          if (e) place(e, wx, wy, cell)
        }
        continue
      }
      // дальняя зона: одна вышка с прожектором, обломки вездехода, костры и хижины биома,
      // остальное — дальний набор; у scatter свой бросок зерна
      const roll3 = hash(cx, cy, seed + 205)
      if (B.props.tower && !tower && roll < 0.08) {
        tower = true
        const p = add('baked', wx, wy, 0.75, { baked: watchtower(), cell })
        mapLights.push({ x: p.x, y: p.y - 46, kind: 'window', seed: cx })
        // прожектор вышки шарит лучом по полю
        mapLights.push({ x: p.x + 2, y: p.y - 50, kind: 'search', seed: cx, gx: p.x, gy: p.y })
      } else if (fires < B.props.fires && roll > 0.7 && roll < 0.74) {
        fires++
        const p = add('fire', wx, wy, 1, { cell })
        mapLights.push({ x: p.x, y: p.y - 6, kind: 'furnace', seed: cx * 5 + cy })
      } else if (B.props.wreck && !crash && roll < 0.14) {
        crash = true
        add('baked', wx, wy, 0.7, { baked: wreck(), cell })
      } else if (huts < B.props.huts && roll > 0.2 && roll < 0.42) {
        huts++
        const name = pick<AssetName>(B.props.hutPool)
        const p = add(name, wx, wy, 0.36, { flip: r() > 0.5, cell })
        mapLights.push({ x: p.x, y: p.y - 12, kind: name === 'prop-tent' ? 'furnace' : 'window', seed: cx * 3 + cy })
      } else if (roll3 < 0.42) {
        const e = pickProp(B.props.far, roll3 / 0.42)
        if (e) place(e, wx, wy, cell)
      }
    }
  }

  // ─── Лагерь беженцев за кромкой выхода ─────────────────────────────────
  // Сердце паровой базы — генератор; вокруг палатки, лазарет, мастерская и склад, сани и ящики;
  // частокол с воротами у дороги. Лагерь всегда зимний — беженцы тащат свой снег за собой (лор),
  // но стоит он за кромкой выхода, а она у каждой карты своя: вся геометрия — от ворот (gateW).
  const outV = OUT_DIR[outEdge]
  const perp = outV.x !== 0 ? { x: 0, y: 1 } : { x: 1, y: 0 } // поперёк дороги
  const inV = OUT_DIR[inEdge]
  const perpIn = inV.x !== 0 ? { x: 0, y: 1 } : { x: 1, y: 0 }
  const gateW = edgePoint(outEdge, exitLine)
  const genW: Vec = outEdge === 'E' ? { x: MAP_W + 120, y: Math.round(MAP_H * 0.55) }
    : outEdge === 'W' ? { x: -120, y: Math.round(MAP_H * 0.55) }
    : { x: Math.round(MAP_W * 0.5), y: -150 }
  const gen = add('bld-generator', genW.x, genW.y, 0.72)
  roadEnds.camp = { x: gen.x, y: gen.y }
  mapLights.push({ x: gen.x, y: gen.y - 58, kind: 'generator', seed: 7 })
  const houses: AssetName[] = ['prop-tent', 'bld-medical', 'prop-tent', 'bld-workshop', 'prop-cabin', 'prop-tent', 'bld-heater', 'prop-shed', 'bld-depot']
  const placed: { x: number; y: number }[] = [{ x: genW.x, y: genW.y }]
  const visible = (p: { x: number; y: number }, mx = 30, my = 12) => p.x > mx && p.x < W - mx && p.y > my && p.y < H - my
  // паровая база стоит рядом с генератором: на ней беженцы идут дальше (лор GDD)
  const spots: [number, number][] = []
  for (let by = campBox.y0 + 20; by < campBox.y1; by += 20)
    for (let bx = campBox.x0 + 20; bx < campBox.x1; bx += 20) spots.push([bx, by])
  // ближе к генератору и ниже к зрителю — там её не загораживают дома
  const want = (q: [number, number]) => {
    const sp = toScreen(q[0], q[1])
    return Math.abs(sp.x - gen.x) + Math.abs(sp.y - gen.y) * 0.6 + (H - sp.y) * 0.3
  }
  spots.sort((a, b) => want(a) - want(b))
  for (const [bx, by] of spots) {
    const p = toScreen(bx, by)
    if (!visible(p, 40, 20)) continue
    if (nearGate(bx, by, 70) || Math.hypot(bx - genW.x, by - genW.y) < 130) continue
    const sc = 0.6
    const base = steamBase()
    add('baked', bx, by, sc, { baked: base })
    // дым из каждой трубы базы
    base.smoke.forEach(([dx, dy], i) => mapLights.push({ ...bakedPoint(p, sc, base, dx, dy), kind: 'chimney', seed: 30 + i }))
    placed.push({ x: bx, y: by }, { x: bx + 40, y: by }, { x: bx - 30, y: by })
    mapLights.push({ x: p.x - 10, y: p.y - 26, kind: 'window', seed: 12 })
    break
  }
  // радиомачта лагеря: через неё выходит на связь ИИ
  for (const [mx, my] of [[campBox.x0 + 50, campBox.y0 + 90], [campBox.x0 + 50, campBox.y1 - 40], [campBox.x0 + 80, campBox.y0 + 40]] as [number, number][]) {
    const p = toScreen(mx, my)
    if (!visible(p, 30, 10) || nearGate(mx, my, 50) || placed.some((q) => Math.hypot(q.x - mx, q.y - my) < 50)) continue
    const mast = radioMast()
    add('baked', mx, my, 0.8, { baked: mast })
    placed.push({ x: mx, y: my })
    mapLights.push({ ...bakedPoint(p, 0.8, mast, mast.smoke[0][0], mast.smoke[0][1]), kind: 'beacon', seed: 0 })
    break
  }
  let hi = Math.floor(r() * houses.length)
  for (let by = campBox.y0 + 30; by < campBox.y1 - 20; by += 58) {
    for (let bx = campBox.x0 + 50; bx < campBox.x1 - 20; bx += 64) {
      const x = bx + (r() - 0.5) * 20
      const y = by + (r() - 0.5) * 20
      const p = toScreen(x, y)
      if (!visible(p, 30, 10)) continue
      if (nearGate(x, y, 48)) continue
      if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 70)) continue
      placed.push({ x, y })
      const name = houses[hi++ % houses.length]
      const sp = add(name, x, y, name.startsWith('prop') ? 0.42 : 0.5, { flip: r() > 0.5 })
      mapLights.push({ x: sp.x, y: sp.y - 16, kind: 'window', seed: Math.floor(x + y) })
    }
  }
  // костры лагеря: вокруг них греются беженцы
  for (let i = 0, made = 0; i < 40 && made < 2; i++) {
    const x = campBox.x0 + 60 + r() * Math.max(40, campBox.x1 - campBox.x0 - 120)
    const y = campBox.y0 + 60 + r() * Math.max(40, campBox.y1 - campBox.y0 - 120)
    const p = toScreen(x, y)
    if (!visible(p, 40, 16) || nearGate(x, y, 40)) continue
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 50)) continue
    placed.push({ x, y })
    add('fire', x, y, 1)
    mapLights.push({ x: p.x, y: p.y - 6, kind: 'furnace', seed: 40 + i })
    made++
  }
  // скарб беженцев между палатками
  for (let i = 0, made = 0; i < 60 && made < 10; i++) {
    const x = campBox.x0 + 40 + r() * Math.max(40, campBox.x1 - campBox.x0 - 80)
    const y = campBox.y0 + 40 + r() * Math.max(40, campBox.y1 - campBox.y0 - 80)
    const p = toScreen(x, y)
    if (!visible(p, 25, 8) || nearGate(x, y, 30)) continue
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 34)) continue
    placed.push({ x, y })
    made++
    const name = pick<AssetName>(['prop-crate', 'prop-barrel', 'prop-crates', 'prop-sled', 'prop-box', 'prop-lamp'])
    const sp = add(name, x, y, 0.3, { flip: r() > 0.5 })
    if (name === 'prop-lamp') mapLights.push({ x: sp.x, y: sp.y - 22, kind: 'lantern', seed: i })
  }
  // фонари вдоль дорог за краем поля — тропа к Разлому и к воротам освещена
  const roadLamp = (x: number, y: number, i: number) => {
    const p = toScreen(x, y)
    if (!visible(p, 8, 20)) return
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 30)) return
    placed.push({ x, y })
    add('prop-lamp2', x, y, 0.32)
    mapLights.push({ x: p.x, y: p.y - 30, kind: 'lantern', seed: 60 + i })
  }
  // за воротами — вдоль дороги к лагерю, за порталом — вдоль дороги к Разлому (чередуем стороны)
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 30 : -30
    roadLamp(gateW.x + outV.x * (50 + i * 80) + perp.x * side, gateW.y + outV.y * (50 + i * 80) + perp.y * side, i)
  }
  for (let i = 0; i < 3; i++) {
    const side = i % 2 ? 32 : -32
    roadLamp(entryP.x + inV.x * (140 + i * 90) + perpIn.x * side, entryP.y + inV.y * (140 + i * 90) + perpIn.y * side, 10 + i)
  }
  // частокол вдоль кромки выхода, разрыв — ворота; у ворот фонари-башенки
  const wallX = outEdge === 'E' ? MAP_W + 18 : outEdge === 'W' ? -18 : null
  const wallY = outEdge === 'N' ? -18 : outEdge === 'S' ? MAP_H + 18 : null
  if (wallX !== null) {
    for (let y = 26; y < MAP_H; y += 48) {
      if (nearGate(wallX, y, 60)) continue
      add('bld-wall', wallX, y, 0.5, { flip: true })
    }
  } else {
    for (let x = 26; x < MAP_W; x += 48) {
      if (nearGate(x, wallY ?? 0, 60)) continue
      add('bld-wall', x, wallY ?? 0, 0.5, { flip: true })
    }
  }
  const gateTower = (t: number, line: number) => {
    const q = wallX !== null
      ? { x: wallX, y: line * CELL + CELL / 2 + t }
      : { x: line * CELL + CELL / 2 + t, y: wallY ?? 0 }
    const p = add('prop-lamptower', q.x, q.y, 0.36)
    mapLights.push({ x: p.x, y: p.y - 36, kind: 'gate', seed: t })
  }
  for (const t of [-44, 44]) gateTower(t, exitLine)
  roadEnds.exit = toScreen(gateW.x, gateW.y)
  // второй выход: свои ворота в стене, фонари-башенки и дорога к лагерю
  if (exit2Line !== null) {
    for (const t of [-44, 44]) gateTower(t, exit2Line)
    const gate2W = edgePoint(outEdge, exit2Line)
    for (let i = 0; i < 2; i++) {
      const side = i % 2 ? 30 : -30
      roadLamp(gate2W.x + outV.x * (50 + i * 80) + perp.x * side, gate2W.y + outV.y * (50 + i * 80) + perp.y * side, 20 + i)
    }
    roadEnds.exit2 = toScreen(gate2W.x, gate2W.y)
  }

  // лес за задними краями и в низине под утёсом: выборка по экрану, частая сетка с дрожанием.
  // Не растёт на поле, в лагере и на дорогах к порталу и воротам; состав — из дикой зоны биома.
  for (let sy = -6; sy < H + 30; sy += 13) {
    for (let sx = -10; sx < W + 10; sx += 15) {
      const x = sx + (r() - 0.5) * 12
      const y = sy + (r() - 0.5) * 8
      const w = toWorld(x, y)
      if (w.x >= -8 && w.y >= -8 && w.x < MAP_W + 8 && w.y < MAP_H + 8) continue // поле
      if (inCamp(w.x, w.y)) continue // лагерь беженцев
      if (inOuterWater(w.x, w.y, true)) continue // лес не растёт в воде и на мокром берегу
      if (nearArm(w.x, w.y, 46)) continue // дороги к порталу и к воротам
      if (w.y >= MAP_H) {
        const d = belowFrontEdge(x, y)
        if (d >= 0 && d < CLIFF + 6) continue // на утёсе
      }
      // поляны: крупный шум по экрану прореживает лес, чтобы он не сливался в ковёр
      const dense = hash(Math.floor(x / 90), Math.floor(y / 70), seed + 77)
      const roll = r() / (0.55 + dense * 0.6)
      if (infection(w.x, w.y) > 0.35) {
        // мёртвый лес у Разлома: редкие друзы среди мёртвых деревьев (лор — на всех картах)
        if (roll < 0.07) {
          props.push({ name: 'crystal', x, y, s: 0.4 + r() * 0.3 })
          if (r() < 0.3) mapLights.push({ x, y: y - 10, kind: 'crystal', seed: Math.floor(x) })
        } else if (roll < 0.3) props.push({ name: 'prop-deadtree', x, y, s: 0.3 + r() * 0.1, flip: r() > 0.5 })
        else if (roll < 0.52) props.push({ name: 'prop-pine', x, y, s: 0.3 + r() * 0.14, flip: r() > 0.5 })
        else if (roll < 0.58) props.push({ name: 'prop-rock', x, y, s: 0.24, flip: r() > 0.5 })
        continue
      }
      // дикий лес биома: тайга — ели, болото — сухостой, ущелье — скалы, пустошь — обломки
      const e = pickProp(B.props.wild, r())
      if (e && roll < 0.66) {
        props.push({
          name: e.names[Math.floor(r() * e.names.length)],
          x, y,
          s: e.s ? e.s[0] + r() * (e.s[1] - e.s[0]) : 0.28 + r() * 0.12,
          flip: e.flip ? r() > 0.5 : false,
        })
      }
    }
  }

  // вход: портал Разлома за кромкой входа, рядом лагерь разведчиков
  roadEnds.entry = toScreen(portalW.x, portalW.y)
  mapLights.push({ x: roadEnds.entry.x, y: roadEnds.entry.y - 16, kind: 'portal', seed: 1 })
  const scoutW = { x: entryP.x + inV.x * 40 + perpIn.x * 70, y: entryP.y + inV.y * 40 + perpIn.y * 70 }
  const camp = toScreen(scoutW.x, scoutW.y)
  if (camp.x > 10 && camp.y > 30 && camp.x < W - 10 && camp.y < H - 6) {
    props.push({ name: 'prop-tent', x: camp.x, y: camp.y, s: 0.36 })
    mapLights.push({ x: camp.x, y: camp.y - 12, kind: 'furnace', seed: 3 })
  }
  // второй портал Разлома (Пепельная долина) — над северной кромкой
  if (first2 && map.points2) {
    const e2 = map.points2[0]
    roadEnds.entry2 = toScreen(e2.x, e2.y - 44)
    mapLights.push({ x: roadEnds.entry2.x, y: roadEnds.entry2.y - 16, kind: 'portal', seed: 2 })
  }

  // мягкая виньетка по краям — у каждого биома свой цвет сумрака
  const g = L.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62)
  g.addColorStop(0, B.vignette.replace(/,\s*[\d.]+\)$/, ',0)'))
  g.addColorStop(1, B.vignette)
  L.fillStyle = g
  L.fillRect(0, 0, W, H)

  props.sort((a, b) => a.y - b.y)
  return cv
}

/**
 * Костёр: каменное кольцо, поленья, языки пламени (мерцают и клонятся по ветру), искры.
 */
function drawFire(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const seed = Math.floor(x * 3 + y)
  const wnd = windAt(t)
  ctx.save()
  // кольцо камней и угли
  ctx.fillStyle = 'rgba(14,22,52,0.4)'
  ctx.beginPath()
  ctx.ellipse(x + 2, y + 1, 13, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const sx = x + Math.cos(a) * 10
    const sy = y + Math.sin(a) * 4
    ctx.fillStyle = '#0b0e14'
    ctx.fillRect(sx - 2.5, sy - 2.5, 5, 4)
    ctx.fillStyle = i % 2 ? '#5d6576' : '#4a5262'
    ctx.fillRect(sx - 2, sy - 2, 4, 3)
    ctx.fillStyle = '#c9d6e6'
    ctx.fillRect(sx - 2, sy - 2.5, 3, 1)
  }
  ctx.fillStyle = '#3a1a0c'
  ctx.fillRect(x - 6, y - 2, 12, 3)
  ctx.fillStyle = '#ff6a1a'
  ctx.fillRect(x - 4, y - 1, 8, 1)
  // поленья крест-накрест
  ctx.strokeStyle = '#4e3828'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(x - 7, y + 1); ctx.lineTo(x + 5, y - 4)
  ctx.moveTo(x + 7, y + 1); ctx.lineTo(x - 5, y - 4)
  ctx.stroke()
  // языки пламени: три слоя, верхушки гнутся по ветру
  const tongue = (dx: number, h: number, w: number, col: string, ph: number) => {
    const fl = h * (0.75 + 0.25 * Math.sin(t * 11 + ph + seed) + 0.1 * Math.sin(t * 23 + ph * 2))
    const lean = wnd * 3 + Math.sin(t * 6 + ph) * 1.5
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.moveTo(x + dx - w, y - 1)
    ctx.quadraticCurveTo(x + dx - w * 0.6 + lean * 0.4, y - fl * 0.6, x + dx + lean, y - fl)
    ctx.quadraticCurveTo(x + dx + w * 0.6 + lean * 0.4, y - fl * 0.6, x + dx + w, y - 1)
    ctx.fill()
  }
  for (const [dx, ph] of [[-3, 0], [3, 2], [0, 4]]) tongue(dx, 16, 4.5, '#ff6a1a', ph)
  for (const [dx, ph] of [[-2, 1], [2, 3]]) tongue(dx, 11, 3, '#ffb347', ph)
  tongue(0, 7, 2, '#fff0b0', 5)
  // искры поднимаются и уносятся ветром
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.7 + i / 6 + seed * 0.07) % 1
    const sx = x + Math.sin(i * 2.3 + t * 3) * 3 + p * p * 26 * wnd
    const sy = y - 8 - p * 34
    ctx.fillStyle = `rgba(255,${180 - p * 80},80,${1 - p})`
    ctx.fillRect(sx, sy, 2, 2)
  }
  ctx.restore()
}

let shadowLayer: HTMLCanvasElement | null = null

/**
 * Длинные тени всех построек и деревьев — один холст на карту: собирается, когда загружены все
 * картинки, и дальше только накладывается. Под башнями-клетками тени не исчезают (это мелочь).
 */
export function drawPropShadows(ctx: CanvasRenderingContext2D) {
  if (!shadowLayer) {
    const imgs: { p: Prop; img: CanvasImageSource & { width: number; height: number }; ax: number; k: number; dy: number }[] = []
    for (const p of props) {
      if (p.name === 'crystal' || p.name === 'fire') continue
      if (p.name === 'baked') {
        const b = p.baked!
        imgs.push({ p, img: b.cv, ax: b.ax, k: (p.s * 2) / b.k, dy: 6 })
        continue
      }
      const im = asset(p.name) as (CanvasImageSource & { width: number; height: number }) | null
      if (!im) return // ещё грузится — тени появятся чуть позже
      imgs.push({ p, img: im, ax: ASSETS[p.name].ax, k: p.s, dy: Math.round(ASSETS[p.name].h * p.s * 0.12) })
    }
    // тени — в половинном разрешении: они мягкие, а мир всё равно рисуется в низком холсте
    shadowLayer = document.createElement('canvas')
    shadowLayer.width = MAP_W / 2
    shadowLayer.height = MAP_H / 2
    const c = shadowLayer.getContext('2d')!
    c.scale(0.5, 0.5)
    for (const { p, img, ax, k, dy } of imgs) drawLongShadow(c, img, p.x, p.y + dy - 3, p.flip ? img.width - ax : ax, k, 0.3)
  }
  ctx.drawImage(shadowLayer, 0, 0, MAP_W, MAP_H)
}

/**
 * Мелочи на грунте, вписанные прямо в землю (пиксели 2×2, как у неё): намётенные сугробы,
 * камни, сухая трава, цепочки следов и колея, обломки досок, наст — и породы биома:
 * трещины сухой земли, пепельные бугры, уголь и шлак, галька, ледяные блики.
 * Плоские — места под башни не занимают, поэтому лежат везде, кроме тропы и воды.
 */
function groundDetails(
  L: CanvasRenderingContext2D, seed: number,
  road: (cx: number, cy: number) => boolean, inLake: (x: number, y: number, pad?: number) => boolean,
  B: BiomeDef, inWater: (x: number, y: number) => boolean,
) {
  let rs = (seed * 97 + 13) >>> 0
  const r = () => {
    rs = (Math.imul(rs ^ (rs >>> 15), 2246822519) + 0x9e3779b9) >>> 0
    return rs / 4294967296
  }
  const blk = (x: number, y: number, c: string, w = 2, h = 2) => {
    L.fillStyle = c
    L.fillRect(Math.floor(x / 2) * 2, Math.floor(y / 2) * 2, w, h)
  }
  /** Затемнить hex-цвет (k<1) или осветлить (k>1) */
  const shade = (hex: string, k: number) => {
    const n = parseInt(hex.slice(1), 16)
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    return `rgb(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))})`
  }
  /** Свободный грунт (поле или лес рядом), не дорога и не вода */
  const free = (wx: number, wy: number) => {
    const cx = Math.floor(wx / CELL)
    const cy = Math.floor(wy / CELL)
    if (wx < -60 || wy < -60 || wx > MAP_W + 40 || wy > MAP_H + 10) return false
    return !road(cx, cy) && !inLake(wx, wy, 8) && !inWater(wx, wy)
  }
  const D = B.details
  // сугробы, вытянутые по ветру: светлый верх, тень справа-снизу
  if (D.drifts) {
    const [count, hi, lo] = D.drifts
    for (let i = 0; i < count; i++) {
      const wx = r() * (MAP_W + 80) - 40
      const wy = r() * (MAP_H + 40) - 20
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      const len = 8 + Math.floor(r() * 10)
      for (let k = -len; k <= len; k += 2) {
        const h = Math.round((1 - (k / len) ** 2) * 3)
        for (let j = 0; j <= h; j += 2) blk(p.x + k, p.y - j, j >= h - 1 ? hi : shade(hi, 0.88))
        blk(p.x + k + 2, p.y + 2, lo)
      }
    }
  }
  // камни: тёмные бока, светлая макушка (снежная шапка — только там, где есть снег)
  if (D.boulders) {
    const [count, dark, mid, cap] = D.boulders
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      const n = 1 + Math.floor(r() * 3)
      for (let k = 0; k < n; k++) {
        const x = p.x + k * 4 - 2
        const y = p.y + (k % 2) * 2
        blk(x, y, dark, 4, 4)
        blk(x, y + 2, mid, 2, 2)
        if (cap) {
          blk(x, y - 2, cap, 4, 2)
          blk(x + 4, y + 2, shade(dark, 1.5))
        } else blk(x + 4, y + 2, shade(dark, 1.4))
      }
    }
  }
  // сухая трава из-под снега / жухлые колоски по земле
  if (D.grass) {
    const [count, c1, c2] = D.grass
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      for (let k = 0; k < 3; k++) {
        const x = p.x + k * 2 - 2
        const h = 2 + Math.floor(r() * 3) * 2
        L.fillStyle = k === 1 ? c1 : c2
        L.fillRect(Math.floor(x / 2) * 2, Math.floor((p.y - h) / 2) * 2, 2, h)
      }
    }
  }
  // цепочки следов: кто-то бродил между постройками (пары точек вдоль извилистого пути)
  if (D.tracks) {
    const [count, col] = D.tracks
    for (let t = 0; t < count; t++) {
      let wx = r() * MAP_W
      let wy = r() * MAP_H
      let a = r() * Math.PI * 2
      for (let s = 0; s < 40; s++) {
        a += (r() - 0.5) * 0.5
        wx += Math.cos(a) * 9
        wy += Math.sin(a) * 9
        if (!free(wx, wy)) continue
        const p = toScreen(wx, wy)
        blk(p.x + (s % 2 ? 2 : -2), p.y + (s % 2 ? 0 : 2), col)
      }
    }
  }
  // колея от саней: две параллельные борозды дугой через поле
  if (D.ruts) {
    const [count, col] = D.ruts
    for (let t = 0; t < count; t++) {
      let wx = r() * MAP_W
      let wy = r() * MAP_H
      let a = r() * Math.PI * 2
      for (let s = 0; s < 70; s++) {
        a += Math.sin(s * 0.15 + t) * 0.06
        wx += Math.cos(a) * 4
        wy += Math.sin(a) * 4
        if (!free(wx, wy)) continue
        const nx = -Math.sin(a) * 7
        const ny = Math.cos(a) * 7
        const p1 = toScreen(wx + nx, wy + ny)
        const p2 = toScreen(wx - nx, wy - ny)
        blk(p1.x, p1.y, col)
        blk(p2.x, p2.y, col)
      }
    }
  }
  // обломки досок и брёвна, полузанесённые (налёт — снег или пепел биома)
  if (D.boards) {
    const [count, wood, hi, fleck] = D.boards
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      const dir = r() > 0.5 ? 1 : -1
      for (let k = 0; k < 5; k++) {
        blk(p.x + k * 2 * dir, p.y + k, wood)
        blk(p.x + k * 2 * dir, p.y + k - 2, k % 2 ? hi : fleck ?? shade(wood, 1.25))
      }
    }
  }
  // наст: пятна блестящего снега с искрами (зимние биомы)
  if (D.crust) {
    const [count, hi, lo] = D.crust
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      for (let k = 0; k < 6; k++) blk(p.x + (r() - 0.5) * 20, p.y + (r() - 0.5) * 10, r() > 0.7 ? hi : lo)
    }
  }
  // трещины сухой земли: ломаные тёмные линии со случайным изломом
  if (D.cracks) {
    const [count, col] = D.cracks
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      let dir = r() > 0.5 ? 1 : -1
      for (let k = 0; k < 6 + Math.floor(r() * 10); k++) {
        blk(p.x + k * 2 * dir, p.y + (r() > 0.6 ? 2 : 0), col, 2, 1)
        if (r() > 0.85) dir = -dir
      }
    }
  }
  // пепельные бугры: мягкие холмики со светлым верхом и тенью
  if (D.ash) {
    const [count, hi, lo] = D.ash
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      for (let k = -4; k <= 4; k += 2) {
        const h = Math.round((1 - (k / 4) ** 2) * 2)
        for (let j = 0; j <= h; j += 2) blk(p.x + k, p.y - j, j >= h ? hi : lo)
      }
      blk(p.x + 4, p.y + 2, shade(lo, 0.9))
    }
  }
  // уголь и шлак: тёмные россыпи с редкими блёстками
  if (D.coal) {
    const [count, hi, lo] = D.coal
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      for (let k = 0; k < 4; k++) blk(p.x + (r() - 0.5) * 14, p.y + (r() - 0.5) * 8, r() > 0.8 ? hi : lo)
    }
  }
  // галька и щебень: пары светлых камушков
  if (D.pebbles) {
    const [count, c1, c2] = D.pebbles
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      for (let k = 0; k < 3; k++) blk(p.x + k * 3 - 3, p.y + (k % 2) * 2, k % 2 ? c1 : c2)
    }
  }
  // ледяные блики на камне: холодные полоски света
  if (D.sheen) {
    const [count, hi, lo] = D.sheen
    for (let i = 0; i < count; i++) {
      const wx = r() * MAP_W
      const wy = r() * MAP_H
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      for (let k = 0; k < 5; k++) blk(p.x + (r() - 0.5) * 16, p.y + (r() - 0.5) * 8, r() > 0.6 ? hi : lo, 2, 1)
    }
  }
}

/** Экранная точка внутри дорисованной постройки: (dx, dy) — смещение от опоры в пикселях её картинки */
function bakedPoint(at: { x: number; y: number }, s: number, b: Baked, dx: number, dy: number) {
  const k = (s * 2) / b.k
  return { x: at.x + dx * k, y: at.y + 6 + dy * k }
}

/** Нарисовать пропс (зовётся из общего прохода по глубине) */
export function drawProp(ctx: CanvasRenderingContext2D, p: Prop, t: number) {
  if (p.name === 'crystal') drawCrystal(ctx, p.x, p.y, p.s, t)
  else if (p.name === 'fire') drawFire(ctx, p.x, p.y, t)
  else if (p.name === 'prop-pine' || p.name === 'prop-pines' || p.name === 'prop-deadtree') {
    // деревья гнутся по ветру: сдвиг верхушки, основание стоит на месте
    const k = 0.035 * swayAt(p.x, t) * (p.flip ? -1 : 1) + 0.012 * Math.sin(t * 2.3 + p.x)
    ctx.save()
    ctx.transform(1, 0, p.flip ? -k : k, 1, -(p.flip ? -k : k) * p.y, 0)
    drawAsset(ctx, p.name, p.x, p.y + Math.round(ASSETS[p.name].h * p.s * 0.12), p.s, p.flip)
    ctx.restore()
  }
  else if (p.name === 'baked') {
    // дорисованная постройка: как спрайты листа — уменьшается со сглаживанием
    const b = p.baked!
    const k = (p.s * 2) / b.k
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    crispDraw(ctx, b.cv, p.x - b.ax * k, p.y + 6 - b.ay * k, b.cv.width * k, b.cv.height * k)
    ctx.restore()
  }
  else drawAsset(ctx, p.name, p.x, p.y + Math.round(ASSETS[p.name].h * p.s * 0.12), p.s, p.flip)
}

/**
 * Друза живого минерала: 3–5 граней-осколков, светлая грань к свету, тёмная в тени, тёмный контур;
 * ореол медленно «дышит» — минерал живой.
 */
function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const seed = Math.floor(x * 7 + y * 13)
  const pulse = 0.75 + 0.25 * Math.sin(t * 1.6 + seed)
  ctx.save()
  const g = ctx.createRadialGradient(x, y - 8 * s, 0, x, y - 8 * s, 22 * s)
  g.addColorStop(0, `rgba(90,170,150,${0.2 * pulse})`)
  g.addColorStop(1, 'rgba(90,170,150,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - 22 * s, y - 30 * s, 44 * s, 44 * s)
  ctx.fillStyle = 'rgba(14,22,52,0.4)'
  ctx.beginPath()
  ctx.ellipse(x + 2, y, 11 * s, 4 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  const n = 3 + (seed % 3)
  for (let i = 0; i < n; i++) {
    const k = hash(seed, i, 3)
    const bx = x + (i - (n - 1) / 2) * 5 * s + (k - 0.5) * 3 * s
    const h = (12 + k * 18) * s * (i === Math.floor(n / 2) ? 1.3 : 1)
    const w = Math.max(3, h * 0.3)
    const lean = (i - (n - 1) / 2) * 3 * s
    const tx = bx + lean
    const ty = y - h
    // контур, затем светлая левая грань и тёмная правая
    ctx.fillStyle = '#0e2a1c'
    ctx.beginPath()
    ctx.moveTo(bx - w / 2 - 1, y + 1)
    ctx.lineTo(tx, ty - 2)
    ctx.lineTo(bx + w / 2 + 1, y + 1)
    ctx.fill()
    ctx.fillStyle = '#6fae9c'
    ctx.beginPath()
    ctx.moveTo(bx - w / 2, y)
    ctx.lineTo(tx, ty)
    ctx.lineTo(bx, y)
    ctx.fill()
    ctx.fillStyle = '#2f7a68'
    ctx.beginPath()
    ctx.moveTo(bx, y)
    ctx.lineTo(tx, ty)
    ctx.lineTo(bx + w / 2, y)
    ctx.fill()
    ctx.fillStyle = `rgba(200,235,225,${0.35 * pulse})`
    ctx.fillRect(tx - 1, ty + 2, 2, Math.max(2, h * 0.25))
  }
  ctx.restore()
}

/**
 * Позёмка: струйки низко над землёй бегут по ветру; в порыв — гуще и длиннее.
 * Цвет и сила — от биома (снег, пепел, пыль). Рисуется поверх земли, под постройками и фигурами.
 */
export function drawDrift(ctx: CanvasRenderingContext2D, t: number, color = '230,240,255', k = 1) {
  const W = MAP_W
  const wnd = windAt(t)
  const path = windPath(t)
  const n = Math.round((18 + wnd * 14) * k)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const speed = 60 + (i % 5) * 18
    const len = (24 + (i % 7) * 9) * (0.6 + wnd * 0.5)
    const x = ((((i * 211.7 + path * speed) % (W + 200)) + W + 200) % (W + 200)) - 100
    const y = (i * 97.3) % MAP_H + Math.sin(t * 0.9 + i) * 4
    const a = Math.min(0.32, (0.08 + wnd * 0.1) * k) * (0.6 + 0.4 * Math.sin(t * 1.5 + i * 2.1))
    // струйка — три отрезка: бледный хвост, плотная середина, бледная голова (без градиентов — дёшево)
    ctx.fillStyle = `rgba(${color},${a * 0.4})`
    ctx.fillRect(x - len, y, len * 0.4, 2)
    ctx.fillRect(x - len * 0.15, y, len * 0.15, 2)
    ctx.fillStyle = `rgba(${color},${a})`
    ctx.fillRect(x - len * 0.6, y, len * 0.45, 2)
    ctx.fillRect(x - len * 0.5, y + 3, len * 0.3, 1)
  }
  ctx.restore()
}

/** Портал Разлома: тёмный провал в земле, зелёный водоворот, осколки кристаллов */
export function drawPortal(ctx: CanvasRenderingContext2D, t: number, at: { x: number; y: number } = roadEnds.entry) {
  const { x, y } = at
  ctx.save()
  ctx.fillStyle = 'rgba(8,14,22,0.82)'
  ctx.beginPath()
  ctx.ellipse(x, y, 30, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(96,176,150,${0.32 - i * 0.08})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(x, y, 24 - i * 7, 10 - i * 3, 0, t * (1.5 + i) , t * (1.5 + i) + Math.PI * 1.3)
    ctx.stroke()
  }
  // осколки по краю провала
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3
    const cx = x + Math.cos(a) * 32
    const cy = y + Math.sin(a) * 15
    ctx.fillStyle = i % 2 ? '#2f7a68' : '#5f9c88'
    ctx.beginPath()
    ctx.moveTo(cx - 3, cy)
    ctx.lineTo(cx, cy - 7 - (i % 3) * 2)
    ctx.lineTo(cx + 3, cy)
    ctx.fill()
  }
  ctx.restore()
}
