import { describe, expect, it } from 'vitest'
import { galponDe, galponLibre, nombreGalpon, nuevoGalpon } from './galpones'
import { leerGalpones, type Galpon } from './settings'

const g1: Galpon = { id: 'g1', nombre: 'Galpón 1', largoM: 60, anchoM: 12 }
const g2: Galpon = { id: 'g2', nombre: 'Galpón 2', largoM: 40, anchoM: 10 }
const granja = { galpones: [g1, g2] }

describe('galponDe', () => {
  it('da el galpón del ciclo', () => {
    expect(galponDe({ galponId: 'g2' }, granja)).toBe(g2)
  })

  it('sin galpón, o con uno que ya no existe, es el primero', () => {
    expect(galponDe({}, granja)).toBe(g1)
    expect(galponDe({ galponId: 'quitado' }, granja)).toBe(g1)
    expect(galponDe(undefined, granja)).toBe(g1)
  })
})

describe('nuevoGalpon', () => {
  it('sigue la cuenta sin repetir nombre ni id', () => {
    const n = nuevoGalpon([g1, g2], 1000)
    expect(n.nombre).toBe('Galpón 3')
    expect([g1.id, g2.id]).not.toContain(n.id)
  })

  it('salta un nombre que ya está aunque falte otro', () => {
    // Se quitó el 2 y quedó el 3: el nuevo no puede llamarse «Galpón 3».
    const g3 = { id: 'g3', nombre: 'Galpón 3' }
    expect(nuevoGalpon([g1, g3], 1000).nombre).toBe('Galpón 4')
  })

  it('no reusa el id de otro galpón', () => {
    const a = nuevoGalpon([g1], 1000)
    const b = nuevoGalpon([g1, a], 1000)
    expect(b.id).not.toBe(a.id)
  })
})

describe('galponLibre', () => {
  it('es el primero sin ciclo en curso', () => {
    expect(galponLibre([g1, g2], [{ galponId: 'g1' }])).toBe(g2)
  })

  it('un ciclo sin galpón ocupa el primero', () => {
    expect(galponLibre([g1, g2], [{}])).toBe(g2)
  })

  it('un ciclo de un galpón quitado cuenta en el primero', () => {
    expect(galponLibre([g1, g2], [{ galponId: 'quitado' }])).toBe(g2)
  })

  it('con todos ocupados, el primero', () => {
    expect(galponLibre([g1, g2], [{ galponId: 'g1' }, { galponId: 'g2' }])).toBe(g1)
  })
})

describe('nombreGalpon', () => {
  it('con un solo galpón no se nombra', () => {
    expect(nombreGalpon({ galponId: 'g1' }, { galpones: [g1] })).toBeUndefined()
  })

  it('con varios dice cuál', () => {
    expect(nombreGalpon({ galponId: 'g2' }, granja)).toBe('Galpón 2')
  })
})

describe('leerGalpones', () => {
  it('las medidas sueltas de antes pasan al Galpón 1', () => {
    expect(leerGalpones({ galponLargoM: 50, galponAnchoM: 11 })).toEqual([
      { id: 'g1', nombre: 'Galpón 1', largoM: 50, anchoM: 11 },
    ])
  })

  it('sin nada queda un galpón sin medidas', () => {
    expect(leerGalpones({})).toEqual([{ id: 'g1', nombre: 'Galpón 1', largoM: undefined, anchoM: undefined }])
  })

  it('la lista guardada manda y se descarta lo que no es un galpón', () => {
    expect(leerGalpones({ galpones: [g2, null, { id: 3 }], galponLargoM: 50 })).toEqual([g2])
  })

  it('una lista vacía no deja la granja sin galpón', () => {
    expect(leerGalpones({ galpones: [] })).toHaveLength(1)
  })
})
