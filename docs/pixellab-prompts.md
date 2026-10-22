# Промпты для PixelLab — «Железный Разлом»

Каждый блок ниже — **готовый текст для поля Description**. Копируйте один блок целиком: одна генерация — один ассет. Пояснения на русском в Description не вставляйте.

---

## Как работать в PixelLab

**1. Один ассет — одна генерация.** В Description вставляется один блок. Нельзя вставлять таблицы или несколько ассетов сразу: модель смешает всё в одну картинку.

**2. Какой инструмент для чего:**

| Что делаем | Где в PixelLab |
|---|---|
| Тайлы, башни, декор, снаряды, иконки | слева **Create** → **Create image** |
| Враги и Охотница | сверху **Characters** (персонаж сразу в 4 направлениях) |
| Анимация (ходьба, огонь, выстрел) | слева **Animate**, на уже готовую картинку |
| Предметы на карте | сверху **Objects** (или тот же Create image) |

**3. Модель.** **Pixen** — быстро, для проб. **Pro** — лучше качество. Нашёл удачный промпт на Pixen — делайте финал на Pro.

**4. Размер холста.** Ставьте тот, что указан над блоком. Если поля размера не видно — разверните настройки под Description.

**5. Настройки, если они есть:**

| Поле | Значение |
|---|---|
| Background | transparent (кроме тайлов земли и тропы) |
| Outline | black outline |
| Palette | загрузить [palette.png](palette.png) |
| Style reference | первый удачный ассет — для всех следующих |

**6. Генерируйте 3–4 раза и берите лучший.** Нейросеть каждый раз рисует по-разному, это нормально.

**7. Края тропы и переходы рисовать не нужно.** Бордюры, тени и стыки игра рисует сама. От вас нужны только **ровные бесшовные текстуры**.

---

## 1. Тайлы земли — Create image, 32×32, без прозрачного фона

Первая попытка вышла кубиком в перспективе, потому что модели не сказали «плоско сверху». В этих промптах это сказано явно.

**Земля:**
```
seamless tileable texture, flat top-down view, dark brown trampled dirt ground with tiny grey pebbles and black coal dust, no perspective, no objects, no grass, fills the entire square edge to edge, pixel art
```

**Тропа (плиты):**
```
seamless tileable texture, flat top-down view, worn khaki sandstone paving slabs in a 2x2 grid, thin dark mortar gaps between slabs, small cracks, no perspective, fills the entire square edge to edge, pixel art
```

**Стальной пол:**
```
seamless tileable texture, flat top-down view, dark gunmetal riveted steel floor plate, rivets in the corners, one welded seam, rust streaks, no perspective, fills the entire square edge to edge, pixel art
```

**Земля с травой** (для разнообразия):
```
seamless tileable texture, flat top-down view, dark brown dirt ground with sparse small tufts of dry olive green grass, no perspective, fills the entire square edge to edge, pixel art
```

**Проверить бесшовность:** поставьте 4 копии тайла квадратом 2×2 — швов быть не должно. Если швы видны, сгенерируйте ещё раз.

---

## 2. Портал и ворота — Create image, 48×48, прозрачный фон

**Портал врагов:**
```
glowing green rift portal, broken steel ring half buried in the ground, green crystals around it, swirling toxic green energy inside, top-down view, steampunk, pixel art, transparent background
```

**Ворота города:**
```
fortified brass city gate, heavy riveted iron doors, two red alarm lamps on top, stone walls on the sides, front view from slightly above, steampunk, pixel art, transparent background
```

---

## 3. Декор — Create image (или Objects), прозрачный фон

Все предметы видны **слегка сверху**, как сама карта.

**16×16:**

Ящик:
```
small wooden crate with iron corners, view from slightly above, steampunk, pixel art, transparent background
```

Бочка:
```
small rusty barrel with steel hoops, view from slightly above, steampunk, pixel art, transparent background
```

Шестерня:
```
broken brass gear half buried in dirt, view from above, pixel art, transparent background
```

Камни:
```
small pile of grey rocks, view from slightly above, pixel art, transparent background
```

Кристаллы:
```
small cluster of glowing green crystals, view from slightly above, pixel art, transparent background
```

Кости:
```
scattered old bones on the ground, view from above, pixel art, transparent background
```

Решётка:
```
square iron floor vent grate, flat top-down view, pixel art, transparent background
```

**32×32:**

Фонарь:
```
old iron street lantern on a post, warm yellow light glowing inside, view from slightly above, steampunk, pixel art, transparent background
```

Печь:
```
small coal furnace with a glowing orange grille and a short chimney, riveted iron, view from slightly above, steampunk, pixel art, transparent background
```

Котёл:
```
small steam boiler with a brass chimney, pressure gauge and copper pipes, view from slightly above, steampunk, pixel art, transparent background
```

Сломанный робот:
```
wrecked rusted steam robot lying half buried in dirt, broken gears around it, view from slightly above, steampunk, pixel art, transparent background
```

---

## 4. Растения — Create image, 16×16, прозрачный фон

Трава:
```
small tuft of tough olive green grass, view from slightly above, pixel art, transparent background
```

Камыш:
```
two reeds with brown cattail heads, view from slightly above, pixel art, transparent background
```

Папоротник:
```
small green fern with curled fronds, view from slightly above, pixel art, transparent background
```

Куст:
```
low thorny dark green bush with tiny red berries, view from slightly above, pixel art, transparent background
```

Цветок:
```
thin green stem with a small rust red flower, view from slightly above, pixel art, transparent background
```

**Анимация ветра:** откройте готовое растение в **Animate** и вставьте в описание движения:
```
gently swaying in the wind, the base stays in place, only the top bends
```

---

## 5. Башни — Create image, 32×48, прозрачный фон

Сначала сделайте **Стражника**. Когда он понравится, ставьте его в **Style reference** для всех остальных башен, чтобы получилась одна серия.

**Стражник** (с него начать):
```
steampunk defense tower, square stone block base with iron rivets, short brass column with a grey stripe, on top a small brass gear turret with a short cannon barrel, front view from slightly above, pixel art, transparent background
```

Лучница:
```
steampunk defense tower, square stone block base with iron rivets, brass column with an olive green stripe, on top a light wooden crossbow with a nocked arrow, front view from slightly above, pixel art, transparent background
```

Арбалетчик:
```
steampunk defense tower, square stone block base with iron rivets, brass column with an olive green stripe, on top a heavy steel crossbow with a brass scope, front view from slightly above, pixel art, transparent background
```

Ловчий:
```
steampunk defense tower, square stone block base with iron rivets, brass column with an olive green stripe, on top a triple crossbow and a net launcher, front view from slightly above, pixel art, transparent background
```

Баллиста:
```
steampunk defense tower, square stone block base with iron rivets, brass column with an olive green stripe, on top a long ballista loaded with a huge bolt, front view from slightly above, pixel art, transparent background
```

Камнемёт:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a copper orange stripe, on top a catapult arm with a round stone in the bucket, front view from slightly above, pixel art, transparent background
```

Молотобоец:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a copper orange stripe, on top a heavy piston driven steam hammer, front view from slightly above, pixel art, transparent background
```

Мортира:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a copper orange stripe, on top a short wide iron mortar barrel pointing up, front view from slightly above, pixel art, transparent background
```

Голем-таран:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a copper orange stripe, on top a huge iron battering ram fist on pistons, front view from slightly above, pixel art, transparent background
```

Пиромант:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a red stripe, on top an iron brazier with a roaring orange flame, front view from slightly above, pixel art, transparent background
```

Ледяной шпиль:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a red stripe, on top a tall pale blue ice crystal spire with frost mist, front view from slightly above, pixel art, transparent background
```

Заклинатель молний:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a red stripe, on top a copper tesla coil crackling with violet sparks, front view from slightly above, pixel art, transparent background
```

Хрономант:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a red stripe, on top a brass hourglass inside spinning clock rings with a purple glow, front view from slightly above, pixel art, transparent background
```

Механический страж:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a grey stripe, on top a twin barrel rotary machine gun on a swivel, front view from slightly above, pixel art, transparent background
```

Призматический кристалл:
```
steampunk defense tower, square stone block base with iron rivets, brass column with a grey stripe, on top a floating faceted cyan crystal prism glowing, front view from slightly above, pixel art, transparent background
```

**Слитые башни** — та же схема, но с золотыми кольцами:

Огненная лучница:
```
ornate fusion steampunk defense tower with golden rings around the brass column, square stone base, olive green and red stripes, on top a crossbow shooting flaming arrows, front view from slightly above, pixel art, transparent background
```

Вулкан:
```
ornate fusion steampunk defense tower with golden rings around the brass column, square stone base, copper and red stripes, on top a catapult with a molten lava rock dripping lava, front view from slightly above, pixel art, transparent background
```

Громовой арбалет:
```
ornate fusion steampunk defense tower with golden rings around the brass column, square stone base, olive green and red stripes, on top a steel crossbow combined with a crackling tesla coil, front view from slightly above, pixel art, transparent background
```

Бастион:
```
ornate fusion steampunk defense tower with golden rings, square stone base, on top a small fortified brass bunker with twin guns and a red banner, front view from slightly above, pixel art, transparent background
```

Каменный титан:
```
ornate fusion steampunk defense tower with golden rings, massive stone base, on top a giant stone fist slamming down, front view from slightly above, pixel art, transparent background
```

Остальные слитые башни — по той же схеме. В конец после `on top` вставьте навершие:

| Башня | Навершие |
|---|---|
| Морозный ловчий | `a triple crossbow with ice tipped bolts and frost` |
| Осадная машина | `a huge siege ballista on a battering ram frame` |
| Страж времени | `a steam hammer wrapped in spinning clock rings` |
| Грозовая мортира | `a mortar with a lightning rod and storm sparks` |
| Паровой котёл | `a boiler venting a big cloud of white steam` |
| Призма вечности | `a cyan prism inside a brass hourglass frame` |
| Автоматический арсенал | `a rack of auto loading crossbows and gun barrels` |

**Анимация выстрела:** готовую башню откройте в **Animate**.

Для стреляющих:
```
the weapon on top recoils when firing, then returns
```

Для магических:
```
the top glows brighter and pulses when casting a spell
```

---

## 6. Враги — Characters

**Как делать:** вверху **Characters** → создать персонажа → вставить описание → **4 направления**. Затем в этом же персонаже → **Animate** → **walk** (ходьба).

**Размеры:**

| Враги | Размер |
|---|---|
| Мелкие | 32 |
| Крупные | 48 |
| Босс | 64 |

Паровой паук (32):
```
small steam powered spider robot, round pale brass boiler body, six thin jointed metal legs, tiny chimney on top, one glowing red eye, steampunk, pixel art
```

Заводной жук (32):
```
clockwork beetle robot, riveted pale brass shell, small metal wings, wind-up key on its back, one glowing red eye, steampunk, pixel art
```

Заводной пехотинец (32):
```
clockwork soldier robot, grey steel body, steel helmet with a visor, holding a rifle, big wind-up key on its back, one glowing red eye, steampunk, pixel art
```

Паровой наездник (48):
```
robot riding a steam powered motorcycle with big spoked wheels, grey steel, exhaust smoke behind, one glowing red eye, steampunk, pixel art
```

Котельный латник (48):
```
heavy boxy armored robot, dark iron riveted plates, two smoking chimneys on its shoulders, narrow eye slit glowing red, steampunk, pixel art
```

Клёпаный голем (48):
```
massive riveted dark iron golem, glowing orange furnace in its chest, thick piston arms, one glowing red eye, steampunk, pixel art
```

Кристалл Разлома (32):
```
floating chunk of glowing green crystal with a red eye in the center, small crystal shards orbiting around it, no legs, pixel art
```

Искра Разлома (32):
```
small fast glowing green energy wisp, bright white core, flickering green flame tail, tiny red eye, pixel art
```

Титан-ИИ, босс (64):
```
giant steampunk war machine boss, dark iron body, domed head with one huge glowing red eye, crown of brass gears, glowing furnace in the chest, cannon arms, two heavy legs, pixel art
```

**Анимация летающих врагов** (кристалл, искра). Вместо walk вставьте:
```
hovering in the air, bobbing slowly up and down
```

**Гибель врага** (по желанию):
```
breaking apart into flying gears and bolts with a burst of white steam
```

---

## 7. Охотница — Characters, 32, 4 направления

```
hooded female hunter, dark green cloak, brown leather straps, holding a brass steampunk bow, pixel art
```

**Анимации:** walk, idle и выстрел. Для выстрела вставьте:
```
drawing the bow and shooting an arrow
```

**Портрет для интерфейса** — Create image, 64×64:
```
portrait of a hooded female steampunk hunter, dark green cloak, brass goggles on her forehead, confident look, pixel art
```

---

## 8. Снаряды — Create image, 16×16, прозрачный фон

Снаряды летят **вправо**, игра сама их поворачивает.

Стрела:
```
single wooden arrow flying to the right, side view, pixel art, transparent background
```

Болт:
```
single steel crossbow bolt flying to the right, side view, pixel art, transparent background
```

Камень:
```
single round grey stone, pixel art, transparent background
```

Огненный шар:
```
single glowing orange fireball with a small flame tail pointing left, pixel art, transparent background
```

Лёд:
```
single sharp pale blue ice shard pointing right, pixel art, transparent background
```

Магия:
```
single glowing purple magic orb with sparkles, pixel art, transparent background
```

---

## 9. Эффекты — Create image, 32×32 + Animate

**Взрыв.** Картинка:
```
chunky explosion, orange and yellow fire, dark smoke, flying debris, pixel art, transparent background
```
Анимация:
```
explosion expands quickly then fades into smoke
```

**Пар.** Картинка:
```
puff of white steam cloud, pixel art, transparent background
```
Анимация:
```
the steam cloud rises and dissipates
```

---

## 10. Иконки — Create image, 32×32, прозрачный фон

Жизни:
```
red heart icon with a brass rim, pixel art, transparent background
```

Золото:
```
shiny gold coin icon with a gear stamped on it, pixel art, transparent background
```

Волна:
```
two crossed steel swords icon, pixel art, transparent background
```

Ролл:
```
brass dice icon, pixel art, transparent background
```

Босс:
```
iron robot skull icon with one glowing red eye, pixel art, transparent background
```

---

## 11. С чего начать

1. **Тайлы:** земля и тропа (раздел 1). Проверьте, что они плоские и без швов.
2. **Стражник** (раздел 5). Затем ставьте его в Style reference для остальных башен.
3. **Паровой паук** в Characters, с ходьбой (раздел 6).
4. **Фонарь, бочка и трава** (разделы 3–4).

**Сохранение.** Скачивайте в PNG. Анимацию — листом кадров (sprite sheet), если такая кнопка есть.

**Имена файлов:**

| Что | Имя файла |
|---|---|
| Земля | `tile-ground.png` |
| Тропа | `tile-path.png` |
| Стражник | `tower-sentry.png` |
| Ходьба паука вправо | `creep-scuttler-walk-east.png` |
| Фонарь | `decor-lantern.png` |

**Куда класть:** `E:\zhelezny-razlom\public\assets\`. Как принесёте первую партию, я подключу её к игре.
