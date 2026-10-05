import { describe, expect, it } from 'vitest'
import { aMedida, computeEquipo, deMedida, type ConfigEquipo } from './equipo'

const plasson: ConfigEquipo = { bebedero: 'plasson', comedero: 'tolva' }
const base = { pesoObjetivoLb: 5.5, diaVenta: 35, config: plasson, avesPorM2: 11 }

describe('computeEquipo', () => {
  it('no hay plan sin aves', () => {
    expect(computeEquipo({ ...base, aves: 0 })).toBeNull()
  })

  // 1.000 pollos con Plasson y tolvas Plasson: 80 aves por bebedero en calor y
  // 45 por tolva al final (80 al empezar).
  it('cuenta Plasson y tolvas para las aves del galpón', () => {
    const p = computeEquipo({ ...base, aves: 1000 })!
    expect(p.bebederos.nombre).toBe('Bebederos Plasson')
    expect(p.bebederos.cantidad).toBe(13)
    expect(p.comederos.cantidad).toBe(23)
    expect(p.comederos.alInicio).toBe(13)
  })

  it('usa la cifra del productor cuando su modelo es otro', () => {
    const p = computeEquipo({
      ...base,
      aves: 1000,
      config: { ...plasson, avesPor: { tolva: 35, plasson: 100 } },
    })!
    expect(p.comederos.cantidad).toBe(29)
    expect(p.bebederos.cantidad).toBe(10)
  })

  it('con niples y platos cambian las cuentas', () => {
    const p = computeEquipo({ ...base, aves: 1000, config: { bebedero: 'niple', comedero: 'plato' } })!
    expect(p.bebederos.cantidad).toBe(100)
    expect(p.comederos.cantidad).toBe(17)
    expect(p.comederos.alInicio).toBeUndefined()
    expect(p.metrosDeNiples).toBeCloseTo(35, 5)
  })

  it('el recibo lleva bandejas, bebederos de galón y criadoras', () => {
    const [bandejas, galones, criadoras] = computeEquipo({ ...base, aves: 2500 })!.crianza
    expect(bandejas.cantidad).toBe(50)
    expect(galones.cantidad).toBe(25)
    expect(criadoras.cantidad).toBe(3)
  })

  it('el agua del final sale del consumo del día de venta', () => {
    const poco = computeEquipo({ ...base, aves: 1000, diaVenta: 21 })!
    const mucho = computeEquipo({ ...base, aves: 1000, diaVenta: 40 })!
    expect(mucho.aguaFinalL).toBeGreaterThan(poco.aguaFinalL)
    expect(mucho.aguaFinalL).toBeGreaterThan(300)
  })

  describe('con las medidas del galpón', () => {
    const galpon = { ...base, largoM: 40, anchoM: 12 }

    it('caben las que permite la densidad de la granja', () => {
      const g = computeEquipo({ ...galpon, aves: 1000 })!.galpon!
      expect(g.areaM2).toBe(480)
      expect(g.avesMaximas).toBe(480 * 11)
      expect(g.limitePorPeso).toBe(false)
      expect(g.sobrepoblado).toBe(false)
    })

    // A 6.5 lb, 11 aves por m² ya pasan de 30 kg/m²: manda el peso.
    it('al peso de venta alto manda el límite de 30 kg/m²', () => {
      const g = computeEquipo({ ...galpon, aves: 1000, pesoObjetivoLb: 6.5 })!.galpon!
      expect(g.limitePorPeso).toBe(true)
      expect(g.avesMaximas).toBeLessThan(480 * 11)
    })

    it('avisa cuando no caben', () => {
      const g = computeEquipo({ ...galpon, aves: 6000 })!.galpon!
      expect(g.sobrepoblado).toBe(true)
    })

    it('el recibo usa los primeros metros del galpón a todo lo ancho', () => {
      const g = computeEquipo({ ...galpon, aves: 1080 })!.galpon!
      expect(g.reciboM2).toBeCloseTo(24, 5)
      expect(g.reciboLargoM).toBeCloseTo(2, 5)
    })

    it('reparte en dos líneas un galpón de 12 m de ancho', () => {
      const g = computeEquipo({ ...galpon, aves: 1000 })!.galpon!
      expect(g.bebederos.lineas).toBe(2)
      expect(g.bebederos.caminataMaxM).toBeLessThanOrEqual(3)
      expect(g.comederos.porLinea * g.comederos.lineas).toBeGreaterThanOrEqual(23)
    })
  })
})

describe('medidas en pies', () => {
  it('ida y vuelta sin perder nada', () => {
    expect(deMedida(aMedida(12, 'pies'), 'pies')).toBeCloseTo(12, 10)
    expect(aMedida(10, 'm')).toBe(10)
    expect(deMedida(100, 'pies')).toBeCloseTo(30.48, 2)
  })
})
