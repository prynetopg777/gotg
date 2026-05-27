import React from 'react';
import { Flag, Eye, ChevronUp } from 'lucide-react';
import type { BoardTheme, Piece } from '../types';

// ── SVG Icon components ────────────────────────────────────────────────

function StarRow({ count }: { count: number }) {
  const w = count * 13 - 1;
  return (
    <svg viewBox={`0 0 ${w} 12`} width={w} height={12} style={{ display: 'block' }}>
      {Array.from({ length: count }, (_, i) => {
        const cx = i * 13 + 6;
        return (
          <polygon
            key={i}
            points={`${cx},1 ${cx+1.8},4.4 ${cx+5.5},4.8 ${cx+2.7},7.4 ${cx+3.6},11 ${cx},9.1 ${cx-3.6},11 ${cx-2.7},7.4 ${cx-5.5},4.8 ${cx-1.8},4.4`}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

function Bars({ count, diamond = false }: { count: number; diamond?: boolean }) {
  const h = count * 4 - 1;
  return (
    <svg viewBox={`0 0 18 ${h}`} width={18} height={h} style={{ display: 'block' }}>
      {Array.from({ length: count }, (_, i) =>
        diamond ? (
          <polygon
            key={i}
            points={`9,${i*4} 16,${i*4+1.5} 9,${i*4+3} 2,${i*4+1.5}`}
            fill="currentColor"
          />
        ) : (
          <rect key={i} x={0} y={i * 4} width={18} height={2.5} rx={1.2} fill="currentColor" />
        )
      )}
    </svg>
  );
}

function Chevrons({ count }: { count: number }) {
  const h = count * 5 + 1;
  return (
    <svg viewBox={`0 0 18 ${h}`} width={18} height={h} style={{ display: 'block' }}>
      {Array.from({ length: count }, (_, i) => (
        <polyline
          key={i}
          points={`0,${i*5+4} 9,${i*5} 18,${i*5+4}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function CrossedBars() {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} style={{ display: 'block' }}>
      <rect x={0} y={3} width={18} height={2.5} rx={1.2} fill="currentColor" />
      <rect x={0} y={8} width={18} height={2.5} rx={1.2} fill="currentColor" />
      <circle cx={9} cy={14} r={2.5} fill="currentColor" />
    </svg>
  );
}

function SingleBarPip({ pips }: { pips: number }) {
  return (
    <svg viewBox="0 0 18 12" width={18} height={12} style={{ display: 'block' }}>
      <rect x={0} y={0} width={18} height={2.5} rx={1.2} fill="currentColor" />
      {Array.from({ length: pips }, (_, i) => (
        <circle key={i} cx={5 + i * 8} cy={8} r={2.5} fill="currentColor" />
      ))}
    </svg>
  );
}

function EagleShield() {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} style={{ display: 'block' }}>
      <path d="M9,1 L16,4 L16,10 Q16,15 9,17 Q2,15 2,10 L2,4 Z" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <rect x={2} y={6} width={14} height={2} rx={1} fill="currentColor" />
      <rect x={2} y={9.5} width={14} height={2} rx={1} fill="currentColor" />
      <circle cx={9} cy={3.5} r={1.8} fill="currentColor" />
    </svg>
  );
}

export function PieceIcon({ code }: { code: string }) {
  if (code === '5G') return <StarRow count={5} />;
  if (code === '4G') return <StarRow count={4} />;
  if (code === '3G') return <StarRow count={3} />;
  if (code === '2G') return <StarRow count={2} />;
  if (code === '1G') return <StarRow count={1} />;
  if (code === 'COL') return <EagleShield />;
  if (code === 'LTC') return <Bars count={3} diamond />;
  if (code === 'MAJ') return <Bars count={2} diamond />;
  if (code === 'CPT') return <CrossedBars />;
  if (code === '1LT') return <SingleBarPip pips={1} />;
  if (code === '2LT') return <Bars count={1} />;
  if (code === 'SGT') return <Chevrons count={3} />;
  if (code === 'SPY') return <Eye size={16} />;
  if (code === 'PVT') return <ChevronUp size={16} />;
  if (code === 'FLG') return <Flag size={16} />;
  return <span style={{ fontSize: 12, fontWeight: 900 }}>{code}</span>;
}

// ── Main PieceToken ────────────────────────────────────────────────────

interface PieceTokenProps {
  piece: Piece;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  textRanks: boolean;
  boardTheme?: BoardTheme;
}

export function PieceToken({ piece, compact = false, draggable = false, onDragStart, textRanks, boardTheme = 'classic' }: PieceTokenProps) {
  const hidden = !piece.visible;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      title={piece.visible ? `${piece.name}: ${ruleText(piece.code)}` : 'Unknown enemy piece. Rank is revealed only if eliminated.'}
      className={`piece-token ${piece.owner} piece-theme-${boardTheme} ${hidden ? 'hidden-piece' : ''} ${compact ? 'compact' : ''}`}
    >
      {hidden ? (
        <span className="piece-code">◆</span>
      ) : (
        <>
          <span className="piece-icon"><PieceIcon code={piece.code} /></span>
          {textRanks && <span className="piece-code">{piece.code}</span>}
          {!compact && <span className="piece-name">{piece.name}</span>}
        </>
      )}
    </div>
  );
}

export function ruleText(code: string): string {
  if (code === 'SPY') return 'Beats all pieces except Private.';
  if (code === 'PVT') return 'Beats Spy and loses to normal ranks.';
  if (code === 'FLG') return 'Loses to everything. Reach the enemy back row to threaten victory.';
  return 'Higher normal rank wins. Same rank eliminates both.';
}
