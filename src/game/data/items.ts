// Лавка предметов (GDD «Предметы (экипировка аватара)», Таблица 9).
// Предметы покупаются за эссенцию внутри матча. 6 слотов: оружие, доспех, амулет,
// 2 кольца, реликвия. Бонус действует на аватара и на все башни игрока, если в
// описании не сказано иное. Продажа — за 50% цены. В лавке 4 случайных предмета,
// обновление витрины — 5 эссенции. Редкие версии (+50% к эффекту) — после 10-й волны.
// Всё заработанное сгорает в конце матча — вне матча покупок нет.

import type { AttackType } from '../types'

export type ItemSlot = 'weapon' | 'armor' | 'amulet' | 'ring' | 'relic'

export const ITEM_SLOTS: Record<ItemSlot, { name: string; max: number }> = {
  weapon: { name: 'Оружие', max: 1 },
  armor: { name: 'Доспех', max: 1 },
  amulet: { name: 'Амулет', max: 1 },
  ring: { name: 'Кольцо', max: 2 },
  relic: { name: 'Реликвия', max: 1 },
}

export const ITEM_REROLL_COST = 5 // эссенция (GDD)
export const ITEM_SHOP_SIZE = 4 // предложений в лавке (GDD)
export const ITEM_SLOTS_TOTAL = 6
export const ITEM_RARE_WAVE = 11 // редкие версии — с этой волны («после 10-й»)
export const ITEM_RARE_CHANCE = 0.25 // доля редких в витрине после открытия (черновик)

/** Предложение в лавке / экипированный предмет: id + редкость */
export interface ItemOffer {
  id: string
  rare: boolean
}

export type ItemEffect =
  | { kind: 'attackDamage'; attack: AttackType; mult: number } // +mult к урону башен этого типа
  | { kind: 'allDamage'; mult: number } // +mult ко всем башням и аватару
  | { kind: 'universalArmorUp'; to: number } // универсальная атака 80% → to против л/с/т
  | { kind: 'weakArmorUp'; to: number } // слабые ячейки 70% → to
  | { kind: 'attackSpeed'; mult: number } // +mult к скорости атаки (башни и аватар)
  | { kind: 'range'; mult: number } // +mult к дальности (башни и аватар)
  | { kind: 'crit'; chance: number; mult: number } // шанс крита (башни и аватар)
  | { kind: 'bossDamage'; mult: number } // +mult урона по боссам
  | { kind: 'abilityCd'; mult: number } // перезарядка способности аватара ×mult
  | { kind: 'essenceBonus'; mult: number } // +mult эссенции со всех шахт
  | { kind: 'essencePerAura'; amount: number } // +amount эссенции за каждую ауру рядом с шахтой
  | { kind: 'shareAura'; radius: number } // кооп: бонусы предметов — и союзникам в радиусе от аватара

export interface ItemDef {
  id: string
  name: string
  slot: ItemSlot
  price: number // эссенция; редкая версия стоит столько же (GDD молчит о наценке)
  desc: string
  effect: ItemEffect
}

export const ITEMS: ItemDef[] = [
  { id: 'piercer_tip', name: 'Наконечник бронебоя', slot: 'weapon', price: 30, desc: '+15% урона пронзающим башням', effect: { kind: 'attackDamage', attack: 'pierce', mult: 0.15 } },
  { id: 'anvil', name: 'Тяжёлая наковальня', slot: 'weapon', price: 30, desc: '+15% урона сокрушающим башням', effect: { kind: 'attackDamage', attack: 'crush', mult: 0.15 } },
  { id: 'elemental_sphere', name: 'Сфера стихий', slot: 'weapon', price: 30, desc: '+15% урона магическим башням', effect: { kind: 'attackDamage', attack: 'magic', mult: 0.15 } },
  { id: 'commander_blade', name: 'Клинок командира', slot: 'weapon', price: 60, desc: '+10% урона всех башен и аватара', effect: { kind: 'allDamage', mult: 0.1 } },
  { id: 'balance_plate', name: 'Доспех равновесия', slot: 'armor', price: 60, desc: 'Универсальная атака 80% → 90% против лёгкой, средней и тяжёлой брони', effect: { kind: 'universalArmorUp', to: 0.9 } },
  { id: 'broken_shield', name: 'Расколотый щит', slot: 'armor', price: 80, desc: 'Слабая атака 70% → 85% (стрелы по тяжёлым, камни по лёгким, магия по средним)', effect: { kind: 'weakArmorUp', to: 0.85 } },
  { id: 'rage_amulet', name: 'Амулет ярости', slot: 'amulet', price: 50, desc: '+12% скорости атаки башен и аватара', effect: { kind: 'attackSpeed', mult: 0.12 } },
  { id: 'sniper_eye', name: 'Око снайпера', slot: 'amulet', price: 50, desc: '+15% дальности башен и аватара', effect: { kind: 'range', mult: 0.15 } },
  { id: 'hunter_ring', name: 'Кольцо охотника', slot: 'ring', price: 70, desc: '10% шанс крита ×2 (башни и аватар)', effect: { kind: 'crit', chance: 0.1, mult: 2 } },
  { id: 'executioner_ring', name: 'Кольцо палача', slot: 'ring', price: 90, desc: '+25% урона по боссам', effect: { kind: 'bossDamage', mult: 0.25 } },
  { id: 'leader_ring', name: 'Кольцо вожака', slot: 'ring', price: 60, desc: 'Способность аватара перезаряжается на 25% быстрее', effect: { kind: 'abilityCd', mult: 0.75 } },
  { id: 'gnome_pickaxe', name: 'Гномья кирка', slot: 'relic', price: 40, desc: '+20% эссенции со всех шахт', effect: { kind: 'essenceBonus', mult: 0.2 } },
  { id: 'mine_heart', name: 'Сердце рудника', slot: 'relic', price: 70, desc: '+1 эссенция за каждую ауру рядом с шахтой', effect: { kind: 'essencePerAura', amount: 1 } },
  { id: 'march_banner', name: 'Знамя похода', slot: 'relic', price: 100, desc: 'Бонусы предметов действуют и на башни союзников в радиусе 3 клеток от аватара (кооп)', effect: { kind: 'shareAura', radius: 120 } },
]

export const ALL_ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))

/** Множитель эффекта редкой версии (+50%) */
export const rareK = (rare: boolean) => (rare ? 1.5 : 1)
