# First Year — one Node service, one port, world snapshots on a volume (agent 01).
# Build: docker build -t first-year .   Run: docker run -p 8787:8787 -v first-year-data:/data first-year
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/data
COPY --from=build /app ./
RUN npm prune --omit=dev --no-audit --no-fund && mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["npm", "start"]
