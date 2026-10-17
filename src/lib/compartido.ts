import type { Aplicacion, EntregaSocio, Gasto, Ingreso, Lote, Pesaje, Registro } from '../db/schema'
import { esObjeto, primerProblema } from './validar'

// Un ciclo para mandárselo a un socio que no lleva los datos: lo abre en su
// teléfono como una copia que solo se mira. Cuando se lo mandas otra vez, su
// copia se pone al día en vez de quedar dos.
export const TIPO_CICLO = 'avicontrol-ciclo'
export const VERSION_CICLO = 1

export interface CicloCompartido {
  tipo: typeof TIPO_CICLO
  version: number
  /** La granja que lo manda. */
  de: string
  /** Cuándo se armó el archivo. */
  exportado: string
  lote: Lote
  registros: Registro[]
  pesajes: Pesaje[]
  gastos: Gasto[]
  ingresos: Ingreso[]
  aplicaciones: Aplicacion[]
  entregas: EntregaSocio[]
}

// Lo que une la copia con el ciclo de donde salió. Una copia que se vuelve a
// mandar sigue siendo del mismo ciclo.
export const claveOrigen = (lote: Pick<Lote, 'id' | 'creado' | 'compartido'>) =>
  lote.compartido?.origen ?? `${lote.creado}:${lote.id}`

export const esArchivoDeCiclo = (data: unknown) => esObjeto(data) && data.tipo === TIPO_CICLO

// El ciclo con todo lo suyo, listo para mandar. Las deudas no van: son de la
// granja, no del ciclo. Se arma con lo que la pantalla ya tiene: en el iPhone
// el menú de compartir solo se abre justo después del toque, y leer la base en
// ese momento lo hacía caducar.
export function armarCiclo(
  datos: Omit<CicloCompartido, 'tipo' | 'version' | 'de' | 'exportado'>,
  granja: string,
  ahora = new Date(),
): CicloCompartido {
  return {
    tipo: TIPO_CICLO,
    version: VERSION_CICLO,
    de: datos.lote.compartido?.de ?? granja,
    exportado: ahora.toISOString(),
    ...datos,
  }
}

export type LecturaCiclo = { ok: true; ciclo: CicloCompartido } | { ok: false; error: string }

export function leerCiclo(data: unknown): LecturaCiclo {
  if (!esArchivoDeCiclo(data)) return { ok: false, error: 'Ese archivo no es un ciclo de AviControl.' }
  const d = data as Record<string, unknown>
  if (typeof d.version === 'number' && d.version > VERSION_CICLO)
    return { ok: false, error: 'Ese ciclo viene de una versión más nueva de la app. Actualiza AviControl primero.' }
  const lista = (v: unknown) => (v == null ? [] : v)
  const problema =
    primerProblema([['lotes', [d.lote]]]) ??
    primerProblema(
      [
        ['registros', d.registros],
        ['gastos', lista(d.gastos)],
        ['ingresos', lista(d.ingresos)],
        ['pesajes', lista(d.pesajes)],
        ['aplicaciones', lista(d.aplicaciones)],
        ['entregas', lista(d.entregas)],
      ],
      // Las filas entran con números nuevos: los del otro teléfono no importan.
      { conId: false },
    )
  if (problema) return { ok: false, error: `El ciclo llegó dañado: ${problema}. Pídele que te lo mande otra vez.` }
  const lote = d.lote as Lote
  const deOtro = [d.registros, d.gastos, d.ingresos, d.pesajes, d.aplicaciones, d.entregas].some(
    (l) => Array.isArray(l) && l.some((f) => esObjeto(f) && f.loteId != null && f.loteId !== lote.id),
  )
  if (deOtro) return { ok: false, error: 'El archivo mezcla datos de otro ciclo. Pídele que te lo mande otra vez.' }
  return {
    ok: true,
    ciclo: {
      tipo: TIPO_CICLO,
      version: VERSION_CICLO,
      de: typeof d.de === 'string' && d.de.trim() ? d.de.trim() : 'otra granja',
      exportado: typeof d.exportado === 'string' ? d.exportado : new Date().toISOString(),
      lote,
      registros: d.registros as Registro[],
      pesajes: lista(d.pesajes) as Pesaje[],
      gastos: lista(d.gastos) as Gasto[],
      ingresos: lista(d.ingresos) as Ingreso[],
      aplicaciones: lista(d.aplicaciones) as Aplicacion[],
      entregas: lista(d.entregas) as EntregaSocio[],
    },
  }
}
