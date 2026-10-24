'use client'

// HUD «Последнего горизонта»: один набор компонентов для телефона (ландшафт) и компьютера.
// Верх: ресурсы · волна (или что строим) · скорость, пауза, меню. Низ: герой и способность · арсенал
// (прокручиваемый ряд карточек + закреплённый ролл) · «Начать». Раскладку задаёт GameShell.
// Стиль: Rubik, панели rgba(14,19,31,.9) с рамкой #3a4660, золото #f2c94c, линейные иконки.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { AI_SIGNALS, ALL_DEFS, ARMOR_COLORS, ARMOR_NAMES, AVATARS, TOWERS } from '@/game/config'
import { avatarPortrait, towerThumb } from '@/game/pixel'
import type { AttackType, TowerDef, UiState } from '@/game/types'
import type { MpRole, MpStatus } from './Panels'
import { DAMAGE_TYPE, TOWER_CARD_W, TowerInfoCard } from './TowerInfo'
import {
  BoltIcon, CheckIcon, CloseIcon, CoinIcon, DiceIcon, ExitFullscreenIcon, FullscreenIcon, HeartIcon, HelpIcon, InfinityIcon,
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
  const lives = useAnimationControls()
  const gold = useAnimationControls()
  const prevLives = useRef(ui.lives)
  const prevGold = useRef(ui.gold)
  useEffect(() => {
    if (ui.lives < prevLives.current) lives.start({ x: [0, -5, 5, -3, 3, 0], transition: { duration: 0.4 } })
    prevLives.current = ui.lives
  }, [ui.lives, lives])
  useEffect(() => {
    if (ui.gold !== prevGold.current && !ui.infiniteGold) gold.start({ scale: [1, 1.2, 1], transition: { duration: 0.25 } })
    prevGold.current = ui.gold
  }, [ui.gold, ui.infiniteGold, gold])

  return (
    <motion.div {...slideDown} className={`${PILL} flex h-11 items-center gap-4 rounded-full px-4 text-[15px] font-bold leading-none`}>
      <motion.span animate={lives} className="flex items-center gap-1.5 text-[#ff7a7a]" title="Жизни">
        <HeartIcon size={18} /> {ui.lives}
      </motion.span>
      <motion.span animate={gold} className="flex items-center gap-1.5 text-[#f2c94c]" title="Золото">
        <CoinIcon size={18} /> {ui.infiniteGold ? '∞' : ui.gold}
      </motion.span>
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
    else tag = <Tag color={ARMOR_COLORS[ui.nextWaveArmor]} title="Броня следующей волны">{ARMOR_NAMES[ui.nextWaveArmor]}</Tag>
  }
  return (
    <motion.div {...slideDown} className={`${PILL} flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full pl-4 pr-3 text-[15px] font-bold leading-none text-[#f4ead2]`}>
      <span>{title}</span>
      {tag}
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
  onLighting: () => void
  onMute: () => void
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
      <div className={stacked ? 'order-last flex w-full justify-center' : 'flex justify-center'}>
        <WaveChip ui={ui} build={build} />
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
export function CenterNotices({ paused }: { paused: boolean }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
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
    <div className="pointer-events-auto flex gap-3">
      <div className="flex w-16 flex-col items-center gap-1" title={`${AVATAR.name}: ${AVATAR.role}. Пассивно: ${AVATAR.passive}`}>
        <div
          className="h-14 w-14 overflow-hidden rounded-full border-2 border-[#59c27a] bg-[rgba(14,19,31,0.9)]"
          role="img"
          aria-label={AVATAR.name}
        >
              <img src={avatarPortrait(AVATAR.id, 3)} alt="" className="h-full w-full object-cover object-top" style={{ imageRendering: 'pixelated' }} draggable={false} />
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
  return (
    <motion.button
      type="button"
      onClick={onStart}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label={`Начать волну, авто через ${left} секунд`}
      className="pointer-events-auto flex h-11 items-center gap-2 whitespace-nowrap rounded-full border-0 bg-[#f2c94c] pl-3.5 pr-[18px] text-[15px] font-bold leading-none text-[#1a1408] active:scale-95"
    >
      <PlayIcon stroke="#1a1408" />
      <span>Начать · {left}с</span>
    </motion.button>
  )
}

// ─── Арсенал: прокручиваемый ряд карточек + закреплённый ролл ─────────────
const CARD = {
  sm: { w: 64, h: 76, iw: 56, ih: 44, name: false },
  lg: { w: 92, h: 118, iw: 80, ih: 64, name: true },
} as const

export function Arsenal({
  ui, armed, onPick, onRoll, size = 'sm', rowWidth, fill = false, info = true,
}: {
  ui: UiState
  armed: string | null
  onPick: (defId: string) => void
  onRoll: () => void
  size?: 'sm' | 'lg'
  /** ширина ряда; по умолчанию для sm — 3,5 карточки */
  rowWidth?: number | string
  /** на всю ширину (портрет телефона) */
  fill?: boolean
  /** карточка с подробностями при наведении мыши (на телефоне не нужна) */
  info?: boolean
}) {
  const c = CARD[size]
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  const pool = ui.shop.map((id) => ALL_DEFS[id]).filter((d): d is TowerDef => !!d && !d.merged)
  const thumb = (t: TowerDef) => (typeof document === 'undefined' ? '' : towerThumb(t))
  const canRoll = ui.gold >= ui.rollCost && canBuild
  const [spin, setSpin] = useState(0)

  // прокрутка: края затухают, пока в ту сторону ещё есть башни
  const vp = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })
  const [dragging, setDragging] = useState(false)
  const down = useRef<{ x: number; left: number; mouse: boolean } | null>(null)
  const moved = useRef(false)
  const measure = () => {
    const el = vp.current
    if (!el) return
    const start = el.scrollLeft <= 2
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
    setEdge((e) => (e.start === start && e.end === end ? e : { start, end }))
  }
  useEffect(measure, [pool.length, size])
  useEffect(() => {
    const el = vp.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // колесо мыши по вертикали листает ряд вбок; слушатель не пассивный, чтобы страница не дёргалась
  useEffect(() => {
    const el = vp.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false
    down.current = { x: e.clientX, left: vp.current?.scrollLeft ?? 0, mouse: e.pointerType === 'mouse' }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = down.current
    if (!d || !vp.current) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 4) moved.current = true // сдвиг больше ~4 px — это прокрутка, а не тап
    if (d.mouse && moved.current) {
      if (!dragging) setDragging(true)
      vp.current.scrollLeft = d.left - dx
    }
  }
  const onPointerUp = () => {
    down.current = null
    if (dragging) setDragging(false)
  }

  const fadeL = edge.start ? '#000 0' : 'transparent 0, #000 18px'
  const fadeR = edge.end ? '#000 100%' : '#000 calc(100% - 28px), transparent 100%'
  const mask = `linear-gradient(to right, ${fadeL}, ${fadeR})`

  // подсказка над карточкой для мыши (на пальцах её заменяет плашка с названием вверху)
  const rootRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ id: string; left: number } | null>(null)
  const showHover = (id: string, card: HTMLElement) => {
    const root = rootRef.current
    if (!root) return
    const rr = root.getBoundingClientRect(), cr = card.getBoundingClientRect()
    const k = rr.width / (root.offsetWidth || 1) || 1
    const cx = (cr.left + cr.width / 2 - rr.left) / k
    const lo = (8 - rr.left) / k, hi = (window.innerWidth - 8 - rr.left) / k - TOWER_CARD_W
    setHover({ id, left: Math.max(lo, Math.min(hi, cx - TOWER_CARD_W / 2)) })
  }

  return (
    <div ref={rootRef} className={`${PILL} relative flex items-center gap-1.5 rounded-[18px] p-1.5 ${fill ? 'w-full' : ''}`} style={{ maxWidth: '100%' }}>
      <div
        ref={vp}
        role="group"
        aria-label="Арсенал, листается вбок"
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`flex min-w-0 gap-1.5 overflow-x-auto overflow-y-hidden ${fill ? 'flex-1' : ''} [&::-webkit-scrollbar]:hidden`}
        style={{
          width: rowWidth ?? (size === 'sm' ? 246 : undefined),
          height: c.h,
          overscrollBehaviorX: 'contain',
          touchAction: 'pan-x',
          scrollSnapType: dragging ? 'none' : 'x mandatory',
          scrollbarWidth: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      >
        {pool.map((t) => {
          const affordable = ui.gold >= t.price
          const locked = !affordable || !canBuild
          const on = armed === t.id
          return (
            <button
              key={ui.shop.join() + t.id}
              type="button"
              aria-pressed={on}
              aria-label={`${t.name}, ${DAMAGE_TYPE[t.attack].name.toLowerCase()}, цена ${t.price}${affordable ? '' : ', не хватает золота'}`}
              onClick={() => {
                if (moved.current || locked) return
                setHover(null)
                onPick(t.id)
              }}
              onPointerEnter={(e) => info && e.pointerType === 'mouse' && showHover(t.id, e.currentTarget)}
              onPointerLeave={() => setHover((h) => (h?.id === t.id ? null : h))}
              className={`relative flex shrink-0 grow-0 snap-start flex-col items-center justify-between rounded-xl pb-1.5 pt-1 ${
                on ? 'border-2 border-[#f2c94c] bg-[#2b3550]' : 'border border-[#3a4660] bg-[#1f2638]'
              } ${locked ? 'opacity-50' : ''}`}
              style={{ flexBasis: c.w, width: c.w, height: c.h, boxSizing: 'border-box' }}
            >
              <span className="absolute left-[5px] top-[5px] h-2 w-2 rounded-full" style={{ background: DMG_COLORS[t.attack] }} />
                  <img
                src={thumb(t) || undefined}
                alt=""
                draggable={false}
                className="pointer-events-none block object-contain"
                style={{ width: c.iw, height: c.ih, imageRendering: 'pixelated' }}
              />
              {c.name && <span className="w-full truncate px-1 text-center text-[11px] font-bold leading-tight text-[#c3cbe0]">{t.name}</span>}
              <span className={`text-[13px] font-bold leading-4 ${affordable ? 'text-[#f2c94c]' : 'text-[#ff8a8a]'}`}>{t.price}</span>
            </button>
          )
        })}
        {pool.length === 0 && <span className="self-center px-3 text-xs text-[#c3cbe0]">Арсенал выпадет с началом игры</span>}
      </div>

      {/* карточка башни под мышью — вне прокручиваемого ряда, чтобы он её не обрезал */}
      <AnimatePresence>
        {hover && ALL_DEFS[hover.id] && (
          <div key={hover.id} className="pointer-events-none absolute z-50" style={{ left: hover.left, bottom: '100%', marginBottom: 12 }}>
            <TowerInfoCard def={ALL_DEFS[hover.id]} affordable={ui.gold >= ALL_DEFS[hover.id].price} thumb={thumb(ALL_DEFS[hover.id] as TowerDef)} />
          </div>
        )}
      </AnimatePresence>

      <div className="h-14 w-px shrink-0 bg-[#3a4660]" style={{ height: c.h - 20 }} />
      <button
        type="button"
        disabled={!canRoll}
        onClick={() => {
          setSpin((s) => s + 1)
          onRoll()
        }}
        aria-label={`Ролл: обновить арсенал за ${ui.rollCost}`}
        title={`Ролл арсенала: ${pool.length} новых башен из ${TOWERS.length}`}
        className="flex shrink-0 flex-col items-center justify-between rounded-xl border border-[#3a4660] bg-[#1f2638] pb-1.5 pt-1 disabled:opacity-50"
        style={{ flexBasis: c.w, width: c.w, height: c.h, boxSizing: 'border-box' }}
      >
        <span className="flex items-center justify-center text-[#f2c94c]" style={{ width: c.iw, height: c.ih }}>
          <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.45 }} className="flex">
            <DiceIcon size={size === 'sm' ? 26 : 34} />
          </motion.span>
        </span>
        {c.name && <span className="text-[11px] font-bold leading-tight text-[#c3cbe0]">Ролл</span>}
        <span className={`text-[13px] font-bold leading-4 ${ui.gold >= ui.rollCost ? 'text-[#f2c94c]' : 'text-[#ff8a8a]'}`}>{ui.rollCost}</span>
      </button>
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
