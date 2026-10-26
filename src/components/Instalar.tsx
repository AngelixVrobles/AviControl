import { useState, useSyncExternalStore } from 'react'
import { avisoCallado, callarAviso, comoInstalar, instalar, suscribirInstalacion } from '../lib/instalar'

// El aviso para instalar la app. En el iPhone es lo que cuida los datos: Safari
// los borra si pasan siete días sin abrirla. Quien ya tiene datos lo sabe antes
// de instalar: la app instalada empieza vacía y se llena con un respaldo.
export function AvisoInstalar({ hayDatos }: { hayDatos: boolean }) {
  const como = useSyncExternalStore(suscribirInstalacion, comoInstalar)
  const [callado, setCallado] = useState(avisoCallado)
  if (!como || callado) return null
  return (
    <section className="mt-6 rounded-xl2 border border-forest-200 bg-forest-50 p-4">
      <h2 className="font-display text-base font-semibold text-forest-800">Instala la app en tu teléfono</h2>
      <p className="mt-1 text-sm leading-relaxed text-forest-800">
        {como === 'ios'
          ? 'Toca Compartir y después «Añadir a pantalla de inicio». En Safari, si pasas una semana sin abrirla, el iPhone puede borrar tus datos; instalada no.'
          : 'Abre más rápido, funciona sin internet y tus datos quedan guardados con ella.'}
        {como === 'ios' && hayDatos
          ? ' La app instalada empieza vacía: haz un respaldo aquí y restáuralo allá, en Ajustes.'
          : ''}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {como === 'boton' && (
          <button
            type="button"
            onClick={() => instalar()}
            className="h-11 rounded-full bg-forest-500 px-5 text-sm font-semibold text-paper-raised transition active:scale-95"
          >
            Instalar
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            callarAviso()
            setCallado(true)
          }}
          className="h-11 rounded-full px-4 text-sm font-semibold text-forest-700"
        >
          Ahora no
        </button>
      </div>
    </section>
  )
}
