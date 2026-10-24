'use client'

// UI-панели прототипа «Железный Разлом»

import { useState } from 'react'
import { ARMOR_COLORS, ARMOR_NAMES, ATTACK_NAMES, MERGED_TOWERS, TOWERS, DAMAGE_MATRIX, LEVEL_MULT, SELL_RATIO, ALL_DEFS } from '@/game/config'
import { mergePartnersText, upgradeCost } from '@/game/engine'
import type { Game } from '@/game/engine'
import type { ArmorType, AttackType, TowerDef, UiState, Vec } from '@/game/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, Coins, Repeat2, Trash2, ChevronUp, Copy, Check, Clock } from 'lucide-react'

export type MpRole = 'single' | 'host' | 'guest'
export type MpStatus = 'off' | 'waiting' | 'linked'

import { ATTACK_COLORS, ARMOR_ICONS, DamageBadge, EffectiveVs, effectLines } from './TowerInfo'
export { ATTACK_COLORS, ARMOR_ICONS }

function BrassTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color, borderColor: color + '66', background: color + '14' }}
    >
      {children}
    </span>
  )
}

// ─── Общие элементы интерфейса: один вид для всех панелей ─────────────────

/** Цена в золоте — везде одинаково: монета + число (красное, если не хватает) */
export function Price({ value, ok = true, className = '' }: { value: number; ok?: boolean; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 font-mono tabular-nums ${ok ? 'text-[#f0b060]' : 'text-[#e05252]'} ${className}`}>
      <Coins className="h-3 w-3" />
      {value}
    </span>
  )
}

// ─── Панель башни ────────────────────────────────────────────────────────
export function TowerPanel({
  game,
  towerId,
  gold,
  nextArmor,
  onUpgrade,
  onSell,
  onMergeStart,
  onClose,
}: {
  game: Game
  towerId: number | null
  gold: number
  nextArmor: ArmorType
  onUpgrade: () => void
  onSell: () => void
  onMergeStart: () => void
  onClose: () => void
}) {
  const tw = towerId !== null ? game.towerById(towerId) : undefined
  if (!tw) return null
  const def = ALL_DEFS[tw.defId]
  const dmg = Math.round(def.damage * LEVEL_MULT[tw.level - 1] * 10) / 10
  const interval = def.interval * (tw.level >= 3 ? 0.9 : 1)
  const range = Math.round(def.range * (tw.level >= 4 ? 1.1 : tw.level >= 2 ? 1.05 : 1))
  const attacks: AttackType[] = def.merged ? def.attacks : [def.attack]
  const bestMult = Math.max(...attacks.map((a) => DAMAGE_MATRIX[a][nextArmor]))
  const dps = Math.round(((dmg / interval) * bestMult) * 10) / 10
  const cost = upgradeCost(def)
  const refund = Math.floor(tw.invested * SELL_RATIO)
  const canMerge = !def.merged && tw.level >= 3

  return (
    <div className="rounded-lg border-2 border-[#5b6f8c] bg-[#141b27] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2 font-serif text-sm font-bold text-[#f0b060]">
          <span className="text-xl leading-none">{def.glyph}</span>
          {def.name}
          <span className="font-mono text-xs text-[#7088a8]">ур. {tw.level}/5</span>
        </span>
        <button onClick={onClose} className="text-[#5b6f8c] hover:text-[#f0b060]" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {attacks.map((a, i) => (
          <DamageBadge key={a + i} type={a} className="!text-[10px]" />
        ))}
        {def.merged && (
          <BrassTag color="#ffd700">уникальная</BrassTag>
        )}
      </div>
      {!def.merged && <p className="mb-1 text-[11px] text-[#94a3b8]">{def.role}</p>}
      {def.merged && <p className="mb-1 text-[11px] text-[#94a3b8]">{def.desc}</p>}
      <div className="mb-2">
        <EffectiveVs def={def} />
      </div>
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-md border border-[#5b6f8c55] bg-[#0f151f] p-2 text-center font-mono text-xs">
        <div>
          <div className="text-[9px] uppercase text-[#5b6f8c]">урон</div>
          <div className="text-[#f0b060]">{dmg}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-[#5b6f8c]">DPS vs след.</div>
          <div className="text-[#7fd0a0]">{dps}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-[#5b6f8c]">радиус</div>
          <div className="text-[#ccd8e6]">{range}</div>
        </div>
      </div>
      {effectLines(def).length > 0 && (
        <ul className="mb-2 flex flex-col gap-0.5 rounded border border-[#2e3c52] bg-[#0a0f17]/60 px-2 py-1">
          {effectLines(def).map((e) => (
            <li key={e} className="flex gap-1 text-[10.5px] leading-snug text-[#c9d6e8]">
              <span className="text-[#f0b060]">◆</span>
              {e}
            </li>
          ))}
        </ul>
      )}
      {tw.level >= 5 ? (
        <p className="mb-2 rounded border border-[#ffd70055] bg-[#19212e] px-2 py-1 text-[11px] text-[#ffd700]">
          ★ {def.l5}
        </p>
      ) : (
        <p className="mb-2 text-[10px] text-[#5b6f8c]">5 ур.: {def.l5}</p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          onClick={onUpgrade}
          disabled={tw.level >= 5 || gold < cost}
          size="sm"
          className="h-8 gap-0.5 border border-[#7088a8] bg-[#1f2a3b] px-1 text-[11px] text-[#ffd700] hover:bg-[#26344a] disabled:opacity-40"
          title="Повысить уровень"
        >
          <ChevronUp className="h-3 w-3" />
          {tw.level >= 5 ? 'макс.' : <Price value={cost} ok={gold >= cost} />}
        </Button>
        <Button
          onClick={onMergeStart}
          disabled={!canMerge}
          size="sm"
          className="h-8 border border-[#7fd0a088] bg-[#243326] px-1 text-[11px] text-[#7fd0a0] hover:bg-[#2e4230] disabled:opacity-40"
        >
          <Repeat2 className="mr-0.5 h-3 w-3" />
          Слить
        </Button>
        <Button
          onClick={onSell}
          size="sm"
          className="h-8 gap-0.5 border border-[#e0525288] bg-[#33241c] px-1 text-[11px] text-[#e08870] hover:bg-[#42291f]"
          title={`Продать: вернётся ${refund} золота`}
        >
          <Trash2 className="mr-0.5 h-3 w-3" />+{refund}
        </Button>
      </div>
      {!def.merged && (
        <p className="mt-1.5 text-[10px] leading-snug text-[#5b6f8c]">
          {canMerge ? 'Слияние: выберите башню 3+ ур. в пределах 140 px. ' : 'Слияние — с 3 уровня, вторая башня в пределах 140 px. '}
          Сливается с: {mergePartnersText(def.id)}.
        </p>
      )}
    </div>
  )
}

// ─── Панель слияния ──────────────────────────────────────────────────────
export function MergePanel({
  game,
  from,
  onCancel,
}: {
  game: Game
  from: number
  onCancel: () => void
}) {
  const tw = game.towerById(from)
  if (!tw) return null
  const def = ALL_DEFS[tw.defId]
  const targets = game.mergeTargetsFor(from)
  return (
    <div className="rounded-lg border-2 border-[#7fd0a0] bg-[#1d2a20] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-serif text-sm font-bold text-[#7fd0a0]">
          <Repeat2 className="mr-1 inline h-4 w-4" />
          Слияние: {def.glyph} {def.name} (ур. {tw.level})
        </span>
        <button onClick={onCancel} className="text-[#7fd0a0aa] hover:text-[#7fd0a0]" aria-label="Отмена">
          <X className="h-4 w-4" />
        </button>
      </div>
      {targets.length > 0 ? (
        <>
          <p className="mb-2 text-xs text-[#c8d8c0]">
            Коснитесь подсвеченной башни рядом (до 140 px):
          </p>
          <ul className="space-y-1">
            {targets.map((t) => {
              // ВАЖНО: towers — массив, id не равен индексу после слияния/продажи.
              // Ищем по id, а не game.towers[t] (иначе undefined после сдвига массива).
              const other = game.towerById(t)
              if (!other) return null
              const odef = ALL_DEFS[other.defId]
              const recipe = MERGED_TOWERS.find(
                (m) =>
                  (m.parents[0] === tw.defId && m.parents[1] === other.defId) ||
                  (m.parents[1] === tw.defId && m.parents[0] === other.defId)
              )
              return (
                <li key={t} className="flex items-center gap-2 rounded border border-[#7fd0a044] bg-[#141b27] px-2 py-1 text-xs">
                  <span>{odef.glyph} {odef.name} (ур. {other.level})</span>
                  <span className="ml-auto text-[#7fd0a0]">→ {recipe?.glyph} {recipe?.name}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[10px] text-[#7fd0a099]">
            Уровень новой башни = меньший из двух. Вторая башня исчезнет, её вложенное золото перейдёт в новую.
          </p>
        </>
      ) : (
        <p className="text-xs text-[#c8d8c0]">
          Рядом нет подходящей пары. {def.name} сливается только с: {mergePartnersText(def.id)}. Вторая башня
          тоже должна быть 3+ уровня и стоять в пределах 140 px.
        </p>
      )}
    </div>
  )
}

// ─── Справка ─────────────────────────────────────────────────────────────
export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const armors: ArmorType[] = ['light', 'medium', 'heavy', 'universal']
  const attacks: AttackType[] = ['pierce', 'crush', 'magic', 'universal']
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-2 border-[#5b6f8c] bg-[#141b27] text-[#ccd8e6]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#f0b060]">Как играть</DialogTitle>
          <DialogDescription className="text-xs text-[#94a3b8]">
            Заражённые минералом звери и автоматоны идут по тракту к лагерю беженцев. Продержитесь 10 волн!
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-1 text-xs leading-relaxed">
          <p>
            <b className="text-[#f0b060]">Жизни:</b> 20. Каждый заражённый, дошедший до лагеря, отнимает 1, босс — 10.
          </p>
          <p>
            <b className="text-[#f0b060]">Управление:</b> поле разбито на клетки, одна башня — одна клетка.
            Перетащите башню из арсенала на свободную клетку (не на тракт) — пока тянете, видно радиус атаки.
            Можно и иначе: нажать башню в арсенале, потом клетку; Esc — отмена. Клик по башне — улучшить, слить,
            продать; клик по пустой земле — Охотница идёт туда.
          </p>
          <p>
            <b className="text-[#f0b060]">Арсенал:</b> строить можно только башни из текущего пула — 5 случайных
            из {TOWERS.length}. Ролл за 10 золота меняет весь пул.
          </p>
          <p>
            <b className="text-[#f0b060]">Уровни:</b> покупка копии башни повышает уровень (до 5): урон ×1.9,
            ×3.2, ×5.0, ×7.5. На 5 уровне — способность.
          </p>
          <p>
            <b className="text-[#f0b060]">Пауза:</b> кнопка вверху или клавиша P. На паузе можно строить,
            улучшать, сливать и роллить.
          </p>
          <p>
            <b className="text-[#f0b060]">Слияние:</b> две РАЗНЫЕ башни 3+ ур. на расстоянии до 140 px →
            уникальная башня с гибридной атакой (лучший множитель из двух типов против каждой цели).
          </p>
          <p>
            <b className="text-[#f0b060]">Карта:</b> тракт генерируется заново в каждой игре.
          </p>
          <p>
            <b className="text-[#f0b060]">Волны:</b> тип брони виден заранее — стройте контр-башни. Волна 9 —
            денежная (золото ×3), волна 10 — босс.
          </p>
        </section>

        <section>
          <p className="mb-1.5 font-serif text-sm font-bold text-[#f0b060]">Матрица урона</p>
          <div className="overflow-x-auto rounded border border-[#5b6f8c55]">
            <table className="w-full border-collapse text-center font-mono text-[10px]">
              <thead>
                <tr className="bg-[#19212e]">
                  <th className="p-1 text-left text-[#5b6f8c]">атака \ броня</th>
                  {armors.map((a) => (
                    <th key={a} className="p-1" style={{ color: ARMOR_COLORS[a] }}>
                      {ARMOR_ICONS[a]} {ARMOR_NAMES[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attacks.map((at) => (
                  <tr key={at} className="border-t border-[#5b6f8c33]">
                    <td className="p-1 text-left" style={{ color: ATTACK_COLORS[at] }}>
                      {ATTACK_NAMES[at]}
                    </td>
                    {armors.map((ar) => {
                      const v = DAMAGE_MATRIX[at][ar]
                      return (
                        <td
                          key={ar}
                          className="p-1"
                          style={{
                            color: v >= 1.5 ? '#7fd0a0' : v >= 1.0 ? '#ccd8e6' : '#e05252',
                            background: v >= 1.5 ? 'rgba(127,208,160,0.08)' : v < 1 ? 'rgba(224,82,82,0.06)' : undefined,
                          }}
                        >
                          {Math.round(v * 100)}%
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-[#5b6f8c]">
            Специализированная атака бьёт «свою» броню на 150%. Универсальная — 80% по любой, кроме
            универсальной брони (120%).
          </p>
        </section>

        <section>
          <p className="mb-1.5 font-serif text-sm font-bold text-[#f0b060]">Книга слияний</p>
          <ul className="space-y-1">
            {MERGED_TOWERS.map((m) => {
              const pa = ALL_DEFS[m.parents[0]] as TowerDef
              const pb = ALL_DEFS[m.parents[1]] as TowerDef
              return (
                <li key={m.id} className="rounded border border-[#5b6f8c44] bg-[#19212e] p-2 text-xs">
                  <span className="font-semibold text-[#f0b060]">
                    {m.glyph} {m.name}
                  </span>
                  <span className="ml-1 text-[#94a3b8]">
                    = {pa.glyph} {pa.name} + {pb.glyph} {pb.name}
                  </span>
                  <p className="text-[10px] text-[#5b6f8c]">{m.desc}</p>
                </li>
              )
            })}
          </ul>
          <p className="mt-1 text-[10px] text-[#5b6f8c]">
            Все {MERGED_TOWERS.length} рецептов открыты сразу. Обе башни — 3+ уровня и рядом.
          </p>
        </section>
      </DialogContent>
    </Dialog>
  )
}

// ─── Мультиплеер: лобби хоста (приглашение) ──────────────────────────────
export function MpLobbyPanel({
  code,
  inviteUrl,
  status,
  onStart,
  onClose,
  onHelp,
  inGame = false,
}: {
  code: string
  inviteUrl: string
  status: MpStatus
  onStart: () => void
  onClose: () => void
  onHelp: () => void
  inGame?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = inviteUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-[#0a0e15]/90 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-lg border-2 border-[#7fd0a0] bg-[#1d2a20] p-4 text-center shadow-[0_0_30px_rgba(0,0,0,0.7)]">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#7fd0a0]">
          кооп · два игрока · один тракт
        </p>
        <h2 className="mb-3 font-serif text-2xl font-black text-[#7fd0a0]">КООП-ЛОББИ</h2>

        <div className="mb-3 rounded border border-[#7fd0a044] bg-[#141b27] p-3">
          <p className="mb-1 text-xs text-[#c8d8c0]">Пригласительная ссылка — отправьте её другу:</p>
          <div className="mb-2 break-all rounded bg-[#0a0e15] px-2 py-1.5 font-mono text-[11px] text-[#7fd0a0]">
            {inviteUrl}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={copy}
              size="sm"
              className="h-9 border-2 border-[#7fd0a0] bg-[#243a2c] px-4 font-bold text-[#a8e8c0] hover:bg-[#2d4a38]"
            >
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? 'Скопировано!' : 'Копировать ссылку'}
            </Button>
            <span className="rounded border border-[#7088a888] bg-[#141b27] px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-[#f0b060]">
              {code}
            </span>
          </div>
        </div>

        <p className="mb-1 flex items-center justify-center gap-1.5 text-xs">
          {status === 'linked' ? (
            <span className="font-bold text-[#7fd0a0]">● Друг в лобби! Можно начинать</span>
          ) : (
            <span className="flex items-center gap-1 text-[#7088a8]">
              <Clock className="h-3.5 w-3.5 animate-pulse" /> Ожидание друга...
            </span>
          )}
        </p>
        <p className="mb-3 text-[10px] leading-snug text-[#5b6f8c]">
          Друг открывает ссылку с телефона или ПК и сразу попадает сюда. Общий строй: строить могут оба,
          Охотница — у хоста, HP волн ×1.85 (GDD кооп).
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {!inGame && (
            <Button
              onClick={onStart}
              className="h-11 border-2 border-[#7088a8] bg-[#1f2a3b] px-6 font-serif text-base font-bold text-[#ffd700] hover:bg-[#26344a]"
            >
              ⚙ Начать игру
            </Button>
          )}
          {!inGame && (
            <Button
              onClick={onHelp}
              variant="outline"
              className="h-11 border-[#5b6f8c] bg-transparent px-4 text-sm text-[#ccd8e6] hover:bg-[#1f2a3b]"
            >
              Как играть
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="outline"
            className="h-11 border-[#5b6f8c55] bg-transparent px-4 text-sm text-[#5b6f8c] hover:bg-[#1f2a3b] hover:text-[#e05252]"
          >
            {inGame ? 'Закрыть' : 'Один игрок'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Мультиплеер: экран ожидания гостя ───────────────────────────────────
export function MpGuestWait({
  code,
  status,
  hostLeft,
}: {
  code: string
  status: MpStatus
  hostLeft: boolean
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0e15]/90 p-4 backdrop-blur-[2px]">
      <div className="max-w-sm text-center">
        {hostLeft ? (
          <>
            <h2 className="mb-2 font-serif text-2xl font-black text-[#e05252]">ХОСТ ОТКЛЮЧИЛСЯ</h2>
            <p className="mb-4 text-sm text-[#b8c6d8]">
              Лобби {code} закрыто. Попросите хоста создать новое и прислать ссылку.
            </p>
            <Button
              onClick={() => window.location.replace('/')}
              className="h-10 border-2 border-[#7088a8] bg-[#1f2a3b] px-6 font-serif font-bold text-[#ffd700] hover:bg-[#26344a]"
            >
              На главный экран
            </Button>
          </>
        ) : (
          <>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#7fd0a0]">
              кооп-лобби
            </p>
            <h2 className="mb-3 font-serif text-3xl font-black tracking-widest text-[#f0b060]">{code}</h2>
            <p className="mb-4 flex items-center justify-center gap-2 text-sm text-[#b8c6d8]">
              <Clock className="h-4 w-4 animate-pulse text-[#7fd0a0]" />
              {status === 'linked' || status === 'waiting'
                ? 'Подключено! Ждём, пока хост начнёт игру...'
                : 'Подключение...'}
            </p>
            <p className="text-[10px] leading-snug text-[#5b6f8c]">
              Вы гость: строите башни вместе с хостом, запускаете волны, сливаете башни.
              Охотница и перезапуск — у хоста.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
