'use client'

// Хаб-терминал главного меню «Последнего горизонта» (docs/menu-survey/BRIEF.md).
// Один экран «командного пункта лагеря» вместо степпера 1-2-3-4:
//   ХАБ        — арт-логотип, сводка ИИ (лор минерала), сектора КАМПАНИЯ / СОБЫТИЯ /
//                ПРОФИЛЬ / НАСТРОЙКИ, внизу мини-профиль и кнопка «+» (инвайт в кооп);
//   КАМПАНИЯ   — карта кампании с узлами; клик по узлу открывает модалку миссии
//                (превью карты + сложность + герой + «В бой» / «Вдвоём»);
//   СОБЫТИЯ    — сундук за вход и задачи дня (meta.daily);
//   ПРОФИЛЬ    — статистика кампании и коллекция деталей башен;
//   НАСТРОЙКИ  — громкости, звук/свет, полный экран, сброс прогресса.
// Фон — чертёж «командного пункта» (MenuBackdrop, монтируется в GameShell на интро);
// живой игровой мир в меню больше не виден. После партии меню монтируется заново — с хаба.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Gift, Lock, Map as MapIcon, Maximize, Minimize, Plus, Settings, User, Users, Volume2, X,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  ALL_DEFS,
  AVATARS,
  AVATAR_IDS,
  BUILDING_BASE_HP,
  DIFFICULTIES,
  DIFFICULTY_IDS,
  MAP_DEFS,
  MAP_H,
  MAP_W,
  type AvatarId,
  type DifficultyId,
} from '@/game/config'
import {
  ACHIEVEMENTS,
  DAILY_TASKS,
  collectionRows,
  dailyReady,
  isAchieved,
  isMapUnlocked,
  mapProgress,
  taskClaimable,
  taskClaimed,
  taskProgress,
  type MetaSave,
} from '@/game/meta'
import { CHESTS, PART_BY_ID, PART_STAT_BY_ID, type PartStat } from '@/game/data/meta'
import { generateMap } from '@/game/map'
import { toScreen } from '@/game/iso'
import { buildBackground, mapLights, props, roadEnds } from '@/game/world'
import { BIOMES } from '@/game/biomes'
import { avatarPortrait, towerThumb } from '@/game/pixel'
import type { UiState, Vec } from '@/game/types'

type View = 'hub' | 'campaign' | 'events' | 'profile' | 'settings'

interface MainMenuProps {
  ui: UiState
  uiScale: number
  fullscreen: boolean
  /** громкость музыки 0..1 — регулятор в углу хаба */
  musicVolume: number
  onMusicVolume: (v: number) => void
  sfxVolume: number
  onSfxVolume: (v: number) => void
  ambientVolume: number
  onAmbientVolume: (v: number) => void
  muted: boolean
  onMute: () => void
  lighting: boolean
  onLighting: () => void
  onPickMap: (seed: number) => void
  onPickDifficulty: (id: DifficultyId) => void
  onPickAvatar: (id: AvatarId) => void
  onStart: () => void
  /** создать кооп-лобби: окно с ссылкой-приглашением открывает оболочка */
  onStartCoop: () => void
  onHelp: () => void
  onToggleFullscreen: () => void
  /** забрать дневной сундук (сейв пишет оболочка) */
  onClaimDaily: () => void
  /** забрать награду задачи дня */
  onClaimTask: (taskId: string) => void
  /** сбросить лесенку кампании и коллекцию деталей */
  onResetProgress: () => void
  /** переименовать билд башни в коллекции (этап 2, docs/meta.md) */
  onRenameBuild: (towerId: string, name: string) => void
  /** хаб открывается только для одиночки и хоста (гость ждёт на своём экране) */
  mpRole: 'single' | 'host'
  mpStatus: string
  /** сейв метапрогрессии: замки карт, статистика, задачи дня (docs/meta.md) */
  meta: MetaSave
}

export function MainMenu(props: MainMenuProps) {
  const [view, setView] = useState<View>('hub')
  const [dir, setDir] = useState(1)
  const [missionId, setMissionId] = useState<string | null>(null)
  // выбор сложности и героя живёт на уровне меню: открытая модалка не сбрасывает его
  const [pickedDiff, setPickedDiff] = useState<DifficultyId>(props.ui.difficulty)
  const [pickedHero, setPickedHero] = useState<AvatarId>(props.ui.avatar.id)
  const go = (v: View) => {
    setDir(v === 'hub' ? -1 : 1)
    setView(v)
  }

  const missionDef = missionId ? MAP_DEFS.find((m) => m.id === missionId) ?? null : null
  const launch = (coop: boolean) => {
    const map = missionDef ?? MAP_DEFS[0]
    props.onPickMap(map.seed)
    props.onPickDifficulty(pickedDiff)
    props.onPickAvatar(pickedHero)
    if (coop) props.onStartCoop()
    else props.onStart()
  }

  return (
    // на весь экран: фон — чертёж «командного пункта» (MenuBackdrop в GameShell).
    // Хаб сидит на чистом чертеже; секторам (кампания/события/профиль/настройки)
    // нужна тёмная подложка — их плотный текст иначе накладывается на штамп и выноски.
    <div
      className={
        view === 'hub'
          ? 'absolute inset-0 overflow-y-auto'
          : 'absolute inset-0 overflow-y-auto bg-[rgba(7,11,17,0.86)] backdrop-blur-[2px]'
      }
    >
      {/* громкость музыки и полный экран — под рукой на любом экране хаба */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5" style={{ zoom: props.uiScale }}>
        <button
          type="button"
          onClick={props.onToggleFullscreen}
          title={props.fullscreen ? 'Выйти из полного экрана' : 'На весь экран'}
          aria-label={props.fullscreen ? 'Выйти из полного экрана' : 'На весь экран'}
          className="hover-glow flex h-8 w-8 items-center justify-center rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.9)] text-[#93a9c6] hover:text-[#e8ecf4]"
          style={{ '--glow': '#93a9c6' } as CSSProperties}
        >
          {props.fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.9)] px-3 py-1.5">
          <Volume2 className="h-4 w-4 shrink-0 text-[#f2c94c]" strokeWidth={2.2} />
          <Slider
            value={[Math.round(props.musicVolume * 100)]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => props.onMusicVolume((v[0] ?? 0) / 100)}
            aria-label="Громкость музыки"
            className="w-24 sm:w-32 [&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#f2c94c]"
          />
          <span className="w-9 text-right font-mono text-[10px] font-bold text-[#c3cbe0]">
            {Math.round(props.musicVolume * 100)}%
          </span>
        </div>
      </div>

      <div className="flex min-h-full flex-col items-center px-4 py-5 sm:py-7" style={{ zoom: props.uiScale }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ x: 44 * dir, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -44 * dir, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex w-full flex-1 flex-col justify-center"
          >
            {view === 'hub' && <HubView {...props} onOpen={go} />}
            {view === 'campaign' && (
              <CampaignView
                meta={props.meta}
                ui={props.ui}
                onBack={() => go('hub')}
                onOpenMission={setMissionId}
              />
            )}
            {view === 'events' && (
              <EventsView
                meta={props.meta}
                onBack={() => go('hub')}
                onClaimDaily={props.onClaimDaily}
                onClaimTask={props.onClaimTask}
              />
            )}
            {view === 'profile' && <ProfileView meta={props.meta} ui={props.ui} onRenameBuild={props.onRenameBuild} onBack={() => go('hub')} />}
            {view === 'settings' && <SettingsView {...props} onBack={() => go('hub')} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* модалка миссии: поверх любого экрана хаба */}
      <AnimatePresence>
        {missionDef && (
          <MissionModal
            def={missionDef}
            ui={props.ui}
            pickedDiff={pickedDiff}
            setPickedDiff={setPickedDiff}
            pickedHero={pickedHero}
            setPickedHero={setPickedHero}
            onClose={() => setMissionId(null)}
            onLaunch={() => launch(false)}
            onLaunchCoop={() => launch(true)}
            uiScale={props.uiScale}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── ХАБ: командный пункт лагеря ─────────────────────────────────────────

function HubView(props: MainMenuProps & { onOpen: (v: View) => void }) {
  const { meta, ui, mpRole, mpStatus } = props
  const daily = dailyReady(meta)
  const tasksDone = DAILY_TASKS.filter((t) => taskClaimed(meta, t.id)).length
  const nextMap = MAP_DEFS[Math.min(mapProgress(meta), MAP_DEFS.length - 1)]
  const hero = AVATARS[ui.avatar.id]

  return (
    <div className="flex w-full flex-col items-center">
      <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.35em] text-[#5b6f8c]">
        ◆ командный пункт лагеря «железный разлом» ◆
      </p>
      <h1 className="mb-4 select-none">
        <img
          src="/logo-the-last-horizon.png"
          alt="Последний горизонт"
          className="mx-auto w-full max-w-[460px] drop-shadow-[0_10px_32px_rgba(0,0,0,0.9)]"
          draggable={false}
        />
      </h1>

      {/* плашка прогресса */}
      <div className="mb-2.5 flex flex-wrap justify-center gap-1.5 font-mono text-[10px]">
        <span className="rounded border border-[#3a4660] bg-[rgba(14,19,31,0.8)] px-2 py-1 text-[#9db4d0]">
          тракты <b className="text-[#e0a832]">{mapProgress(meta)}/{MAP_DEFS.length}</b>
        </span>
        <span className="rounded border border-[#3a4660] bg-[rgba(14,19,31,0.8)] px-2 py-1 text-[#9db4d0]">
          победы <b className="text-[#e0a832]">{meta.wins}</b>
        </span>
        <span className={`rounded border px-2 py-1 ${daily ? 'animate-pulse border-[#59c27a55] text-[#7fd0a0]' : 'border-[#3a4660] text-[#5b6f8c]'} bg-[rgba(14,19,31,0.8)]`}>
          сундук дня {daily ? 'готов' : 'завтра'}
        </span>
      </div>

      {/* сводка ИИ: лор живого минерала — одна строка над секторами */}
      <p className="mb-5 text-center font-mono text-[10px] leading-relaxed text-[#5f8a94]">
        <span className="font-bold text-[#7fd0c0]">ИИ ▸</span> минерал по-прежнему жив. он изменил зверей, лес и машины — восемь из десяти не пережили первый день.
      </p>

      {/* сектора: кампания — главный выбор, остальные три — служба хаба */}
      <div className="grid w-full max-w-4xl grid-cols-2 gap-2.5 lg:grid-cols-3">
        <Sector
          featured
          wide
          icon={<MapIcon className="h-5 w-5" strokeWidth={2.2} />}
          title="КАМПАНИЯ"
          sub={`следующий тракт: ${nextMap.name} — ${nextMap.feature}`}
          chips={
            <>
              <Chip tone="gold">карта {mapProgress(meta)}/{MAP_DEFS.length}</Chip>
              <Chip tone="dim">лесенка ×HP</Chip>
            </>
          }
          onClick={() => props.onOpen('campaign')}
        />
        <Sector
          icon={<Gift className="h-5 w-5" strokeWidth={2.2} />}
          title="СОБЫТИЯ"
          sub={daily ? 'сундук за вход уже ждёт' : 'сундук за вход — завтра'}
          chips={
            <>
              {daily && <Chip tone="green">готово</Chip>}
              <Chip tone="dim">задачи {tasksDone}/{DAILY_TASKS.length}</Chip>
            </>
          }
          onClick={() => props.onOpen('events')}
        />
        <Sector
          icon={<User className="h-5 w-5" strokeWidth={2.2} />}
          title="ПРОФИЛЬ"
          sub="статистика кампании и детали башен — собранные единицы усиливают башни в следующих миссиях"
          chips={
            <>
              <Chip tone="dim">побед: {meta.wins}</Chip>
              <Chip tone="gold">коллекция {collectionDonePct(meta)}%</Chip>
            </>
          }
          wideLg
          onClick={() => props.onOpen('profile')}
        />
        <Sector
          icon={<Settings className="h-5 w-5" strokeWidth={2.2} />}
          title="НАСТРОЙКИ"
          sub="звук, свет, полный экран, сброс"
          chips={
            <>
              <Chip tone="dim">звук {props.muted ? 'выкл' : 'вкл'}</Chip>
              <Chip tone="dim">свет {props.lighting ? 'вкл' : 'выкл'}</Chip>
            </>
          }
          onClick={() => props.onOpen('settings')}
        />
      </div>

      {/* низ: мини-профиль + кнопка «+» для приглашения друга (кооп по ссылке) */}
      <div className="mt-6 flex w-full max-w-4xl flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border-2 border-[#3a4660] bg-[rgba(14,19,31,0.92)] px-2 py-1.5">
          <img
            src={avatarPortrait(ui.avatar.id, 2)}
            alt=""
            className="h-10 w-10 rounded-sm border border-[#5b6f8c] object-cover object-top"
            draggable={false}
          />
          <div className="text-left leading-tight">
            <p className="font-serif text-[13px] font-black" style={{ color: hero.color }}>{hero.name}</p>
            <p className="font-mono text-[9px] text-[#7088a8]">побед: {meta.wins} · тракты {mapProgress(meta)}/{MAP_DEFS.length}</p>
          </div>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          onClick={props.onStartCoop}
          title="Позвать друга — кооп по ссылке (создаст лобби и окно приглашения)"
          aria-label="Позвать друга в кооп"
          className="hover-glow flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#7fd0a0] bg-[rgba(18,30,24,0.92)] text-[#7fd0a0]"
          style={{ '--glow': '#7fd0a0' } as CSSProperties}
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </motion.button>
        {mpRole === 'host' && (
          <span className="rounded border border-[#59c27a55] px-2 py-1 font-mono text-[9px] text-[#7fd0a0]">
            лобби: {mpStatus === 'waiting' ? 'ждём друга' : 'друг в игре'}
          </span>
        )}
        <span className="ml-auto hidden font-mono text-[9px] text-[#5b6f8c] sm:block">
          прототип · паропанк tower defense · кооп по ссылке
        </span>
      </div>
    </div>
  )
}

// ─── КАМПАНИЯ: карта с узлами ────────────────────────────────────────────

function CampaignView({
  meta,
  ui,
  onBack,
  onOpenMission,
}: {
  meta: MetaSave
  ui: UiState
  onBack: () => void
  onOpenMission: (id: string) => void
}) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <ViewHeader
        title="КАРТА КАМПАНИИ"
        sub="шесть трактов — шесть биомов · следующая карта откроется после победы · боссы на 10-й, 20-й и 30-й волне"
        onBack={onBack}
      />
      <div className="relative">
        {/* пунктирная тропа кампании за узлами */}
        <div className="pointer-events-none absolute left-[6%] right-[6%] top-[96px] hidden border-t-2 border-dashed border-[#5b6f8c40] lg:block" />
        <div className="relative flex flex-wrap items-start justify-center gap-3">
          {MAP_DEFS.map((m, i) => (
            <CampaignNode
              key={m.id}
              def={m}
              index={i}
              wins={meta.winsByMap[m.id] ?? 0}
              locked={!isMapUnlocked(meta, m.id)}
              picked={ui.mapName === m.name}
              onOpen={() => onOpenMission(m.id)}
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-center font-mono text-[10px] text-[#5b6f8c]">
        лесенка сложности: каждый тракт сильнее предыдущего (×HP) · детали сундуков усиливают башни (сектор ПРОФИЛЬ)
      </p>
    </div>
  )
}

function CampaignNode({
  def,
  index,
  wins,
  locked,
  picked,
  onOpen,
}: {
  def: (typeof MAP_DEFS)[number]
  index: number
  wins: number
  locked: boolean
  picked: boolean
  onOpen: () => void
}) {
  return (
    <motion.button
      type="button"
      whileHover={locked ? undefined : { y: -3 }}
      whileTap={locked ? undefined : { scale: 0.97 }}
      onClick={onOpen}
      className={`hover-glow relative w-[196px] overflow-hidden rounded-md border-2 bg-gradient-to-b from-[#172030] to-[#0a0f17] text-left transition-colors ${
        locked
          ? 'cursor-not-allowed border-[#25304a] opacity-60'
          : picked
            ? 'border-[#ffc46b] shadow-[0_0_16px_#ffd70055]'
            : 'border-[#2e3c52] hover:border-[#4a5f80]'
      } ${index % 2 === 1 ? 'lg:mt-10' : ''}`}
      style={{ '--glow': locked ? '#5b6f8c' : '#ffd700' } as CSSProperties}
      title={locked ? 'Победите на предыдущей карте кампании' : def.feature}
    >
      <div className="relative">
        <div className={locked ? 'pointer-events-none opacity-40 grayscale' : ''}>
          <MapPreview seed={def.seed} w={196} />
        </div>
        {/* номер узла кампании */}
        <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#5b6f8c88] bg-[rgba(10,15,23,0.9)] font-mono text-[10px] font-bold text-[#9db4d0]">
          {index + 1}
        </span>
        {locked && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#5b6f8c88] bg-[rgba(10,15,23,0.9)] text-[#9db4d0]" title="Заперта: откроется после победы на предыдущей карте">
            <Lock className="h-3 w-3" />
          </span>
        )}
        {/* бейдж биома и множитель HP (biomes.ts, docs/meta.md) */}
        <span className="absolute bottom-1.5 right-1.5 rounded-sm border border-[#3a4660] bg-[rgba(10,15,23,0.85)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#9db4d0]">
          {BIOMES[def.biome].name}
        </span>
        <span className="absolute bottom-1.5 left-1.5 rounded-sm border border-[#3a4660] bg-[rgba(10,15,23,0.85)] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#e0a832]">
          ×{def.hpMult.toFixed(2)} HP
        </span>
      </div>
      <div className="px-2 py-1.5">
        <p className="flex items-center justify-between gap-1 font-serif text-[12px] font-black leading-tight text-[#ccd8e6]">
          <span className="truncate">{picked && <span className="text-[#ffc46b]">▸ </span>}{def.name}</span>
          {wins > 0 && <span className="shrink-0 font-mono text-[9px] text-[#e0a832]">★{wins}</span>}
        </p>
        <p className="min-h-[2.4em] text-[9px] leading-tight text-[#7088a8]">{def.feature}</p>
      </div>
    </motion.button>
  )
}

// ─── МОДАЛКА МИССИИ: карта + сложность + герой + старт ───────────────────

function MissionModal({
  def,
  ui,
  pickedDiff,
  setPickedDiff,
  pickedHero,
  setPickedHero,
  onClose,
  onLaunch,
  onLaunchCoop,
  uiScale,
}: {
  def: (typeof MAP_DEFS)[number]
  ui: UiState
  pickedDiff: DifficultyId
  setPickedDiff: (id: DifficultyId) => void
  pickedHero: AvatarId
  setPickedHero: (id: AvatarId) => void
  onClose: () => void
  onLaunch: () => void
  onLaunchCoop: () => void
  uiScale: number
}) {
  const a = AVATARS[pickedHero]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onMouseDown={onClose}
      className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[rgba(4,7,12,0.75)] p-4 backdrop-blur-[3px]"
    >
      <motion.div
        initial={{ scale: 0.94, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 8, opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ zoom: uiScale }}
        className="relative my-auto w-full max-w-3xl rounded-lg border-2 border-[#3a4660] bg-gradient-to-b from-[#131b28]/97 to-[#0a0f17]/97 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
      >
        <Rivets />
        {/* шапка миссии */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 pr-6">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">миссия · {BIOMES[def.biome].name}</p>
            <p className="font-serif text-xl font-black tracking-wide text-[#ffc46b]">{def.name}</p>
            <p className="mt-0.5 text-[11px] text-[#7088a8]">{def.feature}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="hover-glow flex h-8 w-8 items-center justify-center rounded-full border border-[#3a4660] text-[#93a9c6] hover:text-[#e8ecf4]"
            style={{ '--glow': '#93a9c6' } as CSSProperties}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* превью карты: запечённый мир + маршрут */}
          <div className="self-start overflow-hidden rounded-md border border-[#3a4660]">
            <MapPreview seed={def.seed} w={340} />
          </div>
          <div className="flex flex-col gap-2.5">
            {/* сложность */}
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">сложность</p>
              <div className="flex flex-col gap-1.5">
                {DIFFICULTY_IDS.map((id) => {
                  const d = DIFFICULTIES[id]
                  const picked = pickedDiff === id
                  const buildingHp = Math.round(BUILDING_BASE_HP * d.buildingHpMult)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPickedDiff(id)}
                      title={d.desc}
                      className={`rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                        picked ? 'bg-[rgba(46,60,82,0.5)]' : 'border-[#2e3c52] opacity-85 hover:border-[#4a5f80] hover:opacity-100'
                      }`}
                      style={{ borderColor: picked ? d.color : undefined }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-serif text-[13px] font-black" style={{ color: d.color }}>
                          {picked ? '▸ ' : ''}{d.name}
                        </span>
                        <span className="font-mono text-[9px] text-[#8fa2bd]">
                          HP ×{d.creepHpMult.toFixed(2).replace(/0$/, '')} · золото {d.startGold}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-[#aebdd2]">
                        {d.desc} · здание {buildingHp} HP
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
            {/* герой */}
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">герой</p>
              <div className="grid grid-cols-4 gap-1.5">
                {AVATAR_IDS.map((id) => {
                  const av = AVATARS[id]
                  const picked = pickedHero === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPickedHero(id)}
                      title={`${av.abilityName}: ${av.abilityDesc}`}
                      className={`hover-glow rounded-md border-2 p-1 transition-colors ${
                        picked ? '' : 'border-[#2e3c52] opacity-80 hover:opacity-100'
                      }`}
                      style={{ borderColor: picked ? av.color : undefined, '--glow': av.color } as CSSProperties}
                    >
                      <div
                        className="overflow-hidden rounded-sm border"
                        style={{ borderColor: picked ? av.color : '#2e3c52', aspectRatio: '1 / 1' }}
                      >
                        <img src={avatarPortrait(id, 3)} alt="" className="h-full w-full object-cover object-top" draggable={false} />
                      </div>
                      <p className="mt-1 truncate text-center font-serif text-[10px] font-black leading-none" style={{ color: av.color }}>
                        {av.name}
                      </p>
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[10px] leading-snug text-[#b9c6d8]">
                <b style={{ color: a.color }}>{a.abilityName}:</b> {a.abilityDesc}.{' '}
                <span className="text-[#7088a8]">Пассивно: {a.passive.toLowerCase()}.</span>
              </p>
            </div>
          </div>
        </div>

        {/* подвал: старт */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5 border-t border-[#2e3c52] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md border border-[#5b6f8c] px-4 text-[12px] text-[#ccd8e6] transition-colors hover:bg-[#1f2a3b]"
          >
            Отмена
          </button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={onLaunch}
            className="hover-glow h-11 rounded-md border-2 border-[#93a9c6] bg-gradient-to-b from-[#2e3c52] to-[#1f2a3b] px-8 font-serif text-[15px] font-black tracking-wide text-[#ffd700] shadow-[0_6px_20px_rgba(60,90,140,0.35)] hover:from-[#34475f]"
            style={{ '--glow': '#ffd700' } as CSSProperties}
          >
            ⚔ В БОЙ
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={onLaunchCoop}
            title="Создать лобби и получить ссылку-приглашение для друга"
            className="hover-glow h-11 rounded-md border-2 border-[#7fd0a0] bg-[#1f2d24] px-5 font-serif text-[13px] font-bold text-[#7fd0a0] hover:bg-[#243a2c]"
            style={{ '--glow': '#7fd0a0' } as CSSProperties}
          >
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> ВДВОЁМ</span>
          </motion.button>
          <p className="w-full text-center font-mono text-[9px] text-[#5b6f8c]">
            «вдвоём» создаст лобби со ссылкой — друг подключится гостем · сложность сохранится при повторе
          </p>
        </div>
        <span className="sr-only">{ui.mapName}</span>
      </motion.div>
    </motion.div>
  )
}

// ─── СОБЫТИЯ: сундук за вход + задачи дня ────────────────────────────────

function EventsView({
  meta,
  onBack,
  onClaimDaily,
  onClaimTask,
}: {
  meta: MetaSave
  onBack: () => void
  onClaimDaily: () => void
  onClaimTask: (taskId: string) => void
}) {
  const ready = dailyReady(meta)
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ViewHeader
        title="СОБЫТИЯ"
        sub="награда за вход и задачи дня · счётчики и награды обновляются каждый день"
        onBack={onBack}
      />
      {/* сундук за вход */}
      <div className="relative mb-3 rounded-md border-2 border-[#e0a83266] bg-gradient-to-b from-[#1b1a14]/95 to-[#0d0c08]/95 p-3.5">
        <Rivets />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-serif text-[15px] font-black" style={{ color: CHESTS.daily.accent }}>
              {CHESTS.daily.icon} {CHESTS.daily.name}
            </p>
            <p className="mt-0.5 max-w-md text-[11px] leading-snug text-[#aebdd2]">
              2–4 единицы деталей башен за вход в лагерь. Детали усилят башни в следующих миссиях —
              разбор коллекции в секторе ПРОФИЛЬ.
            </p>
          </div>
          {ready ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onClaimDaily}
              className="hover-glow h-10 shrink-0 rounded-md border-2 border-[#e0a832] bg-gradient-to-b from-[#3a2f14] to-[#241d0c] px-5 font-serif text-[13px] font-black tracking-wide text-[#ffd76b]"
              style={{ '--glow': '#ffd700' } as CSSProperties}
            >
              ЗАБРАТЬ
            </motion.button>
          ) : (
            <span className="shrink-0 rounded border border-[#3a4660] px-3 py-1.5 font-mono text-[10px] text-[#5b6f8c]">
              забрано · вернётся завтра
            </span>
          )}
        </div>
      </div>
      {/* задачи дня */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DAILY_TASKS.map((t) => {
          const prog = taskProgress(meta, t.id)
          const claimed = taskClaimed(meta, t.id)
          const claimable = taskClaimable(meta, t.id)
          const pct = Math.min(100, Math.round((prog / t.goal) * 100))
          return (
            <div key={t.id} className={`rounded-md border bg-[#141b27] p-3 ${claimed ? 'border-[#59c27a55]' : 'border-[#2e3c52]'}`}>
              <p className="min-h-[2.6em] text-[11px] leading-snug text-[#ccd8e6]">{t.text}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0d1420]">
                <div className="h-full rounded-full bg-[#e0a832] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 font-mono text-[9px] text-[#8fa2bd]">
                {Math.min(prog, t.goal)}/{t.goal} · награда: детали ×{t.reward[0]}–{t.reward[1]}
              </p>
              {claimed ? (
                <p className="mt-2 font-mono text-[10px] font-bold text-[#7fd0a0]">получено ✓</p>
              ) : claimable ? (
                <button
                  type="button"
                  onClick={() => onClaimTask(t.id)}
                  className="hover-glow mt-2 h-8 w-full rounded border-2 border-[#e0a832] bg-[rgba(58,47,20,0.6)] font-mono text-[10px] font-black tracking-wide text-[#ffd76b]"
                  style={{ '--glow': '#ffd700' } as CSSProperties}
                >
                  ЗАБРАТЬ
                </button>
              ) : (
                <p className="mt-2 font-mono text-[10px] text-[#5b6f8c]">выполните задачу</p>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center font-mono text-[10px] text-[#5b6f8c]">
        награда за задачу фиксирована на сутки: до утра она не «перекатывается»
      </p>
    </div>
  )
}

// ─── ПРОФИЛЬ: статистика кампании + коллекция деталей ────────────────────

// Строка статистики на карточке командира: мелкая метка сверху, крупное значение
function ProfileStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#5b6f8c]">{label}</p>
      <p className="mt-0.5 truncate font-serif text-[15px] font-black" style={{ color: color ?? '#ccd8e6' }}>
        {value}
      </p>
    </div>
  )
}

/** Цвет мини-бара по типу стата детали: урон/скорострельность/дальность */
const STAT_COLORS: Record<PartStat, string> = { damage: '#e0685a', cadence: '#7fd0c0', range: '#7fa8e0' }

type CollectionRowData = ReturnType<typeof collectionRows>[number]

/** Карточка башни в коллекции: слот с pixel-артом, имя (или имя билда), три стата с мини-барами */
function CollectionCard({
  towerId,
  stats,
  build,
  onRename,
}: {
  towerId: string
  stats: CollectionRowData['stats']
  /** имя билда, придуманное игроком (null — не названа) */
  build: string | null
  /** сохранить имя билда (пустая строка — сбросить) */
  onRename: (towerId: string, name: string) => void
}) {
  const def = ALL_DEFS[towerId]
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (!def) return null
  const total = stats.reduce((a, s) => a + Math.min(s.units, s.max), 0)
  const max = stats.reduce((a, s) => a + s.max, 0)
  const done = total >= max
  const hasAny = total > 0
  const save = () => {
    onRename(towerId, draft)
    setEditing(false)
  }
  return (
    <div
      className={`relative overflow-hidden rounded-md border bg-[#141b27] p-2 ${
        done ? 'border-[#e0a83288] shadow-[0_0_14px_rgba(224,168,50,0.12)]' : hasAny ? 'border-[#2e3c52]' : 'border-[#25304a]'
      }`}
    >
      {done && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded border border-[#e0a83288] bg-[rgba(224,168,50,0.14)] px-1 font-mono text-[7px] font-bold tracking-wider text-[#e0a832]">
          СОБРАНО
        </span>
      )}
      <div className="flex gap-2">
        {/* слот арта: живой pixel-спрайт той же башни, что на поле; пустая — приглушена */}
        <div
          className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border bg-[#0a0f17] ${
            done ? 'border-[#e0a83299]' : 'border-[#2e3c52]'
          } ${hasAny ? '' : 'opacity-40 grayscale'}`}
        >
          <img src={towerThumb(def)} alt="" className="h-full w-full object-contain" draggable={false} />
          {/* бейдж суммы единиц (как счётчик Insta-Monkeys) */}
          <span
            className={`absolute bottom-0.5 right-0.5 rounded px-1 font-mono text-[8px] font-black leading-4 ${
              hasAny ? 'bg-[rgba(10,14,22,0.85)] text-[#ffd76b]' : 'bg-[rgba(10,14,22,0.85)] text-[#4a5a72]'
            }`}
          >
            {total}
          </span>
        </div>
        {/* имя и статы */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                maxLength={24}
                placeholder="имя билда"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                  if (e.key === 'Escape') setEditing(false)
                }}
                className="min-w-0 flex-1 rounded border border-[#e0a83255] bg-[#0a0f17] px-1.5 py-0.5 font-serif text-[11px] font-bold text-[#ffd76b] outline-none placeholder:text-[#4a5a72]"
              />
              <button
                type="button"
                onClick={save}
                className="shrink-0 rounded border border-[#7fd0a055] px-1 font-mono text-[9px] font-bold text-[#a6f095]"
                title="Сохранить имя билда"
              >
                ✓
              </button>
            </div>
          ) : (
            <div className="group flex min-w-0 items-baseline gap-1">
              <p className={`truncate font-serif text-[12px] font-black leading-tight ${hasAny ? 'text-[#ccd8e6]' : 'text-[#4a5a72]'}`}>
                {def.name}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraft(build ?? '')
                  setEditing(true)
                }}
                title={build ? `Билд «${build}» — переименовать` : 'Назвать свой билд'}
                className="shrink-0 font-mono text-[9px] text-[#4a5a72] opacity-0 transition-opacity group-hover:opacity-100"
              >
                ✎
              </button>
            </div>
          )}
          {build && !editing && (
            <p className="truncate font-mono text-[9px] font-bold leading-tight text-[#ffd76b]" title={`Билд: ${build}`}>
              «{build}»
            </p>
          )}
          <div className="mt-1 space-y-1">
            {stats.map((s) => {
              const label = PART_STAT_BY_ID[s.stat].label
              const fill = Math.round((Math.min(s.units, s.max) / s.max) * 100)
              const sign = s.stat === 'cadence' ? '−' : '+'
              const bonus = Math.round(s.units * s.step * 100)
              return (
                <div key={s.stat} title={PART_BY_ID[`${towerId}-${s.stat}`]?.name}>
                  <div className="flex items-baseline justify-between gap-1 font-mono text-[8px] leading-none">
                    <span className={hasAny ? 'text-[#8fa9c8]' : 'text-[#4a5a72]'}>
                      {label} {sign}{bonus}%
                    </span>
                    <span className="text-[#4a5a72]">{s.units}/{s.max}</span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[#0a0f17]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${fill}%`, background: STAT_COLORS[s.stat], opacity: hasAny ? 1 : 0 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProfileView({ meta, ui, onRenameBuild, onBack }: { meta: MetaSave; ui: UiState; onRenameBuild: (towerId: string, name: string) => void; onBack: () => void }) {
  const rows = collectionRows(meta)
  const hero = AVATARS[ui.avatar.id]
  // итоги коллекции: единицы и потолок — для бейджа «единицы» и общего бара
  let units = 0
  let max = 0
  for (const r of rows) {
    for (const s of r.stats) {
      units += Math.min(s.units, s.max)
      max += s.max
    }
  }
  return (
    <div className="mx-auto w-full max-w-5xl">
      <ViewHeader title="ПРОФИЛЬ" sub="личное дело командира · трофеи кампании · арсенал деталей" onBack={onBack} />

      {/* личное дело: портрет героя в латунной рамке + статы (как карточка героя в Hero Room) */}
      <section className="relative mb-3 overflow-hidden rounded-md border-2 border-[#3a4660] bg-gradient-to-b from-[#172030]/95 to-[#0a0f17]/95 p-4">
        <Rivets />
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded border-2 border-[#8a6a2f]/70 bg-[#0a0f17] shadow-[0_6px_22px_rgba(0,0,0,0.55)]">
              <img src={avatarPortrait(ui.avatar.id, 3)} alt="" className="h-full w-full object-cover object-top" draggable={false} />
            </div>
            <p className="mt-1.5 text-center font-mono text-[8px] uppercase tracking-[0.3em] text-[#5b6f8c]">командир</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-black tracking-wide" style={{ color: hero.color }}>
              {hero.name}
            </p>
            <p className="mb-3 text-[11px] leading-snug text-[#7088a8]">{hero.role}</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <ProfileStat label="победы" value={String(meta.wins)} />
              <ProfileStat label="тракты открыто" value={`${mapProgress(meta)}/${MAP_DEFS.length}`} />
              <ProfileStat label="единицы деталей" value={`${units}/${max}`} />
              <ProfileStat label="коллекция" value={`${collectionDonePct(meta)}%`} color="#e0a832" />
            </div>
          </div>
        </div>
      </section>

      {/* лесенка кампании: живые мини-превью карт, заблокированные — затемнены с замком */}
      <section className="mb-3 rounded-md border border-[#2e3c52] bg-[#101724] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">лесенка кампании</p>
          <Chip tone="dim">тракты {mapProgress(meta)}/{MAP_DEFS.length}</Chip>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MAP_DEFS.map((m, i) => {
            const unlocked = isMapUnlocked(meta, m.id)
            const wins = meta.winsByMap[m.id] ?? 0
            return (
              <div
                key={m.id}
                title={m.feature}
                className={`relative w-[108px] shrink-0 overflow-hidden rounded border ${
                  unlocked ? 'border-[#3a4660]' : 'border-[#25304a]'
                }`}
              >
                <div className={unlocked ? '' : 'opacity-40 grayscale'}>
                  <MapPreview seed={m.seed} w={106} />
                </div>
                <span className="absolute left-1 top-1 rounded bg-[rgba(8,11,17,0.85)] px-1 font-mono text-[8px] font-bold leading-4 text-[#c3cbe0]">
                  {i + 1}
                </span>
                {!unlocked && (
                  <span className="absolute inset-0 flex items-center justify-center bg-[rgba(5,8,13,0.35)]">
                    <Lock size={16} className="text-[#93a9c6]" />
                  </span>
                )}
                <div className="flex items-center justify-between gap-1 bg-[#0d131d] px-1.5 py-1">
                  <span className={`truncate font-mono text-[9px] font-bold ${unlocked ? 'text-[#ccd8e6]' : 'text-[#4a5a72]'}`}>
                    {m.name}
                  </span>
                  {wins > 0 && <span className="font-mono text-[9px] font-bold text-[#e0a832]">★{wins}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* коллекция деталей: сетка карточек башен с прогрессом сбора */}
      <section className="rounded-md border border-[#2e3c52] bg-[#101724] p-3">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">коллекция деталей</p>
          {/* общий прогресс сбора */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-36 overflow-hidden rounded-full border border-[#2e3c52] bg-[#0a0f17]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8a6a2f] to-[#e0c05a] transition-all"
                style={{ width: `${collectionDonePct(meta)}%` }}
              />
            </div>
            <Chip tone="gold">собрано {collectionDonePct(meta)}%</Chip>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-[#7088a8]">
          детали из сундуков усиливают башни в следующих миссиях (в коопе — fair play, без бонусов)
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <CollectionCard
              key={row.towerId}
              towerId={row.towerId}
              stats={row.stats}
              build={meta.builds[row.towerId] ?? null}
              onRename={onRenameBuild}
            />
          ))}
        </div>
      </section>

      {/* ачивки (этап 2): одноразовые сундуки за подвиги — выполненные золотом, прочие серые */}
      <section className="mt-3 rounded-md border border-[#2e3c52] bg-[#101724] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">ачивки</p>
          <Chip tone="gold">взято {ACHIEVEMENTS.filter((a) => isAchieved(meta, a.id)).length}/{ACHIEVEMENTS.length}</Chip>
        </div>
        <p className="mb-3 text-[11px] text-[#7088a8]">
          за каждую новую ачивку — сундук с деталями; берутся один раз
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const done = isAchieved(meta, a.id)
            return (
              <div
                key={a.id}
                title={a.desc}
                className={`flex items-start gap-2 rounded-md border px-2.5 py-2 ${
                  done ? 'border-[#e0a83288] bg-[rgba(224,168,50,0.08)]' : 'border-[#25304a] bg-[#0d131d]'
                }`}
              >
                <span className={`text-[18px] leading-none ${done ? '' : 'opacity-35 grayscale'}`}>{a.icon}</span>
                <div className="min-w-0">
                  <p className={`truncate font-serif text-[12px] font-black leading-tight ${done ? 'text-[#ffd76b]' : 'text-[#4a5a72]'}`}>
                    {a.name}
                  </p>
                  <p className={`text-[10px] leading-snug ${done ? 'text-[#a09470]' : 'text-[#3d4a60]'}`}>{a.desc}</p>
                </div>
                {done && <span className="ml-auto shrink-0 font-mono text-[10px] font-bold text-[#e0a832]">✓</span>}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ─── НАСТРОЙКИ ───────────────────────────────────────────────────────────

function SettingsView(props: MainMenuProps & { onBack: () => void }) {
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <div className="mx-auto w-full max-w-2xl">
      <ViewHeader title="НАСТРОЙКИ" sub="звук, свет и опасная кнопка" onBack={props.onBack} />
      {/* громкости */}
      <div className="mb-3 rounded-md border border-[#2e3c52] bg-[#101724] p-3.5">
        <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.25em] text-[#5b6f8c]">громкость</p>
        <VolumeRow
          label="Музыка"
          value={props.musicVolume}
          onChange={props.onMusicVolume}
          sliderClass="[&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#f2c94c]"
        />
        <VolumeRow
          label="Эффекты"
          value={props.sfxVolume}
          onChange={props.onSfxVolume}
          sliderClass="[&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#7fd0a0]"
        />
        <VolumeRow
          label="Лагерь (фон)"
          value={props.ambientVolume}
          onChange={props.onAmbientVolume}
          sliderClass="[&_[data-slot=slider-track]]:bg-[#3a4660] [&_[data-slot=slider-range]]:bg-[#93a9c6]"
        />
      </div>
      {/* переключатели */}
      <div className="mb-3 rounded-md border border-[#2e3c52] bg-[#101724] p-3.5">
        <div className="flex items-center justify-between gap-3 py-1">
          <div>
            <p className="text-[12px] text-[#ccd8e6]">Без звука</p>
            <p className="text-[10px] text-[#7088a8]">выключает и музыку, и эффекты, и лагерь</p>
          </div>
          <Switch checked={props.muted} onCheckedChange={props.onMute} aria-label="Без звука" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#2e3c52] pt-2.5">
          <div>
            <p className="text-[12px] text-[#ccd8e6]">Динамический свет</p>
            <p className="text-[10px] text-[#7088a8]">можно выключить на слабых устройствах</p>
          </div>
          <Switch checked={props.lighting} onCheckedChange={props.onLighting} aria-label="Динамический свет" />
        </div>
      </div>
      {/* прочее */}
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={props.onToggleFullscreen}
          className="hover-glow h-10 rounded-md border border-[#5b6f8c] bg-transparent px-4 text-[12px] text-[#ccd8e6] transition-colors hover:bg-[#1f2a3b]"
        >
          {props.fullscreen ? '⤢ Выйти из полного экрана' : '⛶ На весь экран'}
        </button>
        <button
          type="button"
          onClick={props.onHelp}
          className="hover-glow h-10 rounded-md border border-[#5b6f8c] bg-transparent px-4 text-[12px] text-[#ccd8e6] transition-colors hover:bg-[#1f2a3b]"
        >
          Как играть
        </button>
      </div>
      {/* опасная зона */}
      <div className="rounded-md border border-[#e0525255] bg-[rgba(30,12,14,0.5)] p-3.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#e05252]">опасная зона</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-sm text-[11px] leading-snug text-[#aebdd2]">
            Сбросить лесенку кампании, победы и коллекцию деталей — необратимо.
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirmReset) {
                props.onResetProgress()
                setConfirmReset(false)
              } else {
                setConfirmReset(true)
              }
            }}
            className={`h-9 shrink-0 rounded-md border-2 px-4 font-mono text-[11px] font-black tracking-wide transition-colors ${
              confirmReset
                ? 'border-[#ff7a7a] bg-[rgba(224,82,82,0.25)] text-[#ffb3b3]'
                : 'border-[#e0525255] text-[#e05252] hover:bg-[rgba(224,82,82,0.12)]'
            }`}
          >
            {confirmReset ? 'точно сбросить?' : 'сбросить прогресс'}
          </button>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[9px] text-[#5b6f8c]">прототип · последняя версия всегда по ссылке у автора</p>
    </div>
  )
}

// ─── общие элементы ──────────────────────────────────────────────────────

function ViewHeader({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#5b6f8c]">командный пункт · сектор</p>
        <p className="font-serif text-2xl font-black tracking-wide text-[#ffc46b]">{title}</p>
        {sub && <p className="mt-0.5 max-w-xl text-[11px] text-[#7088a8]">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="hover-glow h-9 shrink-0 rounded-md border border-[#5b6f8c] bg-transparent px-3 text-[12px] text-[#ccd8e6] transition-colors hover:bg-[#1f2a3b]"
      >
        ← В штаб
      </button>
    </div>
  )
}

/** Латунная панель сектора: заклёпки по углам, золотая рамка у главного сектора */
function Sector({
  icon,
  title,
  sub,
  chips,
  onClick,
  featured,
  wide,
  wideLg,
}: {
  icon: ReactNode
  title: string
  sub: string
  chips: ReactNode
  onClick: () => void
  featured?: boolean
  wide?: boolean
  wideLg?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`hover-glow group relative overflow-hidden rounded-md border-2 bg-gradient-to-b from-[#172030]/95 to-[#0a0f17]/95 p-3 text-left transition-colors ${
        featured
          ? 'border-[#e0a83266] hover:border-[#e0a832]'
          : 'border-[#2e3c52] hover:border-[#4a5f80]'
      } ${wide ? 'col-span-2' : ''} ${wideLg ? 'lg:col-span-2' : ''}`}
      style={{ '--glow': featured ? '#ffd700' : '#93a9c6' } as CSSProperties}
    >
      <Rivets />
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border ${
            featured ? 'border-[#e0a83266] text-[#e0a832]' : 'border-[#3a4660] text-[#93a9c6]'
          }`}
        >
          {icon}
        </span>
        <span className="font-serif text-[15px] font-black tracking-wide text-[#ccd8e6]">{title}</span>
      </div>
      <p className={`mt-2 text-[11px] leading-snug text-[#7088a8] ${wide ? 'sm:pr-24' : 'min-h-[2.4em]'} ${wideLg ? 'lg:pr-24' : ''}`}>{sub}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">{chips}</div>
      <span className="absolute bottom-2 right-2 font-mono text-[12px] font-bold text-[#e0a832] opacity-70 transition-opacity group-hover:opacity-100">
        ▸
      </span>
    </motion.button>
  )
}

/** Четыре заклёпки по углам панели — фирменный «приборный» вид */
function Rivets() {
  const dot = 'pointer-events-none absolute h-1 w-1 rounded-full bg-[#5b6f8c] opacity-70'
  return (
    <>
      <span className={`${dot} left-1.5 top-1.5`} />
      <span className={`${dot} right-1.5 top-1.5`} />
      <span className={`${dot} bottom-1.5 left-1.5`} />
      <span className={`${dot} bottom-1.5 right-1.5`} />
    </>
  )
}

function Chip({ children, tone }: { children: ReactNode; tone: 'dim' | 'gold' | 'green' }) {
  const cls =
    tone === 'gold'
      ? 'border-[#e0a83266] text-[#e0a832]'
      : tone === 'green'
        ? 'border-[#59c27a55] text-[#7fd0a0]'
        : 'border-[#3a4660] text-[#9db4d0]'
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${cls}`}>{children}</span>
}

function VolumeRow({
  label,
  value,
  onChange,
  sliderClass,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  sliderClass: string
}) {
  return (
    <div className="mb-2.5 flex items-center gap-3 last:mb-0">
      <span className="w-28 shrink-0 text-[12px] text-[#ccd8e6]">{label}</span>
      <Slider
        value={[Math.round(value * 100)]}
        min={0}
        max={100}
        step={5}
        onValueChange={(v) => onChange((v[0] ?? 0) / 100)}
        aria-label={label}
        className={`flex-1 ${sliderClass}`}
      />
      <span className="w-10 text-right font-mono text-[10px] font-bold text-[#c3cbe0]">{Math.round(value * 100)}%</span>
    </div>
  )
}

/** Процент собранной коллекции деталей (для плашек профиля и хаба) */
function collectionDonePct(meta: MetaSave): number {
  const rows = collectionRows(meta)
  let units = 0
  let max = 0
  for (const r of rows) {
    for (const s of r.stats) {
      units += Math.min(s.units, s.max)
      max += s.max
    }
  }
  return max > 0 ? Math.round((units / max) * 100) : 0
}

// ─── Живой предпросмотр карты (перенесён из степпера без изменений) ──────
// Запечённый грунт настоящего мира (снег, настил тракта, заражение минералом,
// озеро) + яркая линия маршрута со стрелками хода, вход РАЗЛОМ, выход ЛАГЕРЬ
// и пунктирная вторая тропа. Грунт печётся по одной карте за кадр (очередь),
// кэшируется по зерну; глобальные props мира сохраняются и восстанавливаются.

const groundCache = new Map<number, HTMLCanvasElement>()
let bakeQueue: Promise<void> = Promise.resolve()

function bakeGround(seed: number): HTMLCanvasElement {
  const cached = groundCache.get(seed)
  if (cached) return cached
  // buildBackground переставляет глобальные props/mapLights/roadEnds под новую карту —
  // сохраняем и возвращаем на место, чтобы мир за меню не подменился
  const savedProps = props.slice()
  const savedLights = mapLights.slice()
  const savedEnds = { ...roadEnds }
  const cv = buildBackground(generateMap(seed))
  props.length = 0
  props.push(...savedProps)
  mapLights.length = 0
  mapLights.push(...savedLights)
  Object.assign(roadEnds, savedEnds)
  groundCache.set(seed, cv)
  return cv
}

/** Точка на ломаной по доле пути (для стрелок направления) */
function pointAtFraction(points: Vec[], f: number): { p: Vec; dir: Vec } {
  const lens: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const l = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y)
    lens.push(l)
    total += l
  }
  let rest = total * f
  for (let i = 0; i < lens.length; i++) {
    if (rest <= lens[i]) {
      const t = lens[i] === 0 ? 0 : rest / lens[i]
      const a = points[i]
      const b = points[i + 1]
      return {
        p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        dir: { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) },
      }
    }
    rest -= lens[i]
  }
  const last = points[points.length - 1]
  return { p: last, dir: { x: 1, y: 0 } }
}

function MapPreview({ seed, w = 320 }: { seed: number; w?: number }) {
  const h = Math.round((w * MAP_H) / MAP_W)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    // плейсхолдер, пока печётся грунт
    const c0 = ref.current
    if (c0) {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c0.width = w * dpr
      c0.height = h * dpr
      const ph = c0.getContext('2d')
      if (ph) {
        ph.setTransform(dpr, 0, 0, dpr, 0, 0)
        ph.fillStyle = '#0c111a'
        ph.fillRect(0, 0, w, h)
      }
    }
    bakeQueue = bakeQueue
      .then(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
      .then(() => {
        if (cancelled) return
        const c = ref.current
        if (!c) return
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const ctx = c.getContext('2d')
        if (!ctx) return
        const ground = bakeGround(seed)
        const map = generateMap(seed)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(ground, 0, 0, w, h)
        // настил тракта рисуем поверх ярче — маршрут читается с одного взгляда
        ctx.save()
        ctx.scale(w / MAP_W, h / MAP_H)
        const stroke = (pts: Vec[], width: number, color: string, dash?: number[]) => {
          ctx.beginPath()
          pts.forEach((p, i) => {
            const s = toScreen(p.x, p.y)
            if (i) ctx.lineTo(s.x, s.y)
            else ctx.moveTo(s.x, s.y)
          })
          ctx.lineWidth = width
          ctx.strokeStyle = color
          ctx.lineJoin = 'round'
          ctx.lineCap = 'round'
          if (dash) ctx.setLineDash(dash)
          ctx.stroke()
          ctx.setLineDash([])
        }
        stroke(map.points, 9, 'rgba(20,14,8,0.85)')
        stroke(map.points, 5.5, '#e8c170')
        stroke(map.points, 1.6, 'rgba(255,255,255,0.35)')
        if (map.points2) stroke(map.points2, 4.5, '#7fe0a8', [12, 8])
        // стрелки хода по тракту
        for (const f of [0.35, 0.7]) {
          const { p, dir } = pointAtFraction(map.points, f)
          const s = toScreen(p.x, p.y)
          const s2 = toScreen(p.x + dir.x * 40, p.y + dir.y * 40)
          const ang = Math.atan2(s2.y - s.y, s2.x - s.x)
          ctx.save()
          ctx.translate(s.x, s.y)
          ctx.rotate(ang)
          ctx.fillStyle = 'rgba(20,14,8,0.9)'
          ctx.beginPath()
          ctx.moveTo(2, -7)
          ctx.lineTo(12, 0)
          ctx.lineTo(2, 7)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#ffe9b0'
          ctx.beginPath()
          ctx.moveTo(3, -5)
          ctx.lineTo(10, 0)
          ctx.lineTo(3, 5)
          ctx.closePath()
          ctx.fill()
          ctx.restore()
        }
        // вход (РАЗЛОМ) и выход (ЛАГЕРЬ)
        const dot = (pt: Vec, color: string) => {
          const s = toScreen(pt.x, pt.y)
          ctx.beginPath()
          ctx.arc(s.x, s.y, 11, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(10,8,6,0.55)'
          ctx.fill()
          ctx.beginPath()
          ctx.arc(s.x, s.y, 6.5, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.lineWidth = 2
          ctx.strokeStyle = 'rgba(0,0,0,0.65)'
          ctx.stroke()
        }
        dot(map.points[0], '#a6f095')
        dot(map.points[map.points.length - 1], '#ffb347')
        if (map.points2) dot(map.points2[0], '#7fe0a8')
        ctx.restore()
      })
    return () => {
      cancelled = true
    }
  }, [seed, w, h])
  return <canvas ref={ref} className="block h-auto w-full" aria-hidden />
}
