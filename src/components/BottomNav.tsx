import { clsx } from 'clsx'
import { NavLink, useNavigate } from 'react-router-dom'
import { IconChart, IconFlock, IconGear, IconHome, IconPlus } from './icons'

const items = [
  { to: '/', label: 'Inicio', Icon: IconHome, end: true },
  { to: '/lotes', label: 'Lotes', Icon: IconFlock, end: false },
  { to: '/reportes', label: 'Reportes', Icon: IconChart, end: false },
  { to: '/ajustes', label: 'Ajustes', Icon: IconGear, end: false },
]

export function BottomNav() {
  const nav = useNavigate()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/85 backdrop-blur-xl safe-b">
      <div className="mx-auto grid max-w-md grid-cols-5 items-center px-2">
        {items.slice(0, 2).map((it) => (
          <Tab key={it.to} {...it} />
        ))}
        <div className="flex justify-center">
          <button
            onClick={() => nav('/lotes/nuevo')}
            className="grid h-14 w-14 -translate-y-4 place-items-center rounded-full bg-forest-600 text-paper-raised shadow-pop transition active:scale-90"
            aria-label="Nuevo lote"
          >
            <IconPlus width={26} height={26} strokeWidth={2.2} />
          </button>
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
          'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition',
          isActive ? 'text-forest-600' : 'text-ink-faint',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            width={23}
            height={23}
            strokeWidth={1.9}
            className={clsx('transition-transform', isActive && 'scale-110')}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}
