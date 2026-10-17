import { describe, expect, it } from 'vitest'
import { columna, crc32, crearXlsx, serialExcel } from './xlsx'
import { hojasDelCiclo } from './exportar'
import { computeMetrics } from './metrics'
import { gasto, ingreso, lote, registro } from '../test/fixtures'

// Lee el zip como lo haría Excel: el directorio del final dice dónde está cada
// archivo, y el CRC de cada uno tiene que cuadrar.
function leerZip(bytes: Uint8Array): Map<string, string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const fin = bytes.length - 22
  expect(v.getUint32(fin, true)).toBe(0x06054b50)
  const total = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const dec = new TextDecoder()
  const out = new Map<string, string>()
  for (let k = 0; k < total; k++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50)
    const crc = v.getUint32(p + 16, true)
    const tam = v.getUint32(p + 20, true)
    const largoNombre = v.getUint16(p + 28, true)
    const local = v.getUint32(p + 42, true)
    const nombre = dec.decode(bytes.subarray(p + 46, p + 46 + largoNombre))
    expect(v.getUint32(local, true)).toBe(0x04034b50)
    const ini = local + 30 + v.getUint16(local + 26, true)
    const datos = bytes.subarray(ini, ini + tam)
    expect(crc32(datos)).toBe(crc)
    out.set(nombre, dec.decode(datos))
    p += 46 + largoNombre
  }
  return out
}

describe('xlsx', () => {
  it('nombra las columnas como Excel', () => {
    expect(columna(0)).toBe('A')
    expect(columna(25)).toBe('Z')
    expect(columna(26)).toBe('AA')
    expect(columna(701)).toBe('ZZ')
  })

  it('cuenta las fechas como Excel', () => {
    expect(serialExcel('1900-03-01')).toBe(61)
    expect(serialExcel('2026-10-17')).toBe(46312)
  })

  it('el CRC es el de siempre', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('arma un libro que se abre: hojas, textos, números y fechas', () => {
    const archivos = leerZip(
      crearXlsx([
        { nombre: 'Días', filas: [['Fecha', 'Bajas'], [{ fecha: '2026-10-17' }, 3], ['A & B <c>', 2.5]] },
        { nombre: 'Días', filas: [['Otra']] },
      ]),
    )
    expect([...archivos.keys()]).toEqual(
      expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet2.xml']),
    )
    const libro = archivos.get('xl/workbook.xml')!
    expect(libro).toContain('name="Días"')
    // Dos hojas no pueden llamarse igual.
    expect(libro).toContain('name="Días 2"')
    const hoja = archivos.get('xl/worksheets/sheet1.xml')!
    expect(hoja).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Fecha</t></is></c>')
    expect(hoja).toContain('<c r="A2" s="4"><v>46312</v></c>')
    expect(hoja).toContain('<c r="B2" s="3"><v>3</v></c>')
    expect(hoja).toContain('A &amp; B &lt;c&gt;')
    expect(hoja).toContain('<c r="B3" s="2"><v>2.5</v></c>')
  })
})

describe('hojasDelCiclo', () => {
  it('lleva el resumen y cada cosa anotada en su hoja', () => {
    const l = lote({ socios: [{ nombre: 'Yo', pct: 50 }, { nombre: 'Pedro', pct: 50 }], costoInicialPagadoPor: 1 })
    const registros = [registro(1, { mortalidad: 2, alimentoLb: 50, tempMaxC: 31 })]
    const gastos = [gasto({ categoria: 'alimento', monto: 3000, cantidadQq: 2, pagadoPor: 0 })]
    const ingresos = [ingreso({ cantidad: 100, monto: 9000, credito: true, cobros: [{ fecha: '2026-10-01', monto: 4000 }] })]
    const m = computeMetrics(l, registros, gastos, ingresos)
    const hojas = hojasDelCiclo(
      { lote: l, registros, pesajes: [], gastos, ingresos, aplicaciones: [], entregas: [], metrics: m },
      'Granja El Sol',
    )
    expect(hojas.map((h) => h.nombre)).toEqual(['Resumen', 'Días', 'Gastos', 'Ventas', 'Pesajes', 'Sanidad'])
    const resumen = Object.fromEntries(hojas[0].filas.slice(1).map((f) => [f[0], f[1]]))
    expect(resumen['Granja']).toBe('Granja El Sol')
    expect(resumen['Socios']).toBe('Yo 50 % · Pedro 50 %')
    expect(hojas[1].filas[1]).toContain(31)
    // Los pollitos van como el primer gasto, con quien los pagó.
    expect(hojas[2].filas[1]).toEqual([{ fecha: l.fechaInicio }, 'Pollitos', '500 pollitos', undefined, 24000, 'Pedro'])
    expect(hojas[2].filas[2]).toContain('Yo')
    expect(hojas[3].filas[1].slice(5)).toEqual([9000, 4000, 5000])
  })
})

describe('la pollada en varios galpones', () => {
  it('lleva su hoja con lo que se pasó y lo que hay hoy, y cada venta dice de qué galpón salió', () => {
    const l = lote({
      galponId: 'g1',
      cantidadInicial: 1000,
      movimientos: [{ fecha: '2026-10-01', de: 'g1', a: 'g2', aves: 350 }],
    })
    const ingresos = [ingreso({ cantidad: 50, monto: 9000, galponId: 'g2' })]
    const m = computeMetrics(l, [], [], ingresos)
    const galpones = [
      { id: 'g1', nombre: 'Galpón 1' },
      { id: 'g2', nombre: 'Galpón 2' },
    ]
    const hojas = hojasDelCiclo(
      { lote: l, registros: [], pesajes: [], gastos: [], ingresos, aplicaciones: [], entregas: [], metrics: m },
      'Granja',
      galpones,
    )
    const hoja = hojas.find((h) => h.nombre === 'Galpones')!
    expect(hoja.filas[1].slice(2)).toEqual(['Galpón 1', 'Galpón 2', 350])
    expect(hoja.filas.slice(-2)).toEqual([
      ['Galpón 1', 650],
      ['Galpón 2', 300],
    ])
    expect(hojas.find((h) => h.nombre === 'Ventas')!.filas[1].at(-1)).toBe('Galpón 2')
  })
})

describe('semanasDelCiclo', () => {
  it('junta los días por semana del ciclo', async () => {
    const { semanasDelCiclo } = await import('./exportar')
    const l = lote({ cantidadInicial: 1000 })
    const s = semanasDelCiclo(l, [
      registro(1, { mortalidad: 3, alimentoLb: 20 }),
      registro(7, { mortalidad: 1, alimentoLb: 30, pesoPromedio: 0.4 }),
      registro(8, { mortalidad: 2, descarte: 1, alimentoLb: 40 }),
    ])
    expect(s).toEqual([
      { semana: 1, bajas: 4, pctLote: 0.4, alimentoLb: 50, pesoLb: 0.4 },
      { semana: 2, bajas: 3, pctLote: 0.3, alimentoLb: 40 },
    ])
  })
})
