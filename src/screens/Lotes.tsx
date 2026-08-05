import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { motion } from 'motion/react'
import { LoteCard } from '../components/LoteCard'
import { Button, EmptyState } from '../components/ui'
import { IconPlus, IconPulso } from '../components/icons'
import { useResumen } from '../lib/hooks'

type Filtro = 'activo' | 'cerrado' | 'todos'

export function Lotes() {
  const [filtro, setFiltro] = useState<Filtro>('activo')
  const resumen = useResumen()

  const lista = (resumen ?? []).filter((r) =>
    filtro === 'todos' ? true : r.lote.estado === filtro,
  )

  return (
    <div className="animate-rise pt-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px] font-semibold">Ciclos</h1>
        <Link
          to="/lotes/nuevo"
          className="inline-flex items-center gap-1.5 rounded-full bg-green-action px-4 py-2.5 text-sm font-semibold text-paper-raised transition active:scale-95"
        >
          <IconPlus width={18} height={18} strokeWidth={2.2} />
          Nuevo
        </Link>
      </div>

      <div className="mt-4 flex gap-1 rounded-full bg-paper-sunken p-1">
        {(['activo', 'cerrado', 'todos'] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className="relative flex-1 rounded-full py-2.5 text-sm font-semibold"
          >
            {filtro === f && (
              <motion.span
                layoutId="filtro-activo"
                className="absolute inset-0 rounded-full bg-paper-raised shadow-card"
                transition={{ type: 'spring', stiffness: 500, damping: 42 }}
              />
            )}
            <span className={clsx('relative transition', filtro === f ? 'text-ink' : 'text-ink-faint')}>
              {f === 'activo' ? 'Activos' : f === 'cerrado' ? 'Cerrados' : 'Todos'}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {lista.length === 0 ? (
          <EmptyState
            icon={<IconPulso width={28} height={28} strokeWidth={2} />}
            title="Sin ciclos en esta vista"
            text="Cambia el filtro o crea un ciclo nuevo para empezar."
            action={
              <Link to="/lotes/nuevo">
                <Button>Nuevo lote</Button>
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
    </div>
  )
}
