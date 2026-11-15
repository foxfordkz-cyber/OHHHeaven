# First Year

[![CI](https://github.com/foxfordkz-cyber/OHHHeaven/actions/workflows/ci.yml/badge.svg)](https://github.com/foxfordkz-cyber/OHHHeaven/actions/workflows/ci.yml)

**Play it: https://ohhheaven-production.up.railway.app** · pitch deck: https://ohhheaven-production.up.railway.app/deck/
([PDF](docs/pitch/deck/deck.pdf))

A slow, persistent New York City where you live the first year of your own business — real rent, permits,
wages, taxes and inspections — without risking your savings. Game spec: `docs/GAME.md`.
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

| Folder | Package | What it is |
|---|---|---|
| `shared/` | `@ohh/shared` | contract types, rules, utils |
| `engine/` | `@ohh/engine` | pure game engine: economy, law, deals, analytics, niches |
| `ai/` | `@ohh/ai` | weather, city events, advisor |
| `host/` | `@ohh/host` | world, clock, views |
| `server/` | `@ohh/server` | Express HTTP API, serves the built client |
| `bots/` | `@ohh/bots` | AI-run residents |
| `client/` | `@ohh/client` | Vite + React |

## Repository layout

| Folder | What is inside |
|---|---|
| `packs/` | niche data packs (cafe, barbershop, common NYC law) with a source for every number |
| `data/` | NYC open data and the scripts that build places, footfall and the offline map |
| `sim/` | season balance runner and the economy audit |
| `scripts/` | smoke test, pack validation, production check, browser end-to-end runs |
| `build/` | specs: contract, design guide, pack format, events, cafe formats |
| `docs/` | game spec (`GAME.md`), deploy guide, pitch deck and materials, QA notes and screenshots |
| `research/` | market research behind the numbers and the reports the code cites |

Requires Node 20+.

## Deploy

Step by step for someone who has never deployed, with variables and checks: [`docs/DEPLOY.md`](docs/DEPLOY.md).
After a deploy: `node scripts/prod-check.mjs <url>` walks health → city → join → opening → a month of trading.

One Node service on one port; the world lives in memory and is snapshotted to `SNAPSHOT_DIR` (JSON, once a second
when it changed) and restored on restart. The `Dockerfile` builds the client and runs the server with
`SNAPSHOT_DIR=/data` — mount a volume there.

```bash
docker build -t first-year .
docker run -p 8787:8787 -v first-year-data:/data first-year
```

### Railway (recommended)

Why Railway: the service runs all the time (the city has its own clock and must not fall asleep), it supports
volumes for the snapshots, and it deploys this repo's `Dockerfile` straight from GitHub (`railway.json` is
included). The trial gives a one-time $5 credit for 30 days, which covers a small always-on service for the
hackathon; after that the Free plan is $1/month of credit, so keep it on the trial or move to Hobby
([Railway: free trial](https://docs.railway.com/pricing/free-trial), [plans](https://docs.railway.com/pricing/plans)).

1. railway.com → New Project → Deploy from GitHub repo → pick this repository and the branch to deploy.
2. The service builds from `Dockerfile` (via `railway.json`); health check: `/api/health`.
3. Service → Settings → Volumes → add a volume mounted at `/data`.
4. Service → Settings → Networking → Generate Domain. Open it: the client and `/api` are on the same URL.

No API key is needed; to switch on AI texts later, add the key as a service variable (see `ai/`).

### Render (fallback for a one-off demo)

Render's free web service sleeps after 15 minutes without traffic (about a minute to wake up) and cannot have a
persistent disk, so the live city stops and snapshots are lost on every restart
([Render: deploy for free](https://render.com/docs/free)). Usable only for a demo you keep open: New → Web Service
→ this repo → Runtime: Docker → Health check path `/api/health`.

### Fly.io (paid, a few dollars a month)

New Fly.io organizations get only a short trial, then pay as you go: a small always-on machine plus a volume
(about $0.15 per GB per month) ([Fly.io: discontinued plans](https://fly.io/docs/about/discontinued-plans/)).
`fly launch --no-deploy` → `fly volumes create data --size 1` → mount it at `/data` in `fly.toml`
(`[mounts] source = "data"`, `destination = "/data"`, `internal_port = 8787`) → `fly deploy`.

### From a laptop on the local network

```bash
npm install && npm run build && npm start
```

The server listens on all interfaces (`HOST=0.0.0.0`, port 8787). Find the laptop's address
(macOS: `ipconfig getifaddr en0`, Linux: `hostname -I`, Windows: `ipconfig`) and open
`http://<address>:8787` on the phones in the same Wi-Fi. Snapshots go to `.data/` in the repo folder.

## Contributors

| GitHub | Role |
|---|---|
| [diiaanns07-droid](https://github.com/diiaanns07-droid) | build: skeleton, integration, deploy (agent 01 tab), research |
| [foxfordkz-cyber](https://github.com/foxfordkz-cyber) | lead, game design, contract |

Code is written together with Claude (Anthropic) agents; their commits carry a `Co-Authored-By` line.
