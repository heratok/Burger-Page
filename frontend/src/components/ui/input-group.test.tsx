import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import React from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group"

describe("InputGroup Components", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders InputGroup container correctly", () => {
    const { container } = render(
      <InputGroup className="custom-input-group">
        <InputGroupInput placeholder="Search..." />
      </InputGroup>
    )
    const el = container.querySelector('[data-slot="input-group"]')
    expect(el).toBeDefined()
    expect(el?.className).toContain("custom-input-group")
    expect(screen.getByPlaceholderText("Search...")).toBeDefined()
  })

  it("renders InputGroupAddon with default and custom alignments", () => {
    const { rerender } = render(
      <InputGroup>
        <InputGroupAddon data-testid="addon" align="inline-start">
          <span>Prefix</span>
        </InputGroupAddon>
        <InputGroupInput />
      </InputGroup>
    )

    let addon = screen.getByTestId("addon")
    expect(addon.getAttribute("data-align")).toBe("inline-start")

    rerender(
      <InputGroup>
        <InputGroupAddon data-testid="addon" align="inline-end">
          <span>Suffix</span>
        </InputGroupAddon>
      </InputGroup>
    )
    addon = screen.getByTestId("addon")
    expect(addon.getAttribute("data-align")).toBe("inline-end")

    rerender(
      <InputGroup>
        <InputGroupAddon data-testid="addon" align="block-start">
          <span>Top</span>
        </InputGroupAddon>
      </InputGroup>
    )
    addon = screen.getByTestId("addon")
    expect(addon.getAttribute("data-align")).toBe("block-start")

    rerender(
      <InputGroup>
        <InputGroupAddon data-testid="addon" align="block-end">
          <span>Bottom</span>
        </InputGroupAddon>
      </InputGroup>
    )
    addon = screen.getByTestId("addon")
    expect(addon.getAttribute("data-align")).toBe("block-end")
  })

  it("focuses the input when InputGroupAddon is clicked or triggered via keyboard", () => {
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <span>Click to focus</span>
        </InputGroupAddon>
        <InputGroupInput data-testid="target-input" />
      </InputGroup>
    )

    const addon = screen.getByTestId("addon")
    const input = screen.getByTestId("target-input")
    const focusSpy = vi.spyOn(input, "focus")

    // Click on addon focuses input
    fireEvent.click(addon)
    expect(focusSpy).toHaveBeenCalledTimes(1)

    // KeyDown Enter on addon focuses input
    fireEvent.keyDown(addon, { key: "Enter" })
    expect(focusSpy).toHaveBeenCalledTimes(2)

    // KeyDown Space on addon focuses input
    fireEvent.keyDown(addon, { key: " " })
    expect(focusSpy).toHaveBeenCalledTimes(3)

    // Other key on addon does not focus input
    fireEvent.keyDown(addon, { key: "Tab" })
    expect(focusSpy).toHaveBeenCalledTimes(3)
  })

  it("does not focus the input when clicking a button inside InputGroupAddon", () => {
    render(
      <InputGroup>
        <InputGroupAddon data-testid="addon">
          <button type="button" data-testid="nested-btn">Clear</button>
        </InputGroupAddon>
        <InputGroupInput data-testid="target-input" />
      </InputGroup>
    )

    const button = screen.getByTestId("nested-btn")
    const input = screen.getByTestId("target-input")
    const focusSpy = vi.spyOn(input, "focus")

    fireEvent.click(button)
    expect(focusSpy).not.toHaveBeenCalled()

    fireEvent.keyDown(button, { key: "Enter" })
    expect(focusSpy).not.toHaveBeenCalled()
  })

  it("renders InputGroupButton with proper variant and size classes", () => {
    render(
      <InputGroup>
        <InputGroupButton data-testid="group-btn" size="icon-sm" variant="outline">
          Action
        </InputGroupButton>
      </InputGroup>
    )

    const btn = screen.getByTestId("group-btn")
    expect(btn.getAttribute("data-size")).toBe("icon-sm")
    expect(btn.getAttribute("type")).toBe("button")
  })

  it("renders InputGroupText correctly", () => {
    render(
      <InputGroupText data-testid="group-text" className="custom-text">
        $ USD
      </InputGroupText>
    )

    const span = screen.getByTestId("group-text")
    expect(span.textContent).toBe("$ USD")
    expect(span.className).toContain("custom-text")
  })

  it("renders InputGroupTextarea forwardRef correctly", () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    render(
      <InputGroup>
        <InputGroupTextarea ref={ref} data-testid="group-textarea" placeholder="Enter notes..." />
      </InputGroup>
    )

    const textarea = screen.getByTestId("group-textarea")
    expect(textarea).toBeDefined()
    expect(ref.current).toBe(textarea)
    expect(textarea.getAttribute("data-slot")).toBe("input-group-control")
  })
})
