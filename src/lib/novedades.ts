// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.17',
  cosas: [
    'Un ciclo cerrado se corrige completo, sin reabrirlo: en «Corregir el ciclo» también va la fecha de cierre —el que decía que duró 64 días queda con lo que duró—, y en Dinero se anotan el día, la venta o el gasto que faltaron.',
    'Si en un ciclo cerrado las aves no dan —las que entraron contra las que murieron y se vendieron—, la app lo dice, y con «Cuadrar» las que faltan se reparten en las ventas según sus libras.',
    'En Dinero, «A cada precio»: cuántos pollos se vendieron a cada precio —al camión por libra, a la gente por unidad o arreglado— y lo que dejó cada uno.',
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
