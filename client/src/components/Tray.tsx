import React from 'react';
import { Shuffle, Undo2, RefreshCcw } from 'lucide-react';
import { PieceToken } from './PieceToken';
import type { BoardTheme, GameState } from '../types';

interface TrayProps {
  state: GameState;
  selected: string | null;
  textRanks: boolean;
  boardTheme: BoardTheme;
  placementStrategy: 'balanced' | 'aggressive' | 'defensive';
  setPlacementStrategy: (s: 'balanced' | 'aggressive' | 'defensive') => void;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onRandomize: () => void;
  onUndo: () => void;
  onClear: () => void;
}

export function Tray({
  state, selected, textRanks, boardTheme, placementStrategy, setPlacementStrategy,
  onSelect, onDragStart, onRandomize, onUndo, onClear,
}: TrayProps) {
  if (state.phase !== 'setup' && state.phase !== 'countdown') return null;

  return (
    <div className="tray-panel">
      <div className="tray-header">
        <p className="eyebrow">Reserve Tray</p>
        <div className="tray-actions">
          <select
            value={placementStrategy}
            onChange={e => setPlacementStrategy(e.target.value as 'balanced' | 'aggressive' | 'defensive')}
            className="strategy-select"
          >
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
            <option value="defensive">Defensive</option>
          </select>
          <button onClick={onRandomize} className="small-action"><Shuffle size={14} /> Randomize</button>
          <button onClick={onUndo} className="small-action"><Undo2 size={14} /> Undo</button>
          <button onClick={onClear} className="small-action"><RefreshCcw size={14} /> Clear</button>
        </div>
      </div>
      <div className="tray">
        {state.tray.map(piece => (
          <button
            key={piece.id}
            draggable
            title={`${piece.name}`}
            onClick={() => onSelect(piece.id)}
            onDragStart={() => onDragStart(piece.id)}
            className={`tray-piece ${selected === piece.id ? 'ring-2 ring-emerald-300' : ''}`}
          >
            <PieceToken piece={piece} compact textRanks={textRanks} boardTheme={boardTheme} />
          </button>
        ))}
      </div>
    </div>
  );
}
