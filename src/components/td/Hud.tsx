'use client'

// HUD «Железного Разлома» в латунном стимпанк-стиле.
// Верхняя полоса (поверх верхнего ряда клеток, куда тропа не заходит): ресурсы · волна · кнопки.
// Нижняя панель (под полем, не перекрывает его): Охотница · арсенал с картинками башен · ролл.
// Размер HUD масштабируется под экран (zoom из GameShell) — на 2K/4K он не мельчит.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import {
  Coins, Dices, Heart, Maximize2, Minimize2, Pause, Play, RotateCcw, Swords, Users, Zap, HelpCircle, Volume2, VolumeX, Cog,
  Lightbulb, LightbulbOff,
} from 'lucide-react'
import { ALL_DEFS, ARMOR_COLORS, ARMOR_NAMES, ATTACK_NAMES, AVATAR, TOWERS } from '@/game/config'
import { towerThumb } from '@/game/pixel'
import type { TowerDef, UiState } from '@/game/types'
import { ARMOR_ICONS, ATTACK_COLORS, Price, type MpRole, type MpStatus } from './Panels'

/** Латунная рамка: светлый кант, тёмная внутренняя фаска, тень */
export const BRASS =
  'pointer-events-auto rounded-md border-2 border-[#b08d57] bg-gradient-to-b from-[#2f2416] to-[#17110b] ' +
  'shadow-[inset_0_0_0_2px_#3d2f1c,inset_0_3px_0_rgba(232,193,112,0.25),0_6px_18px_rgba(0,0,0,0.6)]'
/** Та же рамка для панелей башни и слияния */
export const HUD_PANEL = BRASS

const slideDown = { initial: { y: -24, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -24, opacity: 0 } }
const slideUp = { initial: { y: 30, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 30, opacity: 0 } }

/** Латунная шестерня-заклёпка в углу рамки */
function CornerGear({ className }: { className: string }) {
  return (
    <span className={`pointer-events-none absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#b08d57] bg-[#2a2016] text-[#d4a85a] ${className}`}>
      <Cog className="h-4 w-4" />
    </span>
  )
}

// ─── Ресурсы: жизни, золото, волна ───────────────────────────────────────
export function ResourceBar({ ui }: { ui: UiState }) {
  const lives = useAnimationControls()
  const gold = useAnimationControls()
  const prevLives = useRef(ui.lives)
  const prevGold = useRef(ui.gold)
  useEffect(() => {
    if (ui.lives < prevLives.current) {
      lives.start({ x: [0, -5, 5, -3, 3, 0], color: ['#ffffff', '#e05252'], transition: { duration: 0.4 } })
    }
    prevLives.current = ui.lives
  }, [ui.lives, lives])
  useEffect(() => {
    if (ui.gold !== prevGold.current && !ui.infiniteGold) gold.start({ scale: [1, 1.25, 1], transition: { duration: 0.25 } })
    prevGold.current = ui.gold
  }, [ui.gold, ui.infiniteGold, gold])

  return (
    <motion.div {...slideDown} className={`${BRASS} flex h-11 items-center gap-3 px-3 font-mono text-sm font-bold tabular-nums`}>
      <motion.span animate={lives} className="flex items-center gap-1 text-[#e05252]" title="Жизни">
        <Heart className="h-4 w-4 fill-[#e05252]" /> {ui.lives}
      </motion.span>
      <span className="h-5 w-px bg-[#b08d5766]" />
      <motion.span animate={gold} className="flex items-center gap-1 text-[#ffd76a]" title="Золото">
        <Coins className="h-4 w-4" /> {ui.infiniteGold ? '∞' : ui.gold}
      </motion.span>
      <span className="h-5 w-px bg-[#b08d5766]" />
      <span className="flex items-center gap-1 text-[#e8dcc0]" title="Волна">
        <Swords className="h-4 w-4 text-[#b08d57]" /> {Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}
      </span>
      {ui.coop && (
        <span className="rounded border border-[#e05252aa] px-1.5 text-[10px] text-[#ff9a7a]" title="Кооп: HP волн ×1.85">
          КООП ×1.85
        </span>
      )}
    </motion.div>
  )
}

// ─── Волна: таймер до следующей или ход текущей ──────────────────────────
export function WaveWidget({ ui, onStart }: { ui: UiState; onStart: () => void }) {
  const inWave = ui.phase === 'wave'
  const left = Math.ceil(ui.previewRemaining)
  return (
    <motion.div {...slideDown} className={`${BRASS} flex h-11 min-w-0 items-center gap-2 px-3`}>
      <span className="shrink-0 font-serif text-sm font-black tracking-wide text-[#ffd76a]">Волна {ui.wave}</span>
      {inWave ? (
        <>
          <div className="h-2.5 w-32 shrink overflow-hidden rounded-sm border border-[#5a4424] bg-[#0f0b07]" title="Вышло из портала">
            <motion.div
              className="h-full bg-gradient-to-r from-[#b08d57] to-[#ffd700]"
              animate={{ width: `${(ui.waveSpawned / Math.max(1, ui.waveTotal)) * 100}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs text-[#e8dcc0]" title="Машин на поле">⚙ {ui.creepsAlive}</span>
        </>
      ) : (
        <>
          <span
            className="shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase"
            style={{ color: ARMOR_COLORS[ui.nextWaveArmor], borderColor: ARMOR_COLORS[ui.nextWaveArmor] + '66' }}
            title="Броня следующей волны"
          >
            {ARMOR_ICONS[ui.nextWaveArmor]} {ARMOR_NAMES[ui.nextWaveArmor]}
          </span>
          {ui.nextWaveIsBoss && <span className="shrink-0 text-[10px] font-bold text-[#e05252]">⚠ БОСС</span>}
          {ui.nextWaveIsMoney && <span className="shrink-0 text-[10px] font-bold text-[#7fd0a0]">💰 ×3</span>}
          <motion.span
            key={left}
            initial={{ scale: left <= 5 ? 1.4 : 1 }}
            animate={{ scale: 1 }}
            className={`w-8 shrink-0 text-right font-mono text-sm tabular-nums ${left <= 5 ? 'text-[#ffd700]' : 'text-[#e8dcc0]'}`}
          >
            {left}с
          </motion.span>
          <button
            onClick={onStart}
            className="flex h-7 shrink-0 items-center gap-1 rounded border border-[#d4a85a] bg-gradient-to-b from-[#5a4424] to-[#3a2e1c] px-2 text-xs font-bold text-[#ffd700] transition-colors hover:from-[#6a5430]"
            title="Начать волну сейчас"
          >
            <Play className="h-3 w-3" /> Начать
          </button>
        </>
      )}
    </motion.div>
  )
}

// ─── Кнопки: мелкие иконки в рамке + две большие круглые латунные ────────
function IconButton({
  onClick, title, active = false, disabled = false, children,
}: { onClick: () => void; title: string; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded border px-1.5 text-xs transition-colors disabled:opacity-40 ${
        active
          ? 'border-[#ffd700] bg-[#4a3a24] text-[#ffd700]'
          : 'border-[#8a6d3b88] bg-[#241b12] text-[#e8c170] hover:border-[#e8c170] hover:text-[#ffd700]'
      }`}
    >
      {children}
    </motion.button>
  )
}

/** Большая круглая латунная кнопка с зубчатым ободом */
function RoundBrass({ onClick, title, active, disabled, children }: {
  onClick: () => void; title: string; active?: boolean; disabled?: boolean; children: React.ReactNode
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { rotate: 8 }}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] font-mono text-sm font-black shadow-[0_4px_10px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,230,160,0.35)] disabled:opacity-40 ${
        active ? 'border-[#ffd700] bg-[#6a5430] text-[#ffe9a0]' : 'border-[#b08d57] bg-gradient-to-b from-[#5a4424] to-[#2a2016] text-[#ffd76a]'
      }`}
      // зубчатый обод — пунктирное кольцо вокруг
      style={{ outline: '2px dashed #7d5a2c', outlineOffset: 1 }}
    >
      {children}
    </motion.button>
  )
}

export function ControlBar({
  ui, skin, fullscreen, muted, lighting, role, mpStatus,
  onSpeed, onPause, onInvite, onInfiniteGold, onSkin, onMute, onLighting, onHelp, onRestart, onFullscreen,
}: {
  ui: UiState
  skin: 'steam' | 'lol'
  fullscreen: boolean
  muted: boolean
  lighting: boolean
  onLighting: () => void
  role: MpRole
  mpStatus: MpStatus
  onSpeed: () => void
  onPause: () => void
  onInvite?: () => void
  onInfiniteGold: () => void
  onSkin: () => void
  onMute: () => void
  onHelp: () => void
  onRestart: () => void
  onFullscreen: () => void
}) {
  const playing = ui.phase === 'preview' || ui.phase === 'wave'
  return (
    <motion.div {...slideDown} className="flex items-center gap-2">
      <div className={`${BRASS} flex h-11 items-center gap-1 px-1.5`}>
        {role !== 'single' && (
          <span
            className={`flex h-8 items-center gap-1 rounded border px-1.5 font-mono text-[10px] ${
              mpStatus === 'linked' ? 'border-[#7fd0a088] text-[#7fd0a0]' : 'border-[#8a6d3b66] text-[#b08d57]'
            }`}
            title={mpStatus === 'linked' ? 'Оба игрока на связи' : 'Второй игрок не подключился'}
          >
            <Users className="h-3 w-3" /> {mpStatus === 'linked' ? '2/2' : '1/2'}
          </span>
        )}
        {role === 'host' && onInvite && (
          <IconButton onClick={onInvite} title="Пригласить друга">
            <Users className="h-3.5 w-3.5" />
          </IconButton>
        )}
        <IconButton onClick={onLighting} title={lighting ? 'Выключить свет и тени (для слабых устройств)' : 'Включить свет и тени'} active={lighting}>
          {lighting ? <Lightbulb className="h-3.5 w-3.5" /> : <LightbulbOff className="h-3.5 w-3.5" />}
        </IconButton>
        <IconButton onClick={onMute} title={muted ? 'Включить звук' : 'Выключить звук'} active={!muted}>
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </IconButton>
        <IconButton
          onClick={onInfiniteGold}
          title={ui.infiniteGold ? 'Выключить бесконечное золото (вернётся прежнее)' : 'Бесконечное золото — для тестов'}
          active={ui.infiniteGold}
        >
          <Coins className="h-3.5 w-3.5" />∞
        </IconButton>
        <IconButton onClick={onSkin} title={skin === 'lol' ? 'Вернуть стимпанк-башни' : 'Шуточный скин башен'} active={skin === 'lol'}>
          🍆
        </IconButton>
        <IconButton onClick={onHelp} title="Как играть и книга слияний">
          <HelpCircle className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton onClick={onRestart} title="Начать заново (новая карта)">
          <RotateCcw className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton onClick={onFullscreen} title={fullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'} active={fullscreen}>
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </IconButton>
      </div>
      <RoundBrass onClick={onSpeed} title="Скорость игры" active={ui.speed > 1}>
        ×{ui.speed}
      </RoundBrass>
      <RoundBrass onClick={onPause} title={ui.paused ? 'Продолжить (P)' : 'Пауза (P)'} active={ui.paused} disabled={!playing}>
        {ui.paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5 fill-current" />}
      </RoundBrass>
    </motion.div>
  )
}

// ─── Нижняя панель: Охотница · арсенал · ролл ────────────────────────────
export function BottomPanel({
  ui, role, armed, onAbility, onPick, onRoll,
}: {
  ui: UiState
  role: MpRole
  armed: string | null
  onAbility: () => void
  onPick: (defId: string, e: React.PointerEvent) => void
  onRoll: () => void
}) {
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  const pool = ui.shop.map((id) => ALL_DEFS[id]).filter((d): d is TowerDef => !!d && !d.merged)
  // картинки башен рисуются на холсте (кэш в pixel.ts). На сервере пул всегда пуст — арсенал выпадает
  // только при старте игры в браузере, поэтому document здесь уже есть и гидратация не расходится
  const thumb = (t: TowerDef) => (typeof document === 'undefined' ? '' : towerThumb(t))
  const [spin, setSpin] = useState(0)
  const canRoll = ui.gold >= ui.rollCost && canBuild

  const cd = ui.avatar.cooldown
  const ready = cd <= 0 && role !== 'guest' && canBuild
  const xpNext = ui.avatar.xpNext
  const xpPrev = xpNext ? [0, 3, 7, 12, 18, 25, 33, 42, 52][ui.avatar.level - 1] ?? 0 : 0
  const xpFrac = xpNext ? Math.min(1, (ui.avatar.xp - xpPrev) / (xpNext - xpPrev)) : 1
  const cdFrac = Math.min(1, cd / AVATAR.abilityCd)

  return (
    <motion.div {...slideUp} className={`${BRASS} relative flex flex-wrap items-stretch justify-center gap-3 px-6 pb-2 pt-4 lg:flex-nowrap`}>
      <CornerGear className="-left-2 -top-2" />
      <CornerGear className="-right-2 -top-2" />
      <CornerGear className="-bottom-2 -left-2" />
      <CornerGear className="-bottom-2 -right-2" />
      {/* табличка-заголовок на верхней кромке */}
      <span className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 rounded border-2 border-[#b08d57] bg-gradient-to-b from-[#4a3a24] to-[#241b12] px-4 py-0.5 font-serif text-xs font-black tracking-[0.3em] text-[#ffd76a] shadow-md">
        АРСЕНАЛ
      </span>

      {/* Охотница */}
      <div className="flex shrink-0 items-center gap-2 rounded border-2 border-[#5a4424] bg-[#120e09]/70 p-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-[#7fd0a0] bg-[#1f2d24] text-2xl">🏹</div>
        <div className="w-28">
          <p className="font-serif text-sm font-black text-[#7fd0a0]">{AVATAR.name}</p>
          <p className="font-mono text-[10px] text-[#b08d57]">уровень {ui.avatar.level}/10</p>
          <div className="mt-1 h-2 overflow-hidden rounded-sm border border-[#2a3a2e] bg-[#0f0b07]" title={xpNext ? `Опыт ${ui.avatar.xp}/${xpNext}` : 'Максимум'}>
            <motion.div className="h-full bg-[#7fd0a0]" animate={{ width: `${xpFrac * 100}%` }} />
          </div>
          <p className="mt-1 text-[9px] leading-tight text-[#8a6d3b]">клик по земле — идти</p>
        </div>
        <motion.button
          onClick={onAbility}
          disabled={!ready}
          whileTap={ready ? { scale: 0.9 } : undefined}
          animate={ready ? { boxShadow: ['0 0 0px #ffd70000', '0 0 16px #ffd700cc', '0 0 0px #ffd70000'] } : { boxShadow: '0 0 0px #ffd70000' }}
          transition={ready ? { duration: 1.6, repeat: Infinity } : undefined}
          className="relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[#b08d57] text-[#ffd700] disabled:text-[#8a6d3b]"
          // кольцо перезарядки — тёмный сектор тает по мере готовности
          style={{ background: `conic-gradient(#120e09 ${cdFrac * 360}deg, #4a3a24 0deg)` }}
          title={role === 'guest' ? 'Способностью управляет хост' : `${AVATAR.abilityName}: ${AVATAR.abilityDesc}`}
        >
          <Zap className="h-6 w-6" />
          <span className="font-mono text-[9px] leading-none">{cd > 0 ? Math.ceil(cd) : 'метка'}</span>
        </motion.button>
      </div>

      {/* карточки башен */}
      <div className="flex flex-wrap justify-center gap-2 lg:flex-nowrap">
        <AnimatePresence mode="popLayout" initial={false}>
          {pool.map((t, i) => {
            const affordable = ui.gold >= t.price
            const usable = canBuild && affordable
            const picked = armed === t.id
            return (
              <motion.button
                key={ui.shop.join() + t.id}
                layout
                initial={{ y: 26, opacity: 0, rotate: -5 }}
                animate={{ y: picked ? -6 : 0, opacity: usable ? 1 : 0.45, rotate: 0 }}
                exit={{ y: -18, opacity: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 26 }}
                whileHover={usable ? { y: -5 } : undefined}
                type="button"
                disabled={!usable}
                onPointerDown={(e) => usable && onPick(t.id, e)}
                style={{ touchAction: 'none' }}
                className={`flex w-[116px] shrink-0 flex-col overflow-hidden rounded border-2 bg-gradient-to-b from-[#2a2016] to-[#120e09] ${
                  picked ? 'border-[#ffd700] shadow-[0_0_14px_#ffd70088]' : usable ? 'cursor-grab border-[#8a6d3b] hover:border-[#e8c170]' : 'cursor-not-allowed border-[#5a4424]'
                }`}
                title={`${t.name} — ${t.role}. ${ATTACK_NAMES[t.attack]} атака, радиус ${t.range}. Перетащите на клетку или нажмите и выберите клетку`}
              >
                <span className="relative flex h-[60px] items-end justify-center border-b-2 border-[#5a4424] bg-[radial-gradient(circle_at_50%_70%,#3a2e1c,#120e09)]">
                  {thumb(t) && (
                    <img src={thumb(t)} alt="" className="mb-0.5 h-[54px] w-[44px]" style={{ imageRendering: 'pixelated' }} draggable={false} />
                  )}
                  <span className="absolute left-1 top-1 text-sm leading-none">{t.glyph}</span>
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: ATTACK_COLORS[t.attack] }} title={ATTACK_NAMES[t.attack]} />
                </span>
                <span className="flex flex-col items-center px-1 py-0.5">
                  <span className="w-full truncate text-center font-serif text-[11px] font-bold leading-tight text-[#ffd76a]">{t.name}</span>
                  <Price value={t.price} ok={affordable} className="text-[11px]" />
                </span>
              </motion.button>
            )
          })}
        </AnimatePresence>
        {pool.length === 0 && <span className="self-center px-4 text-xs text-[#8a6d3b]">Арсенал выпадет с началом игры</span>}
      </div>

      {/* ролл */}
      <motion.button
        whileTap={canRoll ? { scale: 0.92 } : undefined}
        disabled={!canRoll}
        onClick={() => {
          setSpin((s) => s + 1)
          onRoll()
        }}
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded border-2 border-[#b08d57] bg-gradient-to-b from-[#5a4424] to-[#241b12] text-[#ffd700] hover:from-[#6a5430] disabled:opacity-40"
        title={`Ролл арсенала: ${pool.length} новых башен из ${TOWERS.length}`}
      >
        <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.45 }}>
          <Dices className="h-8 w-8" />
        </motion.span>
        <span className="font-serif text-xs font-black tracking-wider">РОЛЛ</span>
        <Price value={ui.rollCost} ok={ui.gold >= ui.rollCost} className="text-xs" />
      </motion.button>
    </motion.div>
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
      const t = setTimeout(() => setShown(null), 1600)
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
          <p className={`font-serif text-5xl font-black tracking-[0.2em] drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] ${shown.boss ? 'text-[#ff5a3c]' : 'text-[#ffd700]'}`}>
            {shown.boss ? 'ТИТАН-ИИ' : `ВОЛНА ${shown.wave}`}
          </p>
          <p className="mt-1 font-mono text-sm uppercase tracking-[0.4em] text-[#e8c170] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
            {shown.boss ? 'босс идёт по тракту' : 'машины выходят из Разлома'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Уведомления сверху по центру: пауза, выбранная для постройки башня ───
export function CenterNotices({ paused, armedName }: { paused: boolean; armedName: string | null }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
        {paused && (
          <motion.span
            key="pause"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="rounded border-2 border-[#d4a85a] bg-gradient-to-b from-[#3a2e1c] to-[#1a140e] px-5 py-1 font-serif text-lg font-black tracking-[0.35em] text-[#ffd700] shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          >
            ПАУЗА
          </motion.span>
        )}
        {armedName && (
          <motion.span key="armed" {...slideDown} className="rounded border border-[#e8c170] bg-[#1a140e]/90 px-3 py-1 text-center text-xs text-[#e8c170] shadow-lg">
            {armedName}: нажмите на клетку · Esc или правая кнопка — отмена
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
