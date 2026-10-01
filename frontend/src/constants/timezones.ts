export interface TimezoneOption {
  value: string
  label: string
}

/** Curated IANA zones for Latin America and Spain; the admin select stays short. */
export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/El_Salvador", label: "El Salvador" },
  { value: "America/Tegucigalpa", label: "Honduras (Tegucigalpa)" },
  { value: "America/Managua", label: "Nicaragua (Managua)" },
  { value: "America/Santo_Domingo", label: "República Dominicana" },
  { value: "America/Havana", label: "Cuba (La Habana)" },
  { value: "America/Puerto_Rico", label: "Puerto Rico" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
  { value: "Atlantic/Canary", label: "España (Canarias)" },
]
