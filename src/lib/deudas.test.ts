import { describe, expect, it } from 'vitest'
import type { Abono, Deuda } from '../db/schema'
import { deudaPorSocio, estadoDeuda, resumenDeudas } from './deudas'

const deuda = (patch: Partial<Deuda> = {}): Deuda => ({
  id: 1,
  concepto: 'Galpón 2',
  categoria: 'estructura',
  monto: 450000,
  fecha: '2026-01-10',
  creado: 0,
  ...patch,
})

const abono = (id: number, monto: number, patch: Partial<Abono> = {}): Abono => ({
  id,
  deudaId: 1,
  fecha: '2026-03-01',
  monto,
  creado: 0,
  ...patch,
})

describe('estadoDeuda', () => {
  it('descuenta lo abonado y deja el saldo', () => {
    const e = estadoDeuda(deuda(), [abono(1, 200000), abono(2, 70000)])
    expect(e.abonado).toBe(270000)
    expect(e.saldo).toBe(180000)
    expect(e.pagadoPct).toBeCloseTo(60, 5)
  })

  it('ignora los abonos de otra deuda', () => {
    const e = estadoDeuda(deuda(), [abono(1, 100000), abono(2, 50000, { deudaId: 99 })])
    expect(e.abonado).toBe(100000)
  })

  it('no deja el saldo en negativo si abonaste de más', () => {
    expect(estadoDeuda(deuda({ monto: 1000 }), [abono(1, 1500)]).saldo).toBe(0)
  })

  it('ordena los abonos por fecha y guarda el último', () => {
    const e = estadoDeuda(deuda(), [
      abono(1, 10, { fecha: '2026-05-01' }),
      abono(2, 20, { fecha: '2026-02-01' }),
    ])
    expect(e.abonos.map((a) => a.id)).toEqual([2, 1])
    expect(e.ultimoAbono?.id).toBe(1)
  })
})

describe('el reparto entre socios', () => {
  const enSociedad = deuda({
    socios: [
      { nombre: 'Yo', pct: 60 },
      { nombre: 'Socio', pct: 40 },
    ],
  })

  it('a cada uno le toca su parte del total', () => {
    const [yo, socio] = estadoDeuda(enSociedad, []).socios
    expect(yo.leToca).toBe(270000)
    expect(socio.leToca).toBe(180000)
    expect(yo.leFalta).toBe(270000)
  })

  it('un abono con dueño cuenta entero para quien lo puso', () => {
    const [yo, socio] = estadoDeuda(enSociedad, [abono(1, 100000, { pagadoPor: 0 })]).socios
    expect(yo.haPuesto).toBe(100000)
    expect(socio.haPuesto).toBe(0)
    // De los 100.000 abonados a Yo le tocaban 60.000, así que puso 40.000 de más.
    expect(yo.ajuste).toBeCloseTo(40000, 5)
    expect(socio.ajuste).toBeCloseTo(-40000, 5)
  })

  it('un abono sin dueño salió de la caja común y se reparte', () => {
    const [yo, socio] = estadoDeuda(enSociedad, [abono(1, 100000)]).socios
    expect(yo.haPuesto).toBeCloseTo(60000, 5)
    expect(socio.haPuesto).toBeCloseTo(40000, 5)
    expect(yo.ajuste).toBeCloseTo(0, 5)
  })

  it('sin sociedad no hay partes que mostrar', () => {
    expect(estadoDeuda(deuda(), [abono(1, 100)]).socios).toEqual([])
    expect(estadoDeuda(deuda({ socios: [{ nombre: 'Yo', pct: 100 }] }), []).socios).toEqual([])
  })

  it('reparte parejo cuando los porcentajes no suman nada', () => {
    const d = deuda({
      monto: 1000,
      socios: [
        { nombre: 'A', pct: 0 },
        { nombre: 'B', pct: 0 },
      ],
    })
    expect(estadoDeuda(d, []).socios.map((s) => s.leToca)).toEqual([500, 500])
  })
})

describe('resumenDeudas', () => {
  const galpon = deuda()
  const equipo = deuda({ id: 2, concepto: 'Planta eléctrica', monto: 90000 })
  const abonos = [abono(1, 270000), abono(2, 90000, { deudaId: 2 })]

  it('suma el total, lo abonado y lo que falta', () => {
    const r = resumenDeudas([galpon, equipo], abonos)
    expect(r.total).toBe(540000)
    expect(r.abonado).toBe(360000)
    expect(r.saldo).toBe(180000)
  })

  it('pone primero lo que todavía se debe', () => {
    const r = resumenDeudas([equipo, galpon], abonos)
    expect(r.deudas[0].deuda.concepto).toBe('Galpón 2')
    expect(r.deudas[1].saldo).toBe(0)
  })

  it('sin deudas no divide por cero', () => {
    const r = resumenDeudas([], [])
    expect(r).toMatchObject({ total: 0, abonado: 0, saldo: 0, pagadoPct: 0 })
  })
})

describe('deudaPorSocio', () => {
  it('junta lo que cada uno lleva puesto en todas las deudas', () => {
    const socios = [
      { nombre: 'Yo', pct: 50 },
      { nombre: 'Socio', pct: 50 },
    ]
    const r = resumenDeudas(
      [deuda({ monto: 100000, socios }), deuda({ id: 2, monto: 60000, socios })],
      [abono(1, 40000, { pagadoPor: 0 }), abono(2, 20000, { deudaId: 2, pagadoPor: 1 })],
    )
    const [yo, socio] = deudaPorSocio(r.deudas)
    expect(yo.leToca).toBe(80000)
    expect(socio.leToca).toBe(80000)
    expect(yo.haPuesto).toBe(40000)
    expect(socio.haPuesto).toBe(20000)
  })
})
