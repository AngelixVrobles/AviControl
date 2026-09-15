import { Link } from 'react-router-dom'
import type { Aplicacion, Lote } from '../db/schema'
import type { LoteMetrics } from '../lib/metrics'
import { money, num, pct } from '../lib/format'
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
    { tipo: 'aves', titulo: 'Aves', valor: pct(metrics.mortalidadPct, 1), pie: 'de baja' },
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
      pie: aplicaciones.length === 1 ? 'aplicación' : 'aplicaciones',
    },
    {
      tipo: 'gastos',
      titulo: 'Gastos',
      valor: money(metrics.costos, { compact: true }),
      pie: 'en el ciclo',
    },
  ]

  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {fichas.map((f) => (
        <Link
          key={f.tipo}
          to={`/lotes/${lote.id}/ficha/${f.tipo}`}
          className="rounded-xl2 border border-line bg-paper-raised p-3.5 shadow-card transition active:scale-[0.98]"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-ink-soft">{f.titulo}</span>
            <span className="text-ink-faint">›</span>
          </div>
          <div className="mt-1.5 font-display text-[20px] font-semibold leading-none tnum">
            {f.valor}
          </div>
          <div className="mt-1 text-[11px] text-ink-faint">{f.pie}</div>
        </Link>
      ))}
    </div>
  )
}
