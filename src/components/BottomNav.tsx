import { clsx } from 'clsx'
import { NavLink, useNavigate } from 'react-router-dom'
import { IconChart, IconGear, IconHome, IconLapiz, IconPulso } from './icons'
import { useLotes } from '../lib/hooks'

const items = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/lotes', label: 'Ciclos', Icon: IconPulso, end: false },
  { to: '/reportes', label: 'Reportes', Icon: IconChart, end: false },
  { to: '/ajustes', label: 'Ajustes', Icon: IconGear, end: false },
]

export function BottomNav() {
  const nav = useNavigate()
  const activos = useLotes('activo')

  function registrar() {
    if (!activos?.length) return nav('/lotes/nuevo')
    if (activos.length === 1) return nav(`/lotes/${activos[0].id}?reg=1`)
    nav('/lotes?reg=1')
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 backdrop-blur-xl safe-b">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-1 pt-1.5">
        {items.slice(0, 2).map((it) => (
          <Tab key={it.to} {...it} />
        ))}
        <div className="flex flex-col items-center">
          <button
            onClick={registrar}
            className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-green-action text-paper-raised shadow-pop transition active:scale-90"
            aria-label="Registrar día"
          >
            <IconLapiz width={24} height={24} />
          </button>
          <span className="-mt-1.5 text-[11px] font-semibold text-forest-600">Registrar</span>
        </div>
        {items.slice(2).map((it) => (
          <Tab key={it.to} {...it} />
        ))}
      </div>
    </nav>
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
          'flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition',
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
