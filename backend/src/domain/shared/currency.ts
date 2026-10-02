/** Defaults a new restaurant starts with when the caller does not choose a currency. */
export const DEFAULT_CURRENCY = 'COP';
export const DEFAULT_CURRENCY_SYMBOL = '$';

/** Display symbols for the currencies the platform knows; others fall back to the ISO code. */
const KNOWN_SYMBOLS: Record<string, string> = {
  COP: '$',
  MXN: '$',
  ARS: '$',
  CLP: '$',
  UYU: '$',
  USD: '$',
  PEN: 'S/',
  BRL: 'R$',
  EUR: '€',
};

export function normalizeCurrency(code: string | undefined): string {
  return (code ?? DEFAULT_CURRENCY).trim().toUpperCase();
}

/** The symbol to store when the caller sent a currency but no symbol. */
export function defaultSymbolFor(code: string): string {
  return KNOWN_SYMBOLS[code] ?? code;
}
