// Headless симулятор миссии «Последний горизонт» — без рендера, без React.
// Прогоняет миссию с фиксированным зерном и печатает отчёт:
// фазы, золото, жизни, утечки, статистика.
// Политики (без башен / случайная застройка / скрипт игрока) — в следующих итерациях этапа 1.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { WAVES, TOTAL_WAVES } from '../src/game/config'

const g = new Game(20261029) // фиксированное зерно — воспроизводимость отчёта
g.unlockAllTowers() // арсенал случайный — тестам нужны все башни
g.useMap(CLASSIC_MAP) // карта случайная — тестам нужна классическая

const dt = 1 / 60
let t = 0

const log = (s: string) => console.log(`[sim] ${s}`)

g.beginPreview()
g.startWave()
log(`старт: phase=${g.phase} wave=${g.wave} time=${g.time.toFixed(2)}`)

const events: string[] = []
let lastPhase = g.phase

while (g.phase !== 'over' && g.phase !== 'won') {
  g.update(dt)
  t += dt
  if (g.phase !== lastPhase) {
    events.push(`t=${t.toFixed(1)}s → ${g.phase} (wave ${g.wave}, gold=${g.gold}, lives=${g.lives})`)
    lastPhase = g.phase
  }
  if (g.phase === 'over' || g.phase === 'won') break
}

log(`финал: phase=${g.phase} wave=${g.wave} time=${g.time.toFixed(1)}s gold=${g.gold} lives=${g.lives}`)
log(`stats: ${JSON.stringify(g.stats)}`)
log(`пройденные волны: ${Math.max(0, g.wave - 1)} из ${TOTAL_WAVES}`)
log(`события фаз: ${events.join(' | ')}`)

// сводка по волнам: сколько было крипов и сколько утекло
for (let w = 1; w <= g.wave && w <= TOTAL_WAVES; w++) {
  const def = WAVES[w - 1]
  log(`волна ${w}: kind=${def.kind} armor=${def.armor} count=${def.count} hp=${def.hp} spawnInterval=${def.spawnInterval}`)
}
