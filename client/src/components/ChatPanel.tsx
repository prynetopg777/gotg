import React from 'react';
import { MessageSquare, Download } from 'lucide-react';
import type { BoardTheme, GameState, Piece } from '../types';
import { PieceToken } from './PieceToken';

function Captured({ title, pieces, boardTheme }: { title: string; pieces: Piece[]; boardTheme: BoardTheme }) {
  return (
    <div className="mt-2">
      <p className="eyebrow mb-2">{title}</p>
      <div className="captured">
        {pieces.length ? pieces.map(p => (
          <span key={p.id} title={p.name} className="captured-token">
            <PieceToken piece={p} compact textRanks={false} boardTheme={boardTheme} />
          </span>
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
        {items.length ? items.map(e => (
          <div key={e.id} className="history-row">
            <span className="font-mono text-stone-500">{e.at}</span>
            <span>{e.text}</span>
          </div>
        )) : <span className="text-sm text-stone-500">No entries yet</span>}
      </div>
    </div>
  );
}

interface ChatPanelProps {
  state: GameState;
  boardTheme: BoardTheme;
  chatText: string;
  setChatText: (v: string) => void;
  onSendChat: (text?: string) => void;
}

export function ChatPanel({ state, boardTheme, chatText, setChatText, onSendChat }: ChatPanelProps) {
  const moveCount = state.stats.moves.red + state.stats.moves.blue;
  const profileFor = (player: 'red' | 'blue') => state.profiles[player];

  function exportRecord() {
    const lines = [
      `Game of the Generals — Room ${state.code}`,
      `Result: ${state.winner ? `${state.winner.toUpperCase()} wins — ${state.winReason}` : 'In progress'}`,
      `Moves: ${moveCount} | Challenges: ${state.stats.challenges}`,
      '',
      '=== Move History ===',
      ...state.history.slice().reverse().map(h => `[${h.at}] ${h.text}`),
      '',
      '=== Eliminated ===',
      ...state.eliminatedLog.slice().reverse().map(e => `[${e.at}] ${e.owner.toUpperCase()} ${e.code} — ${e.reason}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gotg-${state.code}.txt`;
    a.click();
  }

  return (
    <aside className="panel order-3">
      <Captured title="Captured Red" pieces={state.captured.red} boardTheme={boardTheme} />
      <Captured title="Captured Blue" pieces={state.captured.blue} boardTheme={boardTheme} />

      <div className="mt-5 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md border p-3 border-stone-700 bg-stone-950/60">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Moves</p>
          <p className="mt-1 font-bold uppercase">{moveCount}</p>
        </div>
        <div className="rounded-md border p-3 border-stone-700 bg-stone-950/60">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Clashes</p>
          <p className="mt-1 font-bold uppercase">{state.stats.challenges}</p>
        </div>
        <div className="rounded-md border p-3 border-stone-700 bg-stone-950/60">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">Spy KOs</p>
          <p className="mt-1 font-bold uppercase">{state.stats.spyKills.red + state.stats.spyKills.blue}</p>
        </div>
      </div>

      <Log
        title="Move History"
        items={state.history.map(e => ({ id: e.id, at: e.at, text: e.text }))}
      />
      <Log
        title="Eliminated"
        items={state.eliminatedLog.map(e => ({ id: e.id, at: e.at, text: `${e.owner.toUpperCase()} ${e.code} — ${e.reason}` }))}
      />

      {/* Export game record */}
      <button onClick={exportRecord} className="small-action mt-4 w-full justify-center">
        <Download size={13} /> Export game record
      </button>

      {/* Chat */}
      <div className="mt-5">
        <p className="eyebrow mb-3 flex items-center gap-2"><MessageSquare size={14} /> Chat</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {['Nice try!', 'That was sneaky!', 'My heart skipped!', 'Well played!', 'Spy time!'].map(preset => (
            <button key={preset} onClick={() => onSendChat(preset)} className="preset-chat">{preset}</button>
          ))}
        </div>
        <div className="chat-box">
          {state.chat.map(m => (
            <div key={m.id} className={`chat-row ${m.reaction ? 'reaction-row' : ''}`}>
              <span className={`chat-avatar ${m.player}`}>
                {profileFor(m.player).avatar ? <img src={profileFor(m.player).avatar || ''} alt="" /> : profileFor(m.player).username.slice(0, 1)}
              </span>
              <span className={`chat-player ${m.player}`}>{profileFor(m.player).username}</span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
        <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); onSendChat(); }}>
          <input
            value={chatText}
            onChange={e => setChatText(e.target.value)}
            maxLength={80}
            placeholder="Send a message"
            className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm outline-none focus:border-emerald-400"
          />
          <button className="command-button bg-emerald-500 px-3 text-stone-950">Send</button>
        </form>
      </div>
    </aside>
  );
}
