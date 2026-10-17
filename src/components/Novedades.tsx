import { useState } from 'react'
import { NOVEDADES } from '../lib/novedades'
import { num } from '../lib/format'

// Lo nuevo de esta versión, en una lista. En Inicio va corta, para no empujar
// el registro del día fuera de la pantalla: tres y el resto a un toque.
export function ListaNovedades({ corta = false }: { corta?: boolean }) {
  const [todas, setTodas] = useState(!corta)
  const visibles = todas ? NOVEDADES.cosas : NOVEDADES.cosas.slice(0, 3)
  const faltan = NOVEDADES.cosas.length - visibles.length
  return (
    <>
      <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
        {visibles.map((c) => (
          <li key={c} className="flex gap-2">
            <span aria-hidden className="text-forest-600">
              •
            </span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
      {faltan > 0 && (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="-mx-2 mt-1 px-2 py-3 text-sm font-medium text-forest-600"
        >
          Ver {faltan === 1 ? 'la otra' : `las otras ${num(faltan)}`} →
        </button>
      )}
    </>
  )
}
