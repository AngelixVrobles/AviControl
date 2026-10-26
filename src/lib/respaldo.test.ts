import { describe, expect, it } from 'vitest'
import {
  diasSinRespaldo,
  fechaDelRespaldo,
  nombreRespaldo,
  tocaRecordarRespaldo,
  validarRespaldo,
  type Respaldo,
} from './respaldo'
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

// Restaurar reemplaza todo: antes de hacerlo se dice de cuándo es el archivo,
// para no volver sin querer a uno de hace un mes.
describe('fechaDelRespaldo', () => {
  const vacio: Respaldo = { lotes: [], registros: [], gastos: [], ingresos: [], pesajes: [], aplicaciones: [], deudas: [], abonos: [], entregas: [] }

  it('uno nuevo dice el día en que se hizo, en la hora de aquí', () => {
    // Las 9 de la noche en Santo Domingo ya son mañana en Londres.
    const r = { ...vacio, exportado: new Date(2026, 9, 12, 21, 0).toISOString() }
    expect(fechaDelRespaldo(r)).toEqual({ fecha: '2026-10-12', exacta: true })
  })

  it('uno de antes de la 1.13 dice el último día que trae anotado', () => {
    const r = {
      ...vacio,
      lotes: [lote({ fechaInicio: '2026-09-01' })],
      registros: [registro(1, { fecha: '2026-09-02' }), registro(2, { fecha: '2026-09-20' })],
      gastos: [gasto({ fecha: '2026-09-25' })],
    }
    expect(fechaDelRespaldo(r)).toEqual({ fecha: '2026-09-25', exacta: false })
  })

  it('sin nada anotado no dice nada', () => {
    expect(fechaDelRespaldo(vacio)).toBeUndefined()
  })

  it('una fecha de respaldo que no es fecha se ignora', () => {
    const r = validarRespaldo(
      { version: 4, exportado: 'ayer', lotes: [], registros: [], gastos: [], ingresos: [] },
      4,
    )
    expect(r.ok && r.respaldo.exportado).toBe(undefined)
  })
})

describe('haceCuanto', () => {
  it('dice hoy y ayer, no «hace 0 días»', () => {
    expect(haceCuanto(0)).toBe('hoy')
    expect(haceCuanto(1)).toBe('ayer')
    expect(haceCuanto(12)).toBe('hace 12 días')
  })
})
