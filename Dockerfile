# First Year — one Node service on one port: the API and the built client; world snapshots on a volume.
#   docker build -t first-year .
#   docker run -p 8787:8787 -v first-year-data:/data first-year      → http://localhost:8787
# Deploy guide: docs/DEPLOY.md. Railway reads railway.json next to this file.

# ── build: install every workspace, build the client into client/dist, drop dev dependencies ──
FROM node:22-alpine AS build
WORKDIR /app
# Manifests first: a code-only change reuses the installed node_modules layer.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY engine/package.json engine/
COPY ai/package.json ai/
COPY host/package.json host/
COPY server/package.json server/
COPY bots/package.json bots/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund

# ── run: the server runs its TypeScript through tsx, a runtime dependency of @ohh/server ──
FROM node:22-alpine
WORKDIR /app
# The server reads SNAPSHOT_DIR; DATA_DIR is the name the docs and scripts use. Both point at the volume.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 SNAPSHOT_DIR=/data DATA_DIR=/data
COPY --from=build /app ./
RUN mkdir -p /data
# No VOLUME instruction: Railway rejects it ("Dockerfile failed validation"). Mount the storage from outside:
# a Railway Volume at /data (docs/DEPLOY.md), or `docker run -v first-year-data:/data` locally.
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
# node itself is PID 1 (not npm): SIGTERM reaches the server, which saves every world before it exits.
CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/src/main.ts"]
