import { describe, expect, it } from 'vitest'
import { retiroDe, retiroEn, ultimaDosis } from './retiro'
import { computeAlertas } from './alerts'
import { computeMetrics } from './metrics'
import { hace, lote } from '../test/fixtures'
import type { Aplicacion } from '../db/schema'

const medicina = (patch: Partial<Aplicacion>): Aplicacion => ({
  id: 1,
  loteId: 1,
  fecha: '2026-10-10',
  tipo: 'medicina',
  nombre: 'Enrofloxacina',
  creado: 0,
  ...patch,
})

describe('retiro', () => {
  it('cuenta desde la última dosis de un tratamiento de varios días', () => {
    expect(ultimaDosis({ fecha: '2026-10-10', diasTratamiento: 5 })).toBe('2026-10-14')
    expect(retiroDe(medicina({ diasTratamiento: 5, retiroDias: 7 }))?.libreDesde).toBe('2026-10-21')
  })

  it('una sola dosis cuenta desde ese día', () => {
    expect(retiroDe(medicina({ retiroDias: 3 }))?.libreDesde).toBe('2026-10-13')
  })

  it('sin días de retiro no hay retiro', () => {
    expect(retiroDe(medicina({}))).toBeUndefined()
    expect(retiroDe(medicina({ retiroDias: 0 }))).toBeUndefined()
  })

  it('una venta dentro del retiro lo encuentra, y con varias manda la que termina más tarde', () => {
    const aps = [
      medicina({ id: 1, retiroDias: 3 }),
      medicina({ id: 2, nombre: 'Sulfa', fecha: '2026-10-12', retiroDias: 10 }),
    ]
    expect(retiroEn(aps, '2026-10-15')?.nombre).toBe('Sulfa')
    expect(retiroEn(aps, '2026-10-22')).toBeUndefined()
  })

  it('lo que se dio después de la venta no cuenta para esa venta', () => {
    expect(retiroEn([medicina({ fecha: '2026-10-20', retiroDias: 7 })], '2026-10-15')).toBeUndefined()
  })
})

describe('alerta de retiro', () => {
  const alertas = (aplicaciones: Aplicacion[], dias = 38) => {
    const l = lote({ fechaInicio: hace(dias) })
    return computeAlertas(l, [], [], computeMetrics(l, [], [], []), { plan: [], aplicaciones })
  }

  it('si el retiro pasa del día de venta, no se vende antes', () => {
    const a = alertas([medicina({ fecha: hace(1), retiroDias: 10 })])
    const r = a.find((x) => x.texto.startsWith('No vendas antes del'))
    expect(r?.nivel).toBe('bad')
    expect(r?.texto).toContain('Enrofloxacina tiene 10 días de retiro')
  })

  it('si se cumple antes de la venta, solo informa', () => {
    const a = alertas([medicina({ fecha: hace(1), retiroDias: 2 })], 20)
    expect(a.find((x) => x.texto.startsWith('En retiro de Enrofloxacina'))?.nivel).toBe('info')
  })

  it('un retiro cumplido ya no dice nada', () => {
    const a = alertas([medicina({ fecha: hace(10), retiroDias: 3 })])
    expect(a.some((x) => x.texto.includes('Enrofloxacina'))).toBe(false)
  })
})
