// Арсенал с роллом и пауза.
// Арсенал: 5 разных башен из 17 (15 боевых + стан и шахта — они тоже выпадают в ролле),
// ролл за 10 золота меняет пул, карточка выбывает после покупки, строить можно только из арсенала.
// Пауза: время стоит, крипы не двигаются; строить и роллить на паузе можно; кооп-команды работают.

import { Game, rollPool } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { mulberry32 } from '../src/game/rng'
import { ROLL_COST, SHOP_SIZE, TOWERS, MERGED_TOWERS, ECONOMY_IDS, ECONOMY_TOWERS, RARITIES, RARITY_BY_ID, RARITY_DPS } from '../src/game/config'

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
  const poolIds = [...TOWERS, ...ECONOMY_TOWERS].map((t) => t.id)
  check(`стартовый пул — ${SHOP_SIZE} разных башен (боевые и экономические)`, g.shop.length === SHOP_SIZE && new Set(g.shop).size === SHOP_SIZE, g.shop.join(','))
  check('в пуле только боевые и экономические башни', g.shop.every((id) => poolIds.includes(id)))
  const gold0 = g.gold
  const r = g.roll()
  check(`ролл списывает ${ROLL_COST} золота`, r.ok && g.gold === gold0 - ROLL_COST, `${gold0} → ${g.gold}`)
  check('после ролла снова полный пул', g.shop.length === SHOP_SIZE && new Set(g.shop).size === SHOP_SIZE)

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
  check('после рестарта — новый бесплатный пул и стартовое золото', g.shop.length === SHOP_SIZE && g.gold === 150)

  // тестовый «полный арсенал» не затирается стартом игры
  const u = new Game()
  u.useMap(CLASSIC_MAP) // координаты построек — под классическую змейку
  u.unlockAllTowers()
  u.beginPreview()
  check('unlockAllTowers переживает старт игры', u.shop.length === TOWERS.length + MERGED_TOWERS.length + ECONOMY_IDS.length)
}

// ─── Редкости в ролле (задача 19) ───
{
  // 5 редкостей, монотонность и данных достаточно
  check('редкостей — 5, все уникальны', RARITIES.length === 5 && new Set(RARITIES.map((r) => r.id)).size === 5)
  check('множитель ДПС растёт со ступенью', RARITIES.every((r, i) => i === 0 || RARITIES[i - 1].dpsMult < r.dpsMult))
  check('вес и волна открытия заданы', RARITIES.every((r) => r.weight > 0 && r.fromWave >= 1))

  // детерминированный взвешенный ролл: размер и уникальность
  const p = rollPool(mulberry32(12345), 15)
  check('rollPool даёт 5 разных башен', p.length === SHOP_SIZE && new Set(p).size === SHOP_SIZE, p.join(','))

  // гейтинг: до 8-й волны не выпадают Минеральная и Разломная, до 15-й — Разломная
  const lateIds = RARITIES.filter((r) => r.fromWave > 1)
    .flatMap((r) => TOWERS.filter((t) => t.rarity === r.id).map((t) => t.id))
  const riftIds = TOWERS.filter((t) => t.rarity === 'rift').map((t) => t.id) // prism
  let gatedOk = true
  for (let s = 1; s <= 200; s++) {
    const w1 = rollPool(mulberry32(s * 777), 1)
    const w8 = rollPool(mulberry32(s * 777), 8)
    if (w1.some((id) => lateIds.includes(id))) gatedOk = false
    if (w8.some((id) => riftIds.includes(id))) gatedOk = false
  }
  check('до 8-й волны Минеральная не выпадает, до 15-й — Разломная', gatedOk, lateIds.join(','))
  const prismId = riftIds[0]
  let prismAppeared = false
  for (let s = 1; s <= 200; s++) {
    if (rollPool(mulberry32(s * 777), 15).includes(prismId)) prismAppeared = true
  }
  check('с 15-й волны Разломная выпадает (статистика 200 сидов)', prismAppeared)

  // доли редкостей в длинном прогоне сходятся к весам (без pity, только гейтинг)
  // веса полного ростера: 150/88/45/20/4/16 → карточка: 46/27/14/6/1.2%, экономическая ≈ 5%
  const cards: string[] = []
  for (let s = 1; s <= 3000; s++) cards.push(...rollPool(mulberry32(s * 777 + 1), 15))
  const shareOf = (ids: string[]) => cards.filter((id) => ids.includes(id)).length / cards.length
  const expect: [string, number, number, number][] = [
    ['Латунная', shareOf(TOWERS.filter((t) => t.rarity === 'brass').map((t) => t.id)), 0.4, 0.52],
    ['Стальная', shareOf(TOWERS.filter((t) => t.rarity === 'steel').map((t) => t.id)), 0.23, 0.31],
    ['Кристальная', shareOf(TOWERS.filter((t) => t.rarity === 'crystal').map((t) => t.id)), 0.11, 0.17],
    ['Минеральная', shareOf(TOWERS.filter((t) => t.rarity === 'mineral').map((t) => t.id)), 0.045, 0.082],
    ['Разломная', shareOf(TOWERS.filter((t) => t.rarity === 'rift').map((t) => t.id)), 0.006, 0.024],
  ]
  for (const [name, share, min, max] of expect) {
    check(`доля карточек редкости ${name} сходится к весу`, share > min && share < max, `${Math.round(share * 1000) / 10}%`)
  }

  // живая игра: стартовый пул (волна 1) без поздних редкостей, ролл от this.wave
  const hg = new Game()
  hg.useMap(CLASSIC_MAP)
  hg.beginPreview()
  check('стартовый пул игры без Минеральной и Разломной', hg.shop.every((id) => !lateIds.includes(id)))
  hg.wave = 15
  hg.roll()
  check('ролл на 15-й волне использует гейтинг волны профиля', hg.shop.length === SHOP_SIZE && new Set(hg.shop).size === SHOP_SIZE)

  // множитель ДПС exported и растёт: 1 → ~1.36
  check('множители по редкости 1 → 1.36', RARITY_DPS.brass === 1 && RARITY_DPS.rift === 1.36)
  check('бейджи редкостей доступны по id', RARITY_BY_ID.brass.name === 'Латунная' && RARITY_BY_ID.rift.name === 'Разломная')
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
