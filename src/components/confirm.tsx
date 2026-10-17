import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, DangerButton, Sheet } from './ui'
import { usePresencia } from './usePresencia'

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

let mostrarToast: ((m: string) => void) | null = null

// Aviso breve, sin botones, que se va solo. Reemplaza los alert() del sistema
// que rompen la ilusión de app nativa.
export function toast(mensaje: string) {
  if (mostrarToast) mostrarToast(mensaje)
  else window.alert(mensaje)
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  // Mientras se va, sigue diciendo lo último que dijo.
  const [visto, setVisto] = useState<string | null>(null)
  if (msg && msg !== visto) setVisto(msg)
  const { montado, saliendo } = usePresencia(!!msg, 200)

  useEffect(() => {
    let t = 0
    mostrarToast = (m) => {
      setMsg(m)
      clearTimeout(t)
      t = window.setTimeout(() => setMsg(null), 2800)
    }
    return () => {
      mostrarToast = null
      clearTimeout(t)
    }
  }, [])

  if (!montado) return null
  return createPortal(
    <div
      aria-hidden={saliendo || undefined}
      className="animate-aviso pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-5 transition-[opacity,transform] duration-200"
      style={{
        bottom: 'calc(6rem + env(safe-area-inset-bottom))',
        ...(saliendo ? { opacity: 0, transform: 'translateY(12px)' } : {}),
      }}
    >
      <div
        role="status"
        className="max-w-[22rem] rounded-2xl bg-ink px-4 py-3 text-center text-sm font-medium text-paper-raised shadow-pop"
      >
        {msg ?? visto}
      </div>
    </div>,
    document.body,
  )
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
        {o?.mensaje && <p className="text-base leading-relaxed text-ink-soft">{o.mensaje}</p>}
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
