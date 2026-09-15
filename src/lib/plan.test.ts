import { describe, expect, it } from 'vitest'
import { computeInventarioAlimento, computePlanAlimento, consumoPorFase } from './plan'
import { computeMetrics } from './metrics'
import { gasto, lote, registro } from '../test/fixtures'
import { LB_POR_QUINTAL } from './standards'

const m = (l = lote(), registros = [] as ReturnType<typeof registro>[]) =>
  computeMetrics(l, registros, [], [])

describe('computePlanAlimento', () => {
  it('reparte el ciclo en fases sin repetir alimento', () => {
    const plan = computePlanAlimento(lote(), m())!
    const suma = plan.fases.reduce((a, f) => a + f.lb, 0)
    expect(suma).toBeCloseTo(plan.totalLb, 5)
    expect(plan.fases.length).toBeGreaterThan(2)
  })

  it('cuesta el plan cuando se sabe el precio del quintal', () => {
    const plan = computePlanAlimento(lote(), m(), 2000)!
    expect(plan.costoTotal).toBeCloseTo(plan.totalQuintales * 2000, 5)
  })

  it('marca la fase en curso y cuánto falta para la siguiente', () => {
    const plan = computePlanAlimento(lote(), m())!
    expect(plan.faseActual).toBeDefined()
    expect(plan.faseActual!.desde).toBeLessThanOrEqual(30)
    expect(plan.faseActual!.hasta).toBeGreaterThanOrEqual(30)
    if (plan.proximoCambio) expect(plan.proximoCambio.enDias).toBeGreaterThan(0)
  })
})

describe('consumoPorFase', () => {
  // El día 11 pertenece al iniciador, no al pre-inicio: si el corte se corre,
  // el alimento aparece en la fase equivocada.
  it('asigna cada día a su fase', () => {
    const registros = [
      registro(10, { alimentoLb: 100 }),
      registro(11, { alimentoLb: 200 }),
    ]
    const fases = consumoPorFase(lote(), registros, m(lote(), registros))
    expect(fases.find((f) => f.nombre === 'Pre-inicio')!.realLb).toBe(100)
    expect(fases.find((f) => f.nombre === 'Iniciador')!.realLb).toBe(200)
  })

  it('compara contra lo que tocaba hasta hoy, no contra la fase entera', () => {
    const registros = [registro(26, { alimentoLb: 100 })]
    const crecimiento = consumoPorFase(lote(), registros, m(lote(), registros)).find(
      (f) => f.nombre === 'Crecimiento',
    )!
    expect(crecimiento.enCurso).toBe(true)
    expect(crecimiento.planALaFechaLb).toBeLessThan(crecimiento.planTotalLb)
  })
})

describe('computeInventarioAlimento', () => {
  const registros = [registro(1, { alimentoLb: 1000 })]
  const met = m(lote(), registros)

  it('no hay existencia que mostrar sin compras', () => {
    expect(computeInventarioAlimento([], met, 40)).toBeNull()
  })

  // Con una sola compra sin cantidad el saldo miente; mejor no mostrarlo.
  it('solo cuadra si todas las compras traen quintales', () => {
    const conFalta = computeInventarioAlimento(
      [
        gasto({ id: 1, categoria: 'alimento', monto: 38000, cantidadQq: 20 }),
        gasto({ id: 2, categoria: 'alimento', monto: 20000 }),
      ],
      met,
      40,
    )!
    expect(conFalta.completo).toBe(false)
    expect(conFalta.comprasSinCantidad).toBe(1)
  })

  it('resta lo dado de lo comprado', () => {
    const inv = computeInventarioAlimento(
      [gasto({ categoria: 'alimento', monto: 38000, cantidadQq: 20 })],
      met,
      40,
    )!
    expect(inv.completo).toBe(true)
    expect(inv.consumidoQq).toBeCloseTo(1000 / LB_POR_QUINTAL, 5)
    expect(inv.existenciaQq).toBeCloseTo(10, 5)
    expect(inv.faltaComprarQq).toBeCloseTo(20, 5)
  })

  it('los días que alcanza salen del consumo del lote, no de una división plana', () => {
    const conStock = (qq: number) =>
      computeInventarioAlimento([gasto({ categoria: 'alimento', monto: 1, cantidadQq: qq })], met, 40)!

    // Consume 10 qq; con 20 compradas le quedan 10 para los días que vienen.
    expect(conStock(20).diasQueAlcanza).toBeGreaterThan(0)
    expect(conStock(30).diasQueAlcanza).toBeGreaterThan(conStock(20).diasQueAlcanza)

    // Medio quintal no cubre un día del día 30 en adelante.
    expect(conStock(10.5).diasQueAlcanza).toBe(0)
    expect(conStock(10).existenciaQq).toBe(0)
  })
})
