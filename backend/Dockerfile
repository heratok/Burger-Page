# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Copy root workspace and package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all dependencies (including devDependencies needed for building)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/contracts ./packages/contracts
COPY backend ./backend

# Build contracts first, then backend, then prune devDependencies for runner
RUN pnpm --filter @burger-page/contracts run build
RUN pnpm --filter burger-page-backend run build
RUN pnpm prune --prod

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

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
