// Сводка баланса этапа 2: win-rate, длина миссии и «стены» по волнам
// для трёх сложностей на выборке карт и зёрен. Использует тот же движок,
// что и игра, поэтому цифры воспроизводимы.
//
//   npx tsx scripts/balance.ts
//   npx tsx scripts/balance.ts --policy random
//   npx tsx scripts/balance.ts --seeds 10 --difficulty nightmare
//
// «Стена» — поражение раньше 10/20-й волны: сигнал, что сложность
// ломает прогрессию, а не проверяет навык.

import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { MAP_DEFS } from '../src/game/data/maps'
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../src/game/data/difficulties'
import { runSimulation, type SimPolicyId, type SimReport } from '../src/game/sim'

const { values } = parseArgs({
  options: {
    policy: { type: 'string', default: 'scripted' },
    seeds: { type: 'string', default: '6' },
    difficulty: { type: 'string', default: 'all' },
    maps: { type: 'string', default: 'all' },
    json: { type: 'string' },
  },
})

const policy = values.policy as SimPolicyId
if (!['none', 'random', 'scripted'].includes(policy)) throw new Error(`Неизвестная политика: ${policy}`)
const runsPerMap = Math.max(1, Math.min(20, Number(values.seeds) || 6))
const difficulties: DifficultyId[] =
  values.difficulty === 'all'
    ? DIFFICULTY_IDS
    : DIFFICULTY_IDS.filter((d) => d === values.difficulty)
if (difficulties.length === 0) throw new Error(`Неизвестная сложность: ${values.difficulty}`)
const maps = values.maps === 'all' ? MAP_DEFS : MAP_DEFS.filter((m) => m.id === values.maps)
if (maps.length === 0) throw new Error(`Неизвестная карта: ${values.maps}`)

const SEED_BASE = 20261029
const SEED_STEP = 7919

interface Row {
  difficulty: DifficultyId
  map: string
  seed: number
  outcome: string
  waves: number
  combat: number
  mission: number
  buildingPct: number
  leaks: number
  bosses: number
}

const rows: Row[] = []
for (const difficulty of difficulties) {
  for (const map of maps) {
    for (let i = 0; i < runsPerMap; i++) {
      const seed = SEED_BASE + i * SEED_STEP
      const r: SimReport = runSimulation({
        seed,
        policy,
        mapId: map.id,
        difficulty,
        maxSeconds: 60 * 60,
      })
      rows.push({
        difficulty,
        map: map.id,
        seed,
        outcome: r.outcome,
        waves: r.wavesCompleted,
        combat: r.combatSeconds,
        mission: r.estimatedMissionSeconds,
        buildingPct: r.buildingMaxHp > 0 ? (100 * r.buildingHp) / r.buildingMaxHp : 0,
        leaks: r.stats.leaked,
        bosses: r.stats.bossKills,
      })
    }
  }
}

const fmt = (s: number) => {
  const total = Math.round(s)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

console.log(
  `Баланс: политика ${policy} · карт ${maps.length} · зёрен на карту ${runsPerMap} · прогонов ${rows.length}`
)
for (const difficulty of difficulties) {
  const rs = rows.filter((r) => r.difficulty === difficulty)
  const wins = rs.filter((r) => r.outcome === 'won')
  const early = rs.filter((r) => r.outcome === 'lost' && r.waves < 10)
  const mid = rs.filter((r) => r.outcome === 'lost' && r.waves >= 10 && r.waves < 20)
  const late = rs.filter((r) => r.outcome === 'lost' && r.waves >= 20)
  const d = DIFFICULTIES[difficulty]
  console.log(
    `\n${d.name} (цель ~${d.targetWinRate}%): побед ${wins.length}/${rs.length} = ` +
      `${Math.round((100 * wins.length) / rs.length)}%`
  )
  console.log(
    `  длина: бой ${fmt(avg(rs.map((r) => r.combat)))} · с паузами ${fmt(avg(rs.map((r) => r.mission)))} · ` +
      `волн в среднем ${avg(rs.map((r) => r.waves)).toFixed(1)}/${30}`
  )
  console.log(
    `  поражения: до 10-й — ${early.length}, 10–19 — ${mid.length}, 20+ — ${late.length} · ` +
      `здание в конце ${avg(rs.map((r) => r.buildingPct)).toFixed(0)}% · утечек ${avg(rs.map((r) => r.leaks)).toFixed(1)}`
  )
  const walls = [...new Map(early.map((r) => [r.waves, 0])).keys()].sort((a, b) => a - b)
  if (walls.length) console.log(`  ранние поражения на волнах: ${walls.join(', ')}`)
  if (maps.length > 1) {
    for (const m of maps) {
      const mr = rs.filter((r) => r.map === m.id)
      if (!mr.length) continue
      const mw = mr.filter((r) => r.outcome === 'won').length
      console.log(
        `  ${m.name}: побед ${mw}/${mr.length} · бой ${fmt(avg(mr.map((r) => r.combat)))} · ` +
          `миссия ${fmt(avg(mr.map((r) => r.mission)))}`
      )
    }
  }
}

if (values.json) {
  writeFileSync(values.json, JSON.stringify(rows, null, 2) + '\n', 'utf8')
  console.log(`\nJSON: ${values.json}`)
}
