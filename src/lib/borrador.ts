// Borrador del pesaje. Los pesos se guardan en el teléfono a medida que se
// anotan: pesar 40 o 60 aves toma un rato con el ave en la mano, y si la hoja se
// cierra —un toque fuera, el sistema que mata la app, una llamada— lo pesado no
// se puede repetir. El borrador se borra solo al guardar el pesaje.

export interface BorradorPesaje {
  fecha: string
  pesos: number[]
  actualizado: number
}

const clave = (loteId: number, pesajeId?: number) =>
  `avicontrol.pesaje.${loteId}${pesajeId != null ? `.${pesajeId}` : ''}`

export function leerBorrador(loteId: number, pesajeId?: number): BorradorPesaje | null {
  try {
    const raw = localStorage.getItem(clave(loteId, pesajeId))
    if (!raw) return null
    const b = JSON.parse(raw)
    if (!b || typeof b.fecha !== 'string' || !Array.isArray(b.pesos)) return null
    const pesos = b.pesos.filter((p: unknown): p is number => typeof p === 'number' && p > 0 && Number.isFinite(p))
    if (!pesos.length) return null
    return { fecha: b.fecha, pesos, actualizado: Number(b.actualizado) || 0 }
  } catch {
    return null
  }
}

export function guardarBorrador(
  loteId: number,
  pesajeId: number | undefined,
  datos: { fecha: string; pesos: number[] },
) {
  try {
    if (!datos.pesos.length) localStorage.removeItem(clave(loteId, pesajeId))
    else
      localStorage.setItem(
        clave(loteId, pesajeId),
        JSON.stringify({ fecha: datos.fecha, pesos: datos.pesos, actualizado: Date.now() }),
      )
  } catch {
    // Sin espacio o en modo privado: el pesaje sigue en memoria mientras la hoja
    // esté abierta, que es lo que había antes.
  }
}

export function borrarBorrador(loteId: number, pesajeId?: number) {
  try {
    localStorage.removeItem(clave(loteId, pesajeId))
  } catch {
    // Nada que hacer: un borrador que no se pudo borrar solo vuelve a aparecer.
  }
}

// Un peso que se aparta a la mitad o al doble de la mediana casi siempre es un
// dedazo (42 en vez de 4.2) y no un ave rara: se marca para que se revise antes
// de que arrastre el promedio. Con menos de cinco pesos no hay mediana que valga.
export function pesoSospechoso(peso: number, pesos: number[]): boolean {
  if (pesos.length < 5) return false
  const orden = [...pesos].sort((a, b) => a - b)
  const mitad = Math.floor(orden.length / 2)
  const mediana = orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2
  return mediana > 0 && (peso > mediana * 1.5 || peso < mediana * 0.5)
}
