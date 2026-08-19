// Global jsdom test setup. jsdom does not implement window.matchMedia, which the
// shadcn Sidebar's useIsMobile hook needs. A desktop default (innerWidth >= 768)
// keeps the collapsible sidebar on the desktop path in tests.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom does not implement ResizeObserver, which Recharts v3's
// ResponsiveContainer uses to measure its parent. A no-op keeps the chart
// components (ChartContainer) from throwing when the dashboard mounts in tests.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}
