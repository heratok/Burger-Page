# ==========================================
# STAGE 1: Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package manifests
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci

# Copy source files
COPY packages/contracts ./packages/contracts
COPY frontend ./frontend

# Build contracts first, then frontend
RUN npm --prefix packages/contracts run build
RUN npm --prefix frontend run build

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
