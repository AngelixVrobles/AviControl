import { describe, expect, it } from 'vitest'
import { aguaEsperadaL, caidaDeAgua, resumenAgua } from './agua'
import { lote, registro } from '../test/fixtures'

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
