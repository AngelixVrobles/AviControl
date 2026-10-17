// Un .xlsx es un zip con unas cuantas hojas en XML. Se arma aquí, sin
// librerías: la app sigue pesando lo mismo y la hoja sale igual sin internet.
// Lo abren Excel, Google Sheets y Numbers.

export type Celda = string | number | null | undefined | { fecha: string }

export interface Hoja {
  nombre: string
  filas: Celda[][]
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const NS = 'http://schemas.openxmlformats.org'

// Lo que el XML no admite (controles) se quita; lo que tiene significado se escapa.
const esc = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 0 → A, 25 → Z, 26 → AA.
export function columna(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// Excel cuenta los días desde el 30 de diciembre de 1899.
export function serialExcel(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000)
}

// Estilos: 0 normal, 1 negrita (la primera fila), 2 con dos decimales, 3 entero
// con separador de miles, 4 fecha como se escribe aquí.
const ESTILOS = `${XML}<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

function celda(v: Celda, ref: string, encabezado: boolean): string {
  if (v == null || v === '') return ''
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    return `<c r="${ref}" s="${Number.isInteger(v) ? 3 : 2}"><v>${v}</v></c>`
  }
  if (typeof v === 'object') return `<c r="${ref}" s="4"><v>${serialExcel(v.fecha)}</v></c>`
  return `<c r="${ref}" t="inlineStr"${encabezado ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`
}

const largo = (v: Celda) =>
  v == null ? 0 : typeof v === 'number' ? String(Math.round(v * 100) / 100).length + 2 : typeof v === 'object' ? 10 : v.length

function hojaXml(h: Hoja): string {
  const columnas = Math.max(0, ...h.filas.map((f) => f.length))
  const anchos = Array.from({ length: columnas }, (_, i) =>
    Math.min(50, Math.max(8, ...h.filas.map((f) => largo(f[i]) + 2))),
  )
  const cols = anchos.length
    ? `<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const filas = h.filas
    .map((f, r) => `<row r="${r + 1}">${f.map((v, c) => celda(v, `${columna(c)}${r + 1}`, r === 0)).join('')}</row>`)
    .join('')
  // La primera fila se queda fija al bajar: son los títulos de cada columna.
  const vista =
    h.filas.length > 1
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : ''
  return `${XML}<worksheet xmlns="${NS}/spreadsheetml/2006/main">${vista}${cols}<sheetData>${filas}</sheetData></worksheet>`
}

// Los nombres de hoja no pasan de 31 letras, no llevan []:*?/\ y no se repiten.
function nombresDeHoja(hojas: Hoja[]): string[] {
  const usados = new Set<string>()
  return hojas.map((h, i) => {
    const base = h.nombre.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Hoja ${i + 1}`
    let nombre = base
    for (let n = 2; usados.has(nombre.toLowerCase()); n++) nombre = `${base.slice(0, 28)} ${n}`
    usados.add(nombre.toLowerCase())
    return nombre
  })
}

export function crearXlsx(hojas: Hoja[]): Uint8Array<ArrayBuffer> {
  const nombres = nombresDeHoja(hojas)
  const rel = (id: string, tipo: string, destino: string) =>
    `<Relationship Id="${id}" Type="${NS}/officeDocument/2006/relationships/${tipo}" Target="${destino}"/>`
  const archivos: [string, string][] = [
    [
      '[Content_Types].xml',
      `${XML}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('')}</Types>`,
    ],
    [
      '_rels/.rels',
      `${XML}<Relationships xmlns="${NS}/package/2006/relationships">${rel('rId1', 'officeDocument', 'xl/workbook.xml')}</Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `${XML}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>${nombres
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${XML}<Relationships xmlns="${NS}/package/2006/relationships">${hojas
        .map((_, i) => rel(`rId${i + 1}`, 'worksheet', `worksheets/sheet${i + 1}.xml`))
        .join('')}${rel(`rId${hojas.length + 1}`, 'styles', 'styles.xml')}</Relationships>`,
    ],
    ['xl/styles.xml', ESTILOS],
    ...hojas.map((h, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)]),
  ]
  const enc = new TextEncoder()
  return zip(archivos.map(([nombre, texto]) => ({ nombre, datos: enc.encode(texto) })))
}

// --- zip sin comprimir ---------------------------------------------------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Los archivos van guardados tal cual (sin comprimir): una hoja de un ciclo pesa
// poco, y así no hace falta un compresor.
export function zip(archivos: { nombre: string; datos: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  // 1 de enero de 1980, la primera fecha que cabe en un zip.
  const FECHA = (0 << 9) | (1 << 5) | 1

  for (const { nombre, datos } of archivos) {
    const n = enc.encode(nombre)
    const crc = crc32(datos)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true)
    local.setUint16(8, 0, true)
    local.setUint16(10, 0, true)
    local.setUint16(12, FECHA, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, n.length, true)
    local.setUint16(28, 0, true)
    partes.push(new Uint8Array(local.buffer), n, datos)

    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(4, 20, true)
    cd.setUint16(6, 20, true)
    cd.setUint16(8, 0x0800, true)
    cd.setUint16(10, 0, true)
    cd.setUint16(12, 0, true)
    cd.setUint16(14, FECHA, true)
    cd.setUint32(16, crc, true)
    cd.setUint32(20, datos.length, true)
    cd.setUint32(24, datos.length, true)
    cd.setUint16(28, n.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), n)

    offset += 30 + n.length + datos.length
  }

  const tamCentral = central.reduce((a, p) => a + p.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, offset, true)

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(new ArrayBuffer(todo.reduce((a, p) => a + p.length, 0)))
  let i = 0
  for (const p of todo) {
    salida.set(p, i)
    i += p.length
  }
  return salida
}
