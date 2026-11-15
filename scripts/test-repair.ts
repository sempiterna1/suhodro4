// Ремонт главного здания (превью между волнами): «+25 HP за 25 золота»,
// не более 2 покупок за волну. Проверяем чанк, цену, квоту, сброс между
// волнами, запреты (полное HP, волна, нехватка золота) и кооп-команду гостя.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { BUILDING_BASE_HP, REPAIR_CHUNK_HP, REPAIR_GOLD_PER_HP, REPAIR_MAX_BUYS_PER_WAVE } from '../src/game/config'

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

const g = new Game()
g.useMap(CLASSIC_MAP)
g.beginPreview()

check(
  'константы ремонта: +25 HP, 25 золота, 2 покупки',
  REPAIR_CHUNK_HP === 25 && REPAIR_GOLD_PER_HP === 1 && REPAIR_MAX_BUYS_PER_WAVE === 2,
)
check('старт миссии: квота ремонта полная', g.repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)
check('UiState отдаёт квоту ремонта', g.getUiState().repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)

// ─── Полное здание не чинится (и квота не тратится) ───
{
  check('здание цело — HP на максимуме', g.buildingHp === g.buildingMaxHp)
  const res = g.repairBuilding()
  check('целое здание не чинится', !res.ok && !!res.error, res.error ?? '')
  check('неудачный ремонт не тратит квоту', g.repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)
}

// ─── Нехватка золота (квота ещё целая) ───
{
  g.buildingHp = g.buildingMaxHp - 50
  g.gold = 10
  const res = g.repairBuilding()
  check('ремонт без золота запрещён', !res.ok && (res.error ?? '').includes('25'), res.error ?? '')
  check('отказ по золоту не меняет HP', g.buildingHp === g.buildingMaxHp - 50)
  check('отказ по золоту не тратит квоту', g.repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)
  check('отказ по золоту не списывает золото', g.gold === 10)
}

// ─── Частичный чанк: платим только за недостающее HP ───
{
  g.buildingMaxHp = BUILDING_BASE_HP
  g.buildingHp = g.buildingMaxHp - 10
  g.gold = 100
  const res = g.repairBuilding()
  check('частичный ремонт: успешен', res.ok)
  check('частичный ремонт: ровно до максимума', g.buildingHp === g.buildingMaxHp, `${g.buildingHp}/${g.buildingMaxHp}`)
  check('частичный ремонт: цена по факту (10 зол)', g.gold === 90, `золото ${g.gold}`)
  check('частичный ремонт: квота 1', g.repairBuysLeft === 1)
}

// ─── Чанк: +25 HP за 25 золота, кап 2 покупки за волну ───
{
  g.gold = 100
  g.buildingHp = g.buildingMaxHp - 100
  const goldBefore = g.gold
  const hpBefore = g.buildingHp

  const r2 = g.repairBuilding()
  check('ремонт 2: успешен (вторая покупка волны)', r2.ok)
  check('ремонт 2: +25 HP', g.buildingHp === hpBefore + REPAIR_CHUNK_HP, `${hpBefore} → ${g.buildingHp}`)
  check('ремонт 2: −25 золота', g.gold === goldBefore - REPAIR_CHUNK_HP, `${goldBefore} → ${g.gold}`)
  check('ремонт 2: квота 0', g.repairBuysLeft === 0)

  const hpAfter = g.buildingHp
  const goldAfter = g.gold
  const r3 = g.repairBuilding()
  check('ремонт 3: запрещён квотой', !r3.ok && (r3.error ?? '').includes('исчерпан'), r3.error ?? '')
  check('отказ по квоте не меняет HP и золото', g.buildingHp === hpAfter && g.gold === goldAfter)
}

// ─── Волна: ремонт запрещён, квота после волны обновляется ───
{
  // переживаем первую волну без обороны (20 утечек × 10 = 200 урона)
  g.buildingMaxHp = 4000
  g.buildingHp = 4000
  g.startWave()
  check('во время волны квота не обновляется', g.repairBuysLeft === 0)
  const res = g.repairBuilding()
  check('во время волны ремонт запрещён', !res.ok && (res.error ?? '').includes('между волнами'), res.error ?? '')

  let guard = 0
  while (g.phase === 'wave' && guard++ < 20000) g.update(0.05)
  check('волна завершилась без обороны', g.phase === 'preview', `phase=${g.phase}, шагов=${guard}`)
  check('после волны квота снова полная', g.repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)
  check('UiState после волны: квота полная', g.getUiState().repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)

  g.buildingMaxHp = BUILDING_BASE_HP
  g.buildingHp = g.buildingMaxHp
  check('phase между волнами — превью', g.phase === 'preview')
}

// ─── Кооп: команда гостя исполняется хостом ───
{
  g.buildingHp = g.buildingMaxHp - 60
  g.gold = 100
  const before = g.buildingHp
  const err = g.applyGuestCmd({ t: 'repair' })
  check('гость: команда repair принята', err === null, err ?? '')
  check('гость: хост починил +25 HP', g.buildingHp === before + REPAIR_CHUNK_HP)
  check('гость: квота уменьшилась', g.repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE - 1)

  // снапшот переносит квоту гостю — интерфейс гостя видит те же цифры
  const snap = JSON.parse(JSON.stringify(g.serialize()))
  const guest = new Game()
  guest.applySnap(snap)
  check(
    'снапшот: гость видит квоту хоста',
    guest.getUiState().repairBuysLeft === g.repairBuysLeft && guest.repairBuysLeft === g.repairBuysLeft,
    `${guest.repairBuysLeft}`,
  )
  check('снапшот: HP здания совпадает', guest.buildingHp === g.buildingHp && guest.buildingMaxHp === g.buildingMaxHp)
}

// ─── Рестарт: квота обнуляется до первого превью ───
{
  g.reset()
  check('после reset квота 0 (до начала миссии)', g.repairBuysLeft === 0)
  g.beginPreview()
  check('первое превью новой миссии: квота полная', g.repairBuysLeft === REPAIR_MAX_BUYS_PER_WAVE)
}

if (failed > 0) {
  console.log(`\n✗ Провалено проверок: ${failed}`)
  process.exit(1)
} else {
  console.log('\n✓✓ Ремонт здания работает')
}
