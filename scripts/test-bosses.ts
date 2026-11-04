// Тест боссов этапа 2: три босса (10/20/30), фазы по здоровью, призывы,
// вторая способность на Кошмаре, снапшот коопа и победа на 30-й волне.

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
check('UiState сообщает имя босса', g10.getUiState().nextWaveBossName === 'Колосс Разлома')
const b10 = boss(g10)
const baseSpeed = b10.speed
const nonBossBefore = g10.creeps.filter((c) => !c.isBoss).length
b10.hp = b10.maxHp * 0.5
for (let i = 0; i < 10; i++) g10.update(0.05)
check('фаза «Ярость» на 50%: скорость ×1.35', Math.abs(b10.speed - baseSpeed * 1.35) < 0.01, `${b10.speed}`)
check('на Ветеране босс 10 не призывает', g10.creeps.filter((c) => !c.isBoss).length === nonBossBefore)
b10.hp = b10.maxHp * 0.9 // откат HP не откатывает фазу
g10.update(0.05)
check('фазы необратимы', b10.bossPhase === 1)

// ── Босс 20-й волны: Матка Разлома (две фазы с призывом) ──
const g20 = new Game()
setWave(g20, 20)
const b20 = boss(g20)
check('босс 20 спавнится с универсальной бронёй', b20.armor === 'universal')
check('имя босса 20 — Матка Разлома', BOSSES[20].name === 'Матка Разлома')
const sp20 = b20.speed

// фаза 1 (≤60%): Зов выводка — призыв средней брони
b20.hp = b20.maxHp * 0.59
g20.update(0.05)
check('фаза «Зов выводка»: универсальная броня', b20.armor === 'universal' && b20.bossPhase === 1)
check('фаза «Зов выводка»: nextSummonAt назначен', (b20.nextSummonAt ?? 0) > g20.time)
const creepsBefore = g20.creeps.length
for (let i = 0; i < 60; i++) g20.update(0.05) // ~3 с: первый призыв должен случиться
const summons = g20.creeps.filter((c) => !c.isBoss && c.dist > 0)
check('призыв: крипы появились у босса', g20.creeps.length > creepsBefore, `+${g20.creeps.length - creepsBefore}`)
check('призванные — средняя броня, не боссы', summons.every((c) => c.armor === 'medium' && !c.isBoss))

// фаза 2 (≤30%): Панцирь матки — тяжёлая броня ×1.25, призыв универсалов
b20.hp = b20.maxHp * 0.29
g20.update(0.05)
check('фаза «Панцирь матки»: тяжёлая броня', b20.armor === 'heavy' && b20.bossPhase === 2)
check('фаза «Панцирь матки»: скорость ×1.25', Math.abs(b20.speed - sp20 * 1.25) < 0.01, `${b20.speed}`)

// ── Босс 30-й волны: Сердце Разлома, 4 фазы ──
const g30 = new Game()
setWave(g30, 30)
const b30 = boss(g30)
check('босс 30 спавнится с универсальной бронёй', b30.armor === 'universal')
check('имя босса 30 — Сердце Разлома', BOSSES[30].name === 'Сердце Разлома')
const sp30 = b30.speed

// фаза 1 (≤75%): Панцирь — тяжёлая броня, скорость прежняя
b30.hp = b30.maxHp * 0.74
g30.update(0.05)
check('фаза «Панцирь»: тяжёлая броня', b30.armor === 'heavy' && b30.bossPhase === 1)
check('фаза «Панцирь»: скорость ×1.0', Math.abs(b30.speed - sp30) < 0.01)

// фаза 2 (≤50%): Заражённый призыв — средняя броня ×1.15 + призыв
b30.hp = b30.maxHp * 0.49
g30.update(0.05)
check('фаза «Заражённый призыв»: средняя броня ×1.15', b30.armor === 'medium' && b30.bossPhase === 2)
check('фаза «Заражённый призыв»: nextSummonAt назначен', (b30.nextSummonAt ?? 0) > g30.time)
const before30 = g30.creeps.length
for (let i = 0; i < 40; i++) g30.update(0.05) // ~2 с, призыв через 1.2 с
check('призыв Сердца: крипы появились', g30.creeps.length > before30, `+${g30.creeps.length - before30}`)

// фаза 3 (≤25%): Последний рубеж — лёгкая броня ×1.4 + призыв чаще
b30.hp = b30.maxHp * 0.24
g30.update(0.05)
check('фаза «Последний рубеж»: лёгкая броня', b30.armor === 'light' && b30.bossPhase === 3)
check('фаза «Последний рубеж»: скорость ×1.4', Math.abs(b30.speed - BOSS_SPEED * 1.4) < 0.01, `${b30.speed}`)

// скачок через несколько фаз сразу
const gJump = new Game()
setWave(gJump, 30)
const bj = boss(gJump)
bj.hp = bj.maxHp * 0.1
gJump.update(0.05)
check('скачок до последней фазы одним ударом', bj.bossPhase === 3 && bj.armor === 'light')

// ── Кошмар: у каждого босса вторая способность (доп. призыв) ──
for (const n of [10, 20, 30]) {
  const gm = new Game()
  check(`Кошмар: сложность переключается до волны ${n}`, gm.setDifficulty('nightmare').ok)
  setWave(gm, n)
  const bm = boss(gm)
  let ability = false
  for (let i = 0; i < 400 && !ability; i++) {
    gm.update(0.05)
    ability = gm.events.some((e) => e.type === 'bossAbility')
  }
  check(`Кошмар: босс ${n} использует вторую способность`, ability)
  check(
    `Кошмар: в журнале есть название способности босса ${n}`,
    gm.events.some((e) => e.type === 'bossAbility' && (e.text ?? '').includes(BOSSES[n].nightmare!.name))
  )
}

// победа по-прежнему на последней волне
check('TOTAL_WAVES = 30', TOTAL_WAVES === 30)

// кооп: фазовые поля не ломают снапшот/восстановление
const host = new Game()
host.setCoop(true)
setWave(host, 30)
boss(host).hp = boss(host).maxHp * 0.4
host.update(0.05)
const guest = new Game()
guest.applySnap(JSON.parse(JSON.stringify(host.serialize())))
check('applySnap переносит фазу босса', boss(guest).armor === boss(host).armor && boss(guest).speed === boss(host).speed)

console.log(fails === 0 ? '\nВсе проверки пройдены ✓' : `\nПровалено проверок: ${fails}`)
process.exitCode = fails === 0 ? 0 : 1
