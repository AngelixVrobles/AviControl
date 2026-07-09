import { Link } from 'react-router-dom'
import type { LoteConMetrics } from '../lib/hooks'
import { money, num, pct } from '../lib/format'
import { Pill } from './ui'
import { IconChevron, IconEgg, IconScale } from './icons'

export function LoteCard({ data }: { data: LoteConMetrics }) {
  const { lote, metrics } = data
  const engorde = lote.tipo === 'engorde'
  const gananciaPos = metrics.ganancia >= 0

  return (
    <Link
      to={`/lotes/${lote.id}`}
      className="block rounded-xl2 border border-line bg-paper-raised p-4 shadow-card transition active:scale-[0.985]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={
              'grid h-11 w-11 place-items-center rounded-full ' +
              (engorde ? 'bg-forest-50 text-forest-600' : 'bg-amber-400/15 text-amber-600')
            }
          >
            {engorde ? <IconScale width={22} height={22} /> : <IconEgg width={22} height={22} />}
          </div>
          <div>
            <div className="font-display text-[17px] font-semibold leading-tight">{lote.nombre}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
              <Pill tone={engorde ? 'engorde' : 'ponedora'}>
                {engorde ? 'Engorde' : 'Ponedora'}
              </Pill>
              <span>Día {metrics.dias}</span>
            </div>
          </div>
        </div>
        <IconChevron width={20} height={20} className="mt-1 text-ink-faint" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Mini label="Aves vivas" value={num(metrics.avesVivas)} />
        {engorde ? (
          <Mini label="FCA" value={metrics.fca != null ? num(metrics.fca, 2) : '—'} />
        ) : (
          <Mini label="Postura" value={metrics.posturaPct != null ? pct(metrics.posturaPct, 0) : '—'} />
        )}
        <Mini
          label={gananciaPos ? 'Ganancia' : 'Pérdida'}
          value={money(metrics.ganancia, { compact: true })}
          tone={gananciaPos ? 'ok' : 'bad'}
        />
      </div>
    </Link>
  )
}

function Mini({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'ok' | 'bad'
}) {
  return (
    <div>
      <div
        className={
          'font-display text-[19px] font-semibold tnum leading-none ' +
          (tone === 'ok' ? 'text-forest-600' : tone === 'bad' ? 'text-clay-deep' : 'text-ink')
        }
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-ink-faint">{label}</div>
    </div>
  )
}
