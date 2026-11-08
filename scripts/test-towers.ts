// Проверка 9 новых башен и 12 рецептов слияния (GDD «15 боевых башен», «Слияние башен»).
// Для каждой башни: строим 1 и 5 ур. у тракта, гоняем волну 1 и проверяем, что она убивает.
// Для механик — точечные проверки: замедление, цепь, линия, уязвимость, аура, разгон, фокус.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { ALL_DEFS, MERGED_TOWERS, TOWERS } from '../src/game/config'
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

// ─── каждая башня и слитая башня наносит урон (1 и 5 ур.) ───
// Проверяем урон, а не убийства: одиночная слабая башня 1 ур. (Ледяной шпиль) может не добить
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
  check('Ледяной шпиль замедляет', slowed)
}
{
  const g = setup('lightning', 1)
  let chained = false
  for (let t = 0; t < 30 && !chained; t += 0.05) {
    g.update(0.05)
    chained = g.effects.some((e) => e.kind === 'chain' && (e.points?.length ?? 0) > 2)
  }
  check('Заклинатель молний бьёт цепью', chained)
}
{
  const g = setup('ballista', 1)
  let beam = false
  for (let t = 0; t < 30 && !beam; t += 0.05) {
    g.update(0.05)
    beam = g.effects.some((e) => e.kind === 'beam')
  }
  check('Баллиста стреляет болтом по линии', beam)
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
  check('Автоматический арсенал разгоняется в волне', tw.rampMult > 1, 'множитель ' + tw.rampMult.toFixed(2))
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
  check('Призма вечности копит фокус на цели', maxStacks > 0, 'макс. стаков ' + maxStacks)
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
  check('нет рецепта — так и сказано, с подсказкой партнёров', noRecipe.includes('Нет рецепта') && noRecipe.includes('Пиромант'), noRecipe)
  check('низкий уровень — названы уровни', (g.mergeError(archer, pyroLow) ?? '').includes('сейчас 3 и 2'))
  check('далеко — названо расстояние', (g.mergeError(archer, pyroFar) ?? '').includes('Слишком далеко'))
  check('одинаковые башни — отдельная причина', (g.mergeError(archer, archer2) ?? '').includes('разные'))
  g.towerById(pyroLow)!.level = 3
  check('подходящая пара — без ошибки', g.mergeError(archer, pyroLow) === null && g.merge(archer, pyroLow).ok)
}
void firstCreep

console.log(failed ? `\n✗ провалено проверок: ${failed}` : '\n✓✓ Все башни и рецепты работают')
process.exit(failed ? 1 : 0)
