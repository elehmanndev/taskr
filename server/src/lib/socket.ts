import { Server } from 'socket.io'
import type { FastifyInstance } from 'fastify'

let io: Server

export function initSocket(app: FastifyInstance) {
  // Attach to Fastify's underlying HTTP server
  io = new Server((app.server as any), {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  })

  io.on('connection', (socket) => {
    // Client joins a board room on connect
    socket.on('board:join', (boardId: string) => {
      socket.join(`board:${boardId}`)
    })

    socket.on('board:leave', (boardId: string) => {
      socket.leave(`board:${boardId}`)
    })

    // Presence — broadcast who's viewing the board
    socket.on('board:presence', ({ boardId, user }: any) => {
      socket.to(`board:${boardId}`).emit('presence:update', {
        socketId: socket.id,
        user,
        online: true,
      })
    })

    socket.on('disconnect', () => {
      io.emit('presence:offline', { socketId: socket.id })
    })
  })

  return io
}

export function emitToBoard(boardId: string, event: string, data: any) {
  if (!io) return
  io.to(`board:${boardId}`).emit(event, data)
}
