import React, { useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { PieceToken } from './PieceToken';
import type { GameState, BoardTheme } from '../types';

const cols = Array.from({ length: 9 }, (_, c) => c);
const rows = Array.from({ length: 8 }, (_, r) => r);
const columns = 'ABCDEFGHI'.split('');

interface BoardProps {
  state: GameState;
  selected: string | null;
  legalMoves: Set<string>;
  boardTheme: BoardTheme;
  customBoardImg: string | null;
  textRanks: boolean;
  zoom: number;
  setZoom: (fn: (v: number) => number) => void;
  preMove: string | null;
  onSquareClick: (row: number, col: number) => void;
  onDragStart: (pieceId: string) => void;
  onDrop: (row: number, col: number) => void;
}

const BOARD_THEME_VARS: Record<string, { sqA: string; sqB: string; bg: string; border: string }> = {
  classic:  { sqA: '#7b6a45', sqB: '#29351f', bg: '#2a3020', border: '#d6d3d1' },
  forest:   { sqA: '#d7f0b2', sqB: '#166534', bg: '#0f2c1b', border: '#86efac' },
  midnight: { sqA: '#0b1021', sqB: '#5eead4', bg: '#020617', border: '#67e8f9' },
  sand:     { sqA: '#f5d06f', sqB: '#8b4513', bg: '#5f371a', border: '#fde68a' },
  marble:   { sqA: '#f8fafc', sqB: '#64748b', bg: '#cbd5e1', border: '#1e293b' },
  crimson:  { sqA: '#ffedd5', sqB: '#7f1d1d', bg: '#250707', border: '#fb7185' },
  custom:   { sqA: 'rgba(0,0,0,0.42)', sqB: 'rgba(255,255,255,0.2)', bg: 'transparent', border: '#a7f3d0' },
};

export function Board({
  state, selected, legalMoves, boardTheme, customBoardImg, textRanks, zoom, setZoom,
  preMove, onSquareClick, onDragStart, onDrop,
}: BoardProps) {
  const orientedRows = state.you === 'red' ? rows : [...rows].reverse();
  const setupRows = state.you === 'red' ? [5, 6, 7] : [0, 1, 2];
  const themeVars = BOARD_THEME_VARS[boardTheme] || BOARD_THEME_VARS.classic;

  const boardStyle: React.CSSProperties = {
    background: boardTheme === 'custom' && customBoardImg
      ? `url(${customBoardImg}) center/cover`
      : themeVars.bg,
    borderColor: themeVars.border,
    '--board-zoom': zoom,
  } as React.CSSProperties;

  const boardRef = useRef<HTMLDivElement>(null);
  const battleClass = state.lastBattle ? `battle-${state.lastBattle.special || state.lastBattle.outcome}` : '';

  // Keyboard navigation
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    el.focus();
  }, [selected]);

  return (
    <div>
      {/* Zoom controls */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'flex-end' }}>
        <button title="Zoom out (R)" onClick={() => setZoom(v => Math.max(0.72, v - 0.08))} className="icon-button">
          <ZoomOut size={18} />
        </button>
        <button title="Zoom in" onClick={() => setZoom(v => Math.min(1.2, v + 0.08))} className="icon-button">
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="board-scroll">
        <div
          className={`board-wrap board-theme-${boardTheme} ${state.lastBattle ? 'battle-shake' : ''}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', ...boardStyle }}
          ref={boardRef}
          tabIndex={-1}
        >
          {/* Column labels */}
          <div className="file-labels">
            {columns.map(c => <span key={c}>{c}</span>)}
          </div>

          {/* Board grid */}
          <div className="board" style={{ borderColor: themeVars.border }}>
            {orientedRows.map((row, rowIdx) =>
              cols.map((col) => {
                const piece = state.board[row][col];
                const key = `${row}:${col}`;
                const cellIndex = rowIdx * 9 + col;
                const isLight = (rowIdx + col) % 2 === 0;
                const isSetup = (state.phase === 'setup' || state.phase === 'countdown') && setupRows.includes(row);
                const isLegal = legalMoves.has(key);
                const isSelected = piece?.id === selected;
                const isPreMove = piece?.id === preMove && !isSelected;
                const lastMove = state.lastMove && (
                  (state.lastMove.from.row === row && state.lastMove.from.col === col) ||
                  (state.lastMove.to.row === row && state.lastMove.to.col === col)
                );
                const isBattleSquare = state.lastBattle?.at.row === row && state.lastBattle.at.col === col;

                const squareBg = boardTheme === 'custom' && customBoardImg
                  ? isLight ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.18)'
                  : isLight ? themeVars.sqA : themeVars.sqB;

                return (
                  <button
                    key={key}
                    aria-label={`${columns[col]}${row + 1}${piece ? ` occupied` : ''}`}
                    data-cell={cellIndex}
                    className={[
                      'square',
                      isSetup ? 'setup-zone' : '',
                      isLegal ? 'legal' : '',
                      isSelected ? 'selected' : '',
                      isPreMove ? 'premove' : '',
                      lastMove ? 'last-move' : '',
                      isBattleSquare ? `battle-impact ${battleClass}` : '',
                    ].join(' ')}
                    style={{ background: squareBg }}
                    onClick={() => onSquareClick(row, col)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => { onSquareClick(row, col); onDrop(row, col); }}
                  >
                    <span className="rank-label">{col === 0 ? row + 1 : ''}</span>
                    {piece && (
                      <PieceToken
                        piece={piece}
                        textRanks={textRanks}
                        boardTheme={boardTheme}
                        draggable={piece.owner === state.you && (state.phase === 'setup' || state.phase === 'countdown')}
                        onDragStart={() => onDragStart(piece.id)}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
