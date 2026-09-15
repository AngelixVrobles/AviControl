import { describe, expect, it } from 'vitest'
import { agendaSanitaria } from './sanidad'
import { hace, lote } from '../test/fixtures'
import type { Aplicacion } from '../db/schema'

const plan = [
  { nombre: 'Newcastle', dia: 7 },
  { nombre: 'Gumboro', dia: 14 },
]

const aplicacion = (patch: Partial<Aplicacion>): Aplicacion => ({
  id: 1,
  loteId: 1,
  fecha: hace(23),
  tipo: 'vacuna',
  nombre: 'Newcastle',
  creado: 0,
  ...patch,
})

describe('agendaSanitaria', () => {
  it('marca aplicado lo que casa con el plan', () => {
    const agenda = agendaSanitaria(lote(), 30, plan, [aplicacion({})])
    expect(agenda.find((e) => e.nombre === 'Newcastle')!.estado).toBe('aplicado')
    expect(agenda.find((e) => e.nombre === 'Newcastle')!.dia).toBe(7)
  })

  it('lo del plan que ya pasó y no se anotó queda atrasado', () => {
    const agenda = agendaSanitaria(lote(), 30, plan, [])
    expect(agenda.every((e) => e.estado === 'atrasado')).toBe(true)
  })

  it('lo que todavía no toca queda pendiente', () => {
    const agenda = agendaSanitaria(lote(), 5, plan, [])
    expect(agenda.every((e) => e.estado === 'pendiente')).toBe(true)
  })

  // El nombre del frasco casi nunca es idéntico al del plan.
  it('casa nombres con mayúsculas, acentos o palabras de más', () => {
    const agenda = agendaSanitaria(lote(), 30, plan, [
      aplicacion({ nombre: 'vacuna newcastle B1' }),
    ])
    expect(agenda.find((e) => e.nombre === 'Newcastle')!.estado).toBe('aplicado')
  })

  it('lo que no está en el plan no se pierde: queda como extra', () => {
    const agenda = agendaSanitaria(lote(), 30, plan, [
      aplicacion({ id: 9, nombre: 'Vitaminas de arranque', tipo: 'vitamina', fecha: hace(27) }),
    ])
    const extra = agenda.find((e) => e.estado === 'extra')!
    expect(extra.nombre).toBe('Vitaminas de arranque')
    expect(extra.dia).toBe(3)
  })

  it('una aplicación no puede tachar dos veces el mismo plan', () => {
    const agenda = agendaSanitaria(lote(), 30, [
      { nombre: 'Newcastle', dia: 7 },
      { nombre: 'Newcastle', dia: 21 },
    ], [aplicacion({})])
    expect(agenda.filter((e) => e.estado === 'aplicado')).toHaveLength(1)
    expect(agenda.filter((e) => e.estado === 'atrasado')).toHaveLength(1)
  })

  it('ordena la agenda por día', () => {
    const agenda = agendaSanitaria(lote(), 30, plan, [
      aplicacion({ id: 9, nombre: 'Vitaminas', tipo: 'vitamina', fecha: hace(28) }),
    ])
    const dias = agenda.map((e) => e.dia ?? e.diaPlan ?? 0)
    expect([...dias].sort((a, b) => a - b)).toEqual(dias)
  })
})
