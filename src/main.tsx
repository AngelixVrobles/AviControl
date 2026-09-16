import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import { ErrorBoundary, ErrorDeRuta } from './components/ErrorBoundary'
import { Shell } from './components/Shell'
import { Dashboard } from './screens/Dashboard'
import { Lotes } from './screens/Lotes'
import { LoteDetail } from './screens/LoteDetail'
import { Ficha } from './screens/fichas'
import { NuevoLote } from './screens/NuevoLote'
import { Reportes } from './screens/Reportes'
import { Ajustes } from './screens/Ajustes'
import { Deudas } from './screens/Deudas'

const router = createBrowserRouter([
  {
    element: <Shell />,
    errorElement: <ErrorDeRuta />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/lotes', element: <Lotes /> },
      { path: '/lotes/:id', element: <LoteDetail /> },
      { path: '/lotes/:id/ficha/:tipo', element: <Ficha /> },
      { path: '/reportes', element: <Reportes /> },
      { path: '/deudas', element: <Deudas /> },
      { path: '/ajustes', element: <Ajustes /> },
    ],
  },
  { path: '/lotes/nuevo', element: <NuevoLote />, errorElement: <ErrorDeRuta /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
