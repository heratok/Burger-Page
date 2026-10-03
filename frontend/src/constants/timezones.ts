export interface TimezoneOption {
  value: string
  label: string
  group?: string
}

/** Curated IANA zones for Latin America and Spain; the admin select stays short. */
export const TIMEZONE_OPTIONS: readonly TimezoneOption[] = [
  { value: "America/Bogota", label: "Colombia (Bogotá)", group: "Latinoamérica" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)", group: "Latinoamérica" },
  { value: "America/Lima", label: "Perú (Lima)", group: "Latinoamérica" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil)", group: "Latinoamérica" },
  { value: "America/Caracas", label: "Venezuela (Caracas)", group: "Latinoamérica" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)", group: "Latinoamérica" },
  { value: "America/Santiago", label: "Chile (Santiago)", group: "Latinoamérica" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)", group: "Latinoamérica" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)", group: "Latinoamérica" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)", group: "Latinoamérica" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)", group: "Latinoamérica" },
  { value: "America/Panama", label: "Panamá", group: "Latinoamérica" },
  { value: "America/Costa_Rica", label: "Costa Rica", group: "Latinoamérica" },
  { value: "America/Guatemala", label: "Guatemala", group: "Latinoamérica" },
  { value: "America/El_Salvador", label: "El Salvador", group: "Latinoamérica" },
  { value: "America/Tegucigalpa", label: "Honduras (Tegucigalpa)", group: "Latinoamérica" },
  { value: "America/Managua", label: "Nicaragua (Managua)", group: "Latinoamérica" },
  { value: "America/Santo_Domingo", label: "República Dominicana", group: "Latinoamérica" },
  { value: "America/Havana", label: "Cuba (La Habana)", group: "Latinoamérica" },
  { value: "America/Puerto_Rico", label: "Puerto Rico", group: "Latinoamérica" },
  { value: "Europe/Madrid", label: "España (Madrid)", group: "España & Europa" },
  { value: "Atlantic/Canary", label: "España (Canarias)", group: "España & Europa" },
]
