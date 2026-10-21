'use client'

// HUD поверх поля «Железного Разлома».
// Раскладка (GameShell): верхняя полоса — ресурсы · волна · кнопки; нижняя — Охотница · арсенал;
// справа по требованию — панель выбранной башни; в центре сверху — уведомления (пауза, выбор башни);
// посередине экрана — баннер новой волны. Полосы лежат на верхнем и нижнем рядах клеток — тропа туда
// не заходит (map.ts). Внутри полос элементы стоят во flex: при нехватке места раздвигаются, но не
// налезают друг на друга.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import {
  Coins, Dices, Heart, Maximize2, Minimize2, Pause, Play, RotateCcw, Swords, Users, Zap, HelpCircle, Gauge,
} from 'lucide-react'
import { ALL_DEFS, ARMOR_COLORS, ARMOR_NAMES, ATTACK_NAMES, AVATAR, TOWERS } from '@/game/config'
import type { TowerDef, UiState } from '@/game/types'
import { ARMOR_ICONS, ATTACK_COLORS, Price, type MpRole, type MpStatus } from './Panels'

/** Единый вид панелей HUD: тёмное стекло с латунной рамкой */
export const HUD_PANEL =
  'pointer-events-auto rounded-lg border-2 border-[#8a6d3b] bg-[#1a140e]/85 shadow-[0_6px_18px_rgba(0,0,0,0.55)] backdrop-blur-sm'

const slideDown = { initial: { y: -24, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: -24, opacity: 0 } }
const slideUp = { initial: { y: 24, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 24, opacity: 0 } }

// ─── Ресурсы: жизни, золото, волна ───────────────────────────────────────
export function ResourceBar({ ui }: { ui: UiState }) {
  const lives = useAnimationControls()
  const gold = useAnimationControls()
  const prevLives = useRef(ui.lives)
  const prevGold = useRef(ui.gold)
  useEffect(() => {
    // потеря жизней — встряска и вспышка красным
    if (ui.lives < prevLives.current) {
      lives.start({ x: [0, -5, 5, -3, 3, 0], color: ['#ffffff', '#e05252'], transition: { duration: 0.4 } })
    }
    prevLives.current = ui.lives
  }, [ui.lives, lives])
  useEffect(() => {
    // изменение золота — короткий «подскок» числа
    if (ui.gold !== prevGold.current && !ui.infiniteGold) {
      gold.start({ scale: [1, 1.25, 1], transition: { duration: 0.25 } })
    }
    prevGold.current = ui.gold
  }, [ui.gold, ui.infiniteGold, gold])

  return (
    <motion.div {...slideDown} className={`${HUD_PANEL} flex h-11 items-center gap-3 px-3 font-mono text-sm tabular-nums`}>
      <motion.span animate={lives} className="flex items-center gap-1 text-[#e05252]" title="Жизни">
        <Heart className="h-4 w-4 fill-[#e05252]" /> {ui.lives}
      </motion.span>
      <span className="h-5 w-px bg-[#8a6d3b55]" />
      <motion.span animate={gold} className="flex items-center gap-1 text-[#e8c170]" title="Золото">
        <Coins className="h-4 w-4" /> {ui.infiniteGold ? '∞' : ui.gold}
      </motion.span>
      <span className="h-5 w-px bg-[#8a6d3b55]" />
      <span className="flex items-center gap-1 text-[#d8cbb0]" title="Волна">
        <Swords className="h-4 w-4 text-[#b08d57]" /> {Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}
      </span>
      {ui.coop && (
        <span className="rounded border border-[#e05252aa] px-1.5 text-[10px] font-bold text-[#ff9a7a]" title="Кооп: HP волн ×1.85">
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
    <motion.div {...slideDown} className={`${HUD_PANEL} flex h-11 min-w-0 items-center gap-2 px-3`}>
      {inWave ? (
        <>
          <span className="shrink-0 font-serif text-sm font-bold text-[#e8c170]">Волна {ui.wave}</span>
          <div className="h-2 w-28 shrink overflow-hidden rounded-full bg-[#0f0b07]" title="Вышло из портала">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#b08d57] to-[#ffd700]"
              animate={{ width: `${(ui.waveSpawned / Math.max(1, ui.waveTotal)) * 100}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs text-[#d8cbb0]" title="Машин на поле">
            ⚙ {ui.creepsAlive}
          </span>
        </>
      ) : (
        <>
          <span className="shrink-0 font-serif text-sm font-bold text-[#e8c170]">Волна {ui.wave}</span>
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
            className={`w-8 shrink-0 text-right font-mono text-sm tabular-nums ${left <= 5 ? 'text-[#ffd700]' : 'text-[#d8cbb0]'}`}
          >
            {left}с
          </motion.span>
          <button
            onClick={onStart}
            className="flex h-7 shrink-0 items-center gap-1 rounded border border-[#b08d57] bg-[#3a2e1c] px-2 text-xs font-bold text-[#ffd700] transition-colors hover:bg-[#4a3a24]"
            title="Начать волну сейчас"
          >
            <Play className="h-3 w-3" /> Начать
          </button>
        </>
      )}
    </motion.div>
  )
}

// ─── Кнопки управления (иконки с подсказками) ────────────────────────────
function IconButton({
  onClick, title, active = false, disabled = false, children,
}: { onClick: () => void; title: string; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded border px-1.5 text-xs transition-colors disabled:opacity-40 ${
        active
          ? 'border-[#ffd700] bg-[#3a2e1c] text-[#ffd700]'
          : 'border-[#8a6d3b66] bg-[#241b12] text-[#e8c170] hover:border-[#e8c170] hover:text-[#ffd700]'
      }`}
    >
      {children}
    </motion.button>
  )
}

export function ControlBar({
  ui, skin, fullscreen, role, mpStatus,
  onSpeed, onPause, onInvite, onInfiniteGold, onSkin, onHelp, onRestart, onFullscreen,
}: {
  ui: UiState
  skin: 'steam' | 'lol'
  fullscreen: boolean
  role: MpRole
  mpStatus: MpStatus
  onSpeed: () => void
  onPause: () => void
  onInvite?: () => void
  onInfiniteGold: () => void
  onSkin: () => void
  onHelp: () => void
  onRestart: () => void
  onFullscreen: () => void
}) {
  const playing = ui.phase === 'preview' || ui.phase === 'wave'
  return (
    <motion.div {...slideDown} className={`${HUD_PANEL} flex h-11 items-center gap-1 px-1.5`}>
      <IconButton onClick={onSpeed} title="Скорость игры" active={ui.speed > 1}>
        <Gauge className="h-3.5 w-3.5" /> <span className="font-mono">×{ui.speed}</span>
      </IconButton>
      <IconButton onClick={onPause} title={ui.paused ? 'Продолжить (P)' : 'Пауза (P)'} active={ui.paused} disabled={!playing}>
        {ui.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
      </IconButton>
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
      <span className="mx-0.5 h-5 w-px bg-[#8a6d3b55]" />
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
    </motion.div>
  )
}

// ─── Охотница: уровень, опыт и способность с кольцом перезарядки ─────────
export function HunterWidget({ ui, onAbility, role }: { ui: UiState; onAbility: () => void; role: MpRole }) {
  const cd = ui.avatar.cooldown
  const ready = cd <= 0 && role !== 'guest'
  const xpNext = ui.avatar.xpNext
  const xpPrev = xpNext ? [0, 3, 7, 12, 18, 25, 33, 42, 52][ui.avatar.level - 1] ?? 0 : 0
  const xpFrac = xpNext ? Math.min(1, (ui.avatar.xp - xpPrev) / (xpNext - xpPrev)) : 1
  const cdFrac = Math.min(1, cd / AVATAR.abilityCd)
  return (
    <motion.div {...slideUp} className={`${HUD_PANEL} flex h-12 items-center gap-2 px-2`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-[#7fd0a0] bg-[#1f2d24] text-xl">
        🏹
      </div>
      <div className="w-24 min-w-0">
        <p className="truncate font-serif text-xs font-bold text-[#7fd0a0]">
          {AVATAR.name} <span className="font-mono text-[10px] text-[#b08d57]">ур.{ui.avatar.level}</span>
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#0f0b07]" title={xpNext ? `Опыт ${ui.avatar.xp}/${xpNext}` : 'Максимальный уровень'}>
          <motion.div className="h-full rounded-full bg-[#7fd0a0]" animate={{ width: `${xpFrac * 100}%` }} />
        </div>
        <p className="mt-0.5 truncate text-[9px] text-[#8a6d3b]">клик по земле — идти</p>
      </div>
      <motion.button
        onClick={onAbility}
        disabled={!ready}
        whileTap={ready ? { scale: 0.9 } : undefined}
        animate={ready ? { boxShadow: ['0 0 0px #ffd70000', '0 0 14px #ffd700aa', '0 0 0px #ffd70000'] } : { boxShadow: '0 0 0px #ffd70000' }}
        transition={ready ? { duration: 1.6, repeat: Infinity } : undefined}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#b08d57] text-[#ffd700] disabled:text-[#8a6d3b]"
        // кольцо перезарядки — тёмный сектор уменьшается по мере готовности
        style={{ background: `conic-gradient(#1a140e ${cdFrac * 360}deg, #3a2e1c 0deg)` }}
        title={role === 'guest' ? 'Способностью управляет хост' : `${AVATAR.abilityName}: ${AVATAR.abilityDesc}`}
      >
        <Zap className="h-5 w-5" />
        {cd > 0 && <span className="absolute -bottom-1 rounded bg-[#1a140e] px-1 font-mono text-[9px] text-[#d8cbb0]">{Math.ceil(cd)}</span>}
      </motion.button>
    </motion.div>
  )
}

// ─── Арсенал: 5 карточек, перетаскиваются на клетку ─────────────────────
export function HudArsenal({
  gold, shop, rollCost, armed, canBuild, onPick, onRoll,
}: {
  gold: number
  shop: string[]
  rollCost: number
  armed: string | null
  canBuild: boolean
  onPick: (defId: string, e: React.PointerEvent) => void
  onRoll: () => void
}) {
  const pool = shop.map((id) => ALL_DEFS[id]).filter((d): d is TowerDef => !!d && !d.merged)
  const [spin, setSpin] = useState(0)
  const canRoll = gold >= rollCost && canBuild
  return (
    <motion.div {...slideUp} className={`${HUD_PANEL} flex max-w-full flex-wrap items-center justify-center gap-1.5 p-1.5 lg:h-12 lg:flex-nowrap lg:py-0`}>
      {/* на узком экране карточки переносятся в несколько рядов, на десктопе — одна строка */}
      <div className="flex flex-wrap justify-center gap-1.5 lg:flex-nowrap">
        <AnimatePresence mode="popLayout" initial={false}>
          {pool.map((t, i) => {
            const affordable = gold >= t.price
            const usable = canBuild && affordable
            const picked = armed === t.id
            return (
              <motion.button
                // ключ с набором пула — после ролла карточки «перетасовываются» заново
                key={shop.join() + t.id}
                layout
                initial={{ y: 20, opacity: 0, rotate: -4 }}
                animate={{ y: picked ? -4 : 0, opacity: usable ? 1 : 0.45, rotate: 0 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 420, damping: 28 }}
                whileHover={usable ? { y: -3 } : undefined}
                type="button"
                disabled={!usable}
                onPointerDown={(e) => usable && onPick(t.id, e)}
                style={{ touchAction: 'none', borderBottomColor: ATTACK_COLORS[t.attack] }}
                className={`flex h-10 w-[104px] shrink-0 items-center gap-1.5 rounded border border-b-[3px] bg-[#241b12] px-1.5 text-left ${
                  picked ? 'border-[#ffd700] ring-1 ring-[#ffd700]' : usable ? 'cursor-grab border-[#8a6d3b66] hover:border-[#e8c170]' : 'cursor-not-allowed border-[#8a6d3b33]'
                }`}
                title={`${t.name} — ${t.role}. ${ATTACK_NAMES[t.attack]} атака, радиус ${t.range}. Перетащите на клетку или нажмите и выберите клетку`}
              >
                <span className="text-lg leading-none">{t.glyph}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-semibold leading-tight text-[#e8c170]">{t.name}</span>
                  <Price value={t.price} ok={affordable} className="text-[10px]" />
                </span>
              </motion.button>
            )
          })}
        </AnimatePresence>
        {pool.length === 0 && <span className="px-3 text-[10px] text-[#8a6d3b]">Арсенал выпадет с началом игры</span>}
      </div>
      <motion.button
        whileTap={canRoll ? { scale: 0.92 } : undefined}
        disabled={!canRoll}
        onClick={() => {
          setSpin((s) => s + 1)
          onRoll()
        }}
        className="flex h-10 shrink-0 flex-col items-center justify-center rounded border border-[#b08d57] bg-[#3a2e1c] px-2 text-[10px] font-bold text-[#ffd700] hover:bg-[#4a3a24] disabled:opacity-40"
        title={`Ролл арсенала: ${pool.length} новых башен из ${TOWERS.length}`}
      >
        <motion.span animate={{ rotate: spin * 360 }} transition={{ duration: 0.45 }}>
          <Dices className="h-4 w-4" />
        </motion.span>
        <Price value={rollCost} ok={gold >= rollCost} />
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
    // запоминаем, босс ли следующая волна, пока она ещё в превью
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
          <p
            className={`font-serif text-5xl font-black tracking-[0.2em] drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] ${
              shown.boss ? 'text-[#ff5a3c]' : 'text-[#ffd700]'
            }`}
          >
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
            className="rounded-md border-2 border-[#ffd700] bg-[#1a140e]/90 px-4 py-1 font-serif text-lg font-black tracking-[0.3em] text-[#ffd700] shadow-lg"
          >
            ПАУЗА
          </motion.span>
        )}
        {armedName && (
          <motion.span
            key="armed"
            {...slideDown}
            className="rounded-md border border-[#e8c170] bg-[#1a140e]/90 px-3 py-1 text-center text-xs text-[#e8c170] shadow-lg"
          >
            {armedName}: нажмите на клетку · Esc или правая кнопка — отмена
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
