import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  alimentoFuturo,
  alimentoPorTipo,
  faseDeNombre,
  precioDelDiaLb,
  ultimosPrecios,
} from './alimentos'
import { computeMetrics } from './metrics'
import { proyectarVenta } from './proyeccion'
import { gasto, hace, lote, registro } from '../test/fixtures'
import { memoriaStorage } from '../test/storage'

afterEach(() => vi.unstubAllGlobals())

// Como los anota el productor: el nombre que trae el saco.
const compra = (id: number, dia: number, descripcion: string, qq: number, precioQq: number) =>
  gasto({ id, categoria: 'alimento', fecha: hace(30 - dia), descripcion, cantidadQq: qq, monto: qq * precioQq })

const comprasDeEjemplo = () => [
  compra(1, 0, 'PREINICIO POLLO TRYADDPIO', 3, 1985),
  compra(2, 8, 'MEGA BROILER INICIADOR', 18, 1429),
  compra(3, 18, 'MEGA BROILER CRECIMIENTO', 20, 1445),
  compra(4, 28, '19 QUINTALES DE ENGORDE', 19, 1401),
]

// 100 lb al día los primeros tres días y 150 después: el pre-inicio (300 lb) se
// acaba el día 3 y el iniciador (1,800 lb) el 15. El ciclo tiene un día más
// que lo anotado: hoy todavía no se anota.
const dias = (hasta: number, elegidos: Record<number, 'iniciador' | 'crecimiento' | 'engorde'> = {}) =>
  Array.from({ length: hasta }, (_, i) =>
    registro(i + 1, {
      fecha: hace(hasta - i),
      alimentoLb: i < 3 ? 100 : 150,
      alimentoFase: elegidos[i + 1],
    }),
  )

function calcular(registros = dias(29), gastos = comprasDeEjemplo()) {
  const edad = registros.length + 1
  const l = lote({ cantidadInicial: 1000, fechaInicio: hace(edad) })
  // Las compras van por día del ciclo, no por fecha de hoy.
  const g = gastos.map((x) => ({ ...x, fecha: hace(edad - (30 - diasAtras(x.fecha))) }))
  const m = computeMetrics(l, registros, g, [])
  return { l, m, apt: alimentoPorTipo(l, registros, g, m) }
}

// Los días que hay entre una fecha y hoy.
const diasAtras = (fecha: string) =>
  Math.round((new Date(hace(0) + 'T00:00:00').getTime() - new Date(fecha + 'T00:00:00').getTime()) / 86400000)

describe('faseDeNombre', () => {
  it('saca el tipo del nombre del saco', () => {
    expect(faseDeNombre('PREINICIO POLLO TRYADDPIO')).toBe('preinicio')
    expect(faseDeNombre('PRE INICIO')).toBe('preinicio')
    expect(faseDeNombre('Pre-inicio')).toBe('preinicio')
    expect(faseDeNombre('MEGA BROILER INICIADOR')).toBe('iniciador')
    expect(faseDeNombre('MEGA BROILER CRECIMIENTO')).toBe('crecimiento')
    expect(faseDeNombre('19 QUINTALES DE ENGORDE')).toBe('engorde')
    expect(faseDeNombre('Finalizador')).toBe('engorde')
  })

  it('sin una palabra conocida no adivina', () => {
    expect(faseDeNombre('Mega Broiler')).toBeUndefined()
    expect(faseDeNombre(undefined)).toBeUndefined()
  })
})

describe('alimentoPorTipo', () => {
  it('da los sacos en orden: se acaba uno y sigue el próximo', () => {
    const { apt } = calcular()
    const tipoDel = (dia: number) => apt.dias.find((d) => d.dia === dia)?.fase
    expect(tipoDel(3)).toBe('preinicio')
    expect(tipoDel(4)).toBe('iniciador')
    expect(tipoDel(15)).toBe('iniciador')
    expect(tipoDel(16)).toBe('crecimiento')
    const iniciador = apt.fases.find((f) => f.fase === 'iniciador')!
    expect([iniciador.desdeDia, iniciador.hastaDia]).toEqual([4, 15])
    expect(iniciador.nombre).toBe('MEGA BROILER INICIADOR')
    expect(iniciador.quedaLb).toBeCloseTo(0, 5)
  })

  // Del 16 al 29 se dieron 2,100 lb de crecimiento y solo había 2,000: las 100
  // que faltan salen del engorde, que ya estaba en el almacén.
  it('lo de hoy y lo que sigue', () => {
    const { apt } = calcular()
    expect(apt.actual).toBe('engorde')
    expect(apt.fases.find((f) => f.fase === 'engorde')!.quedaLb).toBeCloseTo(1800, 5)
    expect(apt.siguiente).toBeUndefined()
    const { apt: antes } = calcular(dias(20))
    expect(antes.actual).toBe('crecimiento')
    expect(antes.siguiente).toBe('engorde')
  })

  // El productor pasó a crecimiento el día 12 aunque quedaba iniciador: desde
  // ahí se da crecimiento, y el iniciador que sobró se queda en el almacén.
  it('lo que el productor eligió manda, y no se vuelve atrás', () => {
    const { apt } = calcular(dias(20, { 12: 'crecimiento' }))
    expect(apt.dias.find((d) => d.dia === 12)).toMatchObject({ fase: 'crecimiento', elegido: true })
    expect(apt.dias.find((d) => d.dia === 13)?.fase).toBe('crecimiento')
    const iniciador = apt.fases.find((f) => f.fase === 'iniciador')!
    expect(iniciador.hastaDia).toBe(11)
    expect(iniciador.quedaLb).toBeCloseTo(1800 - 8 * 150, 5)
  })

  it('una compra sin tipo se supone por el día en que se compró', () => {
    const gastos = [...comprasDeEjemplo().slice(0, 2), compra(5, 18, 'Mega Broiler', 20, 1445)]
    const { apt } = calcular(dias(20), gastos)
    expect(apt.supuestas).toBe(1)
    expect(apt.partidas.find((p) => p.gastoId === 5)).toMatchObject({ fase: 'iniciador', supuesta: true })
  })

  it('lo que se pasó a otro ciclo sale de lo que quedaba de ese tipo', () => {
    const gastos = [
      ...comprasDeEjemplo(),
      gasto({ id: 9, categoria: 'alimento', fecha: hace(0), descripcion: 'Engorde', cantidadQq: -5, monto: -7005, traspaso: { loteId: 2 } }),
    ]
    const { apt } = calcular(dias(29), gastos)
    const engorde = apt.fases.find((f) => f.fase === 'engorde')!
    expect(engorde.quedaLb).toBeCloseTo(1300, 5)
    expect(engorde.compradoQq).toBe(14)
  })
})

describe('el precio de lo que falta', () => {
  it('cada tipo a lo último que se pagó por él', () => {
    const { apt } = calcular()
    const precio = (f: string) => apt.fases.find((x) => x.fase === f)?.precioQq
    expect(precio('preinicio')).toBe(1985)
    expect(precio('engorde')).toBe(1401)
  })

  // A los 20 días todavía no se ha comprado engorde: se usa lo que se pagó la
  // última vez en la granja, no el promedio de este ciclo.
  it('un tipo que este ciclo no ha comprado sale de otras compras de la granja', () => {
    vi.stubGlobal('localStorage', memoriaStorage({ 'avicontrol.settings': '{"preciosAlimento":{"engorde":1390}}' }))
    const { apt } = calcular(dias(20), comprasDeEjemplo().slice(0, 3))
    expect(apt.fases.find((f) => f.fase === 'engorde')?.precioQq).toBe(1390)
    expect(precioDelDiaLb(apt, 40, 0)).toBeCloseTo(13.9, 5)
  })

  it('lo que falta se compra del tipo que toca y a su precio', () => {
    const { apt } = calcular(dias(20))
    // Del 21 al 40, 200 lb al día: primero lo que queda de crecimiento y el
    // engorde del almacén; lo demás, engorde a 1,401.
    const futuro = alimentoFuturo(apt, 20, 40, () => 200)
    const enAlmacen = apt.partidas.reduce((a, p) => a + p.quedaLb, 0)
    expect(futuro.delAlmacenLb).toBeCloseTo(enAlmacen, 5)
    expect(futuro.comprar).toHaveLength(1)
    expect(futuro.comprar[0]).toMatchObject({ fase: 'engorde', precioQq: 1401 })
    expect(futuro.costo).toBeCloseTo(((20 * 200 - enAlmacen) / 100) * 1401, 3)
  })

  // Antes lo que faltaba se pagaba al promedio de todo lo comprado, con el
  // pre-inicio a 1,985: el engorde que falta salía más caro de lo que cuesta.
  it('la proyección paga el engorde que falta a precio de engorde', () => {
    const registros = dias(29).map((r) => (r.id === 28 ? { ...r, pesoPromedio: 3.4 } : r))
    // Con 29 días anotados el ciclo tiene 30: las compras quedan en sus días.
    const { l, m } = calcular(registros)
    const p = proyectarVenta({ ...l, precioVentaLb: 60 }, registros, comprasDeEjemplo(), m, 5.5)!
    expect(p.alimentoPorComprarLb).toBeGreaterThan(0)
    expect(p.comprarPorTipo.map((c) => c.fase)).toEqual(['engorde'])
    expect(p.faltaAlimento).toBeCloseTo((p.alimentoPorComprarLb / 100) * 1401, 0)
  })
})

describe('ultimosPrecios', () => {
  it('lo último que se pagó por cada tipo en la granja', () => {
    const gastos = [...comprasDeEjemplo(), compra(5, 29, 'Engorde', 10, 1420)]
    expect(ultimosPrecios(gastos)).toEqual({ preinicio: 1985, iniciador: 1429, crecimiento: 1445, engorde: 1420 })
  })
})
