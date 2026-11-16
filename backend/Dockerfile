# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Keep pnpm non-interactive: dropping dev dependencies from node_modules asks for
# confirmation when stdin is not a TTY, and without CI=true pnpm aborts with
# ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY.
ENV CI=true

RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Copy root workspace and package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install only the two projects the image ships. The frontend manifest stays
# copied so `--frozen-lockfile` can still validate every workspace importer.
RUN pnpm install --frozen-lockfile --filter burger-page-backend --filter @burger-page/contracts

# Copy source files
COPY packages/contracts ./packages/contracts
COPY backend ./backend

# Build contracts first, then backend, then reduce node_modules to runtime deps.
RUN pnpm --filter @burger-page/contracts run build
RUN pnpm --filter burger-page-backend run build
# `pnpm prune --prod` is not workspace-aware: it drops the workspace
# packages' own dependencies, and the container then dies at boot with
# `Cannot find package 'fastify'`. Reinstall with --prod for just the two
# packages the runner needs, which keeps their runtime tree intact.
RUN pnpm install --frozen-lockfile --prod --filter burger-page-backend --filter @burger-page/contracts

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy package manifests and pruned production dependencies
COPY package.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy compiled artifacts from builder stage
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Expose Fastify port
EXPOSE 3001

# Healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

# Start the server
CMD ["node", "backend/dist/index.js"]
