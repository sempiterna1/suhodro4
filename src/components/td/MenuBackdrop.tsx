'use client'

// Фон хаб-меню «командный пункт»: инженерный чертёж на тёмном ватмане.
// Статичный SVG, рисуется кодом без ассетов: техническая сетка, горизонтали
// рельефа, контуры шестерён, штрихованный карьер, схема тракта (портал →
// рубежи волн → лагерь) с выносками и титульный штамп. Монтируется в
// GameShell на фазе intro — живой игровой мир в меню больше не просвечивает.
// Вся смысловая графика живёт в центральной зоне листа (x 250–1350): окно
// может быть не 16:9, и slice тогда срезает края — декор не должен резаться.

import { useMemo } from 'react'

const W = 1600
const H = 900

const MONO = "ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Consolas, monospace"

/** Замкнутый контур шестерни: зубья по окружности (r — впадина зуба). */
function gearPath(cx: number, cy: number, r: number, teeth: number): string {
  const tooth = r * 0.16
  const step = (Math.PI * 2) / teeth
  const hw = step * 0.26 // половина угловой ширины зуба
  let d = ''
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2
    const pts: Array<[number, number]> = [
      [r, a - hw],
      [r + tooth, a - hw * 0.55],
      [r + tooth, a + hw * 0.55],
      [r, a + hw],
    ]
    for (const [rr, ang] of pts) {
      d += `${d === '' ? 'M' : 'L'}${(cx + rr * Math.cos(ang)).toFixed(1)} ${(cy + rr * Math.sin(ang)).toFixed(1)} `
    }
  }
  return `${d}Z`
}

/** Спицы шестерни: линии от втулки к ободу. */
function spokes(cx: number, cy: number, inner: number, outer: number, count: number): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count - Math.PI / 2
    d += `M${(cx + inner * Math.cos(a)).toFixed(1)} ${(cy + inner * Math.sin(a)).toFixed(1)} L${(cx + outer * Math.cos(a)).toFixed(1)} ${(cy + outer * Math.sin(a)).toFixed(1)} `
  }
  return d
}

export function MenuBackdrop() {
  // контуры шестерён считаются один раз на монтирование
  const gears = useMemo(
    () => ({
      big: gearPath(1330, 112, 150, 14),
      bigSpokes: spokes(1330, 112, 26, 88, 5),
      mesh: gearPath(1150, 250, 52, 8),
      corner: gearPath(280, 852, 88, 11),
    }),
    [],
  )

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#0a111d]">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="mb-bg" cx="50%" cy="38%" r="80%">
            <stop offset="0%" stopColor="#111c30" />
            <stop offset="55%" stopColor="#0b1322" />
            <stop offset="100%" stopColor="#070c15" />
          </radialGradient>
          <pattern id="mb-fine" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#182741" strokeWidth="1" />
          </pattern>
          <pattern id="mb-major" width="200" height="200" patternUnits="userSpaceOnUse">
            <path d="M200 0H0V200" fill="none" stroke="#233657" strokeWidth="1.1" />
          </pattern>
          <pattern id="mb-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="9" stroke="#1e3252" strokeWidth="1.6" />
          </pattern>
          <radialGradient id="mb-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7de3ea" stopOpacity="0.3" />
            <stop offset="55%" stopColor="#4fb3c9" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#4fb3c9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mb-vig" cx="50%" cy="40%" r="78%">
            <stop offset="0%" stopColor="#050a12" stopOpacity="0" />
            <stop offset="62%" stopColor="#050a12" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#04070d" stopOpacity="0.6" />
          </radialGradient>
        </defs>

        {/* ватман и техническая сетка (на весь лист, без рамки) */}
        <rect width={W} height={H} fill="url(#mb-bg)" />
        <rect width={W} height={H} fill="url(#mb-fine)" opacity="0.55" />
        <rect width={W} height={H} fill="url(#mb-major)" opacity="0.45" />

        {/* рельеф: горизонтали с отметками высот */}
        <g stroke="#213349" fill="none" opacity="0.65" strokeWidth="1.3">
          <path d="M-20 606 C 240 545, 470 662, 760 585 S 1240 632, 1620 548" />
          <path d="M-20 678 C 260 618, 500 722, 820 652 S 1300 702, 1620 618" opacity="0.8" />
          <path d="M-20 752 C 300 700, 560 792, 900 732 S 1360 768, 1620 702" opacity="0.6" />
        </g>
        <g fontFamily={MONO} fontSize="10" fill="#4d6b8d" opacity="0.65">
          <text x="544" y="610">▲ 126</text>
          <text x="1046" y="650">▲ 112</text>
          <text x="1330" y="598">▲ 98</text>
        </g>

        {/* шестерни механизмов за листом */}
        <g stroke="#263c5e" fill="none" opacity="0.7">
          <path d={gears.big} strokeWidth="1.6" />
          <circle cx="1330" cy="112" r="88" strokeWidth="1.1" />
          <circle cx="1330" cy="112" r="26" strokeWidth="1.1" />
          <path d={gears.bigSpokes} strokeWidth="1.1" />
          <path d={gears.mesh} strokeWidth="1.3" />
          <circle cx="1150" cy="250" r="30" strokeWidth="1" />
          <path d={gears.corner} strokeWidth="1.3" />
          <circle cx="280" cy="852" r="48" strokeWidth="1" />
          <circle cx="280" cy="852" r="14" strokeWidth="1" />
        </g>

        {/* карьер (штриховка сечения) и минеральная жила, ведущая к кристаллу */}
        <path d="M836 268 L1006 216 L1092 262 L1066 330 L894 342 Z" fill="url(#mb-hatch)" stroke="#2b4060" strokeWidth="1.4" opacity="0.9" />
        <path d="M300 560 L326 528 L346 546 L372 506 L390 528 L414 400" stroke="#2f4666" strokeWidth="1.6" fill="none" />
        <g fontFamily={MONO} fontSize="10.5" letterSpacing="1.5" fill="#5d799c">
          <text x="962" y="366" textAnchor="middle">КАРЬЕР</text>
          <text x="300" y="584">МИНЕРАЛЬНАЯ ЖИЛА</text>
          <text x="300" y="600" opacity="0.7">ВЕДЁТ К МИНЕРАЛУ</text>
        </g>

        {/* живой минерал — источник лора: гранёный кристалл в карантинной границе */}
        <circle cx="430" cy="330" r="92" fill="url(#mb-glow)" />
        <circle cx="430" cy="330" r="68" stroke="#9a5252" strokeWidth="1.3" strokeDasharray="6 7" fill="none" opacity="0.6" />
        <g stroke="#59c2c8" fill="#0f2a30" strokeWidth="1.6" strokeLinejoin="round">
          {/* боковые шпили */}
          <path d="M388 330 L376 362 L376 385 L400 385 L400 362 Z" strokeWidth="1.2" opacity="0.85" />
          <path d="M470 342 L458 368 L458 385 L482 385 L482 368 Z" strokeWidth="1.2" opacity="0.85" />
          {/* главный шпиль */}
          <path d="M430 268 L408 318 L408 385 L452 385 L452 318 Z" />
          {/* грани */}
          <path d="M430 268 L430 385 M408 318 L452 318 M408 352 L452 352" fill="none" strokeWidth="1" opacity="0.4" />
        </g>
        {/* блики */}
        <g stroke="#baf3f0" strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
          <path d="M421 296 L415 312" />
          <path d="M437 288 L431 304" />
        </g>
        {/* осколочная осыпь у подножия */}
        <path d="M380 385 L480 385 L470 398 L390 398 Z" fill="#0d1727" stroke="#2b4060" strokeWidth="1.2" />
        {/* выноски минерала */}
        <g fontFamily={MONO} fontSize="10.5" letterSpacing="1.5">
          <text x="516" y="292" fill="#7fd0c0">ЖИВОЙ МИНЕРАЛ</text>
          <text x="516" y="308" fill="#5d799c" opacity="0.8">ИСТОЧНИК ЗАРАЖЕНИЯ</text>
          <text x="516" y="324" fill="#8d6a6a">8 ИЗ 10 ПОГИБЛИ</text>
        </g>
        <path d="M510 296 L462 316" stroke="#33506f" strokeWidth="1.2" strokeDasharray="5 5" fill="none" opacity="0.8" />
        <text x="430" y="424" textAnchor="middle" fontFamily={MONO} fontSize="10" letterSpacing="1.5" fill="#8d6a6a" opacity="0.9">
          КАРАНТИННАЯ ГРАНИЦА
        </text>

        {/* схема тракта: портал → рубежи волн → лагерь */}
        <path
          d="M1236 404 C 1180 420, 1130 442, 1082 468 S 1002 510, 950 546 S 858 594, 790 630 S 694 674, 628 704 S 512 754, 448 782"
          stroke="#3d5a7c"
          strokeWidth="2.2"
          strokeDasharray="15 9"
          fill="none"
          opacity="0.6"
        />
        <g fill="#46658a" opacity="0.7">
          <circle cx="1160" cy="432" r="3.5" />
          <circle cx="1020" cy="506" r="3.5" />
          <circle cx="876" cy="586" r="3.5" />
          <circle cx="708" cy="668" r="3.5" />
          <circle cx="536" cy="742" r="3.5" />
        </g>
        {/* рубежи волн: боссы кампании */}
        {[
          { x: 1082, y: 468, n: '10', name: 'КОЛОСС' },
          { x: 950, y: 546, n: '20', name: 'МАТКА' },
          { x: 790, y: 630, n: '30', name: 'СЕРДЦЕ РАЗЛОМА' },
        ].map((m) => (
          <g key={m.n}>
            <circle cx={m.x} cy={m.y} r="13" fill="#0d1727" stroke="#6d5a28" strokeWidth="1.6" />
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontFamily={MONO} fontSize="11.5" fontWeight="700" fill="#c9a648">
              {m.n}
            </text>
            <text x={m.x} y={m.y - 22} textAnchor="middle" fontFamily={MONO} fontSize="10" letterSpacing="1.5" fill="#7d94b4" opacity="0.85">
              {m.name}
            </text>
          </g>
        ))}
        {/* портал разлома (вход заражённых) и лагерь */}
        <g stroke="#9a5252" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.85">
          <path d="M1268 388 L1246 404 L1268 420" />
          <path d="M1292 388 L1270 404 L1292 420" opacity="0.5" />
        </g>
        <text x="1252" y="372" textAnchor="middle" fontFamily={MONO} fontSize="10.5" letterSpacing="1.5" fill="#8d6a6a">
          ПОРТАЛ РАЗЛОМА
        </text>
        <circle cx="448" cy="786" r="26" stroke="#5c4d20" fill="none" strokeDasharray="4 5" opacity="0.7" />
        <path d="M432 780 L448 766 L464 780 L464 796 L432 796 Z" fill="#0e1828" stroke="#7d6524" strokeWidth="1.8" />
        <text x="448" y="840" textAnchor="middle" fontFamily={MONO} fontSize="10.5" letterSpacing="1.5" fill="#8a7440">
          ЛАГЕРЬ «ЖЕЛЕЗНЫЙ РАЗЛОМ»
        </text>

        {/* выноски и кресты-регистры */}
        <g fontFamily={MONO} fontSize="10.5" letterSpacing="1.5" fill="#5d799c" textAnchor="end">
          <text x="1348" y="640">СЕКТОР Б-4</text>
          <text x="1348" y="656" opacity="0.7">ОРУДИЙНЫЙ ДВОР</text>
        </g>
        <path d="M1340 634 L1280 620 L1220 634" stroke="#33506f" strokeWidth="1.2" strokeDasharray="5 5" fill="none" opacity="0.8" />
        <g stroke="#2c4162" strokeWidth="1.3" opacity="0.85">
          <path d="M300 172 V188 M292 180 H308" />
          <path d="M560 132 V148 M552 140 H568" />
          <path d="M1240 700 V716 M1232 708 H1248" />
          <path d="M1120 832 V848 M1112 840 H1128" />
        </g>

        {/* заклёпки, прижимающие лист к доске, и титульный штамп */}
        <g fill="#2a230e" stroke="#8a6a2f" strokeWidth="1.2" opacity="0.9">
          <circle cx="248" cy="32" r="4.5" />
          <circle cx="1352" cy="32" r="4.5" />
          <circle cx="248" cy="868" r="4.5" />
          <circle cx="1352" cy="868" r="4.5" />
        </g>
        <g fontFamily={MONO} fontSize="10.5" letterSpacing="1">
          <rect x="250" y="40" width="262" height="76" fill="rgba(13,22,38,0.55)" stroke="#2c4162" strokeWidth="1.4" />
          <line x1="250" y1="64" x2="512" y2="64" stroke="#2c4162" strokeWidth="1" />
          <line x1="250" y1="92" x2="512" y2="92" stroke="#2c4162" strokeWidth="1" />
          <text x="260" y="58" fill="#8ba4c4">СХЕМА ЛАГЕРЯ «ЖЕЛЕЗНЫЙ РАЗЛОМ»</text>
          <text x="260" y="84" fill="#5d799c">ЛИСТ 1/6 · М 1:200 · ФОРМА 9-РЗ</text>
          <text x="260" y="110" fill="#5d799c">30 ВОЛН · ИЗМ. 27 · УТВ. ГИ</text>
        </g>

        {/* виньетка */}
        <rect width={W} height={H} fill="url(#mb-vig)" />
      </svg>
    </div>
  )
}
