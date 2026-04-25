'use strict';

const STREAK_LABELS = [
  '',
  'Infected!',
  'Double Infection!',
  'Triple Infection!',
  'Outbreak!',
  'Epidemic!',
  'Pandemic!',
  'Plague Bringer!',
  'UNSTOPPABLE!',
];

function streakLabel(n) {
  return n >= STREAK_LABELS.length ? 'UNSTOPPABLE!' : STREAK_LABELS[n];
}

const DEFAULT_SETTINGS = {
  numHunters: 1,
  gameMode: 'classic',          // classic | infection | freeze
  tagRange: 10,                  // metres
  timeLimit: 10,                 // minutes, 0 = unlimited
  tagImmunity: 3,               // seconds immune after being tagged
  headStart: 10,                // seconds hunters wait before tagging
  locationAccuracy: 'normal',   // precise | normal | approximate | vague
  boundary: null,
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function haversine(a, b) {
  const R = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

class GameManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(hostId, hostName) {
    let code;
    do { code = generateCode(); } while (this.rooms.has(code));

    const room = {
      code,
      hostId,
      players: new Map(),
      settings: { ...DEFAULT_SETTINGS },
      state: 'waiting',
      startTime: null,
      timeLimitTimer: null,
      infectionStreaks: new Map(), // hunterId -> count
    };
    room.players.set(hostId, this._newPlayer(hostId, hostName));
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(roomCode, playerId, playerName) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.state !== 'waiting') return { error: 'Game already in progress' };
    if (room.players.has(playerId)) return { error: 'Already in room' };

    room.players.set(playerId, this._newPlayer(playerId, playerName));
    return { room };
  }

  leaveRoom(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return {};

    room.players.delete(playerId);

    if (room.players.size === 0) {
      this._clearTimer(room);
      this.rooms.delete(roomCode);
      return { roomDeleted: true };
    }

    if (room.hostId === playerId) {
      room.hostId = room.players.keys().next().value;
      return { newHostId: room.hostId, room };
    }

    return { room };
  }

  updateSettings(roomCode, playerId, partial) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== playerId) return { error: 'Only the host can change settings' };
    if (room.state !== 'waiting') return { error: 'Cannot change settings mid-game' };

    const allowed = [
      'numHunters', 'gameMode', 'tagRange', 'timeLimit',
      'tagImmunity', 'headStart', 'locationAccuracy',
    ];
    for (const key of allowed) {
      if (!(key in partial)) continue;
      if (key === 'numHunters') {
        room.settings.numHunters = Math.max(1, Math.floor(Number(partial.numHunters) || 1));
      } else {
        room.settings[key] = partial[key];
      }
    }
    return { settings: room.settings };
  }

  setBoundary(roomCode, playerId, boundary) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== playerId) return { error: 'Only the host can set the boundary' };

    room.settings.boundary = boundary;
    return { boundary };
  }

  startGame(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return { error: 'Room not found' };
    if (room.hostId !== playerId) return { error: 'Only the host can start the game' };
    if (room.state !== 'waiting') return { error: 'Game already started' };
    if (room.players.size < 2) return { error: 'Need at least 2 players to start' };

    const players = Array.from(room.players.values());
    const numHunters = Math.min(room.settings.numHunters, players.length - 1);

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, i) => {
      p.role = i < numHunters ? 'hunter' : 'runner';
      p.isFrozen = false;
      p.immuneUntil = 0;
      p.taggedBy = null;
    });

    room.state = 'playing';
    room.startTime = Date.now();
    room.infectionStreaks = new Map();

    return { room };
  }

  scheduleTimeLimit(roomCode, onExpire) {
    const room = this.rooms.get(roomCode);
    if (!room || room.settings.timeLimit <= 0) return;

    room.timeLimitTimer = setTimeout(() => {
      if (room.state !== 'playing') return;
      room.state = 'ended';
      onExpire({ winners: 'runners', reason: "Time's up — runners win!" });
    }, room.settings.timeLimit * 60 * 1000);
  }

  updatePosition(roomCode, playerId, position) {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== 'playing') return null;

    const player = room.players.get(playerId);
    if (!player) return null;

    if (typeof position.lat !== 'number' || typeof position.lng !== 'number' ||
        position.lat < -90 || position.lat > 90 ||
        position.lng < -180 || position.lng > 180) return null;

    player.position = position;
    player.isOutOfBounds =
      room.settings.boundary != null
        ? haversine(position, room.settings.boundary.center) > room.settings.boundary.radius
        : false;

    return player;
  }

  // Runner reports they were tagged by a specific hunter
  reportTag(roomCode, runnerId, hunterId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== 'playing') return { error: 'Game not in progress' };

    const runner = room.players.get(runnerId);
    const hunter = room.players.get(hunterId);

    if (!runner) return { error: 'Invalid player state' };
    if (runner.role !== 'runner') return { error: 'You are not a runner' };
    if (runner.isFrozen) return { error: 'You are already frozen' };
    if (!hunter || hunter.role !== 'hunter') return { error: 'That player is not a hunter' };
    if (runner.immuneUntil && Date.now() < runner.immuneUntil)
      return { error: 'You are temporarily immune from being tagged' };

    // Validate proximity — use 2× range to account for phone-pull latency
    if (runner.position && hunter.position) {
      const dist = haversine(runner.position, hunter.position);
      const allowedRange = room.settings.tagRange * 2;
      if (dist > allowedRange) {
        return {
          error: `Too far from ${hunter.name} (${Math.round(dist)} m away, need < ${allowedRange} m)`,
        };
      }
    }

    const headStartElapsed = (Date.now() - (room.startTime ?? 0)) / 1000;
    if (headStartElapsed < room.settings.headStart) {
      return {
        error: `Head start still active — ${Math.ceil(room.settings.headStart - headStartElapsed)}s remaining`,
      };
    }

    runner.taggedBy = hunterId;
    runner.immuneUntil = Date.now() + room.settings.tagImmunity * 1000;

    const mode = room.settings.gameMode;
    let streak = null;

    if (mode === 'classic') {
      runner.role = 'hunter';
      hunter.role = 'runner';
    } else if (mode === 'infection') {
      runner.role = 'hunter';
      const prev = room.infectionStreaks.get(hunterId) ?? 0;
      const next = prev + 1;
      room.infectionStreaks.set(hunterId, next);
      streak = { count: next, label: streakLabel(next) };
    } else if (mode === 'freeze') {
      runner.isFrozen = true;
    }

    const gameOver = this._checkGameOver(room);

    return {
      tagged: runner,
      tagger: hunter,
      players: this._publicPlayers(room),
      gameOver,
      streak,
    };
  }

  attemptUnfreeze(roomCode, runnerId, frozenId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.state !== 'playing') return { error: 'Game not in progress' };
    if (room.settings.gameMode !== 'freeze') return { error: 'Not freeze mode' };

    const runner = room.players.get(runnerId);
    const frozen = room.players.get(frozenId);
    if (!runner || runner.role !== 'runner' || runner.isFrozen) return { error: 'You cannot unfreeze anyone' };
    if (!frozen || !frozen.isFrozen) return { error: 'That player is not frozen' };
    if (!runner.position || !frozen.position) return { error: 'Position unknown' };

    const dist = haversine(runner.position, frozen.position);
    if (dist > room.settings.tagRange * 1.5) return { error: 'Too far away to unfreeze' };

    frozen.isFrozen = false;
    frozen.immuneUntil = Date.now() + room.settings.tagImmunity * 1000;

    return { unfrozen: frozen, players: this._publicPlayers(room) };
  }

  endGame(roomCode, winners, reason) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    this._clearTimer(room);
    room.state = 'ended';
    this.rooms.delete(roomCode);
    return { winners, reason };
  }

  getRoomState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    return {
      code: room.code,
      hostId: room.hostId,
      players: this._publicPlayers(room),
      settings: room.settings,
      state: room.state,
      startTime: room.startTime,
    };
  }

  _newPlayer(id, name) {
    return {
      id, name, role: 'runner', position: null,
      isOutOfBounds: false, isFrozen: false, immuneUntil: 0, taggedBy: null,
    };
  }

  _publicPlayers(room) {
    return Array.from(room.players.values()).map(
      ({ id, name, role, position, isOutOfBounds, isFrozen }) => ({
        id, name, role, position, isOutOfBounds, isFrozen,
      })
    );
  }

  _checkGameOver(room) {
    const players = Array.from(room.players.values());
    const mode = room.settings.gameMode;

    if (mode === 'infection') {
      if (players.every(p => p.role === 'hunter')) {
        room.state = 'ended';
        return { winners: 'hunters', reason: 'All runners infected — hunters win!' };
      }
    }

    if (mode === 'freeze') {
      const freeRunners = players.filter(p => p.role === 'runner' && !p.isFrozen);
      if (freeRunners.length === 0) {
        room.state = 'ended';
        return { winners: 'hunters', reason: 'All runners frozen — hunters win!' };
      }
    }

    return null;
  }

  _clearTimer(room) {
    if (room.timeLimitTimer) {
      clearTimeout(room.timeLimitTimer);
      room.timeLimitTimer = null;
    }
  }
}

module.exports = { GameManager };
