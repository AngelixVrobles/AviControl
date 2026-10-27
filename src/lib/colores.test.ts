import { describe, expect, it } from 'vitest'
import config from '../../tailwind.config.js'
import { COLOR } from './colores'

describe('COLOR', () => {
  // Cada valor dice en su comentario de qué token sale; si alguien cambia el
  // verde en Tailwind, la imagen y las gráficas no se pueden quedar atrás.
  it('son los mismos colores de Tailwind', () => {
    const c = config.theme.extend.colors
    expect(COLOR).toEqual({
      papel: c.paper.DEFAULT,
      papelAlto: c.paper.raised,
      papelHundido: c.paper.sunken,
      tinta: c.ink.DEFAULT,
      tintaSuave: c.ink.soft,
      tintaTenue: c.ink.faint,
      linea: c.line,
      verde: c.forest[600],
      verdeDato: c.forest[500],
      verdeClaro: c.forest[400],
      verdeOscuro: c.forest[700],
      verdeTinte: c.forest[50],
      ambar: c.amber[400],
      ambarTexto: c.amber.text,
      barro: c.clay.DEFAULT,
      barroTexto: c.clay.text,
    })
  })
})
