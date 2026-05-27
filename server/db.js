import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'gotg-data.json');
const STARTING_ELO = 1000;

function emptyDb() {
  return { users: [] };
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return emptyDb();
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return emptyDb();
  }
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function publicUser(user) {
  if (!user) return null;
  return {
    username: user.username,
    elo: user.elo,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    avatar: user.avatar || null
  };
}

export async function createUser(username, password) {
  const clean = String(username || '').trim();
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(clean)) {
    throw new Error('Use 3-20 letters, numbers, underscores, or dashes.');
  }
  if (String(password || '').length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const db = readDb();
  if (db.users.some((user) => user.username.toLowerCase() === clean.toLowerCase())) {
    throw new Error('Username is already taken.');
  }
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    id: randomUUID(),
    username: clean,
    passwordHash,
    elo: STARTING_ELO,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: null,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeDb(db);
  return publicUser(user);
}

export async function validateUser(username, password) {
  const db = readDb();
  const user = db.users.find((item) => item.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user) return null;
  const ok = await bcrypt.compare(String(password || ''), user.passwordHash);
  return ok ? publicUser(user) : null;
}

export function getUser(username) {
  const db = readDb();
  return publicUser(db.users.find((item) => item.username.toLowerCase() === String(username || '').trim().toLowerCase()));
}

export function updateProfile(username, { avatar }) {
  const db = readDb();
  const user = db.users.find((item) => item.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user) throw new Error('Profile not found.');
  if (avatar !== undefined) {
    const clean = avatar ? String(avatar) : null;
    if (clean && (!clean.startsWith('data:image/') || clean.length > 900_000)) {
      throw new Error('Use an image under about 650 KB.');
    }
    user.avatar = clean;
  }
  writeDb(db);
  return publicUser(user);
}

export function getLeaderboard(limit = 20) {
  const db = readDb();
  return db.users
    .map(publicUser)
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins || a.username.localeCompare(b.username))
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function expectedScore(a, b) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function recordResult(redUsername, blueUsername, winner) {
  if (!redUsername || !blueUsername || redUsername === blueUsername) return;
  const db = readDb();
  const red = db.users.find((user) => user.username === redUsername);
  const blue = db.users.find((user) => user.username === blueUsername);
  if (!red || !blue) return;

  const redScore = winner === 'draw' ? 0.5 : winner === 'red' ? 1 : 0;
  const blueScore = winner === 'draw' ? 0.5 : winner === 'blue' ? 1 : 0;
  const k = 32;
  const redExpected = expectedScore(red.elo, blue.elo);
  const blueExpected = expectedScore(blue.elo, red.elo);

  red.elo = Math.round(red.elo + k * (redScore - redExpected));
  blue.elo = Math.round(blue.elo + k * (blueScore - blueExpected));

  if (winner === 'draw') {
    red.draws += 1;
    blue.draws += 1;
  } else if (winner === 'red') {
    red.wins += 1;
    blue.losses += 1;
  } else {
    blue.wins += 1;
    red.losses += 1;
  }
  writeDb(db);
}
