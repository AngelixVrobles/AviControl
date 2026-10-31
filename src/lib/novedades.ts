// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.15',
  cosas: [
    'La venta al pollero se anota como en el cuaderno: en «Pesar por cajas» pones las cajas vacías por grupos —6 cajas, 94 lb— y cada pesada llena, y la app saca las libras de pollo y el total. Si dices cuántos pollos van por caja, salen las aves.',
    'La app recuerda cuánto pesan las cajas de cada pollero: si hoy salen muy distintas, se nota. Y si la última venta se pesó por cajas, la próxima abre igual.',
    'Cada venta dice cuántas cajas fueron, y el Excel lleva lo que pesaron vacías y llenas, para cuadrar con el cuaderno.',
    'Logo nuevo: el anillo del ciclo, del día 1 a la venta, con el pollito con el que empieza cada pollada.',
  ],
}

const KEY = 'avicontrol.novedades'

// «1.11.0» y «1.11.3» son la misma: los arreglos no traen nada que contar.
export const versionCorta = (v: string) => v.split('.').slice(0, 2).join('.')

/**
 * Si toca mostrar lo nuevo: solo a quien ya llevaba datos con una versión
 * anterior. Quien estrena la app no tiene nada que comparar.
 */
export function tocaNovedades(vistas: string | null, hayDatos: boolean, version = NOVEDADES.version): boolean {
  return hayDatos && vistas !== version
}

export function leerNovedadesVistas(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function marcarNovedadesVistas(version = NOVEDADES.version) {
  try {
    localStorage.setItem(KEY, version)
  } catch {
    // Sin almacenamiento se vuelve a mostrar la próxima vez: no pasa nada.
  }
}
