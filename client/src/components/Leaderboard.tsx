import React, { useEffect, useState } from 'react';
import { Trophy, RefreshCcw, X } from 'lucide-react';
import type { LeaderboardEntry } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

interface LeaderboardProps {
  onClose: () => void;
}

export function Leaderboard({ onClose }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/leaderboard`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setEntries(data.entries || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load leaderboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function eloColor(elo: number) {
    if (elo >= 1400) return 'text-amber-300';
    if (elo >= 1200) return 'text-emerald-300';
    if (elo >= 1000) return 'text-stone-200';
    return 'text-stone-400';
  }

  function rankMedal(rank: number) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4 overflow-y-auto py-6">
      <div className="modal-card max-w-lg w-full">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow">Hall of Honor</p>
            <h2 className="mt-1 text-2xl font-black uppercase flex items-center gap-2">
              <Trophy size={22} className="text-amber-300" /> Leaderboard
            </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="icon-button" title="Refresh"><RefreshCcw size={16} /></button>
            <button onClick={onClose} className="icon-button"><X size={18} /></button>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12 text-stone-400 text-sm">Loading rankings…</div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400 text-sm">{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-12 text-stone-400 text-sm">
            No ranked players yet. Create an account and play a game to appear here!
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-700/60 text-left">
                <th className="pb-3 text-xs uppercase tracking-wider text-stone-500 w-10">#</th>
                <th className="pb-3 text-xs uppercase tracking-wider text-stone-500">Player</th>
                <th className="pb-3 text-xs uppercase tracking-wider text-stone-500 text-right">ELO</th>
                <th className="pb-3 text-xs uppercase tracking-wider text-stone-500 text-right">W</th>
                <th className="pb-3 text-xs uppercase tracking-wider text-stone-500 text-right">L</th>
                <th className="pb-3 text-xs uppercase tracking-wider text-stone-500 text-right">D</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.username} className="border-b border-stone-800/50 hover:bg-stone-900/40 transition-colors">
                  <td className="py-3 text-stone-500 font-mono text-xs">{rankMedal(e.rank)}</td>
                  <td className="py-3 font-bold text-stone-100">{e.username}</td>
                  <td className={`py-3 text-right font-black ${eloColor(e.elo)}`}>{e.elo}</td>
                  <td className="py-3 text-right text-emerald-400">{e.wins}</td>
                  <td className="py-3 text-right text-red-400">{e.losses}</td>
                  <td className="py-3 text-right text-stone-500">{e.draws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-4 text-xs text-stone-600 text-center">
          ELO-based ranking. Gain points by winning, lose by losing. Starting ELO: 1000.
        </p>
      </div>
    </div>
  );
}
