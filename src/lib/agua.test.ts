import { describe, expect, it } from 'vitest'
import { aguaEsperadaL, caidaDeAgua, resumenAgua } from './agua'
import { ingreso, lote, registro } from '../test/fixtures'

const dia = (d: number, alimentoLb: number, aguaL: number) => registro(d, { alimentoLb, aguaL })

describe('aguaEsperadaL', () => {
  it('un pollo bebe cerca del doble de lo que come', () => {
    expect(aguaEsperadaL(100)).toBeCloseTo(82, 5)
    expect(aguaEsperadaL(0)).toBe(0)
  })
})

describe('resumenAgua', () => {
  it('sin agua anotada no devuelve nada', () => {
    expect(resumenAgua(lote(), [])).toBeNull()
    expect(resumenAgua(lote(), [registro(1, { alimentoLb: 50 })])).toBeNull()
  })

  it('saca los litros por libra de alimento', () => {
    const r = resumenAgua(lote(), [dia(10, 100, 82), dia(11, 100, 82)])!
    expect(r.promedioLitrosPorLb).toBeCloseTo(0.82, 3)
    expect(r.estado).toBe('normal')
    expect(r.totalL).toBe(164)
  })

  // El estado tiene que ser del último día: un promedio sano del ciclo esconde
  // que hoy dejaron de beber, que es justo lo que hay que ver.
  it('juzga por el último día y no por el promedio del ciclo', () => {
    // Diez días bebiendo bien y uno malo: el promedio sigue sano, el día no.
    const dias = Array.from({ length: 10 }, (_, i) => dia(10 + i, 100, 82))
    const r = resumenAgua(lote(), [...dias, dia(20, 100, 30)])!
    expect(r.promedioLitrosPorLb).toBeGreaterThan(0.7)
    expect(r.ultimo.litrosPorLb).toBeCloseTo(0.3, 3)
    expect(r.estado).toBe('bajo')
  })

  it('detecta cuando beben de más', () => {
    const r = resumenAgua(lote(), [dia(10, 100, 200)])!
    expect(r.estado).toBe('alto')
  })
})

describe('caidaDeAgua', () => {
  const serie = (litros: number[]) =>
    resumenAgua(lote(), litros.map((l, i) => dia(10 + i, 100, l)))!.dias

  it('avisa cuando el último día cae 20 % o más', () => {
    expect(caidaDeAgua(serie([100, 100, 100, 75]))).toBeCloseTo(25, 5)
  })

  it('no avisa por una bajada chica', () => {
    expect(caidaDeAgua(serie([100, 100, 100, 90]))).toBeUndefined()
  })

  it('no avisa si el consumo sube', () => {
    expect(caidaDeAgua(serie([100, 100, 100, 130]))).toBeUndefined()
  })

  it('necesita historial para poder comparar', () => {
    expect(caidaDeAgua(serie([100, 20]))).toBeUndefined()
  })

  // Compara contra los tres días previos, no contra todo el ciclo: si no, el
  // arranque (cuando beben poquísimo) taparía cualquier caída del final.
  it('compara solo contra los días recientes', () => {
    expect(caidaDeAgua(serie([10, 20, 100, 100, 100, 70]))).toBeCloseTo(30, 5)
  })
})

describe('agua con conteo de sacos y con ventas', () => {
  // Quien cuenta sacos no anota el alimento del día: antes cada día salía
  // «bebiendo poco, 0.00 L por libra».
  it('sin el alimento del día no se juzga como «bebiendo poco»', () => {
    const r = resumenAgua(lote(), [10, 11, 12, 13].map((d) => registro(d, { aguaL: 300 })))!
    expect(r.estado).toBe('normal')
  })

  // Vender la mitad del lote no es que dejaron de beber.
  it('una venta no parece una caída de agua', () => {
    const l = lote({ cantidadInicial: 1000 })
    const regs = [20, 21, 22, 23].map((d) => registro(d, { aguaL: d === 23 ? 300 : 600, alimentoLb: d === 23 ? 360 : 720 }))
    const venta = ingreso({ cantidad: 500, fecha: registro(22).fecha })
    expect(resumenAgua(l, regs, [venta])!.caidaPct).toBeUndefined()
    expect(resumenAgua(l, regs)!.caidaPct).toBeGreaterThan(40)
  })
})
