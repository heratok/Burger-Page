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
