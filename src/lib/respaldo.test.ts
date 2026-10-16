import { describe, expect, it } from 'vitest'
import { diasSinRespaldo, nombreRespaldo, tocaRecordarRespaldo } from './respaldo'

describe('recordar el respaldo', () => {
  const hoy = '2026-10-16'

  it('sin datos no hay nada que respaldar', () => {
    expect(tocaRecordarRespaldo(null, false, hoy)).toBe(false)
  })

  it('con datos y nunca respaldado, se recuerda', () => {
    expect(tocaRecordarRespaldo(null, true, hoy)).toBe(true)
    expect(diasSinRespaldo(null, hoy)).toBeNull()
  })

  it('se recuerda a la semana, no antes', () => {
    expect(tocaRecordarRespaldo('2026-10-10', true, hoy)).toBe(false)
    expect(tocaRecordarRespaldo('2026-10-09', true, hoy)).toBe(true)
    expect(diasSinRespaldo('2026-10-09', hoy)).toBe(7)
  })

  it('el archivo lleva la fecha', () => {
    expect(nombreRespaldo(hoy)).toBe('avicontrol-respaldo-2026-10-16.json')
  })
})
