import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ModalShell } from "./modal-shell"

afterEach(() => {
  cleanup()
  document.body.removeAttribute("style")
})

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div>
      <main data-testid="background">
        <button onClick={() => setOpen(true)}>Open</button>
      </main>
      {open && (
        <ModalShell
          aria-labelledby="t"
          onClose={() => {
            onClose?.()
            setOpen(false)
          }}
        >
          <h2 id="t">Title</h2>
          <button>First</button>
          <input aria-label="Field" />
          <button>Last</button>
        </ModalShell>
      )}
    </div>
  )
}

const openModal = () => {
  const trigger = screen.getByText("Open")
  trigger.focus()
  fireEvent.click(trigger)
  return trigger
}

describe("ModalShell", () => {
  it("exposes dialog semantics with an accessible name", () => {
    render(<Harness />)
    openModal()
    const dialog = screen.getByRole("dialog", { name: "Title" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
  })

  it("moves focus inside on open, honouring data-modal-initial-focus", () => {
    render(<Harness />)
    openModal()
    expect(document.activeElement).toBe(screen.getByText("First"))
    cleanup()
    render(
      <ModalShell aria-label="x">
        <button>A</button>
        <button data-modal-initial-focus>Safe</button>
      </ModalShell>
    )
    expect(document.activeElement).toBe(screen.getByText("Safe"))
  })

  it("keeps an autoFocus field that already took focus", () => {
    render(
      <ModalShell aria-label="x">
        <button>A</button>
        <input aria-label="auto" autoFocus />
      </ModalShell>
    )
    expect(document.activeElement).toBe(screen.getByLabelText("auto"))
  })

  it("wraps Tab and Shift+Tab inside the dialog", () => {
    render(<Harness />)
    openModal()
    const first = screen.getByText("First")
    const last = screen.getByText("Last")
    last.focus()
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it("closes on Escape and restores focus to the trigger", () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const trigger = openModal()
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it("does not close when an inner widget already consumed Escape", () => {
    const onClose = vi.fn()
    render(
      <ModalShell aria-label="x" onClose={onClose}>
        <input
          aria-label="inner"
          onKeyDown={(e) => {
            if (e.key === "Escape") e.preventDefault()
          }}
        />
      </ModalShell>
    )
    fireEvent.keyDown(screen.getByLabelText("inner"), { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
  })

  it("without onClose the modal ignores Escape", () => {
    render(
      <ModalShell aria-label="x">
        <button>A</button>
      </ModalShell>
    )
    fireEvent.keyDown(screen.getByText("A"), { key: "Escape" })
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("only the topmost of stacked modals handles Escape", () => {
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <ModalShell aria-label="outer" onClose={outer}>
        <button>Outer button</button>
        <ModalShell aria-label="inner" onClose={inner}>
          <button>Inner button</button>
        </ModalShell>
      </ModalShell>
    )
    fireEvent.keyDown(screen.getByText("Inner button"), { key: "Escape" })
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it("makes the background inert and locks body scroll, releasing both on unmount", () => {
    const { unmount } = render(<Harness />)
    openModal()
    expect(screen.getByTestId("background").hasAttribute("inert")).toBe(true)
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" })
    expect(screen.getByTestId("background").hasAttribute("inert")).toBe(false)
    expect(document.body.style.overflow).toBe("")
    unmount()
  })

  it("keeps the scroll lock until the last stacked modal unmounts", () => {
    const a = render(<ModalShell aria-label="a"><button>a</button></ModalShell>)
    const b = render(<ModalShell aria-label="b"><button>b</button></ModalShell>)
    expect(document.body.style.overflow).toBe("hidden")
    b.unmount()
    expect(document.body.style.overflow).toBe("hidden")
    a.unmount()
    expect(document.body.style.overflow).toBe("")
  })
})
