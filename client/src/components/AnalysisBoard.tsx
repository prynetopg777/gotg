import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GameState } from '../types';

interface AnalysisBoardProps {
  state: GameState;
  onClose: () => void;
}

export function AnalysisBoard({ state, onClose }: AnalysisBoardProps) {
  const moves = [...state.history].reverse(); // oldest first
  const [cursor, setCursor] = useState(moves.length - 1);

  const current = moves[cursor] || null;

  function kindClass(kind: string) {
    if (kind === 'capture') return 'text-red-300';
    if (kind === 'win') return 'text-amber-300';
    if (kind === 'system') return 'text-stone-500 italic';
    return 'text-stone-300';
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4 overflow-y-auto py-6">
      <div className="modal-card max-w-2xl w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Game Record</p>
            <h2 className="mt-1 text-2xl font-black uppercase">Room {state.code}</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={18} /></button>
        </div>

        {/* Move navigator */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setCursor(0)}
            disabled={cursor === 0}
            className="icon-button"
            title="First move"
          >|◀</button>
          <button
            onClick={() => setCursor(c => Math.max(0, c - 1))}
            disabled={cursor === 0}
            className="icon-button"
          ><ChevronLeft size={16} /></button>
          <span className="flex-1 text-center text-sm text-stone-400">
            Move {cursor + 1} / {moves.length}
          </span>
          <button
            onClick={() => setCursor(c => Math.min(moves.length - 1, c + 1))}
            disabled={cursor >= moves.length - 1}
            className="icon-button"
          ><ChevronRight size={16} /></button>
          <button
            onClick={() => setCursor(moves.length - 1)}
            disabled={cursor >= moves.length - 1}
            className="icon-button"
            title="Last move"
          >▶|</button>
        </div>

        {/* Highlighted current move */}
        {current && (
          <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-400/8 p-3 text-sm">
            <span className="font-mono text-stone-500 mr-3">{current.at}</span>
            <span className={kindClass(current.kind)}>{current.text}</span>
          </div>
        )}

        {/* Full move list */}
        <div className="history max-h-96 overflow-auto">
          {moves.map((entry, i) => (
            <div
              key={entry.id}
              onClick={() => setCursor(i)}
              className={`history-row cursor-pointer rounded px-2 transition-colors ${i === cursor ? 'bg-emerald-400/12 border-emerald-400/30' : 'hover:bg-stone-800/40'}`}
            >
              <span className="text-stone-600 text-xs mr-2">{i + 1}.</span>
              <span className="font-mono text-stone-500">{entry.at}</span>
              <span className={kindClass(entry.kind)}>{entry.text}</span>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 border-t border-stone-700/50 pt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-wider">Moves</p>
            <p className="font-bold">{state.stats.moves.red + state.stats.moves.blue}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-wider">Challenges</p>
            <p className="font-bold">{state.stats.challenges}</p>
          </div>
          <div>
            <p className="text-stone-500 text-xs uppercase tracking-wider">Result</p>
            <p className="font-bold">{state.winner ? `${state.winner.toUpperCase()} wins` : 'In progress'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
