# syntax=docker/dockerfile:1
# =============================================================================
# ClassPulse Frontend + Edge (React/Vite build → Caddy static + reverse proxy)
# This image is the public entrypoint: serves the SPA and proxies /api /ws
# /storage to the backend & MinIO. Caddyfile is bind-mounted at runtime so you
# can change domains without rebuilding.
# =============================================================================

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_* are relative (/api/v1, /ws) — baked at build, resolved same-origin in prod
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
# Caddyfile is provided via bind-mount (see docker-compose.prod.yml)
