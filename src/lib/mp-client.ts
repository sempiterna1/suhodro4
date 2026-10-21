'use client'

// Клиент лобби-сервиса мультиплеера (socket.io через Caddy-шлюз)
// Паттерн из examples/websocket: io('/?XTransformPort=3003'), path '/'

import { io, type Socket } from 'socket.io-client'
import type { GuestCmd, Snap } from '@/game/mp-protocol'

let socket: Socket | null = null

export function getMpSocket(): Socket {
  // ЖЕЛЕЗНОЕ ПРАВИЛО: один сокет на страницу. Создали — и никогда не убиваем.
  // При любых проверках «connected/connecting» и пересоздании была гонка:
  // эффект socket-events убивал сокет, на котором joinLobby держал
  // once('connect'), и команда join навсегда оставалась на мёртвом инстансе.
  // reconnection:true сам поднимает соединение после любых сбоев.
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      // polling первым: мгновенно работает через Caddy-шлюз, websocket — апгрейдом
      transports: ['polling', 'websocket'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 15000,
    })
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __mpSocket?: Socket }).__mpSocket = socket
    }
  }
  return socket
}

export function closeMpSocket() {
  socket?.disconnect()
  socket = null
}

export function createLobby(): Promise<{ code: string | null; error?: string }> {
  return new Promise((resolve) => {
    const s = getMpSocket()
    let settled = false
    const done = (r: { code: string | null; error?: string }) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    if (!s.connected) {
      s.once('connect', () => s.emit('lobby:create', (res: { code: string }) => done({ code: res.code })))
      s.once('connect_error', () => done({ code: null, error: 'Сервис лобби недоступен' }))
    } else {
      s.emit('lobby:create', (res: { code: string }) => done({ code: res.code }))
    }
    setTimeout(() => done({ code: null, error: 'Таймаут создания лобби' }), 8000)
  })
}

export function joinLobby(
  code: string
): Promise<{ ok: boolean; snap?: Snap; error?: string }> {
  return new Promise((resolve) => {
    const s = getMpSocket()
    let settled = false
    const done = (r: { ok: boolean; snap?: Snap; error?: string }) => {
      if (!settled) {
        settled = true
        resolve(r)
      }
    }
    const emit = () =>
      s.emit(
        'lobby:join',
        { code },
        (res: { ok: true; snap: Snap } | { ok: false; error: string }) => {
          if (res.ok) done({ ok: true, snap: res.snap })
          else done({ ok: false, error: res.error })
        }
      )
    if (!s.connected) {
      s.once('connect', emit)
      s.once('connect_error', () => done({ ok: false, error: 'Сервис лобби недоступен' }))
    } else {
      emit()
    }
    setTimeout(() => done({ ok: false, error: 'Таймаут подключения' }), 15000)
  })
}

export function sendCmd(code: string, cmd: GuestCmd) {
  const s = getMpSocket()
  if (s.connected) s.emit('guest:cmd', { code, cmd })
}

export function sendSnap(code: string, snap: Snap) {
  const s = getMpSocket()
  if (s.connected) s.emit('host:snap', { code, snap })
}

/** Хост закрывает лобби — гостю придёт host:left */
export function closeLobby(code: string) {
  const s = getMpSocket()
  if (s.connected) s.emit('host:close', { code })
}
