# Музыка для «Последнего горизонта» — промпты для Suno

Стиль игры: замёрзший мир, который убил живой минерал; паропанк, лагерь беженцев, тёплые огни среди холода, трагедия и тайна. Музыка должна быть холодной, медленной и человечной: струнные и низкая медь, механический ритм паровых машин, редкие тёплые мотивы.

**Как вставлять в Suno (режим Custom):**

- **Style of Music** — строка из блока «Стиль».
- **Lyrics** — блок «Структура» целиком. Слов там нет, только теги: так Suno делает инструментал.
- Включите **Instrumental**.
- Для фоновой музыки в игре берите версии без резкого финала. Удобнее всего — те, где последняя часть тихая: их легче зациклить.

---

## 1. Главная тема — меню и затишье между волнами

**Стиль:**

```
dark cinematic orchestral, frostpunk, steampunk, slow 70 bpm, mournful cello, low strings, distant brass, music box, howling wind, hopeful undertone, instrumental
```

**Структура:**

```
[Intro: wind, lone music box melody]
[Verse: solo cello, soft low strings]
[Build: steam hiss, slow mechanical pulse]
[Chorus: full strings, warm horn theme, hopeful but sad]
[Bridge: music box over choir pad]
[Outro: wind, single cello note fades]
[Instrumental]
```

---

## 2. Бой — волна идёт по тракту

**Стиль:**

```
epic steampunk battle orchestral, frostpunk, 110 bpm, driving taiko and anvil percussion, staccato low strings, industrial steam machinery rhythm, brass stabs, tense, cold, instrumental
```

**Структура:**

```
[Intro: ticking gears, steam whistle]
[Verse: staccato strings, anvil hits, marching drums]
[Pre-Chorus: rising brass, tension]
[Chorus: full orchestra, heavy drums, heroic horn motif]
[Breakdown: percussion and machinery only]
[Chorus: louder, choir added]
[Outro: drums drop to steady loop]
[Instrumental]
```

---

## 3. Босс — Колосс Разлома

**Стиль:**

```
dark epic boss battle, frostpunk, steampunk, 125 bpm, massive war drums, distorted low brass, eerie choir, dissonant strings, alien crystalline synth shimmer, ominous, relentless, instrumental
```

**Структура:**

```
[Intro: deep rumble, eerie crystal shimmer]
[Verse: pounding war drums, low brass ostinato]
[Chorus: choir chant, dissonant strings, huge brass]
[Bridge: crystalline synth, heartbeat drum, silence breaks]
[Final Chorus: everything at once, faster]
[Outro: one last brass hit, ringing shimmer]
[Instrumental]
```

---

## 4. Победа и поражение — короткие отбивки (15–20 секунд)

**Победа — стиль:**

```
short orchestral victory sting, frostpunk, warm horns and strings, relief after hardship, bittersweet, 15 seconds, instrumental
```

**Поражение — стиль:**

```
short orchestral defeat sting, frostpunk, falling strings, low brass, cold wind, tragic, 15 seconds, instrumental
```

Структура для обеих:

```
[Short Instrumental Sting]
[End]
```

---

**Если результат слишком «эпичный» или поп-звучащий**, допишите в начало стиля `ambient,` и уберите `epic`. Звучание станет тише и холоднее.
