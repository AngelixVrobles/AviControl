import { afterEach, describe, expect, it, vi } from 'vitest'
import { borrarBorradoresDe, guardarBorrador, leerBorrador, pesoSospechoso } from './borrador'
import { memoriaStorage } from '../test/storage'

afterEach(() => vi.unstubAllGlobals())

describe('borradores del pesaje', () => {
  it('se guardan y se leen por ciclo y por pesaje', () => {
    vi.stubGlobal('localStorage', memoriaStorage())
    guardarBorrador(3, undefined, { fecha: '2026-03-01', pesos: [4.1, 4.3] })
    guardarBorrador(3, 7, { fecha: '2026-03-02', pesos: [5] })
    expect(leerBorrador(3)?.pesos).toEqual([4.1, 4.3])
    expect(leerBorrador(3, 7)?.pesos).toEqual([5])
    expect(leerBorrador(4)).toBeNull()
  })

  // Al borrar el ciclo 3 se van sus borradores y no los del 31 ni los del 4,
  // ni los ajustes de la app.
  it('al borrar un ciclo se van solo los suyos', () => {
    const ls = memoriaStorage({ 'avicontrol.settings': '{}' })
    vi.stubGlobal('localStorage', ls)
    guardarBorrador(3, undefined, { fecha: '2026-03-01', pesos: [4] })
    guardarBorrador(3, 7, { fecha: '2026-03-01', pesos: [4] })
    guardarBorrador(31, undefined, { fecha: '2026-03-01', pesos: [4] })
    guardarBorrador(4, 2, { fecha: '2026-03-01', pesos: [4] })

    borrarBorradoresDe(3)
    expect(leerBorrador(3)).toBeNull()
    expect(leerBorrador(3, 7)).toBeNull()
    expect(leerBorrador(31)).not.toBeNull()
    expect(leerBorrador(4, 2)).not.toBeNull()
    expect(ls.getItem('avicontrol.settings')).toBe('{}')
  })

  it('sin decir cuál se van todos los borradores', () => {
    const ls = memoriaStorage({ 'avicontrol.settings': '{}' })
    vi.stubGlobal('localStorage', ls)
    guardarBorrador(1, undefined, { fecha: '2026-03-01', pesos: [4] })
    guardarBorrador(2, 5, { fecha: '2026-03-01', pesos: [4] })
    borrarBorradoresDe()
    expect(ls.length).toBe(1)
    expect(ls.getItem('avicontrol.settings')).toBe('{}')
  })
})

describe('pesoSospechoso', () => {
  it('marca el dedazo y no el ave normal', () => {
    const pesos = [4.1, 4.2, 4.3, 4.0, 4.4]
    expect(pesoSospechoso(42, pesos)).toBe(true)
    expect(pesoSospechoso(4.2, pesos)).toBe(false)
    expect(pesoSospechoso(42, [4, 4])).toBe(false)
  })
})
