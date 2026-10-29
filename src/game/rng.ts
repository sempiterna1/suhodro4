// Детерминированный генератор случайных чисел (mulberry32) + утилиты.
// Один и тот же seed даёт одну и ту же последовательность «случайных» чисел —
// это основа для тестов, симулятора и коопа (гость и хост должны генерить мир
// из одного зерна).

/** mulberry32: быстрый детерминированный PRNG, возвращающий float в [0, 1) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Создать генератор с конкретным зерном */
export function createRng(seed: number): () => number {
  return mulberry32(seed)
}

/** Случайное целое в диапазоне [0, maxExclusive) */
export function randInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive)
}
