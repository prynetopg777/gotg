export type Player = 'red' | 'blue';
export type Phase = 'lobby' | 'setup' | 'countdown' | 'playing';
export type AnimationSpeed = 'calm' | 'normal' | 'fast';
export type BoardTheme = 'classic' | 'forest' | 'midnight' | 'sand' | 'marble' | 'crimson' | 'custom';
export type SoundPack = 'off' | 'classic' | 'tactical';

export type Piece = {
  id: string;
  owner: Player;
  status: 'tray' | 'board' | 'captured';
  row?: number;
  col?: number;
  visible: boolean;
  name: string;
  code: string;
};

export type BattlePiece = Pick<Piece, 'id' | 'owner' | 'visible' | 'name' | 'code'> & { eliminated: boolean };

export type Battle = {
  attacker: BattlePiece;
  defender: BattlePiece;
  outcome: 'attacker' | 'defender' | 'both';
  at: { row: number; col: number };
  special: null | 'flag-capture' | 'private-trap' | 'spy-assassination' | 'ambush' | 'capture';
};

export type GameState = {
  code: string;
  you: Player;
  opponent: Player;
  phase: Phase;
  turn: Player;
  ready: Record<Player, boolean>;
  connected: Record<Player, boolean>;
  spectators: number;
  winner: Player | null;
  winReason: string;
  pendingFlagWin: null | { player: Player; row: number; col: number };
  countdownEndsAt: number | null;
  turnEndsAt: number | null;
  turnSeconds: number;
  increment: number;
  timeBank: Record<Player, number>;
  revealAll: boolean;
  revealMode: 'hidden' | 'classic';
  rematchReady: Record<Player, boolean>;
  drawOffer: Player | null;
  counts: Record<Player, number>;
  stats: {
    challenges: number;
    captures: Record<Player, number>;
    spyKills: Record<Player, number>;
    moves: Record<Player, number>;
    biggestBluff: null | { winnerOwner: Player; winnerCode: string; loserOwner: Player; loserCode: string; loserName: string; loserPower: number };
    mvp: null | { id: string; owner: Player; code: string; name: string; wins: number; moves: number };
    longestSurvivor: null | { id: string; owner: Player; code: string; name: string; firstMove: number };
  };
  board: (Piece | null)[][];
  tray: Piece[];
  captured: Record<Player, Piece[]>;
  lastBattle: Battle | null;
  lastMove: null | { player: Player; from: { row: number; col: number }; to: { row: number; col: number }; capture: boolean };
  eliminatedLog: { id: number; owner: Player; name: string; code: string; reason: string; at: string }[];
  chat: { id: number; player: Player; text: string; at: string; reaction?: boolean }[];
  history: { id: number; text: string; kind: string; at: string }[];
  isSpectator?: boolean;
  profiles: Record<Player, PublicProfile>;
};

export type Ack = { ok: boolean; error?: string; code?: string; player?: Player };

export type User = {
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  avatar?: string | null;
};

export type LeaderboardEntry = User & { rank: number };

export type PublicProfile = {
  username: string;
  elo: number | null;
  wins: number;
  losses: number;
  draws: number;
  avatar?: string | null;
  guest: boolean;
};
