import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return socket
}

export function joinBoard(boardId: string) {
  getSocket().emit('board:join', boardId)
}

export function leaveBoard(boardId: string) {
  getSocket().emit('board:leave', boardId)
}

export function onEvent<T = any>(event: string, cb: (data: T) => void): () => void {
  const s = getSocket()
  s.on(event, cb)
  return () => { s.off(event, cb) }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
