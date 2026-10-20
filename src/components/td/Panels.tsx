'use client'

// UI-панели прототипа «Железный Разлом»

import { ARMOR_COLORS, ARMOR_NAMES, ATTACK_NAMES, AVATAR, MERGED_TOWERS, TOWERS, DAMAGE_MATRIX, LEVEL_MULT, SELL_RATIO, ALL_DEFS } from '@/game/config'
import { upgradeCost } from '@/game/engine'
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
import { X, Heart, Coins, Swords, Zap, Repeat2, Trash2, ChevronUp } from 'lucide-react'

const ATTACK_COLORS: Record<AttackType, string> = {
  pierce: '#8fae6b',
  crush: '#c2874f',
  magic: '#d4694f',
  universal: '#b0a08a',
}

const ARMOR_ICONS: Record<ArmorType, string> = {
  light: '🪶',
  medium: '⚙',
  heavy: '🛡',
  universal: '✷',
}

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

// ─── Верхняя панель ──────────────────────────────────────────────────────
export function TopBar({
  ui,
  onSpeed,
  onHelp,
  onRestart,
}: {
  ui: UiState
  onSpeed: () => void
  onHelp: () => void
  onRestart: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">⚙</span>
        <span className="font-serif text-sm font-bold tracking-wide text-[#e8c170] sm:text-base">
          ЖЕЛЕЗНЫЙ РАЗЛОМ
        </span>
        <span className="hidden text-[10px] uppercase tracking-widest text-[#8a6d3b] md:inline">
          прототип · Пограничный тракт
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="flex items-center gap-1 rounded border border-[#8a6d3b55] bg-[#1a140e] px-2 py-1 font-mono text-sm text-[#e05252]" title="Жизни">
          <Heart className="h-3.5 w-3.5 fill-[#e05252]" /> {ui.lives}
        </span>
        <span className="flex items-center gap-1 rounded border border-[#8a6d3b55] bg-[#1a140e] px-2 py-1 font-mono text-sm text-[#e8c170]" title="Золото">
          <Coins className="h-3.5 w-3.5 text-[#e8c170]" /> {ui.gold}
        </span>
        <span className="flex items-center gap-1 rounded border border-[#8a6d3b55] bg-[#1a140e] px-2 py-1 font-mono text-sm text-[#d8cbb0]" title="Волна">
          <Swords className="h-3.5 w-3.5 text-[#b08d57]" /> {Math.min(ui.wave, ui.totalWaves)}/{ui.totalWaves}
        </span>
        <Button
          onClick={onSpeed}
          variant="outline"
          size="sm"
          className="h-8 border-[#8a6d3b] bg-[#2b2115] px-2 font-mono text-xs text-[#e8c170] hover:bg-[#3a2e1c] hover:text-[#ffd700]"
          title="Скорость игры"
        >
          ×{ui.speed}
        </Button>
        <Button
          onClick={onHelp}
          variant="outline"
          size="sm"
          className="h-8 border-[#8a6d3b] bg-[#2b2115] px-2 text-xs text-[#d8cbb0] hover:bg-[#3a2e1c]"
        >
          Как играть
        </Button>
        <Button
          onClick={onRestart}
          variant="outline"
          size="sm"
          className="h-8 border-[#8a6d3b55] bg-transparent px-2 text-xs text-[#8a6d3b] hover:bg-[#3a2e1c] hover:text-[#e05252]"
          title="Начать заново"
        >
          Заново
        </Button>
      </div>
    </div>
  )
}

// ─── Панель волны ────────────────────────────────────────────────────────
export function WavePanel({ ui, onStart }: { ui: UiState; onStart: () => void }) {
  const duringWave = ui.phase === 'wave'
  return (
    <div className="rounded-lg border-2 border-[#8a6d3b] bg-[#241b12] p-3">
      {duringWave ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-serif text-sm font-bold text-[#e8c170]">Волна {ui.wave}</span>
            <span className="font-mono text-xs text-[#d8cbb0]">
              живых: {ui.creepsAlive} · вышло из портала: {ui.waveSpawned}/{ui.waveTotal}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#1a140e]">
            <div
              className="h-full rounded-full bg-[#b08d57] transition-all"
              style={{ width: `${(ui.waveSpawned / Math.max(1, ui.waveTotal)) * 100}%` }}
            />
          </div>
        </>
      ) : ui.phase === 'preview' ? (
        <>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-serif text-sm font-bold text-[#e8c170]">
              Следующая волна: {ui.wave}
            </span>
            <span className="font-mono text-sm text-[#d8cbb0]">
              {Math.ceil(ui.previewRemaining)} с
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[#d8cbb0]">
            <BrassTag color={ARMOR_COLORS[ui.nextWaveArmor]}>
              {ARMOR_ICONS[ui.nextWaveArmor]} {ARMOR_NAMES[ui.nextWaveArmor]} броня
            </BrassTag>
            <span>{ui.nextWaveCount} машин</span>
          </div>
          {ui.nextWaveIsMoney && (
            <p className="mb-2 text-xs font-semibold text-[#7fd0a0]">
              💰 Денежная волна: золото за убийство ×3, бонус ×2!
            </p>
          )}
          {ui.nextWaveIsBoss && (
            <p className="mb-2 text-xs font-semibold text-[#e05252]">
              ⚠ БОСС «Титан-ИИ»: тяжёлая броня, −10 жизней при прорыве!
            </p>
          )}
          <Button
            onClick={onStart}
            className="h-9 w-full border-2 border-[#b08d57] bg-[#3a2e1c] font-serif font-bold text-[#ffd700] hover:bg-[#4a3a24]"
          >
            Начать волну сейчас
          </Button>
        </>
      ) : (
        <p className="text-center text-xs text-[#8a6d3b]">
          {ui.phase === 'intro' ? 'Нажмите «Начать игру»' : '...'}
        </p>
      )}
    </div>
  )
}

// ─── Меню постройки ──────────────────────────────────────────────────────
export function BuildMenu({
  pos,
  gold,
  onBuild,
  onClose,
}: {
  pos: Vec
  gold: number
  onBuild: (defId: string) => void
  onClose: () => void
}) {
  return (
    <div className="rounded-lg border-2 border-[#8a6d3b] bg-[#241b12] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-serif text-sm font-bold text-[#e8c170]">
          Постройка · {Math.round(pos.x)}:{Math.round(pos.y)}
        </span>
        <button onClick={onClose} className="text-[#8a6d3b] hover:text-[#e8c170]" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TOWERS.map((t) => {
          const affordable = gold >= t.price
          return (
            <button
              key={t.id}
              disabled={!affordable}
              onClick={() => onBuild(t.id)}
              className={`flex items-start gap-2 rounded-md border p-2 text-left transition-colors ${
                affordable
                  ? 'border-[#8a6d3b] bg-[#2b2115] hover:border-[#e8c170] hover:bg-[#3a2e1c]'
                  : 'cursor-not-allowed border-[#8a6d3b33] bg-[#221a10] opacity-50'
              }`}
            >
              <span className="text-xl leading-none">{t.glyph}</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-[#e8c170]">{t.name}</span>
                <span className="block text-[10px] leading-tight text-[#a89a80]">{t.role}</span>
                <span className="mt-1 flex items-center gap-1">
                  <BrassTag color={ATTACK_COLORS[t.attack]}>{ATTACK_NAMES[t.attack]}</BrassTag>
                  <span className={`font-mono text-[10px] ${affordable ? 'text-[#e8c170]' : 'text-[#e05252]'}`}>
                    {t.price}⚡
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-[#8a6d3b]">
        Повторная покупка той же башни повышает её уровень (до 5). Продажа возвращает {SELL_RATIO * 100}%.
      </p>
    </div>
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
    <div className="rounded-lg border-2 border-[#8a6d3b] bg-[#241b12] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2 font-serif text-sm font-bold text-[#e8c170]">
          <span className="text-xl leading-none">{def.glyph}</span>
          {def.name}
          <span className="font-mono text-xs text-[#b08d57]">ур. {tw.level}/5</span>
        </span>
        <button onClick={onClose} className="text-[#8a6d3b] hover:text-[#e8c170]" aria-label="Закрыть">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {attacks.map((a) => (
          <BrassTag key={a} color={ATTACK_COLORS[a]}>
            {ATTACK_NAMES[a]}
          </BrassTag>
        ))}
        {def.merged && (
          <BrassTag color="#ffd700">уникальная</BrassTag>
        )}
      </div>
      {!def.merged && <p className="mb-1 text-[11px] text-[#a89a80]">{def.role}</p>}
      {def.merged && <p className="mb-1 text-[11px] text-[#a89a80]">{def.desc}</p>}
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-md border border-[#8a6d3b55] bg-[#1a140e] p-2 text-center font-mono text-xs">
        <div>
          <div className="text-[9px] uppercase text-[#8a6d3b]">урон</div>
          <div className="text-[#e8c170]">{dmg}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-[#8a6d3b]">DPS vs след.</div>
          <div className="text-[#7fd0a0]">{dps}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase text-[#8a6d3b]">радиус</div>
          <div className="text-[#d8cbb0]">{range}</div>
        </div>
      </div>
      {tw.level >= 5 ? (
        <p className="mb-2 rounded border border-[#ffd70055] bg-[#2b2115] px-2 py-1 text-[11px] text-[#ffd700]">
          ★ {def.l5}
        </p>
      ) : (
        <p className="mb-2 text-[10px] text-[#8a6d3b]">5 ур.: {def.l5}</p>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          onClick={onUpgrade}
          disabled={tw.level >= 5 || gold < cost}
          size="sm"
          className="h-8 border border-[#b08d57] bg-[#3a2e1c] px-1 text-[11px] text-[#ffd700] hover:bg-[#4a3a24] disabled:opacity-40"
        >
          <ChevronUp className="mr-0.5 h-3 w-3" />
          {tw.level >= 5 ? 'макс.' : `${cost}⚡`}
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
          className="h-8 border border-[#e0525288] bg-[#33241c] px-1 text-[11px] text-[#e08870] hover:bg-[#42291f]"
        >
          <Trash2 className="mr-0.5 h-3 w-3" />
          {refund}⚡
        </Button>
      </div>
      {!def.merged && (
        <p className="mt-1.5 text-[10px] leading-snug text-[#8a6d3b]">
          {canMerge
            ? `Слияние: выберите башню 3+ ур. в пределах 140 px. Рецепты с «${def.name}»: ` +
              MERGED_TOWERS.filter((m) => m.parents.includes(def.id))
                .map((m) => m.name)
                .join(', ')
            : 'Слияние доступно с 3 уровня для двух разных башен на расстоянии до 140 px.'}
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
              const other = game.towers[t]!
              const odef = ALL_DEFS[other.defId]
              const recipe = MERGED_TOWERS.find(
                (m) =>
                  (m.parents[0] === tw.defId && m.parents[1] === other.defId) ||
                  (m.parents[1] === tw.defId && m.parents[0] === other.defId)
              )
              return (
                <li key={t} className="flex items-center gap-2 rounded border border-[#7fd0a044] bg-[#241b12] px-2 py-1 text-xs">
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
          Рядом нет подходящих башен: нужны разные башни 3+ уровня в пределах 140 px.
        </p>
      )}
    </div>
  )
}

// ─── Панель аватара ──────────────────────────────────────────────────────
export function AvatarPanel({ ui, onAbility }: { ui: UiState; onAbility: () => void }) {
  const cd = Math.ceil(ui.avatar.cooldown)
  const xpNext = ui.avatar.xpNext
  const xpPrev = xpNext ? [0, 3, 7, 12, 18, 25, 33, 42, 52][ui.avatar.level - 1] ?? 0 : 0
  const frac = xpNext ? Math.min(1, (ui.avatar.xp - xpPrev) / (xpNext - xpPrev)) : 1
  return (
    <div className="rounded-lg border-2 border-[#8a6d3b] bg-[#241b12] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2 font-serif text-sm font-bold text-[#e8c170]">
          <span className="text-lg leading-none">🏹</span>
          {AVATAR.name}
          <span className="font-mono text-xs text-[#b08d57]">ур. {ui.avatar.level}/10</span>
        </span>
        {xpNext !== null && (
          <span className="font-mono text-[10px] text-[#8a6d3b]">
            опыт {ui.avatar.xp}/{xpNext}
          </span>
        )}
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1a140e]">
        <div className="h-full rounded-full bg-[#7fd0a0]" style={{ width: `${frac * 100}%` }} />
      </div>
      <p className="mb-2 text-[10px] leading-snug text-[#8a6d3b]">
        Клик по карте — движение. Атакует сама. Пассивка: {AVATAR.passive}. Уровень растёт за убийства
        рядом (+10% силы способности).
      </p>
      <Button
        onClick={onAbility}
        disabled={cd > 0}
        className="h-10 w-full border-2 border-[#b08d57] bg-[#3a2e1c] font-serif text-sm font-bold text-[#ffd700] hover:bg-[#4a3a24] disabled:opacity-50"
      >
        <Zap className="mr-1.5 h-4 w-4 text-[#ffd700]" />
        {AVATAR.abilityName}
        {cd > 0 ? ` · ${cd} с` : ' · готова'}
      </Button>
      <p className="mt-1 text-center text-[10px] text-[#8a6d3b]">
        {AVATAR.abilityDesc} · КД {AVATAR.abilityCd} с
      </p>
    </div>
  )
}

// ─── Список башен (когда ничего не выбрано) ──────────────────────────────
export function ShopList({ gold, buildMode }: { gold: number; buildMode: boolean }) {
  return (
    <div className="rounded-lg border-2 border-[#8a6d3b] bg-[#241b12] p-3">
      <p className="mb-2 font-serif text-sm font-bold text-[#e8c170]">Арсенал</p>
      <div className="grid grid-cols-2 gap-1.5">
        {TOWERS.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-1.5 rounded border border-[#8a6d3b44] bg-[#2b2115] px-2 py-1 ${
              gold < t.price ? 'opacity-50' : ''
            }`}
          >
            <span className="text-base leading-none">{t.glyph}</span>
            <span className="min-w-0 flex-1 truncate text-[10px] text-[#d8cbb0]">{t.name}</span>
            <span className={`font-mono text-[10px] ${gold >= t.price ? 'text-[#e8c170]' : 'text-[#e05252]'}`}>
              {t.price}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[#8a6d3b]">
        {buildMode
          ? 'Коснитесь свободной земли на карте, чтобы построить башню. Строить можно почти везде, кроме тракта.'
          : 'Включите режим «строить» (кнопка слева внизу карты), чтобы выбрать место для башни.'}
      </p>
    </div>
  )
}

// ─── Справка ─────────────────────────────────────────────────────────────
export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const armors: ArmorType[] = ['light', 'medium', 'heavy', 'universal']
  const attacks: AttackType[] = ['pierce', 'crush', 'magic', 'universal']
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-2 border-[#8a6d3b] bg-[#241b12] text-[#d8cbb0]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#e8c170]">Как играть</DialogTitle>
          <DialogDescription className="text-xs text-[#a89a80]">
            Машины пробудившегося ИИ идут по тракту. Продержитесь 10 волн!
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-1 text-xs leading-relaxed">
          <p>
            <b className="text-[#e8c170]">Жизни:</b> 20. Обычная машина при прорыве отнимает 1, босс — 10.
          </p>
          <p>
            <b className="text-[#e8c170]">Управление:</b> режим 🏗 «строить» — клик по земле выбирает место для
            башни (нельзя на тракте, у краёв и вплотную к другим башням); клик по башне — улучшить, слить,
            продать; кнопка «идти» — клик по земле двигает Охотницу.
          </p>
          <p>
            <b className="text-[#e8c170]">Уровни:</b> покупка копии башни повышает уровень (до 5): урон ×1.9,
            ×3.2, ×5.0, ×7.5. На 5 уровне — способность.
          </p>
          <p>
            <b className="text-[#e8c170]">Слияние:</b> две РАЗНЫЕ башни 3+ ур. на расстоянии до 140 px →
            уникальная башня с гибридной атакой (лучший множитель из двух типов против каждой цели).
          </p>
          <p>
            <b className="text-[#e8c170]">Волны:</b> тип брони виден заранее — стройте контр-башни. Волна 9 —
            денежная (золото ×3), волна 10 — босс.
          </p>
        </section>

        <section>
          <p className="mb-1.5 font-serif text-sm font-bold text-[#e8c170]">Матрица урона</p>
          <div className="overflow-x-auto rounded border border-[#8a6d3b55]">
            <table className="w-full border-collapse text-center font-mono text-[10px]">
              <thead>
                <tr className="bg-[#2b2115]">
                  <th className="p-1 text-left text-[#8a6d3b]">атака \ броня</th>
                  {armors.map((a) => (
                    <th key={a} className="p-1" style={{ color: ARMOR_COLORS[a] }}>
                      {ARMOR_ICONS[a]} {ARMOR_NAMES[a]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attacks.map((at) => (
                  <tr key={at} className="border-t border-[#8a6d3b33]">
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
                            color: v >= 1.5 ? '#7fd0a0' : v >= 1.0 ? '#d8cbb0' : '#e05252',
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
          <p className="mt-1 text-[10px] text-[#8a6d3b]">
            Специализированная атака бьёт «свою» броню на 150%. Универсальная — 80% по любой, кроме
            универсальной брони (120%).
          </p>
        </section>

        <section>
          <p className="mb-1.5 font-serif text-sm font-bold text-[#e8c170]">Книга слияний</p>
          <ul className="space-y-1">
            {MERGED_TOWERS.map((m) => {
              const pa = ALL_DEFS[m.parents[0]] as TowerDef
              const pb = ALL_DEFS[m.parents[1]] as TowerDef
              return (
                <li key={m.id} className="rounded border border-[#8a6d3b44] bg-[#2b2115] p-2 text-xs">
                  <span className="font-semibold text-[#e8c170]">
                    {m.glyph} {m.name}
                  </span>
                  <span className="ml-1 text-[#a89a80]">
                    = {pa.glyph} {pa.name} + {pb.glyph} {pb.name}
                  </span>
                  <p className="text-[10px] text-[#8a6d3b]">{m.desc}</p>
                </li>
              )
            })}
          </ul>
          <p className="mt-1 text-[10px] text-[#8a6d3b]">
            В полной версии — 12 рецептов. Пробуйте комбинации!
          </p>
        </section>
      </DialogContent>
    </Dialog>
  )
}
