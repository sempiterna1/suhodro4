// Тест карт и 20 волн: реестр MAP_DEFS, фиксированные зёрна, фичи карт,
// структура волн (боссы 10/20, денежные 9/19) и победа на 20-й волне.

import {
  ARMOR_SPEED,
  CREEP_KINDS,
  MAP_DEFS,
  TOTAL_WAVES,
  WAVES,
  mapDefBySeed,
  waveSpeedMult,
} from '../src/game/config'
import { Game } from '../src/game/engine'
import { generateMap } from '../src/game/map'

let fails = 0
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗ РЕГРЕССИЯ'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

// ── Реестр карт ──
check('карт в реестре ≥ 6', MAP_DEFS.length >= 6, `${MAP_DEFS.length}`)
check('зёрна карт уникальны', new Set(MAP_DEFS.map((m) => m.seed)).size === MAP_DEFS.length)
for (const m of MAP_DEFS) {
  const map = generateMap(m.seed)
  check(`карта «${m.name}» (seed=${m.seed}) генерируется`, map.cells.length >= 40 && map.cells.length <= 72, `${map.cells.length} клеток`)
  check(`зерно ${m.seed} детерминировано`, JSON.stringify(generateMap(m.seed)) === JSON.stringify(map))
}
check('mapDefBySeed находит по зерну', mapDefBySeed(1).id === 'pass')
check('mapDefBySeed: чужое зерно → «Пограничный тракт»', mapDefBySeed(999999).id === 'tract')

// ── Волны ──
check('всего волн 20', WAVES.length === 20 && TOTAL_WAVES === 20)
check('денежные волны 9 и 19', WAVES[8].kind === 'money' && WAVES[18].kind === 'money')
check('босс на 10 и 20', WAVES[9].kind === 'boss' && WAVES[19].kind === 'boss')
check('в 11–20 есть универсальная броня', WAVES.slice(10, 20).some((w) => w.armor === 'universal'))
check('скорость: +1%/волна, потолок +25%', waveSpeedMult(1) === 1 && waveSpeedMult(20) === 1.19 && waveSpeedMult(40) === 1.25)

// ── Движок: выбор карты и рестарт ──
const g = new Game()
g.selectMap(MAP_DEFS.find((m) => m.id === 'mill')!.seed)
check('selectMap применяет карту', g.mapDef.id === 'mill')
g.reset()
check('после reset() карта та же (выбор живёт)', g.mapDef.id === 'mill' && g.getUiState().mapName === 'Старая мельница')

// ── Пепельная долина: +6 универсальных в обычной волне ──
const valley = new Game()
valley.selectMap(MAP_DEFS.find((m) => m.id === 'valley')!.seed)
valley.beginPreview()
valley.startWave()
const q = valley['spawnQueue'] as Array<{ armor: string }>
check('Пепельная долина: 20 обычных + 6 универсальных', q.length === 26, `${q.length} в очереди`)
check('Пепельная долина: универсалы в очереди', q.filter((o) => o.armor === 'universal').length === 6)

// ── Ледяной перевал: крипы +10% скорости ──
const pass = new Game()
pass.selectMap(MAP_DEFS.find((m) => m.id === 'pass')!.seed)
pass.beginPreview()
pass.startWave()
for (let i = 0; i < 100; i++) pass.update(0.05) // заспавнить часть волны
const base = (c: { armor: string; kind: string }) =>
  ARMOR_SPEED[c.armor] * CREEP_KINDS[c.kind].speedMult * waveSpeedMult(1)
const ratios = pass['creeps'].map((c) => c.speed / base(c))
check(
  'Ледяной перевал: скорость крипов ×1.1',
  ratios.length > 0 && ratios.every((r) => Math.abs(r - 1.1) < 0.01),
  `${pass['creeps'].length} крипов`
)

// ── Победа наступает на 20-й волне, не раньше ──
const fin = new Game()
fin.selectMap(0)
fin.beginPreview()
for (let w = 1; w <= 20; w++) {
  fin['finishWave']()
  if (w < 20) check(`после волны ${w} игра продолжается`, fin.phase !== 'won')
}
check('после 20-й волны — победа', fin.phase === 'won')

console.log(fails === 0 ? '\nВсе проверки пройдены ✓' : `\nПровалено проверок: ${fails}`)
process.exitCode = fails === 0 ? 0 : 1
