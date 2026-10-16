import { diasEntre, hoyISO } from './format'

// Pasada una semana sin respaldo, Inicio lo recuerda: todo vive en el teléfono
// y una semana de registros ya no se reconstruye de memoria.
export const DIAS_PARA_RECORDAR = 7

export const nombreRespaldo = (hoy = hoyISO()) => `avicontrol-respaldo-${hoy}.json`

export function diasSinRespaldo(ultimo: string | null, hoy = hoyISO()): number | null {
  return ultimo ? diasEntre(ultimo, hoy) : null
}

export function tocaRecordarRespaldo(ultimo: string | null, hayDatos: boolean, hoy = hoyISO()) {
  if (!hayDatos) return false
  const dias = diasSinRespaldo(ultimo, hoy)
  return dias == null || dias >= DIAS_PARA_RECORDAR
}

export type ComoSeGuardo = 'compartido' | 'descargado' | 'cancelado'

// En el teléfono el archivo sale por el menú de compartir —Guardar en Archivos,
// WhatsApp, Drive—: con la app instalada en el iPhone, la descarga de antes
// podía no guardar nada. En la computadora, o si el teléfono no deja compartir
// ese tipo de archivo (Android no comparte .json), se descarga.
export async function entregarArchivo(archivo: File): Promise<ComoSeGuardo> {
  const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (tactil && navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: archivo.name })
      return 'compartido'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // Cualquier otro fallo (el toque ya caducó, el sistema no quiso): se descarga.
    }
  }
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = archivo.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Soltarlo al instante podía cortar la descarga en Safari antes de empezar.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'descargado'
}
