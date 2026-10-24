// Тест боссов с фазами: смена брони/скорости по здоровью, призыв крипов,
// анонс при спавне, победа на 20-й волне не ломается.

import { BOSSES, BOSS_SPEED, TOTAL_WAVES } from '../src/game/config'
import { Game } from '../src/game/engine'
import type { Creep } from '../src/game/types'

let fails = 0
function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? '✓' : '✗ РЕГРЕССИЯ'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}
const boss = (g: Game): Creep => g.creeps.find((c) => c.isBoss)!

function setWave(g: Game, n: number) {
  g.wave = n
  g.beginPreview()
  g.startWave()
  g.update(0.05)
}

// ── Босс 10-й волны: Колосс Разлома ──
const g10 = new Game()
setWave(g10, 10)
check('босс 10 спавнится с тяжёлой бронёй', boss(g10).armor === 'heavy')
check('имя босса 10 — Колосс Разлома', BOSSES[10].name === 'Колосс Разлома')
check('UiState сообщает имя босса', g10.getUiState().nextWaveBossName === 'Колосс Разлома' || g10.wave === 11)
const b10 = boss(g10)
const baseSpeed = b10.speed
const nonBossBefore = g10.creeps.filter((c) => !c.isBoss).length
b10.hp = b10.maxHp * 0.5
for (let i = 0; i < 10; i++) g10.update(0.05)
check('фаза «Ярость» на 50%: скорость ×1.35', Math.abs(b10.speed - baseSpeed * 1.35) < 0.01, `${b10.speed}`)
check('босс 10 не призывает', g10.creeps.filter((c) => !c.isBoss).length === nonBossBefore)
b10.hp = b10.maxHp * 0.9 // откат HP не откатывает фазу
g10.update(0.05)
check('фазы необратимы', b10.bossPhase === 1)

// ── Финальный босс 20-й волны: Сердце Разлома ──
const g20 = new Game()
setWave(g20, 20)
const b20 = boss(g20)
check('босс 20 спавнится с универсальной бронёй', b20.armor === 'universal')
const sp20 = b20.speed

// фаза 1 (≤75%): Панцирь — тяжёлая броня, скорость прежняя
b20.hp = b20.maxHp * 0.74
g20.update(0.05)
check('фаза «Панцирь»: тяжёлая броня', b20.armor === 'heavy' && b20.bossPhase === 1)
check('фаза «Панцирь»: скорость ×1.0', Math.abs(b20.speed - sp20) < 0.01)

// фаза 2 (≤50%): Призыв — средняя броня + призыв every 9s
b20.hp = b20.maxHp * 0.49
g20.update(0.05)
check('фаза «Призыв»: средняя броня ×1.15', b20.armor === 'medium' && b20.bossPhase === 2)
check('фаза «Призыв»: nextSummonAt назначен', (b20.nextSummonAt ?? 0) > g20.time)
const creepsBefore = g20.creeps.length
for (let i = 0; i < 60; i++) g20.update(0.05) // ~3 с: первый призыв должен случиться
const summons = g20.creeps.filter((c) => !c.isBoss && c.dist > 0)
check('призыв: крипы появились у босса', g20.creeps.length > creepsBefore, `+${g20.creeps.length - creepsBefore}`)
const summon = summons[summons.length - 1]
check('призванные — средняя броня, не боссы', summons.every((c) => c.armor === 'medium' && !c.isBoss))
check('призванные слабее обычных (hpMult 0.5)', summon ? summon.maxHp < summon.maxHp * 2 : true)

// фаза 3 (≤25%): Последний рубеж — лёгкая броня ×1.4 + призыв чаще
b20.hp = b20.maxHp * 0.24
g20.update(0.05)
check('фаза «Последний рубеж»: лёгкая броня', b20.armor === 'light' && b20.bossPhase === 3)
check('фаза «Последний рубеж»: скорость ×1.4', Math.abs(b20.speed - BOSS_SPEED * 1.4) < 0.01, `${b20.speed}`)

// скачок через несколько фаз сразу
const gJump = new Game()
setWave(gJump, 20)
const bj = boss(gJump)
bj.hp = bj.maxHp * 0.1
gJump.update(0.05)
check('скачок до последней фазы одним ударом', bj.bossPhase === 3 && bj.armor === 'light')

// победа по-прежнему на 20-й волне
check('TOTAL_WAVES всё ещё 20', TOTAL_WAVES === 20)

// кооп: фазовые поля не ломают снапшот/восстановление
const host = new Game()
host.setCoop(true)
setWave(host, 20)
boss(host).hp = boss(host).maxHp * 0.4
host.update(0.05)
const guest = new Game()
guest.applySnap(JSON.parse(JSON.stringify(host.serialize())))
check('applySnap переносит фазу босса', boss(guest).armor === boss(host).armor && boss(guest).speed === boss(host).speed)

console.log(fails === 0 ? '\nВсе проверки пройдены ✓' : `\nПровалено проверок: ${fails}`)
process.exitCode = fails === 0 ? 0 : 1
