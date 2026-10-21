// Регрессия краша MergePanel (Panels.tsx:380):
// после слияния towers.filter() сдвигает массив → id ≠ индексу.
// mergeTargetsFor() возвращает id, которые UI обязан резолвить через towerById().

import { Game } from '../src/game/engine'

const g = new Game()
g.beginPreview()
g.gold = 99999

// Кластер из 4 валидных точек (не на тракте), попарно в пределах 140 px
const a = g.build(300, 240, 'archer').towerId!
const b = g.build(370, 240, 'pyro').towerId!
const c = g.build(330, 300, 'archer').towerId!
const d = g.build(400, 300, 'pyro').towerId!
console.log('ids построек:', a, b, c, d)
for (const id of [a, b, c, d]) for (let i = 0; i < 2; i++) g.upgrade(id)

/** Проверка: все id во всех targets всех башен резолвятся через towerById */
function assertAllResolve(step: string) {
  for (const tw of g.towers) {
    for (const tid of g.mergeTargetsFor(tw.id)) {
      if (!g.towerById(tid)) {
        console.error(`РЕГРЕССИЯ [${step}]: tower ${tw.id} имеет stale target ${tid}`)
        process.exit(1)
      }
    }
  }
  console.log(`✓ [${step}] ${g.towers.length} башен (ids: ${g.towers.map((t) => t.id)}), targets резолвятся`)
}

// ─── Слияние №1: A + B → flame_archer (A удаляется, массив сдвигается) ───
const m1 = g.merge(a, b)
console.log('merge1 (archer+pyro):', m1.ok ? 'ok, survivor=' + b : 'FAIL: ' + m1.error)
assertAllResolve('после merge1')

// ─── Слияние №2 — сценарий пользователя «второе слияние подряд» ───
const m2 = g.merge(c, d)
console.log('merge2 (archer+pyro):', m2.ok ? 'ok, survivor=' + d : 'FAIL: ' + m2.error)
assertAllResolve('после merge2')

// ─── targets у слитой башни (слияние запрещено, но резолв не должен падать) ───
const mergedTower = g.towerById(d)!
console.log('итог у survivor:', mergedTower.defId, 'ур.', mergedTower.level,
  '| targets слитой:', g.mergeTargetsFor(d).length, '(0 = слитые не сливаются, ок)')

// ─── Продажа тоже сдвигает массив ───
const e = g.build(300, 360, 'frost').towerId ?? g.build(470, 300, 'frost').towerId
if (e) {
  g.sell(e)
  assertAllResolve('после sell')
}

console.log('\n✓✓ Регрессия пройдена: stale-id после слияний/продажи не воспроизводится')
