import React, { useState } from 'react';
import { X, User, Lock, LogIn, UserPlus } from 'lucide-react';
import type { User as UserType } from '../types';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

interface AccountModalProps {
  onClose: () => void;
  onLogin: (user: UserType, token: string) => void;
}

export function AccountModal({ onClose, onLogin }: AccountModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('Fill in all fields.');
    if (tab === 'register' && password !== confirm) return setError('Passwords do not match.');
    if (username.length < 3) return setError('Username must be at least 3 characters.');

    setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      window.localStorage.setItem('gotg-token', data.token);
      onLogin(data.user, data.token);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4">
      <div className="modal-card max-w-sm w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">Account</p>
            <h2 className="mt-1 text-2xl font-black uppercase">{tab === 'login' ? 'Sign In' : 'Register'}</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={18} /></button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-5 p-1 rounded-lg bg-stone-900 border border-stone-700">
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-bold uppercase transition-colors ${tab === t ? 'bg-emerald-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'}`}
            >
              {t === 'login' ? 'Login' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="grid gap-3">
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              maxLength={20}
              className="w-full rounded-md border border-stone-700 bg-stone-950 pl-9 pr-3 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border border-stone-700 bg-stone-950 pl-9 pr-3 py-3 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          {tab === 'register' && (
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-md border border-stone-700 bg-stone-950 pl-9 pr-3 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <button type="submit" disabled={loading} className="command-button bg-emerald-500 text-stone-950 hover:bg-emerald-400 w-full mt-1">
            {tab === 'login' ? <LogIn size={14} /> : <UserPlus size={14} />}
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-stone-500">
          {tab === 'login'
            ? "Don't have an account? Click Register above."
            : 'Play as a guest anytime — accounts unlock rankings.'}
        </p>
      </div>
    </div>
  );
}
