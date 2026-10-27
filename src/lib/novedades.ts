// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.14',
  cosas: [
    'Cada compra de alimento lleva el nombre del saco —«Mega Broiler Crecimiento»— y la app saca de ahí si es pre-inicio, iniciador, crecimiento o engorde. Si no lo adivina, tocas cuál es.',
    'Los sacos se dan en orden: se acaba uno y sigue el próximo. Hoy dice qué alimento le estás dando, para cuántos días alcanza y cuál sigue; el registro del día lo trae puesto y lo cambias con «Cambiar».',
    'Lo que falta por comprar se cuenta del tipo que toca y a lo último que pagaste por él: el engorde ya no sale al precio del pre-inicio. La ficha de Alimento lo junta por tipo.',
    'Punto de venta compara el mejor día con el día de venta que elegiste, y dice cuánto va de uno a otro.',
    'Fechas como «3 nov», montos como «156 mil» y el alimento en quintales (qq) en toda la app. La letra más chica es un poco más grande.',
    'Fuera de Hoy, los avisos del ciclo van en un renglón; Dinero tiene un índice arriba para ir a cada parte.',
    'La imagen para WhatsApp pone tu granja primero y la ganancia estimada en grande, y el PDF de un ciclo en curso ya no muestra una pérdida que no es.',
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
