# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

# Copy root workspace and package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/contracts ./packages/contracts
COPY frontend ./frontend

# Build contracts first, then frontend
RUN pnpm --filter @burger-page/contracts run build
RUN pnpm --filter burger-page-frontend run build

# ==========================================
# STAGE 2: Lightweight Nginx Web Server
# ==========================================
FROM nginx:alpine AS runner

# Copy custom Nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static SPA files from builder stage
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
