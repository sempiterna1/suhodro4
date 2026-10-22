// Честные пиксели для спрайтов из листа и дорисованных построек.
// Мир рисуется в низком холсте (один пиксель = 2 пикселя экрана). Если просто уменьшить туда
// детальный спрайт со сглаживанием, он расплывается в кашу. Поэтому каждый спрайт один раз
// уменьшается ровно до своего размера в пикселях низкого холста, затем повышается резкость,
// края силуэта становятся жёсткими, цвета слегка сводятся к палитре — получается пиксель-арт
// того же размера пикселя, что у земли. Результат кэшируется на (картинка, размер).

type Img = CanvasImageSource & { width: number; height: number }

/** Пикселей низкого холста на единицу координат мира — выставляет render() перед кадром */
let lowScale = 0.5
export function setLowScale(k: number) {
  lowScale = k
}

const cache = new WeakMap<object, Map<string, HTMLCanvasElement>>()

function crispen(img: Img, pw: number, ph: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = pw
  cv.height = ph
  const c = cv.getContext('2d')!
  c.imageSmoothingEnabled = true
  c.imageSmoothingQuality = 'high'
  c.drawImage(img, 0, 0, pw, ph)
  const id = c.getImageData(0, 0, pw, ph)
  const s = id.data
  const d = new Uint8ClampedArray(s)
  const A = 0.22 // сила резкости
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const i = (y * pw + x) * 4
      if (s[i + 3] < 100) {
        d[i + 3] = 0
        continue
      }
      for (let ch = 0; ch < 3; ch++) {
        // нерезкая маска 3×3 по соседям внутри силуэта
        let sum = 0
        let n = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx
          const Y = y + dy
          if (X < 0 || Y < 0 || X >= pw || Y >= ph) continue
          const j = (Y * pw + X) * 4
          if (s[j + 3] < 100) continue
          sum += s[j + ch]
          n++
        }
        const v = n ? s[i + ch] + (A * (s[i + ch] * n - sum)) / n : s[i + ch]
        d[i + ch] = Math.round(v / 6) * 6 // лёгкое сведение к палитре
      }
      d[i + 3] = 255
    }
  }
  id.data.set(d)
  c.putImageData(id, 0, 0)
  return cv
}

/**
 * Нарисовать картинку в прямоугольник (dx, dy, dw, dh) в координатах мира пиксельно:
 * картинка заранее уменьшена ровно до размера в пикселях низкого холста.
 */
export function crispDraw(ctx: CanvasRenderingContext2D, img: Img, dx: number, dy: number, dw: number, dh: number) {
  const pw = Math.max(1, Math.round(dw * lowScale))
  const ph = Math.max(1, Math.round(dh * lowScale))
  let byImg = cache.get(img)
  if (!byImg) {
    byImg = new Map()
    cache.set(img, byImg)
  }
  const key = pw + 'x' + ph
  let cv = byImg.get(key)
  if (!cv) {
    cv = crispen(img, pw, ph)
    byImg.set(key, cv)
  }
  const prev = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(cv, dx, dy, dw, dh)
  ctx.imageSmoothingEnabled = prev
}
