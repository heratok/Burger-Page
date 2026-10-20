import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'

describe('index.html static link-preview defaults', () => {
  it.each([
    ['og:type', 'website'],
    ['og:site_name', 'FoodOS'],
    ['og:title', 'FoodOS'],
    ['og:description', 'Haz tu pedido en línea y recíbelo en la puerta de tu casa.'],
    ['og:image', 'https://heratok.app/logo.jpg'],
  ])('declares %s', (property, content) => {
    expect(html).toContain(`<meta property="${property}" content="${content}" />`)
  })

  it('declares a summary twitter card with title, description and image', () => {
    expect(html).toContain('<meta name="twitter:card" content="summary" />')
    expect(html).toContain('<meta name="twitter:title" content="FoodOS" />')
    expect(html).toContain('<meta name="twitter:image" content="https://heratok.app/logo.jpg" />')
    expect(html).toContain(
      '<meta name="twitter:description" content="Haz tu pedido en línea y recíbelo en la puerta de tu casa." />',
    )
  })
})
