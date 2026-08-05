import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { LoteConMetrics } from '../lib/hooks'
import { fecha, money, num } from '../lib/format'
import { RAZA } from '../lib/labels'
import { desviaciones } from '../lib/desviaciones'
import { hitosEngorde } from '../lib/standards'
import { IconChevron } from './icons'

export function LoteCard({ data }: { data: LoteConMetrics }) {
  const { lote, metrics } = data
  const total = metrics.diaObjetivo
  const dia = Math.min(metrics.dias, total)
  const pos = (d: number) => `${Math.max(0, Math.min(100, (d / total) * 100))}%`
  const hitos = hitosEngorde(total)
  const proximo = hitos.find((h) => h.dia > metrics.dias)
  const tieneDatos = metrics.pesoPromedioLb != null
  const dev = desviaciones(metrics)

  return (
    <Link
      to={`/lotes/${lote.id}`}
      className="block rounded-xl2 border border-line bg-paper-raised p-4 shadow-card transition active:scale-[0.985]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate font-display text-[19px] font-semibold leading-tight">{lote.nombre}</div>
          <div className="mt-0.5 text-[13px] text-ink-soft tnum">
            {num(metrics.avesVivas)} aves · {RAZA}
          </div>
        </div>
        <div className="shrink-0 pl-3 text-right">
          <div className="font-display text-[26px] font-semibold leading-none tnum">{metrics.dias}</div>
          <div className="mt-0.5 text-[12px] text-ink-faint tnum">de {total} días</div>
        </div>
      </div>

      <div className="mb-1 mt-5">
        <div className="relative h-2.5 rounded-full bg-sunken">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-green-action"
            style={{ width: pos(dia) }}
          />
          {hitos.slice(1, -1).map((h) => (
            <span
              key={h.dia}
              className="absolute top-[-3px] h-4 w-0.5 rounded bg-paper"
              style={{ left: pos(h.dia) }}
            />
          ))}
          {dia < total && (
            <span
              className="absolute top-[-7px] h-6 w-6 rounded-full border-[3px] border-paper bg-forest-darkest"
              style={{ left: pos(dia), marginLeft: -12 }}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-semibold text-forest-600">
          <span>día 1 · recibo</span>
          <span>{total} · venta</span>
        </div>
      </div>

      {tieneDatos ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            <Estado dev={dev.peso} />
            <Estado dev={dev.fca} />
            <Estado dev={dev.mortalidad} />
          </div>
          {metrics.fechaVentaEstimada && metrics.diaVentaEstimado != null && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-green-tint px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-forest-darkest">Venta estimada</span>
              <span className="text-[13px] font-bold text-forest-darkest tnum">
                {metrics.diaVentaEstimado <= metrics.dias
                  ? 'lista para vender'
                  : `${fecha(metrics.fechaVentaEstimada)} · ${enDias(metrics.diaVentaEstimado - metrics.dias)}`}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-[13px] text-ink-soft">
            {gananciaLabel(metrics.ganancia)} {money(metrics.ganancia, { compact: true })}
          </span>
          {proximo && (
            <span className="rounded-full bg-amber-tint px-3 py-1 text-[12px] font-semibold text-amber-text">
              {proximo.etiqueta} {enDias(proximo.dia - metrics.dias)}
            </span>
          )}
          <IconChevron width={18} height={18} className="text-ink-faint" />
        </div>
      )}
    </Link>
  )
}

function gananciaLabel(g: number) {
  return g >= 0 ? 'Ganancia' : 'Pérdida'
}

function enDias(n: number) {
  if (n <= 0) return 'hoy'
  return `en ${n} ${n === 1 ? 'día' : 'días'}`
}

function Estado({ dev }: { dev: ReturnType<typeof desviaciones>['peso'] }) {
  return (
    <div>
      <div className="font-display text-[20px] font-semibold leading-none tnum">{dev.valor}</div>
      <div
        className={clsx(
          'mt-1 text-[12px] font-semibold tnum',
          dev.estado === 'mal' ? 'text-clay-text' : 'text-green-text',
        )}
      >
        {dev.detalle}
      </div>
    </div>
  )
}
