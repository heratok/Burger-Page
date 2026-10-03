export interface CountryPhoneCode {
  code: string
  name: string
  dialCode: string
  flag: string
}

export const POPULAR_COUNTRY_CODES: CountryPhoneCode[] = [
  { code: "CO", name: "Colombia", dialCode: "57", flag: "🇨🇴" },
  { code: "MX", name: "México", dialCode: "52", flag: "🇲🇽" },
  { code: "US", name: "Estados Unidos", dialCode: "1", flag: "🇺🇸" },
  { code: "ES", name: "España", dialCode: "34", flag: "🇪🇸" },
  { code: "AR", name: "Argentina", dialCode: "54", flag: "🇦🇷" },
  { code: "CL", name: "Chile", dialCode: "56", flag: "🇨🇱" },
  { code: "PE", name: "Perú", dialCode: "51", flag: "🇵🇪" },
  { code: "BR", name: "Brasil", dialCode: "55", flag: "🇧🇷" },
  { code: "EC", name: "Ecuador", dialCode: "593", flag: "🇪🇨" },
  { code: "VE", name: "Venezuela", dialCode: "58", flag: "🇻🇪" },
  { code: "UY", name: "Uruguay", dialCode: "598", flag: "🇺🇾" },
  { code: "BO", name: "Bolivia", dialCode: "591", flag: "🇧🇴" },
  { code: "PY", name: "Paraguay", dialCode: "595", flag: "🇵🇾" },
  { code: "PA", name: "Panamá", dialCode: "507", flag: "🇵🇦" },
  { code: "CR", name: "Costa Rica", dialCode: "506", flag: "🇨🇷" },
  { code: "GT", name: "Guatemala", dialCode: "502", flag: "🇬🇹" },
  { code: "DO", name: "Rep. Dominicana", dialCode: "1809", flag: "🇩🇴" },
  { code: "SV", name: "El Salvador", dialCode: "503", flag: "🇸🇻" },
  { code: "HN", name: "Honduras", dialCode: "504", flag: "🇭🇳" },
  { code: "NI", name: "Nicaragua", dialCode: "505", flag: "🇳🇮" },
]

/** Dial code for numbers whose prefix is not in POPULAR_COUNTRY_CODES. */
export const UNLISTED_DIAL_CODE = ""

export function splitPhoneNumber(
  rawPhone?: string | null,
  defaultDialCode = "57"
): { dialCode: string; nationalNumber: string } {
  if (!rawPhone) {
    return { dialCode: defaultDialCode, nationalNumber: "" }
  }

  const rawCleaned = rawPhone.replace(/\D/g, "")
  if (!rawCleaned) {
    return { dialCode: defaultDialCode, nationalNumber: "" }
  }

  // Sort dial codes by length descending so longer codes match first (e.g. 1809 before 1)
  const sortedCodes = [...POPULAR_COUNTRY_CODES].sort(
    (a, b) => b.dialCode.length - a.dialCode.length
  )

  const matched = sortedCodes.find((c) => rawCleaned.startsWith(c.dialCode))
  if (matched) {
    return {
      dialCode: matched.dialCode,
      nationalNumber: rawCleaned.slice(matched.dialCode.length),
    }
  }

  // Unknown prefix: keep every digit so editing never prepends a guessed code.
  return { dialCode: UNLISTED_DIAL_CODE, nationalNumber: rawCleaned }
}

export function combinePhoneNumber(dialCode: string, nationalNumber: string): string {
  const cleaned = nationalNumber.replace(/\D/g, "")
  if (!cleaned) {
    return ""
  }
  const cleanDialCode = dialCode.replace(/\D/g, "")
  return `${cleanDialCode}${cleaned}`
}
