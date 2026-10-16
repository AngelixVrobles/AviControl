import { describe, expect, it } from 'vitest'
import { computeAlertas } from './alerts'
import { computeMetrics } from './metrics'
import { hace, lote } from '../test/fixtures'
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
