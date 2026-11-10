// Лавка предметов (этап 3): витрина, покупка за эссенцию, слоты, продажа,
// редкие версии после 10-й волны, работа эффектов, снапшоты.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import {
  ALL_ITEMS, ITEM_RARE_WAVE, ITEM_REROLL_COST, ITEM_SLOTS, ITEM_SLOTS_TOTAL, ITEMS,
} from '../src/game/config'

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

/** Игра с фиксированной картой и полным арсеналом, готовая к покупкам */
function setup(seed = 7): Game {
  const g = new Game(seed)
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  return g
}

// ─── Витрина и покупка ───
{
  const g = setup()
  check('витрина 4 разных предмета', g.itemShop.length === 4 && new Set(g.itemShop.map((o) => o.id)).size === 4, g.itemShop.map((o) => o.id).join(','))
  check('до 11-й волны редких нет', g.itemShop.every((o) => !o.rare))
  g.essence = 1000
  const offer = g.itemShop[0]
  const price = ALL_ITEMS[offer.id].price
  const ok = g.buyItem(0)
  check('покупка списывает эссенцию и кладёт предмет', ok.ok && g.essence === 1000 - price && g.items.length === 1 && g.items[0].id === offer.id)
  check('купленный предмет исчезает с витрины', g.itemShop.length === 3 && !g.itemShop.some((o) => o.id === offer.id))
}
{
  // лимит слота: оружие одно
  const g = setup()
  g.essence = 1000
  g.itemShop = [{ id: 'commander_blade', rare: false }, { id: 'piercer_tip', rare: false }]
  check('покупка оружия', g.buyItem(0).ok)
  const second = g.buyItem(0) // витрина сдвинулась: теперь piercer_tip на 0
  check('второе оружие отклонено (слот занят)', !second.ok, second.error)
}
{
  // кольца — два, третье не влезает
  const g = setup()
  g.essence = 1000
  g.itemShop = [{ id: 'hunter_ring', rare: false }, { id: 'leader_ring', rare: false }]
  check('первое кольцо купилось', g.buyItem(0).ok)
  check('второе кольцо — можно', g.buyItem(0).ok && g.items.length === 2)
  g.itemShop = [{ id: 'executioner_ring', rare: false }]
  const third = g.buyItem(0)
  check('третье кольцо отклонено (макс. 2)', !third.ok, third.error)
}
{
  // 6 слотов всего: все типы слотов + лишнее кольцо
  const g = setup()
  g.essence = 10000
  g.itemShop = [
    { id: 'anvil', rare: false }, // оружие
    { id: 'balance_plate', rare: false }, // доспех
    { id: 'rage_amulet', rare: false }, // амулет
    { id: 'hunter_ring', rare: false }, // кольцо 1
    { id: 'leader_ring', rare: false }, // кольцо 2
    { id: 'gnome_pickaxe', rare: false }, // реликвия
    { id: 'executioner_ring', rare: false }, // лишнее
  ]
  let bought = 0
  for (let i = 0; i < 7; i++) if (g.buyItem(0).ok) bought++
  check('куплено ровно 6 предметов (слоты)', bought === ITEM_SLOTS_TOTAL && g.items.length === 6, `куплено ${bought}`)
}
{
  // продажа за 50%
  const g = setup()
  g.essence = 100
  g.itemShop = [{ id: 'rage_amulet', rare: false }] // цена 50
  g.buyItem(0)
  check('после покупки эссенции 50', g.essence === 50, String(g.essence))
  const ok = g.sellItem(0)
  check('продажа вернула 25 (50%)', ok.ok && g.essence === 75 && g.items.length === 0, String(g.essence))
}

// ─── Ролл витрины ───
{
  const g = setup()
  g.essence = 100
  const e0 = g.essence
  const ok = g.rollItems()
  check(`обновление витрины стоит ${ITEM_REROLL_COST}`, ok.ok && g.essence === e0 - ITEM_REROLL_COST && g.itemShop.length === 4)
  const poor = new Game(7)
  poor.useMap(CLASSIC_MAP)
  poor.beginPreview()
  poor.essence = ITEM_REROLL_COST - 1
  check('без эссенции обновление отклонено', !poor.rollItems().ok)
}

// ─── Редкие версии после 10-й волны ───
{
  const g = new Game(11)
  g.useMap(CLASSIC_MAP)
  g.wave = ITEM_RARE_WAVE
  g.beginPreview()
  let rare = 0
  let rolls = 0
  g.essence = 1000
  for (let i = 0; i < 40 && rare === 0; i++) {
    if (g.rollItems().ok) rolls++
    rare = g.itemShop.filter((o) => o.rare).length
  }
  check('с 11-й волны редкие появляются', rare > 0, `редких: ${rare} за ${rolls} роллов`)
  // эффект редкой версии: наковальня +22.5% вместо +15%
  g.itemShop = [{ id: 'anvil', rare: true }]
  g.buyItem(0)
  check('редкий предмет экипирован с флагом rare', g.items.some((o) => o.id === 'anvil' && o.rare))
}

// ─── Эффекты ───
{
  // Гномья кирка: +20% эссенции с шахты (4 → 5)
  const g = setup()
  g.unlockAllTowers()
  g.gold = 1e6
  g.essence = 0
  const mine = (() => {
    const r = g.buy('mine')
    if (!r.ok) throw new Error('mine buy')
    const p = g.placeFromHand(g.hand.length - 1, 420, 260)
    return g.towerById(p.towerId!)!
  })()
  const golem = (() => {
    g.shop.push('golem')
    g.buy('golem')
    const p = g.placeFromHand(g.hand.length - 1, 300, 200)
    g.towerById(p.towerId!)!.level = 5
    return true
  })()
  void golem
  g.itemShop = [{ id: 'gnome_pickaxe', rare: false }]
  g.essence = 100
  g.buyItem(0)
  check('кирка экипирована', g.items.some((o) => o.id === 'gnome_pickaxe'))
  g.startWave()
  for (let t = 0; t < 40; t += 0.05) g.update(0.05)
  const inc = g.events.filter((e) => e.type === 'income' && e.defId === 'mine' && e.wave === 1)
  check('кирка: шахта дала 5 вместо 4', inc.length === 1 && inc[0].amount === 5 && g.essence === 65, JSON.stringify(inc))
  void mine
}
{
  // Клинок командира: +10% урона всех башен — сравнение двух одинаковых прогонов.
  // Слабая башня 1 ур.: дельта видна по убийствам, а не по «впитанному» урону
  const run = (withItem: boolean) => {
    const g = new Game(42)
    g.useMap(CLASSIC_MAP)
    g.beginPreview()
    g.unlockAllTowers()
    g.gold = 1e6
    g.shop.push('sentry')
    g.buy('sentry')
    const p = g.placeFromHand(g.hand.length - 1, 300, 200)
    if (withItem) {
      g.essence = 100
      g.itemShop = [{ id: 'commander_blade', rare: false }]
      g.buyItem(0)
    }
    g.startWave()
    for (let t = 0; t < 25; t += 0.05) g.update(0.05)
    return { dmg: g.stats.damageDealt, kills: g.stats.kills }
  }
  const plain = run(false)
  const buffed = run(true)
  check(
    'клинок: с +10% убийств не меньше, урон не ниже',
    buffed.kills >= plain.kills && buffed.dmg >= plain.dmg && (buffed.kills > plain.kills || buffed.dmg > plain.dmg),
    `${plain.kills} уб./${plain.dmg.toFixed(1)} → ${buffed.kills} уб./${buffed.dmg.toFixed(1)}`
  )
}
{
  // Доспех равновесия: универсальная 80% → 90% против лёгкой
  const g = setup()
  check('матрица без предмета: 0.8', g.armorMult('universal', 'light') === 0.8)
  g.essence = 100
  g.itemShop = [{ id: 'balance_plate', rare: false }]
  g.buyItem(0)
  check('с доспехом: 0.9', g.armorMult('universal', 'light') === 0.9)
  check('прочие ячейки не тронуты', g.armorMult('pierce', 'light') === 1.5 && g.armorMult('universal', 'universal') === 1.2)
}
{
  // Кольцо вожака: перезарядка способности ×0.75
  const cd = (withRing: boolean) => {
    const g = setup(5)
    g.unlockAllTowers()
    if (withRing) {
      g.essence = 100
      g.itemShop = [{ id: 'leader_ring', rare: false }]
      g.buyItem(0)
    }
    g.startWave()
    for (let t = 0; t < 5; t += 0.05) g.update(0.05) // крипы вошли в радиус
    const before = g.avatar.cooldown
    g.useAbility()
    return g.avatar.cooldown - before >= 0 ? g.avatar.cooldown : g.avatar.cooldown
  }
  const plain = cd(false)
  const fast = cd(true)
  check('перстень: перезарядка 0.75×', Math.abs(fast - plain * 0.75) < 0.01, `${plain} → ${fast}`)
}

// ─── Снапшот и команды гостя ───
{
  const host = setup(3)
  host.essence = 200
  host.itemShop = [{ id: 'rage_amulet', rare: false }]
  check('гость: покупка предмета', host.applyGuestCmd({ t: 'itemBuy', idx: 0 }) === null && host.items.length === 1 && host.essence === 150)
  const guest = new Game(3)
  guest.useMap(CLASSIC_MAP)
  guest.applySnap(host.serialize())
  check('снапшот переносит предметы и витрину', guest.items.length === 1 && guest.items[0].id === 'rage_amulet' && guest.itemShop.length === host.itemShop.length)
  check('гость: продажа предмета', host.applyGuestCmd({ t: 'itemSell', idx: 0 }) === null && host.items.length === 0 && host.essence === 175)
  check('гость: обновление витрины', host.applyGuestCmd({ t: 'itemRoll' }) === null && host.essence === 175 - ITEM_REROLL_COST)
}

console.log(failed ? `\n✗ провалено проверок: ${failed}` : '\n✓✓ Лавка предметов работает')
process.exit(failed ? 1 : 0)
