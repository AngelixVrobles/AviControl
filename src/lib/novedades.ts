// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.13',
  cosas: [
    'Tú decides a los cuántos días vendes: en Dinero, «Cambiar el día». El alimento que falta, el pago de los empleados y la ganancia estimada se cuentan hasta ese día. En Ajustes queda para todos los ciclos.',
    'En Android, el botón Atrás cierra la hoja abierta en vez de sacarte del ciclo.',
    'En Android el respaldo ya sale por WhatsApp o Drive: llega como .txt y se restaura igual.',
    'Antes de restaurar se dice de cuándo es el respaldo, con el año. Si no era ese, «Volver a eso» en Ajustes trae lo que tenías.',
    'Cuando hay una versión nueva, un aviso abajo la pone con un toque, cuando tú quieras.',
    'En el iPhone, Inicio explica cómo instalar la app: instalada, Safari no le borra los datos.',
    'Pasar alimento entre ciclos con socios distintos dice quién lo pone y quién se lo queda. Y las bajas ya no pasan de las aves que quedan después de vender.',
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
