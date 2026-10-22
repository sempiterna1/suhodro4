// PNG-палитра игры для PixelLab (поле Color palette): квадраты 8×8 в ряд по 8
import { createCanvas } from '@napi-rs/canvas'
import { writeFileSync } from 'node:fs'

const colors = [
  '#140d07', '#d4a85a', '#7d5a2c', '#ffd76a', '#a8adb3', '#61666d', '#3c4046', '#201811',
  '#261c13', '#403424', '#5e5137', '#6f6145', '#3a3022', '#7a6a48', '#2c2925', '#3a362f',
  '#4a2e1c', '#ff8a1e', '#ffdc4a', '#c8501a', '#ece6d6', '#ff3b24', '#ffc2b0', '#a6f095',
  '#4e9a46', '#eaffdf', '#7ad0c8', '#4f5f22', '#6f7d34', '#7a6f34', '#d4b483', '#9aa0a6',
  '#6b6f76', '#7aa874', '#8fae6b', '#c2874f', '#d4694f', '#b0a08a', '#3f7a5a', '#275040',
  '#6b4a2e', '#e8b48a',
]
const S = 8
const cols = 8
const cv = createCanvas(cols * S, Math.ceil(colors.length / cols) * S)
const c = cv.getContext('2d')
colors.forEach((col, i) => {
  c.fillStyle = col
  c.fillRect((i % cols) * S, Math.floor(i / cols) * S, S, S)
})
writeFileSync(process.argv[2], cv.toBuffer('image/png'))
console.log('saved', colors.length, 'colors')
