import React from 'react';
import { Swords, Eye, RotateCcw, Trophy, Zap, Shield, LogOut, FileText } from 'lucide-react';
import type { GameState } from '../types';

function PostGameStats({ state }: { state: GameState }) {
  const totalMoves = state.stats.moves.red + state.stats.moves.blue;
  const bluff = state.stats.biggestBluff;
  const mvp = state.stats.mvp;
  const survivor = state.stats.longestSurvivor;
  return (
    <div className="postgame-grid">
      <div className="rounded-md border p-3 border-stone-700 bg-stone-950/60">
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Moves</p>
        <p className="mt-1 font-bold">{totalMoves}</p>
      </div>
      <div className="rounded-md border p-3 border-stone-700 bg-stone-950/60">
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Challenges</p>
        <p className="mt-1 font-bold">{state.stats.challenges}</p>
      </div>
      <div className="rounded-md border p-3 border-stone-700 bg-stone-950/60">
        <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Spy KOs</p>
        <p className="mt-1 font-bold">{state.stats.spyKills.red + state.stats.spyKills.blue}</p>
      </div>
      <div className="postgame-card">
        <Trophy size={18} className="text-amber-300" />
        <span>MVP</span>
        <b>{mvp ? `${mvp.owner.toUpperCase()} ${mvp.code}` : 'No clear MVP'}</b>
        <small>{mvp ? `${mvp.wins} wins, ${mvp.moves} moves` : 'Quiet battlefield'}</small>
      </div>
      <div className="postgame-card">
        <Zap size={18} className="text-emerald-300" />
        <span>Biggest Bluff</span>
        <b>{bluff ? `${bluff.winnerOwner.toUpperCase()} SPY beat ${bluff.loserCode}` : 'No general fell to Spy'}</b>
        <small>{bluff ? bluff.loserName : 'Try a sneakier setup'}</small>
      </div>
      <div className="postgame-card">
        <Shield size={18} className="text-sky-300" />
        <span>Longest Survivor</span>
        <b>{survivor ? `${survivor.owner.toUpperCase()} ${survivor.code}` : 'No mover survived'}</b>
        <small>{survivor ? survivor.name : 'Pieces stayed cautious'}</small>
      </div>
    </div>
  );
}

interface WinScreenProps {
  state: GameState;
  onRevealAll: () => void;
  onRematch: () => void;
  onLeave: () => void;
  onAnalyze: () => void;
}

export function WinScreen({ state, onRevealAll, onRematch, onLeave, onAnalyze }: WinScreenProps) {
  const winnerText = state.winner ? `${state.winner.toUpperCase()} wins` : null;
  const isWinner = state.winner === state.you;

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/80 px-4">
      <div className={`victory-card ${isWinner ? 'winner' : 'defeated'}`}>
        <Swords className="mx-auto text-emerald-300" size={48} />
        <h2 className="mt-4 text-4xl font-black uppercase">{winnerText}</h2>
        <p className="mt-3 text-stone-300">{state.winReason}</p>

        <PostGameStats state={state} />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button onClick={onRevealAll} className="command-button bg-stone-200 text-stone-950 hover:bg-white">
            <Eye size={14} /> Reveal All
          </button>
          <button onClick={onAnalyze} className="command-button bg-stone-700 text-stone-100 hover:bg-stone-600">
            <FileText size={14} /> Game Record
          </button>
          <button onClick={onRematch} className="command-button bg-emerald-500 text-stone-950 hover:bg-emerald-400">
            <RotateCcw size={14} /> Rematch
          </button>
          <button onClick={onLeave} className="command-button bg-stone-800 text-stone-300 hover:bg-stone-700">
            <LogOut size={14} /> Exit Game
          </button>
        </div>

        <p className="mt-4 text-sm uppercase tracking-[0.25em] text-stone-500">
          Rematch: Red {state.rematchReady.red ? '✓ ready' : 'waiting'} | Blue {state.rematchReady.blue ? '✓ ready' : 'waiting'}
        </p>
      </div>
    </div>
  );
}
