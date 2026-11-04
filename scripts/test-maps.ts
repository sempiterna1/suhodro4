// Тест карт и 30 волн: реестр MAP_DEFS, фиксированные зёрна, фичи карт,
// структура волн (боссы 10/20/30, денежные 9/19/29, смешанные 21–28),
// сложности и победа на 30-й волне.

import {
  ARMOR_SPEED,
  CREEP_KINDS,
  DIFFICULTIES,
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
  check(`карта «${m.name}» (seed=${m.seed}) генерируется`, map.cells.length >= 55 && map.cells.length <= 100, `${map.cells.length} клеток`)
  check(`зерно ${m.seed} детерминировано`, JSON.stringify(generateMap(m.seed)) === JSON.stringify(map))
}
check('mapDefBySeed находит по зерну', mapDefBySeed(3).id === 'pass' && mapDefBySeed(47).id === 'mill' && mapDefBySeed(8).id === 'valley')
check('mapDefBySeed: чужое зерно → «Пограничный тракт»', mapDefBySeed(999999).id === 'tract')

// ── Волны ──
check('всего волн 30', WAVES.length === 30 && TOTAL_WAVES === 30)
check('денежные волны 9, 19 и 29', WAVES[8].kind === 'money' && WAVES[18].kind === 'money' && WAVES[28].kind === 'money')
check('боссы на 10, 20 и 30', WAVES[9].kind === 'boss' && WAVES[19].kind === 'boss' && WAVES[29].kind === 'boss')
check('в 11–20 есть универсальная броня', WAVES.slice(10, 20).some((w) => w.armors.includes('universal')))
check(
  'волны 21–28 смешаны из двух типов брони',
  WAVES.slice(20, 28).every((w) => w.armors.length === 2 && w.armors[0] !== w.armors[1]),
  WAVES.slice(20, 28).map((w) => w.armors.join('+')).join(', ')
)
check('скорость: +1%/волна, потолок +25%', waveSpeedMult(1) === 1 && waveSpeedMult(20) === 1.19 && waveSpeedMult(30) === 1.25 && waveSpeedMult(40) === 1.25)

// ── Сложности: золото, HP здания, доступность ──
const diff = new Game()
check('по умолчанию Ветеран', diff.difficulty === 'veteran' && diff.buildingMaxHp === 200 && diff.gold === 150)
check('Новобранец: 200 золота и 280 HP здания', diff.setDifficulty('recruit').ok && diff.gold === 200 && diff.buildingMaxHp === 280)
check('Кошмар: 120 золота и 150 HP здания', diff.setDifficulty('nightmare').ok && diff.gold === 120 && diff.buildingMaxHp === 150)
diff.beginPreview()
check('после старта сложность не меняется', !diff.setDifficulty('veteran').ok && diff.difficulty === 'nightmare')
check('DIFFICULTIES: три режима', Object.keys(DIFFICULTIES).length === 3)

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
check('Пепельная долина: 20 обычных + 3 универсальных', q.length === 23, `${q.length} в очереди`)
check('Пепельная долина: универсалы в очереди', q.filter((o) => o.armor === 'universal').length === 3)

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

// ── Победа наступает на 30-й волне, не раньше ──
const fin = new Game()
fin.selectMap(0)
fin.beginPreview()
for (let w = 1; w <= 30; w++) {
  fin['finishWave']()
  if (w < 30) check(`после волны ${w} игра продолжается`, fin.phase !== 'won')
}
check('после 30-й волны — победа', fin.phase === 'won')

console.log(fails === 0 ? '\nВсе проверки пройдены ✓' : `\nПровалено проверок: ${fails}`)
process.exitCode = fails === 0 ? 0 : 1
