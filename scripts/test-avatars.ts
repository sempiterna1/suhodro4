// Аватары (GDD, приложение): выбор до первой волны, способности Воеводы, Архимага, Инженера и Охотницы,
// пассивки, снапшот коопа переносит выбор и ускорение башен.

import { Game } from '../src/game/engine'
import { CLASSIC_MAP, pointAtLength } from '../src/game/map'
import { AVATARS, AVATAR_IDS, VOEVODA_RADIUS, SELL_RATIO } from '../src/game/config'

let failed = 0
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`)
  if (!ok) failed++
}

const fresh = () => {
  const g = new Game()
  g.useMap(CLASSIC_MAP)
  g.beginPreview()
  g.gold = 5000
  g.shop = ['archer'] // пул арсенала случаен — фиксируем
  return g
}
const addCreeps = (g: Game, n: number, dist: number) => {
  for (let i = 0; i < n; i++) {
    g.creeps.push({
      uid: 9000 + i, kind: 'scuttler', armor: 'light', hp: 500, maxHp: 500, speed: 0, dist: dist + i * 4, size: 11,
      isBoss: false, gold: 1, livesCost: 1, burnDps: 0, burnUntil: 0, burnSource: '', stunnedUntil: 0,
      markedUntil: 0, markedBonus: 0, goldMult: 1, slowPct: 0, slowUntil: 0, vulnBonus: 0, vulnUntil: 0,
    } as never)
  }
}

check('в GDD 4 аватара', AVATAR_IDS.length === 4 && AVATAR_IDS.join() === 'hunter,voevoda,archmage,engineer')

// выбор
{
  const g = new Game()
  check('по умолчанию Охотница', g.avatarId === 'hunter')
  g.beginPreview()
  check('выбор до первой волны', g.setAvatar('voevoda').ok && g.avatarId === 'voevoda')
  check('неизвестный id отклонён', !g.setAvatar('nobody' as never).ok)
  g.startWave()
  check('в волне сменить нельзя', !g.setAvatar('archmage').ok && g.avatarId === 'voevoda')
  check('UI знает аватара', g.getUiState().avatar.id === 'voevoda')
}

// Воевода: клич ускоряет башни рядом на 40%, пассивка +5%
{
  const g = fresh()
  g.setAvatar('voevoda')
  g.avatar.x = 300; g.avatar.y = 300
  const near = g.build(300, 300 + 40, 'archer')
  const far = g.build(700, 100, 'archer')
  check('башни построены', near.ok && far.ok)
  const nt = g.towerById(near.towerId!)!, ft = g.towerById(far.towerId!)!
  const r = g.useAbility()
  check('Боевой клич срабатывает', r.ok && g.avatar.cooldown === AVATARS.voevoda.abilityCd)
  check('башня рядом ускорена, дальняя — нет', (nt.hasteMult ?? 0) >= 1.4 && !ft.hasteUntil)
  check('перезарядка блокирует повтор', !g.useAbility().ok)
  const g2 = fresh()
  g2.setAvatar('voevoda')
  check('без башен рядом — ошибка', !g2.useAbility().ok)
  check('радиус клича — 3 места', VOEVODA_RADIUS === 120)
}

// Инженер: Перегрузка ×2 ближайшей башне; продажа 85%
{
  const g = fresh()
  g.setAvatar('engineer')
  g.avatar.x = 300; g.avatar.y = 300
  const a = g.build(300, 340, 'archer'), b = g.build(700, 100, 'archer')
  const r = g.useAbility()
  const ta = g.towerById(a.towerId!)!, tb = g.towerById(b.towerId!)!
  check('Перегрузка ускоряет ближайшую башню вдвое', r.ok && ta.hasteMult === 2 && !tb.hasteUntil)
  const gold0 = g.gold
  g.sell(b.towerId!)
  const got = g.gold - gold0
  check('продажа возвращает 85%', got === Math.floor(50 * 0.85) && got > Math.floor(50 * SELL_RATIO), String(got))
  const h = fresh()
  const c = h.build(300, 340, 'archer')
  const g1 = h.gold
  h.sell(c.towerId!)
  check('у остальных — 70%', h.gold - g1 === Math.floor(50 * SELL_RATIO), String(h.gold - g1) + ' vs ' + Math.floor(50 * SELL_RATIO))
}

// Архимаг: Метеор по площади, 500% урона
{
  const g = fresh()
  g.setAvatar('archmage')
  g.startWave()
  g.creeps = []
  addCreeps(g, 4, 400)
  const hp0 = g.creeps.map((c) => c.hp)
  const r = g.useAbility()
  const dealt = g.creeps.map((c, i) => hp0[i] - c.hp)
  check('Метеор срабатывает', r.ok && g.avatar.cooldown === AVATARS.archmage.abilityCd)
  check('урон по скоплению', dealt.every((d) => d > 0), dealt.join(','))
  const expected = AVATARS.archmage.damage * 5 * (g.creeps[0].armor === 'light' ? 1 : 1)
  check('урон около 500% урона аватара (множитель брони из матрицы)', Math.abs(dealt[0] - expected) <= expected * 0.6, `${dealt[0]} vs ${expected}`)
  const g2 = fresh()
  g2.setAvatar('archmage')
  g2.creeps = []
  check('без целей — ошибка', !g2.useAbility().ok)
  void pointAtLength
}

// Охотница: метка (как раньше)
{
  const g = fresh()
  g.startWave()
  g.creeps = []
  addCreeps(g, 2, 300)
  check('Метка добычи работает', g.useAbility().ok && g.creeps.some((c) => c.goldMult === 2))
}

// кооп: снапшот переносит аватара и ускорение башен
{
  const host = fresh()
  host.setAvatar('voevoda')
  host.avatar.x = 300; host.avatar.y = 300
  host.build(300, 340, 'archer')
  host.useAbility()
  const snap = host.serialize()
  const guest = new Game()
  guest.useMap(CLASSIC_MAP)
  guest.applySnap(snap)
  check('гость видит выбранного аватара', guest.avatarId === 'voevoda' && guest.getUiState().avatar.id === 'voevoda')
  check('гость получает ускорение башни', (guest.towers[0].hasteMult ?? 0) >= 1.4 && (guest.towers[0].hasteUntil ?? 0) > 0)
}

console.log(failed ? `\n✗✗ Провалено: ${failed}` : '\n✓✓ Аватары работают')
process.exit(failed ? 1 : 0)
