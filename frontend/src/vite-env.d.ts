/// <reference types="vite/client" />

declare module "*.css"

interface ImportMetaEnv {
  readonly BACKEND_API_URL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}