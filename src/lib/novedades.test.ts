import { describe, expect, it } from 'vitest'
import { NOVEDADES, tocaNovedades, versionCorta } from './novedades'

describe('qué hay de nuevo', () => {
  it('sale a quien ya tenía datos y no la ha visto', () => {
    expect(tocaNovedades(null, true)).toBe(true)
    expect(tocaNovedades('1.10', true)).toBe(true)
  })

  it('no sale dos veces ni a quien estrena la app', () => {
    expect(tocaNovedades(NOVEDADES.version, true)).toBe(false)
    expect(tocaNovedades(null, false)).toBe(false)
  })

  it('los arreglos no cuentan como versión nueva', () => {
    expect(versionCorta('1.11.3')).toBe('1.11')
  })

  it('la lista es de esta versión', () => {
    expect(versionCorta(__APP_VERSION__)).toBe(NOVEDADES.version)
  })
})
