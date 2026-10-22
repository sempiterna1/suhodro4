// Длинные тени от луны: силуэт спрайта ложится на снег вправо-вниз (свет — слева сверху).
// Силуэт — тот же спрайт, залитый тёмно-синим; кэшируется на каждую картинку.

const silhouettes = new WeakMap<object, HTMLCanvasElement>()

function silhouette(img: CanvasImageSource & { width: number; height: number }) {
  let s = silhouettes.get(img)
  if (!s) {
    s = document.createElement('canvas')
    s.width = img.width
    s.height = img.height
    const c = s.getContext('2d')!
    c.drawImage(img, 0, 0)
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = '#0a1230'
    c.fillRect(0, 0, s.width, s.height)
    silhouettes.set(img, s)
  }
  return s
}

/**
 * Тень спрайта с опорой (x, y) на экране: ax — опора внутри картинки, k — масштаб картинки.
 * Высота предмета переходит в длину тени: верхушка ложится вправо-вниз от основания.
 */
export function drawLongShadow(
  ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number },
  x: number, y: number, ax: number, k: number, alpha = 0.34,
) {
  const sil = silhouette(img)
  ctx.save()
  ctx.globalAlpha *= alpha
  // точка спрайта (u, v), v < 0 вверх → земля: x + u − 0.95·v, y − 0.36·v
  ctx.transform(1, 0, -0.95, -0.36, x, y)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(sil, -ax * k, -img.height * k, img.width * k, img.height * k)
  ctx.restore()
}
