'use client'

// HUD «Последнего горизонта»: один набор компонентов для телефона (ландшафт) и компьютера.
// Верх: ресурсы · волна (или что строим) · скорость, пауза, меню. Низ: герой и способность · арсенал
// (прокручиваемый ряд карточек + закреплённый ролл) · «Начать». Раскладку задаёт GameShell.
// Стиль: Rubik, тёмное стекло (blur + полупрозрачность) с рамкой #3a4660, золото #f2c94c, линейные иконки.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { AI_SIGNALS, ALL_DEFS, ALL_ITEMS, ARMOR_COLORS, ARMOR_NAMES, AVATARS, ITEM_REROLL_COST, ITEM_SLOTS, ITEM_SLOTS_TOTAL, RARITY_BY_ID, TOWERS, defFootprint, econIncomeAt, econIncomeAt5, econIncomeBase } from '@/game/config'
import { avatarPortrait, towerThumb } from '@/game/pixel'
import type { AttackType, TowerDefinition, UiState } from '@/game/types'
import type { MpRole, MpStatus } from './Panels'
import { DAMAGE_TYPE, DamageBadge, effectLines, isEcon } from './TowerInfo'
import { Store, Music, Volume2, Wind, Gem, RefreshCw, ChevronUp } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import {
  BoltIcon, BuildingIcon, CheckIcon, CloseIcon, CoinIcon, DiceIcon, ExitFullscreenIcon, FullscreenIcon, HelpIcon, InfinityIcon,
  MaskIcon, MenuIcon, PauseIcon, PlayIcon, RestartIcon, SoundIcon, SoundOffIcon, SunIcon, SwordsIcon, UsersIcon,
} from './icons'

// ─── Токены ──────────────────────────────────────────────────────────────
export const UI = {
  panel: 'rgba(14,19,31,0.9)',
  line: '#3a4660',
  gold: '#f2c94c',
  heart: '#ff7a7a',
  text: '#e8ecf4',
  text2: '#c3cbe0',
  green: '#59c27a',
  card: '#1f2638',
  cardOn: '#2b3550',
} as const

/** Цвета типов урона: дробящий, магический, колющий (универсальный — нейтральный) */
export const DMG_COLORS: Record<AttackType, string> = {
  crush: '#e8893a',
  magic: '#ef6b80',
  pierce: '#59c27a',
  universal: '#a0aec0',
}

const PILL = 'pointer-events-auto border border-[#3a4660]/90 bg-[rgba(10,15,24,0.78)] backdrop-blur-md'
const slideDown = { initial: { y: -16, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -16, opacity: 0 } }
const num = (v: number) => String(Math.round(v * 10) / 10)

/** Ярлык: высота 20, 10 px, верхний регистр, рамка цветом ярлыка */
export function Tag({ color, children, title }: { color: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-bold uppercase leading-none tracking-[0.04em]"
      style={{ color, borderColor: color, background: 'rgba(255,255,255,0.06)' }}
    >
      {children}
    </span>
  )
}

/** Круглая кнопка 48 px: скорость, пауза, меню, отмена */
export function RoundButton({
  onClick, label, active = false, disabled = false, children, className = '',
}: { onClick: () => void; label: string; active?: boolean; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`${PILL} flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0 text-[15px] font-bold leading-none text-[#e8ecf4] transition-transform hover:-translate-y-px active:scale-95 disabled:opacity-40 ${
        active ? '!border-[#f2c94c] !text-[#f2c94c]' : ''
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Круглая иконка-чип: тонированный фон под цвет ресурса (золото, эссенция, жизни…) */
function Chip({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${tone}1f`, border: `1px solid ${tone}44`, color: tone }}
    >
      {children}
    </span>
  )
}

// ─── Верх-лево: жизни · золото · волна ────────────────────────────────────
export function ResourceBar({ ui }: { ui: UiState }) {
  const building = useAnimationControls()
  const gold = useAnimationControls()
  const prevBuilding = useRef(ui.buildingHp)
  const prevGold = useRef(ui.gold)
  useEffect(() => {
    if (ui.buildingHp < prevBuilding.current) building.start({ x: [0, -5, 5, -3, 3, 0], transition: { duration: 0.4 } })
    prevBuilding.current = ui.buildingHp
  }, [ui.buildingHp, building])
  useEffect(() => {
    if (ui.gold !== prevGold.current && !ui.infiniteGold) gold.start({ scale: [1, 1.2, 1], transition: { duration: 0.25 } })
    prevGold.current = ui.gold
  }, [ui.gold, ui.infiniteGold, gold])
  const hpPct = ui.buildingMaxHp > 0 ? Math.max(0, Math.min(1, ui.buildingHp / ui.buildingMaxHp)) : 0
  const hpColor = hpPct <= 0.3 ? '#ff3b3b' : hpPct <= 0.6 ? '#f0a44a' : '#e05252'

  return (
    <motion.div {...slideDown} className={`${PILL} flex h-12 items-center gap-2 rounded-full pl-2.5 pr-4 text-[15px] font-bold leading-none`}>
      <motion.span
        animate={building}
        className="flex items-center gap-2 text-[#ff9a7a]"
        title={`Главное здание: ${ui.buildingHp} / ${ui.buildingMaxHp} HP`}
      >
        <Chip tone="#e05252"><BuildingIcon size={15} /></Chip>
        <span className="h-2 w-12 overflow-hidden rounded-full bg-[#4a1f24]">
          <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${hpPct * 100}%`, background: hpColor }} />
        </span>
        <span className="font-mono text-[13px] tabular-nums text-[#ffb0a0]">
          {ui.buildingHp}
          <span className="text-[10px] opacity-60">/{ui.buildingMaxHp}</span>
        </span>
      </motion.span>
      <span className="h-5 w-px bg-[#3a4660]/70" />
      <motion.span animate={gold} className="flex items-center gap-2 text-[#f2c94c]" title="Золото">
        <Chip tone="#f2c94c"><CoinIcon size={15} /></Chip>
        <span className="font-mono tabular-nums">{ui.infiniteGold ? '∞' : ui.gold}</span>
      </motion.span>
      <span className="h-5 w-px bg-[#3a4660]/70" />
      <span className="flex items-center gap-2 text-[#a6f095]" title="Эссенция: добывается шахтами, тратится в лавке предметов">
        <Chip tone="#a6f095"><Gem size={15} strokeWidth={2.4} /></Chip>
        <span className="font-mono text-[14px] tabular-nums">{ui.essence}</span>
      </span>
      <span className="h-5 w-px bg-[#3a4660]/70" />
      <span className="flex items-center gap-2 text-[#c3cbe0]" title="Волна">
        <Chip tone="#8fa2bd"><SwordsIcon size={15} /></Chip>
        <span className="font-mono tabular-nums">{Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}</span>
      </span>
      {ui.coop && <Tag color="#ff9a7a" title="Кооп: HP волн ×1.85">кооп ×1.85</Tag>}
    </motion.div>
  )
}

// ─── Верх-центр: «Волна N + ярлык» или «Башня + ВЫБЕРИТЕ КЛЕТКУ» ──────────
export function WaveChip({ ui, build }: { ui: UiState; build: { name: string; color: string } | null }) {
  let title: string
  let tag: React.ReactNode
  if (build) {
    title = build.name
    tag = <Tag color={build.color}>выберите клетку</Tag>
  } else {
    title = `Волна ${ui.wave}`
    if (ui.phase === 'wave') tag = <Tag color={UI.gold}>на поле {ui.creepsAlive}</Tag>
    else if (ui.nextWaveIsBoss) tag = <Tag color="#ff7a7a">босс{ui.nextWaveBossName ? ` · ${ui.nextWaveBossName}` : ''}</Tag>
    else if (ui.nextWaveArmors.length > 1)
      tag = (
        <>
          {ui.nextWaveArmors.map((a) => (
            <Tag key={a} color={ARMOR_COLORS[a]} title="Броня следующей волны">
              {ARMOR_NAMES[a]}
            </Tag>
          ))}
        </>
      )
    else tag = <Tag color={ARMOR_COLORS[ui.nextWaveArmor]} title="Броня следующей волны">{ARMOR_NAMES[ui.nextWaveArmor]}</Tag>
  }
  return (
    <motion.div {...slideDown} className={`${PILL} flex h-12 items-center gap-2.5 whitespace-nowrap rounded-full pl-4 pr-3 text-[15px] font-bold leading-none text-[#f4ead2]`}>
      <span>{title}</span>
      {tag}
    </motion.div>
  )
}

/** Прогноз брони на волну вперёд (Новобранец): вторая строка под плашкой волны */
export function ArmorForecastChip({ ui }: { ui: UiState }) {
  const next = ui.armorForecast[1]
  if (!next) return null
  return (
    <motion.div
      {...slideDown}
      className="pointer-events-none flex items-center gap-1 rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.72)] px-2.5 py-0.5 text-[10px] leading-none text-[#8fa2bd]"
    >
      <span className="uppercase tracking-[0.08em]">через волну {next.wave}:</span>
      {next.kind === 'boss' ? (
        <b className="text-[#ff9a7a]">босс</b>
      ) : (
        next.armors.map((a) => (
          <span key={a} className="font-bold" style={{ color: ARMOR_COLORS[a] }}>
            {ARMOR_NAMES[a]}
          </span>
        ))
      )}
    </motion.div>
  )
}

// ─── Меню: всё редкое ────────────────────────────────────────────────────
export interface MenuActions {
  skin: 'steam' | 'lol'
  fullscreen: boolean
  muted: boolean
  lighting: boolean
  role: MpRole
  mpStatus: MpStatus
  /** громкости 0..1 — для слайдеров в меню */
  musicVolume: number
  sfxVolume: number
  ambientVolume: number
  onLighting: () => void
  onMute: () => void
  onMusicVolume: (v: number) => void
  onSfxVolume: (v: number) => void
  onAmbientVolume: (v: number) => void
  onInfiniteGold: () => void
  onSkin: () => void
  onHelp: () => void
  onRestart: () => void
  onFullscreen: () => void
  onInvite?: () => void
}

export function MenuPanel({ ui, m, onClose }: { ui: UiState; m: MenuActions; onClose: () => void }) {
  const row = (icon: React.ReactNode, label: string, on: (() => void) | null, active = false, closes = false) => (
    <button
      key={label}
      type="button"
      disabled={!on}
      onClick={() => {
        on?.()
        if (closes) onClose() // переключатели оставляют меню открытым; окна и рестарт закрывают
      }}
      className={`flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-[13px] font-bold transition-colors active:scale-[0.98] disabled:cursor-default ${
        active
          ? 'border-[#f2c94c] bg-[#2b3550] text-[#f2c94c]'
          : 'border-[#3a4660] bg-[#1f2638]/90 text-[#e8ecf4] hover:border-[#4a5876] hover:bg-[#26304a] disabled:hover:border-[#3a4660] disabled:hover:bg-[#1f2638]/90'
      }`}
    >
      <span className="flex w-5 shrink-0 justify-center">{icon}</span>
      {label}
    </button>
  )
  return (
    <motion.div
      {...slideDown}
      className={`${PILL} grid max-h-[calc(100dvh-72px)] w-[min(400px,calc(100vw-24px))] grid-cols-2 gap-1.5 overflow-y-auto rounded-2xl p-2`}
      role="menu"
      aria-label="Меню"
    >
      {m.role !== 'single' && row(<UsersIcon />, `Кооп: ${m.mpStatus === 'linked' ? '2/2 на связи' : '1/2'}`, null)}
      {m.role === 'host' && m.onInvite && row(<UsersIcon />, 'Пригласить друга', m.onInvite, false, true)}
      {row(m.muted ? <SoundOffIcon /> : <SoundIcon />, m.muted ? 'Звук: выкл' : 'Звук: вкл', m.onMute, !m.muted)}
      <div className="col-span-2 flex flex-col gap-1.5 rounded-xl border border-[#3a4660] bg-[#1f2638] px-3 py-2">
        <div className="flex items-center justify-between text-[13px] font-bold text-[#e8ecf4]">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex w-5 shrink-0 justify-center text-[#f2c94c]"><Music /></span>
            Музыка
          </span>
          <span className="font-mono text-[11px] text-[#c3cbe0]">{Math.round(m.musicVolume * 100)}%</span>
        </div>
        <Slider
          value={[Math.round(m.musicVolume * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={(v) => m.onMusicVolume((v[0] ?? 0) / 100)}
          aria-label="Громкость музыки"
          className="[&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#f2c94c]"
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 rounded-xl border border-[#3a4660] bg-[#1f2638] px-3 py-2">
        <div className="flex items-center justify-between text-[13px] font-bold text-[#e8ecf4]">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex w-5 shrink-0 justify-center text-[#f2c94c]"><Volume2 /></span>
            Звуки игры
          </span>
          <span className="font-mono text-[11px] text-[#c3cbe0]">{Math.round(m.sfxVolume * 100)}%</span>
        </div>
        <Slider
          value={[Math.round(m.sfxVolume * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={(v) => m.onSfxVolume((v[0] ?? 0) / 100)}
          aria-label="Громкость звуков игры"
          className="[&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#f2c94c]"
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 rounded-xl border border-[#3a4660] bg-[#1f2638] px-3 py-2">
        <div className="flex items-center justify-between text-[13px] font-bold text-[#e8ecf4]">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex w-5 shrink-0 justify-center text-[#f2c94c]"><Wind /></span>
            Атмосфера
          </span>
          <span className="font-mono text-[11px] text-[#c3cbe0]">{Math.round(m.ambientVolume * 100)}%</span>
        </div>
        <Slider
          value={[Math.round(m.ambientVolume * 100)]}
          min={0}
          max={100}
          step={5}
          onValueChange={(v) => m.onAmbientVolume((v[0] ?? 0) / 100)}
          aria-label="Громкость атмосферы (ветер, лагерь)"
          className="[&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#f2c94c]"
        />
      </div>
      {row(<SunIcon />, m.lighting ? 'Свет и тени: вкл' : 'Свет и тени: выкл', m.onLighting, m.lighting)}
      {row(<InfinityIcon />, 'Бесконечное золото', m.onInfiniteGold, ui.infiniteGold)}
      {row(<MaskIcon />, 'Шуточный скин', m.onSkin, m.skin === 'lol')}
      {row(<HelpIcon />, 'Как играть', m.onHelp, false, true)}
      {row(m.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />, m.fullscreen ? 'Выйти из полного экрана' : 'На весь экран (F)', m.onFullscreen, m.fullscreen)}
      {row(<RestartIcon />, 'Начать заново', m.onRestart, false, true)}
    </motion.div>
  )
}

// ─── Верхняя полоса: ресурсы · волна · скорость/пауза/меню ────────────────
export function TopBar({
  ui, build, menu, menuOpen, onMenu, onSpeed, onPause, stacked = false,
}: {
  ui: UiState
  build: { name: string; color: string } | null
  menu: MenuActions
  menuOpen: boolean
  onMenu: (open: boolean) => void
  onSpeed: () => void
  onPause: () => void
  /** узкий портрет: плашка волны уходит во вторую строку */
  stacked?: boolean
}) {
  const playing = ui.phase === 'preview' || ui.phase === 'wave'
  const rightRef = useRef<HTMLDivElement>(null)
  // тап мимо меню закрывает его
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: PointerEvent) => {
      if (!rightRef.current?.contains(e.target as Node)) onMenu(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menuOpen, onMenu])
  return (
    <div className={stacked ? 'flex flex-wrap items-start justify-between gap-2' : 'grid grid-cols-[1fr_auto_1fr] items-start gap-2'}>
      <div className="flex justify-start">
        <ResourceBar ui={ui} />
      </div>
      <div className={stacked ? 'order-last flex w-full flex-col items-center gap-1' : 'flex flex-col items-center gap-1'}>
        <WaveChip ui={ui} build={build} />
        <ArmorForecastChip ui={ui} />
      </div>
      <div ref={rightRef} className="relative flex justify-end gap-2">
        <RoundButton onClick={onSpeed} label="Скорость игры" active={ui.speed > 1}>×{ui.speed}</RoundButton>
        <RoundButton onClick={onPause} label={ui.paused ? 'Продолжить (P)' : 'Пауза (P)'} active={ui.paused} disabled={!playing}>
          {ui.paused ? <PlayIcon /> : <PauseIcon />}
        </RoundButton>
        <RoundButton onClick={() => onMenu(!menuOpen)} label="Меню" active={menuOpen}>
          <MenuIcon />
        </RoundButton>
        <AnimatePresence>
          {menuOpen && (
            <div className="pointer-events-auto absolute right-0 top-[56px] z-30">
              <MenuPanel ui={ui} m={menu} onClose={() => onMenu(false)} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Баннер паузы под верхней полосой ─────────────────────────────────────
/** secondExit — предупреждение GDD «Второй выход»: показывается в паузе перед волной открытия */
export function CenterNotices({ paused, secondExit }: { paused: boolean; secondExit?: number | null }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
        {secondExit != null && (
          <motion.span
            key="second-exit"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [1, 0.55, 1], scale: 1 }}
            transition={{ opacity: { repeat: Infinity, duration: 1.6 }, scale: { duration: 0.2 } }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="rounded-full border border-[#59c27a] bg-[rgba(14,19,31,0.92)] px-5 py-1.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[#a6f095]"
          >
            С волны {secondExit}: второй выход — крипы идут по двум тропам!
          </motion.span>
        )}
        {paused && (
          <motion.span
            key="pause"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.9)] px-5 py-1.5 text-[13px] font-bold uppercase tracking-[0.2em] text-[#f2c94c]"
          >
            Пауза
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Низ-лево: герой и способность ────────────────────────────────────────
export function HeroButtons({ ui, role, onAbility }: { ui: UiState; role: MpRole; onAbility: () => void }) {
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  const cd = ui.avatar.cooldown
  const ready = cd <= 0 && role !== 'guest' && canBuild
  const AVATAR = AVATARS[ui.avatar.id]
  const cdFrac = Math.min(1, cd / AVATAR.abilityCd)
  const caption = 'text-[10px] font-bold uppercase leading-[14px] tracking-[0.08em] text-[#aebad0] [text-shadow:0_1px_2px_#000]'
  return (
    <div className="pointer-events-auto flex items-start gap-3">
      {/* герой: портрет в латунной рамке с бейджем уровня */}
      <div className="flex flex-col items-center gap-1" title={`${AVATAR.name}: ${AVATAR.role}. Пассивно: ${AVATAR.passive}`}>
        <div
          className="relative h-[88px] w-[88px] rounded-full"
          role="img"
          aria-label={AVATAR.name}
          style={{
            padding: 3,
            background: 'linear-gradient(160deg, #9fe6b4 0%, #3f8a5c 38%, #182b3a 78%, #0e1520 100%)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.55)',
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-[#0b0e14] bg-[#101828]">
            <img src={avatarPortrait(AVATAR.id, 3)} alt="" className="h-full w-full object-cover object-top" draggable={false} />
          </div>
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-[#0b0e14]/95 px-2 py-px text-[9px] font-black leading-[13px] tracking-wide text-[#e8ecf4]">
            {ui.avatar.level} УР.
          </span>
        </div>
        <span className={caption}>{AVATAR.name}</span>
      </div>
      {/* способность: откат заливкой по кругу + счётчик по центру */}
      <div className="flex flex-col items-center gap-1 pt-2">
        <motion.button
          type="button"
          onClick={onAbility}
          disabled={!ready}
          aria-label={`Способность: ${AVATAR.abilityName}`}
          title={role === 'guest' ? 'Способностью управляет хост' : `${AVATAR.abilityName}: ${AVATAR.abilityDesc}`}
          whileTap={ready ? { scale: 0.92 } : undefined}
          animate={ready ? { boxShadow: ['0 0 0 rgba(89,194,122,0)', '0 0 16px rgba(89,194,122,0.55)', '0 0 0 rgba(89,194,122,0)'] } : { boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}
          transition={ready ? { duration: 1.6, repeat: Infinity } : undefined}
          className="relative flex h-[68px] w-[68px] items-center justify-center rounded-full border border-[#3a4660] p-0 text-[#e8ecf4] disabled:opacity-90"
          style={{
            background:
              cd > 0
                ? `conic-gradient(rgba(5,8,14,0.88) ${cdFrac * 360}deg, rgba(16,23,36,0.95) 0deg)`
                : 'radial-gradient(circle at 50% 30%, rgba(143,224,168,0.12), rgba(10,15,24,0.92) 72%)',
          }}
        >
          <span className={cd > 0 ? 'opacity-25' : ''}><BoltIcon size={30} /></span>
          {cd > 0 && (
            <span className="absolute inset-0 flex items-center justify-center font-mono text-[19px] font-black text-[#f4ead2] [text-shadow:0_1px_3px_#000]">
              {Math.ceil(cd)}
            </span>
          )}
        </motion.button>
        <span className={caption}>{cd > 0 ? `${Math.ceil(cd)} с` : AVATAR.abilityName.split(' ')[0]}</span>
      </div>
    </div>
  )
}

// ─── «Начать · 11с» ───────────────────────────────────────────────────────
export function StartButton({ ui, onStart }: { ui: UiState; onStart: () => void }) {
  if (ui.phase !== 'preview') return null
  const left = Math.ceil(ui.previewRemaining)
  const boss = ui.nextWaveIsBoss
  return (
    <motion.button
      type="button"
      onClick={onStart}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, ...(boss ? { boxShadow: ['0 0 0 rgba(224,82,82,0)', '0 0 14px rgba(224,82,82,0.7)', '0 0 0 rgba(224,82,82,0)'] } : {}) }}
      transition={{ duration: boss ? 1.4 : 0.3, repeat: boss ? Infinity : 0 }}
      aria-label={`Начать волну${boss ? ` с боссом${ui.nextWaveBossName ? ` ${ui.nextWaveBossName}` : ''}` : ``}, авто через ${left} секунд`}
      className="pointer-events-auto flex h-12 items-center gap-2 whitespace-nowrap rounded-full pl-4 pr-5 text-[15px] font-black uppercase tracking-wide text-[#1a1408] active:scale-95"
      style={{
        background: 'linear-gradient(180deg, #ffd76b 0%, #eebd45 55%, #e0a832 100%)',
        boxShadow: boss
          ? '0 4px 18px rgba(242,201,76,0.3), inset 0 1px 0 rgba(255,255,255,0.45)'
          : '0 4px 18px rgba(242,201,76,0.35), inset 0 1px 0 rgba(255,255,255,0.45)',
      }}
    >
      <PlayIcon stroke="#1a1408" />
      <span>Начать · {left}с</span>
      {boss && (
        <span className="max-w-[110px] truncate rounded-full bg-[#2b0d0d] px-2 py-0.5 text-[10px] normal-case tracking-[0.1em] text-[#ff9a7a]">
          {ui.nextWaveBossName ?? 'босс'}
        </span>
      )}
    </motion.button>
  )
}

// ─── Магазин: кнопка в нижней панели + окно по центру экрана ───────────────
/** Кнопка открытия магазина — вместо постоянного ряда арсенала внизу экрана */
export function ShopButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Открыть магазин башен"
      title="Магазин: выбрать башню из арсенала"
      className={`${PILL} flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-4 text-[13px] font-bold uppercase tracking-wide text-[#e8ecf4] transition-all hover:-translate-y-px hover:border-[#f2c94c]/50 hover:bg-[rgba(24,30,44,0.85)] active:scale-95 disabled:opacity-40`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#f2c94c]/30 bg-[#f2c94c]/12 text-[#f2c94c]">
        <Store className="h-5 w-5" strokeWidth={2.2} />
      </span>
      Магазин
    </button>
  )
}

/**
 * Магазин по центру экрана: пул из SHOP_SIZE башен крупными карточками
 * (имя, тип урона, цена, «эффективен против», статы, способность 5 ур.),
 * ролл в подвале. Покупка — клик по карточке, окно закрывает GameShell.
 */
export function ShopModal({ ui, onPick, onRoll, onClose }: {
  ui: UiState
  onPick: (defId: string) => void
  onRoll: () => void
  onClose: () => void
}) {
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  // в пуле и базовые, и открытые слитые (копия слитой качает её на поле)
  const pool = ui.shop.map((id) => ALL_DEFS[id]).filter((d): d is TowerDefinition => !!d)
  const thumb = (t: TowerDefinition) => (typeof document === 'undefined' ? '' : towerThumb(t))
  const canRoll = ui.gold >= ui.rollCost && canBuild
  const [spin, setSpin] = useState(0)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Магазин башен"
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[rgba(4,7,12,0.7)] p-3 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ scale: 0.92, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="td-ornate flex max-h-[92dvh] w-[min(94vw,920px)] flex-col overflow-hidden rounded-2xl border border-[#3a4660]/90 bg-[rgba(9,13,21,0.88)] shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#3a4660] px-3 py-2">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-[#f2c94c]" strokeWidth={2.2} />
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#e8ecf4]">Арсенал</h2>
            <span className="text-[11px] text-[#7088a8]">выберите башню</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#f0b060]">
              <CoinIcon size={13} strokeWidth={2.6} />
              {ui.gold}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть магазин"
              title="Закрыть (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.92)] text-[#e8ecf4] active:scale-95"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 overflow-y-auto p-3">
          {pool.map((t) => {
            const affordable = ui.gold >= t.price
            const locked = !affordable || !canBuild
            const attacks: AttackType[] = t.merged ? t.attacks : [t.attack]
            const desc = t.merged ? t.desc : t.role
            const rarity = t.rarity ? RARITY_BY_ID[t.rarity] : null
            const econ = isEcon(t)
            // свечение карточки: цвет редкости; слитые без редкости — золото, экономические — тёплый
            const glow = rarity ? rarity.color : t.merged ? '#ffd700' : '#f0b060'
            return (
              <button
                key={t.id}
                type="button"
                disabled={locked}
                onClick={() => onPick(t.id)}
                aria-label={`Купить: ${t.name}, ${rarity ? rarity.name + ' редкость, ' : ''}${DAMAGE_TYPE[attacks[0]].name.toLowerCase()}, цена ${t.price}${affordable ? '' : ', не хватает золота'}`}
                title={`${desc.charAt(0).toUpperCase() + desc.slice(1)}${t.l5 ? ` · ★ 5 ур.: ${t.l5}` : ''}`}
                className={`hover-glow relative flex aspect-[4/5] flex-col overflow-hidden rounded-xl border text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed ${locked ? 'opacity-45' : ''}`}
                style={{
                  borderColor: rarity ? rarity.color + '66' : t.merged ? '#ffd70088' : '#3a4660',
                  '--glow': glow,
                } as CSSProperties}
              >
                {/* фон: глубина + свечение редкости за артом */}
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,#1c2536_0%,#121a28_46%,#0b1019_100%)]" />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-[72%]" style={{ background: `radial-gradient(70% 60% at 50% 74%, ${glow}30, transparent 72%)` }} />
                {/* арт башни: крупный план + размытое свечение огней, «выходящее» за края */}
                {thumb(t) ? (
                  <>
                    <img
                      src={thumb(t)}
                      alt=""
                      aria-hidden
                      className="absolute inset-x-0 bottom-[54px] top-0 origin-bottom scale-[1.8] object-contain object-bottom opacity-40 blur-xl [mask-image:radial-gradient(105%_92%_at_50%_72%,black_46%,transparent_86%)]"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <img
                      src={thumb(t)}
                      alt=""
                      aria-hidden
                      className="absolute inset-x-0 bottom-[54px] top-0 origin-bottom scale-[1.45] object-contain object-bottom"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </>
                ) : (
                  <span aria-hidden className="absolute inset-x-0 bottom-[54px] top-2 flex items-center justify-center text-4xl">{t.glyph}</span>
                )}

                {/* левая колонка: цена + характеристики поверх арта */}
                <span className="absolute left-1.5 top-1.5 z-10 flex w-[min(88px,72%)] flex-col items-start gap-[3px]">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] font-mono text-[11px] font-bold leading-none backdrop-blur-[2px] ${
                      affordable ? 'border-[#f2c94c88] bg-[rgba(14,18,26,0.82)] text-[#f2c94c]' : 'border-[#e0525288] bg-[rgba(14,18,26,0.82)] text-[#ff8a8a]'
                    }`}
                  >
                    <CoinIcon size={11} strokeWidth={2.6} />
                    {t.price}
                  </span>
                  {econ ? (
                    <>
                      {t.income ? (
                        <>
                          <ShopStat icon="💰" value={`+${econIncomeAt(t, 1)}/в`} color="#f0b060" title="Золото за волну (ур. 1)" />
                          <ShopStat icon="↗" value={`+${econIncomeBase(t)}/ур`} color="#e8d9a0" title="Прирост за уровень" />
                          <ShopStat icon="★" value={`+${econIncomeAt5(t)}`} color="#ffd700" title="Золото за волну на 5 ур." />
                        </>
                      ) : (
                        <>
                          <ShopStat icon="💠" value={`+${econIncomeAt(t, 1)}/в`} color="#a6f095" title="Эссенция за волну (ур. 1)" />
                          <ShopStat icon="↗" value={`+${econIncomeBase(t)}/ур`} color="#c9e8bd" title="Прирост за уровень" />
                          <ShopStat icon="★" value={`+${econIncomeAt5(t)}`} color="#7ad0c8" title="Эссенция за волну на 5 ур." />
                        </>
                      )}
                      {defFootprint(t) > 1 && <ShopStat icon="▦" value={`${defFootprint(t)}×${defFootprint(t)}`} color="#7fd0a0" title="Блок клеток" />}
                      <ShopStat icon="⚔" value="—" color="#8a96a8" title="Не атакует" />
                    </>
                  ) : (
                    <>
                      <ShopStat icon="⚔" value={num(t.damage)} color="#f0b060" title="Урон за выстрел" />
                      <ShopStat icon="⏱" value={`${num(1 / t.interval)}/с`} color="#9fd2ff" title="Скорость атаки" />
                      <ShopStat icon="◎" value={String(t.range)} color="#ccd8e6" title="Радиус атаки" />
                      <ShopStat icon="◆" value={`${num(t.damage / t.interval)}/с`} color="#7fd0a0" title="Урон в секунду" />
                      {shortFx(t).slice(0, 2).map((f) => (
                        <ShopStat key={f.icon + f.text} icon={f.icon} value={f.text} color="#e8c170" title={f.title} />
                      ))}
                    </>
                  )}
                </span>

                {/* низ: имя по центру, под ним редкость и тип урона */}
                <span className="absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(180deg,rgba(5,8,14,0)_0%,rgba(5,8,14,0.8)_40%,rgba(5,8,14,0.96)_100%)] px-1.5 pb-1.5 pt-5">
                  <span className="block text-center text-[11.5px] font-black uppercase leading-none tracking-[0.05em] text-[#e8ecf4] [text-shadow:0_1px_4px_rgba(0,0,0,0.95)]">{t.name}</span>
                  <span className="mt-1 flex flex-wrap items-center justify-center gap-1">
                    {rarity && (
                      <span className="rounded-sm border px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide" style={{ color: rarity.color, borderColor: rarity.color + '88', background: rarity.color + '1f' }}>
                        {rarity.name}
                      </span>
                    )}
                    {econ ? (
                      <span className="rounded-sm border border-[#e8c17088] bg-[#e8c1701f] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#e8c170]">🪙 экономика</span>
                    ) : (
                      attacks.map((a, i) => <DamageBadge key={a + i} type={a} label={false} />)
                    )}
                    {!!t.merged && (
                      <span className="rounded-sm border border-[#ffd70066] bg-[#ffd7001a] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#ffd700]">слитая</span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
          {pool.length === 0 && (
            <p className="px-6 py-8 text-center text-xs text-[#c3cbe0]">
              {canBuild ? 'Арсенал пуст — обновите его роллом' : 'Арсенал будет доступен в бою'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#3a4660] bg-[rgba(10,15,23,0.6)] px-3 py-2">
          <p className="text-[10.5px] leading-snug text-[#7088a8]">
            Купленная карточка уходит из арсенала до ролла и падает в «руку» — оттуда наведите копию на клетку или на такую же башню (+1 уровень).
          </p>
          <button
            type="button"
            disabled={!canRoll}
            onClick={() => {
              setSpin((s) => s + 1)
              onRoll()
            }}
            aria-label={`Ролл: обновить арсенал за ${ui.rollCost}`}
            title={`Ролл арсенала: ${pool.length} новых башен из ${TOWERS.length}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#3a4660] bg-[rgba(31,38,56,0.9)] px-3.5 py-2 text-[12px] font-bold text-[#e8ecf4] transition-colors hover:border-[#f2c94c]/50 hover:bg-[rgba(43,53,80,0.95)] active:scale-95 disabled:opacity-40 disabled:hover:border-[#3a4660] disabled:hover:bg-[rgba(31,38,56,0.9)]"
          >
            <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.45 }} className="flex text-[#f2c94c]">
              <DiceIcon size={18} />
            </motion.span>
            Ролл
            <span className={`font-mono ${ui.gold >= ui.rollCost ? 'text-[#f2c94c]' : 'text-[#ff8a8a]'}`}>{ui.rollCost}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Лавка предметов: кнопка + окно (покупка за эссенцию, этап 3) ──────────
/** Кнопка открытия лавки предметов */
export function LavkaButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Открыть лавку предметов"
      title="Лавка: предметы за эссенцию (действуют на аватара и все башни)"
      className={`${PILL} flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-4 text-[13px] font-bold uppercase tracking-wide text-[#e8ecf4] transition-all hover:-translate-y-px hover:border-[#a6f095]/50 hover:bg-[rgba(20,30,26,0.85)] active:scale-95 disabled:opacity-40`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#a6f095]/30 bg-[#a6f095]/12 text-[#a6f095]">
        <Gem className="h-5 w-5" strokeWidth={2.2} />
      </span>
      Лавка
    </button>
  )
}

/**
 * Лавка по центру экрана: 4 предложения (карточка = слот, эффект, цена в эссенции),
 * обновление витрины за 5 эссенции, снизу — экипированные предметы с продажей за 50%.
 */
export function LavkaModal({ ui, onBuy, onSell, onRoll, onClose }: {
  ui: UiState
  onBuy: (idx: number) => void
  onSell: (idx: number) => void
  onRoll: () => void
  onClose: () => void
}) {
  const canAct = ui.phase === 'preview' || ui.phase === 'wave'
  const offers = ui.itemShop
  const slotCount = (slot: string) => ui.items.filter((o) => ALL_ITEMS[o.id]?.slot === slot).length
  const canRoll = ui.essence >= ITEM_REROLL_COST && canAct
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Лавка предметов"
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[rgba(4,7,12,0.7)] p-3 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ scale: 0.92, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="td-ornate flex max-h-[92dvh] w-fit max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-[#3f5c4a]/90 bg-[rgba(8,12,10,0.88)] shadow-[0_24px_80px_rgba(0,0,0,0.75)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#3a5c46] px-3 py-2">
          <div className="flex items-center gap-2">
            <Gem className="h-4 w-4 text-[#a6f095]" strokeWidth={2.2} />
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#e8ecf4]">Лавка</h2>
            <span className="text-[11px] text-[#7ba88a]">предметы за эссенцию</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#a6f095]">
              <span className="text-[13px] leading-none">💠</span>
              {ui.essence}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть лавку"
              title="Закрыть (Esc)"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[#3a5c46] bg-[rgba(12,19,15,0.92)] text-[#e8ecf4] active:scale-95"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 overflow-y-auto p-3">
          {offers.map((o, idx) => {
            const def = ALL_ITEMS[o.id]
            if (!def) return null
            const slot = ITEM_SLOTS[def.slot]
            const slotFull = slotCount(def.slot) >= slot.max
            const affordable = ui.essence >= def.price
            const locked = !affordable || !canAct || slotFull
            return (
              <button
                key={`${idx}-${o.id}`}
                type="button"
                disabled={locked}
                onClick={() => onBuy(idx)}
                aria-label={`Купить: ${def.name}, ${slot.name}, ${def.price} эссенции${o.rare ? ', редкий' : ''}`}
                className={`hover-glow flex w-[210px] flex-col overflow-hidden rounded-xl text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
                  o.rare ? 'border border-[#7ad0c8aa] bg-gradient-to-b from-[#1d3234] to-[#101c1a]' : 'border border-[#3f5c4a]/90 bg-gradient-to-b from-[#1d2c22] to-[#101a13]'
                } ${locked ? 'opacity-45' : ''}`}
                style={{ '--glow': o.rare ? '#7ad0c8' : '#8fe0a8' } as CSSProperties}
              >
                <div className="h-1 w-full" style={{ background: o.rare ? 'linear-gradient(90deg,#7ad0c8,#7ad0c833)' : 'linear-gradient(90deg,#a6f095,#a6f09533)' }} />
                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[12.5px] font-black leading-tight text-[#e8ecf4]">{def.name}</p>
                    <span className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-xs font-bold ${affordable ? 'text-[#a6f095]' : 'text-[#e05252]'}`}>
                      💠{def.price}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded-sm border border-[#3a5c46] bg-[#0a0f17]/60 px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#9fb1c8]">
                      {slot.name} {slotCount(def.slot)}/{slot.max}
                    </span>
                    {o.rare && (
                      <span className="rounded-sm border border-[#7ad0c888] bg-[#7ad0c81a] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#7ad0c8]">
                        редкий · эффект +50%
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] leading-snug text-[#b9c6d8]">{def.desc}</p>
                  {slotFull && <p className="text-[9.5px] text-[#e0a050]">Слот занят — продайте предмет ниже</p>}
                </div>
              </button>
            )
          })}
          {offers.length === 0 && (
            <p className="px-6 py-8 text-center text-xs text-[#c3cbe0]">
              Витрина пуста — обновите её кнопкой ниже
            </p>
          )}
        </div>

        <div className="border-t border-[#3a5c46] bg-[rgba(8,13,10,0.6)] px-3 py-2">
          {ui.items.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7ba88a]">надето {ui.items.length}/{ITEM_SLOTS_TOTAL}:</span>
              {ui.items.map((o, idx) => {
                const def = ALL_ITEMS[o.id]
                if (!def) return null
                return (
                  <button
                    key={`${idx}-${o.id}`}
                    type="button"
                    onClick={() => onSell(idx)}
                    disabled={!canAct}
                    title={`Продать за ${Math.floor(def.price * 0.5)} эссенции (50%)`}
                    className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[10.5px] font-bold active:scale-95 disabled:opacity-40 ${
                      o.rare ? 'border-[#7ad0c8aa] bg-[#1d2e2a] text-[#7ad0c8]' : 'border-[#3a5c46] bg-[#18241c] text-[#c9e8bd]'
                    }`}
                  >
                    {def.name}
                    <span className="font-mono text-[9px] opacity-70">+{Math.floor(def.price * 0.5)}💠</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10.5px] leading-snug text-[#7ba88a]">
              Бонус предмета действует на аватара и все башни. Редкие версии (+50% к эффекту) появляются после 10-й волны. В конце матча всё сгорает.
            </p>
            <button
              type="button"
              disabled={!canRoll}
              onClick={onRoll}
              aria-label={`Обновить витрину за ${ITEM_REROLL_COST} эссенции`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#3f5c4a] bg-[rgba(29,44,34,0.9)] px-3.5 py-2 text-[12px] font-bold text-[#e8ecf4] transition-colors hover:border-[#a6f095]/50 hover:bg-[rgba(38,58,45,0.95)] active:scale-95 disabled:opacity-40"
            >
              <RefreshCw className="h-4 w-4 text-[#a6f095]" strokeWidth={2.4} />
              Обновить
              <span className={`font-mono ${ui.essence >= ITEM_REROLL_COST ? 'text-[#a6f095]' : 'text-[#ff8a8a]'}`}>💠{ITEM_REROLL_COST}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Чип характеристики на карточке магазина: маленькая плашка с иконкой и значением поверх арта */
function ShopStat({ icon, value, color, title }: { icon: string; value: string; color: string; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#2e3c52]/80 bg-[rgba(8,12,20,0.78)] px-1.5 py-[2.5px] leading-none backdrop-blur-[2px]"
    >
      <span className="shrink-0 text-[9.5px]" style={{ color }}>
        {icon}
      </span>
      <span className="truncate font-mono text-[10px] font-bold" style={{ color }}>
        {value}
      </span>
    </span>
  )
}

/** Особые эффекты башни короткими подписями для чипов (полный текст — в title и effectLines) */
function shortFx(def: TowerDefinition): { icon: string; text: string; title: string }[] {
  const fulls = effectLines(def)
  const p = (v: number) => `${Math.round(v * 100)}%`
  const rows: { icon: string; text: string; title: string }[] = []
  // порядок повторяет effectLines — title берётся из той же позиции
  const add = (icon: string, text: string) => rows.push({ icon, text, title: fulls[rows.length] ?? text })
  if (def.splash) add('💥', `R${def.splash}`)
  if (def.slam) add('⭙', 'круг')
  if (def.line) add('→', 'линия')
  if (def.targets) add('✳', `×${def.targets}`)
  if (def.chain) add('⛓', `+${def.chain}`)
  if (def.burn) add('🔥', `${def.burn.dps}/с`)
  if (def.slow) add('❄', p(def.slow.pct))
  if (def.freeze) add('❄', `${def.freeze}с`)
  if (def.stunChance) add('⚡', p(def.stunChance))
  if (def.stunSlow) add('😵', p(def.stunSlow.pct))
  if (def.vuln) add('✖', `+${p(def.vuln.bonus)}`)
  if (def.heavyBonus) add('🛡', `×${def.heavyBonus}`)
  if (def.critEvery) add('✷', `1/${def.critEvery}`)
  if (def.aura) add('⟡', `+${p(def.aura)}`)
  if (def.ramp) add('⏫', `+${p(def.ramp)}`)
  if (def.focus) add('◎', `+${p(def.focus.perHit)}`)
  if (def.waveGrowth) add('↟', `+${p(def.waveGrowth)}`)
  return rows
}

// ─── Рука: купленные башни, ждущие установки или прокачки ──────────────────
/** Короткое число: 12 / 1,2к / 3,4М */
export const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'М'
  if (n >= 10_000) return Math.round(n / 1000) + 'к'
  if (n >= 1_000) return (n / 1000).toFixed(1).replace('.', ',') + 'к'
  return String(Math.round(n))
}

export function HandTray({
  ui, armedHand, onArm, size = 'sm',
}: {
  ui: UiState
  /** индекс взятой в «стол» копии (подсветка) */
  armedHand: number | null
  onArm: (idx: number) => void
  size?: 'sm' | 'lg'
}) {
  const defOf = (idx: number) => ALL_DEFS[ui.hand[idx]]
  // поп новой карточки и автоскролл к ней — только при покупке (рост руки);
  // поп задаём ключевыми кадрами после монтирования, чтобы не читать ref во время рендера
  const trayRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(ui.hand.length)
  const [popKey, setPopKey] = useState<string | null>(null)
  useEffect(() => {
    if (ui.hand.length > prevLen.current) {
      const i = ui.hand.length - 1
      setPopKey(`${i}-${ui.hand[i]}`)
      trayRef.current?.scrollTo({ left: trayRef.current.scrollWidth, behavior: 'smooth' })
      const t = setTimeout(() => setPopKey(null), 520)
      prevLen.current = ui.hand.length
      return () => clearTimeout(t)
    }
    prevLen.current = ui.hand.length
  })
  if (!ui.hand.length) return null
  const cardW = size === 'lg' ? 88 : 74
  const cardH = size === 'lg' ? 112 : 96
  const imgH = size === 'lg' ? 54 : 44
  return (
    <div
      ref={trayRef}
      className={`${PILL} no-scrollbar flex min-w-0 max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl py-2 pl-1.5 pr-1.5`}
      role="group"
      aria-label={`Рука: купленных башен ${ui.hand.length}, клик — взять в стол`}
    >
      {ui.hand.map((id, i) => {
        const def = defOf(i)
        if (!def) return null
        const on = armedHand === i
        const econ = isEcon(def)
        const rarity = def.rarity ? RARITY_BY_ID[def.rarity] : null
        // главная характеристика копии: у экономических — доход за волну (бур — по кривой), у боевых — ДПС
        const stat = econ
          ? `${fmtNum(econIncomeAt(def, 1))}${def.essence ? '💠' : ''}/волна`
          : `${fmtNum(def.damage / def.interval)} ДПС`
        const label = econ ? (def.essence ? 'добыча' : 'доход') : 'урон'
        // рамка карточки — цвет редкости (слитые — золото, экономические — латунь)
        const frame = rarity ? rarity.color : def.merged ? '#ffd700' : '#c9a25e'
        const pop = popKey === `${i}-${id}`
        return (
          <motion.button
            key={`${i}-${id}`}
            type="button"
            aria-pressed={on}
            aria-label={`Взять в стол: ${def.name}, ${rarity ? rarity.name + ' редкость, ' : ''}${label} ${stat} (копия ${i + 1} из ${ui.hand.length})`}
            title={on ? 'Снята со стола' : `${def.name} — копия из руки: тап по клетке или по такой же башне`}
            onClick={() => onArm(i)}
            animate={pop
              ? { scale: [0.5, 1.1, 1], y: [12, 0], opacity: [0.3, 1] }
              : on
                ? { y: -4, scale: 1, opacity: 1 }
                : { y: 0, scale: 1, opacity: 1 }}
            transition={{
              type: 'spring', stiffness: 420, damping: 26,
              // три опорных кадра «попа» не живут на пружине — только твин
              scale: { type: 'tween', duration: 0.38, ease: 'easeOut', times: [0, 0.65, 1] },
              opacity: { type: 'tween', duration: 0.22 },
            }}
            className="hover-glow relative flex shrink-0 grow-0 flex-col items-center overflow-hidden rounded-xl"
            style={{
              width: cardW,
              height: cardH,
              boxSizing: 'border-box',
              border: `2px solid ${on ? '#8fe0a8' : frame + '8c'}`,
              background: on
                ? 'linear-gradient(180deg,#2a3a33 0%,#16211d 100%)'
                : 'linear-gradient(180deg,#28324c 0%,#1b2334 62%,#141b2a 100%)',
              boxShadow: on ? '0 6px 18px rgba(0,0,0,0.55)' : undefined,
              // свечение при наведении — в цвет редкости; слитые без редкости — золото
              '--glow': frame,
            } as CSSProperties}
          >
            {/* цветное свечение под спрайтом — в цвет башни */}
            <span
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: imgH + 10, background: `radial-gradient(ellipse 70% 85% at 50% 100%, ${def.color}2e, transparent 72%)` }}
            />
            {/* полная картинка башни — тот же спрайт, что на поле (часть корпуса может ещё грузиться) */}
            <span className="flex w-full items-end justify-center overflow-hidden" style={{ height: imgH }}>
              {typeof document === 'undefined' ? (
                <span className="text-lg leading-none">{def.glyph}</span>
              ) : (
                <img
                  src={towerThumb(def)}
                  alt=""
                  className="max-h-full w-auto"
                  style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.45))' }}
                  draggable={false}
                />
              )}
            </span>
            <span className="mt-1 w-full truncate px-1.5 text-center text-[9px] font-semibold leading-[11px] text-[#e6ecf6]" title={def.name}>
              {def.name}
            </span>
            <span className="mt-0.5 w-full px-1.5 text-center font-mono text-[9.5px] font-bold leading-[12px]" style={{ color: econ ? '#8fe0a8' : '#f2c94c' }}>
              {stat}
            </span>
            {rarity && (
              <span
                title={`редкость: ${rarity.name}`}
                className="absolute bottom-0 left-0 h-[3px] w-full"
                style={{ background: `linear-gradient(90deg, ${rarity.color}, ${rarity.color}55)` }}
              />
            )}
            <span className="absolute right-1 top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#e8ecf4]/25 bg-[#0b0e14]/85 text-[8.5px] font-black leading-none text-[#e8ecf4]">
              {i + 1}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Табличка урона: кто сколько урона нанёс за карту (башни + герой) ─────
export function TowerDamageBoard({ ui }: { ui: UiState }) {
  const [open, setOpen] = useState(true)
  const rows = Object.entries(ui.stats.damageByTower ?? {})
    .filter(([, v]) => v >= 1)
    .sort((a, b) => b[1] - a[1])
  if (!rows.length) return null
  const total = ui.stats.damageDealt
  const max = rows[0][1]
  const heroDef = AVATARS[ui.avatar.id]
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Развернуть табличку урона за карту: всего ${fmtNum(total)}`}
        title={`Урон за карту: ${Math.round(total)} · нажми, чтобы разложить по башням`}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#3a4660]/90 bg-[rgba(10,15,24,0.85)] px-3 py-1.5 backdrop-blur-md active:scale-95"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7088a8]">Урон</span>
        <span className="font-mono text-[11px] font-bold text-[#f2c94c]">{fmtNum(total)}</span>
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={`Табличка урона за карту: всего ${fmtNum(total)} за ${rows.length} источника`}
      className="pointer-events-auto w-[224px] rounded-xl border border-[#3a4660]/90 bg-[rgba(10,15,24,0.85)] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#7088a8]">
          Урон за карту
        </span>
        <span className="font-mono text-[11px] font-bold text-[#f2c94c]">{fmtNum(total)}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Свернуть табличку урона"
          title="Свернуть"
          className="rounded p-0.5 text-[#7088a8] active:scale-90"
        >
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex max-h-[min(44vh,300px)] flex-col gap-1 overflow-y-auto pr-0.5">
        {rows.map(([id, v]) => {
          const isAvatar = id === 'avatar'
          const def = (ALL_DEFS as Record<string, TowerDefinition | undefined>)[id]
          const name = isAvatar ? heroDef.name : def?.name ?? id
          const barColor = def?.color ?? '#a0aec0'
          const thumb = isAvatar
            ? avatarPortrait(heroDef.id, 2)
            : def && typeof document !== 'undefined'
              ? towerThumb(def)
              : ''
          return (
            <div
              key={id}
              className="flex items-center gap-1.5"
              title={`${name}: ${Math.round(v)} урона (${Math.round((v / total) * 100)}%)`}
            >
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className={`h-4 w-4 shrink-0 ${isAvatar ? 'rounded-full object-cover' : 'object-contain'}`}
                  style={{ imageRendering: 'pixelated' }}
                  draggable={false}
                />
              )}
              <span className="w-[84px] shrink-0 truncate text-[10px] font-semibold leading-tight text-[#dde6f0]">
                {name}
              </span>
              <span className="relative h-1.5 min-w-4 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.max(5, (v / max) * 100)}%`, background: barColor }}
                />
              </span>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] leading-tight text-[#c3cbe0]">
                {fmtNum(v)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Подтверждение постройки: плашка с ценой и круглые ✕ / ✓ ──────────────
export function BuildConfirmButton({
  kind, onClick, disabled, size, label,
}: { kind: 'cancel' | 'ok'; onClick: () => void; disabled?: boolean; size: number; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`pointer-events-auto flex items-center justify-center rounded-full p-0 active:scale-95 disabled:opacity-40 ${
        kind === 'ok' ? 'border border-[#59c27a] bg-[#59c27a] text-[#0b1a10]' : 'border border-[#3a4660] bg-[rgba(14,19,31,0.92)] text-[#e8ecf4]'
      }`}
      style={{ width: size, height: size }}
    >
      {kind === 'ok' ? <CheckIcon size={size * 0.45} /> : <CloseIcon size={size * 0.45} />}
    </button>
  )
}

export function PricePlaque({ price }: { price: number }) {
  return (
    <span className="inline-flex h-5 items-center justify-center gap-1 rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.92)] px-2 text-[12px] font-bold leading-none text-[#f2c94c]">
      <CoinIcon size={12} strokeWidth={3} />
      {price}
    </span>
  )
}

// ─── Баннер новой волны посреди экрана ───────────────────────────────────
export function WaveBanner({ ui }: { ui: UiState }) {
  const [shown, setShown] = useState<{ wave: number; boss: boolean } | null>(null)
  const last = useRef(0)
  const bossWave = useRef(false)
  useEffect(() => {
    if (ui.phase === 'preview') bossWave.current = ui.nextWaveIsBoss
    if (ui.phase === 'wave' && ui.wave !== last.current) {
      last.current = ui.wave
      setShown({ wave: ui.wave, boss: bossWave.current })
      const t = setTimeout(() => setShown(null), AI_SIGNALS[ui.wave - 1] ? 3400 : 1600)
      return () => clearTimeout(t)
    }
    if (ui.phase === 'intro') last.current = 0
  }, [ui.phase, ui.wave, ui.nextWaveIsBoss])
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown.wave}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.3, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="pointer-events-none text-center"
        >
          <div className="flex flex-col items-center">
            <span
              className="mb-2 h-px w-44 sm:w-60"
              style={{ background: `linear-gradient(90deg, transparent, ${shown.boss ? '#ff7a7a88' : '#f2c94c88'}, transparent)` }}
            />
            <p className={`text-3xl font-black tracking-[0.12em] sm:text-5xl sm:tracking-[0.2em] [text-shadow:0_2px_0_rgba(0,0,0,0.85),0_10px_32px_rgba(0,0,0,0.6)] ${shown.boss ? 'text-[#ff7a7a]' : 'text-[#f2c94c]'}`}>
              {shown.boss ? 'КОЛОСС РАЗЛОМА' : `ВОЛНА ${shown.wave}`}
            </p>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-[#e6ecf6] sm:text-sm sm:tracking-[0.45em] [text-shadow:0_1px_0_rgba(0,0,0,0.85)]">
              {shown.boss ? 'босс идёт к лагерю' : 'заражённые выходят из Разлома'}
            </p>
            <span
              className="mt-2 h-px w-44 sm:w-60"
              style={{ background: `linear-gradient(90deg, transparent, ${shown.boss ? '#ff7a7a88' : '#f2c94c88'}, transparent)` }}
            />
          </div>
          {AI_SIGNALS[shown.wave - 1] && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mx-auto mt-3 max-w-md rounded-full border border-[#59c27a]/40 bg-[rgba(10,15,24,0.82)] px-4 py-2 text-xs font-medium text-[#a6f095] shadow-lg backdrop-blur-md"
            >
              <span className="text-[#59c27a]">▮ сигнал ИИ:</span> «{AI_SIGNALS[shown.wave - 1]}»
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
