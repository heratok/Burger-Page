/**
 * Shared CORS origin allowlist for the API (main CORS plugin and the hijacked
 * SSE stream, which bypasses the plugin because it replies raw).
 */
export function getAllowedOrigins(): string[] {
  return process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return getAllowedOrigins().includes(origin);
}