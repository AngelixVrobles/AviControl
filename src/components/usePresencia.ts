import { useEffect, useRef, useState, type PointerEvent } from 'react'

// Lo que se va con animación sigue en la página hasta terminar de irse. Antes
// lo hacía una librería de animaciones de 122 kB, la mitad del peso de la app
// para tres cosas que el CSS ya sabe hacer.
export function usePresencia(abierto: boolean, ms: number) {
  const [montado, setMontado] = useState(abierto)
  if (abierto && !montado) setMontado(true)
  useEffect(() => {
    if (abierto) return
    const t = window.setTimeout(() => setMontado(false), ms)
    return () => clearTimeout(t)
  }, [abierto, ms])
  return { montado: montado || abierto, saliendo: !abierto && montado }
}

// Bajar la hoja desde el asa o el título la cierra; si no se baja lo
// suficiente, vuelve a su lugar. La hoja sigue al dedo con freno, como antes.
export function useArrastreHoja(abierto: boolean, onClose: () => void) {
  const [dy, setDy] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  const toque = useRef<{ id: number; y0: number; y: number; t: number; v: number } | null>(null)

  // Al volver a abrirse empieza en su lugar, no donde quedó al cerrarla.
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    if (abierto) setDy(0)
  }

  function fin(e: PointerEvent<HTMLElement>, cancelado: boolean) {
    const t = toque.current
    if (!t || t.id !== e.pointerId) return
    toque.current = null
    setArrastrando(false)
    const bajo = e.clientY - t.y0
    // Cerrada, se queda donde la soltó y desde ahí baja: no salta arriba.
    if (!cancelado && (bajo > 90 || t.v > 600)) onClose()
    else setDy(0)
  }

  const manejadores = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      toque.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0 }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setArrastrando(true)
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const t = toque.current
      if (!t || t.id !== e.pointerId) return
      const dt = e.timeStamp - t.t
      if (dt > 0) t.v = ((e.clientY - t.y) / dt) * 1000
      t.y = e.clientY
      t.t = e.timeStamp
      setDy(Math.max(0, e.clientY - t.y0) * 0.6)
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => fin(e, false),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => fin(e, true),
  }

  return { dy, arrastrando, manejadores }
}
