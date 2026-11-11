'use client'

// HUD «Последнего горизонта»: один набор компонентов для телефона (ландшафт) и компьютера.
// Верх: ресурсы · волна (или что строим) · скорость, пауза, меню. Низ: герой и способность · арсенал
// (прокручиваемый ряд карточек + закреплённый ролл) · «Начать». Раскладку задаёт GameShell.
// Стиль: Rubik, панели rgba(14,19,31,.9) с рамкой #3a4660, золото #f2c94c, линейные иконки.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { AI_SIGNALS, ALL_DEFS, ALL_ITEMS, ARMOR_COLORS, ARMOR_NAMES, AVATARS, ITEM_REROLL_COST, ITEM_SLOTS, ITEM_SLOTS_TOTAL, RARITY_BY_ID, TOWERS, defFootprint, econIncomeAt, econIncomeAt5, econIncomeBase } from '@/game/config'
import { avatarPortrait, towerThumb } from '@/game/pixel'
import type { AttackType, TowerDefinition, UiState } from '@/game/types'
import type { MpRole, MpStatus } from './Panels'
import { DAMAGE_TYPE, DamageBadge, EffectiveVs, effectLines, isEcon } from './TowerInfo'
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

const PILL = 'pointer-events-auto border border-[#3a4660] bg-[rgba(14,19,31,0.9)]'
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

/** Круглая кнопка 44 px: скорость, пауза, меню, отмена */
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
      className={`${PILL} flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-[15px] font-bold leading-none text-[#e8ecf4] transition-transform active:scale-95 disabled:opacity-40 ${
        active ? '!border-[#f2c94c] !text-[#f2c94c]' : ''
      } ${className}`}
    >
      {children}
    </button>
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
    <motion.div {...slideDown} className={`${PILL} flex h-11 items-center gap-3 rounded-full px-4 text-[15px] font-bold leading-none`}>
      <motion.span
        animate={building}
        className="flex items-center gap-1.5 text-[#ff9a7a]"
        title={`Главное здание: ${ui.buildingHp} / ${ui.buildingMaxHp} HP`}
      >
        <BuildingIcon size={18} />
        <span className="h-2 w-12 overflow-hidden rounded-full bg-[#4a1f24]">
          <span className="block h-full rounded-full transition-[width] duration-200" style={{ width: `${hpPct * 100}%`, background: hpColor }} />
        </span>
        <span className="font-mono text-[12px] tabular-nums text-[#ffb0a0]">
          {ui.buildingHp}
          <span className="text-[10px] opacity-60">/{ui.buildingMaxHp}</span>
        </span>
      </motion.span>
      <motion.span animate={gold} className="flex items-center gap-1.5 text-[#f2c94c]" title="Золото">
        <CoinIcon size={18} /> {ui.infiniteGold ? '∞' : ui.gold}
      </motion.span>
      <span className="flex items-center gap-1 text-[#a6f095]" title="Эссенция: добывается шахтами, тратится в лавке предметов">
        <span className="text-[15px] leading-none">💠</span>
        <span className="font-mono text-[13px] tabular-nums">{ui.essence}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[#c3cbe0]" title="Волна">
        <SwordsIcon size={18} /> {Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}
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
    <motion.div {...slideDown} className={`${PILL} flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full pl-4 pr-3 text-[15px] font-bold leading-none text-[#f4ead2]`}>
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
      className={`flex h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-[13px] font-bold active:scale-[0.98] disabled:cursor-default ${
        active ? 'border-[#f2c94c] bg-[#2b3550] text-[#f2c94c]' : 'border-[#3a4660] bg-[#1f2638] text-[#e8ecf4]'
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
            <div className="pointer-events-auto absolute right-0 top-[52px] z-30">
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
  const caption = 'text-[10px] font-bold uppercase leading-[14px] tracking-[0.04em] text-[#c3cbe0] [text-shadow:0_1px_2px_#000]'
  return (
    <div className="pointer-events-auto flex items-center gap-2">
      <div className="flex w-[72px] flex-col items-center gap-1" title={`${AVATAR.name}: ${AVATAR.role}. Пассивно: ${AVATAR.passive}`}>
        <div
          className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[#59c27a] bg-[rgba(14,19,31,0.9)]"
          role="img"
          aria-label={AVATAR.name}
        >
          <img src={avatarPortrait(AVATAR.id, 3)} alt="" className="h-full w-full object-cover object-top" draggable={false} />
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-[#0b0e14cc] px-1 text-[9px] font-bold leading-[13px] text-[#f2c94c]">
            {ui.avatar.level} ур.
          </span>
        </div>
        <span className={caption}>{AVATAR.name}</span>
      </div>
      <div className="flex w-16 flex-col items-center gap-1">
        <motion.button
          type="button"
          onClick={onAbility}
          disabled={!ready}
          aria-label={`Способность: ${AVATAR.abilityName}`}
          title={role === 'guest' ? 'Способностью управляет хост' : `${AVATAR.abilityName}: ${AVATAR.abilityDesc}`}
          whileTap={ready ? { scale: 0.92 } : undefined}
          animate={ready ? { boxShadow: ['0 0 0 rgba(242,201,76,0)', '0 0 14px rgba(242,201,76,0.8)', '0 0 0 rgba(242,201,76,0)'] } : { boxShadow: '0 0 0 rgba(242,201,76,0)' }}
          transition={ready ? { duration: 1.6, repeat: Infinity } : undefined}
          className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#f2c94c] p-0 text-[#f2c94c] disabled:opacity-60"
          style={{ background: cd > 0 ? `conic-gradient(rgba(5,8,14,0.85) ${cdFrac * 360}deg, rgba(14,19,31,0.9) 0deg)` : UI.panel }}
        >
          <BoltIcon size={24} />
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
      className="pointer-events-auto flex h-11 items-center gap-2 whitespace-nowrap rounded-full border-0 bg-[#f2c94c] pl-3.5 pr-[18px] text-[15px] font-bold leading-none text-[#1a1408] active:scale-95"
    >
      <PlayIcon stroke="#1a1408" />
      <span>Начать · {left}с</span>
      {boss && (
        <span className="rounded-full bg-[#2b0d0d] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#ff9a7a]">
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
      className={`${PILL} flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide text-[#e8ecf4] transition-colors hover:bg-[rgba(30,38,56,0.95)] active:scale-95 disabled:opacity-40`}
    >
      <Store className="h-5 w-5 shrink-0 text-[#f2c94c]" strokeWidth={2.2} />
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
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[rgba(5,7,11,0.72)] p-3"
    >
      <motion.div
        initial={{ scale: 0.92, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-fit max-w-[96vw] flex-col overflow-hidden rounded-2xl border-2 border-[#5b6f8c] bg-[rgba(14,19,31,0.97)] shadow-[0_18px_60px_rgba(0,0,0,0.8)]"
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

        <div className="flex flex-wrap justify-center gap-2 overflow-y-auto p-3">
          {pool.map((t) => {
            const affordable = ui.gold >= t.price
            const locked = !affordable || !canBuild
            const attacks: AttackType[] = t.merged ? t.attacks : [t.attack]
            const desc = t.merged ? t.desc : t.role
            const effects = effectLines(t)
            const rarity = t.rarity ? RARITY_BY_ID[t.rarity] : null
            return (
              <button
                key={t.id}
                type="button"
                disabled={locked}
                onClick={() => onPick(t.id)}
                aria-label={`Купить: ${t.name}, ${rarity ? rarity.name + ' редкость, ' : ''}${DAMAGE_TYPE[attacks[0]].name.toLowerCase()}, цена ${t.price}${affordable ? '' : ', не хватает золота'}`}
                className={`flex w-[220px] flex-col overflow-hidden rounded-xl border text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed ${
                  t.merged ? 'bg-[#242a3e]' : 'bg-[#1f2638]'
                } ${locked ? 'opacity-45' : ''}`}
                style={{ borderColor: rarity ? rarity.color + '66' : t.merged ? '#ffd70088' : '#3a4660' }}
              >
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${t.color}, ${t.color}33)` }} />
                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  <div className="flex items-start gap-2">
                    <div className="flex h-11 w-11 shrink-0 items-end justify-center rounded border border-[#2e3c52] bg-[radial-gradient(circle_at_50%_70%,#1f2a3b,#0a0f17)]">
                      {thumb(t) ? (
                        <img src={thumb(t)} alt="" className="h-10 w-auto max-w-[40px] object-contain" style={{ imageRendering: 'pixelated' }} />
                      ) : (
                        <span className="self-center text-xl">{t.glyph}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-serif text-[13px] font-black leading-tight text-[#ffc46b]">{t.name}</p>
                        <span className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-xs font-bold ${affordable ? 'text-[#f0b060]' : 'text-[#e05252]'}`}>
                          <CoinIcon size={12} strokeWidth={2.6} />
                          {t.price}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {rarity && (
                          <span
                            className="rounded-sm border px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide"
                            style={{ color: rarity.color, borderColor: rarity.color + '88', background: rarity.color + '1f' }}
                          >
                            {rarity.name}
                          </span>
                        )}
                        {isEcon(t) ? (
                          <span className="rounded-sm border border-[#e8c17088] bg-[#e8c1701f] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#e8c170]">
                            🪙 экономика
                          </span>
                        ) : (
                          attacks.map((a, i) => (
                            <DamageBadge key={a + i} type={a} />
                          ))
                        )}
                        {!!t.merged && (
                          <span className="rounded-sm border border-[#ffd70066] bg-[#ffd7001a] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-[#ffd700]">
                            слитая
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-[10.5px] leading-snug text-[#b9c6d8]">{desc.charAt(0).toUpperCase() + desc.slice(1)}</p>
                  <EffectiveVs def={t} />

                  <div className="grid grid-cols-4 gap-1">
                    {isEcon(t) ? (
                      t.income ? (
                        <>
                          <ShopStat label="Доход" value={`+${econIncomeAt(t, 1)}/волну`} color="#f0b060" />
                          <ShopStat label="За уровень" value={`+${econIncomeBase(t)}`} color="#e8d9a0" />
                          <ShopStat label="На 5 ур." value={`+${econIncomeAt5(t)}`} color="#ffd700" />
                          <ShopStat label="Атака" value="нет" color="#8a96a8" />
                        </>
                      ) : (
                        <>
                          <ShopStat label="Доход" value={`+${econIncomeAt(t, 1)}💠/волну`} color="#a6f095" />
                          <ShopStat label="За уровень" value={`+${econIncomeBase(t)}`} color="#c9e8bd" />
                          <ShopStat label="На 5 ур." value={`+${econIncomeAt5(t)}`} color="#7ad0c8" />
                          {defFootprint(t) > 1 ? <ShopStat label="Слот" value={`${defFootprint(t)}×${defFootprint(t)}`} color="#7fd0a0" /> : <ShopStat label="Атака" value="нет" color="#8a96a8" />}
                        </>
                      )
                    ) : (
                      <>
                        <ShopStat label="Урон" value={num(t.damage)} color="#f0b060" />
                        <ShopStat label="Скорость" value={`${num(1 / t.interval)}/с`} color="#9fd2ff" />
                        <ShopStat label="Дальн." value={String(t.range)} color="#ccd8e6" />
                        <ShopStat label="Урон/с" value={num(t.damage / t.interval)} color="#7fd0a0" />
                      </>
                    )}
                  </div>

                  {effects.length > 0 && (
                    <ul className="flex flex-col gap-0.5">
                      {effects.slice(0, 2).map((e) => (
                        <li key={e} className="flex gap-1 text-[10px] leading-snug text-[#c9d6e8]">
                          <span className="text-[#f0b060]">◆</span>
                          {e}
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="mt-auto pt-0.5 text-[10px] leading-snug text-[#e8d9a0]">
                    <span className="font-bold text-[#ffd700]">★ 5 ур.:</span> {t.l5}
                  </p>
                </div>
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
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#3a4660] bg-[#1f2638] px-3 py-1.5 text-[12px] font-bold text-[#c3cbe0] active:scale-95 disabled:opacity-40"
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
export function LavkaButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Открыть лавку предметов"
      title="Лавка: предметы за эссенцию (действуют на аватара и все башни)"
      className={`${PILL} flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-bold uppercase tracking-wide text-[#e8ecf4] transition-colors hover:bg-[rgba(30,38,56,0.95)] active:scale-95 disabled:opacity-40`}
    >
      <Gem className="h-5 w-5 shrink-0 text-[#a6f095]" strokeWidth={2.2} />
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
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[rgba(5,7,11,0.72)] p-3"
    >
      <motion.div
        initial={{ scale: 0.92, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-fit max-w-[96vw] flex-col overflow-hidden rounded-2xl border-2 border-[#4e7a5c] bg-[rgba(12,19,15,0.97)] shadow-[0_18px_60px_rgba(0,0,0,0.8)]"
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
                className={`flex w-[210px] flex-col overflow-hidden rounded-xl text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
                  o.rare ? 'border border-[#7ad0c8aa] bg-[#1d2e2a]' : 'border border-[#3a5c46] bg-[#18241c]'
                } ${locked ? 'opacity-45' : ''}`}
              >
                <div className="h-1 w-full" style={{ background: o.rare ? 'linear-gradient(90deg,#7ad0c8,#7ad0c833)' : 'linear-gradient(90deg,#a6f095,#a6f09533)' }} />
                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-serif text-[13px] font-black leading-tight text-[#c9e8bd]">{def.name}</p>
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
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#3a5c46] bg-[#18241c] px-3 py-1.5 text-[12px] font-bold text-[#c3e0c8] active:scale-95 disabled:opacity-40"
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

function ShopStat({ label, value, color = '#dde6f0' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-[#2e3c52] bg-[#0a0f17]/70 px-1 py-0.5 text-center">
      <div className="text-[7.5px] font-semibold uppercase tracking-wide text-[#5b6f8c]">{label}</div>
      <div className="font-mono text-[11px] font-bold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  )
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
  if (!ui.hand.length) return null
  const cardW = size === 'lg' ? 78 : 66
  const cardH = size === 'lg' ? 94 : 82
  const imgH = size === 'lg' ? 46 : 40
  return (
    <div
      className={`${PILL} flex items-center gap-1.5 rounded-[18px] p-1.5`}
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
        return (
          <button
            key={`${i}-${id}`}
            type="button"
            aria-pressed={on}
            aria-label={`Взять в стол: ${def.name}, ${rarity ? rarity.name + ' редкость, ' : ''}${label} ${stat} (копия ${i + 1} из ${ui.hand.length})`}
            title={on ? 'Снята со стола' : `${def.name} — копия из руки: тап по клетке или по такой же башне`}
            onClick={() => onArm(i)}
            className={`relative flex shrink-0 grow-0 flex-col items-center overflow-hidden rounded-xl pb-0.5 ${on ? 'border-2 border-[#7fd0a0] bg-[#1f2d28]' : 'border bg-[#1f2638]'}`}
            style={{
              width: cardW,
              height: cardH,
              boxSizing: 'border-box',
              borderColor: rarity ? rarity.color + (on ? 'ff' : '66') : on ? undefined : '#3a4660',
            }}
          >
            {/* полная картинка башни — тот же спрайт, что на поле (часть корпуса может ещё грузиться) */}
            <span
              className="flex w-full items-end justify-center overflow-hidden"
              style={{ height: imgH }}
            >
              {typeof document === 'undefined' ? (
                <span className="text-lg leading-none">{def.glyph}</span>
              ) : (
                <img
                  src={towerThumb(def)}
                  alt=""
                  className="max-h-full w-auto"
                  style={{ imageRendering: 'pixelated' }}
                  draggable={false}
                />
              )}
            </span>
            <span className="mt-1 w-full truncate px-1 text-center text-[8.5px] font-semibold leading-[10px] text-[#dde6f0]" title={def.name}>
              {def.name}
            </span>
            <span className="mt-0.5 w-full px-1 text-center font-mono text-[9px] font-bold leading-[11px]" style={{ color: econ ? '#7fd0a0' : '#f2c94c' }}>
              {stat}
            </span>
            {rarity && (
              <span
                title={`редкость: ${rarity.name}`}
                className="absolute bottom-0 left-0 h-[3px] w-full rounded-b-[10px]"
                style={{ background: rarity.color + 'cc' }}
              />
            )}
            <span className="absolute right-[3px] top-[3px] rounded-full bg-[#0b0e14aa] px-1 text-[8px] font-bold leading-[12px] text-[#7fd0a0]">
              {i + 1}
            </span>
          </button>
        )
      })}
      {ui.hand.length > 0 && (
        <span className="pr-1 text-[10px] font-bold uppercase tracking-wider text-[#7fd0a0]">
          рука
        </span>
      )}
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
        className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.92)] px-3 py-1.5 active:scale-95"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5b6f8c]">Урон</span>
        <span className="font-mono text-[11px] font-bold text-[#f2c94c]">{fmtNum(total)}</span>
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={`Табличка урона за карту: всего ${fmtNum(total)} за ${rows.length} источника`}
      className="pointer-events-auto w-[224px] rounded-xl border border-[#3a4660] bg-[rgba(14,19,31,0.92)] p-2 shadow-[0_4px_16px_rgba(0,0,0,0.55)]"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#5b6f8c]">
          Урон за карту
        </span>
        <span className="font-mono text-[11px] font-bold text-[#f2c94c]">{fmtNum(total)}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Свернуть табличку урона"
          title="Свернуть"
          className="rounded p-0.5 text-[#5b6f8c] active:scale-90"
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
              <span className="relative h-1.5 min-w-4 flex-1 overflow-hidden rounded-full bg-[#141b27]">
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
          <p className={`text-3xl font-bold tracking-[0.12em] sm:text-5xl sm:tracking-[0.2em] drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] ${shown.boss ? 'text-[#ff7a7a]' : 'text-[#f2c94c]'}`}>
            {shown.boss ? 'КОЛОСС РАЗЛОМА' : `ВОЛНА ${shown.wave}`}
          </p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.25em] text-[#c3cbe0] sm:text-sm sm:tracking-[0.4em] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
            {shown.boss ? 'босс идёт к лагерю' : 'заражённые выходят из Разлома'}
          </p>
          {AI_SIGNALS[shown.wave - 1] && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mx-auto mt-3 max-w-md rounded-xl border border-[#59c27a66] bg-[rgba(14,19,31,0.9)] px-3 py-1.5 text-xs font-medium text-[#a6f095] shadow-lg"
            >
              <span className="text-[#59c27a]">▮ сигнал ИИ:</span> «{AI_SIGNALS[shown.wave - 1]}»
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
