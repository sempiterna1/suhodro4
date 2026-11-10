// Арсенал с роллом и пауза.
// Арсенал: 5 разных башен из 15 + постоянные экономические постройки (стан, шахта),
// ролл за 10 золота меняет только боевой пул, строить можно только из арсенала.
// Пауза: время стоит, крипы не двигаются; строить и роллить на паузе можно; кооп-команды работают.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { ROLL_COST, SHOP_SIZE, TOWERS, MERGED_TOWERS, ECONOMY_IDS } from '../src/game/config'

/** Тестовая застройка новой механикой: купить в арсенал → взять из руки → поставить */
const buildTower = (g: Game, x: number, y: number, defId: string) => {
  const r = g.buy(defId)
  if (!r.ok) return r
  return g.placeFromHand(g.hand.length - 1, x, y)
}
/** Прокачка новой механикой: купить копию → навести из руки на башню */
const levelTower = (g: Game, towerId: number) => {
  const tw = g.towerById(towerId)
  if (!tw || tw.level >= 5) return { ok: false, error: 'не найдена или макс. уровень' }
  const r = g.buy(tw.defId)
  if (!r.ok) return r
  return g.levelFromHand(g.hand.length - 1, towerId)
}

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

// ─── Арсенал ───
{
  const g = new Game()
  g.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  // до старта пул пуст: Game создаётся и при SSR, случайный пул сломал бы гидратацию
  check('до старта игры пул пуст', g.shop.length === 0)
  g.beginPreview()
  const poolSize = SHOP_SIZE + ECONOMY_IDS.length
  check(`стартовый пул — ${SHOP_SIZE} разных башен + экономические постройки`, g.shop.length === poolSize && new Set(g.shop).size === poolSize, g.shop.join(','))
  check('боевая часть пула — только боевые башни', g.shop.filter((id) => !ECONOMY_IDS.includes(id)).every((id) => TOWERS.some((t) => t.id === id)))
  const gold0 = g.gold
  const r = g.roll()
  check(`ролл списывает ${ROLL_COST} золота`, r.ok && g.gold === gold0 - ROLL_COST, `${gold0} → ${g.gold}`)
  check('после ролла снова полный пул', g.shop.length === poolSize && new Set(g.shop).size === poolSize)

  g.gold = ROLL_COST - 1
  const poor = g.roll()
  check('без золота ролл отклонён', !poor.ok && g.gold === ROLL_COST - 1, poor.error)

  // строить можно только из пула
  g.gold = 1e6
  const outside = TOWERS.find((t) => !g.shop.includes(t.id))!
  const bad = g.buy(outside.id)
  check('башню не из пула купить нельзя', !bad.ok, bad.error)
  const good = buildTower(g, 300, 200, g.shop[0])
  check('башню из пула построить можно', good.ok)
  check('купленная башня уходит из пула до ролла', !g.shop.includes(g.towerById(good.towerId!)!.defId))

  // прокачка копией: если карточки башни нет в арсенале — копию не купить
  g.shop = g.shop.filter((id) => id !== g.towerById(good.towerId!)!.defId)
  check('прокачка без карточки в арсенале отклонена', !levelTower(g, good.towerId!).ok)

  // разные роллы дают разные пулы (вероятность совпадения 50 роллов подряд ничтожна)
  const seen = new Set<string>()
  for (let i = 0; i < 50; i++) {
    g.roll()
    seen.add([...g.shop].sort().join(','))
  }
  check('роллы случайны', seen.size > 1, `разных пулов: ${seen.size}`)

  // рестарт даёт новый бесплатный пул
  g.reset()
  g.beginPreview()
  check('после рестарта — новый бесплатный пул и стартовое золото', g.shop.length === SHOP_SIZE + ECONOMY_IDS.length && g.gold === 150)

  // тестовый «полный арсенал» не затирается стартом игры
  const u = new Game()
  u.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  u.unlockAllTowers()
  u.beginPreview()
  check('unlockAllTowers переживает старт игры', u.shop.length === TOWERS.length + MERGED_TOWERS.length + ECONOMY_IDS.length)
}

// ─── Пауза ───
{
  const g = new Game()
  g.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  g.beginPreview()
  g.startWave()
  for (let i = 0; i < 40; i++) g.update(0.05)
  const t0 = g.time
  const dist0 = g.creeps.map((c) => c.dist).join(',')

  g.setPaused(true)
  for (let i = 0; i < 40; i++) g.update(0.05)
  check('на паузе время стоит', g.time === t0, `${t0} → ${g.time}`)
  check('на паузе крипы не двигаются', g.creeps.map((c) => c.dist).join(',') === dist0)

  const goldBefore = g.gold
  check('на паузе можно роллить', g.roll().ok && g.gold === goldBefore - ROLL_COST)
  g.gold = 1e6
  check('на паузе можно строить', buildTower(g, 300, 200, g.shop[0]).ok)

  g.setPaused(false)
  for (let i = 0; i < 10; i++) g.update(0.05)
  check('после снятия паузы время идёт', g.time > t0)

  // пауза в превью тоже останавливает таймер до волны
  const p = new Game()
  p.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  p.beginPreview()
  const left = p.previewRemaining
  p.setPaused(true)
  for (let i = 0; i < 40; i++) p.update(0.05)
  check('на паузе таймер до волны стоит', p.previewRemaining === left)

  g.reset()
  check('рестарт снимает паузу', !g.paused)
}

// ─── Бесконечное золото (чит для тестов) ───
{
  const g = new Game()
  g.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  g.beginPreview()
  g.gold = 123
  g.setInfiniteGold(true)
  const full = g.gold
  check('чит включает много золота', full >= 99999, String(full))
  const b = buildTower(g, 300, 200, g.shop[0])
  g.roll()
  if (b.ok) levelTower(g, b.towerId!)
  check('траты не уменьшают золото', b.ok && g.gold === full, String(g.gold))
  g.reset()
  check('чит переживает рестарт', g.infiniteGold && g.gold === full)
  g.setInfiniteGold(false)
  check('выключение возвращает обычное золото', g.gold === 150, String(g.gold))

  const h = new Game()

  h.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  h.beginPreview()
  h.gold = 77
  h.setInfiniteGold(true)
  h.setInfiniteGold(false)
  check('выключение без рестарта — золото как до включения', h.gold === 77, String(h.gold))
  check('гость: бесконечное золото', h.applyGuestCmd({ t: 'setInfiniteGold', on: true }) === null && h.infiniteGold)
  const gg = new Game()
  gg.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  gg.applySnap(h.serialize())
  check('снапшот переносит чит', gg.infiniteGold)
}

// ─── Кооп: команды гостя и снапшот ───
{
  const host = new Game()
  host.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  host.beginPreview()
  const gold0 = host.gold
  check('гость: ролл', host.applyGuestCmd({ t: 'roll' }) === null && host.gold === gold0 - ROLL_COST)
  check('гость: пауза', host.applyGuestCmd({ t: 'setPaused', paused: true }) === null && host.paused)

  const guest = new Game()

  guest.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  guest.applySnap(host.serialize())
  check('снапшот переносит пул и паузу', guest.paused && guest.shop.join() === host.shop.join())
  host.essence = 42
  const guest2 = new Game()
  guest2.useMap(CLASSIC_MAP)
  guest2.applySnap(host.serialize())
  check('снапшот переносит эссенцию', guest2.essence === 42)
  const t0 = guest.time
  guest.guestTick(0.5)
  check('гость на паузе не интерполирует время', guest.time === t0)
}

console.log(failed ? `\n✗ провалено проверок: ${failed}` : '\n✓✓ Арсенал и пауза работают')
process.exit(failed ? 1 : 0)
