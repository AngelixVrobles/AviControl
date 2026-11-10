import { describe, expect, it } from 'vitest'
import { RITMO_ESTANDAR, bajasEntre, bajasQueFaltan, ritmoDeBajas } from './ritmoBajas'
import { cicloAprendido, perfilDeGranja } from './estimador'
import { computeMetrics } from './metrics'
import { proyectarVenta } from './proyeccion'
import { hace, ingreso, lote, registro } from '../test/fixtures'

// Un lote de 1,000 pollitos a los 30 días, con un registro cada día.
const l = lote({ cantidadInicial: 1000 })
const dias = (muertesDe: (dia: number) => number) =>
  Array.from({ length: 30 }, (_, k) => registro(k + 1, { mortalidad: muertesDe(k + 1) }))

describe('el ritmo de las bajas', () => {
  it('cuenta las aves vivas de cada día, sin las vendidas ni los días sin registro', () => {
    const regs = [registro(10, { mortalidad: 2 }), registro(11, { mortalidad: 1, descarte: 1 }), registro(13)]
    const venta = ingreso({ cantidad: 100, fecha: hace(30 - 11) })
    const b = bajasEntre(l, regs, [venta], 8)
    expect(b.muertes).toBe(4)
    // Día 10: 1,000 vivas; día 11: 998 menos 100 vendidas; día 13: 996 menos 100.
    expect(b.exposicion).toBe(1000 + 898 + 896)
  })

  it('sin registros es el de cualquier granja', () => {
    expect(ritmoDeBajas(l, [], [], 30)).toBeCloseTo(RITMO_ESTANDAR, 9)
  })

  it('si estos días se mueren 3 por día, cuenta más que el estándar', () => {
    const r = ritmoDeBajas(l, dias((d) => (d > 23 ? 3 : 0)), [], 30)
    expect(r).toBeGreaterThan(RITMO_ESTANDAR * 2)
    expect(r).toBeLessThan(3 / 950)
  })

  it('si no se muere ninguna, cuenta menos; y las del arranque no cuentan', () => {
    const sinBajas = ritmoDeBajas(l, dias(() => 0), [], 30)
    expect(sinBajas).toBeLessThan(RITMO_ESTANDAR)
    // 10 por día la primera semana, que viene de la incubadora: a los 10 días no pesa.
    const arranque = ritmoDeBajas(l, dias((d) => (d < 8 ? 10 : 0)).slice(0, 10), [], 10)
    expect(arranque).toBeLessThan(RITMO_ESTANDAR)
  })

  it('lo de las polladas cerradas cuenta, a medias', () => {
    const cerrada = lote({ cantidadInicial: 1000, estado: 'cerrado', fechaCierre: hace(0) })
    const venta = ingreso({ cantidad: 900, pesoLb: 4950, monto: 190000, fecha: hace(0) })
    // Con el pollo grande se le murieron 4 por día.
    const regs = Array.from({ length: 30 }, (_, k) => registro(k + 1, { mortalidad: k + 1 >= 22 ? 4 : 0 }))
    const c = cicloAprendido(cerrada, [venta], regs)!
    expect(c.bajasTarde!.muertes).toBe(36)
    const perfil = perfilDeGranja([c])!
    const conGranja = ritmoDeBajas(l, dias(() => 0), [], 30, perfil.bajasTarde)
    expect(conGranja).toBeGreaterThan(ritmoDeBajas(l, dias(() => 0), [], 30))
  })

  it('las que faltan, sobre las que quedan', () => {
    expect(bajasQueFaltan(1000, 0.002, 7)).toBe(14)
    expect(bajasQueFaltan(0, 0.002, 7)).toBe(0)
    expect(bajasQueFaltan(1000, 0.002, -3)).toBe(0)
  })

  it('la proyección vende menos aves si el lote se está muriendo', () => {
    const conPeso = (regs: ReturnType<typeof dias>) =>
      regs.map((r) => (r.id === 28 ? { ...r, pesoPromedio: 3.9 } : r))
    const proyectar = (regs: ReturnType<typeof dias>) => {
      const loteFijo = { ...l, diaVenta: 42 }
      const m = computeMetrics(loteFijo, regs, [], [])
      return proyectarVenta(loteFijo, regs, [], m, 5.5)!
    }
    const tranquilo = proyectar(conPeso(dias(() => 0)))
    const muriendo = proyectar(conPeso(dias((d) => (d > 23 ? 3 : 0))))
    // 12 días más a unas 2 por día, contra casi ninguna.
    expect(muriendo.avesAlVender).toBeLessThan(tranquilo.avesAlVender - 30)
  })
})
