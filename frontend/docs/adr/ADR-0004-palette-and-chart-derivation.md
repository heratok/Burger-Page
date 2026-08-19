# ADR-0004: palette and chart ramp derivation

## Status

Accepted.

## Context

Every restaurant defines its own look through a small set of explicit palette
tokens, and the resumen dashboards render charts that must stay readable for
*any* palette a user picks. Two problems forced a derivation strategy instead of
hardcoded colors:

1. The full runtime theme needs many more values (hover/pressed, surfaces,
   text, sidebar, charts) than the four stored tokens
   (`accent`/`primary`/`background`/`surface`). Hardcoding them would break the
   moment a user changes the accent.
2. Charts reference five colors (`--chart-1..5`) that must remain
   contrast-distinct even when `accent` and `primary` are identical (a very
   common choice). A naive two-color ramp would collapse into duplicates.

## Decision

- The four explicit tokens are the single source of truth
   (`RestaurantPalette` in `src/shared/domain/domain.ts`).
- `applyTheme(palette)` (`src/shared/domain/theme.ts`) derives the full runtime
  palette **deterministically** and writes it as CSS variables on `:root`
  (`--accent`, `--bg-base`, `--text-primary`, `--sidebar-*`, `--chart-1..5`,
  etc., plus their `--color-*` twins). Tailwind resolves these at runtime via
  `@theme inline`.
- **Chart ramp** (`chartPalette(accent, primary)`): the accent as anchor plus
  four distinct lighten/darken blend steps toward white/black, so two identical
  anchors still yield five distinct colors.
- **Chart config** (`chartConfig` in `src/shared/domain/resumen/index.tsx`)
  references the runtime tokens (`var(--chart-1)`…) and derives its label text
  from the shared `STATUS_LABELS`/`PAYMENT_LABELS` — colors and plural labels
  are defined exactly once, never as per-chart literals.
- Text/surface tokens are derived with WCAG-aware rules
  (`relativeLuminance`, `contrastRatio`, `steppedBlend`): body text picks the
  light/dark extreme with higher contrast; secondary/muted text steps down only
  while keeping ≥ 4.5:1 contrast.
- Sidebar tokens are derived from the runtime palette, never hardcoded hex.
  `destructive`/`success`/`warning` stay fixed in CSS (semantic status colors,
  not brand).

## Consequences

- **Positive:** a user can change only the four tokens and the whole theme —
  including charts — re-derives consistently.
- **Positive:** derivation is pure and deterministic, so it is unit-testable
  (`theme.test.ts`) and reproducible across runs.
- **Positive:** charts stay legible for any palette because the ramp guarantees
  five distinct colors.
- **Negative:** the theme cannot be described by hand-written CSS alone — you
  must reason through the derivation functions; the tokens are the API.
- **Negative:** chart color values are runtime-only (CSS vars), so a static
  snapshot of the stylesheet will not show the actual chart colors.

## References

- `src/shared/domain/theme.ts` — `applyTheme`, `chartPalette`,
  `hexToRgb`, `relativeLuminance`, `contrastRatio`, `steppedBlend`.
- `src/shared/domain/resumen/index.tsx` — `chartConfig`, `STATUS_LABELS`,
  `PAYMENT_LABELS`.
- `src/shared/domain/domain.ts` — `RestaurantPalette`.
