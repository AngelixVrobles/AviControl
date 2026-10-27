import { useEffect, useSyncExternalStore } from 'react'
import { Outlet, useBlocker, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { ConfirmHost, ToastHost } from './confirm'
import { cerrarHojaDeArriba, hayHojaAbierta, suscribirHojas } from './hojasAbiertas'
import { ponerVersionNueva, suscribirVersionNueva, versionNueva } from '../lib/actualizacion'

export function Shell() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper sm:border-x sm:border-line">
      <main
        key={pathname}
        className="flex-1 px-5 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>
      <BottomNav />
      <ConfirmHost />
      <ToastHost />
      <AtrasCierraLaHoja />
      <AvisoVersionNueva />
    </div>
  )
}

// Llegó una versión nueva: se pone con un toque, cuando el productor quiera.
function AvisoVersionNueva() {
  const hay = useSyncExternalStore(suscribirVersionNueva, versionNueva)
  if (!hay) return null
  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-4"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      <div
        role="status"
        className="flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink py-2 pl-4 pr-2 text-sm text-paper-raised shadow-pop"
      >
        <span>Hay una versión nueva de la app.</span>
        <button
          type="button"
          onClick={ponerVersionNueva}
          className="h-11 shrink-0 rounded-full bg-forest-600 px-4 font-semibold text-paper-raised"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}

// Con una hoja abierta, el botón Atrás del teléfono la cierra y se queda en la
// pantalla, como en cualquier app. Antes salía de la pantalla con la hoja.
function AtrasCierraLaHoja() {
  const abierta = useSyncExternalStore(suscribirHojas, hayHojaAbierta)
  const blocker = useBlocker(({ historyAction }) => abierta && historyAction === 'POP')
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    cerrarHojaDeArriba()
    blocker.reset()
  }, [blocker])
  return null
}
