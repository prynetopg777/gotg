import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import {
  Flag,
  RefreshCcw,
  Shield,
  Swords,
  Handshake,
  Skull,
  Undo2,
  Shuffle,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare,
  HelpCircle,
  Sun,
  Moon,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Timer,
  Trophy,
  Eye,
  RotateCcw,
  Zap
} from 'lucide-react';
import './styles.css';

type Player = 'red' | 'blue';
type Phase = 'lobby' | 'setup' | 'countdown' | 'playing';
type AnimationSpeed = 'calm' | 'normal' | 'fast';

type Piece = {
  id: string;
  owner: Player;
  status: 'tray' | 'board' | 'captured';
  row?: number;
  col?: number;
  visible: boolean;
  name: string;
  code: string;
};

type BattlePiece = Pick<Piece, 'id' | 'owner' | 'visible' | 'name' | 'code'> & { eliminated: boolean };
type Battle = {
  attacker: BattlePiece;
  defender: BattlePiece;
  outcome: 'attacker' | 'defender' | 'both';
  at: { row: number; col: number };
  special: null | 'flag-capture' | 'private-trap' | 'spy-assassination' | 'ambush' | 'capture';
};

type GameState = {
  code: string;
  you: Player;
  opponent: Player;
  phase: Phase;
  turn: Player;
  ready: Record<Player, boolean>;
  connected: Record<Player, boolean>;
  winner: Player | null;
  winReason: string;
  pendingFlagWin: null | { player: Player; row: number; col: number };
  countdownEndsAt: number | null;
  turnEndsAt: number | null;
  turnSeconds: number;
  revealAll: boolean;
  revealMode: 'hidden' | 'classic';
  rematchReady: Record<Player, boolean>;
  drawOffer: Player | null;
  counts: Record<Player, number>;
  stats: {
    challenges: number;
    captures: Record<Player, number>;
    spyKills: Record<Player, number>;
    moves: Record<Player, number>;
    biggestBluff: null | { winnerOwner: Player; winnerCode: string; loserOwner: Player; loserCode: string; loserName: string; loserPower: number };
    mvp: null | { id: string; owner: Player; code: string; name: string; wins: number; moves: number };
    longestSurvivor: null | { id: string; owner: Player; code: string; name: string; firstMove: number };
  };
  board: (Piece | null)[][];
  tray: Piece[];
  captured: Record<Player, Piece[]>;
  lastBattle: Battle | null;
  lastMove: null | { player: Player; from: { row: number; col: number }; to: { row: number; col: number }; capture: boolean };
  eliminatedLog: { id: number; owner: Player; name: string; code: string; reason: string; at: string }[];
  chat: { id: number; player: Player; text: string; at: string; reaction?: boolean }[];
  history: { id: number; text: string; kind: string; at: string }[];
};

type Ack = { ok: boolean; error?: string; code?: string; player?: Player };

const socketUrl = import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
const socket: Socket = io(socketUrl, { autoConnect: true });
const rows = Array.from({ length: 8 }, (_, row) => row);
const cols = Array.from({ length: 9 }, (_, col) => col);
const columns = 'ABCDEFGHI'.split('');
const hierarchy = [
  ['5G', '5-Star General', 'Highest normal rank'],
  ['4G', '4-Star General', 'Loses only to 5G or Spy'],
  ['3G', '3-Star General', 'Senior general'],
  ['2G', '2-Star General', 'Mid general'],
  ['1G', '1-Star General', 'Junior general'],
  ['COL', 'Colonel', 'Line officer'],
  ['LTC', 'Lt. Colonel', 'Line officer'],
  ['MAJ', 'Major', 'Line officer'],
  ['CPT', 'Captain', 'Line officer'],
  ['1LT', '1st Lieutenant', 'Line officer'],
  ['2LT', '2nd Lieutenant', 'Line officer'],
  ['SGT', 'Sergeant', 'Lowest officer rank'],
  ['SPY', 'Spy', 'Beats all except Private'],
  ['PVT', 'Private', 'Beats Spy only'],
  ['FLG', 'Flag', 'Loses to every piece']
];

function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for browsers that don't support randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getClientId() {
  const existing = window.localStorage.getItem('gotg-client-id');
  if (existing) return existing;
  const next = generateUUID();
  window.localStorage.setItem('gotg-client-id', next);
  return next;
}

const clientId = getClientId();

function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [status, setStatus] = useState('Create a room or join your opponent.');
  const [tutorialOpen, setTutorialOpen] = useState(() => window.localStorage.getItem('gotg-tutorial-seen') !== 'yes');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [soundOn, setSoundOn] = useState(() => window.localStorage.getItem('gotg-sound') !== 'off');
  const [lightMode, setLightMode] = useState(false);
  const [colorblind, setColorblind] = useState(false);
  const [textRanks, setTextRanks] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>('normal');
  const [zoom, setZoom] = useState(1);
  const [placementStrategy, setPlacementStrategy] = useState<'balanced' | 'aggressive' | 'defensive'>('balanced');
  const previousState = useRef<GameState | null>(null);
  const alertedWinner = useRef<string | null>(null);

  useEffect(() => {
    socket.on('state', (nextState: GameState) => {
      const prior = previousState.current;
      setState(nextState);
      setRoomCode(nextState.code);
      setStatus(statusFor(nextState));

      if (soundOn && prior) {
        if (nextState.winner && !prior.winner) playTone('win');
        else if (nextState.lastBattle && JSON.stringify(nextState.lastBattle) !== JSON.stringify(prior.lastBattle)) {
          playTone(nextState.lastBattle.special === 'flag-capture' ? 'win' : 'capture');
        }
        else if (nextState.lastMove && JSON.stringify(nextState.lastMove) !== JSON.stringify(prior.lastMove)) playTone('move');
      }

      if (nextState.winner && nextState.winner !== nextState.you && alertedWinner.current !== nextState.code) {
        alertedWinner.current = nextState.code;
        window.setTimeout(() => window.alert('bading ka'), 250);
      }
      previousState.current = nextState;
    });
    socket.on('notice', (message: string) => setStatus(message));
    return () => {
      socket.off('state');
      socket.off('notice');
    };
  }, [soundOn]);

  useEffect(() => {
    const saved = JSON.parse(window.localStorage.getItem('gotg-seat') || 'null') as null | { code: string; player: Player };
    if (!saved) return;
    socket.emit('reconnectRoom', { ...saved, clientId }, (ack: Ack) => {
      if (!ack?.ok) return;
      setRoomCode(ack.code || saved.code);
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem('gotg-sound', soundOn ? 'on' : 'off');
  }, [soundOn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') setZoom((value) => value === 1 ? 0.86 : 1);
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const orientedRows = useMemo(() => state?.you === 'red' ? rows : [...rows].reverse(), [state?.you]);
  const setupRows = useMemo(() => state?.you === 'red' ? [5, 6, 7] : [0, 1, 2], [state?.you]);
  const selectedPiece = state ? findPiece(state, selected) : null;
  const placedCount = state ? 21 - state.tray.length : 0;
  const countdown = useCountdown(state?.countdownEndsAt || null);
  const turnCountdown = useCountdown(state?.turnEndsAt || null);

  const legalMoves = useMemo(() => {
    if (!state || !selectedPiece || selectedPiece.owner !== state.you || selectedPiece.status !== 'board') return new Set<string>();
    if (state.phase === 'setup' || state.phase === 'countdown') return new Set(setupRows.flatMap((row) => cols.map((col) => `${row}:${col}`)));
    if (state.phase !== 'playing' || state.turn !== state.you) return new Set<string>();
    return new Set([
      [selectedPiece.row! - 1, selectedPiece.col!],
      [selectedPiece.row! + 1, selectedPiece.col!],
      [selectedPiece.row!, selectedPiece.col! - 1],
      [selectedPiece.row!, selectedPiece.col! + 1]
    ].filter(([row, col]) => row >= 0 && row < 8 && col >= 0 && col < 9)
      .filter(([row, col]) => state.board[row][col]?.owner !== state.you)
      .map(([row, col]) => `${row}:${col}`));
  }, [state, selectedPiece, setupRows]);

  function emit(event: string, payload = {}) {
    socket.emit(event, payload, (ack: Ack) => {
      if (!ack?.ok) setStatus(ack?.error || 'Command failed.');
      else setStatus('Command accepted.');
    });
  }

  function createRoom() {
    socket.emit('createRoom', { clientId }, (ack: Ack) => {
      if (!ack.ok) return setStatus(ack.error || 'Could not create room.');
      setRoomCode(ack.code || '');
      if (ack.code && ack.player) window.localStorage.setItem('gotg-seat', JSON.stringify({ code: ack.code, player: ack.player }));
    });
  }

  function joinRoom() {
    socket.emit('joinRoom', { code: roomCode.trim().toUpperCase(), clientId }, (ack: Ack) => {
      if (!ack.ok) return setStatus(ack.error || 'Could not join room.');
      setRoomCode(ack.code || roomCode);
      if (ack.code && ack.player) window.localStorage.setItem('gotg-seat', JSON.stringify({ code: ack.code, player: ack.player }));
    });
  }

  function handleSquare(row: number, col: number) {
    if (!state) return;
    const piece = state.board[row][col];
    if (state.phase === 'setup' || state.phase === 'countdown') {
      const pieceId = dragId || selected;
      if (pieceId) emit('placePiece', { pieceId, row, col });
      return;
    }
    if (piece?.owner === state.you) {
      setSelected(piece.id);
      return;
    }
    if (selected && legalMoves.has(`${row}:${col}`)) {
      if (selectedPiece?.code === 'FLG' && !window.confirm('Move your Flag here? This may expose your win condition or risk capture.')) return;
      emit('movePiece', { pieceId: selected, row, col });
      setSelected(null);
    } else if (selected) {
      setStatus('Illegal move: choose a highlighted orthogonal square.');
    }
  }

  function sendChat(text = chatText) {
    emit('chatMessage', { text });
    setChatText('');
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-100">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <section>
              <div className="mb-5 flex items-center gap-3 text-emerald-300">
                <Shield className="h-7 w-7" />
                <span className="text-sm font-bold uppercase tracking-[0.3em]">Local Network Command</span>
              </div>
              <h1 className="font-display text-6xl uppercase leading-none text-stone-50 sm:text-7xl">
                Game of the Generals
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-stone-300">
                Secret ranks, ruthless bluffs, and one flag trying to cross the line.
              </p>
            </section>
            <section className="rounded-lg border border-stone-700 bg-stone-900/85 p-5 shadow-command">
              <button onClick={createRoom} className="command-button w-full bg-emerald-500 text-stone-950 hover:bg-emerald-400">
                <Flag className="h-5 w-5" /> Create Room
              </button>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-stone-700" />
                <span className="text-xs uppercase tracking-[0.25em] text-stone-500">or</span>
                <div className="h-px flex-1 bg-stone-700" />
              </div>
              <div className="flex gap-2">
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value)}
                  placeholder="Room code"
                  className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-950 px-3 py-3 font-mono uppercase text-stone-100 outline-none focus:border-emerald-400"
                />
                <button onClick={joinRoom} className="command-button bg-stone-200 text-stone-950 hover:bg-white">
                  Join
                </button>
              </div>
              <button onClick={() => setTutorialOpen(true)} className="mt-4 flex items-center gap-2 text-sm text-emerald-200 hover:text-white">
                <HelpCircle className="h-4 w-4" /> Quick rules and fog-of-war variant
              </button>
              <p className="mt-4 text-sm text-stone-400">{status}</p>
            </section>
          </div>
        </div>
        {tutorialOpen && <Tutorial onClose={() => {
          window.localStorage.setItem('gotg-tutorial-seen', 'yes');
          setTutorialOpen(false);
        }} />}
      </main>
    );
  }

  const isYourTurn = state.phase === 'playing' && state.turn === state.you;
  const winnerText = state.winner ? `${state.winner.toUpperCase()} wins` : null;
  const appClasses = [
    'min-h-screen text-stone-100',
    lightMode ? 'theme-light' : 'theme-dark',
    colorblind ? 'colorblind' : '',
    `speed-${animationSpeed}`
  ].join(' ');

  return (
    <main className={appClasses}>
      <div className="mx-auto grid max-w-[1680px] gap-5 px-4 py-4 2xl:grid-cols-[300px_minmax(620px,1fr)_360px]">
        <aside className="panel order-2 2xl:order-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Room</p>
              <h2 className="font-mono text-3xl font-black tracking-widest">{state.code}</h2>
            </div>
            <div className={`army-chip ${state.you}`}>{state.you}</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <StatusBox label="Phase" value={state.phase} />
            <StatusBox label="Turn" value={state.turn} highlight={isYourTurn} />
            <StatusBox label="You" value={state.connected[state.you] ? 'online' : 'offline'} />
            <StatusBox label="Enemy" value={state.connected[state.opponent] ? 'online' : 'waiting'} />
          </div>
          {state.phase === 'playing' && (
            <TurnTimer seconds={turnCountdown} total={state.turnSeconds} active={isYourTurn} />
          )}
          {state.phase === 'countdown' && (
            <div className="countdown-card">Battle starts in {countdown}</div>
          )}
          {state.pendingFlagWin && (
            <div className="mt-4 rounded-md border border-amber-300/50 bg-amber-300/10 p-3 text-sm text-amber-100">
              {state.pendingFlagWin.player.toUpperCase()} flag has reached the enemy back row. It wins at the start of its next turn if it survives.
            </div>
          )}
          <div className="mt-4 rounded-md border border-stone-700/80 bg-stone-950/45 p-3 text-sm text-stone-300">
            <p className="mb-1 flex items-center gap-2 font-bold text-stone-100"><EyeOff className="h-4 w-4" /> House Fog Rule</p>
            Enemy ranks stay hidden forever unless that exact piece is eliminated. Challenge winners stay unknown.
          </div>
          {state.lastBattle && <BattleCard battle={state.lastBattle} />}
          <div className="mt-5 flex flex-wrap gap-2">
            {state.phase === 'setup' || state.phase === 'countdown' ? (
              <>
                <button onClick={() => emit('ready')} className="command-button flex-1 bg-emerald-500 text-stone-950 hover:bg-emerald-400">
                  <Shield className="h-4 w-4" /> Ready
                </button>
                <button title="Randomize placement" onClick={() => emit('randomizePlacement', { strategy: placementStrategy })} className="icon-button">
                  <Shuffle className="h-5 w-5" />
                </button>
                <button title="Undo last placement" onClick={() => emit('undoPlacement')} className="icon-button">
                  <Undo2 className="h-5 w-5" />
                </button>
                <button title="Clear placement" onClick={() => emit('resetPlacement')} className="icon-button">
                  <RefreshCcw className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => window.confirm('Offer a draw?') && emit('offerDraw')} className="command-button flex-1 bg-stone-700 text-stone-100 hover:bg-stone-600">
                  <Handshake className="h-4 w-4" /> Draw
                </button>
                <button onClick={() => window.confirm('Resign this game?') && emit('resign')} className="command-button flex-1 bg-red-500 text-white hover:bg-red-400">
                  <Skull className="h-4 w-4" /> Resign
                </button>
              </>
            )}
          </div>
          <p className="mt-4 text-sm text-stone-400">{status}</p>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {['Whoa!', 'Sneaky!', 'Respect.', 'Again!'].map((text) => (
              <button key={text} onClick={() => emit('reaction', { text })} className="reaction-button">{text}</button>
            ))}
          </div>
          <Legend />
        </aside>

        <section className="order-1 2xl:order-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`eyebrow ${isYourTurn ? 'pulse-turn' : ''}`}>{isYourTurn ? 'Your Turn' : state.phase === 'setup' ? 'Deployment' : "Opponent's Turn"}</p>
              <h1 className="text-2xl font-black uppercase tracking-wide text-stone-50">
                {winnerText || titleFor(state)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-stone-700 bg-stone-950/70 px-3 py-2 text-sm text-stone-300">
                Placed {placedCount}/21 | Red {state.counts.red} | Blue {state.counts.blue}
              </div>
              <button title="Zoom out" onClick={() => setZoom((value) => Math.max(0.78, value - 0.08))} className="icon-button"><ZoomOut className="h-5 w-5" /></button>
              <button title="Zoom in" onClick={() => setZoom((value) => Math.min(1.12, value + 0.08))} className="icon-button"><ZoomIn className="h-5 w-5" /></button>
              <button title="Settings" onClick={() => setSettingsOpen(true)} className="icon-button"><Settings className="h-5 w-5" /></button>
              <button title="Tutorial" onClick={() => setTutorialOpen(true)} className="icon-button"><HelpCircle className="h-5 w-5" /></button>
            </div>
          </div>

          <div className="placement-guide">
            <span>Your army is always at the bottom.</span>
            {(state.phase === 'setup' || state.phase === 'countdown') && <span>{21 - placedCount} pieces left to deploy. Six home squares may stay empty.</span>}
          </div>

          <div className="board-scroll">
            <div className="board-wrap" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
              <div className="file-labels">
                {columns.map((column) => <span key={column}>{column}</span>)}
              </div>
              <div className="board">
                {orientedRows.map((row) =>
                  cols.map((col) => {
                    const piece = state.board[row][col];
                    const key = `${row}:${col}`;
                    const isSetup = (state.phase === 'setup' || state.phase === 'countdown') && setupRows.includes(row);
                    const isLegal = legalMoves.has(key);
                    const isSelected = piece?.id === selected;
                    const lastMove = state.lastMove && ((state.lastMove.from.row === row && state.lastMove.from.col === col) || (state.lastMove.to.row === row && state.lastMove.to.col === col));
                    return (
                      <button
                        key={key}
                        aria-label={`${columns[col]}${row + 1}${piece ? ` occupied by ${piece.visible ? piece.name : 'unknown enemy piece'}` : ''}`}
                        className={`square ${isSetup ? 'setup-zone' : ''} ${isLegal ? 'legal' : ''} ${isSelected ? 'selected' : ''} ${lastMove ? 'last-move' : ''}`}
                        onClick={() => handleSquare(row, col)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          handleSquare(row, col);
                          setDragId(null);
                        }}
                      >
                        <span className="rank-label">{row + 1}</span>
                        {piece && (
                          <PieceToken
                            piece={piece}
                            textRanks={textRanks}
                            draggable={piece.owner === state.you && (state.phase === 'setup' || state.phase === 'countdown')}
                            onDragStart={() => {
                              setSelected(piece.id);
                              setDragId(piece.id);
                            }}
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {(state.phase === 'setup' || state.phase === 'countdown') && (
            <div className="mt-4 rounded-lg border border-stone-700 bg-stone-900/85 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow">Reserve Tray</p>
                <div className="flex gap-2">
                  <select value={placementStrategy} onChange={(event) => setPlacementStrategy(event.target.value as 'balanced' | 'aggressive' | 'defensive')} className="strategy-select">
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                    <option value="defensive">Defensive</option>
                  </select>
                  <button onClick={() => emit('randomizePlacement', { strategy: placementStrategy })} className="small-action"><Shuffle className="h-4 w-4" /> Randomize</button>
                  <button onClick={() => emit('undoPlacement')} className="small-action"><Undo2 className="h-4 w-4" /> Undo</button>
                  <button onClick={() => emit('resetPlacement')} className="small-action"><RefreshCcw className="h-4 w-4" /> Clear</button>
                </div>
              </div>
              <div className="tray">
                {state.tray.map((piece) => (
                  <button
                    key={piece.id}
                    draggable
                    title={`${piece.name}: ${ruleText(piece.code)}`}
                    onClick={() => setSelected(piece.id)}
                    onDragStart={() => {
                      setSelected(piece.id);
                      setDragId(piece.id);
                    }}
                    className={`tray-piece ${selected === piece.id ? 'ring-2 ring-emerald-300' : ''}`}
                  >
                    <PieceToken piece={piece} compact textRanks={textRanks} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="panel order-3">
          <Captured title="Captured Red" pieces={state.captured.red} />
          <Captured title="Captured Blue" pieces={state.captured.blue} />
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
            <StatusBox label="Moves" value={String(state.stats.moves.red + state.stats.moves.blue)} />
            <StatusBox label="Clashes" value={String(state.stats.challenges)} />
            <StatusBox label="Spy KOs" value={String(state.stats.spyKills.red + state.stats.spyKills.blue)} />
          </div>
          <Log title="Move History" items={state.history.map((entry) => ({ id: entry.id, at: entry.at, text: entry.text }))} />
          <Log title="Eliminated" items={state.eliminatedLog.map((entry) => ({ id: entry.id, at: entry.at, text: `${entry.owner.toUpperCase()} ${entry.code} - ${entry.reason}` }))} />
          <div className="mt-5">
            <p className="eyebrow mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Chat</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {['Nice try!', 'That was sneaky!', 'My heart skipped!', 'Well played!', 'Spy time!'].map((preset) => (
                <button key={preset} onClick={() => sendChat(preset)} className="preset-chat">{preset}</button>
              ))}
            </div>
            <div className="chat-box">
              {state.chat.map((message) => (
                <div key={message.id} className={`chat-row ${message.reaction ? 'reaction-row' : ''}`}>
                  <span className={`chat-player ${message.player}`}>{message.player}</span>
                  <span>{message.text}</span>
                </div>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={(event) => {
              event.preventDefault();
              sendChat();
            }}>
              <input
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                maxLength={80}
                placeholder="Send a message"
                className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
              <button className="command-button bg-emerald-500 px-3 text-stone-950">Send</button>
            </form>
          </div>
        </aside>
      </div>

      {tutorialOpen && <Tutorial onClose={() => {
        window.localStorage.setItem('gotg-tutorial-seen', 'yes');
        setTutorialOpen(false);
      }} />}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          soundOn={soundOn}
          setSoundOn={setSoundOn}
          lightMode={lightMode}
          setLightMode={setLightMode}
          colorblind={colorblind}
          setColorblind={setColorblind}
          textRanks={textRanks}
          setTextRanks={setTextRanks}
          animationSpeed={animationSpeed}
          setAnimationSpeed={setAnimationSpeed}
          turnSeconds={state.turnSeconds}
          revealMode={state.revealMode}
          updateServer={(payload) => emit('updateSettings', payload)}
        />
      )}
      {state.winner && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/75 px-4">
          <div className={`victory-card ${state.winner === state.you ? 'winner' : 'defeated'}`}>
            <Swords className="mx-auto h-12 w-12 text-emerald-300" />
            <h2 className="mt-4 text-4xl font-black uppercase">{winnerText}</h2>
            <p className="mt-3 text-stone-300">{state.winReason}</p>
            <PostGameStats state={state} />
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={() => emit('revealAll')} className="command-button bg-stone-200 text-stone-950 hover:bg-white"><Eye className="h-4 w-4" /> Reveal All</button>
              <button onClick={() => emit('rematch')} className="command-button bg-emerald-500 text-stone-950 hover:bg-emerald-400"><RotateCcw className="h-4 w-4" /> Rematch</button>
            </div>
            <p className="mt-4 text-sm uppercase tracking-[0.25em] text-stone-500">
              Rematch: Red {state.rematchReady.red ? 'ready' : 'waiting'} | Blue {state.rematchReady.blue ? 'ready' : 'waiting'}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function useCountdown(endsAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function TurnTimer({ seconds, total, active }: { seconds: number; total: number; active: boolean }) {
  const pct = total ? Math.max(0, Math.min(100, (seconds / total) * 100)) : 0;
  const urgent = seconds <= 10;
  return (
    <div className={`turn-timer ${active ? 'active' : ''} ${urgent ? 'urgent' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><Timer className="h-4 w-4" /> {active ? 'Your clock' : 'Opponent clock'}</span>
        <b>{seconds}s</b>
      </div>
      <div className="timer-track"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function PostGameStats({ state }: { state: GameState }) {
  const totalMoves = state.stats.moves.red + state.stats.moves.blue;
  const bluff = state.stats.biggestBluff;
  const mvp = state.stats.mvp;
  const survivor = state.stats.longestSurvivor;
  return (
    <div className="postgame-grid">
      <StatusBox label="Moves" value={String(totalMoves)} />
      <StatusBox label="Challenges" value={String(state.stats.challenges)} />
      <StatusBox label="Spy KOs" value={String(state.stats.spyKills.red + state.stats.spyKills.blue)} />
      <div className="postgame-card">
        <Trophy className="h-5 w-5 text-amber-300" />
        <span>MVP</span>
        <b>{mvp ? `${mvp.owner.toUpperCase()} ${mvp.code}` : 'No clear MVP'}</b>
        <small>{mvp ? `${mvp.wins} wins, ${mvp.moves} moves` : 'Quiet battlefield'}</small>
      </div>
      <div className="postgame-card">
        <Zap className="h-5 w-5 text-emerald-300" />
        <span>Biggest Bluff</span>
        <b>{bluff ? `${bluff.winnerOwner.toUpperCase()} SPY beat ${bluff.loserCode}` : 'No general fell to Spy'}</b>
        <small>{bluff ? bluff.loserName : 'Try a sneakier setup next round'}</small>
      </div>
      <div className="postgame-card">
        <Shield className="h-5 w-5 text-sky-300" />
        <span>Longest Survivor</span>
        <b>{survivor ? `${survivor.owner.toUpperCase()} ${survivor.code}` : 'No mover survived'}</b>
        <small>{survivor ? survivor.name : 'Pieces stayed cautious'}</small>
      </div>
    </div>
  );
}

function statusFor(state: GameState) {
  if (!state.connected[state.opponent]) return 'Waiting for opponent to connect or reconnect.';
  if (state.phase === 'setup') return 'Arrange your formation.';
  if (state.phase === 'countdown') return 'Both players ready. Countdown started.';
  if (state.winner) return state.winReason;
  return state.turn === state.you ? 'Your turn. Select a piece.' : 'Opponent is thinking.';
}

function titleFor(state: GameState) {
  if (state.phase === 'setup') return 'Set the line';
  if (state.phase === 'countdown') return 'Stand by';
  return 'Command the field';
}

function findPiece(state: GameState, id: string | null) {
  if (!id) return null;
  return state.board.flat().find((piece) => piece?.id === id) || state.tray.find((piece) => piece.id === id) || null;
}

function playTone(kind: 'move' | 'capture' | 'win') {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const frequency = kind === 'move' ? 220 : kind === 'capture' ? 92 : 440;
  osc.frequency.value = frequency;
  osc.type = kind === 'capture' ? 'sawtooth' : 'triangle';
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(kind === 'capture' ? 0.12 : 0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'win' ? 0.45 : 0.16));
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + (kind === 'win' ? 0.5 : 0.18));
}

function StatusBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? 'status-highlight' : 'border-stone-700 bg-stone-950/60'}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 font-bold uppercase">{value}</p>
    </div>
  );
}

function PieceToken({ piece, compact = false, draggable = false, onDragStart, textRanks }: { piece: Piece; compact?: boolean; draggable?: boolean; onDragStart?: () => void; textRanks: boolean }) {
  const hidden = !piece.visible;
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      title={piece.visible ? `${piece.name}: ${ruleText(piece.code)}` : 'Unknown enemy piece. Rank is revealed only if eliminated.'}
      className={`piece-token ${piece.owner} ${hidden ? 'hidden-piece' : ''} ${compact ? 'compact' : ''}`}
    >
      <span className="piece-code">{hidden ? '◆' : textRanks ? piece.code : iconFor(piece.code)}</span>
      {!compact && <span className="piece-name">{hidden ? 'Unknown' : piece.name}</span>}
    </div>
  );
}

function BattleCard({ battle }: { battle: Battle }) {
  const result = battle.outcome === 'both'
    ? 'Both pieces were eliminated'
    : battle.outcome === 'attacker'
      ? 'Defender eliminated. Attacker remains hidden.'
      : 'Attacker eliminated. Defender remains hidden.';
  return (
    <div className={`battle-card ${battle.special ? `special-${battle.special}` : ''}`}>
      <p className="eyebrow text-amber-200">{specialTitle(battle.special)}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <BattleMini piece={battle.attacker} label="Attacker" />
        <Swords className="h-5 w-5 text-amber-200" />
        <BattleMini piece={battle.defender} label="Defender" />
      </div>
      <p className="mt-3 text-center text-sm font-bold text-amber-100">{result}</p>
    </div>
  );
}

function specialTitle(special: Battle['special']) {
  if (special === 'flag-capture') return 'Flag Captured';
  if (special === 'private-trap') return 'Private Trap';
  if (special === 'spy-assassination') return 'Spy Assassination';
  if (special === 'ambush') return 'Ambush';
  return 'Challenge';
}

function BattleMini({ piece, label }: { piece: BattlePiece; label: string }) {
  return (
    <div className={`rounded-md border p-2 ${piece.owner === 'red' ? 'border-red-300/50 bg-red-500/20' : 'border-sky-300/50 bg-sky-500/20'} ${piece.eliminated ? 'eliminated-pop' : ''}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">{label}</p>
      <p className="font-black">{piece.visible ? piece.code : '◆'}</p>
      <p className="text-[11px] text-stone-300">{piece.visible ? piece.name : 'Hidden winner'}</p>
    </div>
  );
}

function Captured({ title, pieces }: { title: string; pieces: Piece[] }) {
  return (
    <div className="mt-2">
      <p className="eyebrow mb-2">{title}</p>
      <div className="captured">
        {pieces.length ? pieces.map((piece) => (
          <span key={piece.id} title={piece.name} className={`captured-chip ${piece.owner}`}>{piece.code}</span>
        )) : <span className="text-sm text-stone-500">None</span>}
      </div>
    </div>
  );
}

function Log({ title, items }: { title: string; items: { id: number; at: string; text: string }[] }) {
  return (
    <div className="mt-5">
      <p className="eyebrow mb-3">{title}</p>
      <div className="history">
        {items.length ? items.map((entry) => (
          <div key={entry.id} className="history-row">
            <span className="font-mono text-stone-500">{entry.at}</span>
            <span>{entry.text}</span>
          </div>
        )) : <span className="text-sm text-stone-500">No entries yet</span>}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-5">
      <p className="eyebrow mb-3">Piece Hierarchy</p>
      <div className="legend-list">
        {hierarchy.map(([code, name, note]) => (
          <div key={code} className="legend-row">
            <span className="legend-code">{code}</span>
            <span>
              <b>{name}</b>
              <small>{note}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tutorial({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4">
      <div className="modal-card max-w-2xl">
        <p className="eyebrow">First briefing</p>
        <h2 className="mt-2 text-3xl font-black uppercase">How this table plays</h2>
        <div className="mt-5 grid gap-3 text-sm text-stone-300 sm:grid-cols-2">
          <p><b>1. Deploy secretly.</b> Put all 21 pieces in your nearest three rows. Six home squares stay empty.</p>
          <p><b>2. Move one square.</b> Orthogonal only: up, down, left, right. No diagonals or jumping.</p>
          <p><b>3. Challenge blind.</b> The server compares ranks privately when you attack an enemy piece.</p>
          <p><b>4. House fog rule.</b> Only eliminated pieces reveal their rank. Winning pieces stay as unknown silhouettes.</p>
          <p><b>5. Win cleanly.</b> Capture the enemy Flag or move your Flag to the enemy back row and survive until your next turn starts.</p>
          <p><b>6. Special ranks.</b> Spy beats everything except Private. Private beats Spy. Flag loses to everything.</p>
        </div>
        <button onClick={onClose} className="command-button mt-6 bg-emerald-500 text-stone-950 hover:bg-emerald-400">Begin</button>
      </div>
    </div>
  );
}

function SettingsModal(props: {
  onClose: () => void;
  soundOn: boolean;
  setSoundOn: (value: boolean) => void;
  lightMode: boolean;
  setLightMode: (value: boolean) => void;
  colorblind: boolean;
  setColorblind: (value: boolean) => void;
  textRanks: boolean;
  setTextRanks: (value: boolean) => void;
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (value: AnimationSpeed) => void;
  turnSeconds: number;
  revealMode: 'hidden' | 'classic';
  updateServer: (payload: { turnSeconds?: number; revealMode?: 'hidden' | 'classic' }) => void;
}) {
  const [turnSeconds, setTurnSeconds] = useState(props.turnSeconds);
  const [revealMode, setRevealMode] = useState(props.revealMode);
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4">
      <div className="modal-card max-w-md">
        <p className="eyebrow">Settings</p>
        <h2 className="mt-2 text-3xl font-black uppercase">Table feel</h2>
        <div className="mt-5 grid gap-3">
          <Toggle label="Sound effects" icon={props.soundOn ? <Volume2 /> : <VolumeX />} value={props.soundOn} onChange={props.setSoundOn} />
          <Toggle label="Light mode" icon={props.lightMode ? <Sun /> : <Moon />} value={props.lightMode} onChange={props.setLightMode} />
          <Toggle label="Colorblind-friendly borders" icon={<Shield />} value={props.colorblind} onChange={props.setColorblind} />
          <Toggle label="Show ranks as text" icon={<Flag />} value={props.textRanks} onChange={props.setTextRanks} />
          <label className="setting-row">
            <span>Animation speed</span>
            <select value={props.animationSpeed} onChange={(event) => props.setAnimationSpeed(event.target.value as AnimationSpeed)}>
              <option value="calm">Calm</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Turn timer</span>
            <select value={turnSeconds} onChange={(event) => {
              const next = Number(event.target.value);
              setTurnSeconds(next);
              props.updateServer({ turnSeconds: next });
            }}>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={90}>90 seconds</option>
              <option value={120}>120 seconds</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Reveal rule</span>
            <select value={revealMode} onChange={(event) => {
              const next = event.target.value as 'hidden' | 'classic';
              setRevealMode(next);
              props.updateServer({ revealMode: next });
            }}>
              <option value="hidden">Hidden until eliminated</option>
              <option value="classic">Classic challenge reveal</option>
            </select>
          </label>
        </div>
        <button onClick={props.onClose} className="command-button mt-6 bg-emerald-500 text-stone-950 hover:bg-emerald-400">Done</button>
      </div>
    </div>
  );
}

function Toggle({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="setting-row">
      <span className="flex items-center gap-2">{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}{label}</span>
      <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function ruleText(code: string) {
  if (code === 'SPY') return 'Beats all pieces except Private.';
  if (code === 'PVT') return 'Beats Spy and loses to normal ranks.';
  if (code === 'FLG') return 'Loses to everything. Reach the enemy back row to threaten victory.';
  return 'Higher normal rank wins. Same rank eliminates both.';
}

function iconFor(code: string) {
  if (code === 'SPY') return 'S';
  if (code === 'PVT') return 'P';
  if (code === 'FLG') return 'F';
  return '★';
}

createRoot(document.getElementById('root')!).render(<App />);
