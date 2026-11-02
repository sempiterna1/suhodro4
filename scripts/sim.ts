// CLI headless-симулятора «Последнего горизонта» (этап 1).
//
// Примеры:
//   npx tsx scripts/sim.ts
//   npx tsx scripts/sim.ts --policy none --seed 7
//   npx tsx scripts/sim.ts --policy scripted --map valley --seed 42 --json reports/valley.json --csv reports/valley.csv
//   npx tsx scripts/sim.ts --shop pool --max-waves 10
//
// Отчёт по волнам: золото, утечки, урон, DPS, постройки, слияния, фазы боссов.
// Один и тот же --seed даёт побайтно одинаковый JSON (кроме времени расчёта в консоли).

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { MAP_DEFS } from '../src/game/data/maps'
import { TOTAL_WAVES } from '../src/game/data/waves'
import { AVATAR_IDS } from '../src/game/data/avatars'
import {
  outcomeLabel,
  runSimulation,
  type SimOptions,
  type SimPolicyId,
  type SimReport,
  type SimWaveRow,
} from '../src/game/sim'

const POLICIES: SimPolicyId[] = ['none', 'random', 'scripted']

function usage() {
  console.log(`Последний горизонт — headless-симулятор миссии (этап 1)

Использование:
  npx tsx scripts/sim.ts [опции]

Опции:
  --policy <none|random|scripted>  политика игрока (по умолчанию scripted)
  --seed <число>                   зерно мира и RNG (по умолчанию 20261029)
  --map <id>                       карта из реестра (по умолчанию tract)
  --shop <all|pool>                all — все башни, pool — случайный арсенал (по умолчанию all)
  --coop                           кооп-режим, HP волн ×1.85
  --avatar <id>                    hunter|voevoda|archmage|engineer (по умолчанию hunter)
  --dt <сек>                       шаг симуляции, максимум 0.05 (по умолчанию 1/30)
  --max-minutes <мин>              предохранитель по боевому времени (по умолчанию 180)
  --max-waves <N>                  остановиться после N волн (для быстрых прогонов)
  --json <путь|->                  сохранить полный отчёт JSON («-» — в stdout)
  --csv <путь|->                   сохранить отчёт по волнам CSV («-» — в stdout)
  --quiet                          только ошибки (JSON/CSV всё равно пишутся)
  --fail-on-loss                   код выхода 1, если миссия проиграна
  -h, --help                       эта справка

Карты: ${MAP_DEFS.map((m) => `${m.id} (${m.name})`).join(', ')}
Волн в текущей миссии: ${TOTAL_WAVES}`)
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

function pad(s: string | number, n: number): string {
  const str = String(s)
  return str.length >= n ? str : str + ' '.repeat(n - str.length)
}

function printTable(r: SimReport) {
  console.log('')
  console.log(
    `${pad('волна', 6)}${pad('тип', 8)}${pad('броня', 13)}${pad('спавн', 7)}${pad('убито', 7)}${pad('утекло', 7)}${pad('урон', 10)}${pad('DPS', 8)}${pad('золото', 15)}${pad('башни', 7)}${pad('вр.,с', 7)}`
  )
  for (const w of r.waves) {
    const gold = `${w.goldStart}→${w.goldEnd}`
    const wave = w.completed ? String(w.wave) : `${w.wave}*`
    console.log(
      `${pad(wave, 6)}${pad(w.kind, 8)}${pad(w.armor, 13)}${pad(w.spawned, 7)}${pad(w.killed, 7)}${pad(w.leaked, 7)}${pad(Math.round(w.damage), 10)}${pad(w.dps.toFixed(1), 8)}${pad(gold, 15)}${pad(w.towerCount, 7)}${pad(w.duration.toFixed(0), 7)}`
    )
  }
  if (r.waves.some((w) => !w.completed)) console.log('* волна не завершена')
}

function printSummary(r: SimReport) {
  const s = r.stats
  console.log('')
  console.log(
    `ИТОГ: ${outcomeLabel(r.outcome)} — ${r.wavesCompleted}/${r.totalWaves} волн · ` +
      `боёв ${fmtTime(r.combatSeconds)}, с паузами ~${fmtTime(r.estimatedMissionSeconds)}`
  )
  console.log(
    `жизни ${r.lives} · золото ${r.gold} · убито ${s.kills} (боссов ${s.bossKills}) · ` +
      `прорвалось ${s.leaked} · урон ${Math.round(s.damageDealt)} · DPS ${(s.damageDealt / Math.max(1, r.combatSeconds)).toFixed(1)}`
  )
  const ev = (t: string) => r.events.filter((e) => e.type === t).length
  console.log(
    `события: build ${ev('build')} · upgrade ${ev('upgrade')} · merge ${ev('merge')} · ` +
      `sell ${ev('sell')} · roll ${ev('roll')} · leak ${ev('leak')} · bossPhase ${ev('bossPhase')}`
  )
  const usage = Object.entries(r.towerUsage).sort(
    (a, b) => b[1].built + b[1].merges - (a[1].built + a[1].merges)
  )
  const top = usage.slice(0, 8)
  if (top.length) {
    console.log(
      'башни: ' +
        top
          .map(([, u]) => `${u.name} (построено ${u.built}, слияний ${u.merges}, осталось ${u.surviving}, макс. ур. ${u.maxLevel})`)
          .join(' · ')
    )
  }
}

function csvCell(v: string | number | boolean): string {
  const s = String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(r: SimReport): string {
  const head = [
    'wave',
    'kind',
    'armor',
    'planned',
    'spawned',
    'killed',
    'leaked',
    'livesLost',
    'damage',
    'dps',
    'duration',
    'goldStart',
    'goldEnd',
    'goldEarned',
    'towerCount',
    'built',
    'upgrades',
    'merges',
    'sells',
    'bossPhases',
    'completed',
  ]
  const rows = r.waves.map((w: SimWaveRow) =>
    [
      w.wave,
      w.kind,
      w.armor,
      w.planned,
      w.spawned,
      w.killed,
      w.leaked,
      w.livesLost,
      w.damage,
      w.dps,
      w.duration,
      w.goldStart,
      w.goldEnd,
      w.goldEarned,
      w.towerCount,
      w.built,
      w.upgrades,
      w.merges,
      w.sells,
      w.bossPhases.join('; '),
      w.completed,
    ]
      .map(csvCell)
      .join(',')
  )
  return '\uFEFF' + [head.join(','), ...rows].join('\n') + '\n'
}

function main() {
  const { values } = parseArgs({
    options: {
      policy: { type: 'string', default: 'scripted' },
      seed: { type: 'string', default: '20261029' },
      map: { type: 'string', default: 'tract' },
      shop: { type: 'string', default: 'all' },
      coop: { type: 'boolean', default: false },
      avatar: { type: 'string', default: 'hunter' },
      dt: { type: 'string', default: String(1 / 30) },
      'max-minutes': { type: 'string', default: '180' },
      'max-waves': { type: 'string' },
      json: { type: 'string' },
      csv: { type: 'string' },
      quiet: { type: 'boolean', default: false },
      'fail-on-loss': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
    allowPositionals: false,
  })

  if (values.help) {
    usage()
    return
  }

  const policy = values.policy as SimPolicyId
  if (!POLICIES.includes(policy)) throw new Error(`Неизвестная политика «${values.policy}» (${POLICIES.join(', ')})`)
  if (values.shop !== 'all' && values.shop !== 'pool') throw new Error('--shop: all или pool')
  if (!MAP_DEFS.some((m) => m.id === values.map)) {
    throw new Error(`Неизвестная карта «${values.map}» (${MAP_DEFS.map((m) => m.id).join(', ')})`)
  }
  if (!AVATAR_IDS.includes(values.avatar as (typeof AVATAR_IDS)[number])) {
    throw new Error(`Неизвестный аватар «${values.avatar}» (${AVATAR_IDS.join(', ')})`)
  }
  const seed = Number(values.seed)
  if (!Number.isFinite(seed)) throw new Error('--seed должен быть числом')
  const dt = Number(values.dt)
  if (!Number.isFinite(dt) || dt <= 0) throw new Error('--dt должен быть положительным числом')
  const maxMinutes = Number(values['max-minutes'])
  if (!Number.isFinite(maxMinutes) || maxMinutes <= 0) throw new Error('--max-minutes должен быть положительным')
  const maxWaves = values['max-waves'] !== undefined ? Number(values['max-waves']) : undefined
  if (maxWaves !== undefined && (!Number.isInteger(maxWaves) || maxWaves < 1)) {
    throw new Error('--max-waves должен быть целым числом ≥ 1')
  }

  const opts: SimOptions = {
    seed,
    policy,
    mapId: values.map,
    shop: values.shop as 'all' | 'pool',
    coop: values.coop,
    avatarId: values.avatar as (typeof AVATAR_IDS)[number],
    dt,
    maxSeconds: maxMinutes * 60,
    maxWaves,
  }

  const started = Date.now()
  const report = runSimulation(opts)
  const elapsed = (Date.now() - started) / 1000

  if (values.json === '-' && values.csv === '-') throw new Error('нельзя одновременно писать JSON и CSV в stdout')
  if (values.json) {
    const body = JSON.stringify(report, null, 2) + '\n'
    if (values.json === '-') process.stdout.write(body)
    else {
      const path = values.json
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body, 'utf8')
    }
  }
  if (values.csv) {
    const body = toCsv(report)
    if (values.csv === '-') process.stdout.write(body)
    else {
      const path = values.csv
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, body, 'utf8')
    }
  }

  const jsonToStdout = values.json === '-'
  const csvToStdout = values.csv === '-'
  if (!values.quiet && !jsonToStdout && !csvToStdout) {
    console.log('Последний горизонт — headless-симулятор (этап 1)')
    console.log(
      `seed=${report.seed} · policy=${report.policy} · map=${report.map.name} (${report.map.id}) · ` +
        `shop=${report.shop} · coop=${report.coop ? 'да' : 'нет'} · avatar=${report.avatarId} · dt=${report.dt.toFixed(4)}`
    )
    printTable(report)
    printSummary(report)
    console.log(`расчёт: ${elapsed.toFixed(2)} с`)
  }

  if (values['fail-on-loss'] && report.outcome === 'lost') process.exitCode = 1
  if (report.outcome === 'timeout') process.exitCode = 2
}

try {
  main()
} catch (err) {
  console.error(`[sim] ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
}
