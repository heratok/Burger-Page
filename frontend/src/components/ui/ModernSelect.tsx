import React, { useState, useRef, useEffect, useMemo } from "react"
import { ChevronDown, Check, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ModernSelectOption {
  value: string
  label: string
  sublabel?: string
  badge?: string
  icon?: React.ReactNode
  flagCode?: string // e.g. "CO", "MX", "US" -> renders 20x15 flag thumbnail via https://flagcdn.com/28x21/${code.toLowerCase()}.png with fallback
  group?: string
  disabled?: boolean
}

export interface ModernSelectProps {
  id?: string
  name?: string
  required?: boolean
  label?: string
  ariaLabel?: string
  "aria-label"?: string
  value: string
  onChange: (value: string) => void
  options: ModernSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  searchable?: boolean // default true if options.length > 5
  disabled?: boolean
  size?: "sm" | "md" | "lg"
  variant?: "default" | "outline" | "filled" | "ghost"
  className?: string
  containerClassName?: string
  menuClassName?: string
  leftIcon?: React.ReactNode
  error?: string
  ref?: React.Ref<HTMLSelectElement>
}

export const FlagThumbnail: React.FC<{ code: string; alt?: string }> = ({ code, alt }) => {
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
  }, [code])

  if (error || !code) {
    return (
      <span
        aria-hidden="true"
        className="w-5 h-3.5 rounded-xs bg-slate-100 dark:bg-slate-800 text-[9px] font-mono font-bold flex items-center justify-center shrink-0 text-slate-500 border border-slate-200 dark:border-slate-700 select-none"
      >
        {code ? code.toUpperCase().slice(0, 2) : "??"}
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/28x21/${code.toLowerCase()}.png`}
      alt={alt || code}
      width={20}
      height={15}
      loading="lazy"
      onError={() => setError(true)}
      className="w-5 h-3.5 object-cover rounded-xs shadow-2xs shrink-0 border border-black/10 dark:border-white/10"
    />
  )
}

export const ModernSelect = React.forwardRef<HTMLSelectElement, ModernSelectProps>(
  (
    {
      id,
      name,
      required,
      label,
      ariaLabel,
      "aria-label": ariaLabelAttr,
      value,
      onChange,
      options,
      placeholder = "Seleccionar...",
      searchPlaceholder = "Buscar...",
      searchable,
      disabled = false,
      size = "md",
      variant = "default",
      className,
      containerClassName,
      menuClassName,
      leftIcon,
      error,
    },
    ref
  ) => {
    const effectiveAriaLabel = ariaLabel || ariaLabelAttr || label
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [focusedIndex, setFocusedIndex] = useState(-1)

    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const isSearchable = searchable ?? options.length > 5

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value)
  }, [options, value])

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return options
    return options.filter((opt) => {
      const matchLabel = opt.label?.toLowerCase().includes(query) ?? false
      const matchSublabel = opt.sublabel?.toLowerCase().includes(query) ?? false
      const matchBadge = opt.badge?.toLowerCase().includes(query) ?? false
      const matchValue = opt.value?.toLowerCase().includes(query) ?? false
      return matchLabel || matchSublabel || matchBadge || matchValue
    })
  }, [options, searchQuery])

  useEffect(() => {
    if (isOpen) {
      const selectedIdx = filteredOptions.findIndex((o) => o.value === value)
      setFocusedIndex(selectedIdx >= 0 ? selectedIdx : 0)
      if (isSearchable) {
        const timer = setTimeout(() => {
          searchInputRef.current?.focus()
        }, 10)
        return () => clearTimeout(timer)
      }
    } else {
      setSearchQuery("")
      setFocusedIndex(-1)
    }
  }, [isOpen, isSearchable, value, filteredOptions])

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView?.({ block: "nearest" })
    }
  }, [focusedIndex, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery("")
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
    }
  }, [isOpen])

  const handleSelectOption = (opt: ModernSelectOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    setIsOpen(false)
    setSearchQuery("")
    triggerRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === "Escape") {
      e.preventDefault()
      setIsOpen(false)
      setSearchQuery("")
      triggerRef.current?.focus()
      return
    }

    if (e.key === "Tab") {
      setIsOpen(false)
      setSearchQuery("")
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (filteredOptions.length === 0) return
      setFocusedIndex((prev) => {
        let next = prev + 1
        while (next < filteredOptions.length && filteredOptions[next].disabled) {
          next++
        }
        return next < filteredOptions.length ? next : prev
      })
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      if (filteredOptions.length === 0) return
      setFocusedIndex((prev) => {
        let next = prev - 1
        while (next >= 0 && filteredOptions[next].disabled) {
          next--
        }
        return next >= 0 ? next : prev
      })
      return
    }

    if (e.key === "Enter") {
      e.preventDefault()
      if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
        const opt = filteredOptions[focusedIndex]
        if (!opt.disabled) {
          handleSelectOption(opt)
        }
      } else if (filteredOptions.length > 0 && !filteredOptions[0].disabled) {
        handleSelectOption(filteredOptions[0])
      }
      return
    }
  }

  const sizeClasses = {
    sm: "text-xs py-1.5 px-2.5 min-h-[34px]",
    md: "text-xs py-2.5 px-3 min-h-[40px]",
    lg: "text-sm py-3 px-3.5 min-h-[46px]",
  }[size]

  const variantClasses = {
    default:
      "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600",
    outline:
      "border-2 border-slate-200 bg-transparent text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600",
    filled:
      "border-transparent bg-slate-100/90 text-slate-900 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800",
    ghost:
      "border-transparent bg-transparent text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60",
  }[variant]

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={cn("relative w-full", containerClassName)}
    >
      {label && (
        <label
          htmlFor={id}
          onClick={() => triggerRef.current?.focus()}
          className="font-semibold block mb-1 text-slate-800 dark:text-slate-200 text-xs cursor-pointer"
        >
          {label}
        </label>
      )}

      {/* Accessible hidden native select for testing-library and form synchronization */}
      <select
        ref={ref}
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        aria-label={effectiveAriaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="sr-only"
      >
        {value && !options.some((o) => o.value === value) && (
          <option value={value}>{value}</option>
        )}
        {(() => {
          const hasGroups = options.some((o) => o.group)
          if (!hasGroups) {
            return options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          }
          const groups: { name?: string; items: ModernSelectOption[] }[] = []
          for (const opt of options) {
            const lastGroup = groups[groups.length - 1]
            if (lastGroup && lastGroup.name === opt.group) {
              lastGroup.items.push(opt)
            } else {
              groups.push({ name: opt.group, items: [opt] })
            }
          }
          return groups.map((g, idx) =>
            g.name ? (
              <optgroup key={`group-${idx}`} label={g.name}>
                {g.items.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              g.items.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            )
          )
        })()}
      </select>

      {/* Modern Dropdown Trigger */}
      <button
        ref={triggerRef}
        id={id ? `${id}-trigger` : undefined}
        data-testid={id ? `${id}-trigger` : "modern-select-trigger"}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={id ? `${id}-menu` : undefined}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-xl border transition-all text-left cursor-pointer",
          variantClasses,
          error
            ? isOpen
              ? "border-rose-500 ring-2 ring-rose-500/20 dark:border-rose-500"
              : "border-rose-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-rose-500"
            : isOpen
              ? "ring-2 ring-indigo-500 border-indigo-500 dark:border-indigo-500"
              : "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          sizeClasses,
          className
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {leftIcon && (
            <span
              data-testid={id ? `${id}-left-icon` : undefined}
              className="shrink-0 text-slate-400 dark:text-slate-500 flex items-center justify-center pointer-events-none"
            >
              {leftIcon}
            </span>
          )}
          {selectedOption ? (
            <>
              {selectedOption.flagCode && (
                <FlagThumbnail code={selectedOption.flagCode} alt={selectedOption.label} />
              )}
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-medium text-slate-900 dark:text-white">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-600/60">
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : value ? (
            <span className="truncate font-medium text-slate-900 dark:text-white">{value}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {error && (
        <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400 block mt-1">
          {error}
        </span>
      )}

      {/* Floating Card Menu */}
      {isOpen && (
        <div
          id={id ? `${id}-menu` : undefined}
          data-testid={id ? `${id}-menu` : "modern-select-menu"}
          role="listbox"
          className={cn(
            "rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-1.5 space-y-1 z-50 absolute mt-1.5 left-0 right-0",
            menuClassName
          )}
        >
          {/* Search Filter Input */}
          {isSearchable && (
            <div className="relative px-1 pt-0.5 pb-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setFocusedIndex(0)
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-0.5 space-y-0.5 overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                No se encontraron opciones
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const showGroupHeader = Boolean(
                  opt.group && (index === 0 || filteredOptions[index - 1].group !== opt.group)
                )
                const isSelected = opt.value === value
                const isFocused = index === focusedIndex

                return (
                  <React.Fragment key={opt.value}>
                    {showGroupHeader && (
                      <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
                        {opt.group}
                      </div>
                    )}
                    <button
                      type="button"
                      ref={(el) => {
                        itemRefs.current[index] = el
                      }}
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      onClick={() => handleSelectOption(opt)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs text-left cursor-pointer transition-colors select-none",
                        isSelected
                          ? "bg-indigo-50/80 dark:bg-slate-800/90 text-indigo-900 dark:text-white font-medium"
                          : isFocused
                            ? "bg-indigo-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-white"
                            : "text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800/80",
                        opt.disabled && "opacity-40 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {opt.flagCode && <FlagThumbnail code={opt.flagCode} alt={opt.label} />}
                        {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                        <div className="min-w-0 truncate">
                          <span className="truncate block font-medium">{opt.label}</span>
                          {opt.sublabel && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {opt.badge && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <Check className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  </React.Fragment>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
})

ModernSelect.displayName = "ModernSelect"
