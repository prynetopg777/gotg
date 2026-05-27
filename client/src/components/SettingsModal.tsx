import React, { useState } from 'react';
import {
  Volume2, VolumeX, Sun, Moon, Shield, Flag, X,
} from 'lucide-react';
import { ThemePicker } from './ThemePicker';
import type { AnimationSpeed, BoardTheme, SoundPack } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  soundPack: SoundPack;
  setSoundPack: (v: SoundPack) => void;
  lightMode: boolean;
  setLightMode: (v: boolean) => void;
  colorblind: boolean;
  setColorblind: (v: boolean) => void;
  textRanks: boolean;
  setTextRanks: (v: boolean) => void;
  animationSpeed: AnimationSpeed;
  setAnimationSpeed: (v: AnimationSpeed) => void;
  showCoords: boolean;
  setShowCoords: (v: boolean) => void;
  boardTheme: BoardTheme;
  setBoardTheme: (v: BoardTheme) => void;
  customBoardImg: string | null;
  setCustomBoardImg: (v: string) => void;
  turnSeconds: number;
  increment: number;
  revealMode: 'hidden' | 'classic';
  updateServer: (payload: { turnSeconds?: number; revealMode?: 'hidden' | 'classic'; increment?: number }) => void;
}

function Toggle({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting-row">
      <span className="flex items-center gap-2">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'h-4 w-4' })}
        {label}
      </span>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

export function SettingsModal(props: SettingsModalProps) {
  const [turnSeconds, setTurnSeconds] = useState(props.turnSeconds);
  const [increment, setIncrement] = useState(props.increment);
  const [revealMode, setRevealMode] = useState(props.revealMode);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4 overflow-y-auto py-6">
      <div className="modal-card max-w-lg w-full">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="eyebrow">Settings</p>
            <h2 className="mt-1 text-2xl font-black uppercase">Table Feel</h2>
          </div>
          <button onClick={props.onClose} className="icon-button"><X size={18} /></button>
        </div>

        <div className="mt-5 grid gap-3">
          {/* Sound pack */}
          <label className="setting-row">
            <span className="flex items-center gap-2">
              {props.soundPack === 'off' ? <VolumeX size={16} /> : <Volume2 size={16} />}
              Sound pack
            </span>
            <select
              value={props.soundPack}
              onChange={e => props.setSoundPack(e.target.value as SoundPack)}
            >
              <option value="off">Off</option>
              <option value="classic">Classic beeps</option>
              <option value="tactical">Tactical</option>
            </select>
          </label>

          <Toggle label="Light mode" icon={props.lightMode ? <Sun /> : <Moon />} value={props.lightMode} onChange={props.setLightMode} />
          <Toggle label="Colorblind-friendly borders" icon={<Shield />} value={props.colorblind} onChange={props.setColorblind} />
          <Toggle label="Show ranks as text" icon={<Flag />} value={props.textRanks} onChange={props.setTextRanks} />
          <Toggle label="Show board coordinates" icon={<Shield />} value={props.showCoords} onChange={props.setShowCoords} />

          <label className="setting-row">
            <span>Animation speed</span>
            <select value={props.animationSpeed} onChange={e => props.setAnimationSpeed(e.target.value as AnimationSpeed)}>
              <option value="calm">Calm</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </label>

          {/* Turn timer */}
          <label className="setting-row">
            <span>Turn timer</span>
            <select value={turnSeconds} onChange={e => {
              const v = Number(e.target.value);
              setTurnSeconds(v);
              props.updateServer({ turnSeconds: v });
            }}>
              {[30, 60, 90, 120, 180].map(s => <option key={s} value={s}>{s}s</option>)}
            </select>
          </label>

          {/* Increment (Fischer time control) */}
          <label className="setting-row">
            <span>Clock increment (Fischer)</span>
            <select value={increment} onChange={e => {
              const v = Number(e.target.value);
              setIncrement(v);
              props.updateServer({ increment: v });
            }}>
              {[0, 2, 5, 10, 15, 30].map(s => <option key={s} value={s}>{s === 0 ? 'Off' : `+${s}s`}</option>)}
            </select>
          </label>

          {/* Reveal rule */}
          <label className="setting-row">
            <span>Reveal rule</span>
            <select value={revealMode} onChange={e => {
              const v = e.target.value as 'hidden' | 'classic';
              setRevealMode(v);
              props.updateServer({ revealMode: v });
            }}>
              <option value="hidden">Hidden until eliminated</option>
              <option value="classic">Classic challenge reveal</option>
            </select>
          </label>
        </div>

        {/* Board theme */}
        <div className="mt-6">
          <p className="eyebrow mb-3">Board Theme</p>
          <ThemePicker
            current={props.boardTheme}
            customImg={props.customBoardImg}
            onChange={props.setBoardTheme}
            onCustomImg={props.setCustomBoardImg}
          />
        </div>

        <button onClick={props.onClose} className="command-button mt-6 bg-emerald-500 text-stone-950 hover:bg-emerald-400 w-full">
          Done
        </button>
      </div>
    </div>
  );
}
