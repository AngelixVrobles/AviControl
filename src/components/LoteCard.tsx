import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import type { LoteConMetrics } from '../lib/hooks'
import { fecha, money, num, plural } from '../lib/format'
import { RAZA } from '../lib/labels'
import { desviaciones } from '../lib/desviaciones'
import { agruparHitos, hitosEngorde } from '../lib/standards'
import { useSettings } from '../lib/hooks'
import { IconChevron } from './icons'

export function LoteCard({ data }: { data: LoteConMetrics }) {
  const { lote, metrics } = data
  const settings = useSettings()
  const total = metrics.diaObjetivo
  const dia = Math.min(metrics.dias, total)
  const pos = (d: number) => `${Math.max(0, Math.min(100, (d / total) * 100))}%`
  const hitos = hitosEngorde(total, settings.planSanitario)
  const marcas = agruparHitos(hitos, total)
  const proximo = hitos.find((h) => h.dia > metrics.dias)
  const tieneDatos = metrics.pesoPromedioLb != null
  const dev = desviaciones(metrics)
  const cerrado = lote.estado === 'cerrado'

  return (
    <Link
      to={`/lotes/${lote.id}`}
      className="block rounded-xl2 border border-line bg-paper-raised p-4 transition active:scale-[0.985]"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="truncate font-display text-lg font-semibold leading-tight">{lote.nombre}</div>
          <div className="mt-0.5 text-sm text-ink-soft tnum">
            {cerrado
              ? `${num(metrics.vendidas)} ${plural(metrics.vendidas, 'ave vendida', 'aves vendidas')}`
              : `${num(metrics.avesVivas)} ${plural(metrics.avesVivas, 'ave', 'aves')}`}{' '}
            · {RAZA}
          </div>
        </div>
        <div className="shrink-0 pl-3 text-right">
          <div className="font-display text-2xl font-semibold leading-none tnum">{metrics.dias}</div>
          <div className="mt-0.5 text-xs text-ink-faint tnum">
            {cerrado ? plural(metrics.dias, 'día', 'días') : `de ${total} días`}
          </div>
        </div>
      </div>

      <div className="mb-1 mt-5">
        <div className="relative h-2.5 rounded-full bg-sunken">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-forest-500"
            style={{ width: pos(dia) }}
          />
          {marcas.slice(1, -1).map((h) => (
            <span
              key={h.dia}
              className="absolute top-[-3px] h-4 w-0.5 rounded bg-paper"
              style={{ left: pos(h.dia) }}
            />
          ))}
          {dia < total && (
            <span
              className="absolute top-[-7px] h-6 w-6 rounded-full border-[3px] border-paper bg-forest-800"
              style={{ left: pos(dia), marginLeft: -12 }}
            />
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs font-semibold text-forest-600">
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
          {cerrado ? (
            <div
              className={clsx(
                'mt-3 flex items-center justify-between rounded-xl px-3.5 py-2.5',
                metrics.ganancia >= 0 ? 'bg-forest-50' : 'bg-clay-tint',
              )}
            >
              <span
                className={clsx(
                  'text-sm font-medium',
                  metrics.ganancia >= 0 ? 'text-forest-800' : 'text-clay-text',
                )}
              >
                {metrics.ganancia >= 0 ? 'Ganancia' : 'Pérdida'}
              </span>
              <span
                className={clsx(
                  'text-sm font-bold tnum',
                  metrics.ganancia >= 0 ? 'text-forest-800' : 'text-clay-text',
                )}
              >
                {money(metrics.ganancia)}
              </span>
            </div>
          ) : (
            metrics.fechaVentaEstimada &&
            metrics.diaVentaEstimado != null && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-forest-50 px-3.5 py-2.5">
                <span className="text-sm font-medium text-forest-800">Venta estimada</span>
                <span className="text-sm font-bold text-forest-800 tnum">
                  {metrics.diaVentaEstimado <= metrics.dias
                    ? 'lista para vender'
                    : `${fecha(metrics.fechaVentaEstimada)} · ${enDias(metrics.diaVentaEstimado - metrics.dias)}`}
                </span>
              </div>
            )
          )}
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-sm text-ink-soft">
            Invertido {money(metrics.costos, { compact: true })}
          </span>
          {proximo && (
            <span className="rounded-full bg-amber-tint px-3 py-1 text-xs font-semibold text-amber-text">
              {proximo.etiqueta} {enDias(proximo.dia - metrics.dias)}
            </span>
          )}
          <IconChevron width={18} height={18} className="text-ink-faint" />
        </div>
      )}
    </Link>
  )
}

function enDias(n: number) {
  if (n <= 0) return 'hoy'
  return `en ${n} ${n === 1 ? 'día' : 'días'}`
}

function Estado({ dev }: { dev: ReturnType<typeof desviaciones>['peso'] }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold leading-none tnum">{dev.valor}</div>
      <div
        className={clsx(
          'mt-1 text-xs font-semibold tnum',
          dev.estado === 'mal' ? 'text-clay-text' : 'text-forest-600',
        )}
      >
        {dev.detalle}
      </div>
    </div>
  )
}
