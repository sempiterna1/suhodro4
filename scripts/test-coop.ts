// Тест кооп-множителя HP (GDD: 2 игрока → ×1.85)

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { hpForWave, ARMOR_HP_MULT, HP_PLAYTEST_MULT, COOP_HP_MULT, CREEP_KINDS } from '../src/game/config'

/** Тестовая застройка новой механикой: купить в арсенал → взять из руки → поставить */
const buildTower = (g: Game, x: number, y: number, defId: string) => {
  if (!g.shop.includes(defId)) g.shop.push(defId) // карточка одна на пул: ролл снова предложил ту же башню
  const r = g.buy(defId)
  if (!r.ok) return r
  return g.placeFromHand(g.hand.length - 1, x, y)
}
/** Прокачка новой механикой: купить копию → навести из руки на башню */
const levelTower = (g: Game, towerId: number) => {
  const tw = g.towerById(towerId)
  if (!tw || tw.level >= 5) return { ok: false, error: 'не найдена или макс. уровень' }
  if (!g.shop.includes(tw.defId)) g.shop.push(tw.defId) // ролл снова предложил ту же башню
  const r = g.buy(tw.defId)
  if (!r.ok) return r
  return g.levelFromHand(g.hand.length - 1, towerId)
}

const g = new Game()

g.unlockAllTowers() // арсенал случаен — тестам нужны все башни

g.useMap(CLASSIC_MAP) // карта случайна — тестам нужна классическая
g.beginPreview()
g.startWave()

// прогоняем время, чтобы заспавнились крипы
for (let i = 0; i < 60; i++) g.update(0.05)

const solo = g.creeps[0]
// вид врага (паук/жук) случаен — HP сверяем с учётом его множителя
const expectedSolo = hpForWave(1) * ARMOR_HP_MULT.light * HP_PLAYTEST_MULT * CREEP_KINDS[solo.kind].hpMult
console.log(`соло: hp=${solo.maxHp.toFixed(1)} ожид=${expectedSolo.toFixed(1)} | ${Math.abs(solo.maxHp - expectedSolo) < 0.01 ? '✓' : '✗ РЕГРЕССИЯ'}`)

// Включаем кооп — новые волны должны спавниться с ×1.85
g.setCoop(true)
g.reset()
g.coop = true
g.beginPreview()
g.startWave()
for (let i = 0; i < 60; i++) g.update(0.05)

const coop = g.creeps[0]
const baseCoop = hpForWave(1) * ARMOR_HP_MULT.light * HP_PLAYTEST_MULT * CREEP_KINDS[coop.kind].hpMult
const expectedCoop = baseCoop * COOP_HP_MULT
console.log(`кооп: hp=${coop.maxHp.toFixed(1)} ожид=${expectedCoop.toFixed(1)} | соотношение=${(coop.maxHp / baseCoop).toFixed(2)} (надо 1.85)`)
console.log(Math.abs(coop.maxHp - expectedCoop) < 0.1 ? '✓ Кооп-множитель работает' : '✗ РЕГРЕССИЯ коопа')

// Сериализация снапшота — размер и состав
const snap = g.serialize()
const size = JSON.stringify(snap).length
console.log(`снапшот: ${size} байт (${(size / 1024).toFixed(1)} КБ), крипов: ${snap.creeps.length}, башен: ${snap.towers.length}`)

// applySnap на втором экземпляре (гость) — состояние совпадает
const guest = new Game()
guest.unlockAllTowers() // арсенал случаен — тестам нужны все башни
guest.useMap(CLASSIC_MAP) // карта случайна — тестам нужна классическая
guest.applySnap(snap)
if (guest.creeps.length !== snap.creeps.length || guest.gold !== snap.gold || guest.phase !== snap.phase) {
  console.error('✗ РЕГРЕССИЯ applySnap')
  process.exit(1)
}
console.log('✓ applySnap: крипы/золото/фаза восстановлены')

// ─── Команды гостя (applyGuestCmd) ───
const h = new Game()
h.unlockAllTowers() // арсенал случаен — тестам нужны все башни
h.useMap(CLASSIC_MAP) // карта случайна — тестам нужна классическая
h.beginPreview()
if (h.phase !== 'preview') { console.error('✗ нет preview'); process.exit(1) }
const err = h.applyGuestCmd({ t: 'startWave' })
const phaseAfter: string = h.phase
console.log(`startWave от гостя: фаза=${phaseAfter} ${phaseAfter === 'wave' && err === null ? '✓' : '✗ РЕГРЕССИЯ'}`)

// прокачка командой levelHand: строим башню как хост, гость качает копией из руки
const tid = buildTower(h, 300, 300, 'archer').towerId!
h.gold = 1000
h.shop.push('archer') // карточка одна на пул: магазин прокрутили до той же башни
h.applyGuestCmd({ t: 'buy', defId: h.towerById(tid)!.defId })
h.applyGuestCmd({ t: 'levelHand', idx: h.hand.length - 1, id: tid })
h.shop.push('archer') // ролл снова предложил ту же башню
h.applyGuestCmd({ t: 'buy', defId: h.towerById(tid)!.defId })
h.applyGuestCmd({ t: 'levelHand', idx: h.hand.length - 1, id: tid })
const err2 = h.applyGuestCmd({ t: 'levelHand', idx: 999, id: tid }) // рука пуста — отклонение
const tw = h.towerById(tid)
h.gold = 1000
console.log(`upgrade от гостя: ур.=${tw?.level} ${tw?.level === 3 && err2 !== null ? '✓' : '✗ РЕГРЕССИЯ'}`)

// merge командой: вторая башня + слияние (обе L3)
const tid2 = buildTower(h, 370, 300, 'pyro').towerId!
for (let i = 0; i < 2; i++) levelTower(h, tid2)
const err3 = h.applyGuestCmd({ t: 'merge', a: tid, b: tid2 })
const merged = h.towerById(tid2)
console.log(`merge от гостя: ${merged?.defId} ${merged?.defId === 'flame_archer' && err3 === null ? '✓' : '✗ РЕГРЕССИЯ'}`)
