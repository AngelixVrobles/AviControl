import { useEffect, useState } from 'react'
import { Button, DangerButton, Sheet } from './ui'

interface Opciones {
  titulo: string
  mensaje?: string
  confirmar?: string
  peligro?: boolean
}

let mostrar: ((o: Opciones) => Promise<boolean>) | null = null

export function confirmar(o: Opciones): Promise<boolean> {
  return mostrar ? mostrar(o) : Promise.resolve(window.confirm(o.mensaje ?? o.titulo))
}

export function ConfirmHost() {
  const [estado, setEstado] = useState<{ o: Opciones; resolver: (v: boolean) => void } | null>(null)

  useEffect(() => {
    mostrar = (o) => new Promise((resolver) => setEstado({ o, resolver }))
    return () => {
      mostrar = null
    }
  }, [])

  function cerrar(valor: boolean) {
    estado?.resolver(valor)
    setEstado(null)
  }

  const o = estado?.o
  return (
    <Sheet open={!!estado} onClose={() => cerrar(false)} title={o?.titulo ?? ''}>
      <div className="space-y-4">
        {o?.mensaje && <p className="text-[15px] leading-relaxed text-ink-soft">{o.mensaje}</p>}
        {o?.peligro ? (
          <>
            <DangerButton onClick={() => cerrar(true)}>{o?.confirmar ?? 'Eliminar'}</DangerButton>
            <Button block variant="soft" onClick={() => cerrar(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button block onClick={() => cerrar(true)}>
              {o?.confirmar ?? 'Confirmar'}
            </Button>
            <Button block variant="ghost" onClick={() => cerrar(false)}>
              Cancelar
            </Button>
          </>
        )}
      </div>
    </Sheet>
  )
}
