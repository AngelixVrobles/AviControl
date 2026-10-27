import { useState } from 'react'
import { clsx } from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, useNavigate } from 'react-router-dom'
import { IconChart, IconGear, IconHome, IconLapiz, IconPollito } from './icons'
import { Sheet } from './ui'
import { db, type Lote } from '../db/schema'
import { diasEntre } from '../lib/format'
import { nombreGalpon } from '../lib/galpones'
import { useHoy, useLotes, useSettings } from '../lib/hooks'

const items = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/lotes', label: 'Ciclos', Icon: IconPollito, end: false },
  { to: '/reportes', label: 'Reportes', Icon: IconChart, end: false },
  { to: '/ajustes', label: 'Ajustes', Icon: IconGear, end: false },
]

export function BottomNav() {
  const nav = useNavigate()
  const activos = useLotes('activo')
  const [elegir, setElegir] = useState(false)

  function registrar() {
    if (!activos?.length) return nav('/lotes/nuevo')
    if (activos.length === 1) return nav(`/lotes/${activos[0].id}?reg=1`)
    // Con dos ciclos o más se pregunta en cuál. Antes llevaba a la lista, y
    // había que abrir el ciclo y buscar dónde se anotaba el día.
    setElegir(true)
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper safe-b">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-1 pt-1.5">
        {items.slice(0, 2).map((it) => (
          <Tab key={it.to} {...it} />
        ))}
        <div className="flex flex-col items-center">
          <button
            onClick={registrar}
            className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-forest-600 text-paper-raised shadow-pop transition active:scale-90"
            aria-label="Registrar día"
          >
            <IconLapiz width={24} height={24} />
          </button>
          <span className="-mt-1.5 text-xs font-semibold text-forest-600">Registrar</span>
        </div>
        {items.slice(2).map((it) => (
          <Tab key={it.to} {...it} />
        ))}
      </div>
      <ElegirCiclo
        open={elegir}
        lotes={activos ?? []}
        onClose={() => setElegir(false)}
        onElegir={(id) => {
          setElegir(false)
          nav(`/lotes/${id}?reg=1`)
        }}
      />
    </nav>
  )
}

function ElegirCiclo({
  open,
  lotes,
  onClose,
  onElegir,
}: {
  open: boolean
  lotes: Lote[]
  onClose: () => void
  onElegir: (id: number) => void
}) {
  const hoy = useHoy()
  const settings = useSettings()
  // Cuáles ya tienen el día de hoy: el que falta es casi siempre el que se busca.
  const anotados = useLiveQuery(
    async () =>
      open
        ? new Set(
            (await db.registros.where('fecha').equals(hoy).toArray()).filter((r) => !r.soloPeso).map((r) => r.loteId),
          )
        : new Set<number>(),
    [open, hoy],
  )
  return (
    <Sheet open={open} onClose={onClose} title="¿En cuál ciclo anotas?">
      <div className="space-y-2">
        {lotes.map((l) => {
          const listo = anotados?.has(l.id)
          const galpon = nombreGalpon(l, settings)
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onElegir(l.id)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl2 border border-line bg-paper-raised p-4 text-left transition active:scale-[0.98]"
            >
              <div className="min-w-0">
                <div className="truncate font-display text-base font-semibold">{l.nombre}</div>
                <div className="truncate text-sm text-ink-soft tnum">
                  Día {diasEntre(l.fechaInicio, hoy)}
                  {galpon ? ` · ${galpon}` : ''}
                </div>
              </div>
              <span
                className={clsx(
                  'shrink-0 text-sm font-medium',
                  listo ? 'text-forest-600' : 'text-amber-text',
                )}
              >
                {listo ? 'Hoy ya está' : 'Falta hoy'}
              </span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

function Tab({
  to,
  label,
  Icon,
  end,
}: {
  to: string
  label: string
  Icon: typeof IconHome
  end: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'flex flex-col items-center gap-1 py-2 text-xs font-medium transition',
          isActive ? 'text-forest-600' : 'text-ink-faint',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            width={23}
            height={23}
            strokeWidth={2}
            className={clsx('transition-transform', isActive && 'scale-110')}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}
