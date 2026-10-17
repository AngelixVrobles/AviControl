// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.11',
  cosas: [
    'Una pollada en varios galpones: si de grandes no caben, pasa parte a otro galpón desde la ficha Galpón y sigue siendo el mismo ciclo.',
    'Un aviso dice cuándo un galpón no aguanta sus aves al peso de venta.',
    'Las bajas del día se escriben con el teclado, y puedes anotar de qué murieron.',
    'La venta saca el total con el precio por libra.',
    'Con varios ciclos, Registrar pregunta en cuál anotas.',
    'El alimento que sobró pasa al siguiente ciclo con su costo.',
    'Reportes por galpón, y gas y luz, y cama, como gastos aparte.',
    'Se lee mejor al sol y en teléfonos chicos.',
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
