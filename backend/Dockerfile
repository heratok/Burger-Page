# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY backend/package*.json ./backend/

# Install all dependencies (including devDependencies needed for building)
RUN npm ci

# Copy source files
COPY packages/contracts ./packages/contracts
COPY backend ./backend

# Build contracts first, then backend
RUN npm --prefix packages/contracts run build
RUN npm --prefix backend run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy package manifests for production install
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY backend/package*.json ./backend/

# Install only production dependencies
RUN npm ci --omit=dev

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
