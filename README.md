# Burger Page — Restaurant CRM (repo)

Monorepo layout for the Restaurant CRM change:

| Folder | Status | Contents |
|--------|--------|----------|
| [`frontend/`](frontend/) | **Active** | The Burger Page storefront app (React + Vite + TypeScript + Tailwind 4). `npm run dev` / `build` / `typecheck` / `lint` / `test` run from inside this folder. |
| [`backend/`](backend/) | **Placeholder** | Future backend for Restaurant CRM (persistence/API behind the storefront repository seam). No implementation yet — pending a future SDD change. |

There are **no npm workspaces**: each folder owns an independent `package.json`.

## Development

```bash
cd frontend
npm install
npm run dev      # start the storefront
npm run build    # typecheck + production build
npm run typecheck
npm run lint
npm test         # vitest run
```

## Restaurant CRM

This repo is the working base for the `restaurant-crm` SDD change (local-first admin panel: catalog management, order lifecycle, sales summary, restaurant config, admin shell). See the change's proposal/spec/design artifacts for scope. Storefront behavior must stay identical while the admin capabilities land.
