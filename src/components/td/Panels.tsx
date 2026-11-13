'use client'

// UI-панели прототипа «Железный Разлом»

import { useState } from 'react'
import { ARMOR_COLORS, ARMOR_NAMES, ATTACK_NAMES, MERGED_TOWERS, TOWERS, DAMAGE_MATRIX, LEVEL_MULT, SELL_RATIO, ALL_DEFS, econIncomeAt, econIncomeBase } from '@/game/config'
import { mergePartnersText } from '@/game/engine'
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
import { X, Coins, Repeat2, Trash2, Copy, Check, Clock } from 'lucide-react'

export type MpRole = 'single' | 'host' | 'guest'
export type MpStatus = 'off' | 'waiting' | 'linked'

import { ATTACK_COLORS, ARMOR_ICONS, DamageBadge, EffectiveVs, effectLines, isEcon } from './TowerInfo'
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
  nextArmor,
  onSell,
  onMergeStart,
  onClose,
}: {
  game: Game
  towerId: number | null
  nextArmor: ArmorType
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
  const refund = Math.floor(tw.invested * SELL_RATIO)
  const econ = isEcon(def)
  const canMerge = !def.merged && !econ && tw.level >= 3
  // копии в «руке»: сколько ещё это башню прокачают (рука хоста/гостя синхронизируется снапшотами)
  const copies = game.hand.filter((id) => id === tw.defId).length

  return (
    <div className="td-ornate rounded-xl border border-[#3a4660]/90 bg-[rgba(10,15,24,0.9)] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-black text-[#e8ecf4]">
          <span className="text-xl leading-none">{def.glyph}</span>
          {def.name}
          <span className="font-mono text-[11px] font-bold text-[#7088a8]">ур. {tw.level}/5</span>
        </span>
        <button onClick={onClose} className="text-[#7088a8] transition-colors hover:text-[#f2c94c]" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {econ ? (
          <span className="inline-flex items-center gap-1 rounded-sm border border-[#e8c17088] bg-[#e8c1701f] px-1 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-[#e8c170]">
            🪙 экономика
          </span>
        ) : (
          attacks.map((a, i) => (
            <DamageBadge key={a + i} type={a} className="!text-[10px]" />
          ))
        )}
        {def.merged && (
          <BrassTag color="#ffd700">уникальная</BrassTag>
        )}
      </div>
      {!def.merged && <p className="mb-1 text-[11px] text-[#94a3b8]">{def.role}</p>}
      {def.merged && <p className="mb-1 text-[11px] text-[#94a3b8]">{def.desc}</p>}
      <div className="mb-2">
        <EffectiveVs def={def} />
      </div>
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg border border-[#2e3c52]/80 bg-[#0a0f17]/70 p-2 text-center font-mono text-xs">
        {econ ? (
          def.income ? (
            <>
              <div>
                <div className="text-[9px] uppercase text-[#7088a8]">доход</div>
                <div className="text-[#f2c94c]">+{econIncomeAt(def, tw.level)}/волну</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-[#7088a8]">за уровень</div>
                <div className="text-[#e8d9a0]">+{econIncomeBase(def)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-[#7088a8]">атака</div>
                <div className="text-[#8a96a8]">нет</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[9px] uppercase text-[#7088a8]">доход</div>
                <div className="text-[#a6f095]">+{econIncomeAt(def, tw.level)}💠/волну</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-[#7088a8]">за уровень</div>
                <div className="text-[#c9e8bd]">+{econIncomeBase(def)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase text-[#7088a8]">атака</div>
                <div className="text-[#8a96a8]">нет</div>
              </div>
            </>
          )
        ) : (
          <>
            <div>
              <div className="text-[9px] uppercase text-[#7088a8]">урон</div>
              <div className="text-[#f2c94c]">{dmg}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-[#7088a8]">DPS vs след.</div>
              <div className="text-[#7fd0a0]">{dps}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase text-[#7088a8]">радиус</div>
              <div className="text-[#ccd8e6]">{range}</div>
            </div>
          </>
        )}
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
        <p className="mb-2 rounded-lg border border-[#f2c94c]/40 bg-[rgba(242,201,76,0.08)] px-2 py-1 text-[11px] text-[#f2c94c]">
          ★ {def.l5}
        </p>
      ) : (
        <p className="mb-2 text-[10px] text-[#7088a8]">5 ур.: {def.l5}</p>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          onClick={onMergeStart}
          disabled={!canMerge}
          size="sm"
          className="h-8 rounded-lg border border-[#59c27a]/60 bg-[rgba(89,194,122,0.12)] px-1 text-[11px] font-bold text-[#a6f095] hover:bg-[rgba(89,194,122,0.22)] disabled:opacity-40"
        >
          <Repeat2 className="mr-0.5 h-3 w-3" />
          Слить
        </Button>
        <Button
          onClick={onSell}
          size="sm"
          className="h-8 gap-0.5 rounded-lg border border-[#e05252]/50 bg-[rgba(224,82,82,0.1)] px-1 text-[11px] font-bold text-[#ff9a8a] hover:bg-[rgba(224,82,82,0.2)]"
          title={`Продать: вернётся ${refund} золота`}
        >
          <Trash2 className="mr-0.5 h-3 w-3" />+{refund}
        </Button>
      </div>
      {tw.level < 5 && (
        <p className="mt-1.5 text-[10px] leading-snug text-[#7088a8]">
          Прокачка: купите копию в арсенале — она ляжет в «руку», затем наведите копию из руки на эту башню (+1 уровень).
          {copies > 0 && <> В руке копий: <span className="font-bold text-[#c9d6e8]">{copies}</span>.</>}
        </p>
      )}
      {!def.merged && (
        <p className="mt-1.5 text-[10px] leading-snug text-[#7088a8]">
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
    <div className="td-ornate rounded-xl border border-[#59c27a]/50 bg-[rgba(10,18,13,0.9)] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-black text-[#a6f095]">
          <Repeat2 className="h-4 w-4" />
          Слияние: {def.glyph} {def.name} <span className="font-mono text-[11px] text-[#7088a8]">ур. {tw.level}</span>
        </span>
        <button onClick={onCancel} className="text-[#a6f095]/60 transition-colors hover:text-[#a6f095]" aria-label="Отмена">
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
                <li key={t} className="flex items-center gap-2 rounded-lg border border-[#59c27a]/30 bg-[rgba(10,15,24,0.7)] px-2 py-1 text-xs">
                  <span>{odef.glyph} {odef.name} (ур. {other.level})</span>
                  <span className="ml-auto text-[#a6f095]">→ {recipe?.glyph} {recipe?.name}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-[10px] text-[#a6f095]/70">
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
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto rounded-2xl border border-[#3a4660]/90 bg-[rgba(9,13,21,0.96)] text-[#c3cbe0] backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black uppercase tracking-[0.1em] text-[#e8ecf4]">Как играть</DialogTitle>
          <DialogDescription className="text-xs text-[#94a3b8]">
            Заражённые минералом звери и автоматоны идут по тракту к лагерю беженцев. Продержитесь 30 волн — боссы на 10-й, 20-й и 30-й!
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-1 text-xs leading-relaxed">
          <p>
            <b className="text-[#f2c94c]">Главное здание:</b> 200 HP (на Новобранце 280, на Кошмаре 150).
            Каждый заражённый, дошедший до лагеря, отнимает 10 HP, босс — 100. При 0 HP миссия проиграна.
          </p>
          <p>
            <b className="text-[#f2c94c]">Управление:</b> поле разбито на клетки, одна башня — одна клетка.
            Перетащите башню из арсенала на свободную клетку (не на тракт) — пока тянете, видно радиус атаки.
            Можно и иначе: нажать башню в арсенале, потом клетку; Esc — отмена. Клик по башне — улучшить, слить,
            продать; клик по пустой земле — Сорока идёт туда.
          </p>
          <p>
            <b className="text-[#f2c94c]">Арсенал:</b> строить можно только башни из текущего пула — 5 случайных
            из {TOWERS.length}. Ролл за 10 золота меняет весь пул.
          </p>
          <p>
            <b className="text-[#f2c94c]">Уровни:</b> покупка копии башни повышает уровень (до 5): урон ×1.9,
            ×3.2, ×5.0, ×7.5. На 5 уровне — способность.
          </p>
          <p>
            <b className="text-[#f2c94c]">Пауза:</b> кнопка вверху или клавиша P. На паузе можно строить,
            улучшать, сливать и роллить.
          </p>
          <p>
            <b className="text-[#f2c94c]">Слияние:</b> две РАЗНЫЕ башни 3+ ур. на расстоянии до 140 px →
            уникальная башня с гибридной атакой (лучший множитель из двух типов против каждой цели).
          </p>
          <p>
            <b className="text-[#f2c94c]">Карта:</b> 6 карт на выбор — у каждой своя тропа и особенность
            (например, на Ледяном перевале заражённые быстрее на 10%).
          </p>
          <p>
            <b className="text-[#f2c94c]">Волны:</b> всего 30, тип брони виден заранее — стройте контр-башни.
            Волны 9, 19 и 29 — денежные (золото ×3), 10, 20 и 30 — боссы. С 21-й волны броня смешана,
            а с каждой волной заражённые чуть быстрее.
          </p>
          <p>
            <b className="text-[#f2c94c]">Сложности:</b> Новобранец — HP врагов ×0.75, 200 золота, здание 280 HP
            и прогноз брони на две волны. Ветеран — базовые числа. Кошмар — HP ×1.4, 120 золота, здание 150 HP,
            смешанная броня с 11-й волны и вторая способность у боссов.
          </p>
        </section>

        <section>
          <p className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#f2c94c]">Матрица урона</p>
          <div className="overflow-x-auto rounded-lg border border-[#3a4660]/60">
            <table className="w-full border-collapse text-center font-mono text-[10px]">
              <thead>
                <tr className="bg-[rgba(31,38,56,0.7)]">
                  <th className="p-1 text-left text-[#7088a8]">атака \ броня</th>
                  {armors.map((a) => (
                    <th key={a} className="p-1" style={{ color: ARMOR_COLORS[a] }}>
                      {ARMOR_ICONS[a]} {ARMOR_NAMES[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attacks.map((at) => (
                  <tr key={at} className="border-t border-[#3a4660]/30">
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
          <p className="mt-1 text-[10px] text-[#7088a8]">
            Специализированная атака бьёт «свою» броню на 150%. Универсальная — 80% по любой, кроме
            универсальной брони (120%).
          </p>
        </section>

        <section>
          <p className="mb-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#f2c94c]">Книга слияний</p>
          <ul className="space-y-1">
            {MERGED_TOWERS.map((m) => {
              const pa = ALL_DEFS[m.parents[0]] as TowerDef
              const pb = ALL_DEFS[m.parents[1]] as TowerDef
              return (
                <li key={m.id} className="rounded-lg border border-[#3a4660]/60 bg-[rgba(31,38,56,0.5)] p-2 text-xs">
                  <span className="font-bold text-[#f2c94c]">
                    {m.glyph} {m.name}
                  </span>
                  <span className="ml-1 text-[#94a3b8]">
                    = {pa.glyph} {pa.name} + {pb.glyph} {pb.name}
                  </span>
                  <p className="text-[10px] text-[#7088a8]">{m.desc}</p>
                </li>
              )
            })}
          </ul>
          <p className="mt-1 text-[10px] text-[#7088a8]">
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
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-[rgba(6,9,14,0.85)] p-4 backdrop-blur-md">
      <div className="td-ornate w-full max-w-md rounded-2xl border border-[#59c27a]/40 bg-[rgba(9,15,12,0.9)] p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#59c27a]">
          кооп · два игрока · один тракт
        </p>
        <h2 className="mb-3 text-2xl font-black tracking-[0.06em] text-[#e8ecf4]">КООП-ЛОББИ</h2>

        <div className="mb-3 rounded-xl border border-[#3a4660]/80 bg-[rgba(10,15,24,0.7)] p-3">
          <p className="mb-1 text-xs text-[#c3cbe0]">Пригласительная ссылка — отправьте её другу:</p>
          <div className="mb-2 break-all rounded-lg border border-[#3a4660]/60 bg-[rgba(8,11,17,0.9)] px-2 py-1.5 font-mono text-[11px] text-[#a6f095]">
            {inviteUrl}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={copy}
              size="sm"
              className="h-9 rounded-lg border border-[#59c27a]/60 bg-[rgba(89,194,122,0.12)] px-4 text-[12px] font-bold text-[#a6f095] hover:bg-[rgba(89,194,122,0.22)]"
            >
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? 'Скопировано!' : 'Копировать ссылку'}
            </Button>
            <span className="rounded-lg border border-[#f2c94c]/40 bg-[rgba(242,201,76,0.07)] px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-[#f2c94c]">
              {code}
            </span>
          </div>
        </div>

        <p className="mb-1 flex items-center justify-center gap-1.5 text-xs">
          {status === 'linked' ? (
            <span className="font-bold text-[#a6f095]">● Друг в лобби! Можно начинать</span>
          ) : (
            <span className="flex items-center gap-1 text-[#7088a8]">
              <Clock className="h-3.5 w-3.5 animate-pulse" /> Ожидание друга...
            </span>
          )}
        </p>
        <p className="mb-3 text-[10px] leading-snug text-[#7088a8]">
          Друг открывает ссылку с телефона или ПК и сразу попадает сюда. Общий строй: строить могут оба,
          Сорока — у хоста, HP волн ×1.85 (GDD кооп).
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          {!inGame && (
            <Button
              onClick={onStart}
              className="h-11 rounded-xl px-6 text-[13px] font-black uppercase tracking-wide text-[#1a1408] hover:brightness-105"
              style={{
                background: 'linear-gradient(180deg, #ffd76b 0%, #eebd45 55%, #e0a832 100%)',
                boxShadow: '0 4px 18px rgba(242,201,76,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              ⚙ Начать игру
            </Button>
          )}
          {!inGame && (
            <Button
              onClick={onHelp}
              variant="outline"
              className="h-11 rounded-xl border-[#3a4660] bg-[rgba(31,38,56,0.6)] px-4 text-[12px] font-bold text-[#e8ecf4] hover:bg-[rgba(43,53,80,0.8)] hover:text-[#e8ecf4]"
            >
              Как играть
            </Button>
          )}
          <Button
            onClick={onClose}
            variant="outline"
            className="h-11 rounded-xl border-[#3a4660]/60 bg-transparent px-4 text-[12px] font-bold text-[#8fa0ba] hover:bg-[rgba(31,38,56,0.6)] hover:text-[#ff8a8a]"
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
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(6,9,14,0.85)] p-4 backdrop-blur-md">
      <div className="td-ornate max-w-sm rounded-2xl border border-[#3a4660]/90 bg-[rgba(10,15,24,0.88)] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        {hostLeft ? (
          <>
            <h2 className="mb-2 text-2xl font-black tracking-[0.06em] text-[#ff7a7a]">ХОСТ ОТКЛЮЧИЛСЯ</h2>
            <p className="mb-4 text-sm text-[#c3cbe0]">
              Лобби {code} закрыто. Попросите хоста создать новое и прислать ссылку.
            </p>
            <Button
              onClick={() => window.location.replace('/')}
              className="h-10 rounded-xl px-6 text-[13px] font-black uppercase tracking-wide text-[#1a1408] hover:brightness-105"
              style={{
                background: 'linear-gradient(180deg, #ffd76b 0%, #eebd45 55%, #e0a832 100%)',
                boxShadow: '0 4px 18px rgba(242,201,76,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              На главный экран
            </Button>
          </>
        ) : (
          <>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#59c27a]">
              кооп-лобби
            </p>
            <h2 className="mb-3 font-mono text-3xl font-black tracking-[0.3em] text-[#f2c94c]">{code}</h2>
            <p className="mb-4 flex items-center justify-center gap-2 text-sm text-[#c3cbe0]">
              <Clock className="h-4 w-4 animate-pulse text-[#59c27a]" />
              {status === 'linked' || status === 'waiting'
                ? 'Подключено! Ждём, пока хост начнёт игру...'
                : 'Подключение...'}
            </p>
            <p className="text-[10px] leading-snug text-[#7088a8]">
              Вы гость: строите башни вместе с хостом, запускаете волны, сливаете башни.
              Сорока и перезапуск — у хоста.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
