import { describe, expect, it } from 'vitest'
import { armarCiclo, claveOrigen, esArchivoDeCiclo, leerCiclo, TIPO_CICLO } from './compartido'
import { gasto, ingreso, lote, registro } from '../test/fixtures'

const ciclo = () =>
  armarCiclo(
    {
      lote: lote({ id: 7, creado: 1700 }),
      registros: [registro(1, { loteId: 7 }), registro(2, { loteId: 7 })],
      pesajes: [],
      gastos: [gasto({ loteId: 7, monto: 500 })],
      ingresos: [ingreso({ loteId: 7, monto: 900 })],
      aplicaciones: [],
      entregas: [],
    },
    'Granja El Sol',
    new Date('2026-10-17T12:00:00Z'),
  )

// Lo que pasa por el archivo: el objeto se vuelve texto y se lee de nuevo.
const porArchivo = (x: unknown) => JSON.parse(JSON.stringify(x))

describe('ciclo compartido', () => {
  it('se arma con la granja que lo manda y la fecha', () => {
    const c = ciclo()
    expect(c.tipo).toBe(TIPO_CICLO)
    expect(c.de).toBe('Granja El Sol')
    expect(c.exportado).toBe('2026-10-17T12:00:00.000Z')
    expect(esArchivoDeCiclo(porArchivo(c))).toBe(true)
  })

  it('se lee completo del otro lado', () => {
    const r = leerCiclo(porArchivo(ciclo()))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.ciclo.registros).toHaveLength(2)
      expect(r.ciclo.gastos[0].monto).toBe(500)
    }
  })

  it('la copia que se vuelve a mandar sigue siendo del mismo ciclo', () => {
    const original = lote({ id: 7, creado: 1700 })
    expect(claveOrigen(original)).toBe('1700:7')
    const copia = { ...original, id: 3, compartido: { de: 'X', exportado: '', origen: '1700:7' } }
    expect(claveOrigen(copia)).toBe('1700:7')
  })

  it('un respaldo no es un ciclo', () => {
    expect(esArchivoDeCiclo({ version: 4, lotes: [] })).toBe(false)
    expect(leerCiclo({ version: 4, lotes: [] }).ok).toBe(false)
  })

  it('uno de una versión más nueva pide actualizar', () => {
    const r = leerCiclo({ ...porArchivo(ciclo()), version: 99 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/versión más nueva/)
  })

  it('uno dañado no entra y dice qué tiene', () => {
    const c = porArchivo(ciclo())
    c.registros[1].fecha = 'ayer'
    const r = leerCiclo(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/1 día anotado viene incompleto o dañado/)
  })

  it('uno que mezcla datos de otro ciclo no entra', () => {
    const c = porArchivo(ciclo())
    c.gastos[0].loteId = 99
    expect(leerCiclo(c).ok).toBe(false)
  })
})
