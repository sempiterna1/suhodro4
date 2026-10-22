'use client'

// HUD «Железного Разлома» в стиле зимнего стимпанка: тёмная сталь, холодный кант, тёплые огни.
// Верхняя полоса (поверх верхнего ряда клеток, куда тропа не заходит): ресурсы · волна · кнопки.
// Нижняя панель (под полем, не перекрывает его): Охотница · арсенал с картинками башен · ролл.
// Размер HUD масштабируется под экран (zoom из GameShell) — на 2K/4K он не мельчит.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import {
  Coins, Dices, Heart, Maximize2, Minimize2, Pause, Play, RotateCcw, Swords, Users, Zap, HelpCircle, Volume2, VolumeX, Cog,
  Lightbulb, LightbulbOff,
} from 'lucide-react'
import { AI_SIGNALS, ALL_DEFS, ARMOR_COLORS, ARMOR_NAMES, ATTACK_NAMES, AVATAR, TOWERS } from '@/game/config'
import { towerThumb } from '@/game/pixel'
import type { TowerDef, UiState } from '@/game/types'
import { ARMOR_ICONS, ATTACK_COLORS, Price, type MpRole, type MpStatus } from './Panels'

/** Стальная рамка: светлый кант, тёмная внутренняя фаска, тень */
export const BRASS =
  'pointer-events-auto rounded-md border-2 border-[#7088a8] bg-gradient-to-b from-[#1b2433] to-[#0c111a] ' +
  'shadow-[inset_0_0_0_2px_#2a3548,inset_0_3px_0_rgba(240,176,96,0.25),0_6px_18px_rgba(0,0,0,0.6)]'
/** Та же рамка для панелей башни и слияния */
export const HUD_PANEL = BRASS

const slideDown = { initial: { y: -24, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -24, opacity: 0 } }
const slideUp = { initial: { y: 30, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 30, opacity: 0 } }

/** Стальная шестерня-заклёпка в углу рамки */
function CornerGear({ className }: { className: string }) {
  return (
    <span className={`pointer-events-none absolute flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#7088a8] bg-[#172030] text-[#93a9c6] ${className}`}>
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
      <span className="h-5 w-px bg-[#7088a866]" />
      <motion.span animate={gold} className="flex items-center gap-1 text-[#ffc46b]" title="Золото">
        <Coins className="h-4 w-4" /> {ui.infiniteGold ? '∞' : ui.gold}
      </motion.span>
      <span className="h-5 w-px bg-[#7088a866]" />
      <span className="flex items-center gap-1 text-[#dde6f0]" title="Волна">
        <Swords className="h-4 w-4 text-[#7088a8]" /> {Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}
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
      <span className="shrink-0 font-serif text-sm font-black tracking-wide text-[#ffc46b]">Волна {ui.wave}</span>
      {inWave ? (
        <>
          <div className="h-2.5 w-32 shrink overflow-hidden rounded-sm border border-[#2e3c52] bg-[#080c13]" title="Вышло из портала">
            <motion.div
              className="h-full bg-gradient-to-r from-[#7088a8] to-[#ffd700]"
              animate={{ width: `${(ui.waveSpawned / Math.max(1, ui.waveTotal)) * 100}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs text-[#dde6f0]" title="Заражённых на поле">☣ {ui.creepsAlive}</span>
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
            className={`w-8 shrink-0 text-right font-mono text-sm tabular-nums ${left <= 5 ? 'text-[#ffd700]' : 'text-[#dde6f0]'}`}
          >
            {left}с
          </motion.span>
          <button
            onClick={onStart}
            className="flex h-7 shrink-0 items-center gap-1 rounded border border-[#93a9c6] bg-gradient-to-b from-[#2e3c52] to-[#1f2a3b] px-2 text-xs font-bold text-[#ffd700] transition-colors hover:from-[#34475f]"
            title="Начать волну сейчас"
          >
            <Play className="h-3 w-3" /> Начать
          </button>
        </>
      )}
    </motion.div>
  )
}

// ─── Кнопки: мелкие иконки в рамке + две большие круглые стальные ────────
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
          ? 'border-[#ffd700] bg-[#26344a] text-[#ffd700]'
          : 'border-[#5b6f8c88] bg-[#141b27] text-[#f0b060] hover:border-[#f0b060] hover:text-[#ffd700]'
      }`}
    >
      {children}
    </motion.button>
  )
}

/** Большая круглая стальная кнопка с зубчатым ободом */
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
        active ? 'border-[#ffd700] bg-[#34475f] text-[#ffe9a0]' : 'border-[#7088a8] bg-gradient-to-b from-[#2e3c52] to-[#172030] text-[#ffc46b]'
      }`}
      // зубчатый обод — пунктирное кольцо вокруг
      style={{ outline: '2px dashed #3e5070', outlineOffset: 1 }}
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
              mpStatus === 'linked' ? 'border-[#7fd0a088] text-[#7fd0a0]' : 'border-[#5b6f8c66] text-[#7088a8]'
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
      <span className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 rounded border-2 border-[#7088a8] bg-gradient-to-b from-[#26344a] to-[#141b27] px-4 py-0.5 font-serif text-xs font-black tracking-[0.3em] text-[#ffc46b] shadow-md">
        АРСЕНАЛ
      </span>

      {/* Охотница */}
      <div className="flex shrink-0 items-center gap-2 rounded border-2 border-[#2e3c52] bg-[#0a0f17]/70 p-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border-2 border-[#7fd0a0] bg-[#1f2d24] text-2xl">🏹</div>
        <div className="w-28">
          <p className="font-serif text-sm font-black text-[#7fd0a0]">{AVATAR.name}</p>
          <p className="font-mono text-[10px] text-[#7088a8]">уровень {ui.avatar.level}/10</p>
          <div className="mt-1 h-2 overflow-hidden rounded-sm border border-[#2a3a2e] bg-[#080c13]" title={xpNext ? `Опыт ${ui.avatar.xp}/${xpNext}` : 'Максимум'}>
            <motion.div className="h-full bg-[#7fd0a0]" animate={{ width: `${xpFrac * 100}%` }} />
          </div>
          <p className="mt-1 text-[9px] leading-tight text-[#5b6f8c]">клик по земле — идти</p>
        </div>
        <motion.button
          onClick={onAbility}
          disabled={!ready}
          whileTap={ready ? { scale: 0.9 } : undefined}
          animate={ready ? { boxShadow: ['0 0 0px #ffd70000', '0 0 16px #ffd700cc', '0 0 0px #ffd70000'] } : { boxShadow: '0 0 0px #ffd70000' }}
          transition={ready ? { duration: 1.6, repeat: Infinity } : undefined}
          className="relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[#7088a8] text-[#ffd700] disabled:text-[#5b6f8c]"
          // кольцо перезарядки — тёмный сектор тает по мере готовности
          style={{ background: `conic-gradient(#0a0f17 ${cdFrac * 360}deg, #26344a 0deg)` }}
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
                className={`flex w-[116px] shrink-0 flex-col overflow-hidden rounded border-2 bg-gradient-to-b from-[#172030] to-[#0a0f17] ${
                  picked ? 'border-[#ffd700] shadow-[0_0_14px_#ffd70088]' : usable ? 'cursor-grab border-[#5b6f8c] hover:border-[#f0b060]' : 'cursor-not-allowed border-[#2e3c52]'
                }`}
                title={`${t.name} — ${t.role}. ${ATTACK_NAMES[t.attack]} атака, радиус ${t.range}. Перетащите на клетку или нажмите и выберите клетку`}
              >
                <span className="relative flex h-[60px] items-end justify-center border-b-2 border-[#2e3c52] bg-[radial-gradient(circle_at_50%_70%,#1f2a3b,#0a0f17)]">
                  {thumb(t) && (
                    <img src={thumb(t)} alt="" className="mb-0.5 h-[56px] w-auto max-w-[60px] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" draggable={false} />
                  )}
                  <span className="absolute left-1 top-1 text-sm leading-none">{t.glyph}</span>
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: ATTACK_COLORS[t.attack] }} title={ATTACK_NAMES[t.attack]} />
                </span>
                <span className="flex flex-col items-center px-1 py-0.5">
                  <span className="w-full truncate text-center font-serif text-[11px] font-bold leading-tight text-[#ffc46b]">{t.name}</span>
                  <Price value={t.price} ok={affordable} className="text-[11px]" />
                </span>
              </motion.button>
            )
          })}
        </AnimatePresence>
        {pool.length === 0 && <span className="self-center px-4 text-xs text-[#5b6f8c]">Арсенал выпадет с началом игры</span>}
      </div>

      {/* ролл */}
      <motion.button
        whileTap={canRoll ? { scale: 0.92 } : undefined}
        disabled={!canRoll}
        onClick={() => {
          setSpin((s) => s + 1)
          onRoll()
        }}
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded border-2 border-[#7088a8] bg-gradient-to-b from-[#2e3c52] to-[#141b27] text-[#ffd700] hover:from-[#34475f] disabled:opacity-40"
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
          <p className={`font-serif text-3xl font-black tracking-[0.12em] sm:text-5xl sm:tracking-[0.2em] drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] ${shown.boss ? 'text-[#ff5a3c]' : 'text-[#ffd700]'}`}>
            {shown.boss ? 'КОЛОСС РАЗЛОМА' : `ВОЛНА ${shown.wave}`}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.25em] text-[#f0b060] sm:text-sm sm:tracking-[0.4em] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">
            {shown.boss ? 'босс идёт к лагерю' : 'заражённые выходят из Разлома'}
          </p>
          {AI_SIGNALS[shown.wave - 1] && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mx-auto mt-3 max-w-md rounded border border-[#5fd06a55] bg-[#070d0acc] px-3 py-1.5 font-mono text-xs text-[#a6f095] shadow-lg"
            >
              <span className="text-[#5fd06a]">▮ сигнал ИИ:</span> «{AI_SIGNALS[shown.wave - 1]}»
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Уведомления сверху по центру: пауза, выбранная для постройки башня ───
export function CenterNotices({ paused, armedName, touch = false }: { paused: boolean; armedName: string | null; touch?: boolean }) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-2">
      <AnimatePresence>
        {paused && (
          <motion.span
            key="pause"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="rounded border-2 border-[#93a9c6] bg-gradient-to-b from-[#1f2a3b] to-[#0f151f] px-5 py-1 font-serif text-lg font-black tracking-[0.35em] text-[#ffd700] shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
          >
            ПАУЗА
          </motion.span>
        )}
        {armedName && (
          <motion.span key="armed" {...slideDown} className="rounded border border-[#f0b060] bg-[#0f151f]/90 px-3 py-1 text-center text-xs text-[#f0b060] shadow-lg">
            {armedName}: {touch ? 'коснитесь клетки · карточка ещё раз — отмена' : 'нажмите на клетку · Esc или правая кнопка — отмена'}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Телефон ─────────────────────────────────────────────────────────────
// Поле во весь экран; сверху одна тонкая полоса, редкие кнопки — в меню; внизу лента арсенала;
// способность Охотницы — круглая кнопка над полем.

/** Круглая кнопка способности Охотницы: кольцо перезарядки, уровень на значке */
export function AbilityButton({ ui, role, onAbility, size = 56 }: { ui: UiState; role: MpRole; onAbility: () => void; size?: number }) {
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  const cd = ui.avatar.cooldown
  const ready = cd <= 0 && role !== 'guest' && canBuild
  const cdFrac = Math.min(1, cd / AVATAR.abilityCd)
  return (
    <motion.button
      onClick={onAbility}
      disabled={!ready}
      whileTap={ready ? { scale: 0.9 } : undefined}
      animate={ready ? { boxShadow: ['0 0 0px #ffd70000', '0 0 16px #ffd700cc', '0 0 0px #ffd70000'] } : { boxShadow: '0 0 0px #ffd70000' }}
      transition={ready ? { duration: 1.6, repeat: Infinity } : undefined}
      className="relative flex shrink-0 flex-col items-center justify-center rounded-full border-[3px] border-[#7088a8] text-[#ffd700] disabled:text-[#5b6f8c]"
      style={{ width: size, height: size, background: `conic-gradient(#0a0f17 ${cdFrac * 360}deg, #26344a 0deg)` }}
      title={role === 'guest' ? 'Способностью управляет хост' : `${AVATAR.abilityName}: ${AVATAR.abilityDesc}`}
    >
      <Zap className="h-6 w-6" />
      <span className="font-mono text-[9px] leading-none">{cd > 0 ? Math.ceil(cd) : 'метка'}</span>
      <span className="absolute -right-1 -top-1 rounded-full border border-[#7fd0a0] bg-[#1f2d24] px-1 font-mono text-[9px] font-bold text-[#7fd0a0]">
        {ui.avatar.level}
      </span>
    </motion.button>
  )
}

/** Тонкая верхняя полоса телефона: ресурсы · волна с кнопкой старта · скорость · пауза · меню */
export function MobileTopBar({
  ui, onStart, onSpeed, onPause, onMenu, menuOpen,
}: { ui: UiState; onStart: () => void; onSpeed: () => void; onPause: () => void; onMenu: () => void; menuOpen: boolean }) {
  const inWave = ui.phase === 'wave'
  const left = Math.ceil(ui.previewRemaining)
  const btn = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-[#7088a8] bg-gradient-to-b from-[#2e3c52] to-[#141b27] text-[#ffc46b] active:scale-95'
  return (
    <div className="pointer-events-auto flex items-center justify-center gap-1.5 p-1.5">
      <div className={`${BRASS} flex h-9 shrink-0 items-center gap-2 px-2 font-mono text-xs font-bold tabular-nums`}>
        <span className="flex items-center gap-0.5 text-[#e05252]"><Heart className="h-3.5 w-3.5 fill-[#e05252]" />{ui.lives}</span>
        <span className="flex items-center gap-0.5 text-[#ffc46b]"><Coins className="h-3.5 w-3.5" />{ui.infiniteGold ? '∞' : ui.gold}</span>
        <span className="flex items-center gap-0.5 text-[#dde6f0]"><Swords className="h-3.5 w-3.5 text-[#7088a8]" />{Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}</span>
      </div>
      <div className={`${BRASS} flex h-9 min-w-0 max-w-[260px] flex-1 items-center gap-1.5 px-2`}>
        {inWave ? (
          <>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm border border-[#2e3c52] bg-[#080c13]">
              <motion.div className="h-full bg-gradient-to-r from-[#7088a8] to-[#ffd700]" animate={{ width: `${(ui.waveSpawned / Math.max(1, ui.waveTotal)) * 100}%` }} />
            </div>
            <span className="shrink-0 font-mono text-[11px] text-[#dde6f0]">☣{ui.creepsAlive}</span>
          </>
        ) : (
          <>
            <span className="shrink-0 text-sm" style={{ color: ARMOR_COLORS[ui.nextWaveArmor] }} title={ARMOR_NAMES[ui.nextWaveArmor]}>
              {ARMOR_ICONS[ui.nextWaveArmor]}
            </span>
            {ui.nextWaveIsBoss && <span className="shrink-0 text-[10px] font-bold text-[#e05252]">⚠</span>}
            <span className={`min-w-0 flex-1 truncate font-mono text-xs tabular-nums ${left <= 5 ? 'text-[#ffd700]' : 'text-[#dde6f0]'}`}>{left}с</span>
            <button
              onClick={onStart}
              className="flex h-7 shrink-0 items-center gap-1 rounded border border-[#93a9c6] bg-gradient-to-b from-[#2e3c52] to-[#1f2a3b] px-2 text-[11px] font-bold text-[#ffd700] active:scale-95"
            >
              <Play className="h-3 w-3" /> Волна
            </button>
          </>
        )}
      </div>
      <button onClick={onSpeed} className={`${btn} font-mono text-xs font-bold`}>×{ui.speed}</button>
      <button onClick={onPause} className={btn} disabled={!(ui.phase === 'preview' || ui.phase === 'wave')}>
        {ui.paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
      </button>
      <button onClick={onMenu} className={`${btn} ${menuOpen ? 'border-[#ffd700]' : ''}`} aria-label="Меню">
        <Cog className="h-4 w-4" />
      </button>
    </div>
  )
}

/** Меню телефона: редкие действия крупными строками */
export function MobileMenu({
  ui, skin, fullscreen, muted, lighting, role,
  onLighting, onMute, onInfiniteGold, onSkin, onHelp, onRestart, onFullscreen, onInvite, onClose,
}: {
  ui: UiState
  skin: 'steam' | 'lol'
  fullscreen: boolean
  muted: boolean
  lighting: boolean
  role: MpRole
  onLighting: () => void
  onMute: () => void
  onInfiniteGold: () => void
  onSkin: () => void
  onHelp: () => void
  onRestart: () => void
  onFullscreen: () => void
  onInvite?: () => void
  onClose: () => void
}) {
  const row = (icon: React.ReactNode, label: string, on: () => void, active = false) => (
    <button
      key={label}
      onClick={() => {
        on()
        onClose()
      }}
      className={`flex h-11 w-full items-center gap-3 rounded border px-3 text-left text-sm active:scale-[0.98] ${
        active ? 'border-[#ffd70088] bg-[#26344a] text-[#ffd700]' : 'border-[#2e3c52] bg-[#0f151f] text-[#ccd8e6]'
      }`}
    >
      <span className="flex w-5 justify-center">{icon}</span>
      {label}
    </button>
  )
  return (
    <motion.div {...slideDown} className={`${BRASS} pointer-events-auto flex w-64 flex-col gap-1.5 p-2`}>
      {role === 'host' && onInvite && row(<Users className="h-4 w-4" />, 'Пригласить друга', onInvite)}
      {row(fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />, fullscreen ? 'Выйти из полного экрана' : 'На весь экран', onFullscreen, fullscreen)}
      {row(lighting ? <Lightbulb className="h-4 w-4" /> : <LightbulbOff className="h-4 w-4" />, lighting ? 'Свет и тени: вкл' : 'Свет и тени: выкл', onLighting, lighting)}
      {row(muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />, muted ? 'Звук: выкл' : 'Звук: вкл', onMute, !muted)}
      {row(<Coins className="h-4 w-4" />, 'Бесконечное золото', onInfiniteGold, ui.infiniteGold)}
      {row(<span>🍆</span>, 'Шуточный скин', onSkin, skin === 'lol')}
      {row(<HelpCircle className="h-4 w-4" />, 'Как играть', onHelp)}
      {row(<RotateCcw className="h-4 w-4" />, 'Начать заново', onRestart)}
    </motion.div>
  )
}

/** Лента арсенала телефона: карточки листаются пальцем; нажать — выбрать, потянуть на поле — поставить */
export function MobileArsenal({
  ui, armed, onPick, onRoll, vertical = false,
}: { ui: UiState; armed: string | null; onPick: (defId: string, e: React.PointerEvent) => void; onRoll: () => void; vertical?: boolean }) {
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  const pool = ui.shop.map((id) => ALL_DEFS[id]).filter((d): d is TowerDef => !!d && !d.merged)
  const thumb = (t: TowerDef) => (typeof document === 'undefined' ? '' : towerThumb(t))
  const canRoll = ui.gold >= ui.rollCost && canBuild
  return (
    // в портрете — лента внизу (листается вбок), в альбомной ориентации — колонка справа (листается вниз)
    <div
      className={
        vertical
          ? `${BRASS} flex w-[88px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden rounded-none border-y-0 border-r-0 px-1.5 py-1.5`
          : `${BRASS} flex shrink-0 items-stretch gap-1.5 overflow-x-auto rounded-none border-x-0 border-b-0 px-2 pt-1.5`
      }
      style={vertical ? { paddingRight: 'max(6px, env(safe-area-inset-right))' } : { paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
    >
      {pool.map((t) => {
        const affordable = ui.gold >= t.price
        const usable = canBuild && affordable
        const picked = armed === t.id
        return (
          <button
            key={ui.shop.join() + t.id}
            type="button"
            disabled={!usable}
            onPointerDown={(e) => usable && onPick(t.id, e)}
            style={{ touchAction: 'none' }}
            className={`relative flex w-[74px] shrink-0 flex-col items-center overflow-hidden rounded border-2 bg-gradient-to-b from-[#172030] to-[#0a0f17] ${
              picked ? '-translate-y-1 border-[#ffd700] shadow-[0_0_12px_#ffd70088]' : usable ? 'border-[#5b6f8c]' : 'border-[#2e3c52] opacity-45'
            }`}
          >
            <span className="flex h-[50px] w-full items-end justify-center bg-[radial-gradient(circle_at_50%_70%,#1f2a3b,#0a0f17)]">
              {thumb(t) && (
                <img src={thumb(t)} alt="" className="h-[48px] w-auto max-w-[64px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
              )}
            </span>
            <span className="absolute left-0.5 top-0.5 text-xs leading-none">{t.glyph}</span>
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: ATTACK_COLORS[t.attack] }} />
            <span className="w-full truncate px-0.5 text-center font-serif text-[9px] font-bold leading-tight text-[#ffc46b]">{t.name}</span>
            <Price value={t.price} ok={affordable} className="text-[10px]" />
          </button>
        )
      })}
      {pool.length === 0 && <span className="self-center px-3 text-xs text-[#5b6f8c]">Арсенал выпадет с началом игры</span>}
      <button
        disabled={!canRoll}
        onClick={onRoll}
        // ролл прилипает к правому краю ленты — его видно, даже когда карточки не помещаются
        className={`sticky ${vertical ? 'bottom-0 w-[74px] py-1' : 'right-0 w-[60px]'} flex shrink-0 flex-col items-center justify-center gap-0.5 rounded border-2 border-[#7088a8] bg-gradient-to-b from-[#2e3c52] to-[#141b27] text-[#ffd700] shadow-[-8px_0_12px_#0a0f17] disabled:opacity-60`}
      >
        <Dices className="h-6 w-6" />
        <span className="font-serif text-[10px] font-black">РОЛЛ</span>
        <Price value={ui.rollCost} ok={ui.gold >= ui.rollCost} className="text-[10px]" />
      </button>
    </div>
  )
}
