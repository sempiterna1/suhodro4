// Тест второго выхода (GDD «Второй выход»): генерация второй тропы, чередование
// спавна поровну, блокировка клеток, утечки по своей тропе, снапшот коопа,
// наследование тропы призванными боссом крипами.

import { CELL, MAP_DEFS } from '../src/game/config'
import { Game } from '../src/game/engine'
import { cellOf, generateMap, isPathCell, pathLength, pointAtLength, setSecondPathActive } from '../src/game/map'

let fails = 0
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗ РЕГРЕССИЯ'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

const valleyDef = MAP_DEFS.find((m) => m.id === 'valley')!

// ── Генерация второй тропы ──
const map = generateMap(valleyDef.seed)
check('у Пепельной долины есть вторая тропа', !!map.cells2 && !!map.points2, `${map.cells2?.length ?? 0} клеток`)
check('вторая тропа детерминирована', JSON.stringify(generateMap(valleyDef.seed)) === JSON.stringify(map))
const keys1 = new Set(map.cells.map((c) => c.cx + ',' + c.cy))
const overlap = map.cells2!.filter((c) => keys1.has(c.cx + ',' + c.cy))
const adjacent = map.cells2!.filter(
  (c) =>
    keys1.has((c.cx + 1) + ',' + c.cy) ||
    keys1.has((c.cx - 1) + ',' + c.cy) ||
    keys1.has(c.cx + ',' + (c.cy + 1)) ||
    keys1.has(c.cx + ',' + (c.cy - 1))
)
check('вторая тропа не пересекает первую', overlap.length === 0, `пересечений ${overlap.length}, прижиманий ${adjacent.length}`)
check('вторая тропа: вход с севера, выход к лагерю на востоке',
  map.points2![0].y < 0 && map.points2![map.points2!.length - 1].x > 900)
const noSecond = generateMap(MAP_DEFS.find((m) => m.id === 'mill')!.seed)
check('без secondExitWave второй тропы нет', noSecond.cells2 === undefined)

// ── Движок: открытие на 16-й волне ──
const g = new Game()
g.selectMap(valleyDef.seed)
g.beginPreview()
check('до открытия второй выход закрыт', !g.secondExitOpen && g.getUiState().secondExitWave === 16)
const c2 = map.cells2![10]
const freeCell = { x: c2.cx * CELL + CELL / 2, y: c2.cy * CELL + CELL / 2 }
const beforeErr = g.canPlace(freeCell.x, freeCell.y)
check('до открытия на второй тропе строить можно', beforeErr === null, `${beforeErr}`)

// проматываем 15 волн (крипов нет — волны завершаются мгновенно)
for (let w = 0; w < 15; w++) g['finishWave']()
check('после волны 15: пауза перед открытием', g.wave === 16 && g.phase === 'preview' && g.secondExitOpen)
check('в паузе перед 16-й вторая тропа блокируется', g.canPlace(freeCell.x, freeCell.y) === 'Нельзя строить на тракте', `клетка ${JSON.stringify(c2)} → '${g.canPlace(freeCell.x, freeCell.y)}'`)

// ── Спавн поровну ──
g.startWave()
for (let i = 0; i < 400; i++) g.update(0.05)
const onPath0 = g.creeps.filter((c) => c.pathIdx === 0).length
const onPath1 = g.creeps.filter((c) => c.pathIdx === 1).length
check('крипы делятся между тропами поровну', onPath0 > 0 && Math.abs(onPath0 - onPath1) <= 1, `${onPath0}/${onPath1}`)
const first1 = g.creeps.find((c) => c.pathIdx === 1)!
const p = pointAtLength(first1.dist, 1)
check('крип второй тропы стоит на ней', isPathCell(cellOf(p.x, p.y)))
check('длины троп независимы', pathLength(0) > 0 && pathLength(1) > 0 && Math.abs(pathLength(0) - pathLength(1)) < 2600)

// ── Утечка по своей тропе: крип второй тропы уносит жизни у её выхода ──
const livesBefore = g.lives
const far1 = pathLength(1) + 1
g.creeps = g.creeps.filter((c) => c.pathIdx === 1)
for (const c of g.creeps) c.dist = far1
g.update(0.05)
check('утечка по второй тропе снимает жизни', g.lives < livesBefore, `${livesBefore} → ${g.lives}`)

// ── Кооп: pathIdx в снапшоте ──
const host = new Game()
host.selectMap(valleyDef.seed)
for (let w = 0; w < 15; w++) host['finishWave']()
host.startWave()
for (let i = 0; i < 100; i++) host.update(0.05)
const snap = host.serialize()
check('снапшот несёт pathIdx', snap.creeps.length > 0 && snap.creeps.every((c) => c.pathIdx === 0 || c.pathIdx === 1))
const guest = new Game()
guest.applySnap(snap)
check('гость видит тропы крипа как хост',
  guest.creeps.length === host.creeps.length && guest.creeps.every((c, i) => c.pathIdx === host.creeps[i].pathIdx))
const g1 = host.creeps[0]
const g2 = guest.creeps[0]
check('позиции хоста и гостя совпадают',
  Math.hypot(pointAtLength(g1.dist, g1.pathIdx).x - pointAtLength(g2.dist, g2.pathIdx).x,
    pointAtLength(g1.dist, g1.pathIdx).y - pointAtLength(g2.dist, g2.pathIdx).y) < 0.001)

// ── Призыв боссом наследует тропу босса (волна 20 — Сердце Разлома) ──
const b = new Game()
b.selectMap(valleyDef.seed)
for (let w = 0; w < 19; w++) b['finishWave']()
b.startWave()
for (let i = 0; i < 40; i++) b.update(0.05)
const boss = b.creeps.find((c) => c.isBoss)!
check('босс 20-й волны на поле', !!boss)
boss.hp = boss.maxHp * 0.4 // фаза «Заражённый призыв» (atHp 0.5, summon)
// призыв попадает в очередь между тиками — ловим его там, чтобы проверить тропу
let summons: Array<{ atDist?: number; pathIdx?: number }> = []
for (let i = 0; i < 600 && summons.length === 0; i++) {
  b.update(0.05)
  summons = (b['spawnQueue'] as Array<{ atDist?: number; pathIdx?: number }>).filter(
    (o) => o.atDist !== undefined
  )
}
check('призванные появляются', summons.length > 0, `${summons.length} в очереди`)
check('призванные наследуют тропу босса', summons.every((o) => (o.pathIdx ?? 0) === boss.pathIdx))
const uidsBefore = new Set(b.creeps.map((c) => c.uid))
for (let i = 0; i < 40; i++) b.update(0.05)
const spawned = b.creeps.filter((c) => !uidsBefore.has(c.uid) && !c.isBoss)
check('призванные выходят на тропе босса', spawned.length > 0 && spawned.every((c) => c.pathIdx === boss.pathIdx))

// ── Сброс: после рестарта вторая тропа снова закрыта ──
g.reset()
check('после reset() второй выход закрыт', !g.secondExitOpen)
setSecondPathActive(false)

console.log(fails === 0 ? '\nВсе проверки пройдены ✓' : `\nПровалено проверок: ${fails}`)
process.exitCode = fails === 0 ? 0 : 1
