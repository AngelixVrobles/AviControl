import { useLiveQuery } from 'dexie-react-hooks'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { db } from '../db/schema'
import { useResumen } from '../lib/hooks'
import { agruparGastos } from '../lib/metrics'
import { money } from '../lib/format'
import { CHART_COLORS, categoriaLabel } from '../lib/labels'
import { reduceMotion } from '../lib/motion'
import { Card, EmptyState } from '../components/ui'
import { IconChart } from '../components/icons'
import { ComparacionLotes } from '../components/Comparacion'

export function Reportes() {
  const resumen = useResumen()
  const gastos = useLiveQuery(() => db.gastos.toArray(), [])

  if (!resumen || !gastos)
    return (
      <div role="status" aria-label="Cargando" className="animate-pulse pt-3">
        <div className="h-8 w-40 rounded-lg bg-paper-sunken" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl2 bg-paper-sunken" />
          ))}
        </div>
        <div className="mt-7 h-56 rounded-xl2 bg-paper-sunken" />
      </div>
    )

  if (resumen.length === 0) {
    return (
      <div className="pt-3">
        <h1 className="mb-4 font-display text-[26px] font-semibold">Reportes</h1>
        <EmptyState
          icon={<IconChart width={28} height={28} />}
          title="Sin datos todavía"
          text="Crea lotes y registra movimientos para ver tus reportes."
        />
      </div>
    )
  }

  const ingresos = resumen.reduce((a, r) => a + r.metrics.ingresos, 0)
  const costos = resumen.reduce((a, r) => a + r.metrics.costos, 0)
  const ganancia = ingresos - costos

  const porLote = resumen.map((r) => ({
    nombre: r.lote.nombre.replace(/^Lote\s*/i, ''),
    ganancia: Math.round(r.metrics.ganancia),
  }))

  const catData = agruparGastos(gastos).map((g) => ({
    name: categoriaLabel(g.categoria),
    value: Math.round(g.total),
  }))

  return (
    <div className="animate-rise pt-3">
      <h1 className="font-display text-[26px] font-semibold">Reportes</h1>
      <p className="mt-1 text-sm text-ink-faint">Resumen general de la granja</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Totales label="Ingresos" value={money(ingresos, { compact: true })} tone="ink" />
        <Totales label="Costos" value={money(costos, { compact: true })} tone="ink" />
        <Totales
          label={ganancia >= 0 ? 'Ganancia' : 'Pérdida'}
          value={money(ganancia, { compact: true })}
          tone={ganancia >= 0 ? 'ok' : 'bad'}
        />
      </div>

      <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Ganancia por lote</h2>
      <Card className="p-4 pt-5">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={porLote} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="nombre"
              tick={{ fontSize: 11, fill: '#5C6A61' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: '#EEEBE2' }}
              formatter={(v) => [money(Number(v)), 'Ganancia'] as [string, string]}
              contentStyle={tooltipStyle}
            />
            <Bar
              dataKey="ganancia"
              radius={[6, 6, 0, 0]}
              maxBarSize={64}
              animationDuration={600}
              animationEasing="ease-out"
              isAnimationActive={!reduceMotion}
            >
              {porLote.map((d, i) => (
                <Cell key={i} fill={d.ganancia >= 0 ? '#2F8A4C' : '#C4622D'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {catData.length > 0 && (
        <>
          <h2 className="mb-3 mt-7 font-display text-lg font-semibold">Distribución de gastos</h2>
          <Card className="flex items-center gap-2 p-4">
            <div className="w-[45%] shrink-0">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={catData}
                    dataKey="value"
                    innerRadius={38}
                    outerRadius={62}
                    paddingAngle={2}
                    stroke="none"
                    animationDuration={600}
                    isAnimationActive={!reduceMotion}
                  >
                    {catData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {catData.map((c, i) => (
                <li key={c.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="flex-1 truncate text-ink-soft">{c.name}</span>
                  <span className="font-medium tnum">{money(c.value, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <ComparacionLotes resumen={resumen} />
    </div>
  )
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E3DFD3',
  background: '#FCFBF7',
  fontSize: 13,
  boxShadow: '0 8px 24px -12px rgba(27,43,34,0.2)',
}

function Totales({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ink' | 'ok' | 'bad'
}) {
  return (
    <Card className="p-3.5">
      <div
        className={
          'font-display text-[19px] font-semibold tnum leading-none ' +
          (tone === 'ok' ? 'text-forest-600' : tone === 'bad' ? 'text-clay-deep' : 'text-ink')
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-ink-faint">{label}</div>
    </Card>
  )
}
