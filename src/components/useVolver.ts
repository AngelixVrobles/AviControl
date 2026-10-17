import { useLocation, useNavigate } from 'react-router-dom'

// «Volver» regresa a la pantalla de donde se vino, con su pestaña. Antes la
// ficha empujaba el ciclo otra vez, y el «Volver» del ciclo regresaba a la
// ficha: daba vueltas entre las dos. Si la pantalla se abrió directa —desde un
// enlace, o al abrir la app en ella— no hay de dónde se vino: va a `arriba`.
export function useVolver(arriba: string) {
  const nav = useNavigate()
  const { key } = useLocation()
  return () => (key !== 'default' ? nav(-1) : nav(arriba, { replace: true }))
}
