'use client'

// Оболочка прототипа: canvas + игровой цикл + ввод + панели

import { useCallback, useEffect, useRef, useState } from 'react'
import { Game } from '@/game/engine'
import { render, type ViewState } from '@/game/render'
import { MAP_H, MAP_W, SPOTS } from '@/game/config'
import type { UiState, Vec } from '@/game/types'
import {
  AvatarPanel,
  BuildMenu,
  HelpDialog,
  MergePanel,
  ShopList,
  TopBar,
  TowerPanel,
  WavePanel,
} from './Panels'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [game] = useState(() => new Game())

  const [ui, setUi] = useState<UiState>(() => game.getUiState())
  const [selectedSpot, setSelectedSpot] = useState<number | null>(null)
  const [mergeFrom, setMergeFrom] = useState<number | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const { toast } = useToast()

  const viewRef = useRef<ViewState>({ hoverSpot: null, selectedSpot: null, mergeFrom: null, mouse: null })
  const panelRef = useRef<HTMLDivElement>(null)
  const selRef = useRef(selectedSpot)
  const mergeRef = useRef(mergeFrom)

  useEffect(() => {
    selRef.current = selectedSpot
  }, [selectedSpot])
  useEffect(() => {
    mergeRef.current = mergeFrom
  }, [mergeFrom])

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
      viewRef.current.selectedSpot = selRef.current
      viewRef.current.mergeFrom = mergeRef.current
      game.update(dt)
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
    if (window.innerWidth < 1024 && (selectedSpot !== null || mergeFrom !== null)) {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedSpot, mergeFrom])

  // ─── Ввод ──────────────────────────────────────────────────────────────
  const toMap = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Vec => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * MAP_W,
      y: ((e.clientY - rect.top) / rect.height) * MAP_H,
    }
  }, [])

  const spotAt = (p: Vec) =>
    SPOTS.findIndex((s) => Math.hypot(s.x - p.x, s.y - p.y) <= 24)

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toMap(e)
    viewRef.current.mouse = p
    viewRef.current.hoverSpot = spotAt(p) >= 0 ? spotAt(p) : null
  }

  const handleLeave = () => {
    viewRef.current.mouse = null
    viewRef.current.hoverSpot = null
  }

  const handleTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toMap(e)
    const idx = spotAt(p)

    if (idx >= 0) {
      if (mergeFrom !== null) {
        const from = mergeFrom
        if (from === idx) {
          setMergeFrom(null)
          return
        }
        const recipe = game.canMerge(from, idx)
        if (recipe) {
          const res = game.merge(from, idx)
          if (res.ok) {
            toast({ title: `${recipe.glyph} ${recipe.name}`, description: 'Башни слиты в уникальную!' })
            setMergeFrom(null)
            setSelectedSpot(idx)
          } else if (res.error) {
            toast({ title: 'Ошибка', description: res.error, variant: 'destructive' })
          }
        } else {
          toast({ title: 'Слияние невозможно', description: 'Нужны разные башни 3+ ур. на соседних площадках.', variant: 'destructive' })
        }
        return
      }
      setSelectedSpot((prev) => (prev === idx ? null : idx))
      return
    }

    // пустое место: в режиме слияния — отмена, иначе двигаем аватар
    if (mergeFrom !== null) {
      setMergeFrom(null)
      return
    }
    if (ui.phase !== 'intro') game.moveAvatar(p)
  }

  // ─── Действия панелей ──────────────────────────────────────────────────
  const errToast = (title: string, error?: string) =>
    toast({ title, description: error, variant: 'destructive' })

  const doBuild = (defId: string) => {
    if (selectedSpot === null) return
    const res = game.build(selectedSpot, defId)
    if (res.ok) {
      // остаёмся на выбранной площадке — откроется панель башни
    } else if (res.error) errToast('Не построено', res.error)
  }

  const doUpgrade = () => {
    if (selectedSpot === null) return
    const res = game.upgrade(selectedSpot)
    if (!res.ok && res.error) errToast('Улучшение недоступно', res.error)
  }

  const doSell = () => {
    if (selectedSpot === null) return
    const res = game.sell(selectedSpot)
    if (res.ok) setSelectedSpot(null)
    else if (res.error) errToast('Продажа не удалась', res.error)
  }

  const doAbility = () => {
    const res = game.useAbility()
    if (!res.ok && res.error) errToast('Метка добычи', res.error)
  }

  const doRestart = () => {
    game.reset()
    setSelectedSpot(null)
    setMergeFrom(null)
    toast({ title: 'Новая попытка', description: 'Пограничный тракт снова под атакой.' })
  }

  const selectedTower = selectedSpot !== null ? game.towers[selectedSpot] : undefined

  return (
    <div className="flex min-h-screen flex-col bg-[#1a140e]">
      <header className="sticky top-0 z-20 border-b-2 border-[#8a6d3b] bg-[#241b12]/95 backdrop-blur">
        <TopBar
          ui={ui}
          onSpeed={() => game.setSpeed(ui.speed === 1 ? 2 : 1)}
          onHelp={() => setHelpOpen(true)}
          onRestart={doRestart}
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

            {/* Плавающая кнопка способности */}
            {ui.phase !== 'intro' && (
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

            {/* Интро */}
            {ui.phase === 'intro' && (
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
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">6 башен</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">слияние</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">4 типа брони</span>
                    <span className="rounded border border-[#8a6d3b55] px-2 py-1">аватар «Охотница»</span>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Button
                      onClick={() => game.beginPreview()}
                      className="h-11 border-2 border-[#b08d57] bg-[#3a2e1c] px-6 font-serif text-base font-bold text-[#ffd700] hover:bg-[#4a3a24]"
                    >
                      ⚙ Начать игру
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

            {/* Поражение */}
            {ui.phase === 'over' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#120d08]/90 p-4">
                <div className="max-w-sm text-center">
                  <h2 className="mb-2 font-serif text-3xl font-black text-[#e05252]">ОБОРОНА ПАЛА</h2>
                  <p className="mb-4 text-sm text-[#c8b896]">
                    Машины ИИ прорвались на волне {ui.wave}. Разлом поглощает тракт...
                  </p>
                  <Stats ui={ui} />
                  <Button
                    onClick={doRestart}
                    className="mt-4 h-10 border-2 border-[#b08d57] bg-[#3a2e1c] px-6 font-serif font-bold text-[#ffd700] hover:bg-[#4a3a24]"
                  >
                    Играть снова
                  </Button>
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
                  <Button
                    onClick={doRestart}
                    className="mt-4 h-10 border-2 border-[#b08d57] bg-[#3a2e1c] px-6 font-serif font-bold text-[#ffd700] hover:bg-[#4a3a24]"
                  >
                    Играть снова
                  </Button>
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-center text-[10px] text-[#8a6d3b]">
            Клик по площадке — стройка · клик по башне — улучшение/слияние/продажа · клик по земле — движение Охотницы
          </p>
        </section>

        {/* Боковая панель */}
        <aside className="flex w-full flex-col gap-3 lg:w-[350px] lg:shrink-0">
          <WavePanel ui={ui} onStart={() => game.startWave()} />
          <div ref={panelRef} className="flex flex-col gap-3">
            {mergeFrom !== null ? (
              <MergePanel game={game} from={mergeFrom} onCancel={() => setMergeFrom(null)} />
            ) : selectedSpot !== null && selectedTower ? (
              <TowerPanel
                game={game}
                spot={selectedSpot}
                gold={ui.gold}
                nextArmor={ui.nextWaveArmor}
                onUpgrade={doUpgrade}
                onSell={doSell}
                onMergeStart={() => {
                  setMergeFrom(selectedSpot)
                  setSelectedSpot(null)
                }}
                onClose={() => setSelectedSpot(null)}
              />
            ) : selectedSpot !== null ? (
              <BuildMenu spot={selectedSpot} gold={ui.gold} onBuild={doBuild} onClose={() => setSelectedSpot(null)} />
            ) : (
              <ShopList gold={ui.gold} />
            )}
          </div>
          <AvatarPanel ui={ui} onAbility={doAbility} />
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
