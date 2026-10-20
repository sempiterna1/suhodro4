// Изолированный тест движка: проверка движения крипов и утечек
import { Game } from '../src/game/engine'
import { WAVES, hpForWave, ARMOR_HP_MULT } from '../src/game/config'

const g = new Game()
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

// проверка HP волны 1
const w1 = WAVES[0]
console.log('wave1 armor:', w1.armor, 'hp:', hpForWave(1) * ARMOR_HP_MULT[w1.armor])
