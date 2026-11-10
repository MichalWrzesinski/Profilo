# syntax=docker/dockerfile:1.7
# Build context: repository root (the app imports docs/design/tokens.css).
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/client

FROM base AS deps
COPY client/package.json client/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Development image: code mounted by Compose, `next dev`.
FROM base AS dev
COPY --from=deps /repo/client/node_modules ./node_modules
COPY docs/design/tokens.css /repo/docs/design/tokens.css
COPY client/ ./
# node_modules/.vite-temp is world-writable: checks run as the host user (Makefile AS_HOST).
RUN mkdir -p .next node_modules/.vite-temp && chown -R node:node /repo && chmod 1777 node_modules/.vite-temp
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=10 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["npm", "run", "dev"]

FROM base AS build
COPY --from=deps /repo/client/node_modules ./node_modules
COPY docs/design/tokens.css /repo/docs/design/tokens.css
COPY client/ ./
RUN npm run build

# Production image: Next.js standalone server only.
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS prod
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/client/.next/standalone ./
COPY --from=build --chown=node:node /repo/client/.next/static ./client/.next/static
COPY --from=build --chown=node:node /repo/client/public ./client/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "client/server.js"]
