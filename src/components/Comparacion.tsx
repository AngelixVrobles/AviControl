import { clsx } from 'clsx'
import { Link } from 'react-router-dom'
import type { LoteConMetrics } from '../lib/hooks'
import type { LoteMetrics } from '../lib/metrics'
import { fecha, money, num, pct, porLb } from '../lib/format'
import { Banda, Seccion } from './ui'
import { IconTrofeo } from './icons'

interface Metrica {
  label: string
  value: (m: LoteMetrics) => number | undefined
  format: (v: number) => string
  mejor?: 'mayor' | 'menor'
  // En un ciclo activo estas cifras no son finales: el peso es el de hoy y los
  // días son los transcurridos, no la duración del ciclo. Se marca la celda.
  parcialEnActivo?: boolean
}

const METRICAS: Metrica[] = [
  { label: 'IEP', value: (m) => m.iep, format: (v) => num(v, 0), mejor: 'mayor' },
  { label: 'Ganancia', value: (m) => m.ganancia, format: (v) => money(v, { compact: true }), mejor: 'mayor' },
  { label: 'Margen', value: (m) => m.margenPct, format: (v) => pct(v), mejor: 'mayor' },
  {
    label: 'Ganancia / ave',
    value: (m) => (m.cantidadInicial > 0 ? m.ganancia / m.cantidadInicial : undefined),
    format: (v) => money(v),
    mejor: 'mayor',
  },
  { label: 'FCA', value: (m) => m.fca, format: (v) => num(v, 2), mejor: 'menor' },
  { label: 'Costo / lb', value: (m) => m.costoPorLb, format: (v) => porLb(v), mejor: 'menor' },
  { label: 'Peso final', value: (m) => m.pesoPromedioLb, format: (v) => `${num(v, 2)} lb`, mejor: 'mayor', parcialEnActivo: true },
  { label: 'Mortalidad', value: (m) => m.mortalidadPct, format: (v) => pct(v), mejor: 'menor' },
  { label: 'Días', value: (m) => m.dias, format: (v) => num(v), parcialEnActivo: true },
  { label: 'Aves', value: (m) => m.cantidadInicial, format: (v) => num(v) },
]

export function ComparacionLotes({ resumen }: { resumen: LoteConMetrics[] }) {
  if (resumen.length < 2) return null
  const lotes = [...resumen].sort(
    (a, b) => (b.metrics.iep ?? -Infinity) - (a.metrics.iep ?? -Infinity),
  )

  return (
    <>
      <Seccion className="mb-3 mt-8" etiqueta="Comparar ciclos" />
      <Banda className="overflow-x-auto no-scrollbar">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 border-r border-line bg-paper-raised px-5 py-3" />
              {lotes.map((l, i) => (
                <th key={l.lote.id} scope="col" className="min-w-[124px] px-3 py-3 text-right align-top">
                  <Link to={`/lotes/${l.lote.id}`} className="block">
                    <div className="flex items-center justify-end gap-1 font-display text-sm font-semibold leading-tight">
                      {i === 0 && (
                        <IconTrofeo
                          width={14}
                          height={14}
                          strokeWidth={2}
                          className="shrink-0 text-forest-600"
                          aria-label="Mejor ciclo"
                        />
                      )}
                      <span className="max-w-[13ch] truncate">{l.lote.nombre}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-normal text-ink-soft">
                      {fecha(l.lote.fechaInicio)}
                      {l.lote.estado === 'cerrado' ? ' · cerrado' : ' · en curso'}
                    </div>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line tnum">
            {METRICAS.map((met) => {
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
                    className="sticky left-0 z-10 whitespace-nowrap border-r border-line bg-paper-raised px-5 py-2.5 text-left text-sm font-normal text-ink-faint"
                  >
                    {met.label}
                  </th>
                  {valores.map((v, i) => {
                    const parcial = met.parcialEnActivo && lotes[i].lote.estado === 'activo'
                    return (
                      <td
                        key={i}
                        className={clsx(
                          'px-3 py-2.5 text-right',
                          v != null && v === best ? 'font-semibold text-forest-600' : 'text-ink-soft',
                        )}
                      >
                        {v != null ? met.format(v) : '—'}
                        {parcial && v != null && (
                          <span className="ml-1 text-xs font-normal text-ink-soft">hoy</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </Banda>
      <p className="mt-2 text-sm text-ink-soft">
        En verde, el mejor valor de cada indicador. «hoy» marca lo que aún no es final. Toca un ciclo para abrirlo.
      </p>
    </>
  )
}
