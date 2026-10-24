// Минимальный декодер FLAC (CONSTANT / VERBATIM / FIXED / LPC, rice-остатки) — ffmpeg в проекте нет.
// import { decodeFlac } from './sfx-flac.mjs' → { rate, pcm: Float32Array (моно, −1..1) }
import { readFileSync } from 'node:fs'

export function decodeFlac(path) {
  const b = readFileSync(path)
  if (b.toString('ascii', 0, 4) !== 'fLaC') throw new Error('не FLAC: ' + path)
  let p = 4, rate = 44100, bps0 = 16, channels = 2
  for (;;) {
    const h = b[p], last = h & 0x80, type = h & 0x7f, len = b.readUIntBE(p + 1, 3)
    if (type === 0) {
      const v = b.readUIntBE(p + 4 + 10, 4) // 20 бит частоты, 3 бита каналов, 5 бит разрядности (старшие биты 4 байт)
      rate = Math.floor(v / 4096)
      channels = ((v >> 9) & 7) + 1
      bps0 = ((v >> 4) & 31) + 1
    }
    p += 4 + len
    if (last) break
  }
  let bit = p * 8
  const rb = (n) => { // до 32 бит
    let v = 0
    while (n > 0) {
      const byte = b[bit >> 3] ?? 0, avail = 8 - (bit & 7), take = Math.min(avail, n)
      v = v * (1 << take) + ((byte >> (avail - take)) & ((1 << take) - 1))
      bit += take; n -= take
    }
    return v
  }
  const rs = (n) => { const v = rb(n); return n > 0 && v >= 2 ** (n - 1) ? v - 2 ** n : v }
  const unary = () => { let q = 0; while (rb(1) === 0) q++; return q }
  const out = []
  const total = b.length * 8
  while (bit + 32 < total) {
    if ((bit & 7) !== 0) bit += 8 - (bit & 7)
    if (rb(14) !== 0x3ffe) { bit -= 14; bit += 8; continue }
    rb(2) // зарезервировано + стратегия блока
    const bsCode = rb(4), srCode = rb(4), chAsg = rb(4), szCode = rb(3)
    rb(1)
    // номер кадра в UTF-8
    const first = rb(8); let extra = 0
    if (first >= 0xfc) extra = 5; else if (first >= 0xf8) extra = 4; else if (first >= 0xf0) extra = 3; else if (first >= 0xe0) extra = 2; else if (first >= 0xc0) extra = 1
    for (let i = 0; i < extra; i++) rb(8)
    let bs = bsCode === 1 ? 192 : bsCode >= 2 && bsCode <= 5 ? 576 << (bsCode - 2) : bsCode >= 8 ? 256 << (bsCode - 8) : 0
    if (bsCode === 6) bs = rb(8) + 1
    if (bsCode === 7) bs = rb(16) + 1
    if (srCode === 12) rb(8); else if (srCode === 13 || srCode === 14) rb(16)
    rb(8) // CRC-8
    const bps = [bps0, 8, 12, 0, 16, 20, 24, 0][szCode] || bps0
    const nch = chAsg < 8 ? chAsg + 1 : 2
    const chans = []
    for (let c = 0; c < nch; c++) {
      let sb = bps
      if (chAsg === 8 && c === 1) sb++
      if (chAsg === 9 && c === 0) sb++
      if (chAsg === 10 && c === 1) sb++
      rb(1)
      const type = rb(6)
      let wasted = 0
      if (rb(1)) wasted = unary() + 1
      const eb = sb - wasted
      const s = new Float64Array(bs)
      const residual = (order) => {
        const method = rb(2), po = rb(4), pbits = method === 0 ? 4 : 5, esc = method === 0 ? 15 : 31
        let i = order
        for (let part = 0; part < (1 << po); part++) {
          const param = rb(pbits)
          const n = (bs >> po) - (part === 0 ? order : 0)
          if (param === esc) { const nb = rb(5); for (let k = 0; k < n; k++) s[i++] = nb ? rs(nb) : 0 }
          else for (let k = 0; k < n; k++) { const q = unary(), v = q * (1 << param) + (param ? rb(param) : 0); s[i++] = (v & 1) ? -((v + 1) / 2) : v / 2 }
        }
      }
      if (type === 0) { const v = rs(eb); s.fill(v) }
      else if (type === 1) for (let i = 0; i < bs; i++) s[i] = rs(eb)
      else if (type >= 8 && type <= 12) {
        const order = type & 7
        const warm = []
        for (let i = 0; i < order; i++) { s[i] = rs(eb) }
        residual(order)
        for (let i = order; i < bs; i++) {
          const r = s[i], a = s[i - 1], c2 = s[i - 2], d = s[i - 3], e = s[i - 4]
          s[i] = r + (order === 0 ? 0 : order === 1 ? a : order === 2 ? 2 * a - c2 : order === 3 ? 3 * a - 3 * c2 + d : 4 * a - 6 * c2 + 4 * d - e)
        }
        void warm
      } else if (type >= 32) {
        const order = (type & 31) + 1
        for (let i = 0; i < order; i++) s[i] = rs(eb)
        const prec = rb(4) + 1, shift = rs(5)
        const co = []
        for (let i = 0; i < order; i++) co.push(rs(prec))
        residual(order)
        for (let i = order; i < bs; i++) {
          let sum = 0
          for (let j = 0; j < order; j++) sum += co[j] * s[i - 1 - j]
          s[i] += Math.floor(sum / 2 ** shift)
        }
      } else throw new Error('подкадр ' + type)
      if (wasted) for (let i = 0; i < bs; i++) s[i] *= 2 ** wasted
      chans.push(s)
    }
    if ((bit & 7) !== 0) bit += 8 - (bit & 7)
    rb(16) // CRC-16
    let L = chans[0], R = chans[1] ?? chans[0]
    if (chAsg === 8) R = L.map((v, i) => v - chans[1][i])
    else if (chAsg === 9) { L = chans[0].map((v, i) => v + chans[1][i]); R = chans[1] }
    else if (chAsg === 10) { const m = chans[0], sd = chans[1]; L = m.map((v, i) => { const mm = v * 2 + (sd[i] & 1); return (mm + sd[i]) / 2 }); R = m.map((v, i) => { const mm = v * 2 + (sd[i] & 1); return (mm - sd[i]) / 2 }) }
    const scale = 2 ** (bps - 1)
    for (let i = 0; i < bs; i++) out.push((L[i] + R[i]) / 2 / scale)
  }
  void channels
  return { rate, pcm: Float32Array.from(out) }
}
