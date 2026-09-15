import { describe, expect, it } from 'vitest'
import {
  alimentoAcumEstandarLb,
  alimentoDiaEstandarLb,
  diaParaPeso,
  fcaEstandar,
  FASES_ALIMENTO,
  hitosEngorde,
  mortalidadEsperadaPct,
  pesoEstandarLb,
} from './standards'

// La tabla es el suplemento Cobb500 2022 (as-hatched, imperial). Si alguien la
// edita y se le va un dedo, toda la app miente sin avisar: estas son las anclas.
describe('tabla Cobb 500', () => {
  it('coincide con los valores publicados', () => {
    expect(pesoEstandarLb(0)).toBe(0.09)
    expect(pesoEstandarLb(7)).toBe(0.45)
    expect(pesoEstandarLb(21)).toBe(2.46)
    expect(pesoEstandarLb(42)).toBe(7.23)
    expect(alimentoAcumEstandarLb(7)).toBe(0.4)
    expect(alimentoAcumEstandarLb(42)).toBe(11.26)
  })

  it('la conversión acumulada reproduce el FCR publicado', () => {
    expect(fcaEstandar(42)).toBeCloseTo(1.557, 2)
    expect(fcaEstandar(35)).toBeCloseTo(1.442, 2)
  })

  it('crece siempre: ni peso ni alimento retroceden', () => {
    for (let d = 1; d <= 56; d++) {
      expect(pesoEstandarLb(d)).toBeGreaterThan(pesoEstandarLb(d - 1))
      expect(alimentoAcumEstandarLb(d)).toBeGreaterThan(alimentoAcumEstandarLb(d - 1))
    }
  })

  it('no devuelve NaN ni fuera de rango', () => {
    for (const d of [-5, 0, 56, 200]) {
      expect(Number.isFinite(pesoEstandarLb(d))).toBe(true)
      expect(Number.isFinite(alimentoAcumEstandarLb(d))).toBe(true)
    }
    expect(pesoEstandarLb(200)).toBe(pesoEstandarLb(56))
  })

  it('el consumo diario nunca es negativo', () => {
    for (let d = 0; d <= 56; d++) expect(alimentoDiaEstandarLb(d)).toBeGreaterThanOrEqual(0)
  })
})

describe('diaParaPeso', () => {
  it('encuentra el día en que la curva llega al objetivo', () => {
    const d = diaParaPeso(5.5)
    expect(pesoEstandarLb(d)).toBeGreaterThanOrEqual(5.5)
    expect(pesoEstandarLb(d - 1)).toBeLessThan(5.5)
  })

  it('un lote al 90 % del estándar tarda más', () => {
    expect(diaParaPeso(5.5, 0.9)).toBeGreaterThan(diaParaPeso(5.5))
  })

  it('no se pasa del final de la tabla', () => {
    expect(diaParaPeso(99)).toBe(56)
  })
})

describe('fases de alimento', () => {
  it('cubren el ciclo sin huecos ni solapes', () => {
    for (let i = 1; i < FASES_ALIMENTO.length; i++) {
      expect(FASES_ALIMENTO[i].desde).toBe(FASES_ALIMENTO[i - 1].hasta + 1)
    }
    expect(FASES_ALIMENTO[0].desde).toBe(0)
    expect(FASES_ALIMENTO[FASES_ALIMENTO.length - 1].hasta).toBe(Infinity)
  })
})

describe('hitos del ciclo', () => {
  it('van en orden y ninguno se pasa del día de venta', () => {
    const hitos = hitosEngorde(41)
    expect(hitos.length).toBeGreaterThan(3)
    for (let i = 1; i < hitos.length; i++) expect(hitos[i].dia).toBeGreaterThanOrEqual(hitos[i - 1].dia)
    expect(hitos[hitos.length - 1].dia).toBe(41)
    expect(hitos.every((h) => h.dia > 0 && h.dia <= 41)).toBe(true)
  })

  it('el retiro cae antes de la venta', () => {
    const hitos = hitosEngorde(41)
    const retiro = hitos.find((h) => h.etiqueta === 'Retiro')!
    expect(retiro.dia).toBeLessThan(41)
  })
})

describe('mortalidad esperada', () => {
  it('sube con la edad y tiene techo', () => {
    expect(mortalidadEsperadaPct(0)).toBe(0)
    expect(mortalidadEsperadaPct(42)).toBeGreaterThan(mortalidadEsperadaPct(7))
    expect(mortalidadEsperadaPct(200)).toBeLessThanOrEqual(5)
  })
})
