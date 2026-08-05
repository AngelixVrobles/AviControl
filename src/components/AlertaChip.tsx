import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { Alerta } from '../lib/alerts'
import { IconAlerta, IconVacuna } from './icons'

const tonos = {
  bad: 'border-clay-line border-l-4 border-l-clay bg-clay-tint text-clay-text',
  warn: 'border-amber-line border-l-4 border-l-amber bg-amber-tint text-amber-text',
  info: 'border-green-tint-line border-l-4 border-l-green-action bg-green-tint text-forest-darkest',
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
