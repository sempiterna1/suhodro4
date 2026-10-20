// Тест кооп-множителя HP (GDD: 2 игрока → ×1.85)

import { Game } from '../src/game/engine'
import { hpForWave, ARMOR_HP_MULT, HP_PLAYTEST_MULT, COOP_HP_MULT } from '../src/game/config'

const g = new Game()
g.beginPreview()
g.startWave()

// прогоняем время, чтобы заспавнились крипы
for (let i = 0; i < 60; i++) g.update(0.05)

const solo = g.creeps[0]
const expectedSolo = hpForWave(1) * ARMOR_HP_MULT.light * HP_PLAYTEST_MULT
console.log(`соло: hp=${solo.hp.toFixed(1)} ожид=${expectedSolo.toFixed(1)} | ${Math.abs(solo.hp - expectedSolo) < 0.01 ? '✓' : '✗ РЕГРЕССИЯ'}`)

// Включаем кооп — новые волны должны спавниться с ×1.85
g.setCoop(true)
g.reset()
g.coop = true
g.beginPreview()
g.startWave()
for (let i = 0; i < 60; i++) g.update(0.05)

const coop = g.creeps[0]
const expectedCoop = expectedSolo * COOP_HP_MULT
console.log(`кооп: hp=${coop.hp.toFixed(1)} ожид=${expectedCoop.toFixed(1)} | соотношение=${(coop.hp / expectedSolo).toFixed(2)} (надо 1.85)`)
console.log(Math.abs(coop.hp - expectedCoop) < 0.1 ? '✓ Кооп-множитель работает' : '✗ РЕГРЕССИЯ коопа')

// Сериализация снапшота — размер и состав
const snap = g.serialize()
const size = JSON.stringify(snap).length
console.log(`снапшот: ${size} байт (${(size / 1024).toFixed(1)} КБ), крипов: ${snap.creeps.length}, башен: ${snap.towers.length}`)

// applySnap на втором экземпляре (гость) — состояние совпадает
const guest = new Game()
guest.applySnap(snap)
if (guest.creeps.length !== snap.creeps.length || guest.gold !== snap.gold || guest.phase !== snap.phase) {
  console.error('✗ РЕГРЕССИЯ applySnap')
  process.exit(1)
}
console.log('✓ applySnap: крипы/золото/фаза восстановлены')

// ─── Команды гостя (applyGuestCmd) ───
const h = new Game()
h.beginPreview()
if (h.phase !== 'preview') { console.error('✗ нет preview'); process.exit(1) }
const err = h.applyGuestCmd({ t: 'startWave' })
console.log(`startWave от гостя: фаза=${h.phase} ${h.phase === 'wave' && err === null ? '✓' : '✗ РЕГРЕССИЯ'}`)

// upgrade командой: строим башню как хост, гость качает
const tid = h.build(300, 300, 'archer').towerId!
h.upgrade(tid)
h.upgrade(tid)
h.gold = 1000
const err2 = h.applyGuestCmd({ t: 'upgrade', id: tid })
const tw = h.towerById(tid)
console.log(`upgrade от гостя: ур.=${tw?.level} ${tw?.level === 4 && err2 === null ? '✓' : '✗ РЕГРЕССИЯ'}`)

// merge командой: вторая башня + слияние (обе L3)
const tid2 = h.build(370, 300, 'pyro').towerId!
for (let i = 0; i < 2; i++) h.upgrade(tid2)
const err3 = h.applyGuestCmd({ t: 'merge', a: tid, b: tid2 })
const merged = h.towerById(tid2)
console.log(`merge от гостя: ${merged?.defId} ${merged?.defId === 'flame_archer' && err3 === null ? '✓' : '✗ РЕГРЕССИЯ'}`)
