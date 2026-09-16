import { describe, expect, it } from 'vitest'
import { escalaY, indicesEtiqueta, interpolar, tramosBanda } from './escala'

describe('escalaY', () => {
  it('pega el dominio a los datos y pone las marcas en valores redondos', () => {
    const e = escalaY(0.09, 4.61)
    expect(e.desde).toBe(0)
    expect(e.hasta).toBeLessThan(5)
    expect(e.hasta).toBeGreaterThan(4.61)
    expect(e.marcas).toEqual([0, 2, 4])
  })

  it('no deja la curva aplastada: el dato más alto pasa del 90 % del alto', () => {
    const e = escalaY(0.09, 4.61)
    expect((4.61 - e.desde) / (e.hasta - e.desde)).toBeGreaterThan(0.9)
  })

  it('abre un dominio alrededor de un valor plano', () => {
    const e = escalaY(3, 3)
    expect(e.desde).toBeLessThan(3)
    expect(e.hasta).toBeGreaterThan(3)
  })

  it('deja el cero dentro cuando hay pérdidas y ganancias', () => {
    const e = escalaY(-12000, 47000)
    expect(e.desde).toBeLessThanOrEqual(-12000)
    expect(e.hasta).toBeGreaterThanOrEqual(47000)
    expect(e.marcas).toContain(0)
  })

  it('no produce marcas con basura decimal', () => {
    for (const v of escalaY(0, 0.7).marcas) expect(String(v).length).toBeLessThan(6)
  })
})

describe('tramosBanda', () => {
  const x = [0, 1, 2, 3]

  it('parte el tramo en el cruce exacto, no en el punto siguiente', () => {
    const t = tramosBanda(x, [2, 2, 0, 0], [1, 1, 1, 1])
    expect(t).toHaveLength(2)
    expect(t[0].signo).toBe(1)
    expect(t[1].signo).toBe(-1)
    const cruce = t[0].puntos.at(-1)!
    expect(cruce.x).toBeCloseTo(1.5, 5)
    expect(cruce.a).toBeCloseTo(cruce.b, 5)
    expect(t[1].puntos[0].x).toBeCloseTo(1.5, 5)
  })

  it('corta la banda donde falta un dato', () => {
    const t = tramosBanda(x, [2, undefined, 2, 2], [1, 1, 1, 1])
    expect(t).toHaveLength(1)
    expect(t[0].puntos.map((p) => p.x)).toEqual([2, 3])
  })

  it('descarta los tramos de un solo punto, que no pintan nada', () => {
    expect(tramosBanda(x, [2, undefined, undefined, undefined], [1, 1, 1, 1])).toEqual([])
  })
})

describe('interpolar', () => {
  it('rellena los huecos interiores en línea recta', () => {
    expect(interpolar([0, 5, 10], [2, undefined, 4])).toEqual([2, 3, 4])
  })

  it('reparte según la distancia real en x, no según el índice', () => {
    expect(interpolar([0, 8, 10], [0, undefined, 10])).toEqual([0, 8, 10])
  })

  it('no inventa datos fuera del primero y el último', () => {
    expect(interpolar([0, 1, 2], [undefined, 5, undefined])).toEqual([undefined, 5, undefined])
  })
})

describe('indicesEtiqueta', () => {
  it('etiqueta todo cuando cabe', () => {
    expect(indicesEtiqueta(3, 5)).toEqual([0, 1, 2])
  })

  it('reparte y siempre incluye los extremos', () => {
    const i = indicesEtiqueta(43, 5)
    expect(i).toHaveLength(5)
    expect(i[0]).toBe(0)
    expect(i.at(-1)).toBe(42)
  })
})
