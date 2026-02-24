declare global {
  interface Window {
    createLemonSqueezy?: () => void
    LemonSqueezy?: {
      Url: {
        Open: (url: string) => void
        Close: () => void
      }
      Setup: (config: {
        eventHandler?: (event: { event: string; data?: unknown }) => void
      }) => void
    }
  }
}

export {}
