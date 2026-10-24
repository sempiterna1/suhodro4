# Звуки: источники и лицензии

Обработка и сборка: `tools/preview/sfx-build.mjs` (сэмплы) и `tools/preview/sfx-synth.mjs` (синтез);
замеры (атака, центроид, доля высоких частот): `tools/preview/sfx-analyze.mjs`.

## Сэмплы (CC0, проверено на страницах источников 2026-10-22)

### Лук и арбалет
- Источник: https://opengameart.org/content/medieval-sound-effects-weapon-textures
- Авторы: Ben Jaszczak & Brian Nelson (загрузил MedicineStorm), лицензия CC0
- Файлы: `bow-longbow.wav` (English Longbow Shoot), `bow-recurve.wav` (Scythian Recurve Shoot), `crossbow-shoot.wav` (Crossbow Shoot);
  моно, обрезка, срез верха фильтром и мягкая атака

### Монстры (гибель врагов)
- Источник: https://opengameart.org/content/monster-sound-effects-pack
- Автор: Ogrebane, лицензия CC0
- Файлы: `monster-1.wav` … `monster-10.wav`; моно 22 кГц, срез верха, мягкая атака

## Собственный синтез (шум + фильтры + огибающие, права принадлежат проекту)
`catapult-*`, `mortar-*`, `thud-*`, `boom-*`, `fire-*`, `frost-*`, `spark-*`, `time-*`, `prism-1`, `steam-*`, `clank-*`,
`build-*`, `roll-1`, `leak-1`, `horn-1` — сгенерированы `sfx-synth.mjs`, внешних источников нет.

Ambient (ветер, гул генератора, костры, скрип, пульс Разлома) целиком синтезируется в Web Audio в `src/game/audio.ts`.

Звуки Kenney «63 Digital sound effects» (цифровые лазеры) убраны как не подходящие по характеру.

## Шаги мобов
- Источник: https://opengameart.org/content/42-snow-and-gravel-footsteps («Walking in Snow»)
- Автор записи: Corsica_S (на OpenGameArt загрузил qubodup; исходники на freesound.org, id 28661 и 28662), лицензия CC0
- Файлы: `step-light-1…6.wav` (лёгкие мобы: хруст снега), `step-heavy-1…4.wav` (тяжёлые: ниже в 1.6 раза, темнее, плюс синтезированный глухой удар), `step-paw-1…4.wav` (волк: короткие шлепки);
  получены `tools/preview/sfx-steps.mjs` (свой декодер FLAC `sfx-flac.mjs`, срез верха, мягкая атака)

Музыка — в `public/assets/music/LICENSES.md`.
