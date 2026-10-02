export interface CurrencyOption {
  code: string
  name: string
  defaultSymbol: string
}

export const COMMON_CURRENCIES: CurrencyOption[] = [
  { code: 'COP', name: 'COP — Peso colombiano', defaultSymbol: '$' },
  { code: 'USD', name: 'USD — Dólar estadounidense', defaultSymbol: '$' },
  { code: 'EUR', name: 'EUR — Euro', defaultSymbol: '€' },
  { code: 'MXN', name: 'MXN — Peso mexicano', defaultSymbol: '$' },
  { code: 'ARS', name: 'ARS — Peso argentino', defaultSymbol: '$' },
  { code: 'CLP', name: 'CLP — Peso chileno', defaultSymbol: '$' },
  { code: 'PEN', name: 'PEN — Sol peruano', defaultSymbol: 'S/' },
  { code: 'BRL', name: 'BRL — Real brasileño', defaultSymbol: 'R$' },
  { code: 'UYU', name: 'UYU — Peso uruguayo', defaultSymbol: '$' },
  { code: 'BOB', name: 'BOB — Boliviano', defaultSymbol: 'Bs.' },
  { code: 'GTQ', name: 'GTQ — Quetzal guatemalteco', defaultSymbol: 'Q' },
  { code: 'CRC', name: 'CRC — Colón costarricense', defaultSymbol: '₡' },
  { code: 'PAB', name: 'PAB — Balboa panameño', defaultSymbol: 'B/.' },
  { code: 'DOP', name: 'DOP — Peso dominicano', defaultSymbol: 'RD$' },
]

export interface TimezoneOption {
  value: string
  label: string
  group: 'Latinoamérica' | 'Otras regiones'
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'America/Bogota', label: 'Colombia (Bogotá) — UTC-5', group: 'Latinoamérica' },
  { value: 'America/Lima', label: 'Perú (Lima) — UTC-5', group: 'Latinoamérica' },
  { value: 'America/Mexico_City', label: 'México (CDMX) — UTC-6', group: 'Latinoamérica' },
  { value: 'America/Buenos_Aires', label: 'Argentina (Buenos Aires) — UTC-3', group: 'Latinoamérica' },
  { value: 'America/Santiago', label: 'Chile (Santiago) — UTC-3', group: 'Latinoamérica' },
  { value: 'America/Caracas', label: 'Venezuela (Caracas) — UTC-4', group: 'Latinoamérica' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo) — UTC-3', group: 'Latinoamérica' },
  { value: 'America/Panama', label: 'Panamá — UTC-5', group: 'Latinoamérica' },
  { value: 'America/Guatemala', label: 'Guatemala — UTC-6', group: 'Latinoamérica' },
  { value: 'America/Costa_Rica', label: 'Costa Rica — UTC-6', group: 'Latinoamérica' },
  { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil) — UTC-5', group: 'Latinoamérica' },
  { value: 'America/La_Paz', label: 'Bolivia (La Paz) — UTC-4', group: 'Latinoamérica' },
  { value: 'America/Asuncion', label: 'Paraguay (Asunción) — UTC-3', group: 'Latinoamérica' },
  { value: 'America/Santo_Domingo', label: 'Rep. Dominicana — UTC-4', group: 'Latinoamérica' },
  { value: 'America/Tegucigalpa', label: 'Honduras — UTC-6', group: 'Latinoamérica' },
  { value: 'America/Managua', label: 'Nicaragua — UTC-6', group: 'Latinoamérica' },
  { value: 'America/El_Salvador', label: 'El Salvador — UTC-6', group: 'Latinoamérica' },
  { value: 'America/Sao_Paulo', label: 'Brasil (São Paulo) — UTC-3', group: 'Latinoamérica' },
  { value: 'UTC', label: 'UTC (Tiempo Universal Coordinado)', group: 'Otras regiones' },
  { value: 'America/New_York', label: 'EE.UU. Este (New York) — UTC-5', group: 'Otras regiones' },
  { value: 'America/Chicago', label: 'EE.UU. Central (Chicago) — UTC-6', group: 'Otras regiones' },
  { value: 'America/Los_Angeles', label: 'EE.UU. Pacífico (Los Angeles) — UTC-8', group: 'Otras regiones' },
  { value: 'Europe/Madrid', label: 'España (Madrid) — UTC+1', group: 'Otras regiones' },
]

export function getDefaultSymbolForCurrency(code: string): string {
  const found = COMMON_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase())
  return found?.defaultSymbol || '$'
}
