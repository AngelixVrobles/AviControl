import { describe, expect, it } from 'vitest'
import { compararConOtros, curvaInversion, invertidoAlDia } from './inversion'
import { gasto, hace, lote } from '../test/fixtures'

// El lote de prueba empezó hace 30 días: el día N es hace(30 - N).
const enDia = (dia: number, monto: number, categoria: 'alimento' | 'medicina' | 'otros' = 'alimento', id = dia + 100) =>
  gasto({ id, categoria, monto, fecha: hace(30 - dia) })

describe('invertidoAlDia', () => {
  const gastos = [enDia(0, 20000), enDia(5, 3000, 'medicina'), enDia(12, 30000), enDia(25, 40000)]

  it('suma los pollitos y lo gastado hasta ese día, ni un día más', () => {
    const l = lote({ costoInicial: 24000, cantidadInicial: 500 })
    expect(invertidoAlDia(l, gastos, 0).total).toBe(44000)
    expect(invertidoAlDia(l, gastos, 11).total).toBe(47000)
    expect(invertidoAlDia(l, gastos, 12).total).toBe(77000)
    expect(invertidoAlDia(l, gastos, 30).total).toBe(117000)
    expect(invertidoAlDia(l, gastos, 12).porAve).toBeCloseTo(154, 5)
  })

  // Lo comprado antes de recibir los pollitos (alimento, gas, cascarilla) ya
  // estaba puesto el día 0.
  it('lo pagado antes de recibir cuenta desde el día 0', () => {
    const l = lote({ costoInicial: 0 })
    expect(invertidoAlDia(l, [enDia(-3, 9000)], 0).total).toBe(9000)
  })

  it('desglosa por categoría con los pollitos dentro de aves', () => {
    const l = lote({ costoInicial: 24000 })
    const partes = invertidoAlDia(l, gastos, 12).partes
    expect(partes[0]).toEqual({ categoria: 'alimento', monto: 50000 })
    expect(partes.find((p) => p.categoria === 'aves')!.monto).toBe(24000)
    expect(partes.find((p) => p.categoria === 'medicina')!.monto).toBe(3000)
  })

  it('un ciclo activo que no llega a esa edad dice hasta dónde va', () => {
    const l = lote()
    const r = invertidoAlDia(l, gastos, 40)
    expect(r.llego).toBe(false)
    expect(r.hastaDia).toBe(30)
    expect(r.total).toBe(24000 + 93000)
  })

  // Lo que se paga después de vender (el último flete, la mano de obra) es del
  // ciclo: a partir del cierre cuenta todo.
  it('un ciclo cerrado suma todo desde el día de cierre', () => {
    const l = lote({ estado: 'cerrado', fechaCierre: hace(10), costoInicial: 0 })
    const tarde = [...gastos, enDia(25, 5000, 'otros', 999)]
    expect(invertidoAlDia(l, tarde, 15).total).toBe(53000)
    const alCierre = invertidoAlDia(l, tarde, 20)
    expect(alCierre.total).toBe(98000)
    expect(alCierre.llego).toBe(true)
    expect(invertidoAlDia(l, tarde, 40).llego).toBe(false)
    expect(invertidoAlDia(l, tarde, 40).total).toBe(98000)
  })
})

describe('curvaInversion', () => {
  it('acumula por pollito día por día y se corta donde termina el ciclo', () => {
    const l = lote({ costoInicial: 500, cantidadInicial: 100, estado: 'cerrado', fechaCierre: hace(20) })
    const curva = curvaInversion(l, [enDia(2, 1000), enDia(8, 500)], 15)
    expect(curva[0]).toBe(5)
    expect(curva[1]).toBe(5)
    expect(curva[2]).toBe(15)
    expect(curva[8]).toBe(20)
    expect(curva[10]).toBe(20)
    expect(curva[11]).toBeUndefined()
  })

  it('coincide con invertidoAlDia', () => {
    const l = lote({ costoInicial: 24000 })
    const gastos = [enDia(0, 20000), enDia(12, 30000)]
    const curva = curvaInversion(l, gastos, 30)
    for (const d of [0, 11, 12, 30]) expect(curva[d]! * 500).toBeCloseTo(invertidoAlDia(l, gastos, d).total, 5)
  })
})

describe('compararConOtros', () => {
  const este = lote({ id: 2, fechaInicio: hace(30), costoInicial: 30000, cantidadInicial: 1000 })
  const anterior = lote({ id: 1, fechaInicio: hace(90), costoInicial: 30000, cantidadInicial: 1000, estado: 'cerrado', fechaCierre: hace(52) })
  const viejo = lote({ id: 3, fechaInicio: hace(200), costoInicial: 10000, cantidadInicial: 500, estado: 'cerrado', fechaCierre: hace(160) })

  it('compara por pollito a la misma edad y marca el ciclo anterior', () => {
    const propio = invertidoAlDia(este, [], 20)
    const c = compararConOtros(este, propio, [
      { lote: este, gastos: [] },
      { lote: viejo, gastos: [] },
      { lote: anterior, gastos: [gasto({ id: 7, loteId: 1, categoria: 'alimento', monto: 15000, fecha: hace(85) })] },
    ], 20)
    expect(c.map((x) => x.lote.id)).toEqual([1, 3])
    expect(c[0].anterior).toBe(true)
    expect(c[0].inversion.porAve).toBe(45)
    expect(c[0].difPct).toBeCloseTo(((30 - 45) / 45) * 100, 5)
    expect(c[1].anterior).toBe(false)
  })

  it('no saca diferencia contra un ciclo que no llegó a esa edad', () => {
    const propio = invertidoAlDia(este, [], 30)
    const c = compararConOtros(este, propio, [{ lote: anterior, gastos: [] }], 45)
    expect(c[0].inversion.llego).toBe(false)
    expect(c[0].difPct).toBeUndefined()
  })
})
