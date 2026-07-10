import { useState } from 'react'
import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { TipoLote } from '../db/schema'
import type { LoteConMetrics } from '../lib/hooks'
import type { LoteMetrics } from '../lib/metrics'
import { fecha, money, num, pct } from '../lib/format'
import { Card } from './ui'
import { IconTrofeo } from './icons'

interface Metrica {
  label: string
  value: (m: LoteMetrics) => number | undefined
  format: (v: number) => string
  mejor?: 'mayor' | 'menor'
}

const COMUNES_FIN: Metrica[] = [
  { label: 'Ganancia', value: (m) => m.ganancia, format: (v) => money(v, { compact: true }), mejor: 'mayor' },
  { label: 'Margen', value: (m) => m.margenPct, format: (v) => pct(v), mejor: 'mayor' },
  {
    label: 'Ganancia / ave',
    value: (m) => (m.cantidadInicial > 0 ? m.ganancia / m.cantidadInicial : undefined),
    format: (v) => money(v),
    mejor: 'mayor',
  },
]

const COMUNES_FIN_CIERRE: Metrica[] = [
  { label: 'Mortalidad', value: (m) => m.mortalidadPct, format: (v) => pct(v), mejor: 'menor' },
  { label: 'Días', value: (m) => m.dias, format: (v) => num(v) },
  { label: 'Aves', value: (m) => m.cantidadInicial, format: (v) => num(v) },
]

const METRICAS: Record<TipoLote, Metrica[]> = {
  engorde: [
    ...COMUNES_FIN,
    { label: 'FCA', value: (m) => m.fca, format: (v) => num(v, 2), mejor: 'menor' },
    { label: 'Costo / lb', value: (m) => m.costoPorLb, format: (v) => money(v), mejor: 'menor' },
    { label: 'Peso final', value: (m) => m.pesoPromedioLb, format: (v) => `${num(v, 2)} lb`, mejor: 'mayor' },
    ...COMUNES_FIN_CIERRE,
  ],
  ponedora: [
    ...COMUNES_FIN,
    { label: 'Costo / huevo', value: (m) => m.costoPorHuevo, format: (v) => money(v), mejor: 'menor' },
    { label: 'Huevos totales', value: (m) => m.huevosTotal, format: (v) => num(v), mejor: 'mayor' },
    {
      label: 'Huevos / ave',
      value: (m) =>
        m.huevosTotal && m.cantidadInicial > 0 ? m.huevosTotal / m.cantidadInicial : undefined,
      format: (v) => num(v, 1),
      mejor: 'mayor',
    },
    ...COMUNES_FIN_CIERRE,
  ],
}

export function ComparacionLotes({ resumen }: { resumen: LoteConMetrics[] }) {
  const porTipo: Record<TipoLote, LoteConMetrics[]> = {
    engorde: resumen.filter((r) => r.lote.tipo === 'engorde'),
    ponedora: resumen.filter((r) => r.lote.tipo === 'ponedora'),
  }
  const tipos = (['engorde', 'ponedora'] as TipoLote[]).filter((t) => porTipo[t].length >= 2)
  const [tipoSel, setTipoSel] = useState<TipoLote>()
  const tipo = tipoSel && tipos.includes(tipoSel) ? tipoSel : tipos[0]
  if (!tipo) return null

  const lotes = [...porTipo[tipo]].sort((a, b) => b.metrics.ganancia - a.metrics.ganancia)

  return (
    <>
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Comparar lotes</h2>
        {tipos.length > 1 && (
          <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
            {tipos.map((t) => (
              <button
                key={t}
                onClick={() => setTipoSel(t)}
                className={clsx(
                  'rounded-full px-4 py-2.5 text-[13px] font-semibold transition',
                  tipo === t ? 'bg-paper-raised text-ink shadow-card' : 'text-ink-faint',
                )}
              >
                {t === 'engorde' ? 'Engorde' : 'Ponedoras'}
              </button>
            ))}
          </div>
        )}
      </div>
      <Card className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 border-r border-line bg-paper-raised px-4 py-3" />
              {lotes.map((l, i) => (
                <th key={l.lote.id} scope="col" className="min-w-[124px] px-3 py-3 text-right align-top">
                  <Link to={`/lotes/${l.lote.id}`} className="block">
                    <div className="flex items-center justify-end gap-1 font-display text-[13px] font-semibold leading-tight">
                      {i === 0 && (
                        <IconTrofeo
                          width={14}
                          height={14}
                          strokeWidth={2}
                          className="shrink-0 text-amber-500"
                          aria-label="Mejor lote"
                        />
                      )}
                      <span className="max-w-[13ch] truncate">{l.lote.nombre}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-normal text-ink-faint">
                      {fecha(l.lote.fechaInicio)}
                      {l.lote.estado === 'cerrado' ? ' · cerrado' : ''}
                    </div>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line tnum">
            {METRICAS[tipo].map((met) => {
              const valores = lotes.map((l) => met.value(l.metrics))
              const definidos = valores.filter((v): v is number => v != null)
              const best =
                met.mejor && definidos.length > 1
                  ? met.mejor === 'mayor'
                    ? Math.max(...definidos)
                    : Math.min(...definidos)
                  : undefined
              return (
                <tr key={met.label}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap border-r border-line bg-paper-raised px-4 py-2.5 text-left text-[13px] font-normal text-ink-faint"
                  >
                    {met.label}
                  </th>
                  {valores.map((v, i) => (
                    <td
                      key={i}
                      className={clsx(
                        'px-3 py-2.5 text-right',
                        v != null && v === best
                          ? 'font-semibold text-forest-600'
                          : 'text-ink-soft',
                      )}
                    >
                      {v != null ? met.format(v) : '—'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-ink-faint">
        En verde, el mejor valor de cada indicador. Toca un lote para abrirlo.
      </p>
    </>
  )
}
