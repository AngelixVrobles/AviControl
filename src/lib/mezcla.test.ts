import { describe, expect, it } from 'vitest'
import { mezclaDeCiclo, mezclaDeGranja, mezclaPorVender, vendidasAparte } from './mezcla'
import { cicloAprendido, perfilDeGranja } from './estimador'
import { computeMetrics } from './metrics'
import { proyectarVenta } from './proyeccion'
import { analizarPrecio } from './precios'
import { hace, ingreso, lote, registro } from '../test/fixtures'

// La pollada cerrada: 850 al pollero en pie a 62, 50 por unidad a 400 cada uno
// y 20 arregladas, 80 lb limpias a 90.
const alPollero = ingreso({ id: 1, cantidad: 850, pesoLb: 4675, precioLb: 62, monto: 289850 })
const porUnidad = ingreso({ id: 2, cantidad: 50, monto: 20000 })
const arregladas = ingreso({ id: 3, cantidad: 20, pesoLb: 80, precioLb: 90, monto: 7200, arreglado: { rindePct: 75 } })
const ventas = [alPollero, porUnidad, arregladas]

describe('lo que se vende aparte', () => {
  it('lo de aparte, contra lo que habría dejado al precio del pollero', () => {
    const m = mezclaDeCiclo(ventas)!
    expect(m.aves).toBe(920)
    expect(m.aparte).toBe(70)
    expect(m.ingresoAparte).toBe(27200)
    // Cada pollo pesó 5.5 lb en pie; las 80 lb arregladas fueron 106.7 en pie.
    const pesoAve = (4675 + 80 / 0.75) / 870
    expect(m.valorAparte).toBeCloseTo((50 * pesoAve + 80 / 0.75) * 62, 6)
    // Todo por unidad no tiene libra con qué comparar.
    expect(mezclaDeCiclo([porUnidad])).toBeUndefined()
  })

  it('lo de la granja: qué parte se vende aparte y cuánto más deja', () => {
    const g = mezclaDeGranja([{ mezcla: mezclaDeCiclo(ventas), peso: 1 }])!
    expect(g.aparte).toBeCloseTo(70 / 920, 6)
    expect(g.prima).toBeGreaterThan(0.1)
    expect(g.prima).toBeLessThan(0.2)
    // Si casi nada se vende aparte, no cambia la cuenta.
    expect(mezclaDeGranja([{ mezcla: { aves: 1000, aparte: 5, ingresoAparte: 3000, valorAparte: 2000 }, peso: 1 }])).toBeUndefined()
    expect(mezclaDeGranja([])).toBeUndefined()
  })

  it('lo que ya se vendió aparte en este ciclo ya no falta', () => {
    const g = { aparte: 0.1, prima: 0.2 }
    expect(mezclaPorVender(g, 0, 0, 900)).toEqual({ aves: 90, prima: 0.2, factor: 1.02 })
    const despues = mezclaPorVender(g, 60, 60, 900)!
    expect(despues.aves).toBe(36)
    expect(mezclaPorVender(g, 100, 100, 900)).toBeUndefined()
    expect(mezclaPorVender(undefined, 0, 0, 900)).toBeUndefined()
  })

  it('en este ciclo, aparte es lo que no fue a su precio', () => {
    const otroPrecio = ingreso({ id: 4, cantidad: 30, pesoLb: 165, precioLb: 70, monto: 11550 })
    expect(vendidasAparte([alPollero, porUnidad, arregladas, otroPrecio], 62)).toBe(100)
    expect(vendidasAparte(ventas, undefined)).toBe(0)
  })

  it('la ganancia estimada lo cuenta, y el precio mínimo del pollero baja', () => {
    const cerrada = lote({ cantidadInicial: 1000, estado: 'cerrado', fechaCierre: hace(0) })
    const perfil = perfilDeGranja([cicloAprendido(cerrada, ventas)!])!
    expect(perfil.mezcla).toBeDefined()
    const l = lote({ cantidadInicial: 1000, precioVentaLb: 62, diaVenta: 42 })
    const regs = Array.from({ length: 30 }, (_, k) => registro(k + 1, k + 1 === 28 ? { pesoPromedio: 3.9 } : {}))
    const sin = computeMetrics(l, regs, [], [])
    const con = computeMetrics(l, regs, [], [], { perfil })
    const pSin = proyectarVenta(l, regs, [], sin, 5.5)!
    const pCon = proyectarVenta(l, regs, [], con, 5.5)!
    expect(pSin.factorPrecio).toBe(1)
    expect(pCon.aparte!.aves).toBeGreaterThan(50)
    expect(pCon.ingresoPorVender!).toBeCloseTo(pCon.lbVenta * 62 * pCon.factorPrecio, 6)
    expect(pCon.factorPrecio).toBeGreaterThan(1)
    const aSin = analizarPrecio(l, [], sin, pSin)!
    const aCon = analizarPrecio(l, [], con, { ...pSin, factorPrecio: pCon.factorPrecio })!
    expect(aCon.precioEquilibrioLb).toBeLessThan(aSin.precioEquilibrioLb)
  })
})
