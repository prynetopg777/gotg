import React from 'react';
import {
  Shield, Skull, Handshake, Timer, EyeOff, Swords, LogOut, Users,
  Flag, RefreshCcw, Undo2, Shuffle,
} from 'lucide-react';
import { useCountdown } from '../hooks/useCountdown';
import type { GameState, Battle, Player } from '../types';

// ── Sub-components ─────────────────────────────────────────────────────

function StatusBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${highlight ? 'status-highlight' : 'border-stone-700 bg-stone-950/60'}`}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{label}</p>
      <p className="mt-1 font-bold uppercase">{value}</p>
    </div>
  );
}

function TurnTimer({ seconds, total, active }: { seconds: number; total: number; active: boolean }) {
  const pct = total ? Math.max(0, Math.min(100, (seconds / total) * 100)) : 0;
  const urgent = seconds <= 10 && active;
  return (
    <div className={`turn-timer ${active ? 'active' : ''} ${urgent ? 'urgent' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2"><Timer size={14} /> {active ? 'Your clock' : 'Opponent clock'}</span>
        <b>{seconds}s</b>
      </div>
      <div className="timer-track"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function DualClock({ timeBank, turn, you }: { timeBank: Record<Player, number>; turn: Player; you: Player }) {
  return (
    <div className="dual-clock">
      {(['red', 'blue'] as Player[]).map(p => {
        const isActive = turn === p;
        const secs = Math.max(0, Math.ceil(timeBank[p] / 1000));
        const urgent = secs <= 15 && isActive;
        const mins = Math.floor(secs / 60);
        const rem = secs % 60;
        const label = p === you ? 'You' : 'Opponent';
        return (
          <div key={p} className={`clock-chip ${isActive ? 'active' : ''} ${urgent ? 'urgent' : ''} ${p}`}>
            <span className="clock-label">{label}</span>
            <span className="clock-time">{mins}:{String(rem).padStart(2, '0')}</span>
          </div>
        );
      })}
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

function BattleMini({ piece, label }: { piece: Battle['attacker']; label: string }) {
  return (
    <div className={`rounded-md border p-2 ${piece.owner === 'red' ? 'border-red-300/50 bg-red-500/20' : 'border-sky-300/50 bg-sky-500/20'} ${piece.eliminated ? 'eliminated-pop' : ''}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-stone-400">{label}</p>
      <p className="font-black">{piece.visible ? piece.code : '◆'}</p>
      <p className="text-[11px] text-stone-300">{piece.visible ? piece.name : 'Hidden winner'}</p>
    </div>
  );
}

function BattleCard({ battle }: { battle: Battle }) {
  const result = battle.outcome === 'both'
    ? 'Both eliminated'
    : battle.outcome === 'attacker'
      ? 'Defender eliminated'
      : 'Attacker eliminated';
  return (
    <div className={`battle-card ${battle.special ? `special-${battle.special}` : ''}`}>
      <p className="eyebrow text-amber-200">{specialTitle(battle.special)}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <BattleMini piece={battle.attacker} label="Attacker" />
        <Swords size={18} className="text-amber-200" />
        <BattleMini piece={battle.defender} label="Defender" />
      </div>
      <p className="mt-3 text-center text-sm font-bold text-amber-100">{result}</p>
    </div>
  );
}

function Legend() {
  const hierarchy = [
    ['5G', '5-Star General'], ['4G', '4-Star General'], ['3G', '3-Star General'],
    ['2G', '2-Star General'], ['1G', '1-Star General'], ['COL', 'Colonel'],
    ['LTC', 'Lt. Colonel'], ['MAJ', 'Major'], ['CPT', 'Captain'],
    ['1LT', '1st Lieutenant'], ['2LT', '2nd Lieutenant'], ['SGT', 'Sergeant'],
    ['SPY', 'Spy ★ beats all except PVT'], ['PVT', 'Private ★ beats Spy'], ['FLG', 'Flag — reach enemy back row'],
  ];
  return (
    <div className="mt-5">
      <p className="eyebrow mb-3">Piece Hierarchy</p>
      <div className="legend-list">
        {hierarchy.map(([code, name]) => (
          <div key={code} className="legend-row">
            <span className="legend-code">{code}</span>
            <span><b>{name}</b></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Sidebar ────────────────────────────────────────────────────────

interface SidebarProps {
  state: GameState;
  status: string;
  placementStrategy: 'balanced' | 'aggressive' | 'defensive';
  setPlacementStrategy: (s: 'balanced' | 'aggressive' | 'defensive') => void;
  onReady: () => void;
  onRandomize: () => void;
  onUndo: () => void;
  onClear: () => void;
  onDraw: () => void;
  onResign: () => void;
  onLeave: () => void;
  onReaction: (text: string) => void;
}

export function Sidebar({
  state, status, placementStrategy, setPlacementStrategy,
  onReady, onRandomize, onUndo, onClear, onDraw, onResign, onLeave, onReaction,
}: SidebarProps) {
  const isYourTurn = state.phase === 'playing' && state.turn === state.you;
  const countdown = useCountdown(state.countdownEndsAt || null);
  const turnCountdown = useCountdown(state.turnEndsAt || null);
  const isTimeBankMode = state.increment > 0 || state.timeBank.red < state.turnSeconds * 1000 * 7.9;

  return (
    <aside className="panel order-2 2xl:order-1">
      {/* Room header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Room</p>
          <h2 className="font-mono text-3xl font-black tracking-widest">{state.code}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`army-chip ${state.you}`}>{state.you}</div>
          {state.spectators > 0 && (
            <span className="flex items-center gap-1 text-xs text-stone-400">
              <Users size={12} /> {state.spectators} watching
            </span>
          )}
        </div>
      </div>

      {/* Status grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <StatusBox label="Phase" value={state.phase} />
        <StatusBox label="Turn" value={state.turn} highlight={isYourTurn} />
        <StatusBox label="You" value={state.connected[state.you] ? 'online' : 'offline'} />
        <StatusBox label="Enemy" value={state.connected[state.opponent] ? 'online' : 'waiting'} />
      </div>

      {/* Clock */}
      {state.phase === 'playing' && (
        isTimeBankMode
          ? <DualClock timeBank={state.timeBank} turn={state.turn} you={state.you} />
          : <TurnTimer seconds={turnCountdown} total={state.turnSeconds} active={isYourTurn} />
      )}

      {/* Countdown */}
      {state.phase === 'countdown' && (
        <div className="countdown-card">Battle starts in {countdown}</div>
      )}

      {/* Flag win alert */}
      {state.pendingFlagWin && (
        <div className="mt-4 rounded-md border border-amber-300/50 bg-amber-300/10 p-3 text-sm text-amber-100">
          {state.pendingFlagWin.player.toUpperCase()} flag at enemy back row — wins next turn if it survives.
        </div>
      )}

      {/* Draw offer */}
      {state.drawOffer && state.drawOffer !== state.you && (
        <div className="mt-4 rounded-md border border-emerald-400/50 bg-emerald-400/10 p-3 text-sm text-emerald-100">
          Opponent offered a draw. <button onClick={onDraw} className="ml-2 font-bold underline">Accept</button>
        </div>
      )}

      {/* Fog rule reminder */}
      <div className="mt-4 rounded-md border border-stone-700/80 bg-stone-950/45 p-3 text-sm text-stone-300">
        <p className="mb-1 flex items-center gap-2 font-bold text-stone-100"><EyeOff size={14} /> House Fog Rule</p>
        Enemy ranks stay hidden until eliminated.
      </div>

      {/* Battle card */}
      {state.lastBattle && <BattleCard battle={state.lastBattle} />}

      {/* Action buttons */}
      <div className="mt-5 flex flex-wrap gap-2">
        {state.phase === 'setup' || state.phase === 'countdown' ? (
          <>
            <button onClick={onReady} className="command-button flex-1 bg-emerald-500 text-stone-950 hover:bg-emerald-400">
              <Shield size={14} /> Ready
            </button>
            <button title="Randomize" onClick={onRandomize} className="icon-button"><Shuffle size={16} /></button>
            <button title="Undo" onClick={onUndo} className="icon-button"><Undo2 size={16} /></button>
            <button title="Clear" onClick={onClear} className="icon-button"><RefreshCcw size={16} /></button>
          </>
        ) : (
          <>
            <button onClick={onDraw} className="command-button flex-1 bg-stone-700 text-stone-100 hover:bg-stone-600">
              <Handshake size={14} /> Draw
            </button>
            <button onClick={onResign} className="command-button flex-1 bg-red-500 text-white hover:bg-red-400">
              <Skull size={14} /> Resign
            </button>
          </>
        )}
      </div>

      {/* Leave game */}
      <button onClick={onLeave} className="leave-button mt-3 w-full">
        <LogOut size={14} /> Leave Game
      </button>

      {/* Status text */}
      <p className="mt-3 text-sm text-stone-400">{status}</p>

      {/* Quick reactions */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {['Whoa!', 'Sneaky!', 'Respect.', 'Again!'].map(text => (
          <button key={text} onClick={() => onReaction(text)} className="reaction-button">{text}</button>
        ))}
      </div>

      <Legend />
    </aside>
  );
}
