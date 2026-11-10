// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.18',
  cosas: [
    'El peso al vender es el que paga el pollero: si en tus polladas cerradas pesaste en los 10 días antes de vender, la app aprende cuánto da de más tu báscula —las que se dejan agarrar, el ayuno antes de cargar— y lo descuenta. Las aves que salen del peso de una venta también cuadran mejor.',
    'Las bajas que faltan hasta la venta van al ritmo de tu lote esta semana y de tus polladas cerradas con el pollo grande, no al 0.09 % por día de cualquier granja. En Estimado dice cuántas aves llegan a la venta.',
    'La ganancia estimada cuenta lo que sueles vender aparte —por unidad o arreglado, a mejor precio—, como en tus polladas cerradas, y el precio mínimo del pollero baja con eso.',
    'Los campos en que escribes, el precio elegido y la barra del pesaje se ven mejor al sol.',
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
