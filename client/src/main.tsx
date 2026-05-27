import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, Socket } from 'socket.io-client';
import { HelpCircle, Settings } from 'lucide-react';
import './styles.css';
import { AccountModal } from './components/AccountModal';
import { AnalysisBoard } from './components/AnalysisBoard';
import { Board } from './components/Board';
import { ChatPanel } from './components/ChatPanel';
import { Leaderboard } from './components/Leaderboard';
import { Lobby } from './components/Lobby';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { Tray } from './components/Tray';
import { Tutorial } from './components/Tutorial';
import { WinScreen } from './components/WinScreen';
import type { Ack, AnimationSpeed, BoardTheme, GameState, Piece, Player, SoundPack, User } from './types';

const socketUrl = import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
const socket: Socket = io(socketUrl, { autoConnect: true });
const rows = Array.from({ length: 8 }, (_, row) => row);
const cols = Array.from({ length: 9 }, (_, col) => col);

function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
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
  const [preMove, setPreMove] = useState<string | null>(null);
  const [status, setStatus] = useState('Create a room or join your opponent.');
  const [tutorialOpen, setTutorialOpen] = useState(() => window.localStorage.getItem('gotg-tutorial-seen') !== 'yes');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [chatText, setChatText] = useState('');
  const [soundPack, setSoundPack] = useState<SoundPack>(() => (window.localStorage.getItem('gotg-sound-pack') as SoundPack) || 'classic');
  const [lightMode, setLightMode] = useState(false);
  const [colorblind, setColorblind] = useState(false);
  const [textRanks, setTextRanks] = useState(() => window.localStorage.getItem('gotg-text-ranks') !== 'off');
  const [showCoords, setShowCoords] = useState(() => window.localStorage.getItem('gotg-show-coords') !== 'off');
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(() => (window.localStorage.getItem('gotg-board-theme') as BoardTheme) || 'classic');
  const [customBoardImg, setCustomBoardImg] = useState<string | null>(() => window.localStorage.getItem('gotg-board-img'));
  const [animationSpeed, setAnimationSpeed] = useState<AnimationSpeed>('normal');
  const [zoom, setZoom] = useState(1);
  const [placementStrategy, setPlacementStrategy] = useState<'balanced' | 'aggressive' | 'defensive'>('balanced');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const tokenRef = useRef(window.localStorage.getItem('gotg-token') || '');
  const previousState = useRef<GameState | null>(null);

  useEffect(() => {
    socket.on('state', (nextState: GameState) => {
      const prior = previousState.current;
      setState(nextState);
      setRoomCode(nextState.code);
      setStatus(statusFor(nextState));
      if (soundPack !== 'off' && prior) {
        if (nextState.winner && !prior.winner) playTone('win', soundPack);
        else if (nextState.lastBattle && JSON.stringify(nextState.lastBattle) !== JSON.stringify(prior.lastBattle)) {
          playTone(nextState.lastBattle.special === 'flag-capture' ? 'win' : 'capture', soundPack);
        } else if (nextState.lastMove && JSON.stringify(nextState.lastMove) !== JSON.stringify(prior.lastMove)) {
          playTone('move', soundPack);
        }
      }
      previousState.current = nextState;
    });
    socket.on('notice', (message: string) => setStatus(message));
    return () => {
      socket.off('state');
      socket.off('notice');
    };
  }, [soundPack]);

  useEffect(() => {
    const saved = JSON.parse(window.localStorage.getItem('gotg-seat') || 'null') as null | { code: string; player: Player };
    if (!saved) return;
    socket.emit('reconnectRoom', { ...saved, clientId, token: tokenRef.current }, (ack: Ack) => {
      if (ack?.ok) setRoomCode(ack.code || saved.code);
    });
  }, []);

  useEffect(() => {
    const onSpectate = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      joinRoom(true, code);
    };
    window.addEventListener('gotg:spectate', onSpectate);
    return () => window.removeEventListener('gotg:spectate', onSpectate);
  });

  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;
    fetch(`${socketUrl}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setCurrentUser(data.user))
      .catch(() => {
        window.localStorage.removeItem('gotg-token');
        tokenRef.current = '';
      });
  }, []);

  useEffect(() => window.localStorage.setItem('gotg-sound-pack', soundPack), [soundPack]);
  useEffect(() => window.localStorage.setItem('gotg-text-ranks', textRanks ? 'on' : 'off'), [textRanks]);
  useEffect(() => window.localStorage.setItem('gotg-show-coords', showCoords ? 'on' : 'off'), [showCoords]);
  useEffect(() => window.localStorage.setItem('gotg-board-theme', boardTheme), [boardTheme]);
  useEffect(() => {
    if (customBoardImg) window.localStorage.setItem('gotg-board-img', customBoardImg);
  }, [customBoardImg]);

  const setupRows = useMemo(() => state?.you === 'red' ? [5, 6, 7] : [0, 1, 2], [state?.you]);
  const selectedPiece = state ? findPiece(state, selected) : null;
  const placedCount = state ? 21 - state.tray.length : 0;

  const legalMoves = useMemo(() => {
    if (!state || state.isSpectator || !selectedPiece || selectedPiece.owner !== state.you || selectedPiece.status !== 'board') return new Set<string>();
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') setZoom((value) => value === 1 ? 0.86 : 1);
      if (event.key === 'Escape') setSelected(null);
      if (!state || !selectedPiece || state.phase !== 'playing' || state.turn !== state.you) return;
      const delta: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      if (event.key in delta) {
        event.preventDefault();
        const [dr, dc] = delta[event.key];
        const row = selectedPiece.row! + dr;
        const col = selectedPiece.col! + dc;
        if (legalMoves.has(`${row}:${col}`)) handleSquare(row, col);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, selectedPiece, legalMoves]);

  useEffect(() => {
    if (state?.phase === 'playing' && state.turn === state.you && preMove) {
      setSelected(preMove);
      setPreMove(null);
    }
  }, [state?.turn, state?.phase, state?.you, preMove]);

  function emit(event: string, payload = {}) {
    socket.emit(event, payload, (ack: Ack) => {
      if (!ack?.ok) setStatus(ack?.error || 'Command failed.');
      else setStatus('Command accepted.');
    });
  }

  function createRoom() {
    socket.emit('createRoom', { clientId, token: tokenRef.current }, (ack: Ack) => {
      if (!ack.ok) return setStatus(ack.error || 'Could not create room.');
      setRoomCode(ack.code || '');
      if (ack.code && ack.player) window.localStorage.setItem('gotg-seat', JSON.stringify({ code: ack.code, player: ack.player }));
    });
  }

  function joinRoom(spectator = false, overrideCode?: string) {
    const code = (overrideCode || roomCode).trim().toUpperCase();
    socket.emit('joinRoom', { code, clientId, token: tokenRef.current, spectator }, (ack: Ack) => {
      if (!ack.ok) return setStatus(ack.error || 'Could not join room.');
      setRoomCode(ack.code || code);
      if (!spectator && ack.code && ack.player) window.localStorage.setItem('gotg-seat', JSON.stringify({ code: ack.code, player: ack.player }));
    });
  }

  function leaveGame() {
    socket.emit('leaveRoom', {}, () => undefined);
    window.localStorage.removeItem('gotg-seat');
    setState(null);
    setSelected(null);
    setPreMove(null);
    setStatus('Returned to lobby.');
  }

  function handleSquare(row: number, col: number) {
    if (!state || state.isSpectator) return;
    const piece = state.board[row][col];
    if (state.phase === 'setup' || state.phase === 'countdown') {
      const pieceId = dragId || selected;
      if (pieceId) emit('placePiece', { pieceId, row, col });
      return;
    }
    if (piece?.owner === state.you) {
      if (state.turn !== state.you) setPreMove(piece.id);
      else setSelected(piece.id);
      return;
    }
    if (selected && legalMoves.has(`${row}:${col}`)) {
      if (selectedPiece?.code === 'FLG' && !window.confirm('Move your Flag here?')) return;
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

  function handleLogin(user: User, token: string) {
    setCurrentUser(user);
    tokenRef.current = token;
  }

  function logout() {
    setCurrentUser(null);
    tokenRef.current = '';
    window.localStorage.removeItem('gotg-token');
  }

  function uploadAvatar(file: File) {
    if (!tokenRef.current) return setStatus('Sign in before adding a profile picture.');
    if (file.size > 700_000) return setStatus('Choose an image under about 650 KB.');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const avatar = String(reader.result || '');
        const res = await fetch(`${socketUrl}/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({ avatar }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update profile.');
        setCurrentUser(data.user);
        setStatus('Profile picture updated.');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not update profile.');
      }
    };
    reader.readAsDataURL(file);
  }

  if (!state) {
    return (
      <>
        <Lobby
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          status={status}
          currentUser={currentUser}
          onCreateRoom={createRoom}
          onJoinRoom={() => joinRoom(false)}
          onOpenTutorial={() => setTutorialOpen(true)}
          onOpenAccount={() => setAccountOpen(true)}
          onOpenLeaderboard={() => setLeaderboardOpen(true)}
          onLogout={logout}
          onAvatarUpload={uploadAvatar}
        />
        {tutorialOpen && <Tutorial onClose={() => {
          window.localStorage.setItem('gotg-tutorial-seen', 'yes');
          setTutorialOpen(false);
        }} />}
        {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} onLogin={handleLogin} />}
        {leaderboardOpen && <Leaderboard onClose={() => setLeaderboardOpen(false)} />}
      </>
    );
  }

  const isYourTurn = state.phase === 'playing' && state.turn === state.you;
  const appClasses = [
    'min-h-screen text-stone-100',
    lightMode ? 'theme-light' : 'theme-dark',
    colorblind ? 'colorblind' : '',
    showCoords ? '' : 'no-coords',
    `speed-${animationSpeed}`
  ].join(' ');

  return (
    <main className={appClasses}>
      <div className="mx-auto grid max-w-[1680px] gap-5 px-4 py-4 2xl:grid-cols-[300px_minmax(620px,1fr)_360px]">
        <Sidebar
          state={state}
          status={status}
          placementStrategy={placementStrategy}
          setPlacementStrategy={setPlacementStrategy}
          onReady={() => emit('ready')}
          onRandomize={() => emit('randomizePlacement', { strategy: placementStrategy })}
          onUndo={() => emit('undoPlacement')}
          onClear={() => emit('resetPlacement')}
          onDraw={() => state.drawOffer && state.drawOffer !== state.you ? emit('acceptDraw') : window.confirm('Offer a draw?') && emit('offerDraw')}
          onResign={() => window.confirm('Resign this game?') && emit('resign')}
          onLeave={leaveGame}
          onReaction={(text) => emit('reaction', { text })}
        />

        <section className="order-1 2xl:order-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`eyebrow ${isYourTurn ? 'pulse-turn' : ''}`}>
                {state.isSpectator ? 'Spectating' : isYourTurn ? 'Your Turn' : state.phase === 'setup' ? 'Deployment' : "Opponent's Turn"}
              </p>
              <h1 className="text-2xl font-black uppercase tracking-wide text-stone-50">
                {state.winner ? `${state.winner.toUpperCase()} wins` : titleFor(state)}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-stone-700 bg-stone-950/70 px-3 py-2 text-sm text-stone-300">
                Placed {placedCount}/21 | Red {state.counts.red} | Blue {state.counts.blue}
              </div>
              <button title="Settings" onClick={() => setSettingsOpen(true)} className="icon-button"><Settings size={18} /></button>
              <button title="Tutorial" onClick={() => setTutorialOpen(true)} className="icon-button"><HelpCircle size={18} /></button>
            </div>
          </div>

          <div className="placement-guide">
            <span>{state.isSpectator ? 'Spectator mode hides both armies.' : 'Your army is always at the bottom.'}</span>
            {(state.phase === 'setup' || state.phase === 'countdown') && !state.isSpectator && <span>{21 - placedCount} pieces left to deploy.</span>}
          </div>

          <Board
            state={state}
            selected={selected}
            legalMoves={legalMoves}
            boardTheme={boardTheme}
            customBoardImg={customBoardImg}
            textRanks={textRanks}
            zoom={zoom}
            setZoom={setZoom}
            preMove={preMove}
            onSquareClick={handleSquare}
            onDragStart={(pieceId) => {
              setSelected(pieceId);
              setDragId(pieceId);
            }}
            onDrop={() => setDragId(null)}
          />

          <div className="board-profiles">
            <PlayerProfileCard player="red" state={state} />
            <PlayerProfileCard player="blue" state={state} />
          </div>

          <Tray
            state={state}
            selected={selected}
            textRanks={textRanks}
            boardTheme={boardTheme}
            placementStrategy={placementStrategy}
            setPlacementStrategy={setPlacementStrategy}
            onSelect={setSelected}
            onDragStart={(pieceId) => {
              setSelected(pieceId);
              setDragId(pieceId);
            }}
            onRandomize={() => emit('randomizePlacement', { strategy: placementStrategy })}
            onUndo={() => emit('undoPlacement')}
            onClear={() => emit('resetPlacement')}
          />
        </section>

        <ChatPanel state={state} boardTheme={boardTheme} chatText={chatText} setChatText={setChatText} onSendChat={sendChat} />
      </div>

      {tutorialOpen && <Tutorial onClose={() => {
        window.localStorage.setItem('gotg-tutorial-seen', 'yes');
        setTutorialOpen(false);
      }} />}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          soundPack={soundPack}
          setSoundPack={setSoundPack}
          lightMode={lightMode}
          setLightMode={setLightMode}
          colorblind={colorblind}
          setColorblind={setColorblind}
          textRanks={textRanks}
          setTextRanks={setTextRanks}
          showCoords={showCoords}
          setShowCoords={setShowCoords}
          boardTheme={boardTheme}
          setBoardTheme={setBoardTheme}
          customBoardImg={customBoardImg}
          setCustomBoardImg={setCustomBoardImg}
          animationSpeed={animationSpeed}
          setAnimationSpeed={setAnimationSpeed}
          turnSeconds={state.turnSeconds}
          increment={state.increment}
          revealMode={state.revealMode}
          updateServer={(payload) => emit('updateSettings', payload)}
        />
      )}
      {state.winner && (
        <WinScreen
          state={state}
          onRevealAll={() => emit('revealAll')}
          onRematch={() => emit('rematch')}
          onLeave={leaveGame}
          onAnalyze={() => setAnalysisOpen(true)}
        />
      )}
      {analysisOpen && <AnalysisBoard state={state} onClose={() => setAnalysisOpen(false)} />}
    </main>
  );
}

function PlayerProfileCard({ player, state }: { player: Player; state: GameState }) {
  const profile = state.profiles[player];
  const label = player === state.you && !state.isSpectator ? 'You' : player === state.opponent && !state.isSpectator ? 'Opponent' : player.toUpperCase();
  return (
    <div className={`player-profile-card ${player}`}>
      <span className="profile-avatar">
        {profile.avatar ? <img src={profile.avatar} alt="" /> : profile.username.slice(0, 1)}
      </span>
      <span>
        <small>{label}</small>
        <b>{profile.username}</b>
      </span>
      <span className="profile-record">
        {profile.elo ? `${profile.elo} ELO` : 'Guest'}
        <small>{profile.wins}-{profile.losses}-{profile.draws}</small>
      </span>
    </div>
  );
}

function statusFor(state: GameState) {
  if (state.isSpectator) return 'Watching live as a spectator.';
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

function findPiece(state: GameState, id: string | null): Piece | null {
  if (!id) return null;
  return state.board.flat().find((piece) => piece?.id === id) || state.tray.find((piece) => piece.id === id) || null;
}

function playTone(kind: 'move' | 'capture' | 'win', pack: SoundPack) {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const tactical = pack === 'tactical';
  osc.frequency.value = kind === 'move' ? (tactical ? 180 : 220) : kind === 'capture' ? (tactical ? 70 : 92) : (tactical ? 520 : 440);
  osc.type = kind === 'capture' ? 'sawtooth' : tactical ? 'square' : 'triangle';
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(kind === 'capture' ? 0.12 : 0.08, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'win' ? 0.45 : 0.16));
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + (kind === 'win' ? 0.5 : 0.18));
}

createRoot(document.getElementById('root')!).render(<App />);
