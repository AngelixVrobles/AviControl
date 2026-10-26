import { registerSW } from 'virtual:pwa-register'

// La versión nueva de la app. Antes llegaba tarde y sin aviso: la app abierta
// seguía en la vieja, al volver a abrirla también, y después se recargaba sola
// al tocar una pantalla. Ahora, cuando llega, se avisa y se pone con un toque; y
// cada vez que se vuelve a la app se pregunta si hay una.

let hayNueva = false
let registro: ServiceWorkerRegistration | undefined
const oyentes = new Set<() => void>()

export function iniciarActualizaciones() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  registerSW({
    immediate: true,
    // La versión nueva ya está lista: en vez de recargar de golpe, se avisa.
    onNeedReload() {
      hayNueva = true
      oyentes.forEach((f) => f())
    },
    onRegisteredSW(_url, r) {
      registro = r
      // Una app que vuelve del fondo no preguntaba hasta que se cerraba del todo.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r?.update().catch(() => {})
      })
    },
  })
}

export const versionNueva = () => hayNueva

export function suscribirVersionNueva(f: () => void): () => void {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}

export function ponerVersionNueva() {
  window.location.reload()
}

/** Pregunta si hay una versión nueva; si la hay, el aviso sale solo cuando esté lista. */
export async function buscarActualizacion(): Promise<'nueva' | 'al-dia' | 'sin-conexion'> {
  if (hayNueva) return 'nueva'
  if (!registro) return 'al-dia'
  try {
    await registro.update()
  } catch {
    return 'sin-conexion'
  }
  return registro.installing || registro.waiting ? 'nueva' : 'al-dia'
}
