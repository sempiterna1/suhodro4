// Проверка 9 новых башен и 12 рецептов слияния (GDD «15 боевых башен», «Слияние башен»).
// Для каждой башни: строим 1 и 5 ур. у тракта, гоняем волну 1 и проверяем, что она убивает.
// Для механик — точечные проверки: замедление, цепь, линия, уязвимость, аура, разгон, фокус.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP, GRID_H, GRID_W } from '../src/game/map'
import { defFootprint } from '../src/game/data/towers'
import type { TowerDef } from '../src/game/types'
import { ALL_DEFS, ECONOMY_IDS, MERGED_TOWERS, RARITIES, RARITY_DPS, TOWERS } from '../src/game/config'
import type { Creep } from '../src/game/types'

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

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

// точка у первого поворота тракта: крипы проходят рядом с ней
const SPOT = { x: 300, y: 200 }

function setup(defId: string, level: number): Game {
  const g = new Game()
  g.unlockAllTowers() // арсенал случаен — тестам нужны все башни
  g.useMap(CLASSIC_MAP) // карта случайна — тестам нужна классическая
  g.shop.push(defId) // слитые башни в арсенале не продаются — для теста ставим напрямую
  g.beginPreview()
  g.gold = 1e6
  const id = buildTower(g, SPOT.x, SPOT.y, defId).towerId
  if (!id) throw new Error('не построилась ' + defId)
  const tw = g.towerById(id)!
  tw.level = level
  g.startWave()
  return g
}

function run(g: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) g.update(0.05)
}

// ─── состав ───
check('15 боевых башен', TOWERS.length === 15, String(TOWERS.length))
check('12 рецептов слияния', MERGED_TOWERS.length === 12, String(MERGED_TOWERS.length))
for (const m of MERGED_TOWERS) {
  check(`рецепт ${m.name}: родители существуют`, !!ALL_DEFS[m.parents[0]] && !!ALL_DEFS[m.parents[1]] && !ALL_DEFS[m.parents[0]].merged)
}
const pairs = new Set(MERGED_TOWERS.map((m) => [...m.parents].sort().join('+')))
check('пары родителей не повторяются', pairs.size === MERGED_TOWERS.length)

// ─── редкости (задача 19): данные ───
{
  check('редкостей — 5, порядок от дешёвых к дорогим', RARITIES.length === 5 && RARITIES.every((r, i) => i === 0 || RARITIES[i - 1].dpsMult < r.dpsMult))
  check('у каждой боевой башни есть редкость', TOWERS.every((t) => !!t.rarity), TOWERS.filter((t) => !t.rarity).join(','))
  check('экономические постройки вне редкостей', ECONOMY_IDS.every((id) => !ALL_DEFS[id].rarity))
  check('Разломная — Призма вечности за 240', ALL_DEFS.prism.rarity === 'rift' && ALL_DEFS.prism.price === 240, String(ALL_DEFS.prism.price))
  check('Минеральные — Латунный голем и Гарпунница-стена при 160/170', ['golem', 'ballista'].every((id) => ALL_DEFS[id].rarity === 'mineral'))
  // слитые наследуют старшую редкость родителей: проверяем по индексу в RARITIES
  const idx = (id?: string) => RARITIES.findIndex((r) => r.id === id)
  let inheritOk = true
  for (const m of MERGED_TOWERS) {
    const want = Math.max(idx(ALL_DEFS[m.parents[0]].rarity), idx(ALL_DEFS[m.parents[1]].rarity))
    if (idx(m.rarity) !== want) inheritOk = false
  }
  check('слитые наследуют старшую редкость родителей', inheritOk)
}

// ─── редкости (задача 19): множитель ДПС в бою ───
// Средний урон Призмы вечности за выстрел (перехват applyHit: меряем заявленный урон выстрела,
// он не зависит от HP крипов). Волна 1: универсальный урон ×0.8 брони — оба прогона по беде равны,
// разница объявленного урона = множитель редкости (Свобула ×1 → Разломная ×1.36).
{
  const measureAvg = (): number => {
    const g = setup('prism', 1)
    let sum = 0
    let n = 0
    const gf = g as unknown as { applyHit?: (...a: unknown[]) => void }
    const orig = gf.applyHit!.bind(g) as (c: unknown, h: unknown) => void
    gf.applyHit = (c: unknown, h: unknown) => {
      const hh = h as { sourceDefId?: string; damage: number }
      if (hh.sourceDefId === 'prism') { sum += hh.damage; n++ }
      orig(c, h)
    }
    for (let t = 0; t < 40; t += 0.05) g.update(0.05)
    if (n === 0) throw new Error('Призма не выстрелила за 40 с')
    return sum / n
  }
  const prism = ALL_DEFS.prism as typeof ALL_DEFS.prism & { rarity?: typeof RARITIES[number]['id'] }
  const saved = prism.rarity
  prism.rarity = undefined // эмулируем Латунную (множитель ×1)
  const base = measureAvg()
  prism.rarity = 'rift'
  const rift = measureAvg()
  prism.rarity = saved
  check('Разломная бьёт в 1.36 раза сильнее той же башни без редкости', Math.abs(rift / base - RARITY_DPS.rift) < 0.01, `${base} → ${rift}`)
  prism.rarity = saved
}

// ─── каждая башня и слитая башня наносит урон (1 и 5 ур.) ───
// Проверяем урон, а не убийства: одиночная слабая башня 1 ур. (Морозный конденсатор) может не добить
// ни одного врага — HP видов врагов случайно отличаются на ±15%, и тест «мигал».
for (const def of [...TOWERS, ...MERGED_TOWERS]) {
  for (const level of [1, 5]) {
    const g = setup(def.id, level)
    let damaged = false
    for (let t = 0; t < 40; t += 0.05) {
      g.update(0.05)
      if (g.creeps.some((c) => c.hp < c.maxHp)) damaged = true
    }
    check(`${def.name} ур.${level} наносит урон`, damaged || g.stats.kills > 0, `убийств ${g.stats.kills}, ошибок нет`)
  }
}

// ─── механики ───
function firstCreep(g: Game): Creep | undefined {
  return g.creeps[0]
}
{
  const g = setup('frost', 1)
  let slowed = false
  for (let t = 0; t < 30 && !slowed; t += 0.05) {
    g.update(0.05)
    slowed = g.creeps.some((c) => g.time < c.slowUntil && c.slowPct > 0)
  }
  check('Морозный конденсатор замедляет', slowed)
}
{
  const g = setup('lightning', 1)
  let chained = false
  for (let t = 0; t < 30 && !chained; t += 0.05) {
    g.update(0.05)
    chained = g.effects.some((e) => e.kind === 'chain' && (e.points?.length ?? 0) > 2)
  }
  check('Разрядник бьёт цепью', chained)
}
{
  const g = setup('ballista', 1)
  let beam = false
  for (let t = 0; t < 30 && !beam; t += 0.05) {
    g.update(0.05)
    beam = g.effects.some((e) => e.kind === 'beam')
  }
  check('Шпаломёт стреляет болтом по линии', beam)
}
{
  const g = setup('steam_boiler', 3)
  let steamed = false
  for (let t = 0; t < 30 && !steamed; t += 0.05) {
    g.update(0.05)
    steamed = g.creeps.some((c) => g.time < c.vulnUntil && c.vulnBonus > 0)
  }
  check('Паровой котёл накладывает уязвимость', steamed)
}
{
  const g = setup('auto_arsenal', 3)
  run(g, 15)
  const tw = g.towers[0]
  check('Автогарпун разгоняется в волне', tw.rampMult > 1, 'множитель ' + tw.rampMult.toFixed(2))
}
{
  // счётчик сбрасывается при смене цели — смотрим максимум за волну;
  // 1 ур., чтобы цель волны 1 не умирала с одного выстрела
  const g = setup('eternity_prism', 1)
  let maxStacks = 0
  for (let t = 0; t < 30; t += 0.05) {
    g.update(0.05)
    maxStacks = Math.max(maxStacks, g.towers[0].focusStacks)
  }
  check('Око ИИ копит фокус на цели', maxStacks > 0, 'макс. стаков ' + maxStacks)
}
{
  // аура Бастиона: урон соседа растёт на 10%
  const g = new Game()
  g.unlockAllTowers() // арсенал случаен — тестам нужны все башни
  g.useMap(CLASSIC_MAP) // карта случайна — тестам нужна классическая
  g.beginPreview()
  g.gold = 1e6
  const a = buildTower(g, 420, 260, 'archer').towerId! // свободный блок между вертикалями классической карты
  const before = (g as unknown as { auraMult(t: unknown): number }).auraMult(g.towerById(a))
  const b = buildTower(g, 480, 260, 'sentry').towerId!
  const c = buildTower(g, 450, 320, 'mech_guard').towerId!
  for (const id of [b, c]) for (let i = 0; i < 2; i++) levelTower(g, id)
  const m = g.merge(b, c)
  const after = (g as unknown as { auraMult(t: unknown): number }).auraMult(g.towerById(a))
  check('Бастион даёт ауру +10% соседям', m.ok && Math.abs(after - before - 0.1) < 1e-9, `${before} → ${after}`)
}
{
  // все 10 новых рецептов сливаются из своих родителей
  for (const m of MERGED_TOWERS) {
    const g = new Game()
    g.unlockAllTowers() // арсенал случаен — тестам нужны все башни
    g.useMap(CLASSIC_MAP) // карта случайна — тестам нужна классическая
    g.beginPreview()
    g.gold = 1e6
    const a = buildTower(g, 300, 200, m.parents[0]).towerId!
    const b = buildTower(g, 370, 200, m.parents[1]).towerId!
    for (const id of [a, b]) for (let i = 0; i < 2; i++) levelTower(g, id)
    const r = g.merge(a, b)
    check(`слияние → ${m.name}`, r.ok && g.towerById(b)?.defId === m.id)
  }
}
{
  // причины отказа в слиянии — по одной на каждую проверку
  const g = new Game()
  g.unlockAllTowers()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.gold = 1e6
  const at = (x: number, y: number, id: string, level: number) => {
    const t = buildTower(g, x, y, id).towerId!
    g.towerById(t)!.level = level
    return t
  }
  const archer = at(420, 260, 'archer', 3)
  const crossbow = at(460, 260, 'crossbow', 3)
  const pyroLow = at(420, 300, 'pyro', 2)
  const pyroFar = at(860, 60, 'pyro', 3)
  const archer2 = at(500, 260, 'archer', 3)
  const noRecipe = g.mergeError(archer, crossbow) ?? ''
  check('нет рецепта — так и сказано, с подсказкой партнёров', noRecipe.includes('Нет рецепта') && noRecipe.includes('Жаровня'), noRecipe)
  check('низкий уровень — названы уровни', (g.mergeError(archer, pyroLow) ?? '').includes('сейчас 3 и 2'))
  check('далеко — названо расстояние', (g.mergeError(archer, pyroFar) ?? '').includes('Слишком далеко'))
  check('одинаковые башни — отдельная причина', (g.mergeError(archer, archer2) ?? '').includes('разные'))
  g.towerById(pyroLow)!.level = 3
  check('подходящая пара — без ошибки', g.mergeError(archer, pyroLow) === null && g.merge(archer, pyroLow).ok)
}
// ─── Промывочный стан (этап 3): экономические башни тоже выпадают в ролле ───
{
  const g = new Game()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.shop.push('sluice') // пул случаен — для эконом-блока карточку вставляем вручную
  g.gold = 1e6
  check('стан из пула можно купить', g.buy('sluice').ok)
  check('карточка стана выбывает после покупки', !g.shop.includes('sluice'))
  const idx = g.hand.indexOf('sluice')
  check('копия стана в руке', idx >= 0)
  // первая свободная клетка — стан не требует покрытия тропы
  let cell: { x: number; y: number } | null = null
  outer: for (let cy = 0; cy < 15; cy++) {
    for (let cx = 0; cx < 24; cx++) {
      const x = cx * 40 + 20
      const y = cy * 40 + 20
      if (g.canPlace(x, y) === null) {
        cell = { x, y }
        break outer
      }
    }
  }
  check('нашлась свободная клетка', cell !== null)
  const placed = g.placeFromHand(idx, cell!.x, cell!.y)
  check('стан встал на поле', placed.ok)
  // оборона, иначе волна 1 с 20 утечками убивает здание и доход не наступит
  const def = buildTower(g, SPOT.x, SPOT.y, 'golem').towerId!
  g.towerById(def)!.level = 5
  g.startWave()
  run(g, 90) // волна 1 целиком
  const inc = g.events.filter((e) => e.type === 'income' && e.defId === 'sluice' && e.wave === 1)
  check('стан заплатил 7 за волну', inc.length === 1 && inc[0].amount === 7, JSON.stringify(inc))
  check('стан не атакует (0 выстрелов)', g.towers.find((t) => t.defId === 'sluice')!.shotCount === 0)
}
{
  // доход растёт с уровнем; на 5 ур. — ×2 (7×5×2 = 70)
  const g = new Game()
  g.unlockAllTowers()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.gold = 1e6
  const id = buildTower(g, 420, 260, 'sluice').towerId!
  g.towerById(id)!.level = 5
  const def = buildTower(g, SPOT.x, SPOT.y, 'golem').towerId!
  g.towerById(def)!.level = 5
  g.startWave()
  run(g, 90)
  const inc = g.events.filter((e) => e.type === 'income' && e.wave === 1)
  check('доход 5 ур. = 70', inc.length === 1 && inc[0].amount === 70, JSON.stringify(inc))
}
{
  // Кристальная шахта: эссенция за волну, растёт с уровнем (4×2 ур. = 8)
  const g = new Game()
  g.unlockAllTowers()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.gold = 1e6
  const id = buildTower(g, 420, 260, 'mine').towerId!
  g.towerById(id)!.level = 2
  const def = buildTower(g, SPOT.x, SPOT.y, 'golem').towerId!
  g.towerById(def)!.level = 5
  check('эссенция 0 до первой волны', g.essence === 0)
  g.startWave()
  run(g, 40)
  const mineInc = g.events.filter((e) => e.type === 'income' && e.defId === 'mine' && e.wave === 1)
  check('шахта дала 8 эссенции', mineInc.length === 1 && mineInc[0].amount === 8 && g.essence === 8, JSON.stringify(mineInc))
}
// ─── Глубинный бур (этап 3): блок 2×2, эссенция по точной кривой 10 → 45 ───
{
  const def = ALL_DEFS.deep_drill as TowerDef
  check('бур у экономических, без редкости', !!def && ECONOMY_IDS.includes('deep_drill') && !def.rarity)
  check('бур стоит 160', def.price === 160, String(def.price))
  check('бур занимает слот 2×2', defFootprint(def) === 2, String(defFootprint(def)))
  check('кривая эссенции 10→45 по уровням', JSON.stringify(def.incomeByLevel) === JSON.stringify([10, 16, 24, 33, 45]), JSON.stringify(def.incomeByLevel))
}
{
  // правила блока 2×2: края, тропа, аватар, занятые клетки, свободное место
  const g = new Game()
  g.unlockAllTowers()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.gold = 1e6
  // якорь у правого края: блок вылезает справа — нельзя, с названием слота
  const edgeRight = (GRID_W - 1) * 40 + 20
  const edgeBottom = (GRID_H - 1) * 40 + 20
  check('у правого края — «Нужен блок 2×2»', (g.canPlace(edgeRight, 260, 2) ?? '').startsWith('Нужен блок 2×2'), g.canPlace(edgeRight, 260, 2) ?? 'null')
  check('у нижнего края — «Нужен блок 2×2»', (g.canPlace(260, edgeBottom, 2) ?? '').startsWith('Нужен блок 2×2'), g.canPlace(260, edgeBottom, 2) ?? 'null')
  // тропа: ключ, что все 4 клетки блока проверяются (у сужений тракта даже 1×1 конфликтует)
  let onPath = false
  for (let cy = 0; cy < GRID_H; cy++)
    for (let cx = 0; cx < GRID_W; cx++)
      if ([g.canPlace(cx * 40 + 20, cy * 40 + 20, 1), g.canPlace(cx * 40 + 20, cy * 40 + 20, 2)].some((e) => e === 'Нельзя строить на тракте'))
        onPath = true
  check('тропа блокирует и соты, и блок 2×2', onPath)
  // аватар стоит в блоке
  const acell = g.canPlace(60, 260, 2)
  check('аватар блокирует блок 2×2', acell === 'Сорока стоит на этом месте', acell ?? 'null')
  // чужая башня в блоке: чистый блок, ставим в него 1×1 — блок становится занят
  let occCell: { x: number; y: number } | null = null
  outer: for (let cy = 0; cy < GRID_H - 1; cy++)
    for (let cx = 0; cx < GRID_W - 1; cx++) {
      const x = cx * 40 + 20
      const y = cy * 40 + 20
      if (g.canPlace(x, y, 2) === null) { occCell = { x, y }; break outer }
    }
  check('нашёлся чистый блок для занятости', occCell !== null)
  if (occCell) {
    buildTower(g, occCell.x, occCell.y, 'golem')
    check('башня в блоке — «Место занято башней»', g.canPlace(occCell.x, occCell.y, 2) === 'Место занято башней', g.canPlace(occCell.x, occCell.y, 2) ?? 'null')
  }
  // свободное место встаёт якорем в клетку
  let cell: { x: number; y: number } | null = null
  outer: for (let cy = 0; cy < GRID_H - 1; cy++)
    for (let cx = 0; cx < GRID_W - 1; cx++) {
      const x = cx * 40 + 20
      const y = cy * 40 + 20
      // не рядом со спотом голема: место для обороны оставляем, бур там не нужен
      if (Math.abs(x - SPOT.x) < 80 && Math.abs(y - SPOT.y) < 60) continue
      if (g.canPlace(x, y, 2) === null) { cell = { x, y }; break outer }
    }
  check('нашлось место под блок 2×2', cell !== null)
}
{
  // постановка: якорь — клетка клика, блок идёт вправо-вниз, клетки блока занимаются
  const def = ALL_DEFS.deep_drill
  const g = new Game()
  g.unlockAllTowers()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.gold = 1e6
  let cell: { x: number; y: number } | null = null
  outer: for (let cy = 0; cy < GRID_H - 1; cy++)
    for (let cx = 0; cx < GRID_W - 1; cx++) {
      const x = cx * 40 + 20
      const y = cy * 40 + 20
      if (Math.abs(x - SPOT.x) < 200 && Math.abs(y - SPOT.y) < 200) continue // оставим место обороне
      if (g.canPlace(x, y, 2) === null) { cell = { x, y }; break outer }
    }
  check('место под блок найдено', cell !== null)
  const id = buildTower(g, cell!.x, cell!.y, 'deep_drill').towerId!
  const tw = g.towerById(id)!
  check('бур встал якорем в клетку клика', tw.x === cell!.x && tw.y === cell!.y, `${tw.x},${tw.y}`)
  // соседняя клетка блока теперь занята 1×1
  check('клетки блока заняты после постройки', g.canPlace(cell!.x + 40, cell!.y + 40, 1) !== null, g.canPlace(cell!.x + 40, cell!.y + 40, 1) ?? 'null')
  check('бур не атакует', def.damage === 0 && def.range === 0)
}
{
  // защита волны и точная эссенция: 10 / 24 / 45 на 1 / 3 / 5 уровнях
  function drillGold(level: number): { amount: number; essence: number } {
    const g = new Game()
    g.unlockAllTowers()
    g.useMap(CLASSIC_MAP)
    g.beginPreview()
    g.gold = 1e6
    let cell: { x: number; y: number } | null = null
    outer: for (let cy = 0; cy < GRID_H - 1; cy++)
      for (let cx = 0; cx < GRID_W - 1; cx++) {
        const x = cx * 40 + 20
        const y = cy * 40 + 20
        if (Math.abs(x - SPOT.x) < 200 && Math.abs(y - SPOT.y) < 200) continue
        if (g.canPlace(x, y, 2) === null) {
          // свободный блок — вдали от обороны на споте
          cell = { x, y }
          break outer
        }
      }
    const id = buildTower(g, cell!.x, cell!.y, 'deep_drill').towerId!
    g.towerById(id)!.level = level
    const guard = buildTower(g, SPOT.x, SPOT.y, 'golem').towerId!
    g.towerById(guard)!.level = 5
    g.startWave()
    run(g, 90)
    const inc = g.events.filter((e) => e.type === 'income' && e.defId === 'deep_drill' && e.wave === 1)
    return { amount: inc[0]?.amount ?? -1, essence: g.essence }
  }
  check('бур на 1 ур. дал 10 эссенции', drillGold(1).amount === 10)
  check('бур на 3 ур. дал 24 эссенции', drillGold(3).amount === 24)
  check('бур на 5 ур. дал 45 эссенции', drillGold(5).amount === 45)
}
void firstCreep

console.log(failed ? `\n✗ провалено проверок: ${failed}` : '\n✓✓ Все башни и рецепты работают')
process.exit(failed ? 1 : 0)
