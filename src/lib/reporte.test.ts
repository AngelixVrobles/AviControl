import { describe, expect, it } from 'vitest'
import { partir } from './reporte'

// Diez puntos por letra: se sabe de antemano dónde cae cada corte.
const regla = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics }

describe('partir', () => {
  it('pasa de renglón por palabras en vez de cortar con «…»', () => {
    expect(partir(regla, 'Mínimo por lb arreglada', 120)).toEqual(['Mínimo por', 'lb arreglada'])
  })

  it('lo que cabe queda en un renglón', () => {
    expect(partir(regla, 'Mortalidad', 200)).toEqual(['Mortalidad'])
  })

  it('una palabra más larga que el renglón va sola, sin perderse', () => {
    expect(partir(regla, 'Granja Supercalifragilística', 100)).toEqual(['Granja', 'Supercalifragilística'])
  })
})
