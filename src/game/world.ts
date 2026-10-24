// Мир вокруг тропы в изометрии: земля (снег, укатанная дорога, утёс, низина) запекается в один
// холст по зерну карты; деревья, скалы, дома, генератор, стены и фонари — спрайты-«пропсы»,
// которые рисуются каждый кадр вместе с башнями и врагами, отсортированные по глубине.
// Внутри поля пропсы стоят на свободных клетках и прячутся, когда на клетку ставят башню.

import { CELL, MAP_H, MAP_W } from './config'
import { ASSETS, asset, drawAsset, type AssetName } from './assets'
import { drawLongShadow } from './shadows'
import { crispDraw } from './pixelart'
import { ISO_OX, ISO_TW, toScreen, toWorld } from './iso'
import type { GameMap } from './map'
import { GRID_H, GRID_W } from './map'
import { radioMast, steamBase, watchtower, wreck, type Baked } from './machines'
import { swayAt, windAt, windPath } from './wind'

// ─── Палитра земли ───────────────────────────────────────────────────────
const SNOW_PLATEAU: [number, number, number][] = [[122, 140, 166], [131, 149, 174], [114, 132, 158], [140, 158, 182], [150, 167, 190]]
const SNOW_LOW: [number, number, number][] = [[92, 108, 134], [99, 116, 142], [86, 101, 127], [106, 123, 149]]
const MUD: [number, number, number][] = [[112, 101, 96], [104, 94, 90], [120, 108, 101], [97, 88, 85]]
const CLIFF = 30 // высота утёса под передним краем поля, экранные пиксели

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

/** Где начинается и кончается дорога (экран) — для портала Разлома и надписей */
export const roadEnds = { entry: { x: 0, y: 0 }, exit: { x: 0, y: 0 } }

/** Экранная глубина точки под передним левым краем поля (y = MAP_H); <0 — над краем */
function belowFrontEdge(sx: number, sy: number) {
  const x = (sx - ISO_OX) / (ISO_TW / 2 / CELL) + MAP_H
  if (x < -20 || x > MAP_W + 4) return -1
  return sy - toScreen(x, MAP_H).y
}

// ─── Земля ───────────────────────────────────────────────────────────────
export function buildBackground(map: GameMap): HTMLCanvasElement {
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
  const onPath = new Set(map.cells.map((c) => c.cx + ',' + c.cy))
  const first = map.cells[0]
  const last = map.cells[map.cells.length - 1]
  const entryY = first.cy * CELL + CELL / 2
  const exitY = last.cy * CELL + CELL / 2

  /** Клетка дороги? Вне поля дорога продолжается от входа влево и от выхода вправо */
  const road = (cx: number, cy: number) => {
    if (cx < 0) return cy === first.cy
    if (cx >= GRID_W) return cy === last.cy && cy >= 0 && cy < GRID_H
    if (cy < 0 || cy >= GRID_H) return false
    return onPath.has(cx + ',' + cy)
  }

  // расстояние каждой клетки до тропы (в шагах по клеткам): декор — не ближе 2, крупный — от 3
  const dist = new Map<string, number>()
  let front = map.cells.map((c) => c.cx + ',' + c.cy)
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

  // заражение: от Разлома по снегу расползается живой минерал — серо-зелёная корка и светящиеся жилы
  const rift = { x: -70, y: entryY }
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

  // замёрзшее озеро — на самом дальнем от тропы и от Разлома месте поля
  let lake: { x: number; y: number; rx: number; ry: number } | null = null
  {
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
      const inside = w.x >= 0 && w.y >= 0 && w.x < MAP_W && w.y < MAP_H

      // утёс под передним левым краем поля
      const depth = w.y >= MAP_H ? belowFrontEdge(sx, sy) : -1
      if (depth >= 0 && depth < CLIFF) {
        const snowTop = 3 + Math.floor(hash(bx >> 1, 7, seed) * 5)
        if (depth < snowTop) put(bx, by, depth < 2 ? [214, 225, 238] : [178, 192, 212])
        else {
          const streak = hash(bx, Math.floor(depth / 6), seed + 3)
          const tone = streak > 0.75 ? [58, 66, 82] : streak > 0.4 ? [44, 51, 65] : [35, 41, 53]
          const fade = depth > CLIFF - 6 ? 0.85 : 1
          put(bx, by, (dith > 0.94 ? [120, 136, 160] : tone) as [number, number, number], fade)
        }
        continue
      }

      if (road(cx, cy)) {
        // укатанная мёрзлая земля: колеи вдоль направления, снежная крошка, снежные валы по краям
        const u = w.x - cx * CELL
        const v = w.y - cy * CELL
        let c = MUD[Math.floor(hash(Math.floor(w.x / 6), Math.floor(w.y / 6), seed + 8) * MUD.length)]
        const hor = road(cx - 1, cy) || road(cx + 1, cy)
        const ver = road(cx, cy - 1) || road(cx, cy + 1)
        const rut = (t: number) => (t > 11 && t < 15) || (t > 25 && t < 29)
        if ((hor && rut(v) && (road(cx - 1, cy) ? u < 26 : u > 14)) || (ver && rut(u) && (road(cx, cy - 1) ? v < 26 : v > 14))) c = [78, 70, 68]
        if (dith > 0.9) c = [170, 180, 196]
        else if (dith < 0.04) c = [70, 63, 62]
        // валы: у стороны, где соседа-дороги нет
        const edgeD = Math.min(
          road(cx - 1, cy) ? 99 : u,
          road(cx + 1, cy) ? 99 : CELL - u,
          road(cx, cy - 1) ? 99 : v,
          road(cx, cy + 1) ? 99 : CELL - v,
        )
        const bank = 4 + hash(Math.floor(w.x / 5), Math.floor(w.y / 5), seed + 31) * 4
        if (edgeD < bank) c = edgeD < bank * 0.45 ? [200, 212, 228] : [168, 182, 204]
        else if (edgeD < bank + 3) c = [c[0] * 0.78, c[1] * 0.8, c[2] * 0.88]
        put(bx, by, infect(c, w.x, w.y, infection(w.x, w.y) * 0.6))
        continue
      }

      // снег: на поле светлее, за краем (лес, низина) — темнее; пятна идут ромбами по сетке мира
      const pal = inside ? SNOW_PLATEAU : SNOW_LOW
      const n = hash(Math.floor(w.x / 9), Math.floor(w.y / 9), seed)
      const big = hash(Math.floor(w.x / 50), Math.floor(w.y / 50), seed + 3)
      let c = pal[Math.floor((n * 0.5 + big * 0.5) * pal.length) % pal.length]
      if (dith > 0.985) c = [228, 236, 246]
      else if (dith < 0.012) c = [70, 82, 104]
      // еле заметная сетка клеток на поле — видно, куда ставить башню
      let k = 1
      if (inside) {
        const u = w.x - cx * CELL
        const v = w.y - cy * CELL
        if (u < 1.6 || v < 1.6) k = 0.955
      }
      // город за правым краем: утоптанный снег с грязью
      if (w.x >= MAP_W && w.y < MAP_H && hash(Math.floor(w.x / 14), Math.floor(w.y / 14), seed + 5) > 0.72) c = [110, 104, 104]
      // лёд озера: тёмно-синий с трещинами и бликами, по краю — снежная кромка
      if (lake && inLake(w.x, w.y, 6)) {
        const e = ((w.x - lake.x) / lake.rx) ** 2 + ((w.y - lake.y) / lake.ry) ** 2
        if (e > 1) c = [196, 208, 226]
        else {
          const cr = Math.abs(Math.sin(w.x * 0.11 + Math.sin(w.y * 0.07) * 3) * Math.sin(w.y * 0.09 + w.x * 0.02))
          c = cr < 0.05 ? [150, 186, 214] : e < 0.5 ? [64, 98, 136] : [80, 116, 152]
          if (dith > 0.97) c = [214, 232, 248]
        }
      }
      put(bx, by, infect(c, w.x, w.y, infection(w.x, w.y)), k)
    }
  }
  L.putImageData(img, 0, 0)
  groundDetails(L, map, seed, (cx, cy) => road(cx, cy), inLake)

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
  // в 1 клетке от тропы ничего, в 2 — редкие ели, камни, ящики и фонари, от 3 — постройки и рощи
  let tower = false
  let crash = false
  let huts = 0
  let fires = 0
  for (let cx = 0; cx < GRID_W; cx++) {
    for (let cy = 0; cy < GRID_H; cy++) {
      const d = far(cx, cy)
      if (d < 1) continue
      if (d === 1) {
        const roll1 = hash(cx, cy, seed + 131)
        const ox = cx * CELL + CELL / 2 + (hash(cx, cy, seed + 7) - 0.5) * 18
        const oy = cy * CELL + CELL / 2 + (hash(cx, cy, seed + 8) - 0.5) * 18
        if (infection(ox, oy) > 0.35 || inLake(ox, oy, 8)) continue
        const cell1 = cx + ',' + cy
        if (roll1 < 0.08) add(pick<AssetName>(['prop-rock', 'prop-rubble']), ox, oy, 0.17, { flip: r() > 0.5, cell: cell1 })
        else if (roll1 < 0.13) add(pick<AssetName>(['prop-crate', 'prop-barrel', 'prop-box']), ox, oy, 0.24, { cell: cell1 })
        else if (roll1 < 0.15) add('prop-sign', ox, oy, 0.26, { flip: r() > 0.5, cell: cell1 })
        else if (roll1 < 0.17) {
          const p = add('prop-lamp2', ox, oy, 0.28, { cell: cell1 })
          mapLights.push({ x: p.x, y: p.y - 26, kind: 'lantern', seed: cx * 13 + cy })
        }
        continue
      }
      const roll = hash(cx, cy, seed + 101)
      const wx = cx * CELL + CELL / 2 + (hash(cx, cy, seed + 5) - 0.5) * 14
      const wy = cy * CELL + CELL / 2 + (hash(cx, cy, seed + 6) - 0.5) * 14
      if (inLake(wx, wy, 12)) continue
      const cell = cx + ',' + cy
      // у Разлома лес уже мёртв: друзы минерала и сухие деревья вместо елей
      if (infection(wx, wy) > 0.35) {
        if (roll < 0.35) {
          const p = add('crystal', wx, wy, 0.55 + hash(cx, cy, 9) * 0.4, { cell })
          mapLights.push({ x: p.x, y: p.y - 10, kind: 'crystal', seed: cx * 7 + cy })
        } else if (roll < 0.5) add('prop-deadtree', wx, wy, 0.3, { flip: r() > 0.5, cell })
        continue
      }
      if (d === 2) {
        if (roll < 0.16) add('prop-pine', wx, wy, 0.28 + hash(cx, cy, 7) * 0.08, { flip: r() > 0.5, cell })
        else if (roll < 0.22) add(pick<AssetName>(['prop-rock', 'prop-rubble']), wx, wy, 0.22, { flip: r() > 0.5, cell })
        else if (roll < 0.26) add(pick<AssetName>(['prop-crate', 'prop-barrel', 'prop-box']), wx, wy, 0.28, { cell })
        else if (roll < 0.28) {
          const p = add('prop-lamp', wx, wy, 0.3, { cell })
          mapLights.push({ x: p.x, y: p.y - 22, kind: 'lantern', seed: cx * 31 + cy })
        }
        continue
      }
      if (!tower && roll < 0.08) {
        tower = true
        const p = add('baked', wx, wy, 0.75, { baked: watchtower(), cell })
        mapLights.push({ x: p.x, y: p.y - 46, kind: 'window', seed: cx })
        // прожектор вышки шарит лучом по полю
        mapLights.push({ x: p.x + 2, y: p.y - 50, kind: 'search', seed: cx, gx: p.x, gy: p.y })
      } else if (fires < 2 && roll > 0.7 && roll < 0.74) {
        fires++
        const p = add('fire', wx, wy, 1, { cell })
        mapLights.push({ x: p.x, y: p.y - 6, kind: 'furnace', seed: cx * 5 + cy })
      } else if (!crash && roll < 0.14) {
        crash = true
        add('baked', wx, wy, 0.7, { baked: wreck(), cell })
      } else if (roll < 0.2 && huts >= 3) {
        add('prop-pine', wx, wy, 0.34, { flip: r() > 0.5, cell })
      } else if (roll < 0.2) {
        huts++
        const name = pick<AssetName>(['prop-shed', 'prop-cabin', 'prop-tent'])
        const p = add(name, wx, wy, 0.36, { flip: r() > 0.5, cell })
        mapLights.push({ x: p.x, y: p.y - 12, kind: name === 'prop-tent' ? 'furnace' : 'window', seed: cx * 3 + cy })
      } else if (roll < 0.22) add(pick<AssetName>(['prop-fence', 'prop-fence2', 'prop-fence3']), wx, wy, 0.32, { flip: r() > 0.5, cell })
      else if (roll < 0.5) add('prop-pine', wx, wy, 0.3 + hash(cx, cy, 7) * 0.14, { flip: r() > 0.5, cell })
      else if (roll < 0.6) add('prop-pines', wx, wy, 0.32, { flip: r() > 0.5, cell })
      else if (roll < 0.66) add(pick<AssetName>(['prop-rock', 'prop-rubble', 'prop-deadtree']), wx, wy, 0.26, { flip: r() > 0.5, cell })
      else if (roll < 0.7) add(pick<AssetName>(['prop-crates', 'prop-crates2', 'prop-sled', 'prop-sign', 'prop-flag']), wx, wy, 0.3, { flip: r() > 0.5, cell })
    }
  }

  // лагерь беженцев за выходом (лор GDD): сердце паровой базы — генератор, вокруг палатки,
  // лазарет, мастерская и склад базы, сани и ящики; частокол с воротами у дороги
  const gen = add('bld-generator', 1080, 330, 0.72)
  mapLights.push({ x: gen.x, y: gen.y - 58, kind: 'generator', seed: 7 })
  const houses: AssetName[] = ['prop-tent', 'bld-medical', 'prop-tent', 'bld-workshop', 'prop-cabin', 'prop-tent', 'bld-heater', 'prop-shed', 'bld-depot']
  // паровая база стоит рядом с генератором: на ней беженцы идут дальше (лор GDD)
  const placed: { x: number; y: number }[] = [{ x: 1080, y: 330 }]
  const spots: [number, number][] = []
  for (let by = 60; by < MAP_H; by += 20) for (let bx = 1000; bx < 1300; bx += 20) spots.push([bx, by])
  // ближе к зрителю и левее генератора — там её не загораживают дома
  const want = (q: [number, number]) => {
    const sp = toScreen(q[0], q[1])
    return Math.abs(sp.x - 700) + Math.abs(sp.y - 520)
  }
  spots.sort((a, b) => want(a) - want(b))
  for (const [bx, by] of spots) {
    const p = toScreen(bx, by)
    if (p.x < 620 || p.x > 880 || p.y > 548 || Math.abs(by - exitY) < 70 || Math.hypot(bx - 1080, by - 330) < 130) continue
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
  for (const [mx, my] of [[1010, 150], [1010, 520], [1040, 80]]) {
    const p = toScreen(mx, my)
    if (p.x > 930 || p.y > 590 || Math.abs(my - exitY) < 50 || placed.some((q) => Math.hypot(q.x - mx, q.y - my) < 50)) continue
    const mast = radioMast()
    add('baked', mx, my, 0.8, { baked: mast })
    placed.push({ x: mx, y: my })
    mapLights.push({ ...bakedPoint(p, 0.8, mast, mast.smoke[0][0], mast.smoke[0][1]), kind: 'beacon', seed: 0 })
    break
  }
  let hi = Math.floor(r() * houses.length)
  for (let wy = 60; wy < MAP_H; wy += 58) {
    for (let wx = 1010; wx < 1400; wx += 64) {
      const x = wx + (r() - 0.5) * 20
      const y = wy + (r() - 0.5) * 20
      const p = toScreen(x, y)
      if (p.x > 930 || p.y > 590 || p.x < 560) continue
      if (Math.abs(y - exitY) < 48) continue
      if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 70)) continue
      placed.push({ x, y })
      const name = houses[hi++ % houses.length]
      const sp = add(name, x, y, name.startsWith('prop') ? 0.42 : 0.5, { flip: r() > 0.5 })
      mapLights.push({ x: sp.x, y: sp.y - 16, kind: 'window', seed: Math.floor(x + y) })
    }
  }
  // костры лагеря: вокруг них греются беженцы
  for (let i = 0, made = 0; i < 30 && made < 2; i++) {
    const x = 1010 + r() * 220
    const y = 60 + r() * 500
    const p = toScreen(x, y)
    if (p.x > 920 || p.y > 586 || p.x < 600 || Math.abs(y - exitY) < 40) continue
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 50)) continue
    placed.push({ x, y })
    add('fire', x, y, 1)
    mapLights.push({ x: p.x, y: p.y - 6, kind: 'furnace', seed: 40 + i })
    made++
  }
  // фонари вдоль дорог за краем поля — тропа к Разлому и к лагерю освещена
  const roadLamp = (x: number, y: number, i: number) => {
    const p = toScreen(x, y)
    if (p.x < 6 || p.x > 950 || p.y < 20 || p.y > 594) return
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 30)) return
    placed.push({ x, y })
    add('prop-lamp2', x, y, 0.32)
    mapLights.push({ x: p.x, y: p.y - 30, kind: 'lantern', seed: 60 + i })
  }
  for (let i = 0; i < 4; i++) roadLamp(MAP_W + 50 + i * 80, exitY + (i % 2 ? 30 : -30), i)
  for (let i = 0; i < 3; i++) roadLamp(-140 - i * 90, entryY + (i % 2 ? 32 : -32), 10 + i)

  // скарб беженцев между палатками
  for (let i = 0; i < 40 && placed.length < 26; i++) {
    const x = 1000 + r() * 260
    const y = 40 + r() * 540
    const p = toScreen(x, y)
    if (p.x > 935 || p.y > 594 || p.x < 570 || Math.abs(y - exitY) < 30) continue
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < 34)) continue
    placed.push({ x, y })
    const name = pick<AssetName>(['prop-crate', 'prop-barrel', 'prop-crates', 'prop-sled', 'prop-box', 'prop-lamp'])
    const sp = add(name, x, y, 0.3, { flip: r() > 0.5 })
    if (name === 'prop-lamp') mapLights.push({ x: sp.x, y: sp.y - 22, kind: 'lantern', seed: i })
  }
  // стена по правому краю поля, разрыв — ворота для дороги; у ворот фонари-башенки
  for (let y = 26; y < MAP_H; y += 48) {
    if (Math.abs(y - exitY) < 46) continue
    add('bld-wall', MAP_W + 18, y, 0.5, { flip: true })
  }
  for (const dy of [-44, 44]) {
    const p = add('prop-lamptower', MAP_W + 18, exitY + dy, 0.36)
    mapLights.push({ x: p.x, y: p.y - 36, kind: 'gate', seed: dy })
  }
  roadEnds.exit = toScreen(MAP_W, exitY)

  // лес за задними краями и в низине под утёсом: выборка по экрану, частая сетка с дрожанием
  for (let sy = -6; sy < H + 30; sy += 13) {
    for (let sx = -10; sx < W + 10; sx += 15) {
      const x = sx + (r() - 0.5) * 12
      const y = sy + (r() - 0.5) * 8
      const w = toWorld(x, y)
      if (w.x >= -8 && w.y >= -8 && w.x < MAP_W + 8 && w.y < MAP_H + 8) continue // поле
      if (w.x >= MAP_W - 10 && w.y < MAP_H + 10) continue // город
      if (w.x < 0 && Math.abs(w.y - entryY) < 46) continue // дорога ко входу
      if (w.y >= MAP_H) {
        const d = belowFrontEdge(x, y)
        if (d >= 0 && d < CLIFF + 6) continue // на утёсе
      }
      // поляны: крупный шум по экрану прореживает лес, чтобы он не сливался в ковёр
      const dense = hash(Math.floor(x / 90), Math.floor(y / 70), seed + 77)
      const roll = r() / (0.55 + dense * 0.6)
      if (infection(w.x, w.y) > 0.35) {
        // мёртвый лес у Разлома: редкие друзы среди мёртвых деревьев и елей
        if (roll < 0.07) {
          props.push({ name: 'crystal', x, y, s: 0.4 + r() * 0.3 })
          if (r() < 0.3) mapLights.push({ x, y: y - 10, kind: 'crystal', seed: Math.floor(x) })
        } else if (roll < 0.3) props.push({ name: 'prop-deadtree', x, y, s: 0.3 + r() * 0.1, flip: r() > 0.5 })
        else if (roll < 0.52) props.push({ name: 'prop-pine', x, y, s: 0.3 + r() * 0.14, flip: r() > 0.5 })
        else if (roll < 0.58) props.push({ name: 'prop-rock', x, y, s: 0.24, flip: r() > 0.5 })
        continue
      }
      if (roll < 0.5) props.push({ name: 'prop-pine', x, y, s: 0.3 + r() * 0.16, flip: r() > 0.5 })
      else if (roll < 0.6) props.push({ name: 'prop-pines', x, y, s: 0.32 + r() * 0.1, flip: r() > 0.5 })
      else if (roll < 0.63) props.push({ name: 'prop-deadtree', x, y, s: 0.3, flip: r() > 0.5 })
      else if (roll < 0.66) props.push({ name: pick<AssetName>(['prop-rock', 'prop-rubble', 'prop-cliff']), x, y, s: 0.26, flip: r() > 0.5 })
    }
  }

  // вход: портал Разлома у края леса, рядом лагерь разведчиков
  roadEnds.entry = toScreen(-70, entryY)
  mapLights.push({ x: roadEnds.entry.x, y: roadEnds.entry.y - 16, kind: 'portal', seed: 1 })
  const camp = toScreen(-40, entryY + 70)
  if (camp.x > 10 && camp.y > 30) {
    props.push({ name: 'prop-tent', x: camp.x, y: camp.y, s: 0.36 })
    mapLights.push({ x: camp.x, y: camp.y - 12, kind: 'furnace', seed: 3 })
  }

  // мягкая холодная виньетка по краям
  const g = L.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62)
  g.addColorStop(0, 'rgba(6,12,30,0)')
  g.addColorStop(1, 'rgba(6,12,30,0.55)')
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
 * Мелочи на снегу, вписанные прямо в землю (пиксели 2×2, как у неё): наметённые сугробы с синей
 * тенью, камни под снегом, сухая трава, цепочки следов, колея от саней, обломки досок, наст.
 * Плоские — места под башни не занимают, поэтому лежат везде, кроме самой тропы и озера.
 */
function groundDetails(
  L: CanvasRenderingContext2D, map: GameMap, seed: number,
  road: (cx: number, cy: number) => boolean, inLake: (x: number, y: number, pad?: number) => boolean,
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
  /** Свободный снег (поле или лес рядом), не дорога и не лёд */
  const free = (wx: number, wy: number) => {
    const cx = Math.floor(wx / CELL)
    const cy = Math.floor(wy / CELL)
    if (wx < -60 || wy < -60 || wx > MAP_W + 40 || wy > MAP_H + 10) return false
    return !road(cx, cy) && !inLake(wx, wy, 8)
  }
  void map

  // сугробы, вытянутые по ветру: светлый верх, тень справа-снизу
  for (let i = 0; i < 120; i++) {
    const wx = r() * (MAP_W + 80) - 40
    const wy = r() * (MAP_H + 40) - 20
    if (!free(wx, wy)) continue
    const p = toScreen(wx, wy)
    const len = 8 + Math.floor(r() * 10)
    for (let k = -len; k <= len; k += 2) {
      const h = Math.round((1 - (k / len) ** 2) * 3)
      for (let j = 0; j <= h; j += 2) blk(p.x + k, p.y - j, j >= h - 1 ? '#d6e1ee' : '#b8c6da')
      blk(p.x + k + 2, p.y + 2, '#6c7d98')
    }
  }
  // камни под снежными шапками
  for (let i = 0; i < 90; i++) {
    const wx = r() * MAP_W
    const wy = r() * MAP_H
    if (!free(wx, wy)) continue
    const p = toScreen(wx, wy)
    const n = 1 + Math.floor(r() * 3)
    for (let k = 0; k < n; k++) {
      const x = p.x + k * 4 - 2
      const y = p.y + (k % 2) * 2
      blk(x, y, '#2c3340', 4, 4)
      blk(x, y + 2, '#3e4758', 2, 2)
      blk(x, y - 2, '#dfe8f2', 4, 2)
      blk(x + 4, y + 2, '#5a6a85')
    }
  }
  // сухая трава из-под снега
  for (let i = 0; i < 110; i++) {
    const wx = r() * MAP_W
    const wy = r() * MAP_H
    if (!free(wx, wy)) continue
    const p = toScreen(wx, wy)
    for (let k = 0; k < 3; k++) {
      const x = p.x + k * 2 - 2
      const h = 2 + Math.floor(r() * 3) * 2
      L.fillStyle = k === 1 ? '#9a8a62' : '#7a6a48'
      L.fillRect(Math.floor(x / 2) * 2, Math.floor((p.y - h) / 2) * 2, 2, h)
    }
  }
  // цепочки следов: кто-то бродил между постройками (пары точек вдоль извилистого пути)
  for (let t = 0; t < 8; t++) {
    let wx = r() * MAP_W
    let wy = r() * MAP_H
    let a = r() * Math.PI * 2
    for (let s = 0; s < 40; s++) {
      a += (r() - 0.5) * 0.5
      wx += Math.cos(a) * 9
      wy += Math.sin(a) * 9
      if (!free(wx, wy)) continue
      const p = toScreen(wx, wy)
      blk(p.x + (s % 2 ? 2 : -2), p.y + (s % 2 ? 0 : 2), '#7889a4')
    }
  }
  // колея от саней: две параллельные борозды дугой через поле
  for (let t = 0; t < 2; t++) {
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
      blk(p1.x, p1.y, '#8495b0')
      blk(p2.x, p2.y, '#8495b0')
    }
  }
  // обломки досок и брёвна, полузанесённые снегом
  for (let i = 0; i < 26; i++) {
    const wx = r() * MAP_W
    const wy = r() * MAP_H
    if (!free(wx, wy)) continue
    const p = toScreen(wx, wy)
    const dir = r() > 0.5 ? 1 : -1
    for (let k = 0; k < 5; k++) {
      blk(p.x + k * 2 * dir, p.y + k, '#5a4030')
      blk(p.x + k * 2 * dir, p.y + k - 2, k % 2 ? '#7a5a40' : '#dfe8f2')
    }
  }
  // наст: пятна блестящего снега с искрами
  for (let i = 0; i < 60; i++) {
    const wx = r() * MAP_W
    const wy = r() * MAP_H
    if (!free(wx, wy)) continue
    const p = toScreen(wx, wy)
    for (let k = 0; k < 6; k++) blk(p.x + (r() - 0.5) * 20, p.y + (r() - 0.5) * 10, r() > 0.7 ? '#f2f7ff' : '#c2cfe0')
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
 * Позёмка: снежные струйки низко над землёй бегут по ветру; в порыв — гуще и длиннее.
 * Рисуется поверх земли, под постройками и фигурами.
 */
export function drawDrift(ctx: CanvasRenderingContext2D, t: number) {
  const W = MAP_W
  const wnd = windAt(t)
  const path = windPath(t)
  const n = Math.round(18 + wnd * 14)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const speed = 60 + (i % 5) * 18
    const len = (24 + (i % 7) * 9) * (0.6 + wnd * 0.5)
    const x = ((((i * 211.7 + path * speed) % (W + 200)) + W + 200) % (W + 200)) - 100
    const y = (i * 97.3) % MAP_H + Math.sin(t * 0.9 + i) * 4
    const a = Math.min(0.32, 0.08 + wnd * 0.1) * (0.6 + 0.4 * Math.sin(t * 1.5 + i * 2.1))
    // струйка — три отрезка: бледный хвост, плотная середина, бледная голова (без градиентов — дёшево)
    ctx.fillStyle = `rgba(230,240,255,${a * 0.4})`
    ctx.fillRect(x - len, y, len * 0.4, 2)
    ctx.fillRect(x - len * 0.15, y, len * 0.15, 2)
    ctx.fillStyle = `rgba(230,240,255,${a})`
    ctx.fillRect(x - len * 0.6, y, len * 0.45, 2)
    ctx.fillRect(x - len * 0.5, y + 3, len * 0.3, 1)
  }
  ctx.restore()
}

/** Портал Разлома: тёмный провал в земле, зелёный водоворот, осколки кристаллов */
export function drawPortal(ctx: CanvasRenderingContext2D, t: number) {
  const { x, y } = roadEnds.entry
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
