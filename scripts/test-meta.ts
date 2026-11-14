// Метапрогрессия «Верстак» (docs/meta.md): данные деталей, лесенка карт, сейв,
// бонусы башен, сундуки, применение к движку, множитель HP карт.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { MAP_DEFS } from '../src/game/data/maps'
import { CHESTS, PARTS, PART_BY_ID, PART_STATS, rollChest, type AchievementCtx } from '../src/game/data/meta'
import {
  ACHIEVEMENTS, DAILY_TASKS, META_KEY, applyDrop, buildName, chestForAchievement, chestForDaily, chestForWin,
  claimTask, collectionRows, dailyReady, emptyMeta, ensureDailyTasks, evaluateAchievements, isAchieved,
  isMapUnlocked, loadMeta, partUnits, rawStorage, registerWinTasks, resetMeta, saveMeta, setBuildName,
  taskClaimable, taskClaimed, taskProgress, taskReward, towerMetaBonus, unlockNextMap,
} from '../src/game/meta'
import { TOWERS } from '../src/game/data/towers'

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

/** Детерминированный rng для тестов */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Данные: детали покрывают все боевые башни, три слота, капы ───
{
  const ids = new Set(PARTS.map((p) => p.id))
  check('уникальные id деталей', ids.size === PARTS.length)
  const towersCovered = new Set(PARTS.map((p) => p.towerId))
  check('детали есть у каждой боевой башни', TOWERS.every((t) => towersCovered.has(t.id)))
  check('у каждой башни три слота (урон/скорострельность/дальность)', TOWERS.every((t) => PART_STATS.every((s) => ids.has(`${t.id}-${s.stat}`))))
  check('шаг и кап положительные', PARTS.every((p) => p.step > 0 && p.max > 0))
  check('имя детали содержит имя башни', PARTS.every((p) => {
    const towerName = TOWERS.find((t) => t.id === p.towerId)!.name
    return p.name.includes(towerName)
  }))
}

// ─── Лесенка карт ───
{
  const m = emptyMeta()
  check('первая карта открыта', isMapUnlocked(m, 'tract') && m.unlocked.length === 1)
  check('вторая карта заперта', !isMapUnlocked(m, 'mill'))
  check('победа не на открытой карте ничего не открывает', unlockNextMap(m, 'valley') === null)
  check('победа на первой открывает вторую', unlockNextMap(m, 'tract') === 'mill' && isMapUnlocked(m, 'mill'))
  check('повторная победа не открывает третью', unlockNextMap(m, 'tract') === null)
  check('победа на второй открывает третью', unlockNextMap(m, 'mill') === 'bridge')
  const hp = MAP_DEFS.map((d) => d.hpMult)
  check('каждая карта сложнее предыдущей (×HP)', hp.every((v, i) => i === 0 || v > hp[i - 1]), hp.join(' / '))
}

// ─── Сейв: круг в памяти хранилища ───
{
  resetMeta()
  const m = emptyMeta()
  m.parts['archer-damage'] = 4
  m.unlocked.push('mill')
  m.wins = 2
  m.winsByMap['tract'] = 2
  saveMeta(m)
  const loaded = loadMeta()
  check('сейв читается обратно', loaded.parts['archer-damage'] === 4 && isMapUnlocked(loaded, 'mill') && loaded.wins === 2)
  check('битый сейв не роняет загрузку', (() => {
    try {
      rawStorage().setItem('zr-meta', '{битый json')
      const bad = loadMeta()
      return bad.v === 1 && Array.isArray(bad.unlocked)
    } finally {
      resetMeta()
    }
  })())
}

// ─── Бонусы башен: математика и капы ───
{
  const m = emptyMeta()
  m.parts['archer-damage'] = 3
  m.parts['archer-cadence'] = 2
  m.parts['pyro-range'] = 99 // кап обрежется при чтении
  const archer = towerMetaBonus(m, 'archer')
  check('урон: 3 единицы × 1.5% = ×1.045', Math.abs(archer.damage - 1.045) < 1e-9, String(archer.damage))
  check('скорострельность: 2 единицы × 1% = ×0.98', Math.abs(archer.cadence - 0.98) < 1e-9, String(archer.cadence))
  const pyro = towerMetaBonus(m, 'pyro')
  check('дальность: 99 единиц обрезано капом 5 = ×1.05', Math.abs(pyro.range - 1.05) < 1e-9, String(pyro.range))
  const none = towerMetaBonus(m, 'mauler')
  check('без деталей множители единичные', none.damage === 1 && none.cadence === 1 && none.range === 1)
}

// ─── Сундуки ───
{
  const rng = mulberry32(42)
  const m = emptyMeta()
  const first = chestForWin(m, 'tract', rng)
  check('первое прохождение даёт сундук всегда', first !== null && first.chest === CHESTS.firstClear.id)
  const units = first!.parts.reduce((s, p) => s + p.units, 0)
  check('в сундуке первопроходца 3–5 деталей', units >= 3 && units <= 5, String(units))
  const parts = first!.parts
  check('дроп — существующие детали', parts.every((p) => !!PART_BY_ID[p.partId]))
  applyDrop(m, first!)
  check('дроп вписан в сейв', m.parts[parts[0].partId] === parts[0].units)
  const rng2 = mulberry32(1) // rng() < 0.25 не всегда — проверим оба исхода на серии
  let drops = 0
  for (let i = 0; i < 400; i++) {
    const mm = emptyMeta()
    mm.winsByMap['tract'] = 1
    if (chestForWin(mm, 'tract', mulberry32(100 + i))) drops++
  }
  check('повторная победа: сундук по шансу 25%', drops > 70 && drops < 130, `${drops}/400`)
  check('дневной сундук готов в первый день', dailyReady(m))
  const daily = chestForDaily(m, rng)
  applyDrop(m, daily)
  check('дневной сундук 2–4 детали', (() => {
    const n = daily.parts.reduce((s, p) => s + p.units, 0)
    return n >= 2 && n <= 4
  })())
  const roll = rollChest(CHESTS.daily, mulberry32(7))
  check('ролл сундука детерминирован по зерну', rollChest(CHESTS.daily, mulberry32(7)).every((p, i) => p.partId === roll[i].partId && p.units === roll[i].units))
}

// ─── Верстак: сводка коллекции ───
{
  const m = emptyMeta()
  m.parts['archer-damage'] = 10 // кап урона 10
  const rows = collectionRows(m)
  const archer = rows.find((r) => r.towerId === 'archer')!
  const dmg = archer.stats.find((s) => s.stat === 'damage')!
  check('сводка ограничена капом', dmg.units === 10 && dmg.max === 10)
  check('все 15 башен в сводке', rows.length === TOWERS.length)
}

// ─── Движок: множитель HP лесенки карт ───
{
  const valley = MAP_DEFS.find((d) => d.id === 'valley')!
  const g1 = new Game(5)
  check('обучающая карта без множителя HP', g1.mapDef.hpMult === 1.0, `hpMult=${g1.mapDef.hpMult}`)
  const g2 = new Game(5)
  g2.selectMap(valley.seed)
  check('лесенка: Пепельная долина ×1.4', g2.mapDef.hpMult === 1.4 && valley.hpMult === 1.4)
}

// ─── Движок: детали усиливают башню ───
{
  const CELL = 40
  const placeOnPath = (game: Game, defId: string, range: number): void => {
    // сэмплируем тропу и выбираем свободную клетку с максимальным покрытием (как в sim.ts)
    const samples: Array<{ x: number; y: number }> = []
    const pts = game.map.points
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const n = Math.max(1, Math.ceil(len / 20))
      for (let k = 0; k < n; k++) samples.push({ x: a.x + (b.x - a.x) * (k / n), y: a.y + (b.y - a.y) * (k / n) })
    }
    let best: { x: number; y: number; score: number } | null = null
    for (let cy = 0; cy < 720 / CELL; cy++) {
      for (let cx = 0; cx < 1280 / CELL; cx++) {
        const x = cx * CELL + CELL / 2
        const y = cy * CELL + CELL / 2
        if (game.canPlace(x, y) !== null) continue
        const score = samples.filter((s) => Math.hypot(s.x - x, s.y - y) <= range).length
        if (score > (best?.score ?? 0)) best = { x, y, score }
      }
    }
    if (!best) throw new Error('нет клетки с покрытием тропы')
    const res = game.placeFromHand(0, best.x, best.y)
    if (!res.ok || !res.towerId) throw new Error('постановка не удалась: ' + res.error)
  }
  const runFixed = (meta: boolean): number => {
    const game = new Game(11)
    game.useMap(CLASSIC_MAP)
    game.beginPreview()
    if (meta) game.metaBonus = (towerId) => (towerId === 'archer' ? { damage: 1.15, cadence: 1, range: 1 } : { damage: 1, cadence: 1, range: 1 })
    game.gold = 10000
    game.shop = ['archer', 'archer', 'archer', 'archer', 'archer']
    if (!game.buy('archer').ok) throw new Error('покупка не удалась')
    placeOnPath(game, 'archer', 140)
    game.startWave()
    // детерминизм: все крипы бессмертны (бужуем до и после update — включая свежих);
    // метрика — урон башни, аватар не мешает (его урон считается отдельно в damageByTower)
    for (let i = 0; i < 240; i++) {
      for (const c of game.creeps) {
        c.hp = 1e9
        c.maxHp = 1e9
      }
      game.update(1 / 30)
      for (const c of game.creeps) {
        c.hp = 1e9
        c.maxHp = 1e9
      }
    }
    return game.stats.damageByTower['archer'] ?? 0
  }
  const base = runFixed(false)
  const withMeta = runFixed(true)
  if (base <= 0) throw new Error('башня не выстрелила ни разу')
  const ratio = withMeta / base
  check('детали усиливают урон башни (×1.15)', Math.abs(ratio - 1.15) < 0.02, `×${ratio.toFixed(3)} (${Math.round(base)} → ${Math.round(withMeta)})`)
}

// ─── Задачи дня (сектор СОБЫТИЯ хаб-меню) ───
{
  const noon = new Date(2026, 0, 15, 12, 0).getTime()
  const nextDay = new Date(2026, 0, 16, 12, 0).getTime()
  const m = emptyMeta()
  check('в пустом сейве задачи на нуле', DAILY_TASKS.every((t) => taskProgress(m, t.id, noon) === 0))

  registerWinTasks(m, 'tract', noon)
  check('одна победа: win-1 готова', taskProgress(m, 'daily-win-1', noon) === 1)
  check('одна победа: win-2 в прогрессе', taskProgress(m, 'daily-win-2', noon) === 1)
  check('одна карта: maps-2 в прогрессе', taskProgress(m, 'daily-maps-2', noon) === 1)

  registerWinTasks(m, 'tract', noon)
  registerWinTasks(m, 'mill', noon)
  check('две победы: win-2 выполнена', taskProgress(m, 'daily-win-2', noon) === 2)
  check('две разные карты: maps-2 выполнена', taskProgress(m, 'daily-maps-2', noon) === 2)

  check('win-1 можно забрать', taskClaimable(m, 'daily-win-1', noon))
  const drop = claimTask(m, 'daily-win-1', noon)
  check('награда win-1 — детали', drop !== null && drop.parts.reduce((s, p) => s + p.units, 0) >= 1)
  check('win-1 отмечена взятой', taskClaimed(m, 'daily-win-1', noon))
  check('повторное взятие запрещено', claimTask(m, 'daily-win-1', noon) === null && !taskClaimable(m, 'daily-win-1', noon))

  // детерминированная награда: два ролла одного дня совпадают, у задач — свои
  const again = taskReward('daily-win-1', noon)
  check('награда детерминирована на сутки', JSON.stringify(again) === JSON.stringify(taskReward('daily-win-1', noon)))
  check('у разных задач награда своя', JSON.stringify(taskReward('daily-maps-2', noon)) !== JSON.stringify(again))

  // новый день: счётчики и взятые награды сбрасываются
  ensureDailyTasks(m, nextDay)
  check('новый день: прогресс на нуле', DAILY_TASKS.every((t) => taskProgress(m, t.id, nextDay) === 0))
  check('новый день: win-1 снова не взята', !taskClaimed(m, 'daily-win-1', nextDay))
  check('новый день: win-1 нельзя взять сразу', !taskClaimable(m, 'daily-win-1', nextDay))

  // миграция старого сейва без поля daily
  const old = { v: 1, parts: {}, unlocked: ['tract'], dailyAt: null, wins: 3, winsByMap: { tract: 3 } }
  rawStorage().setItem(META_KEY, JSON.stringify(old))
  const migrated = loadMeta()
  check(
    'старый сейв добирается полем daily',
    migrated.daily.at === null && migrated.daily.wins === 0 && migrated.daily.claimed.length === 0 && migrated.wins === 3,
  )
  check('старый сейв добирается полем achieved/builds', Array.isArray(migrated.achieved) && migrated.achieved.length === 0 && typeof migrated.builds === 'object')
  rawStorage().setItem(META_KEY, JSON.stringify(emptyMeta()))
}

// ─── Ачивки (этап 2): одноразовые сундуки за подвиги ───
{
  const m = emptyMeta()
  check('в пустом сейве ачивок нет', ACHIEVEMENTS.every((a) => !isAchieved(m, a.id)))
  const ctx: AchievementCtx = {
    leaked: 0,
    merges: 6,
    difficulty: 'nightmare',
    wins: 10,
    winsByMap: { tract: 3, mill: 2, bridge: 1, mines: 1, pass: 1, valley: 2 },
    parts: { 'archer-damage': 10 },
    unlocked: ['tract', 'mill', 'bridge', 'mines', 'pass', 'valley'],
  }
  const fresh = evaluateAchievements(m, ctx)
  check('выполнены все 6 ачивок сразу', fresh.length === ACHIEVEMENTS.length, `${fresh.length}/${ACHIEVEMENTS.length}`)
  check('ахивки вписаны в сейв', ACHIEVEMENTS.every((a) => isAchieved(m, a.id)))
  const again = evaluateAchievements(m, ctx)
  check('повторная проверка ничего не выдаёт (одноразово)', again.length === 0)

  // частичные итоги: только подходящие ачивки
  const m2 = emptyMeta()
  const partial = evaluateAchievements(m2, { ...ctx, leaked: 2, merges: 1, difficulty: 'recruit', wins: 1, winsByMap: { tract: 1 }, parts: {}, unlocked: ['tract'] })
  check('без подвигов ачивок нет', partial.length === 0, partial.map((a) => a.id).join(','))
  const noLeaks = evaluateAchievements(m2, { ...ctx, leaked: 0, merges: 1, difficulty: 'recruit', wins: 1, winsByMap: { tract: 1 }, parts: {}, unlocked: ['tract'] })
  check('идеальная оборона берётся одна', noLeaks.length === 1 && noLeaks[0].id === 'clean-defense')

  // сундук за ачивку: в диапазоне награды, детали существующие
  const def = ACHIEVEMENTS.find((a) => a.id === 'nightmare-victory')!
  const drop = chestForAchievement(def, mulberry32(5))
  const n = drop.parts.reduce((s, p) => s + p.units, 0)
  check('сундук за ачивку в диапазоне награды', n >= def.reward[0] && n <= def.reward[1], `${n} (${def.reward[0]}–${def.reward[1]})`)
  check('сундук за ачивку — существующие детали', drop.parts.every((p) => !!PART_BY_ID[p.partId]))
  check('у всех ачивок иконка и описание', ACHIEVEMENTS.every((a) => a.icon.length > 0 && a.desc.length > 0 && a.reward[0] > 0))
}

// ─── Имена билдов (этап 2) ───
{
  const m = emptyMeta()
  check('без имени билд не назван', buildName(m, 'archer') === null)
  setBuildName(m, 'archer', '  Дальний бой  ')
  check('имя билда обрезано по краям', buildName(m, 'archer') === 'Дальний бой')
  setBuildName(m, 'archer', 'х'.repeat(40))
  check('имя билда ограничено 24 символами', buildName(m, 'archer')!.length === 24)
  setBuildName(m, 'archer', '')
  check('пустое имя сбрасывает билд', buildName(m, 'archer') === null)
}

if (failed > 0) {
  console.log(`\n✗ Провалено проверок: ${failed}`)
  process.exit(1)
} else {
  console.log('\n✓✓ Метапрогрессия «Верстак» работает')
}
