import { Component, type ReactNode } from 'react'
import { useRouteError } from 'react-router-dom'
import { leerRespaldo } from '../db/respaldo'
import { entregarArchivo, nombreRespaldo } from '../lib/respaldo'
import { hoyISO } from '../lib/format'
import { getSettings, saveSettings } from '../lib/settings'
import { Button } from './ui'

// El mismo respaldo de Ajustes, con los ajustes incluidos y el mismo camino
// para guardarlo. Aquí no hay avisos: la app está trabada, y si algo falla el
// productor ve que no bajó nada y puede volver a intentar.
async function respaldar() {
  try {
    const texto = await leerRespaldo(getSettings())
    const como = await entregarArchivo(
      new File([texto], nombreRespaldo(), { type: 'application/json' }),
    )
    if (como !== 'cancelado') saveSettings({ ultimoRespaldo: hoyISO() })
  } catch {
    // Sin base que leer no hay respaldo posible.
  }
}

export function PantallaError({ detalle }: { detalle?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10 safe-t">
      <h1 className="font-display text-2xl font-semibold leading-tight">
        La app se quedó trabada
      </h1>
      <p className="mt-2 text-base leading-relaxed text-ink-soft">
        Tus datos no se tocaron: siguen guardados en este teléfono. Guarda el respaldo por si acaso
        y vuelve a abrir.
      </p>

      <div className="mt-6 space-y-2">
        <Button block onClick={respaldar}>
          Guardar mi respaldo
        </Button>
        <Button block variant="soft" onClick={() => location.assign('/')}>
          Volver al inicio
        </Button>
      </div>

      {detalle && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-ink-faint">Detalle del error</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-line bg-paper-raised p-3 text-xs text-ink-soft">
            {detalle}
          </pre>
        </details>
      )}
    </div>
  )
}

// Mientras se baja la pantalla con que se abrió la app.
export function PantallaCargando() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-paper text-sm text-ink-faint">
      Cargando…
    </div>
  )
}

// React Router atrapa lo que revienta dentro de una ruta antes de que llegue al
// boundary de arriba, así que necesita el suyo propio.
export function ErrorDeRuta() {
  return <PantallaError detalle={detalle(useRouteError())} />
}

// `String(error)` deja «[object Object]» en todo lo que no sea un Error, que es
// justo cuando hace falta el detalle.
function detalle(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message
  if (error && typeof error === 'object') return JSON.stringify(error, null, 2)
  return String(error)
}

interface Estado {
  error?: Error
}

// Red de último recurso para lo que pase fuera del router.
export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = {}

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return <PantallaError detalle={error.stack ?? error.message} />
  }
}
