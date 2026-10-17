import { useCallback, useEffect, useRef, useState } from 'react'

// Un toque, un guardado. El botón queda bloqueado desde el primer toque hasta
// que la hoja se vuelve a abrir: mientras se cierra sigue en pantalla un
// momento, y un segundo toque ahí guardaba otra vez —dos ciclos iguales, el
// mismo día anotado dos veces con las bajas y el alimento contados doble—.
// Si guardar falla, o la función devuelve `false` porque no guardó, el botón
// se libera para intentar de nuevo.
export function useEnvio(abierta = true) {
  const usado = useRef(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!abierta) return
    usado.current = false
    setOcupado(false)
  }, [abierta])

  const enviar = useCallback(
    (f: () => Promise<unknown>) => async () => {
      if (usado.current) return
      usado.current = true
      setOcupado(true)
      const liberar = () => {
        usado.current = false
        setOcupado(false)
      }
      try {
        if ((await f()) === false) liberar()
      } catch (e) {
        liberar()
        throw e
      }
    },
    [],
  )

  return { ocupado, enviar }
}
