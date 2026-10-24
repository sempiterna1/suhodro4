// Шаги мобов из CC0-записи «Walking in snow» (Corsica_S): лёгкие — хруст снега, тяжёлые — глухой шаг (ниже и темнее), лапы — мягкие шлепки.
// node sfx-steps.mjs <папка с распакованными .flac> <куда>
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { decodeFlac } from './sfx-flac.mjs'

const [, , SRC, OUT] = process.argv
mkdirSync(OUT, { recursive: true })
const RATE = 22050

function lowpass(x, f, order = 2) {
  let y = x
  for (let o = 0; o < order; o++) {
    const w = 2 * Math.PI * f / RATE, al = Math.sin(w) / (2 * 0.707), cw = Math.cos(w)
    const b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = b0, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al
    const out = new Float32Array(y.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < y.length; i++) { const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v }
    y = out
  }
  return y
}
/** pitch < 1 — ниже и медленнее */
function resample(pcm, from, to, pitch = 1) {
  const step = from / to * pitch, n = Math.floor(pcm.length / step), out = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = i * step, i0 = Math.floor(x), f = x - i0; out[i] = pcm[i0] * (1 - f) + (pcm[Math.min(pcm.length - 1, i0 + 1)] ?? 0) * f }
  return out
}
function writeWav(path, pcm) {
  const b = Buffer.alloc(44 + pcm.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24)
  b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40)
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2)
  writeFileSync(path, b)
}

function step(file, name, { pitch = 1, maxSec = 0.3, lp = 2200, thump = 0, attack = 0.006 }) {
  const { rate, pcm } = decodeFlac(join(SRC, file))
  let x = resample(pcm, rate, RATE, pitch)
  // начало — по первому заметному звуку
  let pk = 0
  for (const v of x) pk = Math.max(pk, Math.abs(v))
  let a = 0
  while (a < x.length && Math.abs(x[a]) < pk * 0.12) a++
  x = x.slice(Math.max(0, a - Math.round(RATE * 0.01)), Math.max(0, a - Math.round(RATE * 0.01)) + Math.round(RATE * maxSec))
  x = lowpass(x, lp)
  if (thump) for (let i = 0; i < x.length; i++) { const t = i / RATE; x[i] += thump * Math.sin(2 * Math.PI * (58 + 30 * Math.exp(-t / 0.05)) * t) * Math.exp(-t / 0.07) * (1 - Math.exp(-t / 0.006)) }
  const ni = Math.round(RATE * attack), nf = Math.round(RATE * Math.min(0.12, maxSec * 0.5))
  for (let i = 0; i < Math.min(ni, x.length); i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / ni)
  for (let i = 0; i < Math.min(nf, x.length); i++) x[x.length - 1 - i] *= i / nf
  let mean = 0
  for (const v of x) mean += v
  mean /= x.length
  let m = 1e-6
  for (let i = 0; i < x.length; i++) { x[i] -= mean; m = Math.max(m, Math.abs(x[i])) }
  for (let i = 0; i < x.length; i++) x[i] *= 0.7 / m
  writeWav(join(OUT, name + '.wav'), x)
  console.log(name, (x.length / RATE).toFixed(2) + 's')
}

const g = (n) => `Corsica_S-Walking_on_snow_covered_gravel_${String(n).padStart(2, '0')}.flac`
const gi = (n) => `Corsica_S-Walking_on_snow_covered_gravel_and_ice_${String(n).padStart(2, '0')}.flac`
// лёгкие: тихий хруст снега
for (let i = 1; i <= 6; i++) step(g(i), `step-light-${i}`, { pitch: 1.05, maxSec: 0.26, lp: 2000 })
// тяжёлые: ниже, темнее, с глухой «подушкой» удара
for (let i = 1; i <= 4; i++) step(g(6 + i), `step-heavy-${i}`, { pitch: 0.62, maxSec: 0.42, lp: 750, thump: 0.5, attack: 0.012 })
// лапы: короткие мягкие шлепки по снегу
for (let i = 1; i <= 4; i++) step(gi(i), `step-paw-${i}`, { pitch: 1.25, maxSec: 0.16, lp: 1500, attack: 0.008 })
