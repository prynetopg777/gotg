import React from 'react';
import type { BoardTheme } from '../types';

interface ThemeSwatchProps {
  id: BoardTheme;
  label: string;
  sqA: string;
  sqB: string;
  border: string;
  active: boolean;
  onClick: () => void;
}

function ThemeSwatch({ id, label, sqA, sqB, border, active, onClick }: ThemeSwatchProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '8px',
        borderRadius: 8,
        border: active ? '2px solid rgb(110, 231, 183)' : '2px solid transparent',
        background: active ? 'rgba(110, 231, 183, 0.08)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 140ms ease',
      }}
    >
      {/* Mini board preview: 4×3 grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 14px)',
        gridTemplateRows: 'repeat(3, 14px)',
        border: `2px solid ${border}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {Array.from({ length: 12 }, (_, i) => {
          const row = Math.floor(i / 4);
          const col = i % 4;
          const isLight = (row + col) % 2 === 0;
          return (
            <div key={i} style={{ background: isLight ? sqA : sqB, width: 14, height: 14 }} />
          );
        })}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'rgb(110, 231, 183)' : 'rgb(168, 162, 158)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </span>
    </button>
  );
}

const THEMES: { id: BoardTheme; label: string; sqA: string; sqB: string; border: string }[] = [
  { id: 'classic',  label: 'Classic',  sqA: '#7b6a45', sqB: '#29351f', border: '#d6d3d1' },
  { id: 'forest',   label: 'Forest',   sqA: '#d7f0b2', sqB: '#166534', border: '#86efac' },
  { id: 'midnight', label: 'Midnight', sqA: '#0b1021', sqB: '#5eead4', border: '#67e8f9' },
  { id: 'sand',     label: 'Sand',     sqA: '#f5d06f', sqB: '#8b4513', border: '#fde68a' },
  { id: 'marble',   label: 'Marble',   sqA: '#f8fafc', sqB: '#64748b', border: '#1e293b' },
  { id: 'crimson',  label: 'Crimson',  sqA: '#ffedd5', sqB: '#7f1d1d', border: '#fb7185' },
  { id: 'custom',   label: 'Custom',   sqA: 'rgba(0,0,0,0.42)', sqB: 'rgba(255,255,255,0.2)', border: '#a7f3d0' },
];

interface ThemePickerProps {
  current: BoardTheme;
  customImg: string | null;
  onChange: (theme: BoardTheme) => void;
  onCustomImg: (dataUrl: string) => void;
}

export function ThemePicker({ current, customImg, onChange, onCustomImg }: ThemePickerProps) {
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        onCustomImg(result);
        onChange('custom');
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
        marginBottom: 10,
      }}>
        {THEMES.map(t => (
          <ThemeSwatch
            key={t.id}
            {...t}
            active={current === t.id}
            onClick={() => onChange(t.id)}
          />
        ))}
      </div>

      {current === 'custom' && (
        <div style={{ marginTop: 8 }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderRadius: 6,
            border: '1px dashed rgba(110,231,183,0.4)',
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: 13,
            color: 'rgb(167,243,208)',
          }}>
            <span>📁 Upload board image</span>
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
          {customImg && (
            <div style={{ marginTop: 8, borderRadius: 6, overflow: 'hidden', height: 60 }}>
              <img src={customImg} alt="Custom board" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { THEMES };
