import React from 'react';
import { X } from 'lucide-react';

export function Tutorial({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-black/75 px-4 overflow-y-auto py-6">
      <div className="modal-card max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">First Briefing</p>
            <h2 className="mt-2 text-3xl font-black uppercase">How This Table Plays</h2>
          </div>
          <button onClick={onClose} className="icon-button"><X size={18} /></button>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-stone-300 sm:grid-cols-2">
          <p><b>1. Deploy secretly.</b> Put all 21 pieces in your nearest three rows. Six home squares may stay empty.</p>
          <p><b>2. Move one square.</b> Orthogonal only: up, down, left, right. No diagonals or jumping.</p>
          <p><b>3. Challenge blind.</b> The server compares ranks privately when you attack an enemy piece.</p>
          <p><b>4. House fog rule.</b> Only eliminated pieces reveal their rank. Challenge winners stay hidden.</p>
          <p><b>5. Win cleanly.</b> Capture the enemy Flag, or move your Flag to their back row and survive to your next turn.</p>
          <p><b>6. Special ranks.</b> Spy beats everything except Private. Private beats Spy. Flag loses to everything.</p>
          <p><b>7. Keyboard navigation.</b> Arrow keys move the selected piece. Press Enter to confirm a move.</p>
          <p><b>8. Board themes.</b> Open Settings to choose from 6 board themes or upload a custom image.</p>
        </div>

        <div className="mt-5 border-t border-stone-700/60 pt-5">
          <p className="eyebrow mb-3">Piece Rank Guide (highest → lowest)</p>
          <div className="grid grid-cols-3 gap-1 text-xs sm:grid-cols-5">
            {[
              ['5G', '5-Star General'], ['4G', '4-Star General'], ['3G', '3-Star General'],
              ['2G', '2-Star General'], ['1G', '1-Star General'], ['COL', 'Colonel'],
              ['LTC', 'Lt. Colonel'], ['MAJ', 'Major'], ['CPT', 'Captain'],
              ['1LT', '1st Lt.'], ['2LT', '2nd Lt.'], ['SGT', 'Sergeant'],
              ['SPY', 'Spy ★'], ['PVT', 'Private ★'], ['FLG', 'Flag'],
            ].map(([code, name]) => (
              <div key={code} className="flex items-center gap-2 rounded border border-stone-700/40 bg-stone-900/50 p-2">
                <span className="legend-code text-[10px]">{code}</span>
                <span className="text-stone-300">{name}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="command-button mt-6 bg-emerald-500 text-stone-950 hover:bg-emerald-400">
          Begin
        </button>
      </div>
    </div>
  );
}
