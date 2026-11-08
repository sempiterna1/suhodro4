// Тест headless-симулятора (этап 1): политики, отчёт, event-log и детерминизм.
// Один и тот же seed должен давать побайтно одинаковый JSON-отчёт.

import { runSimulation } from '../src/game/sim'
import { TOTAL_WAVES, WAVES } from '../src/game/config'
import { DIFFICULTIES } from '../src/game/data/difficulties'

let fails = 0
let checks = 0
function check(name: string, cond: boolean, extra = '') {
  checks++
  console.log(`${cond ? '✓' : '✗ РЕГРЕССИЯ'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

// ─── Политика «без башен»: миссия должна быстро провалиться ──────────────
const none = runSimulation({ seed: 7, policy: 'none', maxSeconds: 300 })
check('none: поражение', none.outcome === 'lost', none.outcome)
check('none: есть хотя бы одна волна', none.waves.length >= 1, `${none.waves.length}`)
check('none: не построено ни одной башни', Object.keys(none.towerUsage).length === 0)
check('none: утечки есть', none.stats.leaked > 0, `${none.stats.leaked}`)
check('none: событие leak записано', none.events.some((e) => e.type === 'leak'))
check('none: событие lose записано', none.events.some((e) => e.type === 'lose'))
check('none: волна помечена незавершённой', none.waves.every((w) => !w.completed))

// ─── Скриптовая политика: строит, качает, сливает ────────────────────────
const scripted = runSimulation({ seed: 20261029, policy: 'scripted', maxWaves: 10, maxSeconds: 1800 })
check('scripted: дошёл до лимита 10 волн', scripted.outcome === 'waveLimit', scripted.outcome)
check('scripted: 10 завершённых волн', scripted.waves.length === 10 && scripted.wavesCompleted === 10)
check('scripted: босс 10-й волны убит', scripted.stats.bossKills >= 1, `${scripted.stats.bossKills}`)
check('scripted: есть постройки', Object.keys(scripted.towerUsage).length > 0, `${Object.keys(scripted.towerUsage).length} видов`)
check('scripted: есть слияния', scripted.stats.merges > 0, `${scripted.stats.merges}`)
check('scripted: урон посчитан', scripted.stats.damageDealt > 0, `${Math.round(scripted.stats.damageDealt)}`)
check('scripted: DPS волн конечен', scripted.waves.every((w) => Number.isFinite(w.dps) && w.dps >= 0))
check('scripted: дистанция и золото конечны', scripted.waves.every((w) => Number.isFinite(w.duration) && Number.isFinite(w.goldEnd)))
check(
  'scripted: event-log содержит волны/постройки/прокачку',
  ['waveStart', 'waveEnd', 'build', 'upgrade'].every((t) => scripted.events.some((e) => e.type === t))
)
check('scripted: event-log содержит фазу босса', scripted.events.some((e) => e.type === 'bossPhase'))
check('scripted: отчёт сериализуется в JSON', typeof JSON.stringify(scripted) === 'string')
check(
  'scripted: HP здания в отчёте и в допустимых границах',
  scripted.buildingMaxHp === 200 && scripted.buildingHp >= 0 && scripted.buildingHp <= scripted.buildingMaxHp,
  `${scripted.buildingHp}/${scripted.buildingMaxHp}`
)
check(
  'scripted: урон по зданию по волнам неотрицателен',
  scripted.waves.every((w) => w.buildingDamage >= 0 && Number.isFinite(w.buildingDamage))
)
check(
  'scripted: у смешанных волн в отчёте два типа брони',
  scripted.waves.every((w) => w.armors.length === (w.armor.includes('+') ? 2 : 1))
)

// ─── Сложности в симуляторе ──────────────────────────────────────────────
const recruit = runSimulation({ seed: 20261029, policy: 'scripted', maxWaves: 10, difficulty: 'recruit' })
check('recruit: сложность в отчёте', recruit.difficulty === 'recruit' && recruit.difficultyName === 'Новобранец')
check('recruit: здание 280 HP', recruit.buildingMaxHp === 280, `${recruit.buildingMaxHp}`)
const nightmare = runSimulation({ seed: 20261029, policy: 'scripted', maxWaves: 11, difficulty: 'nightmare' })
check('nightmare: сложность в отчёте', nightmare.difficulty === 'nightmare' && nightmare.difficultyName === 'Кошмар')
check('nightmare: здание 150 HP', nightmare.buildingMaxHp === 150, `${nightmare.buildingMaxHp}`)
// Кошмар при новой экономике прокачки падает раньше 11-й волны — смешанную броню
// проверяем отдельно: подмешиваем mixedWavesFrom в лёгкую сложность и убеждаемся,
// что путь «два типа брони в отчёте» работает (armorsForWave → отчёт).
{
  const def = DIFFICULTIES.recruit as unknown as { mixedWavesFrom: number | null }
  const saved = def.mixedWavesFrom
  def.mixedWavesFrom = 11
  const mixed = runSimulation({ seed: 20261029, policy: 'scripted', maxWaves: 12, difficulty: 'recruit', shop: 'all' })
  def.mixedWavesFrom = saved
  check(
    'с 11-й волны броня смешана ( путь armorsForWave в отчёте)',
    mixed.waves.filter((w) => w.wave >= 11).length > 0
      && mixed.waves.filter((w) => w.wave >= 11).every((w) => w.armors.length > 1),
    mixed.waves.filter((w) => w.wave >= 11).map((w) => `${w.wave}:${w.armor}`).join(', ')
  )
}
// Сравниваем урон по волнам, завершённым в обоих прогонах: более короткий прогон
// (поражение на Кошмаре) не должен занижать итог — проверяем именно скалирование HP врагов
const recruitDone = recruit.waves.filter((w) => w.completed)
const nightmareDone = nightmare.waves.filter((w) => w.completed)
const commonWaves = Math.min(recruitDone.length, nightmareDone.length)
const damageFirst = (ws: typeof recruitDone) => Math.round(ws.slice(0, commonWaves).reduce((s, w) => s + w.damage, 0))
check(
  'сложности влияют на HP врагов (recruit легче nightmare)',
  damageFirst(recruitDone) < damageFirst(nightmareDone),
  `${damageFirst(recruitDone)} vs ${damageFirst(nightmareDone)} (первые ${commonWaves} волн)`
)

// ─── Детерминизм: два одинаковых прогона — один и тот же JSON ────────────
const a = runSimulation({ seed: 42, policy: 'scripted', maxWaves: 5, dt: 1 / 30 })
const b = runSimulation({ seed: 42, policy: 'scripted', maxWaves: 5, dt: 1 / 30 })
check('детерминизм: одинаковый seed → одинаковый отчёт', JSON.stringify(a) === JSON.stringify(b))
check('детерминизм: тот же набор волн', a.waves.length === b.waves.length && a.stats.kills === b.stats.kills)

// Другой seed и карта попадают в отчёт и меняют мир
const c = runSimulation({ seed: 43, policy: 'scripted', maxWaves: 2, mapId: 'mill', dt: 1 / 30 })
check('другой seed и карта: параметры в отчёте', c.seed === 43 && c.map.id === 'mill')

// ─── Случайный арсенал (pool) и случайная политика ───────────────────────
const pool = runSimulation({ seed: 5, policy: 'scripted', shop: 'pool', maxWaves: 3 })
check('pool: арсенал случайный', pool.shop === 'pool')
check('pool: симуляция доходит до лимита', pool.outcome === 'waveLimit', pool.outcome)
const random = runSimulation({ seed: 5, policy: 'random', maxWaves: 5 })
check('random: отчёт непустой', random.waves.length > 0 && Number.isFinite(random.stats.damageDealt))
check('random: есть события действий', random.events.some((e) => e.type === 'build' || e.type === 'upgrade'))

// ─── Общие инварианты ────────────────────────────────────────────────────
check('totalWaves совпадает с конфигом', scripted.totalWaves === TOTAL_WAVES && TOTAL_WAVES === WAVES.length)
check('estimatedMissionSeconds ≥ combatSeconds', scripted.estimatedMissionSeconds >= scripted.combatSeconds)
check('wavesCompleted ≤ totalWaves', scripted.wavesCompleted <= scripted.totalWaves)

console.log(`\n${fails === 0 ? `✓ Все ${checks} проверок симулятора пройдены` : `✗ Провалено ${fails} из ${checks}`}`)
process.exitCode = fails === 0 ? 0 : 1
