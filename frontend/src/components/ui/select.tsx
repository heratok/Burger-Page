import * as React from "react"
import {
  ModernSelect,
  type ModernSelectOption,
  type ModernSelectProps,
} from "./ModernSelect"

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
  badge?: string
  icon?: React.ReactNode
  flagCode?: string
  sublabel?: string
  group?: string
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "onChange"> {
  label?: string
  error?: string
  leftIcon?: React.ReactNode
  size?: "sm" | "md" | "lg"
  variant?: "default" | "outline" | "filled" | "ghost"
  containerClassName?: string
  menuClassName?: string
  options?: (SelectOption | SelectGroup | ModernSelectOption)[]
  searchable?: boolean
  searchPlaceholder?: string
  placeholder?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

function parseChildrenToOptions(children: React.ReactNode): ModernSelectOption[] {
  const result: ModernSelectOption[] = []

  const extractText = (node: React.ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") return String(node)
    if (Array.isArray(node)) return node.map(extractText).join("")
    if (React.isValidElement(node) && node.props && (node.props as any).children) {
      return extractText((node.props as any).children)
    }
    return ""
  }

  const processNode = (node: React.ReactNode, currentGroup?: string) => {
    if (!node) return

    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return

      // Handle Fragment
      if (child.type === React.Fragment) {
        processNode((child.props as any).children, currentGroup)
        return
      }

      // Handle optgroup
      if (
        child.type === "optgroup" ||
        (typeof child.type === "string" && child.type.toLowerCase() === "optgroup")
      ) {
        const groupLabel = (child.props as any).label || ""
        processNode((child.props as any).children, groupLabel)
        return
      }

      // Handle option
      if (
        child.type === "option" ||
        (typeof child.type === "string" && child.type.toLowerCase() === "option") ||
        typeof (child.props as any)?.value !== "undefined"
      ) {
        const text = extractText((child.props as any).children)
        const val = String((child.props as any).value ?? text)
        const label = (child.props as any).label || text || val
        const disabled = Boolean((child.props as any).disabled)
        result.push({
          value: val,
          label,
          disabled,
          ...(currentGroup ? { group: currentGroup } : {}),
        })
      }
    })
  }

  processNode(children)
  return result
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      id,
      name,
      required,
      disabled,
      className,
      containerClassName,
      menuClassName,
      label,
      error,
      leftIcon,
      size = "md",
      variant = "default",
      placeholder = "Seleccionar...",
      searchPlaceholder = "Buscar...",
      searchable,
      children,
      options,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    // 1. Normalize options or parse children
    const modernOptions = React.useMemo<ModernSelectOption[]>(() => {
      if (options && options.length > 0) {
        const flat: ModernSelectOption[] = []
        for (const item of options) {
          if ("options" in item && Array.isArray((item as SelectGroup).options)) {
            for (const opt of (item as SelectGroup).options) {
              flat.push({
                value: String(opt.value),
                label: opt.label,
                disabled: opt.disabled,
                group: (item as SelectGroup).label,
                badge: (opt as any).badge,
                icon: (opt as any).icon,
                flagCode: (opt as any).flagCode,
                sublabel: (opt as any).sublabel,
              })
            }
          } else {
            const opt = item as SelectOption | ModernSelectOption
            flat.push({
              value: String(opt.value),
              label: opt.label,
              disabled: opt.disabled,
              group: (opt as any).group,
              badge: (opt as any).badge,
              icon: (opt as any).icon,
              flagCode: (opt as any).flagCode,
              sublabel: (opt as any).sublabel,
            })
          }
        }
        return flat
      }

      if (children) {
        return parseChildrenToOptions(children)
      }

      return []
    }, [options, children])

    // 2. Controlled vs Uncontrolled state
    const [internalVal, setInternalVal] = React.useState<string>(() => {
      if (value !== undefined && value !== null) return String(value)
      if (defaultValue !== undefined && defaultValue !== null) return String(defaultValue)
      return ""
    })

    React.useEffect(() => {
      if (value !== undefined && value !== null) {
        setInternalVal(String(value))
      }
    }, [value])

    const currentValue = value !== undefined && value !== null ? String(value) : internalVal

    // 3. Synthetic onChange adapter
    const handleModernChange = React.useCallback(
      (nextVal: string) => {
        if (value === undefined) {
          setInternalVal(nextVal)
        }
        if (onChange) {
          const syntheticEvent = {
            target: {
              value: nextVal,
              name: name || "",
              id: id || "",
            },
            currentTarget: {
              value: nextVal,
              name: name || "",
              id: id || "",
            },
            value: nextVal,
            persist: () => {},
            preventDefault: () => {},
            stopPropagation: () => {},
          } as unknown as React.ChangeEvent<HTMLSelectElement>

          ;(onChange as any)(syntheticEvent, nextVal)
        }
      },
      [value, onChange, name, id]
    )

    return (
      <ModernSelect
        ref={ref}
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        aria-label={props["aria-label"]}
        ariaLabel={props["aria-label"]}
        label={label}
        error={error}
        leftIcon={leftIcon}
        size={size}
        variant={variant}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        searchable={searchable}
        className={className}
        containerClassName={containerClassName}
        menuClassName={menuClassName}
        value={currentValue}
        onChange={handleModernChange}
        options={modernOptions}
      />
    )
  }
)

Select.displayName = "Select"

export { ModernSelect, type ModernSelectOption, type ModernSelectProps }
