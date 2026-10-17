import { describe, expect, it } from 'vitest'
import { computeAlertas } from './alerts'
import { computeMetrics } from './metrics'
import { hace, ingreso, lote, registro } from '../test/fixtures'
import type { Aplicacion } from '../db/schema'
import type { Settings } from './settings'

const plan = [
  { nombre: 'Newcastle', dia: 7 },
  { nombre: 'Gumboro', dia: 14 },
  { nombre: 'Refuerzo Newcastle', dia: 21 },
]

const aplicacion = (patch: Partial<Aplicacion>): Aplicacion => ({
  id: 1,
  loteId: 1,
  fecha: hace(0),
  tipo: 'vacuna',
  nombre: 'Gumboro',
  creado: 0,
  ...patch,
})

// Las alertas de un ciclo que va en el día `dia`.
function alertasAlDia(dia: number, aplicaciones: Aplicacion[] = [], p = plan) {
  const l = lote({ fechaInicio: hace(dia) })
  const m = computeMetrics(l, [], [], [])
  return computeAlertas(l, [], [], m, { plan: p, aplicaciones }).map((a) => a.texto)
}

describe('alertas del plan sanitario', () => {
  it('avisa el día que toca según el plan', () => {
    expect(alertasAlDia(14)).toContain('Hoy toca Gumboro (día 14 de tu plan)')
  })

  it('avisa la víspera', () => {
    expect(alertasAlDia(13)).toContain('Mañana toca Gumboro')
  })

  // Antes salía «vacuna Gumboro» aunque ya estuviera puesta.
  it('no avisa lo que ya se anotó como aplicado', () => {
    const textos = alertasAlDia(14, [aplicacion({})])
    expect(textos.some((t) => t.includes('Gumboro'))).toBe(false)
  })

  it('usa el plan de la granja, no uno fijo', () => {
    const propio = [{ nombre: 'Bronquitis', dia: 10 }]
    expect(alertasAlDia(10, [], propio)).toContain('Hoy toca Bronquitis (día 10 de tu plan)')
    expect(alertasAlDia(14, [], propio).some((t) => t.includes('Gumboro'))).toBe(false)
  })

  it('lo que se pasó sin anotar se recuerda unos días y después se calla', () => {
    expect(alertasAlDia(16).some((t) => t.startsWith('Gumboro tocaba el día 14'))).toBe(true)
    expect(alertasAlDia(18).some((t) => t.startsWith('Gumboro tocaba'))).toBe(false)
  })
})

describe('ciclo sin aves', () => {
  // Se vendió todo con «Venta» y el ciclo quedó abierto: lo único que importa es
  // cerrarlo, no el registro del día ni el pesaje.
  it('pide cerrarlo y calla lo demás', () => {
    const l = lote({ fechaInicio: hace(40), cantidadInicial: 100 })
    const m = computeMetrics(l, [], [], [ingreso({ cantidad: 100, monto: 30000 })])
    const textos = computeAlertas(l, [], [], m, { plan }).map((a) => a.texto)
    expect(textos).toEqual([
      'Vendiste todas las aves y el ciclo sigue abierto: ciérralo para ver cómo salió',
    ])
  })
})

describe('el pesaje no es el registro del día', () => {
  // Pesar no dice cuántas aves murieron ni cuánto comieron: el día sigue sin
  // registro hasta que se complete.
  it('un día con solo el peso no calla el aviso de días sin registro', () => {
    const l = lote({ fechaInicio: hace(20) })
    const regs = [
      registro(10, { fecha: hace(5), mortalidad: 1, alimentoLb: 300 }),
      registro(20, { fecha: hace(0), pesoPromedio: 2.1, soloPeso: true }),
    ]
    const m = computeMetrics(l, regs, [], [])
    const textos = computeAlertas(l, regs, [], m, { plan: [] }).map((a) => a.texto)
    expect(textos).toContain('Sin registro desde hace 5 días')
    expect(m.registroHoy).toBeUndefined()
  })

  it('completado en la hoja del día, ya cuenta', () => {
    const l = lote({ fechaInicio: hace(20) })
    const regs = [registro(20, { fecha: hace(0), pesoPromedio: 2.1, mortalidad: 2, alimentoLb: 250 })]
    const m = computeMetrics(l, regs, [], [])
    expect(m.registroHoy?.pesoPromedio).toBe(2.1)
  })
})

describe('días con fecha futura', () => {
  // El último registro real fue hace 6 días; otro quedó anotado por error en
  // el mes que viene. Antes ese callaba el aviso de días sin registro.
  it('avisan para corregirlos y no callan los días sin registro', () => {
    const l = lote({ fechaInicio: hace(20) })
    const regs = [
      registro(14, { fecha: hace(6), mortalidad: 1, alimentoLb: 300 }),
      registro(50, { fecha: hace(-25), alimentoLb: 300 }),
    ]
    const m = computeMetrics(l, regs, [], [])
    const textos = computeAlertas(l, regs, [], m, { plan: [] }).map((a) => a.texto)
    expect(textos.some((t) => t.startsWith('Hay un día anotado con fecha'))).toBe(true)
    expect(textos).toContain('Sin registro desde hace 6 días')
  })
})

describe('conversión que no cuadra', () => {
  it('avisa que falta alimento cuando el FCA sale imposible de bajo', () => {
    const l = lote({ fechaInicio: hace(24) })
    const regs = [registro(24, { fecha: hace(0), pesoPromedio: 2.6, alimentoLb: 100 })]
    const m = computeMetrics(l, regs, [], [])
    const textos = computeAlertas(l, regs, [], m, { plan: [] }).map((a) => a.texto)
    expect(textos.some((t) => t.startsWith('La conversión sale en') && t.includes('falta alimento'))).toBe(true)
  })
})

describe('alimento que se acabó', () => {
  // Con el saldo estimado en cero o menos, el aviso de «te queda alimento
  // para N días» desaparecía justo cuando más hacía falta.
  it('avisa cuando por lo anotado ya no queda', () => {
    const l = lote({ fechaInicio: hace(20), cantidadInicial: 1000 })
    const regs = Array.from({ length: 19 }, (_, i) => ({ ...registro(i + 1, { alimentoLb: 100 }), fecha: hace(19 - i) }))
    const gastos = [{ id: 1, loteId: 1, categoria: 'alimento' as const, monto: 30000, cantidadQq: 19, fecha: hace(20), creado: 0 }]
    const m = computeMetrics(l, regs, gastos, [])
    const textos = computeAlertas(l, regs, gastos, m, { plan: [] }).map((a) => a.texto)
    expect(textos.some((t) => /ya no queda alimento/i.test(t))).toBe(true)
  })
})

describe('espacio de cada galpón', () => {
  // El caso del productor: 1,000 pollitos en un galpón de 8.6 × 8.6 m.
  const settings: Settings = {
    moneda: 'RD$',
    granja: 'Granja',
    galpones: [
      { id: 'g1', nombre: 'Galpón 1', largoM: 8.6, anchoM: 8.6 },
      { id: 'g2', nombre: 'Galpón 2', largoM: 8, anchoM: 6 },
    ],
    unidadMedida: 'm',
    bebedero: 'plasson',
    comedero: 'tolva',
    avesPorEquipo: {},
    pesoObjetivoLb: 5.5,
    avesPorM2: 11,
    unidadAlimento: 'qq',
    planSanitario: [],
    ultimoRespaldo: null,
  }
  const textos = (l: ReturnType<typeof lote>) =>
    computeAlertas(l, [], [], computeMetrics(l, [], [], []), { plan: [], settings }).map((a) => a.texto)

  it('avisa cuando de grandes no caben', () => {
    const l = lote({ fechaInicio: hace(15), galponId: 'g1', cantidadInicial: 1000 })
    expect(textos(l).find((t) => /aguanta/.test(t))).toBe(
      'Galpón 1 aguanta 813 aves al peso de venta y tiene 1,000: pasa 187 a otro galpón en la ficha Galpón, o vende antes',
    )
  })

  it('con las 350 pasadas al otro galpón ya no avisa', () => {
    const l = lote({
      fechaInicio: hace(15),
      galponId: 'g1',
      cantidadInicial: 1000,
      movimientos: [{ fecha: hace(1), de: 'g1', a: 'g2', aves: 350 }],
    })
    expect(textos(l).some((t) => /aguanta/.test(t))).toBe(false)
  })

  it('los primeros días no avisa todavía', () => {
    const l = lote({ fechaInicio: hace(5), galponId: 'g1', cantidadInicial: 1000 })
    expect(textos(l).some((t) => /aguanta/.test(t))).toBe(false)
  })
})
