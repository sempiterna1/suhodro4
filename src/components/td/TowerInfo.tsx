'use client'

// Карточка башни для всплывающих подсказок и шторок: имя, тип урона (значок + слово), описание, «эффективен против»,
// статы и особые эффекты. Все числа берутся из config.ts — ничего не придумано здесь.

import { motion } from 'framer-motion'
import { Asterisk, Coins, Crosshair, Hammer, Sparkles } from 'lucide-react'
import { ALL_DEFS, ARMOR_COLORS, ARMOR_NAMES, DAMAGE_MATRIX, LEVEL_MULT } from '@/game/config'
import type { ArmorType, AttackType, TowerDefinition } from '@/game/types'

export const ATTACK_COLORS: Record<AttackType, string> = {
  pierce: '#8fae6b',
  crush: '#c2874f',
  magic: '#d4694f',
  universal: '#a0aec0',
}

export const ARMOR_ICONS: Record<ArmorType, string> = {
  light: '🪶',
  medium: '⚙',
  heavy: '🛡',
  universal: '✷',
}

/** Тип урона: слово и значок (вместо безымянных цветных кружков) */
export const DAMAGE_TYPE: Record<AttackType, { name: string; hint: string; Icon: typeof Crosshair }> = {
  pierce: { name: 'Колющий', hint: 'стрелы и болты — лучше всего бьют по лёгкой броне', Icon: Crosshair },
  crush: { name: 'Дробящий', hint: 'камни и удары — лучше всего против средней брони', Icon: Hammer },
  magic: { name: 'Магический', hint: 'огонь, лёд и молнии — лучше всего против тяжёлой брони', Icon: Sparkles },
  universal: { name: 'Универсальный', hint: 'ровный урон по всем, чуть слабее специализированного', Icon: Asterisk },
}

/** Значок типа урона: иконка + (по желанию) слово; цвет — тип урона */
export function DamageBadge({ type, label = true, className = '' }: { type: AttackType; label?: boolean; className?: string }) {
  const { name, hint, Icon } = DAMAGE_TYPE[type]
  const c = ATTACK_COLORS[type]
  return (
    <span
      title={`${name} урон — ${hint}`}
      className={`inline-flex items-center gap-1 rounded-sm border px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide ${className}`}
      style={{ color: c, borderColor: c + '88', background: c + '1f' }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label && name}
    </span>
  )
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const num = (v: number) => String(Math.round(v * 10) / 10)

/** Особые эффекты башни — по полям AttackFx */
export function effectLines(def: TowerDefinition): string[] {
  const l: string[] = []
  if (def.splash) l.push(`Урон по площади, радиус ${def.splash}`)
  if (def.slam) l.push('Удар по всем врагам в радиусе')
  if (def.line) l.push('Болт насквозь — бьёт всех на линии')
  if (def.targets) l.push(`${def.targets} цели за выстрел`)
  if (def.chain) l.push(`Цепная молния: ещё ${def.chain} цели`)
  if (def.burn) l.push(`Поджог: ${def.burn.dps} урона/с, ${def.burn.dur} с`)
  if (def.slow) l.push(`Замедление ${pct(def.slow.pct)} на ${def.slow.dur} с`)
  if (def.freeze) l.push(`Заморозка на ${def.freeze} с`)
  if (def.stunChance) l.push(`Оглушение на 1 с, шанс ${pct(def.stunChance)}`)
  if (def.stunSlow) l.push(`Оглушённые замедлены на ${pct(def.stunSlow.pct)} (${def.stunSlow.dur} с)`)
  if (def.vuln) l.push(`Цель получает +${pct(def.vuln.bonus)} урона от всех башен, ${def.vuln.dur} с`)
  if (def.heavyBonus) l.push(`×${def.heavyBonus} урона по тяжёлой броне`)
  if (def.critEvery) l.push(`Каждый ${def.critEvery}-й выстрел — крит ×3`)
  if (def.aura) l.push(`+${pct(def.aura)} урона башням рядом`)
  if (def.ramp) l.push(`+${pct(def.ramp)} скорости атаки за выстрел`)
  if (def.focus) l.push(`+${pct(def.focus.perHit)} урона за каждый выстрел по той же цели, до ×${def.focus.max}`)
  if (def.waveGrowth) l.push(`+${pct(def.waveGrowth)} урона с каждой волной`)
  return l
}

/** Лучший множитель урона по броне среди типов атаки башни */
export function armorMult(def: TowerDefinition): Record<ArmorType, number> {
  const attacks: AttackType[] = def.merged ? def.attacks : [def.attack]
  const out = {} as Record<ArmorType, number>
  for (const a of ['light', 'medium', 'heavy', 'universal'] as ArmorType[]) out[a] = Math.max(...attacks.map((t) => DAMAGE_MATRIX[t][a]))
  return out
}

/** Строка «Эффективен против»: броня с множителем, сильные выделены */
export function EffectiveVs({ def }: { def: TowerDefinition }) {
  const m = armorMult(def)
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-full text-[9px] font-semibold uppercase tracking-wide text-[#5b6f8c]">Эффективен против (урон по броне)</span>
      {(['light', 'medium', 'heavy', 'universal'] as ArmorType[]).map((a) => {
        const v = m[a]
        const strong = v > 1.05, weak = v < 0.95
        return (
          <span
            key={a}
            title={`${ARMOR_NAMES[a]} броня: урон ×${v}`}
            className="inline-flex items-center gap-0.5 rounded-sm border px-1 py-px font-mono text-[9px] leading-none"
            style={{
              color: strong ? '#7fd0a0' : weak ? '#8a6a66' : '#9fb1c8',
              borderColor: strong ? '#7fd0a077' : '#2e3c52',
              background: strong ? '#7fd0a01a' : 'transparent',
              opacity: weak ? 0.8 : 1,
            }}
          >
            <span style={{ color: ARMOR_COLORS[a] }}>{ARMOR_ICONS[a]}</span>
            {ARMOR_NAMES[a].toLowerCase()} ×{v}
          </span>
        )
      })}
    </div>
  )
}

function Stat({ label, value, color = '#dde6f0' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-[#2e3c52] bg-[#0a0f17]/70 px-1.5 py-1 text-center">
      <div className="text-[8px] font-semibold uppercase tracking-wide text-[#5b6f8c]">{label}</div>
      <div className="font-mono text-xs font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

/**
 * Всплывающая карточка башни. level — для башни на поле (статы с учётом уровня), иначе уровень 1.
 * Ширина фиксирована, чтобы позиционирование у краёв экрана было предсказуемым.
 */
export const TOWER_CARD_W = 268

export function TowerInfoCard({
  def, level = 1, affordable = true, thumb, className = '',
}: { def: TowerDefinition; level?: number; affordable?: boolean; thumb?: string; className?: string }) {
  const dmg = Math.round(def.damage * LEVEL_MULT[level - 1] * 10) / 10
  const interval = def.interval * (level >= 3 ? 0.9 : 1)
  const range = Math.round(def.range * (level >= 4 ? 1.1 : level >= 2 ? 1.05 : 1))
  const attacks: AttackType[] = def.merged ? def.attacks : [def.attack]
  const effects = effectLines(def)
  const desc = def.merged ? def.desc : def.role
  const parents = def.merged ? def.parents.map((p) => ALL_DEFS[p]?.name ?? p) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.14 }}
      style={{ width: TOWER_CARD_W }}
      className={`pointer-events-none relative overflow-hidden rounded-md border-2 border-[#7088a8] bg-gradient-to-b from-[#1b2433] to-[#0c111a] shadow-[inset_0_0_0_2px_#2a3548,0_10px_28px_rgba(0,0,0,0.75)] ${className}`}
    >
      {/* цветная кромка башни — по ней карточка сразу связывается с вымпелом на поле */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${def.color}, ${def.color}33)` }} />
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex items-start gap-2">
          <div className="flex h-12 w-12 shrink-0 items-end justify-center rounded border-2 border-[#2e3c52] bg-[radial-gradient(circle_at_50%_70%,#1f2a3b,#0a0f17)]">
            {thumb ? <img src={thumb} alt="" className="h-11 w-auto max-w-[44px] object-contain" style={{ imageRendering: 'pixelated' }} /> : <span className="self-center text-2xl">{def.glyph}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <p className="font-serif text-[15px] font-black leading-tight text-[#ffc46b]">{def.name}</p>
              <span className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-xs font-bold ${affordable ? 'text-[#f0b060]' : 'text-[#e05252]'}`}>
                <Coins className="h-3 w-3" />
                {def.price}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {attacks.map((a, i) => <DamageBadge key={a + i} type={a} />)}
              {def.merged && <span className="rounded-sm border border-[#ffd70066] bg-[#ffd7001a] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#ffd700]">слитая</span>}
              {level > 1 && <span className="font-mono text-[10px] text-[#7088a8]">ур. {level}/5</span>}
            </div>
          </div>
        </div>

        <p className="text-[11.5px] leading-snug text-[#b9c6d8]">{desc.charAt(0).toUpperCase() + desc.slice(1)}</p>
        {parents && <p className="text-[10px] text-[#7088a8]">Рецепт: <span className="text-[#c9d6e8]">{parents.join(' + ')}</span></p>}

        <EffectiveVs def={def} />

        <div className="grid grid-cols-4 gap-1">
          <Stat label="Урон" value={num(dmg)} color="#f0b060" />
          <Stat label="Скорость" value={`${num(1 / interval)}/с`} color="#9fd2ff" />
          <Stat label="Дальность" value={String(range)} color="#ccd8e6" />
          <Stat label="В секунду" value={num(dmg / interval)} color="#7fd0a0" />
        </div>

        {effects.length > 0 && (
          <ul className="flex flex-col gap-0.5 rounded border border-[#2e3c52] bg-[#0a0f17]/60 px-2 py-1">
            {effects.map((e) => (
              <li key={e} className="flex gap-1 text-[10.5px] leading-snug text-[#c9d6e8]">
                <span className="text-[#f0b060]">◆</span>
                {e}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10.5px] leading-snug text-[#ffd700]">
          <span className="font-bold">★ 5 ур.:</span> <span className="text-[#e8d9a0]">{def.l5}</span>
        </p>
      </div>
    </motion.div>
  )
}
