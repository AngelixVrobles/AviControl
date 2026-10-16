import { describe, expect, it } from 'vitest'
import { computeAlertas } from './alerts'
import { computeMetrics } from './metrics'
import { hace, ingreso, lote, registro } from '../test/fixtures'
import type { Aplicacion } from '../db/schema'

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
