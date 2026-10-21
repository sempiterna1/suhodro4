// Изолированный тест движка: проверка движения крипов и утечек
import { Game } from '../src/game/engine'
import { WAVES, hpForWave, ARMOR_HP_MULT } from '../src/game/config'

const g = new Game()

g.unlockAllTowers() // арсенал случаен — тестам нужны все башни
console.log('phase:', g.phase, 'gold:', g.gold, 'lives:', g.lives)

g.beginPreview()
g.previewRemaining = 0
g.startWave()
console.log('after startWave: phase =', g.phase, 'queue =', g['spawnQueue'].length)

for (let i = 0; i < 60 * 30; i++) {
  // 30 сек при 60 fps
  g.update(1 / 60)
  if (i % 120 === 0) {
    const c = g.creeps[0]
    console.log(
      `t=${(i / 60).toFixed(1)}s phase=${g.phase} creeps=${g.creeps.length} ` +
        `dist0=${c ? c.dist.toFixed(0) : '—'} lives=${g.lives} kills=${g.stats.kills}`
    )
  }
  if (g.phase === 'over') {
    console.log(`GAME OVER at t=${(i / 60).toFixed(1)}s, leaked=${g.stats.leaked}`)
    break
  }
}

// проверка HP волны 1 (с плейтест-множителем −30%)
import { HP_PLAYTEST_MULT } from '../src/game/config'
const w1 = WAVES[0]
console.log(
  'wave1 armor:', w1.armor,
  'hp(base):', (hpForWave(1) * ARMOR_HP_MULT[w1.armor]).toFixed(1),
  'hp(-30%):', (hpForWave(1) * ARMOR_HP_MULT[w1.armor] * HP_PLAYTEST_MULT).toFixed(1)
)
// проверка свободной постройки
const r1 = g.build(300, 300, 'sentry')
const r2 = g.build(301, 301, 'archer') // слишком близко — должно отклониться
const r3 = g.build(240, 150, 'archer') // на тракте — должно отклониться
console.log('build(300,300):', r1.ok, '| build(301,301):', r2.ok, r2.error, '| build(на тракте):', r3.ok, r3.error)

// проверка слияния при свободной постройке (Лучница + Пиромант рядом, оба 3 ур.)
const g2 = new Game()
g2.unlockAllTowers() // арсенал случаен — тестам нужны все башни
const bA = g2.build(285, 260, 'archer')
const bB = g2.build(285, 340, 'pyro')
const idA = bA.towerId!
const idB = bB.towerId!
g2.towerById(idA)!.level = 3
g2.towerById(idB)!.level = 3
const recipe = g2.canMerge(idA, idB)
g2.gold = 999 // на тест дальнего строительства
const far = g2.build(850, 100, 'archer')
g2.towerById(far.towerId!)!.level = 3
const farRecipe = g2.canMerge(idA, far.towerId!)
console.log('merge recipe рядом:', recipe?.id ?? 'НЕТ', '| далеко (850,100):', farRecipe === null ? 'отклонено (дистанция)' : 'ОШИБКА: слилось издалека')
const mres = g2.merge(idA, idB)
console.log('merge:', mres.ok, '| башен осталось:', g2.towers.length, '| итог:', g2.towers[0]?.defId, 'ур.', g2.towers[0]?.level)
