import { describe, expect, it } from 'vitest'
import { proyectarVenta } from './proyeccion'
import { computeMetrics } from './metrics'
import { gasto, hace, lote, registro } from '../test/fixtures'
import { pesoEstandarLb } from './standards'

const gastos = [gasto({ categoria: 'alimento', monto: 76000, cantidadQq: 40 })]

function proyectar(pesoDia30: number, objetivo = 5.5) {
  const l = lote({ precioVentaLb: 60 })
  const registros = [registro(30, { pesoPromedio: pesoDia30, alimentoLb: 4000 })]
  const m = computeMetrics(l, registros, gastos, [])
  return { p: proyectarVenta(l, registros, gastos, m, objetivo), m }
}

describe('proyectarVenta', () => {
  it('sin pesajes no proyecta nada', () => {
    const l = lote()
    const m = computeMetrics(l, [], gastos, [])
    expect(proyectarVenta(l, [], gastos, m, 5.5)).toBeNull()
  })

  it('marca listo cuando ya pasó el peso objetivo', () => {
    const { p } = proyectar(5.8)
    expect(p!.listo).toBe(true)
    expect(p!.alimentoRestanteLb).toBe(0)
    expect(p!.pesoVentaLb).toBe(5.8)
  })

  it('proyecta al peso objetivo cuando todavía no llega', () => {
    const { p } = proyectar(pesoEstandarLb(30))
    expect(p!.listo).toBe(false)
    expect(p!.pesoVentaLb).toBe(5.5)
    expect(p!.diaVenta).toBeGreaterThan(30)
    expect(p!.alimentoRestanteLb).toBeGreaterThan(0)
  })

  // Las aves que faltan por morirse no se venden: contarlas infla las libras.
  it('descuenta la mortalidad que falta por ocurrir', () => {
    const { p, m } = proyectar(4)
    expect(p!.avesAlVender).toBeLessThan(m.avesVivas)
    expect(p!.lbEnPie).toBe(Math.round(p!.avesAlVender * p!.pesoVentaLb))
  })

  it('un lote lento tarda más y come más', () => {
    const rapido = proyectar(pesoEstandarLb(30))
    const lento = proyectar(pesoEstandarLb(30) * 0.85)
    expect(lento.p!.diaVenta).toBeGreaterThan(rapido.p!.diaVenta)
    expect(lento.p!.alimentoRestanteLb).toBeGreaterThan(rapido.p!.alimentoRestanteLb)
  })

  it('el precio de equilibrio cubre exactamente el costo proyectado', () => {
    const { p } = proyectar(4)
    expect(p!.precioEquilibrioLb * p!.lbEnPie).toBeCloseTo(p!.costoProyectado, 0)
  })

  it('el costo proyectado incluye el alimento que falta comprar', () => {
    const { p, m } = proyectar(4)
    expect(p!.costoProyectado).toBeGreaterThan(m.costos)
    expect(p!.costoProyectado).toBeCloseTo(m.costos + p!.costoRestante, 5)
  })

  it('no proyecta un peso que la curva no alcanza', () => {
    expect(proyectar(4, 99).p).toBeNull()
  })

  // El alimento comprado por adelantado ya está en los costos: si además se
  // cobra como consumo futuro, el precio de equilibrio sube en todo lo que hay
  // en el almacén.
  describe('alimento en el almacén', () => {
    const l = lote({ precioVentaLb: 60 })
    const registros = [registro(30, { pesoPromedio: 4, alimentoLb: 4000 })]
    const proyectarCon = (compras: ReturnType<typeof gasto>[]) => {
      const m = computeMetrics(l, registros, compras, [])
      return { p: proyectarVenta(l, registros, compras, m, 5.5)!, m }
    }
    // 40 qq comprados y 40 dados: el almacén está vacío.
    const justo = [gasto({ id: 1, categoria: 'alimento', monto: 76000, cantidadQq: 40 })]
    const conAdelanto = (qq: number) => [
      ...justo,
      gasto({ id: 2, categoria: 'alimento', monto: 1900 * qq, cantidadQq: qq }),
    ]

    it('comprar por adelantado no cambia el costo proyectado', () => {
      const sinStock = proyectarCon(justo).p
      const conStock = proyectarCon(conAdelanto(10)).p
      expect(sinStock.existenciaLb).toBe(0)
      expect(conStock.existenciaLb).toBeCloseTo(1000, 5)
      expect(conStock.alimentoRestanteLb).toBe(sinStock.alimentoRestanteLb)
      expect(conStock.alimentoPorComprarLb).toBeCloseTo(sinStock.alimentoRestanteLb - 1000, 5)
      expect(conStock.costoProyectado).toBeCloseTo(sinStock.costoProyectado, 5)
      expect(conStock.precioEquilibrioLb).toBeCloseTo(sinStock.precioEquilibrioLb, 5)
    })

    it('si lo del almacén alcanza hasta la venta no falta nada por comprar', () => {
      const { p, m } = proyectarCon(conAdelanto(80))
      expect(p.alimentoPorComprarLb).toBe(0)
      expect(p.costoRestante).toBe(0)
      expect(p.costoProyectado).toBe(m.costos)
      expect(p.sobranteLb).toBeCloseTo(8000 - p.alimentoRestanteLb, 5)
    })

    // Con una compra sin quintales no se sabe cuánto hay: se supone que todo
    // falta por comprar, que se equivoca hacia el lado seguro.
    it('sin los quintales de todas las compras no descuenta nada', () => {
      const { p } = proyectarCon([
        ...conAdelanto(10),
        gasto({ id: 3, categoria: 'alimento', monto: 5000 }),
      ])
      expect(p.existenciaLb).toBe(0)
      expect(p.alimentoPorComprarLb).toBe(p.alimentoRestanteLb)
    })
  })
})

describe('proyectarVenta sin precio del alimento', () => {
  // Compras sin quintales, sin precio del quintal y sin alimento anotado: no hay
  // cómo saber cuánto cuesta la libra.
  const l = lote({ precioVentaLb: 60, costoInicial: 24000 })
  const registros = [registro(30, { pesoPromedio: 4 })]
  const compras = [
    gasto({ id: 1, categoria: 'alimento', monto: 60000 }),
    gasto({ id: 2, categoria: 'medicina', monto: 3000 }),
  ]

  // Antes los 24.000 de los pollitos entraban en el gasto por día y se
  // cobraban otra vez por cada día que faltaba.
  it('estima lo que falta con el gasto por día, sin los pollitos', () => {
    const m = computeMetrics(l, registros, compras, [])
    const p = proyectarVenta(l, registros, compras, m, 5.5)!
    expect(p.sinPrecioAlimento).toBe(true)
    expect(p.costoRestante).toBeCloseTo((63000 / m.dias) * p.diasRestantes, 5)
  })

  it('con precio del quintal no hace falta estimar', () => {
    const conPrecio = lote({ precioVentaLb: 60, costoInicial: 24000, precioQuintal: 1900 })
    const m = computeMetrics(conPrecio, registros, compras, [])
    expect(proyectarVenta(conPrecio, registros, compras, m, 5.5)!.sinPrecioAlimento).toBe(false)
  })
})

describe('proyección con el peso de hoy', () => {
  // Pesadas a 5.4 lb hace cuatro días: hoy ya pasaron las 5.5 lb. Antes decía
  // «vender» en una fecha que ya pasó y ponía el precio con 5.5 lb.
  it('decide si están listas con el peso estimado de hoy', () => {
    const l = lote({ precioVentaLb: 60, fechaInicio: hace(40) })
    const regs = [{ ...registro(36, { pesoPromedio: 5.4, alimentoLb: 9000 }), fecha: hace(4) }]
    const m = computeMetrics(l, regs, gastos, [])
    const p = proyectarVenta(l, regs, gastos, m, 5.5)!
    expect(m.pesoEstimadoLb!).toBeGreaterThan(5.5)
    expect(p.listo).toBe(true)
    expect(p.pesoVentaLb).toBeCloseTo(m.pesoEstimadoLb!, 5)
  })
})

describe('lo que falta por pagar además del alimento', () => {
  const l = lote({ precioVentaLb: 60 })
  const registros = [registro(30, { pesoPromedio: 4, alimentoLb: 4000 })]
  const base = (patch: Parameters<typeof lote>[0] = {}, compras = gastos) => {
    const ciclo = lote({ ...l, ...patch })
    const m = computeMetrics(ciclo, registros, compras, [])
    return { p: proyectarVenta(ciclo, registros, compras, m, 5.5)!, m }
  }

  // A la semana, hasta el día de la venta, menos lo ya anotado como mano de obra.
  it('suma lo que queda del pago de los empleados', () => {
    const compras = [...gastos, gasto({ id: 9, categoria: 'mano_obra', monto: 6000 })]
    const { p, m } = base({ empleados: { monto: 3500, cada: 'semana' } }, compras)
    expect(p.faltaEmpleados).toBeCloseTo((3500 / 7) * p.diaVenta - 6000, 5)
    expect(p.costoProyectado).toBeCloseTo(m.costos + p.faltaAlimento + p.faltaEmpleados, 5)
  })

  it('suma los gastos que ya se sabe que vienen', () => {
    const sin = base().p
    const { p } = base({
      gastosPorVenir: [
        { concepto: 'Luz', monto: 2500, categoria: 'energia' },
        { concepto: 'Camión', monto: 1500, categoria: 'transporte' },
      ],
    })
    expect(p.faltaPorVenir).toBe(4000)
    expect(p.costoProyectado).toBeCloseTo(sin.costoProyectado + 4000, 5)
    expect(p.gananciaProyectada!).toBeCloseTo(sin.gananciaProyectada! - 4000, 5)
  })

  it('el costo que falta es la suma de sus partes', () => {
    const { p } = base({
      empleados: { monto: 20000, cada: 'ciclo' },
      gastosPorVenir: [{ concepto: 'Luz', monto: 2500, categoria: 'energia' }],
    })
    expect(p.costoRestante).toBeCloseTo(p.faltaAlimento + p.faltaEmpleados + p.faltaPorVenir + p.faltaArreglo, 5)
  })

  // Sin precio del alimento, lo que falta se estima con el gasto por día: si
  // ahí entraba también el sueldo, se contaba dos veces.
  it('sin precio del alimento, el sueldo no entra también en el gasto por día', () => {
    const compras = [
      gasto({ id: 1, categoria: 'alimento', monto: 60000 }),
      gasto({ id: 2, categoria: 'mano_obra', monto: 9000 }),
    ]
    const regs = [registro(30, { pesoPromedio: 4 })]
    const ciclo = lote({ precioVentaLb: 60, empleados: { monto: 3000, cada: 'semana' } })
    const m = computeMetrics(ciclo, regs, compras, [])
    const p = proyectarVenta(ciclo, regs, compras, m, 5.5)!
    expect(p.faltaAlimento).toBeCloseTo((60000 / m.dias) * p.diasRestantes, 5)
  })
})

describe('proyección vendiendo el pollo arreglado', () => {
  const l = lote({ precioVentaLb: 60 })
  const registros = [registro(30, { pesoPromedio: 4, alimentoLb: 4000 })]
  const m = computeMetrics(l, registros, gastos, [])
  const enPie = proyectarVenta(l, registros, gastos, m, 5.5)!
  const arreglado = proyectarVenta(l, registros, gastos, m, 5.5, { arreglado: true, rinde: 0.75, costoAve: 12 })!

  // Se cobran menos libras, las arregladas, y el galpón es el mismo.
  it('cobra las libras arregladas, no las de en pie', () => {
    expect(arreglado.lbEnPie).toBe(enPie.lbEnPie)
    expect(arreglado.lbVenta).toBe(Math.round(enPie.lbEnPie * 0.75))
    expect(arreglado.ingresoProyectado).toBeCloseTo(arreglado.lbVenta * 60, 5)
  })

  it('arreglar las aves que faltan es un costo', () => {
    expect(arreglado.faltaArreglo).toBe(arreglado.avesAlVender * 12)
    expect(arreglado.costoProyectado).toBeCloseTo(enPie.costoProyectado + arreglado.faltaArreglo, 5)
  })

  it('el precio de equilibrio es por libra arreglada', () => {
    expect(arreglado.precioEquilibrioLb * arreglado.lbVenta).toBeCloseTo(arreglado.costoProyectado, 5)
    expect(arreglado.precioEquilibrioLb).toBeGreaterThan(enPie.precioEquilibrioLb)
  })
})

describe('con un día de venta fijo', () => {
  // El productor vende a los días que quiere, no cuando lleguen al peso: el
  // alimento que falta y el pago de los empleados van hasta ese día.
  const registros = [registro(30, { pesoPromedio: pesoEstandarLb(30), alimentoLb: 4000 })]
  const proyectarDia = (diaVenta?: number) => {
    const l = lote({ precioVentaLb: 60, diaVenta, empleados: { monto: 700, cada: 'semana' } })
    const m = computeMetrics(l, registros, gastos, [])
    return { p: proyectarVenta(l, registros, gastos, m, 5.5)!, m }
  }

  it('se vende ese día, al peso que lleven', () => {
    const { p, m } = proyectarDia(42)
    expect(m.diaObjetivo).toBe(42)
    expect(m.diaVentaEstimado).toBe(42)
    expect(p.diaVenta).toBe(42)
    expect(p.pesoVentaLb).toBeCloseTo(pesoEstandarLb(42), 5)
  })

  it('más días son más alimento y más sueldo', () => {
    const corto = proyectarDia(35).p
    const largo = proyectarDia(45).p
    expect(largo.alimentoRestanteLb).toBeGreaterThan(corto.alimentoRestanteLb)
    expect(largo.faltaEmpleados - corto.faltaEmpleados).toBeCloseTo(1000, 5)
  })

  it('si ya pasó el día, se vende hoy', () => {
    const { p } = proyectarDia(25)
    expect(p.listo).toBe(true)
    expect(p.diaVenta).toBe(30)
  })

  // 0 es «por peso» a propósito: no toma el día de Ajustes.
  it('con 0 se vende por peso', () => {
    const { m } = proyectarDia(0)
    expect(m.diaVentaFijo).toBeUndefined()
  })
})
