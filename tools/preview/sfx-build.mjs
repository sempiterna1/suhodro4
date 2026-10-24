// Подготовка звуков из CC0-паков (см. public/assets/sfx/LICENSES.md): моно, обрезка тишины, нормализация, затухание.
// ffmpeg не нужен: WAV читаем и пишем сами. Запуск: node sfx-build.mjs <папка-с-распакованным> <куда>
// Вход: <src>/med/*.wav (лук, арбалет), <src>/mon/*.wav (монстры), <src>/dig/*.mp3 (Kenney)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [, , SRC, OUT] = process.argv
mkdirSync(OUT, { recursive: true })

function readWav(path) {
  const b = readFileSync(path)
  let p = 12, fmt = null, data = null
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4)
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }
    if (id === 'data') { data = b.subarray(p + 8, Math.min(b.length, p + 8 + sz)); break }
    p += 8 + sz + (sz & 1)
  }
  const bytes = fmt.bits / 8, n = Math.floor(data.length / (bytes * fmt.ch))
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * bytes
      let v
      if (fmt.tag === 3) v = data.readFloatLE(o)
      else if (fmt.bits === 16) v = data.readInt16LE(o) / 32768
      else if (fmt.bits === 24) v = data.readIntLE(o, 3) / 8388608
      else if (fmt.bits === 32) v = data.readInt32LE(o) / 2147483648
      else v = (data.readUInt8(o) - 128) / 128
      s += v
    }
    out[i] = s / fmt.ch
  }
  return { rate: fmt.rate, pcm: out }
}

function resample(pcm, from, to) {
  if (from === to) return pcm
  const n = Math.floor(pcm.length * to / from), out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = i * from / to, i0 = Math.floor(x), f = x - i0
    out[i] = pcm[i0] * (1 - f) + (pcm[Math.min(pcm.length - 1, i0 + 1)] ?? 0) * f
  }
  return out
}

function writeWav(path, pcm, rate) {
  const b = Buffer.alloc(44 + pcm.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length * 2, 4); b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length * 2, 40)
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2)
  writeFileSync(path, b)
}

/** Биквад-фильтр нижних частот (RBJ), порядок order */
function lowpass(x, f, rate, order = 2) {
  let y = x
  for (let o = 0; o < order; o++) {
    const w = 2 * Math.PI * f / rate, al = Math.sin(w) / (2 * 0.707), cw = Math.cos(w)
    const b0 = (1 - cw) / 2, b1 = 1 - cw, b2 = b0, a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al
    const out = new Float32Array(y.length)
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    for (let i = 0; i < y.length; i++) { const v = (b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v }
    y = out
  }
  return y
}

/** Обрезка начала по порогу, длина ≤ maxSec, затухание, пик −2 dB */
function prep(file, name, { rate = 44100, maxSec = 0.5, fade = 0.12, thr = 0.02, lp = 0, fadeIn = 0.004 } = {}) {
  const w = readWav(file)
  let pcm = resample(w.pcm, w.rate, rate)
  let a = 0
  while (a < pcm.length && Math.abs(pcm[a]) < thr) a++
  a = Math.max(0, a - Math.round(rate * 0.005))
  pcm = pcm.slice(a, a + Math.round(rate * maxSec))
  if (lp) pcm = lowpass(pcm, lp, rate)
  const ni = Math.min(pcm.length, Math.round(rate * fadeIn))
  for (let i = 0; i < ni; i++) pcm[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / ni)
  const nf = Math.min(pcm.length, Math.round(rate * fade))
  for (let i = 0; i < nf; i++) pcm[pcm.length - 1 - i] *= i / nf
  // убрать постоянную составляющую и нормализовать
  let mean = 0
  for (const v of pcm) mean += v
  mean /= pcm.length
  let peak = 1e-6
  for (let i = 0; i < pcm.length; i++) { pcm[i] -= mean; peak = Math.max(peak, Math.abs(pcm[i])) }
  const g = 0.79 / peak
  for (let i = 0; i < pcm.length; i++) pcm[i] *= g
  writeWav(join(OUT, name + '.wav'), pcm, rate)
  console.log(name, (pcm.length / rate).toFixed(2) + 's', Math.round((pcm.length * 2) / 1024) + 'KB')
}

// выстрелы
prep(join(SRC, 'med', 'English Longbow Shoot.wav'), 'bow-longbow', { maxSec: 0.45, fade: 0.15, lp: 4500, fadeIn: 0.008 })
prep(join(SRC, 'med', 'Scythian Recurve Shoot.wav'), 'bow-recurve', { maxSec: 0.45, fade: 0.15, lp: 3500, fadeIn: 0.01 })
prep(join(SRC, 'med', 'Crossbow Shoot.wav'), 'crossbow-shoot', { maxSec: 0.4, fade: 0.12, lp: 1400, fadeIn: 0.016 })
// монстры — для гибели врагов
for (let i = 1; i <= 10; i++) prep(join(SRC, 'mon', `monster-${i}.wav`), `monster-${i}`, { rate: 22050, maxSec: 1.4, fade: 0.35, thr: 0.015, lp: 2800, fadeIn: 0.012 })
