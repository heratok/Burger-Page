import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs"
import { Utensils, Settings } from "lucide-react"

describe("Tabs UI Component Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
  })

  it("renders Tabs, TabsList, TabsTrigger, and TabsContent with correct accessibility attributes", () => {
    render(
      <Tabs value="tab1" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content for Tab 1</TabsContent>
        <TabsContent value="tab2">Content for Tab 2</TabsContent>
      </Tabs>
    )

    const tab1 = screen.getByRole("tab", { name: "Tab 1" })
    const tab2 = screen.getByRole("tab", { name: "Tab 2" })

    expect(tab1).toBeDefined()
    expect(tab2).toBeDefined()
    expect(tab1.getAttribute("aria-selected")).toBe("true")
    expect(tab2.getAttribute("aria-selected")).toBe("false")

    // Active panel is rendered, inactive panel is not in document
    const activePanel = screen.getByRole("tabpanel")
    expect(activePanel.textContent).toContain("Content for Tab 1")
    expect(screen.queryByText("Content for Tab 2")).toBeNull()
  })

  it("calls onValueChange when clicking an inactive tab trigger", () => {
    const handleValueChange = vi.fn()
    render(
      <Tabs value="profile" onValueChange={handleValueChange}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const settingsTab = screen.getByRole("tab", { name: "Settings" })
    fireEvent.click(settingsTab)

    expect(handleValueChange).toHaveBeenCalledTimes(1)
    expect(handleValueChange).toHaveBeenCalledWith("settings")
  })

  it("works seamlessly in a controlled component state cycle", () => {
    const ControlledTabsWrapper = () => {
      const [currentTab, setCurrentTab] = useState("overview")

      return (
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview Panel Data</TabsContent>
          <TabsContent value="analytics">Analytics Panel Data</TabsContent>
        </Tabs>
      )
    }

    render(<ControlledTabsWrapper />)

    expect(screen.getByText("Overview Panel Data")).toBeDefined()
    expect(screen.queryByText("Analytics Panel Data")).toBeNull()

    const analyticsTab = screen.getByRole("tab", { name: "Analytics" })
    fireEvent.click(analyticsTab)

    expect(screen.queryByText("Overview Panel Data")).toBeNull()
    expect(screen.getByText("Analytics Panel Data")).toBeDefined()
    expect(analyticsTab.getAttribute("aria-selected")).toBe("true")
  })

  it("renders badges and icons correctly inside TabsTrigger", () => {
    render(
      <Tabs value="active-tab" onValueChange={vi.fn()}>
        <TabsList>
          <TabsTrigger
            value="active-tab"
            icon={<Utensils data-testid="utensils-icon" />}
            badge={5}
          >
            Orders
          </TabsTrigger>
          <TabsTrigger
            value="inactive-tab"
            icon={<Settings data-testid="settings-icon" />}
            badge="New"
          >
            Settings
          </TabsTrigger>
        </TabsList>
      </Tabs>
    )

    expect(screen.getByTestId("utensils-icon")).toBeDefined()
    expect(screen.getByTestId("settings-icon")).toBeDefined()

    const activeBadge = screen.getByText("5")
    expect(activeBadge).toBeDefined()
    expect(activeBadge.className).toContain("bg-primary")

    const inactiveBadge = screen.getByText("New")
    expect(inactiveBadge).toBeDefined()
    expect(inactiveBadge.className).toContain("bg-muted-foreground/20")
  })

  it("applies custom classNames to Tabs, TabsList, TabsTrigger, and TabsContent", () => {
    const { container } = render(
      <Tabs value="tab1" onValueChange={vi.fn()} className="custom-tabs-container">
        <TabsList className="custom-tabs-list">
          <TabsTrigger value="tab1" className="custom-tab-trigger">
            Tab 1
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tab1" className="custom-tab-content">
          Content 1
        </TabsContent>
      </Tabs>
    )

    expect(container.querySelector(".custom-tabs-container")).toBeDefined()
    expect(container.querySelector(".custom-tabs-list")).toBeDefined()
    expect(container.querySelector(".custom-tab-trigger")).toBeDefined()
    expect(container.querySelector(".custom-tab-content")).toBeDefined()
  })

  it("throws descriptive error when TabsTrigger or TabsContent is used outside Tabs context", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => render(<TabsTrigger value="invalid">Orphan Trigger</TabsTrigger>)).toThrow(
      "TabsTrigger must be used inside Tabs"
    )

    expect(() => render(<TabsContent value="invalid">Orphan Content</TabsContent>)).toThrow(
      "TabsContent must be used inside Tabs"
    )

    consoleError.mockRestore()
  })
})
