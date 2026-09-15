import { describe, expect, it } from 'vitest'
import { analizarMuestra, faltanPorPesar, tamanoMuestra } from './muestreo'

const PESOS = [4.1, 4.5, 3.8, 4.35, 4.6, 3.95]

describe('analizarMuestra', () => {
  it('calcula promedio, desviación y CV', () => {
    const m = analizarMuestra(PESOS, 461)!
    expect(m.n).toBe(6)
    expect(m.promedioLb).toBeCloseTo(4.2167, 3)
    expect(m.desvEstLb).toBeCloseTo(0.3173, 3)
    expect(m.cvPct).toBeCloseTo(7.52, 1)
    expect(m.minLb).toBe(3.8)
    expect(m.maxLb).toBe(4.6)
  })

  // Con seis aves la t de Student da un margen bastante mayor que la normal;
  // usar z aquí subestimaría el error justo cuando más engaña.
  it('usa la t de Student con muestras chicas', () => {
    const m = analizarMuestra(PESOS, 461)!
    expect(m.margenLb).toBeCloseTo(0.331, 2)
    const conZ = (1.96 * m.desvEstLb) / Math.sqrt(m.n)
    expect(m.margenLb).toBeGreaterThan(conZ)
  })

  it('el margen se achica al crecer la muestra', () => {
    const chica = analizarMuestra(PESOS, 1000)!
    const grande = analizarMuestra([...PESOS, ...PESOS, ...PESOS, ...PESOS], 1000)!
    expect(grande.margenPct).toBeLessThan(chica.margenPct)
  })

  it('si pesas todo el galpón no hay margen de error', () => {
    const m = analizarMuestra(PESOS, 6)!
    expect(m.margenLb).toBe(0)
  })

  it('sin población conocida no aplica corrección', () => {
    const m = analizarMuestra(PESOS, 0)!
    expect(m.margenLb).toBeGreaterThan(0)
  })

  it('la uniformidad cuenta las aves dentro de ±10 % del promedio', () => {
    const m = analizarMuestra([5, 5, 5, 5], 100)!
    expect(m.uniformidadPct).toBe(100)
    const fuera = analizarMuestra([5, 5, 5, 5.8], 100)!
    expect(fuera.uniformidadPct).toBe(75)
    expect(analizarMuestra([4, 4.5, 5.5, 6], 100)!.uniformidad).toBe('despareja')
  })

  it('estima el peso vivo del galpón con su rango', () => {
    const m = analizarMuestra(PESOS, 100)!
    expect(m.biomasaLb).toBeCloseTo(421.67, 1)
    expect(m.biomasaMinLb!).toBeLessThan(m.biomasaLb!)
    expect(m.biomasaMaxLb!).toBeGreaterThan(m.biomasaLb!)
  })

  it('descarta pesos inválidos y devuelve null si no queda nada', () => {
    expect(analizarMuestra([], 100)).toBeNull()
    expect(analizarMuestra([0, -1], 100)).toBeNull()
    expect(analizarMuestra([4, 0, 5], 100)!.n).toBe(2)
  })
})

describe('tamanoMuestra', () => {
  // Con el CV típico y ±2 % da unas cien aves, que es la regla de campo de toda
  // la vida; sirve de prueba de que la fórmula no se fue a otro planeta.
  it('reproduce la regla de las cien aves en galpones grandes', () => {
    expect(tamanoMuestra(10000, 10, 2)).toBeGreaterThan(80)
    expect(tamanoMuestra(10000, 10, 2)).toBeLessThan(110)
  })

  it('pide menos aves en galpones chicos', () => {
    expect(tamanoMuestra(100, 10, 3)).toBeLessThan(tamanoMuestra(5000, 10, 3))
  })

  it('pide más cuando el lote está despareja o se quiere más precisión', () => {
    expect(tamanoMuestra(1000, 16, 3)).toBeGreaterThan(tamanoMuestra(1000, 8, 3))
    expect(tamanoMuestra(1000, 10, 1)).toBeGreaterThan(tamanoMuestra(1000, 10, 5))
  })

  it('nunca pide más aves de las que hay', () => {
    expect(tamanoMuestra(20, 10, 1)).toBeLessThanOrEqual(20)
  })
})

describe('faltanPorPesar', () => {
  // Con una sola ave la desviación es cero y el margen sale cero: decir
  // «muestra suficiente» ahí sería mentir.
  it('no da por buena una muestra de una sola ave', () => {
    const m = analizarMuestra([4.2], 500)!
    expect(m.margenLb).toBe(0)
    expect(faltanPorPesar(m, 500)).toBeGreaterThan(0)
  })

  it('no pide más cuando ya se alcanzó la precisión', () => {
    const m = analizarMuestra(Array(60).fill(4.2), 500)!
    expect(faltanPorPesar(m, 500)).toBe(0)
  })

  it('pide más cuando el margen todavía es grande', () => {
    const m = analizarMuestra([4.1, 4.5, 3.8, 4.35, 4.6, 3.95], 461)!
    expect(faltanPorPesar(m, 461)).toBeGreaterThan(0)
  })
})
