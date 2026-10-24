'use client'

// Пошаговое главное меню «Последнего горизонта» (в духе больших игр):
//   Этап 1 — главная: арт, лор, «Играть»;
//   Этап 2 — выбор карты: 6 карт с живым предпросмотром тропы (рисуется по зерну);
//   Этап 3 — выбор героя: портреты, способности, «В бой» / «Вдвоём».
// Состояние шага живёт внутри меню: после партии меню монтируется заново — с главной.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AVATARS, AVATAR_IDS, CELL, MAP_DEFS, MAP_H, MAP_W, type AvatarId } from '@/game/config'
import { generateMap } from '@/game/map'
import { avatarPortrait } from '@/game/pixel'
import type { UiState } from '@/game/types'

type Step = 0 | 1 | 2
const STEP_TITLES = ['ГЛАВНАЯ', 'ВЫБОР КАРТЫ', 'ВЫБОР ГЕРОЯ']

interface MainMenuProps {
  ui: UiState
  uiScale: number
  fullscreen: boolean
  onPickMap: (seed: number) => void
  onPickAvatar: (id: AvatarId) => void
  onStart: () => void
  onStartCoop: () => void
  onHelp: () => void
  onToggleFullscreen: () => void
}

export function MainMenu(props: MainMenuProps) {
  const { ui, uiScale, fullscreen } = props
  const [step, setStep] = useState<Step>(0)
  const [dir, setDir] = useState(1)
  const go = (s: Step) => {
    setDir(s >= step ? 1 : -1)
    setStep(s)
  }

  return (
    // на весь экран: живой изометрический мир игры виден фоном за лёгким затемнением
    <div className="absolute inset-0 overflow-y-auto bg-[#070a10]/60 backdrop-blur-[2px]">
      <div className="flex min-h-full flex-col items-center px-4 py-6 sm:py-8" style={{ zoom: uiScale }}>
        {/* индикатор шагов */}
        <div className="mb-6 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#5b6f8c]">
          {STEP_TITLES.map((t, i) => (
            <span key={t} className="flex items-center gap-2">
              {i > 0 && <span className="text-[#2e3c52]">──</span>}
              <span className={i === step ? 'text-[#ffc46b]' : ''}>
                {i + 1}. {t}
              </span>
            </span>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ x: 44 * dir, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -44 * dir, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex w-full flex-1 flex-col justify-center"
          >
            {step === 0 && <StepMain {...props} onPlay={() => go(1)} />}
            {step === 1 && (
              <StepMap
                ui={ui}
                onPickMap={props.onPickMap}
                onBack={() => go(0)}
                onNext={() => go(2)}
              />
            )}
            {step === 2 && (
              <StepHero
                ui={ui}
                onPickAvatar={props.onPickAvatar}
                onBack={() => go(1)}
                onStart={props.onStart}
                onStartCoop={props.onStartCoop}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Этап 1: главная ─────────────────────────────────────────────────────

function StepMain({ onPlay, onHelp, onToggleFullscreen, fullscreen }: MainMenuProps & { onPlay: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#5b6f8c]">
        паропанк · tower defense · прототип
      </p>
      <h1 className="mb-8 select-none">
        <img
          src="/logo-the-last-horizon.png"
          alt="Последний горизонт"
          className="mx-auto w-full max-w-[560px] drop-shadow-[0_10px_32px_rgba(0,0,0,0.9)]"
          draggable={false}
        />
      </h1>
      <div className="mb-9 flex flex-wrap justify-center gap-2 text-[10px] text-[#94a3b8]">
        {['15 башен', 'слияние', '6 карт · 20 волн', 'кооп по ссылке'].map((t) => (
          <span key={t} className="rounded border border-[#5b6f8c55] px-2 py-1">{t}</span>
        ))}
      </div>
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={onPlay}
        className="h-16 w-full max-w-sm rounded-md border-2 border-[#93a9c6] bg-gradient-to-b from-[#2e3c52] to-[#1f2a3b] px-10 font-serif text-xl font-black tracking-wide text-[#ffd700] shadow-[0_8px_32px_rgba(60,90,140,0.4)] hover:from-[#34475f]"
      >
        ⚙ ИГРАТЬ
      </motion.button>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <MenuBtn onClick={onHelp}>Как играть</MenuBtn>
        <MenuBtn onClick={onToggleFullscreen}>{fullscreen ? 'Окно' : 'На весь экран'}</MenuBtn>
      </div>
    </div>
  )
}

// ─── Этап 2: выбор карты с предпросмотром ────────────────────────────────

function StepMap({
  ui,
  onPickMap,
  onBack,
  onNext,
}: {
  ui: UiState
  onPickMap: (seed: number) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <p className="mb-1 text-center font-serif text-2xl font-black tracking-wide text-[#ffc46b]">ВЫБОР КАРТЫ</p>
      <p className="mb-5 text-center text-[11px] text-[#7088a8]">тропа фиксирована и видна заранее · 20 волн · боссы на 10-й и 20-й</p>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MAP_DEFS.map((m) => {
          const picked = ui.mapName === m.name
          return (
            <motion.button
              key={m.id}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPickMap(m.seed)}
              className={`overflow-hidden rounded-md border-2 bg-gradient-to-b from-[#172030] to-[#0a0f17] text-left transition-colors ${
                picked ? 'border-[#ffc46b] shadow-[0_0_16px_#ffd70055]' : 'border-[#2e3c52] hover:border-[#4a5f80]'
              }`}
              title={m.feature}
            >
              <MapPreview seed={m.seed} />
              <div className="px-2.5 py-2">
                <p className="font-serif text-sm font-black leading-tight text-[#ccd8e6]">
                  {picked && <span className="text-[#ffc46b]">▸ </span>}
                  {m.name}
                </p>
                <p className="min-h-[2em] text-[9px] leading-tight text-[#7088a8]">{m.feature}</p>
              </div>
            </motion.button>
          )
        })}
      </div>
      <MenuFooter onBack={onBack} nextLabel="ДАЛЕЕ: ГЕРОЙ →" onNext={onNext} />
    </div>
  )
}

/** Живой предпросмотр карты: тропа, вход РАЗЛОМ и выход ЛАГЕРЬ — по зерну карты.
 *  Внутреннее разрешение фиксировано, CSS растягивает канвас на ширину карточки. */
function MapPreview({ seed, w = 320, h = 200 }: { seed: number; w?: number; h?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = w * dpr
    c.height = h * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sx = w / MAP_W
    const sy = h / MAP_H
    // фон в духе ночного поля
    ctx.fillStyle = '#0c111a'
    ctx.fillRect(0, 0, w, h)
    // шахматная сетка — намёк на клетки стройки
    ctx.fillStyle = 'rgba(120,150,190,0.07)'
    for (let gx = 0; gx < MAP_W / CELL; gx++)
      for (let gy = 0; gy < MAP_H / CELL; gy++)
        if ((gx + gy) % 2 === 0) ctx.fillRect(gx * CELL * sx, gy * CELL * sy, CELL * sx, CELL * sy)
    const pts = generateMap(seed).points
    const stroke = (width: number, color: string) => {
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x * sx, p.y * sy) : ctx.moveTo(p.x * sx, p.y * sy)))
      ctx.lineWidth = width
      ctx.strokeStyle = color
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()
    }
    stroke(9, '#33291c') // тёмная обочина
    stroke(6, '#b3a284') // настил тракта
    stroke(1.4, 'rgba(255,255,255,0.16)') // блик
    // вход (РАЗЛОМ) и выход (ЛАГЕРЬ) — как подписи на поле
    const dot = (x: number, y: number, color: string) => {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 1.4
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'
      ctx.stroke()
    }
    dot(pts[0].x * sx, pts[0].y * sy, '#a6f095')
    dot(pts[pts.length - 1].x * sx, pts[pts.length - 1].y * sy, '#ffb347')
  }, [seed, w, h])
  return <canvas ref={ref} className="block h-auto w-full" aria-hidden />
}

// ─── Этап 3: выбор героя ─────────────────────────────────────────────────

function StepHero({
  ui,
  onPickAvatar,
  onBack,
  onStart,
  onStartCoop,
}: {
  ui: UiState
  onPickAvatar: (id: AvatarId) => void
  onBack: () => void
  onStart: () => void
  onStartCoop: () => void
}) {
  const a = AVATARS[ui.avatar.id]
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="mb-1 text-center font-serif text-2xl font-black tracking-wide text-[#ffc46b]">ВЫБОР ГЕРОЯ</p>
      <p className="mb-5 text-center text-[11px] text-[#7088a8]">герой ходит по карте, растёт в уровнях и ведёт свою игру</p>
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {AVATAR_IDS.map((id) => {
          const av = AVATARS[id]
          const picked = ui.avatar.id === id
          return (
            <motion.button
              key={id}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPickAvatar(id)}
              className={`flex flex-col items-center gap-1.5 rounded-md border-2 bg-gradient-to-b from-[#172030] to-[#0a0f17] px-2 py-3 text-center transition-colors ${
                picked ? 'shadow-[0_0_16px_#ffd70055]' : 'border-[#2e3c52] opacity-80 hover:opacity-100'
              }`}
              style={{ borderColor: picked ? av.color : undefined }}
              title={`${av.abilityName}: ${av.abilityDesc}`}
            >
              <AvatarImg id={id} size={64} />
              <span className="font-serif text-sm font-black leading-none" style={{ color: av.color }}>{av.name}</span>
              <span className="text-[10px] leading-tight text-[#b9c6d8]">{av.role}</span>
              <span className="font-mono text-[9px] leading-tight text-[#7088a8]">{av.abilityName} · {av.abilityCd} с</span>
            </motion.button>
          )
        })}
      </div>
      {/* карточка выбранного героя */}
      <div className="mb-5 rounded-md border border-[#5b6f8c55] bg-[#141b27] px-4 py-2.5 text-left">
        <p className="text-[12px] leading-snug text-[#ccd8e6]">
          <b style={{ color: a.color }}>{a.abilityName}:</b> {a.abilityDesc}.{' '}
          <span className="text-[#7088a8]">Пассивно: {a.passive.toLowerCase()}.</span>
        </p>
        <p className="mt-1 font-mono text-[10px] text-[#5b6f8c]">
          карта: {ui.mapName} · {ui.mapFeature}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <MenuBtn onClick={onBack}>← Назад</MenuBtn>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="h-12 rounded-md border-2 border-[#93a9c6] bg-gradient-to-b from-[#2e3c52] to-[#1f2a3b] px-8 font-serif text-base font-black tracking-wide text-[#ffd700] shadow-[0_6px_20px_rgba(60,90,140,0.35)] hover:from-[#34475f]"
        >
          ⚔ В БОЙ
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStartCoop}
          className="h-12 rounded-md border-2 border-[#7fd0a0] bg-[#1f2d24] px-6 font-serif text-sm font-bold text-[#7fd0a0] hover:bg-[#243a2c]"
        >
          👥 ВДВОЁМ
        </motion.button>
      </div>
    </div>
  )
}

/** Портрет аватара: рисуется на холсте, подставляется после монтирования (гидратация не расходится) */
function AvatarImg({ id, size = 40 }: { id: AvatarId; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- холст доступен только в браузере
    setSrc(avatarPortrait(id, 3))
  }, [id])
  return (
    <img
      src={src || undefined}
      alt=""
      style={{ imageRendering: 'pixelated', height: size, width: size }}
      className="object-contain"
      draggable={false}
    />
  )
}

// ─── общие элементы ──────────────────────────────────────────────────────

function MenuBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 rounded-md border border-[#5b6f8c] bg-transparent px-4 text-sm text-[#ccd8e6] transition-colors hover:bg-[#1f2a3b]"
    >
      {children}
    </button>
  )
}

function MenuFooter({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <MenuBtn onClick={onBack}>← Назад</MenuBtn>
      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="h-11 rounded-md border-2 border-[#93a9c6] bg-gradient-to-b from-[#2e3c52] to-[#1f2a3b] px-6 font-serif text-sm font-bold tracking-wide text-[#ffd700] hover:from-[#34475f]"
      >
        {nextLabel}
      </motion.button>
    </div>
  )
}
