// Звуки башен и событий, собранные по физическому источнику: шум, фильтры, мягкие огибающие.
// node sfx-synth.mjs <выходная папка>  — пишет моно WAV 22.05 кГц; обработка сэмплов лука/арбалета/монстров — sfx-build.mjs.
// Все звуки нормализуются по пику (громкость в игре — в audio.ts), верх срезан фильтром — резких пиков нет.
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })
const SR = 22050

// ─── DSP ────────────────────────────────────────────────────────────────
let seed = 1
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const noise = (n) => Float32Array.from({ length: n }, () => rnd() * 2 - 1)
const zeros = (sec) => new Float32Array(Math.round(sec * SR))

/** Биквад по RBJ: lp / hp / bp. Q ≈ 0.7 — без пика на срезе */
function filt(x, type, f, q = 0.707, order = 1) {
  let y = x
  for (let o = 0; o < order; o++) {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, al = Math.sin(w) / (2 * q), cw = Math.cos(w)
    let b0, b1, b2
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0 }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0 }
    else { b0 = al; b1 = 0; b2 = -al }
    const a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al
    const out = new Float32Array(y.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < y.length; i++) {
      const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
      x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v
    }
    y = out
  }
  return y
}
/** Огибающая: косинусная атака a (с) и экспоненциальное затухание d (с); hold — полка между ними */
const env = (n, a, d, hold = 0) => Float32Array.from({ length: n }, (_, i) => {
  const t = i / SR
  if (t < a) return 0.5 - 0.5 * Math.cos(Math.PI * t / Math.max(a, 1e-4))
  if (t < a + hold) return 1
  return Math.exp(-(t - a - hold) / d)
})
const mul = (x, e) => x.map((v, i) => v * (e[i] ?? 0))
const drive = (x, k) => x.map((v) => Math.tanh(v * k) / Math.tanh(k))
const gain = (x, g) => x.map((v) => v * g)
/** Генератор по частоте, заданной функцией времени (интеграл фазы) */
function osc(n, freqAt, shape = 'sine') {
  const out = new Float32Array(n); let ph = 0
  for (let i = 0; i < n; i++) {
    ph += 2 * Math.PI * freqAt(i / SR) / SR
    out[i] = shape === 'saw' ? ((ph / Math.PI) % 2) - 1 : shape === 'tri' ? 2 * Math.abs(((ph / Math.PI) % 2) - 1) - 1 : Math.sin(ph)
  }
  return out
}
const glide = (f0, f1, dur) => (t) => f1 + (f0 - f1) * Math.exp(-t / (dur / 4))
/** Наложить слой b на a со сдвигом start (с) */
function layer(a, b, start = 0, g = 1) {
  const off = Math.round(start * SR)
  const n = Math.max(a.length, off + b.length), out = new Float32Array(n)
  out.set(a)
  for (let i = 0; i < b.length; i++) out[off + i] += b[i] * g
  return out
}
function finish(name, x, peak = 0.8, lp = 5000) {
  let y = filt(x, 'lp', lp, 0.707, 2)
  // постоянную составляющую убрать, пик привести к нужному, концы — в ноль
  let mean = 0
  for (const v of y) mean += v
  mean /= y.length
  let pk = 1e-6
  for (let i = 0; i < y.length; i++) { y[i] -= mean; pk = Math.max(pk, Math.abs(y[i])) }
  const nf = Math.min(y.length, Math.round(SR * 0.03))
  for (let i = 0; i < nf; i++) y[y.length - 1 - i] *= i / nf
  const b = Buffer.alloc(44 + y.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + y.length * 2, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24)
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(y.length * 2, 40)
  for (let i = 0; i < y.length; i++) b.writeInt16LE(Math.round(y[i] * (peak / pk) * 32767), 44 + i * 2)
  writeFileSync(join(OUT, name + '.wav'), b)
}

// ─── звуки ───────────────────────────────────────────────────────────────
for (let v = 0; v < 3; v++) {
  seed = 100 + v
  // Камнемёт: скрип дерева, удар рычага, низкий «бух» и полёт камня — без высокого щёлканья
  const f0 = 170 + rnd() * 60
  const creakN = Math.round(0.28 * SR)
  const creak = mul(filt(noise(creakN), 'bp', f0, 4), env(creakN, 0.06, 0.12))
  const am = osc(creakN, () => 11 + rnd() * 0.0 + 4 * v)
  const creakAm = creak.map((s, i) => s * (0.55 + 0.45 * am[i]))
  let x = gain(creakAm, 0.6)
  const thunkN = Math.round(0.3 * SR)
  const thunk = mul(drive(osc(thunkN, glide(190, 80, 0.25)), 2.2), env(thunkN, 0.014, 0.075))
  x = layer(x, thunk, 0.26, 1)
  x = layer(x, mul(filt(noise(thunkN), 'lp', 650, 0.707, 2), env(thunkN, 0.012, 0.09)), 0.26, 0.9)
  const flyN = Math.round(0.5 * SR)
  x = layer(x, mul(filt(noise(flyN), 'bp', 420, 0.8), env(flyN, 0.14, 0.18)), 0.32, 0.3)
  finish(`catapult-${v + 1}`, x, 0.8, 1800)
}
for (let v = 0; v < 2; v++) {
  seed = 200 + v
  // Мортира: глухой «пум» из трубы — низкий резонанс и мягкий шум
  const n = Math.round(0.7 * SR)
  let x = mul(drive(osc(n, glide(125, 58, 0.32)), 2), env(n, 0.014, 0.17))
  x = layer(x, mul(filt(noise(n), 'lp', 420, 0.8, 2), env(n, 0.012, 0.15)), 0, 0.7)
  x = layer(x, mul(osc(n, () => 150 - v * 12), env(n, 0.01, 0.12)), 0, 0.25)
  finish(`mortar-${v + 1}`, x, 0.85, 1300)
}
for (let v = 0; v < 3; v++) {
  seed = 300 + v
  // Молот/таран/титан: тяжёлый глухой удар с короткой каменной трещиной
  const n = Math.round(0.45 * SR)
  let x = mul(drive(osc(n, glide(150 - v * 10, 68, 0.3)), 2.4), env(n, 0.012, 0.11))
  x = layer(x, mul(filt(noise(n), 'lp', 620, 0.707, 2), env(n, 0.01, 0.07)), 0, 0.8)
  x = layer(x, mul(filt(noise(n), 'bp', 900, 1.2), env(n, 0.008, 0.025)), 0, 0.3)
  finish(`thud-${v + 1}`, x, 0.85, 1500)
}
for (let v = 0; v < 2; v++) {
  seed = 400 + v
  // Взрыв: низкий раскат с долгим затуханием
  const n = Math.round(1.4 * SR)
  let x = mul(filt(noise(n), 'lp', 520, 0.707, 2), env(n, 0.02, 0.36))
  x = layer(x, mul(drive(osc(n, glide(100, 48, 0.6)), 2), env(n, 0.02, 0.4)), 0, 0.9)
  x = layer(x, mul(filt(noise(n), 'lp', 900, 0.707, 2), env(n, 0.01, 0.12)), 0, 0.4)
  finish(`boom-${v + 1}`, x, 0.85, 1300)
}
for (let v = 0; v < 3; v++) {
  seed = 500 + v
  // Огонь: низкий шипящий «фух» с медленным нарастанием и редкими лопающимися угольками
  const n = Math.round(0.7 * SR)
  let x = mul(filt(noise(n), 'bp', 520 + v * 60, 0.6), env(n, 0.06, 0.2, 0.05))
  x = layer(x, mul(filt(noise(n), 'lp', 260, 0.707, 2), env(n, 0.05, 0.22)), 0, 0.7)
  for (let k = 0; k < 4; k++) {
    const pn = Math.round(0.02 * SR)
    x = layer(x, mul(filt(noise(pn), 'lp', 1600, 0.707, 2), env(pn, 0.002, 0.007)), 0.08 + rnd() * 0.4, 0.25)
  }
  finish(`fire-${v + 1}`, x, 0.7, 2000)
}
for (let v = 0; v < 2; v++) {
  seed = 600 + v
  // Лёд: мягкий хрустальный звон и тихий треск льдинки
  const n = Math.round(1.0 * SR)
  const base = 523 * (v ? 1.122 : 1)
  let x = mul(osc(n, () => base), env(n, 0.012, 0.28))
  x = layer(x, mul(osc(n, () => base * 1.5), env(n, 0.012, 0.22)), 0, 0.5)
  x = layer(x, mul(osc(n, () => base * 2.25), env(n, 0.012, 0.16)), 0, 0.25)
  const tn = Math.round(0.03 * SR)
  x = layer(x, mul(filt(noise(tn), 'bp', 2600, 1), env(tn, 0.003, 0.01)), 0, 0.2)
  finish(`frost-${v + 1}`, x, 0.6, 4200)
}
for (let v = 0; v < 3; v++) {
  seed = 700 + v
  // Молния/тесла: электрический треск пачкой коротких импульсов и низкий гул, пики сглажены
  const n = Math.round(0.5 * SR)
  let x = mul(osc(n, () => 100), env(n, 0.02, 0.12))
  x = layer(zeros(0.5), x, 0, 0.35)
  for (let k = 0; k < 9; k++) {
    const pn = Math.round((0.004 + rnd() * 0.006) * SR)
    x = layer(x, mul(filt(noise(pn), 'bp', 900 + rnd() * 900, 1.2), env(pn, 0.0015, 0.004)), rnd() * 0.3, 0.5 + rnd() * 0.4)
  }
  x = layer(x, mul(filt(noise(n), 'bp', 700, 0.8), env(n, 0.03, 0.1)), 0, 0.25)
  finish(`spark-${v + 1}`, x, 0.65, 3600)
}
for (let v = 0; v < 2; v++) {
  seed = 800 + v
  // Время: плывущий мягкий тон с дрожью, как тиканье пружин под водой
  const n = Math.round(0.7 * SR)
  const vib = (t) => 1 + 0.015 * Math.sin(2 * Math.PI * 6 * t)
  let x = mul(osc(n, (t) => (200 + 170 * Math.min(1, t / 0.5)) * vib(t) * (v ? 1.18 : 1)), env(n, 0.05, 0.25))
  x = layer(x, mul(osc(n, (t) => (400 + 340 * Math.min(1, t / 0.5)) * vib(t) * (v ? 1.18 : 1)), env(n, 0.06, 0.2)), 0, 0.3)
  finish(`time-${v + 1}`, x, 0.55, 2200)
}
{
  seed = 900
  // Призма: мягкий колокольчик со слабым биением
  const n = Math.round(1.1 * SR)
  let x = mul(osc(n, () => 660), env(n, 0.015, 0.3))
  x = layer(x, mul(osc(n, () => 664), env(n, 0.015, 0.3)), 0, 0.8)
  x = layer(x, mul(osc(n, () => 990), env(n, 0.015, 0.2)), 0, 0.35)
  finish('prism-1', x, 0.55, 3500)
}
for (let v = 0; v < 2; v++) {
  seed = 1000 + v
  // Механизм: глухой пневматический «чух» и короткий стук металла
  const n = Math.round(0.25 * SR)
  let x = mul(filt(noise(n), 'bp', 700, 0.8), env(n, 0.008, 0.045))
  x = layer(x, mul(osc(n, glide(180 - v * 20, 90, 0.08)), env(n, 0.006, 0.05)), 0, 0.8)
  x = layer(x, mul(filt(noise(n), 'bp', 2200, 2), env(n, 0.004, 0.012)), 0.01, 0.25)
  finish(`clank-${v + 1}`, x, 0.7, 2800)
}
for (let v = 0; v < 2; v++) {
  seed = 1100 + v
  // Пар: шипение, нарастающее и затухающее
  const n = Math.round(0.8 * SR)
  let x = mul(filt(filt(noise(n), 'bp', 1500, 0.6), 'hp', 500), env(n, 0.12, 0.22, 0.08))
  x = layer(x, mul(filt(noise(n), 'lp', 300, 0.707), env(n, 0.1, 0.25)), 0, 0.4)
  finish(`steam-${v + 1}`, x, 0.55, 3000)
}
for (let v = 0; v < 2; v++) {
  seed = 1200 + v
  // Постройка: два глухих удара молотка по дереву
  const n = Math.round(0.4 * SR)
  let x = zeros(0.4)
  for (let k = 0; k < 2; k++) {
    const kn = Math.round(0.14 * SR)
    let kk = mul(osc(kn, glide(260 - v * 25 - k * 20, 140, 0.07)), env(kn, 0.007, 0.03))
    kk = layer(kk, mul(filt(noise(kn), 'lp', 900, 0.8), env(kn, 0.006, 0.012)), 0, 0.6)
    x = layer(x, kk, k * 0.16, 1 - k * 0.2)
  }
  finish(`build-${v + 1}`, x, 0.7, 1800)
}
{
  seed = 1300
  // Ролл арсенала: шорох карточек — три мягких тика и лёгкий шелест
  const n = Math.round(0.4 * SR)
  let x = mul(filt(noise(n), 'bp', 1800, 0.7), env(n, 0.05, 0.12))
  x = gain(x, 0.2)
  for (let k = 0; k < 3; k++) {
    const tn = Math.round(0.03 * SR)
    x = layer(x, mul(filt(noise(tn), 'lp', 1600, 0.707, 2), env(tn, 0.003, 0.008)), 0.02 + k * 0.08, 0.8)
  }
  finish('roll-1', x, 0.5, 2600)
}
{
  seed = 1400
  // Прорыв: низкий тревожный гудок, без визга
  const n = Math.round(0.9 * SR)
  const trem = (t) => 0.8 + 0.2 * Math.sin(2 * Math.PI * 5 * t)
  let x = mul(osc(n, () => 130, 'saw'), env(n, 0.07, 0.35, 0.3))
  x = layer(x, mul(osc(n, () => 138, 'saw'), env(n, 0.07, 0.35, 0.3)), 0, 0.8)
  x = x.map((v, i) => v * trem(i / SR))
  finish('leak-1', filt(x, 'lp', 600, 0.707, 2), 0.7, 700)
}
{
  seed = 1500
  // Рог волны: паровой гудок — две низкие ноты, медленный вдох и долгий спад
  const n = Math.round(2.2 * SR)
  let x = mul(osc(n, () => 98, 'saw'), env(n, 0.18, 0.4, 0.9))
  x = layer(x, mul(osc(n, () => 147, 'saw'), env(n, 0.22, 0.4, 0.8)), 0, 0.7)
  x = layer(x, mul(filt(noise(n), 'bp', 900, 0.6), env(n, 0.2, 0.3, 0.7)), 0, 0.15)
  finish('horn-1', filt(x, 'lp', 520, 0.707, 2), 0.7, 650)
}

// ─── Аватары (задача 22): отклик на приказ движения и каст способности ───
for (let v = 0; v < 1; v++) {
  seed = 1600
  // Сорока — отклик: короткий двусложный свист
  const n = Math.round(0.35 * SR)
  let x = mul(osc(n, glide(1500, 2600, 0.1)), env(n, 0.008, 0.06))
  x = layer(x, mul(osc(n, glide(1800, 3000, 0.08)), env(n, 0.006, 0.05)), 0.16, 0.9)
  x = layer(x, mul(filt(noise(n), 'bp', 3400, 1), env(n, 0.006, 0.02)), 0, 0.12)
  finish('av-hunter-ack', x, 0.5, 5200)
}
{
  seed = 1700
  // Кузьма — отклик: тяжёлый шаг сапога по щебню, скрип латунной пряжки
  const n = Math.round(0.4 * SR)
  let x = mul(drive(osc(n, glide(140, 70, 0.12)), 2.2), env(n, 0.008, 0.07))
  x = layer(x, mul(filt(noise(n), 'lp', 800, 0.707, 2), env(n, 0.006, 0.05)), 0, 0.6)
  x = layer(x, mul(filt(noise(n), 'bp', 2500, 2), env(n, 0.004, 0.015)), 0.02, 0.2)
  finish('av-voevoda-ack', x, 0.65, 1600)
}
{
  seed = 1800
  // Фитиль — отклик: чирк спички и вспышка серы
  const n = Math.round(0.4 * SR)
  let x = zeros(0.4)
  for (let k = 0; k < 3; k++) {
    const sn = Math.round((0.03 + rnd() * 0.02) * SR)
    x = layer(x, mul(filt(noise(sn), 'hp', 2200), env(sn, 0.003, 0.012)), k * 0.05, 0.7 - k * 0.15)
  }
  const pn = Math.round(0.2 * SR)
  x = layer(x, mul(filt(noise(pn), 'bp', 700, 0.7), env(pn, 0.04, 0.1, 0.02)), 0.18, 0.5)
  finish('av-archmage-ack', x, 0.5, 3600)
}
{
  seed = 1900
  // Гайка — отклик: трещотка ключа, четыре щелчка с подъёмом
  const n = Math.round(0.4 * SR)
  let x = zeros(0.4)
  for (let k = 0; k < 4; k++) {
    const cn = Math.round(0.04 * SR)
    let c = mul(osc(cn, () => 700 + k * 160), env(cn, 0.003, 0.012))
    c = layer(c, mul(filt(noise(cn), 'bp', 2400 + k * 300, 2), env(cn, 0.002, 0.008)), 0, 0.5)
    x = layer(x, c, k * 0.07, 1)
  }
  finish('av-engineer-ack', x, 0.5, 3200)
}
{
  seed = 2000
  // Сорока — каст: «поп» шашки и шипящий дым-пшик
  const n = Math.round(0.7 * SR)
  let x = mul(osc(n, glide(300, 90, 0.06)), env(n, 0.004, 0.03))
  x = layer(x, mul(filt(filt(noise(n), 'bp', 1800, 0.6), 'hp', 700), env(n, 0.02, 0.28, 0.04)), 0.02, 0.8)
  x = layer(x, mul(filt(noise(n), 'lp', 350, 0.707), env(n, 0.03, 0.3)), 0.02, 0.4)
  finish('av-hunter-cast', x, 0.6, 2600)
}
{
  seed = 2100
  // Кузьма — каст: паровой гудок смены, дрожащий и короткий
  const n = Math.round(1.1 * SR)
  let x = mul(osc(n, () => 220, 'saw'), env(n, 0.04, 0.28, 0.25))
  x = layer(x, mul(osc(n, () => 277, 'saw'), env(n, 0.05, 0.26, 0.2)), 0, 0.7)
  x = layer(x, mul(filt(noise(n), 'bp', 1200, 0.6), env(n, 0.05, 0.2, 0.2)), 0, 0.25)
  x = x.map((v, i) => v * (0.85 + 0.15 * Math.sin(2 * Math.PI * 6 * i / SR)))
  finish('av-voevoda-cast', filt(x, 'lp', 900, 0.707, 2), 0.65, 1600)
}
{
  seed = 2200
  // Фитиль — каст: фитиль шипит с треском искр, затем взрыв
  const n = Math.round(1.5 * SR)
  let x = zeros(1.5)
  const fn = Math.round(0.32 * SR)
  let f = mul(filt(noise(fn), 'hp', 3000), env(fn, 0.05, 0.18, 0.06))
  f = f.map((v) => v * (0.6 + 0.4 * rnd()))
  x = layer(x, f, 0, 0.5)
  const bn = Math.round(1.1 * SR)
  let b = mul(filt(noise(bn), 'lp', 520, 0.707, 2), env(bn, 0.015, 0.3))
  b = layer(b, mul(drive(osc(bn, glide(110, 45, 0.5)), 2), env(bn, 0.015, 0.32)), 0, 0.9)
  x = layer(x, b, 0.34, 1)
  finish('av-archmage-cast', x, 0.8, 1500)
}
{
  seed = 2300
  // Гайка — каст: щелчок клапана и выброс пара пульсами
  const n = Math.round(0.9 * SR)
  let x = mul(osc(n, glide(400, 150, 0.05)), env(n, 0.003, 0.02))
  x = layer(x, mul(filt(noise(n), 'bp', 2600, 2), env(n, 0.002, 0.01)), 0, 0.5)
  for (let k = 0; k < 3; k++) {
    const sn = Math.round(0.3 * SR)
    x = layer(x, mul(filt(filt(noise(sn), 'bp', 1600, 0.6), 'hp', 800), env(sn, 0.03, 0.16, 0.03)), 0.05 + k * 0.14, 0.7 - k * 0.15)
  }
  finish('av-engineer-cast', x, 0.6, 3000)
}
console.log('ok')
