import { describe, expect, it } from 'vitest'
import { calorDelCiclo, calorReciente, fraseCalor, juicioCalor } from './calor'
import { computeAlertas } from './alerts'
import { computeMetrics } from './metrics'
import { hace, ingreso, lote, registro } from '../test/fixtures'

describe('juicioCalor', () => {
  it('con el pollo grande, 30 °C ya es calor y 34 °C es peligro', () => {
    expect(juicioCalor(29, 30).nivel).toBe('bien')
    expect(juicioCalor(30, 30).nivel).toBe('calor')
    expect(juicioCalor(34, 30).nivel).toBe('peligro')
  })

  it('la humedad pesa: con 85 % de humedad, 30 °C ya es peligro', () => {
    // 86 °F + 80 = 166: calor; con 85 % llega a 171.
    expect(juicioCalor(30, 30, 80).nivel).toBe('calor')
    expect(juicioCalor(30, 30, 85).nivel).toBe('peligro')
    expect(juicioCalor(28, 30, 80).nivel).toBe('calor')
    expect(juicioCalor(28, 30, 40).nivel).toBe('bien')
  })

  it('el pollito necesita calor: 33 °C el día 3 está bien', () => {
    expect(juicioCalor(33, 3).nivel).toBe('bien')
  })

  it('al pollito lo que se pasa de lo que pide su edad también le hace daño', () => {
    // Al día 10 piden 30 °C.
    expect(juicioCalor(34, 10).nivel).toBe('calor')
    expect(juicioCalor(37, 10).nivel).toBe('peligro')
  })

  it('si la máxima no llega a lo que piden, pasan frío', () => {
    expect(juicioCalor(27, 3).nivel).toBe('frio')
    expect(juicioCalor(25, 20).nivel).toBe('bien')
  })

  it('la frase dice qué hacer', () => {
    expect(fraseCalor(juicioCalor(35, 35))).toMatch(/ventiladores/)
    expect(fraseCalor(juicioCalor(27, 3))).toMatch(/frío/)
  })
})

describe('calorReciente', () => {
  const l = lote()
  it('mira el calor de hoy o de ayer', () => {
    expect(calorReciente(l, [registro(29, { tempMaxC: 35 })])?.nivel).toBe('peligro')
  })

  it('el de hace días ya no avisa', () => {
    expect(calorReciente(l, [registro(27, { tempMaxC: 35 })])).toBeUndefined()
  })

  it('el más nuevo manda', () => {
    expect(calorReciente(l, [registro(29, { tempMaxC: 35 }), registro(30, { tempMaxC: 27 })])?.nivel).toBe('bien')
  })
})

describe('alerta de calor', () => {
  const alertas = (registros: ReturnType<typeof registro>[]) => {
    const l = lote({ fechaInicio: hace(30) })
    return computeAlertas(l, registros, [], computeMetrics(l, registros, [], []), { plan: [] })
  }

  it('avisa el peligro como lo más grave', () => {
    const a = alertas([registro(30, { tempMaxC: 35, alimentoLb: 100 })])
    const calor = a.find((x) => x.texto.startsWith('Hoy el galpón llegó a 35 °C'))
    expect(calor?.nivel).toBe('bad')
  })

  it('el calor de ayer también', () => {
    const a = alertas([registro(29, { tempMaxC: 31, humedadPct: 60, alimentoLb: 100 })])
    expect(a.some((x) => x.texto.startsWith('Ayer el galpón llegó a 31 °C con 60 % de humedad'))).toBe(true)
  })

  it('un día fresco no avisa', () => {
    const a = alertas([registro(30, { tempMaxC: 27, alimentoLb: 100 })])
    expect(a.some((x) => x.texto.includes('°C'))).toBe(false)
  })
})

describe('calorDelCiclo', () => {
  it('compara las bajas de los días de calor con las de los demás', () => {
    const l = lote({ cantidadInicial: 1000 })
    const c = calorDelCiclo(l, [
      registro(20, { tempMaxC: 28, mortalidad: 1 }),
      registro(21, { tempMaxC: 29, mortalidad: 1 }),
      registro(22, { tempMaxC: 33, mortalidad: 6 }),
      registro(23, { tempMaxC: 35, mortalidad: 10 }),
    ])!
    expect(c.anotados).toBe(4)
    expect(c.diasCalor).toBe(2)
    expect(c.porMilNormal).toBeCloseTo(1, 1)
    expect(c.porMilCalor).toBeGreaterThan(7)
    expect(c.peor).toMatchObject({ dia: 23, tempC: 35, bajas: 10 })
  })

  it('la primera semana no entra en la comparación', () => {
    const c = calorDelCiclo(lote(), [registro(3, { tempMaxC: 40, mortalidad: 20 })])!
    expect(c.diasCalor).toBe(1)
    expect(c.porMilCalor).toBeUndefined()
  })

  it('sin temperaturas no hay nada que decir', () => {
    expect(calorDelCiclo(lote(), [registro(20, { mortalidad: 3 })])).toBeNull()
  })
})

describe('calor con ventas', () => {
  // Vendidas 700 de 1,000 el día 35: las bajas de los días siguientes se
  // dividían entre las 1,000 y el calor nunca «costaba aves».
  it('las aves de cada mañana restan lo vendido antes', () => {
    const l = lote({ cantidadInicial: 1000 })
    const venta = ingreso({ cantidad: 700, fecha: registro(35).fecha })
    const regs = [36, 37, 38, 39].map((d) => registro(d, { tempMaxC: d % 2 ? 35 : 27, mortalidad: d % 2 ? 3 : 1 }))
    const c = calorDelCiclo(l, regs, [venta])!
    expect(c.porMilCalor!).toBeCloseTo(10, 0)
    expect(c.porMilNormal!).toBeCloseTo(3.3, 0)
  })
})
