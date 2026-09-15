import { Component, type ReactNode } from 'react'
import { useRouteError } from 'react-router-dom'
import { db } from '../db/schema'
import { hoyISO } from '../lib/format'
import { Button } from './ui'

async function respaldar() {
  const [lotes, registros, gastos, ingresos, pesajes, aplicaciones] = await Promise.all([
    db.lotes.toArray(),
    db.registros.toArray(),
    db.gastos.toArray(),
    db.ingresos.toArray(),
    db.pesajes.toArray(),
    db.aplicaciones.toArray(),
  ])
  const blob = new Blob(
    [JSON.stringify({ version: 2, lotes, registros, gastos, ingresos, pesajes, aplicaciones }, null, 2)],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `avicontrol-respaldo-${hoyISO()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function PantallaError({ detalle }: { detalle?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10 safe-t">
      <h1 className="font-display text-[26px] font-semibold leading-tight">
        La app se quedó trabada
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Tus datos no se tocaron: siguen guardados en este teléfono. Baja el respaldo por si acaso y
        vuelve a abrir.
      </p>

      <div className="mt-6 space-y-2">
        <Button block onClick={respaldar}>
          Descargar mi respaldo
        </Button>
        <Button block variant="soft" onClick={() => location.assign('/')}>
          Volver al inicio
        </Button>
      </div>

      {detalle && (
        <details className="mt-8">
          <summary className="cursor-pointer text-[13px] text-ink-faint">Detalle del error</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl border border-line bg-paper-raised p-3 text-[11px] text-ink-soft">
            {detalle}
          </pre>
        </details>
      )}
    </div>
  )
}

// React Router atrapa lo que revienta dentro de una ruta antes de que llegue al
// boundary de arriba, así que necesita el suyo propio.
export function ErrorDeRuta() {
  const error = useRouteError()
  return <PantallaError detalle={error instanceof Error ? error.message : String(error)} />
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
    return <PantallaError detalle={error.message} />
  }
}
