// Боевые параметры ядра: матрица урона, множители HP/скорости по броне, имена атак и типов брони.
// Числа — стартовые значения из GDD и прототипа; баланс — здесь, код читает данные.

import type { AttackType, ArmorType } from '../types'

// ─── Матрица урона (GDD: «Матрица урона») ───────────────────────────────
// Специализированная атака бьёт «свою» броню на 150%,
// универсальная — любую на 80%, кроме универсальной брони.
export const DAMAGE_MATRIX: Record<AttackType, Record<ArmorType, number>> = {
  pierce: { light: 1.5, medium: 1.0, heavy: 0.7, universal: 0.9 },
  crush: { light: 0.7, medium: 1.5, heavy: 1.0, universal: 0.9 },
  magic: { light: 1.0, medium: 0.7, heavy: 1.5, universal: 0.9 },
  universal: { light: 0.8, medium: 0.8, heavy: 0.8, universal: 1.2 },
}

// Множители HP по типу брони (GDD: «Враги и броня»)
export const ARMOR_HP_MULT: Record<ArmorType, number> = {
  light: 0.7,
  medium: 1.0,
  heavy: 1.4,
  universal: 1.1,
}

export const ARMOR_SPEED: Record<ArmorType, number> = {
  light: 40,
  medium: 34,
  heavy: 28,
  universal: 34,
}

export const ATTACK_NAMES: Record<AttackType, string> = {
  pierce: 'Пронзающая',
  crush: 'Сокрушающая',
  magic: 'Магическая',
  universal: 'Универсальная',
}

export const ARMOR_NAMES: Record<ArmorType, string> = {
  light: 'Лёгкая',
  medium: 'Средняя',
  heavy: 'Тяжёлая',
  universal: 'Универсальная',
}

export const ARMOR_COLORS: Record<ArmorType, string> = {
  light: '#d4b483',
  medium: '#9aa0a6',
  heavy: '#6b6f76',
  universal: '#7aa874',
}
