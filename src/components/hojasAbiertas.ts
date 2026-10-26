// Las hojas abiertas, la última arriba. El botón Atrás del teléfono cierra la
// de arriba en vez de salir de la pantalla: antes, con la hoja del día a medio
// llenar, Atrás sacaba del ciclo y llevaba a Inicio.

type Hoja = { cerrar: () => void }

let pila: Hoja[] = []
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((f) => f())

/** Anota una hoja que se abrió; lo que devuelve la quita al cerrarse. */
export function registrarHoja(cerrar: { current: () => void }): () => void {
  const hoja: Hoja = { cerrar: () => cerrar.current() }
  pila = [...pila, hoja]
  avisar()
  return () => {
    pila = pila.filter((h) => h !== hoja)
    avisar()
  }
}

export const hayHojaAbierta = () => pila.length > 0

export function cerrarHojaDeArriba() {
  pila[pila.length - 1]?.cerrar()
}

export function suscribirHojas(f: () => void): () => void {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}
