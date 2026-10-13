const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user asked the OS/browser to minimise non-essential motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCE_QUERY).matches;
}

/** Scroll behavior for programmatic scrolling: instant under reduced motion, smooth otherwise. */
export function scrollBehavior(): 'auto' | 'smooth' {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
