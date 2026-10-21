# Промпты для ассетов «Железного Разлома»

Готовые промпты для графических нейросетей (Midjourney, DALL·E / ChatGPT, Stable Diffusion, Leonardo, PixelLab, Retro Diffusion). Промпты написаны на английском: так модели понимают их точнее. Пояснения — на русском.

Под каждым промптом указан **итоговый размер**: под него рассчитан движок, и с ним ассет встанет в игру без переделок.

---

## 1. Как пользоваться

1. В начало каждого промпта вставляйте **общий стиль** из раздела 2. Без него ассеты разойдутся по стилю.
2. Генерируйте крупно (1024×1024), а потом **уменьшайте до итогового размера без сглаживания** (nearest neighbor). Обычные нейросети не делают настоящий пиксель-арт: у них «пиксели» неровные. Уменьшение и сведение к палитре исправляют это.
3. Свести к палитре можно в Aseprite (Sprite → Color Mode → Indexed, загрузить палитру из раздела 3) или в Photopea (Image → Mode → Indexed).
4. Фон убирать до прозрачного (remove.bg, Photopea, Aseprite). Всем спрайтам нужен **прозрачный фон**. Исключение — тайлы земли и тропы.
5. Для настоящего пиксель-арта лучше подходят **PixelLab** и **Retro Diffusion**: они сразу рисуют в маленьком размере, по сетке и с прозрачным фоном.
6. Анимации делайте **листом кадров** (sprite sheet): кадры в один ряд, одинакового размера, без отступов.

**Как устроен мир в коде.** Поле — 480×300 игровых пикселей, на экране оно растягивается в 2 раза и больше. Клетка — 20×20 игровых пикселей. Все размеры ниже указаны в игровых пикселях.

---

## 2. Общий стиль (вставлять в каждый промпт)

```
pixel art, 16-bit retro game asset, steampunk industrial wasteland, brass copper and riveted steel,
coal smoke and steam, dark gritty atmosphere with warm brass highlights, limited palette,
crisp 1-pixel dark outline, top-left light source, no anti-aliasing, no blur, no gradients,
clean readable silhouette, game sprite, transparent background
```

**Негативный промпт** (для Stable Diffusion / Leonardo; в Midjourney — через `--no`):

```
blurry, anti-aliasing, smooth gradients, 3d render, photorealistic, painterly, soft shading,
text, watermark, signature, frame, border, background scenery, multiple objects, cropped,
jpeg artifacts, noise, high detail texture, isometric
```

**Midjourney:** добавлять в конец `--style raw --ar 1:1 --v 6`, а для тайлов ещё `--tile`.

---

## 3. Палитра игры

Ассеты должны укладываться в эти цвета, тогда они сойдутся с остальной графикой. Это цвета из кода (`src/game/pixel.ts`, `config.ts`).

| Назначение | Цвета |
|---|---|
| Контур | `#140d07` |
| Латунь | `#d4a85a` светлая · `#7d5a2c` тёмная · `#ffd76a` блик |
| Сталь | `#a8adb3` · `#61666d` · `#3c4046` воронёная |
| Земля | `#201811` · `#231a12` · `#261c13` · камешки `#403424` |
| Тропа | `#5e5137` · `#584b32` · блик `#6f6145` · швы `#3a3022` · кант `#7a6a48` |
| Стальные плиты пола | `#2c2925` · `#29261f` · блик `#3a362f` · ржавчина `#4a2e1c` |
| Огонь | `#ff8a1e` · `#ffdc4a` · `#c8501a` |
| Пар | `#ece6d6` |
| Глаз ИИ | `#ff3b24` · блик `#ffc2b0` |
| Кристалл Разлома | `#a6f095` · `#4e9a46` · `#eaffdf` · бирюзовый `#7ad0c8` |
| Растения | `#4f5f22` · `#5e6e2a` · `#6f7d34` · сухая `#7a6f34` |
| Броня врагов | лёгкая `#d4b483` · средняя `#9aa0a6` · тяжёлая `#6b6f76` · универсальная `#7aa874` |
| Типы атаки башен | пронзающая `#8fae6b` · сокрушающая `#c2874f` · магическая `#d4694f` · универсальная `#b0a08a` |
| Охотница | плащ `#3f7a5a` · `#275040` · кожа `#6b4a2e` · лицо `#e8b48a` |

---

## 4. Тайлы карты

Тайлы — **бесшовные** квадраты, вид строго сверху. Для каждого тайла сделайте 3–4 варианта, чтобы поле не выглядело повторяющимся.

### 4.1 Земля — 20×20, бесшовный, 4 варианта
```
[стиль] seamless tileable top-down ground texture, dark trampled soil of an industrial wasteland,
scattered tiny pebbles and coal dust, very dark brown, subtle variation, flat lighting,
no objects, no grass, fills the whole square, no transparent background
```

### 4.2 Стальная плита пола — 40×40 (на 2×2 клетки), 3 варианта
```
[стиль] top-down riveted steel floor plate, dark gunmetal, rivets in the four corners,
one welded seam across the middle, rust streaks and small dents, beveled edge highlight top-left,
shadow bottom-right, flat top-down view, no transparent background
```

### 4.3 Тропа — 20×20, бесшовный, 4 варианта
```
[стиль] seamless top-down paved road tile, worn sandstone and brass-tinted flagstones,
2x2 square slabs with dark mortar gaps, small cracks, one tiny brass rivet,
warm khaki tone, top-left highlight on each slab, no transparent background
```

### 4.4 Край тропы (бордюр) — 20×20, отдельно прямой участок, внешний и внутренний угол
```
[стиль] top-down road curb edge tile, light brass-stone curb strip along one side of a paved road,
dark drop shadow onto the ground side, matches khaki flagstone road, three versions:
straight edge, outer corner, inner corner
```

### 4.5 Вход и выход
```
[стиль] side-on pixel sprite of a glowing green rift portal arch made of broken steel and crystals,
swirling toxic-green energy inside, sparks, 14x24 pixels, transparent background
```
```
[стиль] side-on pixel sprite of a fortified brass city gate with red alarm lamps,
heavy riveted doors, 14x24 pixels, transparent background
```

---

## 5. Декор (мелкие предметы, 8×8 – 16×16, прозрачный фон)

Декор стоит в углу клетки, поэтому он мелкий. Для каждого предмета просите **3 варианта на одном листе**.

```
[стиль] set of small top-down props for an industrial steampunk wasteland, each 12x12 pixels,
on transparent background, evenly spaced in a row:
wooden crate, rusty barrel with steel hoops, broken gear half-buried, pile of grey rocks,
glowing green mineral crystals, lantern on a post with warm light, scattered bones,
oil puddle with rainbow sheen, broken pipe with valve, floor vent grate,
small coal furnace with glowing grille, steam valve with pressure gauge
```

Отдельные объекты покрупнее (16×16), их можно ставить реже:
```
[стиль] top-down steampunk machinery prop, 16x16 pixels, a small boiler with chimney puffing steam,
brass pipes, pressure gauge, riveted steel body, transparent background
```
```
[стиль] top-down horizontal steel pipe segment with brass flanges, seamless along its length,
20x6 pixels, transparent background, also a vertical version and an elbow joint
```

### 5.1 Растения с анимацией ветра — 8×12, лист из 4 кадров
```
[стиль] sprite sheet, 4 frames in a row, each 8x12 pixels, a tuft of tough olive-green wasteland grass
swaying in the wind, frames loop smoothly (left, center, right, center), base of the grass stays fixed,
only the tips bend, transparent background
```
Тот же промпт с заменой первой части на: `reed with a brown cattail head`, `small fern with curled fronds`, `low thorny bush with red berries`, `thin stem with a small rust-red flower`.

---

## 6. Враги — вид сбоку, смотрят вправо, лист из 4 кадров ходьбы

Враги в игре разворачиваются сами, поэтому рисовать нужно только **смотрящими вправо**. Основной цвет корпуса задаётся типом брони (палитра, раздел 3). У всех один общий признак — **красный светящийся глаз ИИ**.

**Шаблон:**
```
[стиль] sprite sheet, 4-frame walk cycle in a row, each {W}x{H} pixels, side view facing right,
{описание}, single glowing red AI eye, small steam puffs, main body color {цвет брони},
transparent background
```

| Враг | Размер | {описание} | Броня |
|---|---|---|---|
| Паровой паук | 16×12 | `a small steam-powered spider robot, round boiler body on six jointed thin legs, tiny chimney on top` | лёгкая `#d4b483` |
| Заводной жук | 14×10 | `a clockwork beetle robot, two-part riveted shell with a seam, fluttering translucent wings, wind-up key on its back` | лёгкая |
| Заводной пехотинец | 12×14 | `a clockwork infantry soldier robot, steel helmet with a visor, rifle, big wind-up key on the back, short legs` | средняя `#9aa0a6` |
| Паровой наездник | 18×12 | `a robot rider on a steam motorcycle-boiler, two spoked wheels, exhaust smoke behind` | средняя |
| Котельный латник | 16×14 | `a heavy boxy armored robot with a riveted plate body, two smoking chimneys, narrow viewing slit, stomping legs` | тяжёлая `#6b6f76` |
| Клёпаный голем | 18×16 | `a massive riveted iron golem, glowing orange furnace in its chest, piston arms, heavy legs` | тяжёлая |
| Кристалл Разлома | 14×14 | `a floating chunk of glowing green mineral crystal with an eye in the center, small shards orbiting it, no legs, hovering` | универсальная `#7aa874` |
| Искра Разлома | 12×7 | `a fast glowing green energy wisp with a bright core and a flickering flame tail, hovering` | универсальная |
| **Титан-ИИ (босс)** | 28×23 | `a giant boss war machine, domed head with one huge red eye, crown of spinning gears, furnace in the chest, cannon arms, two heavy legs` | тяжёлая |

**Дополнительно для каждого врага (по желанию):** кадр гибели, где робот разваливается на детали и выпускает пар.
```
[стиль] sprite sheet, 4 frames, the same {враг} breaking apart into bolts, gears and steam, facing right,
{W}x{H} pixels each, transparent background
```

---

## 7. Охотница (герой) — 12×13, вид сбоку, смотрит вправо

```
[стиль] sprite sheet, 4-frame walk cycle, each 12x13 pixels, side view facing right,
a hooded female hunter in a dark green cloak, leather straps, holding a brass steampunk bow,
determined, small and readable, transparent background
```
Ещё 2 кадра: стойка и выстрел (`drawing the bow` / `releasing an arrow`).

Портрет для HUD — 48×48:
```
[стиль] character portrait icon 48x48 pixels, hooded female steampunk hunter, green cloak,
brass goggles pushed up, confident look, inside a round brass frame, dark background
```

---

## 8. Башни — 16×24, вид спереди-сверху (3/4), прозрачный фон

Как сейчас в игре: **каменный цоколь + латунная колонна + навершие по типу атаки**. Цвет типа атаки (раздел 3) — акцентная полоса на колонне. Нужен 1 кадр покоя и 1 кадр выстрела (отдача или вспышка).

**Шаблон:**
```
[стиль] game tower sprite, 16x24 pixels, 3/4 top-down front view, stone block base with rivets,
brass column with a {цвет атаки} accent band, on top: {навершие}, 2 frames in a row: idle and firing,
transparent background
```

**Уровень 5.** Тот же промпт плюс `upgraded elite version, gold trim, glowing parts, more ornate`.
**Слитые башни.** Тот же промпт плюс `fusion tower combining two designs, double-colored accents, golden rings around the column`.

| Башня | Атака | {навершие} |
|---|---|---|
| Стражник | универсальная | `a small brass gear turret with a short barrel` |
| Лучница | пронзающая | `a light crossbow arm with a nocked arrow, quick and slim` |
| Арбалетчик | пронзающая | `a heavy steel crossbow with a scope, aiming forward` |
| Ловчий | пронзающая | `a triple crossbow firing three bolts in a fan, net launcher` |
| Баллиста | пронзающая | `a long ballista with a huge bolt, tension cables` |
| Камнемёт | сокрушающая | `a catapult arm with a stone in the bucket` |
| Молотобоец | сокрушающая | `a piston-driven steam hammer` |
| Мортира | сокрушающая | `a short wide mortar barrel pointing up, smoke` |
| Голем-таран | сокрушающая | `a massive battering ram fist on pistons` |
| Пиромант | магическая | `a brazier with a roaring orange flame and fire crystal` |
| Ледяной шпиль | магическая | `a pale blue ice crystal spire, frost mist` |
| Заклинатель молний | магическая | `a tesla coil crackling with violet lightning` |
| Хрономант | магическая | `a brass hourglass inside spinning clock rings, purple glow` |
| Механический страж | универсальная | `a twin-barrel rotary machine gun on a swivel` |
| Призматический кристалл | универсальная | `a floating faceted cyan prism shooting a light beam` |

**Слитые башни** (тем же шаблоном, `fusion tower`):

| Башня | {навершие} |
|---|---|
| Огненная лучница | `a crossbow shooting flaming arrows` |
| Вулкан | `a catapult hurling molten lava rocks, lava dripping` |
| Громовой арбалет | `a steel crossbow with a tesla coil, lightning on the bolt` |
| Морозный ловчий | `a triple crossbow with ice-tipped bolts, frost` |
| Осадная машина | `a huge siege ballista on a ram frame` |
| Страж времени | `a steam hammer wrapped in spinning clock rings` |
| Грозовая мортира | `a mortar with a lightning rod, storm sparks` |
| Паровой котёл | `a boiler venting a big cloud of white steam, frost and fire pipes` |
| Бастион | `a fortified brass bunker with twin guns and a banner` |
| Призма вечности | `a prism inside an hourglass frame, purple-cyan beam` |
| Автоматический арсенал | `a rack of auto-loading crossbows and gun barrels` |
| Каменный титан | `a giant stone fist slamming the ground, shockwave` |

---

## 9. Снаряды и эффекты — листы кадров, прозрачный фон

```
[стиль] set of tiny projectile sprites in a row, each 6x6 pixels: arrow, steel bolt, round stone,
glowing fire orb, ice shard, purple magic orb, brass bullet, hammer head, transparent background
```
```
[стиль] sprite sheet, 6 frames in a row, each 24x24 pixels, a chunky pixel explosion with orange fire,
smoke and flying debris, transparent background
```
```
[стиль] sprite sheet, 4 frames, each 32x8 pixels, a jagged violet lightning bolt, horizontal, transparent background
```
```
[стиль] sprite sheet, 4 frames, each 16x16 pixels, a puff of white steam dissipating, transparent background
```
```
[стиль] sprite sheet, 4 frames, each 16x16 pixels, a robot breaking into flying gears and bolts, transparent background
```

---

## 10. Интерфейс (HUD)

Интерфейс тянется под любой экран, поэтому рамки рисуются **для растягивания на 9 частей (9-slice)**: углы не тянутся, края тянутся. Рисуйте их в 2–4 раза крупнее игровых пикселей — это экранная графика.

### 10.1 Латунная рамка панели — 96×96, 9-slice
```
[стиль] UI panel frame for 9-slice scaling, ornate steampunk brass border with rivets,
small gears in the four corners, dark leather-brown inner area, bevel highlight on top edge,
96x96 pixels, the center is plain so it can stretch, transparent outside the frame
```

### 10.2 Табличка-заголовок — 128×24
```
[стиль] small brass nameplate banner for a UI title, engraved metal plaque with rivets on both ends,
128x24 pixels, empty center for text, transparent background
```

### 10.3 Карточка башни в арсенале — 64×72
```
[стиль] UI card frame for a tower shop slot, brass border, dark recessed top window for an item picture,
small engraved plate at the bottom for a name and price, 64x72 pixels, empty inside, transparent background
```
Плюс 2 состояния того же: `highlighted, glowing gold border` и `disabled, dim and desaturated`.

### 10.4 Круглые латунные кнопки — 48×48, 3 состояния
```
[стиль] round steampunk brass button with a toothed gear rim, 48x48 pixels, embossed center,
three states in a row: normal, hovered (brighter), pressed (darker and inset), empty center for an icon,
transparent background
```

### 10.5 Иконки — 16×16, одним листом
```
[стиль] set of UI icons in a row, each 16x16 pixels, brass and dark outline style:
heart (lives), gold coin, crossed swords (wave), pause, play, fast forward, speaker on, speaker muted,
question mark, restart arrow, fullscreen, dice (reroll), lightning (ability), gear (settings),
skull (boss), coin stack (money wave), transparent background
```

### 10.6 Иконки брони и типов атаки — 12×12
```
[стиль] set of 8 small icons, each 12x12 pixels: armor types — feather (light), cog (medium),
shield (heavy), star crystal (universal); attack types — arrowhead (pierce), hammer (crush),
flame (magic), gear (universal), transparent background
```

### 10.7 Заставка — 1920×1080 (не пиксель-арт, можно иллюстрацию)
```
pixel art key art illustration, 16:9, a steampunk wasteland at dusk, a fortified brass city wall
with towers and crossbows defending a stone road, an army of clockwork robots with red glowing eyes
marching out of a glowing green rift in the ground, smoke and steam, warm brass light against
cold green energy, dramatic, empty space at the top center for the game title
```

### 10.8 Логотип — 512×160
```
pixel art game logo, the words "ЖЕЛЕЗНЫЙ РАЗЛОМ" in heavy riveted brass letters,
gears and a crack with green glow behind, transparent background
```
Нейросети часто путают кириллицу. Если буквы получатся с ошибками, сгенерируйте только **оформление без текста** (`no text, empty banner`) и наложите надпись шрифтом вручную.

---

## 11. Как подключить ассеты в игру

Сейчас вся графика рисуется кодом (`src/game/pixel.ts`), а файлов картинок игра не читает. Чтобы перейти на нарисованные ассеты, понадобится:

1. Положить файлы в `public/assets/` с понятными именами, например `creep-scuttler.png`, `tower-archer.png`, `tile-path-1.png`.
2. Добавить в рендерер загрузку картинок и рисовать их вместо процедурных спрайтов (`drawSprite`, `drawPixelTower`, `buildPixelBackground`).
3. Листы кадров нарезать по ширине кадра. Порядок кадров — слева направо.

Размеры в этом документе совпадают с текущими спрайтами в коде. Поэтому ассеты встанут на место без изменения логики игры, и их можно менять по одному.
