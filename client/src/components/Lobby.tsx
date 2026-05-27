import React from 'react';
import { Shield, Flag, HelpCircle, Trophy, User, LogOut } from 'lucide-react';
import type { User as UserType } from '../types';

interface LobbyProps {
  roomCode: string;
  setRoomCode: (v: string) => void;
  status: string;
  currentUser: UserType | null;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  onOpenTutorial: () => void;
  onOpenAccount: () => void;
  onOpenLeaderboard: () => void;
  onLogout: () => void;
  onAvatarUpload: (file: File) => void;
}

export function Lobby({
  roomCode, setRoomCode, status, currentUser,
  onCreateRoom, onJoinRoom, onOpenTutorial, onOpenAccount, onOpenLeaderboard, onLogout, onAvatarUpload,
}: LobbyProps) {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-10">

        {/* Top bar */}
        <div className="mb-8 flex items-center justify-end gap-3">
          {currentUser ? (
            <>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-700 bg-stone-900/70 px-4 py-2 hover:border-emerald-400/70">
                <span className="profile-avatar small">
                  {currentUser.avatar ? <img src={currentUser.avatar} alt="" /> : <User size={14} />}
                </span>
                <span className="text-sm font-bold">{currentUser.username}</span>
                <span className="text-xs text-amber-300 font-mono ml-1">{currentUser.elo} ELO</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onAvatarUpload(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <button onClick={onOpenLeaderboard} className="icon-button" title="Leaderboard">
                <Trophy size={18} />
              </button>
              <button onClick={onLogout} className="icon-button" title="Sign out">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <button onClick={onOpenLeaderboard} className="icon-button" title="Leaderboard">
                <Trophy size={18} />
              </button>
              <button
                onClick={onOpenAccount}
                className="command-button border border-stone-600 bg-stone-800 text-stone-100 hover:bg-stone-700"
              >
                <User size={14} /> Sign In / Register
              </button>
            </>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          {/* Hero section */}
          <section>
            <div className="mb-5 flex items-center gap-3 text-emerald-300">
              <Shield size={28} />
              <span className="text-sm font-bold uppercase tracking-[0.3em]">Local Network Command</span>
            </div>
            <h1 className="font-display text-6xl uppercase leading-none text-stone-50 sm:text-7xl">
              Game of the Generals
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-stone-300">
              Secret ranks, ruthless bluffs, and one flag trying to cross the line.
            </p>

            {/* Feature pills */}
            <div className="mt-6 flex flex-wrap gap-2">
              {['6 Board Themes', 'Piece Icons', 'ELO Rankings', 'Fischer Clock', 'Spectator Mode', 'Game Record Export'].map(f => (
                <span key={f} className="rounded-full border border-stone-700 bg-stone-900/50 px-3 py-1 text-xs text-stone-400">
                  {f}
                </span>
              ))}
            </div>
          </section>

          {/* Action panel */}
          <section className="rounded-lg border border-stone-700 bg-stone-900/85 p-5 shadow-command">
            <button onClick={onCreateRoom} className="command-button w-full bg-emerald-500 text-stone-950 hover:bg-emerald-400">
              <Flag size={18} /> Create Room
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-stone-700" />
              <span className="text-xs uppercase tracking-[0.25em] text-stone-500">or join</span>
              <div className="h-px flex-1 bg-stone-700" />
            </div>

            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && onJoinRoom()}
                placeholder="Room code"
                maxLength={6}
                className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-950 px-3 py-3 font-mono uppercase text-stone-100 outline-none focus:border-emerald-400"
              />
              <button onClick={onJoinRoom} className="command-button bg-stone-200 text-stone-950 hover:bg-white">
                Join
              </button>
            </div>

            {/* Spectator join */}
            <div className="mt-3 flex gap-2">
              <input
                placeholder="Watch room code"
                maxLength={6}
                id="spectator-code"
                className="min-w-0 flex-1 rounded-md border border-stone-700/60 bg-stone-950/60 px-3 py-2 font-mono uppercase text-stone-400 text-sm outline-none focus:border-stone-500"
              />
              <button
                onClick={() => {
                  const el = document.getElementById('spectator-code') as HTMLInputElement;
                  if (el?.value) {
                    setRoomCode(el.value.toUpperCase());
                    // Spectator join handled in parent via custom event
                    const evt = new CustomEvent('gotg:spectate', { detail: el.value.toUpperCase() });
                    window.dispatchEvent(evt);
                  }
                }}
                className="command-button bg-stone-700 text-stone-300 hover:bg-stone-600 text-sm"
              >
                Watch
              </button>
            </div>

            <div className="mt-4 flex gap-2 text-sm">
              <button onClick={onOpenTutorial} className="flex items-center gap-2 text-emerald-200 hover:text-white">
                <HelpCircle size={14} /> Rules & fog variant
              </button>
            </div>

            <p className="mt-4 text-sm text-stone-400">{status}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
