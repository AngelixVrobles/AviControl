import { describe, expect, it } from 'vitest'
import { computeLiquidacion, fraseEntrega, gananciaPorSocio, sociosParaGuardar } from './sociedad'
import { computeMetrics } from './metrics'
import { entrega, gasto, ingreso, lote, registro } from '../test/fixtures'

const socios = [
  { nombre: 'Ana', pct: 50 },
  { nombre: 'Beto', pct: 50 },
]

function liquidar(
  l = lote({ socios }),
  gastos = [] as ReturnType<typeof gasto>[],
  ingresos = [] as ReturnType<typeof ingreso>[],
  entregas = [] as ReturnType<typeof entrega>[],
) {
  const m = computeMetrics(l, [registro(1)], gastos, ingresos)
  return { liq: computeLiquidacion(l, gastos, ingresos, m, entregas)!, m }
}

describe('computeLiquidacion', () => {
  it('no aplica sin al menos dos socios', () => {
    const m = computeMetrics(lote(), [], [], [])
    expect(computeLiquidacion(lote(), [], [], m)).toBeNull()
    expect(computeLiquidacion(lote({ socios: [{ nombre: 'Solo', pct: 100 }] }), [], [], m)).toBeNull()
  })

  it('reparte lo común según el porcentaje de cada uno', () => {
    const { liq } = liquidar(lote({ socios, costoInicial: 20000 }))
    expect(liq.socios.map((s) => s.aporte)).toEqual([10000, 10000])
  })

  it('carga el gasto entero a quien lo pagó', () => {
    const { liq } = liquidar(
      lote({ socios, costoInicial: 0 }),
      [gasto({ monto: 30000, pagadoPor: 0 })],
    )
    expect(liq.socios[0].aporte).toBe(30000)
    expect(liq.socios[1].aporte).toBe(0)
  })

  it('normaliza porcentajes que no suman cien', () => {
    const { liq } = liquidar(
      lote({ socios: [{ nombre: 'Ana', pct: 30 }, { nombre: 'Beto', pct: 10 }], costoInicial: 4000 }),
    )
    expect(liq.socios[0].pct).toBeCloseTo(75, 5)
    expect(liq.socios[0].aporte).toBe(3000)
  })

  // Lo que cada uno se lleva menos lo que puso tiene que dar la ganancia total:
  // si esto no cuadra, alguien sale perdiendo sin saberlo.
  it('los ajustes reparten la ganancia completa', () => {
    const { liq, m } = liquidar(
      lote({ socios, costoInicial: 20000 }),
      [gasto({ monto: 30000, pagadoPor: 0 })],
      [ingreso({ monto: 100000, recibidoPor: 1 })],
    )
    expect(m.ganancia).toBe(50000)
    const suma = liq.socios.reduce((a, s) => a + s.corresponde, 0)
    expect(suma).toBeCloseTo(m.ganancia, 5)
    expect(liq.socios.reduce((a, s) => a + s.ajuste, 0)).toBeCloseTo(0, 5)
  })

  it('el traspaso deja a los dos socios iguales', () => {
    const { liq } = liquidar(
      lote({ socios, costoInicial: 0 }),
      [gasto({ monto: 40000, pagadoPor: 0 })],
      [ingreso({ monto: 100000, recibidoPor: 1 })],
    )
    // Ana puso 40.000 y no cobró; Beto cobró 100.000 sin poner nada.
    expect(liq.traspasos).toHaveLength(1)
    expect(liq.traspasos[0]).toMatchObject({ de: 'Beto', a: 'Ana' })
    expect(liq.traspasos[0].monto).toBe(70000)
  })

  it('sin desbalance no manda pagar nada', () => {
    const { liq } = liquidar(
      lote({ socios, costoInicial: 0 }),
      [gasto({ monto: 20000, pagadoPor: 0 }), gasto({ id: 2, monto: 20000, pagadoPor: 1 })],
      [ingreso({ monto: 50000, recibidoPor: 0 }), ingreso({ id: 2, monto: 50000, recibidoPor: 1 })],
    )
    expect(liq.traspasos).toHaveLength(0)
  })

  it('reparte entre tres socios desiguales', () => {
    const tres = [
      { nombre: 'Ana', pct: 50 },
      { nombre: 'Beto', pct: 30 },
      { nombre: 'Cid', pct: 20 },
    ]
    const { liq, m } = liquidar(
      lote({ socios: tres, costoInicial: 0 }),
      [gasto({ monto: 100000, pagadoPor: 0 })],
      [ingreso({ monto: 200000, recibidoPor: 0 })],
    )
    expect(m.ganancia).toBe(100000)
    expect(liq.socios.map((s) => Math.round(s.corresponde))).toEqual([50000, 30000, 20000])
    // Ana puso 100.000 y cobró 200.000: le sobran 50.000 sobre lo que le toca.
    expect(liq.socios[0].ajuste).toBeCloseTo(-50000, 5)
    expect(liq.traspasos).toEqual([
      { de: 'Ana', a: 'Beto', deIdx: 0, aIdx: 1, monto: 30000 },
      { de: 'Ana', a: 'Cid', deIdx: 0, aIdx: 2, monto: 20000 },
    ])
  })

  it('dice cómo se lee el acuerdo', () => {
    expect(liquidar().liq.acuerdo).toBe('mitad y mitad')
    const tres = [1, 2, 3].map((n) => ({ nombre: `S${n}`, pct: 10 }))
    expect(liquidar(lote({ socios: tres })).liq.acuerdo).toBe('en partes iguales')
    const desigual = [{ nombre: 'Ana', pct: 60 }, { nombre: 'Beto', pct: 40 }]
    expect(liquidar(lote({ socios: desigual })).liq.acuerdo).toBe('60/40')
  })

  it('a un socio sin nombre lo llama por su número', () => {
    const { liq } = liquidar(lote({ socios: [{ nombre: 'Ana', pct: 50 }, { nombre: ' ', pct: 50 }] }))
    expect(liq.socios[1].nombre).toBe('Socio 2')
  })
})

describe('entregas entre socios', () => {
  // Ana puso 40.000 y no cobró; Beto cobró 100.000 sin poner nada: Beto le debe
  // 70.000 (los 40.000 de vuelta y 30.000 de la mitad de la ganancia).
  const base = [
    lote({ socios, costoInicial: 0 }),
    [gasto({ monto: 40000, pagadoPor: 0 })],
    [ingreso({ monto: 100000, recibidoPor: 1 })],
  ] as const

  it('la entrega completa deja la cuenta pareja', () => {
    const { liq } = liquidar(...base, [entrega({ de: 1, a: 0, monto: 70000 })])
    expect(liq.traspasos).toHaveLength(0)
    for (const s of liq.socios) expect(s.ajuste).toBeCloseTo(0, 5)
    expect(liq.movido).toBe(70000)
  })

  it('una entrega a medias deja pendiente solo lo que falta', () => {
    const { liq } = liquidar(...base, [entrega({ de: 1, a: 0, monto: 30000 })])
    expect(liq.traspasos).toEqual([{ de: 'Beto', a: 'Ana', deIdx: 1, aIdx: 0, monto: 40000 }])
    expect(liq.socios[0]).toMatchObject({ recibido: 30000, entregado: 0 })
    expect(liq.socios[1]).toMatchObject({ recibido: 0, entregado: 30000 })
  })

  it('la ganancia de cada uno no cambia por lo que se entreguen', () => {
    const sin = liquidar(...base).liq
    const con = liquidar(...base, [entrega({ de: 1, a: 0, monto: 70000 })]).liq
    expect(con.socios.map((s) => s.corresponde)).toEqual(sin.socios.map((s) => s.corresponde))
    expect(con.socios.map((s) => s.corresponde)).toEqual([30000, 30000])
  })

  it('una entrega al revés agranda lo que se debe', () => {
    const { liq } = liquidar(...base, [entrega({ de: 0, a: 1, monto: 10000 })])
    expect(liq.traspasos[0]).toMatchObject({ de: 'Beto', a: 'Ana', monto: 80000 })
  })

  it('ignora entregas a uno mismo o a un socio que no existe', () => {
    const { liq } = liquidar(...base, [
      entrega({ de: 0, a: 0, monto: 5000 }),
      entrega({ id: 2, de: 1, a: 7, monto: 5000 }),
      entrega({ id: 3, de: 1, a: 0, monto: 0 }),
    ])
    expect(liq.movido).toBe(0)
    expect(liq.traspasos[0].monto).toBe(70000)
  })

  // Antes de vender, la misma cuenta sirve para seguir mitad y mitad con lo
  // que cada uno ha puesto.
  it('antes de vender iguala lo que ha puesto cada uno', () => {
    const l = lote({ socios, costoInicial: 0 })
    const gastos = [gasto({ monto: 30000, pagadoPor: 0 })]
    const antes = liquidar(l, gastos).liq
    expect(antes.conVentas).toBe(false)
    expect(antes.socios.map((s) => s.leTocaPoner)).toEqual([15000, 15000])
    expect(antes.traspasos).toEqual([{ de: 'Beto', a: 'Ana', deIdx: 1, aIdx: 0, monto: 15000 }])

    const despues = liquidar(l, gastos, [], [entrega({ de: 1, a: 0, monto: 15000 })]).liq
    expect(despues.traspasos).toHaveLength(0)
  })

  it('lo igualado antes de vender cuenta al liquidar después', () => {
    const l = lote({ socios, costoInicial: 0 })
    const gastos = [gasto({ monto: 100000, pagadoPor: 0 })]
    const ventas = [ingreso({ monto: 150000, recibidoPor: 1 })]
    // Beto le dio 50.000 a Ana para quedar a la par y después cobró la venta.
    const { liq } = liquidar(l, gastos, ventas, [entrega({ de: 1, a: 0, monto: 50000 })])
    expect(liq.socios.map((s) => s.corresponde)).toEqual([25000, 25000])
    expect(liq.traspasos).toEqual([{ de: 'Beto', a: 'Ana', deIdx: 1, aIdx: 0, monto: 75000 }])
  })
})

describe('fraseEntrega', () => {
  it('a «Yo» la app le habla de tú', () => {
    expect(fraseEntrega('Yo', 'Socio')).toEqual(['Le entregas ', ' a Socio'])
    expect(fraseEntrega('Socio', 'Yo')).toEqual(['Socio te entrega ', ''])
    expect(fraseEntrega('Socio', 'yo ', { hecha: true })).toEqual(['Socio te entregó ', ''])
    expect(fraseEntrega('Yo', 'Socio', { hecha: true })).toEqual(['Le entregaste ', ' a Socio'])
  })

  it('en el mensaje que se comparte habla quien lo manda', () => {
    expect(fraseEntrega('Yo', 'Socio', { voz: 'propia' })).toEqual(['Le entrego ', ' a Socio'])
    expect(fraseEntrega('Socio', 'Yo', { voz: 'propia' })).toEqual(['Socio me entrega ', ''])
  })

  it('entre otros nombres va en tercera persona', () => {
    expect(fraseEntrega('Ana', 'Beto')).toEqual(['Ana le entrega ', ' a Beto'])
    expect(fraseEntrega('Ana', 'Beto', { hecha: true })).toEqual(['Ana le entregó ', ' a Beto'])
  })
})

describe('gananciaPorSocio', () => {
  const socios = [
    { nombre: 'Yo', pct: 60 },
    { nombre: 'Socio', pct: 40 },
  ]

  it('reparte la ganancia de un ciclo según el acuerdo', () => {
    const r = gananciaPorSocio([{ socios, ganancia: 100000 }])
    expect(r.socios).toEqual([
      { nombre: 'Yo', pct: 60, monto: 60000 },
      { nombre: 'Socio', pct: 40, monto: 40000 },
    ])
    expect(r.sinSociedad).toBe(0)
  })

  it('acumula varios ciclos bajo el mismo nombre', () => {
    const r = gananciaPorSocio([
      { socios, ganancia: 100000 },
      { socios, ganancia: 50000 },
    ])
    expect(r.socios[0].monto).toBe(90000)
  })

  it('las pérdidas también se reparten', () => {
    expect(gananciaPorSocio([{ socios, ganancia: -10000 }]).socios[0].monto).toBe(-6000)
  })

  it('aparta lo que sale de ciclos que no son en sociedad', () => {
    const r = gananciaPorSocio([{ socios, ganancia: 100000 }, { ganancia: 30000 }])
    expect(r.sinSociedad).toBe(30000)
    expect(r.socios).toHaveLength(2)
  })
})

describe('sociosParaGuardar', () => {
  // La fila vacía de en medio se va, y quien pagó sigue siendo el mismo socio
  // aunque ahora esté un lugar más arriba.
  it('quien pagó sigue siendo el mismo al quitar una fila vacía', () => {
    const r = sociosParaGuardar(
      [
        { nombre: 'Ana', pct: 50 },
        { nombre: '', pct: 0 },
        { nombre: 'Beto', pct: 50 },
      ],
      2,
    )
    expect(r.socios.map((s) => s.nombre)).toEqual(['Ana', 'Beto'])
    expect(r.pagador).toBe(1)
  })

  it('el socio sin nombre pero con su parte se queda con el nombre que se veía', () => {
    const r = sociosParaGuardar(
      [
        { nombre: ' Ana ', pct: 60 },
        { nombre: '', pct: 40 },
      ],
      1,
    )
    expect(r.socios).toEqual([
      { nombre: 'Ana', pct: 60 },
      { nombre: 'Socio 2', pct: 40 },
    ])
    expect(r.pagador).toBe(1)
  })

  it('si quien pagó era la fila vacía el pago queda común', () => {
    const r = sociosParaGuardar(
      [
        { nombre: 'Ana', pct: 50 },
        { nombre: 'Beto', pct: 50 },
        { nombre: '', pct: 0 },
      ],
      2,
    )
    expect(r.socios).toHaveLength(2)
    expect(r.pagador).toBeUndefined()
  })

  it('los socios que ya tienen cuentas no se quitan aunque queden en blanco', () => {
    const r = sociosParaGuardar(
      [
        { nombre: 'Ana', pct: 100 },
        { nombre: '', pct: 0 },
        { nombre: '', pct: 0 },
      ],
      undefined,
      2,
    )
    expect(r.socios).toEqual([
      { nombre: 'Ana', pct: 100 },
      { nombre: 'Socio 2', pct: 0 },
    ])
  })
})

describe('sociedad con ventas a crédito', () => {
  // Venta de 100.000 a crédito, sin cobrar nada: nadie tiene ese dinero, así
  // que nadie le debe entregar nada a nadie por ella.
  it('lo que falta por cobrar no está en la mano de ningún socio', () => {
    const l = lote({ socios, costoInicial: 0 })
    const gastos = [gasto({ monto: 80000, pagadoPor: 0 })]
    const ingresos = [ingreso({ cantidad: 400, monto: 100000, credito: true, cobros: [] })]
    const m = computeMetrics(l, [registro(1)], gastos, ingresos)
    const liq = computeLiquidacion(l, gastos, ingresos, m)!
    expect(liq.porCobrar).toBe(100000)
    expect(liq.socios.map((s) => s.cobrado)).toEqual([0, 0])
    expect(liq.traspasos).toEqual([])
  })

  it('cada cobro cuenta para quien lo recibió', () => {
    const l = lote({ socios, costoInicial: 0 })
    const ingresos = [
      ingreso({
        cantidad: 400,
        monto: 100000,
        credito: true,
        cobros: [
          { fecha: '2026-10-01', monto: 60000, recibidoPor: 1 },
          { fecha: '2026-10-05', monto: 40000 },
        ],
      }),
    ]
    const m = computeMetrics(l, [registro(1)], [], ingresos)
    const liq = computeLiquidacion(l, [], ingresos, m)!
    expect(liq.socios[0].cobrado).toBe(20000)
    expect(liq.socios[1].cobrado).toBe(80000)
    expect(liq.porCobrar).toBe(0)
  })
})

describe('sociedad con ventas antes de cerrar', () => {
  // Con una venta parcial, la cuenta seguía como si el ciclo hubiera cerrado:
  // «Tu pérdida» del tamaño de todo lo que falta por vender.
  it('mientras el ciclo sigue, es la cuenta de lo que pone cada uno', () => {
    const l = lote({ socios: [{ nombre: 'Yo', pct: 50 }, { nombre: 'Pedro', pct: 50 }], costoInicial: 0 })
    const gastos = [gasto({ monto: 100000, pagadoPor: 0 }), gasto({ id: 2, monto: 100000, pagadoPor: 1 })]
    const ingresos = [ingreso({ cantidad: 100, monto: 30000, recibidoPor: 0 })]
    const m = computeMetrics(l, [], gastos, ingresos)
    const liq = computeLiquidacion(l, gastos, ingresos, m)!
    expect(liq.conVentas).toBe(false)
    // Yo cobró los 30,000: la mitad es de Pedro.
    expect(liq.traspasos[0]).toMatchObject({ de: 'Yo', a: 'Pedro', monto: 15000 })
    const cerrado = computeLiquidacion({ ...l, estado: 'cerrado' }, gastos, ingresos, m)!
    expect(cerrado.conVentas).toBe(true)
  })
})
