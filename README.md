# First Year

A slow, persistent New York City where you live the first year of your own business — real rent, permits,
wages, taxes and inspections — without risking your savings. Game spec: `context/08-game-v5.md`.
How the pieces fit: `build/CONTRACT.md`.

## Run it (three commands)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the client (Vite) proxies `/api` to the server on port 8787.

Production mode on one port:

```bash
npm run build && npm start
```

Open http://localhost:8787 — the server serves the built client from `client/dist` and the API under `/api`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | server (`tsx watch`, port 8787) and client (Vite, port 5173) together |
| `npm test` | vitest in every workspace |
| `npm run check` | `tsc --noEmit` in every workspace |
| `npm run build` | builds the client into `client/dist` |
| `npm start` | one Node process: API + built client on `PORT` (default 8787) |
| `node scripts/smoke.mjs` | end-to-end check over HTTP (two owners, a month, a complaint, a deal, analytics) |
| `node scripts/validate-all.mjs` | validates every `packs/*.json` with `build/validate-pack.mjs` |

## Packages (npm workspaces)

| Folder | Package | Owner |
|---|---|---|
| `shared/` | `@ohh/shared` — contract types, rules, utils | lead (types, rules), agent 01 (rest) |
| `engine/` | `@ohh/engine` — pure game engine | agents 02, 03, 04, 13; niches 14–16 |
| `ai/` | `@ohh/ai` — weather, events, advisor | agent 05 |
| `host/` | `@ohh/host` — world, clock, views | agent 06 |
| `server/` | `@ohh/server` — Express HTTP | agent 06 |
| `bots/` | `@ohh/bots` — AI-run residents | agent 07 |
| `client/` | `@ohh/client` — Vite + React | agents 08–12 |

Files that start with `// @ohh-stub` are placeholders written by agent 01 with the exact signatures from
`build/CONTRACT.md`; their owners replace them. `scripts/smoke.mjs` reports which steps ran on real code.

Requires Node 20+.
