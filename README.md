# Burger Page 🍔

A modern full-stack web application designed for artisanal burger restaurants, featuring a **React 18 frontend** and a scalable **Fastify + TypeScript Hexagonal (Ports & Adapters) backend**.

---

## 📁 Project Structure

```text
Burger-Page/
├── package.json               # Root monorepo workspace coordinator
├── docker-compose.yml         # Local container orchestration
├── render.yaml                # Render Infrastructure-as-Code blueprint
├── .github/workflows/ci.yml   # Automated CI/CD pipeline
│
├── packages/
│   └── contracts/             # 📜 Shared Zod schemas, DTOs & Real-time SSE event contracts
│
├── frontend/                  # 🎨 Frontend React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/        # Reusable UI components & dialogs
│   │   ├── context/           # Multi-tenant state slices (Catalog, Orders, Inventory, etc.)
│   │   ├── core/api/          # Typed API Client with SSE order streaming
│   │   └── features/          # Cart, Storefront, CRM modules
│   ├── e2e/                   # Playwright End-to-End test suite
│   ├── Dockerfile             # Multi-stage Dockerfile (Vite build + Nginx Alpine)
│   ├── vercel.json            # Vercel deployment & SPA routing config
│   ├── vite.config.ts         # Vite bundler & reverse proxy (/api -> :3001)
│   └── vitest.config.ts       # Frontend Vitest test runner
│
└── backend/                   # ⚡ Hexagonal Backend (Fastify + TypeScript + Zod + SQLite)
    ├── src/
    │   ├── domain/            # Pure Domain (Models, Ports Out, Typed Domain Errors)
    │   ├── application/       # Use Cases (CreateOrder, ListProducts, etc.) & DTOs
    │   └── infrastructure/    # Adapters (Fastify HTTP, Scalar Docs, SQLite DB, SSE EventBus)
    ├── tests/                 # Unit, Integration, SQLite, and Resilience test suites
    ├── Dockerfile             # Multi-stage production Dockerfile (<100MB Node Alpine)
    ├── tsconfig.json          # TypeScript config (NodeNext)
    └── vitest.config.ts       # Backend Vitest test runner
```

---

## 🚀 Getting Started

### Installation
From the root directory, install all dependencies across all workspaces:

```bash
npm install
```

### Development
- **Run Frontend:** `npm run dev` (running at `http://localhost:5173`)
- **Run Backend:** `npm run dev:backend` (running at `http://localhost:3001`)
- **Interactive API Docs (Scalar):** `http://localhost:3001/docs`

---

## 🛠️ Monorepo Scripts (from root)

| Command | Description |
|---|---|
| `npm run dev` | Starts frontend development server |
| `npm run dev:backend` | Starts backend Fastify server with tsx watch |
| `npm test` | Runs all 122 tests across contracts, frontend, and backend |
| `npm run test:contracts` | Runs shared contracts unit tests |
| `npm run test:frontend` | Runs frontend unit and component tests |
| `npm run test:backend` | Runs backend unit, integration, and SQLite tests |
| `npm run test:e2e` | Runs Playwright full-stack End-to-End tests |
| `npm run build` | Compiles contracts, frontend, and backend for production |
| `npm run lint` | Runs ESLint validation on frontend code |

---

## 🐳 Docker Deployment

### Run with Docker Compose (1-click local production stack):
```bash
docker compose up --build
```
- **Frontend UI:** `http://localhost:8080`
- **Backend API:** `http://localhost:3001`
- **Scalar Docs:** `http://localhost:3001/docs`

---

## ☁️ Cloud Deployment Options

### 1. Frontend on Vercel
- Pre-configured with `frontend/vercel.json`.
- Set **Root Directory:** `frontend`
- Build command: `npm --prefix ../packages/contracts run build && npm run build`

### 2. Backend on Render
- Pre-configured with root `render.yaml` blueprint.
- Automatically handles health checks on `/health`, port binding on `3001`, and automatic zero-downtime deploys.
