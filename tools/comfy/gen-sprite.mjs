// Прогоны ComfyUI (workflow tools/comfy/image_moss_image_t2i.json): node tools/comfy/gen-sprite.mjs <имя> <аspect> <seed,seed,...> <файл-с-промптом>
// Меняются только текст промпта, seed и размер; enhancer выключен, steps 40, cfg 2.5. Результат — tools/preview/out/gen/<имя>-<seed>.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const [, , name, aspect, seeds, promptFile] = process.argv
const base = JSON.parse(readFileSync(new URL('./image_moss_image_t2i.json', import.meta.url), 'utf8'))
const prompt = readFileSync(promptFile, 'utf8').trim()
mkdirSync('tools/preview/out/gen', { recursive: true })
for (const seed of seeds.split(',').map(Number)) {
  const w = structuredClone(base)
  w['18:17'].inputs.value = prompt
  w['18:7'].inputs.seed = seed; w['18:7'].inputs.steps = 40; w['18:7'].inputs.cfg = 2.5
  w['19'].inputs.aspect_ratio = aspect; w['19'].inputs.megapixels = 1
  w['9'].inputs.filename_prefix = `${name}_${seed}`
  const j = await (await fetch('http://127.0.0.1:8188/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: w }) })).json()
  const id = j.prompt_id; if (!id) { console.log(seed, JSON.stringify(j).slice(0, 300)); continue }
  let h
  for (;;) { await new Promise((r) => setTimeout(r, 3000)); h = (await (await fetch('http://127.0.0.1:8188/history/' + id)).json())[id]; if (h?.outputs?.['9']) break; if (h?.status?.status_str === 'error') break }
  const im = h?.outputs?.['9']?.images?.[0]; if (!im) { console.log('fail', seed); continue }
  writeFileSync(`tools/preview/out/gen/${name}-${seed}.png`, Buffer.from(await (await fetch(`http://127.0.0.1:8188/view?filename=${im.filename}&subfolder=${im.subfolder}&type=${im.type}`)).arrayBuffer()))
  console.log('saved', name, seed)
}
