// Скриншоты игры в настоящем Chrome (CDP): node shot.mjs <ширина> <высота> <файл.png> [шаги...]
// шаги: click:<текст кнопки> | hover:<x>,<y> | wait:<мс> | tap:<x>,<y> | eval:<js> | shot:<файл.png> (промежуточный снимок)
// Нужен запущенный dev-сервер (npx next dev -p 3000). Мобильный режим: ширина < 700 → touch + mobile UA.
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , W, H, OUT, ...steps] = process.argv
const width = Number(W), height = Number(H), mobile = width < 700
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => { try { return require('node:fs').existsSync(p) } catch { return false } }) ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const port = 9400 + Math.floor(Math.random() * 300)
const dir = mkdtempSync(join(tmpdir(), 'shot-'))
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--no-first-run', '--disable-gpu', '--mute-audio', `--window-size=${width},${height}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch { /* ждём запуск */ } await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
const shoot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.result.data, 'base64')) }

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1.5, mobile })
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: 'http://localhost:3000/' })
await sleep(4000)
for (const st of steps) {
  const [k, ...rest] = st.split(':'), v = rest.join(':')
  if (k === 'click') await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.includes(${JSON.stringify(v)})); if (b) b.click(); return !!b })()`)
  else if (k === 'hover') { const [x, y] = v.split(',').map(Number); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' }) }
  else if (k === 'mclick') { const [x, y] = v.split(',').map(Number); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }) }
  else if (k === 'trybuild') {
    // поставить башню: нажать карточку с текстом v и пробовать клетки сеткой, пока золото не уменьшится
    const [name, level] = v.split('|')
    const rect = await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((b) => ${JSON.stringify(name)} === 'any' ? (b.getAttribute('aria-label') || '').includes(': ') && !b.disabled : b.textContent.includes(${JSON.stringify(name)})); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2] })()`)
    const gold = () => evalJs(`(() => { const e = document.querySelector('[title="Золото"]'); return e ? Number(e.textContent.replace(/\\D/g, '')) : 0 })()`)
    const g0 = await gold()
    const click = async (x, y) => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' }); await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, pointerType: 'mouse' }) }
    // перетаскивание карточки на клетку одним жестом: не зависит от того, остаётся ли карточка выбранной после неудачи
    const drag = async (x0, y0, x1, y1) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0, pointerType: 'mouse' })
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1, pointerType: 'mouse' })
      for (let i = 1; i <= 4; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * i) / 4, y: y0 + ((y1 - y0) * i) / 4, button: 'left', buttons: 1, pointerType: 'mouse' })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1, pointerType: 'mouse' })
    }
    let done = null
    if (rect) for (let y = height * 0.2; y < height * 0.7 && !done; y += 38) for (let x = width * 0.25; x < width * 0.75 && !done; x += 52) {
      await drag(rect[0], rect[1], x, y); await sleep(80)
      if ((await gold()) < g0) done = [x, y]
    }
    console.log('built at', done)
    if (done) { await sleep(300); await click(done[0], done[1] - 14); await sleep(900) }
  }
  else if (k === 'tap') { const [x, y] = v.split(',').map(Number); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(80); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) }
  else if (k === 'eval') console.log(await evalJs(v))
  else if (k === 'shot') await shoot(v)
  else if (k === 'wait') await sleep(Number(v))
  await sleep(300)
}
await shoot(OUT)
ws.close()
proc.kill()
process.exit(0)
