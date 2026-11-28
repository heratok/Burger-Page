import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * Large CSS blurs (filter: blur) on huge elements and `backdrop-blur-*` on full-viewport
 * overlays (`fixed` + `inset-0` / `inset-x-0 inset-y-0`) are GPU-expensive on low-end
 * devices / software rasterizers and cause scroll/typing paint jank.
 *
 * Rules:
 * 1. No `blur-[Npx]` above 64px (Tailwind blur-3xl) — use CSS radial-gradient instead.
 * 2. No `blur*` filter on elements sized with an arbitrary dimension of 400px or more.
 * 3. Mechanism A (strict, no silence): a single `className` expression (plain string,
 *    template literal, `cn(...)` call, conditional, concatenation, or `@apply` in CSS)
 *    and any single class-building expression in `.ts`/`.tsx` must never mention, across
 *    any of its parts: `backdrop-blur*` AND `fixed` AND (`inset-0` or both `inset-x-0`
 *    and `inset-y-0`).
 *    Deliberate consequence: a legitimate expression mixing a blurred surface with a
 *    conditional `fixed` (e.g. `${x ? 'fixed' : 'sticky'} inset-0 backdrop-blur-xs`) will
 *    be flagged. That is acceptable and intended — it is a prompt to restructure, not a
 *    false positive to suppress. Do NOT "fix" this later by re-adding tolerance for
 *    mutually exclusive conditional literals.
 * 4. Mechanism B (identity, not counts): every remaining `backdrop-blur*` occurrence in
 *    production `.ts`, `.tsx`, and `.css` sources must match a `(file, classes)` entry in
 *    `BLUR_ALLOWLIST` with a verified reason describing the surface. Adding, removing, or
 *    repurposing tokens breaks the pairing and fails; stale entries fail even at zero.
 *
 * Known limits (read before trusting this guard):
 * 1. A class list assembled at runtime from separate sources cannot be proven safe by static
 *    analysis. Fragments split across literals (`"backdrop-" + "blur-md"`) are NOT detected.
 * 2. Only `.ts`, `.tsx` and `.css` under `src` are scanned, and `*.test.*`, `*.spec.*` and
 *    `src/__guards__/**` are excluded. A class string in `.js`, `.jsx`, `.html`, a JSON
 *    fixture or a template outside `src` is NOT seen.
 * 3. A raw `backdrop-filter: blur(...)` CSS declaration is NOT covered by the class-token
 *    rules; only `backdrop-blur*` utility tokens and CSS `@apply` are.
 * 4. Mechanism B counts per file and per normalized class text, not per position: moving a
 *    blur from one line to another place in the same file, with an identical class string,
 *    keeps the count and stays invisible. Class text is whitespace-normalized, so an
 *    "exact" class string here means exact after normalization.
 * 5. Rule 2 of the blur-size checks (no blur on a `[400px]`+ element) inspects a single line
 *    only; a height and a blur split across lines are not correlated.
 * 6. This is best-effort, deliberately. The authoritative check for a concrete overlay is
 *    opening it in a browser and reading the computed `backdrop-filter` of the full-viewport
 *    fixed element. A comprehensive guarantee needs that runtime check on exercised overlays.
 */
const sources = import.meta.glob(
  [
    '/src/**/*.ts',
    '/src/**/*.tsx',
    '/src/**/*.css',
    '!/src/**/*.test.*',
    '!/src/**/*.spec.*',
    '!/src/__guards__/**',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const lineOf = (code: string, index: number) => code.slice(0, index).split('\n').length;

const HAS_FIXED = /(?<![-\w])fixed(?![-\w])/;
const HAS_INSET_ZERO = /(?<![-\w])inset-0(?![-\w.])/;
const HAS_INSET_X_ZERO = /(?<![-\w])inset-x-0(?![-\w.])/;
const HAS_INSET_Y_ZERO = /(?<![-\w])inset-y-0(?![-\w.])/;
const BACKDROP_BLUR_SOURCE = String.raw`(?<![-\w])backdrop-blur(?:-(?:\[[^\]]+\]|[\w-]+))?(?![-\w])`;
const HAS_BACKDROP_BLUR = new RegExp(BACKDROP_BLUR_SOURCE);

const CLASS_HELPER_NAMES = new Set(['cn', 'clsx', 'twMerge', 'classNames', 'cx']);
const CLASS_ATTR_NAME_RE = /^(?:class|className|.*ClassName)$/;

export interface BlurAllowlistEntry {
  file: string;
  classes: string;
  reason: string;
  /**
   * How many identical class strings this entry authorizes in that file. Defaults to 1.
   * The declared value must match the real occurrence count exactly: an increase means an
   * unclassified blur was added, a decrease means the entry went stale. Identity is the
   * class string; this is its multiplicity, not a fungible per-file quota.
   */
  count?: number;
}

/**
 * Every non-full-viewport `backdrop-blur*` occurrence remaining in production sources,
 * identified by `(file, classes)` relative to `src/` with a reason describing the surface.
 */
export const BLUR_ALLOWLIST: readonly BlurAllowlistEntry[] = [
  {
    file: 'components/ui/ModernSelect.tsx',
    classes:
      'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-1.5 space-y-1 z-50 absolute mt-1.5 left-0 right-0',
    reason: 'Floating select dropdown menu surface (absolute z-50) — small ephemeral popover.',
  },
  {
    file: 'features/cart/AdditionsModal.tsx',
    classes:
      'absolute bottom-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-black/80 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md transition-all cursor-pointer active:scale-95 shadow-xs',
    reason: 'Floating expand pill button over the product hero image inside the product modal.',
  },
  {
    file: 'features/cart/AdditionsModal.tsx',
    classes:
      'absolute top-4 right-4 z-70 inline-flex size-11 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-all active:scale-95 cursor-pointer',
    reason: 'Close icon button on the photo lightbox.',
  },
  {
    file: 'features/crm/AdminLayout.tsx',
    classes:
      'border-t p-2.5 pb-4 sm:pb-3 space-y-2 border-slate-200/60 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/40 backdrop-blur-xs',
    reason: 'Sidebar footer control strip.',
  },
  {
    file: 'features/crm/AdminLayout.tsx',
    classes:
      'sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur-md transition-colors sm:px-6 lg:px-8 ${ isDark ? "border-slate-800 bg-[#0B0F19]/90 shadow-sm" : "border-slate-200/80 bg-white/90 shadow-xs" }',
    reason: 'Sticky top-0 admin header bar.',
  },
  {
    file: 'features/crm/ManualSaleModal.tsx',
    classes:
      'md:hidden shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0E1322]/95 backdrop-blur-md flex items-center justify-between shadow-xl',
    reason: 'Mobile-only bottom cart summary strip (md:hidden shrink-0) docked inside the manual sale modal.',
  },
  {
    file: 'features/crm/customizer/CustomizerBrandingSection.tsx',
    classes: 'absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center',
    reason: 'Upload spinner overlays scoped to the size-16 logo and h-24 banner preview thumbnails.',
    count: 2,
  },
  {
    file: 'features/crm/menu/ProductGrid.tsx',
    classes: 'rounded-md bg-black/75 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-xs',
    reason: 'Category pill badge scoped to the product card aspect-video thumbnail.',
  },
  {
    file: 'features/crm/menu/ProductGrid.tsx',
    classes: 'absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-2xs',
    reason: 'Out-of-stock overlay scoped to the product card aspect-video thumbnail.',
  },
  {
    file: 'features/crm/menu/ProductModal.tsx',
    classes:
      'absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-md p-6 text-center transition-all animate-in fade-in duration-200',
    reason: 'Image upload status overlay inside the product image preview box.',
  },
  {
    file: 'features/crm/menu/ProductModal.tsx',
    classes:
      'absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] flex items-center gap-1.5 rounded-lg bg-black/80 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-md border border-white/10 truncate',
    reason: 'Bottom-left status pill inside the product image preview box.',
  },
  {
    file: 'features/crm/utils/customizerStyles.ts',
    classes: 'bg-white/70 backdrop-blur-md border border-white/60 shadow-sm text-slate-900',
    reason: 'Light class preset for the optional "glass" product card style variant.',
  },
  {
    file: 'features/crm/utils/customizerStyles.ts',
    classes: 'bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-md text-white',
    reason: 'Dark class preset for the optional "glass" product card style variant.',
  },
  {
    file: 'features/landing/LandingPage.tsx',
    classes:
      'sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#0B0F19]/85 transition-colors',
    reason: 'Sticky top-0 marketing navbar.',
  },
  {
    file: 'features/landing/LandingPage.tsx',
    classes:
      'inline-flex items-center gap-2 rounded-full border border-brand-orange-subtle bg-orange-500/10 dark:bg-orange-500/15 px-4 py-1.5 text-xs font-bold text-orange-800 dark:text-orange-300 backdrop-blur-md mb-6 shadow-xs',
    reason: 'Hero announcement pill badge.',
  },
  {
    file: 'features/landing/LandingPage.tsx',
    classes:
      'mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto border border-slate-200/80 dark:border-slate-800/80 rounded-3xl bg-white/90 dark:bg-slate-900/80 p-6 shadow-sm backdrop-blur-md',
    reason: 'Social-proof metrics card.',
  },
  {
    file: 'features/storefront/Home.tsx',
    classes:
      'sticky z-20 -mx-4 px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-border-subtle backdrop-blur-md transition-colors',
    reason: 'Sticky horizontal category pills bar under the storefront header.',
  },
  {
    file: 'features/storefront/Navbar.tsx',
    classes: 'sticky top-0 z-30 border-b backdrop-blur-md transition-colors',
    reason: 'Sticky top-0 storefront header over the scrolling product catalog.',
  },
  {
    file: 'features/storefront/ProductCard.tsx',
    classes: 'backdrop-blur-md bg-bg-elevated/70 border border-white/10 shadow-sm',
    reason: 'Optional "glass" card style variant.',
  },
  {
    file: 'features/storefront/ProductCard.tsx',
    classes: 'absolute inset-0 z-10 flex items-center justify-center bg-black/65 backdrop-blur-2xs',
    reason: 'Out-of-stock "Agotado" badge overlay on the card thumbnail.',
  },
];

interface ExtractedUnit {
  text: string;
  start: number;
  end: number;
}

export interface BackdropBlurOccurrence {
  line: number;
  classes: string;
}

function normalizeClassText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeSourceKey(filePath: string): string {
  const posix = filePath.replace(/\\/g, '/');
  return posix.replace(/^(?:[A-Za-z]:)?(?:.*?\/)?src\//, '').replace(/^\/+/, '');
}

/**
 * Strips `/* ... *\/` CSS comments in a string-aware single pass:
 * - `/* ... *\/` inside `'...'` or `"..."` is preserved intact.
 * - Quotes inside `/* ... *\/` do not start string mode.
 * - Line breaks inside comments are preserved so line numbers remain accurate.
 */
export function stripCssComments(code: string): string {
  let out = '';
  let state: 'normal' | 'comment' | 'single' | 'double' = 'normal';

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (state === 'normal') {
      if (ch === '/' && next === '*') {
        state = 'comment';
        out += '  ';
        i++;
      } else if (ch === "'") {
        state = 'single';
        out += ch;
      } else if (ch === '"') {
        state = 'double';
        out += ch;
      } else {
        out += ch;
      }
      continue;
    }

    if (state === 'comment') {
      if (ch === '*' && next === '/') {
        state = 'normal';
        out += '  ';
        i++;
      } else {
        out += ch === '\n' ? '\n' : ' ';
      }
      continue;
    }

    const quote = state === 'single' ? "'" : '"';
    if (ch === '\\' && i + 1 < code.length) {
      out += ch + next;
      i++;
      continue;
    }
    if (ch === quote) {
      state = 'normal';
      out += ch;
      continue;
    }
    if (ch === '\n') {
      state = 'normal';
    }
    out += ch;
  }

  return out;
}

function collectCssUnits(code: string): ExtractedUnit[] {
  const clean = stripCssComments(code);
  const units: ExtractedUnit[] = [];

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (ch === '"' || ch === "'") {
      const start = i;
      const quote = ch;
      let text = '';
      for (i++; i < clean.length; i++) {
        if (clean[i] === '\\' && i + 1 < clean.length) {
          text += clean[i + 1];
          i++;
          continue;
        }
        if (clean[i] === quote || clean[i] === '\n') break;
        text += clean[i];
      }
      units.push({ text, start, end: Math.min(i + 1, clean.length) });
      continue;
    }

    if (ch === '@' && clean.startsWith('@apply', i) && !/[-\w]/.test(clean[i + 6] ?? '')) {
      const prev = clean[i - 1] ?? '';
      if (/[-\w]/.test(prev)) continue;
      const start = i;
      let end = i + 6;
      while (end < clean.length && clean[end] !== ';' && clean[end] !== '{' && clean[end] !== '}') {
        end++;
      }
      units.push({
        text: clean.slice(start, end),
        start,
        end,
      });
      i = end - 1;
    }
  }

  return units;
}

function isJsxOrFunctionBoundary(node: ts.Node): boolean {
  return (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node) ||
    ts.isFunctionLike(node)
  );
}

function collectStringsInExpr(node: ts.Node, out: string[], allowObjects: boolean): void {
  if (isJsxOrFunctionBoundary(node)) return;
  if (!allowObjects && ts.isObjectLiteralExpression(node)) return;

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push(node.text);
    return;
  }
  if (ts.isTemplateExpression(node)) {
    out.push(node.head.text);
    for (const span of node.templateSpans) {
      collectStringsInExpr(span.expression, out, allowObjects);
      out.push(span.literal.text);
    }
    return;
  }
  if (ts.isPropertyAssignment(node)) {
    if (ts.isStringLiteral(node.name) || ts.isNoSubstitutionTemplateLiteral(node.name)) {
      out.push(node.name.text);
    }
    collectStringsInExpr(node.initializer, out, allowObjects);
    return;
  }
  ts.forEachChild(node, (child) => collectStringsInExpr(child, out, allowObjects));
}

function isClassHelperCall(node: ts.CallExpression): boolean {
  if (ts.isIdentifier(node.expression)) {
    return CLASS_HELPER_NAMES.has(node.expression.text);
  }
  if (ts.isPropertyAccessExpression(node.expression)) {
    if (CLASS_HELPER_NAMES.has(node.expression.name.text)) return true;
    if (node.expression.name.text === 'join' && ts.isArrayLiteralExpression(node.expression.expression)) {
      return true;
    }
  }
  return false;
}

function collectTsMechanismAUnits(code: string, scriptKind: ts.ScriptKind): ExtractedUnit[] {
  const sourceFile = ts.createSourceFile('source', code, ts.ScriptTarget.Latest, true, scriptKind);
  const units: ExtractedUnit[] = [];

  function visitBoundariesOnly(node: ts.Node, allowObjects: boolean): void {
    ts.forEachChild(node, (child) => {
      if (isJsxOrFunctionBoundary(child) || (!allowObjects && ts.isObjectLiteralExpression(child))) {
        visit(child);
      } else {
        visitBoundariesOnly(child, allowObjects);
      }
    });
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile);
      if (CLASS_ATTR_NAME_RE.test(attrName) && node.initializer) {
        const exprNode = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
        if (exprNode) {
          const parts: string[] = [];
          collectStringsInExpr(exprNode, parts, true);
          units.push({
            text: parts.join(' '),
            start: exprNode.getStart(sourceFile),
            end: exprNode.getEnd(),
          });
          visitBoundariesOnly(exprNode, true);
        }
        return;
      }
      ts.forEachChild(node, visit);
      return;
    }

    if (ts.isTemplateExpression(node)) {
      const parts: string[] = [];
      collectStringsInExpr(node, parts, false);
      units.push({
        text: parts.join(' '),
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      });
      visitBoundariesOnly(node, false);
      return;
    }

    if (ts.isCallExpression(node) && isClassHelperCall(node)) {
      const parts: string[] = [];
      collectStringsInExpr(node, parts, true);
      units.push({
        text: parts.join(' '),
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      });
      visitBoundariesOnly(node, true);
      return;
    }

    if (ts.isBinaryExpression(node) || ts.isConditionalExpression(node)) {
      const parts: string[] = [];
      collectStringsInExpr(node, parts, false);
      if (parts.length > 0) {
        units.push({
          text: parts.join(' '),
          start: node.getStart(sourceFile),
          end: node.getEnd(),
        });
      }
      visitBoundariesOnly(node, false);
      return;
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      units.push({
        text: node.text,
        start: node.getStart(sourceFile),
        end: node.getEnd(),
      });
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return units;
}

function getScriptKind(filePath: string): ts.ScriptKind {
  const lower = filePath.replace(/\\/g, '/').toLowerCase();
  return lower.endsWith('.ts') && !lower.endsWith('.tsx') ? ts.ScriptKind.TS : ts.ScriptKind.TSX;
}

function isCssFile(filePath: string): boolean {
  return filePath.replace(/\\/g, '/').toLowerCase().endsWith('.css');
}

function hasFullViewportOverlayClasses(text: string): boolean {
  const hasFullInset = HAS_INSET_ZERO.test(text) || (HAS_INSET_X_ZERO.test(text) && HAS_INSET_Y_ZERO.test(text));
  return HAS_FIXED.test(text) && hasFullInset && HAS_BACKDROP_BLUR.test(text);
}

export interface BackdropBlurOffense {
  line: number;
  snippet: string;
}

export function findFullViewportBackdropBlur(code: string, filePath = 'inline.tsx'): BackdropBlurOffense[] {
  const units = isCssFile(filePath)
    ? collectCssUnits(code)
    : collectTsMechanismAUnits(code, getScriptKind(filePath));

  const offenses: BackdropBlurOffense[] = [];
  for (const unit of units) {
    if (hasFullViewportOverlayClasses(unit.text)) {
      offenses.push({
        line: lineOf(code, unit.start),
        snippet: code.slice(unit.start, unit.end).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return offenses;
}

export function extractBackdropBlurOccurrences(code: string, filePath = 'inline.tsx'): BackdropBlurOccurrence[] {
  const occurrences: BackdropBlurOccurrence[] = [];

  if (isCssFile(filePath)) {
    for (const unit of collectCssUnits(code)) {
      if (HAS_BACKDROP_BLUR.test(unit.text)) {
        occurrences.push({
          line: lineOf(code, unit.start),
          classes: normalizeClassText(unit.text),
        });
      }
    }
    return occurrences;
  }

  const sourceFile = ts.createSourceFile('source', code, ts.ScriptTarget.Latest, true, getScriptKind(filePath));

  function visit(node: ts.Node): void {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (HAS_BACKDROP_BLUR.test(node.text)) {
        occurrences.push({
          line: lineOf(code, node.getStart(sourceFile)),
          classes: normalizeClassText(node.text),
        });
      }
      return;
    }

    if (ts.isTemplateExpression(node)) {
      const staticText = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
      if (HAS_BACKDROP_BLUR.test(staticText)) {
        occurrences.push({
          line: lineOf(code, node.getStart(sourceFile)),
          classes: normalizeClassText(node.getText(sourceFile).slice(1, -1)),
        });
      }
      for (const span of node.templateSpans) {
        visit(span.expression);
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return occurrences;
}

export function findBackdropBlurAllowlistViolations(
  files: Record<string, string>,
  allowlist: readonly BlurAllowlistEntry[] = BLUR_ALLOWLIST,
): string[] {
  const violations: string[] = [];
  const allowlistMap = new Map<string, BlurAllowlistEntry>();

  for (const entry of allowlist) {
    const fileKey = normalizeSourceKey(entry.file);
    const classes = normalizeClassText(entry.classes);
    if (!fileKey || !classes || entry.reason.trim().length === 0) {
      violations.push(
        `${fileKey || '<empty>'}: invalid BLUR_ALLOWLIST entry (requires non-empty file, classes, and reason describing the surface)`,
      );
      continue;
    }
    const pairKey = `${fileKey}\0${classes}`;
    if (allowlistMap.has(pairKey)) {
      violations.push(`${fileKey}: duplicate BLUR_ALLOWLIST entry for class string "${classes}"`);
      continue;
    }
    allowlistMap.set(pairKey, { ...entry, file: fileKey, classes });
  }

  const occurrenceCounts = new Map<string, number>();
  const occurrenceLines = new Map<string, number[]>();

  for (const [rawPath, code] of Object.entries(files)) {
    const fileKey = normalizeSourceKey(rawPath);
    for (const occ of extractBackdropBlurOccurrences(code, rawPath)) {
      const pairKey = `${fileKey}\0${occ.classes}`;
      if (!allowlistMap.has(pairKey)) {
        violations.push(
          `${fileKey}:${occ.line}: unclassified backdrop-blur* occurrence for class string "${occ.classes}" — remove the blur or add a BLUR_ALLOWLIST entry for file "${fileKey}" and classes "${occ.classes}" with a reason describing the surface`,
        );
        continue;
      }
      occurrenceCounts.set(pairKey, (occurrenceCounts.get(pairKey) ?? 0) + 1);
      occurrenceLines.set(pairKey, [...(occurrenceLines.get(pairKey) ?? []), occ.line]);
    }
  }

  // One entry authorizes exactly the number of occurrences it declares (default 1). A
  // mismatch in either direction is a violation: more occurrences means an unclassified
  // blur reused a classified slot, fewer means the entry is stale.
  for (const [pairKey, count] of occurrenceCounts.entries()) {
    const entry = allowlistMap.get(pairKey)!;
    const declared = entry.count ?? 1;
    if (count !== declared) {
      const lines = (occurrenceLines.get(pairKey) ?? []).join(', ');
      violations.push(
        `${entry.file}: found ${count} occurrence(s) of class string "${entry.classes}" (lines ${lines}) but the allowlist declares ${declared} — ${count > declared ? 'classify the extra blur or remove it' : 'update the declared count or remove the stale entry'}`,
      );
    }
  }

  for (const [pairKey, entry] of allowlistMap.entries()) {
    if (!occurrenceCounts.has(pairKey)) {
      violations.push(
        `${entry.file}: stale BLUR_ALLOWLIST entry for class string "${entry.classes}" (no matching occurrence found) — remove this entry`,
      );
    }
  }

  return violations;
}

describe('no heavy blur blobs', () => {
  it('scans production .ts, .tsx, and .css sources', () => {
    const keys = Object.keys(sources);
    expect(keys.length).toBeGreaterThan(50);
    expect(keys.some((k) => k.endsWith('.ts'))).toBe(true);
    expect(keys.some((k) => k.endsWith('.tsx'))).toBe(true);
    expect(keys.some((k) => k.endsWith('.css'))).toBe(true);
  });

  it('has no blur filter above 64px', () => {
    const re = /(?<![-\w])blur-\[(\d+)px\]/g;
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) if (Number(m[1]) > 64) offenders.push(`${file}:${lineOf(code, m.index)} ${m[0]}`);
    }
    expect(offenders, `Oversized blur filters (use radial-gradient):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('has no blur filter on large (>=400px) elements', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const line of code.split('\n')) {
        if (/(?<![-\w])blur(?:-[\w[\]]+)?(?=[\s"'`])/.test(line) && /\b[hw]-\[(?:[4-9]\d\d|\d{4,})px\]/.test(line)) {
          offenders.push(`${file}: ${line.trim().slice(0, 110)}`);
        }
      }
    }
    expect(offenders, `Large blurred blobs:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('Mechanism A: has no backdrop-blur on full-viewport fixed overlays in any class expression', () => {
    const offenders: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const hit of findFullViewportBackdropBlur(code, file)) {
        offenders.push(`${file}:${hit.line} ${hit.snippet}`);
      }
    }
    expect(
      offenders,
      `Full-viewport fixed overlays must not use backdrop-blur (causes software-rasterization jank):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('Mechanism B: every remaining backdrop-blur* occurrence matches the identity allowlist', () => {
    const violations = findBackdropBlurAllowlistViolations(sources, BLUR_ALLOWLIST);
    expect(
      violations,
      `Unclassified or stale backdrop-blur* occurrences:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});

describe('findFullViewportBackdropBlur (Mechanism A)', () => {
  it('flags ${x ? "fixed" : "sticky"} inset-0 backdrop-blur-xs', () => {
    const code = "<div className={`${x ? 'fixed' : 'sticky'} inset-0 z-30 backdrop-blur-xs`} />";
    const hits = findFullViewportBackdropBlur(code);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(1);
    expect(hits[0].snippet).toContain('backdrop-blur-xs');
  });

  it('flags the literal "fixed inset-0 backdrop-blur-xs" in a .ts constant', () => {
    const tsCode = `export const OVERLAY_BACKDROP = "fixed inset-0 backdrop-blur-xs";`;
    const hits = findFullViewportBackdropBlur(tsCode, 'src/lib/overlayStyles.ts');
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(1);
    expect(hits[0].snippet).toContain('backdrop-blur-xs');
  });

  it('flags inset-x-0 inset-y-0 with fixed and a blur, while ignoring -inset-x-0', () => {
    const hits = findFullViewportBackdropBlur('<div className="fixed inset-x-0 inset-y-0 z-50 backdrop-blur" />');
    expect(hits).toHaveLength(1);
    expect(hits[0].snippet).toContain('inset-x-0');

    expect(
      findFullViewportBackdropBlur('<div className="fixed -inset-x-0 inset-y-0 z-50 backdrop-blur" />'),
    ).toEqual([]);
  });

  it('flags a cn(..., condition && "backdrop-blur-xs") composition where the same expression also carries fixed inset-0', () => {
    const code = `<DialogOverlay className={cn('fixed inset-0 isolate z-50 bg-black/60', condition && 'backdrop-blur-xs')} />`;
    const hits = findFullViewportBackdropBlur(code);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(1);
    expect(hits[0].snippet).toContain('backdrop-blur-xs');
  });

  it('does NOT flag a sticky header expression that never mentions fixed', () => {
    const code = [
      '<header className="sticky top-0 z-30 border-b backdrop-blur-md" />',
      '<div className={`sticky ${hasBanner ? "top-[92px]" : "top-16"} z-20 border-b backdrop-blur-md`} />',
      '<header className={cn("sticky top-0 z-30 backdrop-blur-md", isDark ? "bg-slate-950/90" : "bg-white/90")} />',
    ].join('\n');
    expect(findFullViewportBackdropBlur(code)).toEqual([]);
  });

  it('does NOT flag a card, dropdown, badge or floating button whose expression has no fixed+inset-0 combination', () => {
    const code = [
      '<div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3.5 backdrop-blur-md" />',
      '<div className={cn("rounded-2xl border bg-white/95 backdrop-blur-md shadow-2xl z-50 absolute mt-1.5 left-0 right-0", menuClassName)} />',
      '<span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3.5 py-1.5 text-xs backdrop-blur-md" />',
      '<button className="fixed right-4 bottom-4 z-30 inline-flex size-11 items-center justify-center rounded-full backdrop-blur-md" />',
      '<div className="fixed right-0 bottom-0 left-0 z-30 border-t backdrop-blur-md" />',
      '<div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-2xs" />',
      '<div className="pointer-events-none fixed inset-0 overflow-hidden" />',
    ].join('\n');
    expect(findFullViewportBackdropBlur(code)).toEqual([]);
  });

  it('flags @apply fixed inset-0 backdrop-blur-xs in CSS and does not treat a commented-out @apply as an occurrence', () => {
    const css = [
      '/* @apply fixed inset-0 backdrop-blur-xs; */',
      '.overlay { @apply fixed inset-0 backdrop-blur-xs; }',
    ].join('\n');
    const hits = findFullViewportBackdropBlur(css, 'src/index.css');
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
    expect(hits[0].snippet).toContain('@apply fixed inset-0 backdrop-blur-xs');
  });

  it('strips CSS comments in a string-aware way', () => {
    const css = [
      '.quoted-slash { content: "/*"; }',
      '.overlay { @apply fixed inset-0 backdrop-blur-xs; }',
      '.quoted-end { content: "*/"; }',
      '/* "quoted string inside comment" @apply fixed inset-0 backdrop-blur-md; */',
    ].join('\n');
    const hits = findFullViewportBackdropBlur(css, 'src/styles/custom.css');
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
  });
});

describe('findBackdropBlurAllowlistViolations (Mechanism B)', () => {
  it('fails when an allowlist slot is repurposed by changing the class string with a blur, even when file count is unchanged', () => {
    const allowlist: readonly BlurAllowlistEntry[] = [
      {
        file: 'features/storefront/Navbar.tsx',
        classes: 'sticky top-0 z-30 border-b backdrop-blur-md',
        reason: 'Sticky top-0 storefront header.',
      },
    ];

    const violations = findBackdropBlurAllowlistViolations(
      {
        '/src/features/storefront/Navbar.tsx':
          '<header className="sticky top-0 z-30 border-b backdrop-blur-md backdrop-blur-xs" />',
      },
      allowlist,
    );
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain('features/storefront/Navbar.tsx');
    expect(violations[0]).toContain('sticky top-0 z-30 border-b backdrop-blur-md backdrop-blur-xs');
    expect(violations[0]).toContain('reason describing the surface');
    expect(violations[1]).toContain('stale');
    expect(violations[1]).toContain('sticky top-0 z-30 border-b backdrop-blur-md');
  });

  it('fails on a stale entry both at zero and when another entry in the same file still exists', () => {
    const allowlist: readonly BlurAllowlistEntry[] = [
      {
        file: 'features/crm/AdminLayout.tsx',
        classes: 'border-t p-2.5 backdrop-blur-xs',
        reason: 'Sidebar footer control strip.',
      },
      {
        file: 'features/crm/AdminLayout.tsx',
        classes: 'sticky top-0 z-30 border-b backdrop-blur-md',
        reason: 'Sticky top-0 admin header bar.',
      },
    ];

    const oneRemoved = findBackdropBlurAllowlistViolations(
      {
        '/src/features/crm/AdminLayout.tsx': '<header className="sticky top-0 z-30 border-b backdrop-blur-md" />',
      },
      allowlist,
    );
    expect(oneRemoved).toHaveLength(1);
    expect(oneRemoved[0]).toContain('stale');
    expect(oneRemoved[0]).toContain('border-t p-2.5 backdrop-blur-xs');

    const allRemoved = findBackdropBlurAllowlistViolations(
      {
        '/src/features/crm/AdminLayout.tsx': '<header className="sticky top-0 z-30 border-b bg-white/95" />',
      },
      allowlist,
    );
    expect(allRemoved).toHaveLength(2);
    expect(allRemoved.every((v) => v.includes('stale'))).toBe(true);
  });

  it('fails on an unclassified new occurrence with exact instructions and passes again once removed', () => {
    const withNewBlur = {
      '/src/features/storefront/NewCard.tsx': '<div className="rounded-xl backdrop-blur-sm" />',
    };
    const failing = findBackdropBlurAllowlistViolations(withNewBlur, []);
    expect(failing).toHaveLength(1);
    expect(failing[0]).toContain('features/storefront/NewCard.tsx');
    expect(failing[0]).toContain('rounded-xl backdrop-blur-sm');
    expect(failing[0]).toContain('reason describing the surface');

    const blurRemoved = {
      '/src/features/storefront/NewCard.tsx': '<div className="rounded-xl bg-slate-900/90" />',
    };
    expect(findBackdropBlurAllowlistViolations(blurRemoved, [])).toEqual([]);
  });

  it('handles CSS @apply occurrences and ignores commented-out @apply in Mechanism B', () => {
    const css = [
      '/* @apply sticky top-0 backdrop-blur-md; */',
      '.header { @apply sticky top-0 backdrop-blur-xs; }',
    ].join('\n');

    const unclassified = findBackdropBlurAllowlistViolations({ '/src/styles/header.css': css }, []);
    expect(unclassified).toHaveLength(1);
    expect(unclassified[0]).toContain('styles/header.css');
    expect(unclassified[0]).toContain('@apply sticky top-0 backdrop-blur-xs');

    const allowlist: readonly BlurAllowlistEntry[] = [
      {
        file: 'styles/header.css',
        classes: '@apply sticky top-0 backdrop-blur-xs',
        reason: 'Sticky storefront header stylesheet rule.',
      },
    ];
    expect(findBackdropBlurAllowlistViolations({ '/src/styles/header.css': css }, allowlist)).toEqual([]);
  });

  it('normalizes Windows and POSIX path separators identically', () => {
    expect(normalizeSourceKey('C:\\repo\\frontend\\src\\features\\storefront\\Navbar.tsx')).toBe(
      'features/storefront/Navbar.tsx',
    );
    expect(normalizeSourceKey('src\\features\\storefront\\Navbar.tsx')).toBe('features/storefront/Navbar.tsx');
    expect(normalizeSourceKey('/src/features/storefront/Navbar.tsx')).toBe('features/storefront/Navbar.tsx');

    const allowlist: readonly BlurAllowlistEntry[] = [
      {
        file: 'features\\storefront\\Navbar.tsx',
        classes: 'sticky top-0 z-30 border-b backdrop-blur-md',
        reason: 'Sticky top-0 storefront header.',
      },
    ];
    expect(
      findBackdropBlurAllowlistViolations(
        {
          'C:\\repo\\frontend\\src\\features\\storefront\\Navbar.tsx':
            '<header className="sticky top-0 z-30 border-b backdrop-blur-md" />',
        },
        allowlist,
      ),
    ).toEqual([]);
  });
});

describe('findBackdropBlurAllowlistViolations is one-to-one (no fungible entries)', () => {
  it('fails when two occurrences share a single allowlisted class string in the same file', () => {
    const allowlist: readonly BlurAllowlistEntry[] = [
      {
        file: 'src/features/x/Thing.tsx',
        classes: 'bg-white/95 backdrop-blur-md shadow-2xl',
        reason: 'test fixture surface',
      },
    ];
    const files = {
      'src/features/x/Thing.tsx': [
        '<div className="bg-white/95 backdrop-blur-md shadow-2xl" />',
        '<div className="bg-white/95 backdrop-blur-md shadow-2xl" />',
      ].join('\n'),
    };

    const violations = findBackdropBlurAllowlistViolations(files, allowlist);
    expect(violations.some((v) => /declares 1/.test(v))).toBe(true);
  });
});
