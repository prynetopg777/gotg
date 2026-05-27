import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;
const ROWS = 8;
const COLS = 9;
const MAX_CHAT = 80;
const DEFAULT_TURN_SECONDS = 60;

const PIECES = [
  ['5-Star General', '5G', 14, 1],
  ['4-Star General', '4G', 13, 1],
  ['3-Star General', '3G', 12, 1],
  ['2-Star General', '2G', 11, 1],
  ['1-Star General', '1G', 10, 1],
  ['Colonel', 'COL', 9, 1],
  ['Lt. Colonel', 'LTC', 8, 1],
  ['Major', 'MAJ', 7, 1],
  ['Captain', 'CPT', 6, 1],
  ['1st Lieutenant', '1LT', 5, 1],
  ['2nd Lieutenant', '2LT', 4, 1],
  ['Sergeant', 'SGT', 3, 1],
  ['Spy', 'SPY', 15, 2],
  ['Private', 'PVT', 2, 6],
  ['Flag', 'FLG', 1, 1]
];

const createArmy = (owner) =>
  PIECES.flatMap(([name, code, power, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${owner}-${code}-${index + 1}`,
      owner,
      name,
      code,
      power,
      status: 'tray'
    }))
  );

const emptyBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const randomCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const setupZone = (player) => player === 'blue' ? [0, 1, 2] : [5, 6, 7];
const backRow = (player) => player === 'blue' ? 7 : 0;
const opponentOf = (player) => player === 'red' ? 'blue' : 'red';
const squareName = (row, col) => `${String.fromCharCode(65 + col)}${row + 1}`;

const createRoom = (code = randomCode()) => ({
  code,
  players: { red: null, blue: null },
  sessions: { red: null, blue: null },
  ready: { red: false, blue: false },
  armies: { red: createArmy('red'), blue: createArmy('blue') },
  board: emptyBoard(),
  phase: 'lobby',
  turn: 'red',
  winner: null,
  winReason: '',
  pendingFlagWin: null,
  countdownEndsAt: null,
  turnEndsAt: null,
  turnSeconds: DEFAULT_TURN_SECONDS,
  revealAll: false,
  rematchReady: { red: false, blue: false },
  revealMode: 'hidden',
  history: [],
  eliminatedLog: [],
  chat: [],
  lastBattle: null,
  lastMove: null,
  placementMoves: { red: [], blue: [] },
  drawOffer: null,
  stats: {
    challenges: 0,
    captures: { red: 0, blue: 0 },
    spyKills: { red: 0, blue: 0 },
    moves: { red: 0, blue: 0 },
    pieceMoves: {},
    pieceWins: {},
    pieceSurvival: {},
    biggestBluff: null,
    mvp: null
  }
});

const rooms = new Map();
const socketRoom = new Map();
const countdownTimers = new Map();
const turnTimers = new Map();

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function findPiece(room, pieceId) {
  if (typeof pieceId !== 'string') return null;
  return [...room.armies.red, ...room.armies.blue].find((piece) => piece.id === pieceId) || null;
}

function removePiece(room, piece) {
  piece.status = 'captured';
  piece.row = undefined;
  piece.col = undefined;
}

function resetPieceRuntime(piece) {
  piece.status = 'tray';
  piece.row = undefined;
  piece.col = undefined;
}

function comparePieces(attacker, defender) {
  if (attacker.code === 'FLG') return 'defender';
  if (defender.code === 'FLG') return 'attacker';
  if (attacker.code === defender.code) return 'both';
  if (attacker.code === 'SPY' && defender.code === 'PVT') return 'defender';
  if (attacker.code === 'PVT' && defender.code === 'SPY') return 'attacker';
  if (attacker.code === 'SPY' && defender.code !== 'PVT') return 'attacker';
  if (defender.code === 'SPY' && attacker.code !== 'PVT') return 'defender';
  return attacker.power > defender.power ? 'attacker' : 'defender';
}

function addHistory(room, text, kind = 'move') {
  room.history.unshift({ id: Date.now() + Math.random(), text, kind, at: new Date().toLocaleTimeString() });
  room.history = room.history.slice(0, 32);
}

function addEliminated(room, piece, reason) {
  room.eliminatedLog.unshift({
    id: Date.now() + Math.random(),
    owner: piece.owner,
    name: piece.name,
    code: piece.code,
    reason,
    at: new Date().toLocaleTimeString()
  });
  room.eliminatedLog = room.eliminatedLog.slice(0, 20);
}

function publicPiece(piece, viewer, revealAll = false) {
  const visible = revealAll || piece.owner === viewer || piece.status === 'captured';
  return {
    id: piece.id,
    owner: piece.owner,
    status: piece.status,
    row: piece.row,
    col: piece.col,
    visible,
    name: visible ? piece.name : 'Unknown',
    code: visible ? piece.code : '???'
  };
}

function publicBattlePiece(piece, viewer, eliminated) {
  const visible = eliminated || piece.owner === viewer;
  return {
    id: piece.id,
    owner: piece.owner,
    visible,
    eliminated,
    name: visible ? piece.name : 'Unknown',
    code: visible ? piece.code : '???'
  };
}

function publicBattle(room, viewer) {
  if (!room.lastBattle) return null;
  const { attackerId, defenderId, outcome, at } = room.lastBattle;
  const attacker = findPiece(room, attackerId);
  const defender = findPiece(room, defenderId);
  if (!attacker || !defender) return null;
  const attackerLost = outcome === 'defender' || outcome === 'both';
  const defenderLost = outcome === 'attacker' || outcome === 'both';
  const classicReveal = room.revealMode === 'classic';
  return {
    attacker: publicBattlePiece(attacker, viewer, classicReveal || attackerLost),
    defender: publicBattlePiece(defender, viewer, classicReveal || defenderLost),
    outcome,
    at,
    special: room.lastBattle.special || null
  };
}

function pieceCounts(room) {
  return {
    red: room.armies.red.filter((piece) => piece.status === 'board').length,
    blue: room.armies.blue.filter((piece) => piece.status === 'board').length
  };
}

function specialMoment(attacker, defender, outcome) {
  const winner = outcome === 'attacker' ? attacker : outcome === 'defender' ? defender : null;
  const loser = outcome === 'attacker' ? defender : outcome === 'defender' ? attacker : null;
  if (!winner || !loser) return null;
  if (loser.code === 'FLG') return 'flag-capture';
  if (winner.code === 'PVT' && loser.code === 'SPY') return 'private-trap';
  if (winner.code === 'SPY' && loser.power >= 10) return 'spy-assassination';
  if (winner.owner !== attacker.owner) return 'ambush';
  return 'capture';
}

function updateMvp(room) {
  const scores = Object.entries(room.stats.pieceWins).map(([id, wins]) => ({
    id,
    wins,
    moves: room.stats.pieceMoves[id] || 0
  }));
  scores.sort((a, b) => b.wins - a.wins || b.moves - a.moves);
  const best = scores[0];
  if (!best) return;
  const piece = findPiece(room, best.id);
  if (!piece) return;
  room.stats.mvp = { id: piece.id, owner: piece.owner, code: piece.code, name: piece.name, wins: best.wins, moves: best.moves };
}

function recordPieceMove(room, piece) {
  room.stats.pieceMoves[piece.id] = (room.stats.pieceMoves[piece.id] || 0) + 1;
  if (!room.stats.pieceSurvival[piece.id]) {
    room.stats.pieceSurvival[piece.id] = { id: piece.id, owner: piece.owner, code: piece.code, name: piece.name, firstMove: room.stats.moves.red + room.stats.moves.blue };
  }
}

function recordPieceWin(room, winner, loser) {
  room.stats.pieceWins[winner.id] = (room.stats.pieceWins[winner.id] || 0) + 1;
  if (winner.code === 'SPY' && loser.power >= 10) {
    const current = room.stats.biggestBluff;
    if (!current || loser.power > current.loserPower) {
      room.stats.biggestBluff = {
        winnerOwner: winner.owner,
        winnerCode: winner.code,
        loserOwner: loser.owner,
        loserCode: loser.code,
        loserName: loser.name,
        loserPower: loser.power
      };
    }
  }
  updateMvp(room);
}

function longestSurvivor(room) {
  const living = [...room.armies.red, ...room.armies.blue].filter((piece) => piece.status === 'board');
  const moved = living
    .map((piece) => room.stats.pieceSurvival[piece.id] ? { ...room.stats.pieceSurvival[piece.id], currentStatus: piece.status } : null)
    .filter(Boolean)
    .sort((a, b) => a.firstMove - b.firstMove);
  return moved[0] || null;
}

function serializeRoom(room, viewer) {
  const revealAll = room.revealAll && Boolean(room.winner);
  return {
    code: room.code,
    you: viewer,
    opponent: opponentOf(viewer),
    phase: room.phase,
    turn: room.turn,
    ready: room.ready,
    connected: { red: Boolean(room.players.red), blue: Boolean(room.players.blue) },
    winner: room.winner,
    winReason: room.winReason,
    pendingFlagWin: room.pendingFlagWin,
    countdownEndsAt: room.countdownEndsAt,
    turnEndsAt: room.turnEndsAt,
    turnSeconds: room.turnSeconds,
    revealAll: room.revealAll,
    revealMode: room.revealMode,
    rematchReady: room.rematchReady,
    drawOffer: room.drawOffer,
    stats: { ...room.stats, longestSurvivor: longestSurvivor(room) },
    counts: pieceCounts(room),
    board: room.board.map((row) =>
      row.map((pieceId) => pieceId ? publicPiece(findPiece(room, pieceId), viewer, revealAll) : null)
    ),
    tray: room.armies[viewer].filter((piece) => piece.status === 'tray').map((piece) => publicPiece(piece, viewer, revealAll)),
    captured: {
      red: room.armies.red.filter((piece) => piece.status === 'captured').map((piece) => publicPiece(piece, viewer, revealAll)),
      blue: room.armies.blue.filter((piece) => piece.status === 'captured').map((piece) => publicPiece(piece, viewer, revealAll))
    },
    lastBattle: publicBattle(room, viewer),
    lastMove: room.lastMove,
    eliminatedLog: room.eliminatedLog,
    chat: room.chat,
    history: room.history
  };
}

function broadcast(room) {
  for (const player of ['red', 'blue']) {
    const socketId = room.players[player];
    if (socketId) io.to(socketId).emit('state', serializeRoom(room, player));
  }
}

function cancelTurnTimer(room) {
  const timer = turnTimers.get(room.code);
  if (timer) clearTimeout(timer);
  turnTimers.delete(room.code);
  room.turnEndsAt = null;
}

function scheduleTurnTimer(room) {
  cancelTurnTimer(room);
  if (room.phase !== 'playing' || room.winner) return;
  room.turnEndsAt = Date.now() + room.turnSeconds * 1000;
  turnTimers.set(room.code, setTimeout(() => {
    if (room.phase !== 'playing' || room.winner) return;
    const timedOut = room.turn;
    addHistory(room, `${timedOut.toUpperCase()} timed out and passed.`, 'system');
    room.turn = opponentOf(timedOut);
    scheduleTurnTimer(room);
    broadcast(room);
  }, room.turnSeconds * 1000));
}

function cancelCountdown(room) {
  const timer = countdownTimers.get(room.code);
  if (timer) clearTimeout(timer);
  countdownTimers.delete(room.code);
  room.countdownEndsAt = null;
  if (room.phase === 'countdown') room.phase = 'setup';
}

function beginCountdown(room) {
  cancelCountdown(room);
  room.phase = 'countdown';
  room.countdownEndsAt = Date.now() + 3000;
  addHistory(room, 'Both armies ready. Battle starts in 3.', 'system');
  countdownTimers.set(room.code, setTimeout(() => {
    if (room.ready.red && room.ready.blue && room.players.red && room.players.blue && !room.winner) {
      room.phase = 'playing';
      room.turn = 'red';
      room.countdownEndsAt = null;
      addHistory(room, 'Battle started. Red moves first.', 'system');
      scheduleTurnTimer(room);
      broadcast(room);
    } else {
      cancelCountdown(room);
      broadcast(room);
    }
  }, 3000));
}

function resetPlacement(room, player) {
  cancelCountdown(room);
  cancelTurnTimer(room);
  for (const piece of room.armies[player]) {
    if (piece.status === 'board') {
      room.board[piece.row][piece.col] = null;
      piece.status = 'tray';
      piece.row = undefined;
      piece.col = undefined;
    }
  }
  room.placementMoves[player] = [];
  room.ready[player] = false;
  room.phase = 'setup';
}

function validateSetup(room, player) {
  const placed = room.armies[player].filter((piece) => piece.status === 'board');
  if (placed.length !== 21) return 'Place all 21 pieces before readying up.';
  const legalRows = setupZone(player);
  if (placed.some((piece) => !legalRows.includes(piece.row))) return 'Pieces must stay inside your first three rows.';
  const occupied = new Set(placed.map((piece) => `${piece.row}:${piece.col}`));
  if (occupied.size !== 21) return 'Placement has overlapping pieces. Reposition and try again.';
  return null;
}

function legalMoveExists(room, player) {
  for (const piece of room.armies[player].filter((armyPiece) => armyPiece.status === 'board')) {
    for (const [row, col] of [[piece.row - 1, piece.col], [piece.row + 1, piece.col], [piece.row, piece.col - 1], [piece.row, piece.col + 1]]) {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) continue;
      const target = room.board[row][col] ? findPiece(room, room.board[row][col]) : null;
      if (!target || target.owner !== player) return true;
    }
  }
  return false;
}

function finishMove(room, movingPlayer) {
  if (room.winner) return;
  const pending = room.pendingFlagWin;
  if (pending && pending.player !== movingPlayer) {
    const flag = room.armies[pending.player].find((piece) => piece.code === 'FLG');
    if (flag?.status === 'board' && flag.row === backRow(pending.player)) {
      room.winner = pending.player;
      room.winReason = `${pending.player.toUpperCase()} flag survived on the enemy back row.`;
      addHistory(room, `${pending.player.toUpperCase()} wins by flag breakthrough.`, 'win');
      cancelTurnTimer(room);
      return;
    }
  }
  const next = opponentOf(movingPlayer);
  room.turn = next;
  if (!legalMoveExists(room, next)) {
    addHistory(room, `${next.toUpperCase()} has no legal moves and passes.`, 'system');
    room.turn = movingPlayer;
  }
  scheduleTurnTimer(room);
}

function randomizePlacement(room, player, strategy = 'balanced') {
  resetPlacement(room, player);
  const squares = setupZone(player).flatMap((row) => Array.from({ length: COLS }, (_, col) => ({ row, col })));
  for (let i = squares.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [squares[i], squares[j]] = [squares[j], squares[i]];
  }
  const ordered = [...room.armies[player]];
  const homeRows = setupZone(player);
  const frontRow = player === 'red' ? Math.min(...homeRows) : Math.max(...homeRows);
  const backHomeRow = player === 'red' ? Math.max(...homeRows) : Math.min(...homeRows);
  const preferred = (piece) => {
    if (strategy === 'aggressive' && ['SPY', '5G', '4G', '3G'].includes(piece.code)) return 0;
    if (strategy === 'defensive' && ['FLG', 'PVT', 'PVT'].includes(piece.code)) return 0;
    if (piece.code === 'FLG') return 2;
    return 1;
  };
  ordered.sort((a, b) => preferred(a) - preferred(b));
  const squareScore = (square) => {
    if (strategy === 'aggressive') return Math.abs(square.row - frontRow);
    if (strategy === 'defensive') return Math.abs(square.row - backHomeRow);
    return Math.abs(square.col - 4) + Math.random();
  };
  squares.sort((a, b) => squareScore(a) - squareScore(b));
  ordered.forEach((piece, index) => {
    const square = squares[index];
    piece.status = 'board';
    piece.row = square.row;
    piece.col = square.col;
    room.board[square.row][square.col] = piece.id;
    room.placementMoves[player].push({ pieceId: piece.id, from: null, to: square });
  });
  room.ready[player] = false;
}

function attachPlayer(socket, room, player, clientId) {
  if (room.players[player] && room.players[player] !== socket.id) {
    io.to(room.players[player]).emit('notice', 'Your seat was opened in another tab.');
  }
  room.players[player] = socket.id;
  if (clientId) room.sessions[player] = String(clientId);
  socketRoom.set(socket.id, { code: room.code, player });
  socket.join(room.code);
  if (room.phase === 'playing' && room.players.red && room.players.blue) scheduleTurnTimer(room);
}

function resetRoomForRematch(room) {
  cancelCountdown(room);
  cancelTurnTimer(room);
  room.ready = { red: false, blue: false };
  room.armies = { red: createArmy('red'), blue: createArmy('blue') };
  room.board = emptyBoard();
  room.phase = 'setup';
  room.turn = 'red';
  room.winner = null;
  room.winReason = '';
  room.pendingFlagWin = null;
  room.countdownEndsAt = null;
  room.turnEndsAt = null;
  room.revealAll = false;
  room.rematchReady = { red: false, blue: false };
  room.history = [];
  room.eliminatedLog = [];
  room.lastBattle = null;
  room.lastMove = null;
  room.placementMoves = { red: [], blue: [] };
  room.drawOffer = null;
  room.stats = {
    challenges: 0,
    captures: { red: 0, blue: 0 },
    spyKills: { red: 0, blue: 0 },
    moves: { red: 0, blue: 0 },
    pieceMoves: {},
    pieceWins: {},
    pieceSurvival: {},
    biggestBluff: null,
    mvp: null
  };
  addHistory(room, 'Rematch ready. Redeploy your army.', 'system');
}

const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 10_000
});

io.on('connection', (socket) => {
  socket.emit('connected', { id: socket.id });

  socket.on('createRoom', ({ clientId } = {}, ack) => {
    let code = randomCode();
    while (rooms.has(code)) code = randomCode();
    const room = createRoom(code);
    room.phase = 'setup';
    attachPlayer(socket, room, 'red', clientId);
    rooms.set(code, room);
    ack?.({ ok: true, code, player: 'red' });
    broadcast(room);
  });

  socket.on('joinRoom', ({ code, clientId } = {}, ack) => {
    const room = rooms.get(normalizeCode(code));
    if (!room) return ack?.({ ok: false, error: 'Room not found.' });
    if (room.players.blue && room.players.blue !== socket.id) return ack?.({ ok: false, error: 'Room is full.' });
    attachPlayer(socket, room, 'blue', clientId);
    addHistory(room, 'Blue joined the command table.', 'system');
    ack?.({ ok: true, code: room.code, player: 'blue' });
    broadcast(room);
  });

  socket.on('reconnectRoom', ({ code, player, clientId } = {}, ack) => {
    const room = rooms.get(normalizeCode(code));
    if (!room || !['red', 'blue'].includes(player)) return ack?.({ ok: false, error: 'Saved room is no longer active.' });
    if (!clientId || room.sessions[player] !== String(clientId)) return ack?.({ ok: false, error: 'Saved seat could not be verified.' });
    attachPlayer(socket, room, player, clientId);
    addHistory(room, `${player.toUpperCase()} reconnected.`, 'system');
    ack?.({ ok: true, code: room.code, player });
    broadcast(room);
  });

  socket.on('placePiece', ({ pieceId, row, col } = {}, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || !['setup', 'countdown'].includes(room.phase)) return ack?.({ ok: false, error: 'Placement is closed.' });
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
      return ack?.({ ok: false, error: 'Invalid square.' });
    }
    if (!setupZone(meta.player).includes(row)) return ack?.({ ok: false, error: 'Use your first three rows.' });
    const piece = findPiece(room, pieceId);
    if (!piece || piece.owner !== meta.player) return ack?.({ ok: false, error: 'That piece is not yours.' });
    if (room.board[row][col] && room.board[row][col] !== pieceId) return ack?.({ ok: false, error: 'That square is occupied.' });
    cancelCountdown(room);
    const from = piece.status === 'board' ? { row: piece.row, col: piece.col } : null;
    if (from) room.board[from.row][from.col] = null;
    room.board[row][col] = piece.id;
    piece.status = 'board';
    piece.row = row;
    piece.col = col;
    room.ready[meta.player] = false;
    room.placementMoves[meta.player].push({ pieceId: piece.id, from, to: { row, col } });
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('undoPlacement', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || !['setup', 'countdown'].includes(room.phase)) return ack?.({ ok: false, error: 'Undo is only available during placement.' });
    const last = room.placementMoves[meta.player].pop();
    if (!last) return ack?.({ ok: false, error: 'No placement move to undo.' });
    cancelCountdown(room);
    const piece = findPiece(room, last.pieceId);
    if (!piece || piece.owner !== meta.player) return ack?.({ ok: false, error: 'Could not undo that placement.' });
    if (piece.status === 'board') room.board[piece.row][piece.col] = null;
    if (last.from) {
      room.board[last.from.row][last.from.col] = piece.id;
      piece.status = 'board';
      piece.row = last.from.row;
      piece.col = last.from.col;
    } else {
      piece.status = 'tray';
      piece.row = undefined;
      piece.col = undefined;
    }
    room.ready[meta.player] = false;
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('randomizePlacement', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || !['setup', 'countdown'].includes(room.phase)) return ack?.({ ok: false, error: 'Randomize is only available during placement.' });
    randomizePlacement(room, meta.player, _?.strategy);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('updateSettings', ({ turnSeconds, revealMode } = {}, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || !['setup', 'countdown'].includes(room.phase)) return ack?.({ ok: false, error: 'Settings can only change before battle.' });
    if (Number.isInteger(turnSeconds) && turnSeconds >= 15 && turnSeconds <= 180) room.turnSeconds = turnSeconds;
    if (['hidden', 'classic'].includes(revealMode)) room.revealMode = revealMode;
    cancelCountdown(room);
    room.ready.red = false;
    room.ready.blue = false;
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('resetPlacement', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    resetPlacement(room, meta.player);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('ready', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room.players.red || !room.players.blue) return ack?.({ ok: false, error: 'Waiting for both players to connect.' });
    const error = validateSetup(room, meta.player);
    if (error) return ack?.({ ok: false, error });
    room.ready[meta.player] = true;
    addHistory(room, `${meta.player.toUpperCase()} locked formation.`, 'system');
    if (room.ready.red && room.ready.blue) beginCountdown(room);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('movePiece', ({ pieceId, row, col } = {}, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || room.phase !== 'playing' || room.winner) return ack?.({ ok: false, error: 'The game is not active.' });
    if (!room.players.red || !room.players.blue) return ack?.({ ok: false, error: 'Opponent is disconnected. Board is paused.' });
    if (room.turn !== meta.player) return ack?.({ ok: false, error: 'Wait for your turn.' });
    const piece = findPiece(room, pieceId);
    if (!piece || piece.owner !== meta.player || piece.status !== 'board') return ack?.({ ok: false, error: 'Select one of your deployed pieces.' });
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
      return ack?.({ ok: false, error: 'Invalid destination.' });
    }
    const distance = Math.abs(piece.row - row) + Math.abs(piece.col - col);
    if (distance !== 1) return ack?.({ ok: false, error: 'Move one square orthogonally. No diagonals, no jumping.' });
    const targetId = room.board[row][col];
    const target = targetId ? findPiece(room, targetId) : null;
    if (target?.owner === meta.player) return ack?.({ ok: false, error: 'Your own piece blocks that square.' });

    const from = { row: piece.row, col: piece.col };
    room.lastBattle = null;
    room.lastMove = { player: meta.player, from, to: { row, col }, capture: Boolean(target) };
    room.drawOffer = null;
    room.board[piece.row][piece.col] = null;
    room.stats.moves[meta.player] += 1;
    recordPieceMove(room, piece);

    if (!target) {
      room.board[row][col] = piece.id;
      piece.row = row;
      piece.col = col;
      if (piece.code === 'FLG' && row === backRow(piece.owner)) {
        room.pendingFlagWin = { player: piece.owner, row, col };
        addHistory(room, `${meta.player.toUpperCase()}: ${squareName(from.row, from.col)}-${squareName(row, col)}. Flag breakthrough threat.`, 'move');
      } else if (room.pendingFlagWin?.player === piece.owner && piece.code === 'FLG') {
        room.pendingFlagWin = null;
        addHistory(room, `${meta.player.toUpperCase()}: ${squareName(from.row, from.col)}-${squareName(row, col)}.`, 'move');
      } else {
        addHistory(room, `${meta.player.toUpperCase()}: ${squareName(from.row, from.col)}-${squareName(row, col)}.`, 'move');
      }
      finishMove(room, meta.player);
      ack?.({ ok: true });
      return broadcast(room);
    }

    const outcome = comparePieces(piece, target);
    room.stats.challenges += 1;
    room.lastBattle = { attackerId: piece.id, defenderId: target.id, outcome, at: { row, col } };
    room.lastBattle.special = specialMoment(piece, target, outcome);

    if (target.code === 'FLG' && outcome === 'attacker') {
      room.winner = piece.owner;
      room.winReason = `${piece.owner.toUpperCase()} captured the enemy Flag.`;
    }

    if (outcome === 'attacker') {
      removePiece(room, target);
      addEliminated(room, target, `Eliminated at ${squareName(row, col)}`);
      room.stats.captures[piece.owner] += 1;
      if (piece.code === 'SPY') room.stats.spyKills[piece.owner] += 1;
      recordPieceWin(room, piece, target);
      room.board[row][col] = piece.id;
      piece.row = row;
      piece.col = col;
      addHistory(room, `${meta.player.toUpperCase()}: ${squareName(from.row, from.col)}x${squareName(row, col)}. ${target.owner.toUpperCase()} ${target.code} eliminated.`, 'capture');
    } else if (outcome === 'defender') {
      room.board[row][col] = target.id;
      removePiece(room, piece);
      addEliminated(room, piece, `Eliminated at ${squareName(row, col)}`);
      room.stats.captures[target.owner] += 1;
      if (target.code === 'SPY') room.stats.spyKills[target.owner] += 1;
      recordPieceWin(room, target, piece);
      addHistory(room, `${meta.player.toUpperCase()}: ${squareName(from.row, from.col)}x${squareName(row, col)}. ${piece.owner.toUpperCase()} ${piece.code} eliminated.`, 'capture');
    } else {
      room.board[row][col] = null;
      removePiece(room, piece);
      removePiece(room, target);
      addEliminated(room, piece, `Mutual elimination at ${squareName(row, col)}`);
      addEliminated(room, target, `Mutual elimination at ${squareName(row, col)}`);
      room.stats.captures.red += 1;
      room.stats.captures.blue += 1;
      addHistory(room, `${meta.player.toUpperCase()}: ${squareName(from.row, from.col)}x${squareName(row, col)}. Both pieces eliminated.`, 'capture');
    }

    if (room.pendingFlagWin) {
      const flag = room.armies[room.pendingFlagWin.player].find((armyPiece) => armyPiece.code === 'FLG');
      if (flag?.status !== 'board' || flag.row !== backRow(flag.owner)) room.pendingFlagWin = null;
    }

    if (room.winner) cancelTurnTimer(room);
    if (!room.winner) finishMove(room, meta.player);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('reaction', ({ text } = {}, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 32);
    if (!clean) return ack?.({ ok: false, error: 'Reaction is empty.' });
    room.chat.unshift({ id: Date.now() + Math.random(), player: meta.player, text: clean, at: new Date().toLocaleTimeString(), reaction: true });
    room.chat = room.chat.slice(0, 24);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('revealAll', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room?.winner) return ack?.({ ok: false, error: 'Reveal All is available after the game.' });
    room.revealAll = true;
    addHistory(room, 'Final board revealed for post-game review.', 'system');
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('rematch', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room?.winner) return ack?.({ ok: false, error: 'Finish this game before rematching.' });
    room.rematchReady[meta.player] = true;
    addHistory(room, `${meta.player.toUpperCase()} wants a rematch.`, 'system');
    if (room.rematchReady.red && room.rematchReady.blue) resetRoomForRematch(room);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('resign', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || room.winner) return ack?.({ ok: false, error: 'Game is already over.' });
    room.winner = opponentOf(meta.player);
    room.winReason = `${meta.player.toUpperCase()} resigned.`;
    addHistory(room, room.winReason, 'win');
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('offerDraw', (_, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    if (!room || room.winner) return ack?.({ ok: false, error: 'Game is already over.' });
    room.drawOffer = meta.player;
    addHistory(room, `${meta.player.toUpperCase()} offered a draw.`, 'system');
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('chatMessage', ({ text } = {}, ack) => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return ack?.({ ok: false, error: 'Join a room first.' });
    const room = rooms.get(meta.code);
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT);
    if (!clean) return ack?.({ ok: false, error: 'Message is empty.' });
    room.chat.unshift({ id: Date.now() + Math.random(), player: meta.player, text: clean, at: new Date().toLocaleTimeString() });
    room.chat = room.chat.slice(0, 24);
    ack?.({ ok: true });
    broadcast(room);
  });

  socket.on('disconnect', () => {
    const meta = socketRoom.get(socket.id);
    if (!meta) return;
    const room = rooms.get(meta.code);
    if (!room) return;
    if (room.players[meta.player] === socket.id) room.players[meta.player] = null;
    if (['setup', 'countdown'].includes(room.phase)) {
      room.ready[meta.player] = false;
      cancelCountdown(room);
    }
    if (room.phase === 'playing') cancelTurnTimer(room);
    addHistory(room, `${meta.player.toUpperCase()} disconnected. Their seat can resume from the same browser.`, 'system');
    broadcast(room);
    socketRoom.delete(socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Game of the Generals server listening on http://0.0.0.0:${PORT}`);
});
