import { describe, expect, it } from 'vitest'
import { avesPorGalpon, ciclosPorGalpon, fraseMovimiento } from './reparto'
import { galponesOcupados, galponLibre, nombreGalpon } from './galpones'
import { hace, ingreso, lote, registro } from '../test/fixtures'

const granja = {
  galpones: [
    { id: 'g1', nombre: 'Galpón 1', largoM: 8.6, anchoM: 8.6 },
    { id: 'g2', nombre: 'Galpón 2' },
    { id: 'g3', nombre: 'Galpón 3' },
  ],
}
const hoy = hace(0)

// El caso del productor: 1,000 pollitos en un galpón de 8.6 × 8.6 m que ya no
// cabían, y 350 que se pasaron a otro galpón el día 21.
const pollada = lote({
  galponId: 'g1',
  cantidadInicial: 1000,
  movimientos: [{ fecha: hace(9), de: 'g1', a: 'g2', aves: 350 }],
})

describe('avesPorGalpon', () => {
  it('sin movimientos, todas están donde llegaron', () => {
    expect(avesPorGalpon(lote({ cantidadInicial: 1000, muertosLlegada: 10 }), 'g1', [], [], hoy)).toEqual([
      { galponId: 'g1', aves: 990 },
    ])
  })

  it('las que se pasaron están en el otro galpón', () => {
    expect(avesPorGalpon(pollada, 'g1', [], [], hoy)).toEqual([
      { galponId: 'g1', aves: 650 },
      { galponId: 'g2', aves: 350 },
    ])
  })

  it('antes del movimiento estaban todas juntas', () => {
    expect(avesPorGalpon(pollada, 'g1', [], [], hace(10))).toEqual([{ galponId: 'g1', aves: 1000 }])
  })

  it('las bajas de antes del movimiento son todas del primer galpón', () => {
    const r = [registro(5, { mortalidad: 20 })]
    expect(avesPorGalpon(pollada, 'g1', r, [], hoy)).toEqual([
      { galponId: 'g1', aves: 630 },
      { galponId: 'g2', aves: 350 },
    ])
  })

  it('las bajas de después se reparten según las aves de cada galpón, y suman lo que hay', () => {
    const r = [registro(25, { mortalidad: 10, descarte: 10 })]
    const g = avesPorGalpon(pollada, 'g1', r, [], hoy)
    expect(g).toEqual([
      { galponId: 'g1', aves: 637 },
      { galponId: 'g2', aves: 343 },
    ])
    expect(g.reduce((a, x) => a + x.aves, 0)).toBe(980)
  })

  it('la venta que dice de qué galpón salió se lleva las de ahí', () => {
    const v = [ingreso({ fecha: hace(2), cantidad: 350, galponId: 'g2' })]
    expect(avesPorGalpon(pollada, 'g1', [], v, hoy)).toEqual([{ galponId: 'g1', aves: 650 }])
  })

  it('la venta sin galpón se reparte', () => {
    const v = [ingreso({ fecha: hace(2), cantidad: 100 })]
    expect(avesPorGalpon(pollada, 'g1', [], v, hoy)).toEqual([
      { galponId: 'g1', aves: 585 },
      { galponId: 'g2', aves: 315 },
    ])
  })

  it('las que se pasaron el día de unas bajas llegan completas', () => {
    const r = [registro(21, { mortalidad: 2 })]
    expect(avesPorGalpon(pollada, 'g1', r, [], hoy)).toEqual([
      { galponId: 'g1', aves: 648 },
      { galponId: 'g2', aves: 350 },
    ])
  })

  it('no se mueven aves que no hay', () => {
    const l = lote({ cantidadInicial: 100, movimientos: [{ fecha: hace(5), de: 'g1', a: 'g2', aves: 500 }] })
    expect(avesPorGalpon(l, 'g1', [], [], hoy)).toEqual([{ galponId: 'g2', aves: 100 }])
  })

  it('al corregir un movimiento se cuenta sin él', () => {
    expect(avesPorGalpon(pollada, 'g1', [], [], hoy, { sin: 0 })).toEqual([{ galponId: 'g1', aves: 1000 }])
  })
})

describe('los galpones del ciclo', () => {
  it('se nombran los dos', () => {
    expect(galponesOcupados(pollada, granja)).toEqual(['g1', 'g2'])
    expect(nombreGalpon(pollada, granja)).toBe('Galpón 1 y Galpón 2')
  })

  it('si se pasaron todas, el primero queda libre', () => {
    const todas = lote({ galponId: 'g1', cantidadInicial: 500, movimientos: [{ fecha: hace(3), de: 'g1', a: 'g3', aves: 500 }] })
    expect(nombreGalpon(todas, granja)).toBe('Galpón 3')
    expect(galponLibre(granja.galpones, [todas])?.id).toBe('g1')
  })

  it('un galpón con parte de una pollada no está libre para otro ciclo', () => {
    expect(galponLibre(granja.galpones, [pollada])?.id).toBe('g3')
  })

  it('el movimiento en palabras', () => {
    expect(fraseMovimiento(pollada.movimientos![0], granja)).toBe('350 aves de Galpón 1 a Galpón 2')
    expect(fraseMovimiento({ fecha: hoy, de: 'g9', a: 'g1', aves: 1 }, granja)).toBe(
      '1 ave de un galpón que se quitó a Galpón 1',
    )
  })
})

describe('ciclosPorGalpon', () => {
  const m = (mortalidadPct: number, ganancia: number, vendidas = 100) => ({ mortalidadPct, fca: 1.6, iep: 400, ganancia, vendidas })

  it('promedia los ciclos de cada galpón y aparta las polladas repartidas', () => {
    const g = ciclosPorGalpon(
      [
        { lote: lote({ galponId: 'g1' }), metrics: m(4, 10000) },
        { lote: lote({ galponId: 'g1' }), metrics: m(6, 20000) },
        { lote: lote({ galponId: 'g2' }), metrics: m(3, 5000) },
        { lote: pollada, metrics: m(5, 0) },
      ],
      granja,
    )
    expect(g.map((x) => [x.nombre, x.ciclos, x.mortalidadPct, x.gananciaPorAve])).toEqual([
      ['Galpón 1', 2, 5, 150],
      ['Galpón 2', 1, 3, 50],
      ['Varios galpones', 1, 5, 0],
    ])
  })
})
