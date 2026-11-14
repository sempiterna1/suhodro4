'use client'

// Оболочка прототипа: canvas + игровой цикл + ввод + панели + кооп-мультиплеер
// Мультиплеер: host-авторитарная модель. Хост симулирует мир и раздаёт
// снапшоты (10 Гц) через лобби-сервис (socket.io :3003), гость шлёт команды.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Game } from '@/game/engine'
import { clampCamera, render, viewScale, type Skin, type ViewState } from '@/game/render'
import { ALL_DEFS, CELL, MAP_DEFS, MAP_H, MAP_W, defFootprint } from '@/game/config'
import { GRID_H, GRID_W, cellOf, snapToCell } from '@/game/map'
import { insideField, toScreen, toWorld } from '@/game/iso'
import { preloadAssets } from '@/game/assets'
import type { GuestCmd } from '@/game/mp-protocol'
import type { TowerDef, UiState, Vec } from '@/game/types'
import { closeLobby, createLobby, getMpSocket, joinLobby, sendCmd, sendSnap } from '@/lib/mp-client'
import {
  HelpDialog,
  MergePanel,
  MpGuestWait,
  MpLobbyPanel,
  TowerPanel,
  type MpRole,
  type MpStatus,
} from './Panels'
import {
  BuildConfirmButton, CenterNotices, DMG_COLORS, HandTray, HeroButtons, LavkaButton, LavkaModal, PricePlaque, ShopButton, ShopModal, StartButton, TopBar, TowerDamageBoard, WaveBanner, type MenuActions,
} from './Hud'
import { Sfx } from '@/game/audio'
import { towerThumb } from '@/game/pixel'
import { TowerInfoCard } from './TowerInfo'
import { MainMenu } from './MainMenu'
import { MenuBackdrop } from './MenuBackdrop'
import { MoveIcon, TrashIcon } from './icons'
import { useToast } from '@/hooks/use-toast'
import { applyDrop, chestForAchievement, chestForDaily, chestForWin, claimTask, dailyReady, emptyMeta, evaluateAchievements, loadMeta, registerWinTasks, resetMeta, saveMeta, setBuildName, towerMetaBonus, unlockNextMap, type MetaSave } from '@/game/meta'
import { ACHIEVEMENTS, CHESTS, PART_BY_ID } from '@/game/data/meta'
import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'

/** Награда победы: сундук из метапрогрессии и его детали (docs/meta.md); achievementId — сундук за ачивку */
interface MetaRewardDrop {
  chest: string
  parts: Array<{ partId: string; units: number }>
  achievementId?: string
}

/**
 * Навести камеру на поле. Десктоп — вся карта режимом «cover» (накрывает экран, излишек обрезан,
 * края доступны панорамой). Телефон — ромб поля (~940×510 с утёсом, центр 480·330) крупно и
 * накрытый экраном целиком; остальное видно сдвигом пальцем или щипком.
 */
function frameField(v: ViewState) {
  // масштаб «cover» при z=1: карта уже накрывает холст
  const fit = Math.max(v.vw / MAP_W, v.vh / MAP_H)
  if (window.matchMedia('(min-width: 1024px)').matches) {
    // компьютер: вся карта, обрезанная под окно
    v.cam.z = 1
    clampCamera(v)
    return
  }
  // ромб поля должен накрыть экран: зум, при котором 940×510 не уже окна
  v.cam.z = Math.max(1, Math.min(3, Math.max(v.vw / (940 * fit), v.vh / (510 * fit))))
  const sc = fit * v.cam.z
  v.cam.x = 480 - v.vw / sc / 2
  v.cam.y = 330 - v.vh / sc / 2
  clampCamera(v)
}

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // по умолчанию выбрана первая карта реестра — зерно 0 детерминировано,
  // поэтому SSR и клиент получают одинаковое состояние (гидратация не расходится)
  const [game] = useState(() => {
    const g = new Game()
    g.selectMap(MAP_DEFS[0].seed)
    return g
  })

  const [ui, setUi] = useState<UiState>(() => game.getUiState())
  const [selectedTower, setSelectedTower] = useState<number | null>(null)
  // башня, выбранная в арсенале для постройки (перетаскиванием или нажатием)
  const [armed, setArmed] = useState<string | null>(null)
  // башня, взятая в «стол» из руки: индекс в ui.hand (копия ставится на клетку или качает башню)
  const [armedHand, setArmedHand] = useState<number | null>(null)
  // магазин — окно по центру, открывается кнопкой в нижней панели (арсенал не закреплён на экране)
  const [shopOpen, setShopOpen] = useState(false)
  const shopOpenRef = useRef(false)
  const [lavkaOpen, setLavkaOpen] = useState(false)
  const lavkaOpenRef = useRef(false)
  useEffect(() => {
    shopOpenRef.current = shopOpen
  }, [shopOpen])
  useEffect(() => {
    lavkaOpenRef.current = lavkaOpen
  }, [lavkaOpen])
  // клетка, выбранная под постройку (центр клетки); башня ставится только кнопкой ✓
  const [buildCell, setBuildCell] = useState<Vec | null>(null)
  const [mergeFrom, setMergeFrom] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [skin, setSkin] = useState<Skin>('steam')
  const { toast } = useToast()

  // ─── Звук: синтез Web Audio; включается после первого жеста, выбор «без звука» запоминается ───
  const [sfx] = useState(() => new Sfx())
  const [muted, setMuted] = useState(false)
  // громкости для слайдеров меню; хранилище и применение — в Sfx (zr-music / zr-sfx / zr-ambient).
  // Начальное значение должно совпадать с серверным (localStorage есть только в браузере) —
  // сохранённые значения подтягиваются после монтирования, иначе гидратация расходится.
  const readStoredVolume = (key: string, fallback: number) => {
    try {
      const raw = window.localStorage.getItem(key)
      const v = Number(raw)
      return raw !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback
    } catch {
      return fallback
    }
  }
  const [musicVolume, setMusicVolume] = useState(0.35)
  const [sfxVolume, setSfxVolume] = useState(1)
  const [ambientVolume, setAmbientVolume] = useState(0.6)
  const [volReady, setVolReady] = useState(false)
  useEffect(() => {
    let saved = false
    try {
      saved = window.localStorage.getItem('zr-muted') === '1'
    } catch {
      // хранилище недоступно — звук по умолчанию включён
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage доступен только после монтирования
    if (saved) setMuted(true)
    const unlock = () => sfx.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [sfx])
  // ─── Динамический свет: можно выключить на слабых устройствах, выбор запоминается ───
  const [lighting, setLighting] = useState(true)
  useEffect(() => {
    let off = false
    try {
      off = window.localStorage.getItem('zr-light') === '0'
    } catch {
      // хранилище недоступно — свет включён
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage доступен только после монтирования
    if (off) setLighting(false)
  }, [])

  useEffect(() => {
    sfx.setMuted(muted)
    try {
      window.localStorage.setItem('zr-muted', muted ? '1' : '0')
    } catch {
      // не запомнили — не страшно
    }
  }, [muted, sfx])

  // подтягиваем сохранённые громкости после монтирования; до этого применение закрыто,
  // чтобы дефолты не перезаписали значения в localStorage раньше чтения
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage доступен только после монтирования
    setMusicVolume(readStoredVolume('zr-music', 0.35))
    setSfxVolume(readStoredVolume('zr-sfx', 1))
    setAmbientVolume(readStoredVolume('zr-ambient', 0.6))
    setVolReady(true)
  }, [])

  // применение громкостей к аудио-графу (Sfx сам пишет их в localStorage)
  useEffect(() => {
    if (volReady) sfx.setMusicVolume(musicVolume)
  }, [volReady, musicVolume, sfx])
  useEffect(() => {
    if (volReady) sfx.setSfxVolume(sfxVolume)
  }, [volReady, sfxVolume, sfx])
  useEffect(() => {
    if (volReady) sfx.setAmbientVolume(ambientVolume)
  }, [volReady, ambientVolume, sfx])

  // ─── Мультиплеер ────────────────────────────────────────────────────────
  const [mpRole, setMpRole] = useState<MpRole>('single')
  const [mpCode, setMpCode] = useState<string | null>(null)
  const [mpStatus, setMpStatus] = useState<MpStatus>('off')
  const [mpHostLeft, setMpHostLeft] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const roleRef = useRef<MpRole>('single')
  const codeRef = useRef<string | null>(null)
  // фаза в рефе для игрового цикла: на интро рендер мира пропускаем — холст закрыт чертёжным фоном меню
  const introRef = useRef(ui.phase === 'intro')

  // ─── Метапрогрессия «Верстак» (docs/meta.md): сейв, бонусы башен, награда за победу ───
  // Начальное значение — пустой сейв (совпадает с серверным), сейв читается после монтирования.
  const [meta, setMeta] = useState<MetaSave>(() => emptyMeta())
  const metaRef = useRef(meta)
  // награда победы: сундуки с деталями (показывается на экране результата)
  const [metaReward, setMetaReward] = useState<MetaRewardDrop[] | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сейв читается после монтирования (localStorage только в браузере)
    setMeta(loadMeta())
  }, [])
  useEffect(() => {
    metaRef.current = meta
  }, [meta])
  // бонусы коллекции применяются к движку только в одиночке: кооп — fair play (docs/meta.md)
  useEffect(() => {
    game.setMetaBonus(mpRole === 'single' ? (towerId) => towerMetaBonus(metaRef.current, towerId) : null)
  }, [game, mpRole])
  // победа: лесенка карт, сундуки (первое прохождение/повтор/дневной), сейв
  const prevPhaseRef = useRef(ui.phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = ui.phase
    if (ui.phase !== 'won' || prev === 'won' || mpRole === 'guest') return
    const m: MetaSave = {
      ...metaRef.current,
      parts: { ...metaRef.current.parts },
      unlocked: [...metaRef.current.unlocked],
      winsByMap: { ...metaRef.current.winsByMap },
      daily: { ...metaRef.current.daily, maps: { ...metaRef.current.daily.maps }, claimed: [...metaRef.current.daily.claimed] },
    }
    const mapId = game.mapDef.id
    m.wins += 1
    m.winsByMap[mapId] = (m.winsByMap[mapId] ?? 0) + 1
    // задачи дня (сектор СОБЫТИЯ хаба): победы и разнообразие карт
    registerWinTasks(m, mapId)
    const drops: MetaRewardDrop[] = []
    const winDrop = chestForWin(m, mapId)
    if (winDrop) {
      applyDrop(m, winDrop)
      drops.push(winDrop)
    }
    // ачивки (этап 2): одноразовые сундуки за подвиги миссии — по итогам этой победы
    for (const ach of evaluateAchievements(m, {
      leaked: game.stats.leaked,
      merges: game.stats.merges,
      difficulty: game.difficultyDef.id,
      wins: m.wins,
      winsByMap: m.winsByMap,
      parts: m.parts,
      unlocked: m.unlocked,
    })) {
      const drop = chestForAchievement(ach)
      applyDrop(m, drop)
      drops.push({ ...drop, achievementId: ach.id })
      toast({ title: `${ach.icon} Ачивка: ${ach.name}`, description: `${ach.desc} — сундук с деталями.` })
    }
    // дневной сундук теперь вручную — кнопка «Забрать» в секторе СОБЫТИЯ главного меню
    const unlockedId = unlockNextMap(m, mapId)
    saveMeta(m)
    setMeta(m)
    setMetaReward(drops.length > 0 ? drops : null)
    if (unlockedId) {
      const next = MAP_DEFS.find((d) => d.id === unlockedId)
      if (next) toast({ title: 'Открыта новая карта', description: `${next.name}: ${next.feature}` })
    }
  }, [ui.phase, mpRole, game, toast])
  // дневной сундук: вручную в секторе СОБЫТИЯ (кнопка «Забрать»), сейв пишет оболочка
  const doClaimDaily = useCallback(() => {
    const m: MetaSave = { ...metaRef.current, parts: { ...metaRef.current.parts }, daily: { ...metaRef.current.daily } }
    if (!dailyReady(m)) return
    const daily = chestForDaily(m)
    applyDrop(m, daily)
    m.dailyAt = Date.now()
    saveMeta(m)
    setMeta(m)
    toast({
      title: '🧰 Дневной сундук',
      description: daily.parts.map(({ partId, units }) => `${PART_BY_ID[partId]?.name ?? partId} ×${units}`).join(' · '),
    })
  }, [toast])
  // награда задачи дня (задача уже проверена на выполнимость в claimTask)
  const doClaimTask = useCallback((taskId: string) => {
    const m: MetaSave = {
      ...metaRef.current,
      parts: { ...metaRef.current.parts },
      daily: { ...metaRef.current.daily, maps: { ...metaRef.current.daily.maps }, claimed: [...metaRef.current.daily.claimed] },
    }
    const drop = claimTask(m, taskId)
    if (!drop) return
    applyDrop(m, drop)
    saveMeta(m)
    setMeta(m)
    toast({
      title: 'Задача дня выполнена',
      description: drop.parts.map(({ partId, units }) => `${PART_BY_ID[partId]?.name ?? partId} ×${units}`).join(' · '),
    })
  }, [toast])
  // опасная кнопка настроек: лесенка кампании и коллекция — в ноль
  const doResetProgress = useCallback(() => {
    resetMeta()
    setMeta(loadMeta())
    toast({ title: 'Прогресс сброшен', description: 'Лесенка кампании, победы и коллекция деталей очищены.' })
  }, [toast])
  // имя билда башни (ПРОФИЛЬ → коллекция): сейв пишет оболочка
  const doRenameBuild = useCallback((towerId: string, name: string) => {
    const m: MetaSave = { ...metaRef.current, builds: { ...metaRef.current.builds } }
    setBuildName(m, towerId, name)
    saveMeta(m)
    setMeta(m)
    const defName = ALL_DEFS[towerId]?.name ?? towerId
    toast({
      title: name.trim() ? 'Билд назван' : 'Имя билда сброшено',
      description: name.trim() ? `${defName}: «${name.trim().slice(0, 24)}»` : `${defName} вернулась к заводскому имени.`,
    })
  }, [toast])
  const mpHostLeftRef = useRef(false)
  const movedHintShown = useRef(false)

  useEffect(() => {
    roleRef.current = mpRole
  }, [mpRole])
  // интро-фаза для цикла: меню закрывает холст чертёжным фоном
  useEffect(() => {
    introRef.current = ui.phase === 'intro'
  }, [ui.phase])
  useEffect(() => {
    codeRef.current = mpCode
  }, [mpCode])

  const viewRef = useRef<ViewState>({
    cam: { z: 1, x: 0, y: 0 },
    vw: MAP_W,
    vh: MAP_H,
    skin: 'steam',
    lighting: true,
    hoverTower: null,
    selectedTower: null,
    mergeFrom: null,
    mouse: null,
    buildGhost: null,
  })
  const panelRef = useRef<HTMLDivElement>(null)
  const selRef = useRef(selectedTower)
  const mergeRef = useRef(mergeFrom)
  const armedRef = useRef(armed)
  const armedHandRef = useRef(armedHand)
  const buildCellRef = useRef<Vec | null>(null)
  const cellsRef = useRef<Vec[]>([])
  // id башни, которую переносят (режим постройки с её клеткой в качестве старта)
  const movingRef = useRef<number | null>(null)
  const [isMoving, setIsMoving] = useState(false)
  // призрак перетаскивают пальцем или мышью
  const ghostDragRef = useRef(false)

  useEffect(() => {
    selRef.current = selectedTower
  }, [selectedTower])
  useEffect(() => {
    mergeRef.current = mergeFrom
  }, [mergeFrom])
  useEffect(() => {
    armedRef.current = armed
    armedHandRef.current = armed ? armedHandRef.current : null
    if (!armed) {
      viewRef.current.buildGhost = null
      buildCellRef.current = null
      movingRef.current = null
      // eslint-disable-next-line react-hooks/set-state-in-effect -- режим закрыт
      setIsMoving(false)
      setBuildCell(null)
    }
  }, [armed])
  useEffect(() => {
    armedHandRef.current = armedHand
  }, [armedHand])

  /** Полный выход из режима постройки: снять башню и со стола, и с руки */
  const disarm = () => {
    armedRef.current = null
    armedHandRef.current = null
    setArmedHand(null)
    setArmed(null)
  }

  // ─── Скин башен: ?skin=lol|steam в ссылке, иначе — последний выбор в этом браузере ───
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('skin')
    let saved: string | null = null
    try {
      saved = window.localStorage.getItem('zr-skin')
    } catch {
      // хранилище недоступно (приватный режим) — просто не запоминаем
    }
    const initial = param ?? saved
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage доступен только после монтирования
    if (initial === 'lol' || initial === 'steam') setSkin(initial)
  }, [])
  useEffect(() => {
    viewRef.current.skin = skin
    try {
      window.localStorage.setItem('zr-skin', skin)
    } catch {
      // не запомнили — не страшно
    }
  }, [skin])
  // свет: эффект стоит после объявления viewRef — иначе React-компилятор запрещает его менять
  useEffect(() => {
    viewRef.current.lighting = lighting
    try {
      window.localStorage.setItem('zr-light', lighting ? '1' : '0')
    } catch {
      // не запомнили — не страшно
    }
  }, [lighting])

  // ─── Настройка canvas ( retina ) ───────────────────────────────────────
  // Холст всегда заполняет весь экран: камера держит карту режимом «cover», так что
  // чёрных полей нет ни при каком соотношении сторон. Излишек карты доступен панорамой.
  const portraitRef = useRef<boolean | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fitCanvas = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
      const v = viewRef.current
      v.vw = w
      v.vh = h
      // при первом показе и при повороте телефона — заново навести камеру на поле
      const portrait = h > w * 0.9
      const firstFit = portraitRef.current === null
      if (portraitRef.current !== portrait || firstFit) {
        portraitRef.current = portrait
        frameField(v)
      }
      clampCamera(v)
    }
    fitCanvas()
    const ro = new ResizeObserver(fitCanvas)
    ro.observe(canvas)
    preloadAssets() // спрайты из листов референса грузятся заранее, пока игрок в меню
    return () => ro.disconnect()
  }, [])

  // ─── Гость: авто-подключение по ссылке /?lobby=КОД ─────────────────────
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('lobby')
    if (!param) return
    let cancelled = false
    const code = param.trim().toUpperCase()
    // setState откладываем в микротаск: линт запрещает синхронные вызовы в теле эффекта,
    // а игроку достаточно, что статус «ждём хоста» появится на первом кадре подключения
    queueMicrotask(() => {
      mpHostLeftRef.current = false
      setMpRole('guest')
      setMpCode(code)
      setMpStatus('waiting')
    })
    joinLobby(code).then((res) => {
      if (cancelled) return
      if (res.ok) {
        if (res.snap) game.applySnap(res.snap)
        toast({ title: `Лобби ${code}`, description: 'Вы подключились как второй игрок' })
      } else {
        toast({ title: 'Не удалось подключиться', description: res.error, variant: 'destructive' })
        setMpRole('single')
        setMpCode(null)
        setMpStatus('off')
      }
    })
    return () => {
      cancelled = true
    }
     
  }, [])

  // ─── Сокет-события мультиплеера ─────────────────────────────────────────
  useEffect(() => {
    const s = getMpSocket()
    const onSnap = (snap: Parameters<Game['applySnap']>[0]) => {
      if (roleRef.current !== 'guest') return
      game.applySnap(snap)
      if (!mpHostLeftRef.current) setMpStatus('linked')
    }
    const onCmd = (cmd: GuestCmd) => {
      if (roleRef.current !== 'host') return
      game.applyGuestCmd(cmd)
    }
    const onGuestJoined = () => {
      if (roleRef.current !== 'host') return
      game.setCoop(true)
      setMpStatus('linked')
      toast({ title: 'Друг подключился!', description: 'HP волн ×1.85 (кооп GDD)' })
    }
    const onGuestLeft = () => {
      if (roleRef.current !== 'host') return
      game.setCoop(false)
      setMpStatus('waiting')
      toast({ title: 'Гость отключился', description: 'HP волн вернулись к одиночным' })
    }
    const onHostLeft = () => {
      if (roleRef.current !== 'guest') return
      mpHostLeftRef.current = true
      setMpHostLeft(true)
    }
    s.on('snap', onSnap)
    s.on('cmd', onCmd)
    s.on('guest:joined', onGuestJoined)
    s.on('guest:left', onGuestLeft)
    s.on('host:left', onHostLeft)
    return () => {
      s.off('snap', onSnap)
      s.off('cmd', onCmd)
      s.off('guest:joined', onGuestJoined)
      s.off('guest:left', onGuestLeft)
      s.off('host:left', onHostLeft)
    }
     
  }, [game])

  // гость уходит со страницы — освобождаем слот
  useEffect(() => {
    const leave = () => {
      if (roleRef.current === 'guest' && codeRef.current) {
        getMpSocket().emit('guest:leave')
      }
    }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [])

  // ─── Хост: рассылка снапшотов 10 Гц ─────────────────────────────────────
  useEffect(() => {
    if (mpRole !== 'host' || !mpCode) return
    const iv = setInterval(() => {
      sendSnap(mpCode, game.serialize())
    }, 100)
    return () => clearInterval(iv)
  }, [mpRole, mpCode, game])

  // тик режима постройки подменяется на каждой отрисовке: цикл ниже создаётся один раз
  const buildTickRef = useRef<(dt: number) => void>(() => {})

  // ─── Игровой цикл (единственный, устойчивый к HMR) ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = window as unknown as { __tdRaf?: number }
    // убиваем осиротевший цикл после Fast Refresh / remount
    if (w.__tdRaf) cancelAnimationFrame(w.__tdRaf)
    let last = performance.now()
    let uiAcc = 1 // форсируем первое обновление UI
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (roleRef.current === 'guest') game.guestTick(dt)
      else game.update(dt)
      // на интро холст закрыт чертёжным фоном меню — отрисовку мира не тратим
      if (!introRef.current) {
        viewRef.current.selectedTower = selRef.current
        viewRef.current.mergeFrom = mergeRef.current
        render(canvas.getContext('2d') ?? ctx, game, viewRef.current)
        sfx.tick(game)
        buildTickRef.current(dt)
      }
      uiAcc += dt
      if (uiAcc >= 0.12) {
        uiAcc = 0
        setUi(game.getUiState())
      }
      w.__tdRaf = requestAnimationFrame(loop)
    }
    w.__tdRaf = requestAnimationFrame(loop)
    return () => {
      if (w.__tdRaf) {
        cancelAnimationFrame(w.__tdRaf)
        w.__tdRaf = undefined
      }
    }
  }, [game])

  // ─── Скролл к панели на мобильных ──────────────────────────────────────
  useEffect(() => {
    if (window.innerWidth < 1024 && (selectedTower !== null || mergeFrom !== null)) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedTower, mergeFrom])

  // ─── Ввод ──────────────────────────────────────────────────────────────
  // Камера изометрическая: точка на холсте → точка на земле поля (iso.ts). Вне ромба поля точка
  // тоже считается — так Сорока может дойти до края, а постройка там просто не пройдёт.
  /** Точка окна → точка холста 960×600 с учётом приближения и сдвига камеры */
  const toCanvas = (clientX: number, clientY: number, r: DOMRect) => {
    const v = viewRef.current
    const sc = viewScale(v)
    return { x: v.cam.x + (clientX - r.left) / sc, y: v.cam.y + (clientY - r.top) / sc }
  }
  const toMap = (e: React.PointerEvent<HTMLCanvasElement>): Vec => {
    const c = toCanvas(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
    return toWorld(c.x, c.y)
  }

  /** Башня под курсором: башни высокие, поэтому попадание считаем по силуэту на экране.
   *  Силуэт масштабируется с зумом камеры — иначе на приближенной карте клик по видимой башне мимо зоны попадания */
  const towerAt = (p: Vec): number | null => {
    const m = toScreen(p.x, p.y)
    const k = viewScale(viewRef.current)
    let best: number | null = null
    let bestY = -Infinity
    for (const tw of game.towers) {
      const s = toScreen(tw.x, tw.y)
      // ближняя к зрителю башня перекрывает дальнюю — берём ту, что ниже на экране
      if (Math.abs(m.x - s.x) <= 22 * k && m.y >= s.y - 58 * k && m.y <= s.y + 14 * k && s.y > bestY) {
        best = tw.id
        bestY = s.y
      }
    }
    return best
  }

  /** Тап по клетке с башней: запасной хит-тест, когда точка ниже силуэта (земля перед основанием) */
  const towerAtCell = (p: Vec): number | null => {
    const c = cellOf(p.x, p.y)
    const tw = game.towers.find((t) => {
      const tc = cellOf(t.x, t.y)
      return tc.cx === c.cx && tc.cy === c.cy
    })
    return tw ? tw.id : null
  }

  /** Основание башни: маленький бокс у подножия — широкий силуэт не должен перекрывать соседние клетки */
  const towerCoreAt = (p: Vec): number | null => {
    const m = toScreen(p.x, p.y)
    const k = viewScale(viewRef.current)
    let best: number | null = null
    let bestY = -Infinity
    for (const tw of game.towers) {
      const s = toScreen(tw.x, tw.y)
      if (Math.abs(m.x - s.x) <= 15 * k && m.y >= s.y - 20 * k && m.y <= s.y + 10 * k && s.y > bestY) {
        best = tw.id
        bestY = s.y
      }
    }
    return best
  }

  /** Цель для копии из руки: клетка башни или её основание — чтобы ставить на соседние клетки рядом с башнями */
  const towerTargetAt = (p: Vec): number | null => towerAtCell(p) ?? towerCoreAt(p)

  /** Экранные координаты → точка поля; null — вне холста или вне ромба поля */
  const clientToMap = (clientX: number, clientY: number): Vec | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const r = canvas.getBoundingClientRect()
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null
    const c = toCanvas(clientX, clientY, r)
    const p = toWorld(c.x, c.y)
    return insideField(p) ? p : null
  }

  // ─── Камера: колесо и щипок — приближение, протяжка ЛКМ или пальцем — сдвиг ───
  // На компьютере до ×2, на телефоне до ×3. Короткое касание без сдвига — обычный клик.
  const panRef = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ d0: number; z0: number; wx: number; wy: number } | null>(null)
  // палец: один — только тап (герой идёт / выбор клетки), два — щипок и сдвиг карты
  const refreshBuildRef = useRef<() => void>(() => {})
  const tapRef = useRef<{ x: number; y: number } | null>(null)
  const maxZoom = () => (window.matchMedia('(min-width: 1024px)').matches ? 2 : 3)
  /** Приблизить к точке экрана (px, py — от угла холста): точка карты под ней остаётся на месте */
  const zoomAt = (z: number, px: number, py: number, wx?: number, wy?: number) => {
    const v = viewRef.current
    const s0 = viewScale(v)
    const ax = wx ?? v.cam.x + px / s0
    const ay = wy ?? v.cam.y + py / s0
    v.cam.z = Math.max(1, Math.min(maxZoom(), z))
    const s1 = viewScale(v)
    v.cam.x = ax - px / s1
    v.cam.y = ay - py / s1
    clampCamera(v)
  }
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      zoomAt(viewRef.current.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  /** Карта целиком в экране — сдвигать нечего */
  const mapFits = () => {
    const v = viewRef.current
    const sc = viewScale(v)
    return v.vw / sc >= MAP_W - 1 && v.vh / sc >= MAP_H - 1
  }

  /** Нажатие: мышью на неприближенной карте — сразу клик; иначе это может стать сдвигом или щипком */
  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      // второй палец — щипок: запоминаем расстояние и точку карты под серединой
      const [p1, p2] = [...pointers.current.values()]
      const r = e.currentTarget.getBoundingClientRect()
      const w = toCanvas((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, r)
      pinchRef.current = { d0: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1, z0: viewRef.current.cam.z, wx: w.x, wy: w.y }
      panRef.current = null
      tapRef.current = null
      return
    }
    const g = viewRef.current.buildGhost
    if (armedRef.current && g && e.button === 0) {
      const p = toMap(e)
      // тап по башне с копией из руки — это прокачка/подсказка (handleTap), а не перетаскивание призрака:
      // иначе нажатие «копию на башню» съедается переносом призрака на соседнюю клетку
      const overTower = armedHandRef.current !== null && towerTargetAt(p) !== null
      if (!overTower && Math.hypot(p.x - g.x, p.y - g.y) <= CELL * 1.3) {
        ghostDragRef.current = true // взяли призрак — тянем по клеткам
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // указатель уже отпущен
        }
        return
      }
    }
    if (e.pointerType === 'touch') {
      tapRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    if (e.button !== 0 || (e.pointerType === 'mouse' && mapFits())) {
      handleTap(e)
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId) // протяжка не обрывается, если палец ушёл с холста
    } catch {
      // указатель уже отпущен — сдвиг всё равно работает, пока он над холстом
    }
    const cam = viewRef.current.cam
    panRef.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }
  }
  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId)
    if (ghostDragRef.current) {
      ghostDragRef.current = false
      // бросок копии на башню: такая же — прокачка (+1 уровень), а не просто перенос призрака на соседнюю клетку
      if (armedHandRef.current !== null) {
        const tid = towerTargetAt(toMap(e))
        if (tid !== null) applyHandToTower(tid)
      }
      return
    }
    if (pinchRef.current) {
      if (pointers.current.size < 2) pinchRef.current = null
      panRef.current = null
      return
    }
    if (e.pointerType === 'touch') {
      const tap = tapRef.current
      tapRef.current = null
      if (tap && e.type === 'pointerup') handleTap(e)
      return
    }
    const pan = panRef.current
    panRef.current = null
    if (pan && !pan.moved && e.type === 'pointerup') handleTap(e)
  }

  // всплывающая карточка башни под курсором (только мышь): позиция правится напрямую, без перерисовки всей оболочки
  const [tip, setTip] = useState<{ id: number; defId: string; level: number } | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const tipMouse = useRef<{ x: number; y: number } | null>(null)
  const placeTip = () => {
    const el = tipRef.current, m = tipMouse.current
    if (!el || !m) return
    const w = el.offsetWidth, h = el.offsetHeight
    let x = m.x + 20
    if (x + w > window.innerWidth - 8) x = m.x - 20 - w // у правого края — слева от курсора
    const y = Math.max(8, Math.min(window.innerHeight - h - 8, m.y - 28))
    el.style.left = Math.max(8, x) + 'px'
    el.style.top = y + 'px'
  }
  useLayoutEffect(placeTip, [tip])
  const updateTip = (e: React.PointerEvent, id: number | null) => {
    if (e.pointerType !== 'mouse') return
    tipMouse.current = { x: e.clientX, y: e.clientY }
    const tw = id !== null ? game.towerById(id) : undefined
    setTip((prev) => (!tw ? (prev ? null : prev) : prev && prev.id === tw.id && prev.level === tw.level ? prev : { id: tw.id, defId: tw.defId, level: tw.level }))
    placeTip()
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pinch = pinchRef.current
    if (pinch && pointers.current.size >= 2) {
      const [p1, p2] = [...pointers.current.values()]
      const r = e.currentTarget.getBoundingClientRect()
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y)
      zoomAt((pinch.z0 * d) / pinch.d0, (p1.x + p2.x) / 2 - r.left, (p1.y + p2.y) / 2 - r.top, pinch.wx, pinch.wy)
      return
    }
    if (ghostDragRef.current) {
      const q = toMap(e)
      const at = snapToCell(q.x, q.y)
      const cell = cellsRef.current.find((c) => c.x === at.x && c.y === at.y)
      const cur = buildCellRef.current
      if (cell && (!cur || cell.x !== cur.x || cell.y !== cur.y)) {
        buildCellRef.current = cell
        setBuildCell(cell)
        refreshBuildRef.current()
      }
      return
    }
    if (e.pointerType === 'touch') {
      const tap = tapRef.current
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) tapRef.current = null // палец поехал — это не тап
      return
    }
    const pan = panRef.current
    if (pan) {
      if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 8) pan.moved = true
      if (pan.moved) {
        const v = viewRef.current
        const sc = viewScale(v)
        v.cam.x = pan.cx - (e.clientX - pan.x) / sc
        v.cam.y = pan.cy - (e.clientY - pan.y) / sc
        clampCamera(v)
        return
      }
    }
    const p = toMap(e)
    viewRef.current.mouse = p
    // подсветка под курсором: обычный режим — широкий силуэт (выделение);
    // копия из руки вооружена — та же цель, что и клик (клетка/основание), чтобы не перекрывать соседние клетки
    const hid = !armedRef.current ? towerAt(p) : armedHandRef.current !== null ? towerTargetAt(p) : null
    viewRef.current.hoverTower = hid
    updateTip(e, hid)
  }

  const handleLeave = () => {
    setTip(null)
    viewRef.current.mouse = null
    viewRef.current.hoverTower = null
  }

  // ─── Постройка: покупка → «рука» → клетка/башня → ✓ ───

  // Esc / ПКМ — отменить выбор башни (в disarm() уже внутри handleTap); Esc сначала закрывает окна
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (shopOpenRef.current) setShopOpen(false)
        else if (lavkaOpenRef.current) setLavkaOpen(false)
        else disarm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /** Копия из руки на башне: такая же — прокачка (+1 уровень), другая — подсказка. Основная механика */
  const applyHandToTower = (tid: number) => {
    const tw = game.towerById(tid)
    const armedDefId = armedRef.current
    if (!tw || !armedDefId || armedHandRef.current === null) return
    const name = ALL_DEFS[armedDefId]?.name ?? 'башня'
    if (tw.defId !== armedDefId) {
      errToast('Слияние только на поле', `Копия «${name}» качает только точно такую же башню`)
      return
    }
    const idx = armedHandRef.current
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'levelHand', idx, id: tid })
    } else {
      const res = game.levelFromHand(idx, tid)
      if (!res.ok && res.error) errToast('Прокачка недоступна', res.error)
      setUi(game.getUiState())
    }
    disarm()
  }

  const handleTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toMap(e)
    // режим постройки: тап по свободной клетке переносит призрак; ставит только ✓
    if (armedRef.current) {
      if (e.button === 2) {
        disarm() // правая кнопка — отмена
        return
      }
      // рука: тап по точно такой же башне — сразу прокачка; по другой — подсказка
      if (armedHandRef.current !== null) {
        const tid = towerTargetAt(p)
        if (tid !== null) {
          applyHandToTower(tid)
          return
        }
      }
      if (insideField(p)) {
        const at = snapToCell(p.x, p.y)
        const cell = cellsRef.current.find((c) => c.x === at.x && c.y === at.y)
        if (cell) {
          buildCellRef.current = cell
          setBuildCell(cell)
          refreshBuildRef.current()
        }
      }
      return
    }
    const tid = towerAt(p)

    if (tid !== null) {
      if (mergeFrom !== null) {
        const from = mergeFrom
        if (from === tid) {
          setMergeFrom(null)
          return
        }
        const recipe = game.canMerge(from, tid)
        if (recipe) {
          if (roleRef.current === 'guest') {
            sendCmd(codeRef.current!, { t: 'merge', a: from, b: tid })
            toast({ title: `${recipe.glyph} ${recipe.name}`, description: 'Команда слияния отправлена хосту' })
          } else {
            game.merge(from, tid)
            toast({ title: `${recipe.glyph} ${recipe.name}`, description: 'Башни слиты в уникальную!' })
          }
          setMergeFrom(null)
          setSelectedTower(null)
        } else {
          toast({
            title: 'Слияние невозможно',
            description: game.mergeError(from, tid) ?? 'Эти башни не сливаются',
            variant: 'destructive',
          })
        }
        return
      }
      setSelectedTower((prev) => (prev === tid ? null : tid))
      return
    }

    // пустая земля: снять выделение и отправить туда Охотницу
    if (mergeFrom !== null) {
      setMergeFrom(null)
      return
    }
    if (ui.phase === 'intro') return
    if (selectedTower !== null) {
      setSelectedTower(null)
      return
    }
    // Сорока одна — ею управляет только хост
    if (roleRef.current === 'guest') {
      if (!movedHintShown.current) {
        movedHintShown.current = true
        toast({ title: 'Охотницей управляет хост', description: 'Стройте башни — это тоже важно!' })
      }
      return
    }
    game.moveAvatar({ x: Math.max(4, Math.min(MAP_W - 4, p.x)), y: Math.max(4, Math.min(MAP_H - 4, p.y)) })
  }

  // ─── Действия панелей ──────────────────────────────────────────────────
  const errToast = (title: string, error?: string) =>
    toast({ title, description: error, variant: 'destructive' })

  const asGuest = mpRole === 'guest'


  const doSell = () => {
    if (selectedTower === null) return
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'sell', id: selectedTower })
      setSelectedTower(null)
      return
    }
    const res = game.sell(selectedTower)
    if (res.ok) setSelectedTower(null)
    else if (res.error) errToast('Продажа не удалась', res.error)
  }

  const doAbility = () => {
    const res = game.useAbility()
    if (!res.ok && res.error) errToast(game.av.abilityName, res.error)
  }

  const doStartWave = () => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'startWave' })
      return
    }
    game.startWave()
  }

  const doSpeed = () => {
    const next = ui.speed >= 3 ? 1 : ui.speed + 1
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'setSpeed', speed: next })
      return
    }
    game.setSpeed(next)
  }

  const doPause = () => {
    if (ui.phase === 'intro' || ui.phase === 'over' || ui.phase === 'won') return
    const next = !game.paused
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'setPaused', paused: next })
      return
    }
    game.setPaused(next)
    setUi(game.getUiState())
  }

  const doInfiniteGold = () => {
    const next = !game.infiniteGold
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'setInfiniteGold', on: next })
      return
    }
    game.setInfiniteGold(next)
    setUi(game.getUiState())
  }

  const doRoll = () => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'roll' })
      return
    }
    const res = game.roll()
    if (!res.ok && res.error) errToast('Ролл недоступен', res.error)
    setUi(game.getUiState())
  }

  // Лавка предметов: хост исполняет сам, гость шлёт команду (снапшот всё синхронизирует)
  const doItemBuy = (idx: number) => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'itemBuy', idx })
      return
    }
    const res = game.buyItem(idx)
    if (!res.ok && res.error) errToast('Покупка невозможна', res.error)
    setUi(game.getUiState())
  }
  const doItemSell = (idx: number) => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'itemSell', idx })
      return
    }
    const res = game.sellItem(idx)
    if (!res.ok && res.error) errToast('Продажа невозможна', res.error)
    setUi(game.getUiState())
  }
  const doItemRoll = () => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'itemRoll' })
      return
    }
    const res = game.rollItems()
    if (!res.ok && res.error) errToast('Обновление невозможно', res.error)
    setUi(game.getUiState())
  }

  // клавиша P — пауза (ref, чтобы обработчик видел свежий doPause)
  const fullscreenRef = useRef<() => void>(() => {})
  const pauseRef = useRef(doPause)
  useEffect(() => {
    pauseRef.current = doPause
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return
      // F — полный экран (по коду клавиши, поэтому работает и на русской раскладке)
      if (e.code === 'KeyF') {
        e.preventDefault()
        fullscreenRef.current()
        return
      }
      if (e.code === 'KeyP') {
        e.preventDefault()
        pauseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const doRestart = () => {
    game.reset()
    setSelectedTower(null)
    disarm()
    setMergeFrom(null)
    setUi(game.getUiState())
    toast({ title: 'Новая попытка', description: `${game.mapDef.name} снова под атакой.` })
  }

  /** Повторить миссию сразу, без прохода по меню (та же карта, герой и сложность) */
  const doRetry = () => {
    game.reset()
    game.beginPreview()
    setSelectedTower(null)
    disarm()
    setMergeFrom(null)
    setUi(game.getUiState())
    toast({ title: 'Миссия заново', description: `${game.mapDef.name} · ${game.difficultyDef.name}.` })
  }

  /** Следующая миссия: соседняя карта реестра, та же сложность, выбор героя заново */
  const doNextMission = () => {
    const idx = MAP_DEFS.findIndex((m) => m.name === ui.mapName)
    const next = MAP_DEFS[(idx + 1 + MAP_DEFS.length) % MAP_DEFS.length]
    game.selectMap(next.seed)
    game.reset()
    setSelectedTower(null)
    disarm()
    setMergeFrom(null)
    setUi(game.getUiState())
    toast({ title: 'Следующая миссия', description: `${next.name}: ${next.feature}` })
  }

  // ─── Создание лобби (хост) ─────────────────────────────────────────────
  const doCreateLobby = async () => {
    const res = await createLobby()
    if (res.code) {
      setMpRole('host')
      setMpCode(res.code)
      setMpStatus('waiting')
      setInviteUrl(`${window.location.origin}/?lobby=${res.code}`)
      setShowInvite(true)
    } else {
      errToast('Лобби не создано', res.error)
    }
  }

  const doCloseLobby = () => {
    if (codeRef.current) closeLobby(codeRef.current)
    game.setCoop(false)
    setMpRole('single')
    setMpCode(null)
    setMpStatus('off')
    setShowInvite(false)
  }

  // ─── Раскладка: поле над нижней панелью, HUD масштабируется под экран ────
  // ui — общий масштаб HUD: 1 на 1440×860 и меньше, растёт на 2K/4K (до 2.6)
  const fieldRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: MAP_W, h: MAP_H })
  const [desktop, setDesktop] = useState(true)
  const [portrait, setPortrait] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [rotateHint, setRotateHint] = useState(true)
  const [uiScale, setUiScale] = useState(1)
  useEffect(() => {
    const fit = () => {
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches
      setDesktop(isDesktop)
      setPortrait(window.innerHeight > window.innerWidth)
      setUiScale(isDesktop ? Math.max(1, Math.min(2.6, Math.min(window.innerWidth / 1440, window.innerHeight / 860))) : 1)
      const r = fieldRef.current?.getBoundingClientRect()
      // холст занимает весь экран: карта масштабируется «cover» — чёрных полей нет ни при каком соотношении
      setStage({ w: Math.floor(r?.width ?? window.innerWidth), h: Math.floor(r?.height ?? window.innerHeight) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (fieldRef.current) ro.observe(fieldRef.current)
    window.addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [])
  // верхняя полоса не выше верхнего ряда клеток (туда тропа не заходит): 48 px полосы на ряд
  const topScale = Math.max(0.7, Math.min(uiScale, (stage.h / 15 - 4) / 48))

  // ─── Полноэкранный режим браузера ─────────────────────────────────────
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else
      document.documentElement
        .requestFullscreen()
        .then(() => {
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
          if (!desktop) o.lock?.('landscape').catch(() => {})
        })
        .catch(() => errToast('Полный экран недоступен', 'Браузер не разрешил'))
  }

  useEffect(() => {
    fullscreenRef.current = toggleFullscreen
  })

  const selectedTowerObj = selectedTower !== null ? game.towerById(selectedTower) : undefined
  const guestWaiting = mpRole === 'guest' && !mpHostLeft
  const hostLobbyIntro = mpRole === 'host' && ui.phase === 'intro'
  const canBuild = ui.phase === 'preview' || ui.phase === 'wave'
  // HUD — только в бою; в интро, лобби и на экранах итогов поле закрыто своим оверлеем
  const hudOn = canBuild && !showInvite
  const armedDef = armed ? ALL_DEFS[armed] : undefined
  const buildChip = armedDef ? { name: isMoving ? `Перенос: ${armedDef.name}` : armedDef.name, color: DMG_COLORS['attack' in armedDef ? armedDef.attack : armedDef.attacks[0]] } : null
  // копия из руки уже оплачена при покупке
  const buildAffordable = !!armedDef && (armedHand !== null || ui.infiniteGold || ui.gold >= armedDef.price)
  const buildOkLabel = armedDef
    ? armedHand !== null
      ? 'Поставить'
      : `Поставить за ${armedDef.price}`
    : 'Поставить'
  const contextPanel =
    mergeFrom !== null ? (
      <MergePanel game={game} from={mergeFrom} onCancel={() => setMergeFrom(null)} />
    ) : selectedTowerObj ? (
      <TowerPanel
        game={game}
        towerId={selectedTower}
        nextArmor={ui.nextWaveArmor}
        onSell={doSell}
        onMergeStart={() => {
          setMergeFrom(selectedTower)
          setSelectedTower(null)
        }}
        onClose={() => setSelectedTower(null)}
      />
    ) : null

  // ─── Режим постройки: свободные клетки, призрак с радиусом, плашка с ценой, кнопки ✕ / ✓ ───
  const plaqueRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLDivElement>(null)
  const okRef = useRef<HTMLDivElement>(null)
  const buildAcc = useRef(0)
  const btn = desktop ? Math.round(44 * Math.min(uiScale, 1.6)) : 44

  /** Свободные места-якоря (центры верхних левых клеток): те, где сейчас можно поставить башню */
  const freeCells = (footprint = 1): Vec[] => {
    const out: Vec[] = []
    const mv = movingRef.current !== null ? game.towerById(movingRef.current) : undefined
    for (let gx = 0; gx < GRID_W; gx++) {
      for (let gy = 0; gy < GRID_H; gy++) {
        const x = gx * CELL + CELL / 2
        const y = gy * CELL + CELL / 2
        // при переносе клетки переносимой башни остаются «под ней» — считаем их свободными
        if (mv && mv.x === x && mv.y === y) {
          out.push({ x, y })
          continue
        }
        if (game.canPlace(x, y, footprint, movingRef.current ?? undefined) === null) out.push({ x, y })
      }
    }
    return out
  }
  const nearestCell = (cells: Vec[], p: Vec) =>
    cells.reduce((best, c) => (Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y) ? c : best), cells[0])

  /** Пересчитать призрак: клетки, выбранная клетка (если её заняли — ближайшая), радиус, хватает ли золота */
  const refreshBuild = () => {
    const def = armedRef.current ? ALL_DEFS[armedRef.current] : undefined
    if (!def) {
      viewRef.current.buildGhost = null
      return
    }
    const fp = defFootprint(def)
    const cells = freeCells(fp)
    cellsRef.current = cells
    let cell = buildCellRef.current
    if (!cell || !cells.some((c) => c.x === cell!.x && c.y === cell!.y)) {
      if (!cells.length) {
        disarm()
        return
      }
      cell = nearestCell(cells, cell ?? { x: MAP_W / 2, y: MAP_H / 2 })
      buildCellRef.current = cell
      setBuildCell(cell)
    }
    viewRef.current.buildGhost = {
      x: cell.x,
      y: cell.y,
      valid: movingRef.current !== null
        ? true
        : armedHandRef.current !== null
          ? game.canPlace(cell.x, cell.y, fp) === null // копия из руки — золото уже заплачено
          : game.canBuild(cell.x, cell.y, def.id),
      range: def.range,
      glyph: def.glyph,
      defId: def.id,
      footprint: fp,
      cells,
      color: DMG_COLORS['attack' in def ? def.attack : def.attacks[0]],
    }
  }

  /** Плашка с ценой и кнопки ✕ / ✓ идут за призраком по экрану (камеру можно двигать и приближать) */
  const placeBuildUi = () => {
    const g = viewRef.current.buildGhost
    const pl = plaqueRef.current, cn = cancelRef.current, ok = okRef.current
    if (!g || !cn || !ok) return
    const v = viewRef.current
    const sc = viewScale(v)
    // плашка и кнопки — по центру блока постройки (у бура 2×2 смещение на полклетки)
    const s = toScreen(g.x + (g.footprint > 1 ? CELL / 2 : 0), g.y + (g.footprint > 1 ? CELL / 2 : 0))
    const px = (s.x - v.cam.x) * sc
    const py = (s.y - v.cam.y) * sc
    const dx = 24 * sc + 14 + btn / 2
    const cx = (x: number) => Math.max(btn / 2 + 6, Math.min(v.vw - btn / 2 - 6, x))
    const cy = (y: number) => Math.max(btn / 2 + 64, Math.min(v.vh - btn / 2 - 6, y))
    const put = (el: HTMLElement, x: number, y: number) => {
      el.style.transform = `translate(${cx(x)}px, ${cy(y)}px) translate(-50%, -50%)`
    }
    put(cn, px - dx, py - 8)
    put(ok, px + dx, py - 8)
    if (pl) put(pl, px, py - 46 * sc - 14)
  }

  /** Быстрый доступ под выбранной башней: перенос и продажа */
  const quickRef = useRef<HTMLDivElement>(null)
  const placeQuickUi = () => {
    const el = quickRef.current
    const id = selRef.current
    const tw = id !== null ? game.towerById(id) : undefined
    if (!el || !tw) return
    const v = viewRef.current
    const sc = viewScale(v)
    const s = toScreen(tw.x, tw.y)
    const x = Math.max(btn + 8, Math.min(v.vw - btn - 8, (s.x - v.cam.x) * sc))
    const y = Math.min(v.vh - btn / 2 - 8, (s.y - v.cam.y) * sc + 12 * sc + btn / 2 + 6)
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
  }

  /** Покупка: золото списывается, копия падает в «руку» (без призрака — взятие в стол — только из руки), магазин закрывается */
  const doBuy = (defId: string) => {
    if (ui.phase !== 'preview' && ui.phase !== 'wave') return
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'buy', defId })
      setShopOpen(false)
      return
    }
    const res = game.buy(defId)
    if (!res.ok && res.error) {
      errToast('Покупка не удалась', res.error)
      return
    }
    setUi(game.getUiState())
    setShopOpen(false)
  }

  /** Взять копию из руки в стол: появляется призрак, ✓ ставит, тап по такой же башне качает */
  const armHand = (idx: number) => {
    const defId = game.hand[idx]
    if (idx < 0 || !defId) {
      disarm() // рука изменилась (снапшот гостя) — выходим
      return
    }
    if (armedHandRef.current === idx && armedRef.current === defId) {
      disarm() // повторный клик по той же копии — снять со стола
      return
    }
    if (ui.phase === 'intro' || ui.phase === 'over' || ui.phase === 'won') return
    setSelectedTower(null)
    setMergeFrom(null)
    movingRef.current = null
    setIsMoving(false)
    const cells = freeCells()
    if (!cells.length) {
      errToast('Нет места', 'Свободных клеток для башни не осталось')
      return
    }
    cellsRef.current = cells
    const v = viewRef.current
    const sc = viewScale(v)
    const centre = toWorld(v.cam.x + v.vw / sc / 2, v.cam.y + v.vh / sc / 2)
    const prev = buildCellRef.current
    const cell = (prev && cells.find((c) => c.x === prev.x && c.y === prev.y)) || nearestCell(cells, centre)
    armedRef.current = defId
    armedHandRef.current = idx
    buildCellRef.current = cell
    setArmed(defId)
    setArmedHand(idx)
    setBuildCell(cell)
    refreshBuild()
  }

  /** Перенос башни: тот же режим с клетками, но без цены; доступен один раз */
  const startMove = (towerId: number) => {
    const tw = game.towerById(towerId)
    if (!tw) return
    if (tw.moved) {
      errToast('Перенос недоступен', 'Эту башню уже переносили')
      return
    }
    setSelectedTower(null)
    movingRef.current = towerId
    setIsMoving(true)
    armedRef.current = tw.defId
    buildCellRef.current = { x: tw.x, y: tw.y }
    setArmed(tw.defId)
    setBuildCell({ x: tw.x, y: tw.y })
    refreshBuild()
  }

  const confirmBuild = () => {
    const id = armedRef.current, c = buildCellRef.current
    if (!id || !c) return
    const mid = movingRef.current
    if (mid !== null) {
      const tw = game.towerById(mid)
      if (tw && (tw.x !== c.x || tw.y !== c.y)) {
        if (asGuest && codeRef.current) sendCmd(codeRef.current, { t: 'move', id: mid, x: c.x, y: c.y })
        else {
          const res = game.moveTower(mid, c.x, c.y)
          if (!res.ok && res.error) {
            errToast('Не перенесено', res.error)
            return
          }
        }
      }
      disarm()
      return
    }
    const idx = armedHandRef.current
    if (idx === null) return
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'placeHand', idx, x: c.x, y: c.y })
    } else {
      const res = game.placeFromHand(idx, c.x, c.y)
      if (!res.ok && res.error) {
        errToast('Не поставлено', res.error)
        return
      }
      setUi(game.getUiState())
    }
    disarm()
  }

  useEffect(() => {
    refreshBuildRef.current = refreshBuild
    buildTickRef.current = (dt) => {
      buildAcc.current += dt
      if (armedRef.current && buildAcc.current >= 0.25) {
        buildAcc.current = 0
        refreshBuild()
      }
      placeBuildUi()
      placeQuickUi()
    }
  })

  useLayoutEffect(() => {
    if (armed) placeBuildUi()
  }, [armed, buildCell])

  const menu: MenuActions = {
    skin,
    fullscreen,
    muted,
    lighting,
    role: mpRole,
    mpStatus,
    musicVolume,
    sfxVolume,
    ambientVolume,
    onLighting: () => setLighting((l) => !l),
    onMute: () => setMuted((m) => !m),
    onMusicVolume: setMusicVolume,
    onSfxVolume: setSfxVolume,
    onAmbientVolume: setAmbientVolume,
    onInfiniteGold: doInfiniteGold,
    onSkin: () => setSkin((s) => (s === 'lol' ? 'steam' : 'lol')),
    onHelp: () => setHelpOpen(true),
    onRestart: doRestart,
    onFullscreen: toggleFullscreen,
    onInvite: mpRole === 'host' ? () => setShowInvite(true) : undefined,
  }
  const topBar = (stacked = false) => (
    <TopBar
      ui={ui}
      build={buildChip}
      menu={menu}
      menuOpen={menuOpen}
      onMenu={setMenuOpen}
      onSpeed={doSpeed}
      onPause={doPause}
      stacked={stacked}
    />
  )
  const heroButtons = <HeroButtons ui={ui} role={mpRole} onAbility={doAbility} />
  const startButton = !armed ? <StartButton ui={ui} onStart={doStartWave} /> : null

  return (
    // Десктоп: экран целиком без прокрутки — карта накрывает окно (cover), HUD плавает поверх.
    // Телефон: то же, HUD-полосы поверх поля.
    <div
      className={
        desktop
          ? 'relative flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_center,#0f151f,#05070b)] lg:h-dvh lg:overflow-hidden'
          : 'fixed inset-0 overflow-hidden bg-[#070b14]'
      }
    >
      <div ref={fieldRef} className="absolute inset-0">
        <div className="absolute inset-0 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 block h-full w-full select-none"
            // pixelated — браузер не размывает пиксели при растягивании под экран
            style={{ touchAction: 'none', imageRendering: 'pixelated' }}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            onPointerDown={handleDown}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={`Карта игры ${ui.mapName}`}
          />
          {/* виньетка «через объектив» — CSS-слоем: композитится видюхой, холст не тратит кадр */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(5,8,14,0) 52%, rgba(5,8,14,0.36) 100%)' }}
          />

          {/* Интро: фон — чертёж «командного пункта»; живой мир под ним не отрисовывается */}
          {ui.phase === 'intro' && <MenuBackdrop />}

          {/* Интро (одиночка / хост без лобби) — хаб-терминал: сектора КАМПАНИЯ / СОБЫТИЯ / ПРОФИЛЬ / НАСТРОЙКИ */}
          {mpRole !== 'guest' && ui.phase === 'intro' && !showInvite && (
            <MainMenu
              ui={ui}
              uiScale={uiScale}
              fullscreen={fullscreen}
              musicVolume={musicVolume}
              onMusicVolume={setMusicVolume}
              sfxVolume={sfxVolume}
              onSfxVolume={setSfxVolume}
              ambientVolume={ambientVolume}
              onAmbientVolume={setAmbientVolume}
              muted={muted}
              onMute={() => setMuted((m) => !m)}
              lighting={lighting}
              onLighting={() => setLighting((l) => !l)}
              meta={meta}
              onPickMap={(seed) => {
                game.selectMap(seed)
                setUi(game.getUiState())
              }}
              onPickDifficulty={(id) => {
                game.setDifficulty(id)
                setUi(game.getUiState())
              }}
              onPickAvatar={(id) => {
                game.setAvatar(id)
                setUi(game.getUiState())
              }}
              onStart={() => game.beginPreview()}
              onStartCoop={doCreateLobby}
              onHelp={() => setHelpOpen(true)}
              onToggleFullscreen={toggleFullscreen}
              onClaimDaily={doClaimDaily}
              onClaimTask={doClaimTask}
              onResetProgress={doResetProgress}
              onRenameBuild={doRenameBuild}
              mpRole={mpRole}
              mpStatus={mpStatus}
            />
          )}

          {/* Лобби хоста (ожидание друга; onStart доступен и без друга) */}
          {mpRole === 'host' && mpCode && (hostLobbyIntro || showInvite) && (
            <MpLobbyPanel
              code={mpCode}
              inviteUrl={inviteUrl}
              status={mpStatus}
              inGame={!hostLobbyIntro}
              onStart={() => {
                setShowInvite(false)
                game.beginPreview()
              }}
              onClose={hostLobbyIntro ? doCloseLobby : () => setShowInvite(false)}
              onHelp={() => setHelpOpen(true)}
            />
          )}

          {/* Экран ожидания гостя */}
          {guestWaiting && ui.phase === 'intro' && <MpGuestWait code={mpCode ?? ''} status={mpStatus} hostLeft={false} />}
          {mpRole === 'guest' && mpHostLeft && <MpGuestWait code={mpCode ?? ''} status={mpStatus} hostLeft />}

          {/* Поражение / победа */}
          {(ui.phase === 'over' || ui.phase === 'won') && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(5,8,13,0.82)] p-4 backdrop-blur-[3px]">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="td-ornate max-w-sm rounded-2xl border border-[#3a4660]/90 bg-[rgba(10,15,24,0.9)] px-8 py-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                style={{ zoom: uiScale }}
              >
                <h2 className={`mb-2 text-[32px] font-black leading-tight tracking-[0.02em] ${ui.phase === 'won' ? 'text-[#f2c94c]' : 'text-[#ff7a7a]'}`}>
                  {ui.phase === 'won' ? 'ГОРИЗОНТ УДЕРЖАН!' : 'ЗДАНИЕ РАЗРУШЕНО'}
                </h2>
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7088a8]">
                  {ui.mapName} · {ui.difficultyName}
                </p>
                <p className="mb-4 text-sm text-[#c3cbe0]">
                  {ui.phase === 'won'
                    ? `Сердце Разлома пало на ${Math.min(ui.wave, ui.totalWaves)}-й волне — лагерь может идти дальше, к убежищу, о котором говорит ИИ.`
                    : `Заражённые прорвались к главному зданию на ${Math.min(ui.wave, ui.totalWaves)}-й волне. Минерал забирает тракт...`}
                </p>
                <Stats ui={ui} />
                {/* награда метапрогрессии: карточки сундуков с деталями за победу (docs/meta.md) */}
                {ui.phase === 'won' && metaReward && metaReward.length > 0 && (
                  <div className="td-ornate mt-3 rounded-xl border border-[#e0a83266] bg-[rgba(20,26,38,0.75)] px-4 py-3 text-left">
                    <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#7088a8]">трофеи миссии</p>
                    {metaReward.map((drop, i) => {
                      const chest = CHESTS[drop.chest as keyof typeof CHESTS]
                      const ach = drop.achievementId ? ACHIEVEMENTS.find((a) => a.id === drop.achievementId) : null
                      return (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: i * 0.15, duration: 0.25, ease: 'easeOut' }}
                          className="mt-2 rounded-lg border bg-[rgba(10,15,23,0.65)] px-3 py-2 first:mt-0"
                          style={{ borderColor: chest.accent + '55', boxShadow: `0 0 14px ${chest.accent}22` }}
                        >
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: chest.accent }}>
                            {ach?.icon ?? chest.icon} {ach ? `${ach.name} — ${chest.name}` : chest.name}
                          </p>
                          <p className="mt-1 text-[12px] leading-snug text-[#c3cbe0]">
                            {drop.parts.map(({ partId, units }) => {
                              const p = PART_BY_ID[partId]
                              return p ? `${p.name} ×${units}` : null
                            }).filter(Boolean).join(' · ')}
                          </p>
                        </motion.div>
                      )
                    })}
                    <p className="mt-1.5 font-mono text-[9px] text-[#5b6f8c]">детали ждут в секторе ПРОФИЛЬ (главное меню)</p>
                  </div>
                )}
                {mpRole !== 'guest' && (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Button
                      onClick={doRetry}
                      className="h-10 rounded-xl px-5 text-[13px] font-black uppercase tracking-wide text-[#1a1408] hover:brightness-105"
                      style={{
                        background: 'linear-gradient(180deg, #ffd76b 0%, #eebd45 55%, #e0a832 100%)',
                        boxShadow: '0 4px 18px rgba(242,201,76,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
                      }}
                    >
                      ↻ Повторить миссию
                    </Button>
                    {ui.phase === 'won' ? (
                      <Button
                        onClick={doNextMission}
                        className="h-10 rounded-xl border border-[#59c27a]/60 bg-[rgba(89,194,122,0.12)] px-5 text-[13px] font-bold text-[#a6f095] hover:bg-[rgba(89,194,122,0.22)]"
                      >
                        Следующая миссия →
                      </Button>
                    ) : (
                      <Button
                        onClick={doRestart}
                        className="h-10 rounded-xl border border-[#3a4660]/70 bg-transparent px-4 text-[12px] font-bold text-[#aebad0] hover:bg-[rgba(31,38,56,0.6)]"
                      >
                        Сменить сложность
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* баннер волны — посередине поля, не перехватывает клики */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zoom: uiScale }}>
            <WaveBanner ui={ui} />
          </div>
          {/* кнопки ✕ / ✓ и плашка с ценой — идут за призраком; ставить башню сразу по тапу нельзя */}
          {selectedTowerObj && !armed && hudOn && (
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              <div ref={quickRef} className="absolute left-0 top-0 flex gap-2" style={{ transform: 'translate(-999px, -999px)' }}>
                <button
                  type="button"
                  aria-label="Перенести башню (один раз)"
                  title={selectedTowerObj.moved ? 'Эту башню уже переносили' : 'Перенести башню (один раз)'}
                  disabled={!!selectedTowerObj.moved}
                  onClick={() => startMove(selectedTowerObj.id)}
                  className="pointer-events-auto flex items-center justify-center rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.92)] p-0 text-[#e8ecf4] active:scale-95 disabled:opacity-40"
                  style={{ width: btn, height: btn }}
                >
                  <MoveIcon size={btn * 0.45} />
                </button>
                <button
                  type="button"
                  aria-label="Продать башню"
                  title="Продать башню"
                  onClick={doSell}
                  className="pointer-events-auto flex items-center justify-center rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.92)] p-0 text-[#ff7a7a] active:scale-95"
                  style={{ width: btn, height: btn }}
                >
                  <TrashIcon size={btn * 0.45} />
                </button>
              </div>
            </div>
          )}

          {armed && armedDef && buildCell && hudOn && (
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
              {!isMoving && armedHand === null && (
                <div ref={plaqueRef} className="absolute left-0 top-0" style={{ transform: 'translate(-999px, -999px)' }}>
                  <PricePlaque price={armedDef.price} />
                </div>
              )}
              <div ref={cancelRef} className="absolute left-0 top-0" style={{ transform: 'translate(-999px, -999px)' }}>
                <BuildConfirmButton kind="cancel" size={btn} label="Отмена" onClick={disarm} />
              </div>
              <div ref={okRef} className="absolute left-0 top-0" style={{ transform: 'translate(-999px, -999px)' }}>
                <BuildConfirmButton kind="ok" size={btn} label={buildOkLabel} disabled={!buildAffordable} onClick={confirmBuild} />
              </div>
            </div>
          )}

          {!desktop && hudOn && (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-30"
                style={{
                  padding: portrait
                    ? 'max(8px, env(safe-area-inset-top)) 8px 0'
                    : '12px max(52px, env(safe-area-inset-right)) 0 max(52px, env(safe-area-inset-left))',
                }}
              >
                {topBar(portrait)}
                <div className="mt-2 flex flex-col items-center gap-1.5">
                  <CenterNotices paused={ui.paused && canBuild} secondExit={ui.phase === 'preview' && ui.secondExitWave !== null && ui.wave === ui.secondExitWave ? ui.secondExitWave : null} />
                  {portrait && rotateHint && (
                    <button
                      onClick={() => setRotateHint(false)}
                      className="pointer-events-auto rounded-full border border-[#3a4660] bg-[rgba(14,19,31,0.9)] px-3 py-1 text-[11px] font-bold text-[#c3cbe0]"
                    >
                      Поверните телефон: поле будет крупнее · ✕
                    </button>
                  )}
                </div>
              </div>
              {portrait ? (
                <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex flex-col gap-2">
                  <div className="flex items-end justify-between">
                    {!contextPanel ? heroButtons : <span />}
                    {startButton}
                  </div>
                  <HandTray ui={ui} armedHand={armedHand} onArm={armHand} />
                  <div className="pointer-events-auto flex gap-2">
                    <ShopButton onClick={() => setShopOpen(true)} disabled={!canBuild} />
                    <LavkaButton onClick={() => setLavkaOpen(true)} />
                  </div>
                </div>
              ) : (
                <>
                  {!contextPanel && (
                    <div className="pointer-events-none absolute bottom-3 z-10 flex flex-col items-start gap-2" style={{ left: 'max(52px, env(safe-area-inset-left))' }}>
                      <TowerDamageBoard ui={ui} />
                      {heroButtons}
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute bottom-3 z-10 flex flex-col items-end gap-3"
                    style={{ right: 'max(52px, env(safe-area-inset-right))' }}
                  >
                    {startButton}
                    <HandTray ui={ui} armedHand={armedHand} onArm={armHand} />
                    <div className="pointer-events-auto flex gap-2">
                      <ShopButton onClick={() => setShopOpen(true)} disabled={!canBuild} />
                      <LavkaButton onClick={() => setLavkaOpen(true)} />
                    </div>
                  </div>
                </>
              )}
              <AnimatePresence>
                {contextPanel && (
                  <motion.div
                    key={mergeFrom !== null ? 'merge' : `tower-${selectedTower}`}
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                    className="absolute inset-x-0 bottom-0 z-20 max-h-[62%] overflow-y-auto rounded-t-xl border-t border-[#3a4660] bg-[rgba(14,19,31,0.96)] shadow-[0_-8px_24px_rgba(0,0,0,0.6)]"
                  >
                    <div className="sticky top-0 z-10 flex justify-center bg-[rgba(14,19,31,0.96)] py-1.5">
                      <span className="h-1 w-10 rounded bg-[#3a4660]" />
                    </div>
                    {contextPanel}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* Десктоп: верхняя полоса HUD над полем, уведомления и выезжающая панель башни */}
        {desktop && (
          // оверлей поверх поля на весь экран: карта теперь накрывает окно целиком
          <div className="pointer-events-none absolute inset-0 z-10">
            <AnimatePresence>
              {hudOn && (
                <motion.div key="top" className="px-2 pt-1" style={{ zoom: topScale }}>
                  {topBar()}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute inset-x-0 flex justify-center" style={{ top: 56 * topScale }}>
              <div style={{ zoom: uiScale }}>
                <CenterNotices paused={ui.paused && canBuild} secondExit={ui.phase === 'preview' && ui.secondExitWave !== null && ui.wave === ui.secondExitWave ? ui.secondExitWave : null} />
              </div>
            </div>
            <AnimatePresence>
              {hudOn && contextPanel && (
                <motion.div
                  key={mergeFrom !== null ? 'merge' : `tower-${selectedTower}`}
                  initial={{ x: 340 * uiScale, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 340 * uiScale, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  // контейнер без своей рамки и без растяжки по высоте: рамка — только у самой карточки панели
                  className="pointer-events-auto absolute right-2 overflow-y-auto"
                  style={{ top: 56 * topScale, width: 300 * uiScale, maxHeight: `calc(100% - ${56 * topScale + 8}px)` }}
                >
                  <div style={{ zoom: uiScale }}>{contextPanel}</div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Табличка урона за карту — слева, зеркально панели башни справа */}
            {hudOn && (
              <div
                className="absolute left-2 z-20"
                style={{ top: 56 * topScale, maxHeight: `calc(100% - ${56 * topScale + 8}px)` }}
              >
                <div style={{ zoom: uiScale }}>
                  <TowerDamageBoard ui={ui} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* нижняя панель: мягкий скрим над полем + герой · рука · магазины и «Начать» */}
      <AnimatePresence>
        {hudOn && desktop && (
          <motion.div
            key="bottom"
            className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-5 px-4 pb-2.5 pt-6"
            style={{
              zoom: uiScale,
              background: 'linear-gradient(to top, rgba(4,7,12,0.95) 0%, rgba(4,7,12,0.62) 55%, rgba(4,7,12,0) 100%)',
            }}
          >
            {heroButtons}
            <HandTray ui={ui} armedHand={armedHand} onArm={armHand} size="lg" />
            <div className="flex items-center gap-3">
              <div className="flex gap-2.5">
                <ShopButton onClick={() => setShopOpen(true)} disabled={!canBuild} />
                <LavkaButton onClick={() => setLavkaOpen(true)} />
              </div>
              <div className="flex w-[170px] justify-start">{startButton}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tip && ALL_DEFS[tip.defId] && (
        <div ref={tipRef} className="pointer-events-none fixed z-50" style={{ left: -999, top: -999 }}>
          <div style={{ zoom: uiScale }}>
            <TowerInfoCard def={ALL_DEFS[tip.defId]} level={tip.level} thumb={ALL_DEFS[tip.defId].merged ? undefined : towerThumb(ALL_DEFS[tip.defId] as TowerDef)} />
          </div>
        </div>
      )}

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <AnimatePresence>
        {shopOpen && <ShopModal ui={ui} onPick={doBuy} onRoll={doRoll} onClose={() => setShopOpen(false)} />}
        {lavkaOpen && <LavkaModal ui={ui} onBuy={doItemBuy} onSell={doItemSell} onRoll={doItemRoll} onClose={() => setLavkaOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}



function Stats({ ui }: { ui: UiState }) {
  const mins = Math.floor(ui.time / 60)
  const secs = Math.floor(ui.time % 60)
  const cell = 'rounded-lg border border-[#3a4660]/70 bg-[rgba(31,38,56,0.55)] px-2.5 py-1.5 text-[#c3cbe0]'
  return (
    <div className="mx-auto grid max-w-[300px] grid-cols-2 gap-1.5 font-mono text-xs">
      <div className={cell}>Волн: {Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}</div>
      <div className={cell}>Здание: {ui.buildingHp}/{ui.buildingMaxHp}</div>
      <div className={cell}>Убито: {ui.stats.kills}</div>
      <div className={cell}>Боссов: {ui.stats.bossKills}</div>
      <div className={cell}>Золота: {ui.stats.goldEarned}</div>
      <div className={cell}>Слияний: {ui.stats.merges}</div>
      <div className={cell}>Урон: {Math.round(ui.stats.damageDealt)}</div>
      <div className={cell}>Время: {mins}:{String(secs).padStart(2, '0')}</div>
      <div className={`${cell} col-span-2`}>
        Прорвалось заражённых: {ui.stats.leaked}
      </div>
    </div>
  )
}
