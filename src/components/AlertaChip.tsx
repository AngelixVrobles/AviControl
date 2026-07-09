import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { Alerta } from '../lib/alerts'
import { IconAlerta, IconVacuna } from './icons'

const tonos = {
  bad: 'border-clay/30 bg-clay/10 text-clay-deep',
  warn: 'border-amber-500/30 bg-amber-400/10 text-amber-700',
  info: 'border-forest-400/30 bg-forest-50 text-forest-700',
}

export function AlertaChip({
  alerta,
  titulo,
  to,
}: {
  alerta: Alerta
  titulo?: string
  to?: string
}) {
  const Icono = alerta.nivel === 'info' ? IconVacuna : IconAlerta
  const cls = clsx(
    'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium',
    tonos[alerta.nivel],
  )
  const contenido = (
    <>
      <Icono width={17} height={17} strokeWidth={2} aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1">
        {titulo && <span className="font-semibold">{titulo}: </span>}
        {alerta.texto}
      </span>
    </>
  )
  return to ? (
    <Link to={to} className={clsx(cls, 'transition active:scale-[0.985]')}>
      {contenido}
    </Link>
  ) : (
    <div className={cls}>{contenido}</div>
  )
}
