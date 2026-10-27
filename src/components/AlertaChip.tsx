import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { Alerta } from '../lib/alerts'
import { IconAlerta, IconVacuna } from './icons'

const tonos = {
  bad: 'border-clay-line border-l-4 border-l-clay bg-clay-tint text-clay-text',
  warn: 'border-amber-line border-l-4 border-l-amber-400 bg-amber-tint text-amber-text',
  info: 'border-forest-100 border-l-4 border-l-forest-500 bg-forest-50 text-forest-700',
}

export function AlertaChip({
  alerta,
  titulo,
  to,
  mas,
  onClick,
}: {
  alerta: Alerta
  titulo?: string
  to?: string
  /** En un renglón, con cuántos avisos más hay detrás: para fuera de Hoy. */
  mas?: number
  onClick?: () => void
}) {
  const Icono = alerta.nivel === 'info' ? IconVacuna : IconAlerta
  const resumen = mas != null
  const cls = clsx(
    'flex items-center gap-2.5 rounded-xl border px-3.5 text-sm font-medium',
    resumen ? 'w-full py-2 text-left' : 'py-2.5',
    tonos[alerta.nivel],
  )
  const contenido = (
    <>
      <Icono width={17} height={17} strokeWidth={2} aria-hidden className="shrink-0" />
      <span className={clsx('min-w-0 flex-1', resumen && 'truncate')}>
        {titulo && <span className="font-semibold">{titulo}: </span>}
        {alerta.texto}
      </span>
      {resumen && mas > 0 && <span className="shrink-0 font-semibold tnum">+{mas}</span>}
    </>
  )
  return to ? (
    <Link to={to} className={clsx(cls, 'transition active:scale-[0.985]')}>
      {contenido}
    </Link>
  ) : onClick ? (
    <button type="button" onClick={onClick} className={clsx(cls, 'transition active:scale-[0.985]')}>
      {contenido}
    </button>
  ) : (
    <div className={cls}>{contenido}</div>
  )
}
