import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import { Shell } from './components/Shell'
import { Dashboard } from './screens/Dashboard'
import { Lotes } from './screens/Lotes'
import { LoteDetail } from './screens/LoteDetail'
import { NuevoLote } from './screens/NuevoLote'
import { Reportes } from './screens/Reportes'
import { Ajustes } from './screens/Ajustes'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/lotes', element: <Lotes /> },
      { path: '/lotes/:id', element: <LoteDetail /> },
      { path: '/reportes', element: <Reportes /> },
      { path: '/ajustes', element: <Ajustes /> },
    ],
  },
  { path: '/lotes/nuevo', element: <NuevoLote /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
