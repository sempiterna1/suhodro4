// Золотые тесты формул баланса (этап 1).
// Проверяют именно числа: HP волны, золото за убийство, бонус волны,
// матрицу урона, уровни/скорость. При изменении баланса эти значения
// должны меняться осознанно — тест ловит случайную правку.

import {
  ARMOR_HP_MULT,
  ARMOR_SPEED,
  ATTACK_NAMES,
  BOSS_BUILDING_DAMAGE,
  BOSS_HP_MULT,
  BUILDING_BASE_HP,
  DAMAGE_MATRIX,
  DIFFICULTIES,
  HP_PLAYTEST_MULT,
  LEAK_BUILDING_DAMAGE,
  LEVEL_MULT,
  MAX_LEVEL,
  TOTAL_WAVES,
  WAVES,
  goldForKill,
  hpForWave,
  levelDamageMult,
  levelIntervalMult,
  levelRangeMult,
  waveBonus,
  waveSpeedMult,
} from '../src/game/config'
import { Game, hybridMult } from '../src/game/engine'
import { CLASSIC_MAP } from '../src/game/map'
import { ALL_DEFS } from '../src/game/data/towers'

let fails = 0
let checks = 0
function check(name: string, cond: boolean, extra = '') {
  checks++
  console.log(`${cond ? '✓' : '✗ РЕГРЕССИЯ'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}
function eq(name: string, actual: number, expected: number, eps = 1e-9) {
  check(name, Math.abs(actual - expected) <= eps, `${actual} (ожид. ${expected})`)
}

// ─── HP волны ───────────────────────────────────────────────────────────
// HP(n) = 60 × (1 + 0,15n) × 1,10^n; плейтест-множитель 0,7
eq('HP волны 1 = 75.9', hpForWave(1), 75.9)
eq('HP волны 5 = 169.10355', hpForWave(5), 169.10355)
eq('HP волны 10 = 389.061369015', hpForWave(10), 389.061369015)
eq('HP волны 20 = 1614.599987838147', hpForWave(20), 1614.599987838147)
eq('HP волны 30 = 5758.302748732528', hpForWave(30), 5758.302748732528)
eq('плейтест-множитель 0,7', HP_PLAYTEST_MULT, 0.7)
eq('HP волны 1 с плейтестом = 53.13', hpForWave(1) * HP_PLAYTEST_MULT, 53.13)

// ─── Броня ──────────────────────────────────────────────────────────────
eq('лёгкая броня: HP ×0.7', ARMOR_HP_MULT.light, 0.7)
eq('средняя броня: HP ×1.0', ARMOR_HP_MULT.medium, 1.0)
eq('тяжёлая броня: HP ×1.4', ARMOR_HP_MULT.heavy, 1.4)
eq('универсальная броня: HP ×1.1', ARMOR_HP_MULT.universal, 1.1)
eq('лёгкая броня: скорость 40', ARMOR_SPEED.light, 40)
eq('тяжёлая броня: скорость 28', ARMOR_SPEED.heavy, 28)

// ─── Матрица урона ──────────────────────────────────────────────────────
const MATRIX: Record<string, Record<string, number>> = {
  pierce: { light: 1.5, medium: 1.0, heavy: 0.7, universal: 0.9 },
  crush: { light: 0.7, medium: 1.5, heavy: 1.0, universal: 0.9 },
  magic: { light: 1.0, medium: 0.7, heavy: 1.5, universal: 0.9 },
  universal: { light: 0.8, medium: 0.8, heavy: 0.8, universal: 1.2 },
}
for (const attack of Object.keys(MATRIX)) {
  for (const armor of Object.keys(MATRIX[attack])) {
    eq(
      `урон ${ATTACK_NAMES[attack as keyof typeof ATTACK_NAMES]} по ${armor}`,
      DAMAGE_MATRIX[attack as keyof typeof DAMAGE_MATRIX][armor as keyof typeof ARMOR_HP_MULT],
      MATRIX[attack][armor]
    )
  }
}
const hybridHeavy = hybridMult(['pierce', 'magic'], 'heavy')
check('гибрид pierce+magic по тяжёлой выбирает magic ×1.5', hybridHeavy.mult === 1.5 && hybridHeavy.attack === 'magic')
const hybridLight = hybridMult(['pierce', 'magic'], 'light')
check('гибрид pierce+magic по лёгкой выбирает pierce ×1.5', hybridLight.mult === 1.5 && hybridLight.attack === 'pierce')

// ─── Золото ─────────────────────────────────────────────────────────────
const goldExpect: Array<[number, number]> = [[1, 2], [2, 2], [3, 3], [9, 5], [10, 5], [19, 8], [20, 8], [29, 11], [30, 12]]
for (const [wave, expected] of goldExpect) eq(`золото за убийство волны ${wave}`, goldForKill(wave), expected)
const bonusExpect: Array<[number, number]> = [[1, 31], [9, 79], [10, 85], [19, 139], [20, 145], [29, 199], [30, 205]]
for (const [wave, expected] of bonusExpect) eq(`бонус волны ${wave}`, waveBonus(wave), expected)
eq('бонус денежной 9-й ×2', waveBonus(9) * 2, 158)
eq('бонус денежной 29-й ×2', waveBonus(29) * 2, 398)

// ─── Главное здание и сложности ─────────────────────────────────────────
eq('база здания 200 HP', BUILDING_BASE_HP, 200)
eq('утечка обычного крипа — 10 HP', LEAK_BUILDING_DAMAGE, 10)
eq('прорыв босса — 100 HP', BOSS_BUILDING_DAMAGE, 100)
eq('Новобранец: здание ×1.4', DIFFICULTIES.recruit.buildingHpMult, 1.4)
eq('Ветеран: здание ×1.0', DIFFICULTIES.veteran.buildingHpMult, 1.0)
eq('Кошмар: здание ×0.75', DIFFICULTIES.nightmare.buildingHpMult, 0.75)
check('Новобранец: HP врагов ×0.75 и 200 золота', DIFFICULTIES.recruit.creepHpMult === 0.75 && DIFFICULTIES.recruit.startGold === 200)
check('Ветеран: базовые HP и 150 золота', DIFFICULTIES.veteran.creepHpMult === 1 && DIFFICULTIES.veteran.startGold === 150)
check('Кошмар: HP ×1.4, 120 золота, смешение с 11-й', DIFFICULTIES.nightmare.creepHpMult === 1.4 && DIFFICULTIES.nightmare.startGold === 120 && DIFFICULTIES.nightmare.mixedWavesFrom === 11)

// ─── Уровни башен ───────────────────────────────────────────────────────
const levels = [1, 1.9, 3.2, 5.0, 7.5]
for (let i = 0; i < levels.length; i++) eq(`урон уровня ${i + 1}`, levelDamageMult(i + 1), levels[i])
eq('LEVEL_MULT совпадает с levelDamageMult', LEVEL_MULT[4], levelDamageMult(5))
eq('MAX_LEVEL = 5', MAX_LEVEL, 5)
eq('радиус: ур.1 ×1.0', levelRangeMult(1), 1)
eq('радиус: ур.2 ×1.05', levelRangeMult(2), 1.05)
eq('радиус: ур.4 ×1.1', levelRangeMult(4), 1.1)
eq('интервал: ур.3 ×0.9', levelIntervalMult(3), 0.9)
eq('интервал: ур.1 ×1.0', levelIntervalMult(1), 1)
// цена покупки копии слитой = сумма цен родителей (новая модель прокачки копиями)
check(
  'цена карточки слитой = сумма родителей',
  ALL_DEFS.flame_archer.price === ALL_DEFS.archer.price + ALL_DEFS.pyro.price,
  `${ALL_DEFS.archer.price}+${ALL_DEFS.pyro.price}=${ALL_DEFS.flame_archer.price}`
)

// ─── Скорость крипов ────────────────────────────────────────────────────
eq('скорость волны 1 = 1.0', waveSpeedMult(1), 1)
eq('скорость волны 2 = 1.01', waveSpeedMult(2), 1.01)
eq('скорость волны 10 = 1.09', waveSpeedMult(10), 1.09)
eq('скорость волны 20 = 1.19', waveSpeedMult(20), 1.19)
eq('потолок скорости +25%', waveSpeedMult(100), 1.25)

// ─── Босс: HP считается по формуле волны ────────────────────────────────
const g = new Game(12345)
g.useMap(CLASSIC_MAP)
g.wave = 10
g.beginPreview()
g.startWave()
for (let i = 0; i < 10; i++) g.update(0.05)
const boss = g.creeps.find((c) => c.isBoss)
check('босс 10-й волны заспавнился', !!boss, boss ? `HP ${boss.maxHp.toFixed(1)}` : 'нет')
if (boss) {
  eq('HP босса = hpForWave(10) × BOSS_HP_MULT × плейтест', boss.maxHp, hpForWave(10) * BOSS_HP_MULT * HP_PLAYTEST_MULT)
  eq('броня босса 10-й — тяжёлая', boss.armor === 'heavy' ? 1 : 0, 1)
}

// ─── Структура волн ─────────────────────────────────────────────────────
check('TOTAL_WAVES совпадает с длиной WAVES', TOTAL_WAVES === WAVES.length, `${TOTAL_WAVES} / ${WAVES.length}`)
check('номера волн идут подряд с 1', WAVES.every((w, i) => w.n === i + 1))
check('WAVES 1..8 — обычные, 9 — денежная, 10 — босс', WAVES.slice(0, 8).every((w) => w.kind === 'normal') && WAVES[8].kind === 'money' && WAVES[9].kind === 'boss')
check('19 — денежная, 20 — босс', WAVES[18].kind === 'money' && WAVES[19].kind === 'boss')
check('21–28 — смешанные обычные волны', WAVES.slice(20, 28).every((w) => w.kind === 'normal' && w.armors.length === 2))
check(
  'последняя волна 30 — босс, 29 — денежная',
  WAVES[WAVES.length - 1].kind === 'boss' && WAVES[WAVES.length - 2].kind === 'money'
)

console.log(`\n${fails === 0 ? `✓ Все ${checks} проверок формул пройдены` : `✗ Провалено ${fails} из ${checks}`}`)
process.exitCode = fails === 0 ? 0 : 1
