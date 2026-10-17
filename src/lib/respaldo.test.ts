import { describe, expect, it } from 'vitest'
import { diasSinRespaldo, nombreRespaldo, tocaRecordarRespaldo, validarRespaldo } from './respaldo'
import { haceCuanto } from './format'
import { gasto, ingreso, lote, registro } from '../test/fixtures'

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

describe('validarRespaldo', () => {
  const base = () => ({
    version: 4,
    settings: { granja: 'El Sol' },
    lotes: [lote()],
    registros: [registro(1, { alimentoLb: 50 }), registro(2, { alimentoLb: 60 })],
    gastos: [gasto({ monto: 500 })],
    ingresos: [ingreso({ monto: 900 })],
  })

  it('deja pasar un respaldo bueno y completa las listas que faltan', () => {
    const r = validarRespaldo(base(), 4)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.respaldo.pesajes).toEqual([])
      expect(r.respaldo.deudas).toEqual([])
      expect(r.respaldo.settings?.granja).toBe('El Sol')
    }
  })

  it('lo que no es un respaldo se dice', () => {
    for (const malo of [null, [], 'hola', { lotes: [] }]) {
      const r = validarRespaldo(malo, 4)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/formato de un respaldo/)
    }
  })

  it('uno de una versión más nueva pide actualizar', () => {
    const r = validarRespaldo({ ...base(), version: 9 }, 4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/versión más nueva/)
  })

  it('una fila dañada no deja restaurar nada, y dice cuál', () => {
    const data = base()
    data.gastos.push({ ...gasto(), id: 2, monto: 'mil' as unknown as number })
    const r = validarRespaldo(data, 4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('El respaldo está dañado: 1 gasto viene incompleto o dañado. No se cambió nada.')
  })

  it('dos filas con el mismo número no entran', () => {
    const data = base()
    data.registros.push(registro(1))
    const r = validarRespaldo(data, 4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/repite el número de otro/)
  })

  it('un respaldo viejo en kilos pasa a libras antes de revisarse', () => {
    const { alimentoLb: _a, ...sinLibras } = registro(1, { pesoPromedio: 1 })
    const data = { ...base(), version: 1, registros: [{ ...sinLibras, alimentoKg: 10 }] }
    const r = validarRespaldo(data, 4)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.respaldo.registros[0].alimentoLb).toBe(22)
      expect(r.respaldo.registros[0].pesoPromedio).toBe(2.2)
      expect('alimentoKg' in r.respaldo.registros[0]).toBe(false)
    }
  })

  it('una fila que no es una fila no rompe la migración', () => {
    const r = validarRespaldo({ ...base(), registros: [null] }, 4)
    expect(r.ok).toBe(false)
  })
})

describe('haceCuanto', () => {
  it('dice hoy y ayer, no «hace 0 días»', () => {
    expect(haceCuanto(0)).toBe('hoy')
    expect(haceCuanto(1)).toBe('ayer')
    expect(haceCuanto(12)).toBe('hace 12 días')
  })
})
