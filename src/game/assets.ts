// Спрайты из листов референса (public/assets/*.png). Вырезаются скриптами tools/preview/cut/,
// размеры и точка опоры лежат в assets.json. Картинки грузятся лениво; пока картинки нет,
// рисовальщики показывают процедурную замену или ничего.

import META from './assets.json'
import type { AttackType, TowerDefinition } from './types'
import { crispDraw } from './pixelart'

export type AssetName = keyof typeof META
export interface AssetMeta {
  w: number
  h: number
  ax: number // x точки опоры: середина «подошвы» спрайта
}
export const ASSETS: Record<AssetName, AssetMeta> = META

const cache = new Map<string, CanvasImageSource | null>()

/** Картинка спрайта или null, если ещё грузится */
export function asset(name: AssetName): CanvasImageSource | null {
  const hit = cache.get(name)
  if (hit !== undefined) return hit
  cache.set(name, null)
  if (typeof Image !== 'undefined') {
    const im = new Image()
    im.onload = () => cache.set(name, im)
    im.src = `/assets/${name}.png`
  }
  return null
}

/** Подложить готовую картинку (превью в Node грузит их через @napi-rs/canvas) */
export function registerAsset(name: string, img: CanvasImageSource) {
  cache.set(name, img)
}

export function preloadAssets() {
  for (const n of Object.keys(ASSETS) as AssetName[]) asset(n)
}

/**
 * Нарисовать спрайт опорой в точку (x, y) экрана: x — середина подошвы, y — её низ.
 * scale — масштаб от размера в листе; flip — зеркально (опора остаётся на месте).
 */
export function drawAsset(
  ctx: CanvasRenderingContext2D, name: AssetName, x: number, y: number, scale: number, flip = false, alpha = 1
): boolean {
  const im = asset(name)
  if (!im) return false
  const m = ASSETS[name]
  const w = m.w * scale
  const h = m.h * scale
  ctx.save()
  if (alpha < 1) ctx.globalAlpha *= alpha
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  if (flip) {
    ctx.translate(x, 0)
    ctx.scale(-1, 1)
    crispDraw(ctx, im as HTMLCanvasElement, -m.ax * scale, y - h, w, h)
  } else {
    crispDraw(ctx, im as HTMLCanvasElement, x - m.ax * scale, y - h, w, h)
  }
  ctx.restore()
  return true
}

// ─── Какой спрайт у какой башни: 6 моделей референса на 15 башен и 12 слияний ─
const TOWER_ART: Record<string, AssetName> = {
  sentry: 'tower-coal', mech_guard: 'tower-coal', bastion: 'tower-coal', auto_arsenal: 'tower-coal',
  catapult: 'tower-cannon', mauler: 'tower-cannon', mortar: 'tower-cannon', golem: 'tower-cannon',
  siege_engine: 'tower-cannon', stone_titan: 'tower-cannon', steam_boiler: 'tower-cannon',
  frost: 'tower-frost', frost_hunter: 'tower-frost', chrono: 'tower-frost', time_guardian: 'tower-frost',
  prism: 'tower-frost', eternity_prism: 'tower-frost',
  archer: 'tower-sniper', crossbow: 'tower-sniper', hunter: 'tower-sniper', ballista: 'tower-sniper',
  pyro: 'tower-flame', flame_archer: 'tower-flame', volcano: 'tower-flame',
  lightning: 'tower-tesla', thunder_crossbow: 'tower-tesla', storm_mortar: 'tower-tesla',
}
const ART_BY_ATTACK: Record<AttackType, AssetName> = {
  pierce: 'tower-sniper', crush: 'tower-cannon', magic: 'tower-tesla', universal: 'tower-coal',
}

export function towerArt(def: TowerDefinition): AssetName {
  return TOWER_ART[def.id] ?? ART_BY_ATTACK[def.merged ? def.attacks[0] : def.attack]
}
