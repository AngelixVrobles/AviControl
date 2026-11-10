import { describe, expect, it } from 'vitest'
import config from '../../tailwind.config.js'

// La app se usa en el galpón, al sol y con el brazo estirado: el texto tiene
// que llegar al contraste AA de las pautas WCAG (4.5 a 1) sobre cada papel, y
// lo que se tiene que ver sin ser texto —un borde de campo, el borde del
// campo en que se escribe, una barra— a 3 a 1. Si alguien cambia un color,
// esto avisa antes de que no se lea.

const c = config.theme.extend.colors

const lineal = (canal: number) => {
  const x = canal / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}
const luminancia = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lineal(parseInt(hex.slice(i, i + 2), 16)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const papeles = { papel: c.paper.DEFAULT, alto: c.paper.raised, hundido: c.paper.sunken }

describe('el contraste de la paleta', () => {
  it.each([
    ['la tinta', c.ink.DEFAULT],
    ['la tinta suave', c.ink.soft],
    ['la tinta tenue', c.ink.faint],
    ['el verde', c.forest[600]],
    ['el verde de los datos', c.forest[500]],
    ['el ámbar de los avisos', c.amber.text],
    ['el barro de las pérdidas', c.clay.text],
  ])('%s se lee sobre cada papel', (_, color) => {
    for (const fondo of Object.values(papeles)) expect(contraste(color, fondo)).toBeGreaterThanOrEqual(4.5)
  })

  it('los avisos se leen sobre su tinte', () => {
    expect(contraste(c.amber.text, c.amber.tint)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(c.clay.text, c.clay.tint)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(c.forest[700], c.forest[50])).toBeGreaterThanOrEqual(4.5)
  })

  it('el texto de los botones se lee sobre el verde', () => {
    expect(contraste(c.paper.raised, c.forest[500])).toBeGreaterThanOrEqual(4.5)
    expect(contraste(c.paper.raised, c.forest[600])).toBeGreaterThanOrEqual(4.5)
  })

  it('los bordes de los campos, el del campo en que se escribe y la barra ámbar se ven', () => {
    for (const fondo of Object.values(papeles)) {
      expect(contraste(c.borde, fondo)).toBeGreaterThanOrEqual(3)
      expect(contraste(c.forest[600], fondo)).toBeGreaterThanOrEqual(3)
      expect(contraste(c.amber[500], fondo)).toBeGreaterThanOrEqual(3)
    }
  })
})
