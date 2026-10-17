import { useLiveQuery } from 'dexie-react-hooks'
import { leerRespaldo } from '../db/respaldo'
import { hoyISO } from '../lib/format'
import { useSettings } from '../lib/hooks'
import { descargaSegura, entregarArchivo, type ComoSeGuardo } from '../lib/archivo'
import { nombreRespaldo } from '../lib/respaldo'
import { saveSettings } from '../lib/settings'
import { toast } from './confirm'

// El respaldo se arma antes del toque y se mantiene al día con la base: Safari
// solo deja abrir el menú de compartir justo después de tocar, y leer todas las
// tablas en ese momento podía hacer que el permiso caducara.
export function useRespaldo() {
  const settings = useSettings()
  const json = useLiveQuery(() => leerRespaldo(settings), [settings])

  async function respaldar() {
    const texto = json ?? (await leerRespaldo(settings))
    const archivo = new File([texto], nombreRespaldo(), { type: 'application/json' })
    let como: ComoSeGuardo
    try {
      como = await entregarArchivo(archivo)
    } catch {
      toast('No se pudo guardar el respaldo. Inténtalo de nuevo.')
      return
    }
    // Solo cuenta como respaldo lo que se guardó: antes se marcaba «hoy» aunque
    // el archivo no hubiera llegado a ninguna parte.
    if (como === 'cancelado') return
    // En el iPhone, si no se pudo compartir y se descargó, puede que no haya
    // quedado en ninguna parte: no se da por hecho, y el aviso sigue.
    if (como === 'descargado' && !descargaSegura()) {
      toast('No se abrió el menú de compartir. Toca Respaldar otra vez y elige Guardar en Archivos o WhatsApp.')
      return
    }
    saveSettings({ ultimoRespaldo: hoyISO() })
    toast(
      como === 'compartido'
        ? 'Respaldo guardado.'
        : 'Respaldo descargado. Pásalo fuera del teléfono: WhatsApp, el correo o Drive.',
    )
  }

  return { respaldar, listo: json != null }
}
