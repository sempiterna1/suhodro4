// Замеры звуков (слух недоступен — меряем): длительность, пик, атака, спектральный центроид, доля энергии выше 4 кГц.
// node sfx-analyze.mjs <папка с .wav> [имя-фильтр]. Помечает «резкое»: центроид > 2200 Гц, HF > 20 %, атака < 5 мс.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2], filt = process.argv[3] ?? ''

function readWav(path) {
  const b = readFileSync(path)
  let p = 12, rate = 44100, bits = 16, data = null
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4)
    if (id === 'fmt ') { rate = b.readUInt32LE(p + 12); bits = b.readUInt16LE(p + 22) }
    if (id === 'data') { data = b.subarray(p + 8, Math.min(b.length, p + 8 + sz)); break }
    p += 8 + sz + (sz & 1)
  }
  const n = Math.floor(data.length / (bits / 8)), out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = bits === 16 ? data.readInt16LE(i * 2) / 32768 : 0
  return { rate, pcm: out }
}

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr; im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t
      }
    }
  }
}

function spectrum(pcm, rate, from, len) {
  let n = 1
  while (n < Math.min(len, 16384)) n <<= 1
  const re = new Float64Array(n), im = new Float64Array(n)
  for (let i = 0; i < n; i++) re[i] = (pcm[from + i] ?? 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n))
  fft(re, im)
  let sum = 0, wsum = 0, hf = 0
  for (let k = 1; k < n / 2; k++) {
    const f = k * rate / n, e = re[k] * re[k] + im[k] * im[k]
    sum += e; wsum += e * f; if (f > 4000) hf += e
  }
  return { centroid: wsum / Math.max(sum, 1e-12), hf: hf / Math.max(sum, 1e-12) }
}

console.log('файл'.padEnd(26), 'длит,с', 'пик,dB', 'атака,мс', 'центроид,Гц', 'HF>4к,%', 'центроид 1-е 80мс', 'оценка')
for (const f of readdirSync(dir).filter((f) => f.endsWith('.wav') && f.includes(filt)).sort()) {
  const { rate, pcm } = readWav(join(dir, f))
  let peak = 0
  for (const v of pcm) peak = Math.max(peak, Math.abs(v))
  // атака: от первого превышения 5 % пика до достижения 90 % пика (по огибающей в окнах 1 мс)
  const w = Math.round(rate / 1000), env = []
  for (let i = 0; i + w <= pcm.length; i += w) { let m = 0; for (let j = 0; j < w; j++) m = Math.max(m, Math.abs(pcm[i + j])); env.push(m) }
  const i5 = env.findIndex((v) => v > peak * 0.05), i90 = env.findIndex((v) => v > peak * 0.9)
  const attack = Math.max(0, i90 - i5)
  const all = spectrum(pcm, rate, 0, pcm.length)
  const head = spectrum(pcm, rate, Math.max(0, i5 * w), Math.round(rate * 0.08))
  const harsh = all.centroid > 2200 || all.hf > 0.2 || attack < 5 || head.centroid > 3000
  console.log(f.padEnd(26), (pcm.length / rate).toFixed(2).padStart(6), (20 * Math.log10(peak)).toFixed(1).padStart(6), String(attack).padStart(8), String(Math.round(all.centroid)).padStart(11), (all.hf * 100).toFixed(1).padStart(7), String(Math.round(head.centroid)).padStart(17), harsh ? ' ⚠ резко' : ' ok')
}
