// Свой облик у каждой из 15 башен и 12 слитых. Корпус — одна из 6 моделей листа референса,
// поверх неё — своё свечение (стихия башни) и дорисованные навесные части в стиле листа:
// лук, арбалет с прицелом, сеть, плечи баллисты, рычаг камнемёта, паровой молот, мортира,
// таран, ледяные шипы, песочные часы, шестерни, пулемётные стволы, щит, парящая призма.
// Слитые собирают части обоих родителей и получают золотой венец. Картинка собирается один раз,
// когда загружен спрайт корпуса, и идёт и на поле, и в карточку арсенала.

import { ASSETS, asset, type AssetName } from './assets'
import { COPPER, DARK, IRON, P, WOOD, box, cylinderX, line, poly, snowCap } from './machines'
import type { TowerDefinition } from './types'

type Ctx = CanvasRenderingContext2D
type Slot = 'top' | 'left' | 'right' | 'front'
type PartKind =
  | 'shield' | 'gear' | 'gatling' | 'prism' | 'bow' | 'crossbow' | 'net' | 'ballista' | 'catapult'
  | 'hammer' | 'mortar' | 'ram' | 'ice' | 'hourglass' | 'boiler' | 'rod'

interface Look {
  art: AssetName
  glow?: string // цвет свечения окон и огней (стихия); без него — как в листе
  parts: [PartKind, Slot][]
}

/** Точки крепления навесных частей на каждой модели листа (пиксели спрайта) */
const SLOTS: Record<string, Record<Slot, [number, number]>> = {
  'tower-coal': { top: [52, 24], left: [16, 80], right: [90, 72], front: [44, 100] },
  'tower-cannon': { top: [54, 24], left: [16, 84], right: [90, 84], front: [48, 104] },
  'tower-frost': { top: [48, 12], left: [14, 88], right: [84, 88], front: [44, 108] },
  'tower-sniper': { top: [36, 22], left: [16, 94], right: [86, 94], front: [54, 110] },
  'tower-flame': { top: [44, 14], left: [14, 84], right: [72, 104], front: [40, 104] },
  'tower-tesla': { top: [46, 8], left: [14, 82], right: [84, 82], front: [44, 102] },
}

const FIRE = '#ff9a3c'
const LOOKS: Record<string, Look> = {
  // универсальные
  sentry: { art: 'tower-coal', parts: [['shield', 'front']] },
  mech_guard: { art: 'tower-coal', glow: '#ffd060', parts: [['gatling', 'right'], ['gear', 'left']] },
  prism: { art: 'art-prism', parts: [] },
  // пронзающие
  archer: { art: 'art-archer', parts: [] },
  crossbow: { art: 'art-crossbow', parts: [] },
  hunter: { art: 'art-hunter', parts: [] },
  ballista: { art: 'tower-cannon', glow: '#e8d090', parts: [['ballista', 'top']] },
  // сокрушающие
  catapult: { art: 'art-catapult', parts: [] },
  mauler: { art: 'art-mauler', parts: [] },
  mortar: { art: 'tower-cannon', glow: '#ffc060', parts: [['mortar', 'left'], ['rod', 'right']] },
  golem: { art: 'art-golem', parts: [] },
  // магические
  pyro: { art: 'art-pyro', parts: [] },
  frost: { art: 'art-frost', parts: [] },
  lightning: { art: 'tower-tesla', glow: '#b0a0ff', parts: [['rod', 'left']] },
  chrono: { art: 'art-chrono', parts: [] },
  // слитые: части обоих родителей
  flame_archer: { art: 'tower-flame', glow: '#ff7a2a', parts: [['bow', 'left']] },
  volcano: { art: 'tower-flame', glow: '#ff4a20', parts: [['catapult', 'left']] },
  thunder_crossbow: { art: 'tower-tesla', glow: '#a9b4ff', parts: [['crossbow', 'left'], ['rod', 'right']] },
  frost_hunter: { art: 'tower-frost', glow: '#9ad8e8', parts: [['net', 'left'], ['ice', 'front']] },
  siege_engine: { art: 'tower-cannon', glow: '#e8c080', parts: [['ballista', 'top'], ['ram', 'front']] },
  time_guardian: { art: 'tower-tesla', glow: '#c49ad0', parts: [['hourglass', 'left'], ['hammer', 'right']] },
  storm_mortar: { art: 'tower-tesla', glow: '#9f8fe0', parts: [['mortar', 'left'], ['rod', 'right']] },
  steam_boiler: { art: 'tower-cannon', glow: '#f0f0ff', parts: [['boiler', 'left'], ['ice', 'front']] },
  bastion: { art: 'tower-coal', glow: '#ffd76a', parts: [['shield', 'front'], ['gatling', 'right'], ['gear', 'left']] },
  eternity_prism: { art: 'tower-frost', glow: '#c0a0f0', parts: [['prism', 'top'], ['hourglass', 'left']] },
  auto_arsenal: { art: 'tower-coal', glow: '#e0e090', parts: [['gatling', 'right'], ['bow', 'left']] },
  stone_titan: { art: 'tower-cannon', glow: '#d0a070', parts: [['catapult', 'left'], ['ram', 'front']] },
}

/** Облик башни (на случай новой башни без записи — модель по типу атаки, без навески) */
export function towerLook(def: TowerDefinition, fallback: AssetName): Look {
  return LOOKS[def.id] ?? { art: fallback, parts: [] }
}

// ─── Навесные части. Единица модели = U пикселей спрайта, начало — точка крепления ─────
const U = 3.2

function lw(c: Ctx, w: number) {
  c.lineWidth = w / U
}
function stroke(c: Ctx, color: string, w: number, path: () => void) {
  c.strokeStyle = color
  lw(c, w)
  c.beginPath()
  path()
  c.stroke()
}

const PARTS: Record<PartKind, (c: Ctx, color: string) => void> = {
  // щит-эмблема на столбе: стальной обод, поле цвета башни, умбон, снег на верхнем крае
  shield: (c, col) => {
    box(c, -0.5, -0.5, 0, 1, 1, 9, WOOD)
    c.fillStyle = '#0b0e14'
    c.beginPath()
    c.moveTo(-4.6, -13.6); c.lineTo(4.6, -13.6); c.lineTo(4.6, -8); c.quadraticCurveTo(4, -3.5, 0, -1.6); c.quadraticCurveTo(-4, -3.5, -4.6, -8)
    c.fill()
    c.fillStyle = col
    c.beginPath()
    c.moveTo(-3.8, -12.8); c.lineTo(3.8, -12.8); c.lineTo(3.8, -8); c.quadraticCurveTo(3.3, -4.2, 0, -2.6); c.quadraticCurveTo(-3.3, -4.2, -3.8, -8)
    c.fill()
    stroke(c, '#7d95b8', 1.2, () => { c.moveTo(-3.8, -12.8); c.lineTo(3.8, -12.8) })
    stroke(c, '#0b0e14', 1, () => { c.moveTo(0, -12.8); c.lineTo(0, -2.8); c.moveTo(-3.8, -9); c.lineTo(3.8, -9) })
    c.fillStyle = '#d8a060'
    c.fillRect(-0.9, -9.9, 1.8, 1.8)
    c.fillStyle = '#dfe8f3'
    c.fillRect(-4.4, -14.4, 8.8, 0.9)
  },
  // шестерня в профиль: зубья, обод, ступица цвета башни
  gear: (c, col) => {
    const R = 4.2
    c.fillStyle = '#0b0e14'
    c.beginPath()
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      const r = i % 2 ? R : R + 1.3
      c.lineTo(Math.cos(a) * r, -6 + Math.sin(a) * r * 0.9)
    }
    c.fill()
    c.fillStyle = '#56607a'
    c.beginPath()
    c.ellipse(0, -6, R - 0.6, (R - 0.6) * 0.9, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#7d95b8'
    c.beginPath()
    c.ellipse(-0.8, -6.8, R - 1.8, (R - 1.8) * 0.9, 0, Math.PI, Math.PI * 1.6)
    c.fill()
    c.fillStyle = col
    c.beginPath()
    c.ellipse(0, -6, 1.3, 1.2, 0, 0, Math.PI * 2)
    c.fill()
  },
  // спаренные стволы-пулемёт на станине
  gatling: (c) => {
    box(c, -1, -2, -1, 3, 4, 3, DARK)
    cylinderX(c, 1, -1.8, 1.6, 9, 1, IRON)
    cylinderX(c, 1, 0.4, 1.6, 9, 1, IRON)
    box(c, 3, -2.2, 1.4, 1.2, 4.6, 2.6, COPPER)
  },
  // парящая призма: высокий кристалл с гранями, ореол, осколки вокруг
  prism: (c, col) => {
    const g = c.createRadialGradient(0, -12, 0, 0, -12, 11)
    g.addColorStop(0, col + 'aa')
    g.addColorStop(1, col + '00')
    c.fillStyle = g
    c.fillRect(-11, -23, 22, 22)
    c.fillStyle = '#0b0e14'
    c.beginPath()
    c.moveTo(0, -22); c.lineTo(4.4, -12); c.lineTo(0, -2.6); c.lineTo(-4.4, -12)
    c.fill()
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.moveTo(0, -21); c.lineTo(-3.6, -12); c.lineTo(0, -3.6)
    c.fill()
    c.fillStyle = col
    c.beginPath()
    c.moveTo(0, -21); c.lineTo(3.6, -12); c.lineTo(0, -3.6)
    c.fill()
    c.globalAlpha = 0.6
    c.fillStyle = col
    c.beginPath()
    c.moveTo(0, -21); c.lineTo(-3.6, -12); c.lineTo(0, -3.6)
    c.fill()
    c.globalAlpha = 1
    for (const [x, y] of [[-6, -16], [6, -9], [-5, -6]]) {
      c.fillStyle = col
      c.fillRect(x - 0.6, y - 1.2, 1.2, 2.4)
    }
  },
  // лук: деревянные плечи дугой, тетива, стрела с наконечником
  bow: (c, col) => {
    stroke(c, '#0b0e14', 3.4, () => c.arc(0, -8, 7, Math.PI * 0.6, Math.PI * 1.4))
    stroke(c, '#7a5a40', 2.2, () => c.arc(0, -8, 7, Math.PI * 0.6, Math.PI * 1.4))
    const top = [Math.cos(Math.PI * 1.4) * 7, -8 + Math.sin(Math.PI * 1.4) * 7]
    const bot = [Math.cos(Math.PI * 0.6) * 7, -8 + Math.sin(Math.PI * 0.6) * 7]
    stroke(c, '#dfe8f3', 0.8, () => { c.moveTo(top[0], top[1]); c.lineTo(bot[0], bot[1]) })
    stroke(c, '#c8b090', 1.2, () => { c.moveTo(top[0] + 0.5, -8); c.lineTo(-8.5, -8) })
    c.fillStyle = col
    c.beginPath()
    c.moveTo(-10, -8); c.lineTo(-8, -9.2); c.lineTo(-8, -6.8)
    c.fill()
  },
  // арбалет на станке с оптическим прицелом и бликом линзы
  crossbow: (c, col) => {
    box(c, -1, -1, -1, 2, 2, 4, DARK)
    stroke(c, '#0b0e14', 3, () => { c.moveTo(-7, -4); c.lineTo(5, -6) })
    stroke(c, '#6e5038', 1.8, () => { c.moveTo(-7, -4); c.lineTo(5, -6) })
    stroke(c, '#0b0e14', 2.6, () => c.arc(-4.5, -4.4, 5, Math.PI * 0.25, Math.PI * 0.75, true))
    stroke(c, '#7d95b8', 1.4, () => c.arc(-4.5, -4.4, 5, Math.PI * 0.25, Math.PI * 0.75, true))
    cylinderX(c, -2, -1, 6.5, 6, 0.9, IRON)
    c.fillStyle = col
    c.fillRect(3.6, -7.9, 1.2, 1.2)
  },
  // сеть с крючьями, свисающая с балки
  net: (c) => {
    stroke(c, '#0b0e14', 2.4, () => { c.moveTo(-6, -14); c.lineTo(5, -15) })
    stroke(c, '#6e5038', 1.4, () => { c.moveTo(-6, -14); c.lineTo(5, -15) })
    for (let i = 0; i <= 4; i++) {
      const x = -5 + i * 2.4
      stroke(c, '#b8c0cc', 0.8, () => { c.moveTo(x, -14.4); c.quadraticCurveTo(x + 1.2, -8, x - 0.6, -3) })
    }
    for (let k = 0; k < 4; k++) stroke(c, '#8a96a8', 0.7, () => { c.moveTo(-5, -12 + k * 2.6); c.lineTo(5, -12.6 + k * 2.6) })
    for (const x of [-5.5, 4.5]) stroke(c, '#c9d6e6', 1, () => { c.moveTo(x, -3); c.arc(x + 0.8, -2.4, 0.8, Math.PI, Math.PI * 0.2, true) })
  },
  // плечи баллисты поперёк башни и болт
  ballista: (c, col) => {
    stroke(c, '#0b0e14', 3.6, () => { c.moveTo(-13, -2); c.quadraticCurveTo(0, -9, 13, -2) })
    stroke(c, '#7a5a40', 2.4, () => { c.moveTo(-13, -2); c.quadraticCurveTo(0, -9, 13, -2) })
    stroke(c, '#dfe8f3', 0.7, () => { c.moveTo(-13, -2); c.lineTo(0, 1); c.lineTo(13, -2) })
    stroke(c, '#0b0e14', 2, () => { c.moveTo(-2, 1.4); c.lineTo(9, -9) })
    stroke(c, '#c8b090', 1.2, () => { c.moveTo(-2, 1.4); c.lineTo(9, -9) })
    c.fillStyle = col
    c.beginPath()
    c.moveTo(10.6, -10.6); c.lineTo(7.6, -9.6); c.lineTo(9.6, -7.6)
    c.fill()
    c.fillStyle = '#dfe8f3'
    c.fillRect(-13.5, -3.2, 2, 1)
    c.fillRect(11.5, -3.2, 2, 1)
  },
  // рычаг камнемёта с ковшом и камнями, противовес
  catapult: (c) => {
    box(c, -1.5, -1.5, -1, 3, 3, 4, WOOD)
    stroke(c, '#0b0e14', 3, () => { c.moveTo(-1, -4); c.lineTo(-8, -15) })
    stroke(c, '#6e5038', 1.8, () => { c.moveTo(-1, -4); c.lineTo(-8, -15) })
    c.fillStyle = '#0b0e14'
    c.beginPath()
    c.ellipse(-8.6, -15.6, 2.6, 1.6, -0.6, 0, Math.PI * 2)
    c.fill()
    for (const [x, y, r] of [[-9.2, -17.2, 1.3], [-7.6, -17, 1], [-8.4, -18.4, 0.9]]) {
      c.fillStyle = '#5d6576'
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#9aa4b4'
      c.fillRect(x - r * 0.5, y - r * 0.6, r * 0.6, r * 0.4)
    }
    box(c, 0.5, -1, 1, 2.4, 2.4, 2.4, DARK)
    snowCap(c, 0.5, -1, 3.4, 2.4, 2.4, 5)
  },
  // паровой молот: цилиндр-поршень, шток и тяжёлая баба
  hammer: (c) => {
    box(c, -1.5, -1.5, 0, 3, 3, 12, IRON, 3)
    snowCap(c, -1.5, -1.5, 12, 3, 3, 9)
    box(c, -0.4, -0.4, -4, 0.8, 0.8, 4.5, COPPER)
    box(c, -2.4, -2.4, -7, 4.8, 4.8, 3.2, DARK, 0, 1.6)
    stroke(c, '#dfe8f3', 1, () => { c.arc(3, -10, 1.5, 0, Math.PI * 2) })
  },
  // короткая толстая мортира, задранная вверх, и стопка снарядов
  mortar: (c, col) => {
    box(c, -2, -2, -1, 4, 4, 3, DARK)
    c.save()
    c.translate(0, -4)
    c.rotate(-0.6)
    c.fillStyle = '#0b0e14'
    c.fillRect(-3.4, -10, 6.8, 11)
    c.fillStyle = '#3c4a62'
    c.fillRect(-2.7, -9.4, 5.4, 10)
    c.fillStyle = '#7d95b8'
    c.fillRect(-2.7, -9.4, 1.2, 10)
    c.fillStyle = COPPER.left
    c.fillRect(-3, -4, 6, 1.4)
    c.fillStyle = '#05070b'
    c.beginPath()
    c.ellipse(0, -9.6, 2.6, 1, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
    for (const [x, y] of [[4, -1], [6, -1], [5, -3]]) {
      c.fillStyle = '#0b0e14'
      c.beginPath()
      c.ellipse(x, y, 1.2, 1.4, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = col
      c.beginPath()
      c.ellipse(x - 0.2, y - 0.2, 0.8, 1, 0, 0, Math.PI * 2)
      c.fill()
    }
  },
  // таран: окованное бревно с железной головой
  ram: (c) => {
    cylinderX(c, -10, -1.4, -1, 14, 1.6, WOOD)
    box(c, -6, -1.6, -1.2, 1, 3.4, 3.4, COPPER)
    box(c, -1, -1.6, -1.2, 1, 3.4, 3.4, COPPER)
    c.fillStyle = '#0b0e14'
    c.beginPath()
    const [hx, hy] = P(4, 0.2, 0.6)
    c.moveTo(hx - 1, hy - 3); c.lineTo(hx + 5, hy); c.lineTo(hx - 1, hy + 3)
    c.fill()
    c.fillStyle = '#7d95b8'
    c.beginPath()
    c.moveTo(hx - 0.4, hy - 2.2); c.lineTo(hx + 3.8, hy); c.lineTo(hx - 0.4, hy)
    c.fill()
  },
  // ледяные шипы вокруг подножия
  ice: (c) => {
    for (const [x, h, w] of [[-9, 9, 2.4], [-5, 13, 3], [-1, 8, 2.2], [3, 11, 2.6], [7, 7, 2]]) {
      c.fillStyle = '#0e2032'
      c.beginPath()
      c.moveTo(x - w / 2 - 0.5, 0.5); c.lineTo(x, -h - 0.8); c.lineTo(x + w / 2 + 0.5, 0.5)
      c.fill()
      c.fillStyle = '#d8f0ff'
      c.beginPath()
      c.moveTo(x - w / 2, 0); c.lineTo(x, -h); c.lineTo(x, 0)
      c.fill()
      c.fillStyle = '#6fb8e8'
      c.beginPath()
      c.moveTo(x, 0); c.lineTo(x, -h); c.lineTo(x + w / 2, 0)
      c.fill()
    }
  },
  // песочные часы в латунной оправе: сыплется светящийся песок
  hourglass: (c, col) => {
    c.fillStyle = '#0b0e14'
    c.fillRect(-4, -16, 8, 1.6)
    c.fillRect(-4, -1.6, 8, 1.6)
    c.fillStyle = '#d8a060'
    c.fillRect(-3.6, -15.6, 7.2, 0.9)
    c.fillRect(-3.6, -1.2, 7.2, 0.9)
    stroke(c, '#d8a060', 1, () => { c.moveTo(-3.2, -15); c.lineTo(-3.2, -1.6); c.moveTo(3.2, -15); c.lineTo(3.2, -1.6) })
    c.fillStyle = 'rgba(200,220,255,0.35)'
    c.beginPath()
    c.moveTo(-2.6, -14.4); c.lineTo(2.6, -14.4); c.lineTo(0, -8.3); c.lineTo(2.6, -2.2); c.lineTo(-2.6, -2.2); c.lineTo(0, -8.3)
    c.fill()
    c.fillStyle = col
    c.beginPath()
    c.moveTo(-1.6, -12); c.lineTo(1.6, -12); c.lineTo(0, -8.6)
    c.fill()
    c.beginPath()
    c.moveTo(-2.4, -2.4); c.lineTo(2.4, -2.4); c.lineTo(0, -5)
    c.fill()
    c.fillRect(-0.25, -8.6, 0.5, 4)
  },
  // паровой котёл сбоку: медный бак, манометр, клапан с паром
  boiler: (c) => {
    cylinderX(c, -6, -2, 0, 9, 3, COPPER)
    c.fillStyle = '#0b0e14'
    c.beginPath()
    c.arc(-1, -6, 1.6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#e8e2d0'
    c.beginPath()
    c.arc(-1, -6, 1.1, 0, Math.PI * 2)
    c.fill()
    stroke(c, '#c02010', 0.5, () => { c.moveTo(-1, -6); c.lineTo(-0.3, -6.7) })
    for (const [x, y, r] of [[3, -13, 1.6], [4.6, -15.6, 2.2], [6.8, -18, 2.8]]) {
      c.fillStyle = 'rgba(230,236,245,0.55)'
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
    }
  },
  // громоотвод-катушка: медные витки на штанге и шарик-разрядник
  rod: (c, col) => {
    box(c, -0.5, -0.5, 0, 1, 1, 13, DARK)
    for (let z = 2; z < 11; z += 1.6) box(c, -1.3, -1.3, z, 2.6, 2.6, 0.7, COPPER)
    const [bx, by] = P(0, 0, 14.5)
    const g = c.createRadialGradient(bx, by, 0, bx, by, 5)
    g.addColorStop(0, col + 'cc')
    g.addColorStop(1, col + '00')
    c.fillStyle = g
    c.fillRect(bx - 5, by - 5, 10, 10)
    c.fillStyle = '#ffffff'
    c.beginPath()
    c.arc(bx, by, 1.3, 0, Math.PI * 2)
    c.fill()
  },
}

/**
 * Перекрасить тёплое свечение окон и огней в цвет стихии башни, а металл корпуса слегка
 * подтонировать тем же цветом — башни одной модели различаются и цветом, и силуэтом.
 */
function recolorGlow(c: Ctx, w: number, h: number, hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const tr = (n >> 16) & 255
  const tg = (n >> 8) & 255
  const tb = n & 255
  const id = c.getImageData(0, 0, w, h)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    if (d[i + 3] < 40) continue
    const warm = r > 130 && r - b > 50 && g > 45
    const snow = r > 150 && b > 170 && Math.abs(r - b) < 60
    if (!warm) {
      if (!snow) {
        // металл: 22% к цвету стихии, яркость сохраняется
        const l = (r + g + b) / 3 / 255
        d[i] = r * 0.78 + tr * l * 0.22 * 1.6
        d[i + 1] = g * 0.78 + tg * l * 0.22 * 1.6
        d[i + 2] = b * 0.78 + tb * l * 0.22 * 1.6
      }
      continue
    }
    const lum = Math.min(1.25, (r + g) / 2 / 200)
    d[i] = Math.min(255, tr * lum)
    d[i + 1] = Math.min(255, tg * lum)
    d[i + 2] = Math.min(255, tb * lum)
  }
  c.putImageData(id, 0, 0)
}

/** Готовая башня: картинка и опора (как у спрайтов листа) */
export interface TowerSprite {
  cv: HTMLCanvasElement
  ax: number
  h: number // высота картинки (опора — нижний край)
}

const PAD = 40
const cache = new Map<string, TowerSprite>()

/** Собрать облик башни; null — спрайт корпуса ещё грузится */
export function towerSprite(def: TowerDefinition, fallback: AssetName): TowerSprite | null {
  const hit = cache.get(def.id)
  if (hit) return hit
  const look = towerLook(def, fallback)
  const im = asset(look.art)
  if (!im) return null
  const m = ASSETS[look.art]
  const W = m.w + PAD * 2
  const H = m.h + PAD
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const c = cv.getContext('2d')!
  c.drawImage(im, PAD, PAD)
  if (look.glow) recolorGlow(c, W, H, look.glow)
  const slots = SLOTS[look.art]
  for (const [kind, slot] of look.parts) {
    const [sx, sy] = slots[slot]
    c.setTransform(U, 0, 0, U, PAD + sx, PAD + sy)
    PARTS[kind](c, look.glow ?? def.color)
  }
  // слитая — золотой венец из зубцов над верхушкой
  if (def.merged) {
    const [tx, ty] = slots.top
    c.setTransform(U, 0, 0, U, PAD + tx, PAD + ty - 4)
    for (let i = 0; i < 5; i++) {
      const x = -6 + i * 3
      c.fillStyle = '#0b0e14'
      c.beginPath()
      c.moveTo(x - 1.4, 0.6); c.lineTo(x, -3.4 - (i % 2) * 1.6); c.lineTo(x + 1.4, 0.6)
      c.fill()
      c.fillStyle = '#ffd76a'
      c.beginPath()
      c.moveTo(x - 0.9, 0); c.lineTo(x, -2.6 - (i % 2) * 1.6); c.lineTo(x + 0.9, 0)
      c.fill()
    }
    c.fillStyle = '#ffd76a'
    c.fillRect(-7, -0.2, 14, 1.2)
  }
  c.setTransform(1, 0, 0, 1, 0, 0)
  const sprite = { cv, ax: m.ax + PAD, h: H }
  cache.set(def.id, sprite)
  return sprite
}

const thumbs = new Map<string, string>()
/** Картинка башни для карточки арсенала (data URL); пока корпус грузится — исходный спрайт */
export function towerThumbUrl(def: TowerDefinition, fallback: AssetName): string {
  const hit = thumbs.get(def.id)
  if (hit) return hit
  const s = towerSprite(def, fallback)
  if (!s) return `/assets/${towerLook(def, fallback).art}.png`
  const url = s.cv.toDataURL()
  thumbs.set(def.id, url)
  return url
}
