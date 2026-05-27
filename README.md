# Game of the Generals (Salpakan)

A local-network, two-player Game of the Generals web app with a React/TypeScript client and a Node/Express/Socket.io server.

## Project Structure

```text
gotg/
  client/
    src/
      main.tsx
      styles.css
    index.html
    package.json
    vite.config.ts
    tailwind.config.js
  server/
    server.js
    package.json
  package.json
  README.md
```

## Run It

Install dependencies:

```bash
npm run install:all
npm install
```

Start both server and client:

```bash
npm run dev
```

Or run them separately:

```bash
npm run server
npm run client
```

Open the client on the host machine:

```text
http://localhost:5173
```

For another player on the same Wi-Fi/LAN, use the host computer's local IP:

```text
http://192.168.1.105:5173
```

The Socket.io server listens on port `3000`. If needed, override it for the client:

```bash
VITE_SERVER_URL=http://192.168.1.105:3000 npm run dev --prefix client
```

## How to Play

1. Player 1 creates a room and becomes Red.
2. Player 2 joins with the room code and becomes Blue.
3. Each player drags all 21 pieces into their first three rows.
4. Both players click `Ready`.
5. Red moves first. Select a piece, then choose a highlighted orthogonal square.
6. Moving into an enemy piece triggers a challenge.

## Implemented Rules

- 9 x 8 board.
- 21 pieces per player.
- Hidden opponent ranks until a challenge reveals the two involved pieces.
- One-square orthogonal movement only.
- Higher rank wins.
- Spy beats all except Private.
- Private beats Spy.
- Flag loses to everything.
- Same rank eliminates both pieces.
- Win by capturing the enemy Flag.
- Win by moving your Flag to the enemy back row and surviving one full opponent turn.
- Resign and draw offer controls.
- Captured pieces, challenge reveal, and move history.
- Loser popup message says `bading ka`, as requested.
