/// <reference types="vite/client" />

declare module "*.css"

interface ImportMetaEnv {
  readonly PUBLIC_API_URL?: string
  readonly PUBLIC_SUPABASE_URL?: string
  readonly PUBLIC_SUPABASE_ANON_KEY?: string
  readonly BACKEND_API_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}