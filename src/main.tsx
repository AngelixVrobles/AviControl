import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import { ErrorBoundary, ErrorDeRuta, PantallaCargando } from './components/ErrorBoundary'
import { Shell } from './components/Shell'
import { Dashboard } from './screens/Dashboard'
import { Lotes } from './screens/Lotes'

// Inicio y Ciclos van en el paquete de entrada; las demás pantallas se bajan
// cuando se abren. Antes la app entera —765 kB— tenía que llegar antes de
// mostrar nada, y con poca señal se notaba. Con la app instalada todo queda
// guardado en el teléfono y se abre igual sin internet.
//
// Si tras una actualización el pedazo que se pide ya no existe en el servidor,
// se recarga una vez, directo en la pantalla que se pidió, para traer la versión
// nueva en lugar de mostrar el error.
const RECARGADO = 'avicontrol.recargado'
function pantalla<T>(cargar: () => Promise<T>, elegir: (m: T) => ComponentType) {
  return async () => {
    try {
      const m = await cargar()
      sessionStorage.removeItem(RECARGADO)
      return { Component: elegir(m) }
    } catch (e) {
      if (!sessionStorage.getItem(RECARGADO)) {
        sessionStorage.setItem(RECARGADO, '1')
        const destino = destinoPendiente()
        if (destino) location.assign(destino)
        else location.reload()
        return new Promise<never>(() => {})
      }
      throw e
    }
  }
}

// Mientras se baja la pantalla, el router todavía muestra la anterior y la
// dirección no ha cambiado: el destino está en la navegación pendiente. En la
// primera carga no hay navegación pendiente: la dirección ya es la de destino.
function destinoPendiente(): string | null {
  try {
    const l = router.state.navigation.location
    return l ? l.pathname + l.search + l.hash : null
  } catch {
    return null
  }
}

const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: <ErrorDeRuta />,
    // Al abrir la app directo en una pantalla que se baja aparte, mientras llega.
    hydrateFallbackElement: <PantallaCargando />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/lotes', element: <Lotes /> },
      {
        path: '/lotes/:id',
        lazy: pantalla(() => import('./screens/LoteDetail'), (m) => m.LoteDetail),
      },
      {
        path: '/lotes/:id/ficha/:tipo',
        lazy: pantalla(() => import('./screens/fichas'), (m) => m.Ficha),
      },
      { path: '/reportes', lazy: pantalla(() => import('./screens/Reportes'), (m) => m.Reportes) },
      { path: '/deudas', lazy: pantalla(() => import('./screens/Deudas'), (m) => m.Deudas) },
      { path: '/ajustes', lazy: pantalla(() => import('./screens/Ajustes'), (m) => m.Ajustes) },
    ],
  },
  {
    path: '/lotes/nuevo',
    lazy: pantalla(() => import('./screens/NuevoLote'), (m) => m.NuevoLote),
    errorElement: <ErrorDeRuta />,
    hydrateFallbackElement: <PantallaCargando />,
  },
])

// Que el navegador no borre la base cuando le falte espacio: la granja entera
// vive aquí y no hay copia en internet. Con la app instalada se concede sin
// preguntar; si no, queda como estaba.
navigator.storage
  ?.persisted?.()
  .then((ya) => ya || navigator.storage.persist())
  .catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
