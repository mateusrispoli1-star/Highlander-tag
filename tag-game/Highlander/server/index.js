'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GameManager } = require('./gameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const gm = new GameManager();

// socketId -> roomCode
const playerRoom = new Map();
// socketId -> last position update timestamp for rate-limiting (max 10/sec)
const positionLastSent = new Map();

io.on('connection', (socket) => {
  console.log('[+]', socket.id);

  // ── Lobby ──────────────────────────────────────────────────────────────────

  socket.on('create-room', ({ name }, cb) => {
    if (playerRoom.has(socket.id)) return cb?.({ error: 'Already in a room' });
    const room = gm.createRoom(socket.id, name);
    socket.join(room.code);
    playerRoom.set(socket.id, room.code);
    cb({ code: room.code, roomState: gm.getRoomState(room.code) });
  });

  socket.on('join-room', ({ code, name }, cb) => {
    if (playerRoom.has(socket.id)) return cb?.({ error: 'Already in a room' });
    const result = gm.joinRoom(code, socket.id, name);
    if (result.error) return cb({ error: result.error });
    socket.join(code);
    playerRoom.set(socket.id, code);
    socket.to(code).emit('player-joined', {
      player: { id: socket.id, name, role: 'runner', position: null, isOutOfBounds: false, isFrozen: false },
    });
    cb({ roomState: gm.getRoomState(code) });
  });

  socket.on('get-room-state', ({ code }, cb) => {
    const state = gm.getRoomState(code);
    if (!state) return cb({ error: 'Room not found' });
    cb({ roomState: state });
  });

  socket.on('update-settings', ({ settings }, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });
    const result = gm.updateSettings(code, socket.id, settings);
    if (result.error) return cb?.({ error: result.error });
    io.to(code).emit('settings-updated', { settings: result.settings });
    cb?.({ ok: true });
  });

  socket.on('set-boundary', ({ boundary }, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });
    const result = gm.setBoundary(code, socket.id, boundary);
    if (result.error) return cb?.({ error: result.error });
    io.to(code).emit('boundary-set', { boundary: result.boundary });
    cb?.({ ok: true });
  });

  // ── Game start ─────────────────────────────────────────────────────────────

  socket.on('start-game', ({}, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });
    const result = gm.startGame(code, socket.id);
    if (result.error) return cb?.({ error: result.error });

    const { room } = result;

    for (const player of room.players.values()) {
      io.to(player.id).emit('game-started', {
        role: player.role,
        players: gm.getRoomState(code).players,
        settings: room.settings,
        startTime: room.startTime,
      });
    }

    gm.scheduleTimeLimit(code, (outcome) => {
      gm.endGame(code, outcome.winners, outcome.reason);
      io.to(code).emit('game-over', outcome);
    });

    cb?.({ ok: true });
  });

  // ── In-game ────────────────────────────────────────────────────────────────

  socket.on('update-position', ({ lat, lng }) => {
    const now = Date.now();
    if (now - (positionLastSent.get(socket.id) ?? 0) < 100) return;
    positionLastSent.set(socket.id, now);
    const code = playerRoom.get(socket.id);
    if (!code) return;

    const player = gm.updatePosition(code, socket.id, { lat, lng });
    if (!player) return;

    // Hunters stay invisible — only broadcast runner positions
    if (player.role === 'runner') {
      io.to(code).emit('position-update', {
        playerId: socket.id,
        lat,
        lng,
        isOutOfBounds: player.isOutOfBounds,
        isFrozen: player.isFrozen,
      });
    }

    if (player.isOutOfBounds) socket.emit('out-of-bounds');
  });

  // Runner presses "TAGGED!" and names the hunter who got them
  socket.on('report-tag', ({ hunterId }, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });

    const result = gm.reportTag(code, socket.id, hunterId);
    if (result.error) return cb?.({ error: result.error });

    io.to(code).emit('player-tagged', {
      taggedPlayerId: result.tagged.id,
      taggedName: result.tagged.name,
      taggerId: result.tagger.id,
      taggerName: result.tagger.name,
      players: result.players,
    });

    if (result.streak) {
      io.to(code).emit('infection-streak', {
        hunterId: result.tagger.id,
        hunterName: result.tagger.name,
        count: result.streak.count,
        label: result.streak.label,
      });
    }

    if (result.gameOver) {
      gm.endGame(code, result.gameOver.winners, result.gameOver.reason);
      io.to(code).emit('game-over', result.gameOver);
    }

    cb?.({ ok: true });
  });

  socket.on('attempt-unfreeze', ({ targetId }, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });
    const result = gm.attemptUnfreeze(code, socket.id, targetId);
    if (result.error) return cb?.({ error: result.error });

    io.to(code).emit('player-unfrozen', {
      unfrozenPlayerId: result.unfrozen.id,
      players: result.players,
    });
    cb?.({ ok: true });
  });

  socket.on('end-game', ({}, cb) => {
    const code = playerRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });
    const room = gm.rooms.get(code);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Only the host can end the game' });
    gm.endGame(code, null, 'Host ended the game');
    io.to(code).emit('game-over', { winners: null, reason: 'Host ended the game' });
    cb?.({ ok: true });
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log('[-]', socket.id);
    positionLastSent.delete(socket.id);
    const code = playerRoom.get(socket.id);
    if (!code) return;
    playerRoom.delete(socket.id);
    const result = gm.leaveRoom(code, socket.id);
    if (!result || result.roomDeleted) return;
    io.to(code).emit('player-left', {
      playerId: socket.id,
      newHostId: result.newHostId ?? null,
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Tag server listening on :${PORT}`);
});
