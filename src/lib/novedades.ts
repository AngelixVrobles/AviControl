// Lo nuevo de la versión, en palabras del productor. Sale una vez en Inicio
// después de actualizar: con la 1.10 llegaron siete cosas nuevas y no había
// forma de enterarse. En Ajustes se puede volver a ver.

export const NOVEDADES = {
  version: '1.12',
  cosas: [
    'Ganancia estimada en Dinero: lo que te queda al vender, con el alimento que falta por comprar, el pago de los empleados y los gastos que vienen.',
    'Si vendes el pollo arreglado, dilo en «Cómo vendes»: las cuentas van por libra arreglada, con el rinde y lo que cuesta arreglarlo.',
    'Te dice si a tu precio conviene más arreglarlo o venderlo en pie al pollero.',
    'Cada comprador con su precio: al escribir su nombre sale el de la última vez, y los precios que usas se tocan.',
    'Desde «Te deben» se corrige la venta: le cambias el precio y lo que falta se saca otra vez.',
    'El mejor día para vender cuenta el sueldo de cada día de más.',
    'Arreglar el pollo —gas, fundas, hielo— tiene su propia categoría de gasto.',
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
