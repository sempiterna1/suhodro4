'use client'

// Оболочка прототипа: canvas + игровой цикл + ввод + панели + кооп-мультиплеер
// Мультиплеер: host-авторитарная модель. Хост симулирует мир и раздаёт
// снапшоты (10 Гц) через лобби-сервис (socket.io :3003), гость шлёт команды.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Game } from '@/game/engine'
import { render, type ViewState } from '@/game/render'
import { MAP_H, MAP_W } from '@/game/config'
import type { GuestCmd } from '@/game/mp-protocol'
import type { UiState, Vec } from '@/game/types'
import { closeLobby, createLobby, getMpSocket, joinLobby, sendCmd, sendSnap } from '@/lib/mp-client'
import {
  AvatarPanel,
  BuildMenu,
  HelpDialog,
  MergePanel,
  MpGuestWait,
  MpLobbyPanel,
  ShopList,
  TopBar,
  TowerPanel,
  WavePanel,
  type MpRole,
  type MpStatus,
} from './Panels'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Zap, Hammer, Footprints } from 'lucide-react'

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game] = useState(() => new Game())

  const [ui, setUi] = useState<UiState>(() => game.getUiState())
  const [selectedTower, setSelectedTower] = useState<number | null>(null)
  const [pendingPos, setPendingPos] = useState<Vec | null>(null)
  const [buildMode, setBuildMode] = useState(true) // клик по земле — постройка
  const [mergeFrom, setMergeFrom] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const { toast } = useToast()

  // ─── Мультиплеер ────────────────────────────────────────────────────────
  const [mpRole, setMpRole] = useState<MpRole>('single')
  const [mpCode, setMpCode] = useState<string | null>(null)
  const [mpStatus, setMpStatus] = useState<MpStatus>('off')
  const [mpHostLeft, setMpHostLeft] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteUrl, setInviteUrl] = useState('')
  const roleRef = useRef<MpRole>('single')
  const codeRef = useRef<string | null>(null)
  const mpHostLeftRef = useRef(false)
  const movedHintShown = useRef(false)

  useEffect(() => {
    roleRef.current = mpRole
  }, [mpRole])
  useEffect(() => {
    codeRef.current = mpCode
  }, [mpCode])

  const viewRef = useRef<ViewState>({
    hoverTower: null,
    selectedTower: null,
    mergeFrom: null,
    mouse: null,
    buildMode: true,
    buildGhost: null,
  })
  const panelRef = useRef<HTMLDivElement>(null)
  const selRef = useRef(selectedTower)
  const mergeRef = useRef(mergeFrom)
  const buildModeRef = useRef(buildMode)

  useEffect(() => {
    selRef.current = selectedTower
  }, [selectedTower])
  useEffect(() => {
    mergeRef.current = mergeFrom
  }, [mergeFrom])
  useEffect(() => {
    buildModeRef.current = buildMode
  }, [buildMode])

  // ─── Настройка canvas ( retina ) ───────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = MAP_W * dpr
    canvas.height = MAP_H * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [])

  // ─── Гость: авто-подключение по ссылке /?lobby=КОД ─────────────────────
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('lobby')
    if (!param) return
    const code = param.trim().toUpperCase()
    let cancelled = false
    mpHostLeftRef.current = false
    setMpRole('guest')
    setMpCode(code)
    setMpStatus('waiting')
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
      viewRef.current.selectedTower = selRef.current
      viewRef.current.mergeFrom = mergeRef.current
      viewRef.current.buildMode = buildModeRef.current
      if (roleRef.current === 'guest') game.guestTick(dt)
      else game.update(dt)
      render(ctx, game, viewRef.current)
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
    if (window.innerWidth < 1024 && (selectedTower !== null || mergeFrom !== null || pendingPos !== null)) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedTower, mergeFrom, pendingPos])

  // ─── Ввод ──────────────────────────────────────────────────────────────
  const toMap = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Vec => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * MAP_W,
      y: ((e.clientY - rect.top) / rect.height) * MAP_H,
    }
  }, [])

  const towerAt = (p: Vec): number | null => {
    for (const tw of game.towers) {
      if (Math.hypot(tw.x - p.x, tw.y - p.y) <= 24) return tw.id
    }
    return null
  }

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toMap(e)
    viewRef.current.mouse = p
    const tid = towerAt(p)
    viewRef.current.hoverTower = tid
    // призрак постройки в режиме стройки (когда не наведены на башню)
    if (buildModeRef.current && tid === null && ui.phase !== 'intro') {
      viewRef.current.buildGhost = { x: p.x, y: p.y, valid: game.canPlace(p.x, p.y) === null }
    } else {
      viewRef.current.buildGhost = null
    }
  }

  const handleLeave = () => {
    viewRef.current.mouse = null
    viewRef.current.hoverTower = null
    viewRef.current.buildGhost = null
  }

  const handleTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toMap(e)
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
          const other = game.towerById(tid)
          const near = other && game.towerById(from)
            ? Math.hypot(other.x - game.towerById(from)!.x, other.y - game.towerById(from)!.y) <= 140
            : false
          toast({
            title: 'Слияние невозможно',
            description: near
              ? 'Нужны разные башни 3+ ур. в пределах 140 px.'
              : 'Башня слишком далеко — постройте вторую в пределах 140 px от первой.',
            variant: 'destructive',
          })
        }
        return
      }
      setPendingPos(null)
      setSelectedTower((prev) => (prev === tid ? null : tid))
      return
    }

    // пустая земля
    if (mergeFrom !== null) {
      setMergeFrom(null)
      return
    }
    if (ui.phase === 'intro') return
    if (buildMode) {
      const err = game.canPlace(p.x, p.y)
      if (err) {
        toast({ title: 'Здесь нельзя строить', description: err, variant: 'destructive' })
        return
      }
      setSelectedTower(null)
      setPendingPos({ x: p.x, y: p.y })
    } else {
      // режим движения — только хост (аватар один)
      if (roleRef.current === 'guest') {
        if (!movedHintShown.current) {
          movedHintShown.current = true
          toast({ title: 'Охотницей управляет хост', description: 'Стройте башни — это тоже важно!' })
        }
        return
      }
      setPendingPos(null)
      game.moveAvatar(p)
    }
  }

  // ─── Действия панелей ──────────────────────────────────────────────────
  const errToast = (title: string, error?: string) =>
    toast({ title, description: error, variant: 'destructive' })

  const asGuest = roleRef.current === 'guest'

  const doBuild = (defId: string) => {
    if (pendingPos === null) return
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'build', x: pendingPos.x, y: pendingPos.y, defId })
      setPendingPos(null)
      return
    }
    const res = game.build(pendingPos.x, pendingPos.y, defId)
    if (res.ok && res.towerId !== undefined) {
      setPendingPos(null)
      setSelectedTower(res.towerId) // откроется панель новой башни
    } else if (res.error) errToast('Не построено', res.error)
  }

  const doUpgrade = () => {
    if (selectedTower === null) return
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'upgrade', id: selectedTower })
      return
    }
    const res = game.upgrade(selectedTower)
    if (!res.ok && res.error) errToast('Улучшение недоступно', res.error)
  }

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
    if (!res.ok && res.error) errToast('Метка добычи', res.error)
  }

  const doStartWave = () => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'startWave' })
      return
    }
    game.startWave()
  }

  const doSpeed = () => {
    const next = ui.speed === 1 ? 2 : 1
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

  const doRoll = () => {
    if (asGuest && codeRef.current) {
      sendCmd(codeRef.current, { t: 'roll' })
      return
    }
    const res = game.roll()
    if (!res.ok && res.error) errToast('Ролл недоступен', res.error)
    setUi(game.getUiState())
  }

  // клавиша P — пауза (ref, чтобы обработчик видел свежий doPause)
  const pauseRef = useRef(doPause)
  useEffect(() => {
    pauseRef.current = doPause
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
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
    setPendingPos(null)
    setMergeFrom(null)
    toast({ title: 'Новая попытка', description: 'Пограничный тракт снова под атакой.' })
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

  const selectedTowerObj = selectedTower !== null ? game.towerById(selectedTower) : undefined
  const guestWaiting = mpRole === 'guest' && !mpHostLeft
  const hostLobbyIntro = mpRole === 'host' && ui.phase === 'intro'

  return (
    <div className="flex min-h-screen flex-col bg-[#1a140e]">
      <header className="sticky top-0 z-20 border-b-2 border-[#8a6d3b] bg-[#241b12]/95 backdrop-blur">
        <TopBar
          ui={ui}
          onSpeed={doSpeed}
          onPause={doPause}
          onHelp={() => setHelpOpen(true)}
          onRestart={doRestart}
          role={mpRole}
          mpStatus={mpStatus}
          onInvite={mpRole === 'host' ? () => setShowInvite(true) : undefined}
        />
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 p-3 lg:flex-row lg:p-4">
        {/* Поле боя */}
        <section className="min-w-0 flex-1">
          <div className="relative overflow-hidden rounded-lg border-2 border-[#8a6d3b] shadow-[0_0_24px_rgba(0,0,0,0.6)]">
            <canvas
              ref={canvasRef}
              className="block h-auto w-full select-none"
              style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, touchAction: 'manipulation' }}
              onPointerMove={handleMove}
              onPointerLeave={handleLeave}
              onPointerDown={handleTap}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Карта игры Пограничный тракт"
            />

            {/* Пауза: плашка не перехватывает клики — на паузе можно строить */}
            {ui.paused && ui.phase !== 'intro' && ui.phase !== 'over' && ui.phase !== 'won' && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                <span className="rounded-md border-2 border-[#ffd700] bg-[#241b12]/90 px-4 py-1 font-serif text-lg font-black tracking-[0.3em] text-[#ffd700] shadow-lg">
                  ПАУЗА
                </span>
              </div>
            )}

            {/* Плавающие кнопки: режим стройки/движения + способность */}
            {ui.phase !== 'intro' && (
              <button
                onClick={() => setBuildMode((v) => !v)}
                className={`absolute bottom-3 left-3 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 shadow-lg transition-transform active:scale-95 ${
                  buildMode
                    ? 'border-[#ffd700] bg-[#3a2e1c]/95 text-[#ffd700]'
                    : 'border-[#7fd0a0] bg-[#1f2d24]/95 text-[#7fd0a0]'
                }`}
                title={buildMode ? 'Режим: ПОСТРОЙКА — клик по земле откроет меню башен' : 'Режим: ДВИЖЕНИЕ — клик по земле двигает Охотницу'}
              >
                {buildMode ? <Hammer className="h-5 w-5" /> : <Footprints className="h-5 w-5" />}
                <span className="text-[8px] font-bold uppercase">{buildMode ? 'строить' : 'идти'}</span>
              </button>
            )}

            {ui.phase !== 'intro' && mpRole !== 'guest' && (
              <button
                onClick={doAbility}
                disabled={Math.ceil(ui.avatar.cooldown) > 0}
                className={`absolute bottom-3 right-3 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 font-mono text-lg font-bold shadow-lg transition-transform active:scale-95 ${
                  ui.avatar.cooldown > 0
                    ? 'border-[#8a6d3b66] bg-[#241b12]/80 text-[#8a6d3b]'
                    : 'border-[#ffd700] bg-[#3a2e1c]/95 text-[#ffd700] hover:scale-105'
                }`}
                title="Метка добычи"
              >
                <Zap className="h-5 w-5" />
                {ui.avatar.cooldown > 0 && (
                  <span className="text-[10px]">{Math.ceil(ui.avatar.cooldown)}</span>
                )}
              </button>
            )}

            {/* Интро (одиночка / хост без лобби) */}
            {mpRole !== 'guest' && ui.phase === 'intro' && !showInvite && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#120d08]/88 p-4 backdrop-blur-[2px]">
                <div className="max-w-md text-center">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#8a6d3b]">
                    стимпанк · tower defense · прототип
                  </p>
                  <h1 className="mb-3 font-serif text-3xl font-black tracking-wide text-[#e8c170] sm:text-4xl">
                    ЖЕЛЕЗНЫЙ РАЗЛОМ
                  </h1>
                  <p className="mb-4 text-xs leading-relaxed text-[#c8b896] sm:text-sm">
                    Новый минерал пробудил древний ИИ. Его машины маршируют по Пограничному тракту.
                    Ставьте башни, сливайте их в уникальные и продержитесь <b className="text-[#e8c170]">10 волн</b> до
                    Титана-ИИ.
                  </p>
                  <div className="mb-5 flex flex-wrap justify-center gap-2 text-[10px] text-[#a89a80]">
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">15 башен</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">ролл арсенала</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">слияние</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">4 типа брони</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">кооп по ссылке</span>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      onClick={() => game.beginPreview()}
                      className="h-11 border-2 border-[#b08d57] bg-[#3a2e1c] px-6 font-serif text-base font-bold text-[#ffd700] hover:bg-[#4a3a24]"
                    >
                      ⚙ Начать игру
                    </Button>
                    <Button
                      onClick={doCreateLobby}
                      variant="outline"
                      className="h-11 border-2 border-[#7fd0a0] bg-[#1f2d24] px-5 text-sm font-bold text-[#7fd0a0] hover:bg-[#243a2c]"
                    >
                      ⚔ Играть вдвоём (кооп)
                    </Button>
                    <Button
                      onClick={() => setHelpOpen(true)}
                      variant="outline"
                      className="h-11 border-[#8a6d3b] bg-transparent px-4 text-sm text-[#d8cbb0] hover:bg-[#3a2e1c]"
                    >
                      Как играть
                    </Button>
                  </div>
                </div>
              </div>
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
            {guestWaiting && ui.phase === 'intro' && (
              <MpGuestWait code={mpCode ?? ''} status={mpStatus} hostLeft={false} />
            )}
            {mpRole === 'guest' && mpHostLeft && (
              <MpGuestWait code={mpCode ?? ''} status={mpStatus} hostLeft />
            )}

            {/* Поражение */}
            {ui.phase === 'over' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#120d08]/90 p-4">
                <div className="max-w-sm text-center">
                  <h2 className="mb-2 font-serif text-3xl font-black text-[#e05252]">ОБОРОНА ПАЛА</h2>
                  <p className="mb-4 text-sm text-[#c8b896]">
                    Машины ИИ прорвались на волне {ui.wave}. Разлом поглощает тракт...
                  </p>
                  <Stats ui={ui} />
                  {mpRole !== 'guest' && (
                    <Button
                      onClick={doRestart}
                      className="mt-4 h-10 border-2 border-[#b08d57] bg-[#3a2e1c] px-6 font-serif font-bold text-[#ffd700] hover:bg-[#4a3a24]"
                    >
                      Играть снова
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Победа */}
            {ui.phase === 'won' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#120d08]/90 p-4">
                <div className="max-w-sm text-center">
                  <h2 className="mb-2 font-serif text-3xl font-black text-[#ffd700]">ТРАКТ УДЕРЖАН!</h2>
                  <p className="mb-4 text-sm text-[#c8b896]">
                    Титан-ИИ уничтожен. В полной версии вас ждут ещё 9 карт и 3 сложности.
                  </p>
                  <Stats ui={ui} />
                  {mpRole !== 'guest' && (
                    <Button
                      onClick={doRestart}
                      className="mt-4 h-10 border-2 border-[#b08d57] bg-[#3a2e1c] px-6 font-serif font-bold text-[#ffd700] hover:bg-[#4a3a24]"
                    >
                      Играть снова
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] text-[#8a6d3b]">
            🏗 Клик по земле — постройка (нельзя на тракте и вплотную к башням) · клик по башне — улучшение/слияние/продажа · кнопка «идти» — движение Охотницы
          </p>
        </section>

        {/* Боковая панель */}
        <aside className="flex w-full flex-col gap-3 lg:w-[350px] lg:shrink-0">
          <WavePanel ui={ui} onStart={doStartWave} />
          <div ref={panelRef} className="flex flex-col gap-3">
            {mergeFrom !== null ? (
              <MergePanel game={game} from={mergeFrom} onCancel={() => setMergeFrom(null)} />
            ) : selectedTowerObj ? (
              <TowerPanel
                game={game}
                towerId={selectedTower}
                gold={ui.gold}
                nextArmor={ui.nextWaveArmor}
                onUpgrade={doUpgrade}
                onSell={doSell}
                onMergeStart={() => {
                  setMergeFrom(selectedTower)
                  setSelectedTower(null)
                }}
                onClose={() => setSelectedTower(null)}
              />
            ) : pendingPos ? (
              <BuildMenu
                pos={pendingPos}
                gold={ui.gold}
                shop={ui.shop}
                rollCost={ui.rollCost}
                onBuild={doBuild}
                onRoll={doRoll}
                onClose={() => setPendingPos(null)}
              />
            ) : (
              <ShopList gold={ui.gold} buildMode={buildMode} shop={ui.shop} rollCost={ui.rollCost} onRoll={doRoll} />
            )}
          </div>
          <AvatarPanel ui={ui} onAbility={doAbility} role={mpRole} />
        </aside>
      </main>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

function Stats({ ui }: { ui: UiState }) {
  return (
    <div className="mx-auto grid max-w-[260px] grid-cols-2 gap-1.5 font-mono text-xs text-[#d8cbb0]">
      <div className="rounded border border-[#8a6d3b55] bg-[#241b12] px-2 py-1">Убито: {ui.stats.kills}</div>
      <div className="rounded border border-[#8a6d3b55] bg-[#241b12] px-2 py-1">Боссов: {ui.stats.bossKills}</div>
      <div className="rounded border border-[#8a6d3b55] bg-[#241b12] px-2 py-1">Золота: {ui.stats.goldEarned}</div>
      <div className="rounded border border-[#8a6d3b55] bg-[#241b12] px-2 py-1">Слияний: {ui.stats.merges}</div>
      <div className="col-span-2 rounded border border-[#8a6d3b55] bg-[#241b12] px-2 py-1">
        Прорвалось машин: {ui.stats.leaked}
      </div>
    </div>
  )
}
