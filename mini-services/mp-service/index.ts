// Лобби-сервис мультиплеера «Железный Разлом»
// Только ретрансляция: хост присылает снапшоты мира, гость — команды.
// Авторитет состояния — клиент хоста (src/game/engine.ts).

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface Lobby {
  code: string
  host: Socket | null
  guest: Socket | null
  lastSnap: unknown
  createdAt: number
  hostSeenAt: number
}

const lobbies = new Map<string, Lobby>()

// Без похожих символов: нет O/0, I/1, L и т.п.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function genCode(len = 4): string {
  let code = ''
  do {
    code = Array.from({ length: len }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
  } while (lobbies.has(code))
  return code
}

function lobbyBySocket(socket: Socket): { lobby: Lobby; role: 'host' | 'guest' } | null {
  for (const l of lobbies.values()) {
    if (l.host?.id === socket.id) return { lobby: l, role: 'host' }
    if (l.guest?.id === socket.id) return { lobby: l, role: 'guest' }
  }
  return null
}

io.on('connection', (socket) => {
  socket.on('lobby:create', (ack?: (res: { code: string }) => void) => {
    // повторное создание тем же сокетом — возвращаем существующее лобби
    const existing = lobbyBySocket(socket)
    if (existing && existing.role === 'host') {
      ack?.({ code: existing.lobby.code })
      return
    }
    const code = genCode()
    const lobby: Lobby = {
      code,
      host: socket,
      guest: null,
      lastSnap: null,
      createdAt: Date.now(),
      hostSeenAt: Date.now(),
    }
    lobbies.set(code, lobby)
    console.log(`[lobby] создано ${code} хостом ${socket.id}`)
    ack?.({ code })
  })

  socket.on('lobby:join', (data: { code: string }, ack?: (res: { ok: true; snap: unknown } | { ok: false; error: string }) => void) => {
    const code = String(data?.code ?? '').trim().toUpperCase()
    const lobby = lobbies.get(code)
    if (!lobby) {
      ack?.({ ok: false, error: 'Лобби не найдено — проверьте код' })
      return
    }
    if (lobby.host?.id === socket.id) {
      ack?.({ ok: false, error: 'Это ваше собственное лобби' })
      return
    }
    if (lobby.guest && lobby.guest.id !== socket.id && lobby.guest.connected) {
      ack?.({ ok: false, error: 'В лобби уже два игрока' })
      return
    }
    const rejoin = lobby.guest?.id === socket.id
    lobby.guest = socket
    console.log(`[lobby] ${rejoin ? 'переподключение' : 'подключение'} гостя ${socket.id} → ${code}`)
    ack?.({ ok: true, snap: lobby.lastSnap })
    lobby.host?.emit('guest:joined')
  })

  socket.on('host:snap', (data: { code: string; snap: unknown }) => {
    const lobby = lobbies.get(String(data?.code ?? ''))
    if (!lobby || lobby.host?.id !== socket.id) return
    lobby.lastSnap = data.snap
    lobby.hostSeenAt = Date.now()
    if (lobby.guest?.connected) lobby.guest.emit('snap', data.snap)
  })

  socket.on('guest:cmd', (data: { code: string; cmd: unknown }) => {
    const lobby = lobbies.get(String(data?.code ?? ''))
    if (!lobby || lobby.guest?.id !== socket.id) return
    if (lobby.host?.connected) lobby.host.emit('cmd', data.cmd)
  })

  socket.on('guest:leave', () => {
    const found = lobbyBySocket(socket)
    if (found && found.role === 'guest') {
      found.lobby.guest = null
      found.lobby.host?.emit('guest:left')
      console.log(`[lobby] гость вышел из ${found.lobby.code}`)
    }
  })

  socket.on('host:close', (data: { code: string }) => {
    const lobby = lobbies.get(String(data?.code ?? ''))
    if (!lobby || lobby.host?.id !== socket.id) return
    lobby.guest?.emit('host:left')
    lobbies.delete(lobby.code)
    console.log(`[lobby] ${lobby.code} закрыто хостом`)
  })

  socket.on('disconnect', () => {
    const found = lobbyBySocket(socket)
    if (!found) return
    const { lobby, role } = found
    if (role === 'host') {
      lobby.host = null
      lobby.guest?.emit('host:left')
      console.log(`[lobby] хост отключился, ${lobby.code} закроется по таймауту`)
    } else {
      lobby.guest = null
      lobby.host?.emit('guest:left')
      console.log(`[lobby] гость отвалился от ${lobby.code}`)
    }
  })

  socket.on('error', (error) => {
    console.error(`[socket ${socket.id}]`, error)
  })
})

// Очистка брошенных лобби: нет хоста дольше 60 секунд
setInterval(() => {
  const now = Date.now()
  for (const [code, l] of lobbies) {
    const dead = (!l.host || !l.host.connected) && now - l.hostSeenAt > 60_000
    if (dead) {
      lobbies.delete(code)
      console.log(`[lobby] ${code} удалено по таймауту`)
    }
  }
}, 30_000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`MP lobby service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
