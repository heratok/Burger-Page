import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCustomizerDraft } from "./useCustomizerDraft"
import { DEFAULT_STORE_CONFIG } from "@/constants/themePresets"

describe("useCustomizerDraft", () => {
  it("initializes with storeConfig draft", () => {
    const onSave = vi.fn()
    const onReset = vi.fn()
    const { result } = renderHook(() =>
      useCustomizerDraft(DEFAULT_STORE_CONFIG, onSave, onReset)
    )

    expect(result.current.draft.name).toBe(DEFAULT_STORE_CONFIG.name)
    expect(result.current.previewDevice).toBe("desktop")
    expect(result.current.activeSection).toBe("templates")
  })

  it("updates draft properties and triggers onSave", () => {
    const onSave = vi.fn()
    const onReset = vi.fn()
    const { result } = renderHook(() =>
      useCustomizerDraft(DEFAULT_STORE_CONFIG, onSave, onReset)
    )

    act(() => {
      result.current.updateDraft({ name: "Custom Name", primaryColor: "#000000" })
    })

    expect(result.current.draft.name).toBe("Custom Name")
    expect(result.current.draft.primaryColor).toBe("#000000")

    act(() => {
      result.current.handleSave()
    })

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Custom Name",
        primaryColor: "#000000",
      })
    )
  })

  it("switches preview device between desktop and mobile", () => {
    const { result } = renderHook(() =>
      useCustomizerDraft(DEFAULT_STORE_CONFIG, vi.fn(), vi.fn())
    )

    act(() => {
      result.current.setPreviewDevice("mobile")
    })

    expect(result.current.previewDevice).toBe("mobile")
  })
})
