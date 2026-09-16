import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { Aplicacion, Lote } from '../db/schema'
import type { LoteMetrics } from '../lib/metrics'
import { money, num, pct, plural } from '../lib/format'
import { LB_POR_QUINTAL } from '../lib/standards'

export function FichasNav({
  lote,
  metrics,
  aplicaciones,
}: {
  lote: Lote
  metrics: LoteMetrics
  aplicaciones: Aplicacion[]
}) {
  const fichas = [
    { tipo: 'aves', titulo: 'Aves', valor: pct(metrics.mortalidadPct, 1), pie: 'de baja', ancho: false },
    {
      tipo: 'alimento',
      titulo: 'Alimento',
      valor: `${num(metrics.alimentoTotalLb / LB_POR_QUINTAL, 1)} qq`,
      pie: 'consumidos',
    },
    {
      tipo: 'sanidad',
      titulo: 'Sanidad',
      valor: num(aplicaciones.length),
      pie: plural(aplicaciones.length, 'aplicación', 'aplicaciones'),
    },
    {
      tipo: 'gastos',
      titulo: 'Gastos',
      valor: money(metrics.costos, { compact: true }),
      pie: 'en el ciclo',
    },
    // El espacio y el equipo son para manejar aves vivas: en un ciclo terminado
    // no hay nada que dimensionar.
    ...(lote.estado === 'activo'
      ? [
          {
            tipo: 'galpon',
            titulo: 'Galpón',
            valor: `${num(metrics.avesVivas)} ${plural(metrics.avesVivas, 'ave', 'aves')}`,
            pie: 'espacio y equipo',
            ancho: true,
          },
        ]
      : []),
  ]

  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {fichas.map((f, i) => (
        <Link
          key={f.tipo}
          style={{ animationDelay: `${i * 45}ms` }}
          to={`/lotes/${lote.id}/ficha/${f.tipo}`}
          className={clsx(
            'animate-rise rounded-xl2 border border-line bg-paper-raised p-3.5 transition active:scale-[0.98]',
            f.ancho && 'col-span-2',
          )}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-ink-soft">{f.titulo}</span>
            <span className="text-ink-faint">›</span>
          </div>
          <div className="mt-1.5 font-display text-xl font-semibold leading-none tnum">
            {f.valor}
          </div>
          <div className="mt-1 text-xs text-ink-faint">{f.pie}</div>
        </Link>
      ))}
    </div>
  )
}
