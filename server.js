const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'Obby 3D Multiplayer Server' });
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join_room', (payload = {}) => {
    const roomId = String(payload.room || 'familia-obby').trim().slice(0, 40) || 'familia-obby';
    const playerName = String(payload.name || 'Jugador').trim().slice(0, 20) || 'Jugador';
    const characterId = String(payload.characterId || 'amy');

    if (currentRoom) {
      socket.leave(currentRoom);
      const prevMap = rooms.get(currentRoom);
      if (prevMap) {
        prevMap.delete(socket.id);
        socket.to(currentRoom).emit('player_left', { id: socket.id });
      }
    }

    currentRoom = roomId;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const roomPlayers = rooms.get(roomId);

    const newPlayer = {
      id: socket.id,
      name: playerName,
      characterId,
      x: Number(payload.x) || 52.0,
      y: Number(payload.y) || 4.6,
      z: Number(payload.z) || -21.5,
      yaw: Number(payload.yaw) || -1.89,
      speed: 0,
      onGround: true,
      level: Number(payload.level) || 1
    };

    roomPlayers.set(socket.id, newPlayer);

    const existingPlayers = [];
    for (const [id, p] of roomPlayers.entries()) {
      if (id !== socket.id) existingPlayers.push(p);
    }
    socket.emit('room_state', { room: roomId, players: existingPlayers });

    socket.to(roomId).emit('player_joined', newPlayer);
  });

  socket.on('player_update', (data = {}) => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const roomPlayers = rooms.get(currentRoom);
    const p = roomPlayers.get(socket.id);
    if (!p) return;

    if (typeof data.name === 'string' && data.name.trim()) {
      p.name = data.name.trim().slice(0, 20);
    }
    if (typeof data.characterId === 'string') {
      p.characterId = data.characterId;
    }
    if (typeof data.x === 'number') p.x = data.x;
    if (typeof data.y === 'number') p.y = data.y;
    if (typeof data.z === 'number') p.z = data.z;
    if (typeof data.yaw === 'number') p.yaw = data.yaw;
    if (typeof data.speed === 'number') p.speed = data.speed;
    if (typeof data.onGround === 'boolean') p.onGround = data.onGround;
    if (typeof data.level === 'number') p.level = data.level;

    socket.to(currentRoom).emit('player_moved', p);
  });

  socket.on('disconnect', () => {
    if (!currentRoom || !rooms.has(currentRoom)) return;
    const roomPlayers = rooms.get(currentRoom);
    roomPlayers.delete(socket.id);
    socket.to(currentRoom).emit('player_left', { id: socket.id });
    if (roomPlayers.size === 0) {
      rooms.delete(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor multijugador activo en puerto ${PORT}`);
});
