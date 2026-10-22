// Дорисованные постройки в стиле листа референса: паровая база (мобильный штаб беженцев по лору),
// радиомачта (через неё выходит на связь ИИ), сторожевая вышка и обломки парового вездехода.
// Стиль листа: каменный цоколь в снегу, тёмно-синее железо с голубыми бликами по рёбрам,
// снег на каждом уступе, тёплый свет из окон, тонкий тёмный контур. Рисуются из изо-коробок в
// утроенном разрешении (K) и на экране уменьшаются со сглаживанием — как спрайты из листа.
// Каждая картинка рисуется один раз и кэшируется.

/**
 * Готовая картинка: точка опоры (середина подошвы), пикселей картинки на единицу модели и
 * верхушки труб (смещения от опоры в пикселях картинки) — из них идёт дым.
 */
export interface Baked {
  cv: HTMLCanvasElement
  ax: number
  ay: number
  k: number
  smoke: [number, number][]
}

type Ctx = CanvasRenderingContext2D
export type Pt = [number, number]

/** Пикселей холста на единицу модели: детали тоньше «пикселя» земли, как у спрайтов листа */
export const K = 3
/** Пикселей «листа» на единицу модели: после пикселизации один такой пиксель — около 1,2 пикселя экрана */
const PIX = 1.25

/** Точка в изометрии: x — вдоль одной оси земли, y — вдоль другой, z — вверх */
export const P = (x: number, y: number, z: number): Pt => [x - y, (x + y) / 2 - z]

export function poly(c: Ctx, pts: Pt[], color: string | CanvasGradient) {
  c.fillStyle = color
  c.beginPath()
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
  c.closePath()
  c.fill()
}
export function line(c: Ctx, a: Pt, b: Pt, color: string, w = 1) {
  c.strokeStyle = color
  c.lineWidth = w / K
  c.beginPath()
  c.moveTo(a[0], a[1])
  c.lineTo(b[0], b[1])
  c.stroke()
}
function dot(c: Ctx, p: Pt, color: string) {
  c.fillStyle = color
  c.fillRect(p[0] - 0.5 / K, p[1] - 0.5 / K, 1 / K, 1 / K)
}

export interface Mat {
  top: string
  left: string // грань к зрителю слева (смотрит на +y)
  right: string // грань к зрителю справа (смотрит на +x)
  edge: string // блик по верхним рёбрам
  seam: string // швы и тени деталей
}
export const IRON: Mat = { top: '#3c4a62', left: '#28334a', right: '#1a2233', edge: '#7d95b8', seam: '#121826' }
export const DARK: Mat = { top: '#252c3a', left: '#181e2a', right: '#10141d', edge: '#4e5d78', seam: '#0a0d14' }
export const COPPER: Mat = { top: '#9a6438', left: '#744626', right: '#4e2e18', edge: '#d8a060', seam: '#2e1a0e' }
export const WOOD: Mat = { top: '#6e5038', left: '#4e3828', right: '#36261b', edge: '#9a7a58', seam: '#22170f' }
const STONE: Mat = { top: '#4a5468', left: '#343c4e', right: '#252b39', edge: '#6e7c96', seam: '#171c27' }
const SNOW = '#dfe8f3'
const SNOW_L = '#b4c3d8'
const SNOW_R = '#8fa0bb'
const SNOWM: Mat = { top: SNOW, left: SNOW_L, right: SNOW_R, edge: '#ffffff', seam: SNOW_R }
const WIN = '#ff9a3c'
const WIN_L = '#ffd884'

function lighten(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(Math.min(255, v * k))
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}

/**
 * Коробка с деталями: грани светлее кверху, швы листов с заклёпками, голубой блик по верхним рёбрам.
 * seam — шаг горизонтальных швов (0 — без швов), rib — шаг вертикальных.
 */
export function box(c: Ctx, x: number, y: number, z: number, a: number, b: number, h: number, m: Mat, seam = 0, rib = 0) {
  const L: Pt[] = [P(x, y + b, z), P(x + a, y + b, z), P(x + a, y + b, z + h), P(x, y + b, z + h)]
  const R: Pt[] = [P(x + a, y, z), P(x + a, y + b, z), P(x + a, y + b, z + h), P(x + a, y, z + h)]
  const T: Pt[] = [P(x, y, z + h), P(x + a, y, z + h), P(x + a, y + b, z + h), P(x, y + b, z + h)]
  const grad = (pts: Pt[], col: string) => {
    const ys = pts.map((p) => p[1])
    const g = c.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys))
    g.addColorStop(0, lighten(col, 1.18))
    g.addColorStop(1, lighten(col, 0.72))
    return g
  }
  poly(c, L, grad(L, m.left))
  poly(c, R, grad(R, m.right))
  poly(c, T, m.top)
  if (seam) {
    for (let zz = z + seam; zz < z + h - 0.5; zz += seam) {
      line(c, P(x, y + b, zz), P(x + a, y + b, zz), m.seam)
      line(c, P(x + a, y, zz), P(x + a, y + b, zz), m.seam)
      for (let u = 1.5; u < a; u += 3) dot(c, P(x + u, y + b, zz + 0.6), m.edge)
    }
  }
  if (rib) {
    for (let u = rib; u < a - 0.5; u += rib) line(c, P(x + u, y + b, z), P(x + u, y + b, z + h), m.seam)
    for (let v = rib; v < b - 0.5; v += rib) line(c, P(x + a, y + v, z), P(x + a, y + v, z + h), m.seam)
  }
  line(c, T[3], T[2], m.edge, 1.2)
  line(c, T[2], T[1], m.edge, 1)
  line(c, L[1], L[2], lighten(m.edge, 0.8), 1)
  line(c, L[0], L[1], m.seam, 1.2)
  line(c, R[0], R[1], m.seam, 1.2)
}

/** Снежная шапка на верх коробки: слой снега, свисающие наплывы на грани, искорки */
export function snowCap(c: Ctx, x: number, y: number, z: number, a: number, b: number, seed: number) {
  const top: Pt[] = [P(x - 0.3, y - 0.3, z + 0.6), P(x + a + 0.3, y - 0.3, z + 0.6), P(x + a + 0.3, y + b + 0.3, z + 0.6), P(x - 0.3, y + b + 0.3, z + 0.6)]
  poly(c, [P(x - 0.3, y + b + 0.3, z), P(x + a + 0.3, y + b + 0.3, z), top[2], top[3]], SNOW_L)
  poly(c, [P(x + a + 0.3, y - 0.3, z), P(x + a + 0.3, y + b + 0.3, z), top[2], top[1]], SNOW_R)
  poly(c, top, SNOW)
  let r = seed
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280
  for (let u = 0.5; u < a; u += 1.2 + rnd() * 1.6) {
    const d = 0.5 + rnd() * 1.4
    poly(c, [P(x + u, y + b + 0.3, z), P(x + u + 0.9, y + b + 0.3, z), P(x + u + 0.45, y + b + 0.3, z - d)], SNOW_L)
  }
  for (let v = 0.5; v < b; v += 1.2 + rnd() * 1.6) {
    const d = 0.4 + rnd() * 1.2
    poly(c, [P(x + a + 0.3, y + v, z), P(x + a + 0.3, y + v + 0.9, z), P(x + a + 0.3, y + v + 0.45, z - d)], SNOW_R)
  }
  for (let i = 0; i < a * b * 0.15; i++) dot(c, P(x + rnd() * a, y + rnd() * b, z + 0.6), '#ffffff')
}

/** Двускатная крыша вдоль оси x под снегом: передний скат, щипец справа, конёк, тёмные доски из-под снега */
function gable(c: Ctx, x: number, y: number, z: number, a: number, b: number, rh: number, seed: number) {
  const ridgeY = y + b / 2
  poly(c, [P(x + a, y, z), P(x + a, y + b, z), P(x + a, ridgeY, z + rh)], WOOD.right)
  poly(c, [P(x - 0.6, y + b + 0.6, z - 0.3), P(x + a + 0.6, y + b + 0.6, z - 0.3), P(x + a + 0.6, ridgeY, z + rh), P(x - 0.6, ridgeY, z + rh)], SNOW_L)
  let r = seed
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280
  for (let u = 1; u < a; u += 1.6 + rnd() * 1.4) {
    if (rnd() < 0.45) line(c, P(x + u, y + b + 0.4, z), P(x + u + 0.2, ridgeY + 1.2, z + rh - 1), '#3a4558', 1.4)
  }
  for (let i = 0; i < a * 0.8; i++) dot(c, P(x + rnd() * a, y + b / 2 + rnd() * b / 2, z + rnd() * rh), '#ffffff')
  line(c, P(x - 0.6, ridgeY, z + rh), P(x + a + 0.6, ridgeY, z + rh), SNOW, 1.6)
  line(c, P(x - 0.6, y + b + 0.6, z - 0.3), P(x + a + 0.6, y + b + 0.6, z - 0.3), '#2a1a10', 1.4)
}

/** Каменный цоколь в снегу — на нём стоит каждая постройка листа */
function plinth(c: Ctx, x: number, y: number, a: number, b: number, seed: number) {
  box(c, x, y, 0, a, b, 2, STONE, 0, 3)
  snowCap(c, x, y, 2, a, b, seed)
  // утоптанный снег: голубые проталины и следы, чтобы площадка не была плоско-белой
  let r = seed * 7
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280
  for (let i = 0; i < a * b * 0.12; i++) {
    const px = x + rnd() * a
    const py = y + rnd() * b
    poly(c, [P(px, py, 2.62), P(px + 1.4, py, 2.62), P(px + 1.4, py + 0.8, 2.62), P(px, py + 0.8, 2.62)], rnd() > 0.5 ? '#9fb0c6' : '#c0cddf')
  }
}

/** Окно на левой грани (плоскость y + b): рама, тёплый свет, переплёт, снег на подоконнике, ореол */
function windowL(c: Ctx, x: number, y: number, b: number, u: number, z: number, w = 2.4, h = 3) {
  const yb = y + b
  const [gx, gy] = P(x + u + w / 2, yb, z + h / 2)
  const g = c.createRadialGradient(gx, gy, 0, gx, gy, 5)
  g.addColorStop(0, 'rgba(255,170,80,0.35)')
  g.addColorStop(1, 'rgba(255,170,80,0)')
  c.fillStyle = g
  c.fillRect(gx - 5, gy - 5, 10, 10)
  poly(c, [P(x + u - 0.4, yb, z - 0.4), P(x + u + w + 0.4, yb, z - 0.4), P(x + u + w + 0.4, yb, z + h + 0.4), P(x + u - 0.4, yb, z + h + 0.4)], '#0b0e14')
  const wg = c.createLinearGradient(0, P(x + u, yb, z + h)[1], 0, P(x + u, yb, z)[1])
  wg.addColorStop(0, WIN_L)
  wg.addColorStop(1, WIN)
  poly(c, [P(x + u, yb, z), P(x + u + w, yb, z), P(x + u + w, yb, z + h), P(x + u, yb, z + h)], wg)
  line(c, P(x + u + w / 2, yb, z), P(x + u + w / 2, yb, z + h), '#3a2414')
  line(c, P(x + u, yb, z + h * 0.55), P(x + u + w, yb, z + h * 0.55), '#3a2414')
  poly(c, [P(x + u - 0.5, yb + 0.3, z - 0.4), P(x + u + w + 0.5, yb + 0.3, z - 0.4), P(x + u + w + 0.5, yb + 0.3, z - 0.9), P(x + u - 0.5, yb + 0.3, z - 0.9)], SNOW_L)
}
/** Окно на правой грани (плоскость x + a) */
function windowR(c: Ctx, x: number, a: number, y: number, v: number, z: number, w = 2.2, h = 3) {
  const xa = x + a
  poly(c, [P(xa, y + v - 0.4, z - 0.4), P(xa, y + v + w + 0.4, z - 0.4), P(xa, y + v + w + 0.4, z + h + 0.4), P(xa, y + v - 0.4, z + h + 0.4)], '#0b0e14')
  poly(c, [P(xa, y + v, z), P(xa, y + v + w, z), P(xa, y + v + w, z + h), P(xa, y + v, z + h)], '#e07a2a')
  line(c, P(xa, y + v + w / 2, z), P(xa, y + v + w / 2, z + h), '#3a2414')
}

/** Цилиндр вдоль оси x (котёл, бак): полосы светотени, обручи, торец */
export function cylinderX(c: Ctx, x: number, y: number, z: number, len: number, r: number, m: Mat) {
  const N = 10
  const at = (t: number): [number, number] => [y + r - Math.cos(t) * r, z + r + Math.sin(t) * r]
  for (let i = N - 1; i >= 0; i--) {
    const [y1, z1] = at((i / N) * Math.PI)
    const [y2, z2] = at(((i + 1) / N) * Math.PI)
    const shade = 0.6 + 0.6 * Math.sin(((i + 0.5) / N) * Math.PI) * (i < N / 2 ? 1 : 0.75)
    poly(c, [P(x, y1, z1), P(x + len, y1, z1), P(x + len, y2, z2), P(x, y2, z2)], lighten(m.left, shade))
  }
  for (let u = 1.5; u < len; u += 3) {
    for (let i = 0; i < N; i++) {
      const [y1, z1] = at((i / N) * Math.PI)
      const [y2, z2] = at(((i + 1) / N) * Math.PI)
      line(c, P(x + u, y1, z1), P(x + u, y2, z2), m.seam, 1.3)
    }
  }
  c.fillStyle = m.right
  c.beginPath()
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * Math.PI * 2
    const [px, py] = P(x + len, y + r - Math.cos(t) * r, z + r + Math.sin(t) * r)
    if (i) c.lineTo(px, py)
    else c.moveTo(px, py)
  }
  c.fill()
}

/** Вертикальная труба (дымовая): тёмная, с медными обручами, расширенным оголовком и снегом на нём */
function stack(c: Ctx, x: number, y: number, z: number, h: number, w: number, seed: number): Pt {
  box(c, x, y, z, w, w, h, DARK)
  for (let zz = z + 3; zz < z + h - 1; zz += 4) box(c, x - 0.2, y - 0.2, zz, w + 0.4, w + 0.4, 0.6, COPPER)
  box(c, x - 0.6, y - 0.6, z + h, w + 1.2, w + 1.2, 1.4, DARK)
  snowCap(c, x - 0.6, y - 0.6, z + h + 1.4, w + 1.2, w + 1.2, seed)
  return P(x + w / 2, y + w / 2, z + h + 2.2)
}

/** Медная паропроводная труба вдоль оси x на левой грани с фланцами */
function pipeX(c: Ctx, x: number, yb: number, z: number, len: number) {
  box(c, x, yb, z, len, 0.9, 0.9, COPPER)
  for (let u = 2; u < len; u += 4) box(c, x + u, yb - 0.1, z - 0.15, 0.5, 1.1, 1.2, COPPER)
}

/** Колесо/каток на левой грани: тёмный диск со ступицей */
function wheelL(c: Ctx, x: number, yb: number, z: number, r: number) {
  const ring = (rr: number, col: string) => {
    c.fillStyle = col
    c.beginPath()
    for (let i = 0; i <= 14; i++) {
      const t = (i / 14) * Math.PI * 2
      const [px, py] = P(x + Math.cos(t) * rr, yb, z + Math.sin(t) * rr)
      if (i) c.lineTo(px, py)
      else c.moveTo(px, py)
    }
    c.fill()
  }
  ring(r, '#0b0e14')
  ring(r * 0.75, '#2a303c')
  ring(r * 0.3, '#9a6438')
}

/**
 * Нарисовать модель на холсте w×h единиц с началом координат в (ox, oy) — в K раз крупнее,
 * снять полупрозрачность краёв, добавить тёмный контур и мелкое зерно.
 * draw возвращает верхушки труб (точки модели) — для дыма.
 */
function bake(w: number, h: number, ox: number, oy: number, draw: (c: Ctx) => Pt[] | void): Baked {
  const W = w * K
  const H = h * K
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.setTransform(K, 0, 0, K, ox * K, oy * K)
  const tops = draw(c) ?? []
  // сброс матрицы: в браузере putImageData её игнорирует, а @napi-rs/canvas в превью — нет
  c.setTransform(1, 0, 0, 1, 0, 0)
  // свести к «пикселю листа»: одна единица модели — один пиксель (усреднение), как у спрайтов референса
  const lw = Math.round(w * PIX)
  const lh = Math.round(h * PIX)
  const low = document.createElement('canvas')
  low.width = lw
  low.height = lh
  const l = low.getContext('2d')!
  l.imageSmoothingEnabled = true
  l.imageSmoothingQuality = 'high'
  l.drawImage(cv, 0, 0, lw, lh)
  const id = l.getImageData(0, 0, lw, lh)
  const d = id.data
  const solid = new Uint8Array(lw * lh)
  for (let i = 0; i < lw * lh; i++) solid[i] = d[i * 4 + 3] > 110 ? 1 : 0
  const out = new Uint8ClampedArray(d.length)
  const near = (X: number, Y: number) => X >= 0 && Y >= 0 && X < lw && Y < lh && solid[Y * lw + X] === 1
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const i = y * lw + x
      if (solid[i]) {
        // пиксельное «зерно» как у спрайтов листа: шум по пикселям, редкие искры инея и тёмные крапины
        const hsh = (Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0) / 4294967296
        let g = 0.86 + hsh * 0.26
        const lum = d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]
        if (hsh > 0.985 && lum < 420) g = 1.9 // иней на металле
        else if (hsh < 0.02) g = 0.6
        for (let ch = 0; ch < 3; ch++) out[i * 4 + ch] = Math.min(255, d[i * 4 + ch] * g)
        out[i * 4 + 3] = 255
      } else if (near(x - 1, y) || near(x + 1, y) || near(x, y - 1) || near(x, y + 1)) {
        out[i * 4] = 8 // контур снаружи силуэта
        out[i * 4 + 1] = 11
        out[i * 4 + 2] = 18
        out[i * 4 + 3] = 235
      } else if (d[i * 4 + 3] > 0) {
        for (let ch = 0; ch < 4; ch++) out[i * 4 + ch] = d[i * 4 + ch] // ореолы окон
      }
    }
  }
  id.data.set(out)
  l.putImageData(id, 0, 0)
  c.clearRect(0, 0, W, H)
  c.imageSmoothingEnabled = false
  c.drawImage(low, 0, 0, W, H)
  return { cv, ax: ox * K, ay: oy * K, k: K, smoke: tops.map(([px, py]) => [px * K, py * K]) }
}

const cache = new Map<string, Baked>()
function cached(key: string, make: () => Baked) {
  let b = cache.get(key)
  if (!b) {
    b = make()
    cache.set(key, b)
  }
  return b
}

/**
 * Паровая база: гусеничный вездеход-штаб беженцев на каменной площадке. Корпус из клёпаных листов
 * с иллюминаторами и паропроводом, рубка со снежной крышей, медный котёл, три дымовые трубы,
 * перила, груз на палубе, прожектор.
 */
export function steamBase(): Baked {
  return cached('base', () =>
    bake(104, 112, 44, 70, (c) => {
      plinth(c, -2, -2, 50, 24, 11)
      const Z = 2.6
      // гусеницы: дальняя, корпус, ближняя с катками
      box(c, 0, 0, Z, 46, 6, 6, DARK, 0, 3)
      box(c, 2, 2, Z + 5, 40, 16, 11, IRON, 3.5, 8)
      box(c, 0, 14, Z, 46, 6, 6, DARK, 0, 2)
      for (const u of [4, 11, 18, 25, 32, 39]) wheelL(c, u, 20, Z + 3, 2.3)
      // паропровод вдоль борта, иллюминаторы, дверь с тёплым светом
      pipeX(c, 2, 18, Z + 14.2, 40)
      for (const u of [7, 17]) windowL(c, 2, 2, 16, u, Z + 9.5, 2.4, 2.6)
      // вертикальные трубы и лестница по борту
      for (const u of [12, 21]) box(c, 2 + u, 18, Z + 5, 0.9, 0.9, 11, COPPER)
      for (let zz = Z + 6; zz < Z + 16; zz += 1.6) line(c, P(31, 18.2, zz), P(33, 18.2, zz), '#56607a', 1.6)
      box(c, 26, 18, Z + 5, 4, 0.4, 7, WOOD)
      windowL(c, 2, 2, 16.4, 25.4, Z + 9, 2.6, 2.8)
      // котёл спереди
      cylinderX(c, 28, 4, Z + 16, 14, 5, COPPER)
      // рубка
      box(c, 4, 4, Z + 16, 20, 12, 9, WOOD, 0, 1.6)
      windowL(c, 4, 4, 12, 3, Z + 19, 2.6, 3.4)
      windowL(c, 4, 4, 12, 12.5, Z + 19.5, 2.2, 2.8)
      windowR(c, 4, 20, 4, 4.5, Z + 19, 2.6, 3.4)
      gable(c, 3.5, 3.5, Z + 25, 21, 13, 6, 7)
      // висячий фонарь у двери рубки
      box(c, 16.5, 16.6, Z + 21, 0.9, 0.9, 1.4, DARK)
      poly(c, [P(16.6, 17.5, Z + 21.2), P(17.3, 17.5, Z + 21.2), P(17.3, 17.5, Z + 22.2), P(16.6, 17.5, Z + 22.2)], WIN_L)
      // бочки и ящики на палубе, сугроб у рубки
      for (const [bx, by] of [[30, 13], [33, 14.5]]) {
        box(c, bx, by, Z + 16, 2, 2, 2.6, COPPER, 1.3)
        snowCap(c, bx, by, Z + 18.6, 2, 2, bx)
      }
      box(c, 2.5, 13, Z + 16, 3, 3, 2.4, WOOD, 0, 1.5)
      snowCap(c, 2.5, 13, Z + 18.4, 3, 3, 27)
      // перила впереди рубки и груз
      for (let u = 25; u < 42; u += 2.5) line(c, P(u, 18, Z + 16), P(u, 18, Z + 18.5), '#56607a', 1.2)
      line(c, P(25, 18, Z + 18.5), P(42, 18, Z + 18.5), '#7d95b8', 1.2)
      snowCap(c, 24, 2, Z + 16, 4, 16, 5)
      box(c, 25, 12, Z + 16, 3, 3, 3, WOOD, 0, 1.5)
      snowCap(c, 25, 12, Z + 19, 3, 3, 9)
      // прожектор на носу
      box(c, 42, 8, Z + 9, 1.5, 4, 3, DARK)
      poly(c, [P(43.5, 8.6, Z + 9.6), P(43.5, 11.4, Z + 9.6), P(43.5, 11.4, Z + 11.4), P(43.5, 8.6, Z + 11.4)], '#fff2c0')
      // дымовые трубы: главная на котле, две поменьше над рубкой, и патрубок с паром у кормы
      const tops = [
        stack(c, 35, 7.5, Z + 26, 18, 3, 3),
        stack(c, 30, 5.5, Z + 24, 11, 2, 15),
        stack(c, 8, 7, Z + 28.4, 10, 2.2, 19),
        stack(c, 15, 7, Z + 28.4, 7, 1.8, 23),
      ]
      return tops
    }),
  )
}

/** Радиомачта: решётчатая башня на цоколе, площадка с будкой, антенна и красный огонь — голос ИИ */
export function radioMast(): Baked {
  return cached('mast', () =>
    bake(40, 120, 20, 108, (c) => {
      plinth(c, -7, -7, 14, 14, 21)
      const H = 52
      const Z = 2.6
      const corner = (dx: number, dy: number, z: number) => {
        const k = 5 - (3.8 * (z - Z)) / H
        return P(dx * k, dy * k, z)
      }
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) line(c, corner(dx, dy, Z), corner(dx, dy, Z + H), dx + dy > 0 ? '#7d95b8' : '#3a4560', 2.4)
      for (let z = Z; z < Z + H - 6; z += 7) {
        for (const [a, b] of [
          [corner(-1, 1, z), corner(1, 1, z + 7)],
          [corner(1, 1, z), corner(-1, 1, z + 7)],
          [corner(1, -1, z), corner(1, 1, z + 7)],
          [corner(1, 1, z), corner(1, -1, z + 7)],
        ] as const) line(c, a, b, '#4e5d78', 1.2)
        line(c, corner(-1, 1, z), corner(1, 1, z), '#5d6f8e', 1.2)
        line(c, corner(1, -1, z), corner(1, 1, z), '#3a4560', 1.2)
      }
      box(c, -4, -4, Z + 30, 8, 8, 1.2, DARK)
      snowCap(c, -4, -4, Z + 31.2, 8, 8, 4)
      box(c, -2, -2, Z + 31.8, 4, 4, 4, IRON)
      windowL(c, -2, -2, 4, 0.8, Z + 33, 2, 1.8)
      snowCap(c, -2, -2, Z + 35.8, 4, 4, 6)
      line(c, P(0, 0, Z + H), P(0, 0, Z + H + 14), '#7d95b8', 1.5)
      line(c, P(-2, 0, Z + H + 8), P(2, 0, Z + H + 8), '#7d95b8', 1.2)
      const [tx, ty] = P(0, 0, Z + H + 15)
      c.fillStyle = '#ff3b24'
      c.fillRect(tx - 0.7, ty - 0.7, 1.4, 1.4)
      return [[tx, ty]] // красный огонь — его подхватывает освещение
    }),
  )
}

/** Сторожевая вышка: цоколь, четыре бревенчатые опоры с раскосами, будка с окнами, снежная крыша */
export function watchtower(): Baked {
  return cached('watch', () =>
    bake(44, 84, 22, 72, (c) => {
      plinth(c, -8, -8, 15, 15, 31)
      const Z = 2.6
      for (const [x, y] of [[-6, -6], [3, -6], [-6, 3], [3, 3]]) box(c, x, y, Z, 2, 2, 24, WOOD)
      for (const z of [Z + 6, Z + 14]) {
        line(c, P(-5, 5, z), P(4, 5, z + 7), WOOD.edge, 1.4)
        line(c, P(5, -5, z), P(5, 4, z + 7), WOOD.right, 1.4)
      }
      box(c, -7, -7, Z + 24, 13, 13, 2, WOOD, 0, 2)
      snowCap(c, -7, -7, Z + 26, 13, 13, 8)
      box(c, -5, -5, Z + 26, 9, 9, 8, WOOD, 0, 1.5)
      windowL(c, -5, -5, 9, 2.6, Z + 28.5, 3.6, 3)
      windowR(c, -5, 9, -5, 3.4, Z + 28.5, 2.4, 3)
      const apex = P(-0.5, -0.5, Z + 41)
      poly(c, [P(-6.5, 4.5, Z + 34), P(4.5, 4.5, Z + 34), apex], SNOW_L)
      poly(c, [P(4.5, -6.5, Z + 34), P(4.5, 4.5, Z + 34), apex], SNOW_R)
      line(c, P(-6.5, 4.5, Z + 34), P(4.5, 4.5, Z + 34), WOOD.seam, 1.5)
      line(c, P(4.5, 4.5, Z + 34), apex, SNOW, 1.2)
    }),
  )
}

/** Обломки парового вездехода: перекошенный корпус полузанесён снегом, гусеница сорвана, котёл пробит */
export function wreck(): Baked {
  return cached('wreck', () =>
    bake(84, 64, 38, 42, (c) => {
      box(c, 0, 0, -2, 30, 14, 9, DARK, 3, 6)
      box(c, 2, 2, 7, 16, 10, 6, IRON, 0, 4)
      for (const u of [3, 8.5]) {
        poly(c, [P(2 + u, 12, 9), P(2 + u + 3, 12, 9), P(2 + u + 3, 12, 11.5), P(2 + u, 12, 11.5)], '#0b0e14')
        poly(c, [P(2 + u + 0.6, 12, 9.4), P(2 + u + 2, 12, 9.4), P(2 + u + 1.2, 12, 11)], '#3a1a10')
      }
      cylinderX(c, 20, 3, 6, 10, 4, COPPER)
      box(c, 25, 6, 14, 2, 2, 4, DARK)
      box(c, 4, 18, 0, 22, 4, 1.6, DARK, 0, 1.5)
      snowCap(c, 0, 0, 7, 16, 12, 13)
      snowCap(c, 2, 2, 13, 16, 10, 17)
      box(c, -5, 10, -1, 14, 10, 4, SNOWM)
      box(c, 24, 10, -1, 10, 8, 3, SNOWM)
    }),
  )
}
