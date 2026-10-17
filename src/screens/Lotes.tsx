import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LoteCard } from '../components/LoteCard'
import { Button, EmptyState, Pestanas, Seccion } from '../components/ui'
import { IconPlus, IconPulso } from '../components/icons'
import { useResumen } from '../lib/hooks'

type Filtro = 'activo' | 'cerrado' | 'todos'

export function Lotes() {
  const [filtro, setFiltro] = useState<Filtro>('activo')
  const todos = useResumen(filtro, { compartidos: true }) ?? []
  const lista = todos.filter((d) => !d.lote.compartido)
  const compartidos = todos.filter((d) => d.lote.compartido)

  return (
    <div className="animate-rise pt-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Ciclos</h1>
        <Link
          to="/lotes/nuevo"
          className="inline-flex items-center gap-1.5 rounded-full bg-forest-500 px-4 py-2.5 text-sm font-semibold text-paper-raised transition active:scale-95"
        >
          <IconPlus width={18} height={18} strokeWidth={2.2} />
          Nuevo
        </Link>
      </div>

      <Pestanas
        className="mt-4"
        etiqueta="Qué ciclos ver"
        valor={filtro}
        onCambio={setFiltro}
        opciones={[
          { id: 'activo', label: 'Activos' },
          { id: 'cerrado', label: 'Cerrados' },
          { id: 'todos', label: 'Todos' },
        ]}
      />

      <div className="mt-4 space-y-3">
        {lista.length === 0 && compartidos.length === 0 ? (
          <EmptyState
            icon={<IconPulso width={28} height={28} strokeWidth={2} />}
            title="Sin ciclos en esta vista"
            text="Cambia el filtro o crea un ciclo nuevo para empezar."
            action={
              <Link to="/lotes/nuevo">
                <Button>Nuevo ciclo</Button>
              </Link>
            }
          />
        ) : (
          lista.map((d, i) => (
            <div key={d.lote.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <LoteCard data={d} />
            </div>
          ))
        )}
      </div>

      {compartidos.length > 0 && (
        <>
          <Seccion
            className="mb-3 mt-8"
            etiqueta="Compartidos contigo"
            nota="Ciclos que te mandó un socio: los ves, no los cambias, y no entran en tus cuentas."
          />
          <div className="space-y-3">
            {compartidos.map((d) => (
              <LoteCard key={d.lote.id} data={d} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
