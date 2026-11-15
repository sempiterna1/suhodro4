// Проверка лесенки кампании: каждая следующая карта слайсера сложнее
// (hpMult ×1.00 → ×1.40), а мета-детали «Верстака» должны компенсировать рост,
// чтобы карта N+1 не становилась стеной и не была пустяком после карты N.
//
// Модель бюджета деталей, заработанных к карте N:
//   clear — консервативно: только сундуки за первое прохождение (3–5, в среднем 4);
//   daily — обычный темп: + дневной сундук (2–4) и три задачи дня (3×1–3) на карту;
//   daily/achievement — с ачивками (6 сундуков 1–3 за кампанию, примерно по 2 к шагу).
//
//   npx tsx scripts/balance-ladder.ts
//   npx tsx scripts/balance-ladder.ts --seeds 5 --model daily --difficulty veteran
//   npx tsx scripts/balance-ladder.ts --json %TEMP%/ladder.json
//
// Внимание: scripted-политика не пользуется ремонтом здания — это нижняя оценка
// человеческой игры по выживаемости, но верхняя по скорости застройки.

import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { CHESTS, PARTS, rollChest } from '../src/game/data/meta'
import { MAP_DEFS } from '../src/game/data/maps'
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../src/game/data/difficulties'
import { runSimulation, type SimPolicyId, type SimReport } from '../src/game/sim'
import { mulberry32 } from '../src/game/rng'

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '6' },
    difficulty: { type: 'string', default: 'veteran' },
    shop: { type: 'string', default: 'all' },
    policy: { type: 'string', default: 'scripted' },
    model: { type: 'string', default: 'daily' },
    json: { type: 'string' },
  },
})

const policy = values.policy as SimPolicyId
if (!['none', 'random', 'scripted'].includes(policy)) throw new Error(`Неизвестная политика: ${values.policy}`)
const shop = values.shop as 'all' | 'pool'
if (!['all', 'pool'].includes(shop)) throw new Error(`Неизвестный магазин: ${values.shop}`)
const difficulty = values.difficulty as DifficultyId
if (!DIFFICULTY_IDS.includes(difficulty)) throw new Error(`Неизвестная сложность: ${values.difficulty}`)
const seeds = Math.max(1, Math.min(20, Number(values.seeds) || 3))
const model = values.model as 'clear' | 'daily' | 'achievement'
if (!['clear', 'daily', 'achievement'].includes(model)) throw new Error(`Неизвестная модель: ${values.model}`)

const SEED_BASE = 20261029
const SEED_STEP = 7919

/** Бюджет единиц деталей, заработанных к началу карты с индексом i (0-based) */
function budgetFor(i: number): number {
  if (model === 'clear') return 4 * i // только сундуки за первое прохождение (3–5, среднее 4)
  if (model === 'daily') return 13 * i // + дневной сундук (3) и три задачи дня (6) на карту
  return 15 * i // + ачивки (6 сундуков 1–3 за кампанию, ~2 на шаг)
}

/**
 * Раскладка бюджета по деталям как у настоящих сундуков: случайные единицы
 * с весом DROP_WEIGHT (стартовые башни чаще), фиксированное зерно — чтобы
 * прогоны были воспроизводимы.
 */
function partsFor(units: number, salt: number): Record<string, number> {
  if (units <= 0) return {}
  const chest = { ...CHESTS.repeatWin, units: [units, units] as [number, number] }
  const drop = rollChest(chest, mulberry32(20260000 + salt * 977 + units))
  return Object.fromEntries(drop.map((d) => [d.partId, d.units]))
}

const diff = DIFFICULTIES[difficulty]
const fmt = (s: number) => {
  const total = Math.round(s)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0)

interface Row {
  map: string
  mapName: string
  mapIndex: number
  hpMult: number
  budget: number
  metaUnits: number
  seed: number
  outcome: string
  waves: number
  combat: number
  buildingPct: number
  leaks: number
  /** поражение раньше 10-й волны — ранняя стена */
  early: boolean
}

const rows: Row[] = []
const started = Date.now()
for (let i = 0; i < MAP_DEFS.length; i++) {
  const map = MAP_DEFS[i]
  const budget = budgetFor(i)
  const parts = partsFor(budget, i)
  for (let s = 0; s < seeds; s++) {
    const seed = SEED_BASE + s * SEED_STEP
    const r: SimReport = runSimulation({
      seed,
      policy,
      mapId: map.id,
      difficulty,
      shop,
      parts,
      maxSeconds: 60 * 60,
    })
    rows.push({
      map: map.id,
      mapName: map.name,
      mapIndex: i,
      hpMult: map.hpMult,
      budget,
      metaUnits: r.metaUnits,
      seed,
      outcome: r.outcome,
      waves: r.wavesCompleted,
      combat: r.combatSeconds,
      buildingPct: r.buildingMaxHp > 0 ? (100 * r.buildingHp) / r.buildingMaxHp : 0,
      leaks: r.stats.leaked,
      early: r.outcome === 'lost' && r.wavesCompleted < 10,
    })
  }
}

console.log(
  `Лесенка карт: политика ${policy} · ${diff.name} · магазин ${shop} · зёрен на карту ${seeds} · ` +
    `модель деталей «${model}» (${rows.length} прогонов, ${Math.round((Date.now() - started) / 1000)} с)`,
)
console.log(`Деталей в коллекции всего: ${PARTS.length} слотов · полностью собранная башня ≈ +28% DPS\n`)

const head = ['#', 'карта', '×HP', 'деталей', 'побед', 'волн', 'здание', 'утечки', 'ранних', 'бой']
console.log(
  head[0].padStart(2) + '  ' +
    head[1].padEnd(20) + head[2].padStart(5) + head[3].padStart(9) + head[4].padStart(9) +
    head[5].padStart(7) + head[6].padStart(8) + head[7].padStart(8) + head[8].padStart(8) + head[9].padStart(8),
)
for (const map of MAP_DEFS) {
  const rs = rows.filter((r) => r.map === map.id)
  const wins = rs.filter((r) => r.outcome === 'won').length
  console.log(
    String(rs[0].mapIndex + 1).padStart(2) + '  ' +
      map.name.padEnd(20) +
      `×${map.hpMult.toFixed(2)}`.padStart(5) +
      String(rs[0].budget).padStart(9) +
      `${wins}/${rs.length} (${pct(wins, rs.length)}%)`.padStart(9) +
      avg(rs.map((r) => r.waves)).toFixed(1).padStart(7) +
      `${avg(rs.map((r) => r.buildingPct)).toFixed(0)}%`.padStart(8) +
      avg(rs.map((r) => r.leaks)).toFixed(1).padStart(8) +
      String(rs.filter((r) => r.early).length).padStart(8) +
      fmt(avg(rs.map((r) => r.combat))).padStart(8),
  )
}

// Шаг лесенки: насколько следующая карта сложнее предыдущей при её бюджете деталей.
// Scripted-политика почти не выигрывает миссии (известная проблема задачи 19), поэтому
// вердикт считаем по выживаемости: сколько волн в среднем держится оборона. «Стена» —
// карта теряет больше 40% волн или в четверти прогонов оборона падает раньше 10-й волны;
// «пустяк» — следующая карта держится дольше предыдущей.
console.log('\nШаг лесенки (карта N+1 против карты N при заработанной мете):')
for (let i = 1; i < MAP_DEFS.length; i++) {
  const prev = rows.filter((r) => r.mapIndex === i - 1)
  const cur = rows.filter((r) => r.mapIndex === i)
  const prevWaves = avg(prev.map((r) => r.waves))
  const curWaves = avg(cur.map((r) => r.waves))
  const ratio = prevWaves > 0 ? curWaves / prevWaves : 1
  const earlyShare = cur.filter((r) => r.early).length / cur.length
  const stepBudget = budgetFor(i) - budgetFor(i - 1)
  const verdict =
    ratio < 0.6 || earlyShare >= 0.25 ? 'СТЕНА' : ratio > 1.1 ? 'пустяк' : 'в норме'
  console.log(
    `  ${MAP_DEFS[i - 1].name} → ${MAP_DEFS[i].name}: волн ${curWaves >= prevWaves ? '+' : ''}${(curWaves - prevWaves).toFixed(1)} ` +
      `(${Math.round(ratio * 100)}% от прошлой), ранних ${Math.round(earlyShare * 100)}%, деталей +${stepBudget} — ${verdict}`,
  )
}

if (values.json) {
  writeFileSync(values.json, JSON.stringify({ model, difficulty, shop, policy, seeds, rows }, null, 2) + '\n', 'utf8')
  console.log(`\nJSON: ${values.json}`)
}
