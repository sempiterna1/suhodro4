// Биомы карт «Железного Разлома» (GDD «Карты и сложности»): у каждой карты свой облик.
// Биом задаёт палитру земли, материал настила, утёс, озеро, мелочи на грунте, наборы пропсов,
// частицы в воздухе, цвет сумрака и дымку. Лагерь беженцев — паровая база — один на всех картах:
// беженцы тащат свой снег за собой, а земля вокруг лагеря подстраивается под биом (camp.dirt).
//
// Мир везде холодный (lore), биомы — разные земли одной замёрзшей границы:
// taiga      — зимняя тайга (Пограничный тракт)
// marsh      — туманное болото у мельницы (Старая мельница)
// canyon     — каменное ущелье (Каменный мост)
// wasteland  — выжженная пустошь у шахт (Заброшенные шахты)
// highland   — снежные высокогорья (Ледяной перевал)
// ashvalley  — пепельная долина Разлома (Пепельная долина)

import type { AssetName } from './assets'

export type BiomeId = 'taiga' | 'marsh' | 'canyon' | 'wasteland' | 'highland' | 'ashvalley'
export type RGB = [number, number, number]

/** Материал настила тропы */
export type RoadStyle = 'wood' | 'bogwood' | 'stone' | 'gravel' | 'ice' | 'ash'
/** Водоём: замёрзшее озеро, мутное болото или нет воды */
export type LakeStyle = 'frozen' | 'bog' | 'none'
/** Частицы в воздухе над полем (pixel.ts drawMotes) */
export type MotesStyle = 'snow' | 'blizzard' | 'ash' | 'dust' | 'mist' | 'ember'

/** Взвешенный пропуск из набора спрайтов: names — случайный из списка, light — подсветка */
export interface PropEntry {
  names: AssetName[]
  w: number
  s?: [number, number] // диапазон масштаба
  light?: 'lantern' | 'window'
  flip?: boolean // чаще перевёрнут
}

/** Мелочи, вписанные прямо в грунт (groundDetails): [количество, цвета...] */
export interface GroundDetails {
  drifts?: [number, string, string] // сугробы по ветру: светлый верх, синяя тень
  boulders?: [number, string, string, string | null] // камни: тёмный, средний, снежная шапка
  grass?: [number, string, string] // сухая трава из-под снега
  tracks?: [number, string] // цепочки следов
  ruts?: [number, string] // колея от саней
  boards?: [number, string, string, string | null] // обломки досок: дерево, светлые торцы, налёт (снег/пепел)
  crust?: [number, string, string] // наст: блестящий снег с искрами
  cracks?: [number, string] // трещины сухого грунта
  ash?: [number, string, string] // пепельные бугры
  coal?: [number, string, string] // уголь и шлак
  pebbles?: [number, string, string] // галька
  sheen?: [number, string, string] // ледяные блики на камне
}

export interface BiomeDef {
  id: BiomeId
  name: string
  /** Палитра земли: на поле и за краем (низина) + редкие светлые/тёмные крапинки */
  ground: { plateau: RGB[]; lowland: RGB[]; dithHi: RGB; dithLo: RGB }
  road: RoadStyle
  /** Утёс под передним краем: снежная кромка, породы склона и светлые прожилки */
  cliff: { cap: RGB; capDeep: RGB; face: RGB[]; streak: RGB }
  lake: LakeStyle
  /** Виньетка по краям холста */
  vignette: string
  /** Земля вокруг лагеря: цвет утоптанного грунта и доля пятен */
  camp: { dirt: RGB; trample: number }
  /** Атмосфера */
  motes: MotesStyle
  dusk: string // цвет сумрака «r,g,b» (lighting.ts)
  ambient: number // плотность сумрака 0..1
  fog: { rgb: string; k: number } // цвет дымки и сила (drawFog)
  drift: { color: string; k: number } // позёмка: цвет и сила (drawDrift)
  /** Мелочи на грунте */
  details: GroundDetails
  /** Пропсы: вблизи тропы (1 клетка), средняя зона (2), дальняя (3+); особые одиноки */
  props: {
    near: PropEntry[]
    mid: PropEntry[]
    far: PropEntry[]
    wild: PropEntry[] // дикий лес за краем поля
    tower: boolean // вышка с прожектором
    wreck: boolean // обломки вездехода
    fires: number // костры на поле
    huts: number // построек на поле
    hutPool: AssetName[]
  }
}

const PINE: PropEntry = { names: ['prop-pine'], w: 0.09, s: [0.28, 0.36], flip: true }
const PINE_GROVE: PropEntry = { names: ['prop-pines'], w: 0.08, s: [0.32, 0.42], flip: true }
const DEADTREE: PropEntry = { names: ['prop-deadtree'], w: 0.08, s: [0.3, 0.4], flip: true }
const ROCK: PropEntry = { names: ['prop-rock', 'prop-rubble'], w: 0.06, s: [0.22, 0.3], flip: true }
const CLIFF_ROCK: PropEntry = { names: ['prop-cliff'], w: 0.05, s: [0.26, 0.34], flip: true }
const CRATES: PropEntry = { names: ['prop-crate', 'prop-barrel', 'prop-box'], w: 0.04 }
const CRATE_STACK: PropEntry = { names: ['prop-crates', 'prop-crates2'], w: 0.04 }
const LAMP: PropEntry = { names: ['prop-lamp'], w: 0.02, s: [0.3, 0.32], light: 'lantern' }
const SIGN: PropEntry = { names: ['prop-sign'], w: 0.015, s: [0.26, 0.28], flip: true }
const FLAG: PropEntry = { names: ['prop-flag'], w: 0.02, s: [0.3, 0.34], flip: true }
const SLED: PropEntry = { names: ['prop-sled'], w: 0.02, s: [0.3, 0.32] }
const FENCE: PropEntry = { names: ['prop-fence', 'prop-fence2', 'prop-fence3'], w: 0.025, s: [0.32, 0.34], flip: true }

export const BIOMES: Record<BiomeId, BiomeDef> = {
  // ── Пограничный тракт: зимняя тайга — эталонный облик мира ──────────────
  taiga: {
    id: 'taiga',
    name: 'Зимняя тайга',
    ground: {
      plateau: [[132, 150, 176], [141, 159, 184], [124, 142, 168], [150, 168, 192], [160, 177, 200]],
      lowland: [[98, 114, 140], [105, 122, 148], [92, 107, 133], [112, 129, 155]],
      dithHi: [228, 236, 246],
      dithLo: [70, 82, 104],
    },
    road: 'wood',
    cliff: { cap: [214, 225, 238], capDeep: [178, 192, 212], face: [[58, 66, 82], [44, 51, 65], [35, 41, 53]], streak: [120, 136, 160] },
    lake: 'frozen',
    vignette: 'rgba(6,12,30,0.38)',
    camp: { dirt: [110, 104, 104], trample: 0.28 },
    motes: 'snow',
    dusk: '8,14,36',
    ambient: 0.42,
    fog: { rgb: '200,216,240', k: 1 },
    drift: { color: '230,240,255', k: 1 },
    details: {
      drifts: [120, '#d6e1ee', '#6c7d98'],
      boulders: [90, '#2c3340', '#3e4758', '#dfe8f2'],
      grass: [110, '#9a8a62', '#7a6a48'],
      tracks: [8, '#7889a4'],
      ruts: [2, '#8495b0'],
      boards: [26, '#5a4030', '#7a5a40', '#dfe8f2'],
      crust: [60, '#f2f7ff', '#c2cfe0'],
    },
    props: {
      near: [ROCK, CRATES, SIGN, { ...LAMP, names: ['prop-lamp2'] }],
      mid: [PINE, ROCK, CRATES, LAMP],
      far: [PINE, PINE_GROVE, ROCK, CRATE_STACK, SLED, SIGN, FLAG, FENCE],
      wild: [{ ...PINE, w: 0.5 }, { ...PINE_GROVE, w: 0.12 }, { ...ROCK, w: 0.04 }],
      tower: true,
      wreck: true,
      fires: 2,
      huts: 3,
      hutPool: ['prop-shed', 'prop-cabin', 'prop-tent'],
    },
  },

  // ── Старая мельница: туманное болото — мхи, мёртвые деревья, тяжёлый туман ─
  marsh: {
    id: 'marsh',
    name: 'Туманное болото',
    ground: {
      plateau: [[96, 106, 96], [88, 98, 90], [104, 112, 100], [80, 90, 84], [112, 120, 106]],
      lowland: [[62, 72, 64], [56, 66, 60], [70, 78, 68], [50, 60, 54]],
      dithHi: [168, 176, 158],
      dithLo: [38, 48, 42],
    },
    road: 'bogwood',
    cliff: { cap: [154, 164, 148], capDeep: [116, 128, 112], face: [[34, 44, 38], [26, 34, 30], [20, 27, 23]], streak: [70, 82, 62] },
    lake: 'bog',
    vignette: 'rgba(4,10,8,0.44)',
    camp: { dirt: [96, 92, 82], trample: 0.3 },
    motes: 'mist',
    dusk: '8,16,12',
    ambient: 0.47,
    fog: { rgb: '158,176,160', k: 1.45 },
    drift: { color: '205,222,205', k: 0.75 },
    details: {
      drifts: [36, '#9aa89a', '#4c584a'],
      boulders: [50, '#26302a', '#34403a', null],
      grass: [150, '#4e5c40', '#36422c'],
      tracks: [8, '#5d6b58'],
      ruts: [1, '#5d6b58'],
      boards: [18, '#3e3428', '#544838', null],
    },
    props: {
      near: [ROCK, CRATES, SIGN, { ...LAMP, names: ['prop-lamp2'] }],
      mid: [DEADTREE, ROCK, CRATES, LAMP],
      far: [DEADTREE, PINE, ROCK, FENCE, CRATE_STACK, FLAG],
      wild: [{ ...DEADTREE, w: 0.38 }, { ...PINE, w: 0.2 }, { ...ROCK, w: 0.05 }, { ...CLIFF_ROCK, w: 0.03 }],
      tower: true,
      wreck: true,
      fires: 1,
      huts: 3,
      hutPool: ['prop-shed', 'prop-cabin', 'prop-tent'],
    },
  },

  // ── Каменный мост: каменное ущелье — скалы, щебень, пыльные ветра ────────
  canyon: {
    id: 'canyon',
    name: 'Каменное ущелье',
    ground: {
      plateau: [[136, 122, 106], [124, 110, 96], [146, 132, 114], [112, 100, 88], [128, 116, 100]],
      lowland: [[96, 86, 76], [88, 78, 70], [104, 92, 82], [80, 72, 64]],
      dithHi: [196, 180, 156],
      dithLo: [52, 44, 38],
    },
    road: 'stone',
    cliff: { cap: [186, 172, 152], capDeep: [148, 134, 116], face: [[64, 54, 46], [50, 42, 36], [38, 32, 28]], streak: [168, 152, 128] },
    lake: 'none',
    vignette: 'rgba(16,8,4,0.36)',
    camp: { dirt: [104, 92, 80], trample: 0.34 },
    motes: 'dust',
    dusk: '30,18,10',
    ambient: 0.4,
    fog: { rgb: '210,182,150', k: 0.7 },
    drift: { color: '222,202,170', k: 0.7 },
    details: {
      boulders: [120, '#3a2f26', '#4c3e32', null],
      grass: [30, '#8a7a54', '#6a5c40'],
      tracks: [6, '#7a6a54'],
      ruts: [1, '#6a5c48'],
      boards: [10, '#4e3a2a', '#6a5038', null],
      cracks: [60, '#3f362c'],
      pebbles: [90, '#5e5142', '#7a6a56'],
    },
    props: {
      near: [ROCK, CRATES, SIGN],
      mid: [ROCK, CLIFF_ROCK, CRATES, FLAG],
      far: [CLIFF_ROCK, ROCK, DEADTREE, CRATE_STACK, FLAG, FENCE],
      wild: [{ ...CLIFF_ROCK, w: 0.34 }, { ...ROCK, w: 0.24 }, { ...DEADTREE, w: 0.06 }],
      tower: true,
      wreck: true,
      fires: 1,
      huts: 2,
      hutPool: ['prop-shed', 'prop-tent'],
    },
  },

  // ── Заброшенные шахты: выжженная пустошь — шлак, уголь, пепел ────────────
  wasteland: {
    id: 'wasteland',
    name: 'Выжженная пустошь',
    ground: {
      plateau: [[76, 68, 62], [66, 60, 56], [86, 76, 68], [58, 54, 50], [72, 66, 60]],
      lowland: [[52, 46, 42], [46, 42, 40], [58, 52, 46], [40, 36, 34]],
      dithHi: [148, 138, 124],
      dithLo: [26, 22, 20],
    },
    road: 'gravel',
    cliff: { cap: [120, 110, 100], capDeep: [92, 84, 76], face: [[40, 34, 30], [30, 26, 24], [22, 20, 18]], streak: [96, 86, 74] },
    lake: 'none',
    vignette: 'rgba(8,6,4,0.4)',
    camp: { dirt: [92, 84, 74], trample: 0.32 },
    motes: 'ash',
    dusk: '16,10,8',
    ambient: 0.46,
    fog: { rgb: '128,116,104', k: 1.05 },
    drift: { color: '150,140,130', k: 0.85 },
    details: {
      boulders: [60, '#221c18', '#2e2620', null],
      grass: [25, '#6a5a40', '#4e422e'],
      tracks: [5, '#4c443a'],
      ruts: [1, '#4c443a'],
      boards: [30, '#382a1e', '#4c3a2a', '#8a8078'],
      cracks: [50, '#2c241c'],
      ash: [70, '#524a42', '#38322e'],
      coal: [60, '#2e2620', '#16120e'],
      pebbles: [40, '#4c4238', '#5e5246'],
    },
    props: {
      near: [{ ...ROCK, names: ['prop-rubble'] }, CRATES, { ...LAMP, names: ['prop-lamp2'] }],
      mid: [{ ...ROCK, names: ['prop-rubble'] }, DEADTREE, CRATE_STACK, LAMP],
      far: [{ ...ROCK, names: ['prop-rubble'], w: 0.12 }, DEADTREE, CRATE_STACK, CRATES, ROCK, FLAG],
      wild: [{ ...ROCK, names: ['prop-rubble'], w: 0.3 }, { ...DEADTREE, w: 0.2 }, { ...ROCK, w: 0.1 }],
      tower: true,
      wreck: true,
      fires: 2,
      huts: 3,
      hutPool: ['prop-shed', 'prop-tent'],
    },
  },

  // ── Ледяной перевал: снежные высокогорья — пурга, наст, ледяные блики ────
  highland: {
    id: 'highland',
    name: 'Снежные высокогорья',
    ground: {
      plateau: [[156, 172, 198], [166, 180, 204], [148, 164, 190], [176, 190, 212], [186, 198, 218]],
      lowland: [[116, 132, 158], [124, 140, 164], [108, 124, 150], [132, 148, 172]],
      dithHi: [242, 248, 255],
      dithLo: [78, 90, 116],
    },
    road: 'ice',
    cliff: { cap: [232, 240, 250], capDeep: [196, 210, 228], face: [[52, 62, 84], [40, 48, 68], [30, 37, 54]], streak: [176, 196, 222] },
    lake: 'frozen',
    vignette: 'rgba(6,10,34,0.42)',
    camp: { dirt: [118, 114, 112], trample: 0.26 },
    motes: 'blizzard',
    dusk: '6,10,40',
    ambient: 0.5,
    fog: { rgb: '224,232,252', k: 1.3 },
    drift: { color: '238,244,255', k: 1.25 },
    details: {
      drifts: [160, '#e2eaf4', '#7488a4'],
      boulders: [90, '#2e3644', '#404a5c', '#e8f0fa'],
      grass: [40, '#9a8a62', '#7a6a48'],
      tracks: [6, '#84a0be'],
      ruts: [1, '#90a8c4'],
      boards: [12, '#54402e', '#6e5440', '#dfe8f2'],
      crust: [90, '#ffffff', '#d2e0f0'],
      sheen: [50, '#dceafc', '#a8c4e0'],
    },
    props: {
      near: [ROCK, CRATES, SIGN, { ...LAMP, names: ['prop-lamp2'] }],
      mid: [{ ...PINE, w: 0.12 }, ROCK, CRATES, LAMP],
      far: [{ ...PINE, w: 0.16 }, { ...PINE_GROVE, w: 0.12 }, ROCK, FLAG, SLED, FENCE],
      wild: [{ ...PINE, w: 0.42 }, { ...PINE_GROVE, w: 0.1 }, { ...ROCK, w: 0.06 }],
      tower: true,
      wreck: true,
      fires: 2,
      huts: 2,
      hutPool: ['prop-tent', 'prop-cabin'],
    },
  },

  // ── Пепельная долина: пепел вулканов и зелень Разлома повсюду ────────────
  ashvalley: {
    id: 'ashvalley',
    name: 'Пепельная долина',
    ground: {
      plateau: [[94, 90, 100], [82, 78, 88], [106, 100, 110], [70, 66, 76], [88, 86, 94]],
      lowland: [[64, 60, 72], [58, 54, 64], [72, 66, 78], [50, 46, 56]],
      dithHi: [162, 168, 172],
      dithLo: [30, 26, 40],
    },
    road: 'ash',
    cliff: { cap: [140, 136, 148], capDeep: [108, 104, 116], face: [[38, 34, 46], [28, 26, 36], [20, 18, 27]], streak: [92, 118, 92] },
    lake: 'none',
    vignette: 'rgba(10,6,18,0.42)',
    camp: { dirt: [96, 90, 92], trample: 0.3 },
    motes: 'ember',
    dusk: '12,8,22',
    ambient: 0.48,
    fog: { rgb: '150,180,150', k: 0.85 },
    drift: { color: '172,182,176', k: 0.8 },
    details: {
      boulders: [70, '#1e1a26', '#2c2636', null],
      grass: [20, '#5e5a44', '#424032'],
      tracks: [4, '#585262'],
      boards: [14, '#332a22', '#463a2e', '#9a948e'],
      cracks: [60, '#26202c'],
      ash: [80, '#585260', '#3e3846'],
      coal: [30, '#241f2c', '#14101a'],
      pebbles: [50, '#4c4656', '#5e5868'],
    },
    props: {
      near: [{ ...ROCK, names: ['prop-rubble'] }, CRATES],
      mid: [{ ...DEADTREE, w: 0.1 }, { ...ROCK, names: ['prop-rubble'] }, CRATES],
      far: [{ ...DEADTREE, w: 0.14 }, { ...ROCK, names: ['prop-rubble'], w: 0.1 }, ROCK, CRATE_STACK, FLAG],
      wild: [{ ...DEADTREE, w: 0.3 }, { ...ROCK, names: ['prop-rubble'], w: 0.22 }, { ...ROCK, w: 0.08 }],
      tower: true,
      wreck: true,
      fires: 2,
      huts: 2,
      hutPool: ['prop-tent', 'prop-shed'],
    },
  },
}

/** Биом по id с запасным тайгой (чужие зерна → Пограничный тракт) */
export const biomeOf = (id: string): BiomeDef => (BIOMES as Record<string, BiomeDef>)[id] ?? BIOMES.taiga
