# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
# Build context: repository root (the app imports docs/design/tokens.css; nick tests read docs/api/nick-cases.json).
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/client

FROM base AS deps
COPY client/package.json client/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Development image: code mounted by Compose, `next dev`.
FROM base AS dev
COPY --from=deps /repo/client/node_modules ./node_modules
COPY docs/design/tokens.css docs/design/components.css /repo/docs/design/
COPY docs/api/nick-cases.json /repo/docs/api/
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
COPY docs/design/tokens.css docs/design/components.css /repo/docs/design/
COPY docs/api/nick-cases.json /repo/docs/api/
COPY client/ ./
# Source maps (TASK-023): debug IDs tie each script to its map (no Sentry token needed);
# the maps then leave the served directory — the deploy workflows upload them to Sentry.
RUN npm run build \
  && npx sentry-cli sourcemaps inject .next/static \
  && cd .next/static \
  && find . -name '*.map' -exec sh -c 'mkdir -p "/sourcemaps/$(dirname "$1")" && mv "$1" "/sourcemaps/$1"' _ {} \; \
  && mkdir -p /sourcemaps

# Production image: Next.js standalone server only.
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS prod
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/client/.next/standalone ./
COPY --from=build --chown=node:node /repo/client/.next/static ./client/.next/static
COPY --from=build --chown=node:node /repo/client/public ./client/public
# Not served (Next.js serves only .next/static and public); read by the deploy workflows.
COPY --from=build /sourcemaps /opt/sourcemaps
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["node", "client/server.js"]
