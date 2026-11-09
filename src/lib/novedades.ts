// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.16',
  cosas: [
    'El estimado de cada pollada aprende de tus polladas cerradas: si tu granja vende al 76 % del peso Cobb, un pesaje de los 28 días ya no se estira con la curva hasta la venta. Usa todos los pesajes, no solo el último, y le cree más a los que tienen más aves.',
    'El peso al vender y la ganancia salen con su rango —«entre 5.5 y 6.6 lb», «puede quedar entre…»—, 8 de cada 10 veces, en Dinero.',
    'La app dice cuántas aves pesar según lo desparejo del lote, cuándo —unos 3 días antes de vender— y cómo escogerlas, y cuánto se afina el estimado con eso.',
    'Al cerrar, lo que falta del pago de los empleados se anota como gasto: la ganancia del cierre es la de verdad.',
    'Un ciclo cerrado se corrige sin reabrirlo: «Anotar un gasto que faltó» en Dinero, y si quedó sin anotar el pago de los empleados, se anota con un toque.',
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
